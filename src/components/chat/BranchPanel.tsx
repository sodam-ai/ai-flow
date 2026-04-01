import { useEffect, useState, useCallback } from "react";
import { listConversationBranches } from "@/lib/ipc/invoke";
import type { ConversationBranch } from "@/types";

interface Props {
  conversationId: string | null;
  onNavigate: (branchConvId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * BranchPanel — Slide-in panel showing all branches of the current conversation.
 * Each branch shows its label, fork point index, creation date and a "열기" button.
 */
export default function BranchPanel({ conversationId, onNavigate, isOpen, onClose }: Props) {
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [loading, setLoading] = useState(false);

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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="w-4 h-4 text-violet-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
            <span className="text-sm font-medium text-zinc-100">대화 브랜치</span>
            {branches.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/50 text-violet-300 font-medium">
                {branches.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label="패널 닫기"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Branch list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <svg className="w-5 h-5 text-zinc-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          )}

          {!loading && branches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-zinc-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-500">브랜치 없음</p>
                <p className="text-xs text-zinc-600 mt-0.5">메시지에서 브랜치를 생성하세요</p>
              </div>
            </div>
          )}

          {!loading && branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onNavigate={() => {
                onNavigate(branch.branch_conversation_id);
                onClose();
              }}
            />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            메시지 위에 마우스를 올리면 <span className="text-zinc-500">⑂ 분기</span> 버튼이 나타납니다
          </p>
        </div>
      </div>
    </>
  );
}

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

  return (
    <div className="group rounded-lg border border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all p-3 space-y-2">
      {/* Label + meta */}
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-md bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-violet-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">
            {branch.label ?? `브랜치 #${branch.id}`}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            메시지 #{branch.fork_message_index + 1} 시점 · {date}
          </p>
        </div>
      </div>

      {/* Navigate button */}
      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-violet-900/40 text-zinc-400 hover:text-violet-300 border border-zinc-700 hover:border-violet-700/50 transition-all cursor-pointer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
        이 브랜치 열기
      </button>
    </div>
  );
}
