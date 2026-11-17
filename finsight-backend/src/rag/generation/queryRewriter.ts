import { generateSmallCompletion } from "./llm.provider";

export const QUERY_REWRITE_SYSTEM_PROMPT = `You are a query reformulation assistant for a financial research RAG system.
Your job is to read the recent conversation history between a user and an AI financial assistant, and reformulate the user's latest follow-up question into a single standalone, self-contained search question.

Rules:
1. Resolve all pronouns (e.g., "it", "they", "their", "this", "its", "the company") and conversational ellipsis into the explicit company name, fiscal year, reporting period, or financial metric established in the conversation history.
2. If the user's question is already completely standalone and self-contained, return it unchanged.
3. Optimize the rewritten query for vector search retrieval against financial filings (Form 10-K, 10-Q).
4. Do NOT answer the question. Do NOT include preambles, conversational pleasantries, or quotes.
5. Output ONLY the standalone question as plain text.`;

export interface ChatHistoryMessage {
  role: string;
  content: string;
}

/**
 * Step 11.1: Query rewriting for follow-ups
 * Sends the last 6 messages plus the new question to the small model to produce a standalone query.
 */
export async function rewriteQueryForFollowUp(
  question: string,
  history: ChatHistoryMessage[]
): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) return trimmed;

  // If no previous history exists, the question is already initial/standalone
  if (!history || history.length === 0) {
    return trimmed;
  }

  // Take the last 6 messages
  const recentMessages = history.slice(-6);

  const historyText = recentMessages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`)
    .join("\n");

  const userPrompt = `Conversation History (last ${recentMessages.length} messages):
--------------------------------------------------
${historyText}
--------------------------------------------------

User's Latest Follow-up Question: "${trimmed}"

Standalone Question:`;

  try {
    const rewritten = await generateSmallCompletion(
      QUERY_REWRITE_SYSTEM_PROMPT,
      userPrompt,
      0.0
    );

    if (rewritten && rewritten.length > 5 && !rewritten.includes("I cannot")) {
      return rewritten.replace(/^["']|["']$/g, "").trim();
    }
    return trimmed;
  } catch (error: any) {
    console.warn("[QueryRewriter] Warning during query rewriting, falling back to original query:", error?.message || error);
    return trimmed;
  }
}

export default rewriteQueryForFollowUp;
