import { useEffect, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

/**
 * ChatSearchBar — Ctrl+F in-conversation search panel.
 *
 * Security (ASVS 5.1.1):
 *   - Input maxLength=500 enforced both on onChange and HTML attribute
 *   - No dangerouslySetInnerHTML — all output is React text
 *   - Client-side filter only (no IPC call = zero injection risk)
 *
 * Accessibility (WCAG 2.1 AA):
 *   - role="search", aria-label on container
 *   - aria-live="polite" on result counter for screen reader announcements
 *   - focus-visible rings on all interactive elements
 *   - Keyboard: Enter→next, Shift+Enter→prev, Escape→close
 */

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  currentIndex: number; // 0-based
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

const MAX_QUERY_LEN = 500;

export default function ChatSearchBar({
  query,
  onQueryChange,
  resultCount,
  currentIndex,
  onPrev,
  onNext,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const hasResults = resultCount > 0;
  const displayIndex = hasResults ? currentIndex + 1 : 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div
      role="search"
      aria-label="채팅 메시지 검색"
      className="animate-search-bar-in shrink-0 flex items-center gap-2 px-4 py-2
                 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm"
    >
      {/* Search icon */}
      <Search
        className="w-3.5 h-3.5 text-zinc-500 shrink-0"
        aria-hidden="true"
      />

      {/* Query input */}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          // ASVS 5.1.1 — enforce 500 char max at JS level too
          if (e.target.value.length <= MAX_QUERY_LEN) {
            onQueryChange(e.target.value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.shiftKey ? onPrev() : onNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="메시지 검색… (Enter: 다음 · Shift+Enter: 이전 · Esc: 닫기)"
        maxLength={MAX_QUERY_LEN}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="검색어 입력"
        className="flex-1 min-w-0 bg-transparent text-sm text-zinc-200
                   placeholder-zinc-600 focus:outline-none selection:bg-violet-700/40"
      />

      {/* Result counter — aria-live for screen readers */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className={`shrink-0 text-xs tabular-nums min-w-[64px] text-right transition-colors duration-150 ${
          !hasQuery
            ? "text-zinc-700"
            : hasResults
            ? "text-zinc-400"
            : "text-red-400/90"
        }`}
      >
        {!hasQuery ? "" : hasResults ? `${displayIndex} / ${resultCount}` : "결과 없음"}
      </span>

      {/* Navigation buttons — only shown when there are results */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onPrev}
          disabled={!hasResults || resultCount <= 1}
          aria-label="이전 결과 (Shift+Enter)"
          title="이전 결과 (Shift+Enter)"
          className="w-6 h-6 flex items-center justify-center rounded
                     text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                     disabled:opacity-25 disabled:cursor-not-allowed
                     transition-colors duration-100
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-violet-500/50 focus-visible:ring-offset-1
                     focus-visible:ring-offset-zinc-950"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNext}
          disabled={!hasResults || resultCount <= 1}
          aria-label="다음 결과 (Enter)"
          title="다음 결과 (Enter)"
          className="w-6 h-6 flex items-center justify-center rounded
                     text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                     disabled:opacity-25 disabled:cursor-not-allowed
                     transition-colors duration-100
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-violet-500/50 focus-visible:ring-offset-1
                     focus-visible:ring-offset-zinc-950"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-zinc-800 shrink-0" aria-hidden="true" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="검색 닫기 (Esc)"
        title="검색 닫기 (Esc)"
        className="w-6 h-6 flex items-center justify-center rounded shrink-0
                   text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800
                   transition-colors duration-100
                   focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-violet-500/50 focus-visible:ring-offset-1
                   focus-visible:ring-offset-zinc-950"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
