import {
  generateEmbeddings,
  EMBEDDING_MODEL,
  useGemini,
} from "../src/rag/ingestion/embedder";

async function runTest() {
  console.log(`🧪 Testing Embedder using [${useGemini ? "Google Gemini" : "OpenAI"}] (${EMBEDDING_MODEL})...`);

  const sampleTexts = [
    "Apple Inc. reported quarterly revenue of $94.9 billion for Q4 fiscal 2024.",
    "Services revenue reached an all-time record of $25.0 billion, up 12 percent year over year.",
    "Operating cash flow was strong at $26.8 billion, returning $29 billion to shareholders.",
  ];

  try {
    const embeddings = await generateEmbeddings(sampleTexts, 64);
    console.log(`✅ Successfully generated ${embeddings.length} embedding vectors!`);

    const firstVector = embeddings[0];
    console.log(`   Model: ${EMBEDDING_MODEL}`);
    console.log(`   Vector dimensions: ${firstVector?.length}`);
    console.log(`   Sample vector slice (first 5 numbers):`, firstVector?.slice(0, 5));

    if (embeddings.length === sampleTexts.length && (firstVector?.length ?? 0) > 0) {
      console.log(`🎉 ${useGemini ? "Google Gemini" : "OpenAI"} Embedder test passed successfully!`);
    } else {
      console.error("❌ Embedder test failed: Dimension or length mismatch.");
      process.exitCode = 1;
    }
  } catch (error: any) {
    console.error("❌ Embedder error:", error?.message || error);
    process.exitCode = 1;
  }
}

runTest();
