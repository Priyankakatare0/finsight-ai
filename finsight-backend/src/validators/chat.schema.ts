import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  documentId: z.string().trim().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  documentId: z.string().trim().nullable().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content cannot be empty"),
  documentId: z.string().trim().optional(),
  refusalThreshold: z.coerce.number().min(0).max(1).optional(),
  editMessageId: z.string().trim().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
