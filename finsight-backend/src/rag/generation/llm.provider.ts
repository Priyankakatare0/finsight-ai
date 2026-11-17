import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { env } from "../../config/env";
import { useGemini } from "../ingestion/embedder";

export const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
export const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

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
  const model = GEMINI_CHAT_MODEL;

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

export default streamChat;
