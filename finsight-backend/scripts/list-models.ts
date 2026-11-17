import { GoogleGenAI } from "@google/genai";
import { env } from "../src/config/env";

async function list() {
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  console.log("Listing available models for your Gemini API key...");

  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.supportedActions?.some((a: string) => a.includes("embed") || a.includes("Embed"))) {
        console.log(`- ${m.name} (Methods: ${m.supportedActions?.join(", ")})`);
      }
    }
  } catch (e: any) {
    console.error("Error listing models:", e?.message || e);
  }
}

list();
