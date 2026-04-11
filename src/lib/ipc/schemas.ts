import { z } from "zod";

// ─── Common ───
const nonEmptyString = z.string().min(1, "Cannot be empty");
const uuid = z.string().min(1);

// ─── Keychain ───
export const saveApiKeySchema = z.object({
  provider: nonEmptyString,
  key: nonEmptyString,
});

export const providerIdSchema = z.object({
  provider: nonEmptyString,
});

// ─── Conversations ───
export const createConversationSchema = z.object({
  providerId: nonEmptyString,
  modelId: nonEmptyString,
});

export const getMessagesSchema = z.object({
  conversationId: uuid,
  limit: z.number().int().positive().max(200),
});

export const conversationIdSchema = z.object({
  conversationId: uuid,
});

export const renameConversationSchema = z.object({
  conversationId: uuid,
  title: z.string().min(1).max(200),
});

// ─── AI Streaming ───
// ASVS 5.1.3: base64 PNG 최대 ~10 MB → base64 인코딩 후 ~13.3 MB = 14_000_000자
const base64Image = z.string().max(14_000_000).nullable().optional();

export const streamAiMessageSchema = z.object({
  conversationId: uuid,
  content: z.string().min(1).max(100_000),
  providerId: nonEmptyString,
  modelId: nonEmptyString,
  streamId: uuid,
  imageData: base64Image, // C-1: 크기 상한 적용
});

// C-2: 검증 누락 해소 — regenerate / multi 공통 스키마
export const regenerateAiMessageSchema = z.object({
  messageId: nonEmptyString,
  conversationId: uuid,
  providerId: nonEmptyString,
  modelId: nonEmptyString,
  streamId: uuid,
});

export const streamMultiAiSchema = z.object({
  conversationId: uuid,
  content: z.string().min(1).max(100_000),
  // targets: 2~3개로 제한 (multi_stream.rs 와 동일)
  targets: z.array(z.object({
    providerId: nonEmptyString,
    modelId: nonEmptyString,
  })).min(2).max(3),
});

export const editAndStreamMessageSchema = z.object({
  messageId: nonEmptyString,
  conversationId: uuid,
  newContent: z.string().min(1).max(100_000),
  providerId: nonEmptyString,
  modelId: nonEmptyString,
  streamId: uuid,
  personaId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const cancelStreamSchema = z.object({
  streamId: uuid,
});

// ─── Model Catalog ───
export const getModelCatalogSchema = z.object({
  providerId: z.string().nullable(),
});

// ─── Personas (Phase 1b) ───
export const createPersonaSchema = z.object({
  input: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    system_prompt: z.string().min(1).max(10_000),
    icon: z.string().max(50).optional(),
    color: z.string().max(20).optional(),
  }),
});

export const updatePersonaSchema = z.object({
  id: nonEmptyString,
  input: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    system_prompt: z.string().min(1).max(10_000).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(20).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  id: nonEmptyString,
});

// ─── Prompts (Phase 1b) ───
export const createPromptSchema = z.object({
  input: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(50_000),
    description: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const updatePromptSchema = z.object({
  id: nonEmptyString,
  input: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(50_000).optional(),
    description: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    is_favorite: z.boolean().optional(),
  }),
});

export const usePromptSchema = z.object({
  id: nonEmptyString,
  variables: z.record(z.string(), z.string()),
});

export const listPromptsSchema = z.object({
  tag: z.string().optional().nullable(),
});

// ─── File (Phase 1b) ───
export const filePathSchema = z.object({
  path: nonEmptyString,
});
