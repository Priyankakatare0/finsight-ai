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

interface TextItemPos {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reconstructs 2D reading order, line grouping, and tabular/columnar layout from PDF items.
 * Preserves the spatial alignment of financial tables and charts.
 */
export function extractPageTextWithLayout(content: any): string {
  if (!content || !content.items || content.items.length === 0) {
    return "";
  }

  const items: TextItemPos[] = [];
  for (const item of content.items) {
    if (typeof item?.str === "string" && item.str.trim().length > 0) {
      items.push({
        str: item.str,
        x: item.transform ? item.transform[4] : 0,
        y: item.transform ? item.transform[5] : 0,
        w: item.width || 0,
        h: item.height || (item.transform ? Math.abs(item.transform[3]) : 10),
      });
    }
  }

  if (items.length === 0) {
    return "";
  }

  // Sort descending by Y (top of page has highest Y in PDF coordinate space), then ascending by X
  items.sort((a, b) => b.y - a.y || a.x - b.x);

  // Group items into visual lines
  const lines: Array<{ y: number; h: number; items: TextItemPos[] }> = [];

  for (const item of items) {
    let placed = false;
    for (const line of lines) {
      const threshold = Math.max(Math.min(line.h, item.h) * 0.6, 5);
      if (Math.abs(line.y - item.y) <= threshold) {
        line.items.push(item);
        line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
        placed = true;
        break;
      }
    }

    if (!placed) {
      lines.push({ y: item.y, h: item.h, items: [item] });
    }
  }

  // Sort lines top to bottom
  lines.sort((a, b) => b.y - a.y);

  const formattedLines: string[] = [];
  let prevLineY: number | null = null;
  let prevLineH = 12;

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    let lineStr = "";
    let lastX = -1;
    let lastW = 0;

    for (const item of line.items) {
      if (lastX >= 0) {
        const gap = item.x - (lastX + lastW);
        if (gap > 22) {
          lineStr += "   "; // Distinct column/table gap
        } else if (gap > 1.5) {
          lineStr += " ";
        }
      }
      lineStr += item.str;
      lastX = item.x;
      lastW = item.w;
    }

    const trimmedLine = lineStr.trim();
    if (trimmedLine.length > 0) {
      if (prevLineY !== null) {
        const lineGap = prevLineY - line.y;
        if (lineGap > prevLineH * 2.2) {
          formattedLines.push("");
        }
      }
      formattedLines.push(trimmedLine);
      prevLineY = line.y;
      prevLineH = line.h;
    }
  }

  return formattedLines.join("\n");
}

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

      // Extract text preserving 2D visual layout and column alignment
      const layoutText = extractPageTextWithLayout(content);

      // Clean redundant empty lines
      const cleanText = (layoutText || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]{4,}/g, "   ")
        .replace(/\n{3,}/g, "\n\n")
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
