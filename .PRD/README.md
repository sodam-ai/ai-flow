# AIFlow — 디자인 문서 v4.0

> v3.6: CRITICAL 보안 3개 수정 + 4계층 아키텍처 + STRIDE 위협 모델 + PIPA 컴플라이언스 (16개 문서)
> **v4.0**: Phase 1a/1b 분리 + Provider Trait + i18n + 업데이터 Phase 1b + 인시던트 대응 + 리스크 레지스터 + E2E 현실화 + 30개 설계 결정 확정 (총 **17개 문서**)

---

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 제품 요구사항, 차별점, 기능 전체 목록, **에러 카탈로그 15개**, **PIPA 컴플라이언스**, 성능 목표 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조, 엔티티 관계, SQLite 마이그레이션 20개, **Cascade Delete**, **DB 인덱스 전략** | DB 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | Phase별 계획, **AI에게 그대로 붙여넣기 가능한 시작 프롬프트**, 보안 체크리스트 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, **4계층 아키텍처(commands/services/models/db)**, **멀티 윈도우 통신**, reqwest 연결풀, OS 키체인 폴백, 절대 금지 목록 | AI에게 코드 시킬 때마다 |
| [05_SECURITY_SPEC.md](./05_SECURITY_SPEC.md) | **🔒 보안 전용 명세서 v1.2** — API 키 보안, SQLCipher 솔트 랜덤화, TempFileGuard, SBOM, PII 보안, 감사 로그 | 보안 구현 및 검토 시 |
| [06_TEST_SPEC.md](./06_TEST_SPEC.md) | **🧪 테스트 전략 v1.1** — Rust cargo-tarpaulin, Vitest, Playwright E2E, **IPC Channel 모킹**, **Rust↔TS 계약 테스트**, **InMemoryKeychain**, 팩토리 패턴, criterion CI | 테스트 작성 시 |
| [07_DEVOPS.md](./07_DEVOPS.md) | **⚙️ CI/CD 완전 명세** — GitHub Actions, Windows Authenticode 코드서명, Tauri auto-updater, **SBOM CycloneDX + Grype** | 배포 및 릴리즈 시 |
| [08_UX_FLOWS.md](./08_UX_FLOWS.md) | **🎨 UX 플로우 명세** — 사용자 플로우 다이어그램, 에러 UI, WCAG 2.1 AA 접근성, 컴포넌트 설계 | UI 구현 시 |
| [09_PLUGIN_API.md](./09_PLUGIN_API.md) | **🔌 플러그인 API (Phase 3)** — 플러그인 생명주기, API, 보안 샌드박스, **Windows Job Object**, MCP 마켓 | Phase 3 개발 시 |
| [10_PERFORMANCE_SPEC.md](./10_PERFORMANCE_SPEC.md) | **🚀 성능 명세** — SLA 목표값, criterion 벤치마크, 스트리밍 배칭, 가상화 스크롤, SQLite 튜닝 | 성능 최적화 시 |
| [11_MONITORING_SPEC.md](./11_MONITORING_SPEC.md) | **📊 모니터링 명세** — Privacy-by-Design, tracing_subscriber, Sentry PII 필터링, 익명 분석 | 에러 추적·모니터링 구현 시 |
| [12_RELEASE_CHECKLIST.md](./12_RELEASE_CHECKLIST.md) | **✅ 릴리즈 체크리스트** — QA·보안·성능·문서·빌드·배포·사후 모니터링 7단계 게이트, 롤백 기준 | 모든 릴리즈 전 |
| [13_ZOD_SCHEMAS.md](./13_ZOD_SCHEMAS.md) | **📋 IPC Zod 스키마** — 전체 IPC 타입 정의, invokeValidated() 패턴, **Windows 경로 검증 강화** | AI에게 코드 시킬 때마다 |
| [14_ERROR_CATALOG.md](./14_ERROR_CATALOG.md) | **🚨 에러 카탈로그** — 전체 에러 코드, 한국어/영어 메시지, Rust·TS 구현 패턴, 복구 행동 | 에러 처리 구현 시 |
| [15_THREAT_MODEL.md](./15_THREAT_MODEL.md) | **🛡️ STRIDE 위협 모델 v1.0** — 공격면 지도, 위협 분석, 업데이터 보안, 레이트 리미팅, Privacy Mode 격리, CSP | 보안 구현 시 반드시 |
| [16_COMPLIANCE.md](./16_COMPLIANCE.md) | **⚖️ 컴플라이언스 명세 v1.0** — PIPA·GDPR·CCPA, 데이터 인벤토리, 기기 ID 랜덤 UUID, 사용자 권리, 개인정보처리방침 초안 | 개인정보·결제 구현 시 |
| [17_INCIDENT_RESPONSE.md](./17_INCIDENT_RESPONSE.md) | **🚨 인시던트 대응 v4.0** — 유출 분류, GDPR 72시간 타임라인, 자동 대응, 사용자 알림, 포렌식 보존 | 보안 사고 발생 시 즉시 |

---

## 한눈에 보는 제품 요약

| 항목 | 내용 |
|------|------|
| **제품명** | AIFlow |
| **한 줄 설명** | 단축키 하나로 어디서나 GPT·Claude·Gemini·로컬 LLM을 동시에 쓰는 AI 통합 데스크톱 허브 |
| **플랫폼** | Windows 10 21H2+ / Windows 11 (Tauri 2.10+ + React 19 + TypeScript) |
| **로그인** | 없음 (로컬 전용) — Free 티어 / Pro 티어 |
| **핵심 차별점** | 글로벌 단축키(`Alt+Space`) + OS 키체인 보안 + 실시간 비용(USD+KRW) + 스마트 AI 라우팅 + 프라이버시 모드 + MCP 마켓 |
| **스택** | Tauri 2.10+ + React 19 + TypeScript + SQLite(SQLCipher) + Tailwind v4 + shadcn/ui + Zustand + Zod |
| **API 키 보안** | OS 키체인 (`tauri-plugin-keyring`) + DB 암호화 (SQLCipher + PBKDF2-SHA512 25만 반복) |
| **수익화** | 오픈코어 모델 — Free(영구) + Pro($9.99/월 or $89/년 글로벌, ₩14,900/월 or ₩129,000/년 한국) |
| **테스트** | Rust 80%+ / TS 75%+ 커버리지 + 계층 분리 E2E (Vitest + 수동 체크리스트 6시나리오) |
| **배포** | GitHub Actions + Azure Key Vault 코드서명 + Tauri auto-updater (stable/beta 채널) |
| **성능 목표** | 오버레이 <200ms, TTFT <800ms, 메모리 유휴 <80MB |
| **모니터링** | Privacy-by-Design — 대화 내용·API 키 수집 절대 금지, 익명 분석만 |

---

## Phase별 필수 참조 문서 (v4.0 신규)

### Phase 1a 개발 시 필수 참조
| 문서 | 참조 섹션 |
|------|----------|
| 01_PRD.md | §3 Phase 1a 기능 체크리스트, §8 Phase 1a 성공 기준, §11 설계 결정 30개, §13 성능 목표 |
| 02_DATA_MODEL.md | Phase 1 테이블 (AIProvider, Conversation, Message, Settings, AuditLog) |
| 04_PROJECT_SPEC.md | 빌드 전제조건, 4계층 아키텍처, Provider Trait, 기술 스택 전체, "절대 하지 마" |
| 05_SECURITY_SPEC.md | §2 API 키 보안 (유효성 검증 포함), §3 SQLCipher, AuditLog trigger |
| 13_ZOD_SCHEMAS.md | AI, Conversation, Message, Settings IPC 스키마 |
| 14_ERROR_CATALOG.md | AI_xxx, DB_xxx, KEYCHAIN_xxx, VAL_xxx 에러 코드 |

### Phase 1b 개발 시 추가 참조
| 문서 | 참조 섹션 |
|------|----------|
| 03_PHASES.md | Phase 1b 기능 체크리스트, 성능 목표, 리스크 레지스터 |
| 06_TEST_SPEC.md | v4.0 E2E 전략 (계층 분리), 단위/통합 테스트 패턴 |
| 08_UX_FLOWS.md | 오버레이 UI, 명령 팔레트, 온보딩 3단계 |
| 15_THREAT_MODEL.md | Ed25519 업데이터 보안, CSP |

---

## v3.3 → v3.4 추가 포인트

| 항목 | v3.3 (12개 문서) | v3.4 (14개 문서) |
|------|----------------|-----------------|
| IPC 타입 정의 | 언급만 있음 | **13_ZOD_SCHEMAS.md** — 전체 IPC 스키마 + invokeValidated() 완전 구현 |
| 에러 메시지 | 분산 언급 | **14_ERROR_CATALOG.md** — 전체 에러 코드 + 한국어 메시지 SSOT |
| reqwest 연결풀 | DO NOT 규칙만 | **04_PROJECT_SPEC.md 패치** — 싱글톤 완전 구현 코드 |
| 스트림 취소 | 언급만 | **04_PROJECT_SPEC.md 패치** — StreamRegistry + cancel_stream 완전 구현 |
| OS 키체인 폴백 | 미정 | **04_PROJECT_SPEC.md 패치** — 폴백 정책 + 구현 코드 |

---

## v3.2 → v3.3 추가 포인트

| 항목 | v3.2 (9개 문서) | v3.3 (12개 문서) |
|------|----------------|-----------------|
| 성능 명세 | 일부 언급 (01_PRD) | **10_PERFORMANCE_SPEC.md** — criterion 벤치마크·SLA·최적화 패턴 |
| 모니터링 | 없음 | **11_MONITORING_SPEC.md** — Sentry PII 필터링·익명 분석·건강 체크 |
| 릴리즈 절차 | 없음 | **12_RELEASE_CHECKLIST.md** — 7단계 게이트·롤백 기준·서명 절차 |

---

## v3.1 → v3.2 추가 포인트

| 항목 | v3.1 (5개 문서) | v3.2 (9개 문서) |
|------|----------------|----------------|
| 테스트 전략 | 언급만 | **06_TEST_SPEC.md** — 전체 테스트 명세 |
| CI/CD | 없음 | **07_DEVOPS.md** — GitHub Actions + 코드서명 + 배포 |
| UX 플로우 | 없음 | **08_UX_FLOWS.md** — 다이어그램 + 컴포넌트 + 접근성 |
| 플러그인 API | 없음 | **09_PLUGIN_API.md** — Phase 3 전체 명세 |
| 보안 갭 | 9개 미해소 | **05_SECURITY_SPEC.md v1.1** — 전부 해소 |
| DB 삭제 정책 | 없음 | **02_DATA_MODEL.md** — Cascade Delete + 인덱스 20개 |
| reqwest 취소 | 부분 | **04_PROJECT_SPEC.md** — CancellationToken + 연결풀 |
| Zod 검증 | 일부 | **04_PROJECT_SPEC.md** — 전체 스키마 + invokeValidated |

---

## v3.0 → v3.1 업그레이드 포인트

| 항목 | v3.0 | v3.1 |
|------|------|------|
| 설계 결정사항 | 17개 미결 | **전부 확정** (단축키, 가격, 오버레이, 환율 등) |
| 보안 문서 | 각 문서에 분산 | **05_SECURITY_SPEC.md 전용 명세서 신규** |
| 에러 처리 | 언급만 | **15가지 에러 카탈로그 + 한국어 메시지 + 복구 행동** |
| 성능 목표 | 없음 | **8가지 지표 + 목표값 명시** |
| 컴플라이언스 | 없음 | **PIPA/GDPR 사용자 권리 구현 + 데이터 보존 정책** |
| 가격 구조 | ₩12,900 (환율 미반영) | **₩14,900/월 (환율 아비트리지 방지)** |
| 단축키 기본값 | Ctrl+Shift+Space (Win11 충돌) | **Alt+Space (충돌 없음) + 충돌 감지 로직** |

---

## 확정된 설계 결정사항 (v3.1 — 전체 요약)

> 전체 상세 내용은 각 문서의 "확정된 설계 결정사항" 섹션 참조

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | 글로벌 단축키 | `Alt+Space` (오버레이), `Alt+Shift+A` (클립보드) |
| 2 | Phase 1 AI 모델 | GPT-4o, Claude Sonnet 4.6, Gemini 1.5 Flash |
| 3 | Phase 1 파일 형식 | PDF·TXT·MD·코드·이미지 (최대 10MB) |
| 4 | 비용 통화 | USD + KRW 병행 (ExchangeRate-API 1일 캐시, 폴백 1380) |
| 5 | 오버레이 UI | 중앙 스포트라이트 640px (Raycast 스타일) |
| 6 | Pro 가격 | $9.99/월 · $89/년 (글로벌) / ₩14,900/월 · ₩129,000/년 (한국) |
| 7 | 오픈소스 | 현재 클로즈드, Phase 3 후 코어 MIT 공개 검토 |
| 8 | 브라우저 확장 | Phase 2 |
| 9 | SQLCipher 키 유도 | PBKDF2-SHA512 25만 반복 |
| 10 | PII 역마스킹 | 미지원 (마스킹 전용 정책) |
| 11 | 배치 결과 저장 | 파일시스템 (DB엔 경로만) |
| 12 | BrowserExtContext 보존 | 7일 |
| 13 | 라이선스 오프라인 | 30일 |
| 14 | OpenRedaction | npm + Vite 번들 |
| 15 | 라우팅 임계값 | 35 / 72 (기본, 조정 가능) |
| 16 | 글로벌 결제 | LemonSqueezy |
| 17 | Windows 최소 요구 | Win10 21H2 (빌드 19044) 이상 |

---

## 다음 단계

Phase 1을 시작하려면 [03_PHASES.md](./03_PHASES.md)의 **"Phase 1 시작 프롬프트"** 를 복사해서 AI에게 전달하세요.

```
반드시 이 9개 파일을 함께 첨부 (최소 필수):
@.PRD/01_PRD.md
@.PRD/02_DATA_MODEL.md
@.PRD/03_PHASES.md
@.PRD/04_PROJECT_SPEC.md      ← v3.6: 4계층 아키텍처 + 멀티 윈도우 통신 포함
@.PRD/05_SECURITY_SPEC.md
@.PRD/13_ZOD_SCHEMAS.md       ← IPC 타입 안전성 필수
@.PRD/14_ERROR_CATALOG.md     ← 에러 처리 일관성 필수
@.PRD/15_THREAT_MODEL.md      ← v3.6 신규: STRIDE + 레이트 리미팅 + 업데이터 보안
@.PRD/16_COMPLIANCE.md        ← v3.6 신규: PIPA + 기기 ID 정책 + 사용자 권리

선택 첨부 (해당 작업 시):
@.PRD/06_TEST_SPEC.md          ← 테스트 코드 작성 시
@.PRD/07_DEVOPS.md             ← CI/CD 설정 시
@.PRD/08_UX_FLOWS.md           ← UI 컴포넌트 구현 시
@.PRD/09_PLUGIN_API.md         ← Phase 3 플러그인 개발 시
@PRD/10_PERFORMANCE_SPEC.md   ← 성능 최적화 작업 시
@PRD/11_MONITORING_SPEC.md    ← 에러 추적·분석 구현 시
@PRD/12_RELEASE_CHECKLIST.md  ← 릴리즈 직전 반드시
```

> **v3.1 이후 필수**: `05_SECURITY_SPEC.md` 없이 코드 작성 시 보안 체크리스트를 놓칠 수 있음.
> **v3.2 신규**: 테스트·배포·UX·플러그인 작업 시 해당 문서도 함께 첨부 권장.
> **v3.3 신규**: 성능·모니터링 구현 시 10·11번 문서, 릴리즈 전 12번 문서 **필수** 확인.
