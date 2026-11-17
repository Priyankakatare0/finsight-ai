import React, { useState } from "react";
import { Plus, MessageSquare, Trash2, Search, Loader2 } from "lucide-react";
import type { Conversation } from "../../types/chat";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-72 sm:w-80 border-r border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
      {/* Top Header & New Chat Button */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Search Input */}
        {conversations.length > 3 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading conversations...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500 text-xs">
            {searchTerm ? "No matching conversations found." : "No conversations yet. Start one above!"}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv._id === activeId;
            return (
              <div
                key={conv._id}
                onClick={() => onSelect(conv._id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive
                    ? "bg-slate-800/90 text-white font-medium shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate flex-1 mr-2">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"
                    }`}
                  />
                  <span className="truncate">{conv.title || "New Conversation"}</span>
                </div>

                <button
                  type="button"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv._id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default ConversationSidebar;
