import { useEffect, useRef, useState } from 'react';
import { usePromptStore } from '@/stores/promptStore';
import type { Prompt } from '@/types';

interface PromptLibraryProps {
  /** 프롬프트 선택 시 content를 입력창에 삽입 */
  onInsert: (content: string) => void;
  onClose: () => void;
}

export default function PromptLibrary({ onInsert, onClose }: PromptLibraryProps) {
  const { prompts, loadPrompts, usePrompt } = usePromptStore();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPrompts().catch(console.error);
    searchRef.current?.focus();
  }, [loadPrompts]);

  // `{{variable}}` 슬롯이 있는 프롬프트는 그대로 삽입 — 프론트엔드에서 치환
  const handleSelect = async (prompt: Prompt) => {
    await usePrompt(prompt.id);
    onInsert(prompt.content);
    onClose();
  };

  const filtered = query.trim()
    ? prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : prompts;

  // 카테고리별 그룹핑
  const categories = Array.from(new Set(filtered.map((p) => p.category ?? '기타')));

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
        <span className="text-sm font-semibold">프롬프트 라이브러리</span>
        <button
          onClick={onClose}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-sm"
        >
          ✕
        </button>
      </div>

      {/* 검색 */}
      <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="프롬프트 검색..."
          className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))] py-8">
            {query ? '검색 결과가 없습니다' : '저장된 프롬프트가 없습니다'}
          </p>
        ) : (
          categories.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              prompts={filtered.filter((p) => (p.category ?? '기타') === cat)}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── 카테고리 섹션 (rerender-no-inline-components) ──
interface CategorySectionProps {
  category: string;
  prompts: Prompt[];
  onSelect: (prompt: Prompt) => Promise<void>;
}

function CategorySection({ category, prompts, onSelect }: CategorySectionProps) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
        {category}
      </div>
      {prompts.map((prompt) => (
        <PromptItem key={prompt.id} prompt={prompt} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── 프롬프트 항목 (rerender-no-inline-components) ──
interface PromptItemProps {
  prompt: Prompt;
  onSelect: (prompt: Prompt) => Promise<void>;
}

function PromptItem({ prompt, onSelect }: PromptItemProps) {
  const hasSlots = /\{\{\w+\}\}/.test(prompt.content);

  return (
    <button
      onClick={() => onSelect(prompt)}
      className="w-full text-left px-3 py-2 hover:bg-[hsl(var(--accent))] transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{prompt.title}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
            {prompt.content.slice(0, 80)}{prompt.content.length > 80 ? '…' : ''}
          </div>
          {prompt.tags.length > 0 ? (
            <div className="flex gap-1 mt-1 flex-wrap">
              {prompt.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1 py-0.5 rounded text-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {hasSlots ? (
            <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-500">슬롯</span>
          ) : null}
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {prompt.useCount > 0 ? `${prompt.useCount}회` : ''}
          </span>
        </div>
      </div>
    </button>
  );
}
