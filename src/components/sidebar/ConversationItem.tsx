import { useState, useRef, useEffect } from "react";
import { Pin, Trash2, MessageSquare, Pencil, Check, X, AlertTriangle } from "lucide-react";
import type { Conversation } from "@/types";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

/**
 * ConversationItem — sidebar entry for a single conversation.
 *
 * Features (Phase 14):
 *   - Inline rename: double-click title OR pencil button → edit input → Enter/blur saves, Esc cancels
 *   - Inline delete confirm: amber warning box instead of immediate delete
 *   - focus-within action visibility: keyboard users can reach pin/rename/delete buttons
 *
 * Security (ASVS 5.1.1):
 *   - maxLength=100 on rename input — prevents oversized titles
 *   - trim + non-empty check before calling onRename
 *   - No innerHTML, no dangerouslySetInnerHTML
 *
 * Accessibility (WCAG 2.1 AA):
 *   - action buttons visible on hover OR focus-within (not CSS-only hover)
 *   - autoFocus on rename input
 *   - aria-label on all icon buttons
 *   - role="alert" on delete confirmation for screen reader announcement
 */

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
  onRename,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync title if prop changes externally (e.g. optimistic update reverted)
  useEffect(() => {
    if (!isEditing) setEditTitle(conversation.title);
  }, [conversation.title, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing]);

  const startEditing = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setConfirmDelete(false);
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
    setIsEditing(false);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <div
      className={`group relative flex flex-col px-3 py-2 rounded-lg transition-all duration-150 ${
        isActive
          ? "bg-zinc-800 text-zinc-100 shadow-sm"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      } ${!isEditing ? "cursor-pointer" : ""}`}
      onClick={!isEditing && !confirmDelete ? onClick : undefined}
    >
      {/* ── Top row: pin icon + title/input + actions ────────────── */}
      <div className="flex items-center gap-1.5 min-w-0">
        {conversation.isPinned && !isEditing && (
          <Pin className="w-2.5 h-2.5 text-violet-400 shrink-0" aria-hidden="true" />
        )}

        {/* Title — double-click to rename */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={commitRename}
            maxLength={100}
            aria-label="대화 제목 편집"
            className="flex-1 min-w-0 text-xs font-medium bg-zinc-700 text-zinc-100
                       px-1.5 py-0.5 rounded border border-zinc-600
                       focus:outline-none focus:border-violet-500
                       focus-visible:ring-1 focus-visible:ring-violet-500/50"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs font-medium truncate flex-1 leading-relaxed select-none"
            onDoubleClick={startEditing}
            title={`${conversation.title} (더블클릭으로 이름 변경)`}
          >
            {conversation.title}
          </span>
        )}

        {/* Action buttons — visible on hover OR keyboard focus-within */}
        {!isEditing && !confirmDelete && (
          <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 shrink-0 ml-auto">
            {/* Rename */}
            <button
              onClick={startEditing}
              className="p-1 rounded transition-colors text-zinc-500
                         hover:bg-zinc-700 hover:text-zinc-300
                         focus-visible:outline-none focus-visible:ring-1
                         focus-visible:ring-zinc-500/50"
              aria-label="대화 이름 변경"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
            </button>
            {/* Pin */}
            <button
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              className={`p-1 rounded transition-colors ${
                conversation.isPinned
                  ? "text-violet-400 hover:bg-zinc-700"
                  : "text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50`}
              aria-label={conversation.isPinned ? "상단 고정 해제" : "상단에 고정"}
            >
              <Pin className="w-3 h-3" aria-hidden="true" />
            </button>
            {/* Delete */}
            <button
              onClick={handleDeleteClick}
              className="p-1 rounded transition-colors text-zinc-500
                         hover:bg-zinc-700 hover:text-red-400
                         focus-visible:outline-none focus-visible:ring-1
                         focus-visible:ring-red-500/50"
              aria-label="대화 삭제"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Confirm/cancel icons while editing */}
        {isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            <button
              onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
              className="p-1 rounded transition-colors text-green-400 hover:bg-zinc-700
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500/50"
              aria-label="이름 변경 확인"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}
              className="p-1 rounded transition-colors text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50"
              aria-label="이름 변경 취소"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom row: message count + time + cost ─────────────── */}
      {!isEditing && !confirmDelete && (
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          {/* Model badge — compact provider·model label */}
          <span
            className="text-[10px] text-zinc-600 font-mono truncate max-w-[90px]"
            title={`${conversation.providerId} · ${conversation.modelId}`}
          >
            {conversation.modelId?.split("-").slice(0, 2).join("-") ?? ""}
          </span>

          {conversation.messageCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-600 shrink-0">
              <MessageSquare className="w-2.5 h-2.5" aria-hidden="true" />
              {conversation.messageCount}
            </span>
          )}
          <span className="text-[10px] text-zinc-600 shrink-0">
            {relativeTime(conversation.updatedAt)}
          </span>
          {conversation.totalCostUsd > 0 && (
            <span className="text-[10px] text-zinc-600 ml-auto shrink-0">
              ${conversation.totalCostUsd.toFixed(3)}
            </span>
          )}
        </div>
      )}

      {/* ── Inline delete confirm ────────────────────────────────── */}
      {confirmDelete && (
        <div
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 px-2 py-1.5
                     bg-red-950/40 border border-red-800/40 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" aria-hidden="true" />
          <p className="text-[10px] text-red-300 flex-1 leading-tight">
            이 대화를 삭제합니다. 복구 불가.
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCancelDelete}
              className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200
                         rounded transition-colors
                         focus-visible:outline-none focus-visible:ring-1
                         focus-visible:ring-zinc-500/50"
              aria-label="삭제 취소"
            >
              취소
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-1.5 py-0.5 text-[10px] font-medium text-white
                         bg-red-600 hover:bg-red-500 rounded transition-colors
                         focus-visible:outline-none focus-visible:ring-1
                         focus-visible:ring-red-400/50"
              aria-label="대화 삭제 확인"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
