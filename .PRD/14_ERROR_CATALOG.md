# AIFlow — 에러 카탈로그 v1.0

> 생성: 2026-03-28
> **이 문서는 Rust 백엔드 + TypeScript 프론트엔드의 에러 코드 단일 진실 원천(SSOT)**
> 에러 코드를 추가/변경 시 반드시 이 문서를 먼저 업데이트

---

## 에러 코드 체계

```
{카테고리}_{번호}

카테고리:
  AI     — AI Provider 관련 (요청, 응답, 스트리밍)
  AUTH   — 인증, API 키, 라이선스
  DB     — 데이터베이스 (SQLCipher, 마이그레이션)
  NET    — 네트워크 (연결, 타임아웃)
  FILE   — 파일 처리 (업로드, 파싱)
  KEYCHAIN — OS 키체인
  RATE   — Rate Limit
  CANCEL — 취소 관련
  PRIV   — 프라이버시 모드
  UPD    — 업데이터
  PLUGIN — 플러그인 (Phase 3)
  SYS    — 시스템 (메모리, 권한)
  VAL    — 입력값 검증 (Zod)
```

---

## AI Provider 에러 (AI_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `AI_001` | API 키 없음 | API 키가 설정되지 않았습니다. 설정에서 {provider} API 키를 입력해주세요. | API key not set. Please add your {provider} key in Settings. | 설정 화면 열기 | error |
| `AI_002` | 잘못된 요청 (400) | 요청 형식이 올바르지 않습니다. 메시지를 확인해주세요. | Invalid request format. Please check your message. | 재입력 유도 | warning |
| `AI_003` | AI 서버 오류 (5xx) | {provider} 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요. | {provider} server error. Please try again in a moment. | 재시도 버튼 | error |
| `AI_004` | 컨텍스트 초과 | 대화가 너무 길어 모델 한도를 초과했습니다. 새 대화를 시작하거나 이전 메시지를 삭제해주세요. | Context length exceeded. Start a new conversation or delete earlier messages. | 새 대화 시작 버튼 | warning |
| `AI_005` | 모델 미지원 | 선택한 모델({model})은 현재 사용할 수 없습니다. 다른 모델을 선택해주세요. | Model {model} is not available. Please select a different model. | 모델 선택 UI 열기 | warning |
| `AI_006` | 응답 파싱 실패 | AI 응답을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요. | Failed to parse AI response. Please try again. | 재시도 버튼 | error |
| `AI_007` | 스트림 중단 | 응답 수신이 중단되었습니다. 네트워크 상태를 확인해주세요. | Stream interrupted. Please check your network connection. | 재시도 버튼 | warning |
| `AI_008` | 콘텐츠 정책 위반 | AI가 요청을 처리할 수 없습니다. 다른 방식으로 질문해주세요. | The AI cannot process this request. Please rephrase your question. | 메시지 수정 유도 | warning |
| `AI_009` | 로컬 LLM 미실행 | 로컬 AI가 실행 중이지 않습니다. Ollama를 시작해주세요. | Local AI is not running. Please start Ollama first. | Ollama 실행 가이드 링크 | error |

---

## 인증 에러 (AUTH_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `AUTH_001` | API 키 인증 실패 (401) | API 키가 올바르지 않습니다. {provider} 키를 다시 확인해주세요. | Invalid API key. Please verify your {provider} key. | 설정 화면 열기 | error |
| `AUTH_002` | API 키 만료 | API 키가 만료되었거나 비활성화되었습니다. 새 키를 발급받아 주세요. | API key expired or disabled. Please generate a new key. | 설정 화면 열기 | error |
| `AUTH_003` | 라이선스 없음 | Pro 기능입니다. 업그레이드하면 이 기능을 사용할 수 있습니다. | This is a Pro feature. Upgrade to unlock it. | 업그레이드 화면 | info |
| `AUTH_004` | 라이선스 만료 | Pro 구독이 만료되었습니다. 갱신 후 계속 사용하세요. | Your Pro subscription has expired. Please renew. | 갱신 화면 열기 | warning |
| `AUTH_005` | 라이선스 오프라인 초과 | 인터넷 연결 없이 30일이 지났습니다. 연결 후 라이선스를 확인해주세요. | Offline license check expired (30 days). Please connect to verify. | 연결 요청 | warning |
| `AUTH_006` | API 키 검증 실패 | API 키를 확인하는 중 오류가 발생했습니다. 키가 올바른지 확인해주세요. | Failed to validate API key. Please check if the key is correct. | 재시도 버튼 | error |

---

## 데이터베이스 에러 (DB_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `DB_001` | 쿼리 실패 | 데이터를 저장하는 중 오류가 발생했습니다. 앱을 재시작해주세요. | Failed to save data. Please restart the app. | 재시작 버튼 | error |
| `DB_002` | DB 잠금 | 데이터베이스가 잠겨 있습니다. 잠시 후 다시 시도해주세요. | Database is locked. Please try again in a moment. | 자동 재시도 (3회) | warning |
| `DB_003` | 마이그레이션 실패 | 앱 업데이트 중 데이터 마이그레이션이 실패했습니다. 지원팀에 문의해주세요. | Database migration failed during update. Please contact support. | 지원팀 문의 링크 | critical |
| `DB_004` | DB 파일 없음 | 데이터베이스 파일을 찾을 수 없습니다. 앱을 재설치해주세요. | Database file not found. Please reinstall the app. | 재설치 가이드 | critical |
| `DB_005` | 암호화 키 불일치 | 데이터베이스 암호화 키가 올바르지 않습니다. | Database encryption key mismatch. | 지원팀 문의 | critical |
| `DB_006` | 디스크 공간 부족 | 저장 공간이 부족합니다. 불필요한 파일을 삭제해주세요. | Not enough disk space. Please free up storage. | 저장소 확인 | error |
| `DB_007` | 백업 실패 | 데이터 백업에 실패했습니다. 경로를 확인해주세요. | Backup failed. Please check the backup path. | 경로 선택 다이얼로그 | warning |
| `DB_008` | 가져오기 실패 | 데이터를 가져오는 중 오류가 발생했습니다. 파일 형식을 확인해주세요. | Import failed. Please verify the file format. | 파일 재선택 | warning |

---

## 네트워크 에러 (NET_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `NET_001` | 연결 실패 | {provider} 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요. | Cannot connect to {provider}. Please check your internet connection. | 재시도 버튼 | error |
| `NET_002` | 타임아웃 | 응답 시간이 초과되었습니다. {provider} 서버가 느릴 수 있습니다. | Request timed out. {provider} servers may be slow. | 재시도 버튼 | warning |
| `NET_003` | TLS 오류 | 보안 연결을 수립할 수 없습니다. 시스템 시간을 확인해주세요. | Cannot establish secure connection. Please check your system clock. | 시스템 시간 확인 안내 | error |
| `NET_004` | 프록시 오류 | 프록시 서버를 통한 연결에 실패했습니다. 프록시 설정을 확인해주세요. | Proxy connection failed. Please check your proxy settings. | 프록시 설정 안내 | error |
| `NET_005` | DNS 오류 | 서버 주소를 확인할 수 없습니다. DNS 설정을 확인해주세요. | Cannot resolve server address. Please check your DNS settings. | 네트워크 진단 안내 | error |

---

## 파일 에러 (FILE_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `FILE_001` | 파일 크기 초과 | 파일 크기가 {max_mb}MB를 초과합니다 ({actual_mb}MB). 더 작은 파일을 사용해주세요. | File size exceeds {max_mb}MB ({actual_mb}MB). Please use a smaller file. | 파일 재선택 안내 | warning |
| `FILE_002` | 지원하지 않는 형식 | 지원하지 않는 파일 형식입니다 ({ext}). 지원 형식: {supported_formats} | Unsupported file format ({ext}). Supported: {supported_formats} | 지원 형식 안내 | warning |
| `FILE_003` | PDF 파싱 실패 | PDF 파일을 읽을 수 없습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다. | Cannot read PDF file. It may be corrupted or password-protected. | 다른 파일 시도 안내 | warning |
| `FILE_004` | 이미지 처리 실패 | 이미지를 처리하는 중 오류가 발생했습니다. | Failed to process image. | 다른 파일 시도 안내 | warning |
| `FILE_005` | 파일 접근 거부 | 파일에 접근할 수 없습니다. 파일 권한을 확인해주세요. | Cannot access file. Please check file permissions. | 권한 설정 안내 | warning |
| `FILE_006` | 경로 트래버설 | 허용되지 않는 파일 경로입니다. | Invalid file path detected. | 보안 경고 표시 | error |

---

## OS 키체인 에러 (KEYCHAIN_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `KEYCHAIN_001` | 키체인 접근 실패 | API 키를 불러올 수 없습니다. 설정에서 API 키를 다시 입력해주세요. | Cannot load API key. Please re-enter your API key in Settings. | 설정 화면 열기 | error |
| `KEYCHAIN_002` | 키체인 저장 실패 | API 키를 안전하게 저장할 수 없습니다. Windows 자격 증명 관리자를 확인해주세요. | Cannot save API key securely. Please check Windows Credential Manager. | 자격 증명 관리자 열기 | error |
| `KEYCHAIN_003` | 키체인 삭제 실패 | API 키를 삭제하는 중 오류가 발생했습니다. | Failed to delete API key from keychain. | 재시도 버튼 | warning |
| `KEYCHAIN_004` | 폴백 복호화 실패 | 저장된 키를 복호화할 수 없습니다. API 키를 다시 입력해주세요. | Cannot decrypt stored key. Please re-enter your API key. | 설정 화면 열기 | error |

---

## Rate Limit 에러 (RATE_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `RATE_001` | Rate Limit 초과 (429) | 요청 한도를 초과했습니다. {retry_after}초 후 자동으로 재시도합니다. | Rate limit exceeded. Retrying in {retry_after} seconds. | 자동 재시도 (카운트다운) | warning |
| `RATE_002` | 일일 한도 초과 | 오늘의 API 사용량이 한도에 도달했습니다. 내일 다시 시도하거나 한도를 늘려주세요. | Daily API quota exceeded. Try again tomorrow or increase your quota. | {provider} 대시보드 링크 | warning |
| `RATE_003` | 분당 토큰 초과 | 분당 토큰 한도를 초과했습니다. 잠시 후 다시 시도해주세요. | Tokens per minute limit exceeded. Please try again shortly. | 자동 재시도 (60초) | warning |

---

## 취소 에러 (CANCEL_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `CANCEL_001` | 사용자 취소 | 생성이 취소되었습니다. | Generation cancelled. | 없음 (정상 취소) | info |
| `CANCEL_002` | 앱 종료 시 취소 | 앱 종료로 생성이 중단되었습니다. | Generation interrupted by app shutdown. | 없음 | info |

---

## 프라이버시 에러 (PRIV_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `PRIV_001` | PII 감지 실패 | 개인정보 감지 중 오류가 발생했습니다. 계속 진행할까요? | PII detection failed. Do you want to continue anyway? | 계속/취소 선택 다이얼로그 | warning |
| `PRIV_002` | 마스킹 실패 | 개인정보 마스킹에 실패했습니다. 전송을 취소합니다. | PII masking failed. Message sending cancelled. | 재시도 버튼 | error |
| `PRIV_003` | 프라이버시 모드 저장 시도 | 프라이버시 모드에서는 대화가 저장되지 않습니다. | Messages are not saved in privacy mode. | 없음 (정보 표시) | info |

---

## 업데이터 에러 (UPD_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `UPD_001` | 업데이트 서버 연결 실패 | 업데이트 서버에 연결할 수 없습니다. 나중에 다시 확인해주세요. | Cannot reach update server. Check again later. | 나중에 확인 버튼 | info |
| `UPD_002` | 업데이트 다운로드 실패 | 업데이트 파일 다운로드에 실패했습니다. 다시 시도해주세요. | Update download failed. Please try again. | 재시도 버튼 | warning |
| `UPD_003` | 서명 검증 실패 | 업데이트 파일의 서명이 올바르지 않습니다. 보안을 위해 설치를 취소합니다. | Update signature invalid. Installation cancelled for security. | 공식 사이트 다운로드 안내 | critical |
| `UPD_004` | 설치 실패 | 업데이트 설치에 실패했습니다. 앱을 재시작해주세요. | Update installation failed. Please restart the app. | 재시작 버튼 | error |

---

## 입력값 검증 에러 (VAL_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `VAL_001` | 필수 필드 없음 | 필수 항목을 입력해주세요: {field} | Required field missing: {field} | 필드 포커스 | warning |
| `VAL_002` | 값 너무 짧음 | {field}은(는) 최소 {min}자 이상이어야 합니다. | {field} must be at least {min} characters. | 필드 포커스 | warning |
| `VAL_003` | 값 너무 긺 | {field}은(는) 최대 {max}자까지 입력 가능합니다. | {field} must be at most {max} characters. | 필드 포커스 | warning |
| `VAL_004` | 형식 불일치 | {field} 형식이 올바르지 않습니다. | Invalid format for {field}. | 입력 힌트 표시 | warning |
| `VAL_005` | API 키 형식 오류 | {provider} API 키 형식이 올바르지 않습니다. 키를 다시 확인해주세요. | Invalid {provider} API key format. Please double-check. | 형식 예시 표시 | warning |

---

## 시스템 에러 (SYS_xxx)

| 코드 | 원인 | 한국어 메시지 | 영어 메시지 | 복구 행동 | 심각도 |
|------|------|-------------|------------|----------|--------|
| `SYS_001` | 메모리 부족 | 사용 가능한 메모리가 부족합니다. 다른 앱을 닫아주세요. | Insufficient memory. Please close other applications. | 없음 | error |
| `SYS_002` | 권한 없음 | 이 작업을 수행할 권한이 없습니다. | Permission denied for this action. | 관리자 권한 안내 | error |
| `SYS_003` | 단축키 충돌 | 단축키 {shortcut}가 다른 앱과 충돌합니다. 다른 단축키를 선택해주세요. | Shortcut {shortcut} conflicts with another app. Please choose a different one. | 단축키 설정 화면 | warning |
| `SYS_004` | 단축키 등록 실패 | 단축키를 등록할 수 없습니다. 다른 단축키를 시도해주세요. | Cannot register shortcut. Please try a different one. | 단축키 설정 화면 | error |

---

## Rust 구현 패턴

```rust
// src-tauri/src/error.rs — 통합 에러 타입

use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AiFlowError {
    // AI
    #[error("AI_001")]
    ApiKeyNotSet { provider: String },
    #[error("AI_003")]
    ProviderServerError { provider: String, status: u16 },
    #[error("AI_004")]
    ContextLengthExceeded,
    #[error("AI_007")]
    StreamInterrupted,

    // Auth
    #[error("AUTH_001")]
    ApiKeyInvalid { provider: String },
    #[error("AUTH_003")]
    ProFeatureRequired { feature: String },

    // DB
    #[error("DB_001")]
    DatabaseError { detail: String },
    #[error("DB_002")]
    DatabaseLocked,
    #[error("DB_003")]
    MigrationFailed { detail: String },

    // Network
    #[error("NET_001")]
    ConnectionFailed { provider: String },
    #[error("NET_002")]
    RequestTimeout { provider: String },

    // File
    #[error("FILE_001")]
    FileTooLarge { max_mb: u32, actual_mb: u32 },
    #[error("FILE_002")]
    UnsupportedFileFormat { ext: String },

    // Keychain
    #[error("KEYCHAIN_001")]
    KeychainReadFailed,
    #[error("KEYCHAIN_002")]
    KeychainWriteFailed,

    // Rate
    #[error("RATE_001")]
    RateLimitExceeded { retry_after: u64 },

    // Cancel
    #[error("CANCEL_001")]
    UserCancelled,

    // System
    #[error("SYS_003")]
    ShortcutConflict { shortcut: String },
}

/// Tauri command 반환용 직렬화
impl AiFlowError {
    pub fn to_ipc_error(&self) -> serde_json::Value {
        serde_json::json!({
            "code": self.to_string(),
            "message": self.user_message_ko(),
        })
    }

    pub fn user_message_ko(&self) -> String {
        match self {
            Self::ApiKeyNotSet { provider } =>
                format!("API 키가 설정되지 않았습니다. 설정에서 {} API 키를 입력해주세요.", provider),
            Self::ProviderServerError { provider, .. } =>
                format!("{} 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.", provider),
            Self::ContextLengthExceeded =>
                "대화가 너무 길어 모델 한도를 초과했습니다. 새 대화를 시작해주세요.".to_string(),
            Self::ApiKeyInvalid { provider } =>
                format!("API 키가 올바르지 않습니다. {} 키를 다시 확인해주세요.", provider),
            Self::ProFeatureRequired { .. } =>
                "Pro 기능입니다. 업그레이드하면 이 기능을 사용할 수 있습니다.".to_string(),
            Self::DatabaseError { .. } =>
                "데이터를 저장하는 중 오류가 발생했습니다. 앱을 재시작해주세요.".to_string(),
            Self::ConnectionFailed { provider } =>
                format!("{} 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.", provider),
            Self::RequestTimeout { .. } =>
                "응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.".to_string(),
            Self::FileTooLarge { max_mb, actual_mb } =>
                format!("파일 크기가 {}MB를 초과합니다 ({}MB).", max_mb, actual_mb),
            Self::UnsupportedFileFormat { ext } =>
                format!("지원하지 않는 파일 형식입니다 (.{}).", ext),
            Self::KeychainReadFailed =>
                "API 키를 불러올 수 없습니다. 설정에서 API 키를 다시 입력해주세요.".to_string(),
            Self::RateLimitExceeded { retry_after } =>
                format!("요청 한도를 초과했습니다. {}초 후 자동으로 재시도합니다.", retry_after),
            Self::UserCancelled =>
                "생성이 취소되었습니다.".to_string(),
            Self::ShortcutConflict { shortcut } =>
                format!("단축키 {}가 다른 앱과 충돌합니다. 다른 단축키를 선택해주세요.", shortcut),
            _ => "알 수 없는 오류가 발생했습니다.".to_string(),
        }
    }
}

// Tauri command에서 사용
// Result<T, AiFlowError> → Tauri가 자동으로 JSON 직렬화
impl From<AiFlowError> for String {
    fn from(e: AiFlowError) -> Self {
        serde_json::to_string(&e.to_ipc_error()).unwrap_or_default()
    }
}
```

---

## TypeScript 에러 처리 패턴

```typescript
// src/lib/errors.ts — 프론트엔드 에러 처리

import { toast } from 'sonner';  // shadcn/ui toast

export interface IpcError {
  code: string;
  message: string;
  detail?: string;
}

export function isIpcError(err: unknown): err is IpcError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err
  );
}

// 에러 코드별 UI 액션
export const ERROR_ACTIONS: Record<string, {
  action?: { label: string; onClick: () => void };
  duration?: number;
}> = {
  'AI_001': {
    action: { label: '설정 열기', onClick: () => navigateTo('/settings/api-keys') },
  },
  'AUTH_003': {
    action: { label: '업그레이드', onClick: () => navigateTo('/upgrade') },
    duration: 8000,
  },
  'RATE_001': {
    duration: 5000, // 자동 재시도 카운트다운 토스트
  },
  'NET_001': {
    action: { label: '재시도', onClick: () => window.location.reload() },
  },
  'DB_003': {
    action: { label: '지원 문의', onClick: () => openExternalLink('https://aiflow.app/support') },
    duration: Infinity,
  },
};

// 전역 에러 핸들러
export function handleIpcError(err: unknown, fallbackMessage = '오류가 발생했습니다'): void {
  if (isIpcError(err)) {
    const config = ERROR_ACTIONS[err.code] ?? {};
    const severity = getErrorSeverity(err.code);

    const toastFn = severity === 'critical' ? toast.error
      : severity === 'warning' ? toast.warning
      : toast.info;

    toastFn(err.message, {
      description: err.code,
      action: config.action,
      duration: config.duration ?? 4000,
    });

    // 심각한 에러는 Sentry에도 전송 (PII 제거 후)
    if (severity === 'critical' || severity === 'error') {
      reportError(err);
    }
  } else {
    toast.error(fallbackMessage);
  }
}

function getErrorSeverity(code: string): 'critical' | 'error' | 'warning' | 'info' {
  const prefix = code.split('_')[0];
  const num = parseInt(code.split('_')[1] ?? '0');

  if (['DB_003', 'DB_004', 'DB_005', 'UPD_003'].includes(code)) return 'critical';
  if (['AUTH', 'KEYCHAIN', 'NET'].includes(prefix)) return 'error';
  if (['RATE', 'FILE', 'VAL', 'PRIV', 'SYS'].includes(prefix)) return 'warning';
  return 'info';
}

// 사용 예
// try {
//   await invokeValidated('stream_ai_message', ...);
// } catch (err) {
//   handleIpcError(err, '메시지 전송에 실패했습니다');
// }
```

---

## 다국어 메시지 (i18n 연동)

```typescript
// src/i18n/errors.ts — 에러 코드별 다국어 메시지 키

export const ERROR_I18N_KEYS: Record<string, string> = {
  'AI_001': 'error.ai.apiKeyNotSet',
  'AI_003': 'error.ai.serverError',
  'AI_004': 'error.ai.contextExceeded',
  'AUTH_001': 'error.auth.invalidKey',
  'AUTH_003': 'error.auth.proRequired',
  'DB_001': 'error.db.queryFailed',
  'NET_001': 'error.net.connectionFailed',
  'NET_002': 'error.net.timeout',
  'FILE_001': 'error.file.tooLarge',
  'FILE_002': 'error.file.unsupportedFormat',
  'KEYCHAIN_001': 'error.keychain.readFailed',
  'RATE_001': 'error.rate.exceeded',
  'CANCEL_001': 'error.cancel.userCancelled',
  'SYS_003': 'error.sys.shortcutConflict',
  // ... 전체 에러 코드
};

// 에러 메시지 가져오기 (i18n 적용)
export function getErrorMessage(code: string, params?: Record<string, string>): string {
  const key = ERROR_I18N_KEYS[code];
  if (!key) return code; // 알 수 없는 코드 → 코드 자체 표시
  return t(key, params); // i18next
}
```

---

## 에러 코드 빠른 참조

```
AI_001  API 키 없음          → 설정 열기
AI_003  서버 오류            → 재시도
AI_004  컨텍스트 초과        → 새 대화
AI_007  스트림 중단          → 재시도
AUTH_001 키 인증 실패        → 설정 열기
AUTH_003 Pro 기능            → 업그레이드
DB_001  DB 쿼리 실패         → 재시작
DB_003  마이그레이션 실패    → 지원 문의 [CRITICAL]
NET_001 연결 실패            → 재시도
NET_002 타임아웃             → 재시도
FILE_001 파일 너무 큼        → 더 작은 파일
FILE_002 지원 안 되는 형식   → 형식 확인
KEYCHAIN_001 키체인 실패     → 재입력
RATE_001 Rate Limit          → 자동 재시도
CANCEL_001 사용자 취소       → (정상)
SYS_003 단축키 충돌          → 단축키 변경
UPD_003 서명 검증 실패       → 재설치 [CRITICAL]
VAL_001 필수 필드 없음       → 입력 안내
```

---

> **관련 문서**
> - [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) — `invokeValidated()`, Rust command 구현
> - [05_SECURITY_SPEC.md](./05_SECURITY_SPEC.md) — 보안 에러 처리 (PII 마스킹)
> - [11_MONITORING_SPEC.md](./11_MONITORING_SPEC.md) — Sentry 에러 추적, PII 필터링
> - [13_ZOD_SCHEMAS.md](./13_ZOD_SCHEMAS.md) — IPC 입력 검증 (VAL_xxx 에러 방지)
