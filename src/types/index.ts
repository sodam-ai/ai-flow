// Provider types — 11 providers (PRD v4.1 §04)
export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "mistral"
  | "groq"
  | "deepseek"
  | "cohere"
  | "xai"
  | "azure_openai"
  | "openai_compatible";

export interface Provider {
  id: ProviderId;
  name: string;
  defaultModel: string;
  keyPrefix: string; // for format validation (e.g. "sk-")
}

export interface ApiKeyStatus {
  isSet: boolean;
  maskedPreview: string | null; // e.g. "sk-••••••••1234"
}

// Conversation & Message
export interface Conversation {
  id: string;
  title: string;
  providerId: ProviderId;
  modelId: string;
  personaId: string | null;
  isPinned: boolean;
  messageCount: number;
  totalCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  createdAt: string;
}

// Streaming
export interface StreamChunk {
  type: "token" | "done" | "error";
  token?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  costKrw?: number;
  exchangeRate?: number;
  error?: string;
}

// Model catalog entry (from Rust provider trait)
export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  inputPricePerM: number;  // USD per 1M input tokens
  outputPricePerM: number; // USD per 1M output tokens
  maxContext: number;
}

// Cost display
export interface CostDisplay {
  usd: number;
  krw: number;
  inputTokens: number;
  outputTokens: number;
}

// Settings
export interface AppSettings {
  language: "ko" | "en";
  theme: "dark" | "light";
  defaultProviderId: ProviderId | null;
  defaultModelId: string | null;
  showCostPerMessage: boolean;
  exchangeRateUsdToKrw: number;
}

// ─── Persona (Phase 1b) ───
export interface Persona {
  id: string;
  name: string;
  slug: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
  is_builtin: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonaInput {
  name: string;
  description?: string;
  system_prompt: string;
  icon?: string;
  color?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string;
  system_prompt?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
}

// ─── Prompt Template (Phase 1b) ───
export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  description: string;
  tags: string[];
  variables: string[];
  is_favorite: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePromptInput {
  title: string;
  content: string;
  description?: string;
  tags?: string[];
}

export interface UpdatePromptInput {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
  is_favorite?: boolean;
}

// ─── File (Phase 1b) ───
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  is_image: boolean;
}

export interface FileContent {
  info: FileInfo;
  content: string;
  content_type: "text" | "image";
}

// IPC Error (matches 14_ERROR_CATALOG)
export interface IpcError {
  code: string;
  message: string;
  detail?: string;
}

export function isIpcError(err: unknown): err is IpcError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "message" in err
  );
}
