import { useEffect, useState } from "react";
import { listKnowledgeBases } from "@/lib/ipc/invoke";
import type { KnowledgeBase } from "@/types";

interface Props {
  activeKbIds: number[];
  onToggle: (id: number) => void;
}

/**
 * KbContextBar — floating chip bar above ChatInput for Smart Context Injection.
 * Shows active KBs as togglable pills; clicking activates/deactivates them.
 * Hidden when no KBs exist.
 */
export default function KbContextBar({ activeKbIds, onToggle }: Props) {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);

  useEffect(() => {
    listKnowledgeBases()
      .then(setKbs)
      .catch(() => setKbs([]));
  }, []);

  if (kbs.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-4 py-1.5 border-t border-zinc-800/60 bg-zinc-950/60 min-h-0 flex-wrap"
      role="group"
      aria-label="지식베이스 컨텍스트 선택"
    >
      {/* Label */}
      <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mr-0.5 shrink-0">
        KB
      </span>

      {kbs.map((kb) => {
        const isActive = activeKbIds.includes(kb.id);
        return (
          <button
            key={kb.id}
            onClick={() => onToggle(kb.id)}
            aria-pressed={isActive}
            title={`${kb.name}${kb.doc_count ? ` · ${kb.doc_count}개 문서` : ""}`}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
              border transition-all duration-150 cursor-pointer
              ${isActive
                ? "bg-violet-900/50 border-violet-600/60 text-violet-300"
                : "bg-zinc-900 border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }
            `}
          >
            {/* DB icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className={`w-2.5 h-2.5 ${isActive ? "text-violet-400" : "text-zinc-600"}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
              />
            </svg>
            <span className="truncate max-w-[80px]">{kb.name}</span>
            {isActive && (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-2.5 h-2.5 text-violet-400 shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        );
      })}

      {activeKbIds.length > 0 && (
        <span className="ml-auto text-[10px] text-violet-500 shrink-0">
          {activeKbIds.length}개 활성
        </span>
      )}
    </div>
  );
}
