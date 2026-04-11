import { create } from "zustand";
import type { PromptTemplate, CreatePromptInput, UpdatePromptInput } from "@/types";
import {
  listPrompts,
  createPrompt as createPromptIpc,
  updatePrompt as updatePromptIpc,
  deletePrompt as deletePromptIpc,
  usePrompt as usePromptIpc,
} from "@/lib/ipc/invoke";
import { useToastStore } from "./toastStore";
import { toUserMessage } from "@/lib/errors";

interface PromptState {
  prompts: PromptTemplate[];
  isLoading: boolean;
  isModalOpen: boolean;
  editingPrompt: PromptTemplate | null;

  fetchPrompts: (tag?: string) => Promise<void>;
  createPrompt: (input: CreatePromptInput) => Promise<PromptTemplate | null>;
  updatePrompt: (id: string, input: UpdatePromptInput) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  usePrompt: (id: string, variables: Record<string, string>) => Promise<string | null>;
  setModalOpen: (open: boolean) => void;
  setEditingPrompt: (prompt: PromptTemplate | null) => void;
  getAllTags: () => string[];
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  isLoading: false,
  isModalOpen: false,
  editingPrompt: null,

  fetchPrompts: async (tag) => {
    set({ isLoading: true });
    try {
      const prompts = await listPrompts(tag);
      set({ prompts, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },

  createPrompt: async (input) => {
    try {
      const prompt = await createPromptIpc(input);
      set((s) => ({ prompts: [prompt, ...s.prompts] }));
      useToastStore.getState().addToast("success", `Prompt "${prompt.title}" created`);
      return prompt;
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
      return null;
    }
  },

  updatePrompt: async (id, input) => {
    try {
      const updated = await updatePromptIpc(id, input);
      set((s) => ({
        prompts: s.prompts.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },

  deletePrompt: async (id) => {
    try {
      await deletePromptIpc(id);
      set((s) => ({
        prompts: s.prompts.filter((p) => p.id !== id),
      }));
      useToastStore.getState().addToast("success", "Prompt deleted");
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },

  usePrompt: async (id, variables) => {
    try {
      const result = await usePromptIpc(id, variables);
      // Update use_count locally
      set((s) => ({
        prompts: s.prompts.map((p) =>
          p.id === id ? { ...p, use_count: p.use_count + 1 } : p,
        ),
      }));
      return result;
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
      return null;
    }
  },

  setModalOpen: (open) => set({ isModalOpen: open }),
  setEditingPrompt: (prompt) => set({ editingPrompt: prompt }),

  getAllTags: () => {
    const { prompts } = get();
    const tagSet = new Set<string>();
    for (const p of prompts) {
      for (const t of p.tags) {
        tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort();
  },
}));
