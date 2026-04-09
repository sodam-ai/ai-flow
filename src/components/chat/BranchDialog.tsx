import { useState, useRef, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFocusReturn } from "@/hooks/useFocusReturn";

interface Props {
  messageIndex: number;   // 0-based index shown as human-readable (index+1)
  onConfirm: (label: string) => void;
  onCancel: () => void;
}

/**
 * BranchDialog — Compact modal to name a new branch before creation.
 * Label is optional (max 50 chars, validated client+server).
 */
export default function BranchDialog({ messageIndex, onConfirm, onCancel }: Props) {
  const [label, setLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useFocusReturn();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (trimmed.length > 50) return; // client-side guard (server also validates)
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
        onClick={onCancel}
      >
        {/* Dialog */}
        <div
          ref={dialogRef}
          className="relative w-80 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-dialog-title"
        >
          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-900/40 border border-violet-700/30 flex items-center justify-center shrink-0" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                className="w-4.5 h-4.5 text-violet-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <div>
              <h2 id="branch-dialog-title" className="text-sm font-semibold text-zinc-100">브랜치 생성</h2>
              <p className="text-xs text-zinc-500">메시지 #{messageIndex + 1} 시점에서 분기</p>
            </div>
          </div>

          {/* Label input */}
          <div className="space-y-1.5">
            <label htmlFor="branch-label" className="text-xs font-medium text-zinc-400">
              레이블 <span className="text-zinc-600">(선택)</span>
            </label>
            <div className="relative">
              <input
                id="branch-label"
                ref={inputRef}
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 50))}
                onKeyDown={handleKeyDown}
                placeholder="예: 다른 접근법, 실험적 방향..."
                maxLength={50}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 placeholder-zinc-600 text-zinc-200 transition-colors"
              />
              {label.length > 0 && (
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] ${label.length >= 45 ? "text-amber-500" : "text-zinc-600"}`}
                >
                  {label.length}/50
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-600">
              메시지 #{messageIndex + 1}까지의 내용이 새 대화로 복사됩니다
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              aria-label="브랜치 생성 취소"
              className="flex-1 py-2 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              aria-label="브랜치 생성 확인"
              className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
            >
              브랜치 생성
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
