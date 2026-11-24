import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { env } from "../../config/env";
import { useGemini } from "../ingestion/embedder";

export const GEMINI_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL && process.env.GEMINI_CHAT_MODEL !== "gemini-3.1-flash-lite"
    ? process.env.GEMINI_CHAT_MODEL
    : "gemini-3.5-flash-lite";
export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const GEMINI_FALLBACK_MODELS = [
  GEMINI_CHAT_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
].filter((v, i, a) => a.indexOf(v) === i);

export interface StreamChatOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number | undefined;
  onToken: (token: string) => void | Promise<void>;
  signal?: AbortSignal | undefined;
}

export interface StreamChatResult {
  content: string;
  model: string;
  provider: "gemini" | "openai";
}

/**
 * Streams chat completion using Google Gemini via @google/genai.
 */
async function streamGeminiChat(options: StreamChatOptions): Promise<StreamChatResult> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in .env");
  }

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let lastError: any;

  for (const model of GEMINI_FALLBACK_MODELS) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: options.userPrompt }],
          },
        ],
        config: {
          systemInstruction: options.systemPrompt,
          temperature: options.temperature ?? 0.1,
        },
      });

      let fullContent = "";

      for await (const chunk of responseStream) {
        if (options.signal?.aborted) {
          break;
        }
        const token = chunk.text || "";
        if (token) {
          fullContent += token;
          await options.onToken(token);
        }
      }

      return {
        content: fullContent,
        model,
        provider: "gemini",
      };
    } catch (err: any) {
      console.warn(`[LLMProvider] Gemini model ${model} stream failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError;
}

/**
 * Streams chat completion using OpenAI.
 */
async function streamOpenAIChat(options: StreamChatOptions): Promise<StreamChatResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured in .env");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const model = OPENAI_CHAT_MODEL;

  const stream = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      stream: true,
      temperature: options.temperature ?? 0.1,
    },
    { signal: options.signal }
  );

  let fullContent = "";

  for await (const chunk of stream) {
    if (options.signal?.aborted) {
      break;
    }
    const token = chunk.choices[0]?.delta?.content || "";
    if (token) {
      fullContent += token;
      await options.onToken(token);
    }
  }

  return {
    content: fullContent,
    model,
    provider: "openai",
  };
}

/**
 * Streams chat generation through the active LLM provider (Gemini or OpenAI).
 */
export async function streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
  if (useGemini) {
    try {
      return await streamGeminiChat(options);
    } catch (geminiError: any) {
      // If gemini fails and OpenAI is also available, fallback gracefully
      if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 5) {
        console.warn("⚠️ Gemini stream failed, falling back to OpenAI:", geminiError?.message || geminiError);
        return await streamOpenAIChat(options);
      }
      throw geminiError;
    }
  }

  return await streamOpenAIChat(options);
}

/**
 * Executes a fast, non-streaming completion using the small model (Gemini 3.1 Flash-Lite or GPT-4o-mini).
 * Used for query rewriting, metadata extraction, and classification.
 */
export async function generateSmallCompletion(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.0,
  timeoutMs: number = 10000
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`generateSmallCompletion timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  if (useGemini && env.GEMINI_API_KEY) {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    for (const model of GEMINI_FALLBACK_MODELS) {
      try {
        const apiCall = ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature,
          },
        });

        const response = await Promise.race([apiCall, timeoutPromise]);
        return response.text?.trim() || "";
      } catch (geminiErr: any) {
        console.warn(`[LLMProvider] Gemini model ${model} completion failed:`, geminiErr?.message || geminiErr);
        if (!env.OPENAI_API_KEY && model === GEMINI_FALLBACK_MODELS[GEMINI_FALLBACK_MODELS.length - 1]) {
          throw geminiErr;
        }
      }
    }
  }

  if (env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const apiCall = client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    });

    const response = await Promise.race([apiCall, timeoutPromise]);
    return response.choices[0]?.message?.content?.trim() || "";
  }

  throw new Error("No LLM API key configured for completion.");
}

export default streamChat;
