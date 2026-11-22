import mongoose, { type Types } from "mongoose";
import { ChunkModel } from "../../models/Chunk.model";
import { generateQueryEmbedding, enforceDimensions } from "../ingestion/embedder";

export const VECTOR_INDEX_NAME = "chunks_vector_idx";

export interface RetrievedChunk {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  text?: string | undefined;
  pageStart: number;
  pageEnd: number;
  company: string;
  docType: string;
  fiscalYear?: number | undefined;
  fiscalQuarter?: string | undefined;
  score: number;
  metadata?: Record<string, unknown> | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface RetrievalFilters {
  documentId?: string | Types.ObjectId | (string | Types.ObjectId)[] | undefined;
  docType?: string | string[] | undefined;
  fiscalYear?: number | number[] | undefined;
  fiscalQuarter?: string | string[] | undefined;
}

export interface RetrievalOptions {
  /**
   * The authenticated user's ID for tenant isolation.
   */
  userId: string | Types.ObjectId;

  /**
   * Pre-computed embedding vector of the question.
   * If omitted, `query` string must be provided.
   */
  queryVector?: number[] | undefined;

  /**
   * Raw question / search string.
   * If provided and queryVector is omitted, it will be embedded via generateQueryEmbedding().
   */
  query?: string | undefined;

  /**
   * Number of nearest candidates to consider in the vector search.
   * Default: 200 (Atlas Search requires numCandidates >= limit)
   */
  numCandidates?: number | undefined;

  /**
   * Maximum candidate chunks to retrieve from the vector index.
   * Default: 20
   */
  limit?: number | undefined;

  /**
   * Number of top chunks to select for generation context.
   * Default: 5 (typically top 5 or 6)
   */
  topK?: number | undefined;

  /**
   * Optional minimum cosine similarity score threshold (0.0 to 1.0).
   */
  minScore?: number | undefined;

  /**
   * Name of the vector search index.
   * Default: 'chunks_vector_idx'
   */
  indexName?: string | undefined;

  /**
   * Optional metadata filter criteria (documentId, docType, fiscalYear, fiscalQuarter).
   */
  filters?: RetrievalFilters | undefined;
}

export interface RetrievalResult {
  queryVector: number[];
  totalRetrieved: number;
  chunks: RetrievedChunk[];
  contextChunks: RetrievedChunk[];
  context: string;
}

/**
 * Builds the Atlas Vector Search filter query matching Section 10.3 and Step 8.2 specs.
 */
export function buildVectorSearchFilter(
  userId: string | Types.ObjectId,
  filters?: RetrievalFilters
): Record<string, unknown> {
  const userObjectId =
    typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const conditions: Record<string, unknown>[] = [
    { userId: { $eq: userObjectId } },
  ];

  if (filters?.documentId) {
    if (Array.isArray(filters.documentId)) {
      const docObjectIds = filters.documentId
        .map((id) => (typeof id === "string" ? new mongoose.Types.ObjectId(id) : id))
        .filter(Boolean);
      if (docObjectIds.length === 1) {
        conditions.push({ documentId: { $eq: docObjectIds[0] } });
      } else if (docObjectIds.length > 1) {
        conditions.push({ documentId: { $in: docObjectIds } });
      }
    } else {
      const docObjectId =
        typeof filters.documentId === "string"
          ? new mongoose.Types.ObjectId(filters.documentId)
          : filters.documentId;
      conditions.push({ documentId: { $eq: docObjectId } });
    }
  }

  if (filters?.docType) {
    if (Array.isArray(filters.docType)) {
      conditions.push({ docType: { $in: filters.docType } });
    } else {
      conditions.push({ docType: { $eq: filters.docType } });
    }
  }

  if (filters?.fiscalYear !== undefined) {
    if (Array.isArray(filters.fiscalYear)) {
      conditions.push({ fiscalYear: { $in: filters.fiscalYear } });
    } else {
      conditions.push({ fiscalYear: { $eq: filters.fiscalYear } });
    }
  }

  if (filters?.fiscalQuarter) {
    if (Array.isArray(filters.fiscalQuarter)) {
      conditions.push({ fiscalQuarter: { $in: filters.fiscalQuarter } });
    } else {
      conditions.push({ fiscalQuarter: { $eq: filters.fiscalQuarter } });
    }
  }

  return conditions.length === 1 ? conditions[0]! : { $and: conditions };
}

/**
 * Formats a list of retrieved chunks into a clean, structured context string for LLM prompting.
 */
export function formatChunksAsContext(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return "";
  }

  return chunks
    .map((chunk, idx) => {
      const yearStr = chunk.fiscalYear ? ` FY${chunk.fiscalYear}` : "";
      const qtrStr = chunk.fiscalQuarter ? ` ${chunk.fiscalQuarter}` : "";
      const pageStr =
        chunk.pageStart === chunk.pageEnd
          ? `Page ${chunk.pageStart}`
          : `Pages ${chunk.pageStart}-${chunk.pageEnd}`;

      const header = `[Source ${idx + 1}: ${chunk.company || "Document"} | ${
        chunk.docType || "Report"
      }${yearStr}${qtrStr} | ${pageStr} | Score: ${
        typeof chunk.score === "number" ? chunk.score.toFixed(4) : "N/A"
      }]`;

      const text = (chunk.content || chunk.text || "").trim();
      return `${header}\n${text}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Step 8.2: Retrieval function
 *
 * Executes Atlas $vectorSearch on the chunks collection using 'chunks_vector_idx',
 * applies user isolation and optional metadata filters, projects vectorSearchScore,
 * and extracts the top 5 or 6 results for context.
 */
export async function retrieveContext(
  options: RetrievalOptions
): Promise<RetrievalResult> {
  const {
    userId,
    query,
    numCandidates = 200,
    limit = 20,
    topK = 5,
    minScore,
    indexName = VECTOR_INDEX_NAME || "chunks_vector_idx",
    filters,
  } = options;

  if (!userId) {
    throw new Error("userId is required for vector retrieval isolation");
  }

  // 1. Resolve query vector
  let queryVector = options.queryVector;
  if (!queryVector || queryVector.length === 0) {
    if (!query || query.trim().length === 0) {
      throw new Error("Either 'queryVector' or 'query' must be provided for retrieval");
    }
    queryVector = await generateQueryEmbedding(query);
  }

  // Ensure query vector matches the vector index dimensions (1536)
  queryVector = enforceDimensions(queryVector, 1536);

  // 2. Build Atlas Vector Search filter
  const filter = buildVectorSearchFilter(userId, filters);

  // 3. Construct the aggregation pipeline matching Step 8.2 exact spec:
  //    - $vectorSearch with index, path, queryVector, numCandidates, limit, filter
  //    - $project with embedding: 0, score: { $meta: 'vectorSearchScore' }
  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: indexName,
        path: "embedding",
        queryVector,
        numCandidates,
        limit,
        filter,
      },
    },
    {
      $project: {
        embedding: 0,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  try {
    let rawResults = await ChunkModel.aggregate<RetrievedChunk>(pipeline);

    // Soft fallback: if strict metadata filter (e.g. fiscalYear, docType) returned 0 results,
    // retry with user & documentId isolation to avoid false negative refusals.
    if (
      rawResults.length === 0 &&
      filters &&
      (filters.fiscalYear !== undefined || filters.docType !== undefined || filters.fiscalQuarter !== undefined)
    ) {
      const relaxedFilter = buildVectorSearchFilter(userId, { documentId: filters.documentId });
      const relaxedPipeline = [
        {
          $vectorSearch: {
            index: indexName,
            path: "embedding",
            queryVector,
            numCandidates,
            limit,
            filter: relaxedFilter,
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];
      try {
        const relaxedResults = await ChunkModel.aggregate<RetrievedChunk>(relaxedPipeline);
        if (relaxedResults.length > 0) {
          rawResults = relaxedResults;
        }
      } catch {
        // Ignore relaxed retry failure
      }
    }

    // 4. Optional score thresholding
    let candidates = rawResults;
    if (typeof minScore === "number" && minScore > 0) {
      candidates = candidates.filter((item) => (item.score ?? 0) >= minScore);
    }

    // 5. Select top K results as context (typically top 5 or 6)
    const contextChunks = candidates.slice(0, Math.max(1, topK));

    // 6. Generate formatted context string ready for LLM consumption
    const context = formatChunksAsContext(contextChunks);

    return {
      queryVector,
      totalRetrieved: rawResults.length,
      chunks: rawResults,
      contextChunks,
      context,
    };
  } catch (error: any) {
    if (
      error?.message?.includes("$vectorSearch") ||
      error?.codeName === "CommandNotSupported" ||
      error?.code === 40324
    ) {
      throw new Error(
        `Atlas Vector Search execution failed: ${error.message}. ` +
        `Ensure MongoDB Atlas Local / Atlas is running and the search index '${indexName}' is in 'READY' state.`
      );
    }
    throw error;
  }
}

/**
 * Shorthand helper to directly retrieve the top context chunks.
 */
export async function retrieveTopChunks(
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  const result = await retrieveContext(options);
  return result.contextChunks;
}

export default retrieveContext;
