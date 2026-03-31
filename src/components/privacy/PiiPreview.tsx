import { useMemo } from "react";
import type { PiiMatch } from "@/lib/privacy/pii-detector";
import { maskPii, piiTypeLabel } from "@/lib/privacy/pii-detector";

interface PiiPreviewProps {
  originalText: string;
  matches: PiiMatch[];
  onSendMasked: (maskedText: string) => void;
  onSendOriginal: () => void;
  onCancel: () => void;
}

/** Modal dialog showing PII detected in the message before sending */
export default function PiiPreview({
  originalText,
  matches,
  onSendMasked,
  onSendOriginal,
  onCancel,
}: PiiPreviewProps) {
  const maskedText = useMemo(() => maskPii(originalText, matches), [originalText, matches]);

  // Group matches by type for summary
  const summary = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const m of matches) {
      const label = piiTypeLabel(m.type);
      groups[label] = (groups[label] ?? 0) + 1;
    }
    return Object.entries(groups);
  }, [matches]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[520px] max-h-[70vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Personal Information Detected
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {matches.length} PII item(s) found — review before sending
          </p>
        </div>

        {/* Summary */}
        <div className="px-4 py-2 border-b border-zinc-800/50 flex flex-wrap gap-1.5">
          {summary.map(([label, count]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-red-950/40 text-red-400 border border-red-800/30"
            >
              {label} x{count}
            </span>
          ))}
        </div>

        {/* Masked preview */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
              Masked version (will be sent to AI)
            </div>
            <div className="bg-zinc-950 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap border border-zinc-800">
              {highlightMasked(maskedText, matches, originalText)}
            </div>
          </div>

          {/* Detail list */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
              Detected items
            </div>
            <div className="space-y-1">
              {matches.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-zinc-950">
                  <span className="text-zinc-500">{piiTypeLabel(m.type)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-red-400 line-through font-mono">{m.value}</span>
                    <span className="text-zinc-400">→</span>
                    <span className="text-green-400 font-mono">{m.masked}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={onSendOriginal}
            className="px-3 py-1.5 text-xs text-red-400 border border-red-800/50 rounded-lg hover:bg-red-950/40"
          >
            Send Original
          </button>
          <button
            onClick={() => onSendMasked(maskedText)}
            className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
          >
            Send Masked
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple text rendering — masked portions shown in green */
function highlightMasked(maskedText: string, _matches: PiiMatch[], _original: string) {
  // For now, return plain text. A full implementation would
  // highlight the masked portions with <span> styling.
  return maskedText;
}
