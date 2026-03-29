import { create } from 'zustand';
import { invoke } from '@/lib/ipc/invoke';
import type { Persona } from '@/types';

/** IPC raw 응답 타입 (Rust snake_case) */
interface RawPersona {
  id: string;
  name: string;
  system_prompt: string;
  avatar_emoji: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** snake_case → camelCase 변환 (IPC 응답 정규화) */
function toPersona(raw: RawPersona): Persona {
  return {
    id: raw.id,
    name: raw.name,
    systemPrompt: raw.system_prompt,
    avatarEmoji: raw.avatar_emoji,
    isDefault: raw.is_default,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface PersonaState {
  personas: Persona[];
  activePersonaId: string;

  // Actions
  loadPersonas: () => Promise<void>;
  createPersona: (name: string, systemPrompt: string, avatarEmoji: string) => Promise<Persona>;
  updatePersona: (id: string, name: string, systemPrompt: string, avatarEmoji: string) => Promise<Persona>;
  deletePersona: (id: string) => Promise<void>;
  setActivePersona: (id: string) => void;
}

export const usePersonaStore = create<PersonaState>((set, get) => ({
  personas: [],
  activePersonaId: 'default',

  loadPersonas: async () => {
    const raw = await invoke<RawPersona[]>('list_personas');
    set({ personas: raw.map(toPersona) });
  },

  createPersona: async (name, systemPrompt, avatarEmoji) => {
    const raw = await invoke<RawPersona>('create_persona', {
      name,
      system_prompt: systemPrompt,
      avatar_emoji: avatarEmoji,
    });
    const persona = toPersona(raw);
    set((s) => ({ personas: [...s.personas, persona] }));
    return persona;
  },

  updatePersona: async (id, name, systemPrompt, avatarEmoji) => {
    const raw = await invoke<RawPersona>('update_persona', {
      id,
      name,
      system_prompt: systemPrompt,
      avatar_emoji: avatarEmoji,
    });
    const updated = toPersona(raw);
    set((s) => ({
      personas: s.personas.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  deletePersona: async (id) => {
    await invoke('delete_persona', { id });
    set((s) => ({
      personas: s.personas.filter((p) => p.id !== id),
      activePersonaId: s.activePersonaId === id ? 'default' : s.activePersonaId,
    }));
  },

  setActivePersona: (id) => {
    const { personas } = get();
    if (personas.some((p) => p.id === id)) {
      set({ activePersonaId: id });
    }
  },
}));
