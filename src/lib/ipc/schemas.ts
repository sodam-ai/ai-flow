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
