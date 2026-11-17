export interface MessageSource {
  chunkId?: string | undefined;
  documentId?: string | undefined;
  title: string;
  page: number;
  pageEnd?: number | undefined;
  snippet: string;
  score?: number | undefined;
}

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "streaming" | "completed" | "failed";

export interface Message {
  _id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sources: MessageSource[];
  status?: MessageStatus | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface Conversation {
  _id: string;
  userId: string;
  title: string;
  documentId?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  success: boolean;
  data: {
    conversations: Conversation[];
  };
}

export interface ConversationSingleResponse {
  success: boolean;
  data: {
    conversation: Conversation;
  };
}

export interface MessageListResponse {
  success: boolean;
  data: {
    messages: Message[];
  };
}
