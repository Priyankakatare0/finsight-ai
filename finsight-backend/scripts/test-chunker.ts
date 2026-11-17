import { chunkPage, chunkDocument } from "../src/rag/ingestion/chunker";

async function runTest() {
  console.log("🧪 1. Testing chunkPage with sentence-aware boundary cutting...");

  const page1Text = `
Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.
The Company offers iPhone, Mac, iPad, and Wearables, Home and Accessories.

During fiscal year 2024, total net sales were $391.0 billion, up 2% compared to fiscal year 2023.
Services revenue reached an all-time high of $96.2 billion, demonstrating continued strong customer engagement.
  `.trim();

  const page2Text = `
Products net sales decreased slightly due to foreign exchange headwinds and macroeconomic factors.
Gross margin expanded by 180 basis points driven by favorable product mix and services growth.
Operating income was $123.2 billion, compared to $114.3 billion in the prior fiscal year.
  `.trim();

  // Test chunkPage
  const singlePageChunks = chunkPage(page1Text, 1, 180, 40);
  console.log(`Page 1 produced ${singlePageChunks.length} chunks.`);
  singlePageChunks.forEach((c, idx) => {
    console.log(`   [Chunk #${idx}] (Page ${c.pageStart}): ${c.text.slice(0, 50)}...`);
  });

  if (singlePageChunks.length >= 2 && singlePageChunks[0]?.pageStart === 1) {
    console.log("✅ chunkPage passed!");
  } else {
    console.error("❌ chunkPage failed.");
    process.exit(1);
  }

  console.log("\n🧪 2. Testing chunkDocument across multi-page document...");
  const pages = [
    { pageNumber: 1, text: page1Text },
    { pageNumber: 2, text: page2Text },
  ];

  const docChunks = chunkDocument(pages, { size: 180, overlap: 40 });
  console.log(`Document produced ${docChunks.length} total chunks.`);

  docChunks.forEach((c) => {
    console.log(
      `   [Index ${c.chunkIndex}] (Page ${c.pageStart} -> ${c.pageEnd}) (${c.text.length} chars): ${c.text.slice(0, 40)}...`
    );
  });

  const page1Present = docChunks.some((c) => c.pageStart === 1);
  const page2Present = docChunks.some((c) => c.pageStart === 2);

  if (page1Present && page2Present && docChunks[0]?.chunkIndex === 0) {
    console.log("🎉 chunkDocument multi-page test passed successfully!");
  } else {
    console.error("❌ chunkDocument test failed: Page citations incorrect.");
    process.exit(1);
  }
}

runTest();
