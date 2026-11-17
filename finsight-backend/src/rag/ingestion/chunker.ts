export interface ChunkOptions {
  size?: number; // Default: ~2400 chars (~600 tokens)
  overlap?: number; // Default: ~400 chars (~100 tokens)
}

export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  content: string; // Alias for text for compatibility
  pageStart: number;
  pageEnd: number;
}

/**
 * Splits a single page's text into overlapping chunks, cutting at sentence ends.
 *
 * @param text - Cleaned text of the page
 * @param pageNumber - 1-based page number
 * @param size - Max chunk character length (default: 2400 chars)
 * @param overlap - Overlap character length (default: 400 chars)
 */
export function chunkPage(
  text: string,
  pageNumber: number,
  size: number = 2400,
  overlap: number = 400
): Array<{ text: string; content: string; pageStart: number; pageEnd: number }> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  if (overlap >= size) {
    throw new Error("overlap must be strictly smaller than chunk size");
  }

  const chunks: Array<{
    text: string;
    content: string;
    pageStart: number;
    pageEnd: number;
  }> = [];

  let start = 0;

  while (start < text.length) {
    let end = start + size;

    if (end < text.length) {
      // Look for a sentence or paragraph boundary within the last 300 characters
      const searchRegion = text.slice(Math.max(start, end - 300), end);
      const boundaryMatch = searchRegion.search(/(\n\n|\n|\.\s|\?\s|\!\s)[^\n.?!]*$/);

      if (boundaryMatch !== -1) {
        end = Math.max(start, end - 300) + boundaryMatch + 1;
      }
    }

    const chunkContent = text.slice(start, end).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        text: chunkContent,
        content: chunkContent,
        pageStart: pageNumber,
        pageEnd: pageNumber,
      });
    }

    const step = Math.max(1, end - start - overlap);
    start += step;
  }

  return chunks;
}

/**
 * Splits an array of parsed pages into numbered, overlapping chunks.
 * Preserves pageStart and pageEnd on each chunk for accurate source citations.
 *
 * @param pages - Array of { pageNumber, text }
 * @param options - size and overlap options
 * @returns DocumentChunk[]
 */
export function chunkDocument(
  pages: Array<{ pageNumber: number; text: string }>,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const { size = 2400, overlap = 400 } = options;
  const allChunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkPage(page.text, page.pageNumber, size, overlap);

    for (const chunk of pageChunks) {
      allChunks.push({
        chunkIndex,
        text: chunk.text,
        content: chunk.content,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
      });
      chunkIndex++;
    }
  }

  return allChunks;
}

/**
 * Backward compatibility fallback for plain text strings.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  return chunkDocument([{ pageNumber: 1, text }], options);
}
