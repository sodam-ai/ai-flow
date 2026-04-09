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
 *   - Streaming: content + blinking cursor bar
 *
 * Design: matches MessageBubble AI style — bg-zinc-800/60, violet left-border accent.
 * Accessibility: role="status" + aria-label on the typing indicator.
 */
export default function StreamingBubble({ content, modelLabel }: Props) {
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
            {/* Blinking cursor — violet accent, slim bar */}
            <span
              className="inline-block w-0.5 h-4 bg-violet-400/80 animate-pulse ml-0.5 align-text-bottom rounded-sm"
              aria-hidden="true"
            />
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
