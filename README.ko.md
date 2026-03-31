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
| **멀티 프로바이더** | GPT-4o, Claude Sonnet, Gemini Flash + 8개 이상 (총 11개) |
| **API 키 검증** | 저장 전 프로바이더 API로 키 유효성 자동 검증 |
| **실시간 비용 표시** | 메시지마다 토큰 수 + USD + KRW 이중 비용 표시 |
| **OS 키체인 보안** | API 키를 Windows 자격 증명 관리자에 저장 (파일에 절대 없음) |
| **암호화 DB** | SQLCipher AES-256으로 모든 대화 암호화 |
| **AI 페르소나** | 6종 내장 (개발자, 카피라이터, 번역가, 분석가, 법무, 요약) |
| **프롬프트 저장고** | 저장, 태그, 검색 + `{{변수}}` 슬롯 지원 |
| **명령 팔레트** (`Ctrl+K`) | 자연어로 앱 기능에 접근 |
| **파일 드래그앤드롭** | PDF, TXT, MD, 코드, 이미지를 AI 채팅에 바로 전달 |
| **자동 업데이터** | Ed25519 서명 검증 + 다운그레이드 방지 |
| **다크 모드** | 기본 다크 테마, 깔끔한 UI |
| **다국어** | 한국어 + 영어 (추가 언어 예정) |
| **멀티 AI 비교** | 2~3개 AI를 나란히 스트리밍, 최고 응답 채택 |
| **스마트 라우팅** | 질문 복잡도 분석 → 최적 AI 자동 선택 + 폴백 체인 |
| **프라이버시 모드** | PII 스캐너 (주민번호, 전화, 이메일 등) + 마스킹 미리보기 |
| **로컬 LLM** | Ollama/LM Studio 자동 감지, 무료 로컬 모델 사용 |
| **비용 대시보드** | 모델별 비용 분석, 일별 차트, USD + KRW |
| **월 예산** | 지출 한도 설정, 80% 도달 시 알림 |
| **프롬프트 버전 관리** | 수정 시 이전 버전 자동 저장, 비교 및 복원 |
| **완료 알림** | AI 응답 완료 시 OS 알림 (최소화 상태) |
| **스크린샷 → AI** (`Ctrl+Shift+S`) | 화면 캡처 → 비전 AI 전송 |

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

- **API 키 검증**: 저장 전 무료 API 호출로 유효성 검증 (포맷 + 실제 확인)
- **API 키 저장**: OS 키체인에만 저장 (코드, 파일, DB에 평문 절대 없음)
- **데이터베이스**: SQLCipher AES-256 + PBKDF2-SHA512 (25만 반복)
- **IPC**: 모든 파라미터 Zod 스키마 검증
- **스트리밍**: Tauri ipc::Channel + 취소 지원
- **감사 로그**: 변경 불가 INSERT 전용 (ai_stream_started/completed/failed)
- **업데이트**: Ed25519 서명 검증

## 비개발자를 위한 가이드 (AI 바이브코딩)

AI 코딩 도구로 자연어만 사용해서 AIFlow를 수정할 수 있습니다:

1. [Cursor](https://cursor.sh) 또는 AI 지원 IDE에서 이 프로젝트를 열기
2. 원하는 것을 자연어로 설명 (예: "다크 블루 테마 옵션 추가해줘")
3. AI가 코드를 생성 — 확인하고 수락하면 끝
4. `npm run dev`로 테스트 — 변경사항이 앱 창에 바로 반영됨
5. **핵심 규칙**: API 키를 코드 파일에 절대 넣지 마세요. 항상 설정 UI를 사용하세요.

## 운영 참고사항

- **데이터베이스 위치**: `%APPDATA%/ai-flow/aiflow.db` (SQLCipher 암호화)
- **API 키**: Windows 자격 증명 관리자의 "aiflow" 서비스에 저장
- **로그**: Tauri 개발 콘솔 또는 `%APPDATA%/ai-flow/logs/`
- **SQLCipher 빌드**: Windows에서 Strawberry Perl 필요 (C 컴파일러 의존성)

## 로드맵

| Phase | 핵심 | 상태 |
|-------|------|------|
| **1a** | 핵심 MVP (채팅, 비용, 보안, i18n) | **완료** |
| **1b** | 단축키, 오버레이, 페르소나, 프롬프트, 트레이, 파일 드롭 | **완료** |
| **2** | 멀티AI, 스마트 라우팅, 프라이버시, Pro | 예정 |
| **3** | RAG, 음성, 에이전트, 플러그인 API | 예정 |

## 라이선스

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
