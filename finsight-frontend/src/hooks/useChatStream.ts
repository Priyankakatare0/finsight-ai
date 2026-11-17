import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import type { Message, MessageSource } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export interface UseChatStreamOptions {
  conversationId: string | null;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export type StatusStage = "retrieving" | "generating" | null;

export function useChatStream({ conversationId, onDone, onError }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [statusStage, setStatusStage] = useState<StatusStage>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStatusStage(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string, documentId?: string) => {
      const trimmed = content.trim();
      if (!trimmed || !conversationId) return;

      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        const err = new Error("Authentication token not found. Please log in.");
        setError(err.message);
        onError?.(err);
        return;
      }

      setError(null);
      setIsStreaming(true);
      setStatusStage("retrieving");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Optimistically append user message
      const userMessageId = `user-${Date.now()}`;
      const optimisticUserMsg: Message = {
        _id: userMessageId,
        conversationId,
        role: "user",
        content: trimmed,
        sources: [],
        status: "completed",
        createdAt: new Date().toISOString(),
      };

      // Optimistic placeholder for assistant's streamed response
      const assistantMessageId = `assistant-${Date.now()}`;
      const placeholderAssistantMsg: Message = {
        _id: assistantMessageId,
        conversationId,
        role: "assistant",
        content: "",
        sources: [],
        status: "streaming",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMsg, placeholderAssistantMsg]);

      try {
        const response = await fetch(
          `${API_BASE_URL}/chat/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              content: trimmed,
              documentId: documentId || undefined,
            }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          let errorMsg = `Server responded with ${response.status}`;
          try {
            const errJson = await response.json();
            errorMsg = errJson.message || errJson.error?.message || errorMsg;
          } catch {
            // response was not JSON
          }
          throw new Error(errorMsg);
        }

        if (!response.body) {
          throw new Error("ReadableStream not supported by this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on blank lines: standard SSE format
          const parts = buffer.split(/\r?\n\r?\n/);
          // Keep the last (possibly incomplete) block in the buffer
          buffer = parts.pop() || "";

          for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart || trimmedPart.startsWith(":")) {
              continue; // Skip comments/keep-alives
            }

            let eventName = "message";
            let dataStr = "";

            const lines = trimmedPart.split(/\r?\n/);
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr += (dataStr ? "\n" : "") + line.slice(5).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              // 1. Status event ('retrieving', 'generating')
              if (eventName === "status") {
                if (data.stage === "retrieving" || data.stage === "generating") {
                  setStatusStage(data.stage);
                }
              }

              // 2. Sources event: store the list of sources on the assistant message
              else if (eventName === "sources") {
                const incomingSources: MessageSource[] = data.sources || [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg._id === assistantMessageId
                      ? { ...msg, sources: incomingSources }
                      : msg
                  )
                );
              }

              // 3. Token event: append text to the last assistant message
              else if (eventName === "token") {
                const tokenText = data.text ?? data.token ?? "";
                if (tokenText) {
                  setStatusStage("generating");
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg._id === assistantMessageId
                        ? { ...msg, content: msg.content + tokenText }
                        : msg
                    )
                  );
                }
              }

              // 4. Done event: finalize assistant message ID, clear streaming status, refetch conversation
              else if (eventName === "done") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg._id === assistantMessageId
                      ? {
                          ...msg,
                          _id: data.messageId || msg._id,
                          status: "completed",
                        }
                      : msg
                  )
                );
                setIsStreaming(false);
                setStatusStage(null);
                onDone?.();
              }

              // 5. Error event
              else if (eventName === "error") {
                throw new Error(data.message || "Streaming error occurred");
              }
            } catch (parseErr) {
              console.warn("Failed to parse SSE event:", parseErr, dataStr);
            }
          }
        }

        setIsStreaming(false);
        setStatusStage(null);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Chat streaming aborted by user.");
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === assistantMessageId
                ? { ...msg, status: "completed" }
                : msg
            )
          );
        } else {
          console.error("Chat streaming error:", err);
          const errorText = err.message || "Failed to stream answer";
          setError(errorText);
          onError?.(err);

          // Update assistant message with error state if empty
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === assistantMessageId && !msg.content
                ? {
                    ...msg,
                    content: "An error occurred while generating the answer. Please try again.",
                    status: "failed",
                  }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setStatusStage(null);
        abortControllerRef.current = null;
      }
    },
    [conversationId, onDone, onError]
  );

  return {
    messages,
    setMessages,
    sendMessage,
    stop,
    isStreaming,
    statusStage,
    error,
  };
}

export default useChatStream;
