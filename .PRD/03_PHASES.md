# AIFlow — Phase 분리 계획 v3.1

> v3.0 업그레이드: AI 페르소나 + 명령 팔레트 (Phase 1), 스마트 라우팅 + 프라이버시 모드 + 브라우저 확장 + 수익화 (Phase 2)
> v3.1 추가: 17개 설계 결정사항 반영 + 보안 체크리스트 강화 + 성능 목표 추가 + 스트림 취소 UI 포함
> 각 Phase는 "단독으로 배포 가능한 가치 있는 제품"이어야 합니다.

---

## Phase 1: MVP — "어디서든 AI" (예상 기간: 1~2주)

### 목표
설치 즉시 단축키 하나로 어느 앱에서나 AI를 호출하고, 파일을 드래그앤드롭해 AI에 전달하며, AI 페르소나와 명령 팔레트로 빠르게 작업하는 — **경쟁사 어디도 없는** 데스크톱 AI 허브.

### 기능 체크리스트 (v3.1 확정 사항 반영)
- [ ] **글로벌 단축키 오버레이** (`Alt+Space` — Win11 이모지 충돌 회피) — 어느 앱에서든 AIFlow 소환
- [ ] **AI Provider 연결** — GPT-4o, Claude Sonnet 4.6, Gemini 1.5 Flash API 키 → OS 키체인 암호화 저장
- [ ] **멀티 AI 채팅** — 2~3개 AI 동시 선택, 나란히 스트리밍 비교 + **중지 버튼** (cancel_stream)
- [ ] **실시간 비용 표시** — 메시지마다 토큰 수 + USD + KRW 병행 (환율: 실시간 캐시, 폴백 1380)
- [ ] **파일 드래그앤드롭** — PDF·TXT·MD·코드·**이미지** 파일 → AI 전달 (최대 10MB, 화이트리스트 검증)
- [ ] **클립보드 → AI** (`Alt+Shift+A`) — 현재 클립보드 즉시 AI 전송
- [ ] **프롬프트 저장고** — 저장/태그/검색/`{{변수}}` 슬롯/버튼 한 번 삽입
- [ ] **AI 페르소나** — 기본 6종 내장 (개발자/카피라이터/번역가/분석가/법무/요약)
- [ ] **AI 명령 팔레트** (`Ctrl+K`) — 자연어로 앱 기능 접근 ("새 대화", "프롬프트 저장", "설정 열기")
- [ ] **SQLCipher DB 암호화** — AES-256 + PBKDF2-SHA512 25만 반복 키 유도 + cipher_memory_security ON
- [ ] **DB 자동 백업** — 마이그레이션 전 자동 백업 (최근 5개 보존)
- [ ] **감사 로그** — AuditLog 엔티티 + INSERT 전용 trigger (UPDATE/DELETE 차단)
- [ ] **IPC Zod 검증** — 모든 invoke 파라미터 Zod 스키마 검증
- [ ] **메시지 페이지네이션** — 50개씩 로드 (가상 스크롤)
- [ ] **시스템 트레이** — 앱 닫아도 백그라운드 상주, 트레이 아이콘 + 메뉴
- [ ] **채팅 히스토리** — 대화 목록, 핀 고정, 이름 변경, 이어서 대화
- [ ] **기본 UI** — 다크모드 기본, 사이드바, 설정 화면 (중앙 스포트라이트 오버레이)

### 사용할 Tauri 플러그인
```toml
# src-tauri/Cargo.toml에 추가
tauri-plugin-global-shortcut  # 글로벌 단축키
tauri-plugin-clipboard-manager  # 클립보드 읽기
tauri-plugin-fs  # 파일 드래그앤드롭 처리
tauri-plugin-notification  # 완료 알림
tauri-plugin-store  # 키-값 영구 저장 (설정)
# tauri-plugin-keyring (community) — OS 키체인
# rusqlite + bundled-sqlcipher — SQLCipher 암호화 DB
# 시스템 트레이 → Tauri 기본 기능 (별도 플러그인 불필요)
```

### 데이터 (Phase 1에서 사용하는 테이블)
- AIProvider, AIPersona, Settings, LicenseInfo(Free만)
- Conversation, Message, **MessageVersion**, FileAttachment, CostLog, Prompt
- **ErrorLog**, **AuditLog** (v3.1 신규 — Phase 1부터 필수)

### 인증
- 없음 (로컬 전용 앱, Free 티어)

### "진짜 제품" 체크리스트
- [ ] 실제 AI API 호출 (mock 데이터 X)
- [ ] API 키가 OS 키체인에 저장됨 (코드·DB·파일 어디에도 평문 없음)
- [ ] DB 파일이 SQLCipher AES-256 + PBKDF2 키 유도로 암호화됨
- [ ] AuditLog에 UPDATE/DELETE 불변 trigger 설정됨
- [ ] DB 백업이 마이그레이션 전 자동 생성됨
- [ ] IPC invoke 파라미터가 Zod 스키마로 검증됨
- [ ] 앱 재시작 후에도 대화·프롬프트·페르소나 유지 (SQLite 영구 저장)
- [ ] 글로벌 단축키(`Alt+Space`)가 Word·Chrome·게임 등 어떤 앱에서도 동작
- [ ] 단축키 충돌 감지 시 에러 메시지와 설정 페이지 링크 표시
- [ ] `.exe` 또는 `.msi`로 빌드되어 Win10 21H2 이상에서 설치 가능
- [ ] 메시지마다 토큰 비용이 실제로 표시됨 (USD + KRW, 실시간 환율)
- [ ] AI 응답 스트리밍 중 "중지" 버튼이 동작함
- [ ] AI 재생성 시 MessageVersion이 생성되고 이전 버전 네비게이션 가능
- [ ] AI 페르소나 전환이 시스템 프롬프트를 실제로 변경함
- [ ] 명령 팔레트에서 모든 주요 기능에 접근 가능
- [ ] 파일 드롭 시 확장자 + 크기 검증 (화이트리스트 외 거부)

### Phase 1 성능 목표
| 지표 | 목표 |
|------|------|
| 앱 콜드 스타트 | < 2초 |
| 단축키 응답 | < 100ms |
| 첫 AI 토큰 수신 | < 1초 |
| DB 대화 목록 로딩 | < 50ms |

### Phase 1 시작 프롬프트
```
이 PRD를 읽고 Phase 1을 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1 범위 (v3.1 확정):
1. Tauri 프로젝트 초기 셋업 (React 19 + TypeScript + Tailwind v4 + shadcn/ui)
2. SQLCipher 암호화 DB 초기화
   - rusqlite + bundled-sqlcipher feature 활성화
   - PBKDF2-SHA512 25만 반복으로 DB 키 유도 (마스터키 직접 사용 금지)
   - PRAGMA cipher_memory_security = ON 설정
   - WAL 모드 + secure_delete = ON
   - 마이그레이션 전 자동 백업 (최근 5개 보존)
   - AuditLog 불변 trigger 설정 (UPDATE/DELETE 차단)
3. AI Provider 연결 (GPT-4o, Claude Sonnet 4.6, Gemini 1.5 Flash)
   - API 키는 반드시 tauri-plugin-keyring (OS 키체인)에 저장
   - DB에는 keychain_key 참조만 저장, API 키 평문 절대 금지
4. 멀티 AI 채팅 허브 (2~3개 동시, 나란히 비교, ipc::Channel 실시간 스트리밍)
   - cancel_stream command + "중지" 버튼 UI 필수
   - AI 재생성 → MessageVersion 자동 저장
5. 실시간 비용 표시 (메시지마다 토큰 수 + USD + KRW, ExchangeRate-API 캐시)
6. 파일 드래그앤드롭 → AI 전달 (PDF·TXT·MD·코드·이미지, 최대 10MB, 화이트리스트 검증)
7. 클립보드 → AI (Alt+Shift+A — 충돌 회피)
8. 프롬프트 저장고 ({{변수}} 슬롯 지원)
9. AI 페르소나 시스템 (6종 기본 내장 + 커스텀 생성)
10. AI 명령 팔레트 (Ctrl+K, 자연어 기능 접근)
11. 시스템 트레이 (앱 종료 대신 트레이 최소화)
12. 채팅 히스토리 (핀, 이름 변경) — 메시지 페이지네이션 (50개씩)
13. 기본 UI (다크모드, 사이드바, 설정) — 오버레이: 중앙 스포트라이트 640px
14. Zod IPC 검증 (모든 invoke 파라미터)
15. 보안 에러 처리 (에러 카탈로그 기반 한국어 메시지)

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 목록 준수
- 05_SECURITY_SPEC.md의 Phase 1 보안 체크리스트 완료
- IPC 스트리밍: Tauri ipc::Channel 사용 (EventSystem 아님)
- DB 암호화: SQLCipher (rusqlite + bundled-sqlcipher) + PBKDF2 키 유도
- 파일 드래그앤드롭: onDragDropEvent + tauri-plugin-fs 조합 + 검증
- SQLite WAL 모드 활성화 (PRAGMA journal_mode=WAL)
- DB 위치: $APPDATA/aiflow/aiflow.db (Tauri path resolver 사용)
- 글로벌 단축키 기본값: Alt+Space (오버레이), Alt+Shift+A (클립보드)
```

---

## Phase 2: 확장 — "AI 자동화 + 생태계" (예상 기간: 2~3주)

### 전제 조건
- Phase 1이 안정적으로 빌드 및 실행 가능
- 모든 Phase 1 기능이 버그 없이 동작

### 목표
스마트 AI 라우팅으로 비용을 자동 최적화하고, 개인정보를 보호하며, 브라우저에서 AIFlow로 컨텍스트를 전달하고, 구독 결제로 Pro 기능을 잠금 해제하는 — **완성형 개인 AI 도구**.

### 기능 체크리스트
- [ ] **스마트 AI 라우팅** — 질문 복잡도 분석 → 최적 AI 자동 선택 + 폴백 체인
- [ ] **프라이버시 모드** — OpenRedaction PII 자동 감지·마스킹 (570+ 패턴, 100% 로컬)
- [ ] **로컬 LLM 자동 감지** — Ollama(`localhost:11434`), LM Studio(`localhost:1234`) 자동 ping
- [ ] **MCP 플러그인 마켓** — filesystem, git, browser MCP 서버 원클릭 설치/관리
- [ ] **워크플로우 빌더** — 노드 추가, AI 선택, 단계 연결, 실행, 진행 표시
- [ ] **배치 처리 큐** — 여러 파일/프롬프트 순차 자동 처리 + 결과 파일 저장
- [ ] **브라우저 확장 (Chrome/Edge)** — 현재 페이지 → AIFlow 전송 (Chrome Native Messaging)
- [ ] **스크린샷 → 비전 AI** (`Ctrl+Shift+S`) — 화면 캡처 → GPT-4o Vision / Gemini Vision
- [ ] **프롬프트 버전 관리** — 수정 이력 자동 저장, 비교·복원
- [ ] **비용 주간/월간 리포트** — 모델별 토큰·비용 요약, 라우팅 절감액 표시
- [ ] **월 예산 알림** — 예산의 80% 도달 시 시스템 알림
- [ ] **Pro 티어 결제** — LemonSqueezy (글로벌) + 토스페이먼츠 + 네이버페이 (한국)
- [ ] **워크플로우 시작 템플릿 15종** — SNS, 코딩 리뷰, 번역, 요약 등
- [ ] **완료 알림** — 장시간 작업 완료 시 시스템 알림 (최소화 중에도)

### 추가 Tauri 플러그인
```toml
tauri-plugin-deep-link  # OAuth 콜백, 외부 앱 연동 (aiflow:// URL scheme)
# Chrome Native Messaging: Windows 레지스트리 등록 (별도 플러그인 불필요)
# LemonSqueezy 결제: Rust reqwest로 HTTP API 호출
```

### 추가 데이터 (Phase 2 신규 테이블)
- RoutingRule, BrowserExtContext
- BatchJob, BatchItem
- Workflow, WorkflowStep, WorkflowRun, WorkflowStepResult
- MCPServer, Template, PromptVersion
- LicenseInfo (Pro 활성화)

### 스마트 라우팅 구현 가이드
```rust
// 복잡도 점수 계산
fn calc_complexity(prompt: &str, has_file: bool, has_code: bool) -> u8 {
    let mut score = 0u8;
    if prompt.len() > 200 { score += 30; }
    if prompt.len() > 500 { score += 20; }
    if has_file { score += 20; }
    if has_code { score += 20; }
    // 추론 키워드 감지
    let reasoning_keywords = ["분석", "비교", "왜", "어떻게", "설명", "추론"];
    for kw in &reasoning_keywords {
        if prompt.contains(kw) { score += 5; }
    }
    score.min(100)
}
```

### 브라우저 확장 Chrome Native Messaging 등록
```json
// aiflow_native_messaging.json (Windows 레지스트리 등록 필요)
{
  "name": "com.aiflow.companion",
  "description": "AIFlow Browser Extension Bridge",
  "path": "C:\\Users\\<user>\\AppData\\Local\\AIFlow\\native-host.exe",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://<extension-id>/"]
}
```

### Phase 2 시작 프롬프트
```
Phase 1이 완성된 상태에서 Phase 2를 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 2 신규 범위:
1. 스마트 AI 라우팅
   - 복잡도 점수 계산 (0~100)
   - RoutingRule 테이블 기반 AI 자동 선택
   - 폴백 체인 (메인 → 백업 AI)
   - 라우팅 절감액 표시 (Message.cost_saved_usd)
2. 프라이버시 모드
   - openredaction npm 패키지 번들
   - PII 감지 → 마스킹 미리보기 UI
   - PrivacyLog 테이블 기록
   - 한국 특화 패턴 (주민번호, 계좌번호, 한국 전화번호)
3. 로컬 LLM 자동 감지 (Ollama/LM Studio) + 모델 목록 표시
4. MCP 플러그인 마켓 (filesystem, git, browser 내장)
   - MCP 서버: stdio transport (subprocess)로 실행
   - allowed_paths 보안 적용
5. 워크플로우 빌더 (순차 실행, 단계별 결과 전달)
6. 배치 처리 큐 (BatchJob/BatchItem 테이블, Tokio async queue)
7. 브라우저 확장 (Chrome Native Messaging)
   - native-host.exe Rust 프로그램 별도 빌드
   - 확장 ↔ AIFlow IPC 통신
8. Pro 결제 연동
   - LemonSqueezy Checkout URL 생성 (Rust reqwest)
   - 라이선스 키 검증 + OS 키체인 저장
9. 비용 리포트 + 예산 알림

반드시 지켜야 할 것:
- Phase 1 기능 회귀 없음
- 스마트 라우팅: 폴백 체인 구현 (1개 AI 실패 시 다음으로)
- 프라이버시 모드: 100% 로컬 (인터넷 전송 없음)
- 브라우저 확장: Chrome Native Messaging 방식 (WebSocket 방식 금지)
- MCP 보안: allowed_paths 반드시 적용
```

---

## Phase 3: 고도화 — "나만의 AI 비서" (예상 기간: 3~4주)

### 전제 조건
- Phase 1 + 2가 안정적으로 운영 중

### 목표
내 로컬 문서를 AI 지식베이스로 만들고, 음성으로 AI를 제어하며, 에이전트가 멀티스텝 작업을 자율 수행하고, 서드파티 개발자가 AIFlow를 확장할 수 있는 — **완성형 AI 비서 플랫폼**.

### 기능 체크리스트
- [ ] **개인 지식베이스 (RAG)** — 로컬 폴더 인덱싱 (PDF·MD·DOCX) + SQLite-vec 또는 LanceDB
- [ ] **AI 에이전트 + 승인 게이트** — 멀티스텝 자율 실행 + 중요 단계 사용자 승인 팝업
- [ ] **음성 입출력 (로컬 스택)** — Whisper.cpp(STT) + Ollama(LLM) + Piper(TTS) 완전 오프라인
- [ ] **조건부 워크플로우** — if/else 분기, 반복 루프, 에러 처리 노드
- [ ] **대화 브랜칭** — 특정 메시지에서 "다른 방향 탐색" 포크 (원본 유지)
- [ ] **워크플로우 내보내기/가져오기** — JSON 파일로 공유
- [ ] **비용 대시보드** — 날짜별·모델별 차트, 월 예산 설정 및 경고
- [ ] **플러그인 API 공개** — 서드파티 개발자가 AIFlow 기능 확장 가능
- [ ] **앱 자동 업데이트** — Tauri updater 플러그인
- [ ] **스마트 컨텍스트 주입** — Windows Accessibility API로 현재 앱·URL·파일 자동 감지

### 추가 데이터 (Phase 3 신규 테이블)
- KnowledgeBase, KBDocument

### 주의사항
- RAG는 벡터 DB 필요 (SQLite-vec 또는 LanceDB 로컬) — 설계 시 사전 결정
- 음성 스택은 Whisper.cpp 바이너리 번들링 → 앱 설치 파일 크기 증가 (~200MB)
- 에이전트 승인 게이트는 UX 세심하게 설계 (너무 많으면 거슬림)
- 플러그인 API는 보안 샌드박스 필수 (악성 플러그인 방지)

---

## Phase 로드맵 요약

| Phase | 핵심 차별점 | 상태 | 비고 |
|-------|-----------|------|------|
| Phase 1 (MVP) | 글로벌 단축키 + OS키체인 + DB암호화 + 페르소나 + 명령팔레트 | 시작 전 | 경쟁사 공백 1~5번 |
| Phase 2 (확장) | 스마트 라우팅 + 프라이버시 모드 + 브라우저 확장 + Pro 수익화 | Phase 1 완료 후 | 수익화 + 생태계 |
| Phase 3 (고도화) | RAG + 음성 + 에이전트 + 플러그인 API | Phase 2 완료 후 | 완성형 AI 비서 |

---

## 추천 개발 순서 (Phase 1 세부)

```
Day 1-2: Tauri 프로젝트 셋업 + SQLCipher DB 초기화 + AI Provider 연결 (OS 키체인)
Day 3-4: 멀티 AI 채팅 UI + 실시간 스트리밍 (ipc::Channel) + 비용 표시 (USD + KRW)
Day 5:   AI 페르소나 시스템 (6종 내장 + 커스텀 생성 UI)
Day 6-7: 글로벌 단축키 + 오버레이 창 + 시스템 트레이
Day 8:   파일 드래그앤드롭 + 클립보드 → AI
Day 9:   AI 명령 팔레트 (Ctrl+K) + 프롬프트 저장고 ({{변수}} 슬롯)
Day 10:  채팅 히스토리 (핀, 이름 변경) + 전체 QA + 빌드 테스트
```
