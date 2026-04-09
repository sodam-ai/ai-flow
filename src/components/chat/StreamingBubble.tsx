import { useEffect, useRef, useState } from "react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  content: string;
  /** Provider + model label shown above streaming content (e.g. "gpt-4o") */
  modelLabel?: string;
}

/**
 * StreamingBubble — real-time AI response container.
 *
 * States:
 *   - Empty (no content yet): animated 3-dot typing indicator
 *   - Streaming: content + blinking cursor bar + elapsed timer
 *
 * Design: matches MessageBubble AI style — bg-zinc-800/60, violet left-border accent.
 * Accessibility: role="status" + aria-label on the typing indicator.
 */
export default function StreamingBubble({ content, modelLabel }: Props) {
  // Track elapsed time from mount (measures TTFT + generation time)
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const elapsedSec = (elapsed / 1000).toFixed(1);

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-zinc-800/60 text-zinc-100 border-l-2 border-violet-600/20">
        {/* Model badge */}
        {modelLabel && (
          <p
            className="text-[10px] text-violet-400/70 font-medium mb-1.5 select-none tracking-wide"
            aria-hidden="true"
          >
            {modelLabel}
          </p>
        )}

        {content ? (
          <>
            <MarkdownContent content={content} />
            <div className="flex items-center gap-1.5 mt-1">
              {/* Blinking cursor — violet accent, slim bar */}
              <span
                className="inline-block w-0.5 h-3.5 bg-violet-400/80 animate-pulse rounded-sm"
                aria-hidden="true"
              />
              {/* Elapsed time — helps compare TTFT across models */}
              <span
                className="text-[10px] text-zinc-600 font-mono tabular-nums"
                aria-live="off"
                aria-label={`생성 중 ${elapsedSec}초 경과`}
              >
                {elapsedSec}s
              </span>
            </div>
          </>
        ) : (
          /* Typing indicator — 3 dots with staggered bounce */
          <span
            className="flex items-center gap-1 h-5 py-0.5"
            role="status"
            aria-label="AI 응답 생성 중"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "0.65s",
                }}
                aria-hidden="true"
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
