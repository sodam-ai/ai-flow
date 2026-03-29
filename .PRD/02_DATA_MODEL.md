# AIFlow — 데이터 모델 v3.1

> v2.0 대비 신규: RoutingRule, AIPersona, BatchJob, BrowserExtContext, PrivacyLog, LicenseInfo
> v3.0 보안 강화: SQLCipher AES-256 암호화 + keychain_key 참조 패턴 유지
> v3.1 추가: ErrorLog, AuditLog, MessageVersion 엔티티 + RoutingRule 폴백 체인 + 데이터 보존 정책 + 스트림 취소 필드

---

## 전체 구조

```
[Settings] ← 글로벌 앱 설정 (단축키, 라우팅 모드, 테마 등, 데이터 보존 정책)
[LicenseInfo] ← 프로 라이선스 정보 (OS 키체인 저장)

[AIProvider] ──────────────────────────────────────────┐
    ├── API 키: OS 키체인 (keychain_key 참조)            │
    └── 연결: RoutingRule에서 참조                       │
                                                        │
[AIPersona] ─── 시스템 프롬프트 세트 (AIProvider와 독립) │
                                                        │
[Conversation] ──1:N──► [Message] ──────────────────► (provider_id)
                              │
                              ├──► [MessageVersion] (재생성·편집 이력, v3.1)
                              ├──► [FileAttachment] (드래그앤드롭 파일)
                              ├──► [CostLog] (토큰 비용 기록)
                              └──► [PrivacyLog] (PII 마스킹 기록)

[Prompt] ──1:N──► [PromptVersion]

[Workflow] ──1:N──► [WorkflowStep] ──► [AIProvider]
      └──► [WorkflowRun] ──1:N──► [WorkflowStepResult]

[BatchJob] ──1:N──► [BatchItem] (배치 처리 큐)

[MCPServer] ─── MCP 플러그인 서버 목록 (Phase 2)
[Template] ─── 시작 템플릿 (Phase 2)
[RoutingRule] ─── 스마트 라우팅 규칙 (폴백 체인 포함, Phase 2)
[BrowserExtContext] ─── 브라우저 확장 컨텍스트 (Phase 2)

[ErrorLog] ─── 앱 에러·API 실패 이력 (v3.1)
[AuditLog] ─── 보안 이벤트 감사 로그 (v3.1)

[KnowledgeBase] ──1:N──► [KBDocument] (RAG, Phase 3)
```

---

## 엔티티 상세

### AIProvider
연결된 AI 서비스 + 로컬 LLM 정보. API 키는 OS 키체인에 저장, DB엔 참조 키만.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | prov_abc123 | O |
| name | 사용자가 붙인 이름 | "Claude Sonnet" | O |
| provider_type | 제공사 구분 | openai / anthropic / google / ollama / lmstudio | O |
| model | 사용할 모델명 | claude-sonnet-4-6 | O |
| keychain_key | OS 키체인 참조 키 (API 키 자체는 여기 없음) | aiflow.anthropic.key | X |
| base_url | 로컬 LLM 엔드포인트 | http://localhost:11434/v1 | X |
| is_active | 활성화 여부 | true | O |
| supports_vision | 이미지 분석 지원 여부 | true | O |
| supports_streaming | 스트리밍 지원 여부 | true | O |
| price_per_1k_input | 입력 토큰 1000개당 USD | 0.003 | X |
| price_per_1k_output | 출력 토큰 1000개당 USD | 0.015 | X |
| avg_latency_ms | 평균 응답 지연 (라우팅용) | 800 | X |
| routing_priority | 라우팅 우선순위 (낮을수록 먼저 선택) | 1 | O |
| created_at | 등록 날짜 | 2026-03-27 | O |

> **보안 패턴**: API 키는 `tauri-plugin-keyring`으로 OS 키체인 저장. DB SQLCipher AES-256 암호화. DB에는 `keychain_key`만 저장.

### AIPersona
커스텀 AI 역할·말투·전문성 설정 (v3.0 신규).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | persona_001 | O |
| name | 페르소나 이름 | "시니어 TypeScript 개발자" | O |
| system_prompt | 시스템 프롬프트 내용 | "당신은 TypeScript 전문 시니어 개발자입니다..." | O |
| icon | 이모지 아이콘 | 💻 | O |
| default_provider_id | 이 페르소나 기본 AI | prov_abc | X |
| is_built_in | 기본 내장 페르소나 | true | O |
| usage_count | 사용 횟수 | 42 | O |
| created_at | 생성 날짜 | 2026-03-27 | O |

> **기본 내장 페르소나**: 시니어 개발자, 카피라이터, 번역가, 데이터 분석가, 법률 검토자, 요약 전문가

### RoutingRule
스마트 AI 라우팅 규칙 (v3.0 신규, Phase 2).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | route_001 | O |
| name | 규칙 이름 | "비용 절약 모드" | O |
| mode | 라우팅 모드 | cost_optimized / quality_first / balanced / privacy | O |
| complexity_threshold_low | 저복잡도 상한 점수 | 30 | O |
| complexity_threshold_high | 고복잡도 하한 점수 | 70 | O |
| low_complexity_provider_id | 저복잡도용 AI | prov_gemini_flash | O |
| mid_complexity_provider_id | 중복잡도용 AI | prov_gpt4o_mini | O |
| high_complexity_provider_id | 고복잡도용 AI | prov_claude_sonnet | O |
| fallback_provider_id | 폴백 AI | prov_gemini_pro | O |
| privacy_mode_provider_id | 프라이버시 모드 시 사용 (로컬 LLM) | prov_ollama | X |
| is_active | 활성 규칙 여부 | true | O |

### Settings
앱 전역 설정. 레코드 하나(싱글턴 패턴).

| 필드 | 설명 | 기본값 |
|------|------|--------|
| id | 항상 1 | 1 |
| global_hotkey | 글로벌 단축키 | Alt+Space |
| clipboard_hotkey | 클립보드→AI 단축키 | Alt+Shift+A |
| screenshot_hotkey | 스크린샷→AI 단축키 | Alt+Shift+S |
| palette_hotkey | 명령 팔레트 단축키 | Ctrl+K |
| language | 앱 언어 | ko |
| theme | 앱 테마 | dark |
| default_provider_id | 기본 AI Provider | null |
| default_persona_id | 기본 AI 페르소나 | null |
| active_routing_rule_id | 활성 라우팅 규칙 | null |
| show_cost_per_message | 메시지마다 비용 표시 | true |
| cost_currency | 비용 통화 | USD |
| show_krw | 원화 병행 표시 | true |
| tray_on_close | 닫을 때 트레이로 최소화 | true |
| privacy_mode_default | 기본 프라이버시 모드 | false |
| monthly_budget_usd | 월 예산 ($) | null |
| budget_alert_threshold | 예산 알림 임계값 (%) | 80 |
| updated_at | 마지막 설정 변경 | 2026-03-27 |

### LicenseInfo
프로 라이선스 정보 (v3.0 신규). 키 자체는 OS 키체인에 저장.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 항상 1 | 1 | O |
| tier | 라이선스 티어 | free / pro | O |
| license_keychain_key | OS 키체인 참조 키 | aiflow.license.key | X |
| email | 구매 이메일 | user@example.com | X |
| activated_at | 활성화 날짜 | 2026-03-27 | X |
| expires_at | 만료 날짜 (구독형) | 2027-03-27 | X |
| is_offline_valid | 오프라인 검증 완료 여부 | true | O |
| last_verified_at | 마지막 온라인 검증 | 2026-03-27 | X |

### Conversation
하나의 대화 세션.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | conv_xyz789 | O |
| title | 대화 제목 | "계약서 분석" | O |
| provider_ids | 참여 AI 목록 (JSON 배열) | ["prov_a", "prov_b"] | O |
| persona_id | 사용된 페르소나 | persona_001 | X |
| routing_rule_id | 사용된 라우팅 규칙 | route_001 | X |
| is_pinned | 상단 고정 여부 | false | O |
| parent_conv_id | 브랜칭 원본 대화 ID (Phase 3) | null | X |
| created_at | 시작 시각 | 2026-03-27T10:00 | O |
| updated_at | 마지막 메시지 시각 | 2026-03-27T10:30 | O |

### Message
대화 안의 개별 메시지.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | msg_001 | O |
| conversation_id | 속한 대화 | conv_xyz789 | O |
| role | user / ai / system | ai | O |
| content | 메시지 내용 (마크다운) | "계약 4조 2항이..." | O |
| provider_id | AI 응답의 경우 어떤 AI | prov_abc | X |
| was_auto_routed | 스마트 라우팅으로 선택됨 | true | O |
| input_tokens | 입력 토큰 수 | 1240 | X |
| output_tokens | 출력 토큰 수 | 823 | X |
| cost_usd | 이 메시지의 비용 (USD) | 0.0186 | X |
| cost_saved_usd | 라우팅으로 절감된 금액 | 0.012 | X |
| pii_scrubbed | PII 마스킹 적용 여부 | false | O |
| created_at | 전송 시각 | 2026-03-27T10:05 | O |

### PrivacyLog
PII 마스킹 기록 (v3.0 신규).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | priv_001 | O |
| message_id | 연관 메시지 | msg_001 | O |
| pii_count | 감지된 PII 개수 | 5 | O |
| pii_types | 감지된 PII 유형 JSON | ["phone", "ssn", "email"] | O |
| masking_map | 원본→마스킹 매핑 (암호화) | {encrypted JSON} | X |
| created_at | 마스킹 시각 | 2026-03-27T10:04 | O |

> **중요**: masking_map은 SQLCipher로 암호화된 DB 내에 추가로 암호화 저장. 역치환 지원 옵션.

### FileAttachment
메시지에 첨부된 파일.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | att_001 | O |
| message_id | 속한 메시지 | msg_001 | O |
| original_path | 원본 파일 경로 | D:\Documents\contract.pdf | O |
| file_name | 파일명 | contract.pdf | O |
| file_type | 형식 | pdf / txt / code / image | O |
| extracted_text | AI에 전달된 텍스트 (PII 마스킹 후) | "제1조 계약의 목적..." | X |
| file_size_bytes | 파일 크기 | 245760 | O |
| pii_scrubbed | PII 마스킹 여부 | false | O |
| created_at | 첨부 시각 | 2026-03-27T10:04 | O |

### CostLog
일별·모델별 누적 비용 추적.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | cost_001 | O |
| provider_id | 어떤 AI | prov_abc | O |
| date | 날짜 (YYYY-MM-DD) | 2026-03-27 | O |
| total_input_tokens | 하루 입력 토큰 합계 | 45230 | O |
| total_output_tokens | 하루 출력 토큰 합계 | 12840 | O |
| total_cost_usd | 하루 총 비용 (USD) | 0.847 | O |
| total_saved_usd | 라우팅으로 절감된 금액 | 0.312 | O |

### BatchJob
배치 처리 큐 (v3.0 신규).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | batch_001 | O |
| title | 작업 이름 | "영어 번역 배치" | O |
| prompt_template | 반복 적용 프롬프트 | "다음을 영어로 번역해줘: {{content}}" | O |
| provider_id | 사용할 AI | prov_abc | O |
| status | 상태 | pending / running / completed / failed | O |
| total_items | 전체 항목 수 | 50 | O |
| completed_items | 완료된 항목 수 | 23 | O |
| total_cost_usd | 총 비용 | 0.234 | X |
| output_folder | 결과 저장 폴더 | D:\Translations\ | X |
| created_at | 생성 시각 | 2026-03-27 | O |
| completed_at | 완료 시각 | 2026-03-27T11:00 | X |

### BatchItem
배치 처리 항목 하나.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | item_001 | O |
| batch_id | 속한 배치 | batch_001 | O |
| order | 처리 순서 | 1 | O |
| input_content | 입력 내용 또는 파일 경로 | D:\docs\file1.txt | O |
| output_content | 처리 결과 | "The contract states..." | X |
| status | 상태 | pending / processing / done / error | O |
| cost_usd | 이 항목 비용 | 0.0047 | X |
| error_message | 오류 메시지 | null | X |

### BrowserExtContext
브라우저 확장에서 전송된 컨텍스트 (v3.0 신규, Phase 2).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | ext_001 | O |
| url | 원본 URL | https://news.ycombinator.com/... | O |
| title | 페이지 제목 | "AI Trends 2026" | O |
| extracted_text | 추출된 텍스트 | "The article discusses..." | O |
| conversation_id | 이어진 대화 | conv_xyz | X |
| received_at | 수신 시각 | 2026-03-27T10:00 | O |

### Prompt
저장된 프롬프트 템플릿.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | prompt_001 | O |
| title | 프롬프트 이름 | "블로그 초안 작성기" | O |
| content | 프롬프트 본문 (`{{변수}}` 지원) | "{{주제}}에 대해 {{톤}}으로 써줘" | O |
| variables | 변수 목록 (JSON) | ["주제", "톤"] | X |
| tags | 분류 태그 | ["글쓰기", "블로그"] | X |
| category | 카테고리 | 글쓰기 / 코딩 / 번역 / 분석 | X |
| persona_id | 연결된 페르소나 | persona_001 | X |
| usage_count | 사용 횟수 | 42 | O |
| is_favorite | 즐겨찾기 여부 | false | O |
| created_at | 저장 날짜 | 2026-03-27 | O |
| updated_at | 마지막 수정 | 2026-03-28 | O |

### PromptVersion
프롬프트 수정 이력 (Phase 2).

| 필드 | 설명 | 예시 |
|------|------|------|
| id | 고유 식별자 | pv_001 |
| prompt_id | 원본 프롬프트 | prompt_001 |
| version | 버전 번호 | 2 |
| content | 이 버전의 내용 | "이전 버전..." |
| created_at | 버전 생성 날짜 | 2026-03-28 |

### Workflow / WorkflowStep / WorkflowRun / WorkflowStepResult
(v2.0과 동일, Phase 2)

### MCPServer
설치된 MCP 플러그인 서버 (Phase 2).

| 필드 | 설명 | 예시 |
|------|------|------|
| id | 고유 식별자 | mcp_001 |
| name | 서버 이름 | filesystem |
| display_name | 표시 이름 | "로컬 파일 시스템" |
| transport | 통신 방식 | stdio / http |
| command | 실행 명령 | npx @modelcontextprotocol/server-filesystem |
| is_enabled | 활성화 여부 | true |
| allowed_paths | 접근 허용 경로 (보안) | ["D:\\Projects"] |
| installed_at | 설치 날짜 | 2026-03-27 |

### KnowledgeBase / KBDocument (Phase 3)
개인 RAG 지식베이스.

| 엔티티 | 핵심 필드 |
|--------|---------|
| KnowledgeBase | id, name, folder_path, last_indexed_at, doc_count, embedding_model |
| KBDocument | id, kb_id, file_path, content_hash, chunk_count, indexed_at, vector_ids |

---

## 신규 엔티티 (v3.1)

### MessageVersion — 재생성·편집 이력 추적
AI 응답 재생성 또는 사용자 편집 시 이전 버전 보존.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | ver_abc123 | O |
| message_id | 원본 메시지 ID | msg_xyz | O |
| version_number | 버전 번호 (1부터 시작) | 2 | O |
| content | 해당 버전의 내용 | "이전 답변..." | O |
| provider_id | 재생성 시 사용한 AI | prov_openai | — |
| reason | 변경 이유 | regenerate / edit | O |
| input_tokens | 재생성 시 입력 토큰 | 345 | — |
| output_tokens | 재생성 시 출력 토큰 | 512 | — |
| cost_usd | 재생성 비용 | 0.0018 | — |
| created_at | 생성 시각 | ISO 8601 | O |

> **이유**: 재생성 버튼 누를 때마다 비용이 발생하고, 사용자가 "이전 버전이 더 나았는데"를 되돌릴 수 없는 문제 해결. 버전 네비게이터(← →) UI와 연동.

---

### ErrorLog — API 실패·앱 에러 이력
디버깅 및 패턴 분석용. 90일 후 자동 삭제.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | err_abc123 | O |
| error_code | 내부 에러 코드 | ERR_API_429 | O |
| provider_id | 실패한 AI 공급자 | prov_openai | — |
| context | 실패 컨텍스트 (JSON) | `{"prompt_len": 500}` | — |
| raw_error | 원본 에러 메시지 (개발용) | "rate limit exceeded" | — |
| resolved_by | 해결 방식 | fallback / retry / user_cancel | — |
| created_at | 발생 시각 | ISO 8601 | O |

> **이유**: 어떤 AI가 자주 실패하는지, 어느 시간대에 Rate Limit이 걸리는지 패턴 파악. Phase 3 대시보드에 표시.

---

### AuditLog — 보안 이벤트 감사 로그
민감 작업 추적. 조작 불가 (INSERT만, UPDATE/DELETE 금지).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | aud_abc123 | O |
| event_type | 이벤트 유형 | api_key_saved / db_key_rotated / license_verified / data_export / data_wipe | O |
| details | 상세 설명 (민감값 제외) | `{"provider": "openai"}` | — |
| created_at | 발생 시각 | ISO 8601 | O |

> **이유**: API 키 언제 저장했는지, DB 키 로테이션이 실제로 됐는지, 데이터 삭제가 언제 요청됐는지 감사 추적. 개인정보보호법(PIPA) 대응.

---

### RoutingRule 개선 — 단일 폴백 → 폴백 체인 (v3.1)
기존 `fallback_provider_id: TEXT`를 `fallback_chain: TEXT (JSON 배열)`로 교체.

```sql
-- 기존 (v3.0) — 단일 폴백만 가능
fallback_provider_id TEXT REFERENCES ai_providers(id)

-- 변경 (v3.1) — 폴백 체인
fallback_chain TEXT NOT NULL DEFAULT '[]'
-- 예: '["prov_claude", "prov_gemini", "prov_local"]'
-- 첫 번째 폴백 실패 시 두 번째로, 모두 실패 시 에러
```

마이그레이션:
```sql
-- 20260327000013_routing_fallback_chain.sql
ALTER TABLE routing_rules ADD COLUMN fallback_chain TEXT NOT NULL DEFAULT '[]';
-- 기존 fallback_provider_id를 배열로 변환
UPDATE routing_rules SET fallback_chain = json_array(fallback_provider_id)
  WHERE fallback_provider_id IS NOT NULL;
```

---

### Message 필드 추가 (v3.1)
스트림 취소 및 버전 추적 지원.

```sql
-- 20260327000014_message_streaming.sql
ALTER TABLE messages ADD COLUMN stream_cancelled INTEGER DEFAULT 0;
-- 0: 완료, 1: 사용자가 취소한 불완전 응답
ALTER TABLE messages ADD COLUMN current_version INTEGER DEFAULT 1;
-- 현재 표시 중인 MessageVersion.version_number
ALTER TABLE messages ADD COLUMN total_versions INTEGER DEFAULT 1;
-- 총 버전 수 (재생성 횟수 + 1)
```

---

### Settings 필드 추가 (v3.1)
데이터 보존 정책 및 보안 설정.

```sql
-- 20260327000015_settings_retention.sql
ALTER TABLE settings ADD COLUMN retention_conversations_days INTEGER DEFAULT -1;
-- -1: 영구, 양수: N일 후 자동 삭제
ALTER TABLE settings ADD COLUMN retention_cost_log_months INTEGER DEFAULT 12;
ALTER TABLE settings ADD COLUMN retention_privacy_log_days INTEGER DEFAULT 30;
ALTER TABLE settings ADD COLUMN retention_browser_ext_days INTEGER DEFAULT 7;
ALTER TABLE settings ADD COLUMN retention_error_log_days INTEGER DEFAULT 90;
ALTER TABLE settings ADD COLUMN auto_lock_minutes INTEGER DEFAULT 0;
-- 0: 비활성, 양수: N분 비활동 시 DB 재잠금
ALTER TABLE settings ADD COLUMN max_file_size_mb INTEGER DEFAULT 10;
ALTER TABLE settings ADD COLUMN allowed_file_extensions TEXT DEFAULT '["pdf","txt","md","js","ts","py","rs","go","java","c","cpp","h","json","yaml","csv","png","jpg","jpeg","gif","webp"]';
```

---

## 관계 요약

- **AIProvider** ↔ **Message** (어떤 AI가 답했는지) ↔ **RoutingRule** (폴백 체인 포함)
- **AIPersona** → **Conversation** (페르소나 적용) → **Prompt** (페르소나 연결)
- **Conversation** → **Message** → **MessageVersion** + **FileAttachment** + **PrivacyLog** + **CostLog**
- **BatchJob** → **BatchItem** (배치 처리 큐)
- **BrowserExtContext** → **Conversation** (웹 컨텍스트 이어받기)
- **LicenseInfo** ← OS 키체인 (라이선스 키 참조)
- **ErrorLog** ← API 실패·앱 에러 (90일 보존)
- **AuditLog** ← 보안 이벤트 감사 (영구, INSERT 전용)

---

## SQLite 마이그레이션 전략 (Tauri 2.x + SQLCipher)

```
migrations/
  20260327000001_create_core_tables.sql       ← AIProvider, Settings, LicenseInfo
  20260327000002_create_chat_tables.sql       ← Conversation, Message
  20260327000003_create_attachment_tables.sql ← FileAttachment, CostLog
  20260327000004_create_prompt_tables.sql     ← Prompt, PromptVersion
  20260327000005_create_persona_tables.sql    ← AIPersona (v3.0)
  20260327000006_create_privacy_tables.sql    ← PrivacyLog (v3.0)
  20260327000007_create_routing_tables.sql    ← RoutingRule (v3.0, Phase 2)
  20260327000008_create_batch_tables.sql      ← BatchJob, BatchItem (v3.0)
  20260327000009_create_workflow_tables.sql   ← Workflow, WorkflowStep 등 (Phase 2)
  20260327000010_create_mcp_tables.sql        ← MCPServer, Template (Phase 2)
  20260327000011_create_browser_tables.sql    ← BrowserExtContext (Phase 2)
  20260327000012_create_rag_tables.sql        ← KnowledgeBase, KBDocument (Phase 3)
  -- v3.1 신규 마이그레이션 --
  20260327000013_routing_fallback_chain.sql   ← RoutingRule 폴백 체인 (v3.1)
  20260327000014_message_streaming.sql        ← Message 스트림 취소·버전 필드 (v3.1)
  20260327000015_settings_retention.sql       ← Settings 보존 정책 필드 (v3.1)
  20260327000016_create_message_versions.sql  ← MessageVersion 엔티티 (v3.1)
  20260327000017_create_error_log.sql         ← ErrorLog 엔티티 (v3.1)
  20260327000018_create_audit_log.sql         ← AuditLog 엔티티 (v3.1)
```

### 암호화 설정 (v3.1 확정)
```sql
-- 앱 시작 시 첫 번째로 실행 (sqlx 연결 후 즉시)
-- 키 유도: OS 키체인 마스터키 → PBKDF2-SHA512 25만 반복 → 파생 DB 키
PRAGMA key = '<PBKDF2_DERIVED_32BYTE_HEX_KEY>'; -- 절대 마스터키 직접 사용 금지
PRAGMA cipher_page_size = 4096;
PRAGMA kdf_iter = 256000;           -- 브루트포스 방지
PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
PRAGMA cipher_memory_security = ON; -- 메모리 내 키 잔류 방지
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA secure_delete = ON;          -- 삭제된 데이터 즉시 덮어쓰기
```

### DB 백업 전략 (v3.1 신규)
```
백업 위치: $APPDATA\aiflow\backups\aiflow_YYYYMMDD_HHMMSS.db
백업 시점:
  - 마이그레이션 실행 직전 (자동)
  - 사용자 수동 백업 (설정 → 데이터 → 백업 생성)
  - 마스터키 로테이션 직전 (자동)
보관 정책: 최근 5개 백업 유지, 오래된 백업 자동 삭제
```

### 기타 전략
- `tauri-plugin-sql` + `sqlx` 마이그레이션 자동 실행
- WAL 모드 활성화 — 동시 읽기 성능, 크래시 안전
- DB 위치: `$APPDATA\aiflow\aiflow.db`
- **마이그레이션 파일 절대 수정 금지** — 변경 시 새 번호로 추가
- **AuditLog 테이블 trigger 설정**: UPDATE, DELETE 시도 시 Rust 레이어에서 차단 (SQLite trigger 활용)

---

## 왜 이 구조인가

- **이중 보안**: API 키 → OS 키체인 / DB → SQLCipher AES-256 / 개인정보 → 로컬 PII 마스킹
- **스마트 라우팅**: RoutingRule + AIProvider.routing_priority + avg_latency_ms 조합으로 최적 AI 자동 선택
- **비용 추적**: Message.cost_saved_usd + CostLog.total_saved_usd로 라우팅 절감 효과 시각화
- **확장성**: 각 Phase의 테이블이 독립적 → Phase별 추가 시 기존 테이블 변경 불필요
- **오프라인 우선**: 모든 데이터 로컬 SQLite → 인터넷 없어도 히스토리·프롬프트 사용

---

## 확정된 설계 결정사항 (v3.1)

| 항목 | **확정값** |
|------|-----------|
| SQLCipher 키 유도 | OS 키체인 마스터키 → **PBKDF2-SHA512 (25만 반복)** → 32바이트 DB 키. 직접 사용 금지 |
| PrivacyLog 역마스킹 | **지원 안 함** — 마스킹 전용. `masking_map` 필드는 감사용 존재하되 앱에서 역치환 기능 미노출 |
| BatchItem 결과 저장 | **파일시스템 전용** — DB에는 `output_file_path`만 기록. DB 비대화 방지 |
| BrowserExtContext 보관 | **7일 후 자동 삭제** — Settings.retention_browser_ext_days로 조정 가능 |
| LicenseInfo 오프라인 기간 | **30일** — 출장·장기 오프라인 환경 고려 |

---

## Cascade Delete 전략 (v3.1 패치)

### 삭제 연쇄 규칙

```sql
-- 20260327000019_cascade_delete.sql (새 마이그레이션)

-- Conversation 삭제 시 연쇄 삭제
-- (기존 테이블에 FOREIGN KEY 재정의 불가 → trigger로 구현)

CREATE TRIGGER cascade_conversation_delete
BEFORE DELETE ON conversations
BEGIN
  -- Messages (자식) 먼저 삭제
  DELETE FROM message_versions WHERE message_id IN (
    SELECT id FROM messages WHERE conversation_id = OLD.id
  );
  DELETE FROM file_attachments WHERE message_id IN (
    SELECT id FROM messages WHERE conversation_id = OLD.id
  );
  DELETE FROM privacy_log WHERE message_id IN (
    SELECT id FROM messages WHERE conversation_id = OLD.id
  );
  DELETE FROM cost_log WHERE message_id IN (
    SELECT id FROM messages WHERE conversation_id = OLD.id
  );
  DELETE FROM messages WHERE conversation_id = OLD.id;
END;

-- BatchJob 삭제 시 BatchItem 연쇄
CREATE TRIGGER cascade_batchjob_delete
BEFORE DELETE ON batch_jobs
BEGIN
  DELETE FROM batch_items WHERE job_id = OLD.id;
END;

-- Workflow 삭제 시 연쇄
CREATE TRIGGER cascade_workflow_delete
BEFORE DELETE ON workflows
BEGIN
  DELETE FROM workflow_step_results WHERE run_id IN (
    SELECT id FROM workflow_runs WHERE workflow_id = OLD.id
  );
  DELETE FROM workflow_runs WHERE workflow_id = OLD.id;
  DELETE FROM workflow_steps WHERE workflow_id = OLD.id;
END;

-- AIProvider 삭제 시 고아 참조 처리 (삭제 금지 → NULL로 변경)
-- Message.provider_id, CostLog.provider_id 등
CREATE TRIGGER nullify_provider_delete
BEFORE DELETE ON ai_providers
BEGIN
  UPDATE messages SET provider_id = NULL WHERE provider_id = OLD.id;
  UPDATE cost_log SET provider_id = NULL WHERE provider_id = OLD.id;
  UPDATE error_log SET provider_id = NULL WHERE provider_id = OLD.id;
END;
```

### 삭제 정책 원칙

| 관계 | 삭제 방식 | 이유 |
|------|---------|------|
| Conversation → Message | CASCADE | 대화 삭제 시 메시지 불필요 |
| Message → FileAttachment | CASCADE | 파일 참조 유효성 보장 |
| Message → MessageVersion | CASCADE | 원본 없는 버전 의미 없음 |
| Message → PrivacyLog | CASCADE | 마스킹 기록은 원본에 종속 |
| Message → CostLog | CASCADE | 비용은 메시지에 종속 |
| AIProvider → Message | SET NULL | 제공자 삭제 후 이력 보존 |
| AIProvider → RoutingRule | RESTRICT | 규칙 있으면 제공자 삭제 금지 |
| BatchJob → BatchItem | CASCADE | 작업 삭제 시 항목도 삭제 |

---

## DB 인덱스 전략 (v3.1 패치)

### 핵심 인덱스 목록

```sql
-- 20260327000020_performance_indexes.sql

-- 1. 대화 목록 조회 (메인 화면 — 최근 대화 정렬)
CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);

-- 2. 특정 대화의 메시지 조회 (페이지네이션 — Phase 1 핵심)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

-- 3. 스트리밍 취소된 메시지 조회 (부분 응답 정리)
CREATE INDEX IF NOT EXISTS idx_messages_cancelled
  ON messages(stream_cancelled) WHERE stream_cancelled = 1;

-- 4. 메시지 버전 조회 (재생성 이력 — 자주 접근)
CREATE INDEX IF NOT EXISTS idx_message_versions_message
  ON message_versions(message_id, version_number ASC);

-- 5. 비용 로그 — 제공자별, 날짜별 집계
CREATE INDEX IF NOT EXISTS idx_cost_log_provider_date
  ON cost_log(provider_id, created_at DESC);

-- 6. 프라이버시 로그 — 보존 정책 삭제 (날짜 기준 DELETE)
CREATE INDEX IF NOT EXISTS idx_privacy_log_created
  ON privacy_log(created_at ASC);

-- 7. 에러 로그 — 최근 에러 + 보존 삭제
CREATE INDEX IF NOT EXISTS idx_error_log_created
  ON error_log(created_at DESC);

-- 8. 감사 로그 — 날짜 범위 조회 (내보내기)
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);

-- 9. 배치 항목 — 상태별 조회 (pending/processing/done)
CREATE INDEX IF NOT EXISTS idx_batch_items_job_status
  ON batch_items(job_id, status);

-- 10. 프롬프트 검색 — 자주 사용 + 즐겨찾기
CREATE INDEX IF NOT EXISTS idx_prompts_usage
  ON prompts(use_count DESC, is_favorite DESC);

-- 11. AI 제공자 — 라우팅 우선순위 정렬
CREATE INDEX IF NOT EXISTS idx_providers_routing
  ON ai_providers(routing_priority ASC, avg_latency_ms ASC)
  WHERE is_active = 1;

-- 12. BrowserExtContext — 보존 삭제 + URL 조회
CREATE INDEX IF NOT EXISTS idx_browser_ext_received
  ON browser_ext_contexts(received_at ASC);
CREATE INDEX IF NOT EXISTS idx_browser_ext_url
  ON browser_ext_contexts(url);
```

### 쿼리 성능 목표

| 쿼리 | 목표 응답시간 | 인덱스 |
|------|------------|--------|
| 최근 대화 20개 목록 | < 5ms | idx_conversations_updated |
| 대화 내 메시지 50개 (페이지) | < 10ms | idx_messages_conversation_created |
| 에러 로그 90일 삭제 | < 50ms | idx_error_log_created |
| 비용 합계 집계 (30일) | < 20ms | idx_cost_log_provider_date |

### 인덱스 모니터링

```sql
-- 개발 시 쿼리 플랜 확인
EXPLAIN QUERY PLAN
SELECT * FROM messages
WHERE conversation_id = 1
ORDER BY created_at ASC
LIMIT 50 OFFSET 0;
-- → SCAN messages USING INDEX idx_messages_conversation_created 확인
```
