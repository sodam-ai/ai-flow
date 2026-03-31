import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  Conversation,
  Message,
  MessageVersion,
  ApiKeyStatus,
  StreamChunk,
  StreamTarget,
  ModelInfo,
  Persona,
  CreatePersonaInput,
  UpdatePersonaInput,
  PromptTemplate,
  CreatePromptInput,
  UpdatePromptInput,
  FileContent,
  RoutingSuggestion,
  RoutingRule,
  LocalLlmDetectionResult,
  PiiStat,
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
  createPersonaSchema,
  updatePersonaSchema,
  idParamSchema,
  createPromptSchema,
  updatePromptSchema,
  usePromptSchema,
  listPromptsSchema,
  filePathSchema,
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
  personaId: string | null,
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
    personaId,
    channel,
  });

  return { promise, channel };
}

export async function cancelStream(streamId: string): Promise<void> {
  validate(cancelStreamSchema, { streamId });
  return invoke("cancel_stream", { streamId });
}

// ─── AI Regeneration ───

export function regenerateAiMessage(
  messageId: string,
  conversationId: string,
  providerId: string,
  modelId: string,
  streamId: string,
  personaId: string | null,
  onChunk: (chunk: StreamChunk) => void,
): { promise: Promise<void>; channel: Channel<StreamChunk> } {
  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;

  const promise = invoke<void>("regenerate_ai_message", {
    messageId,
    conversationId,
    providerId,
    modelId,
    streamId,
    personaId,
    channel,
  });

  return { promise, channel };
}

// ─── Message Versions ───

export async function getMessageVersions(messageId: string): Promise<MessageVersion[]> {
  return invoke("get_message_versions", { messageId });
}

// ─── Search ───

export async function searchMessages(query: string, limit?: number): Promise<Message[]> {
  return invoke("search_messages", { query, limit: limit ?? 20 });
}

// ─── Personas (Phase 1b) ───

export async function listPersonas(): Promise<Persona[]> {
  return invoke("list_personas");
}

export async function getPersona(id: string): Promise<Persona> {
  validate(idParamSchema, { id });
  return invoke("get_persona", { id });
}

export async function createPersona(input: CreatePersonaInput): Promise<Persona> {
  validate(createPersonaSchema, { input });
  return invoke("create_persona", { input });
}

export async function updatePersona(id: string, input: UpdatePersonaInput): Promise<Persona> {
  validate(updatePersonaSchema, { id, input });
  return invoke("update_persona", { id, input });
}

export async function deletePersona(id: string): Promise<void> {
  validate(idParamSchema, { id });
  return invoke("delete_persona", { id });
}

// ─── Prompts (Phase 1b) ───

export async function listPrompts(tag?: string): Promise<PromptTemplate[]> {
  validate(listPromptsSchema, { tag: tag ?? null });
  return invoke("list_prompts", { tag: tag ?? null });
}

export async function getPrompt(id: string): Promise<PromptTemplate> {
  validate(idParamSchema, { id });
  return invoke("get_prompt", { id });
}

export async function createPrompt(input: CreatePromptInput): Promise<PromptTemplate> {
  validate(createPromptSchema, { input });
  return invoke("create_prompt", { input });
}

export async function updatePrompt(id: string, input: UpdatePromptInput): Promise<PromptTemplate> {
  validate(updatePromptSchema, { id, input });
  return invoke("update_prompt", { id, input });
}

export async function deletePrompt(id: string): Promise<void> {
  validate(idParamSchema, { id });
  return invoke("delete_prompt", { id });
}

export async function usePrompt(id: string, variables: Record<string, string>): Promise<string> {
  validate(usePromptSchema, { id, variables });
  return invoke("use_prompt", { id, variables });
}

// ─── File & Clipboard (Phase 1b) ───

export async function validateAndReadFile(path: string): Promise<FileContent> {
  validate(filePathSchema, { path });
  return invoke("validate_and_read_file", { path });
}

export async function readClipboardContent(): Promise<string> {
  return invoke("read_clipboard_content");
}

// ─── Overlay (Phase 1b) ───

export async function toggleOverlay(): Promise<void> {
  return invoke("toggle_overlay");
}

export async function closeOverlay(): Promise<void> {
  return invoke("close_overlay");
}

// ─── Multi-AI Comparison (Phase 2) ───

export function streamMultiAi(
  conversationId: string,
  content: string,
  targets: StreamTarget[],
  personaId: string | null,
  onChunk: (chunk: StreamChunk) => void,
): { promise: Promise<unknown>; channel: Channel<StreamChunk> } {
  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;

  const promise = invoke("stream_multi_ai", {
    conversationId,
    content,
    targets,
    personaId,
    channel,
  });

  return { promise, channel };
}

export async function adoptComparison(
  groupId: string,
  messageId: string,
): Promise<void> {
  return invoke("adopt_comparison", { groupId, messageId });
}

// ─── Smart Routing (Phase 2) ───

export async function getRoutingSuggestion(
  prompt: string,
  hasFile: boolean,
  hasCode: boolean,
): Promise<RoutingSuggestion> {
  return invoke("get_routing_suggestion", { prompt, hasFile, hasCode });
}

export async function getRoutingRules(): Promise<RoutingRule[]> {
  return invoke("get_routing_rules");
}

export function streamRoutedMessage(
  conversationId: string,
  content: string,
  streamId: string,
  hasFile: boolean,
  hasCode: boolean,
  personaId: string | null,
  onChunk: (chunk: StreamChunk) => void,
): { promise: Promise<unknown>; channel: Channel<StreamChunk> } {
  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;

  const promise = invoke("stream_routed_message", {
    conversationId,
    content,
    streamId,
    hasFile,
    hasCode,
    personaId,
    channel,
  });

  return { promise, channel };
}

// ─── Local LLM Detection (Phase 2) ───

export async function detectLocalLlms(): Promise<LocalLlmDetectionResult[]> {
  return invoke("detect_local_llms");
}

export async function getLocalEndpoints(): Promise<unknown[]> {
  return invoke("get_local_endpoints");
}

// ─── Privacy (Phase 2) ───

export async function logPiiDetection(
  conversationId: string,
  messageId: string | null,
  piiType: string,
  piiCount: number,
  wasMasked: boolean,
): Promise<void> {
  return invoke("log_pii_detection", {
    conversationId,
    messageId,
    piiType,
    piiCount,
    wasMasked,
  });
}

export async function getPrivacyStats(
  conversationId: string,
): Promise<PiiStat[]> {
  return invoke("get_privacy_stats", { conversationId });
}
