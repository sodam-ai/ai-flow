/**
 * AI 스트리밍 응답 버블 — 타이핑 커서 + 로딩 점 3개
 */
interface StreamingBubbleProps {
  content: string;
}

export default function StreamingBubble({ content }: StreamingBubbleProps) {
  const hasContent = Boolean(content);

  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] px-4 py-2 rounded-lg text-sm bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border border-[hsl(var(--border))]">
        {hasContent ? (
          <span className="whitespace-pre-wrap">
            {content}
            <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse align-text-bottom" />
          </span>
        ) : (
          <span className="flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
