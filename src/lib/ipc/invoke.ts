import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  Conversation,
  Message,
  ApiKeyStatus,
  StreamChunk,
  ModelInfo,
} from "@/types";
import {
  saveApiKeySchema,
  providerIdSchema,
  createConversationSchema,
  getMessagesSchema,
  conversationIdSchema,
  renameConversationSchema,
  streamAiMessageSchema,
  cancelStreamSchema,
  getModelCatalogSchema,
} from "./schemas";

/** Validate params with Zod before invoking Tauri IPC */
function validate<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`VAL_001: Invalid parameters — ${message}`);
  }
}

// ─── Keychain ───

export async function saveApiKey(
  provider: string,
  key: string,
): Promise<void> {
  const params = validate(saveApiKeySchema, { provider, key });
  return invoke("save_api_key", params);
}

export async function getApiKeyStatus(
  provider: string,
): Promise<ApiKeyStatus> {
  validate(providerIdSchema, { provider });
  return invoke("get_api_key_status", { provider });
}

export async function deleteApiKey(provider: string): Promise<void> {
  validate(providerIdSchema, { provider });
  return invoke("delete_api_key", { provider });
}

export async function validateApiKeyOnly(
  provider: string,
  key: string,
): Promise<void> {
  const params = validate(saveApiKeySchema, { provider, key });
  return invoke("validate_api_key_only", params);
}

// ─── Conversations ───

export async function createConversation(
  providerId: string,
  modelId: string,
): Promise<Conversation> {
  const params = validate(createConversationSchema, { providerId, modelId });
  return invoke("create_conversation", params);
}

export async function getConversations(): Promise<Conversation[]> {
  return invoke("get_conversations");
}

export async function getMessages(
  conversationId: string,
  limit?: number,
): Promise<Message[]> {
  const params = validate(getMessagesSchema, { conversationId, limit: limit ?? 50 });
  return invoke("get_messages", params);
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  validate(conversationIdSchema, { conversationId });
  return invoke("delete_conversation", { conversationId });
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<void> {
  const params = validate(renameConversationSchema, { conversationId, title });
  return invoke("rename_conversation", params);
}

export async function togglePin(conversationId: string): Promise<void> {
  validate(conversationIdSchema, { conversationId });
  return invoke("toggle_pin", { conversationId });
}

// ─── AI Models ───

export async function getModelCatalog(
  providerId?: string,
): Promise<ModelInfo[]> {
  const params = validate(getModelCatalogSchema, { providerId: providerId ?? null });
  return invoke("get_model_catalog", params);
}

// ─── AI Streaming ───

export function streamAiMessage(
  conversationId: string,
  content: string,
  providerId: string,
  modelId: string,
  streamId: string,
  onChunk: (chunk: StreamChunk) => void,
): { promise: Promise<void>; channel: Channel<StreamChunk> } {
  // Validate before creating channel
  validate(streamAiMessageSchema, { conversationId, content, providerId, modelId, streamId });

  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;

  const promise = invoke<void>("stream_ai_message", {
    conversationId,
    content,
    providerId,
    modelId,
    streamId,
    channel,
  });

  return { promise, channel };
}

export async function cancelStream(streamId: string): Promise<void> {
  validate(cancelStreamSchema, { streamId });
  return invoke("cancel_stream", { streamId });
}
