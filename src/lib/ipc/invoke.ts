import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  Conversation,
  Message,
  ApiKeyStatus,
  StreamChunk,
  ModelInfo,
} from "@/types";

// ─── Keychain ───

export async function saveApiKey(
  provider: string,
  key: string,
): Promise<void> {
  return invoke("save_api_key", { provider, key });
}

export async function getApiKeyStatus(
  provider: string,
): Promise<ApiKeyStatus> {
  return invoke("get_api_key_status", { provider });
}

export async function deleteApiKey(provider: string): Promise<void> {
  return invoke("delete_api_key", { provider });
}

export async function validateApiKeyOnly(
  provider: string,
  key: string,
): Promise<void> {
  return invoke("validate_api_key_only", { provider, key });
}

// ─── Conversations ───

export async function createConversation(
  providerId: string,
  modelId: string,
): Promise<Conversation> {
  return invoke("create_conversation", { providerId, modelId });
}

export async function getConversations(): Promise<Conversation[]> {
  return invoke("get_conversations");
}

export async function getMessages(
  conversationId: string,
  limit?: number,
): Promise<Message[]> {
  return invoke("get_messages", { conversationId, limit: limit ?? 50 });
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  return invoke("delete_conversation", { conversationId });
}

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<void> {
  return invoke("rename_conversation", { conversationId, title });
}

export async function togglePin(conversationId: string): Promise<void> {
  return invoke("toggle_pin", { conversationId });
}

// ─── AI Models ───

export async function getModelCatalog(
  providerId?: string,
): Promise<ModelInfo[]> {
  return invoke("get_model_catalog", { providerId: providerId ?? null });
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
  return invoke("cancel_stream", { streamId });
}
