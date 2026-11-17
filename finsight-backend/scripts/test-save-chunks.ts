import mongoose from "mongoose";
import { env } from "../src/config/env";
import { ChunkModel } from "../src/models/Chunk.model";

async function runTest() {
  console.log("🧪 Testing ChunkModel.insertMany with { ordered: false }...");

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB for chunk test");

    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyDocumentId = new mongoose.Types.ObjectId();

    // Create 3 sample chunk documents with 1536-dimensional mock embeddings
    const sampleChunks = [
      {
        userId: dummyUserId,
        documentId: dummyDocumentId,
        chunkIndex: 0,
        content: "Apple Inc. reports quarterly revenue of $94.9 billion.",
        pageStart: 1,
        pageEnd: 1,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: new Array(1536).fill(0.01),
      },
      {
        userId: dummyUserId,
        documentId: dummyDocumentId,
        chunkIndex: 1,
        content: "Services revenue reached an all-time record of $25.0 billion.",
        pageStart: 1,
        pageEnd: 2,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: new Array(1536).fill(0.02),
      },
      {
        userId: dummyUserId,
        documentId: dummyDocumentId,
        chunkIndex: 2,
        content: "Operating cash flow was strong at $26.8 billion.",
        pageStart: 2,
        pageEnd: 2,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: new Array(1536).fill(0.03),
      },
    ];

    // Bulk unordered insert
    const inserted = await ChunkModel.insertMany(sampleChunks, { ordered: false });
    console.log(`✅ Successfully inserted ${inserted.length} chunks via Chunk.insertMany({ ordered: false })`);

    // Verify retrieval
    const retrieved = await ChunkModel.find({ documentId: dummyDocumentId }).sort({ chunkIndex: 1 });
    console.log(`✅ Verified retrieved chunk count: ${retrieved.length}`);
    console.log(`   Chunk #0 pageStart: ${retrieved[0]?.pageStart}, content: "${retrieved[0]?.content}"`);

    // Cleanup test data
    await ChunkModel.deleteMany({ documentId: dummyDocumentId });
    console.log("🧹 Test chunk documents cleaned up successfully.");

    await mongoose.disconnect();
    console.log("🎉 ChunkModel test passed successfully!");
  } catch (error: any) {
    console.error("❌ ChunkModel test error:", error?.message || error);
    process.exitCode = 1;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runTest();
