/**
 * AIFlow IPC Zod 스키마 — 13_ZOD_SCHEMAS.md SSOT 구현
 * Tauri IPC 경계에서 런타임 타입 안전성 보장
 */
import { z } from 'zod';

// ─── 공통 기본 타입 ───────────────────────────────────────────
export const UuidSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const ProviderIdSchema = z.enum(['openai', 'anthropic', 'google', 'ollama']);
export const ModelIdSchema = z.string().min(1).max(100);
export const CostUsdSchema = z.number().nonnegative();
export const TokenCountSchema = z.number().int().nonnegative().max(2_000_000);

/** IPC 에러 응답 — Rust IpcError와 계약 일치 (06_TEST_SPEC.md §11 contract tests) */
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function isIpcError(value: unknown): value is ErrorResponse {
  return ErrorResponseSchema.safeParse(value).success;
}

// ─── API 키 상태 ──────────────────────────────────────────────
/** 04_PROJECT_SPEC.md C-1: 실제 키값 절대 포함 금지 */
export const ApiKeyStatusSchema = z.object({
  provider_id: ProviderIdSchema,
  is_set: z.boolean(),
  masked_preview: z.string().optional(),
});
export type ApiKeyStatusResponse = z.infer<typeof ApiKeyStatusSchema>;

// ─── 대화/메시지 ──────────────────────────────────────────────
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const ConversationSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  provider_id: ProviderIdSchema,
  model_id: ModelIdSchema,
  total_tokens: TokenCountSchema,
  total_cost_usd: CostUsdSchema,
  is_pinned: z.boolean(),
  is_private: z.boolean(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});
export type ConversationResponse = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  role: MessageRoleSchema,
  content: z.string(),
  tokens_used: TokenCountSchema.optional(),
  cost_usd: CostUsdSchema.optional(),
  model_id: ModelIdSchema.optional(),
  is_redacted: z.boolean(),
  created_at: TimestampSchema,
});
export type MessageResponse = z.infer<typeof MessageSchema>;

export const MessagePageResultSchema = z.object({
  messages: z.array(MessageSchema),
  has_more: z.boolean(),
});

// ─── AI 스트림 청크 ───────────────────────────────────────────
/** Rust StreamChunk와 serde tag 계약 일치 — 06_TEST_SPEC.md §10 */
export const StreamChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    message_id: UuidSchema,
    tokens_used: TokenCountSchema,
    cost_usd: CostUsdSchema,
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
]);
export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ─── 페르소나 ─────────────────────────────────────────────────
export const PersonaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  system_prompt: z.string().max(4000),
  avatar_emoji: z.string().min(1).max(8),
  is_default: z.boolean(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});
export type PersonaResponse = z.infer<typeof PersonaSchema>;

// ─── 프롬프트 라이브러리 ──────────────────────────────────────
export const PromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(10000),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()),
  use_count: z.number().int().nonnegative(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});
export type PromptResponse = z.infer<typeof PromptSchema>;

// ─── IPC 입력 스키마 ──────────────────────────────────────────
export const CreateConversationInputSchema = z.object({
  provider_id: ProviderIdSchema,
  model_id: ModelIdSchema,
});

export const SetApiKeyInputSchema = z.object({
  provider_id: ProviderIdSchema,
  api_key: z
    .string()
    .min(10, 'API 키가 너무 짧습니다')
    .max(200, 'API 키가 너무 깁니다')
    .regex(/^\S+$/, 'API 키에 공백이 포함될 수 없습니다'),
});

export const GetMessagesInputSchema = z.object({
  conversation_id: UuidSchema,
  before_id: UuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
