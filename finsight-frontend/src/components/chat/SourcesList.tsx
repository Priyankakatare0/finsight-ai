import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { MessageSource } from "../../types/chat";

interface SourcesListProps {
  sources: MessageSource[];
  onSelectSource?: (source: MessageSource) => void;
}

export const SourcesList: React.FC<SourcesListProps> = ({ sources, onSelectSource }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-blue-400 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        <span>
          {sources.length} Cited Source{sources.length > 1 ? "s" : ""}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-slate-500" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-500" />
        )}
      </button>

      {/* Badges preview row (clickable to open in PDF panel) */}
      {!isExpanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sources.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectSource?.(src)}
              title={`View ${src.title} at page ${src.page}`}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-300 transition-all cursor-pointer group active:scale-95"
            >
              <span className="font-semibold text-blue-400 group-hover:text-blue-300">[{i + 1}]</span>
              <span className="truncate max-w-[140px]">{src.title}</span>
              <span className="text-slate-500 font-mono">p.{src.page}</span>
            </button>
          ))}
        </div>
      )}

      {/* Expanded detailed cards */}
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
          {sources.map((src, i) => (
            <div
              key={i}
              onClick={() => onSelectSource?.(src)}
              className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/50 text-xs flex flex-col justify-between cursor-pointer transition-all group active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                  <span className="flex items-center space-x-1.5 truncate">
                    <span className="text-blue-400 font-bold">[{i + 1}]</span>
                    <span className="truncate group-hover:text-white transition-colors">{src.title}</span>
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 group-hover:bg-blue-900/40 group-hover:text-blue-300">
                    Page {src.page}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 italic">
                  "{src.snippet}"
                </p>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                <span>{src.score !== undefined ? `Relevance: ${(src.score * 100).toFixed(1)}%` : "Verified Passage"}</span>
                <span className="text-blue-400 group-hover:underline flex items-center space-x-0.5">
                  <span>Open PDF</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourcesList;
