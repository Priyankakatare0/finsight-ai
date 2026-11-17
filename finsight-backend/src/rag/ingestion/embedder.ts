import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { env } from "../../config/env";

export const useGemini = Boolean(
  env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 5
);

export const GEMINI_MODEL = "gemini-embedding-001";
export const OPENAI_MODEL = "text-embedding-3-small";

export const EMBEDDING_MODEL = useGemini ? GEMINI_MODEL : OPENAI_MODEL;
export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_BATCH_SIZE = 64;

/**
 * L2-normalizes a numeric vector (required when truncating Matryoshka embeddings).
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Ensures an embedding vector has exactly targetDim dimensions (1536) for Atlas Vector Index compatibility.
 */
export function enforceDimensions(vector: number[], targetDim: number = 1536): number[] {
  if (!vector || vector.length === 0) {
    return new Array(targetDim).fill(0);
  }
  if (vector.length === targetDim) {
    return vector;
  }
  if (vector.length > targetDim) {
    // Matryoshka truncation + L2 normalization
    return normalizeVector(vector.slice(0, targetDim));
  }
  // Pad with zeroes if shorter
  return [...vector, ...new Array(targetDim - vector.length).fill(0)];
}

// Initialize clients
export const geminiClient = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : null;

export const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embeds a batch of texts using Google Gemini (Free tier)
 */
async function embedWithGemini(batch: string[]): Promise<number[][]> {
  if (!geminiClient) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const response = await geminiClient.models.embedContent({
    model: GEMINI_MODEL,
    contents: batch,
    config: {
      outputDimensionality: 1536,
    },
  });

  if (response.embeddings && response.embeddings.length > 0) {
    return response.embeddings.map((e) => enforceDimensions(e.values || [], 1536));
  }

  throw new Error("Gemini returned empty embeddings response");
}

/**
 * Embeds a batch of texts using OpenAI
 */
async function embedWithOpenAI(batch: string[]): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error("OPENAI_API_KEY is not configured in .env");
  }

  const res = await openaiClient.embeddings.create({
    model: OPENAI_MODEL,
    input: batch,
  });

  const sortedData = [...res.data].sort((a, b) => a.index - b.index);
  return sortedData.map((d) => enforceDimensions(d.embedding, 1536));
}

/**
 * Embeds a batch of strings with 3-try exponential backoff retry logic.
 */
export async function embedBatchWithRetry(
  batch: string[],
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<number[][]> {
  if (batch.length === 0) {
    return [];
  }

  // Ensure no empty strings
  const sanitized = batch.map((text) =>
    text.trim().length > 0 ? text : " "
  );

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (useGemini) {
        return await embedWithGemini(sanitized);
      } else {
        return await embedWithOpenAI(sanitized);
      }
    } catch (error: any) {
      const isRateLimit =
        error?.status === 429 ||
        error?.code === "rate_limit_exceeded" ||
        error?.message?.includes("RESOURCE_EXHAUSTED");
      const isServerError =
        typeof error?.status === "number" && error.status >= 500;
      const isTransient =
        isRateLimit ||
        isServerError ||
        error?.code === "ETIMEDOUT" ||
        error?.name === "APIConnectionError" ||
        error?.code === "ECONNRESET";

      if (attempt >= maxRetries || !isTransient) {
        console.error(
          `[Embedder] Fatal failure embedding batch via ${useGemini ? "Gemini" : "OpenAI"} (Attempt ${attempt}/${maxRetries}):`,
          error?.message || error
        );
        throw error;
      }

      const backoffMs =
        baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);

      console.warn(
        `[Embedder] Transient error (${error?.status || error?.code || "Network"}). Retrying in ${backoffMs}ms (Attempt ${attempt}/${maxRetries})...`
      );

      await sleep(backoffMs);
    }
  }

  throw new Error(`Failed to generate embeddings after ${maxRetries} attempts`);
}

/**
 * Splits texts into batches of 64 and embeds each batch.
 */
export async function generateEmbeddings(
  texts: string[],
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchVectors = await embedBatchWithRetry(batch);
    allVectors.push(...batchVectors);
  }

  return allVectors;
}

/**
 * Generates an embedding vector for a single query text string.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Query text cannot be empty");
  }
  const [vector] = await generateEmbeddings([trimmed], 1);
  if (!vector || vector.length === 0) {
    throw new Error("Failed to generate embedding for query");
  }
  return vector;
}

