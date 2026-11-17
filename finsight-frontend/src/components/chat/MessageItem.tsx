import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles, Loader2 } from "lucide-react";
import type { Message, MessageSource } from "../../types/chat";
import SourcesList from "./SourcesList";

interface MessageItemProps {
  message: Message;
  isLatestStreaming?: boolean;
  statusStage?: "retrieving" | "generating" | null;
  onSelectCitation?: (source: MessageSource) => void;
}

/**
 * Step 10.1: Replaces bracketed citations like [1] or [2] in text with clickable chips
 */
function renderWithCitations(
  children: React.ReactNode,
  sources: MessageSource[] = [],
  onSelectCitation?: (source: MessageSource) => void
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts = child.split(/(\[\d+\])/g);
      if (parts.length === 1) return child;

      return parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          const source = sources[num - 1];

          if (source) {
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectCitation?.(source);
                }}
                title={`Source [${num}]: ${source.title} (Page ${source.page}) - Click to open PDF`}
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 hover:bg-blue-500/35 text-blue-400 hover:text-blue-200 border border-blue-500/40 mx-0.5 align-baseline transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              >
                [{num}]
              </button>
            );
          }
        }
        return part;
      });
    }

    if (React.isValidElement(child) && (child.props as any)?.children) {
      return React.cloneElement(
        child as React.ReactElement<any>,
        undefined,
        renderWithCitations((child.props as any).children, sources, onSelectCitation)
      );
    }

    return child;
  });
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isLatestStreaming = false,
  statusStage = null,
  onSelectCitation,
}) => {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="flex items-start max-w-[85%] md:max-w-[75%] space-x-3">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md shadow-blue-900/20 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  const isPendingRetrieval = isLatestStreaming && !message.content && statusStage === "retrieving";
  const isPendingGeneration = isLatestStreaming && !message.content && statusStage === "generating";

  const sources = message.sources || [];

  return (
    <div className="flex justify-start mb-6">
      <div className="flex items-start max-w-[95%] md:max-w-[88%] space-x-3.5">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 text-white font-bold text-xs">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="flex-1 bg-slate-900/70 border border-slate-800/80 rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow-sm text-sm text-slate-200">
          {/* Status Indicator when retrieval/generation is starting */}
          {isPendingRetrieval && (
            <div className="flex items-center space-x-2 text-slate-400 py-1 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-xs font-medium">Retrieving document chunks...</span>
            </div>
          )}

          {isPendingGeneration && (
            <div className="flex items-center space-x-2 text-slate-400 py-1 animate-pulse">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-xs font-medium">Synthesizing financial answer...</span>
            </div>
          )}

          {/* Render Answer with react-markdown and clickable [1] citation chips */}
          {message.content && (
            <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node, children, ...props }) => (
                    <p className="mb-2.5 last:mb-0 leading-relaxed" {...props}>
                      {renderWithCitations(children, sources, onSelectCitation)}
                    </p>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li className="leading-relaxed" {...props}>
                      {renderWithCitations(children, sources, onSelectCitation)}
                    </li>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td className="px-3 py-2 border-b border-slate-800/60 text-slate-300 font-mono text-[11px]" {...props}>
                      {renderWithCitations(children, sources, onSelectCitation)}
                    </td>
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-slate-800 bg-slate-950/60">
                      <table className="min-w-full divide-y divide-slate-800 text-xs text-left" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="px-3 py-2 bg-slate-800/80 font-semibold text-slate-200 uppercase tracking-wider text-[11px]" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-5 mb-2.5 space-y-1" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal pl-5 mb-2.5 space-y-1" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-white" {...props} />
                  ),
                  code: ({ node, ...props }) => (
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-xs" {...props} />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming active blinking cursor */}
          {isLatestStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500 animate-pulse align-middle" />
          )}

          {/* Cited sources row and cards with click to open */}
          {sources.length > 0 && (
            <SourcesList
              sources={sources}
              onSelectSource={onSelectCitation}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
