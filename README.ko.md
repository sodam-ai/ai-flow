# AIFlow

> **Windows용 멀티 AI 데스크톱 채팅 앱** — OpenAI, Claude, Gemini, Ollama 등 10개 이상의 AI를 하나의 앱에서

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/sodamai/aiflow)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)](https://github.com/sodamai/aiflow)
[![License](https://img.shields.io/badge/license-SoDam%20AI%20Studio-green)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [주요 기능](#주요-기능)
3. [스크린샷](#스크린샷)
4. [처음이세요? 걱정 마세요!](#처음이세요-걱정-마세요)
5. [시스템 요구사항](#시스템-요구사항)
6. [빠른 시작 가이드](#빠른-시작-가이드)
7. [API 키 등록 방법](#api-키-등록-방법)
8. [Ollama로 무료 로컬 AI 사용하기](#ollama로-무료-로컬-ai-사용하기)
9. [환경 변수](#환경-변수)
10. [폴더 구조](#폴더-구조)
11. [개발 명령어](#개발-명령어)
12. [보안 설명](#보안-설명)
13. [기여 가이드](#기여-가이드)
14. [라이선스](#라이선스)

---

## 프로젝트 개요

AIFlow는 **Tauri 2 + React 19 + TypeScript**로 만든 Windows 데스크톱 AI 채팅 앱입니다. ChatGPT, Claude, Gemini, Ollama 등 다양한 AI 서비스를 탭 하나에서 바꿔가며 사용할 수 있고, API 키는 Windows 자격 증명 관리자(OS 키체인)에 안전하게 보관됩니다.

**왜 AIFlow인가?**

- 브라우저 여러 탭을 오가지 않아도 됩니다.
- 자주 쓰는 프롬프트를 라이브러리에 저장해 두고 `{{변수}}`만 바꿔 바로 사용합니다.
- AI별 성격(페르소나)을 만들어 각 채팅에 적용할 수 있습니다.
- 사용 비용(USD / KRW)이 실시간으로 표시됩니다.
- 인터넷 없이도 Ollama를 통해 완전 오프라인으로 사용 가능합니다.

---

## 주요 기능

### AI 공급자 지원
| 공급자 | 주요 모델 |
|--------|-----------|
| OpenAI | GPT-4.1, o3, o4-mini |
| Anthropic | Claude 4.6 (Sonnet) |
| Google | Gemini 2.5 Pro |
| Ollama | 로컬 모델 전체 (완전 오프라인) |
| Mistral | Mistral Large 등 |
| Groq | LLaMA 3 등 초고속 추론 |
| DeepSeek | DeepSeek-V3 등 |
| Cohere | Command R+ 등 |
| xAI | Grok-2 등 |
| Azure OpenAI | Azure 엔드포인트 사용 |
| OpenAI 호환 | 커스텀 엔드포인트 지원 |

### 채팅 및 대화 관리
- 실시간 스트리밍 응답 (타이핑 효과)
- 대화 핀 고정 / 이름 변경 / 삭제
- 대화 검색 (퍼지 검색)
- 멀티 대화 동시 관리

### 페르소나 시스템
- AI별 이름, 시스템 프롬프트, 아이콘 설정
- 채팅마다 다른 페르소나 적용
- 페르소나 라이브러리 관리

### 프롬프트 라이브러리
- 자주 쓰는 프롬프트 저장 및 분류
- `{{변수명}}` 슬롯으로 템플릿화
- 실행 시 변수값 입력 팝업

### 비용 추적
- 입력 / 출력 토큰 수 실시간 표시
- 누적 비용 USD + KRW 환산 표시
- 모델별 단가 자동 적용

### 편의 기능
- `Alt + Shift + A` 단축키로 클립보드 내용을 즉시 AI에게 전송
- 시스템 트레이 상주, 오버레이 창 지원
- 다크 모드 기본 적용

### 보안
- API 키는 Windows 자격 증명 관리자(OS 키체인)에만 저장
- DB(SQLite)에 API 키 절대 저장하지 않음
- HTTPS 전용 통신, SSRF 방어 내장
- CSP(콘텐츠 보안 정책) 적용

---

## 스크린샷

> 스크린샷은 추후 추가될 예정입니다.

```
[ 메인 채팅 화면 스크린샷 ]
```

```
[ 공급자 설정 화면 스크린샷 ]
```

```
[ 프롬프트 라이브러리 화면 스크린샷 ]
```

```
[ 페르소나 관리 화면 스크린샷 ]
```

---

## 처음이세요? 걱정 마세요!

**코딩을 전혀 몰라도 AIFlow를 설치하고 사용할 수 있습니다.**
아래 순서대로 따라오세요. 어려운 부분은 없습니다.

---

### 1단계 — 필요한 프로그램 설치하기

아래 세 가지 프로그램을 PC에 설치해야 합니다. 각 링크를 클릭하면 공식 사이트로 이동합니다.

**A. Node.js 설치**

1. [https://nodejs.org](https://nodejs.org) 에 접속합니다.
2. "LTS" 버튼(초록색)을 클릭해 설치 파일을 받습니다.
3. 받은 파일을 더블클릭하고 "Next" → "Next" → "Install" 순서로 설치합니다.
4. 설치가 끝나면 PC를 재시작하지 않아도 됩니다.

**B. Rust 설치**

1. [https://rustup.rs](https://rustup.rs) 에 접속합니다.
2. "DOWNLOAD RUSTUP-INIT.EXE (64-BIT)" 버튼을 클릭합니다.
3. 받은 파일을 더블클릭하고 화면에 나오는 대로 Enter를 누릅니다. (기본값 그대로 설치)
4. 설치가 완료되면 터미널을 새로 열어야 합니다.

**C. Git 설치 (선택사항, 소스코드를 직접 받을 때 필요)**

1. [https://git-scm.com](https://git-scm.com) 에 접속합니다.
2. "Download for Windows" 버튼을 클릭합니다.
3. 받은 파일을 더블클릭하고 "Next" 여러 번 눌러 설치합니다.

---

### 2단계 — AIFlow 소스코드 받기

**터미널(명령 프롬프트)** 을 엽니다.

> **터미널 여는 법**: 키보드에서 `Windows 키 + R` 을 누르고 `cmd` 를 입력한 뒤 Enter를 누릅니다.

터미널에 아래 명령어를 입력하고 Enter를 누릅니다:

```
git clone https://github.com/sodamai/aiflow.git
cd aiflow
npm install
```

> 인터넷에서 파일을 내려받으므로 1~3분 정도 걸릴 수 있습니다. 기다려 주세요.

---

### 3단계 — 앱 실행하기

아래 명령어를 입력하면 AIFlow가 실행됩니다:

```
npm run dev
```

> 처음 실행할 때는 Rust 컴파일 때문에 5~10분 정도 걸립니다. 커피 한 잔 마시고 오세요!
> 두 번째 실행부터는 1분 이내로 빠르게 열립니다.

---

### 4단계 — AI API 키 발급하기

AIFlow를 사용하려면 원하는 AI 서비스의 API 키가 필요합니다.
**API 키란?** AI 서비스에서 발급해 주는 긴 암호 같은 문자열입니다. 이것을 AIFlow에 입력하면 해당 AI를 사용할 수 있습니다.

**무료로 시작하고 싶다면?** → [Ollama](#ollama로-무료-로컬-ai-사용하기) 섹션을 확인하세요. API 키 없이 무료로 사용할 수 있습니다.

#### 유료 AI 서비스 API 키 발급 방법

| 서비스 | 발급 주소 | 참고 |
|--------|-----------|------|
| OpenAI (ChatGPT) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | 가입 후 결제 수단 등록 필요 |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) | 가입 후 API 키 발급 |
| Google (Gemini) | [aistudio.google.com](https://aistudio.google.com) | Google 계정으로 무료 시작 가능 |
| Groq | [console.groq.com](https://console.groq.com) | 무료 플랜 있음 |

> API 키는 절대 다른 사람에게 알려주지 마세요. AIFlow는 키를 Windows 자격 증명 관리자에 암호화하여 저장하므로 안전합니다.

---

### 5단계 — AIFlow에 API 키 입력하기

1. AIFlow 앱에서 왼쪽 아래 **설정(톱니바퀴)** 아이콘을 클릭합니다.
2. **"공급자(Providers)"** 탭을 선택합니다.
3. 사용할 AI 서비스(예: OpenAI)를 선택합니다.
4. 발급받은 API 키를 붙여넣기(`Ctrl + V`)합니다.
5. **저장** 버튼을 클릭합니다.

이제 채팅 화면에서 AI를 선택하고 대화를 시작하면 됩니다!

---

## 시스템 요구사항

| 항목 | 최소 요구사항 |
|------|---------------|
| 운영체제 | Windows 10 이상 (64비트) |
| Node.js | 20.0.0 이상 |
| Rust | 1.77.0 이상 (rustup으로 설치 권장) |
| RAM | 4GB 이상 (8GB 권장) |
| 저장공간 | 500MB 이상 여유 공간 |
| 인터넷 | API 사용 시 필요 (Ollama는 오프라인 가능) |

> macOS / Linux 지원은 추후 추가될 예정입니다.

---

## 빠른 시작 가이드

개발자 또는 명령어에 익숙한 분을 위한 빠른 시작 방법입니다.

### 1. 저장소 클론

```bash
git clone https://github.com/sodamai/aiflow.git
cd aiflow
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정 (선택사항)

```bash
cp .env.example .env.local
# .env.local을 편집기로 열어 필요한 값 설정
```

### 4. 개발 서버 실행

```bash
npm run dev
```

Tauri 윈도우가 열리면서 앱이 시작됩니다.

### 5. 프로덕션 빌드

```bash
npm run build
```

`src-tauri/target/release/bundle/` 폴더에 설치 파일(.msi, .exe)이 생성됩니다.

---

## API 키 등록 방법

AIFlow의 API 키 등록은 3단계로 완료됩니다.

```
앱 실행
  └─> 왼쪽 하단 설정(톱니바퀴) 클릭
        └─> "공급자(Providers)" 탭 선택
              └─> 원하는 AI 서비스 선택
                    └─> API 키 입력 후 저장
```

### 상세 방법

1. AIFlow 앱을 실행합니다.
2. 왼쪽 사이드바 하단의 **설정 아이콘(톱니바퀴)** 을 클릭합니다.
3. 설정 창에서 **"공급자(Providers)"** 탭을 클릭합니다.
4. 사용하려는 AI 서비스 이름을 선택합니다 (예: OpenAI, Anthropic, Gemini 등).
5. API 키 입력란에 발급받은 API 키를 붙여넣기합니다.
6. 모델을 선택합니다 (예: gpt-4.1, claude-sonnet-4-6 등).
7. **"저장"** 버튼을 클릭합니다.

저장 즉시 채팅 화면 상단의 공급자 선택기에서 해당 AI를 선택할 수 있습니다.

> API 키는 Windows 자격 증명 관리자(Credential Manager)에 암호화 저장됩니다.
> 데이터베이스나 파일에는 절대 저장되지 않습니다.

---

## Ollama로 무료 로컬 AI 사용하기

Ollama를 사용하면 API 키 없이, 인터넷 없이, 비용 없이 AI를 사용할 수 있습니다.
모든 데이터가 내 PC에서만 처리되어 프라이버시도 완벽히 보호됩니다.

### Ollama 설치

1. [https://ollama.com](https://ollama.com) 에 접속합니다.
2. "Download" 버튼을 클릭해 Windows 설치 파일을 받습니다.
3. 설치 파일을 실행하고 안내에 따라 설치합니다.

### 모델 다운로드

터미널을 열고 아래 명령어 중 하나를 입력합니다:

```bash
# 가볍고 빠른 모델 (RAM 4GB 권장)
ollama pull llama3.2

# 고성능 모델 (RAM 8GB 권장)
ollama pull llama3.1:8b

# 코딩 특화 모델
ollama pull codellama

# 한국어 특화 모델
ollama pull EEVE-Korean-10.8B
```

> 모델 크기에 따라 수 GB의 다운로드가 필요합니다. 처음 한 번만 다운로드하면 됩니다.

### AIFlow에서 Ollama 사용

1. Ollama가 실행 중인지 확인합니다 (시스템 트레이에 Ollama 아이콘이 있으면 실행 중).
2. AIFlow 설정 → 공급자 → **Ollama** 선택.
3. 기본 URL이 `http://localhost:11434` 로 설정되어 있는지 확인합니다.
4. 다운로드한 모델을 선택하고 저장합니다.
5. 채팅 화면에서 Ollama를 선택하면 오프라인 AI 사용이 가능합니다!

---

## 환경 변수

`.env.example` 파일을 참고하여 `.env.local` 파일을 만드세요. `.env.local` 은 절대 Git에 커밋하지 마세요.

```env
# AIFlow 환경 변수 템플릿
# 실제 값은 .env.local에 설정 (절대 커밋 금지)

# 테스트 환경에서 OS 키체인 대신 메모리 폴백 사용
# KEYCHAIN_TEST=1

# Tauri 개발 서버 호스트 (원격 개발 시)
# TAURI_DEV_HOST=

# Tauri mock 모드 (Rust 없이 프론트엔드만 개발 시)
# TAURI_MOCK=1
```

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `KEYCHAIN_TEST` | (미설정) | `1` 로 설정 시 테스트 환경에서 메모리 키체인 사용 |
| `TAURI_DEV_HOST` | (미설정) | 원격 개발 환경의 호스트 주소 |
| `TAURI_MOCK` | (미설정) | `1` 로 설정 시 Rust 없이 프론트엔드만 개발 가능 |

---

## 폴더 구조

```
aiflow/
├── src/                        # React 프론트엔드 소스
│   ├── components/             # 재사용 가능한 UI 컴포넌트
│   │   ├── chat/               # 채팅 관련 컴포넌트
│   │   ├── palette/            # 커맨드 팔레트
│   │   ├── persona/            # 페르소나 관리 컴포넌트
│   │   ├── prompt/             # 프롬프트 라이브러리 컴포넌트
│   │   ├── sidebar/            # 사이드바 컴포넌트
│   │   └── ui/                 # 기본 UI 요소 (버튼, 인풋 등)
│   ├── views/                  # 페이지 단위 뷰
│   │   ├── OverlayApp.tsx      # 오버레이 창 뷰
│   │   └── SettingsView.tsx    # 설정 화면 뷰
│   ├── stores/                 # Zustand 상태 관리
│   │   ├── chatStore.ts        # 채팅 상태
│   │   ├── personaStore.ts     # 페르소나 상태
│   │   ├── promptStore.ts      # 프롬프트 상태
│   │   └── settingsStore.ts    # 설정 상태
│   ├── lib/                    # 유틸리티 및 서비스
│   │   ├── ai/                 # AI 공급자 어댑터
│   │   ├── ipc/                # Tauri IPC 통신
│   │   ├── privacy/            # 프라이버시 유틸리티
│   │   ├── commands.ts         # Tauri 커맨드 정의
│   │   ├── errors.ts           # 에러 처리
│   │   ├── events.ts           # 이벤트 정의
│   │   └── fuzzy.ts            # 퍼지 검색
│   ├── types/                  # TypeScript 타입 정의
│   ├── App.tsx                 # 앱 루트 컴포넌트
│   ├── main.tsx                # 엔트리포인트
│   └── index.css               # 글로벌 스타일
│
├── src-tauri/                  # Rust 백엔드 소스
│   ├── src/
│   │   ├── commands/           # Tauri IPC 커맨드 핸들러
│   │   ├── db/                 # SQLite DB 접근 계층
│   │   ├── keychain/           # OS 키체인 통합
│   │   ├── models/             # 데이터 모델
│   │   ├── services/           # 비즈니스 로직 서비스
│   │   ├── lib.rs              # 라이브러리 루트
│   │   ├── main.rs             # 앱 진입점
│   │   ├── shortcut.rs         # 전역 단축키 처리
│   │   └── tray.rs             # 시스템 트레이
│   ├── migrations/             # SQLite 마이그레이션
│   │   ├── 20260327000001_core.sql
│   │   ├── 20260327000002_chat.sql
│   │   ├── 20260327000003_attachments.sql
│   │   ├── 20260327000004_prompts.sql
│   │   ├── 20260327000005_personas.sql
│   │   └── 20260327000006_privacy.sql
│   ├── capabilities/           # Tauri 권한 설정
│   ├── icons/                  # 앱 아이콘
│   ├── Cargo.toml              # Rust 의존성
│   └── tauri.conf.json         # Tauri 설정
│
├── tests/                      # E2E 테스트 (Playwright)
├── .env.example                # 환경 변수 예시
├── package.json                # Node.js 의존성
├── tsconfig.json               # TypeScript 설정
├── vite.config.ts              # Vite 빌드 설정
└── vitest.config.ts            # Vitest 테스트 설정
```

---

## 개발 명령어

### 앱 실행

```bash
# Tauri 전체 스택 개발 서버 (권장)
npm run dev

# 프론트엔드만 실행 (Rust 없이, 빠른 UI 개발)
npm run dev:ts

# Tauri mock 모드 (프론트엔드만 + 모의 Tauri API)
npm run dev:mock
```

### 빌드

```bash
# 프로덕션 빌드 (.msi, .exe 설치 파일 생성)
npm run build
```

빌드 결과물 위치: `src-tauri/target/release/bundle/`

### 테스트

```bash
# TypeScript 단위 테스트
npm run test:unit:ts

# Rust 단위 테스트
npm run test:unit:rust

# E2E 테스트 (Playwright)
npm run test:e2e

# 컨트랙트 테스트
npm run test:contract

# 보안 감사 (cargo audit + npm audit)
npm run test:security

# 타입 체크
npm run test:types

# 테스트 감시 모드 (파일 저장 시 자동 실행)
npm run test:watch

# 커버리지 측정
npm run test:coverage

# 전체 테스트 (보안 + 단위 + E2E)
npm run test:all
```

### 코드 품질

```bash
# ESLint 린트
npm run lint

# TypeScript 타입 체크
npm run typecheck
```

---

## 보안 설명

### API 키가 절대 노출되지 않는 이유

많은 앱들이 API 키를 앱 내부 파일이나 데이터베이스에 저장합니다. 이는 키가 유출될 수 있는 위험한 방식입니다. AIFlow는 다릅니다.

```
사용자가 API 키 입력
       |
       v
Rust 백엔드(Tauri)가 수신
       |
       v
Windows 자격 증명 관리자(OS 키체인)에 암호화 저장
       |
       v
앱 DB(SQLite)에는 키 저장 안 함
앱 로그에도 키 기록 안 함
네트워크에도 키 전송 안 함 (AI API 요청 헤더 제외)
```

- **OS 키체인 저장**: `Windows 자격 증명 관리자` → `제어판 > 자격 증명 관리자`에서 확인 가능
- **DB 저장 금지**: SQLite 파일에는 API 키가 없으므로, DB 파일이 유출되어도 키는 안전
- **HTTPS 전용**: 모든 AI API 통신은 HTTPS로만 수행, 일반 HTTP 차단
- **SSRF 방어**: 허가된 AI API 도메인 외 요청 차단
- **CSP 적용**: 스크립트 인젝션 방어

### 앱 데이터 저장 위치

| 데이터 | 저장 위치 |
|--------|-----------|
| API 키 | `Windows 자격 증명 관리자` |
| 대화 내용 | `%APPDATA%\aiflow\` (SQLite) |
| 설정 | `%APPDATA%\aiflow\` (Tauri Store) |
| 페르소나 | `%APPDATA%\aiflow\` (SQLite) |
| 프롬프트 라이브러리 | `%APPDATA%\aiflow\` (SQLite) |

---

## 기여 가이드

AIFlow에 기여해 주셔서 감사합니다! 아래 가이드를 따라주세요.

### 기여 전 확인사항

1. [이슈 트래커](https://github.com/sodamai/aiflow/issues)에서 동일한 이슈 또는 PR이 없는지 확인합니다.
2. 큰 변경사항의 경우 먼저 이슈를 열어 논의해 주세요.

### 개발 플로우

```bash
# 1. 저장소 포크 및 클론
git clone https://github.com/본인계정/aiflow.git
cd aiflow

# 2. 의존성 설치
npm install

# 3. 새 브랜치 생성
git checkout -b feat/기능명
# 또는
git checkout -b fix/버그명

# 4. 코드 수정 후 테스트
npm run test:unit:ts
npm run test:unit:rust
npm run lint
npm run typecheck

# 5. 커밋
git commit -m "feat: 기능 설명"

# 6. 푸시 및 PR 생성
git push origin feat/기능명
```

### 커밋 메시지 규칙

[Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/) 형식을 따릅니다:

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 스타일 변경 (기능 변경 없음)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

### 코드 스타일

- TypeScript strict 모드 사용
- ESLint + Prettier 규칙 준수 (`npm run lint`)
- Rust는 `rustfmt` 포맷 적용 (`cargo fmt`)
- 새 기능에는 테스트 코드 작성 권장

### PR 체크리스트

- [ ] 테스트가 통과하는가 (`npm run test:all`)
- [ ] 타입 오류가 없는가 (`npm run typecheck`)
- [ ] 린트 오류가 없는가 (`npm run lint`)
- [ ] 보안에 영향을 주는 변경사항인지 확인
- [ ] API 키 또는 민감 정보가 코드에 포함되지 않았는지 확인

---

## 라이선스

Copyright (c) 2026 **SoDam AI Studio**

이 프로젝트는 SoDam AI Studio 라이선스 하에 배포됩니다.
자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.

---

<p align="center">
  Made with love by <strong>SoDam AI Studio</strong>
</p>
