# AIFlow

**단축키 하나로 모든 AI를.** 어느 앱에서든 GPT, Claude, Gemini, 로컬 LLM과 대화할 수 있는 로컬 데스크톱 AI 허브 — 지식베이스, 멀티스텝 에이전트, 워크플로우 자동화까지.

[English](README.md) | [Japanese](README.ja.md) | [Chinese](README.zh.md)

---

## AIFlow란?

AIFlow는 여러 AI 프로바이더를 하나로 모은 **Windows 데스크톱 앱**입니다. 어떤 앱에서든 `Alt+Space`를 누르면 AIFlow가 나타나고, 질문하면 실시간 스트리밍 응답과 함께 비용이 표시됩니다. 완전 로컬, 완전 암호화.

**클라우드 계정 불필요. 데이터 수집 없음. 모든 것이 내 PC에 저장됩니다.**

---

## 주요 기능

### 코어 채팅
| 기능 | 설명 |
|------|------|
| **글로벌 단축키** (`Alt+Space`) | 어떤 앱에서든 AIFlow 소환 (Word, Chrome, 게임 등) |
| **멀티 프로바이더** | GPT-4o, Claude Sonnet, Gemini Flash + 8개 이상 (총 11개) |
| **API 키 검증** | 저장 전 프로바이더 API로 키 유효성 자동 검증 |
| **실시간 비용 표시** | 메시지마다 토큰 수 + USD + KRW 이중 비용 표시 |
| **OS 키체인 보안** | API 키를 Windows 자격 증명 관리자에 저장 (파일에 절대 없음) |
| **암호화 DB** | SQLCipher AES-256으로 모든 대화 암호화 |
| **AI 페르소나** | 6종 내장 (개발자, 카피라이터, 번역가, 분석가, 법무, 요약) |
| **프롬프트 저장고** | 저장, 태그, 검색 + `{{변수}}` 슬롯 지원 |
| **명령 팔레트** (`Ctrl+K`) | 자연어로 앱 기능에 접근 |
| **파일 드래그앤드롭** | PDF, TXT, MD, 코드, 이미지를 AI 채팅에 바로 전달 |
| **클립보드 → AI** (`Alt+Shift+A`) | 어떤 앱에서든 클립보드 내용을 AI에 즉시 전송 |
| **스크린샷 → AI** (`Ctrl+Shift+S`) | 스크린샷을 Vision AI에 전송 |
| **시스템 트레이** | 백그라운드 실행 + 빠른 접근 트레이 메뉴 |

### Phase 2 — 파워 기능
| 기능 | 설명 |
|------|------|
| **멀티 AI 비교** | 2~3개 모델 동시 스트리밍, 최적 응답 선택 |
| **스마트 라우팅** | 프롬프트 복잡도(0~100)에 따라 최적 AI 자동 선택 |
| **프라이버시 모드** | 로컬 개인정보 스캐너 (주민번호, 전화, 이메일) — 전송 전 마스킹 |
| **로컬 LLM** | Ollama / LM Studio 자동 감지, 로컬 모델 무료 사용 |
| **비용 대시보드** | 모델별 비용 분석, 일간 차트, USD + KRW |
| **월 예산** | 지출 한도 설정, 80% 도달 시 알림 |
| **프롬프트 버전** | 자동 저장 편집 이력, 버전 비교 및 복원 |
| **완료 알림** | AI 응답 완료 시 OS 알림 (최소화 시) |
| **워크플로우 빌더** | 15개 내장 템플릿, 멀티스텝 AI 자동화 파이프라인 |
| **배치 큐** | 수백 개 항목 자동 일괄 처리 |
| **MCP 마켓** | 파일, Git, 브라우저 AI 도구 (MCP 프로토콜) |
| **브라우저 확장** | 현재 페이지를 AIFlow로 원클릭 전송 |

### Phase 3 — 인텔리전스 기능
| 기능 | 설명 |
|------|------|
| **지식베이스 (RAG)** | 문서를 인덱싱하고 전체 텍스트 AI 쿼리로 검색 |
| **AI 에이전트** | 민감한 작업에 승인 게이트가 있는 멀티스텝 자율 작업 실행 |
| **대화 브랜칭** | 어떤 메시지에서든 대화를 포크, 다양한 경로 탐색 |
| **워크플로우 내보내기/가져오기** | 워크플로우를 JSON 파일로 기기 간 공유 |
| **조건부 워크플로우** | 워크플로우 단계에서 개선된 분기 및 조건 지원 |

### Phase 5 — 음성 I/O ✅ 완료
| 기능 | 설명 |
|------|------|
| **음성 입력** (`Alt+Shift+V`) | Whisper API 기반 STT — 어디서든 단축키 한 번으로 녹음 시작 |
| **실시간 파형 시각화** | 녹음 중 주파수 스펙트럼 바 표시 (8채널) |
| **무음 자동 정지** | 2.5초 무음 감지 시 자동 정지 + 60초 하드 타임아웃 |
| **TTS 읽기** | Web Speech API로 AI 응답 음성 읽기, 속도 설정 저장 |
| **다국어 음성** | Whisper 언어 힌트 (auto-detect 또는 ISO 639-1) |

### Phase 6 — Vision AI & 자동 업데이트 ✅ 완료
| 기능 | 설명 |
|------|------|
| **스크린샷 Vision AI** (`Ctrl+Shift+S`) | 전체 화면 캡처 → GPT-4o / Claude / Gemini Vision에 전송 |
| **멀티프로바이더 Vision** | OpenAI `image_url`, Anthropic `base64 source`, Google `inline_data` 자동 포맷 |
| **스크린샷 미리보기** | ChatInput에 썸네일 + "Vision" 뱃지, X 버튼으로 제거 |
| **자동 업데이트** | GitHub Releases 기반 업데이터, Ed25519 서명 검증 (ASVS 10.3.1-3) |
| **업데이트 배너** | 앱 상단 비침습 알림 — 진행률 바 + 재시작 유도 |
| **사이드바 날짜 그룹핑** | 고정됨 / 오늘 / 어제 / 이번 주 / 이전으로 대화 자동 분류 |

### Phase 7 — GitHub Actions CI/CD ✅ 완료
| 기능 | 설명 |
|------|------|
| **릴리스 워크플로우** | `v*.*.*` 태그 push → MSI 자동 빌드 + Ed25519 서명 + GitHub Release 업로드 |
| **PR 체크 게이트** | PR·push 시 TypeScript 타입 검사 + `cargo check` + `cargo clippy` 자동 실행 |
| **latest.json 자동 생성** | Auto Updater 엔드포인트 — GitHub Release에 버전 메타데이터 자동 첨부 |
| **최소 권한 원칙** | 릴리스 워크플로우는 `contents: write`만, PR 체크는 `contents: read`만 |
| **Rust 캐시** | `swatinem/rust-cache` — Windows CI 빌드 시간 대폭 단축 |

### Phase 8 — 지식베이스 UI 보안/UX 업그레이드 ✅ 완료
| 기능 | 설명 |
|------|------|
| **XSS 취약점 수정** | `dangerouslySetInnerHTML` 제거 → `SnippetHighlight` 컴포넌트로 FTS5 `<mark>` 태그만 안전하게 파싱 (ASVS 5.3.3) |
| **파일 타입 컬러 뱃지** | `.md`, `.rs`, `.py`, `.ts`, `.tsx`, `.js`, `.json`, `.toml`, `.yaml`, `.csv` — 11가지 확장자 색상 구분 |
| **인라인 삭제 확인 UI** | `window.confirm()` 제거 → 인라인 2단계 확인 버튼 (WCAG 2.1 + 보안 강화) |
| **접근성 완성** | `role=dialog/list/menu/menuitem/alert`, `aria-expanded`, `aria-modal`, `aria-labelledby` 전면 적용 |
| **KB 컨텍스트 바 업그레이드** | 채팅 입력창 위 KB 칩 바 — onClearAll 원자적 초기화, doc count 뱃지, 보라색 활성 상태 표시 |
| **클릭 토글 드롭다운** | CSS `:hover` 드롭다운 → 클릭 토글 + mousedown outside-click 핸들러 (touch 호환, 키보드 접근 가능) |

### Phase 9 — 채팅 전체 검색 (`Ctrl+F`) ✅ 완료
| 기능 | 설명 |
|------|------|
| **인-대화 메시지 검색** | `Ctrl+F` → 슬라이드 다운 검색 바, 현재 대화 내 메시지 실시간 필터링 |
| **결과 카운터 + 네비게이션** | "X / Y 결과" 표시, 이전(▲·Shift+Enter) / 다음(▼·Enter) 버튼으로 순환 |
| **자동 스크롤** | 현재 포커스 결과로 smooth scroll, violet ring-2 강조 |
| **검색 일치 발췌** | 일치 메시지 하단에 주변 문맥 45자 + 매칭 텍스트 violet 하이라이트 스니펫 표시 |
| **Esc 닫기** | Escape로 검색 닫기 — 다른 모달보다 우선 처리 (capture:true) |
| **보안** | 클라이언트 사이드 필터링(IPC 없음), ASVS 5.1.1(maxLength=500), ASVS 5.3.3(XSS-safe), CSS.escape() 방어 |

### Phase 10 — 대화별 활성 KB 저장 ✅ 완료
| 기능 | 설명 |
|------|------|
| **세션 간 KB 컨텍스트 유지** | KbContextBar에서 활성화한 KB가 대화별로 DB에 저장 — 앱 재시작·대화 전환 후에도 복원 |
| **마이그레이션 019** | `conversations.active_kb_ids TEXT DEFAULT '[]'` (JSON 배열, 기존 데이터 마찰 없음) |
| **원자적 교체** | toggle/clearAll 시 전체 배열을 한 번에 UPDATE — 부분 업데이트로 인한 불일치 없음 |
| **경쟁 조건 방어** | `activeKbConvIdRef` ref로 대화 전환 중 stale 저장 방지 (다른 대화에 덮어쓰기 불가) |
| **입력 검증** | Rust: 최대 20개, 양수, 중복 제거, rows_affected 체크 / TS: 동일 검증 (defense in depth) |
| **무결성** | `serde_json::to_string()` — 문자열 보간 없이 직렬화, SQL 인젝션 원천 차단 |

### Phase 11 — 복사/내보내기 UX 완성 ✅ 완료
| 기능 | 설명 |
|------|------|
| **복사 버튼 시각 피드백** | 클릭 시 Copy → Check 아이콘 1.5초 전환(emerald), 토스트 알림 "클립보드에 복사됨" |
| **복사 에러 처리** | 클립보드 권한 거부 시 에러 토스트로 사용자에게 즉시 알림 |
| **언마운트 타이머 정리** | useRef + useEffect cleanup으로 메모리 릭 방지 |
| **aria-live 안내** | 스크린 리더에게 복사 완료 실시간 전달 (WCAG 4.1.3) |
| **내보내기 메뉴 접근성 개선** | CSS `:hover` → 클릭 토글 + mousedown outside-click + Escape 키 닫기 |
| **전면 ARIA 속성** | `role=menu/menuitem`, `aria-haspopup`, `aria-expanded`, `aria-label` 전면 적용 |
| **리치 메뉴 아이템** | Markdown/JSON 각각에 아이콘 + 제목 + 설명 + 색상 구분 (sky/amber) |
| **Lucide 아이콘 일관성** | Download, FileText, FileCode, ChevronDown — inline SVG 전면 교체 |
| **내보내기 성공 피드백** | 파일 다운로드 후 성공 토스트로 결과 확인 가능 |

### Phase 4 — 보안 강화 & UX 완성
| 기능 | 설명 |
|------|------|
| **에이전트 웹 검색** | AI 에이전트가 DuckDuckGo로 실시간 웹 검색 (`search_web` 도구) |
| **에이전트 URL 읽기** | AI 에이전트가 웹 페이지 내용 fetch (`read_url` 도구, SSRF 방어 포함) |
| **프롬프트 버전 복원** | 편집 이력 아코디언 UI — 클릭 한 번으로 이전 버전 복원 |
| **로컬 LLM 모델 선택** | Ollama/LM Studio 모델을 드롭다운에서 직접 선택, 30초 TTL 캐시 |
| **개인정보 & 감사 대시보드** | PII 감지 유형별 통계 + 마스킹률 + 불변 감사 로그 뷰 |
| **멀티 AI 비교 완성** | 컬럼 색상 구분, 마크다운 내보내기, API 키 필터링, 채택 기능 |

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 데스크톱 | Tauri 2 (Rust 백엔드) |
| 프론트엔드 | React 19 + TypeScript + Tailwind CSS v4 |
| 데이터베이스 | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 256k 반복) |
| 전체 텍스트 검색 | SQLite FTS5 (지식베이스 RAG) |
| API 키 | Windows 자격 증명 관리자 (OS 키체인) |
| 상태 | Zustand |
| 스트리밍 | Tauri ipc::Channel |
| AI 호출 | Rust reqwest (CORS 없음, 키 프론트엔드 미노출) |
| 음성 STT | Whisper API (OpenAI) — webm/opus, 25MB 제한 |
| TTS | Web Speech API (브라우저 내장) |
| 화면 캡처 | `screenshots` crate (0.8) + `image` crate (0.24) |
| 자동 업데이트 | tauri-plugin-updater v2 (Ed25519 서명 검증) |
| i18n | react-i18next |

---

## 시작하기

### 사전 요구사항

- **Windows 10 21H2+** 또는 **Windows 11**
- AI API 키 1개 이상 (OpenAI, Anthropic, Google)

### 릴리스에서 설치

1. [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)에서 최신 `.msi` 다운로드
2. 설치 실행
3. 시스템 트레이에 AIFlow 아이콘 표시
4. `Alt+Space`를 눌러 오버레이 열기
5. **설정**에서 API 키 추가

### 소스에서 빌드

#### 요구사항

- Rust 툴체인 (MSVC 타겟): `rustup default stable`
- Visual Studio Build Tools (C++ 워크로드)
- Strawberry Perl: `choco install strawberryperl -y` (SQLCipher 필수)
- Node.js 20+: `choco install nodejs-lts -y`

#### 단계

```bash
# 저장소 클론
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow

# 프론트엔드 의존성 설치
npm install

# 개발 모드 실행
npm run tauri:dev

# 프로덕션 빌드 (.msi 설치 파일)
npm run tauri:build
```

---

## 주요 기능 사용법

### 지식베이스 (RAG)

1. 사이드바의 **지식베이스** (데이터베이스 아이콘) 클릭
2. **새 지식베이스** 버튼으로 지식베이스 생성 후 클릭해서 열기
3. 인덱싱할 파일 선택 또는 드롭 (`.txt`, `.md`, `.py`, `.ts`, `.rs`, `.json`, `.toml`, `.yaml`, `.csv` 등)
4. 검색창으로 문서 쿼리 — 결과에 파일 타입 컬러 뱃지 + 일치 텍스트 하이라이팅
5. 문서 삭제 시 휴지통 아이콘 클릭 → 인라인 2단계 확인 (팝업 없음)
6. **스마트 컨텍스트 주입**: 채팅 입력창 위의 KB 칩을 클릭하면 활성화 — 활성화된 KB의 검색 결과가 모든 AI 메시지에 자동 주입됨
7. AI 에이전트는 작업 실행 중 자동으로 지식베이스를 검색 가능

### AI 에이전트

1. 사이드바의 **AI 에이전트** (비커 아이콘) 클릭
2. 입력창에 목표 입력 (예: "지식베이스의 모든 문서 요약해줘")
3. 에이전트가 단계를 계획한 후 하나씩 실행
4. 파일 쓰기 또는 워크플로우 실행이 필요한 단계는 **승인 게이트** 표시 — 진행 전 검토
5. 언제든지 에이전트 취소 가능

### 대화 브랜칭

1. 대화에서 메시지에 마우스 오버
2. **포크** 버튼을 클릭하여 해당 지점에서 분기
3. 그 지점까지의 모든 메시지가 복사된 새 대화 생성
4. 원본 스레드를 잃지 않고 다양한 AI 응답 탐색

### 워크플로우 내보내기/가져오기

1. **워크플로우 빌더**를 열고 워크플로우 선택
2. **내보내기**를 클릭하여 `.json` 파일 다운로드
3. 다른 기기에서 **가져오기**를 클릭하여 파일 선택
4. 모든 단계가 포함된 워크플로우 재생성

### 에이전트 웹 검색 & URL 읽기 (Phase 4)

1. 사이드바의 **AI 에이전트** 클릭
2. 목표에 "최신 정보"가 필요한 작업 입력 (예: "AI 최신 뉴스 요약해줘")
3. 에이전트가 자동으로 `search_web` 또는 `read_url` 도구 호출
4. 각 도구 호출 결과가 StepCard에 펼쳐짐
5. 보안: `read_url`은 사설 IP(localhost, 192.168.x.x 등) 차단

### 개인정보 & 감사 로그 (Phase 4)

1. 사이드바 하단의 **개인정보 & 감사** (방패 아이콘) 클릭
2. **PII 감지 탭**: 전체 마스킹률 + 유형별 통계 (전화번호, 이메일 등) 확인
3. **감사 로그 탭**: 앱 이벤트 타임라인 (INFO/WARN/ERROR 색상 구분)
4. 감사 로그는 변경 불가 — DB 수준 트리거로 삭제/수정 차단

### 로컬 LLM (Ollama) 선택 (Phase 4)

1. 채팅 화면 상단의 **모델 선택기** (프로바이더 이름 버튼) 클릭
2. **로컬 AI** 섹션에 Ollama가 실행 중이면 모델 목록 자동 표시
3. 원하는 모델 클릭 → 즉시 전환 (무료, API 키 불필요)
4. 새로고침 버튼으로 수동 재스캔 가능

### 멀티 AI 비교 (Phase 4 업그레이드)

1. 채팅 헤더의 **비교** 버튼 또는 `Ctrl+K` → "AI 비교" 선택
2. API 키가 설정된 모델만 표시 — 2~3개 선택
3. 질문 입력 후 Enter → 모든 모델이 동시에 스트리밍
4. **채택** 버튼으로 최적 응답 표시
5. **내보내기** 버튼으로 마크다운 파일로 저장

### 채팅 전체 검색 (Phase 9)

1. 채팅 화면에서 `Ctrl+F` — 채팅 헤더 아래 검색 바 슬라이드 다운
2. 검색어 입력 → 현재 대화의 메시지가 실시간으로 필터링
3. 일치하는 메시지에 보라색 테두리 + 발췌 스니펫(주변 문맥 + 하이라이팅) 표시
4. `Enter`(또는 ▼ 버튼) → 다음 결과, `Shift+Enter`(또는 ▲ 버튼) → 이전 결과
5. 상단 카운터로 "X / Y 결과" 확인
6. `Esc` 또는 X 버튼으로 검색 닫기

### 음성 입력 (Phase 5)

1. 채팅 입력창 우측의 **마이크 버튼** 클릭 또는 `Alt+Shift+V`
2. 마이크 권한 허용 → 파형이 표시되며 녹음 시작
3. 말하기 — 2.5초 무음 시 자동 정지 (또는 버튼 다시 클릭으로 수동 정지)
4. Whisper가 텍스트로 변환 → 입력창에 자동 삽입
5. 설정 → **음성 입력 언어**: 한국어, 영어, 자동 감지 선택 가능

### TTS 읽기 (Phase 5)

1. AI 응답 말풍선 하단의 **스피커 버튼** 클릭
2. 마크다운 문법 제거 후 자연스러운 음성으로 읽기 시작
3. 다시 클릭하면 즉시 정지
4. 설정 → **TTS 읽기 속도**: 0.5×~2.0× 조절 가능

### 스크린샷 Vision AI (Phase 6)

1. `Ctrl+Shift+S` — 어떤 앱에서든 전체 화면 캡처
2. AIFlow ChatInput에 썸네일 미리보기 표시 + "Vision" 뱃지
3. 질문 입력 후 전송 → GPT-4o / Claude / Gemini Vision이 화면을 분석
4. X 버튼으로 스크린샷 제거 가능 (텍스트만 전송)
5. 지원 프로바이더: OpenAI(GPT-4o), Anthropic(Claude 3.5 Sonnet+), Google(Gemini 1.5+)

---

## 환경 변수

AIFlow는 `.env` 파일이 **필요하지 않습니다**. 모든 비밀은 OS 키체인에 저장됩니다.

| 변수 | 용도 | 저장 위치 |
|------|------|-----------|
| AI API 키 | 프로바이더 인증 | OS 키체인 (설정 UI) |
| DB 마스터 키 | 데이터베이스 암호화 | OS 키체인 (최초 실행 시 자동 생성) |
| 기기 ID | 라이선스 검증 | OS 키체인 (랜덤 UUID) |

---

## 프로젝트 구조

```
ai-flow/
├── .PRD/                     # 제품 요구사항 문서
├── .github/
│   └── workflows/
│       ├── release.yml       # v*.*.* 태그 push → MSI 빌드 + Ed25519 서명 + GitHub Release
│       └── check.yml         # PR·push 게이트: TypeScript tsc + cargo check + cargo clippy
├── src/                      # React 프론트엔드
│   ├── components/           # UI 컴포넌트
│   │   ├── chat/             # 채팅 전용 컴포넌트
│   │   │   ├── ChatSearchBar.tsx   # Ctrl+F 인-대화 검색 바 (Phase 9)
│   │   └── updater/          # UpdateBanner (자동 업데이트 알림)
│   ├── stores/               # Zustand 상태 관리
│   ├── lib/                  # 유틸리티, IPC, 스키마, 프로바이더
│   ├── views/                # 페이지 레벨 뷰
│   │   ├── KnowledgeBaseView.tsx   # RAG 문서 관리 + 검색
│   │   ├── AgentView.tsx           # AI 에이전트 실행 관리
│   │   ├── PrivacyAuditView.tsx    # PII 통계 + 감사 로그 대시보드
│   │   ├── WorkflowBuilderView.tsx
│   │   ├── BatchQueueView.tsx
│   │   ├── CostReportView.tsx
│   │   └── SettingsView.tsx
│   └── types/                # TypeScript 타입
├── src-tauri/                # Rust 백엔드
│   ├── src/
│   │   ├── commands/         # Tauri IPC 명령 (얇은 어댑터)
│   │   │   ├── knowledge_base.rs  # KB/RAG 명령
│   │   │   ├── agent.rs           # 에이전트 + 브랜칭 + 내보내기/가져오기
│   │   │   ├── voice.rs           # Whisper STT (Phase 5)
│   │   │   ├── screenshot.rs      # 화면 캡처 → base64 (Phase 6)
│   │   │   └── updater.rs         # 업데이트 확인/설치 (Phase 6)
│   │   ├── services/         # 비즈니스 로직
│   │   │   ├── knowledge_base.rs  # FTS5 인덱싱 + 검색
│   │   │   ├── agent.rs           # 멀티스텝 에이전트 (search_web, read_url 포함)
│   │   │   ├── audit.rs           # 불변 감사 로그 읽기/쓰기
│   │   │   ├── privacy.rs         # PII 스캐너 + 글로벌 통계
│   │   │   ├── workflow.rs        # 워크플로우 + 내보내기/가져오기
│   │   │   ├── mcp.rs             # MCP + 경로 보안
│   │   │   └── providers/         # AI 프로바이더 구현체
│   │   ├── models/           # Serde 데이터 구조체
│   │   └── db/               # SQLCipher + 마이그레이션 러너
│   └── migrations/           # SQL 마이그레이션 (001~018)
│       ├── 016_knowledge_base.sql  # 지식베이스, 문서, FTS5
│       ├── 017_agent_runs.sql      # 에이전트 실행, 단계, 도구
│       ├── 018_conversation_branches.sql  # 브랜칭 + 워크플로우 내보내기
│       └── 019_conversation_kb.sql  # 대화별 활성 KB ID (Phase 10)
├── README.md                 # 영어 (기본)
├── README.ko.md              # 한국어 (이 파일)
├── README.ja.md              # 일본어
├── README.zh.md              # 중국어
├── .resume.md                # 작업 재개 가이드
└── LICENSE                   # MIT 라이선스 (SoDam AI Studio)
```

---

## 아키텍처

```
┌─ 메인 창 (React) ──────────────────────────────┐
│  채팅 (스트리밍, 멀티비교, 브랜칭)               │
│  KnowledgeBaseView (RAG, FTS5 검색)             │
│  AgentView (멀티스텝 실행, 승인 게이트)          │
│  WorkflowBuilderView (파이프라인, 내보내기/가져오기) │
│  CostReportView (예산, 모델별 분석)              │
│  Zustand + Zod + i18n                           │
└──────────────────────────┬──────────────────────┘
                           │ Tauri IPC
┌──────────────────────────▼──────────────────────┐
│  Rust 백엔드                                     │
│  commands/   → IPC 진입점 (검증만)               │
│  services/   → 비즈니스 로직                     │
│    ├─ knowledge_base.rs  (FTS5 RAG)              │
│    ├─ agent.rs           (재진입 스텝 엔진)       │
│    ├─ workflow.rs        (파이프라인 + 내보내기)  │
│    ├─ routing.rs         (스마트 AI 선택)         │
│    ├─ privacy.rs         (로컬 PII 스캐너)        │
│    ├─ cost.rs + cost_report.rs                   │
│    └─ providers/         (OpenAI, Anthropic, Google) │
│  db/         → SQLCipher (AES-256) + 백업        │
└───────────┬──────────────┬─────────────────────-┘
            │              │
    OS 키체인          SQLCipher DB          AI 프로바이더 API
    (API 키)           (암호화)              (SSE 스트리밍)
```

**4-레이어 아키텍처:**
1. `commands/` — IPC 진입점 (입력 검증만, 비즈니스 로직 없음)
2. `services/` — 순수 비즈니스 로직 (Provider Trait 추상화)
3. `models/` — Serde 구조체 (로직 없음)
4. `db/` — SQL 실행만

---

## 보안

| 영역 | 구현 |
|------|------|
| API 키 저장 | OS 키체인만 — 코드, 파일, DB에 절대 없음 |
| API 키 검증 | 저장 전 실제 API 호출로 검증 |
| 데이터베이스 | SQLCipher AES-256 + PBKDF2-SHA512 (256,000 반복) |
| DB 마스터 키 | 자동 생성 랜덤 32바이트 키, OS 키체인 저장 |
| IPC 파라미터 | 프론트엔드 Zod 검증 + 백엔드 Rust 타입 시스템 |
| 스트리밍 | Tauri ipc::Channel (EventSystem 아님), 취소 지원 |
| CSP | `default-src 'self'` (unsafe-eval 없음) |
| 감사 로그 | 불변 INSERT 전용 로그 — DB 트리거로 UPDATE/DELETE 차단 |
| 프라이버시 모드 | 100% 로컬 PII 스캐너 — 데이터 기기 외 미전송 |
| SSRF 방어 | 에이전트 URL fetch 시 localhost/사설IP/메타데이터 엔드포인트 차단 |
| 리디렉션 체크 | HTTP 리디렉션 후에도 최종 URL 재검증 (사설망 우회 방지) |
| 제어 문자 제거 | 웹 검색 결과에서 OWASP ASVS 5.2.3 기준 제어 문자 제거 |
| HTML 스트리핑 | 외부 URL 콘텐츠에서 script/style/태그 제거 (50KB 상한) |
| 템플릿 인젝션 | `{{input}}` 값, AI 치환 전 새니타이징 |
| FTS5 인젝션 | 검색어를 큰따옴표로 감싸고 특수문자 제거 |
| 경로 보안 | 모든 MCP 파일 경로에 `canonicalize()` 적용 (심볼릭 링크 순회 방지) |
| 입력 제한 | 모든 텍스트 입력 최대 길이 검증 (목표: 2KB, 쿼리: 500자) |
| 파일 접근 | 절대 경로 확인 + 확장자 허용 목록 + 5MB 크기 제한 (KB) |
| 음성 보안 | 오디오 바이트 디스크 미기록 (IPC 중 메모리 base64만), 25MB / 60초 하드 리밋 |
| Vision 보안 | 스크린샷 10MB 캡, 바이트 디스크 미기록 (base64 메모리 전용) |
| 업데이트 서명 | Ed25519 비대칭 키 — 앱에 공개키만 번들, 다운그레이드 방지 minVersion |
| XSS 방어 (KB) | FTS5 `snippet()` 출력에 `dangerouslySetInnerHTML` 미사용 — `<mark>` 태그만 React 안전 파싱 (ASVS 5.3.3) |
| 삭제 확인 UI | `window.confirm()` 제거 — 인라인 2단계 확인 (포커스 흐름 보호, WCAG 2.1) |

---

## 로드맵

| Phase | 목표 | 상태 |
|-------|------|------|
| **1a** | 코어 MVP (채팅, 비용, 보안, i18n) | ✅ 완료 |
| **1b** | 단축키, 오버레이, 페르소나, 프롬프트, 트레이, 파일 드롭 | ✅ 완료 |
| **2** | 멀티 AI 비교, 스마트 라우팅, 프라이버시, 비용 대시보드, 예산, 워크플로우 | ✅ 완료 |
| **3** | RAG 지식베이스, AI 에이전트, 대화 브랜칭, 워크플로우 내보내기/가져오기 | ✅ 완료 |
| **4** | 에이전트 웹검색/URL읽기, 프롬프트 버전 복원, 로컬 LLM 선택, 감사 대시보드 | ✅ 완료 |
| **5** | 음성 STT (Whisper API) + TTS + 글로벌 단축키 `Alt+Shift+V` | ✅ 완료 |
| **6** | Screenshot Vision AI (`Ctrl+Shift+S`) + Auto Updater (Ed25519) + UI/UX 개선 | ✅ 완료 |
| **7** | GitHub Actions CI/CD — 릴리스 워크플로우 + PR 체크 게이트 (TypeScript + Rust) | ✅ 완료 |
| **8** | 지식베이스 UI 전면 업그레이드 — XSS 수정(ASVS 5.3.3), 파일 타입 뱃지, 접근성 완성 | ✅ 완료 |
| **9** | 채팅 전체 검색 (`Ctrl+F`) — 인-대화 실시간 검색, 결과 하이라이트, 자동 스크롤 | ✅ 완료 |
| **10** | 대화별 활성 KB 저장 — 세션/재시작 간 KB 컨텍스트 자동 복원 (마이그레이션 019) | ✅ 완료 |
| **11** | 복사/내보내기 UX 완성 — 시각 피드백, 접근성 있는 메뉴, Lucide 아이콘 일관성 | ✅ 완료 |
| **12** | 에이전트 도구 확장 (파일 쓰기, 셸 실행 — 승인 게이트 필수), 로컬 Whisper STT | 예정 |

---

## 비개발자를 위한 안내 (바이브코딩 가이드)

> **코딩을 몰라도 AIFlow를 사용하거나 수정할 수 있습니다.**
> 자연어만으로 앱을 커스터마이징하고 싶은 분을 위한 가이드입니다.

### 기능 변경/추가 방법 (코딩 불필요)

1. [Cursor](https://cursor.sh), [Windsurf](https://codeium.com/windsurf) 등 AI 에디터에서 프로젝트 열기
2. 원하는 것을 자연어로 설명:
   - *"설정에 다크 블루 테마 옵션 추가해줘"*
   - *"AI 응답 텍스트 크게 해줘"*
   - *"Mistral AI 프로바이더 지원 추가해줘"*
3. **AI가 코드 생성** — 검토 후 Accept 클릭
4. **테스트**: 터미널에 `npm run tauri:dev` 입력 — 변경사항이 적용된 앱 실행
5. **완료!** 프로그래밍 지식 불필요.

### 황금 규칙
> **API 키를 코드 파일에 직접 입력하지 마세요.**
> 항상 AIFlow 설정 UI에서 입력하세요 — Windows 자격 증명 관리자에 안전하게 저장됩니다.

---

## 운영 참고사항

- **데이터베이스 위치**: `%APPDATA%\ai-flow\aiflow.db` (SQLCipher 암호화)
- **DB 백업**: 각 마이그레이션 전 `%APPDATA%\ai-flow\backups\`에 자동 저장 (최근 5개 유지)
- **API 키**: `aiflow` 서비스명으로 Windows 자격 증명 관리자에 저장
- **지식베이스**: 인덱싱된 문서는 텍스트 청크로 암호화 DB에 저장 (원본 파일 복사 안함)
- **에이전트 실행**: DB에 저장 — 에이전트 뷰에서 모든 과거 실행 내역 확인 가능
- **로그**: Tauri 개발 콘솔 또는 `%APPDATA%\ai-flow\logs\`
- **개발 서버 포트**: 1420

---

## 링크

- [PRD 문서](.PRD/README.md) — 제품 요구사항 및 설계 결정사항
- [GitHub Issues](https://github.com/sodam-ai/ai-flow/issues)
- [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)

---

## 라이선스

[MIT License](LICENSE) — Copyright © 2026 SoDam AI Studio
