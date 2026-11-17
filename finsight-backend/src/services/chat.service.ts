import mongoose, { type Types } from "mongoose";
import { ConversationModel, type IConversationDocument } from "../models/Conversation.model";
import { MessageModel, type IMessageDocument, type IMessageSource } from "../models/Message.model";
import { DocumentModel } from "../models/Document.model";
import { retrieveContext, type RetrievedChunk } from "../rag/retrieval";
import { buildAnswerPrompt, NOT_FOUND_MESSAGE, type ContextBlock } from "../rag/prompts/answer.v1";
import { streamChat } from "../rag/generation/llm.provider";
import { AppError } from "../errors/AppError";

export const DEFAULT_REFUSAL_THRESHOLD = 0.5;

/**
 * Step 10.5: Validate citations on the backend
 * Removes any [n] that does not map to a real source (i.e. n < 1 or n > maxCitation).
 */
export function validateCitations(text: string, maxCitation: number): string {
  if (!text) return text;
  if (maxCitation <= 0) {
    return text.replace(/\[\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
  }

  return text
    .replace(/\[(\d+)\]/g, (match, numStr) => {
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 1 && num <= maxCitation) {
        return match;
      }
      return "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface StreamChatEventHandlers {
  onStatus?: (status: { stage: string }) => void | Promise<void>;
  onSources?: (data: { sources: IMessageSource[] }) => void | Promise<void>;
  onToken: (data: { text: string }) => void | Promise<void>;
  onDone?: (data: { messageId: string; message: IMessageDocument }) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}

export interface SendMessageOptions {
  conversationId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  content: string;
  documentId?: string | Types.ObjectId | undefined;
  refusalThreshold?: number | undefined;
  handlers: StreamChatEventHandlers;
  signal?: AbortSignal | undefined;
}

export class ChatService {
  /**
   * Creates a new conversation for a user.
   */
  async createConversation(
    userId: string | Types.ObjectId,
    title?: string,
    documentId?: string | Types.ObjectId
  ): Promise<IConversationDocument> {
    const userObjectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    const docObjectId = documentId ? (typeof documentId === "string" ? new mongoose.Types.ObjectId(documentId) : documentId) : undefined;

    return await ConversationModel.create({
      userId: userObjectId,
      title: title?.trim() || "New Conversation",
      documentId: docObjectId,
    });
  }

  /**
   * Retrieves all conversations for a user, ordered by most recently updated.
   */
  async getUserConversations(userId: string | Types.ObjectId): Promise<IConversationDocument[]> {
    const userObjectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
    return await ConversationModel.find({ userId: userObjectId }).sort({ updatedAt: -1 }).lean();
  }

  /**
   * Retrieves a single conversation by ID with ownership verification.
   */
  async getConversationById(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IConversationDocument> {
    const convObjectId = typeof conversationId === "string" ? new mongoose.Types.ObjectId(conversationId) : conversationId;
    const userObjectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    const conversation = await ConversationModel.findOne({
      _id: convObjectId,
      userId: userObjectId,
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    return conversation;
  }

  /**
   * Retrieves message history for a conversation.
   */
  async getConversationMessages(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IMessageDocument[]> {
    // Verify ownership first
    await this.getConversationById(conversationId, userId);

    const convObjectId = typeof conversationId === "string" ? new mongoose.Types.ObjectId(conversationId) : conversationId;
    return await MessageModel.find({ conversationId: convObjectId }).sort({ createdAt: 1 }).lean();
  }

  /**
   * Deletes a conversation and all its messages.
   */
  async deleteConversation(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<void> {
    const conversation = await this.getConversationById(conversationId, userId);
    await Promise.all([
      ConversationModel.findByIdAndDelete(conversation._id),
      MessageModel.deleteMany({ conversationId: conversation._id }),
    ]);
  }

  /**
   * Step 9.3: Chat Service Flow
   *
   * 1. Save user message.
   * 2. Embed the question -> retrieve top chunks via vector search.
   * 3. Refusal gate: if top similarity score is below threshold, send not-found message and stop.
   * 4. Build context as numbered blocks: [1] Source: <title>, page <n>\n<text>.
   * 5. Call chat model with stream: true and stream tokens to client.
   * 6. After stream ends, save assistant message with its sources.
   */
  async sendMessageAndStream(options: SendMessageOptions): Promise<IMessageDocument> {
    const {
      conversationId,
      userId,
      content,
      documentId,
      refusalThreshold = DEFAULT_REFUSAL_THRESHOLD,
      handlers,
      signal,
    } = options;

    const convObjectId = typeof conversationId === "string" ? new mongoose.Types.ObjectId(conversationId) : conversationId;
    const userObjectId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    // Verify conversation exists and user owns it
    const conversation = await ConversationModel.findOne({
      _id: convObjectId,
      userId: userObjectId,
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    // Step 1: Save user message
    const userMessage = await MessageModel.create({
      conversationId: convObjectId,
      role: "user",
      content: content.trim(),
      status: "completed",
    });

    // Update conversation title if still default
    if (conversation.title === "New Conversation") {
      const autoTitle = content.trim().slice(0, 45) + (content.length > 45 ? "..." : "");
      conversation.title = autoTitle;
      await conversation.save();
    } else {
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    // Step 2: Embed question & retrieve top chunks
    await handlers.onStatus?.({ stage: "retrieving" });

    if (signal?.aborted) {
      return userMessage;
    }

    const targetDocId = documentId || conversation.documentId;
    const retrieval = await retrieveContext({
      userId: userObjectId,
      query: content,
      numCandidates: 200,
      limit: 20,
      topK: 5,
      filters: targetDocId ? { documentId: targetDocId } : undefined,
    });

    const topChunks = retrieval.contextChunks;
    const topScore = topChunks[0]?.score ?? 0;

    // Step 3: Refusal Gate (easy version)
    // If the best similarity score is below threshold, return not-found message and stop
    if (topChunks.length === 0 || topScore < refusalThreshold) {
      console.log(`[ChatService] Refusal Gate triggered: topScore=${topScore.toFixed(4)} < threshold=${refusalThreshold}`);

      await handlers.onSources?.({ sources: [] });
      await handlers.onToken({ text: NOT_FOUND_MESSAGE });

      const assistantMessage = await MessageModel.create({
        conversationId: convObjectId,
        role: "assistant",
        content: NOT_FOUND_MESSAGE,
        sources: [],
        status: "completed",
      });

      await handlers.onDone?.({ messageId: assistantMessage._id.toString(), message: assistantMessage });
      return assistantMessage;
    }

    if (signal?.aborted) {
      return userMessage;
    }

    // Lookup document titles for citations
    const docIds = [...new Set(topChunks.map((c) => c.documentId?.toString()).filter(Boolean))];
    const documents = await DocumentModel.find({ _id: { $in: docIds } })
      .select("_id title company docType")
      .lean();
    const docMap = new Map(documents.map((d) => [d._id.toString(), d]));

    // Step 4: Build context as numbered blocks
    // [1] Source: <title>, page <n>\n<text>
    const contextBlocks: ContextBlock[] = topChunks.map((chunk, i) => {
      const doc = chunk.documentId ? docMap.get(chunk.documentId.toString()) : null;
      const title = doc?.title || `${chunk.company} ${chunk.docType}`;
      return {
        index: i + 1,
        title,
        page: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        text: chunk.content || chunk.text || "",
      };
    });

    // Map to source records for persistence and UI citations
    const sources: IMessageSource[] = topChunks.map((chunk, i) => {
      const doc = chunk.documentId ? docMap.get(chunk.documentId.toString()) : null;
      const title = doc?.title || `${chunk.company} ${chunk.docType}`;
      return {
        chunkId: chunk._id,
        documentId: chunk.documentId,
        title,
        page: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        snippet: (chunk.content || chunk.text || "").replace(/\s+/g, " ").slice(0, 180) + "...",
        score: chunk.score,
      };
    });

    // Notify client of generating stage and send sources
    await handlers.onStatus?.({ stage: "generating" });
    await handlers.onSources?.({ sources });

    // Build the system prompt and user prompt
    const { systemPrompt, userPrompt } = buildAnswerPrompt(content, contextBlocks);

    // Step 5: Call chat model with stream: true and stream tokens to client
    let accumulatedContent = "";

    try {
      const streamResult = await streamChat({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        signal,
        onToken: async (token: string) => {
          accumulatedContent += token;
          await handlers.onToken({ text: token });
        },
      });

      // Step 6: After stream ends, validate citations and save assistant message with its sources
      const rawContent = accumulatedContent || streamResult.content;
      const validatedContent = validateCitations(rawContent, sources.length);

      const assistantMessage = await MessageModel.create({
        conversationId: convObjectId,
        role: "assistant",
        content: validatedContent,
        sources,
        status: "completed",
      });

      await handlers.onDone?.({ messageId: assistantMessage._id.toString(), message: assistantMessage });
      return assistantMessage;
    } catch (streamError: any) {
      if (signal?.aborted) {
        console.log("[ChatService] Chat streaming aborted by user (client disconnect).");
      } else {
        console.error("[ChatService] Streaming error:", streamError?.message || streamError);
      }

      // Save partial assistant message if anything was generated before abort/error
      const assistantMessage = await MessageModel.create({
        conversationId: convObjectId,
        role: "assistant",
        content: accumulatedContent || (signal?.aborted ? "Generation stopped." : "An error occurred while generating the answer."),
        sources,
        status: accumulatedContent && !signal?.aborted ? "completed" : "failed",
      });

      if (!signal?.aborted) {
        await handlers.onError?.(streamError);
        throw streamError;
      }

      return assistantMessage;
    }
  }
}

export const chatService = new ChatService();
export default chatService;
