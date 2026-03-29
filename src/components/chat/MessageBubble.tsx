import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : 'bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border border-[hsl(var(--border))]'
        }`}
      >
        {message.isRedacted ? (
          <span className="italic text-[hsl(var(--muted-foreground))]">
            [개인정보 보호 모드: 내용 삭제됨]
          </span>
        ) : (
          message.content
        )}
        {message.tokensUsed !== undefined && message.costUsd !== undefined ? (
          <CostBadge tokens={message.tokensUsed} costUsd={message.costUsd} />
        ) : null}
      </div>
    </div>
  );
}

// ── 비용 배지 (rerender-no-inline-components) ──
// USD + KRW(고정 환율 1,350) 표시 — Phase 1 기본 환율 (04_PROJECT_SPEC.md §비용)
function CostBadge({ tokens, costUsd }: { tokens: number; costUsd: number }) {
  const krw = costUsd * 1350;
  const costText =
    costUsd < 0.00001
      ? `₩${(krw * 1000).toFixed(3)}m` // 극소 비용: 밀리원 단위
      : krw < 1
      ? `₩${krw.toFixed(4)}`
      : `₩${krw.toFixed(2)}`;

  return (
    <div className="mt-1 text-[10px] opacity-50 flex gap-2">
      <span>{tokens.toLocaleString()}토큰</span>
      <span>·</span>
      <span title={`$${costUsd.toFixed(7)}`}>{costText}</span>
    </div>
  );
}
