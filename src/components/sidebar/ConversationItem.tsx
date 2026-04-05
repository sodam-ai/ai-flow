import type { Conversation } from "@/types";
import { Pin, Trash2, MessageSquare } from "lucide-react";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}

/** Returns a compact relative-time string for the sidebar */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
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
      className={`group relative flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
        isActive
          ? "bg-zinc-800 text-zinc-100 shadow-sm"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
    >
      {/* Top row: pin icon + title + actions */}
      <div className="flex items-center gap-1.5 min-w-0">
        {conversation.isPinned && (
          <Pin className="w-2.5 h-2.5 text-violet-400 shrink-0" />
        )}
        <span className="text-xs font-medium truncate flex-1 leading-relaxed">
          {conversation.title}
        </span>

        {/* Hover actions */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className={`p-1 rounded transition-colors ${
              conversation.isPinned
                ? "text-violet-400 hover:bg-zinc-700"
                : "text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            }`}
            title={conversation.isPinned ? "핀 해제" : "핀 고정"}
            aria-label={conversation.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
            title="삭제"
            aria-label="Delete conversation"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Bottom row: message count + time + cost */}
      <div className="flex items-center gap-2 mt-0.5">
        {conversation.messageCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
            <MessageSquare className="w-2.5 h-2.5" />
            {conversation.messageCount}
          </span>
        )}
        <span className="text-[10px] text-zinc-600">
          {relativeTime(conversation.updatedAt)}
        </span>
        {conversation.totalCostUsd > 0 && (
          <span className="text-[10px] text-zinc-600 ml-auto">
            ${conversation.totalCostUsd.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}
