import { useEffect, useRef, useState, useCallback } from "react";
import { GitBranch, ArrowRight, X } from "lucide-react";
import { listConversationBranches } from "@/lib/ipc/invoke";
import type { ConversationBranch } from "@/types";

interface Props {
  conversationId: string | null;
  onNavigate: (branchConvId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * BranchPanel — slide-in dialog showing all branches of the current conversation.
 *
 * Accessibility (WCAG 2.1 AA):
 *   - role="dialog" + aria-modal + focus management (close button auto-focused)
 *   - Escape key closes the panel (WCAG 2.1.2)
 *   - ul/li list semantics for branch items
 *   - Skeleton loading cards with aria-busy + sr-only live announcement
 *   - Navigate button: aria-label with branch name + focus-visible ring
 */
export default function BranchPanel({ conversationId, onNavigate, isOpen, onClose }: Props) {
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const loadBranches = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await listConversationBranches(conversationId);
      setBranches(data);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadBranches();
    }
  }, [isOpen, conversationId, loadBranches]);

  // Focus management — move focus to close button on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    }
  }, [isOpen]);

  // Escape key closes the panel (WCAG 2.1.2)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="대화 브랜치 목록"
        aria-modal="true"
        className="fixed right-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl"
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-900/40 flex items-center justify-center shrink-0">
              <GitBranch className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium text-zinc-100">대화 브랜치</span>
            {branches.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-300 font-medium">
                {branches.length}
              </span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
            aria-label="브랜치 패널 닫기 (Esc)"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Branch list */}
        <ul
          role="list"
          aria-label="브랜치 목록"
          aria-busy={loading}
          className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        >
          {/* Skeleton loading cards */}
          {loading && [1, 2, 3].map((i) => (
            <li key={i} aria-hidden="true" className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-2 animate-pulse">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-md bg-zinc-700/50 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 rounded bg-zinc-700/50 w-3/4" />
                  <div className="h-2.5 rounded bg-zinc-700/30 w-1/2" />
                </div>
              </div>
              <div className="h-7 rounded-md bg-zinc-700/30" />
            </li>
          ))}
          {/* Screen-reader-only live loading announcement */}
          {loading && (
            <li>
              <p className="sr-only" role="status" aria-live="polite">브랜치 목록 로딩 중...</p>
            </li>
          )}

          {/* Empty state */}
          {!loading && branches.length === 0 && (
            <li>
              <div role="status" className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-zinc-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-zinc-400 font-medium">브랜치 없음</p>
                  <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                    메시지 위에 마우스를 올리면<br />
                    <span className="text-zinc-500 font-medium">⑂ 분기</span> 버튼이 나타납니다
                  </p>
                </div>
              </div>
            </li>
          )}

          {/* Branch cards */}
          {!loading && branches.map((branch) => (
            <li key={branch.id}>
              <BranchCard
                branch={branch}
                onNavigate={() => {
                  onNavigate(branch.branch_conversation_id);
                  onClose();
                }}
              />
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 shrink-0" aria-hidden="true">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Esc 또는 외부 영역 클릭으로 닫기
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Branch card ──────────────────────────────────────────────────────────────

function BranchCard({
  branch,
  onNavigate,
}: {
  branch: ConversationBranch;
  onNavigate: () => void;
}) {
  const date = new Date(branch.created_at).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const label = branch.label ?? `브랜치 #${branch.id}`;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all p-3 space-y-2">
      {/* Label + meta */}
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-md bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
          <GitBranch className="w-3 h-3 text-violet-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">{label}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            메시지 #{branch.fork_message_index + 1} 시점 · {date}
          </p>
        </div>
      </div>

      {/* Navigate button */}
      <button
        onClick={onNavigate}
        aria-label={`${label} 열기`}
        className="group/nav w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium
                   bg-zinc-800 hover:bg-violet-900/40 text-zinc-400 hover:text-violet-300
                   border border-zinc-700 hover:border-violet-700/50 transition-all cursor-pointer
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
      >
        <ArrowRight
          className="w-3.5 h-3.5 transition-transform duration-150 group-hover/nav:translate-x-0.5"
          aria-hidden="true"
        />
        이 브랜치 열기
      </button>
    </div>
  );
}
