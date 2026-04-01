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
  kbIds?: number[], // Smart Context Injection
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
    kbIds: kbIds && kbIds.length > 0 ? kbIds : null,
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

// ─── Cost Report + Budget (Phase 2) ───

export interface CostReport {
  period: string;
  totalCostUsd: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: { providerId: string; modelId: string; messageCount: number; totalCostUsd: number; totalInputTokens: number; totalOutputTokens: number }[];
  byDay: { date: string; messageCount: number; totalCostUsd: number }[];
  avgCostPerMessage: number;
}

export interface BudgetStatus {
  monthlyBudgetUsd: number;
  spentThisMonthUsd: number;
  remainingUsd: number;
  usagePct: number;
  alertThresholdPct: number;
  isOverThreshold: boolean;
  isOverBudget: boolean;
}

export async function getCostReport(period: string): Promise<CostReport> {
  return invoke("get_cost_report", { period });
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  return invoke("get_budget_status");
}

export async function setBudget(monthlyUsd: number, thresholdPct: number): Promise<void> {
  return invoke("set_budget", { monthlyUsd, thresholdPct });
}

// ─── Prompt Versions (Phase 2) ───

export interface PromptVersionEntry {
  id: string;
  promptId: string;
  versionNumber: number;
  title: string;
  content: string;
  description: string;
  tags: string[];
  createdAt: string;
}

export async function getPromptVersions(promptId: string): Promise<PromptVersionEntry[]> {
  return invoke("get_prompt_versions", { promptId });
}

export async function restorePromptVersion(promptId: string, versionId: string): Promise<void> {
  return invoke("restore_prompt_version", { promptId, versionId });
}

// ─── MCP Plugin Market (Phase 2) ─────────────────────────────────────────
import type { MCPServer, WorkflowTemplate, Workflow, WorkflowRun, BatchJob, BatchItem, LicenseInfo, ProFeatures, CheckoutUrlResponse, BrowserExtStatus } from "@/types";

export async function listMcpServers(): Promise<MCPServer[]> {
  return invoke("list_mcp_servers");
}

export async function createMcpServer(req: {
  name: string; description?: string; server_type?: string;
  command: string; args: string[]; allowed_paths: string[];
}): Promise<MCPServer> {
  return invoke("create_mcp_server", { req });
}

export async function toggleMcpServer(id: number, enabled: boolean): Promise<MCPServer> {
  return invoke("toggle_mcp_server", { id, enabled });
}

export async function deleteMcpServer(id: number): Promise<void> {
  return invoke("delete_mcp_server", { id });
}

export async function setMcpAllowedPaths(id: number, paths: string[]): Promise<MCPServer> {
  return invoke("set_mcp_allowed_paths", { id, paths });
}

// ─── Workflow Builder (Phase 2) ──────────────────────────────────────────
export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return invoke("list_workflow_templates");
}

export async function listWorkflows(): Promise<Workflow[]> {
  return invoke("list_workflows");
}

export async function createWorkflow(req: {
  name: string; description?: string; template_id?: number;
  steps: { name: string; provider?: string; model?: string; system_prompt?: string; user_prompt_template: string }[];
}): Promise<Workflow> {
  return invoke("create_workflow", { req });
}

export async function deleteWorkflow(id: number): Promise<void> {
  return invoke("delete_workflow", { id });
}

export async function runWorkflow(req: {
  workflow_id: number; initial_input: string;
  provider_override?: string; model_override?: string;
}): Promise<WorkflowRun> {
  return invoke("run_workflow", { req });
}

export async function listWorkflowRuns(workflowId: number): Promise<WorkflowRun[]> {
  return invoke("list_workflow_runs", { workflowId });
}

// ─── Batch Processing (Phase 2) ──────────────────────────────────────────
export async function listBatchJobs(): Promise<BatchJob[]> {
  return invoke("list_batch_jobs");
}

export async function createBatchJob(req: {
  name: string; provider?: string; model?: string;
  system_prompt?: string; output_dir?: string;
  items: { input_text?: string; input_file_path?: string }[];
}): Promise<BatchJob> {
  return invoke("create_batch_job", { req });
}

export async function getBatchItems(jobId: number): Promise<BatchItem[]> {
  return invoke("get_batch_items", { jobId });
}

export async function runBatchJob(jobId: number): Promise<void> {
  return invoke("run_batch_job", { jobId });
}

export async function cancelBatchJob(jobId: number): Promise<void> {
  return invoke("cancel_batch_job", { jobId });
}

// ─── Payment / License (Phase 2) ─────────────────────────────────────────
export async function getLicenseStatus(): Promise<LicenseInfo> {
  return invoke("get_license_status");
}

export async function getProFeatures(): Promise<ProFeatures> {
  return invoke("get_pro_features");
}

export async function createLemonsqueezyCheckout(): Promise<CheckoutUrlResponse> {
  return invoke("create_lemonsqueezy_checkout");
}

export async function createTossCheckout(): Promise<CheckoutUrlResponse> {
  return invoke("create_toss_checkout");
}

export async function createNaverpayCheckout(): Promise<CheckoutUrlResponse> {
  return invoke("create_naverpay_checkout");
}

export async function activateLicense(licenseKey: string, provider: string): Promise<LicenseInfo> {
  return invoke("activate_license", { req: { license_key: licenseKey, provider } });
}

// ─── Browser Extension (Phase 2) ─────────────────────────────────────────
export async function getBrowserExtStatus(): Promise<BrowserExtStatus> {
  return invoke("get_browser_ext_status");
}

export async function registerNativeHost(): Promise<string> {
  return invoke("register_native_host");
}

// ─── Knowledge Base / RAG (Phase 3) ──────────────────────────────────────
import type { KnowledgeBase, KbDocument, KbSearchResult, AgentRun, AgentStep, ConversationBranch } from "@/types";

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return invoke("list_knowledge_bases");
}

export async function createKnowledgeBase(req: { name: string; description?: string; icon?: string }): Promise<KnowledgeBase> {
  return invoke("create_knowledge_base", { req });
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  return invoke("delete_knowledge_base", { id });
}

export async function listKbDocuments(kbId: number): Promise<KbDocument[]> {
  return invoke("list_kb_documents", { kbId });
}

export async function indexDocument(req: { kb_id: number; file_path: string }): Promise<KbDocument> {
  return invoke("index_document", { req });
}

export async function deleteKbDocument(docId: number): Promise<void> {
  return invoke("delete_kb_document", { docId });
}

export async function searchKnowledgeBase(req: { kb_id?: number; query: string; limit?: number }): Promise<KbSearchResult[]> {
  return invoke("search_knowledge_base", { req });
}

// ─── AI Agent (Phase 3) ──────────────────────────────────────────────────

export async function startAgentRun(req: {
  goal: string;
  provider?: string;
  model?: string;
  conversation_id?: string;
  kb_ids?: number[];
  max_steps?: number;
}): Promise<AgentRun> {
  return invoke("start_agent_run", { req });
}

export async function resumeAgentRun(runId: number): Promise<AgentRun> {
  return invoke("resume_agent_run", { runId });
}

export async function approveAgentStep(req: {
  run_id: number;
  step_id: number;
  approved: boolean;
  feedback?: string;
}): Promise<AgentStep> {
  return invoke("approve_agent_step", { req });
}

export async function cancelAgentRun(runId: number): Promise<void> {
  return invoke("cancel_agent_run", { runId });
}

export async function listAgentRuns(): Promise<AgentRun[]> {
  return invoke("list_agent_runs");
}

export async function getAgentRunDetail(runId: number): Promise<AgentRun> {
  return invoke("get_agent_run", { runId });
}

// ─── Conversation Branching (Phase 3) ────────────────────────────────────

export async function createConversationBranch(req: {
  parent_conversation_id: string;
  fork_message_id: string;
  fork_message_index: number;
  label?: string;
}): Promise<ConversationBranch> {
  return invoke("create_conversation_branch", { req });
}

export async function listConversationBranches(conversationId: string): Promise<ConversationBranch[]> {
  return invoke("list_conversation_branches", { conversationId });
}

// ─── Workflow Export/Import (Phase 3) ────────────────────────────────────

export async function exportWorkflow(workflowId: number): Promise<string> {
  return invoke("export_workflow", { workflowId });
}

export async function importWorkflow(jsonStr: string): Promise<import("@/types").Workflow> {
  return invoke("import_workflow", { jsonStr });
}
