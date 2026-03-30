import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";
import type { ProviderId, ApiKeyStatus } from "@/types";
import { getApiKeyStatus, saveApiKey, deleteApiKey } from "@/lib/ipc/invoke";

const STORE_DEFAULTS = {
  activeProviderId: "openai",
  activeModelId: "gpt-4o",
};

const STORE_NAME = "settings.json";

interface SettingsState {
  // Active provider/model
  activeProviderId: ProviderId;
  activeModelId: string;
  setActiveProvider: (id: ProviderId, modelId: string) => void;

  // Persistent store initialization
  loadPersistedSettings: () => Promise<void>;

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

  setActiveProvider: async (id, modelId) => {
    set({ activeProviderId: id, activeModelId: modelId });
    // Persist to disk
    try {
      const store = await Store.load(STORE_NAME, { defaults: STORE_DEFAULTS, autoSave: true });
      await store.set("activeProviderId", id);
      await store.set("activeModelId", modelId);
    } catch (e) {
      console.warn("Failed to persist settings:", e);
    }
  },

  loadPersistedSettings: async () => {
    try {
      const store = await Store.load(STORE_NAME, { defaults: STORE_DEFAULTS, autoSave: true });
      const providerId = (await store.get<string>("activeProviderId")) ?? "openai";
      const modelId = (await store.get<string>("activeModelId")) ?? "gpt-4o";
      set({
        activeProviderId: providerId as ProviderId,
        activeModelId: modelId,
      });
    } catch (e) {
      console.warn("Failed to load persisted settings:", e);
    }
  },

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
