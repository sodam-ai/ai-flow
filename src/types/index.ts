/**
 * AIFlow 공통 타입 — 13_ZOD_SCHEMAS.md와 동기화
 * Rust 구조체와 1:1 매핑
 */

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  totalTokens: number;
  totalCostUsd: number;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  tokensUsed?: number;
  costUsd?: number;
  modelId?: string;
  isRedacted: boolean;
  createdAt: string;
}

export interface MessagePageResult {
  messages: Message[];
  hasMore: boolean;
}

/** API 키 상태 — Rust ApiKeyStatus와 1:1 계약 (키값 절대 없음) */
export interface ApiKeyStatus {
  providerId: string;
  isSet: boolean;
  maskedPreview?: string;
}

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'mistral'
  | 'groq'
  | 'deepseek'
  | 'cohere'
  | 'xai'
  | 'azure_openai'
  | 'openai_compatible';

/** 페르소나 — Rust Persona 모델과 1:1 */
export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  avatarEmoji: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 프롬프트 라이브러리 항목 — Rust Prompt 모델과 1:1 */
export interface Prompt {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  providerId: ProviderId;
  contextWindow: number;
  inputCostPer1m: number;
  outputCostPer1m: number;
  supportsVision: boolean;
  supportsTools: boolean;
}
