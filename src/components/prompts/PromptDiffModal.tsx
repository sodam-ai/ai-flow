import { useEffect, useRef } from "react";
import { X, GitCompare, RotateCcw } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import type { PromptVersionEntry } from "@/lib/ipc/invoke";

/**
 * PromptDiffModal — side-by-side / unified diff view between a saved version
 * and the current editor content.
 *
 * Security:
 *   - All text rendered as React text nodes — no innerHTML, no XSS surface
 *   - No IPC calls — diff is computed client-side from data already in memory
 *   - Static diff algorithm: pure TS LCS, no eval, no dynamic code
 *
 * Accessibility (WCAG 2.1 AA):
 *   - role="dialog", aria-modal, aria-labelledby
 *   - Focus moves to close button on open
 *   - Escape closes modal (stopPropagation — independent of outer modals)
 *   - Backdrop mousedown dismissal
 *   - aria-label on colored line indicators
 */

interface Props {
  version: PromptVersionEntry;
  currentContent: string;
  onClose: () => void;
  onRestore: (version: PromptVersionEntry) => void;
  restoring: boolean;
}

// ── Diff algorithm (LCS line-level, pure TS) ────────────────────────────────

type DiffLine =
  | { type: "equal"; text: string }
  | { type: "added"; text: string }
  | { type: "removed"; text: string };

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "equal", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", text: b[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", text: a[i - 1] });
      i--;
    }
  }
  return result;
}

// ── Stats helper ─────────────────────────────────────────────────────────────

function diffStats(lines: DiffLine[]) {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "added") added++;
    else if (l.type === "removed") removed++;
  }
  return { added, removed };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PromptDiffModal({
  version,
  currentContent,
  onClose,
  onRestore,
  restoring,
}: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);
  useFocusReturn();

  // Focus management
  useEffect(() => {
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);

  // Escape + backdrop
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const handleBackdrop = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleBackdrop);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleBackdrop);
    };
  }, [onClose]);

  const diffLines = computeLineDiff(version.content, currentContent);
  const { added, removed } = diffStats(diffLines);

  const formattedDate = new Date(version.createdAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
      className="fixed inset-0 z-[110] flex items-center justify-center px-4
                 bg-black/70 backdrop-blur-sm"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden
                   rounded-2xl border border-zinc-800 bg-zinc-950/97 backdrop-blur-xl
                   shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]
                   flex flex-col"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-900/40 border border-indigo-700/30
                            flex items-center justify-center">
              <GitCompare className="w-3.5 h-3.5 text-indigo-300" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="diff-modal-title"
                className="text-sm font-semibold text-zinc-100 leading-tight"
              >
                버전 비교
              </h2>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                v{version.versionNumber} ({formattedDate}) → 현재 편집 내용
              </p>
            </div>
          </div>

          {/* Diff stats */}
          <div className="flex items-center gap-2 mr-3">
            {removed > 0 && (
              <span className="text-[10px] font-mono text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded">
                -{removed}
              </span>
            )}
            {added > 0 && (
              <span className="text-[10px] font-mono text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded">
                +{added}
              </span>
            )}
            {added === 0 && removed === 0 && (
              <span className="text-[10px] text-zinc-600">변경 없음</span>
            )}
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="버전 비교 닫기 (Esc)"
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                       transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-indigo-500/50"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-5 py-2 bg-zinc-900/40 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-900/60 border border-red-700/40" aria-hidden="true" />
            <span className="text-[10px] text-zinc-500">v{version.versionNumber}에만 있음 (제거됨)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-900/60 border border-green-700/40" aria-hidden="true" />
            <span className="text-[10px] text-zinc-500">현재에만 있음 (추가됨)</span>
          </div>
        </div>

        {/* ── Diff content ─────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">
          {diffLines.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-zinc-600">
              내용이 비어 있습니다
            </div>
          ) : (
            <div className="font-mono text-[11px] leading-[1.65]">
              {diffLines.map((line, idx) => (
                <DiffLineRow key={idx} line={line} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-800/80 shrink-0">
          <p className="text-[10px] text-zinc-600">
            복원하면 현재 편집 내용이 v{version.versionNumber}으로 교체됩니다
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="비교 닫기"
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200
                         transition-colors focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-zinc-600/50 rounded-md"
            >
              닫기
            </button>
            <button
              onClick={() => onRestore(version)}
              disabled={restoring}
              aria-label={restoring ? "복원 중…" : `v${version.versionNumber}으로 복원`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-indigo-600 hover:bg-indigo-500 text-white rounded-md
                         disabled:opacity-40 transition-colors
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-indigo-500/50"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              {restoring ? "복원 중…" : `v${version.versionNumber} 복원`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DiffLineRow ───────────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.type === "equal") {
    return (
      <div className="flex items-start px-4 py-px hover:bg-zinc-900/30">
        <span className="w-4 shrink-0 text-zinc-700 select-none mr-3" aria-hidden="true"> </span>
        {/* Empty text rendered as React node — safe */}
        <span className="text-zinc-400 whitespace-pre-wrap break-all">
          {line.text || " "}
        </span>
      </div>
    );
  }

  if (line.type === "removed") {
    return (
      <div
        className="flex items-start px-4 py-px bg-red-950/30 border-l-2 border-red-700/50"
        aria-label={`제거된 줄: ${line.text}`}
      >
        <span className="w-4 shrink-0 text-red-500 select-none mr-3 font-bold" aria-hidden="true">−</span>
        <span className="text-red-300 whitespace-pre-wrap break-all">
          {line.text || " "}
        </span>
      </div>
    );
  }

  // added
  return (
    <div
      className="flex items-start px-4 py-px bg-green-950/30 border-l-2 border-green-700/50"
      aria-label={`추가된 줄: ${line.text}`}
    >
      <span className="w-4 shrink-0 text-green-500 select-none mr-3 font-bold" aria-hidden="true">+</span>
      <span className="text-green-300 whitespace-pre-wrap break-all">
        {line.text || " "}
      </span>
    </div>
  );
}
