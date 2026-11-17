export interface PageText {
  pageNumber: number;
  text: string;
}

export interface ParseResult {
  text: string;
  pageCount: number;
  pages: PageText[];
}

/** Minimum average characters per page required; below this, PDF is considered scanned image */
const MIN_AVG_CHARS_PER_PAGE = 10;

/**
 * Parses a PDF buffer page-by-page using pdfjs-dist.
 * Validates that the document has extractable text and is not a scanned image.
 *
 * @param buffer - The PDF file as a binary Buffer
 * @returns Promise<ParseResult> Extracted text, page count, and page-by-page array
 */
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error("Cannot parse empty or invalid PDF buffer");
  }

  // Load pdfjs-dist legacy build for Node.js ESM environment
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;

  try {
    const pages: PageText[] = [];
    let totalExtractedChars = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Extract string from items (positional items will be used later in Step 11 for tables)
      const rawText = content.items
        .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
        .join(" ");

      // Normalize whitespace
      const cleanText = rawText
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();

      pages.push({ pageNumber: p, text: cleanText });
      totalExtractedChars += cleanText.length;
    }

    // Check if the PDF is scanned or image-only
    const avgCharsPerPage =
      pdf.numPages > 0 ? totalExtractedChars / pdf.numPages : 0;

    if (avgCharsPerPage < MIN_AVG_CHARS_PER_PAGE) {
      throw new Error(
        "This document appears to be a scanned PDF or contains no extractable text. Scanned PDFs are not supported without OCR."
      );
    }

    // Full aggregated text with clear page boundaries for chunking
    const fullText = pages
      .map((p) => p.text)
      .filter((t) => t.length > 0)
      .join("\n\n");

    return {
      text: fullText,
      pageCount: pdf.numPages,
      pages,
    };
  } finally {
    await pdf.destroy();
  }
}
