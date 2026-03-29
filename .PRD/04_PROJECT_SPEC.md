# AIFlow — 프로젝트 스펙 v4.0

> v3.6 패치: CRITICAL 보안 3개 수정 + 4계층 아키텍처 + 멀티 윈도우 통신 + rusqlite 통일
> v4.0 업그레이드: Windows 빌드 전제조건 + Provider Trait 추상화 + i18n + PDF 크레이트 + 업데이터 Phase 1b + 단축키 통일
> AI가 코드를 짤 때 이 문서를 반드시 함께 제공하세요.

---

## Windows 빌드 전제조건 (v4.0 신규)

> SQLCipher(bundled-sqlcipher)를 사용하려면 Windows에서 C 컴파일 환경이 필요합니다.

### 필수 설치
1. **Rust toolchain**: `rustup default stable` (MSVC target)
2. **Visual Studio Build Tools**: C/C++ 빌드 도구 (workload: "Desktop development with C++")
3. **Strawberry Perl**: `choco install strawberryperl -y` (SQLCipher 빌드에 필요)
4. **Node.js 20+**: `choco install nodejs-lts -y`

### CI 환경 (GitHub Actions)
```yaml
- name: Install Strawberry Perl (SQLCipher 빌드 필수)
  run: choco install strawberryperl -y
```

### Cargo.toml 필수 feature
```toml
rusqlite = { version = "0.32", features = ["bundled-sqlcipher"] }
```

> ⚠️ `bundled` (SQLCipher 없음)를 사용하면 DB 암호화가 비활성화됨.
> PRD의 보안 요구사항(05_SECURITY_SPEC, 15_THREAT_MODEL)이 모두 SQLCipher를 전제함.

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | React 19 + TypeScript | 컴포넌트 기반, 타입 안전, shadcn/ui 호환 |
| 데스크톱 래퍼 | Tauri 2.10+ (Rust) | 가볍고 빠름 (~5MB 바이너리), 로컬 파일 안전 접근 |
| 빌드 도구 | Vite 6 | 빠른 HMR, Tauri 공식 템플릿 기본 |
| 스타일링 | Tailwind CSS v4 + shadcn/ui | 빠른 UI 구성, 다크모드 기본 |
| 로컬 DB | SQLite + **SQLCipher** (rusqlite + bundled-sqlcipher) | AES-256 암호화 + WAL 모드 |
| DB 마이그레이션 | `rusqlite_migration` crate | SQLCipher(`bundled-sqlcipher`)와 완전 호환 — sqlx는 SQLCipher 지원 불안정하여 **사용 금지** |
| API 키 보안 | `tauri-plugin-keyring` (OS 키체인) | Windows Credential Manager — DB에 평문 절대 없음 |
| DB 암호화 키 | OS 키체인 → PBKDF2 유도 | 마스터 키 안전 저장, DB 키는 유도 |
| 상태 관리 | Zustand | 가볍고 Tauri 호환, React Query 병행 |
| AI 스트리밍 | Tauri `ipc::Channel` | 고처리량 토큰 스트리밍, EventSystem보다 안정적 |
| AI HTTP 호출 | Rust `reqwest` (Tauri command) | 브라우저 CORS 우회, API 키 노출 방지 |
| PII 감지 | `openredaction` (npm) | 570+ 패턴, 100% 로컬, 인터넷 없이 동작 |
| 스마트 라우팅 | Rust 순수 구현 | LiteLLM 참고, 복잡도 점수 기반 |
| 결제 | LemonSqueezy API + 토스페이먼츠 | 글로벌 + 한국 시장 동시 커버 |
| 아이콘 | Lucide React | shadcn/ui 기본 아이콘 |
| i18n | `react-i18next` (v4.0 신규) | Phase 1a부터 한국어+영어 2개 언어. 나중에 추가하면 전면 리팩토링 |
| PDF 파싱 | `pdf-extract` (Rust) (v4.0 신규) | 가벼움(+1MB). 한국어 깨짐 시 `pdfium-render`로 폴백 |
| 자동 업데이터 | `tauri-plugin-updater` (v4.0: Phase 1b로 이동) | Ed25519 서명 검증, 다운그레이드 방지 |

### Tauri Capability 최소 권한 (v4.1 신규)

> `src-tauri/capabilities/default.json`에 **필요한 권한만** 명시한다.
> XSS가 발생해도 IPC를 통해 접근할 수 있는 기능을 최소화하는 것이 목적.

**Phase 1 필수 권한만 허용**:
- `global-shortcut:allow-register`, `global-shortcut:allow-unregister`
- `clipboard-manager:allow-read-text`
- `fs:allow-read` (사용자가 드롭한 파일만, 범위 제한)
- `notification:allow-notify`
- `store:allow-get`, `store:allow-set`
- **금지**: `fs:allow-write` (Phase 1에서 파일시스템 쓰기 불필요 — 내보내기는 Rust 명령어에서 직접 처리)

> 새 권한 추가 시 `15_THREAT_MODEL.md` 신뢰 경계 1 검토 필수.

---

### 핵심 Tauri 플러그인 목록 (Phase별)

| 플러그인 | Phase | 용도 |
|---------|-------|------|
| `tauri-plugin-global-shortcut` | 1 | 어디서나 AIFlow 소환 단축키 |
| `tauri-plugin-keyring` (community) | 1 | OS 키체인 API 키 + DB 암호화 키 저장 |
| `tauri-plugin-clipboard-manager` | 1 | 클립보드 읽기/쓰기 |
| `tauri-plugin-fs` | 1 | 파일 드래그앤드롭 처리 |
| `tauri-plugin-notification` | 1 | 작업 완료 시스템 알림 |
| `tauri-plugin-store` | 1 | 키-값 영구 저장 (비암호화 설정값) |
| `tauri-plugin-deep-link` | 2 | aiflow:// URL 스킴 (결제 콜백) |
| `tauri-plugin-stronghold` | 3 | 고급 암호화 볼트 (Phase 3) |
| `tauri-plugin-updater` | **1b** (v4.0: Phase 3에서 이동) | 앱 자동 업데이트 + Ed25519 서명 검증 |

```bash
# Phase 1 플러그인 설치
npm run tauri add global-shortcut
npm run tauri add clipboard-manager
npm run tauri add fs
npm run tauri add notification
npm run tauri add store

# tauri-plugin-keyring은 community 플러그인 — 수동 추가
# Cargo.toml: tauri-plugin-keyring = "2"

# SQLCipher: tauri-plugin-sql 대신 rusqlite 직접 사용
# Cargo.toml에 추가:
# rusqlite = { version = "0.32", features = ["bundled-sqlcipher"] }
```

---

## 프로젝트 구조

```
aiflow/
├── src/                          # React 프론트엔드
│   ├── app/                      # 페이지별 컴포넌트
│   │   ├── overlay/              # 글로벌 단축키 오버레이 창
│   │   ├── chat/                 # 멀티 AI 채팅 허브
│   │   ├── prompts/              # 프롬프트 저장고
│   │   ├── personas/             # AI 페르소나 관리 (v3.0)
│   │   ├── batch/                # 배치 처리 큐 (v3.0)
│   │   ├── workflows/            # 워크플로우 빌더 (Phase 2)
│   │   ├── mcp/                  # MCP 마켓플레이스 (Phase 2)
│   │   ├── routing/              # 스마트 라우팅 설정 (Phase 2)
│   │   └── settings/             # AI Provider 설정
│   ├── components/               # 재사용 가능한 UI
│   │   ├── ui/                   # shadcn/ui 컴포넌트
│   │   ├── chat/                 # 채팅 관련 컴포넌트
│   │   ├── palette/              # 명령 팔레트 (Ctrl+K) (v3.0)
│   │   ├── privacy/              # PII 마스킹 UI (v3.0)
│   │   └── shared/               # 공용 컴포넌트
│   ├── lib/                      # 유틸리티 + 서비스
│   │   ├── db.ts                 # SQLite 쿼리 함수
│   │   ├── ai/                   # AI 호출 로직
│   │   │   ├── stream.ts         # ipc::Channel 스트리밍
│   │   │   ├── cost.ts           # 토큰 비용 계산 (USD + KRW)
│   │   │   ├── providers.ts      # Provider별 설정
│   │   │   └── routing.ts        # 스마트 라우팅 클라이언트 (Phase 2)
│   │   ├── privacy/              # 프라이버시 모드 (v3.0)
│   │   │   ├── pii-detector.ts   # OpenRedaction 래퍼
│   │   │   └── masking.ts        # PII 마스킹 UI 로직
│   │   ├── persona.ts            # AI 페르소나 관리 (v3.0)
│   │   ├── batch.ts              # 배치 처리 큐 클라이언트 (v3.0)
│   │   ├── palette.ts            # 명령 팔레트 로직 (v3.0)
│   │   ├── keychain.ts           # OS 키체인 읽기/쓰기
│   │   ├── shortcuts.ts          # 글로벌 단축키 관리
│   │   └── store.ts              # Zustand 전역 상태
│   └── types/                    # TypeScript 타입
│       └── index.ts
├── src-tauri/                    # Rust 백엔드
│   ├── src/
│   │   ├── main.rs               # 진입점
│   │   ├── db/                   # SQLCipher DB 관리 (v3.0)
│   │   │   ├── mod.rs            # DB 연결 + 암호화 초기화
│   │   │   └── migrations.rs     # 마이그레이션 실행
│   │   ├── commands/             # Tauri commands
│   │   │   ├── ai.rs             # AI API 호출 (스트리밍)
│   │   │   ├── keychain.rs       # OS 키체인 R/W
│   │   │   ├── files.rs          # 파일 처리 (PDF 파싱)
│   │   │   ├── routing.rs        # 스마트 라우팅 엔진 (Phase 2)
│   │   │   ├── batch.rs          # 배치 처리 큐 (v3.0)
│   │   │   ├── license.rs        # 라이선스 검증 (Phase 2)
│   │   │   └── browser_ext.rs    # 브라우저 확장 IPC (Phase 2)
│   │   └── tray.rs               # 시스템 트레이
│   ├── migrations/               # SQLite 마이그레이션 SQL
│   │   ├── 20260327000001_core.sql
│   │   ├── 20260327000002_chat.sql
│   │   ├── 20260327000003_attachments.sql
│   │   ├── 20260327000004_prompts.sql
│   │   ├── 20260327000005_personas.sql
│   │   ├── 20260327000006_privacy.sql
│   │   └── ...
│   ├── native-host/              # Chrome Native Messaging 호스트 (Phase 2)
│   │   └── main.rs
│   └── tauri.conf.json           # Tauri 설정
├── browser-extension/            # Chrome/Edge 확장 (Phase 2)
│   ├── manifest.json
│   ├── popup.html
│   ├── content.js
│   └── background.js
├── public/                       # 정적 파일 (아이콘)
└── package.json
```

---

## Rust 백엔드 레이어 아키텍처 (v3.6 확정)

> AI가 코드를 짤 때 반드시 이 4계층 구조를 지킬 것. commands가 DB를 직접 호출하면 절대 안 됨.

```
┌─────────────────────────────────────────────────────┐
│  Tauri IPC 경계                                      │
│  commands/  — IPC 진입점 (얇은 어댑터 레이어)          │
│   ├── ai.rs         → services::ai_client           │
│   ├── keychain.rs   → services::keychain            │
│   ├── chat.rs       → services::chat                │
│   ├── files.rs      → services::file_extractor      │
│   ├── prompts.rs    → services::prompt              │
│   └── personas.rs   → services::persona             │
│  역할: 입력 검증(Zod 상응) + 에러 변환만. 비즈니스 로직 절대 없음  │
├─────────────────────────────────────────────────────┤
│  services/  — 비즈니스 로직 레이어                      │
│   ├── ai_client.rs    (reqwest 싱글톤, 스트리밍)        │
│   ├── chat.rs         (대화/메시지 CRUD 로직)           │
│   ├── keychain.rs     (키체인 + 폴백 전략)              │
│   ├── cost.rs         (토큰 비용 계산)                  │
│   ├── exchange_rate.rs (환율 캐시)                    │
│   ├── file_extractor.rs (PDF/이미지 파싱)              │
│   ├── persona.rs      (페르소나 관리)                   │
│   ├── prompt.rs       (프롬프트 저장고)                 │
│   └── audit.rs        (감사 로그 기록)                  │
│  역할: 순수 비즈니스 로직. DB는 models 레이어를 통해서만 접근  │
│  ★ v4.0: ai_client.rs는 AiProvider trait 기반 추상화 필수     │
├─────────────────────────────────────────────────────┤
│  models/  — 데이터 구조체 레이어                         │
│   ├── conversation.rs  (Conversation, Message 구조체) │
│   ├── provider.rs      (Provider, ApiKeyStatus)      │
│   ├── persona.rs       (Persona 구조체)               │
│   └── prompt.rs        (Prompt 구조체)                │
│  역할: serde Serialize/Deserialize 구조체만. 로직 없음    │
├─────────────────────────────────────────────────────┤
│  db/  — 데이터 접근 레이어                               │
│   ├── mod.rs       (커넥션 풀 초기화, SQLCipher 설정)    │
│   ├── pool.rs      (r2d2 읽기 풀 4개 + mpsc writer 1개)│
│   └── migrations.rs (rusqlite_migration 실행기)        │
│  역할: SQL 실행만. 비즈니스 로직 절대 없음                  │
└─────────────────────────────────────────────────────┘
```

### Tauri AppState 통합 구조체 (반드시 이 형태로 사용)
```rust
// src-tauri/src/lib.rs
pub struct AppState {
    pub db: Arc<Database>,           // db::pool::Database (읽기풀 + writer)
    pub http_client: Arc<Client>,    // reqwest 싱글톤 (services::ai_client::get_http_client())
    pub streams: Arc<StreamRegistry>, // 진행 중인 스트림 취소 토큰 맵
    pub audit: Arc<AuditService>,    // 감사 로그 서비스
}
```

### Provider Trait 추상화 (v4.0 신규 필수 요구사항)

> 모든 AI 프로바이더는 `AiProvider` trait를 구현해야 한다. 새 프로바이더 추가 시 `ai_client.rs` 본체 수정 없이 trait 구현체 1개만 추가.

```rust
// src-tauri/src/services/provider_trait.rs — 설계 요구사항 (구현은 아닌 PRD 수준)
pub trait AiProvider: Send + Sync {
    /// 프로바이더 식별자 (예: "openai", "anthropic")
    fn id(&self) -> &str;

    /// 인증 헤더 생성 — 프로바이더마다 다름 (Bearer, x-api-key, query param 등)
    fn auth_headers(&self, api_key: &str) -> Vec<(String, String)>;

    /// API 요청 URL 생성
    fn chat_endpoint(&self, model_id: &str) -> String;

    /// 요청 본문 구조 (프로바이더마다 포맷 다름)
    fn build_request_body(&self, messages: &[Message], model_id: &str, system_prompt: Option<&str>) -> serde_json::Value;

    /// SSE 스트림 청크 파싱 (Anthropic: event+data, OpenAI: data만, Google: 다름)
    fn parse_stream_chunk(&self, chunk: &str) -> Option<StreamToken>;

    /// 지원 모델 카탈로그 + 가격 정보
    fn model_catalog(&self) -> Vec<ModelInfo>;
}
```

**적용 이유**: 이전 v1 구현에서 11개 프로바이더 추가 시 `ai_client.rs`를 "완전 재작성"해야 했음. Trait 추상화로 확장 비용을 0으로 낮춤.

---

### DB 동시성 전략 (WAL 모드 최적화)
```rust
// db/pool.rs — 읽기/쓰기 분리 (SQLite WAL 특성 활용)
pub struct Database {
    // 읽기 전용: r2d2 커넥션 풀 (최대 4개, 동시 병렬 읽기 가능)
    read_pool: r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>,
    // 쓰기 전용: 단일 writer + mpsc 채널 (직렬화로 write 충돌 방지)
    write_tx: tokio::sync::mpsc::Sender<WriteCommand>,
}
// ⚠️ rusqlite::Connection은 Sync가 아님 — Arc<Mutex<Connection>> 단독 사용 금지
// 반드시 r2d2 풀 또는 위 패턴 사용
```

---

## 핵심 구현 패턴

### 1. SQLCipher DB 초기화 (v3.0 신규)
```rust
// src-tauri/src/db/mod.rs
use rusqlite::{Connection, params};
use tauri_plugin_keyring::KeyringExt;

pub fn init_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("aiflow.db");

    let conn = Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    // OS 키체인에서 DB 암호화 마스터 키 가져오기
    let master_key = app.keyring()
        .get_password("aiflow", "db_master_key")
        .unwrap_or_else(|_| {
            // 최초 실행 시 새 키 생성 후 저장
            let new_key = generate_random_key();
            app.keyring()
                .set_password("aiflow", "db_master_key", &new_key)
                .unwrap();
            new_key
        });

    // SQLCipher 암호화 설정 (연결 직후 즉시 실행)
    // ⚠️ SECURITY: format!()으로 키를 SQL 문자열에 삽입하면 Zeroizing 보호 우회됨
    // 반드시 pragma_update() 바인딩 방식 사용 — 키가 메모리 상 평문 문자열로 잔류하지 않음
    conn.pragma_update(None, "key", master_key.as_str())
        .map_err(|e| format!("DB 암호화 키 설정 실패: {}", e))?;
    conn.execute_batch(
        "PRAGMA cipher_page_size = 4096;
         PRAGMA kdf_iter = 256000;
         PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
         PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;"
    ).map_err(|e| e.to_string())?;

    // 키 즉시 제로화
    drop(master_key);

    Ok(conn)
}
```

### 2. AI 스트리밍 (ipc::Channel 필수)
```rust
// src-tauri/src/commands/ai.rs
#[tauri::command]
async fn stream_ai(
    prompt: String,
    provider_id: String,
    persona_system_prompt: Option<String>,  // v3.0: 페르소나 시스템 프롬프트
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<(), String> {
    // reqwest로 AI API 스트리밍 요청
    // 페르소나 시스템 프롬프트 prepend (있을 경우)
    // chunk마다 channel.send(json!({ "token": "..." }))
    // 완료 시 channel.send(json!({ "done": true, "cost": 0.0023, "saved": 0.012 }))
}
```

```ts
// src/lib/ai/stream.ts
const channel = new Channel<{ token?: string; done?: boolean; cost?: number; saved?: number }>();
channel.onmessage = (msg) => {
  if (msg.done) onComplete(msg.cost, msg.saved);  // saved: 라우팅 절감액
  else appendToken(msg.token!);
};
await invoke('stream_ai', { prompt, providerId, personaSystemPrompt, channel });
```

### 3. OS 키체인 API 키 저장 (평문 절대 금지)
```rust
// src-tauri/src/commands/keychain.rs
use tauri_plugin_keyring::KeyringExt;

#[tauri::command]
async fn save_api_key(app: tauri::AppHandle, provider: String, key: String) -> Result<(), String> {
    app.keyring()
        .set_password("aiflow", &provider, &key)
        .map_err(|e| e.to_string())
}

// ⚠️ SECURITY: get_api_key는 외부 IPC 커맨드로 절대 노출 금지
// API 키 평문이 WebView JS 메모리에 올라가면 DevTools·XSS 공격 대상이 됨
// 프론트엔드용으로는 get_api_key_status (마스킹 상태만)만 사용할 것
//
// get_api_key_status: 마스킹된 키 상태만 반환 (예: "sk-••••••••1234")
#[tauri::command]
pub async fn get_api_key_status(
    app: tauri::AppHandle,
    provider: String,
) -> Result<ApiKeyStatus, String> {
    match app.keyring().get_password("aiflow", &provider) {
        Ok(key) => {
            let masked = mask_api_key(&key);
            Ok(ApiKeyStatus { is_set: true, masked_preview: Some(masked) })
        }
        Err(_) => Ok(ApiKeyStatus { is_set: false, masked_preview: None }),
    }
}

#[derive(serde::Serialize)]
pub struct ApiKeyStatus {
    pub is_set: bool,
    pub masked_preview: Option<String>, // 예: "sk-••••••••1234"
}

fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "••••••••".to_string();
    }
    let prefix = &key[..4];
    let suffix = &key[key.len()-4..];
    format!("{}••••••••{}", prefix, suffix)
}

// 실제 API 키는 Rust 내부에서만 사용 — get_api_key_safe() 직접 호출
// (keychain.rs의 get_api_key_safe는 Tauri command로 등록하지 않음)
```

### 4. 스마트 AI 라우팅 엔진 (v3.0 신규, Phase 2)
```rust
// src-tauri/src/commands/routing.rs
#[derive(Debug)]
pub struct RoutingResult {
    pub selected_provider_id: String,
    pub complexity_score: u8,
    pub reason: String,
}

#[tauri::command]
pub async fn route_ai(
    prompt: String,
    has_file: bool,
    has_code: bool,
    routing_rule: RoutingRule,
) -> Result<RoutingResult, String> {
    let score = calc_complexity(&prompt, has_file, has_code);

    let (provider_id, reason) = match score {
        0..=30 => (routing_rule.low_complexity_provider_id, "저복잡도 — 비용 최적 모델"),
        31..=70 => (routing_rule.mid_complexity_provider_id, "중복잡도 — 균형 모델"),
        71..=100 => (routing_rule.high_complexity_provider_id, "고복잡도 — 최고 품질 모델"),
        _ => unreachable!(),
    };

    Ok(RoutingResult {
        selected_provider_id: provider_id,
        complexity_score: score,
        reason: reason.to_string(),
    })
}

fn calc_complexity(prompt: &str, has_file: bool, has_code: bool) -> u8 {
    let mut score: u8 = 0;
    let len = prompt.len();
    if len > 50  { score = score.saturating_add(10); }
    if len > 200 { score = score.saturating_add(20); }
    if len > 500 { score = score.saturating_add(20); }
    if has_file  { score = score.saturating_add(20); }
    if has_code  { score = score.saturating_add(20); }
    let keywords = ["분석", "비교", "설명", "추론", "왜", "어떻게", "review", "analyze"];
    for kw in &keywords {
        if prompt.contains(kw) { score = score.saturating_add(5); }
    }
    score.min(100)
}
```

### 5. PII 감지 + 마스킹 (v3.0 신규)
```ts
// src/lib/privacy/pii-detector.ts
import { invoke } from '@tauri-apps/api/core';

// OpenRedaction: npm install openredaction
import { RedactionEngine } from 'openredaction';

const engine = new RedactionEngine({
  locale: 'ko-KR',   // 한국 특화 패턴 활성화
  patterns: ['all'], // 570+ 패턴 전체 사용
});

export interface PiiDetectionResult {
  original: string;
  masked: string;
  detectedItems: Array<{
    type: string;
    value: string;
    masked: string;
    index: number;
  }>;
}

export async function detectAndMask(text: string): Promise<PiiDetectionResult> {
  const result = engine.redact(text);
  return {
    original: text,
    masked: result.redactedText,
    detectedItems: result.entities.map(e => ({
      type: e.entityType,
      value: e.value,
      masked: e.redactedValue,
      index: e.startIndex,
    })),
  };
}
```

### 6. AI 페르소나 시스템 (v3.0 신규)
```ts
// src/lib/persona.ts
export interface AIPersona {
  id: string;
  name: string;
  icon: string;
  systemPrompt: string;
  defaultProviderId?: string;
}

export const BUILT_IN_PERSONAS: AIPersona[] = [
  {
    id: 'dev',
    name: '시니어 개발자',
    icon: '💻',
    systemPrompt: '당신은 TypeScript/React/Rust 전문 시니어 개발자입니다. 코드는 반드시 예시를 포함하고, 한국어로 답변하세요. 보안과 성능을 항상 고려하세요.',
  },
  {
    id: 'writer',
    name: '카피라이터',
    icon: '✍️',
    systemPrompt: '당신은 한국 마케팅 전문 카피라이터입니다. 간결하고 임팩트 있는 문장을 작성하며, 독자의 감정을 자극하는 표현을 사용하세요.',
  },
  {
    id: 'translator',
    name: '전문 번역가',
    icon: '🌐',
    systemPrompt: '당신은 한국어↔영어 전문 번역가입니다. 자연스럽고 문화적으로 적절한 번역을 제공하며, 기술 용어는 정확하게 처리하세요.',
  },
  {
    id: 'analyst',
    name: '데이터 분석가',
    icon: '📊',
    systemPrompt: '당신은 데이터 분석 전문가입니다. 수치를 기반으로 인사이트를 제공하고, 차트나 표로 정리하며, 핵심 결론을 먼저 제시하세요.',
  },
  {
    id: 'legal',
    name: '법률 검토자',
    icon: '⚖️',
    systemPrompt: '당신은 한국 법률 전문가입니다. 계약서·약관·법령을 분석하고 위험 조항을 식별하며, 법적 조언이 아닌 참고 정보를 제공한다고 명시하세요.',
  },
  {
    id: 'summarizer',
    name: '핵심 요약가',
    icon: '📝',
    systemPrompt: '당신은 요약 전문가입니다. 핵심 내용만 불릿 포인트 3~5개로 정리하고, 결론을 먼저 제시하며, 불필요한 설명은 생략하세요.',
  },
];
```

### 7. AI 명령 팔레트 (v3.0 신규)
```ts
// src/lib/palette.ts
export interface PaletteCommand {
  id: string;
  label: string;
  keywords: string[];
  action: () => void;
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { id: 'new-chat', label: '새 대화 시작', keywords: ['new', '새로운', '새 대화', '시작'], action: () => {} },
  { id: 'save-prompt', label: '현재 프롬프트 저장', keywords: ['save', '저장', '프롬프트'], action: () => {} },
  { id: 'open-settings', label: '설정 열기', keywords: ['settings', '설정', 'config'], action: () => {} },
  { id: 'toggle-theme', label: '다크/라이트 모드 전환', keywords: ['theme', '테마', 'dark', '다크'], action: () => {} },
  { id: 'clear-history', label: '대화 기록 초기화', keywords: ['clear', '초기화', '지우기', 'reset'], action: () => {} },
  { id: 'batch-process', label: '배치 처리 시작', keywords: ['batch', '배치', '대량', '자동'], action: () => {} },
  { id: 'privacy-mode', label: '프라이버시 모드 ON/OFF', keywords: ['privacy', '프라이버시', 'pii', '개인정보'], action: () => {} },
];

export function searchCommands(query: string): PaletteCommand[] {
  const q = query.toLowerCase();
  return PALETTE_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(q) ||
    cmd.keywords.some(kw => kw.includes(q))
  );
}
```

### 8. 배치 처리 큐 (v3.0 신규)
```rust
// src-tauri/src/commands/batch.rs
use tokio::sync::mpsc;
use std::sync::Arc;

#[tauri::command]
pub async fn start_batch(
    app: tauri::AppHandle,
    batch_id: String,
    prompt_template: String,
    provider_id: String,
    items: Vec<BatchInputItem>,
    channel: tauri::ipc::Channel<serde_json::Value>,
) -> Result<(), String> {
    let (tx, mut rx) = mpsc::channel(10);

    // 배치 아이템을 순서대로 처리
    tokio::spawn(async move {
        for (i, item) in items.iter().enumerate() {
            let prompt = prompt_template.replace("{{content}}", &item.content);
            // AI API 호출 + 결과 저장
            // channel.send(json!({ "progress": i+1, "total": items.len(), "result": "..." }))
        }
        // channel.send(json!({ "done": true, "total_cost": 0.234 }))
    });

    Ok(())
}
```

### 9. 파일 드래그앤드롭
```ts
// src/lib/files.ts
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const win = getCurrentWebviewWindow();
win.onDragDropEvent(async (event) => {
  if (event.payload.type === 'drop') {
    for (const path of event.payload.paths) {
      const content = await invoke<string>('extract_file_content', { path });
      // content를 AI 메시지에 첨부
    }
  }
});
```

### 10. 글로벌 단축키 (v3.1 확정 기본값)
```ts
// src/lib/shortcuts.ts
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

// 확정된 기본값 (01_PRD.md §11 참조)
// Alt+Space: 오버레이 (Win11 이모지 패널 Ctrl+Shift+Space 충돌 회피)
export const DEFAULT_HOTKEYS = {
  overlay: 'Alt+Space',
  clipboard: 'Alt+Shift+A',
  screenshot: 'Alt+Shift+S',
  palette: 'CommandOrControl+K',
} as const;

export async function registerHotkeys(settings: HotkeySettings) {
  const keys = [
    { key: settings.global_hotkey ?? DEFAULT_HOTKEYS.overlay, handler: showOverlay },
    { key: settings.clipboard_hotkey ?? DEFAULT_HOTKEYS.clipboard, handler: sendClipboardToAI },
    { key: settings.screenshot_hotkey ?? DEFAULT_HOTKEYS.screenshot, handler: captureScreenshot },
    { key: settings.palette_hotkey ?? DEFAULT_HOTKEYS.palette, handler: showCommandPalette },
  ];

  for (const { key, handler } of keys) {
    // 충돌 감지: 이미 등록된 키면 사용자에게 경고
    const already = await isRegistered(key);
    if (already) {
      await emitHotkeyConflict(key); // ERR_HOTKEY_CONFLICT 에러 처리
      continue;
    }
    await register(key, handler);
  }
}

// 앱 종료 시 반드시 호출
export async function unregisterAllHotkeys(settings: HotkeySettings) {
  const keys = [
    settings.global_hotkey ?? DEFAULT_HOTKEYS.overlay,
    settings.clipboard_hotkey ?? DEFAULT_HOTKEYS.clipboard,
    settings.screenshot_hotkey ?? DEFAULT_HOTKEYS.screenshot,
    settings.palette_hotkey ?? DEFAULT_HOTKEYS.palette,
  ];
  for (const key of keys) {
    try { await unregister(key); } catch { /* 이미 해제됨 */ }
  }
}
```

### 11. SQLite WAL 모드 (마이그레이션 예시 — 기존 유지)

### 12. SQLite WAL 모드 (마이그레이션 예시)
```sql
-- migrations/20260327000001_core.sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  model TEXT NOT NULL,
  keychain_key TEXT,
  base_url TEXT,
  is_active INTEGER DEFAULT 1,
  supports_vision INTEGER DEFAULT 0,
  price_per_1k_input REAL,
  price_per_1k_output REAL,
  avg_latency_ms INTEGER,
  routing_priority INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🤖',
  system_prompt TEXT NOT NULL,
  default_provider_id TEXT REFERENCES ai_providers(id),
  is_built_in INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  global_hotkey TEXT DEFAULT 'CommandOrControl+Shift+Space',
  clipboard_hotkey TEXT DEFAULT 'CommandOrControl+Shift+A',
  screenshot_hotkey TEXT DEFAULT 'CommandOrControl+Shift+S',
  palette_hotkey TEXT DEFAULT 'CommandOrControl+K',
  theme TEXT DEFAULT 'dark',
  default_provider_id TEXT,
  default_persona_id TEXT,
  show_cost_per_message INTEGER DEFAULT 1,
  show_krw INTEGER DEFAULT 1,
  tray_on_close INTEGER DEFAULT 1,
  privacy_mode_default INTEGER DEFAULT 0,
  monthly_budget_usd REAL,
  budget_alert_threshold INTEGER DEFAULT 80,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 멀티 윈도우 통신 전략 (v3.6 확정)

AIFlow는 overlay window와 main window 두 개의 독립 Tauri window를 사용합니다.
window 간 통신은 Tauri event system으로 처리합니다.

### ipc::Channel vs Tauri Event 사용 기준

| 사용 상황 | 방식 | 이유 |
|----------|------|------|
| AI 스트리밍 토큰 전달 | `ipc::Channel` | 고빈도(16ms tick) — 성능 우선 |
| 배치 처리 진행률 | `ipc::Channel` | 고빈도 연속 데이터 |
| 시스템 상태 알림 | Tauri `emit()` | 저빈도 이벤트 — 유연성 우선 |
| window 간 통신 | Tauri `emit_to(label)` | window label 지정 필수 |

### 표준 이벤트 목록 (Tauri emit — Phase 1 필수)

```rust
// src-tauri/src/events.rs — 이벤트 상수 (문자열 타이핑 오류 방지)
pub const EVT_NETWORK_STATUS: &str = "aiflow://network-status-changed";
pub const EVT_HOTKEY_CONFLICT: &str = "aiflow://hotkey-conflict";
pub const EVT_OVERLAY_TOGGLE: &str = "aiflow://overlay-toggle";
pub const EVT_DB_READY: &str = "aiflow://db-migration-completed";
pub const EVT_BUDGET_WARNING: &str = "aiflow://budget-warning"; // Phase 2

// 사용 예: overlay window에서 main window로 토글 신호
app.emit_to("main", EVT_OVERLAY_TOGGLE, json!({ "open": true }))?;

// 모든 window에 브로드캐스트
app.emit(EVT_NETWORK_STATUS, json!({ "online": false }))?;
```

```ts
// src/lib/events.ts — 프론트엔드 이벤트 구독
import { listen } from '@tauri-apps/api/event';

export const EVENTS = {
  NETWORK_STATUS: 'aiflow://network-status-changed',
  HOTKEY_CONFLICT: 'aiflow://hotkey-conflict',
  OVERLAY_TOGGLE: 'aiflow://overlay-toggle',
  DB_READY: 'aiflow://db-migration-completed',
} as const;

// 구독 예
const unlisten = await listen<{ online: boolean }>(EVENTS.NETWORK_STATUS, (e) => {
  useUiStore.getState().setOnline(e.payload.online);
});
// 컴포넌트 언마운트 시 반드시 unlisten() 호출
```

### Zustand — window별 독립 인스턴스 (공유 금지)

```
overlay window Zustand ─┐   (독립)
main window Zustand ────┘   (독립)
window 간 상태 공유 → Tauri event로만
```

---

## 핵심 구현 패턴 — v3.1 신규 (보안·안전성 강화)

### A. AI 스트리밍 취소 (v3.1)
```rust
// src-tauri/src/commands/ai.rs
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

// 전역 취소 토큰 (Tauri State로 관리)
pub struct StreamState {
    pub cancel_flag: Arc<AtomicBool>,
}

#[tauri::command]
pub async fn stream_ai(
    prompt: String,
    provider_id: String,
    persona_system_prompt: Option<String>,
    channel: tauri::ipc::Channel<serde_json::Value>,
    state: tauri::State<'_, StreamState>,
) -> Result<(), String> {
    // 이전 스트림 취소 후 새 스트림 시작
    state.cancel_flag.store(false, Ordering::Relaxed);

    // ... reqwest 스트리밍 루프
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        // 취소 요청 확인
        if state.cancel_flag.load(Ordering::Relaxed) {
            let _ = channel.send(serde_json::json!({
                "done": true,
                "cancelled": true,
            }));
            return Ok(());
        }
        let _ = channel.send(serde_json::json!({ "token": chunk_text, "done": false }));
    }

    let _ = channel.send(serde_json::json!({ "done": true, "cancelled": false }));
    Ok(())
}

#[tauri::command]
pub async fn cancel_stream(state: tauri::State<'_, StreamState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}
```

```ts
// 프론트엔드: 취소 버튼
import { invoke } from '@tauri-apps/api/core';

export async function cancelStream() {
  await invoke('cancel_stream');
}
```

---

### B. Zod IPC 입력 검증 (v3.1)
```ts
// src/lib/ipc/validators.ts
// 모든 Tauri invoke 호출 전 반드시 Zod 스키마로 검증
import { z } from 'zod';

export const StreamAiInputSchema = z.object({
  prompt: z.string().min(1).max(100_000), // 최대 100K자
  providerId: z.string().uuid(),
  personaSystemPrompt: z.string().max(10_000).optional(),
  conversationId: z.string().uuid(),
});

export const SaveApiKeyInputSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama', 'lmstudio']),
  key: z.string().min(1).max(500),
});

export const FileDropInputSchema = z.object({
  paths: z.array(z.string()).max(20), // 한 번에 최대 20개
});

// 사용 예시
export async function invokeStreamAi(input: unknown) {
  const validated = StreamAiInputSchema.parse(input); // 실패 시 ZodError throw
  return invoke('stream_ai', validated);
}
```

> **이유**: JS 프론트엔드에서 Rust 백엔드로 넘어오는 값을 타입 이상의 구조 검증. 악성 프롬프트 길이 제한, 파일 수 제한 등 IPC 경계 보안.

---

### C. 메시지 페이지네이션 (v3.1)
```ts
// src/lib/db/messages.ts
// 가상 스크롤과 연동 — 한 번에 50개씩 로드

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  oldestId: string | null;
}

export async function loadMessages(
  conversationId: string,
  beforeId?: string,  // 이 ID보다 오래된 메시지 로드 (무한 스크롤 위)
  limit = 50,
): Promise<MessagePage> {
  const messages = await invoke<Message[]>('get_messages_paginated', {
    conversationId,
    beforeId: beforeId ?? null,
    limit: limit + 1, // +1로 hasMore 판별
  });

  const hasMore = messages.length > limit;
  return {
    messages: hasMore ? messages.slice(0, limit) : messages,
    hasMore,
    oldestId: messages[0]?.id ?? null,
  };
}
```

```rust
// src-tauri/src/commands/chat.rs
#[tauri::command]
pub async fn get_messages_paginated(
    conversation_id: String,
    before_id: Option<String>,
    limit: i64,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<Message>, String> {
    let conn = db.lock().await;
    match before_id {
        Some(id) => conn.prepare_cached(
            "SELECT * FROM messages WHERE conversation_id = ?1
             AND created_at < (SELECT created_at FROM messages WHERE id = ?2)
             ORDER BY created_at DESC LIMIT ?3"
        )?.query_map(rusqlite::params![conversation_id, id, limit], Message::from_row),
        None => conn.prepare_cached(
            "SELECT * FROM messages WHERE conversation_id = ?1
             ORDER BY created_at DESC LIMIT ?2"
        )?.query_map(rusqlite::params![conversation_id, limit], Message::from_row),
    }.map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
```

---

### D. DB 마이그레이션 전 자동 백업 (v3.1)
```rust
// src-tauri/src/db/backup.rs
use std::path::PathBuf;
use chrono::Local;

pub fn backup_before_migration(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let db_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("aiflow.db");

    let backup_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");

    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let backup_path = backup_dir.join(format!("aiflow_{}.db", timestamp));

    std::fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;

    // 최근 5개만 보존, 오래된 백업 자동 삭제
    cleanup_old_backups(&backup_dir, 5)?;

    Ok(backup_path)
}

fn cleanup_old_backups(dir: &PathBuf, keep: usize) -> Result<(), String> {
    let mut backups: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "db"))
        .collect();

    backups.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());

    for old in backups.iter().rev().skip(keep) {
        let _ = std::fs::remove_file(old.path());
    }
    Ok(())
}
```

---

### E. 마스터키 로테이션 (v3.1)
```rust
// src-tauri/src/commands/security.rs
#[tauri::command]
pub async fn rotate_master_key(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    // 1. 백업 먼저
    backup_before_migration(&app)?;

    // 2. 새 마스터키 생성
    let new_master_key = generate_random_key_hex(32);

    // 3. SQLCipher PRAGMA rekey (메모리 내 재암호화)
    let conn = db.lock().await;
    conn.execute_batch(&format!(
        "PRAGMA rekey = '{}';", new_master_key
    )).map_err(|e| e.to_string())?;

    // 4. OS 키체인에 새 키 저장
    app.keyring()
        .set_password("aiflow", "db_master_key", &new_master_key)
        .map_err(|e| e.to_string())?;

    // 5. 감사 로그 기록
    log_audit_event(&conn, "db_key_rotated", None)?;

    Ok(())
}
```

---

### F. 환율 자동 갱신 (v3.1 — 1일 1회 캐시)
```ts
// src/lib/ai/exchange-rate.ts
const FALLBACK_RATE = 1380;
const CACHE_KEY = 'usd_to_krw_cache';

interface RateCache {
  rate: number;
  fetchedAt: string; // ISO 8601
}

export async function getUsdToKrw(): Promise<number> {
  // Store에서 캐시 확인 (1일 이내면 캐시 사용)
  const cached = await loadFromStore<RateCache>(CACHE_KEY);
  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < 24 * 60 * 60 * 1000) return cached.rate;
  }

  // ExchangeRate-API (무료, 요청 제한 있음)
  try {
    const res = await invoke<number>('fetch_exchange_rate', { from: 'USD', to: 'KRW' });
    await saveToStore(CACHE_KEY, { rate: res, fetchedAt: new Date().toISOString() });
    return res;
  } catch {
    return cached?.rate ?? FALLBACK_RATE; // 실패 시 폴백
  }
}
```

---

## 비용 계산 공식 (USD + KRW)

```ts
// src/lib/ai/cost.ts
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.00025, output: 0.00125 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  // 로컬 LLM은 비용 = 0
};

// KRW 환율 (고정 또는 실시간)
const USD_TO_KRW = 1380; // 또는 실시간 API

export function calcCost(model: string, inputTokens: number, outputTokens: number): {
  usd: number;
  krw: number;
} {
  const price = PRICE_TABLE[model];
  if (!price) return { usd: 0, krw: 0 };
  const usd = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
  return { usd, krw: Math.round(usd * USD_TO_KRW) };
}

export function formatCost(cost: { usd: number; krw: number }): string {
  return `$${cost.usd.toFixed(4)} (₩${cost.krw})`;
}
```

---

## 절대 하지 마 (DO NOT)

> AI에게 코드를 시킬 때 이 목록을 반드시 함께 공유하세요.

- [ ] **API 키를 코드·DB·파일에 평문으로 저장하지 마** — OS 키체인(`tauri-plugin-keyring`)만 사용
- [ ] **AI API를 프론트엔드(JS)에서 직접 호출하지 마** — Tauri Rust command 경유 (API 키 노출 방지)
- [ ] **DB를 암호화 없이 열지 마** — 반드시 PRAGMA key로 SQLCipher 활성화 (연결 직후 첫 번째 명령)
- [ ] **PII를 AI에 평문으로 전송하지 마** — 프라이버시 모드 ON 시 OpenRedaction 마스킹 후 전송
- [ ] **mock/하드코딩 데이터로 완성된 척하지 마** — 실제 AI API 호출 필수
- [ ] **EventSystem으로 AI 토큰 스트리밍하지 마** — 반드시 `ipc::Channel` 사용
- [ ] **기존 SQLite 마이그레이션 파일을 수정하지 마** — 변경 필요 시 새 마이그레이션 파일 추가
- [ ] **외부 서버/클라우드에 대화·API 키를 전송하지 마** — 로컬 전용 데이터
- [ ] **Windows 경로 구분자(`\`)를 하드코딩하지 마** — Tauri `path` API 또는 `$APPDATA` 변수 사용
- [ ] **글로벌 단축키를 앱 종료 시 unregister하지 않으면 안 됨** — 시스템 레벨 단축키 누수 발생
- [ ] **package.json 의존성 버전을 임의로 올리지 마** — Tauri 플러그인 호환성 깨질 수 있음
- [ ] **에러를 콘솔에만 출력하지 마** — 사용자에게 한국어 에러 메시지 표시 (에러 카탈로그 참조)
- [ ] **라우팅 없이 항상 같은 AI를 쓰지 마** — 라우팅 모드 설정을 반드시 참조
- [ ] **IPC invoke 파라미터를 Zod 검증 없이 백엔드로 넘기지 마** — validators.ts 통해 먼저 검증
- [ ] **메시지를 페이지 처리 없이 전부 로드하지 마** — 반드시 페이지네이션 (50개씩)
- [ ] **AuditLog 테이블에 UPDATE/DELETE 하지 마** — INSERT 전용, 감사 무결성 유지
- [ ] **PrivacyLog.masking_map으로 역마스킹 기능을 구현하지 마** — 보안 정책상 금지

---

## 항상 해 (ALWAYS DO)

- [ ] 변경 전에 무엇을 어떻게 바꿀지 계획을 먼저 보여줘
- [ ] AI 응답은 `ipc::Channel`로 토큰 단위 실시간 스트리밍
- [ ] AI 응답 UI에 "중지" 버튼을 제공하고 `cancel_stream` command로 연결
- [ ] 각 AI 응답 후 토큰 수 + 비용(USD + KRW)을 메시지 하단에 표시 (환율: 실시간 캐시)
- [ ] 스마트 라우팅 사용 시 절감액도 표시 (v3.0)
- [ ] 다크모드를 기본, 라이트모드도 지원
- [ ] 로딩 상태는 반드시 표시 (스켈레톤 UI 또는 스피너)
- [ ] 한국어 UI (버튼, 메시지, 에러, 툴팁 모두 한국어)
- [ ] API 키는 OS 키체인 → DB에는 keychain_key 참조만 저장
- [ ] DB는 SQLCipher AES-256으로 암호화, PRAGMA cipher_memory_security = ON
- [ ] 글로벌 단축키 등록/해제 쌍으로 관리 + 충돌 감지
- [ ] shadcn/ui 기본 컴포넌트 우선 사용, 커스텀 최소화
- [ ] SQL 마이그레이션은 새 번호의 파일로만 추가 (기존 파일 수정 금지)
- [ ] **마이그레이션 실행 직전 DB 자동 백업** — `backup_before_migration()` 호출
- [ ] 페르소나 시스템 프롬프트는 AI 메시지 맨 앞에 prepend
- [ ] 배치 처리 중에는 진행률(N/M)을 실시간으로 표시
- [ ] 보안 이벤트(API 키 저장/삭제, 키 로테이션, 데이터 삭제)는 AuditLog에 기록
- [ ] Windows 최소 요구사항 확인: Win10 21H2 (빌드 19044) 이상

---

## 테스트 방법

```bash
# 로컬 개발 서버 (Tauri + React 동시 실행)
npm run tauri dev

# 타입 체크
npx tsc --noEmit

# React 단독 실행 (Tauri 없이 UI 확인)
npm run dev

# 빌드 (Windows 설치 파일 생성)
npm run tauri build

# 생성 위치
src-tauri/target/release/bundle/
├── msi/    # Windows Installer (.msi)
└── nsis/   # 설치 마법사 (.exe)
```

---

## 환경변수

Tauri 데스크톱 앱이므로 `.env` 파일 없이 OS 키체인에 저장합니다.

| 데이터 | 저장 위치 | 참조 방법 |
|--------|---------|---------|
| OpenAI API Key | Windows Credential Manager | `tauri-plugin-keyring` "aiflow", "openai" |
| Anthropic API Key | Windows Credential Manager | `tauri-plugin-keyring` "aiflow", "anthropic" |
| Google AI API Key | Windows Credential Manager | `tauri-plugin-keyring` "aiflow", "google" |
| DB 암호화 마스터 키 | Windows Credential Manager | `tauri-plugin-keyring` "aiflow", "db_master_key" |
| 라이선스 키 | Windows Credential Manager | `tauri-plugin-keyring` "aiflow", "license_key" |

---

## 확정된 설계 결정사항 (v3.1)

| 항목 | **확정값** |
|------|-----------|
| SQLCipher 키 유도 | PBKDF2-SHA512 25만 반복 → 파생 DB 키 (직접 사용 금지) |
| OpenRedaction 번들 | npm + Vite 번들 포함 (순수 JS, 오프라인 전용) |
| 라우팅 복잡도 임계값 | 기본 35 / 72 (Settings에서 사용자 조정 가능) |
| KRW 환율 | ExchangeRate-API 1일 캐시, 오프라인 폴백 1380 |
| 브라우저 확장 배포 | Phase 2 중 비공개 배포 → 안정화 후 Chrome Web Store 등록 |
| 글로벌 결제 | **LemonSqueezy** (한국 사업자 등록 불필요, VAT 자동) |
| 글로벌 단축키 기본값 | `Alt+Space` (오버레이) / `Alt+Shift+A` (클립보드) / `Alt+Shift+S` (스크린샷) |
| Windows 최소 요구사항 | Win10 21H2 (빌드 19044) 이상 |

## 의존성 추가 (v3.1)

```bash
# Zod — IPC 입력 검증
npm install zod

# 환율 API 호출은 Rust reqwest 사용 (기존 의존성)
# Rust: chrono — 백업 파일명 타임스탬프
# Cargo.toml: chrono = { version = "0.4", features = ["serde"] }
```

---

## v3.1 패치: reqwest 취소 + 연결 풀 + Zod 완성

### G. reqwest 취소 + 타임아웃 + 연결 풀 설정

기존 `cancel_stream` 패턴(AtomicBool)에서 `CancellationToken`을 활용한 완전한 reqwest 취소를 추가합니다.

```rust
// src-tauri/src/http/client.rs
// 전역 reqwest 클라이언트 (연결 풀 재사용)

use reqwest::Client;
use std::sync::OnceLock;
use tokio_util::sync::CancellationToken;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub fn get_http_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            // 연결 풀 설정
            .pool_max_idle_per_host(5)      // AI 제공자당 최대 5개 유휴 연결
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            // 타임아웃
            .connect_timeout(std::time::Duration::from_secs(10))
            .timeout(std::time::Duration::from_secs(300))  // 스트리밍용 넉넉한 타임아웃
            // TLS: rustls (OpenSSL 미사용)
            .use_rustls_tls()
            // HTTP/2 지원 (OpenAI, Anthropic 모두 지원)
            .http2_adaptive_window(true)
            .build()
            .expect("HTTP client initialization failed")
    })
}

// 취소 가능한 스트리밍 요청
pub struct StreamRequest {
    pub cancel_token: CancellationToken,
    pub message_id: i64,
    pub partial_content: tokio::sync::Mutex<String>,
    pub token_count: std::sync::atomic::AtomicU32,
    pub input_tokens: u32,
    pub provider_id: i64,
    pub start_time: std::time::Instant,
}

pub async fn stream_with_cancellation(
    request: reqwest::RequestBuilder,
    cancel_token: CancellationToken,
    on_chunk: impl Fn(&str) + Send + 'static,
) -> Result<String, AiflowError> {
    use futures::StreamExt;

    let response = tokio::select! {
        res = request.send() => res.map_err(AiflowError::from)?,
        _ = cancel_token.cancelled() => {
            return Err(AiflowError::new("AI_005", "스트리밍이 취소되었습니다."));
        }
    };

    let mut stream = response.bytes_stream();
    let mut full_content = String::new();

    loop {
        tokio::select! {
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = parse_sse_chunk(&bytes)?;
                        on_chunk(&text);
                        full_content.push_str(&text);
                    }
                    Some(Err(e)) => return Err(AiflowError::from(e)),
                    None => break,  // 스트림 완료
                }
            }
            _ = cancel_token.cancelled() => {
                log::info!("Stream cancelled by user after {} chars", full_content.len());
                return Err(AiflowError::Cancelled { partial: full_content });
            }
        }
    }

    Ok(full_content)
}
```

### H. Zod 검증 스키마 완성 (TypeScript)

```typescript
// src/lib/validators.ts
import { z } from 'zod';

// --- 공통 ---
const ProviderIdSchema = z.number().int().positive();
const MessageIdSchema = z.number().int().positive();
const ConversationIdSchema = z.number().int().positive();

// --- AI 스트리밍 ---
export const StreamAiInputSchema = z.object({
  conversationId: ConversationIdSchema,
  content: z.string().min(1).max(50_000),   // 최대 50,000자
  providerId: ProviderIdSchema.optional(),   // 미입력 시 스마트 라우팅
  personaId: z.number().int().positive().optional(),
  attachmentIds: z.array(z.number().int().positive()).max(5).optional(),
  privacyMode: z.boolean().default(false),
});
export type StreamAiInput = z.infer<typeof StreamAiInputSchema>;

// --- 스트림 취소 ---
export const CancelStreamInputSchema = z.object({
  streamId: z.string().uuid(),
});

// --- API 키 저장 ---
export const SaveApiKeyInputSchema = z.object({
  providerId: ProviderIdSchema,
  apiKey: z.string()
    .min(10, 'API 키가 너무 짧습니다.')
    .max(500, 'API 키가 너무 깁니다.')
    .regex(/^[A-Za-z0-9\-_.]+$/, '유효하지 않은 API 키 형식입니다.'),
});

// --- 메시지 페이지네이션 ---
export const GetMessagesPaginatedSchema = z.object({
  conversationId: ConversationIdSchema,
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(50),
  // 최신 먼저 OR 오래된 것 먼저
  order: z.enum(['asc', 'desc']).default('asc'),
});

// --- 대화 생성 ---
export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  personaId: z.number().int().positive().optional(),
  mode: z.enum(['chat', 'batch', 'workflow']).default('chat'),
});

// --- 설정 업데이트 ---
export const UpdateSettingsSchema = z.object({
  hotkey_overlay: z.string().regex(/^(Alt|Ctrl|Shift|Win)\+/).optional(),
  hotkey_clipboard: z.string().regex(/^(Alt|Ctrl|Shift|Win)\+/).optional(),
  routing_mode: z.enum(['manual', 'smart', 'cheapest', 'fastest']).optional(),
  default_provider_id: ProviderIdSchema.optional(),
  privacy_mode_default: z.boolean().optional(),
  auto_lock_minutes: z.number().int().min(0).max(480).optional(),
  max_file_size_mb: z.number().int().min(1).max(100).optional(),
  retention_conversations_days: z.number().int().min(-1).max(3650).optional(),
  show_cost_krw: z.boolean().optional(),
  ui_language: z.enum(['ko', 'en', 'ja', 'zh-CN']).optional(),
  ui_theme: z.enum(['dark', 'light', 'system']).optional(),
}).strict();  // 미선언 필드 자동 거부

// --- 파일 첨부 ---
export const AttachFileSchema = z.object({
  messageId: MessageIdSchema,
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024),  // 최대 10MB
  mimeType: z.string().max(100),
  extractedText: z.string().max(500_000).optional(),
});

// --- 공통 invoke 래퍼 (검증 + invoke) ---
import { invoke } from '@tauri-apps/api/core';

export async function invokeValidated<TInput, TOutput>(
  command: string,
  schema: z.ZodSchema<TInput>,
  input: unknown,
): Promise<TOutput> {
  const validated = schema.parse(input);  // 실패 시 ZodError throw
  return invoke<TOutput>(command, validated as Record<string, unknown>);
}

// 사용 예:
// const result = await invokeValidated('stream_ai', StreamAiInputSchema, {
//   conversationId: 1,
//   content: userInput,
//   privacyMode: isPrivacyMode,
// });
```

### DO NOT 추가 (v3.1 패치)

- [ ] **reqwest Client를 요청마다 새로 생성하지 마** — `get_http_client()` 싱글톤 재사용 (연결 풀 성능)
- [ ] **AI 요청 타임아웃 설정 없이 무한 대기하지 마** — 기본 300초, connect 10초 설정 필수

### ALWAYS DO 추가 (v3.1 패치)

- [ ] **reqwest 스트리밍 루프에서 `CancellationToken`으로 취소 가능하게 구현**
- [ ] **모든 invoke 호출 시 `invokeValidated()` 래퍼 사용** (직접 `invoke()` 금지)
- [ ] **DB 인덱스 추가 시 `20260327000020_performance_indexes.sql` 패턴으로 신규 마이그레이션 파일 생성**

---

## reqwest 연결풀 싱글톤 — 완전 구현 (v3.2 패치)

> **반드시 이 패턴 사용** — 요청마다 Client 생성 시 TCP 핸드셰이크 매번 발생 → TTFT 증가

```rust
// src-tauri/src/ai/http_client.rs
use reqwest::Client;
use std::sync::OnceLock;
use std::time::Duration;

/// 전역 싱글톤 HTTP 클라이언트 — 연결 풀 공유
static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub fn get_http_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            // 연결 풀 설정
            .pool_max_idle_per_host(5)       // provider당 최대 유휴 연결 5개
            .pool_idle_timeout(Duration::from_secs(90))  // 90초 유휴 시 연결 닫기
            .tcp_keepalive(Duration::from_secs(60))      // TCP keepalive 60초

            // 타임아웃 설정
            .connect_timeout(Duration::from_secs(10))    // 연결 수립 최대 10초
            .timeout(Duration::from_secs(300))           // 전체 요청 최대 5분
            .read_timeout(Duration::from_secs(120))      // 읽기 최대 2분 (스트림 토큰 간격)

            // TLS 설정 (rustls 사용 — TLS 1.2 미만 자동 거부)
            .use_rustls_tls()
            .min_tls_version(reqwest::tls::Version::TLS_1_2)

            // HTTP/2 지원 (OpenAI, Anthropic 모두 지원)
            .http2_prior_knowledge()

            // User-Agent
            .user_agent(format!("AIFlow/{}", env!("CARGO_PKG_VERSION")))

            .build()
            .expect("HTTP 클라이언트 초기화 실패 — Cargo.toml rustls 기능 확인")
    })
}
```

```toml
# Cargo.toml — reqwest 기능 플래그
[dependencies]
reqwest = { version = "0.12", default-features = false, features = [
    "json",
    "stream",
    "rustls-tls",    # OpenSSL 대신 rustls (순수 Rust, 크기 작음)
    "http2",
    "gzip",
    "deflate",
] }
tokio-util = { version = "0.7", features = ["codec"] }
tokio-graceful-shutdown = "0.15"
```

---

## AI 스트리밍 취소 — 완전 구현 (v3.2 패치)

> **핵심**: `stream_id`로 취소 토큰을 등록 → 프론트에서 `cancel_stream` 호출 → 스트리밍 루프 즉시 종료

```rust
// src-tauri/src/ai/stream_registry.rs
use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;
use uuid::Uuid;

/// 진행 중인 스트림의 취소 채널 저장소
pub struct StreamRegistry {
    /// stream_id → 취소 신호 전송자
    senders: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            senders: Mutex::new(HashMap::new()),
        }
    }

    /// 새 스트림 등록 → 취소 수신자 반환
    pub fn register(&self, stream_id: &str) -> oneshot::Receiver<()> {
        let (tx, rx) = oneshot::channel();
        self.senders
            .lock()
            .unwrap()
            .insert(stream_id.to_string(), tx);
        rx
    }

    /// 스트림 취소 신호 전송
    pub fn cancel(&self, stream_id: &str) -> bool {
        if let Some(tx) = self.senders.lock().unwrap().remove(stream_id) {
            tx.send(()).is_ok()
        } else {
            false // 이미 완료된 스트림
        }
    }

    /// 완료된 스트림 정리
    pub fn remove(&self, stream_id: &str) {
        self.senders.lock().unwrap().remove(stream_id);
    }
}
```

```rust
// src-tauri/src/commands/ai.rs — 스트리밍 command
use crate::ai::http_client::get_http_client;
use crate::ai::stream_registry::StreamRegistry;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, State};
use tokio::select;
use zeroize::Zeroizing;

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamChunk {
    Token { content: String, index: u32 },
    Done {
        message_id: String,
        input_tokens: u32,
        output_tokens: u32,
        cost_usd: f64,
    },
    Error { code: String, message: String },
}

#[tauri::command]
pub async fn stream_ai_message(
    conversation_id: String,
    content: String,
    provider: String,
    model_id: String,
    stream_id: String,
    privacy_mode: bool,
    channel: Channel<StreamChunk>,
    registry: State<'_, StreamRegistry>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // 1. 취소 수신자 등록
    let mut cancel_rx = registry.register(&stream_id);

    // 2. OS 키체인에서 API 키 조회 (평문 메모리 최소 유지)
    let api_key = {
        use tauri_plugin_keyring::KeyringExt;
        let key = app.keyring()
            .get_password("aiflow", &provider)
            .map_err(|e| format!("API_KEY_001: API 키를 찾을 수 없습니다 ({})", e))?;
        Zeroizing::new(key) // 스코프 종료 시 메모리 자동 제거
    };

    // 3. HTTP 요청 구성 (싱글톤 클라이언트 재사용)
    let client = get_http_client();
    let request = build_streaming_request(client, &provider, &model_id, &content, &api_key)
        .map_err(|e| format!("AI_002: 요청 구성 실패 — {}", e))?;

    // 4. 스트리밍 시작
    let response = client
        .execute(request)
        .await
        .map_err(|e| format!("NET_001: AI 서버 연결 실패 — {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let err_code = match status {
            401 => "AUTH_001",
            429 => "RATE_001",
            500..=599 => "AI_003",
            _ => "AI_002",
        };
        return Err(format!("{}:{}", err_code, status));
    }

    // 5. SSE 스트리밍 루프 (취소 가능)
    let mut stream = response.bytes_stream();
    let mut token_index: u32 = 0;
    let mut buffer = String::new();

    loop {
        select! {
            // 취소 신호 수신 → 즉시 종료
            _ = &mut cancel_rx => {
                registry.remove(&stream_id);
                let _ = channel.send(StreamChunk::Error {
                    code: "CANCEL_001".to_string(),
                    message: "사용자가 생성을 취소했습니다".to_string(),
                });
                return Ok(());
            }

            // 다음 청크 수신
            chunk = stream.next() => {
                match chunk {
                    None => break, // 스트림 종료
                    Some(Err(e)) => {
                        let _ = channel.send(StreamChunk::Error {
                            code: "NET_002".to_string(),
                            message: format!("스트림 수신 오류: {}", e),
                        });
                        break;
                    }
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));

                        // SSE "data: {...}\n\n" 파싱
                        while let Some(pos) = buffer.find("\n\n") {
                            let line = buffer[..pos].trim().to_string();
                            buffer = buffer[pos + 2..].to_string();

                            if let Some(data) = line.strip_prefix("data: ") {
                                if data == "[DONE]" { break; }
                                if let Ok(token) = extract_token_from_sse(data, &provider) {
                                    let _ = channel.send(StreamChunk::Token {
                                        content: token,
                                        index: token_index,
                                    });
                                    token_index += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 6. 완료 처리 — 비용 계산 후 DB 저장
    let (message_id, input_tokens, output_tokens, cost_usd) =
        finalize_stream(&conversation_id, &provider, &model_id, privacy_mode, token_index)
            .await
            .map_err(|e| format!("DB_001: 메시지 저장 실패 — {}", e))?;

    registry.remove(&stream_id);
    let _ = channel.send(StreamChunk::Done {
        message_id,
        input_tokens,
        output_tokens,
        cost_usd,
    });

    Ok(())
}

/// 스트림 취소 command
#[tauri::command]
pub async fn cancel_stream(
    stream_id: String,
    registry: State<'_, StreamRegistry>,
) -> Result<bool, String> {
    Ok(registry.cancel(&stream_id))
}
```

```rust
// src-tauri/src/lib.rs — StreamRegistry 등록
use crate::ai::stream_registry::StreamRegistry;

pub fn run() {
    tauri::Builder::default()
        .manage(StreamRegistry::new()) // 앱 상태로 등록
        .invoke_handler(tauri::generate_handler![
            commands::ai::stream_ai_message,
            commands::ai::cancel_stream,
            // ... 기타 commands
        ])
        .run(tauri::generate_context!())
        .expect("AIFlow 실행 실패");
}
```

### 재시도 정책

```rust
// src-tauri/src/ai/retry.rs
use std::time::Duration;
use tokio::time::sleep;

/// 지수 백오프 재시도 (최대 3회)
pub async fn with_retry<F, Fut, T, E>(
    max_attempts: u32,
    mut f: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut attempt = 0;
    loop {
        match f().await {
            Ok(val) => return Ok(val),
            Err(e) => {
                attempt += 1;
                if attempt >= max_attempts {
                    return Err(e);
                }
                // 지수 백오프: 1s, 2s, 4s
                let delay = Duration::from_secs(2u64.pow(attempt - 1));
                tracing::warn!("재시도 {}/{}: {} ({}초 후)", attempt, max_attempts, e, delay.as_secs());
                sleep(delay).await;
            }
        }
    }
}

// 사용 예 — Rate Limit(429) 시 자동 재시도
// with_retry(3, || async { client.execute(request.try_clone().unwrap()).await }).await
```

---

## OS 키체인 폴백 정책 (v3.2 패치)

```rust
// src-tauri/src/commands/keychain.rs — 폴백 포함 완전 구현
use tauri_plugin_keyring::KeyringExt;
use zeroize::Zeroizing;

/// 키체인 폴백 전략:
/// 1. OS 키체인 (Windows Credential Manager) → 정상
/// 2. 실패 시 → 암호화된 폴백 파일 ($APPDATA/aiflow/keys.enc)
/// 3. 폴백도 실패 시 → 사용자에게 재입력 요청
#[tauri::command]
pub async fn get_api_key_safe(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Zeroizing<String>, String> {
    // 1차: OS 키체인
    match app.keyring().get_password("aiflow", &provider) {
        Ok(key) => return Ok(Zeroizing::new(key)),
        Err(e) => {
            tracing::warn!("키체인 접근 실패 ({}): {} — 폴백 시도", provider, e);
        }
    }

    // 2차: 암호화 폴백 파일
    match read_encrypted_fallback(&app, &provider).await {
        Ok(key) => {
            tracing::info!("폴백 파일에서 {} 키 복원 성공", provider);
            return Ok(Zeroizing::new(key));
        }
        Err(e) => {
            tracing::error!("폴백 파일 읽기 실패 ({}): {}", provider, e);
        }
    }

    // 3차: 사용자에게 재입력 요청
    Err("KEYCHAIN_001: API 키를 불러올 수 없습니다. 설정에서 API 키를 다시 입력해주세요.".to_string())
}

async fn read_encrypted_fallback(
    app: &tauri::AppHandle,
    provider: &str,
) -> Result<String, String> {
    use tauri::Manager;
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;
    let fallback_path = data_dir.join("keys.enc");

    if !fallback_path.exists() {
        return Err("폴백 파일 없음".to_string());
    }

    // AES-256-GCM으로 암호화된 파일 읽기
    // (암호화 키는 PBKDF2(machine-id + salt)로 유도)
    let encrypted = tokio::fs::read(&fallback_path)
        .await
        .map_err(|e| e.to_string())?;

    decrypt_key_file(&encrypted, provider)
}

fn decrypt_key_file(_data: &[u8], _provider: &str) -> Result<String, String> {
    // AES-256-GCM 복호화 구현
    // 키: PBKDF2-SHA512(machine_id() + b"aiflow_fallback_v1", 100_000회)
    // TODO: Phase 1 구현 시 aes-gcm 크레이트 사용
    Err("미구현".to_string())
}
```
