import { create } from "zustand";
import type { Persona, CreatePersonaInput, UpdatePersonaInput } from "@/types";
import {
  listPersonas,
  createPersona as createPersonaIpc,
  updatePersona as updatePersonaIpc,
  deletePersona as deletePersonaIpc,
} from "@/lib/ipc/invoke";
import { useToastStore } from "./toastStore";
import { toUserMessage } from "@/lib/errors";

interface PersonaState {
  personas: Persona[];
  activePersonaId: string | null;
  isLoading: boolean;

  fetchPersonas: () => Promise<void>;
  setActivePersona: (id: string | null) => void;
  getActivePersona: () => Persona | null;
  createPersona: (input: CreatePersonaInput) => Promise<Persona | null>;
  updatePersona: (id: string, input: UpdatePersonaInput) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
}

export const usePersonaStore = create<PersonaState>((set, get) => ({
  personas: [],
  activePersonaId: null,
  isLoading: false,

  fetchPersonas: async () => {
    set({ isLoading: true });
    try {
      const personas = await listPersonas();
      set({ personas, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },

  setActivePersona: (id) => {
    set({ activePersonaId: id });
  },

  getActivePersona: () => {
    const { personas, activePersonaId } = get();
    if (!activePersonaId) return null;
    return personas.find((p) => p.id === activePersonaId) ?? null;
  },

  createPersona: async (input) => {
    try {
      const persona = await createPersonaIpc(input);
      set((s) => ({ personas: [...s.personas, persona] }));
      useToastStore.getState().addToast("success", `Persona "${persona.name}" created`);
      return persona;
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
      return null;
    }
  },

  updatePersona: async (id, input) => {
    try {
      const updated = await updatePersonaIpc(id, input);
      set((s) => ({
        personas: s.personas.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },

  deletePersona: async (id) => {
    try {
      await deletePersonaIpc(id);
      set((s) => ({
        personas: s.personas.filter((p) => p.id !== id),
        activePersonaId: s.activePersonaId === id ? null : s.activePersonaId,
      }));
      useToastStore.getState().addToast("success", "Persona deleted");
    } catch (err) {
      useToastStore.getState().addToast("error", toUserMessage(err));
    }
  },
}));
