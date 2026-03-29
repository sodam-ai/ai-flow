# AIFlow — IPC Zod 스키마 명세 v1.0

> 생성: 2026-03-28
> **이 문서의 스키마는 04_PROJECT_SPEC.md의 `invokeValidated()`와 반드시 함께 사용**
> Tauri IPC 경계에서 런타임 타입 안전성을 보장하는 유일한 진실 원천(SSOT)

---

## 개요

### 왜 Zod인가?

```
TypeScript 타입 → 컴파일 타임만 보호 (런타임 X)
Zod 스키마    → 컴파일 + 런타임 모두 보호

invoke('send_message', { args }) 호출 시:
  → Rust 사이드에서 타입 불일치 → panic 또는 에러 직렬화 실패
  → Zod로 프론트에서 먼저 검증 → 명확한 에러 메시지
```

### 기본 패턴

```typescript
// src/lib/ipc.ts
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

export async function invokeValidated<TInput, TOutput>(
  command: string,
  inputSchema: z.ZodType<TInput>,
  outputSchema: z.ZodType<TOutput>,
  args: TInput
): Promise<TOutput> {
  // 1. 입력값 검증
  const validatedInput = inputSchema.parse(args);

  // 2. Tauri invoke
  const raw = await invoke(command, { args: validatedInput });

  // 3. 출력값 검증
  return outputSchema.parse(raw);
}
```

---

## 공통 기본 타입 스키마

```typescript
// src/lib/schemas/common.ts
import { z } from 'zod';

// UUID
export const UuidSchema = z.string().uuid();

// 타임스탬프 (ISO 8601)
export const TimestampSchema = z.string().datetime();

// AI Provider
export const ProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'local_llm',
]);

// 모델 ID (각 provider별 유효 모델)
export const ModelIdSchema = z.string().min(1).max(100);

// 파일 경로 (Windows 경로 허용)
export const FilePathSchema = z.string().min(1).max(260);

// 비용 (USD, 소수점 8자리)
export const CostUsdSchema = z.number().nonnegative().multipleOf(0.00000001);

// 토큰 수
export const TokenCountSchema = z.number().int().nonnegative().max(2_000_000);

// 페이지네이션
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// 언어 코드
export const LangSchema = z.enum(['ko', 'en', 'ja', 'zh']);

// 에러 응답
export const ErrorResponseSchema = z.object({
  code: z.string(),          // 예: "AI_001"
  message: z.string(),       // 사용자 표시용 메시지
  detail: z.string().optional(), // 개발자용 상세
});
```

---

## Phase 1 IPC 스키마

### 1. AI 메시지 전송 — `stream_ai_message`

```typescript
// src/lib/schemas/ai.ts
import { z } from 'zod';
import { UuidSchema, ProviderSchema, ModelIdSchema, FilePathSchema } from './common';

// 첨부 파일
export const AttachmentSchema = z.object({
  path: FilePathSchema,
  mime_type: z.string().max(100),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024), // 최대 10MB
});

// AI 메시지 전송 입력
export const StreamAiMessageInputSchema = z.object({
  conversation_id: UuidSchema,
  content: z.string()
    .min(1, '메시지를 입력하세요')
    .max(100_000, '메시지가 너무 깁니다 (최대 100,000자)'),
  provider: ProviderSchema,
  model_id: ModelIdSchema,
  attachments: z.array(AttachmentSchema).max(5, '첨부 파일은 최대 5개').default([]),
  persona_id: UuidSchema.nullable().default(null),
  privacy_mode: z.boolean().default(false),
  stream_id: UuidSchema, // 취소 시 사용
});

export type StreamAiMessageInput = z.infer<typeof StreamAiMessageInputSchema>;

// 스트림 청크 (ipc::Channel을 통해 순차 수신)
export const StreamChunkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    content: z.string(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('done'),
    message_id: UuidSchema,
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cost_usd: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
]);

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// 스트림 취소 입력
export const CancelStreamInputSchema = z.object({
  stream_id: UuidSchema,
});

export type CancelStreamInput = z.infer<typeof CancelStreamInputSchema>;
```

**사용 예시:**
```typescript
// src/features/chat/hooks/useAiStream.ts
import { invokeValidated } from '@/lib/ipc';
import { StreamAiMessageInputSchema, CancelStreamInputSchema } from '@/lib/schemas/ai';
import { z } from 'zod';

const streamId = crypto.randomUUID();

await invokeValidated(
  'stream_ai_message',
  StreamAiMessageInputSchema,
  z.void(),
  {
    conversation_id: currentConversationId,
    content: userMessage,
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-6',
    attachments: [],
    persona_id: null,
    privacy_mode: false,
    stream_id: streamId,
  }
);

// 중지 버튼 클릭 시
await invokeValidated('cancel_stream', CancelStreamInputSchema, z.void(), {
  stream_id: streamId,
});
```

---

### 2. 대화 관리 — `conversations`

```typescript
// src/lib/schemas/conversation.ts
import { z } from 'zod';
import { UuidSchema, TimestampSchema, ProviderSchema, ModelIdSchema, PaginationSchema } from './common';

// 대화 생성 입력
export const CreateConversationInputSchema = z.object({
  title: z.string()
    .min(1, '제목을 입력하세요')
    .max(200, '제목이 너무 깁니다')
    .trim(),
  provider: ProviderSchema,
  model_id: ModelIdSchema,
  persona_id: UuidSchema.nullable().default(null),
  privacy_mode: z.boolean().default(false),
});

export type CreateConversationInput = z.infer<typeof CreateConversationInputSchema>;

// 대화 목록 조회 입력
export const ListConversationsInputSchema = PaginationSchema.extend({
  search: z.string().max(200).optional(),
  provider: ProviderSchema.optional(),
  privacy_mode: z.boolean().optional(),
  date_from: TimestampSchema.optional(),
  date_to: TimestampSchema.optional(),
});

export type ListConversationsInput = z.infer<typeof ListConversationsInputSchema>;

// 대화 응답
export const ConversationSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  provider: ProviderSchema,
  model_id: ModelIdSchema,
  persona_id: UuidSchema.nullable(),
  privacy_mode: z.boolean(),
  message_count: z.number().int().nonnegative(),
  total_cost_usd: z.number().nonnegative(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type Conversation = z.infer<typeof ConversationSchema>;

// 대화 목록 응답
export const ConversationListSchema = z.object({
  items: z.array(ConversationSchema),
  total: z.number().int().nonnegative(),
  has_more: z.boolean(),
});

// 대화 업데이트 입력
export const UpdateConversationInputSchema = z.object({
  id: UuidSchema,
  title: z.string().min(1).max(200).trim().optional(),
  persona_id: UuidSchema.nullable().optional(),
  pinned: z.boolean().optional(),
});

export type UpdateConversationInput = z.infer<typeof UpdateConversationInputSchema>;

// 대화 삭제 입력
export const DeleteConversationInputSchema = z.object({
  id: UuidSchema,
  permanent: z.boolean().default(false), // false = 휴지통, true = 영구 삭제
});
```

---

### 3. 메시지 조회 — `messages`

```typescript
// src/lib/schemas/message.ts
import { z } from 'zod';
import { UuidSchema, TimestampSchema, ProviderSchema, ModelIdSchema, PaginationSchema, TokenCountSchema, CostUsdSchema } from './common';

// 메시지 역할
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

// 메시지 목록 조회 입력
export const ListMessagesInputSchema = PaginationSchema.extend({
  conversation_id: UuidSchema,
  before_id: UuidSchema.optional(), // 커서 기반 페이지네이션
});

export type ListMessagesInput = z.infer<typeof ListMessagesInputSchema>;

// 메시지 응답
export const MessageSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  role: MessageRoleSchema,
  content: z.string(),
  provider: ProviderSchema.nullable(),
  model_id: ModelIdSchema.nullable(),
  input_tokens: TokenCountSchema.nullable(),
  output_tokens: TokenCountSchema.nullable(),
  cost_usd: CostUsdSchema.nullable(),
  is_masked: z.boolean(),
  created_at: TimestampSchema,
});

export type Message = z.infer<typeof MessageSchema>;

// 메시지 목록 응답
export const MessageListSchema = z.object({
  items: z.array(MessageSchema),
  total: z.number().int().nonnegative(),
  has_more: z.boolean(),
  next_cursor: UuidSchema.nullable(),
});

// 메시지 재생성 입력
export const RegenerateMessageInputSchema = z.object({
  message_id: UuidSchema,
  provider: ProviderSchema.optional(), // 다른 provider로 재생성 가능
  model_id: ModelIdSchema.optional(),
  stream_id: UuidSchema,
});
```

---

### 4. API 키 관리 — `api_keys`

```typescript
// src/lib/schemas/api-key.ts
import { z } from 'zod';
import { ProviderSchema, UuidSchema, TimestampSchema } from './common';

// API 키 저장 입력 (OS 키체인)
export const SaveApiKeyInputSchema = z.object({
  provider: ProviderSchema,
  api_key: z.string()
    .min(10, 'API 키가 너무 짧습니다')
    .max(200, 'API 키가 너무 깁니다')
    .regex(/^[a-zA-Z0-9\-_]+$/, '유효하지 않은 API 키 형식'),
  // 검증 후 키체인에 저장 — 절대 DB에 저장 안 됨
});

export type SaveApiKeyInput = z.infer<typeof SaveApiKeyInputSchema>;

// API 키 존재 여부 응답 (실제 키값 절대 반환 안 함)
export const ApiKeyStatusSchema = z.object({
  provider: ProviderSchema,
  exists: z.boolean(),
  masked_key: z.string().nullable(), // 예: "sk-...abc123" (끝 6자리만)
  validated_at: TimestampSchema.nullable(),
});

export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

// API 키 검증 입력
export const ValidateApiKeyInputSchema = z.object({
  provider: ProviderSchema,
  // 키체인에서 직접 읽어 검증 — 키값은 프론트에서 전달 안 함
});

// API 키 삭제 입력
export const DeleteApiKeyInputSchema = z.object({
  provider: ProviderSchema,
  delete_related_data: z.boolean().default(false),
});

// 전체 키 삭제 (긴급 삭제)
export const DeleteAllApiKeysInputSchema = z.object({
  confirm: z.literal(true), // 실수 방지: 반드시 true여야 함
});
```

---

### 5. 프롬프트 저장고 — `prompts`

```typescript
// src/lib/schemas/prompt.ts
import { z } from 'zod';
import { UuidSchema, TimestampSchema, ProviderSchema } from './common';

// 프롬프트 태그
export const TagSchema = z.string().min(1).max(50).regex(/^[a-zA-Z가-힣0-9\-_\s]+$/);

// 프롬프트 생성 입력
export const CreatePromptInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(50_000),
  tags: z.array(TagSchema).max(10).default([]),
  is_favorite: z.boolean().default(false),
  target_providers: z.array(ProviderSchema).default([]),
  variables: z.array(z.object({
    name: z.string().min(1).max(50),
    default_value: z.string().max(500).default(''),
    description: z.string().max(200).default(''),
  })).max(20).default([]),
});

export type CreatePromptInput = z.infer<typeof CreatePromptInputSchema>;

// 프롬프트 응답
export const PromptSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  content: z.string(),
  tags: z.array(TagSchema),
  is_favorite: z.boolean(),
  use_count: z.number().int().nonnegative(),
  target_providers: z.array(ProviderSchema),
  variables: z.array(z.object({
    name: z.string(),
    default_value: z.string(),
    description: z.string(),
  })),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

export type Prompt = z.infer<typeof PromptSchema>;

// 프롬프트 검색 입력
export const SearchPromptsInputSchema = z.object({
  query: z.string().max(200).optional(),
  tags: z.array(TagSchema).optional(),
  provider: ProviderSchema.optional(),
  favorites_only: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
```

---

### 6. AI 페르소나 — `personas`

```typescript
// src/lib/schemas/persona.ts
import { z } from 'zod';
import { UuidSchema, TimestampSchema, ProviderSchema } from './common';

// 페르소나 생성 입력
export const CreatePersonaInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).default(''),
  system_prompt: z.string().min(10).max(10_000),
  avatar_emoji: z.string().max(10).default('🤖'),
  preferred_provider: ProviderSchema.nullable().default(null),
  preferred_model: z.string().max(100).nullable().default(null),
  temperature: z.number().min(0).max(2).multipleOf(0.1).default(0.7),
  max_tokens: z.number().int().min(1).max(128_000).nullable().default(null),
  is_default: z.boolean().default(false),
});

export type CreatePersonaInput = z.infer<typeof CreatePersonaInputSchema>;

// 페르소나 응답
export const PersonaSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  avatar_emoji: z.string(),
  preferred_provider: ProviderSchema.nullable(),
  preferred_model: z.string().nullable(),
  temperature: z.number(),
  max_tokens: z.number().nullable(),
  is_default: z.boolean(),
  is_builtin: z.boolean(),
  created_at: TimestampSchema,
});

export type Persona = z.infer<typeof PersonaSchema>;
```

---

### 7. 설정 관리 — `settings`

```typescript
// src/lib/schemas/settings.ts
import { z } from 'zod';
import { LangSchema, ProviderSchema } from './common';

// 전체 설정 스키마
export const AppSettingsSchema = z.object({
  // 일반
  language: LangSchema.default('ko'),
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  launch_at_startup: z.boolean().default(false),
  minimize_to_tray: z.boolean().default(true),

  // 단축키
  shortcut_overlay: z.string().min(1).max(50).default('Alt+Space'),
  shortcut_clipboard: z.string().min(1).max(50).default('Alt+Shift+A'),
  shortcut_command_palette: z.string().min(1).max(50).default('Ctrl+K'),

  // AI
  default_provider: ProviderSchema.default('openai'),
  default_model: z.string().max(100).default('gpt-4o'),
  streaming_enabled: z.boolean().default(true),
  auto_title_generation: z.boolean().default(true),

  // 비용
  currency_display: z.enum(['usd', 'krw', 'both']).default('both'),
  cost_alert_threshold_usd: z.number().nonnegative().nullable().default(null),
  exchange_rate_fallback: z.number().positive().default(1380),

  // 프라이버시
  privacy_mode_default: z.boolean().default(false),
  pii_detection_enabled: z.boolean().default(true),
  pii_sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  save_history: z.boolean().default(true),
  history_retention_days: z.number().int().min(1).max(3650).default(365),

  // 성능
  message_page_size: z.number().int().min(20).max(200).default(50),
  stream_buffer_ms: z.number().int().min(16).max(500).default(16),

  // 보안
  auto_lock_minutes: z.number().int().min(0).max(1440).default(0), // 0 = 비활성화
  allowed_file_extensions: z.array(z.string().max(10)).default([
    'pdf', 'txt', 'md', 'ts', 'js', 'py', 'rs', 'go',
    'java', 'cpp', 'c', 'h', 'json', 'yaml', 'toml',
    'png', 'jpg', 'jpeg', 'webp', 'gif',
  ]),
  max_file_size_mb: z.number().int().min(1).max(50).default(10),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

// 설정 업데이트 (부분 업데이트)
export const UpdateSettingsInputSchema = AppSettingsSchema.partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;
```

---

### 8. 비용 추적 — `costs`

```typescript
// src/lib/schemas/cost.ts
import { z } from 'zod';
import { UuidSchema, TimestampSchema, ProviderSchema, ModelIdSchema, CostUsdSchema, TokenCountSchema } from './common';

// 비용 조회 입력
export const GetCostSummaryInputSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('month'),
  provider: ProviderSchema.optional(),
  group_by: z.enum(['provider', 'model', 'day']).default('provider'),
});

export type GetCostSummaryInput = z.infer<typeof GetCostSummaryInputSchema>;

// 비용 항목
export const CostItemSchema = z.object({
  id: UuidSchema,
  conversation_id: UuidSchema,
  message_id: UuidSchema,
  provider: ProviderSchema,
  model_id: ModelIdSchema,
  input_tokens: TokenCountSchema,
  output_tokens: TokenCountSchema,
  cost_usd: CostUsdSchema,
  cost_krw: z.number().nonnegative().nullable(),
  exchange_rate: z.number().positive().nullable(),
  created_at: TimestampSchema,
});

// 비용 요약 응답
export const CostSummarySchema = z.object({
  total_usd: CostUsdSchema,
  total_krw: z.number().nonnegative().nullable(),
  total_input_tokens: TokenCountSchema,
  total_output_tokens: TokenCountSchema,
  by_group: z.array(z.object({
    label: z.string(),
    cost_usd: CostUsdSchema,
    percentage: z.number().min(0).max(100),
    message_count: z.number().int().nonnegative(),
  })),
  period_start: TimestampSchema,
  period_end: TimestampSchema,
});

export type CostSummary = z.infer<typeof CostSummarySchema>;
```

---

### 9. 파일 처리 — `files`

```typescript
// src/lib/schemas/file.ts
import { z } from 'zod';
import { UuidSchema, FilePathSchema } from './common';

// 파일 드롭 입력 (드래그앤드롭)
export const ProcessDroppedFileInputSchema = z.object({
  path: FilePathSchema,
  conversation_id: UuidSchema,
});

export type ProcessDroppedFileInput = z.infer<typeof ProcessDroppedFileInputSchema>;

// 파일 처리 결과
export const FileProcessResultSchema = z.object({
  attachment_id: UuidSchema,
  original_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
  extracted_text: z.string().nullable(),    // PDF/텍스트 추출 내용
  thumbnail_path: FilePathSchema.nullable(), // 이미지 썸네일
  is_image: z.boolean(),
  is_too_large: z.boolean(),
  error: z.string().nullable(),
});

export type FileProcessResult = z.infer<typeof FileProcessResultSchema>;
```

---

### 10. 환율 — `exchange_rate`

```typescript
// src/lib/schemas/exchange-rate.ts
import { z } from 'zod';
import { TimestampSchema } from './common';

// 환율 조회 응답
export const ExchangeRateSchema = z.object({
  usd_to_krw: z.number().positive(),
  source: z.enum(['api', 'cache', 'fallback']),
  fetched_at: TimestampSchema.nullable(),
  next_refresh_at: TimestampSchema.nullable(),
});

export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;
```

---

## IPC 명령어 전체 목록

| 명령어 | 입력 스키마 | 출력 스키마 | Phase |
|--------|------------|------------|-------|
| `stream_ai_message` | `StreamAiMessageInputSchema` | `z.void()` (채널 스트림) | 1 |
| `cancel_stream` | `CancelStreamInputSchema` | `z.void()` | 1 |
| `create_conversation` | `CreateConversationInputSchema` | `ConversationSchema` | 1 |
| `list_conversations` | `ListConversationsInputSchema` | `ConversationListSchema` | 1 |
| `get_conversation` | `z.object({ id: UuidSchema })` | `ConversationSchema` | 1 |
| `update_conversation` | `UpdateConversationInputSchema` | `ConversationSchema` | 1 |
| `delete_conversation` | `DeleteConversationInputSchema` | `z.void()` | 1 |
| `list_messages` | `ListMessagesInputSchema` | `MessageListSchema` | 1 |
| `regenerate_message` | `RegenerateMessageInputSchema` | `z.void()` | 1 |
| `save_api_key` | `SaveApiKeyInputSchema` | `z.void()` | 1 |
| `get_api_key_status` | `z.object({ provider: ProviderSchema })` | `ApiKeyStatusSchema` | 1 |
| `validate_api_key` | `ValidateApiKeyInputSchema` | `z.object({ valid: z.boolean(), error: z.string().nullable() })` | 1 |
| `delete_api_key` | `DeleteApiKeyInputSchema` | `z.void()` | 1 |
| `delete_all_api_keys` | `DeleteAllApiKeysInputSchema` | `z.void()` | 1 |
| `create_prompt` | `CreatePromptInputSchema` | `PromptSchema` | 1 |
| `list_prompts` | `SearchPromptsInputSchema` | `z.array(PromptSchema)` | 1 |
| `update_prompt` | `z.object({ id: UuidSchema }).merge(CreatePromptInputSchema.partial())` | `PromptSchema` | 1 |
| `delete_prompt` | `z.object({ id: UuidSchema })` | `z.void()` | 1 |
| `list_personas` | `z.void()` | `z.array(PersonaSchema)` | 1 |
| `create_persona` | `CreatePersonaInputSchema` | `PersonaSchema` | 1 |
| `update_persona` | `z.object({ id: UuidSchema }).merge(CreatePersonaInputSchema.partial())` | `PersonaSchema` | 1 |
| `delete_persona` | `z.object({ id: UuidSchema })` | `z.void()` | 1 |
| `get_settings` | `z.void()` | `AppSettingsSchema` | 1 |
| `update_settings` | `UpdateSettingsInputSchema` | `AppSettingsSchema` | 1 |
| `get_cost_summary` | `GetCostSummaryInputSchema` | `CostSummarySchema` | 1 |
| `process_dropped_file` | `ProcessDroppedFileInputSchema` | `FileProcessResultSchema` | 1 |
| `get_exchange_rate` | `z.void()` | `ExchangeRateSchema` | 1 |
| `check_shortcut_conflict` | `z.object({ shortcut: z.string() })` | `z.object({ conflict: z.boolean(), conflicting_app: z.string().nullable() })` | 1 |
| `export_data` | `z.object({ format: z.enum(['json', 'csv', 'markdown']), path: FilePathSchema })` | `z.void()` | 1 |
| `import_data` | `z.object({ path: FilePathSchema })` | `z.object({ imported: z.number() })` | 1 |

---

## 보안 검증 규칙

### 입력 새니타이징

```typescript
// src/lib/schemas/security.ts
import { z } from 'zod';

// XSS 방지: HTML 태그 금지 문자열
export const SafeStringSchema = z.string().transform(
  (val) => val.replace(/<[^>]*>/g, '').trim()
);

// 경로 트래버설 방지
export const SafeFilePathSchema = z.string()
  .refine((path) => !path.includes('..'), {
    message: '경로에 ".."을 포함할 수 없습니다',
  })
  .refine((path) => !path.startsWith('/'), {
    message: '절대 경로는 허용되지 않습니다',
  });

// API 키 형식 검증 (provider별)
export const OpenAIKeySchema = z.string()
  .regex(/^sk-[a-zA-Z0-9\-_]{20,}$/, '올바른 OpenAI API 키 형식이 아닙니다');

export const AnthropicKeySchema = z.string()
  .regex(/^sk-ant-[a-zA-Z0-9\-_]{20,}$/, '올바른 Anthropic API 키 형식이 아닙니다');

export const GoogleKeySchema = z.string()
  .regex(/^AIza[a-zA-Z0-9\-_]{35,}$/, '올바른 Google API 키 형식이 아닙니다');

// Provider별 API 키 스키마 선택
export function getApiKeySchema(provider: string) {
  switch (provider) {
    case 'openai':    return OpenAIKeySchema;
    case 'anthropic': return AnthropicKeySchema;
    case 'google':    return GoogleKeySchema;
    default:          return z.string().min(10).max(200);
  }
}
```

---

## 에러 처리 패턴

```typescript
// src/lib/ipc.ts — 완전한 구현
import { invoke } from '@tauri-apps/api/core';
import { z, ZodError } from 'zod';
import { ErrorResponseSchema } from './schemas/common';

export class IpcValidationError extends Error {
  constructor(
    public readonly command: string,
    public readonly phase: 'input' | 'output',
    public readonly zodError: ZodError
  ) {
    super(`IPC 검증 실패 [${command}/${phase}]: ${zodError.message}`);
  }
}

export class IpcCommandError extends Error {
  constructor(
    public readonly command: string,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function invokeValidated<TInput, TOutput>(
  command: string,
  inputSchema: z.ZodType<TInput>,
  outputSchema: z.ZodType<TOutput>,
  args?: TInput
): Promise<TOutput> {
  // 1. 입력 검증
  let validatedArgs: TInput | undefined;
  if (args !== undefined && inputSchema) {
    const result = inputSchema.safeParse(args);
    if (!result.success) {
      throw new IpcValidationError(command, 'input', result.error);
    }
    validatedArgs = result.data;
  }

  // 2. invoke
  let raw: unknown;
  try {
    raw = await invoke(command, validatedArgs ? { args: validatedArgs } : {});
  } catch (err) {
    // Rust에서 반환된 에러 파싱 시도
    const parsed = ErrorResponseSchema.safeParse(err);
    if (parsed.success) {
      throw new IpcCommandError(command, parsed.data.code, parsed.data.message);
    }
    throw new IpcCommandError(command, 'UNKNOWN', String(err));
  }

  // 3. 출력 검증
  const outResult = outputSchema.safeParse(raw);
  if (!outResult.success) {
    throw new IpcValidationError(command, 'output', outResult.error);
  }

  return outResult.data;
}
```

---

## 파일 구조

```
src/
└── lib/
    ├── ipc.ts                    # invokeValidated() 핵심 구현
    └── schemas/
        ├── common.ts             # 공통 기본 타입
        ├── ai.ts                 # AI 스트리밍, 취소
        ├── conversation.ts       # 대화 관리
        ├── message.ts            # 메시지 조회
        ├── api-key.ts            # API 키 관리
        ├── prompt.ts             # 프롬프트 저장고
        ├── persona.ts            # AI 페르소나
        ├── settings.ts           # 앱 설정
        ├── cost.ts               # 비용 추적
        ├── file.ts               # 파일 처리
        ├── exchange-rate.ts      # 환율
        └── security.ts           # 보안 검증 규칙
```

---

> **관련 문서**
> - [04_PROJECT_SPEC.md](./.PRD/04_PROJECT_SPEC.md) — `invokeValidated()` 구현, reqwest 연결풀
> - [05_SECURITY_SPEC.md](./.PRD/05_SECURITY_SPEC.md) — API 키 보안, PII 마스킹
> - [14_ERROR_CATALOG.md](./.PRD/14_ERROR_CATALOG.md) — 에러 코드 → 한국어 메시지
