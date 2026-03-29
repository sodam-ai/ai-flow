# AIFlow — 위협 모델 v4.1

> v1.0: STRIDE 기반 위협 분석 + 공격면 정의
> v4.1: 신뢰 경계 다이어그램 추가 (OWASP ASVS V1.1 준수)
> AI가 보안 관련 코드를 짤 때 이 문서를 반드시 함께 제공하세요.

---

## 개요

이 문서는 AIFlow 데스크톱 앱의 보안 위협을 체계적으로 분석합니다.
STRIDE 프레임워크 기반으로 공격면(attack surface)을 정의하고, 각 위협에 대한 대응 전략과 구현 요구사항을 명세합니다.

---

## 0. 신뢰 경계 다이어그램 (v4.1 신규)

> OWASP ASVS V1.1: "아키텍처 다이어그램에 신뢰 경계를 표시하라"

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 기기 (Windows PC)                                        │
│                                                                 │
│  ┌──────────────────── 신뢰 경계 1: WebView ↔ Rust ────────────┐ │
│  │                                                              │ │
│  │  [React WebView]                  [Rust Backend]             │ │
│  │   - UI 렌더링                      - 비즈니스 로직           │ │
│  │   - 사용자 입력                    - DB 접근                 │ │
│  │   - Zod 검증 (1차)                - Zod 검증 (2차, Rust)    │ │
│  │         │                               │                   │ │
│  │         └── Tauri IPC (invoke + Channel) ┘                   │ │
│  │             CSP: default-src 'self'                          │ │
│  │             Capability: 최소 권한 (default.json)              │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────── 신뢰 경계 2: Rust ↔ OS 서비스 ───────────────────┐ │
│  │  [OS 키체인]              [파일시스템]      [글로벌 단축키]    │ │
│  │   - API 키 저장            - DB 파일        - Alt+Space       │ │
│  │   - DB 마스터키             - 백업 파일      - Alt+Shift+A    │ │
│  │   - 라이선스 키             - 내보내기 파일   - 클립보드 읽기   │ │
│  │   - 기기 UUID              - 로그 파일                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
         ┌──── 신뢰 경계 3: 기기 ↔ 외부 인터넷 ────┐
         │                                         │
         │  [AI Provider API]    [업데이트 서버]     │
         │   - OpenAI             - latest.json     │
         │   - Anthropic          - Ed25519 서명    │
         │   - Google             - 환율 번들       │
         │   - TLS 1.3 필수                         │
         │                                         │
         │  [라이선스 서버]       [Phase 2: Sentry]  │
         │   - JWT 검증           - 옵트인 전용     │
         │   - 30일 오프라인      - PII 필터        │
         └─────────────────────────────────────────┘
```

### 신뢰 경계별 보안 요구사항

| 경계 | 위협 | 방어 |
|------|------|------|
| **1: WebView ↔ Rust** | XSS → IPC 악용, 입력 조작 | CSP(unsafe-eval 금지), Zod 이중 검증, Capability 최소 권한 |
| **2: Rust ↔ OS** | 키체인 접근 거부, 파일 권한, 경로 조작 | fail-closed 정책, 경로 canonicalize(), 화이트리스트 |
| **3: 기기 ↔ 인터넷** | MITM, DNS 스푸핑, 업데이트 변조 | TLS 1.3, Ed25519 서명, SSRF 방지 |

---

## 1. 보호 대상 자산 (Assets)

| 자산 | 분류 | 중요도 | 위치 |
|------|------|--------|------|
| AI Provider API 키 | 기밀 | CRITICAL | OS 키체인 |
| DB 마스터 키 | 기밀 | CRITICAL | OS 키체인 |
| 대화 내용 (메시지) | 개인정보 | HIGH | SQLCipher DB |
| AI 페르소나 시스템 프롬프트 | 민감 | MEDIUM | SQLCipher DB |
| 사용자 프롬프트 저장고 | 민감 | MEDIUM | SQLCipher DB |
| 비용 사용 내역 | 재무 | MEDIUM | SQLCipher DB |
| 앱 바이너리 (업데이터) | 무결성 | HIGH | 디스크 + 업데이트 서버 |
| 플러그인 코드 | 무결성 | HIGH | 플러그인 디렉토리 |
| 기기 식별자 | 개인정보 | LOW | OS 키체인 (v3.6: 랜덤UUID) |

---

## 2. 공격면 (Attack Surface) 지도

```
외부 공격자
    │
    ├── [인터넷] ─────── AI API 서버 (OpenAI, Anthropic, Google)
    │                    환율 API (ExchangeRate-API)
    │                    업데이트 서버 (GitHub Releases)
    │                    라이선스 서버
    │
    ├── [로컬 파일시스템] ─ 드래그앤드롭 파일 (PDF, 이미지)
    │                      플러그인 패키지 (.aiflow)
    │                      import_data 파일
    │
    ├── [글로벌 단축키] ─── Alt+Space (악성 앱이 단축키 후킹 가능)
    │
    └── [IPC 채널] ───── WebView(JS) ↔ Rust Backend
                         (Tauri invoke + ipc::Channel + emit)
```

---

## 3. STRIDE 위협 분석

### 3.1 Spoofing (신분 위장)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| S-01 | 업데이트 서버 위장 | DNS 스푸핑으로 악성 업데이트 서버로 유도 | Tauri updater HTTPS | **Ed25519 서명 검증 필수** (아래 §6) |
| S-02 | 플러그인 위장 | 합법적 플러그인 이름으로 악성 플러그인 배포 | Ed25519 서명 검증 | 마켓 심사 + 서명 공개키 번들 |
| S-03 | AI API 서버 위장 | MITM으로 가짜 AI 응답 삽입 | HTTPS (reqwest rustls) | Certificate pinning (Phase 2) |
| S-04 | 라이선스 서버 위장 | 가짜 라이선스 서버로 Pro 기능 무료 해제 | JWT 서명 검증 | 공개키 바이너리 내장 확인 |

### 3.2 Tampering (데이터 변조)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| T-01 | DB 변조 | SQLCipher 키 없이 DB 파일 직접 수정 | SQLCipher AES-256 | WAL 파일도 암호화 확인 |
| T-02 | 플러그인 코드 변조 | 설치 후 플러그인 파일 직접 수정 | 설치 시점 서명 검증 | **런타임 재검증 추가 (§4)** |
| T-03 | import_data 조작 | 악의적 JSON으로 대화 내용 덮어쓰기 | 미정의 | **§5 import 검증 정책** |
| T-04 | 설정 파일 변조 | allowed_file_extensions에 .exe 추가 | Zod 스키마 검증 | 서버 사이드 허용 목록 고정 |
| T-05 | 앱 바이너리 변조 | 설치 후 .exe 직접 교체 | Authenticode 서명 | Windows 시작 시 서명 재확인 불가 (OS 의존) |

### 3.3 Repudiation (부인)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| R-01 | API 키 사용 부인 | "나는 그 요청 안 했다" 주장 | audit_log 테이블 | **§7 보안 이벤트 로그 추가** |
| R-02 | 플러그인 보안 위반 부인 | 악성 플러그인 행동 추적 불가 | 미정의 | plugin_security_violation 감사 로그 |
| R-03 | 비용 청구 분쟁 | API 비용 사용 증거 없음 | cost_logs 테이블 | 변조 방지 해시 체인 (Phase 2) |

### 3.4 Information Disclosure (정보 노출)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| I-01 | API 키 IPC 노출 | get_api_key가 JS 메모리에 키 반환 | **v3.6 패치: get_api_key_status로 교체** | ✅ 완료 |
| I-02 | DB 키 메모리 잔류 | format! 문자열로 키 조합 | **v3.6 패치: pragma_update() 바인딩** | ✅ 완료 |
| I-03 | PII 원본 JS 잔류 | detectedItems.value가 Zustand 상태에 보관 | 미정의 | value 필드 제거, masked만 전달 |
| I-04 | 에러 메시지 경로 노출 | Rust 에러에 파일 경로 포함 | 부분적 | 사용자용 에러는 코드만, 경로 제거 |
| I-05 | 플러그인이 대화 내용 수집 | message:sent 이벤트로 외부 전송 | 미정의 | **§8 Privacy Mode 플러그인 격리** |
| I-06 | 로그 파일 API 키 노출 | tracing::error!에 키 포함 | tracing 필터 | Sentry PII 필터 + 로컬 로그 필터 |
| I-07 | 임시 파일 잔류 | 처리 후 temp 파일 미삭제 | TempFileGuard (v3.5) | ✅ 완료 |

### 3.5 Denial of Service (서비스 거부)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| D-01 | MCP 프로세스 리소스 소진 | 악성 플러그인이 무한 루프로 CPU 100% | 선언만 있음 | **v3.6 패치: Job Object 적용** ✅ |
| D-02 | MCP stdout DoS | 플러그인이 무한 출력으로 메모리 소진 | 미정의 | **v3.6 패치: 10MB 제한** ✅ |
| D-03 | AI API 비용 폭탄 | 버그로 수백 건 AI 요청 동시 발사 | 미정의 | **§9 레이트 리미팅 + circuit breaker** |
| D-04 | 대용량 파일 첨부 | 1GB 파일 드롭으로 앱 응답 없음 | 10MB 제한 (Zod) | spawn_blocking으로 UI 블록 방지 |
| D-05 | DB 잠금 교착 | 동시 쓰기로 DB 응답 없음 | 미정의 | **r2d2 풀 + mpsc writer 전략** (04_PROJECT_SPEC.md v3.6) |

### 3.6 Elevation of Privilege (권한 상승)

| ID | 위협 | 공격 시나리오 | 현재 대응 | 추가 필요 |
|----|------|-------------|----------|----------|
| E-01 | 플러그인 OS 탈주 | Node.js child_process로 임의 명령 실행 | env_clear() | **Job Object (v3.6) + stdout 제한** ✅ |
| E-02 | 경로 트래버설 | ../../../ 경로로 플러그인 디렉토리 탈출 | TOCTOU 검증 (09_PLUGIN_API.md) | **§10 Windows 경로 검증 강화** |
| E-03 | XSS → IPC 호출 | WebView XSS로 악성 IPC invoke | Tauri CSP 설정 | CSP 헤더 명세 추가 (아래) |
| E-04 | 다운그레이드 공격 | 구 취약 버전 업데이트 설치 유도 | 미정의 | **§6 최소 버전 강제 정책** |

---

## 4. 플러그인 런타임 재검증 정책

플러그인은 설치 시점뿐 아니라 **매 실행 시**에도 서명을 재검증해야 합니다.

```rust
// 플러그인 spawn 전 검증 체크리스트
pub async fn verify_before_spawn(plugin: &PluginManifest, data_dir: &Path) -> Result<()> {
    // 1. 서명 검증 (설치 후 파일 변조 감지)
    verify_plugin_signature(plugin, data_dir)?;

    // 2. 폐기 목록 확인 (원격 revocation.json)
    check_key_revocation(&plugin.signature.key_id).await?;

    // 3. capabilities 허용 목록 재확인
    validate_capabilities(&plugin.permissions)?;

    // 4. 플러그인 디렉토리 권한 확인 (다른 프로세스 쓰기 가능 상태 방지)
    verify_directory_permissions(data_dir.join(&plugin.id))?;

    Ok(())
}
```

---

## 5. import_data 파일 검증 정책

```rust
// src-tauri/src/commands/data_import.rs
pub const MAX_IMPORT_SIZE: u64 = 100 * 1024 * 1024; // 100MB

pub async fn import_data(path: &Path) -> Result<ImportResult, AiFlowError> {
    // 1. 파일 크기 제한
    let metadata = tokio::fs::metadata(path).await?;
    if metadata.len() > MAX_IMPORT_SIZE {
        return Err(AiFlowError::FileTooLarge { max_mb: 100 });
    }

    // 2. 내용 읽기 + JSON 파싱
    let content = tokio::fs::read(path).await?;
    let raw: serde_json::Value = serde_json::from_slice(&content)?;

    // 3. schema_version 확인
    let version = raw["schema_version"].as_str()
        .ok_or(AiFlowError::InvalidImportFormat)?;
    if version != "aiflow-export-v1" {
        return Err(AiFlowError::UnsupportedImportVersion { version: version.to_string() });
    }

    // 4. 전체 레코드 Zod 상응 Rust 검증 (conversations, messages, prompts)
    let import_data: ExportSchema = serde_json::from_value(raw)?;
    validate_import_records(&import_data)?;

    // 5. DB 트랜잭션 내 일괄 삽입 — 실패 시 전체 롤백
    db.write_tx.send(WriteCommand::ImportData(import_data)).await?;

    Ok(ImportResult::success())
}
```

---

## 6. 업데이터 보안 명세

> Phase 3 (`tauri-plugin-updater`) 개발 전 반드시 구현

### 6.1 Ed25519 서명 검증

```rust
// tauri.conf.json — 업데이터 공개키 내장
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk=",
      "endpoints": ["https://releases.aiflow.app/{{target}}/{{arch}}/{{current_version}}"],
      "dialog": false
    }
  }
}
// Tauri updater는 Ed25519 서명을 자동 검증 — 서명 없는 패키지 설치 불가
```

### 6.2 다운그레이드 공격 방지

```rust
// 업데이트 응답에 최소 허용 버전 포함
#[derive(Deserialize)]
pub struct UpdateManifest {
    pub version: String,
    pub min_allowed_version: String, // 이 버전 미만은 강제 업데이트
    pub signature: String,
    pub url: String,
}

// 현재 버전이 min_allowed_version 미만이면 앱 사용 차단 + 강제 업데이트 유도
pub fn check_minimum_version(manifest: &UpdateManifest) -> Result<()> {
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))?;
    let minimum = semver::Version::parse(&manifest.min_allowed_version)?;
    if current < minimum {
        return Err(AiFlowError::ForceUpdateRequired {
            current: current.to_string(),
            minimum: manifest.min_allowed_version.clone(),
        });
    }
    Ok(())
}
```

### 6.3 업데이터 보안 체크리스트

- [ ] `tauri.conf.json`에 Ed25519 공개키 내장
- [ ] 업데이트 서버 URL은 HTTPS 전용 (`https://releases.aiflow.app`)
- [ ] 다운로드된 패키지는 설치 전 서명 재검증
- [ ] `min_allowed_version` 강제 업데이트 로직 구현
- [ ] 업데이트 실패 시 기존 버전으로 자동 롤백 (`12_RELEASE_CHECKLIST.md` §롤백 기준)
- [ ] 업데이터 루프 감지 (같은 버전 3회 이상 재설치 시도 → 로그 + 중단)

---

## 7. 보안 이벤트 감사 로그 (추가 항목)

`05_SECURITY_SPEC.md` AuditLog에 아래 이벤트 추가 (v3.6 신규):

```sql
-- 추가 감사 이벤트 (기존 audit_log 테이블 사용)
INSERT INTO audit_log (event_type, severity, details) VALUES
  ('api_key_access_denied',       'HIGH',   json('{"provider": "openai", "error": "keychain_locked"}')),
  ('plugin_security_violation',   'CRITICAL', json('{"plugin_id": "...", "violation": "path_traversal"}')),
  ('mcp_path_forbidden',          'HIGH',   json('{"plugin_id": "...", "path": "../secret"}')),
  ('rate_limit_exceeded',         'MEDIUM', json('{"plugin_id": "...", "request_count": 150}')),
  ('file_extension_blocked',      'LOW',    json('{"extension": ".exe", "filename": "malware.exe"}')),
  ('invalid_api_key_format',      'MEDIUM', json('{"provider": "anthropic", "hint": "wrong_prefix"}')),
  ('import_data_invalid',         'MEDIUM', json('{"error": "schema_version_mismatch"}')),
  ('update_force_required',       'HIGH',   json('{"current": "1.0.0", "minimum": "1.1.0"}'));
```

**자동 대응 정책:**
- `plugin_security_violation` 연속 3회 → 해당 플러그인 자동 비활성화 + 사용자 알림
- `api_key_access_denied` → 설정 화면 열기 안내 Toast
- `update_force_required` → 앱 기능 잠금 + 강제 업데이트 다이얼로그

---

## 8. Privacy Mode 플러그인 격리

Privacy Mode가 활성화된 대화에서는 플러그인에 메시지 이벤트를 전달하지 않습니다.

```rust
// src-tauri/src/commands/ai.rs — 스트리밍 전 플러그인 이벤트 발행 시
pub async fn emit_message_event(
    app: &tauri::AppHandle,
    conversation: &Conversation,
    content: &str,
) -> Result<()> {
    // Privacy Mode 대화는 플러그인에 이벤트 차단
    if conversation.privacy_mode {
        tracing::debug!("Privacy Mode: 플러그인 message:sent 이벤트 차단 (conversation_id: {})", conversation.id);
        return Ok(()); // 플러그인에 전달하지 않음
    }

    // 일반 대화만 플러그인에 전달
    app.emit("plugin:message:sent", json!({ "content": content }))?;
    Ok(())
}
```

**플러그인 이벤트 capability 분리:**
- 현재: `network` capability만으로 메시지 이벤트 구독 가능
- 필요: `event:message` 전용 capability 추가 (명시적 선언 없이 구독 불가)

```json
// plugin manifest — 명시적 capability 선언 필요
{
  "permissions": {
    "capabilities": ["network", "event:message"],  // event:message 없으면 message:sent 미전달
    "network": { "allowed_hosts": [...] }
  }
}
```

---

## 9. AI API 레이트 리미팅 + circuit breaker

```rust
// src-tauri/src/services/rate_limiter.rs
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

pub struct AiRateLimiter {
    requests_this_minute: AtomicU32,
    minute_start: Mutex<Instant>,
    pub max_per_minute: u32, // 기본 60
    pub cost_threshold_usd: f64, // 기본 settings.cost_alert_threshold_usd
    cumulative_cost: Mutex<f64>,
    pub circuit_open: AtomicBool, // true = 차단 상태
}

impl AiRateLimiter {
    pub fn check_and_increment(&self) -> Result<(), AiFlowError> {
        // circuit breaker 확인
        if self.circuit_open.load(Ordering::SeqCst) {
            return Err(AiFlowError::CircuitBreakerOpen);
        }

        // 분당 요청 수 초과 확인
        let mut start = self.minute_start.lock().unwrap();
        if start.elapsed() > Duration::from_secs(60) {
            self.requests_this_minute.store(0, Ordering::SeqCst);
            *start = Instant::now();
        }

        let current = self.requests_this_minute.fetch_add(1, Ordering::SeqCst);
        if current >= self.max_per_minute {
            return Err(AiFlowError::RateLimitExceeded { limit: self.max_per_minute });
        }

        Ok(())
    }

    pub fn record_cost(&self, cost_usd: f64) {
        let mut total = self.cumulative_cost.lock().unwrap();
        *total += cost_usd;
        // 임계값 초과 시 circuit breaker 오픈
        if *total >= self.cost_threshold_usd {
            self.circuit_open.store(true, Ordering::SeqCst);
            // 사용자에게 알림 emit
        }
    }
}
```

---

## 10. Windows 경로 검증 강화

`13_ZOD_SCHEMAS.md`의 `SafeFilePathSchema` 보완:

```typescript
// src/lib/ipc/validators.ts — Windows 경로 추가 검증
export const SafeFilePathSchema = z.string()
  .min(1)
  .max(260) // Windows MAX_PATH
  .refine((p) => !p.includes('..'), '경로 트래버설 금지')
  .refine((p) => !p.startsWith('/'), 'Unix 절대경로 금지')
  // Windows 추가 검증
  .refine((p) => !/^[a-zA-Z]:[\\\/]/.test(p), 'Windows 드라이브 절대경로 금지')
  .refine((p) => !p.startsWith('\\\\'), 'UNC 경로 금지')
  .refine((p) => !/%2e%2e/i.test(p), 'URL 인코딩 경로 트래버설 금지')
  .refine((p) => !/[<>:"|?*\x00-\x1f]/.test(p), 'Windows 금지 문자 포함')
  // Rust canonicalize()가 최종 권위 — 이 검증은 조기 실패를 위한 클라이언트 필터
```

```rust
// Rust 측 최종 검증 (canonicalize가 권위)
pub fn validate_safe_path(path: &Path, allowed_root: &Path) -> Result<PathBuf> {
    let canonical = path.canonicalize()
        .map_err(|_| AiFlowError::InvalidPath)?;

    // 허용된 루트 디렉토리 내부인지 확인
    if !canonical.starts_with(allowed_root) {
        return Err(AiFlowError::PathTraversal {
            path: canonical.display().to_string(),
        });
    }

    Ok(canonical)
}
```

---

## 11. CSP (Content Security Policy) 설정

Tauri WebView XSS 방지:

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ipc: http://ipc.localhost; frame-src 'none'; object-src 'none'"
    }
  }
}
```

**금지 사항:**
- `unsafe-eval` — eval() 사용 금지 (XSS 공격 벡터)
- `script-src *` — 외부 스크립트 로드 금지
- `connect-src *` — Tauri IPC 외 외부 연결 금지 (AI API는 Rust에서만)

---

## 12. 확정된 위협 대응 결정사항

| # | 결정 | 값 |
|---|------|-----|
| 1 | MCP 프로세스 CPU 제한 | 25% (Job Object) |
| 2 | MCP 프로세스 메모리 제한 | 128MB (Job Object) |
| 3 | MCP stdout 최대 크기 | 10MB |
| 4 | AI API 레이트 리밋 | 60 req/분 (토큰 버킷) |
| 5 | circuit breaker 임계값 | `settings.cost_alert_threshold_usd` (기본 $5) |
| 6 | import_data 최대 크기 | 100MB |
| 7 | 업데이터 서명 알고리즘 | Ed25519 (Tauri 기본) |
| 8 | 다운그레이드 방지 | min_allowed_version 서버 응답 + 클라이언트 강제 |
| 9 | plugin_security_violation 자동 차단 | 연속 3회 → 자동 비활성화 |
| 10 | Privacy Mode 플러그인 격리 | message:sent 이벤트 차단 |
| 11 | 기기 식별자 방식 | 랜덤 UUID (OS 키체인 저장) — 하드웨어 ID 수집 금지 |
| 12 | CSP | default-src 'self'; unsafe-eval 금지 |
