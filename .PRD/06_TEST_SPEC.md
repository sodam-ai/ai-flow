# AIFlow — 테스트 명세 v4.0

> v1.1: AI 스트리밍 IPC 채널 모킹 + Rust↔TS 계약 테스트 + InMemoryKeychain + 팩토리 패턴 + criterion CI
> v4.0: E2E 전략 현실화 (Playwright → 계층 분리), Tauri 네이티브 기능 테스트 방법 명시
> "테스트 없는 코드는 설계가 아니라 추측이다."
> AI에게 코드 구현을 시킬 때 이 문서를 반드시 함께 제공하세요.

### v4.0 E2E 테스트 전략 변경

> Playwright는 브라우저 자동화 도구이며, Tauri 앱의 네이티브 기능(글로벌 단축키, 시스템 트레이, 오버레이 창 전환)을 테스트할 수 없다.
> v4.0에서는 **계층 분리 전략**을 채택한다:

| 테스트 계층 | 도구 | 대상 | 커버리지 |
|------------|------|------|---------|
| **단위 테스트** (100+) | cargo test + Vitest + @testing-library/react | Rust 비즈니스 로직 + React 컴포넌트 | 80%+ |
| **통합 테스트** (30~50) | Vitest + @tauri-apps/api 모킹 | IPC 경계, Zod 검증, 에러 흐름 | 60%+ |
| **E2E 핵심 플로우** (6개) | **실제 .exe 빌드 + 수동 체크리스트** | 전체 앱 동작 (단축키, 트레이, 스트리밍) | 100% |

> Phase 2에서 Tauri Driver (WebDriver 프로토콜) 성숙도 재평가 후 E2E 자동화 도구 결정.

---

## 1. 테스트 전략 개요

### 테스트 피라미드

```
         ▲
        /E2E\          — Playwright (5~10개 핵심 시나리오)
       /──────\
      / 통합테스트 \    — Tauri TestHarness + Vitest (30~50개)
     /────────────\
    /   단위테스트  \   — Rust #[cfg(test)] + Vitest (100개+)
   /────────────────\
```

### 커버리지 목표

| 레이어 | 목표 커버리지 | CI 게이트 (이하 시 빌드 실패) |
|--------|------------|---------------------------|
| Rust 백엔드 | 80%+ | 70% |
| TypeScript 프론트엔드 | 75%+ | 65% |
| 통합 (IPC 경계) | 60%+ | 50% |
| E2E 핵심 플로우 | 100% (5개) | 100% |

### 테스트 도구 스택

| 도구 | 용도 | 설치 |
|------|------|------|
| `cargo test` | Rust 단위·통합 테스트 | `rustup` 기본 포함 |
| `Vitest` | TypeScript 단위 테스트 | `npm install -D vitest @vitest/ui` |
| `@testing-library/react` | React 컴포넌트 테스트 | `npm install -D @testing-library/react` |
| `Playwright` | E2E 브라우저 자동화 | `npx playwright install` |
| `cargo-tarpaulin` | Rust 커버리지 측정 | `cargo install cargo-tarpaulin` |
| `c8` / `istanbul` | TS 커버리지 측정 | Vitest 내장 |
| `cargo-audit` | 의존성 보안 취약점 | `cargo install cargo-audit` |

---

## 2. Rust 백엔드 단위테스트

### 2.1 테스트 파일 구조

```
src-tauri/src/
├── db/
│   ├── mod.rs
│   └── mod_test.rs        ← DB 초기화·암호화 테스트
├── commands/
│   ├── ai.rs
│   ├── ai_test.rs         ← AI 스트리밍 mock 테스트
│   ├── keychain.rs
│   ├── keychain_test.rs   ← OS 키체인 저장/조회
│   ├── routing.rs
│   └── routing_test.rs    ← 복잡도 계산 로직
├── security/
│   ├── crypto.rs
│   └── crypto_test.rs     ← PBKDF2·AES-128 테스트
└── db/
    └── retention_test.rs  ← 데이터 보존 정책 테스트
```

### 2.2 핵심 Rust 테스트 예시

```rust
// src-tauri/src/db/mod_test.rs
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// DB가 SQLCipher로 암호화되는지 검증
    #[test]
    fn test_db_encrypted_with_sqlcipher() {
        let tmp = TempDir::new().unwrap();
        let db_path = tmp.path().join("test.db");

        // 테스트용 마스터키 (OS 키체인 없이 직접 주입)
        let master_key = "test_master_key_32bytes_exactly!!";
        let conn = init_db_with_key(&db_path, master_key).unwrap();

        // 기본 쿼리 성공 확인
        let count: i64 = conn
            .query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0))
            .unwrap();
        assert!(count >= 0);

        // 잘못된 키로는 열 수 없는지 확인
        drop(conn);
        let result = Connection::open(&db_path)
            .and_then(|c| c.query_row("SELECT 1", [], |r| r.get::<_, i64>(0)));
        assert!(result.is_err(), "암호화 없이 DB가 열려서는 안 됨");
    }

    /// PBKDF2 키 유도가 결정론적인지 확인
    #[test]
    fn test_pbkdf2_derivation_deterministic() {
        let key1 = derive_db_key("master_key_test");
        let key2 = derive_db_key("master_key_test");
        assert_eq!(key1, key2, "같은 입력 → 같은 출력");

        let key3 = derive_db_key("different_master");
        assert_ne!(key1, key3, "다른 입력 → 다른 출력");
        assert_eq!(key1.len(), 64, "32바이트 hex = 64글자");
    }

    /// WAL 모드 활성화 확인
    #[test]
    fn test_wal_mode_enabled() {
        let tmp = TempDir::new().unwrap();
        let conn = init_db_with_key(&tmp.path().join("test.db"), "key").unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .unwrap();
        assert_eq!(mode, "wal");
    }

    /// secure_delete 활성화 확인
    #[test]
    fn test_secure_delete_enabled() {
        let tmp = TempDir::new().unwrap();
        let conn = init_db_with_key(&tmp.path().join("test.db"), "key").unwrap();
        let val: i64 = conn
            .query_row("PRAGMA secure_delete", [], |r| r.get(0))
            .unwrap();
        assert_eq!(val, 1);
    }
}
```

```rust
// src-tauri/src/commands/routing_test.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_complexity_short_prompt_is_low() {
        let score = calc_complexity("안녕", false, false);
        assert!(score <= 35, "짧은 프롬프트는 저복잡도");
    }

    #[test]
    fn test_complexity_long_code_prompt_is_high() {
        let long = "코드를 분석하고 왜 이렇게 동작하는지 ".repeat(20);
        let score = calc_complexity(&long, false, true);
        assert!(score >= 72, "긴 코드 분석 요청은 고복잡도");
    }

    #[test]
    fn test_complexity_file_attachment_adds_score() {
        let base = calc_complexity("짧은 질문", false, false);
        let with_file = calc_complexity("짧은 질문", true, false);
        assert!(with_file > base, "파일 첨부 시 복잡도 증가");
    }

    #[test]
    fn test_complexity_capped_at_100() {
        let very_long = "a".repeat(10000);
        let score = calc_complexity(&very_long, true, true);
        assert_eq!(score, 100, "복잡도는 100을 초과할 수 없음");
    }

    #[test]
    fn test_fallback_chain_ordering() {
        let chain = vec!["gpt-4o".to_string(), "claude".to_string(), "gemini".to_string()];
        let result = select_from_fallback_chain(&chain, 0); // 첫 번째 선택
        assert_eq!(result, Some("gpt-4o".to_string()));

        let result = select_from_fallback_chain(&chain, 1); // 첫 번째 실패 후 두 번째
        assert_eq!(result, Some("claude".to_string()));

        let result = select_from_fallback_chain(&chain, 10); // 모두 소진
        assert_eq!(result, None);
    }
}
```

```rust
// src-tauri/src/security/crypto_test.rs
#[cfg(test)]
mod tests {
    use super::*;

    /// AuditLog UPDATE 시도 시 차단 확인
    #[test]
    fn test_audit_log_immutable() {
        let tmp = tempfile::TempDir::new().unwrap();
        let conn = init_db_with_key(&tmp.path().join("t.db"), "key").unwrap();

        // INSERT는 성공
        conn.execute(
            "INSERT INTO audit_log (event_type, created_at) VALUES ('test_event', datetime('now'))",
            [],
        ).expect("INSERT 성공해야 함");

        // UPDATE는 실패 (trigger)
        let result = conn.execute(
            "UPDATE audit_log SET event_type = 'modified' WHERE 1=1",
            [],
        );
        assert!(result.is_err(), "AuditLog UPDATE는 차단되어야 함");

        // DELETE도 실패 (trigger)
        let result = conn.execute("DELETE FROM audit_log WHERE 1=1", []);
        assert!(result.is_err(), "AuditLog DELETE는 차단되어야 함");
    }

    /// 마스터키 로테이션 후 DB 접근 가능 확인
    #[tokio::test]
    async fn test_master_key_rotation() {
        let tmp = tempfile::TempDir::new().unwrap();
        let db_path = tmp.path().join("test.db");

        // 초기 키로 DB 생성
        let conn = init_db_with_key(&db_path, "old_key").unwrap();
        conn.execute("INSERT INTO audit_log (event_type, created_at) VALUES ('init', datetime('now'))", []).unwrap();
        drop(conn);

        // 키 로테이션
        rotate_db_key(&db_path, "old_key", "new_key").await.unwrap();

        // 새 키로 접근 성공
        let conn = init_db_with_key(&db_path, "new_key").unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM audit_log", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 1, "데이터 보존 확인");

        // 구 키로 접근 실패
        let result = init_db_with_key(&db_path, "old_key");
        assert!(result.is_err(), "구 키로는 접근 불가");
    }
}
```

### 2.3 Rust 테스트 실행 명령

```bash
# 전체 테스트
cargo test --manifest-path src-tauri/Cargo.toml

# 커버리지 측정 (HTML 리포트)
cargo tarpaulin --manifest-path src-tauri/Cargo.toml \
  --out Html --output-dir coverage/rust

# 보안 취약점 검사
cargo audit --manifest-path src-tauri/Cargo.toml

# 특정 모듈 테스트만
cargo test --manifest-path src-tauri/Cargo.toml db::tests

# 상세 출력 모드
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

---

## 3. TypeScript 프론트엔드 단위테스트 (Vitest)

### 3.1 테스트 파일 구조

```
src/
├── lib/
│   ├── ai/
│   │   ├── cost.ts
│   │   └── cost.test.ts          ← 비용 계산 정확도 테스트
│   ├── privacy/
│   │   ├── pii-detector.ts
│   │   └── pii-detector.test.ts  ← PII 감지 패턴 테스트
│   ├── ipc/
│   │   ├── validators.ts
│   │   └── validators.test.ts    ← Zod 검증 스키마 테스트
│   └── exchange-rate.ts
│       exchange-rate.test.ts     ← 환율 캐시 로직 테스트
└── components/
    ├── CommandPalette/
    │   └── CommandPalette.test.tsx ← 명령 팔레트 검색 테스트
    └── ChatMessage/
        └── ChatMessage.test.tsx   ← 메시지 렌더링 테스트
```

### 3.2 핵심 TypeScript 테스트 예시

```ts
// src/lib/ai/cost.test.ts
import { describe, it, expect } from 'vitest';
import { calcCost, formatCost } from './cost';

describe('calcCost', () => {
  it('GPT-4o 비용 계산이 정확해야 함', () => {
    const result = calcCost('gpt-4o', 1000, 500);
    // $0.0025/1K input + $0.01/1K output = $0.0025 + $0.005 = $0.0075
    expect(result.usd).toBeCloseTo(0.0075, 6);
  });

  it('알 수 없는 모델은 0 반환', () => {
    const result = calcCost('unknown-model', 1000, 1000);
    expect(result.usd).toBe(0);
    expect(result.krw).toBe(0);
  });

  it('로컬 LLM은 비용 0', () => {
    const result = calcCost('ollama/llama3', 1000, 1000);
    expect(result.usd).toBe(0);
  });

  it('KRW 환율 변환이 정수 반올림', () => {
    // 0.001 USD × 1380 = 1.38 → 1원
    const result = calcCost('gemini-1.5-flash', 1000, 1000);
    expect(Number.isInteger(result.krw)).toBe(true);
  });

  it('비전 토큰 포함 시 비용 증가', () => {
    const text = calcCost('gpt-4o', 500, 200);
    const vision = calcCost('gpt-4o', 500 + 765, 200); // 이미지 1개 ≈ 765 토큰
    expect(vision.usd).toBeGreaterThan(text.usd);
  });
});

describe('formatCost', () => {
  it('USD + KRW 형식 올바르게 출력', () => {
    const formatted = formatCost({ usd: 0.0075, krw: 10 });
    expect(formatted).toContain('$0.0075');
    expect(formatted).toContain('₩10');
  });
});
```

```ts
// src/lib/privacy/pii-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectAndMask } from './pii-detector';

describe('PII 감지 및 마스킹', () => {
  it('주민등록번호 감지', async () => {
    const result = await detectAndMask('직원 홍길동의 주민번호는 900101-1234567입니다');
    expect(result.detectedItems.some(i => i.type === 'RESIDENT_ID')).toBe(true);
    expect(result.masked).not.toContain('900101-1234567');
  });

  it('이메일 주소 감지', async () => {
    const result = await detectAndMask('연락처: test@example.com');
    expect(result.detectedItems.some(i => i.type === 'EMAIL')).toBe(true);
    expect(result.masked).not.toContain('test@example.com');
  });

  it('한국 전화번호 감지', async () => {
    const result = await detectAndMask('전화: 010-1234-5678');
    expect(result.detectedItems.some(i => i.type === 'PHONE')).toBe(true);
  });

  it('PII 없으면 원본 반환', async () => {
    const input = '오늘 날씨가 맑습니다.';
    const result = await detectAndMask(input);
    expect(result.detectedItems).toHaveLength(0);
    expect(result.masked).toBe(input);
  });

  it('신용카드 번호 감지 (Luhn 알고리즘)', async () => {
    const result = await detectAndMask('카드번호: 4532015112830366');
    expect(result.detectedItems.some(i => i.type === 'CREDIT_CARD')).toBe(true);
  });

  it('마스킹 맵이 원본 복구 정보를 포함', async () => {
    const result = await detectAndMask('이메일: abc@test.com');
    expect(result.maskingMap).toBeDefined();
    // 역마스킹 기능은 앱에서 미노출이므로 맵 존재만 확인
    expect(Object.keys(result.maskingMap).length).toBeGreaterThan(0);
  });
});
```

```ts
// src/lib/ipc/validators.test.ts
import { describe, it, expect } from 'vitest';
import { StreamAiInputSchema, SaveApiKeyInputSchema } from './validators';
import { ZodError } from 'zod';

describe('StreamAiInputSchema', () => {
  it('유효한 입력 통과', () => {
    expect(() => StreamAiInputSchema.parse({
      prompt: '안녕하세요',
      providerId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
    })).not.toThrow();
  });

  it('빈 프롬프트 거부', () => {
    expect(() => StreamAiInputSchema.parse({
      prompt: '',
      providerId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
    })).toThrow(ZodError);
  });

  it('100,000자 초과 프롬프트 거부', () => {
    expect(() => StreamAiInputSchema.parse({
      prompt: 'a'.repeat(100_001),
      providerId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
    })).toThrow(ZodError);
  });

  it('UUID 아닌 providerId 거부', () => {
    expect(() => StreamAiInputSchema.parse({
      prompt: '질문',
      providerId: 'not-a-uuid',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
    })).toThrow(ZodError);
  });
});

describe('SaveApiKeyInputSchema', () => {
  it('지원하지 않는 AI 공급자 거부', () => {
    expect(() => SaveApiKeyInputSchema.parse({
      provider: 'unsupported-provider',
      key: 'sk-test',
    })).toThrow(ZodError);
  });
});
```

### 3.3 Vitest 설정

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 60,
        statements: 65,
      },
      exclude: ['node_modules', 'src/test-setup.ts', '**/*.d.ts'],
    },
    // Tauri invoke mock
    alias: {
      '@tauri-apps/api/core': path.resolve('./src/__mocks__/tauri.ts'),
      '@tauri-apps/plugin-global-shortcut': path.resolve('./src/__mocks__/tauri-plugins.ts'),
    },
  },
});
```

```ts
// src/__mocks__/tauri.ts — Tauri invoke mock
import { vi } from 'vitest';

export const invoke = vi.fn(async (command: string, args?: unknown) => {
  // 테스트별로 vi.mocked(invoke).mockResolvedValueOnce()로 재정의
  console.warn(`[Mock] invoke('${command}', ${JSON.stringify(args)})`);
  return null;
});

export const listen = vi.fn();
export const emit = vi.fn();
```

---

## 4. E2E 테스트 (Playwright)

### 4.1 핵심 E2E 시나리오 (5개 — CI 100% 필수)

```ts
// tests/e2e/01-onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('첫 실행 온보딩 플로우 — API 키 등록 완료', async ({ page }) => {
  await page.goto('/');

  // 1. 웰컴 화면 표시 확인
  await expect(page.locator('[data-testid="welcome-screen"]')).toBeVisible();

  // 2. API 키 입력 폼 이동
  await page.click('[data-testid="btn-connect-api"]');
  await expect(page.locator('[data-testid="api-key-form"]')).toBeVisible();

  // 3. OpenAI 키 입력 (환경변수에서 테스트 키 주입)
  await page.fill('[data-testid="input-openai-key"]', process.env.TEST_OPENAI_KEY!);
  await page.click('[data-testid="btn-validate-key"]');

  // 4. 검증 성공 피드백
  await expect(page.locator('[data-testid="key-valid-badge"]')).toBeVisible({ timeout: 10_000 });

  // 5. 온보딩 완료 → 메인 화면
  await page.click('[data-testid="btn-complete-onboarding"]');
  await expect(page.locator('[data-testid="main-chat-view"]')).toBeVisible();
});
```

```ts
// tests/e2e/02-ai-chat.spec.ts
test('AI 채팅 — 스트리밍 응답 + 비용 표시', async ({ page }) => {
  await page.goto('/');

  // 1. 채팅 입력
  await page.fill('[data-testid="chat-input"]', '안녕하세요, 1+1은?');
  await page.keyboard.press('Enter');

  // 2. 스트리밍 시작 (로딩 상태)
  await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

  // 3. 응답 완료 대기 (최대 30초)
  await expect(page.locator('[data-testid="message-ai"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="streaming-indicator"]')).not.toBeVisible();

  // 4. 비용 표시 확인
  await expect(page.locator('[data-testid="message-cost"]')).toContainText('$');
  await expect(page.locator('[data-testid="message-cost"]')).toContainText('₩');
});

test('AI 스트리밍 중지 버튼 동작', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="chat-input"]', '매우 긴 이야기를 써주세요 500단어 이상');
  await page.keyboard.press('Enter');

  // 스트리밍 시작 확인 후 즉시 중지
  await expect(page.locator('[data-testid="btn-stop-stream"]')).toBeVisible();
  await page.click('[data-testid="btn-stop-stream"]');

  // "응답이 중단되었습니다" 메시지 확인
  await expect(page.locator('[data-testid="stream-cancelled-notice"]')).toBeVisible();
});
```

```ts
// tests/e2e/03-privacy-mode.spec.ts
test('프라이버시 모드 — PII 마스킹 후 AI 전송', async ({ page }) => {
  await page.goto('/');

  // 프라이버시 모드 활성화
  await page.click('[data-testid="toggle-privacy-mode"]');
  await expect(page.locator('[data-testid="privacy-badge"]')).toBeVisible();

  // PII 포함 텍스트 입력
  await page.fill('[data-testid="chat-input"]', '이름: 홍길동, 전화: 010-1234-5678');
  await page.keyboard.press('Enter');

  // PII 감지 미리보기 모달 표시
  await expect(page.locator('[data-testid="pii-preview-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="pii-item-list"]')).toContainText('전화번호');

  // 확인 후 전송
  await page.click('[data-testid="btn-confirm-masking"]');

  // 전송된 텍스트에 원본 PII 없음 확인
  const sentText = await page.locator('[data-testid="message-user"]').textContent();
  expect(sentText).not.toContain('010-1234-5678');
  expect(sentText).not.toContain('홍길동');
});
```

```ts
// tests/e2e/04-file-drop.spec.ts
test('파일 드래그앤드롭 — PDF 내용 AI 전달', async ({ page }) => {
  await page.goto('/');

  // 테스트 파일 드롭 시뮬레이션
  await page.locator('[data-testid="chat-input"]').dispatchEvent('drop', {
    dataTransfer: { files: [new File(['PDF content'], 'test.pdf', { type: 'application/pdf' })] }
  });

  // 첨부 파일 배지 표시 확인
  await expect(page.locator('[data-testid="attachment-badge"]')).toContainText('test.pdf');

  // 파일 크기 초과 시 에러
  const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.pdf');
  await page.locator('[data-testid="chat-input"]').dispatchEvent('drop', {
    dataTransfer: { files: [bigFile] }
  });
  await expect(page.locator('[data-testid="error-toast"]')).toContainText('파일이 너무 큽니다');
});
```

```ts
// tests/e2e/05-persona.spec.ts
test('AI 페르소나 전환 — 시스템 프롬프트 변경 확인', async ({ page }) => {
  await page.goto('/');

  // 기본 페르소나 확인
  await expect(page.locator('[data-testid="current-persona"]')).toContainText('기본');

  // "시니어 개발자" 페르소나 선택
  await page.click('[data-testid="persona-selector"]');
  await page.click('[data-testid="persona-dev"]');
  await expect(page.locator('[data-testid="current-persona"]')).toContainText('시니어 개발자');

  // 코딩 질문 후 응답에 코드 블록 포함 여부 확인
  await page.fill('[data-testid="chat-input"]', 'TypeScript에서 타입 가드를 설명해줘');
  await page.keyboard.press('Enter');
  await expect(page.locator('code, pre')).toBeVisible({ timeout: 30_000 });
});
```

### 4.2 Playwright 설정

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'coverage/e2e' }], ['list']],
  use: {
    baseURL: 'http://localhost:1420', // Tauri dev server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run tauri dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

## 5. 보안 테스트

### 5.1 보안 테스트 체크리스트 (각 Phase 배포 전 필수)

#### Phase 1 보안 게이트
```bash
# 1. Rust 의존성 취약점 스캔
cargo audit --manifest-path src-tauri/Cargo.toml
# → 알려진 취약점 0개여야 CI 통과

# 2. npm 의존성 취약점 스캔
npm audit --audit-level=high
# → HIGH/CRITICAL 0개여야 CI 통과

# 3. API 키 평문 유출 스캔 (정규식)
grep -rn "sk-" src/ --include="*.ts" --include="*.rs" && exit 1 || echo "OK"
grep -rn "AIza" src/ --include="*.ts" --include="*.rs" && exit 1 || echo "OK"
# → 매칭 있으면 빌드 실패

# 4. .env 파일 커밋 방지
git diff --cached --name-only | grep -E "\.env$" && echo "ERROR: .env detected" && exit 1
```

```ts
// tests/security/api-key-leak.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { globSync } from 'glob';

describe('API 키 유출 스캔', () => {
  const sourceFiles = globSync('src/**/*.{ts,tsx,js}');

  it('소스 파일에 OpenAI 키 패턴이 없어야 함', () => {
    const pattern = /sk-[A-Za-z0-9]{20,}/;
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(pattern, `${file} 에 API 키 패턴 발견`);
    }
  });

  it('소스 파일에 Anthropic 키 패턴이 없어야 함', () => {
    const pattern = /sk-ant-[A-Za-z0-9-]{20,}/;
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(pattern, `${file} 에 Anthropic 키 발견`);
    }
  });

  it('소스 파일에 Google AI 키 패턴이 없어야 함', () => {
    const pattern = /AIza[0-9A-Za-z_-]{35}/;
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(pattern, `${file} 에 Google AI 키 발견`);
    }
  });
});
```

```rust
// src-tauri/src/security/audit_test.rs
#[cfg(test)]
mod security_tests {
    /// AI API 호출이 반드시 Rust 백엔드를 통하는지 확인
    /// (프론트엔드 JS가 직접 호출하는 패턴 감지)
    #[test]
    fn test_no_api_call_in_frontend() {
        use std::fs;
        use glob::glob;

        let frontend_files: Vec<_> = glob("../../src/**/*.{ts,tsx}")
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();

        for path in frontend_files {
            let content = fs::read_to_string(&path).unwrap_or_default();

            // OpenAI API 직접 호출 패턴
            assert!(
                !content.contains("api.openai.com"),
                "{:?} 에서 OpenAI API 직접 호출 발견 — Rust 백엔드 경유 필수",
                path
            );
            assert!(
                !content.contains("api.anthropic.com"),
                "{:?} 에서 Anthropic API 직접 호출 발견",
                path
            );

            // fetch/axios로 AI API 호출 패턴
            assert!(
                !content.contains("fetch('https://api.openai"),
                "{:?} 에서 fetch로 AI API 직접 호출 발견",
                path
            );
        }
    }
}
```

### 5.2 OWASP Top 10 데스크톱 앱 체크리스트

| 항목 | 테스트 방법 | 확인 기준 |
|------|-----------|---------|
| **인젝션** | SQL 특수문자 입력 테스트 | rusqlite params! 매크로 사용 확인 |
| **민감 데이터 노출** | API 키 유출 스캔 | 소스 코드 + 빌드 아티팩트 검사 |
| **보안 설정 오류** | CSP 헤더 확인 | `connect-src 'none'` 설정 확인 |
| **취약한 구성요소** | cargo audit + npm audit | HIGH/CRITICAL 0개 |
| **불충분한 로깅** | AuditLog 엔트리 확인 | 주요 이벤트 기록 여부 |
| **메모리 안전** | Rust safe code 확인 | unsafe 블록 최소화 |

---

## 6. 성능 벤치마크 테스트

### 6.1 측정 기준

```
측정 환경 (기준 기기):
  CPU: Intel Core i5-12400 (6코어)
  RAM: 16GB DDR4-3200
  SSD: NVMe 500MB/s 읽기
  OS: Windows 11 22H2
  네트워크: 100Mbps
```

### 6.2 Rust 벤치마크 (criterion)

```rust
// src-tauri/benches/db_bench.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_conversation_list_load(c: &mut Criterion) {
    let conn = setup_test_db_with_100_conversations();

    c.bench_function("대화 목록 100개 로딩", |b| {
        b.iter(|| {
            let _: Vec<Conversation> = conn
                .prepare_cached(
                    "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50"
                )
                .unwrap()
                .query_map([], Conversation::from_row)
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();
        })
    });
    // 목표: < 50ms
}

fn bench_pii_detection(c: &mut Criterion) {
    // 5000자 텍스트 PII 감지 속도
    // 목표: < 500ms
}

criterion_group!(benches, bench_conversation_list_load, bench_pii_detection);
criterion_main!(benches);
```

### 6.3 Vitest 성능 테스트

```ts
// src/lib/performance.test.ts
import { describe, it, expect } from 'vitest';

describe('성능 목표 검증', () => {
  it('비용 계산 1000회가 10ms 이내', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calcCost('gpt-4o', 1000, 500);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });

  it('명령 팔레트 검색이 5ms 이내', () => {
    const start = performance.now();
    searchCommands('설정');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5);
  });
});
```

---

## 7. CI 테스트 게이트

```yaml
# .github/workflows/test.yml — 테스트 전용 워크플로우
name: Test Gate

on: [push, pull_request]

jobs:
  rust-tests:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: cargo audit (보안 취약점)
        run: cargo audit --manifest-path src-tauri/Cargo.toml
      - name: cargo test (단위·통합 테스트)
        run: cargo test --manifest-path src-tauri/Cargo.toml
      - name: cargo tarpaulin (커버리지)
        run: |
          cargo install cargo-tarpaulin
          cargo tarpaulin --manifest-path src-tauri/Cargo.toml \
            --fail-under 70 --out Xml

  ts-tests:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - name: npm audit (보안 취약점)
        run: npm audit --audit-level=high
      - name: API 키 유출 스캔
        run: |
          grep -rn "sk-[A-Za-z0-9]{20,}" src/ && exit 1 || echo "OK"
      - name: vitest (단위 테스트 + 커버리지)
        run: npx vitest run --coverage
      - name: TypeScript 타입 체크
        run: npx tsc --noEmit

  e2e-tests:
    runs-on: windows-latest
    needs: [rust-tests, ts-tests]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install chromium
      - name: E2E 테스트 (5개 핵심 시나리오)
        run: npx playwright test
        env:
          TEST_OPENAI_KEY: ${{ secrets.TEST_OPENAI_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 8. 테스트 데이터 관리

```ts
// src/__fixtures__/test-data.ts
export const TEST_CONVERSATIONS = [
  { id: 'conv-1', title: '테스트 대화 1', provider_ids: '["prov-openai"]' },
  // ... 100개 대화 픽스처
];

export const TEST_API_KEYS = {
  // 실제 키 아님 — 형식 테스트용
  openai: 'sk-test-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  anthropic: 'sk-ant-test-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
};

export const TEST_PII_SAMPLES = [
  { input: '홍길동 010-1234-5678', expectedTypes: ['PHONE'] },
  { input: 'test@example.com', expectedTypes: ['EMAIL'] },
  { input: '900101-1234567', expectedTypes: ['RESIDENT_ID'] },
  { input: '4532015112830366', expectedTypes: ['CREDIT_CARD'] },
];
```

---

## 9. 테스트 실행 전체 명령 모음

```bash
# 전체 테스트 (로컬)
npm run test:all

# package.json scripts
{
  "test:unit:rust": "cargo test --manifest-path src-tauri/Cargo.toml",
  "test:unit:ts": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:e2e:mock": "KEYCHAIN_TEST=1 playwright test",
  "test:security": "cargo audit && npm audit --audit-level=high",
  "test:types": "tsc --noEmit",
  "test:contract": "vitest run tests/contract",
  "test:all": "npm run test:security && npm run test:unit:rust && npm run test:unit:ts && npm run test:e2e",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage && cargo tarpaulin",
  "dev:mock": "TAURI_MOCK=1 vite --port 1420"
}
```

---

## 10. AI 스트리밍 IPC 채널 모킹 (v1.1 신규 — Phase 1 착수 전 필수)

> `stream_ai_message`는 `z.void()`를 반환하고 실제 토큰은 `ipc::Channel`을 통해 비동기로 수신됨.
> 현재 `invoke = vi.fn()` 단순 모킹으로는 채널 동작을 전혀 테스트할 수 없음.

### 10.1 MockIpcChannel 구현

```typescript
// src/__mocks__/tauri-channel.ts
import { vi } from 'vitest';
import type { StreamChunk } from '@/lib/schemas/ai';

export class MockIpcChannel {
  private handlers: ((chunk: StreamChunk) => void)[] = [];

  onEvent(handler: (chunk: StreamChunk) => void) {
    this.handlers.push(handler);
    return this;
  }

  // 테스트에서 청크를 순서대로 주입
  async emit(chunks: StreamChunk[], delayMs = 0) {
    for (const chunk of chunks) {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      this.handlers.forEach(h => h(chunk));
    }
  }
}

// src/__mocks__/tauri.ts 업데이트
let _activeChannel: MockIpcChannel | null = null;

export const invoke = vi.fn(async (command: string) => {
  if (command === 'stream_ai_message') {
    _activeChannel = new MockIpcChannel();
    return _activeChannel;
  }
  return null;
});

export const getActiveChannel = () => _activeChannel;
```

### 10.2 스트리밍 훅 테스트 (4개 필수 케이스)

```typescript
// src/features/chat/hooks/useAiStream.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiStream } from './useAiStream';
import { invoke, getActiveChannel } from '@/__mocks__/tauri';

const BASE_INPUT = {
  conversation_id: crypto.randomUUID(),
  content: '테스트',
  provider: 'anthropic' as const,
  model_id: 'claude-sonnet-4-6',
  stream_id: crypto.randomUUID(),
  attachments: [],
  persona_id: null,
  privacy_mode: false,
};

describe('useAiStream — IPC Channel 통합', () => {
  it('[필수] 토큰 청크가 순차 누적되고 done 수신 시 종료', async () => {
    const { result } = renderHook(() => useAiStream());
    await act(async () => {
      result.current.startStream(BASE_INPUT);
      await getActiveChannel()!.emit([
        { type: 'token', content: '안녕', index: 0 },
        { type: 'token', content: '하세요', index: 1 },
        { type: 'done', message_id: crypto.randomUUID(),
          input_tokens: 10, output_tokens: 5, cost_usd: 0.0001 },
      ]);
    });
    expect(result.current.streamedText).toBe('안녕하세요');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.cost?.usd).toBeCloseTo(0.0001);
  });

  it('[필수] error 청크 수신 시 isError 전환', async () => {
    const { result } = renderHook(() => useAiStream());
    await act(async () => {
      result.current.startStream(BASE_INPUT);
      await getActiveChannel()!.emit([
        { type: 'error', code: 'AI_003', message: '서버 오류' },
      ]);
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.errorCode).toBe('AI_003');
  });

  it('[필수] cancel 후 잔여 토큰은 무시', async () => {
    const { result } = renderHook(() => useAiStream());
    await act(async () => {
      result.current.startStream(BASE_INPUT);
      const ch = getActiveChannel()!;
      await ch.emit([{ type: 'token', content: '첫', index: 0 }]);
      result.current.cancelStream();
      await ch.emit([{ type: 'token', content: '무시됨', index: 1 }]);
    });
    expect(result.current.streamedText).toBe('첫');
  });

  it('[필수] cancel_stream IPC 호출 확인', async () => {
    const { result } = renderHook(() => useAiStream());
    const sid = BASE_INPUT.stream_id;
    await act(async () => {
      result.current.startStream({ ...BASE_INPUT, stream_id: sid });
      result.current.cancelStream();
    });
    expect(invoke).toHaveBeenCalledWith('cancel_stream', { args: { stream_id: sid } });
  });
});
```

---

## 11. Rust↔TypeScript 계약 테스트 (v1.1 신규 — Phase 1 착수 전 필수)

> AiFlowError JSON 직렬화 포맷이 TypeScript ErrorResponseSchema와 실제로 매칭되는지 검증

### 11.1 Rust 픽스처 자동 생성

```rust
// src-tauri/tests/contract_test.rs
#[test]
fn generate_ipc_contract_fixtures() {
    let errors: Vec<IpcError> = vec![
        AiFlowError::ApiKeyNotSet { provider: "openai".to_string() }.to_ipc_error(),
        AiFlowError::RateLimitExceeded { retry_after: 30 }.to_ipc_error(),
        AiFlowError::FileTooLarge { max_mb: 10, actual_mb: 15 }.to_ipc_error(),
        AiFlowError::ConversationNotFound { id: "test-id".to_string() }.to_ipc_error(),
    ];
    let json = serde_json::to_string_pretty(&errors).unwrap();
    // CI에서 픽스처 파일 갱신 (git commit 대상)
    std::fs::write("tests/fixtures/ipc-errors.json", &json).unwrap();
}
```

### 11.2 TypeScript 계약 검증

```typescript
// tests/contract/ipc-errors.test.ts
import { readFileSync } from 'fs';
import { ErrorResponseSchema } from '@/lib/schemas/common';
import { isIpcError } from '@/lib/errors';

const fixtures = JSON.parse(
  readFileSync('./tests/fixtures/ipc-errors.json', 'utf-8')
);

describe('Rust↔TypeScript IPC 계약', () => {
  it('모든 Rust 에러가 ErrorResponseSchema를 통과해야 함', () => {
    for (const fixture of fixtures) {
      const result = ErrorResponseSchema.safeParse(fixture);
      expect(result.success, `실패: ${JSON.stringify(fixture)}`).toBe(true);
    }
  });

  it('isIpcError() guard가 모든 Rust 에러를 인식', () => {
    for (const fixture of fixtures) {
      expect(isIpcError(fixture)).toBe(true);
    }
  });

  it('AI_001 에러에 provider 필드 포함', () => {
    const ai001 = fixtures.find((f: any) => f.code === 'AI_001');
    expect(ai001?.message).toContain('openai');
  });
});
```

> CI 워크플로우에 `npm run test:contract` 추가 필수

---

## 12. OS 키체인 모킹 — InMemoryKeychain (v1.1 신규)

> CI(windows-latest)에서 Windows Credential Manager 접근 실패 방지
> 키체인 실패 시나리오(`KEYCHAIN_002`) E2E 테스트 가능

### 12.1 Rust 키체인 추상화

```rust
// src-tauri/src/keychain/mod.rs
pub trait KeychainBackend: Send + Sync {
    fn get_key(&self, provider: &str) -> Result<Option<String>, AiFlowError>;
    fn set_key(&self, provider: &str, key: &str) -> Result<(), AiFlowError>;
    fn delete_key(&self, provider: &str) -> Result<(), AiFlowError>;
}

// 프로덕션: Windows Credential Manager
pub struct WindowsKeychain;

// 테스트/CI: 인메모리 (환경변수 KEYCHAIN_TEST=1 시 자동 활성화)
pub struct InMemoryKeychain {
    store: std::sync::Mutex<std::collections::HashMap<String, String>>,
}

impl InMemoryKeychain {
    pub fn with_preset(provider: &str, key: &str) -> Self {
        let kc = Self { store: Default::default() };
        kc.set_key(provider, key).unwrap();
        kc
    }
}

pub fn get_keychain_backend() -> Box<dyn KeychainBackend> {
    if std::env::var("KEYCHAIN_TEST").is_ok() {
        Box::new(InMemoryKeychain { store: Default::default() })
    } else {
        Box::new(WindowsKeychain)
    }
}
```

### 12.2 Playwright E2E — 키체인 모킹 설정

```typescript
// playwright.config.ts 업데이트
export default defineConfig({
  webServer: {
    command: 'npm run tauri dev',
    env: {
      KEYCHAIN_TEST: '1',           // InMemoryKeychain 활성화
      PRESET_OPENAI_KEY: 'sk-test-xxxx', // 사전 설정 키
    },
    url: 'http://localhost:1420',
  },
});

// tests/e2e/01-onboarding.spec.ts
test('온보딩 — 키체인 모킹 환경 (CI 안전)', async ({ page }) => {
  await page.fill('[data-testid="input-openai-key"]', 'sk-test-openai');
  await page.click('[data-testid="btn-validate-key"]');
  await expect(page.locator('[data-testid="key-valid-badge"]')).toBeVisible();
});

test('키체인 실패 — KEYCHAIN_002 에러 Toast 표시', async ({ page }) => {
  // Tauri IPC 인터셉트로 실패 주입
  await page.route('**/tauri-ipc*', async route => {
    const body = route.request().postDataJSON();
    if (body?.cmd === 'save_api_key') {
      return route.fulfill({ status: 200,
        body: JSON.stringify({ code: 'KEYCHAIN_002', message: '키체인 저장 실패' }) });
    }
    return route.continue();
  });
  await page.click('[data-testid="btn-save-key"]');
  await expect(page.locator('[data-testid="error-toast"]'))
    .toContainText('Windows 자격 증명 관리자를 확인해주세요');
});
```

---

## 13. 테스트 팩토리 패턴 (v1.1 신규)

```typescript
// src/__fixtures__/factories.ts
import { faker } from '@faker-js/faker/locale/ko';

export const createConversation = (overrides = {}) => ({
  id: faker.string.uuid(),
  title: faker.lorem.words(3),
  provider: faker.helpers.arrayElement(['openai', 'anthropic', 'google']),
  model_id: 'gpt-4o',
  persona_id: null,
  privacy_mode: false,
  message_count: faker.number.int({ min: 1, max: 50 }),
  total_cost_usd: faker.number.float({ min: 0, max: 1, fractionDigits: 6 }),
  created_at: faker.date.recent().toISOString(),
  ...overrides,
});

export const createStreamSequence = (tokenCount = 5, msgId = faker.string.uuid()) => [
  ...Array.from({ length: tokenCount }, (_, i) => ({
    type: 'token' as const, content: faker.lorem.word(), index: i,
  })),
  { type: 'done' as const, message_id: msgId,
    input_tokens: 100, output_tokens: tokenCount * 5, cost_usd: 0.001 },
];

export const createConversationWithMessages = (count = 10) => {
  const conv = createConversation();
  const messages = Array.from({ length: count }, (_, i) => ({
    id: faker.string.uuid(),
    conversation_id: conv.id,
    role: i % 2 === 0 ? 'user' : 'assistant' as const,
    content: faker.lorem.paragraph(),
    cost_usd: faker.number.float({ min: 0.0001, max: 0.01, fractionDigits: 8 }),
    created_at: faker.date.recent().toISOString(),
  }));
  return { conversation: conv, messages };
};
```

---

## 14. criterion 벤치마크 CI 통합 (v1.1 신규)

> 현재 `06_TEST_SPEC.md`에 벤치마크 코드는 있지만 CI에 통합이 누락됨

```yaml
# .github/workflows/benchmark.yml (신규)
name: Performance Benchmark
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  rust-benchmark:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: dtolnay/rust-toolchain@stable
      - name: Run criterion benchmarks
        run: |
          cargo bench --manifest-path src-tauri/Cargo.toml \
            -- --output-format bencher | tee benchmark-output.txt
      - name: Store benchmark result
        uses: benchmark-action/github-action-benchmark@v1
        with:
          name: Rust Criterion Benchmark
          tool: cargo
          output-file-path: benchmark-output.txt
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true
          alert-threshold: '110%'   # 10% 이상 느려지면 PR 코멘트 경고
          comment-on-alert: true
          fail-on-alert: false      # 경고만, 빌드 실패 아님
```

```rust
// src-tauri/benches/core_bench.rs 에 추가
fn bench_pii_detection(c: &mut Criterion) {
    let text = "이름: 홍길동, 전화: 010-1234-5678 ".repeat(50); // 약 1500자
    c.bench_function("PII 감지 1500자", |b| b.iter(|| detect_pii(&text)));
    // 목표: < 500ms
}

fn bench_message_bulk_insert(c: &mut Criterion) {
    let db = TestDb::new();
    c.bench_function("메시지 100개 삽입", |b| b.iter(|| {
        for _ in 0..100 {
            db.insert_test_message();
        }
    }));
    // 목표: < 200ms
}
```
