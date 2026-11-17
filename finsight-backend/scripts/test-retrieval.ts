import mongoose from "mongoose";
import { env } from "../src/config/env";
import { ChunkModel } from "../src/models/Chunk.model";
import { retrieveContext, formatChunksAsContext } from "../src/rag/retrieval";

async function runTest() {
  console.log("🧪 Testing Step 8.2: Vector Retrieval Function ($vectorSearch)...");

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Connected to MongoDB for retrieval test");

    const testUserId = new mongoose.Types.ObjectId();
    const testDocId = new mongoose.Types.ObjectId();

    // Create a 1536-dimensional base vector
    const baseVector = new Array(1536).fill(0.02);
    // Perturb slightly for chunk 0 to give it the highest cosine similarity
    const chunk0Vector = [...baseVector];
    chunk0Vector[0] = 0.05;

    const chunk1Vector = [...baseVector];
    chunk1Vector[0] = 0.01;

    const chunk2Vector = [...baseVector];
    chunk2Vector[0] = -0.02;

    const sampleChunks = [
      {
        userId: testUserId,
        documentId: testDocId,
        chunkIndex: 0,
        content: "Apple Inc. reported record quarterly revenue of $94.9 billion for Q4 FY2024.",
        pageStart: 1,
        pageEnd: 1,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: chunk0Vector,
      },
      {
        userId: testUserId,
        documentId: testDocId,
        chunkIndex: 1,
        content: "Services revenue reached an all-time record of $25.0 billion, up 12 percent year over year.",
        pageStart: 1,
        pageEnd: 2,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: chunk1Vector,
      },
      {
        userId: testUserId,
        documentId: testDocId,
        chunkIndex: 2,
        content: "Operating cash flow was strong at $26.8 billion, returning over $29 billion to shareholders.",
        pageStart: 2,
        pageEnd: 2,
        company: "Apple Inc.",
        docType: "10-Q",
        fiscalYear: 2024,
        fiscalQuarter: "Q4",
        embedding: chunk2Vector,
      },
    ];

    console.log("📥 Inserting sample chunks for vector retrieval...");
    await ChunkModel.insertMany(sampleChunks, { ordered: false });

    // Wait a brief moment for Atlas local search engine index sync
    console.log("⏳ Waiting 1.5s for Atlas index synchronization...");
    await new Promise((r) => setTimeout(r, 1500));

    // Execute the Step 8.2 retrieval function
    console.log("🔍 Executing retrieveContext with $vectorSearch...");
    const queryVector = [...baseVector];
    queryVector[0] = 0.05; // Matches chunk 0 closest

    const result = await retrieveContext({
      userId: testUserId,
      queryVector,
      numCandidates: 200,
      limit: 20,
      topK: 5,
    });

    console.log(`✅ Total candidates retrieved : ${result.totalRetrieved}`);
    console.log(`✅ Context chunks selected   : ${result.contextChunks.length}`);

    if (result.chunks.length > 0) {
      const top = result.chunks[0];
      console.log(`   Top match chunk index   : ${top?.chunkIndex}`);
      console.log(`   Vector search score     : ${top?.score}`);
      console.log(`   Embedding projected out : ${(top as any)?.embedding === undefined ? "YES" : "NO"}`);
      console.log(`   Company & DocType       : ${top?.company} ${top?.docType}`);
    }

    console.log("\n📄 Generated LLM Context Output:");
    console.log("--------------------------------------------------------------------------------");
    console.log(result.context || "(No context generated)");
    console.log("--------------------------------------------------------------------------------\n");

    // Cleanup test chunks
    await ChunkModel.deleteMany({ userId: testUserId });
    console.log("🧹 Test chunk documents cleaned up successfully.");

    await mongoose.disconnect();
    console.log("🎉 Step 8.2: Vector Retrieval test completed successfully!");
  } catch (error: any) {
    console.error("❌ Retrieval test error:", error?.message || error);
    process.exitCode = 1;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

runTest();
