import type { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { AppError } from "../errors/AppError";
import type { CreateConversationInput, UpdateConversationInput, SendMessageInput } from "../validators/chat.schema";

export class ChatController {
  /**
   * POST /api/chat/conversations
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { title, documentId } = req.body as CreateConversationInput;
    const conversation = await chatService.createConversation(userId, title, documentId);

    res.status(201).json({
      success: true,
      data: { conversation },
    });
  }

  /**
   * PATCH /api/chat/conversations/:id
   */
  async updateConversation(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversationId = req.params.id as string;
    const updates = req.body as UpdateConversationInput;
    const conversation = await chatService.updateConversation(conversationId, userId, updates);

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  }

  /**
   * GET /api/chat/conversations
   */
  async listConversations(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversations = await chatService.getUserConversations(userId);

    res.status(200).json({
      success: true,
      data: { conversations },
    });
  }

  /**
   * GET /api/chat/conversations/:id
   */
  async getConversation(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversationId = req.params.id as string;
    const conversation = await chatService.getConversationById(conversationId, userId);

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  }

  /**
   * GET /api/chat/conversations/:id/messages
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversationId = req.params.id as string;
    const messages = await chatService.getConversationMessages(conversationId, userId);

    res.status(200).json({
      success: true,
      data: { messages },
    });
  }

  /**
   * DELETE /api/chat/conversations/:id
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversationId = req.params.id as string;
    await chatService.deleteConversation(conversationId, userId);

    res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    });
  }

  /**
   * POST /api/chat/conversations/:id/messages
   *
   * Streams chat answers via Server-Sent Events (SSE).
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const conversationId = req.params.id as string;
    const { content, documentId, refusalThreshold, editMessageId } = req.body as SendMessageInput;

    if (!content || content.trim().length === 0) {
      throw new AppError("Message content cannot be empty", 400, "BAD_REQUEST");
    }

    // 9.4 Server-Sent Events (SSE) in Express
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    const abortController = new AbortController();

    // Listen for client disconnect and abort model call (Stop button)
    req.on("close", () => {
      abortController.abort();
    });

    try {
      await chatService.sendMessageAndStream({
        conversationId,
        userId,
        content,
        documentId,
        refusalThreshold,
        editMessageId,
        signal: abortController.signal,
        handlers: {
          onStatus: (status) => {
            send("status", status);
          },
          onToken: (tokenData) => {
            send("token", tokenData);
          },
          onSources: (sourcesData) => {
            send("sources", sourcesData);
          },
          onDone: (doneData) => {
            send("done", { messageId: doneData.messageId });
            res.end();
          },
          onError: (error) => {
            send("error", { message: error.message });
            res.end();
          },
        },
      });
    } catch (error: any) {
      console.error("[ChatController] sendMessage error:", error?.message || error);
      if (!res.writableEnded) {
        send("error", { message: error?.message || "Internal server error" });
        res.end();
      }
    }
  }
}

export const chatController = new ChatController();
export default chatController;
