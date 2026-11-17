import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, MessageSquare, AlertCircle, ArrowRight } from "lucide-react";
import chatApi from "../services/chatApi";
import useChatStream from "../hooks/useChatStream";
import ConversationSidebar from "../components/chat/ConversationSidebar";
import MessageItem from "../components/chat/MessageItem";
import ChatInput from "../components/chat/ChatInput";
import PdfViewerPanel from "../components/chat/PdfViewerPanel";
import type { Conversation, MessageSource } from "../types/chat";

const SAMPLE_QUESTIONS = [
  "What was the net profit in FY24?",
  "What were the total net sales and revenue in fiscal 2024?",
  "What were research and development (R&D) expenses?",
  "How much cash was generated from operating activities?",
];

export const ChatPage: React.FC = () => {
  const { conversationId: paramId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(paramId || null);
  const [selectedSource, setSelectedSource] = useState<MessageSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch user conversations
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    refetch: refetchConversations,
  } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => chatApi.listConversations(),
  });

  // 2. Chat Streaming hook
  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    isStreaming,
    statusStage,
    error: streamError,
  } = useChatStream({
    conversationId: activeId,
    onDone: () => {
      // Refetch conversations so titles and order update
      refetchConversations();
    },
  });

  // Sync activeId with URL param if changed
  useEffect(() => {
    if (paramId && paramId !== activeId) {
      setActiveId(paramId);
    }
  }, [paramId, activeId]);

  // Set first conversation as active if none selected and conversations exist
  useEffect(() => {
    if (!activeId && conversations.length > 0 && !paramId) {
      const first = conversations[0];
      if (first) {
        setActiveId(first._id);
        navigate(`/chat/${first._id}`, { replace: true });
      }
    }
  }, [conversations, activeId, paramId, navigate]);

  // Load message history when activeId changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setSelectedSource(null);
      return;
    }

    let isMounted = true;
    chatApi
      .getMessages(activeId)
      .then((history) => {
        if (isMounted) {
          setMessages(history);
        }
      })
      .catch((err) => {
        console.error("Failed to load message history:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeId, setMessages]);

  // Close PDF panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSource) {
        setSelectedSource(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSource]);

  // Auto-scroll to bottom as tokens stream in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusStage]);

  // Create new conversation mutation
  const createConvMutation = useMutation({
    mutationFn: (title?: string) => chatApi.createConversation(title),
    onSuccess: (newConv) => {
      queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) => [
        newConv,
        ...old,
      ]);
      setActiveId(newConv._id);
      setMessages([]);
      setSelectedSource(null);
      navigate(`/chat/${newConv._id}`);
    },
  });

  // Delete conversation mutation
  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => chatApi.deleteConversation(id),
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) =>
        old.filter((c) => c._id !== deletedId)
      );
      if (activeId === deletedId) {
        const remaining = conversations.filter((c) => c._id !== deletedId);
        const nextId = remaining[0]?._id || null;
        setActiveId(nextId);
        setSelectedSource(null);
        if (nextId) {
          navigate(`/chat/${nextId}`);
        } else {
          setMessages([]);
          navigate("/chat");
        }
      }
    },
  });

  const handleNewChat = () => {
    stop();
    setSelectedSource(null);
    createConvMutation.mutate("New Conversation");
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeId) return;
    stop();
    setSelectedSource(null);
    setActiveId(id);
    navigate(`/chat/${id}`);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeId) {
      try {
        const newConv = await chatApi.createConversation(
          text.slice(0, 40) + (text.length > 40 ? "..." : "")
        );
        queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) => [
          newConv,
          ...old,
        ]);
        setActiveId(newConv._id);
        navigate(`/chat/${newConv._id}`, { replace: true });

        setTimeout(() => {
          sendMessage(text);
        }, 50);
      } catch (err: any) {
        console.error("Failed to create conversation:", err);
      }
      return;
    }

    sendMessage(text);
  };

  const currentConversation = conversations.find((c) => c._id === activeId);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
      {/* 1. Left Sidebar: Conversation List */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={(id) => deleteConvMutation.mutate(id)}
        isLoading={isLoadingConversations}
      />

      {/* 2. Middle: Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {/* Chat Header Bar */}
        <div className="h-14 px-6 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 truncate">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-sm text-slate-100 truncate">
              {currentConversation?.title || "Financial Document Q&A"}
            </h2>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
              Vector Search & Citations
            </span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-2">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-12 text-center flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-1">
                Grounded Financial Research
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-8 leading-relaxed">
                Ask precise financial questions about your uploaded SEC 10-K, 10-Q, and annual reports. Every answer includes citations pointing directly to source pages.
              </p>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all text-xs text-slate-300 flex items-center justify-between group active:scale-[0.98]"
                  >
                    <span className="truncate mr-2">"{q}"</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map((msg, index) => {
                const isLast = index === messages.length - 1;
                return (
                  <MessageItem
                    key={msg._id || index}
                    message={msg}
                    isLatestStreaming={isLast && isStreaming}
                    statusStage={isLast && isStreaming ? statusStage : null}
                    onSelectCitation={(source) => setSelectedSource(source)}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Stream Error Alert */}
          {streamError && (
            <div className="max-w-4xl mx-auto mt-2 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{streamError}</span>
            </div>
          )}
        </div>

        {/* 3. Bottom: Input Component */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={createConvMutation.isPending}
        />
      </div>

      {/* 4. Right Side Panel: PDF Viewer & Source Snippet (Step 10.2 & 10.3) */}
      {selectedSource && (
        <PdfViewerPanel
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}
    </div>
  );
};

export default ChatPage;
