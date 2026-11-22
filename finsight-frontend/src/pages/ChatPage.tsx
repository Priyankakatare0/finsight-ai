import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  MessageSquare,
  AlertCircle,
  ArrowRight,
  FileText,
  Upload,
  Layers,
} from "lucide-react";
import chatApi from "../services/chatApi";
import documentApi from "../services/documentApi";
import useChatStream from "../hooks/useChatStream";
import ConversationSidebar from "../components/chat/ConversationSidebar";
import MessageItem from "../components/chat/MessageItem";
import ChatInput from "../components/chat/ChatInput";
import PdfViewerPanel from "../components/chat/PdfViewerPanel";
import { UploadModal } from "../components/documents/UploadModal";
import type { Conversation, MessageSource } from "../types/chat";
import type { DocumentItem } from "../types/document";

const SAMPLE_QUESTIONS = [
  "What was the net profit in FY24?",
  "What were the total net sales and revenue in fiscal 2024?",
  "What were research and development (R&D) expenses?",
  "How much cash was generated from operating activities?",
];

export const ChatPage: React.FC = () => {
  const { conversationId: paramId } = useParams<{ conversationId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queryDocId = searchParams.get("documentId") || searchParams.get("doc");

  const [activeId, setActiveId] = useState<string | null>(paramId || null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(queryDocId || null);
  const [selectedSource, setSelectedSource] = useState<MessageSource | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadInitialFile, setUploadInitialFile] = useState<File | null>(null);

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

  // 2. Fetch user documents with auto-polling for any processing documents
  const {
    data: documents = [],
    refetch: refetchDocuments,
  } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: () => documentApi.listDocuments(),
    refetchInterval: (query) => {
      const docs = query.state.data || [];
      const hasActiveWork = docs.some(
        (doc) => doc.status !== "indexed" && doc.status !== "failed"
      );
      return hasActiveWork ? 2500 : false;
    },
  });

  // 3. Chat Streaming hook
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
    if (!activeId && conversations.length > 0 && !paramId && !queryDocId) {
      const first = conversations[0];
      if (first) {
        setActiveId(first._id);
        navigate(`/chat/${first._id}`, { replace: true });
      }
    }
  }, [conversations, activeId, paramId, queryDocId, navigate]);

  // Handle query parameter ?documentId=... from Documents page or direct navigation
  useEffect(() => {
    if (queryDocId) {
      setSelectedDocId(queryDocId);

      // If active conversation doesn't have documentId or differs, update it
      if (activeId) {
        const activeConv = conversations.find((c) => c._id === activeId);
        if (activeConv && activeConv.documentId !== queryDocId) {
          chatApi
            .updateConversation(activeId, { documentId: queryDocId })
            .then((updated) => {
              queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) =>
                old.map((c) => (c._id === updated._id ? updated : c))
              );
            })
            .catch((err) => console.warn("Failed to bind document to conversation:", err));
        }
      }
    }
  }, [queryDocId, activeId, conversations, queryClient]);

  // Sync selectedDocId with active conversation's documentId
  useEffect(() => {
    if (activeId) {
      const activeConv = conversations.find((c) => c._id === activeId);
      if (activeConv?.documentId) {
        setSelectedDocId(activeConv.documentId);
      } else if (!queryDocId) {
        // If conversation has no bound document and user has exactly 1 document, default to it
        if (!selectedDocId && documents.length === 1 && documents[0]?._id) {
          setSelectedDocId(documents[0]._id);
        }
      }
    } else if (documents.length === 1 && documents[0]?._id && !selectedDocId && !queryDocId) {
      setSelectedDocId(documents[0]._id);
    }
  }, [activeId, conversations, documents, selectedDocId, queryDocId]);

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
    mutationFn: ({ title, documentId }: { title?: string; documentId?: string | null }) =>
      chatApi.createConversation(title, documentId || undefined),
    onSuccess: (newConv) => {
      queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) => [
        newConv,
        ...old,
      ]);
      setActiveId(newConv._id);
      if (newConv.documentId) {
        setSelectedDocId(newConv.documentId);
      }
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
    createConvMutation.mutate({
      title: "New Conversation",
      documentId: selectedDocId,
    });
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeId) return;
    stop();
    setSelectedSource(null);
    setActiveId(id);
    navigate(`/chat/${id}`);
  };

  const handleSelectDocument = async (docId: string | null) => {
    setSelectedDocId(docId);
    if (activeId) {
      try {
        const updated = await chatApi.updateConversation(activeId, {
          documentId: docId,
        });
        queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) =>
          old.map((c) => (c._id === updated._id ? updated : c))
        );
      } catch (err: any) {
        console.error("Failed to update conversation document:", err);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeId) {
      try {
        const newConv = await chatApi.createConversation(
          text.slice(0, 40) + (text.length > 40 ? "..." : ""),
          selectedDocId || undefined
        );
        queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) => [
          newConv,
          ...old,
        ]);
        setActiveId(newConv._id);
        navigate(`/chat/${newConv._id}`, { replace: true });

        setTimeout(() => {
          sendMessage(text, selectedDocId || undefined);
        }, 50);
      } catch (err: any) {
        console.error("Failed to create conversation:", err);
      }
      return;
    }

    sendMessage(text, selectedDocId || undefined);
  };

  const handleEditPrompt = (messageId: string, newContent: string) => {
    if (isStreaming) {
      stop();
    }
    sendMessage(newContent, selectedDocId || undefined, messageId);
  };

  const handleUploadClick = () => {
    setUploadInitialFile(null);
    setIsUploadOpen(true);
  };

  const handleFileDropOrSelect = (file: File) => {
    setUploadInitialFile(file);
    setIsUploadOpen(true);
  };

  const handleUploadSuccess = (newDoc?: DocumentItem) => {
    refetchDocuments();
    if (newDoc?._id) {
      setSelectedDocId(newDoc._id);
      if (activeId) {
        chatApi
          .updateConversation(activeId, { documentId: newDoc._id })
          .then((updated) => {
            queryClient.setQueryData<Conversation[]>(["conversations"], (old = []) =>
              old.map((c) => (c._id === updated._id ? updated : c))
            );
          })
          .catch((err) => console.warn("Failed to link uploaded document to conversation:", err));
      }
    }
  };

  const currentConversation = conversations.find((c) => c._id === activeId);
  const activeDocument = documents.find((d) => d._id === selectedDocId);

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
        <div className="h-14 px-4 sm:px-6 border-b border-slate-800 bg-slate-950/60 backdrop-blur-sm flex items-center justify-between shrink-0 gap-2">
          {/* Conversation Title */}
          <div className="flex items-center space-x-3 truncate">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-sm text-slate-100 truncate">
              {currentConversation?.title || "Financial Document Q&A"}
            </h2>
          </div>

          {/* Right Header: Active Document Chip + PDF View Button */}
          <div className="flex items-center space-x-2 shrink-0">
            {activeDocument ? (
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/60 text-xs">
                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-slate-200 font-medium truncate max-w-[140px] sm:max-w-[200px]">
                    {activeDocument.company && activeDocument.docType
                      ? `${activeDocument.company} (${activeDocument.docType})`
                      : activeDocument.title}
                  </span>

                  {/* Status Indicator */}
                  {activeDocument.status === "indexed" ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">
                      Indexed
                    </span>
                  ) : activeDocument.status === "failed" ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-semibold">
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-semibold animate-pulse">
                      Syncing {activeDocument.progress}%
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedSource({
                      documentId: activeDocument._id,
                      title: activeDocument.title,
                      page: 1,
                      snippet: `Document preview for ${activeDocument.title} (${activeDocument.company}).`,
                    })
                  }
                  title="View PDF Document"
                  className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-colors"
                >
                  View PDF
                </button>
              </div>
            ) : documents.length > 0 ? (
              <span className="inline-flex items-center px-2 py-1 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs font-medium">
                <Layers className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
                <span>All Documents ({documents.length})</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
              </button>
            )}

            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
              Vector Search & Citations
            </span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-2">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-10 text-center flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white mb-4">
                <Sparkles className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-100 mb-1">
                {activeDocument
                  ? `Analyzing: ${activeDocument.title}`
                  : "Grounded Financial Research"}
              </h3>

              <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
                {activeDocument
                  ? `Ask precise financial questions about ${activeDocument.company} (${activeDocument.docType}${activeDocument.fiscalYear ? ` FY${activeDocument.fiscalYear}` : ""
                  }). Every answer includes citations pointing directly to source pages.`
                  : "Upload or select a financial PDF (SEC 10-K, 10-Q, annual reports). Every answer includes citations pointing directly to source pages."}
              </p>

              {/* Upload Document Prompt when no documents exist */}
              {documents.length === 0 && (
                <div className="mb-8 p-4 rounded-2xl bg-slate-900 border border-slate-800 max-w-md w-full text-center space-y-3">
                  <p className="text-xs text-slate-300">
                    No documents uploaded yet. Upload a financial filing to start answering questions!
                  </p>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Financial PDF</span>
                  </button>
                </div>
              )}

              {/* Sample Questions */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q)}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all text-xs text-slate-300 flex items-center justify-between group active:scale-[0.98]"
                  >
                    <span className="truncate mr-2">&quot;{q}&quot;</span>
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
                    onEditSubmit={handleEditPrompt}
                    isStreaming={isStreaming}
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

        {/* 3. Bottom: Input Component with Upload Button & Sources Chip (NotebookLM layout) */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={createConvMutation.isPending}
          onUploadClick={handleUploadClick}
          onFileSelect={handleFileDropOrSelect}
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocument={handleSelectDocument}
        />
      </div>

      {/* 4. Right Side Panel: PDF Viewer & Source Snippet */}
      {selectedSource && (
        <PdfViewerPanel
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      )}

      {/* 5. Document Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadInitialFile(null);
        }}
        onUploadSuccess={handleUploadSuccess}
        initialFile={uploadInitialFile}
      />
    </div>
  );
};

export default ChatPage;
