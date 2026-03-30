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
  cancelStream,
} from "@/lib/ipc/invoke";
import { useSettingsStore } from "./settingsStore";

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
  sendMessage: (content: string) => Promise<void>;
  cancelCurrentStream: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isStreaming: false,
  streamingContent: "",
  currentStreamId: null,

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

  sendMessage: async (content) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    const streamId = crypto.randomUUID();
    let accumulated = "";

    set({ isStreaming: true, streamingContent: "", currentStreamId: streamId });

    // Capture conversation ID to avoid stale closure
    const targetConvId = activeConversationId;

    const { activeProviderId, activeModelId } = useSettingsStore.getState();

    const { promise } = streamAiMessage(
      targetConvId,
      content,
      activeProviderId,
      activeModelId,
      streamId,
      (chunk: StreamChunk) => {
        if (chunk.type === "token" && chunk.token) {
          accumulated += chunk.token;
          set({ streamingContent: accumulated });
        } else if (chunk.type === "done") {
          set({ isStreaming: false, streamingContent: "", currentStreamId: null });
          // Reload messages to get the saved assistant message
          get().loadMessages(targetConvId);
          get().loadConversations();
        } else if (chunk.type === "error") {
          set({ isStreaming: false, streamingContent: "", currentStreamId: null });
        }
      },
    );

    try {
      await promise;
    } catch (err) {
      set({ isStreaming: false, streamingContent: "", currentStreamId: null });
      console.error("Stream error:", err);
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
