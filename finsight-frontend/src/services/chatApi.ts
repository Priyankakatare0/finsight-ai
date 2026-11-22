import api from "../lib/axios";
import type {
  Conversation,
  ConversationListResponse,
  ConversationSingleResponse,
  Message,
  MessageListResponse,
} from "../types/chat";

export const chatApi = {
  async listConversations(): Promise<Conversation[]> {
    const { data } = await api.get<ConversationListResponse>("/chat/conversations");
    return data.data.conversations;
  },

  async getConversation(id: string): Promise<Conversation> {
    const { data } = await api.get<ConversationSingleResponse>(`/chat/conversations/${id}`);
    return data.data.conversation;
  },

  async createConversation(title?: string, documentId?: string): Promise<Conversation> {
    const { data } = await api.post<ConversationSingleResponse>("/chat/conversations", {
      title,
      documentId,
    });
    return data.data.conversation;
  },

  async updateConversation(
    id: string,
    updates: { title?: string; documentId?: string | null }
  ): Promise<Conversation> {
    const { data } = await api.patch<ConversationSingleResponse>(
      `/chat/conversations/${id}`,
      updates
    );
    return data.data.conversation;
  },

  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/chat/conversations/${id}`);
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data } = await api.get<MessageListResponse>(`/chat/conversations/${conversationId}/messages`);
    return data.data.messages;
  },
};

export default chatApi;
