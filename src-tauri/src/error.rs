use serde::Serialize;
use thiserror::Error;

/// AIFlow 에러 카탈로그 코드 — 14_ERROR_CATALOG.md SSOT와 동기화
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    // AI Provider 에러
    Ai001, // API 키 없음
    Ai002, // 잘못된 요청 (400)
    Ai003, // AI 서버 오류 (5xx)
    Ai004, // 컨텍스트 초과
    Ai005, // 모델 미지원
    Ai006, // 응답 파싱 실패
    Ai007, // 스트림 중단
    Ai008, // 콘텐츠 정책 위반
    Ai009, // 로컬 LLM 미실행
    // 인증 에러
    Auth001, // API 키 인증 실패
    Auth002, // API 키 만료
    Auth003, // 라이선스 없음
    Auth004, // 라이선스 만료
    Auth006, // API 키 검증 실패
    // DB 에러
    Db001, // DB 초기화 실패
    Db002, // 마이그레이션 실패
    Db003, // 쿼리 실패
    // 키체인 에러
    Keychain001, // OS 키체인 접근 실패
    Keychain002, // 키체인 항목 없음
    // 네트워크 에러
    Net001, // 연결 없음
    Net002, // 타임아웃
    // Rate Limit
    Rate001, // Provider rate limit
    Rate002, // 내부 rate limit
    // 취소
    Cancel001, // 스트림 취소
    // 시스템
    Sys001, // 내부 오류
}

/// IPC 경계를 넘는 에러 페이로드 — 프론트엔드 ErrorResponseSchema와 계약 일치
#[derive(Debug, Serialize)]
pub struct IpcError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl IpcError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            detail: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

/// Tauri command가 반환하는 에러 타입
#[derive(Debug, Error)]
pub enum AppError {
    #[error("DB error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("IPC error: {code:?} — {message}")]
    Ipc { code: ErrorCode, message: String },
}

impl AppError {
    pub fn ipc(code: ErrorCode, message: impl Into<String>) -> Self {
        Self::Ipc {
            code,
            message: message.into(),
        }
    }
}

/// Tauri command return 타입: Result<T, IpcError>
/// IpcError는 JSON으로 직렬화돼 프론트엔드에 전달됨
impl From<AppError> for IpcError {
    fn from(e: AppError) -> Self {
        match e {
            AppError::Ipc { code, message } => IpcError::new(code, message),
            AppError::Database(e) => IpcError::new(ErrorCode::Db003, "Database query failed")
                .with_detail(e.to_string()),
            AppError::Http(e) => {
                if e.is_timeout() {
                    IpcError::new(ErrorCode::Net002, "Request timed out")
                } else if e.is_connect() {
                    IpcError::new(ErrorCode::Net001, "No network connection")
                } else {
                    IpcError::new(ErrorCode::Ai003, "HTTP request failed").with_detail(e.to_string())
                }
            }
            AppError::Io(e) => {
                IpcError::new(ErrorCode::Sys001, "IO error").with_detail(e.to_string())
            }
            AppError::Serde(e) => {
                IpcError::new(ErrorCode::Ai006, "Failed to parse response").with_detail(e.to_string())
            }
        }
    }
}

/// Tauri command 반환 타입 별칭
pub type CommandResult<T> = Result<T, IpcError>;
