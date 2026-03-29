import { create } from 'zustand';
import { invoke } from '@/lib/ipc/invoke';
import type { Prompt } from '@/types';

/** IPC raw 응답 타입 (Rust snake_case) */
interface RawPrompt {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags: string[];
  use_count: number;
  created_at: string;
  updated_at: string;
}

/** snake_case → camelCase 변환 (IPC 응답 정규화) */
function toPrompt(raw: RawPrompt): Prompt {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    category: raw.category ?? undefined,
    tags: raw.tags,
    useCount: raw.use_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface PromptState {
  prompts: Prompt[];
  activeCategory: string | undefined;

  // Actions
  loadPrompts: (category?: string) => Promise<void>;
  createPrompt: (title: string, content: string, category?: string, tags?: string[]) => Promise<Prompt>;
  updatePrompt: (id: string, title: string, content: string, category?: string, tags?: string[]) => Promise<Prompt>;
  deletePrompt: (id: string) => Promise<void>;
  usePrompt: (id: string) => Promise<void>;
  setActiveCategory: (category: string | undefined) => void;

  /** {{variable}} 슬롯을 실제 값으로 치환 */
  resolveSlots: (content: string, slots: Record<string, string>) => string;
}

export const usePromptStore = create<PromptState>((set) => ({
  prompts: [],
  activeCategory: undefined,

  loadPrompts: async (category) => {
    const raw = await invoke<RawPrompt[]>('list_prompts', {
      category: category ?? null,
    });
    set({ prompts: raw.map(toPrompt), activeCategory: category });
  },

  createPrompt: async (title, content, category, tags = []) => {
    const raw = await invoke<RawPrompt>('create_prompt', {
      title,
      content,
      category: category ?? null,
      tags,
    });
    const prompt = toPrompt(raw);
    set((s) => ({ prompts: [...s.prompts, prompt] }));
    return prompt;
  },

  updatePrompt: async (id, title, content, category, tags = []) => {
    const raw = await invoke<RawPrompt>('update_prompt', {
      id,
      title,
      content,
      category: category ?? null,
      tags,
    });
    const updated = toPrompt(raw);
    set((s) => ({
      prompts: s.prompts.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  deletePrompt: async (id) => {
    await invoke('delete_prompt', { id });
    set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
  },

  usePrompt: async (id) => {
    await invoke('use_prompt', { id });
    // 로컬 카운터도 즉시 반영 (낙관적 업데이트)
    set((s) => ({
      prompts: s.prompts.map((p) =>
        p.id === id ? { ...p, useCount: p.useCount + 1 } : p
      ),
    }));
  },

  setActiveCategory: (category) => set({ activeCategory: category }),

  resolveSlots: (content, slots) => {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => slots[key] ?? `{{${key}}}`);
  },
}));
