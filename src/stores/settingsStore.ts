import { create } from "zustand";
import type { ProviderId, ApiKeyStatus } from "@/types";
import { getApiKeyStatus, saveApiKey, deleteApiKey } from "@/lib/ipc/invoke";

interface SettingsState {
  // Active provider/model
  activeProviderId: ProviderId;
  activeModelId: string;
  setActiveProvider: (id: ProviderId, modelId: string) => void;

  // API key statuses (per provider)
  keyStatuses: Partial<Record<ProviderId, ApiKeyStatus>>;
  loadKeyStatus: (provider: ProviderId) => Promise<void>;
  loadAllKeyStatuses: () => Promise<void>;
  saveKey: (provider: ProviderId, key: string) => Promise<void>;
  removeKey: (provider: ProviderId) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeProviderId: "openai",
  activeModelId: "gpt-4o",
  keyStatuses: {},

  setActiveProvider: (id, modelId) =>
    set({ activeProviderId: id, activeModelId: modelId }),

  loadKeyStatus: async (provider) => {
    const status = await getApiKeyStatus(provider);
    set((s) => ({
      keyStatuses: { ...s.keyStatuses, [provider]: status },
    }));
  },

  loadAllKeyStatuses: async () => {
    const providers: ProviderId[] = [
      "openai",
      "anthropic",
      "google",
      "ollama",
      "mistral",
      "groq",
      "deepseek",
      "cohere",
      "xai",
      "azure_openai",
      "openai_compatible",
    ];
    const statuses: Partial<Record<ProviderId, ApiKeyStatus>> = {};
    for (const p of providers) {
      try {
        statuses[p] = await getApiKeyStatus(p);
      } catch {
        statuses[p] = { isSet: false, maskedPreview: null };
      }
    }
    set({ keyStatuses: statuses });
  },

  saveKey: async (provider, key) => {
    await saveApiKey(provider, key);
    await get().loadKeyStatus(provider);
  },

  removeKey: async (provider) => {
    await deleteApiKey(provider);
    await get().loadKeyStatus(provider);
  },
}));
