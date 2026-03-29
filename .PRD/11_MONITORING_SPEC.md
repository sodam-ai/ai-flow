# AIFlow — 모니터링 명세서 v1.0

> 생성: 2026-03-27 (v1.0)
> 대상: 에러 추적, 앱 건강 지표, 사용 분석, 로그 전략, 충돌 보고

---

## 목차

1. [모니터링 철학](#1-모니터링-철학)
2. [로컬 로그 시스템](#2-로컬-로그-시스템)
3. [Sentry 에러 추적](#3-sentry-에러-추적)
4. [앱 건강 지표 (Heartbeat)](#4-앱-건강-지표-heartbeat)
5. [익명 사용 분석](#5-익명-사용-분석)
6. [충돌 보고 (Crash Report)](#6-충돌-보고-crash-report)
7. [성능 모니터링 통합](#7-성능-모니터링-통합)
8. [사용자 피드백 수집](#8-사용자-피드백-수집)
9. [대시보드 및 알람](#9-대시보드-및-알람)
10. [데이터 보존 및 삭제](#10-데이터-보존-및-삭제)

---

## 1. 모니터링 철학

### 수집 원칙 (Privacy-by-Design)

| 원칙 | 내용 |
|------|------|
| **최소 수집** | 운영에 필요한 최소 정보만 수집 |
| **익명화** | 개인 식별 정보 절대 수집 금지 |
| **옵트인** | 익명 분석은 사용자 동의 후 활성화 |
| **로컬 우선** | 가능하면 로컬 DB에 저장, 외부 전송 최소화 |
| **투명성** | 수집 항목을 설정 화면에서 명확히 표시 |

### 수집 절대 금지 항목

```
❌ 대화 내용 (메시지 텍스트)
❌ API 키 (일부라도)
❌ 파일 내용 (첨부 파일)
❌ 사용자 이름·이메일·주소
❌ AI 응답 내용
❌ IP 주소 (원격 수집 시)
❌ 기기 고유 식별자 (MAC, 하드웨어 ID)
```

### 수집 허용 항목 (익명)

```
✅ 앱 버전
✅ OS 버전 (Windows 10/11, 빌드 번호)
✅ 기능 사용 횟수 (메시지 전송 횟수, 오버레이 열기 횟수)
✅ AI 제공자 종류 (openai/anthropic/google, 모델명 X)
✅ 에러 코드 + 스택 트레이스 (PII 필터링 후)
✅ 성능 지표 (TTFT 분포, 오버레이 열림 시간)
✅ 충돌 발생 위치 (파일·줄 번호, 메시지 내용 X)
✅ 앱 시작/종료 이벤트
```

---

## 2. 로컬 로그 시스템

### 로그 레벨 전략

```rust
// src-tauri/src/logging.rs

use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logging() {
    let log_dir = tauri::api::path::app_log_dir(&tauri::Config::default())
        .unwrap_or_else(|_| std::path::PathBuf::from("logs"));

    std::fs::create_dir_all(&log_dir).ok();

    let log_file = log_dir.join("aiflow.log");

    // 파일 로거 (로테이션 포함)
    let file_appender = tracing_appender::rolling::RollingFileAppender::new(
        tracing_appender::rolling::Rotation::DAILY,
        log_dir,
        "aiflow.log",
    );

    // 로그 레벨: 프로덕션=WARN, 개발=DEBUG
    let filter = if cfg!(debug_assertions) {
        EnvFilter::new("aiflow=debug,tauri=warn,reqwest=warn")
    } else {
        EnvFilter::new("aiflow=warn,tauri=error")
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(file_appender)
        .with_ansi(false)       // 파일에 ANSI 색상 코드 제거
        .with_target(true)      // 모듈 경로 포함
        .with_line_number(true) // 줄 번호 포함
        .compact()
        .init();
}
```

### 로그 파일 위치 및 관리

```
로그 파일 위치:
  %APPDATA%\com.sodamai.aiflow\logs\
  ├── aiflow.log            ← 오늘 로그
  ├── aiflow.log.2026-03-26 ← 어제 로그
  └── aiflow.log.2026-03-25 ← 그저께 로그

보존 정책:
  - 일별 로테이션
  - 최근 7일 보존
  - 각 파일 최대 50MB (초과 시 강제 로테이션)
```

```rust
// 오래된 로그 파일 삭제 (앱 시작 시)
pub fn cleanup_old_logs(log_dir: &Path, keep_days: u64) -> Result<()> {
    let cutoff = std::time::SystemTime::now()
        - std::time::Duration::from_secs(keep_days * 24 * 3600);

    for entry in std::fs::read_dir(log_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map(|e| e == "log").unwrap_or(false) {
            if let Ok(modified) = entry.metadata()?.modified() {
                if modified < cutoff {
                    std::fs::remove_file(&path)?;
                    log::debug!("Removed old log: {}", path.display());
                }
            }
        }
    }
    Ok(())
}
```

### 로그 레벨별 사용 기준

| 레벨 | 사용 상황 | 예시 |
|------|---------|------|
| `ERROR` | 즉각 대응 필요, 사용자 영향 | DB 연결 실패, 암호화 오류 |
| `WARN` | 주의 필요, 서비스 계속 | API 레이트 리밋, 느린 응답 |
| `INFO` | 주요 흐름 기록 | 앱 시작, AI 요청 완료, 마이그레이션 완료 |
| `DEBUG` | 개발 시 상세 정보 | IPC 파라미터, DB 쿼리 시간 |
| `TRACE` | 매우 세밀한 추적 (기본 비활성) | 토큰 스트리밍 청크 |

```rust
// 올바른 로그 사용 예

// ERROR: 복구 불가 상황
tracing::error!(error = %e, "Database encryption failed — app cannot continue");

// WARN: 폴백 동작
tracing::warn!(
    provider = %provider_name,
    latency_ms = %latency,
    "Provider slow, consider routing to alternative"
);

// INFO: 성공 흐름
tracing::info!(
    message_id = %message_id,
    tokens_in = %input_tokens,
    tokens_out = %output_tokens,
    cost_usd = %cost,
    "AI response completed"
);

// DEBUG: 개발용 (프로덕션 필터됨)
tracing::debug!(conversation_id = %id, page = %page, "Loading messages paginated");
```

---

## 3. Sentry 에러 추적

### 설정 원칙

- **옵트아웃 가능**: 기본 활성, 설정에서 비활성화 가능
- **PII 필터링 필수**: 대화 내용·API 키·파일명 전송 금지
- **샘플링**: 트랜잭션 10%, 에러 100%
- **릴리즈 태깅**: 버전별 에러 추이 추적

```toml
# src-tauri/Cargo.toml
[dependencies]
sentry = { version = "0.34", default-features = false, features = [
    "backtrace",      # 스택 트레이스
    "contexts",       # OS/런타임 컨텍스트
    "panic",          # 패닉 핸들러
    "reqwest",        # HTTP transport
    "rustls",         # TLS (OpenSSL 미사용)
] }
```

```rust
// src-tauri/src/telemetry/sentry.rs

use sentry::ClientOptions;

pub fn init_sentry(dsn: Option<&str>, app_version: &str) -> sentry::ClientInitGuard {
    let dsn = dsn.unwrap_or("").parse().ok();

    sentry::init(ClientOptions {
        dsn,
        release: Some(app_version.to_string().into()),
        environment: Some(if cfg!(debug_assertions) { "development" } else { "production" }.into()),

        // 10% 트랜잭션 샘플링 (성능 데이터)
        traces_sample_rate: 0.1,

        // PII 필터링 — 이벤트 전송 전 검사
        before_send: Some(std::sync::Arc::new(|mut event| {
            // 대화 내용 포함 이벤트 차단
            if let Some(msg) = &event.message {
                if contains_potential_pii(msg) {
                    return None;  // 전송 차단
                }
            }

            // 스택 트레이스에서 민감한 값 제거
            sanitize_breadcrumbs(&mut event.breadcrumbs);

            // 사용자 식별 정보 제거 (user 필드 초기화)
            event.user = None;

            Some(event)
        })),

        // 성능 트랜잭션 필터링
        before_send_transaction: Some(std::sync::Arc::new(|transaction| {
            // /api/key, /api/license 등 민감한 경로 차단
            if transaction.name.as_deref().map(|n| n.contains("key") || n.contains("license")).unwrap_or(false) {
                return None;
            }
            Some(transaction)
        })),

        ..Default::default()
    })
}

/// 잠재적 PII 포함 여부 간단 검사
fn contains_potential_pii(text: &str) -> bool {
    // API 키 패턴
    text.contains("sk-") ||
    text.contains("sk-ant-") ||
    // 한국 전화번호 패턴
    text.contains("010-") ||
    // 이메일 패턴 (간단)
    (text.contains('@') && text.contains('.'))
}

fn sanitize_breadcrumbs(breadcrumbs: &mut sentry::protocol::Values<sentry::protocol::Breadcrumb>) {
    for crumb in &mut breadcrumbs.values {
        // 브레드크럼 메시지에서 API 키 패턴 제거
        if let Some(msg) = &crumb.message {
            if msg.contains("sk-") || msg.contains("Bearer ") {
                crumb.message = Some("[REDACTED API KEY]".to_string());
            }
        }
    }
}
```

### Sentry 컨텍스트 수집

```rust
// 에러 발생 시 컨텍스트 추가 (PII 없는 정보만)
pub fn capture_ai_error(error_code: &str, provider: &str, error: &anyhow::Error) {
    sentry::with_scope(
        |scope| {
            // AI 제공자 종류만 (API 키 없음)
            scope.set_tag("ai.provider", provider);
            scope.set_tag("error.code", error_code);
            scope.set_extra("ai.provider", provider.into());
        },
        || sentry::capture_error(error),
    );
}

// 사용 예:
// capture_ai_error("AI_003", "openai", &rate_limit_error);
// → Sentry에서 "openai rate limit 에러 추이" 추적 가능
```

### Sentry 에러 분류

```rust
// 에러 코드별 Sentry 심각도 매핑
pub fn error_severity(code: &str) -> sentry::Level {
    match code {
        "DB_002" => sentry::Level::Fatal,    // 마이그레이션 실패
        "DB_001" => sentry::Level::Error,    // DB 잠금
        "SEC_001" => sentry::Level::Error,   // 키체인 실패
        "AI_005" => sentry::Level::Warning,  // 스트리밍 오류
        "AI_003" => sentry::Level::Info,     // 레이트 리밋 (정상 동작)
        "NET_001" => sentry::Level::Info,    // 네트워크 없음 (정상 상황)
        _ => sentry::Level::Warning,
    }
}
```

---

## 4. 앱 건강 지표 (Heartbeat)

### 로컬 건강 체크 (앱 내부)

```rust
// src-tauri/src/health/checker.rs

#[derive(Debug, serde::Serialize)]
pub struct HealthStatus {
    pub db_connected: bool,
    pub db_encrypted: bool,
    pub keychain_accessible: bool,
    pub ai_providers_configured: u8,  // 설정된 제공자 수 (키값 없음)
    pub disk_space_mb: u64,           // 앱 데이터 디렉토리 여유 공간
    pub log_size_mb: f64,
    pub memory_mb: u64,
    pub uptime_seconds: u64,
}

pub async fn check_health(
    db: &Database,
    start_time: std::time::Instant,
) -> HealthStatus {
    // DB 연결 + 암호화 확인
    let (db_connected, db_encrypted) = match verify_db_encryption(db).await {
        Ok(_) => (true, true),
        Err(_) => (false, false),
    };

    // 키체인 접근 확인 (더미 읽기 시도)
    let keychain_accessible = keyring::Entry::new("aiflow", "_health_check")
        .and_then(|e| e.get_password())
        .map(|_| true)
        .unwrap_or(true);  // NoEntry도 접근 가능으로 판단

    HealthStatus {
        db_connected,
        db_encrypted,
        keychain_accessible,
        ai_providers_configured: count_configured_providers(db).await.unwrap_or(0),
        disk_space_mb: get_available_disk_space(),
        log_size_mb: get_log_size_mb(),
        memory_mb: get_process_memory_mb(),
        uptime_seconds: start_time.elapsed().as_secs(),
    }
}

/// 앱 시작 30초 후 + 주기적으로 실행 (이상 감지)
pub fn start_health_monitor(app: tauri::AppHandle, db: Database) {
    tokio::spawn(async move {
        // 시작 30초 후 첫 체크
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

        loop {
            let health = check_health(&db, app.state::<AppState>().start_time).await;

            // 이상 상태 감지
            if !health.db_connected {
                log::error!("Health check FAILED: DB not connected");
                app.emit("health-alert", serde_json::json!({
                    "type": "db_disconnected",
                    "message": "데이터베이스 연결이 끊겼습니다."
                })).ok();
            }

            if health.disk_space_mb < 100 {
                log::warn!("Low disk space: {}MB remaining", health.disk_space_mb);
                app.emit("health-alert", serde_json::json!({
                    "type": "low_disk",
                    "message": format!("디스크 공간이 부족합니다: {}MB 남음", health.disk_space_mb)
                })).ok();
            }

            // 10분마다 체크
            tokio::time::sleep(tokio::time::Duration::from_secs(600)).await;
        }
    });
}
```

### 건강 상태 UI

```tsx
// src/components/HealthBadge.tsx
// 설정 > 정보 화면에서 표시

interface HealthBadgeProps {
  status: HealthStatus;
}

export function HealthBadge({ status }: HealthBadgeProps) {
  const issues = [
    !status.db_connected && 'DB 연결 오류',
    !status.keychain_accessible && '키체인 접근 불가',
    status.disk_space_mb < 100 && `디스크 ${status.disk_space_mb}MB 부족`,
  ].filter(Boolean);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span className="text-sm">시스템 정상</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-red-400">
      <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
      <span className="text-sm">{issues[0]}</span>
    </div>
  );
}
```

---

## 5. 익명 사용 분석

### 수집 항목 및 방법

```rust
// src-tauri/src/telemetry/analytics.rs
// 사용자 동의 시에만 활성화 (기본: 활성)

#[derive(Debug, serde::Serialize)]
pub struct UsageEvent {
    pub event: String,          // 이벤트 종류
    pub app_version: String,
    pub os_version: String,     // "Windows 11 23H2"
    pub timestamp: u64,         // Unix timestamp
    // PII 없음 — 사용자 ID, IP, 기기 ID 없음
}

// 수집 이벤트 목록
pub enum AnalyticsEvent {
    AppStarted,
    OverlayOpened,
    MessageSent { provider_type: &'static str },  // "openai", "anthropic", "google" (모델명 X)
    StreamCancelled,
    FileAttached { file_type: &'static str },      // "pdf", "image", "code"
    PrivacyModeToggled { enabled: bool },
    SettingsOpened,
    OnboardingCompleted,
    ProUpgraded,
}

impl AnalyticsEvent {
    pub fn to_event_name(&self) -> &'static str {
        match self {
            Self::AppStarted => "app_started",
            Self::OverlayOpened => "overlay_opened",
            Self::MessageSent { .. } => "message_sent",
            Self::StreamCancelled => "stream_cancelled",
            Self::FileAttached { .. } => "file_attached",
            Self::PrivacyModeToggled { .. } => "privacy_mode_toggled",
            Self::SettingsOpened => "settings_opened",
            Self::OnboardingCompleted => "onboarding_completed",
            Self::ProUpgraded => "pro_upgraded",
        }
    }
}
```

### 분석 데이터 처리

```rust
// 로컬 집계 후 배치 전송 (실시간 전송 금지)
pub struct AnalyticsBuffer {
    events: Vec<UsageEvent>,
    last_flush: std::time::Instant,
}

impl AnalyticsBuffer {
    /// 이벤트 추가 (즉시 전송 안 함)
    pub fn track(&mut self, event: AnalyticsEvent, settings: &Settings) {
        if !settings.analytics_enabled {
            return;
        }

        self.events.push(UsageEvent {
            event: event.to_event_name().to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            os_version: get_os_version_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }

    /// 하루 1회 배치 전송 (앱 시작 시 확인)
    pub async fn flush_if_needed(&mut self) -> Result<()> {
        if self.last_flush.elapsed().as_secs() < 86400 {
            return Ok(());  // 24시간 이전이면 스킵
        }

        if self.events.is_empty() {
            self.last_flush = std::time::Instant::now();
            return Ok(());
        }

        let payload = std::mem::take(&mut self.events);
        self.send_batch(payload).await?;
        self.last_flush = std::time::Instant::now();
        Ok(())
    }

    async fn send_batch(&self, events: Vec<UsageEvent>) -> Result<()> {
        // analytics.aiflow.app 엔드포인트로 전송
        // 실패해도 앱 동작에 영향 없음 (silent fail)
        let client = crate::http::get_http_client();
        let _ = client
            .post("https://analytics.aiflow.app/v1/batch")
            .json(&events)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        log::debug!("Analytics batch flushed: {} events", events.len());
        Ok(())
    }
}
```

### 분석 동의 UI

```tsx
// src/components/AnalyticsConsent.tsx
// 첫 실행 온보딩 마지막 단계에서 표시

export function AnalyticsConsent({ onAccept, onDecline }: ConsentProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">익명 사용 데이터 수집</h3>
      <p className="text-sm text-muted-foreground">
        AIFlow 개선을 위해 익명 사용 데이터를 수집합니다.
        대화 내용, API 키, 개인정보는 절대 수집되지 않습니다.
      </p>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">
          수집 항목 보기
        </summary>
        <ul className="mt-2 ml-4 space-y-1 list-disc">
          <li>앱 버전, OS 버전</li>
          <li>기능 사용 횟수 (메시지 수, 오버레이 열기 횟수)</li>
          <li>AI 제공자 종류 (OpenAI/Anthropic/Google 중 선택)</li>
          <li>에러 발생 횟수 및 종류</li>
        </ul>
      </details>

      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="flex-1 bg-accent-primary text-white rounded-lg py-2"
        >
          동의하고 시작하기
        </button>
        <button
          onClick={onDecline}
          className="px-4 text-muted-foreground hover:text-foreground"
        >
          거절
        </button>
      </div>
    </div>
  );
}
```

---

## 6. 충돌 보고 (Crash Report)

### 자동 충돌 감지

```rust
// src-tauri/src/crash/handler.rs

pub fn setup_crash_handler() {
    // Rust 패닉 핸들러
    std::panic::set_hook(Box::new(|info| {
        let location = info.location().map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".to_string());

        let message = info.payload()
            .downcast_ref::<&str>()
            .copied()
            .unwrap_or("unknown panic");

        // 로컬 파일에 충돌 정보 저장
        let crash_info = serde_json::json!({
            "type": "panic",
            "location": location,
            "message": sanitize_crash_message(message),  // PII 제거
            "app_version": env!("CARGO_PKG_VERSION"),
            "os_version": get_os_version_string(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        save_crash_report(crash_info);

        // Sentry에도 전송
        sentry::capture_message(
            &format!("Panic at {location}: {message}"),
            sentry::Level::Fatal,
        );
    }));
}

fn sanitize_crash_message(msg: &str) -> String {
    // API 키, 경로, 개인정보 패턴 제거
    let re_apikey = regex::Regex::new(r"sk-[A-Za-z0-9]{20,}").unwrap();
    let re_path = regex::Regex::new(r"C:\\Users\\[^\\]+").unwrap();

    let sanitized = re_apikey.replace_all(msg, "[API_KEY]");
    let sanitized = re_path.replace_all(&sanitized, "C:\\Users\\[USER]");
    sanitized.to_string()
}

fn save_crash_report(info: serde_json::Value) {
    let crash_dir = get_app_data_dir().join("crashes");
    std::fs::create_dir_all(&crash_dir).ok();

    let filename = format!("crash_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
    let path = crash_dir.join(filename);

    if let Ok(content) = serde_json::to_string_pretty(&info) {
        std::fs::write(&path, content).ok();
        log::error!("Crash report saved: {}", path.display());
    }
}
```

### 충돌 보고서 UI (재시작 후)

```tsx
// src/components/CrashReport.tsx
// 이전 충돌 감지 시 재시작 직후 표시

export function CrashReportDialog({ crashInfo, onDismiss }: CrashReportProps) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await invoke('send_crash_report', { crashId: crashInfo.id });
    setSending(false);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel-bg rounded-2xl p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-xl font-semibold">⚠️ 예기치 않게 종료되었습니다</h2>
        <p className="text-sm text-muted-foreground">
          AIFlow가 이전 세션에서 예기치 않게 종료되었습니다.
          충돌 보고서를 전송하면 이 문제를 빠르게 수정하는 데 도움이 됩니다.
        </p>
        <p className="text-xs text-muted-foreground bg-input-bg rounded p-3">
          보고서에는 오류 발생 위치와 앱 버전만 포함되며,
          대화 내용이나 개인정보는 포함되지 않습니다.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 bg-accent-primary text-white rounded-lg py-2 disabled:opacity-50"
          >
            {sending ? '전송 중...' : '보고서 전송'}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 text-muted-foreground hover:text-foreground"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. 성능 모니터링 통합

### 실시간 성능 지표 수집

```rust
// src-tauri/src/telemetry/perf.rs

#[derive(Debug)]
pub struct PerfMetrics {
    pub ttft_ms: u32,           // 첫 토큰 응답 시간
    pub total_duration_ms: u32, // 전체 응답 시간
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub provider: String,       // 제공자 이름 (키 없음)
    pub stream_cancelled: bool,
}

/// AI 요청 완료 후 성능 메트릭 기록
pub fn record_request_metrics(metrics: &PerfMetrics, settings: &Settings) {
    // 1. 로컬 ErrorLog/DB에 기록 (항상)
    // 2. 분석 버퍼에 추가 (동의 시)
    // 3. 느린 응답은 WARN 로그

    if metrics.ttft_ms > 2000 {
        tracing::warn!(
            provider = %metrics.provider,
            ttft_ms = metrics.ttft_ms,
            "Slow TTFT detected"
        );

        // Sentry에 성능 이슈 기록 (익명)
        sentry::configure_scope(|scope| {
            scope.set_tag("perf.slow_ttft", "true");
            scope.set_extra("ttft_ms", metrics.ttft_ms.into());
        });
    }
}

/// TTFT 분포 추적 (로컬 DB)
pub async fn update_provider_latency(
    db: &Database,
    provider_id: i64,
    latency_ms: u32,
) -> Result<()> {
    // ai_providers.avg_latency_ms 이동 평균 업데이트 (스마트 라우팅에 활용)
    sqlx::query!(
        "UPDATE ai_providers SET
            avg_latency_ms = (avg_latency_ms * 0.8 + ?1 * 0.2),
            updated_at = datetime('now')
         WHERE id = ?2",
        latency_ms,
        provider_id,
    )
    .execute(db.pool())
    .await?;

    Ok(())
}
```

### 성능 대시보드 (설정 화면)

```tsx
// src/views/settings/DiagnosticsView.tsx

export function DiagnosticsView() {
  const { data: health } = useQuery('health', fetchHealthStatus);
  const { data: perf } = useQuery('perf-stats', fetchPerfStats);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold mb-3">시스템 상태</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="DB 상태" value={health?.db_connected ? "정상" : "오류"} />
          <StatCard label="메모리" value={`${health?.memory_mb}MB`} />
          <StatCard label="업타임" value={formatUptime(health?.uptime_seconds)} />
          <StatCard label="로그 크기" value={`${health?.log_size_mb?.toFixed(1)}MB`} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-3">AI 성능 (최근 7일)</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="평균 TTFT" value={`${perf?.avgTtftMs}ms`} />
          <StatCard label="총 메시지" value={`${perf?.totalMessages}`} />
          <StatCard label="취소율" value={`${perf?.cancelRate}%`} />
        </div>
      </section>
    </div>
  );
}
```

---

## 8. 사용자 피드백 수집

### 인앱 피드백 (PRO 기능 또는 오류 발생 시)

```tsx
// src/components/FeedbackForm.tsx
// 에러 발생 후 "문제를 신고하시겠습니까?" 모달에서 사용

export function FeedbackForm({ errorCode, onSubmit, onDismiss }: FeedbackProps) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'bug' | 'suggestion' | 'other'>('bug');

  const handleSubmit = async () => {
    if (!message.trim()) return;

    // 전송 전 사용자 텍스트 PII 검사 경고
    if (message.length > 10) {
      const hasPii = detectPii(message);
      if (hasPii) {
        // 개인정보 포함 경고 표시
        setShowPiiWarning(true);
        return;
      }
    }

    await invoke('submit_feedback', {
      category,
      message,          // 사용자가 직접 입력한 텍스트
      errorCode,        // 에러 코드 (AI_003 등)
      appVersion: APP_VERSION,
      osVersion: await getOsVersion(),
    });

    onSubmit();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">문제 신고</h3>

      <div className="flex gap-2">
        {(['bug', 'suggestion', 'other'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs ${
              category === cat ? 'bg-accent-primary text-white' : 'bg-input-bg'
            }`}
          >
            {{ bug: '버그', suggestion: '제안', other: '기타' }[cat]}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="무슨 일이 있었나요? (개인정보를 포함하지 마세요)"
        className="w-full bg-input-bg rounded-lg p-3 text-sm resize-none"
        rows={4}
        maxLength={500}
      />

      <p className="text-xs text-muted-foreground">
        ⚠️ 이름, 전화번호, API 키 등 개인정보를 포함하지 마세요.
      </p>

      <div className="flex justify-end gap-3">
        <button onClick={onDismiss} className="text-muted-foreground text-sm">취소</button>
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          className="bg-accent-primary text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
```

### GitHub Issues 연동

```rust
// src-tauri/src/feedback/submitter.rs
// 사용자 피드백을 GitHub Issues API로 전송

#[tauri::command]
pub async fn submit_feedback(
    category: String,
    message: String,
    error_code: Option<String>,
    app_version: String,
    os_version: String,
) -> Result<(), AiflowError> {
    // PII 최종 검사
    if contains_potential_pii(&message) {
        return Err(AiflowError::new(
            "FEEDBACK_001",
            "피드백에 개인정보가 포함되었습니다. 제거 후 다시 시도하세요."
        ));
    }

    let body = format!(
        "**카테고리**: {category}\n\
         **에러 코드**: {}\n\
         **앱 버전**: {app_version}\n\
         **OS**: {os_version}\n\n\
         ---\n\n\
         {message}",
        error_code.as_deref().unwrap_or("없음"),
    );

    // GitHub Issues API (공개 레포)
    let client = crate::http::get_http_client();
    client
        .post("https://api.github.com/repos/sodamai/aiflow/issues")
        .header("Authorization", format!("Bearer {}", GITHUB_FEEDBACK_TOKEN))
        .json(&serde_json::json!({
            "title": format!("[{category}] 사용자 피드백 v{app_version}"),
            "body": body,
            "labels": [category, "user-feedback"],
        }))
        .send()
        .await
        .map_err(|e| AiflowError::new("FEEDBACK_002", "피드백 전송에 실패했습니다."))?;

    Ok(())
}
```

---

## 9. 대시보드 및 알람

### 개발팀 대시보드 (내부)

```
Sentry 대시보드:
  - 에러 발생률 추이 (버전별)
  - 가장 많이 발생하는 에러 Top 10
  - 새 릴리즈 후 에러 급증 감지

분석 대시보드 (analytics.aiflow.app):
  - DAU (Daily Active Users)
  - 주요 기능 사용률 (오버레이 사용, 파일 첨부, 프라이버시 모드)
  - AI 제공자 분포 (openai/anthropic/google 비율)
  - 버전별 분포 (업데이트 속도 모니터링)

GitHub Issues:
  - 사용자 피드백 태그별 분류
  - 버전별 버그 리포트 추이
```

### 알람 조건

| 조건 | 알람 채널 | 기준 |
|------|---------|------|
| 새 버전 에러율 급증 | Slack #alerts | 이전 버전 대비 200% 이상 |
| DB_002 에러 발생 | Slack #alerts | 건수 무관 (즉시) |
| 충돌 보고 급증 | Slack #alerts | 24시간 내 10건 이상 |
| 업데이트 서버 다운 | PagerDuty | 3분 이상 |
| 라이선스 서버 응답 느림 | Slack #alerts | p95 > 3초 |

---

## 10. 데이터 보존 및 삭제

### 수집 데이터 보존 기간

| 데이터 | 위치 | 보존 기간 | 삭제 방법 |
|--------|------|---------|---------|
| 로컬 에러 로그 (ErrorLog) | 로컬 DB | 90일 | 자동 삭제 |
| 로컬 앱 로그 파일 | 파일시스템 | 7일 | 자동 삭제 |
| 충돌 보고서 (미전송) | 파일시스템 | 30일 | 전송 후 즉시 삭제 |
| Sentry 에러 | Sentry 서버 | 90일 | Sentry 정책 |
| 익명 분석 데이터 | analytics.aiflow.app | 1년 | 서버 정책 |
| 사용자 피드백 | GitHub Issues | 무기한 | 수동 삭제 |

### 사용자 데이터 삭제 요청 처리

```rust
// GDPR/PIPA 데이터 삭제 요청
// AIFlow는 로컬 앱이므로 "전체 데이터 삭제" 기능으로 해결
// (서버에 저장된 개인정보 없음)

// 단, 피드백을 GitHub에 제출한 경우:
// → GitHub Issues의 해당 이슈 삭제 (GitHub 계정 없어도 support@aiflow.app으로 요청 가능)
// → Sentry: 이메일로 요청 시 특정 이벤트 삭제 가능
```

---

## 확정된 모니터링 설계 결정사항

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | Sentry 사용 | 프로덕션 활성, PII 필터링 필수 |
| 2 | 익명 분석 | 기본 활성, 설정에서 비활성화 가능 |
| 3 | 분석 전송 주기 | 하루 1회 배치 (실시간 전송 금지) |
| 4 | 충돌 보고 | 옵트인 (사용자 동의 후 전송) |
| 5 | 로컬 로그 보존 | 7일 (일별 로테이션) |
| 6 | 건강 체크 주기 | 앱 시작 30초 후 + 10분마다 |
| 7 | Sentry 샘플링 | 에러 100%, 트랜잭션 10% |
| 8 | 피드백 채널 | GitHub Issues API |
| 9 | 분석 수집 금지 | 대화 내용, API 키, 파일 내용, IP |
| 10 | 분석 데이터 보존 | 1년 (익명 데이터) |
