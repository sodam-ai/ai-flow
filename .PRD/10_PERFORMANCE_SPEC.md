# AIFlow — 성능 명세서 v4.0

> v1.0: 성능 목표, 측정 방법, 병목 분석
> v4.0: 목표값/CI게이트 2단계 체계, 환율 API 외부 의존 제거, 01_PRD·03_PHASES·12_RELEASE와 수치 통일

---

## 목차

1. [성능 목표 (SLA)](#1-성능-목표-sla)
2. [측정 도구 및 방법](#2-측정-도구-및-방법)
3. [레이어별 병목 분석](#3-레이어별-병목-분석)
4. [Rust 백엔드 최적화](#4-rust-백엔드-최적화)
5. [React 프론트엔드 최적화](#5-react-프론트엔드-최적화)
6. [SQLite·SQLCipher 최적화](#6-sqlitesqlcipher-최적화)
7. [메모리 관리](#7-메모리-관리)
8. [AI 스트리밍 최적화](#8-ai-스트리밍-최적화)
9. [시작 시간 최적화](#9-시작-시간-최적화)
10. [성능 회귀 방지](#10-성능-회귀-방지)

---

## 1. 성능 목표 (SLA)

### Phase 1 핵심 지표

| 지표 | 목표값 | 측정 방법 | 우선순위 |
|------|--------|----------|--------|
| 지표 | **목표값** | **CI 게이트 (초과 시 릴리스 차단)** | 측정 방법 | 우선순위 |
|------|--------|------|----------|--------|
| 오버레이 열림 시간 | **< 100ms** | **< 200ms** | Alt+Space → 입력창 포커스 | 🔴 최고 |
| 첫 토큰 응답 시간 (TTFT) | **< 800ms** | **< 1.5초** | Enter → 첫 글자 표시 | 🔴 최고 |
| 앱 콜드 스타트 | **< 2초** | **< 3초** | 프로세스 시작 → 트레이 아이콘 | 🟠 높음 |
| DB 쿼리 응답 (p99) | **< 10ms** | **< 50ms** | 메시지 50개 페이지 조회 | 🟠 높음 |
| UI 프레임률 | **≥ 60fps** | **≥ 30fps** | 스트리밍 렌더링 중 | 🟠 높음 |
| 메모리 (유휴) | **< 80MB** | **< 150MB** | 시스템 트레이 대기 시 | 🟡 중간 |
| 메모리 (활성) | **< 200MB** | **< 300MB** | 오버레이 + 대화 중 | 🟡 중간 |
| 파일 첨부 처리 | **< 2초** | **< 5초** | 10MB PDF 드롭 → 추출 완료 | 🟡 중간 |

### Phase 2 추가 지표

| 지표 | 목표값 |
|------|--------|
| 배치 처리 처리량 | ≥ 10파일/분 (PDF, 평균 5MB) |
| Chrome 확장 컨텍스트 수신 | < 100ms (Native Messaging 왕복) |
| MCP 서버 도구 호출 | < 500ms (p95, 로컬 서버) |

---

## 2. 측정 도구 및 방법

### 2.1 Rust 백엔드 측정

```toml
# Cargo.toml — 벤치마크 의존성
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }
tokio-test = "0.4"
```

```rust
// src-tauri/benches/db_bench.rs
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn bench_message_pagination(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let db = rt.block_on(setup_test_db_with_messages(1000));

    let mut group = c.benchmark_group("message_pagination");

    for page_size in [10, 50, 100] {
        group.bench_with_input(
            BenchmarkId::new("get_page", page_size),
            &page_size,
            |b, &size| {
                b.to_async(&rt).iter(|| async {
                    get_messages_paginated(&db, 1, 0, size).await.unwrap()
                });
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_message_pagination);
criterion_main!(benches);
```

```bash
# 벤치마크 실행
cd src-tauri
cargo bench --bench db_bench

# 결과 HTML 리포트
open target/criterion/message_pagination/report/index.html
```

### 2.2 프론트엔드 측정

```typescript
// src/utils/perf.ts
// 개발 모드에서만 활성화 (프로덕션 빌드 시 tree-shake됨)

export function measureOverlayOpenTime() {
  if (import.meta.env.PROD) return;

  const start = performance.now();
  window.__overlayOpenStart = start;
}

export function recordOverlayFocused() {
  if (import.meta.env.PROD || !window.__overlayOpenStart) return;

  const elapsed = performance.now() - window.__overlayOpenStart;
  console.log(`⚡ Overlay open time: ${elapsed.toFixed(1)}ms`);

  // 목표 초과 시 경고
  if (elapsed > 200) {
    console.warn(`⚠️ Overlay open time ${elapsed.toFixed(1)}ms > 200ms target`);
  }

  delete window.__overlayOpenStart;
}

// TTFT 측정
export function measureTTFT() {
  const sendTime = performance.now();

  return {
    recordFirstToken: () => {
      const ttft = performance.now() - sendTime;
      console.log(`⚡ TTFT: ${ttft.toFixed(1)}ms`);
      if (ttft > 800) {
        console.warn(`⚠️ TTFT ${ttft.toFixed(1)}ms > 800ms target`);
      }
    }
  };
}
```

```tsx
// React DevTools Profiler 통합
import { Profiler, ProfilerOnRenderCallback } from 'react';

const onRender: ProfilerOnRenderCallback = (
  id, phase, actualDuration, baseDuration, startTime, commitTime
) => {
  if (actualDuration > 16) {  // 60fps = 16.7ms 프레임 예산
    console.warn(`🐢 Slow render: ${id} (${phase}) = ${actualDuration.toFixed(1)}ms`);
  }
};

// 개발 시에만 감싸기
if (import.meta.env.DEV) {
  // <Profiler id="MessageList" onRender={onRender}><MessageList /></Profiler>
}
```

### 2.3 E2E 성능 측정 (Playwright)

```typescript
// tests/performance.spec.ts
import { test, expect } from '@playwright/test';

test('overlay open time < 200ms', async ({ page }) => {
  // Tauri 앱 실행 가정
  const start = Date.now();

  // Alt+Space 단축키 시뮬레이션 (Tauri CLI 통해)
  await page.keyboard.press('Alt+Space');

  // 입력창이 포커스될 때까지
  await page.waitForSelector('[data-testid="overlay-input"]:focus');
  const elapsed = Date.now() - start;

  console.log(`Overlay open: ${elapsed}ms`);
  expect(elapsed).toBeLessThan(200);
});

test('first token time < 800ms', async ({ page }) => {
  await page.keyboard.press('Alt+Space');
  await page.waitForSelector('[data-testid="overlay-input"]:focus');

  const sendTime = Date.now();
  await page.fill('[data-testid="overlay-input"]', '안녕하세요');
  await page.keyboard.press('Enter');

  // 첫 토큰 등장 대기
  await page.waitForSelector('[data-testid="ai-response-text"]:not(:empty)');
  const ttft = Date.now() - sendTime;

  console.log(`TTFT: ${ttft}ms`);
  expect(ttft).toBeLessThan(800);
});
```

### 2.4 메모리 측정

```powershell
# Windows에서 Tauri 앱 메모리 모니터링
Get-Process -Name "aiflow" | Select-Object Name, WorkingSet64, PrivateMemorySize64 |
  Format-Table @{
    Name="이름"; Expression={$_.Name}
  }, @{
    Name="실제 메모리(MB)"; Expression={[math]::Round($_.WorkingSet64/1MB, 1)}
  }, @{
    Name="전용 메모리(MB)"; Expression={[math]::Round($_.PrivateMemorySize64/1MB, 1)}
  }
```

```rust
// src-tauri/src/diagnostics/memory.rs
// 주기적 메모리 사용량 로깅 (개발 빌드에서만)

#[cfg(debug_assertions)]
pub fn log_memory_usage(label: &str) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::ProcessStatus::GetProcessMemoryInfo;
        // ... Windows API로 WorkingSetSize 조회
        log::debug!("[MEM] {label}: {}MB", working_set_mb);
    }
}
```

---

## 3. 레이어별 병목 분석

### 병목 지점 맵

```
사용자 입력 (Enter)
    │
    ▼ [~1ms]
React 이벤트 핸들러
    │
    ▼ [~5ms] ← IPC 직렬화 오버헤드
Tauri invoke (JSON 직렬화)
    │
    ▼ [~1ms]
Rust Tauri Command 수신
    │
    ├── Zod 검증 (TS) [~2ms]
    │
    ▼ [~3ms]
DB 쿼리 (대화 컨텍스트 로드)
    │
    ▼ [~10ms]
PII 마스킹 (프라이버시 모드 ON 시)
    │
    ▼ [~20-500ms] ← 네트워크 레이턴시 (지역마다 다름)
AI API 첫 응답 (TTFT)
    │
    ▼ [~1ms/청크]
ipc::Channel 토큰 스트리밍
    │
    ▼ [~2ms/청크] ← React 리렌더링 오버헤드
UI 렌더링 (Markdown 파싱 + 표시)
```

### 주요 병목 원인 및 해결책

| 병목 | 원인 | 해결책 |
|------|------|--------|
| IPC 오버헤드 | JSON 직렬화 비용 | 청크 단위 배칭, bincode 검토 |
| 스트리밍 렌더링 지연 | 토큰마다 리렌더링 | 버퍼링 + 16ms 배치 업데이트 |
| DB 조회 느림 | 인덱스 누락 | 20_performance_indexes.sql 적용 |
| 오버레이 열림 느림 | WebView 초기화 지연 | 앱 시작 시 WebView 사전 로드 |
| 메모리 증가 | 대화 기록 누적 | 가상화 스크롤 (react-virtual) |

---

## 4. Rust 백엔드 최적화

### 4.1 비동기 병렬 처리

```rust
// src-tauri/src/commands/ai.rs

// ❌ 비효율: 순차적 처리
async fn prepare_ai_request_slow(
    conv_id: i64,
    db: &Database,
) -> Result<AiRequest> {
    let context = load_conversation_context(db, conv_id).await?;
    let persona = load_persona(db, conv_id).await?;
    let settings = load_settings(db).await?;
    Ok(build_request(context, persona, settings))
}

// ✅ 최적화: 병렬 로드
async fn prepare_ai_request(
    conv_id: i64,
    db: &Database,
) -> Result<AiRequest> {
    let (context, persona, settings) = tokio::try_join!(
        load_conversation_context(db, conv_id),
        load_persona(db, conv_id),
        load_settings(db),
    )?;
    Ok(build_request(context, persona, settings))
}
```

### 4.2 DB 커넥션 풀

```rust
// src-tauri/src/db/pool.rs

use sqlx::{SqlitePool, SqlitePoolOptions};

pub async fn create_pool(db_path: &str, db_key: &str) -> Result<SqlitePool> {
    SqlitePoolOptions::new()
        .max_connections(5)           // 동시 쿼리 최대 5개
        .min_connections(1)           // 유휴 시 최소 1개 유지
        .acquire_timeout(std::time::Duration::from_secs(5))
        .idle_timeout(std::time::Duration::from_secs(60))
        .after_connect(move |conn, _meta| {
            let key = db_key.to_string();
            Box::pin(async move {
                // 연결마다 PRAGMA 설정 (SQLCipher 필수)
                sqlx::query(&format!("PRAGMA key = '{key}'"))
                    .execute(&mut **conn)
                    .await?;
                sqlx::query("PRAGMA journal_mode = WAL").execute(&mut **conn).await?;
                sqlx::query("PRAGMA cipher_memory_security = ON").execute(&mut **conn).await?;
                sqlx::query("PRAGMA synchronous = NORMAL").execute(&mut **conn).await?;
                sqlx::query("PRAGMA cache_size = -8000").execute(&mut **conn).await?; // 8MB 캐시
                sqlx::query("PRAGMA temp_store = MEMORY").execute(&mut **conn).await?;
                Ok(())
            })
        })
        .connect(&format!("sqlite:{db_path}"))
        .await
        .map_err(Into::into)
}
```

### 4.3 문자열 할당 최소화

```rust
// ❌ 비효율: 불필요한 clone/allocation
fn format_cost(cost_usd: f64, cost_krw: Option<f64>) -> String {
    let usd = format!("${:.4}", cost_usd);
    if let Some(krw) = cost_krw {
        format!("{} (₩{})", usd, krw as u64)
    } else {
        usd
    }
}

// ✅ 최적화: write! 매크로로 단일 버퍼 사용
fn format_cost(cost_usd: f64, cost_krw: Option<f64>) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(24);
    write!(s, "${:.4}", cost_usd).unwrap();
    if let Some(krw) = cost_krw {
        write!(s, " (₩{})", krw as u64).unwrap();
    }
    s
}
```

### 4.4 벤치마크 목표

```rust
// src-tauri/benches/ai_bench.rs

fn bench_pii_masking(c: &mut Criterion) {
    let detector = PiiDetector::new();
    let text = "홍길동 씨의 전화번호는 010-1234-5678이고 이메일은 test@example.com입니다.";

    c.bench_function("pii_detect_mask", |b| {
        b.iter(|| detector.detect_and_mask(text))
    });
    // 목표: < 5ms (50,000자 이하 텍스트 기준)
}

fn bench_db_message_insert(c: &mut Criterion) {
    // 목표: < 3ms (단일 메시지 INSERT + CostLog)
}
```

---

## 5. React 프론트엔드 최적화

### 5.1 스트리밍 렌더링 배칭

```tsx
// src/hooks/useStreamingText.ts
// 문제: 토큰마다 setState → 토큰/초 × 리렌더링 = 드롭 프레임

import { useCallback, useRef, useState } from 'react';

export function useStreamingText() {
  const [text, setText] = useState('');
  const bufferRef = useRef('');
  const rafRef = useRef<number>();

  const appendChunk = useCallback((chunk: string) => {
    bufferRef.current += chunk;

    // RAF로 16ms 배치 (60fps 유지)
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setText(prev => prev + bufferRef.current);
        bufferRef.current = '';
        rafRef.current = undefined;
      });
    }
  }, []);

  const reset = useCallback(() => {
    setText('');
    bufferRef.current = '';
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  }, []);

  return { text, appendChunk, reset };
}
```

### 5.2 메시지 목록 가상화

```tsx
// src/components/MessageList.tsx
// 대화가 길어질수록 DOM 노드 폭증 → 가상화 필수

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,    // 메시지당 평균 높이 추정 (px)
    overscan: 3,                // 화면 밖 3개 미리 렌더링
  });

  return (
    <div ref={parentRef} style={{ height: '480px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={messages[item.index].id}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${item.start}px)`,
              width: '100%',
            }}
          >
            <MessageItem message={messages[item.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.3 컴포넌트 메모이제이션

```tsx
// ❌ 부모 리렌더 시 항상 재렌더됨
function CostDisplay({ costUsd, costKrw }: CostDisplayProps) {
  return <span>💰 ${costUsd.toFixed(4)}</span>;
}

// ✅ props가 변경될 때만 재렌더
const CostDisplay = memo(function CostDisplay({ costUsd, costKrw }: CostDisplayProps) {
  return <span>💰 ${costUsd.toFixed(4)}</span>;
});

// ✅ 계산 비용이 높은 값은 useMemo
function MessageContent({ content }: { content: string }) {
  const parsed = useMemo(() => parseMarkdown(content), [content]);
  return <div dangerouslySetInnerHTML={{ __html: parsed }} />;
}

// ✅ 콜백 함수는 useCallback
function MessageActions({ messageId }: { messageId: number }) {
  const handleCopy = useCallback(async () => {
    await copyMessageToClipboard(messageId);
  }, [messageId]);

  return <button onClick={handleCopy}>복사</button>;
}
```

### 5.4 코드 분할 (Code Splitting)

```tsx
// src/App.tsx
import { lazy, Suspense } from 'react';

// 설정 화면은 지연 로드 (메인 번들 크기 감소)
const SettingsWindow = lazy(() => import('./views/SettingsWindow'));
const BatchView = lazy(() => import('./views/BatchView'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {isSettings ? <SettingsWindow /> : <OverlayWindow />}
    </Suspense>
  );
}
```

### 5.5 번들 크기 목표

```
목표 번들 크기 (gzip 기준):
  메인 청크 (overlay): < 150KB
  설정 청크:           < 100KB
  마크다운 파서:        < 30KB
  shadcn/ui 컴포넌트:  < 80KB (사용 컴포넌트만)

분석 명령:
  npx vite-bundle-visualizer
  npx @next/bundle-analyzer  (설정 후)
```

---

## 6. SQLite·SQLCipher 최적화

### 6.1 PRAGMA 성능 튜닝

```sql
-- 연결 직후 실행 (암호화 PRAGMA 다음)

-- 캐시: 8MB (기본 2MB)
PRAGMA cache_size = -8000;       -- 음수 = KB 단위

-- 동기화: NORMAL (FULL 대비 2-3배 빠름, WAL에서 안전)
PRAGMA synchronous = NORMAL;

-- 임시 테이블을 메모리에 (I/O 절약)
PRAGMA temp_store = MEMORY;

-- Mmap: 64MB 메모리 매핑 (대용량 DB 접근 가속)
PRAGMA mmap_size = 67108864;

-- WAL 자동 체크포인트: 1000페이지마다
PRAGMA wal_autocheckpoint = 1000;
```

### 6.2 쿼리 최적화 패턴

```sql
-- ❌ 비효율: SELECT * (불필요한 컬럼 포함)
SELECT * FROM messages WHERE conversation_id = 1 LIMIT 50;

-- ✅ 최적화: 필요한 컬럼만
SELECT id, role, content, provider_id, cost_usd, created_at
FROM messages
WHERE conversation_id = ?1
ORDER BY created_at ASC
LIMIT ?2 OFFSET ?3;

-- ❌ 비효율: N+1 쿼리
for message in messages {
    let cost = query!("SELECT * FROM cost_log WHERE message_id = ?", message.id).fetch_one(&db).await?;
}

-- ✅ 최적화: JOIN으로 한 번에
SELECT m.id, m.content, c.cost_usd, c.input_tokens, c.output_tokens
FROM messages m
LEFT JOIN cost_log c ON c.message_id = m.id
WHERE m.conversation_id = ?1
ORDER BY m.created_at ASC
LIMIT ?2 OFFSET ?3;
```

### 6.3 WAL 체크포인트 관리

```rust
// src-tauri/src/db/maintenance.rs

/// 앱 종료 시 WAL 체크포인트 실행 (다음 시작 속도 향상)
pub async fn checkpoint_on_exit(pool: &SqlitePool) -> Result<()> {
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(pool)
        .await?;
    log::info!("WAL checkpoint completed on exit");
    Ok(())
}

/// 주기적 ANALYZE (쿼리 플래너 통계 갱신, 주 1회)
pub async fn run_periodic_analyze(pool: &SqlitePool) -> Result<()> {
    let last_analyze: Option<String> = sqlx::query_scalar!(
        "SELECT value FROM settings WHERE key = 'last_analyze'"
    )
    .fetch_optional(pool)
    .await?
    .flatten();

    let should_analyze = last_analyze
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| chrono::Utc::now() - dt > chrono::Duration::days(7))
        .unwrap_or(true);

    if should_analyze {
        sqlx::query("ANALYZE").execute(pool).await?;
        sqlx::query("INSERT OR REPLACE INTO settings(key, value) VALUES('last_analyze', ?)")
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(pool)
            .await?;
        log::info!("Database ANALYZE completed");
    }
    Ok(())
}
```

---

## 7. 메모리 관리

### 7.1 Rust 메모리 전략

```rust
// src-tauri/src/memory.rs

/// 스트리밍 완료 후 부분 응답 버퍼 해제
pub fn cleanup_after_stream(stream: &mut StreamRequest) {
    // partial_content 버퍼 해제
    let mut content = stream.partial_content.lock().unwrap();
    content.shrink_to_fit();  // 남은 capacity 반환

    // 취소 토큰 해제
    drop(stream.cancel_token.clone());
}

/// API 키: 사용 후 메모리에서 즉시 제거
/// (Zeroize 크레이트로 메모리 덮어쓰기)
use zeroize::Zeroize;

pub fn use_api_key_then_clear(key: &mut String, action: impl FnOnce(&str)) {
    action(key.as_str());
    key.zeroize();  // 메모리를 0으로 덮어쓰기
}
```

```toml
# Cargo.toml
[dependencies]
zeroize = { version = "1.7", features = ["derive"] }
```

### 7.2 React 메모리 누수 방지

```tsx
// src/hooks/useAiStream.ts

export function useAiStream() {
  const listenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Tauri 이벤트 리스너 등록
    const unlisten = listen('ai-token', (event) => {
      appendChunk(event.payload as string);
    });

    unlisten.then(fn => { listenerRef.current = fn; });

    // ✅ 컴포넌트 언마운트 시 리스너 해제 (누수 방지)
    return () => {
      listenerRef.current?.();
      listenerRef.current = null;
    };
  }, []);
}

// ❌ 잘못된 패턴: 리스너 해제 없음
useEffect(() => {
  listen('ai-token', handler);  // 누수 발생
}, []);
```

### 7.3 메모리 사용량 목표 달성 전략

```
목표: 유휴 시 < 80MB

달성 방법:
1. Tauri WebView: 최소 HTML/CSS/JS만 사전 로드 (~30MB)
2. Rust 프로세스: 최소 스레드, 유휴 연결 풀 1개 (~20MB)
3. SQLite: 8MB 캐시 (활성 시 더 사용, 유휴 시 해제 가능)
4. 이미지: SVG 아이콘만 사용 (PNG/JPG 메모리 절약)

활성 시 < 200MB:
1. 대화 내용: 최근 100개 메시지만 메모리 (나머지 DB에서 지연 로드)
2. Markdown 파싱 결과 캐시: 최대 50개 LRU
3. 스트리밍 버퍼: 완료 즉시 해제
```

---

## 8. AI 스트리밍 최적화

### 8.1 스트리밍 버퍼 크기

```rust
// src-tauri/src/commands/ai.rs

// ❌ 비효율: 토큰 하나씩 IPC 전송 (오버헤드 큼)
while let Some(chunk) = stream.next().await {
    channel.send(chunk).await?;  // 매번 IPC 비용 발생
}

// ✅ 최적화: 시간 기반 배칭 (16ms = 60fps)
use tokio::time::{interval, Duration};

let mut buffer = String::with_capacity(256);
let mut ticker = interval(Duration::from_millis(16));

loop {
    tokio::select! {
        chunk = stream.next() => {
            match chunk {
                Some(Ok(text)) => buffer.push_str(&text),
                Some(Err(e)) => return Err(e.into()),
                None => {
                    // 마지막 버퍼 전송
                    if !buffer.is_empty() {
                        channel.send(std::mem::take(&mut buffer)).await?;
                    }
                    break;
                }
            }
        }
        _ = ticker.tick() => {
            if !buffer.is_empty() {
                channel.send(std::mem::take(&mut buffer)).await?;
            }
        }
        _ = cancel_token.cancelled() => break,
    }
}
```

### 8.2 토큰 카운터 (근사치)

```rust
// 정확한 토큰 카운트는 tiktoken이 필요하지만 Rust에서는 근사치 사용
// (UI 표시용, 실제 과금은 API 응답의 usage 필드 사용)

/// 영어: 4글자 ≈ 1토큰, 한국어: 2글자 ≈ 1토큰 (근사)
pub fn estimate_tokens(text: &str) -> u32 {
    let char_count = text.chars().count();
    let korean_count = text.chars().filter(|c| {
        let code = *c as u32;
        (0xAC00..=0xD7A3).contains(&code)  // 한글 완성형 범위
    }).count();

    let other_count = char_count - korean_count;
    ((korean_count as f32 / 2.0) + (other_count as f32 / 4.0)).ceil() as u32
}
```

### 8.3 HTTP/2 멀티플렉싱

```rust
// src-tauri/src/http/client.rs
// HTTP/2로 동일 연결에서 여러 요청 병렬 처리

Client::builder()
    .http2_prior_knowledge()        // HTTP/2 강제 (HTTPS에서는 ALPN으로 자동)
    .http2_adaptive_window(true)    // 혼잡 제어 최적화
    .http2_max_frame_size(16384)    // 16KB 프레임
    .build()
```

---

## 9. 시작 시간 최적화

### 9.1 WebView 사전 로드

```rust
// src-tauri/src/main.rs
// Tauri 앱 시작 시 WebView를 숨겨진 상태로 미리 로드

pub fn setup_preloaded_webview(app: &tauri::App) {
    // 시스템 트레이 등록 직후 오버레이 WebView를 보이지 않게 생성
    let overlay = create_overlay_window(app);
    overlay.hide().unwrap();  // 보이지 않지만 WebView는 초기화됨

    // 첫 번째 Alt+Space 시 즉시 show() → 초기화 지연 없음
}
```

### 9.2 lazy 초기화

```rust
// src-tauri/src/lib.rs
// 무거운 초기화는 첫 사용 시까지 지연

use once_cell::sync::OnceCell;

static PII_DETECTOR: OnceCell<PiiDetector> = OnceCell::new();

pub fn get_pii_detector() -> &'static PiiDetector {
    PII_DETECTOR.get_or_init(|| {
        // OpenRedaction 패턴 로드 (~570개) — 첫 프라이버시 모드 사용 시
        PiiDetector::new()
    })
}
```

### 9.3 시작 시간 측정 및 목표

```rust
// src-tauri/src/main.rs

fn main() {
    let boot_start = std::time::Instant::now();

    // ... 앱 초기화 ...

    tauri::Builder::default()
        .setup(|app| {
            let elapsed = boot_start.elapsed();
            log::info!("App boot time: {:.0}ms", elapsed.as_millis());

            if elapsed.as_millis() > 3000 {
                log::warn!("⚠️ Boot time {}ms > 3000ms target", elapsed.as_millis());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 시작 단계별 목표:
// OS → 프로세스 시작:   ~200ms
// Rust 런타임 초기화:   ~100ms
// DB 연결 + PRAGMA:     ~300ms (SQLCipher 키 유도 포함)
// WebView 로드:         ~1500ms (가장 오래 걸림)
// 트레이 아이콘 표시:   ~100ms
// 합계:                 ~2200ms (목표 3000ms 이내)
```

---

## 10. 성능 회귀 방지

### 10.1 CI 성능 게이트

```yaml
# .github/workflows/perf.yml
name: Performance

on:
  push:
    branches: [main, develop]

jobs:
  benchmark:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Rust benchmarks
        run: |
          cd src-tauri
          cargo bench --bench db_bench -- --output-format bencher | tee bench_output.txt

      - name: Compare with baseline
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'cargo'
          output-file-path: src-tauri/bench_output.txt
          fail-on-alert: true
          alert-threshold: '130%'    # 30% 이상 느려지면 CI 실패
          comment-on-alert: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### 10.2 번들 크기 회귀 방지

```yaml
# .github/workflows/bundle-size.yml
- name: Check bundle size
  run: |
    npm run build
    MAIN_SIZE=$(gzip -c dist/assets/index-*.js | wc -c)
    echo "Main bundle: ${MAIN_SIZE} bytes"

    # 150KB (153600 bytes) 초과 시 실패
    if [ $MAIN_SIZE -gt 153600 ]; then
      echo "❌ Bundle size ${MAIN_SIZE} > 150KB limit"
      exit 1
    fi
    echo "✅ Bundle size OK: ${MAIN_SIZE} bytes"
```

### 10.3 성능 테스트 기준 시나리오

```typescript
// tests/perf-baseline.spec.ts
// 이 파일의 수치가 "황금 기준" — 회귀 시 PR 차단

const PERF_BASELINES = {
  overlayOpenMs: 200,    // 오버레이 열림
  ttftMs: 800,           // 첫 토큰
  dbPageQueryMs: 10,     // DB 페이지 쿼리
  memoryIdleMb: 80,      // 유휴 메모리
  bundleSizeKb: 150,     // 메인 번들
} as const;

// 각 항목을 E2E + 단위 테스트로 자동 검증
// 실패 시 GitHub PR 코멘트로 회귀 알림
```

---

## 확정된 성능 설계 결정사항

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | 스트리밍 배칭 주기 | 16ms (60fps 유지) |
| 2 | DB 커넥션 풀 크기 | 최대 5개, 유휴 최소 1개 |
| 3 | DB 캐시 크기 | 8MB (PRAGMA cache_size = -8000) |
| 4 | 메시지 가상화 | @tanstack/react-virtual (100개 이상 시) |
| 5 | 코드 분할 | 설정 화면, 배치 화면 lazy 로드 |
| 6 | API 키 메모리 처리 | zeroize 크레이트로 사용 후 덮어쓰기 |
| 7 | WebView 사전 로드 | 앱 시작 시 숨겨진 상태로 초기화 |
| 8 | PII 감지기 초기화 | lazy (첫 프라이버시 모드 사용 시) |
| 9 | 성능 회귀 임계값 | 기준 대비 30% 이상 느려지면 CI 실패 |
| 10 | HTTP/2 | 활성화 (reqwest 기본 지원) |
