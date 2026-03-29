import { type FormEvent, useRef, useEffect, useState } from 'react';
import PersonaSelector from '@/components/persona/PersonaSelector';
import PromptLibrary from '@/components/prompt/PromptLibrary';

interface ChatInputProps {
  isStreaming: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

export default function ChatInput({ isStreaming, onSubmit, onCancel }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);

  // 스트리밍 종료 시 입력창 포커스 복원
  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus();
  }, [isStreaming]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    onSubmit(content);
  };

  // 프롬프트 라이브러리에서 선택 시 입력창에 삽입
  const handlePromptInsert = (content: string) => {
    if (inputRef.current) {
      inputRef.current.value = content;
      inputRef.current.focus();
      // 커서를 맨 끝으로
      inputRef.current.setSelectionRange(content.length, content.length);
    }
  };

  return (
    <div className="border-t border-[hsl(var(--border))]">
      {/* 프롬프트 라이브러리 패널 */}
      {showPromptLibrary ? (
        <div className="h-64 border-b border-[hsl(var(--border))]">
          <PromptLibrary
            onInsert={handlePromptInsert}
            onClose={() => setShowPromptLibrary(false)}
          />
        </div>
      ) : null}

      {/* 입력 영역 */}
      <div className="p-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {/* 툴바 */}
          <div className="flex items-center justify-between">
            <PersonaSelector />
            <button
              type="button"
              onClick={() => setShowPromptLibrary((v) => !v)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showPromptLibrary
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
              }`}
              title="프롬프트 라이브러리"
            >
              📚 프롬프트
            </button>
          </div>

          {/* 입력창 + 전송 버튼 */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="message"
              type="text"
              placeholder="메시지를 입력하세요... (Enter 전송)"
              disabled={isStreaming}
              className="flex-1 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] disabled:opacity-50"
              autoFocus
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] text-sm font-medium hover:opacity-90 flex-shrink-0"
              >
                ■ 중지
              </button>
            ) : (
              <button
                type="submit"
                className="px-3 py-2 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 flex-shrink-0"
              >
                전송
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
