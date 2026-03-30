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
export const streamAiMessageSchema = z.object({
  conversationId: uuid,
  content: z.string().min(1).max(100_000),
  providerId: nonEmptyString,
  modelId: nonEmptyString,
  streamId: uuid,
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
