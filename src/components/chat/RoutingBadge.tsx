import { useState, useEffect } from "react";
import type { RoutingSuggestion } from "@/types";
import { getRoutingSuggestion } from "@/lib/ipc/invoke";

interface RoutingBadgeProps {
  prompt: string;
  hasFile: boolean;
  onRoutingReady?: (suggestion: RoutingSuggestion) => void;
}

/** Shows the smart routing suggestion for the current prompt */
export default function RoutingBadge({ prompt, hasFile, onRoutingReady }: RoutingBadgeProps) {
  const [suggestion, setSuggestion] = useState<RoutingSuggestion | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (prompt.length < 5) {
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const hasCode = /```|function\s|def\s|class\s|import\s/.test(prompt);
        const result = await getRoutingSuggestion(prompt, hasFile, hasCode);
        setSuggestion(result);
        onRoutingReady?.(result);
      } catch {
        // Silently fail — routing is optional
      }
    }, 300); // debounce

    return () => clearTimeout(timer);
  }, [prompt, hasFile, onRoutingReady]);

  if (!suggestion) return null;

  const colorMap: Record<string, string> = {
    simple: "text-green-400 bg-green-950/40 border-green-800/50",
    medium: "text-yellow-400 bg-yellow-950/40 border-yellow-800/50",
    complex: "text-red-400 bg-red-950/40 border-red-800/50",
  };

  const colors = colorMap[suggestion.complexityLabel] ?? colorMap.medium;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded border ${colors} transition-colors`}
        title="Smart Routing: why this AI was selected"
      >
        <span className="font-medium">{suggestion.complexityLabel}</span>
        <span className="text-zinc-400">→</span>
        <span>{suggestion.suggestedModelName}</span>
        {suggestion.potentialSavingsUsd > 0.0001 && (
          <span className="text-green-400">
            (save ${suggestion.potentialSavingsUsd.toFixed(4)})
          </span>
        )}
      </button>

      {showDetails && (
        <div className="absolute bottom-full left-0 mb-1 w-64 p-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Complexity Score</span>
              <span className="font-mono">{suggestion.complexityScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Selected AI</span>
              <span>{suggestion.suggestedProviderId}:{suggestion.suggestedModelId.slice(-12)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Est. Cost</span>
              <span>${suggestion.estimatedCostUsd.toFixed(5)}</span>
            </div>
            {suggestion.fallbackChain.length > 0 && (
              <div>
                <span className="text-zinc-400">Fallback chain:</span>
                <div className="mt-1 space-y-0.5">
                  {suggestion.fallbackChain.map((fb, i) => (
                    <div key={i} className="text-zinc-500 pl-2">
                      {i + 1}. {fb.providerId}:{fb.modelId.slice(-12)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
