import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import type { SearchIndexDescription } from "mongodb";
import { env } from "../src/config/env";
import { ChunkModel } from "../src/models/Chunk.model";
import { DocumentModel } from "../src/models/Document.model";
import { User as UserModel } from "../src/models/User.model";
import { RefreshToken as RefreshTokenModel } from "../src/models/RefreshToken.model";
import { ConversationModel } from "../src/models/Conversation.model";
import { MessageModel } from "../src/models/Message.model";

/**
 * Step 8: Search (Vector Index and Retrieval)
 * 8.1 Vector Index Definition (Spec Section 10.3)
 *
 * Index name: chunks_vector_idx
 * Collection: chunks
 * Vector field: embedding (1536 dimensions, cosine similarity)
 * Filter fields: userId, documentId, docType, fiscalYear, fiscalQuarter
 */

export const VECTOR_INDEX_NAME = "chunks_vector_idx";
export const COLLECTION_NAME = "chunks";
export const DEFAULT_DIMENSIONS = 1536;
export const DEFAULT_SIMILARITY = "cosine" as const;

export interface VectorIndexOptions {
  dimensions?: number;
  recreate?: boolean;
  skipStandardIndexes?: boolean;
}

/**
 * Generates the Atlas Vector Search Index definition matching Section 10.3.
 */
export function getVectorSearchDefinition(dimensions: number = DEFAULT_DIMENSIONS) {
  return {
    fields: [
      {
        type: "vector" as const,
        path: "embedding",
        numDimensions: dimensions,
        similarity: DEFAULT_SIMILARITY,
      },
      {
        type: "filter" as const,
        path: "userId",
      },
      {
        type: "filter" as const,
        path: "documentId",
      },
      {
        type: "filter" as const,
        path: "docType",
      },
      {
        type: "filter" as const,
        path: "fiscalYear",
      },
      {
        type: "filter" as const,
        path: "fiscalQuarter",
      },
    ],
  };
}

/**
 * Syncs standard B-tree / Mongoose schema indexes across all collections.
 */
export async function syncStandardIndexes(): Promise<void> {
  console.log("🔄 Syncing standard Mongoose schema indexes...");
  try {
    const results = await Promise.allSettled([
      UserModel.syncIndexes(),
      DocumentModel.syncIndexes(),
      ChunkModel.syncIndexes(),
      RefreshTokenModel.syncIndexes(),
      ConversationModel.syncIndexes(),
      MessageModel.syncIndexes(),
    ]);

    const names = ["User", "Document", "Chunk", "RefreshToken", "Conversation", "Message"];
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        console.log(`  ✓ ${names[i]} indexes synchronized`);
      } else {
        console.warn(`  ⚠️ Warning syncing ${names[i]} indexes:`, res.reason?.message || res.reason);
      }
    });
    console.log("✅ Standard schema indexes synced.\n");
  } catch (error: any) {
    console.warn("⚠️ Non-fatal error while syncing standard indexes:", error?.message || error);
  }
}

/**
 * Creates or updates the vector search index `chunks_vector_idx` on the `chunks` collection.
 */
export async function createVectorSearchIndex(options: VectorIndexOptions = {}): Promise<void> {
  const dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  const recreate = options.recreate ?? false;

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB database instance not found. Ensure mongoose is connected.");
  }

  const chunksCollection = db.collection(COLLECTION_NAME);
  const definition = getVectorSearchDefinition(dimensions);

  console.log(`🔍 Checking existing search indexes on '${COLLECTION_NAME}' collection...`);

  let existingIndex: any = null;
  try {
    const cursor = chunksCollection.listSearchIndexes();
    const allSearchIndexes = await cursor.toArray();
    existingIndex = allSearchIndexes.find(
      (idx: any) => idx.name === VECTOR_INDEX_NAME
    );
  } catch (listError: any) {
    // If the server does not support listSearchIndexes command
    if (
      listError?.code === 59 ||
      listError?.codeName === "CommandNotFound" ||
      listError?.message?.includes("no such command")
    ) {
      console.warn(
        `\n⚠️ The connected MongoDB server does not support Atlas Search index commands ('listSearchIndexes').\n` +
        `   This is expected on standalone local MongoDB Community without Atlas Search/Atlas Local.\n`
      );
      printManualCompassInstructions(definition);
      return;
    }
    console.warn("⚠️ Note while listing search indexes:", listError?.message || listError);
  }

  if (existingIndex) {
    console.log(`ℹ️ Vector index '${VECTOR_INDEX_NAME}' already exists (status: ${existingIndex.status || "active"}, queryable: ${existingIndex.queryable ?? true}).`);

    if (recreate) {
      console.log(`🔄 Flag '--recreate' specified. Dropping existing search index '${VECTOR_INDEX_NAME}'...`);
      try {
        await chunksCollection.dropSearchIndex(VECTOR_INDEX_NAME);
        console.log(`🗑️ Dropped existing '${VECTOR_INDEX_NAME}'. Recreating...`);
        // Small delay to allow Atlas to deregister
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (dropError: any) {
        console.warn(`⚠️ Warning dropping index:`, dropError?.message || dropError);
      }
    } else {
      console.log(`✅ Vector index '${VECTOR_INDEX_NAME}' is ready. (Use --recreate to force re-creation).`);
      return;
    }
  }

  console.log(`🚀 Creating vector search index '${VECTOR_INDEX_NAME}'...`);
  console.log(`   Dimensions : ${dimensions}`);
  console.log(`   Similarity : ${DEFAULT_SIMILARITY}`);
  console.log(`   Filter paths: userId, documentId, docType, fiscalYear, fiscalQuarter`);

  const searchIndexDescription: SearchIndexDescription = {
    name: VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition,
  };

  try {
    const indexName = await chunksCollection.createSearchIndex(searchIndexDescription);
    console.log(`✅ Search index creation command acknowledged: '${indexName || VECTOR_INDEX_NAME}'`);

    // Poll status for a few seconds to verify readiness
    console.log("⏳ Checking index readiness status...");
    let queryable = false;
    for (let attempt = 1; attempt <= 6; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const indexes = (await chunksCollection.listSearchIndexes().toArray()) as any[];
        const created = indexes.find((idx: any) => idx.name === VECTOR_INDEX_NAME);
        if (created) {
          console.log(`   Attempt ${attempt}: status='${created.status || "building"}', queryable=${created.queryable ?? false}`);
          if (created.queryable || created.status === "READY") {
            queryable = true;
            break;
          }
        }
      } catch {
        // Suppress polling transient check errors
      }
    }

    if (queryable) {
      console.log(`🎉 Vector search index '${VECTOR_INDEX_NAME}' is active and queryable!`);
    } else {
      console.log(
        `ℹ️ Index '${VECTOR_INDEX_NAME}' submitted successfully. Atlas builds search indexes asynchronously.\n` +
        `   It will transition to 'READY' shortly.`
      );
    }
  } catch (createError: any) {
    if (
      createError?.code === 59 ||
      createError?.codeName === "CommandNotFound" ||
      createError?.message?.includes("no such command")
    ) {
      console.warn(
        `\n⚠️ The connected MongoDB server does not support the 'createSearchIndexes' command.\n` +
        `   This is normal on standard MongoDB Community edition without Atlas Search (mongot) or Atlas Local.`
      );
      printManualCompassInstructions(definition);
    } else if (createError?.message?.includes("already exists")) {
      console.log(`ℹ️ Index '${VECTOR_INDEX_NAME}' already exists.`);
    } else {
      console.error(`❌ Failed to create vector search index '${VECTOR_INDEX_NAME}':`, createError?.message || createError);
      throw createError;
    }
  }
}

/**
 * Prints clear, copy-paste ready instructions for Compass / Atlas Search UI.
 */
export function printManualCompassInstructions(definition: ReturnType<typeof getVectorSearchDefinition>): void {
  console.log(`
================================================================================
📋 MONGODB ATLAS / COMPASS (SEARCH INDEXES TAB) CONFIGURATION
================================================================================
To create this index via MongoDB Compass or MongoDB Atlas Web Console:

1. Open MongoDB Compass / Atlas Web UI.
2. Navigate to Database: 'finsight' -> Collection: '${COLLECTION_NAME}'.
3. Click the 'Search Indexes' tab.
4. Click 'Create Search Index' and select 'JSON Editor'.
5. Set Index Name: ${VECTOR_INDEX_NAME}
6. Paste the following JSON definition:

${JSON.stringify(definition, null, 2)}

================================================================================
`);
}

/**
 * Main script runner
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: tsx scripts/createIndexes.ts [options]

Options:
  --recreate, --force       Drop existing chunks_vector_idx before creating
  --dimensions <number>     Vector embedding dimensions (default: 1536)
  --skip-sync               Skip syncing standard Mongoose schema indexes
  --json-only               Print JSON definition for Compass/Atlas and exit
  -h, --help                Show this help message
`);
    process.exit(0);
  }

  const dimIdx = args.indexOf("--dimensions");
  const parsedDimensions = dimIdx !== -1 && args[dimIdx + 1] ? parseInt(args[dimIdx + 1]!, 10) : DEFAULT_DIMENSIONS;

  if (args.includes("--json-only")) {
    printManualCompassInstructions(getVectorSearchDefinition(parsedDimensions));
    process.exit(0);
  }

  const recreate = args.includes("--recreate") || args.includes("--force");
  const skipSync = args.includes("--skip-sync");

  console.log("================================================================================");
  console.log("  FinSight AI - MongoDB Indexes & Vector Index Setup (Step 8.1)");
  console.log("================================================================================");

  try {
    console.log(`🔌 Connecting to MongoDB: ${env.MONGODB_URI.replace(/\/\/.*@/, "//<credentials>@")}...`);
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Connected to MongoDB successfully.\n");

    // 1. Sync standard schema indexes
    if (!skipSync) {
      await syncStandardIndexes();
    }

    // 2. Create Atlas Vector Search index
    await createVectorSearchIndex({
      dimensions: parsedDimensions,
      recreate,
      skipStandardIndexes: skipSync,
    });

    console.log("\n🎉 Index setup script completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Error during index creation:", error?.message || error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("🔌 Disconnected from MongoDB.");
    }
  }
}

function isRunningDirectly(): boolean {
  if (!process.argv[1]) return true;
  try {
    const currentFilePath = fileURLToPath(import.meta.url).toLowerCase();
    const entryFilePath = path.resolve(process.argv[1]).toLowerCase();
    return currentFilePath === entryFilePath;
  } catch {
    return true;
  }
}

if (isRunningDirectly()) {
  main();
}
