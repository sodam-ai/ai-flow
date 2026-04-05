import { useEffect, useState, useCallback } from "react";
import { listKnowledgeBases } from "@/lib/ipc/invoke";
import type { KnowledgeBase } from "@/types";
import { Database, BrainCircuit, X } from "lucide-react";

interface Props {
  activeKbIds: number[];
  onToggle: (id: number) => void;
  /** Clears all active KB IDs atomically — avoids stale-closure issues with forEach(toggle) */
  onClearAll?: () => void;
}

/**
 * KbContextBar — chip bar above ChatInput for Smart Context Injection.
 *
 * Shows all available KBs as toggleable pills.
 * Active KBs are injected as context into every AI message.
 * Hidden when no KBs exist.
 */
export default function KbContextBar({ activeKbIds, onToggle, onClearAll }: Props) {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);

  const load = useCallback(() => {
    listKnowledgeBases().then(setKbs).catch(() => setKbs([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (kbs.length === 0) return null;

  const activeCount = activeKbIds.length;

  return (
    <div
      role="group"
      aria-label="지식베이스 컨텍스트"
      className={`flex items-center gap-1.5 px-4 py-1.5 flex-wrap border-t transition-colors duration-200 ${
        activeCount > 0
          ? "border-violet-800/30 bg-violet-950/15"
          : "border-zinc-800/50 bg-transparent"
      }`}
    >
      {/* Icon + label */}
      <div className="flex items-center gap-1 shrink-0 mr-0.5" aria-hidden="true">
        <BrainCircuit
          className={`w-3 h-3 transition-colors duration-200 ${
            activeCount > 0 ? "text-violet-400" : "text-zinc-600"
          }`}
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200 ${
            activeCount > 0 ? "text-violet-500" : "text-zinc-600"
          }`}
        >
          Context
        </span>
      </div>

      {/* KB chips */}
      {kbs.map((kb) => {
        const isActive = activeKbIds.includes(kb.id);
        return (
          <button
            key={kb.id}
            onClick={() => onToggle(kb.id)}
            aria-pressed={isActive}
            title={
              kb.description
                ? `${kb.name} — ${kb.description}${kb.doc_count ? ` (${kb.doc_count}개 문서)` : ""}`
                : `${kb.name}${kb.doc_count ? ` · ${kb.doc_count}개 문서` : ""}`
            }
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium
              border transition-all duration-150 cursor-pointer select-none focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-1
              focus-visible:ring-offset-zinc-950
              ${
                isActive
                  ? "bg-violet-950/70 border-violet-600/50 text-violet-200"
                  : "bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50"
              }
            `}
          >
            <Database
              className={`w-2.5 h-2.5 shrink-0 transition-colors ${
                isActive ? "text-violet-400" : "text-zinc-600"
              }`}
            />
            <span className="truncate max-w-[80px]">{kb.name}</span>

            {/* Doc count badge */}
            {kb.doc_count > 0 && (
              <span
                className={`text-[9px] leading-none tabular-nums shrink-0 ${
                  isActive ? "text-violet-500" : "text-zinc-700"
                }`}
                aria-label={`${kb.doc_count}개 문서`}
              >
                {kb.doc_count}
              </span>
            )}

            {/* Active indicator dot */}
            {isActive && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}

      {/* Clear all — only visible when at least one KB is active */}
      {activeCount > 0 && onClearAll && (
        <button
          onClick={onClearAll}
          className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer shrink-0 py-0.5 px-1 rounded hover:bg-zinc-800/60"
          title="모든 KB 컨텍스트 비활성화"
          aria-label="모든 KB 해제"
        >
          <X className="w-2.5 h-2.5" />
          <span>해제</span>
        </button>
      )}
    </div>
  );
}
