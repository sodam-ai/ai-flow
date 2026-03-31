import { create } from "zustand";
import type { Conversation, Message, StreamChunk } from "@/types";
import {
  createConversation,
  getConversations,
  getMessages,
  renameConversation,
  togglePin,
  deleteConversation,
  streamAiMessage,
  regenerateAiMessage,
  cancelStream,
  streamRoutedMessage,
} from "@/lib/ipc/invoke";
import { useSettingsStore } from "./settingsStore";
import { usePersonaStore } from "./personaStore";
import { useToastStore } from "./toastStore";

interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  loadConversations: () => Promise<void>;
  createChat: (providerId: string, modelId: string) => Promise<string>;
  setActive: (id: string) => void;
  rename: (id: string, title: string) => Promise<void>;
  pin: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;

  // Messages
  messages: Record<string, Message[]>;
  loadMessages: (conversationId: string) => Promise<void>;

  // Streaming
  isStreaming: boolean;
  streamingContent: string;
  currentStreamId: string | null;
  sendMessage: (content: string, options?: SendOptions) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  cancelCurrentStream: () => Promise<void>;

  // Routing info (Phase 2)
  lastRoutingInfo: RoutingInfo | null;
}

interface SendOptions {
  hasFile?: boolean;
  hasCode?: boolean;
}

interface RoutingInfo {
  complexityScore: number;
  complexityLabel: string;
  selectedProvider: string;
  selectedModel: string;
  potentialSavings: number;
  fallbackUsed?: boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isStreaming: false,
  streamingContent: "",
  currentStreamId: null,
  lastRoutingInfo: null,

  loadConversations: async () => {
    const convs = await getConversations();
    set({ conversations: convs });
  },

  createChat: async (providerId, modelId) => {
    const conv = await createConversation(providerId, modelId);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: conv.id,
    }));
    return conv.id;
  },

  setActive: (id) => {
    set({ activeConversationId: id });
    get().loadMessages(id);
  },

  rename: async (id, title) => {
    await renameConversation(id, title);
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c,
      ),
    }));
  },

  pin: async (id) => {
    await togglePin(id);
    set((s) => ({
      conversations: s.conversations
        .map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    }));
  },

  remove: async (id) => {
    await deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId:
        s.activeConversationId === id ? null : s.activeConversationId,
    }));
  },

  loadMessages: async (conversationId) => {
    const msgs = await getMessages(conversationId);
    set((s) => ({
      messages: { ...s.messages, [conversationId]: msgs },
    }));
  },

  sendMessage: async (content, options) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    const streamId = crypto.randomUUID();
    let accumulated = "";

    // Optimistic UI: show user message immediately (before DB save)
    const optimisticMsg: Message = {
      id: `optimistic-${streamId}`,
      conversationId: activeConversationId,
      role: "user",
      content,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      createdAt: new Date().toISOString(),
      versionCount: 1,
      activeVersion: 1,
    };
    set((s) => ({
      isStreaming: true,
      streamingContent: "",
      currentStreamId: streamId,
      lastRoutingInfo: null,
      messages: {
        ...s.messages,
        [activeConversationId]: [
          ...(s.messages[activeConversationId] ?? []),
          optimisticMsg,
        ],
      },
    }));

    const targetConvId = activeConversationId;
    const { activeProviderId, activeModelId, routingMode } = useSettingsStore.getState();
    const activePersonaId = usePersonaStore.getState().activePersonaId;

    const handleChunk = (chunk: StreamChunk) => {
      if (chunk.type === "token" && chunk.token) {
        accumulated += chunk.token;
        set({ streamingContent: accumulated });
      } else if (chunk.type === "routing_info") {
        // Store routing decision for UI display
        set({
          lastRoutingInfo: {
            complexityScore: chunk.complexityScore ?? 0,
            complexityLabel: chunk.complexityLabel ?? "unknown",
            selectedProvider: chunk.selectedProvider ?? "",
            selectedModel: chunk.selectedModel ?? "",
            potentialSavings: chunk.potentialSavings ?? 0,
          },
        });
      } else if (chunk.type === "fallback_triggered") {
        useToastStore.getState().addToast(
          "info",
          `${chunk.failedProvider} failed, trying fallback...`,
        );
      } else if (chunk.type === "done") {
        // Capture routing savings if present
        const routingInfo = get().lastRoutingInfo;
        if (chunk.costSavedUsd && routingInfo) {
          set({
            lastRoutingInfo: { ...routingInfo, potentialSavings: chunk.costSavedUsd },
          });
        }
        set({ isStreaming: false, streamingContent: "", currentStreamId: null });
        get().loadMessages(targetConvId);
        get().loadConversations();
      } else if (chunk.type === "error") {
        set({ isStreaming: false, streamingContent: "", currentStreamId: null });
        useToastStore.getState().addToast("error", chunk.error ?? "AI streaming failed");
      }
    };

    try {
      if (routingMode) {
        // Smart routing: auto-select best AI based on complexity
        const hasFile = options?.hasFile ?? false;
        const hasCode = options?.hasCode ?? /```|function\s|def\s|class\s|import\s/.test(content);
        const { promise } = streamRoutedMessage(
          targetConvId, content, streamId,
          hasFile, hasCode, activePersonaId,
          handleChunk,
        );
        await promise;
      } else {
        // Manual mode: use selected provider/model
        const { promise } = streamAiMessage(
          targetConvId, content,
          activeProviderId, activeModelId, streamId,
          activePersonaId,
          handleChunk,
        );
        await promise;
      }
    } catch (err) {
      set({ isStreaming: false, streamingContent: "", currentStreamId: null });
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast("error", message);
    }
  },

  regenerateMessage: async (messageId) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    const streamId = crypto.randomUUID();
    let accumulated = "";

    set({ isStreaming: true, streamingContent: "", currentStreamId: streamId });

    const targetConvId = activeConversationId;
    const { activeProviderId, activeModelId } = useSettingsStore.getState();
    const activePersonaId = usePersonaStore.getState().activePersonaId;

    const { promise } = regenerateAiMessage(
      messageId,
      targetConvId,
      activeProviderId,
      activeModelId,
      streamId,
      activePersonaId,
      (chunk: StreamChunk) => {
        if (chunk.type === "token" && chunk.token) {
          accumulated += chunk.token;
          set({ streamingContent: accumulated });
        } else if (chunk.type === "done") {
          set({ isStreaming: false, streamingContent: "", currentStreamId: null });
          get().loadMessages(targetConvId);
        } else if (chunk.type === "error") {
          set({ isStreaming: false, streamingContent: "", currentStreamId: null });
          useToastStore.getState().addToast("error", chunk.error ?? "Regeneration failed");
        }
      },
    );

    try {
      await promise;
    } catch (err) {
      set({ isStreaming: false, streamingContent: "", currentStreamId: null });
      const message = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast("error", message);
    }
  },

  cancelCurrentStream: async () => {
    const { currentStreamId } = get();
    if (currentStreamId) {
      await cancelStream(currentStreamId);
      set({ isStreaming: false, streamingContent: "", currentStreamId: null });
    }
  },
}));
