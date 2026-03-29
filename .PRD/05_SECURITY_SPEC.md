# AIFlow — 보안 명세서 v1.1

> 생성일: 2026-03-27 (v1.0) | 패치: 2026-03-27 (v1.1)
> v1.1: 보안 갭 9개 해소 — Keychain 폴백, JWT 공개키, TOCTOU, AES-128 키,
>        PBKDF2 업그레이드, 확장 ID, 보안 삭제, AuditLog 내보내기, 스트리밍 취소 비용
> AIFlow는 완전 로컬 데스크톱 앱이지만 API 키, DB 데이터, PII, 라이선스 키를 다루므로
> 보안 설계가 제품 신뢰도의 핵심이다.

---

## 1. 보안 위협 모델 (Threat Model)

### 공격 대상 (Assets)
| 자산 | 중요도 | 공격 시 피해 |
|------|--------|------------|
| AI API 키 (OpenAI, Anthropic, Google) | 🔴 최고 | 무제한 API 과금, 계정 피해 |
| DB 마스터 암호화 키 | 🔴 최고 | 전체 대화·개인정보 유출 |
| 대화 내용 | 🟠 높음 | 개인정보·비밀 유출 |
| PII (마스킹 원본) | 🟠 높음 | PIPA 위반, 개인 피해 |
| 라이선스 키 | 🟡 중간 | 불법 공유 |
| 비용 로그·통계 | 🟢 낮음 | 사용 패턴 노출 |

### 위협 행위자 (Threat Actors)
| 행위자 | 공격 방법 | 대응 전략 |
|--------|---------|---------|
| 악성 소프트웨어 | 파일시스템에서 API 키 탈취 | OS 키체인 격리 (키 파일시스템 미노출) |
| 물리 접근 공격자 | PC 탈취 후 DB 파일 복사 | SQLCipher AES-256 암호화 |
| 악성 MCP 서버 | allowed_paths 외 파일 접근 | 경로 화이트리스트 강제 |
| 악성 브라우저 확장 | Native Messaging 악용 | 확장 ID 화이트리스트 |
| 공급망 공격 | npm 패키지 악성 코드 | CSP + Tauri 격리 |

---

## 2. API 키 보안

### 저장 방식
```
[사용자 입력 API 키]
  → tauri-plugin-keyring
  → Windows Credential Manager (OS 레벨 암호화)
  → 앱 종료 후에도 영구 저장

[DB에 저장되는 것]
  → keychain_key: "aiflow/openai" (참조 문자열만)
  → 실제 키값은 절대 DB에 없음
```

### 키 전달 흐름
```
Frontend (React)
  │  invoke('stream_ai', { providerId: '...' })  ← 키값 없음
  ▼
Tauri Rust Command
  │  keyring.get_password("aiflow", "openai")
  │  → "sk-proj-xxxxx" (메모리에서 사용)
  │  → reqwest HTTP 요청에만 사용
  │  → 메모리 사용 후 즉시 해제
  ▼
AI Provider API (HTTPS TLS 1.3)
```

### 데이터 내보내기 보안 (v4.1 신규)

> `export_all_data`는 대화 내용을 JSON으로 파일시스템에 저장한다. DB는 SQLCipher로 암호화되어 있지만, 내보낸 파일은 평문이 될 수 있으므로 보호가 필요하다.

**요구사항**:
1. 내보내기 시 **암호 설정 옵션** 제공 (AES-256 암호화 ZIP)
2. 암호 없이 내보내기도 허용하되 **"이 파일은 암호화되지 않았습니다. 민감한 대화가 포함되어 있을 수 있습니다."** 경고 다이얼로그 표시
3. 내보낸 파일에 API 키는 **절대 포함하지 않음** (키체인 데이터 제외)
4. 감사 로그에 `data_exported` 이벤트 기록 (파일 경로, 암호화 여부)

### 클립보드 → AI 보안 (v4.1 신규)

> `Alt+Shift+A`로 클립보드 내용을 AI에 전송할 때, 클립보드에 다른 앱에서 복사한 비밀번호, API 키, 개인정보가 있을 수 있다.

**요구사항**:
1. **프라이버시 모드 ON** 상태에서 클립보드 → AI 시: PII 자동 스캔 적용 (OpenRedaction, Phase 2)
2. **프라이버시 모드 OFF** 상태: 그대로 전송 (사용자 선택 존중)
3. 클립보드 내용은 전송 후 **앱 메모리에서 즉시 해제** (zeroize 불필요하지만 참조 해제)

### DB 마스터키 수명 권고 (v4.1 신규)

> 로컬 앱이므로 키 로테이션을 강제하면 UX가 나빠지지만, 장기 미갱신은 리스크.

**요구사항**:
1. DB 마스터키 생성일을 기록 (`db_key_created_at` — Settings 또는 키체인 메타데이터)
2. **12개월 경과 시** 설정 화면에 "DB 암호화 키 갱신을 권장합니다" 안내 배너 표시
3. 강제 로테이션은 하지 않음 (사용자 판단에 맡김)
4. 키 갱신 시 `db_key_rotated` 감사 이벤트 기록

---

### API 키 저장 시 유효성 검증 (v4.0 신규)

> API 키를 OS 키체인에 저장하기 전에, 경량 API 호출로 유효성을 검증해야 한다.

```
저장 흐름:
1. 포맷 검증 (Zod): sk- 프리픽스 (OpenAI), sk-ant- (Anthropic), AIza (Google)
2. 경량 API 호출 (models/list 또는 동등): 과금 없는 엔드포인트 1회 호출
   - OpenAI: GET /v1/models
   - Anthropic: POST /v1/messages (dry-run, max_tokens=1)
   - Google: GET /v1beta/models
3. 성공 → 키체인 저장 + "✅ 연결 성공" UI 피드백
4. 실패 → 키체인 저장하지 않음 + 에러 메시지 표시 (AUTH_006)
```

**보안 이유**: 만료/폐기된 키가 키체인에 남으면 사용자가 "보안 상태 양호"로 착각. 저장 시 검증으로 키 상태를 항상 신뢰 가능하게 유지.

---

### API 키 탈취 대응 절차 (사용자 가이드)
1. AIFlow 설정 → 보안 → "모든 API 키 즉시 삭제" 실행
2. 각 AI 공급자 사이트에서 직접 키 폐기:
   - OpenAI: platform.openai.com/api-keys
   - Anthropic: console.anthropic.com/api-keys
   - Google: aistudio.google.com/app/apikey
3. 새 API 키 발급 → AIFlow에 재등록

---

## 3. 데이터베이스 보안

### SQLCipher 암호화 설정 (확정)
```sql
-- 반드시 DB 연결 직후 첫 번째 명령어로 실행
PRAGMA key = '<PBKDF2_DERIVED_KEY>';    -- 마스터키 직접 사용 금지
PRAGMA cipher_page_size = 4096;         -- 최적 성능·보안 균형
PRAGMA kdf_iter = 256000;               -- PBKDF2 반복 횟수 (브루트포스 저항)
PRAGMA cipher_hmac_algorithm = HMAC_SHA512;  -- 무결성 검증
PRAGMA cipher_memory_security = ON;     -- 메모리 내 키 잔류 방지
PRAGMA journal_mode = WAL;              -- 크래시 안전, 동시 읽기
PRAGMA foreign_keys = ON;              -- 참조 무결성
PRAGMA secure_delete = ON;             -- 삭제 시 즉시 덮어쓰기
```

### 마스터키 유도 방식 (PBKDF2 + 기기별 랜덤 솔트) — v1.2 패치

> **⚠️ v1.1 → v1.2 변경**: 고정 솔트(`b"aiflow_db_salt_v1"`) → **기기별 랜덤 16바이트 솔트**로 교체
> 고정 솔트는 레인보우 테이블 공격에 취약. 기기별 솔트는 테이블 사전 계산 완전 불가능.

```rust
// src-tauri/src/db/crypto.rs
use ring::pbkdf2;
use ring::rand::{SecureRandom, SystemRandom};
use zeroize::Zeroizing;

const ITERATIONS: u32 = 250_000;
const SALT_LEN: usize = 16; // 128비트 랜덤 솔트
const SALT_FILE: &str = "db_salt.bin"; // $APPDATA/aiflow/db_salt.bin

/// 기기별 솔트 — 최초 1회 생성 후 영구 보존
/// 절대 변경 금지 (변경 시 DB 재암호화 필요)
pub fn get_or_create_device_salt(app: &tauri::AppHandle) -> Result<Vec<u8>, String> {
    use tauri::Manager;
    let salt_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(SALT_FILE);

    if salt_path.exists() {
        // 기존 솔트 읽기
        let salt = std::fs::read(&salt_path).map_err(|e| e.to_string())?;
        if salt.len() != SALT_LEN {
            return Err("DB_005: 솔트 파일 손상됨".to_string());
        }
        Ok(salt)
    } else {
        // 최초 실행: 암호학적 난수로 솔트 생성
        let rng = SystemRandom::new();
        let mut salt = vec![0u8; SALT_LEN];
        rng.fill(&mut salt).map_err(|_| "솔트 생성 실패".to_string())?;

        // 솔트 파일 저장 (소유자만 읽기: chmod 600 상당)
        std::fs::write(&salt_path, &salt).map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        set_file_owner_only(&salt_path)?;

        tracing::info!("새 DB 솔트 생성 완료: {:?}", salt_path);
        Ok(salt)
    }
}

/// DB 암호화 키 유도 — 기기 솔트 + OS 키체인 마스터키
pub fn derive_db_key(master_key: &str, device_salt: &[u8]) -> Zeroizing<String> {
    let mut derived = Zeroizing::new([0u8; 32]);
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA512,
        std::num::NonZeroU32::new(ITERATIONS).unwrap(),
        device_salt,              // 기기별 랜덤 솔트
        master_key.as_bytes(),
        derived.as_mut(),
    );
    Zeroizing::new(hex::encode(derived.as_ref()))
}

/// Windows: 파일 소유자만 읽기 권한 설정
#[cfg(target_os = "windows")]
fn set_file_owner_only(path: &std::path::Path) -> Result<(), String> {
    use std::os::windows::fs::OpenOptionsExt;
    // FILE_ATTRIBUTE_HIDDEN | FILE_FLAG_BACKUP_SEMANTICS
    // 실제 ACL 설정은 windows-acl 크레이트 사용
    // Cargo.toml: windows-acl = "0.3" (Windows only)
    // acl::SimplifiedAcl::from_path(path)?.set_user_only()
    Ok(()) // TODO: Phase 1 구현 시 windows-acl 크레이트 적용
}
```

**솔트 교체 정책** (마이그레이션):
- 솔트는 **절대 변경 금지** — 변경 시 전체 DB 재암호화 필요
- `db_salt.bin` 분실 시 → DB 복호화 불가 (백업 필수)
- 솔트 파일 백업: `$APPDATA\aiflow\backups\db_salt.bin.bak` (DB 백업과 함께)

> **왜 PBKDF2인가**: 마스터키를 그대로 DB 키로 쓰면 마스터키 길이나 복잡도에 따라 강도가 달라짐.
> PBKDF2 25만 반복 + 기기별 랜덤 솔트로 레인보우 테이블 + 브루트포스 동시 방어.

### DB 백업 보안
- 백업 파일(`aiflow_YYYYMMDD.db`)도 동일한 SQLCipher 암호화 유지
- 백업 폴더: `$APPDATA\aiflow\backups\` (시스템 계정 소유)
- 백업 파일 외부 이동 시 동일 키 없으면 열람 불가

---

## 4. PII 보안 (프라이버시 모드)

### 마스킹 처리 보안 원칙
1. **로컬 전용**: OpenRedaction은 npm 번들 — 어떤 외부 서버에도 텍스트 전달 안 됨
2. **마스킹 전용**: 역마스킹 기능 미구현 (PrivacyLog.masking_map은 감사용 존재, 앱 UI에서 복원 불가)
3. **마스킹 맵 이중 보호**: SQLCipher 암호화 DB 내에 추가 AES-128 암호화로 저장
4. **PII 감지 실패 대응**: 감지 실패 시 사용자에게 "감지 오류 — 계속할까요?" 확인 요구

### 지원 PII 카테고리 (OpenRedaction 570+ 패턴)
| 카테고리 | 글로벌 | 한국 특화 |
|---------|--------|---------|
| 개인식별 | 이름, 생년월일, 여권번호 | 주민등록번호 (6자리-7자리), 외국인등록번호 |
| 연락처 | 이메일, 국제 전화번호 | 010/011/016/017/018/019 형식 |
| 금융 | 신용카드 (Luhn), IBAN | 한국 은행 계좌 (14자리 내외), 증권 계좌 |
| 위치 | GPS 좌표, IP 주소 | 한국 도로명주소, 지번주소, 5자리 우편번호 |
| 의료 | 진단 코드 (ICD-10) | 의료보험 번호, 건강보험 자격번호 |

### 파일 첨부 보안
```
파일 드롭 →
  1. 확장자 화이트리스트 검사 (settings.allowed_file_extensions)
  2. 파일 크기 검사 (최대 settings.max_file_size_mb, 기본 10MB)
  3. MIME 타입 검증 (확장자 위장 방지)
  4. 텍스트 추출 (Rust 내 처리, 프론트엔드 미노출)
  5. PII 감지 (프라이버시 모드 ON 시)
  6. extracted_text만 DB 저장 (원본 파일 경로는 참조만)
```

---

## 5. 네트워크 보안

### 허용 외부 통신 목록
| 대상 | 목적 | 필수 여부 |
|------|------|---------|
| api.openai.com | GPT AI 호출 | 선택 (키 설정 시) |
| api.anthropic.com | Claude AI 호출 | 선택 (키 설정 시) |
| generativelanguage.googleapis.com | Gemini AI 호출 | 선택 (키 설정 시) |
| localhost:11434 | Ollama 로컬 LLM | 선택 (Phase 2) |
| localhost:1234 | LM Studio 로컬 LLM | 선택 (Phase 2) |
| api.lemonsqueezy.com | 결제 처리 | 선택 (Pro 구매 시) |
| license.aiflow.app | 라이선스 검증 | Pro 시 1회 + 30일마다 |
| api.exchangerate-api.com | 환율 조회 | 선택, 1일 1회, 실패 시 폴백 |

### Tauri CSP (Content Security Policy)
```json
// tauri.conf.json
{
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none';",
    "dangerousDisableAssetCspModification": false
  }
}
```

> `connect-src 'none'`: 프론트엔드 JS에서 외부 네트워크 접근 완전 차단.
> 모든 외부 통신은 Rust `reqwest` 경유만 허용.

### TLS 설정
```rust
// Cargo.toml
reqwest = { version = "0.12", features = ["rustls-tls"], default-features = false }
// OpenSSL 대신 Rust-native TLS (rustls) — 더 안전하고 크로스 플랫폼

// TLS 1.2 이하 연결 자동 거부 (rustls 기본 동작)
```

---

## 6. MCP 서버 보안 (Phase 2)

### 허용 경로 화이트리스트
```rust
// src-tauri/src/commands/mcp.rs
pub fn validate_mcp_path_access(
    requested_path: &str,
    allowed_paths: &[String],
) -> Result<(), String> {
    let canonical = std::fs::canonicalize(requested_path)
        .map_err(|_| "ERR_MCP_PATH_INVALID".to_string())?;

    for allowed in allowed_paths {
        let allowed_canonical = std::fs::canonicalize(allowed)
            .unwrap_or_default();
        if canonical.starts_with(&allowed_canonical) {
            return Ok(());
        }
    }

    Err("ERR_MCP_PATH_FORBIDDEN".to_string())
}
```

### MCP 서버 설치 보안
- `MCPServer.command` 실행 전 사용자 명시적 승인 필요
- `allowed_paths` 기본값: 빈 배열 (아무 경로도 접근 불가)
- 사용자가 직접 허용 경로 추가 (설정 UI)
- MCP 서버 목록은 공식 레지스트리 + 사용자 직접 등록 (자동 설치 없음)

---

## 7. 브라우저 확장 보안 (Phase 2)

### Chrome Native Messaging 보안 모델
```json
// com.aiflow.companion.json (Native Messaging Host 매니페스트)
{
  "name": "com.aiflow.companion",
  "description": "AIFlow Native Host",
  "path": "C:\\Users\\<user>\\AppData\\Local\\AIFlow\\native-host.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://<EXTENSION_ID>/"
  ]
}
```

- `allowed_origins`: AIFlow 공식 확장 ID만 허용 (타 확장 접근 차단)
- Native Host는 메시지 수신 후 **오직 텍스트 추출만** 수행 (파일 접근·실행 없음)
- 확장이 전송하는 데이터: `{ url, title, selectedText }` — 개인정보 최소 수집

### 브라우저 확장 권한 (최소 권한 원칙)
```json
// browser-extension/manifest.json
{
  "permissions": ["nativeMessaging", "activeTab"],
  "host_permissions": []
}
// activeTab: 현재 활성 탭의 URL/title/선택된 텍스트만 (모든 탭 아님)
// host_permissions: 없음 (특정 도메인 권한 요청 없음)
```

---

## 8. 감사 로그 (AuditLog)

### 기록 대상 이벤트
| 이벤트 코드 | 발생 상황 |
|-----------|---------|
| `api_key_saved` | API 키 OS 키체인에 저장 |
| `api_key_deleted` | API 키 삭제 |
| `db_key_rotated` | DB 마스터키 로테이션 완료 |
| `license_verified` | 라이선스 온라인 검증 성공 |
| `license_activated` | Pro 라이선스 최초 활성화 |
| `data_exported` | 데이터 JSON 내보내기 실행 |
| `data_wiped` | 전체 데이터 삭제 실행 |
| `privacy_mode_on` | 프라이버시 모드 활성화 |
| `pii_detected` | PII 감지 후 마스킹 적용 |
| `mcp_server_installed` | MCP 서버 설치 |
| `hotkey_conflict` | 단축키 충돌 감지 |

### AuditLog 불변성 보장
```sql
-- AuditLog 테이블 생성 시 triggers로 수정 차단
CREATE TRIGGER audit_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is immutable');
END;

CREATE TRIGGER audit_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is immutable');
END;
```

---

## 9. 라이선스 보안

### 검증 흐름
```
앱 시작
  → DB에서 LicenseInfo 로드
  → tier == 'pro' 이면:
      → last_verified_at 확인
      → 30일 미만이면: 오프라인 valid (is_offline_valid = 1)
      → 30일 초과 또는 최초 활성화:
          → HTTPS로 license.aiflow.app/verify POST
          → 응답 200: is_offline_valid = 1, last_verified_at 갱신
          → 응답 403: 라이선스 무효 → Free 모드로 강제 전환
          → 네트워크 실패: 기존 오프라인 유효 기간 유지 (최대 30일)
```

### 라이선스 키 저장
- OS 키체인에만 저장 (DB에 평문 없음)
- 서버 검증 시 HTTPS POST body에 포함 (TLS 전송)
- 검증 응답: JWT 토큰 (서버 서명, 만료 포함) — 로컬 검증 가능

### 기기 제한 (1 라이선스 = 최대 2기기)
- 검증 시 `device_fingerprint` (CPU ID + 디스크 시리얼 해시) 전송
- 서버에서 2개 초과 기기 등록 시 오래된 기기 자동 해제 또는 사용자 선택

---

## 10. 데이터 보존 및 삭제

### 자동 삭제 스케줄 (앱 시작 시 실행)
```rust
// src-tauri/src/db/retention.rs
pub async fn apply_retention_policy(conn: &Connection, settings: &Settings) -> Result<(), String> {
    // 에러 로그 90일 보존
    conn.execute(
        "DELETE FROM error_log WHERE created_at < datetime('now', '-90 days')",
        [],
    )?;

    // 프라이버시 로그 N일 보존 (기본 30일)
    conn.execute(
        "DELETE FROM privacy_log WHERE created_at < datetime('now', ?)",
        rusqlite::params![format!("-{} days", settings.retention_privacy_log_days)],
    )?;

    // 브라우저 확장 컨텍스트 N일 보존 (기본 7일)
    conn.execute(
        "DELETE FROM browser_ext_contexts WHERE received_at < datetime('now', ?)",
        rusqlite::params![format!("-{} days", settings.retention_browser_ext_days)],
    )?;

    // 비용 로그 N개월 초과분 월별 집계로 압축 (기본 12개월)
    // ... 집계 로직

    Ok(())
}
```

### 전체 데이터 삭제 (GDPR "잊혀질 권리")
```rust
#[tauri::command]
pub async fn wipe_all_data(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbPool>,
) -> Result<(), String> {
    // 1. 감사 로그 기록 (삭제 직전)
    log_audit_event(&db, "data_wiped", None).await?;

    // 2. DB 파일 삭제
    let db_path = app.path().app_data_dir()?.join("aiflow.db");
    drop(db.lock().await); // DB 연결 해제
    std::fs::remove_file(&db_path)?;

    // 3. OS 키체인 모든 키 삭제
    for key in &["openai", "anthropic", "google", "db_master_key", "license_key"] {
        let _ = app.keyring().delete_password("aiflow", key);
    }

    // 4. 백업 폴더 삭제
    let backup_dir = app.path().app_data_dir()?.join("backups");
    let _ = std::fs::remove_dir_all(&backup_dir);

    // 5. 앱 재시작 안내
    Ok(())
}
```

---

## 11. 보안 체크리스트 (Phase별)

### Phase 1 보안 완료 기준
- [ ] API 키가 OS 키체인에 저장되고 DB·코드·로그에 평문이 없다
- [ ] DB가 SQLCipher AES-256으로 암호화된다 (PRAGMA cipher_memory_security ON)
- [ ] DB 마스터키가 PBKDF2-SHA512 25만 반복으로 유도된다
- [ ] Tauri CSP에 `connect-src 'none'` 설정되어 JS 외부 통신 차단된다
- [ ] AI API 호출이 Rust reqwest 경유 (JS 직접 호출 없음)
- [ ] 파일 드롭에 확장자 화이트리스트 + 크기 제한(10MB) 적용된다
- [ ] 단축키 등록/해제가 쌍으로 처리되고 충돌 감지 로직이 있다
- [ ] AuditLog 테이블에 UPDATE/DELETE trigger가 설정된다
- [ ] 마이그레이션 전 DB 자동 백업이 동작한다
- [ ] IPC invoke 파라미터가 Zod 스키마로 검증된다

### Phase 2 보안 완료 기준
- [ ] MCP 서버가 allowed_paths 외 경로 접근 시 ERR_MCP_PATH_FORBIDDEN 반환
- [ ] 브라우저 확장이 allowed_origins에 등록된 ID만 허용
- [ ] PII 마스킹 맵이 SQLCipher 내 추가 AES-128 레이어로 이중 암호화된다
- [ ] 데이터 보존 정책 자동 삭제가 앱 시작 시 실행된다
- [ ] 전체 데이터 삭제 기능이 DB + 키체인 + 백업 모두 제거한다
- [ ] 라이선스 검증이 HTTPS + JWT 서명으로 처리된다

### Phase 3 보안 완료 기준
- [ ] 플러그인 API 샌드박스가 적용된다 (타 앱 데이터 접근 차단)
- [ ] 마스터키 로테이션 기능이 정상 동작한다 (백업 → rekey → 검증)
- [ ] RAG 벡터 DB가 SQLCipher와 같은 마스터키로 암호화된다

---

## 12. 보안 갭 해소 (v1.1 패치)

> 이 섹션은 v1.0 검토 후 발견된 9개 보안 갭을 해소한다.
> MCP TOCTOU(갭 3)는 09_PLUGIN_API.md §5에서 canonicalize() 패턴으로 해소됨.

### 갭 1: OS 키체인 실패 시 폴백 정책

**문제**: Windows Credential Manager 접근 실패 시 API 키를 어떻게 처리하는가?

**확정 정책**: **Fail-Closed (폴백 없음)**

```rust
// src-tauri/src/security/keychain.rs
pub enum KeychainError {
    NotFound,
    AccessDenied,
    SystemError(String),
}

pub async fn get_api_key(provider: &str) -> Result<String, KeychainError> {
    keyring::Entry::new("aiflow", provider)
        .and_then(|e| e.get_password())
        .map_err(|e| match e {
            keyring::Error::NoEntry => KeychainError::NotFound,
            keyring::Error::NoStorageAccess(inner) => {
                // 접근 거부 — 사용자에게 즉시 알림, 절대 평문 파일로 폴백 금지
                log::error!("Keychain access denied: {inner}");
                KeychainError::AccessDenied
            }
            e => KeychainError::SystemError(e.to_string()),
        })
}

// Tauri Command에서 에러 처리
#[tauri::command]
pub async fn stream_ai(provider_id: i64, ...) -> Result<(), AiflowError> {
    match get_api_key(&provider_name).await {
        Ok(key) => { /* AI 호출 */ }
        Err(KeychainError::NotFound) => {
            return Err(AiflowError::new("AI_001", "API 키가 설정되지 않았습니다."));
        }
        Err(KeychainError::AccessDenied) => {
            // 파일시스템 폴백 절대 금지 — 사용자에게 복구 방법 안내
            return Err(AiflowError::new(
                "SEC_001",
                "OS 보안 저장소에 접근할 수 없습니다. Windows 자격증명 관리자를 확인하거나 앱을 재시작하세요."
            ));
        }
        Err(KeychainError::SystemError(e)) => {
            log::error!("Keychain system error: {e}");
            return Err(AiflowError::new("SEC_001", "보안 저장소 오류가 발생했습니다."));
        }
    }
}
```

**보안 체크리스트 추가**:
- [ ] Phase 1: API 키 저장 실패 시 에러 반환 (평문 파일 저장 코드 없음)
- [ ] Phase 1: `KeychainError::AccessDenied` 시 사용자에게 OS 재시작 안내

---

### 갭 2: JWT 공개키 배포 전략

**문제**: 라이선스 검증 JWT의 RS256 공개키를 어떻게 앱에 내장하고 교체하는가?

**확정 방식**: **공개키 바이너리 내장 (하드코딩) + 업데이트 시 교체**

```rust
// src-tauri/src/security/license.rs

// 공개키는 앱 바이너리에 컴파일 시 포함 (외부 파일 아님)
const LICENSE_PUBLIC_KEY_PEM: &str = include_str!("../keys/license_public_key.pem");
// keys/license_public_key.pem — public 정보, 커밋 가능

pub fn verify_license_jwt(token: &str) -> Result<LicenseClaims> {
    use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

    let key = DecodingKey::from_rsa_pem(LICENSE_PUBLIC_KEY_PEM.as_bytes())
        .map_err(|_| LicenseError::InvalidPublicKey)?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&["aiflow-client"]);
    validation.set_issuer(&["license.aiflow.app"]);

    decode::<LicenseClaims>(token, &key, &validation)
        .map(|d| d.claims)
        .map_err(LicenseError::JwtError)
}

// JWT Claims 구조
#[derive(Debug, serde::Deserialize)]
pub struct LicenseClaims {
    pub sub: String,         // 라이선스 키 ID
    pub tier: String,        // "pro"
    pub device_limit: u8,    // 2
    pub exp: u64,            // 만료 (30일 후)
    pub iat: u64,
    pub iss: String,         // "license.aiflow.app"
    pub aud: String,         // "aiflow-client"
    pub feature_flags: Vec<String>,  // 향후 기능 제어용
}
```

**공개키 교체 절차** (비밀키 노출 시):
1. 서버에서 새 RS256 키 쌍 생성
2. 앱 업데이트 (새 공개키 포함)로 배포
3. 서버에서 기존 키로 서명된 JWT 검증 중단
4. **주의**: 공개키 교체는 앱 업데이트와 함께 진행 — 앱 업데이트 전까지 기존 공개키 유효

---

### 갭 4: AES-128 마스킹 맵 키 관리

**문제**: PII 마스킹 맵의 AES-128 키를 어디에 저장하는가?

**확정 방식**: **DB 마스터키에서 HKDF로 분리 파생 (별도 저장 없음)**

```rust
// src-tauri/src/security/pii_crypto.rs
use ring::hkdf;

/// DB 마스터키에서 PII 마스킹 맵 암호화 키를 파생
/// 별도 키체인 항목 필요 없음 — DB 마스터키 하나로 모든 키 관리
pub fn derive_pii_key(master_key: &[u8]) -> [u8; 16] {
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, b"aiflow_pii_masking_map_v1");
    let prk = salt.extract(master_key);

    let mut pii_key = [0u8; 16]; // AES-128 = 16바이트
    prk.expand(&[b"pii-encryption-key"], hkdf::HKDF_SHA256)
        .unwrap()
        .fill(&mut pii_key)
        .unwrap();

    pii_key
}

/// PII 마스킹 맵 암호화 (AES-128-GCM)
pub fn encrypt_masking_map(data: &[u8], master_key: &[u8]) -> Result<Vec<u8>> {
    use aes_gcm::{Aes128Gcm, KeyInit, Nonce};
    use aes_gcm::aead::{Aead, OsRng};
    use aes_gcm::aead::rand_core::RngCore;

    let pii_key = derive_pii_key(master_key);
    let cipher = Aes128Gcm::new_from_slice(&pii_key)?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let mut ciphertext = cipher.encrypt(nonce, data)?;

    // nonce 앞에 붙여 반환 (12 + ciphertext)
    let mut result = nonce_bytes.to_vec();
    result.append(&mut ciphertext);
    Ok(result)
}
```

**보안 이점**: 마스터키 하나만 관리하면 PII 키도 자동으로 변경됨 (마스터키 로테이션 시 PII 키도 갱신).

---

### 갭 5: PBKDF2 반복 횟수 업그레이드 경로

**문제**: 미래에 25만 반복이 부족해질 경우 기존 DB를 어떻게 업그레이드하는가?

**확정 절차**: **DB 마이그레이션과 별도의 Key-Upgrade 프로세스**

```rust
// src-tauri/src/db/key_upgrade.rs

pub struct KdfParams {
    pub iterations: u32,
    pub algorithm: &'static str,
    pub version: u8,       // DB에 저장하여 현재 파라미터 추적
}

pub const CURRENT_KDF: KdfParams = KdfParams {
    iterations: 250_000,
    algorithm: "PBKDF2-SHA512",
    version: 1,
};

/// Settings 테이블에 kdf_version 컬럼 추가 (마이그레이션 파일로 관리)
/// kdf_version = 0 이면 구버전 (기본값)

pub async fn check_and_upgrade_kdf(
    conn: &Connection,
    master_key: &str,
) -> Result<()> {
    let stored_version: u8 = conn.query_row(
        "SELECT COALESCE(kdf_version, 0) FROM settings WHERE id = 1",
        [], |r| r.get(0)
    ).unwrap_or(0);

    if stored_version >= CURRENT_KDF.version {
        return Ok(());  // 이미 최신
    }

    log::info!("KDF upgrade needed: v{stored_version} → v{}", CURRENT_KDF.version);

    // 1. 마이그레이션 전 백업 (기존 backup_before_migration 재사용)
    backup_before_migration(conn).await?;

    // 2. 새 파라미터로 키 재유도
    let new_key = derive_db_key_with_params(master_key, &CURRENT_KDF);

    // 3. SQLCipher rekey
    conn.execute_batch(&format!("PRAGMA rekey = '{new_key}'"))?;

    // 4. kdf_version 업데이트
    conn.execute(
        "UPDATE settings SET kdf_version = ?1 WHERE id = 1",
        [CURRENT_KDF.version],
    )?;

    // 5. AuditLog 기록
    log_audit_event(conn, "kdf_upgraded", Some(&format!(
        "v{stored_version} → v{}", CURRENT_KDF.version
    ))).await?;

    log::info!("KDF upgrade complete: {} iterations", CURRENT_KDF.iterations);
    Ok(())
}
```

**업그레이드 트리거**: 앱 시작 시 자동 확인 (사용자 개입 없음).

---

### 갭 6: 브라우저 확장 ID 관리

**문제**: Native Messaging `allowed_origins`에 들어갈 확장 ID를 어떻게 발급·관리하는가?

**확정 방식**: **Chrome Web Store 등록 후 ID 고정 + 릴리즈 빌드에 하드코딩**

```
Chrome Web Store 등록 → 고정 Extension ID 획득
  예: abcdefghijklmnopqrstuvwxyz123456

Unpacked 개발 로드 시 ID 다름 → 개발자 모드에서만 다른 ID 허용 (옵션)
```

```json
// src-tauri/src/resources/com.aiflow.companion.json
// (빌드 시 자동으로 APPDATA 경로로 설치됨)
{
  "allowed_origins": [
    "chrome-extension://abcdefghijklmnopqrstuvwxyz123456/"
  ]
}
```

```rust
// src-tauri/src/security/browser_ext.rs

// 개발 빌드: 추가 ID 허용 (환경변수로 제어)
#[cfg(debug_assertions)]
pub fn get_allowed_extension_ids() -> Vec<String> {
    let mut ids = vec![
        "abcdefghijklmnopqrstuvwxyz123456".to_string()  // 프로덕션 ID
    ];

    // DEV_EXTENSION_ID 환경변수로 개발 중 임시 ID 추가
    if let Ok(dev_id) = std::env::var("DEV_EXTENSION_ID") {
        if dev_id.len() == 32 && dev_id.chars().all(|c| c.is_ascii_lowercase()) {
            ids.push(dev_id);
        }
    }
    ids
}

#[cfg(not(debug_assertions))]
pub fn get_allowed_extension_ids() -> Vec<String> {
    vec!["abcdefghijklmnopqrstuvwxyz123456".to_string()]
}
```

**ID 변경 절차** (확장 재배포 시 ID 변경 불가 — Chrome CWS 정책):
- 동일 확장 유지 시 ID 고정됨 → 앱 업데이트 불필요
- 확장 계정 변경으로 ID 바뀔 경우 → 앱 업데이트 필수

---

### 갭 7: 보안 파일 삭제 (Secure File Deletion)

**문제**: DB 파일, 백업 파일 삭제 시 `std::fs::remove_file`만으로는 데이터 복구 가능.

**확정 방식**: **SQLCipher `secure_delete ON` + 파일 삭제 전 덮어쓰기**

```rust
// src-tauri/src/security/secure_delete.rs

/// 파일을 덮어쓴 후 삭제 (Windows DoD 표준 준수)
pub async fn secure_delete_file(path: &std::path::Path) -> Result<()> {
    use tokio::io::AsyncWriteExt;

    let file_size = tokio::fs::metadata(path).await?.len();

    // 3패스 덮어쓰기:
    // Pass 1: 0x00
    // Pass 2: 0xFF
    // Pass 3: 랜덤 데이터
    let passes: &[u8] = &[0x00, 0xFF];

    for &byte in passes {
        let mut f = tokio::fs::OpenOptions::new()
            .write(true)
            .open(path)
            .await?;

        let buf = vec![byte; 4096];
        let mut written = 0u64;
        while written < file_size {
            let to_write = std::cmp::min(buf.len() as u64, file_size - written) as usize;
            f.write_all(&buf[..to_write]).await?;
            written += to_write as u64;
        }
        f.flush().await?;
    }

    // Pass 3: 랜덤
    {
        use ring::rand::{SecureRandom, SystemRandom};
        let rng = SystemRandom::new();
        let mut f = tokio::fs::OpenOptions::new()
            .write(true)
            .open(path)
            .await?;

        let mut buf = vec![0u8; 4096];
        let mut written = 0u64;
        while written < file_size {
            let to_write = std::cmp::min(buf.len() as u64, file_size - written) as usize;
            rng.fill(&mut buf[..to_write]).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            f.write_all(&buf[..to_write]).await?;
            written += to_write as u64;
        }
        f.flush().await?;
    }

    // 최종 삭제
    tokio::fs::remove_file(path).await?;

    log::debug!("Securely deleted: {}", path.display());
    Ok(())
}

// wipe_all_data에서 적용:
// std::fs::remove_file(&db_path) → secure_delete_file(&db_path).await
```

**적용 대상**: DB 파일, 백업 파일, 임시 추출 파일.
**SSD 참고**: SSD wear-leveling으로 덮어쓰기가 항상 원본 블록에 적용되지 않을 수 있음 — SQLCipher 암호화가 1차 보호. 덮어쓰기는 2차 보호 (최선 노력 방식).

---

### 임시 파일 보안 정책 (v1.2 신규)

**임시 디렉토리**: `$APPDATA\aiflow\temp\`

| 항목 | 정책 |
|------|------|
| 위치 | `%APPDATA%\aiflow\temp\` (시스템 temp 디렉토리 절대 사용 금지) |
| 파일명 | UUID 기반 랜덤 (`{uuid}.tmp`) — 내용 추측 불가 |
| 권한 | 소유자 읽기/쓰기만 (타 계정 접근 차단) |
| 최대 크기 | 파일 1개당 10MB, 디렉토리 전체 100MB |
| 수명 | 작업 완료 즉시 삭제 (성공/실패 모두) |
| 앱 시작 시 | `temp/` 폴더 내 모든 파일 삭제 (이전 크래시 잔여물 제거) |
| 앱 종료 시 | `temp/` 폴더 전체 삭제 |

```rust
// src-tauri/src/file/temp_manager.rs
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;
use zeroize::Zeroize;

pub struct TempFileGuard {
    path: PathBuf,
}

impl TempFileGuard {
    /// 임시 파일 생성 — Drop 시 자동 안전 삭제
    pub async fn create(app: &tauri::AppHandle) -> Result<Self, String> {
        let temp_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("temp");

        tokio::fs::create_dir_all(&temp_dir)
            .await
            .map_err(|e| e.to_string())?;

        let path = temp_dir.join(format!("{}.tmp", Uuid::new_v4()));
        Ok(Self { path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        // Drop 시 항상 삭제 (성공/실패 무관)
        if self.path.exists() {
            // 내용 덮어쓰기 후 삭제
            if let Ok(size) = std::fs::metadata(&self.path).map(|m| m.len()) {
                if let Ok(mut f) = std::fs::OpenOptions::new().write(true).open(&self.path) {
                    use std::io::Write;
                    let zeros = vec![0u8; size as usize];
                    let _ = f.write_all(&zeros);
                }
            }
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// 앱 시작 시 잔여 임시 파일 전체 삭제
pub async fn cleanup_temp_dir(app: &tauri::AppHandle) -> Result<(), String> {
    let temp_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("temp");

    if temp_dir.exists() {
        let mut dir = tokio::fs::read_dir(&temp_dir)
            .await
            .map_err(|e| e.to_string())?;

        let mut deleted = 0u32;
        while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
            if entry.path().extension().map_or(false, |ext| ext == "tmp") {
                let _ = tokio::fs::remove_file(entry.path()).await;
                deleted += 1;
            }
        }

        if deleted > 0 {
            tracing::warn!("시작 시 잔여 임시 파일 {}개 삭제", deleted);
        }
    }
    Ok(())
}

// 사용 패턴:
// let temp = TempFileGuard::create(&app).await?;
// process_file(temp.path())?;
// // → temp가 스코프 벗어나면 자동 삭제 (panic 포함)
```

**보안 체크리스트 추가**:
- [ ] 임시 파일이 `$APPDATA\aiflow\temp\` 외부 경로에 생성되지 않음 (경로 트래버설 방지)
- [ ] 파일 처리 실패 시에도 `TempFileGuard` Drop으로 자동 삭제됨 확인
- [ ] 앱 시작 시 `cleanup_temp_dir()` 호출됨 확인
- [ ] `temp/` 디렉토리 권한: 앱 소유자만 접근 (Windows ACL 확인)

---

### 갭 8: AuditLog 내보내기 정책

**문제**: AuditLog는 불변이지만 사용자가 내보내거나 삭제할 수 있는가?

**확정 정책**:

| 작업 | 허용 여부 | 이유 |
|------|---------|------|
| AuditLog 읽기 (UI 표시) | ✅ 허용 | 사용자 본인 데이터 |
| AuditLog JSON 내보내기 | ✅ 허용 | GDPR "데이터 이동권" |
| AuditLog 삭제 (개별) | ❌ 금지 | 감사 무결성 침해 |
| AuditLog 전체 삭제 | ⚠️ 조건부 | "전체 데이터 삭제" 시에만 허용 |

```rust
// src-tauri/src/commands/audit.rs

#[tauri::command]
pub async fn export_audit_log(
    db: tauri::State<'_, DbPool>,
    from: Option<String>,  // ISO 8601
    to: Option<String>,
) -> Result<Vec<AuditLogEntry>, AiflowError> {
    // 읽기만 — 수정 불가
    let entries = sqlx::query_as!(
        AuditLogEntry,
        "SELECT id, event_type, details, created_at FROM audit_log
         WHERE (?1 IS NULL OR created_at >= ?1)
           AND (?2 IS NULL OR created_at <= ?2)
         ORDER BY created_at DESC
         LIMIT 10000",
        from, to
    )
    .fetch_all(db.pool())
    .await
    .map_err(AiflowError::from)?;

    // 내보내기 행위 자체도 감사 기록
    log_audit_event(&db, "audit_log_exported", Some(&format!(
        "count={}", entries.len()
    ))).await?;

    Ok(entries)
}

// 전체 삭제 시 AuditLog도 포함 (wipe_all_data에 이미 포함)
// 단, wipe_all_data 직전 AuditLog에 "data_wiped" 기록 후 DB 파일 자체 삭제
```

---

### 갭 9: 스트리밍 취소 시 비용 계산

**문제**: 사용자가 스트리밍을 중간에 취소하면 실제 청구된 토큰 수를 어떻게 기록하는가?

**확정 방식**: **취소 시점의 수신 토큰 수 추정 + `stream_cancelled = true` 플래그**

```rust
// src-tauri/src/commands/ai.rs

#[tauri::command]
pub async fn cancel_stream(
    stream_id: String,
    active_streams: tauri::State<'_, ActiveStreams>,
    db: tauri::State<'_, DbPool>,
) -> Result<(), AiflowError> {
    let stream = active_streams.get(&stream_id)
        .ok_or(AiflowError::new("AI_005", "스트림을 찾을 수 없습니다."))?;

    // 취소 시점 정보 수집
    let received_tokens = stream.token_count.load(Ordering::Relaxed);
    let elapsed_ms = stream.start_time.elapsed().as_millis() as u64;

    // 스트림 중단
    stream.cancel_token.cancel();

    // 메시지 업데이트: 부분 응답으로 저장
    sqlx::query!(
        "UPDATE messages SET
            content = ?1,
            stream_cancelled = 1,
            output_tokens = ?2,    -- 취소 시점까지 받은 토큰 (추정)
            cost_usd = ?3,
            duration_ms = ?4
         WHERE id = ?5",
        stream.partial_content.lock().await.as_str(),
        received_tokens,
        calculate_partial_cost(stream.provider_id, stream.input_tokens, received_tokens),
        elapsed_ms,
        stream.message_id,
    )
    .execute(db.pool())
    .await?;

    log::info!(
        "Stream cancelled: message_id={}, tokens={}/{}, cost_estimate=${:.4}",
        stream.message_id,
        received_tokens,
        stream.input_tokens,
        calculate_partial_cost(stream.provider_id, stream.input_tokens, received_tokens),
    );

    Ok(())
}

/// 부분 응답 비용 계산
/// 주의: 취소 시점 output 토큰은 추정값 (실제 청구는 input만 확정)
fn calculate_partial_cost(provider_id: i64, input_tokens: u32, output_tokens: u32) -> f64 {
    let pricing = get_provider_pricing(provider_id);
    // input은 전체 청구됨 (취소해도)
    // output은 취소 시점까지만 (추정)
    (input_tokens as f64 * pricing.input_per_token)
        + (output_tokens as f64 * pricing.output_per_token)
}
```

**UI 표시**:
```
[사용자가 중지한 응답 — 부분 내용만 표시됨]
💰 ~$0.002 (추정) · ⚠️ 취소됨
```

---

### 보안 체크리스트 추가 (v1.1)

#### Phase 1 추가 항목
- [ ] Keychain 접근 실패 시 평문 폴백 코드 없음 (grep으로 확인)
- [ ] `derive_pii_key()`가 HKDF로 마스터키에서 파생됨 (별도 저장 없음)
- [ ] 스트리밍 취소 시 부분 비용이 `stream_cancelled = 1` 플래그와 함께 DB에 기록됨
- [ ] AuditLog 내보내기 시 내보내기 행위 자체도 AuditLog에 기록됨
- [ ] `db_salt.bin` 파일 생성 확인 (`$APPDATA\aiflow\db_salt.bin` 존재)
- [ ] 솔트 길이 16바이트 확인 (8바이트 미만 금지)
- [ ] `TempFileGuard` Drop 동작 단위 테스트 통과 (파일 삭제 확인)
- [ ] `cleanup_temp_dir()` 앱 시작 시 호출 확인 (`lib.rs` setup 함수)
- [ ] `temp/` 디렉토리 내 `.tmp` 외 다른 확장자 파일 없음 확인

#### Phase 2 추가 항목
- [ ] 확장 ID 화이트리스트가 릴리즈 빌드에 하드코딩됨 (DEV_EXTENSION_ID 환경변수 릴리즈에 미노출)
- [ ] DB 파일 삭제 시 `secure_delete_file()` (3패스 덮어쓰기) 적용됨

#### Phase 3 추가 항목
- [ ] `kdf_version` 컬럼이 Settings에 있고, 앱 시작 시 자동 KDF 업그레이드 실행됨
- [ ] JWT 공개키 교체 절차 문서가 내부 위키에 기록됨
