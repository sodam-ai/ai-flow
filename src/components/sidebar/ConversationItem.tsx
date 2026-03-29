import type { Conversation } from "@/types";
import { Pin, Trash2 } from "lucide-react";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  onPin,
  onDelete,
}: Props) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
    >
      {conversation.isPinned && (
        <Pin className="w-3 h-3 text-zinc-500 shrink-0" />
      )}
      <span className="text-sm truncate flex-1">{conversation.title}</span>

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          className="p-1 rounded hover:bg-zinc-700"
          title={conversation.isPinned ? "Unpin" : "Pin"}
        >
          <Pin className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-zinc-700 text-red-400"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {conversation.totalCostUsd > 0 && (
        <span className="text-[10px] text-zinc-600 shrink-0">
          ${conversation.totalCostUsd.toFixed(3)}
        </span>
      )}
    </div>
  );
}
