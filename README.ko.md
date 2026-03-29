# AIFlow

**단축키 하나로 모든 AI를.** 어느 앱에서든 GPT, Claude, Gemini, 로컬 LLM과 대화할 수 있는 로컬 데스크톱 AI 허브.

[English](README.md) | [Japanese](README.ja.md) | [Chinese](README.zh.md)

---

## AIFlow란?

AIFlow는 여러 AI 프로바이더를 하나로 모은 **Windows 데스크톱 앱**입니다. 어떤 앱에서든 `Alt+Space`를 누르면 AIFlow가 나타나고, 질문하면 실시간 스트리밍 응답과 함께 비용이 표시됩니다.

**클라우드 계정 불필요. 데이터 수집 없음. 모든 것이 내 PC에 저장됩니다.**

## 주요 기능

| 기능 | 설명 |
|------|------|
| **글로벌 단축키** (`Alt+Space`) | 어떤 앱에서든 AIFlow 소환 (Word, Chrome, 게임 등) |
| **멀티 프로바이더** | GPT-4o, Claude Sonnet, Gemini Flash + 8개 이상 |
| **실시간 비용 표시** | 메시지마다 토큰 수 + USD + KRW 비용 표시 |
| **OS 키체인 보안** | API 키를 Windows 자격 증명 관리자에 저장 (파일에 절대 없음) |
| **암호화 DB** | SQLCipher AES-256으로 모든 대화 암호화 |
| **AI 페르소나** | 6종 내장 (개발자, 카피라이터, 번역가, 분석가, 법무, 요약) |
| **프롬프트 저장고** | 저장, 태그, 검색 + `{{변수}}` 슬롯 지원 |
| **명령 팔레트** (`Ctrl+K`) | 자연어로 앱 기능에 접근 |
| **파일 드래그앤드롭** | PDF, TXT, MD, 코드, 이미지를 AI 채팅에 바로 전달 |
| **자동 업데이터** | Ed25519 서명 검증 + 다운그레이드 방지 |
| **다크 모드** | 기본 다크 테마, 깔끔한 UI |
| **다국어** | 한국어 + 영어 (추가 언어 예정) |

## 기술 스택

| 영역 | 기술 |
|------|------|
| 데스크톱 | Tauri 2 (Rust 백엔드) |
| 프론트엔드 | React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| 데이터베이스 | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 25만 반복) |
| API 키 | Windows 자격 증명 관리자 (OS 키체인) |
| 상태 관리 | Zustand |
| 스트리밍 | Tauri ipc::Channel |
| AI 호출 | Rust reqwest (CORS 없음, 키가 프론트엔드에 절대 노출 안 됨) |

## 시작하기

### 요구 사항
- **Windows 10 21H2+** 또는 **Windows 11**
- AI API 키 1개 이상 (OpenAI, Anthropic, 또는 Google)

### 설치
1. [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)에서 최신 `.msi` 다운로드
2. 설치 프로그램 실행
3. 시스템 트레이에 AIFlow 아이콘 등장
4. `Alt+Space`로 오버레이 열기
5. 설정에서 API 키 등록

### 소스에서 빌드

```bash
# 사전 설치 (관리자 PowerShell)
choco install strawberryperl -y   # SQLCipher 빌드에 필요
choco install nodejs-lts -y

# 저장소 클론
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow

# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드 (.msi)
npm run build
```

## 보안

- API 키: OS 키체인에만 저장 (코드, 파일, DB에 평문 절대 없음)
- 데이터베이스: SQLCipher AES-256 + PBKDF2-SHA512 (25만 반복)
- IPC: 모든 파라미터 Zod 스키마 검증
- 감사 로그: 변경 불가 INSERT 전용
- 업데이트: Ed25519 서명 검증

## 로드맵

| Phase | 핵심 | 상태 |
|-------|------|------|
| **1a** | 핵심 MVP (채팅, 비용, 보안, i18n) | 진행 중 |
| **1b** | 단축키, 페르소나, 프롬프트, 업데이터 | 예정 |
| **2** | 멀티AI, 스마트 라우팅, 프라이버시, Pro | 예정 |
| **3** | RAG, 음성, 에이전트, 플러그인 API | 예정 |

## 라이선스

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
