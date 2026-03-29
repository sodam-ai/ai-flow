import { create } from 'zustand';
import { invoke } from '@/lib/ipc/invoke';
import type { ApiKeyStatus, ProviderId } from '@/types';

interface SettingsState {
  apiKeyStatuses: Record<ProviderId, ApiKeyStatus | null>;
  activeProviderId: ProviderId;
  activeModelId: string;

  // Actions
  loadApiKeyStatuses: () => Promise<void>;
  setApiKey: (providerId: ProviderId, apiKey: string) => Promise<void>;
  deleteApiKey: (providerId: ProviderId) => Promise<void>;
  setActiveProvider: (providerId: ProviderId, modelId: string) => void;
}

const PROVIDERS: ProviderId[] = [
  'openai', 'anthropic', 'google', 'ollama',
  'mistral', 'groq', 'deepseek', 'cohere', 'xai',
  'azure_openai', 'openai_compatible',
];

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKeyStatuses: {
    openai: null,
    anthropic: null,
    google: null,
    ollama: null,
    mistral: null,
    groq: null,
    deepseek: null,
    cohere: null,
    xai: null,
    azure_openai: null,
    openai_compatible: null,
  },
  activeProviderId: 'openai',
  activeModelId: 'gpt-4o',

  loadApiKeyStatuses: async () => {
    const statuses = await Promise.all(
      PROVIDERS.map((id) =>
        invoke<ApiKeyStatus>('get_api_key_status', { provider_id: id })
      )
    );
    const statusMap = Object.fromEntries(
      PROVIDERS.map((id, i) => [id, statuses[i]])
    ) as Record<ProviderId, ApiKeyStatus>;
    set({ apiKeyStatuses: statusMap });
  },

  setApiKey: async (providerId, apiKey) => {
    const status = await invoke<ApiKeyStatus>('set_api_key', {
      provider_id: providerId,
      api_key: apiKey,
    });
    set((s) => ({
      apiKeyStatuses: { ...s.apiKeyStatuses, [providerId]: status },
    }));
  },

  deleteApiKey: async (providerId) => {
    await invoke('delete_api_key', { provider_id: providerId });
    set((s) => ({
      apiKeyStatuses: {
        ...s.apiKeyStatuses,
        [providerId]: { providerId: providerId as string, isSet: false },
      },
    }));
  },

  setActiveProvider: (providerId, modelId) => {
    set({ activeProviderId: providerId, activeModelId: modelId });
  },
}));
