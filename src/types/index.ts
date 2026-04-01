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
  versionCount: number;
  activeVersion: number;
}

export interface MessageVersion {
  id: string;
  messageId: string;
  versionNumber: number;
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  createdAt: string;
}

// Streaming
export interface StreamChunk {
  type: "token" | "done" | "error"
    | "multi_start" | "stream_done" | "stream_error" | "stream_cancelled" | "multi_done"
    | "routing_info" | "fallback_triggered" | "fallback_attempt";
  token?: string;
  streamIndex?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  costKrw?: number;
  exchangeRate?: number;
  error?: string;
  // Multi-AI specific
  count?: number;
  targets?: StreamTarget[];
  totalCostUsd?: number;
  totalCostKrw?: number;
  // Routing specific
  complexityScore?: number;
  complexityLabel?: string;
  selectedProvider?: string;
  selectedModel?: string;
  selectedModelName?: string;
  potentialSavings?: number;
  costSavedUsd?: number;
  // Fallback
  failedProvider?: string;
  fallbackUsed?: boolean;
  actualProvider?: string;
  providerId?: string;
  modelId?: string;
}

// Phase 2: Multi-AI stream target
export interface StreamTarget {
  providerId: string;
  modelId: string;
}

// Phase 2: Routing
export interface RoutingSuggestion {
  complexityScore: number;
  complexityLabel: string;
  suggestedProviderId: string;
  suggestedModelId: string;
  suggestedModelName: string;
  estimatedCostUsd: number;
  cheapestCostUsd: number;
  potentialSavingsUsd: number;
  ruleId: string | null;
  fallbackChain: { providerId: string; modelId: string }[];
}

export interface RoutingRule {
  id: string;
  name: string;
  minComplexity: number;
  maxComplexity: number;
  providerId: string;
  modelId: string;
  fallbackChain: { providerId: string; modelId: string }[];
  priority: number;
  isActive: boolean;
}

// Phase 2: Local LLM
export interface LocalLlmDetectionResult {
  endpointName: string;
  baseUrl: string;
  isRunning: boolean;
  models: LocalLlmModel[];
}

export interface LocalLlmModel {
  id: string;
  endpointId: string;
  modelName: string;
  modelSize: string | null;
  parameterCount: string | null;
}

// Phase 2: Privacy
export interface PiiStat {
  piiType: string;
  totalCount: number;
  maskedCount: number;
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
// ─── MCP Plugin Market ───────────────────────────────────────────────────
export interface MCPServer {
  id: number;
  name: string;
  description?: string;
  server_type: "filesystem" | "git" | "browser" | "custom";
  command: string;
  args: string[];
  allowed_paths: string[];
  env_vars: Record<string, string>;
  is_enabled: boolean;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Workflow Builder ────────────────────────────────────────────────────
export interface WorkflowTemplate {
  id: number;
  name: string;
  description?: string;
  category: "writing" | "coding" | "translation" | "analysis" | "social";
  icon: string;
  steps: TemplateStep[];
  is_builtin: boolean;
  created_at: string;
}

export interface TemplateStep {
  name: string;
  prompt: string;
  model?: string;
}

export interface WorkflowStep {
  id: number;
  workflow_id: number;
  step_order: number;
  name: string;
  provider?: string;
  model?: string;
  system_prompt?: string;
  user_prompt_template: string;
  mcp_server_id?: number;
  is_enabled: boolean;
}

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  template_id?: number;
  is_active: boolean;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepResult {
  id: number;
  run_id: number;
  step_id: number;
  step_order: number;
  input_text: string;
  output_text?: string;
  status: "pending" | "running" | "completed" | "failed";
  error_message?: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  started_at?: string;
  completed_at?: string;
}

export interface WorkflowRun {
  id: number;
  workflow_id: number;
  status: "pending" | "running" | "completed" | "failed";
  initial_input: string;
  final_output?: string;
  error_message?: string;
  total_cost_usd: number;
  step_results: WorkflowStepResult[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ─── Batch Processing ────────────────────────────────────────────────────
export interface BatchJob {
  id: number;
  name: string;
  workflow_id?: number;
  provider?: string;
  model?: string;
  system_prompt?: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total_items: number;
  processed_items: number;
  failed_items: number;
  output_dir?: string;
  total_cost_usd: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface BatchItem {
  id: number;
  job_id: number;
  item_order: number;
  input_text?: string;
  input_file_path?: string;
  output_text?: string;
  output_file_path?: string;
  status: "pending" | "running" | "completed" | "failed";
  error_message?: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  processed_at?: string;
}

export interface BatchProgressEvent {
  job_id: number;
  item_id: number;
  item_order: number;
  total_items: number;
  processed_items: number;
  status: string;
  output_text?: string;
  error_message?: string;
}

// ─── Payment / License ───────────────────────────────────────────────────
export interface LicenseInfo {
  id: number;
  tier: "free" | "pro";
  payment_provider?: string;
  order_id?: string;
  activated_at?: string;
  expires_at?: string;
  last_verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProFeatures {
  mcp_plugins: boolean;
  workflow_builder: boolean;
  batch_processing: boolean;
  browser_extension: boolean;
  smart_routing: boolean;
  unlimited_history: boolean;
}

export interface CheckoutUrlResponse {
  url: string;
  provider: string;
}

// ─── Browser Extension ───────────────────────────────────────────────────
export interface BrowserExtStatus {
  registered: boolean;
  manifest_path?: string;
  registry_key?: string;
  native_host_path?: string;
}

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
