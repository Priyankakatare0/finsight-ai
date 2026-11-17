import { parsePdf } from "../src/rag/ingestion/parser";

async function runTest() {
  console.log("🧪 1. Testing parsePdf page-by-page extraction with valid PDF...");

  // Minimal valid 1-page PDF containing text "Hello FinSight AI"
  const validPdfBase64 =
    "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIg" +
    "MCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2Jq" +
    "PDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDE0NF0vQ29udGVu" +
    "dHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBv" +
    "Ymo8PC9MZW5ndGggNTU+PnN0cmVhbQpCVAovRjEgMTggVGYKNTAgMTAwIFRkCihIZWxsbyBG" +
    "aW5TaWdodCBBSSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqPDwvVHlwZS9Gb250" +
    "L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj5lbmRvYmoKeHJlZgowIDYKMDAw" +
    "MDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAg" +
    "biAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQzIDAwMDAwIG4gCjAwMDAwMDAzNDkg" +
    "MDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNi9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjQyNQol" +
    "JUVPRgo=";

  const validBuffer = Buffer.from(validPdfBase64, "base64");

  try {
    const result = await parsePdf(validBuffer);
    console.log("✅ Parse Result:", {
      pageCount: result.pageCount,
      pages: result.pages,
    });

    if (result.pageCount === 1 && result.pages[0]?.text.includes("Hello FinSight AI")) {
      console.log("🎉 Valid PDF parsed page-by-page successfully!");
    } else {
      console.error("❌ Test failed: Content mismatch.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Valid PDF parser failed unexpectedly:", error);
    process.exit(1);
  }

  console.log("\n🧪 2. Testing scanned/empty PDF detection...");
  // Minimal valid 1-page PDF with EMPTY stream (0 characters extracted)
  const emptyPdfBase64 =
    "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIg" +
    "MCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2Jq" +
    "PDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDE0NF0vQ29udGVu" +
    "dHMgNCAwIFI+PmVuZG9iago0IDAgb2JqPDwvTGVuZ3RoIDA+PnN0cmVhbQplbmRzdHJlYW0K" +
    "ZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBu" +
    "IAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNCAw" +
    "MDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA1L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYgMjU0CiUl" +
    "RU9GCg==";

  const emptyBuffer = Buffer.from(emptyPdfBase64, "base64");

  try {
    await parsePdf(emptyBuffer);
    console.error("❌ Test failed: Scanned/empty PDF should have thrown an error!");
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes("scanned PDF")) {
      console.log("✅ Correctly rejected scanned/empty PDF:", err.message);
      console.log("🎉 All parser tests passed!");
    } else {
      console.error("❌ Unexpected error:", err);
      process.exit(1);
    }
  }
}

runTest();
