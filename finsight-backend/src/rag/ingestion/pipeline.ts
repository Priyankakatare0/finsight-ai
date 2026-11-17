import { DocumentModel } from "../../models/Document.model";
import { ChunkModel } from "../../models/Chunk.model";
import { defaultStorageProvider } from "../../providers/storage";
import { parsePdf } from "./parser";
import { chunkDocument } from "./chunker";
import { embedBatchWithRetry, DEFAULT_BATCH_SIZE } from "./embedder";

/**
 * Orchestrates the full document ingestion pipeline:
 * 1. Delete old chunks (idempotent re-run safety)
 * 2. Set status = parsing → parse PDF
 * 3. Set status = chunking → chunk text
 * 4. Set status = embedding → embed & save in batches, updating progress.percent
 * 5. Set status = indexed, save pageCount and chunkCount
 * 6. On error: status = failed and save errorMessage
 *
 * @param documentId - The MongoDB ObjectId string of the Document
 */
export async function runPipeline(documentId: string): Promise<void> {
  const document = await DocumentModel.findById(documentId);
  if (!document) {
    throw new Error(`Document with ID ${documentId} not found`);
  }

  try {
    // ------------------------------------------------------------------------
    // 1. Delete old chunks of this document (ensures safe re-runs & retries)
    // ------------------------------------------------------------------------
    await ChunkModel.deleteMany({ documentId: document._id });

    // ------------------------------------------------------------------------
    // 2. Set status = parsing → parse
    // ------------------------------------------------------------------------
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: "parsing",
      progress: 10,
      errorMessage: undefined,
    });

    const fileBuffer = await defaultStorageProvider.read(document.storageKey);
    const parseResult = await parsePdf(fileBuffer);

    await DocumentModel.findByIdAndUpdate(documentId, {
      pageCount: parseResult.pageCount,
      progress: 25,
    });

    // ------------------------------------------------------------------------
    // 3. Set status = chunking → chunk
    // ------------------------------------------------------------------------
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: "chunking",
      progress: 30,
    });

    const chunks = chunkDocument(parseResult.pages, {
      size: 2400,
      overlap: 400,
    });

    if (chunks.length === 0) {
      throw new Error("No text content could be extracted from the document");
    }

    await DocumentModel.findByIdAndUpdate(documentId, {
      chunkCount: chunks.length,
      progress: 40,
    });

    // ------------------------------------------------------------------------
    // 4. Set status = embedding → embed and save, updating progress as batches finish
    // ------------------------------------------------------------------------
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: "embedding",
      progress: 45,
    });

    const batchSize = DEFAULT_BATCH_SIZE; // 64 chunks per batch
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // 7.4 Add metadata context header to each chunk before embedding
      const contextPrefix = `[${document.company} | ${document.docType}${document.fiscalYear ? ` | FY${document.fiscalYear}` : ""}${document.fiscalQuarter ? ` ${document.fiscalQuarter}` : ""}]`;
      const batchTexts = batch.map((c) => `${contextPrefix}\n${c.content}`);

      // Embed current batch with 3-try exponential backoff
      const batchVectors = await embedBatchWithRetry(batchTexts);

      // Map to chunk database documents
      const batchDocuments = batch.map((chunk, index) => ({
        userId: document.userId,
        documentId: document._id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.text,
        text: chunk.text, // compatibility alias
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        company: document.company,
        docType: document.docType,
        fiscalYear: document.fiscalYear,
        fiscalQuarter: document.fiscalQuarter,
        embedding: batchVectors[index] || [],
      }));

      // Unordered bulk insert for maximum throughput
      await ChunkModel.insertMany(batchDocuments, { ordered: false });

      processedChunks += batch.length;

      // Dynamically calculate progress between 45% and 95%
      const currentProgress = Math.min(
        95,
        Math.round(45 + (processedChunks / chunks.length) * 50)
      );

      await DocumentModel.findByIdAndUpdate(documentId, {
        progress: currentProgress,
      });
    }

    // ------------------------------------------------------------------------
    // 5. Set status = indexed, save chunkCount and pageCount
    // ------------------------------------------------------------------------
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: "indexed",
      progress: 100,
      pageCount: parseResult.pageCount,
      chunkCount: chunks.length,
      errorMessage: undefined,
    });

    console.log(
      `[Pipeline] ✅ Document ${documentId} (${document.company} - ${document.title}) successfully indexed: ${parseResult.pageCount} pages, ${chunks.length} chunks.`
    );
  } catch (error: any) {
    console.error(`[Pipeline] ❌ Failed processing document ${documentId}:`, error?.message || error);

    // ------------------------------------------------------------------------
    // 6. On error: status = failed and save errorMessage
    // ------------------------------------------------------------------------
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: "failed",
      errorMessage: error?.message || "Unknown error occurred during ingestion pipeline",
    });

    // Re-throw so BullMQ records job failure and triggers retry backoff
    throw error;
  }
}

export default runPipeline;
