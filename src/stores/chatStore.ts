import { create } from 'zustand';
import { invoke, streamAi, type StreamChunk } from '@/lib/ipc/invoke';
import type { Conversation, Message, MessagePageResult } from '@/types';
import { usePersonaStore } from './personaStore';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;
  cancelStream: (() => void) | null;

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (providerId: string, modelId: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePinConversation: (id: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  cancelCurrentStream: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  streamingContent: '',
  isStreaming: false,
  cancelStream: null,

  loadConversations: async () => {
    const conversations = await invoke<Conversation[]>('list_conversations');
    set({ conversations });
  },

  createConversation: async (providerId, modelId) => {
    const conversation = await invoke<Conversation>('create_conversation', {
      provider_id: providerId,
      model_id: modelId,
    });
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: conversation.id,
      messages: { ...s.messages, [conversation.id]: [] },
    }));
    return conversation;
  },

  deleteConversation: async (id) => {
    await invoke('delete_conversation', { conversation_id: id });
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const activeConversationId = s.activeConversationId === id
        ? conversations[0]?.id ?? null
        : s.activeConversationId;
      return { conversations, activeConversationId };
    });
  },

  renameConversation: async (id, title) => {
    await invoke('rename_conversation', { conversation_id: id, title });
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  togglePinConversation: async (id) => {
    const isPinned = await invoke<boolean>('toggle_pin_conversation', { conversation_id: id });
    set((s) => ({
      conversations: s.conversations
        .map((c) => (c.id === id ? { ...c, isPinned } : c))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    }));
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id, streamingContent: '' });
    if (id && !get().messages[id]) {
      get().loadMessages(id);
    }
  },

  loadMessages: async (conversationId) => {
    const result = await invoke<MessagePageResult>('get_messages', {
      conversation_id: conversationId,
      limit: 50,
    });
    // 최신순 → 오래된순으로 뒤집어 표시
    const messages = [...result.messages].reverse();
    set((s) => ({
      messages: { ...s.messages, [conversationId]: messages },
    }));
  },

  sendMessage: async (content) => {
    const { activeConversationId, conversations } = get();
    if (!activeConversationId) return;

    // FIX: conversationId를 로컬 변수에 캡처 — stale closure 방지
    // 사용자가 다른 대화로 전환해도 이 스트림의 메시지는 올바른 대화에 귀속됨
    const targetConversationId = activeConversationId;
    const conversation = conversations.find((c) => c.id === targetConversationId);
    if (!conversation) return;

    // 사용자 메시지 즉시 UI에 추가 (optimistic update)
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: targetConversationId,
      role: 'user',
      content,
      isRedacted: false,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [targetConversationId]: [
          ...(s.messages[targetConversationId] ?? []),
          userMessage,
        ],
      },
      streamingContent: '',
      isStreaming: true,
    }));

    const existingMessages = get().messages[targetConversationId] ?? [];

    // 활성 페르소나 system_prompt 조회 (없으면 undefined)
    const { personas, activePersonaId } = usePersonaStore.getState();
    const activePersona = personas.find((p) => p.id === activePersonaId);
    const systemPrompt = activePersona?.systemPrompt || undefined;

    // FIX: streamingContent 누적을 로컬 변수로 관리 — store get() race 방지
    let accumulatedContent = '';

    const { cancel } = streamAi(
      {
        conversationId: targetConversationId,
        providerId: conversation.providerId,
        modelId: conversation.modelId,
        messages: existingMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        systemPrompt,
      },
      (chunk: StreamChunk) => {
        if (chunk.type === 'token') {
          accumulatedContent += chunk.content;
          set({ streamingContent: accumulatedContent });
        } else if (chunk.type === 'done') {
          // FIX: get().streamingContent 대신 로컬 accumulatedContent 사용 — race 없음
          const assistantMessage: Message = {
            id: chunk.message_id,
            conversationId: targetConversationId,
            role: 'assistant',
            content: accumulatedContent,
            tokensUsed: chunk.tokens_used,
            costUsd: chunk.cost_usd,
            modelId: conversation.modelId,
            isRedacted: false,
            createdAt: new Date().toISOString(),
          };
          accumulatedContent = '';
          set((s) => ({
            messages: {
              ...s.messages,
              [targetConversationId]: [
                ...(s.messages[targetConversationId] ?? []),
                assistantMessage,
              ],
            },
            streamingContent: '',
            isStreaming: false,
            cancelStream: null,
          }));
        } else if (chunk.type === 'error') {
          accumulatedContent = '';
          set({ isStreaming: false, cancelStream: null, streamingContent: '' });
        }
      }
    );

    set({ cancelStream: cancel });
  },

  cancelCurrentStream: () => {
    const { cancelStream } = get();
    if (cancelStream) {
      cancelStream();
      set({ isStreaming: false, cancelStream: null });
    }
  },
}));
