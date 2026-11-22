import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Square,
  Paperclip,
  FileText,
  ChevronDown,
  Check,
  Plus,
  Layers,
  Sparkles,
} from "lucide-react";
import type { DocumentItem } from "../../types/document";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  onUploadClick?: () => void;
  onFileSelect?: (file: File) => void;
  documents?: DocumentItem[];
  selectedDocId?: string | null;
  onSelectDocument?: (documentId: string | null) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  placeholder = "Ask a question about your uploaded financial documents...",
  onUploadClick,
  onFileSelect,
  documents = [],
  selectedDocId = null,
  onSelectDocument,
}) => {
  const [input, setInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isStreaming) {
      onStop();
      return;
    }

    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-expand textarea up to ~150px
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect?.(file);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        onFileSelect?.(file);
      }
    }
  };

  const activeDoc = documents.find((d) => d._id === selectedDocId);

  // Label for the sources chip (NotebookLM style)
  const sourcesChipLabel = activeDoc
    ? activeDoc.company && activeDoc.docType
      ? `${activeDoc.company} ${activeDoc.docType}`
      : activeDoc.title
    : documents.length > 0
    ? `${documents.length} source${documents.length === 1 ? "" : "s"}`
    : "Add source";

  return (
    <div className="p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-4xl mx-auto relative" ref={dropdownRef}>
        {/* Hidden native file input for direct file upload via icon */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Sources Dropdown (opens above the input field) */}
        {isDropdownOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-80 max-h-80 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs text-slate-200 divide-y divide-slate-800/60 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Select Active Document</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {documents.length} available
              </span>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onSelectDocument?.(null);
                  setIsDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors ${
                  !selectedDocId ? "bg-blue-600/10 text-blue-400 font-medium" : "text-slate-300"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">All Documents ({documents.length})</span>
                </div>
                {!selectedDocId && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>

              {documents.map((doc) => {
                const isSelected = doc._id === selectedDocId;
                return (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => {
                      onSelectDocument?.(doc._id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors ${
                      isSelected ? "bg-blue-600/10 text-blue-400 font-medium" : "text-slate-300"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                      <div className="truncate">
                        <div className="truncate text-xs">{doc.title}</div>
                        <div className="text-[10px] text-slate-500">
                          {doc.company} • {doc.docType} {doc.fiscalYear ? `FY${doc.fiscalYear}` : ""}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 px-1">
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  if (onUploadClick) {
                    onUploadClick();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload New Financial PDF</span>
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex items-end rounded-2xl bg-slate-900 border transition-all shadow-inner ${
            isDragging
              ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/20"
              : "border-slate-800 focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/50"
          }`}
        >
          {/* 1. Left Upload Icon Button (NotebookLM style) */}
          <div className="p-2 pb-2.5 pl-3 flex items-center">
            <button
              type="button"
              onClick={() => {
                if (onUploadClick) {
                  onUploadClick();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              title="Upload financial PDF document"
              className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800/80 active:scale-95 transition-all cursor-pointer group"
            >
              <Paperclip className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            </button>
          </div>

          {/* 2. Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              activeDoc
                ? `Ask a question about ${activeDoc.title}...`
                : placeholder
            }
            rows={1}
            className="flex-1 resize-none bg-transparent py-3.5 px-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all leading-relaxed max-h-36 overflow-y-auto"
          />

          {/* 3. Right: Sources / Document Badge + Send Button (Gemini NotebookLM layout) */}
          <div className="p-2 pb-2.5 pr-2.5 flex items-center space-x-2 shrink-0">
            {/* Sources Chip (Clickable to switch documents, just like NotebookLM) */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              title={activeDoc ? `Active: ${activeDoc.title}` : "Select document / sources"}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                activeDoc
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {activeDoc ? (
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : (
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                {sourcesChipLabel}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Send / Stop Generation Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-medium text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || disabled}
                title="Send message (Enter)"
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="text-center mt-2 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
        <Sparkles className="w-3 h-3 text-blue-400" />
        <span>
          FinSight AI answers are strictly grounded in uploaded filings with [1], [2] citations.
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
