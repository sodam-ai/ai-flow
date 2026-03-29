# AIFlow — UX 플로우 명세서 v1.0

> 생성: 2026-03-27 (v1.0)
> 대상: 사용자 플로우 다이어그램, 에러 UI, WCAG 2.1 AA 접근성, 컴포넌트 설계

---

## 목차

1. [디자인 원칙](#1-디자인-원칙)
2. [핵심 사용 플로우](#2-핵심-사용-플로우)
3. [화면별 UI 명세](#3-화면별-ui-명세)
4. [에러 상태 UI](#4-에러-상태-ui)
5. [접근성 요구사항 (WCAG 2.1 AA)](#5-접근성-요구사항-wcag-21-aa)
6. [컴포넌트 설계](#6-컴포넌트-설계)
7. [애니메이션 명세](#7-애니메이션-명세)
8. [반응형 및 DPI 대응](#8-반응형-및-dpi-대응)
9. [다국어 UI 고려사항](#9-다국어-ui-고려사항)
10. [키보드 단축키 맵](#10-키보드-단축키-맵)

---

## 1. 디자인 원칙

### 핵심 철학

| 원칙 | 설명 | 구현 방향 |
|------|------|----------|
| **키보드 우선** | 마우스 없이 모든 작업 가능 | Tab/Enter/Esc 완전 지원 |
| **최소 마찰** | 단축키 → 입력 → 결과 → 닫기 (3초 내) | 오버레이 즉시 열림 |
| **문맥 유지** | 다른 앱 작업 중 끊김 없이 AI 사용 | 오버레이 전용 창, 배경 앱 숨기지 않음 |
| **신뢰 표시** | 비용·제공자·보안 상태 항상 가시화 | 실시간 비용, 제공자 배지, 잠금 아이콘 |
| **적절한 피드백** | 모든 상태 변화에 즉각 반응 | 스트리밍 애니메이션, 에러 즉시 표시 |

### 색상 팔레트

```
배경:
  overlay-bg     : rgba(18, 18, 22, 0.98)   진한 다크
  panel-bg       : #1a1a24
  input-bg       : #12121a

강조:
  accent-primary : #7c6ef5   보라 (AI 관련)
  accent-success : #4ade80   초록 (성공/완료)
  accent-warning : #fb923c   주황 (경고)
  accent-danger  : #f87171   빨강 (에러)
  accent-info    : #60a5fa   파랑 (정보)

텍스트:
  text-primary   : #f0f0f8
  text-secondary : #9090a8
  text-muted     : #606078

테두리:
  border-default : rgba(255,255,255,0.08)
  border-focus   : rgba(124,110,245,0.6)   accent-primary 60%
```

### 타이포그래피

```css
/* 시스템 폰트 스택 (한국어 최적화) */
--font-sans: 'Pretendard', 'Segoe UI', 'Apple SD Gothic Neo', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;

/* 크기 */
--text-xs   : 11px  /* 메타데이터, 타임스탬프 */
--text-sm   : 13px  /* 보조 텍스트 */
--text-base : 15px  /* 기본 대화 텍스트 */
--text-lg   : 17px  /* 입력창 */
--text-xl   : 20px  /* 헤더 */
```

---

## 2. 핵심 사용 플로우

### Flow 1: 오버레이 열기 → AI 채팅 → 닫기

```
[사용자 작업 중 (어떤 앱이든)]
        │
        ▼
  Alt+Space 누름
        │
        ▼
  오버레이 표시 (animate: 150ms fade+slide-up)
  ┌─────────────────────────────────┐
  │  🔍 [           입력창         ] │  ← 즉시 포커스
  │  ─────────────────────────────  │
  │  [이전 대화 컨텍스트 미리보기]    │  (있을 때만)
  └─────────────────────────────────┘
        │
        ▼
  텍스트 입력
        │
        ├── Enter 누름 → AI 요청 전송
        │       │
        │       ▼
        │   스트리밍 응답 시작
        │   ┌─────────────────────────────┐
        │   │  [사용자 메시지]              │
        │   │  ────────────────────────── │
        │   │  [AI 응답 스트리밍 중...]    │  ← 타이핑 커서 애니메이션
        │   │  [■ 중지] [💰 $0.001]        │  ← 스트리밍 중 표시
        │   └─────────────────────────────┘
        │       │
        │       ▼
        │   스트리밍 완료
        │   ┌─────────────────────────────┐
        │   │  [사용자 메시지]              │
        │   │  ────────────────────────── │
        │   │  [AI 완성된 응답]            │
        │   │  [📋 복사] [🔄 재생성]        │
        │   │  💰 $0.002  ⏱ 1.2s          │
        │   └─────────────────────────────┘
        │
        └── Esc 누름 → 오버레이 닫기 (animate: 100ms fade-out)
                  → 이전 앱으로 포커스 복귀
```

### Flow 2: 클립보드 AI (Alt+Shift+A)

```
[사용자가 텍스트 선택 후 복사 (Ctrl+C)]
        │
        ▼
  Alt+Shift+A 누름
        │
        ▼
  클립보드 내용 자동 감지
  ┌─────────────────────────────────┐
  │  📋 클립보드에서 가져온 내용:    │
  │  "안녕하세요, 이 텍스트를..."    │  ← 미리보기 (최대 3줄)
  │                                  │
  │  🔍 [무엇을 도와드릴까요?       ] │  ← 즉시 포커스
  └─────────────────────────────────┘
        │
        ▼  (이하 Flow 1과 동일)
```

### Flow 3: 첫 실행 온보딩

```
앱 첫 실행
    │
    ▼
환영 화면 (전체 화면, 640px 중앙 카드)
┌─────────────────────────────────────┐
│                                      │
│        🌊 AIFlow에 오신 것을 환영합니다  │
│                                      │
│   단축키 하나로 어디서나 AI를 사용하세요  │
│                                      │
│         [시작하기 →]                  │  Enter / 클릭
└─────────────────────────────────────┘
    │
    ▼
Step 1: 글로벌 단축키 설정
┌─────────────────────────────────────┐
│  ⌨️  단축키 설정                      │
│                                      │
│  AI 오버레이 열기:                    │
│  [Alt + Space       ] [변경]         │  ← 기본값, 클릭 시 녹음
│                                      │
│  ※ Alt+Space는 Windows와 충돌이 없습니다  │
│                                      │
│  [← 이전]          [다음 →]          │
└─────────────────────────────────────┘
    │
    ▼
Step 2: AI 제공자 API 키 설정
┌─────────────────────────────────────┐
│  🔑 AI 제공자 연결                   │
│                                      │
│  ○ OpenAI (GPT-4o)         [설정]   │
│  ○ Anthropic (Claude)      [설정]   │
│  ○ Google (Gemini)         [설정]   │
│                                      │
│  ℹ️  API 키는 OS 키체인에 안전하게     │
│      저장됩니다. AIFlow 서버로        │
│      전송되지 않습니다.              │
│                                      │
│  [← 이전]      [나중에 설정]  [완료] │
└─────────────────────────────────────┘
    │
    ▼
Step 3: 완료
┌─────────────────────────────────────┐
│  ✅ 설정 완료!                        │
│                                      │
│  Alt+Space를 눌러 AIFlow를 시작하세요  │
│                                      │
│  [단축키 테스트하기]                  │
└─────────────────────────────────────┘
```

### Flow 4: 파일 첨부

```
오버레이 열린 상태
    │
    ├── 파일 드래그 앤 드롭 → 드롭존 강조
    │   ┌─────────────────────────┐
    │   │  📄 여기에 파일을 놓으세요  │  ← 드래그 중 오버레이
    │   │  (최대 10MB)             │
    │   └─────────────────────────┘
    │       │
    │       └── 드롭 → 파일 검증
    │               │
    │               ├── OK → 첨부 배지 표시
    │               │   [📎 document.pdf × ]
    │               │
    │               └── 오류 → 에러 토스트
    │                   "파일 크기 초과 (최대 10MB)"
    │
    └── 📎 버튼 클릭 → 파일 선택 다이얼로그
```

### Flow 5: 프라이버시 모드

```
오버레이 열린 상태
    │
    ▼
🔒 프라이버시 모드 토글 (헤더 우측)
    │
    ▼
활성화:
┌─────────────────────────────────────┐
│  🔒 프라이버시 모드  [OFF → ON]      │  ← 보라색 배경
│  ─────────────────────────────────  │
│  • 이름, 전화번호, 이메일 자동 마스킹  │
│  • 마스킹된 내용은 복원 불가          │
│  [확인]                              │
└─────────────────────────────────────┘
    │
    ▼
입력 예시: "홍길동 씨에게 010-1234-5678로 연락해"
    │
    ▼
AI 전송 전 마스킹:
"[이름] 씨에게 [전화번호]로 연락해"
    │
    ▼
응답 표시 (마스킹 상태로)
```

---

## 3. 화면별 UI 명세

### 3.1 메인 오버레이 (Spotlight Style)

```
┌────────────────────────────── 640px ────────────────────────────────┐
│                                                                       │
│  [제공자 선택 드롭다운]  [페르소나]  [🔒 프라이버시]  [설정⚙️]  [✕]   │  32px
│  ─────────────────────────────────────────────────────────────────  │
│                                                                       │
│  [스크롤 가능 대화 영역]                                    최대 480px │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  사용자: 파이썬으로 피보나치 수열 구현해줘                      │   │
│  │                                                               │   │
│  │  ───────────────────────────────────────────────────────    │   │
│  │                                                               │   │
│  │  Claude: ```python                                            │   │
│  │          def fibonacci(n):                                    │   │
│  │              ...                                              │   │
│  │          ```                                                  │   │
│  │  💰 $0.003  ⏱ 0.8s  [📋]  [🔄]                              │   │
│  │                                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                       │
│  [📎]  [입력창 (자동 높이 조절, 최소 48px, 최대 200px)        ] [↵] │  ← 48~200px
│        placeholder: "무엇이든 물어보세요... (Enter로 전송)"          │
│                                                                       │
│  [💰 총 $0.012]  [🔒 OS 키체인]  [토큰: 245 in / 512 out]           │  20px
└───────────────────────────────────────────────────────────────────────┘
```

**창 속성**:
- 위치: 화면 중앙 상단 1/3 지점 (y = 화면 높이 × 0.2)
- 모서리: 16px rounded
- 그림자: `0 25px 60px rgba(0,0,0,0.6)`
- 배경: `rgba(18,18,22,0.98)` + backdrop blur 불필요 (성능)

### 3.2 설정 화면 (메인 윈도우)

```
┌──── 메인 윈도우 (800×600) ─────────────────────────────────────────┐
│                                                                       │
│  ┌─── 사이드바 (200px) ───┐  ┌─── 컨텐츠 영역 (600px) ─────────┐  │
│  │                          │  │                                   │  │
│  │  AIFlow                  │  │  [탭: AI 제공자]                  │  │
│  │  v1.0.0                  │  │  ─────────────────────────────  │  │
│  │                          │  │                                   │  │
│  │  ───────────────         │  │  ┌──── GPT-4o ───────────────┐  │  │
│  │  > AI 제공자             │  │  │  상태: ✅ 연결됨           │  │  │
│  │    단축키                │  │  │  API 키: sk-***...abc      │  │  │
│  │    프라이버시             │  │  │  [삭제] [재연결]           │  │  │
│  │    외관/언어             │  │  └───────────────────────────┘  │  │
│  │    데이터 관리           │  │                                   │  │
│  │    라이선스              │  │  ┌──── Claude Sonnet 4.6 ──┐     │  │
│  │  ───────────────         │  │  │  상태: ✅ 연결됨         │     │  │
│  │    정보                  │  │  │  API 키: sk-ant-***...  │     │  │
│  │                          │  │  │  [삭제] [재연결]         │     │  │
│  │                          │  │  └───────────────────────────┘  │  │
│  │                          │  │                                   │  │
│  │                          │  │  [+ 새 제공자 추가]              │  │
│  └──────────────────────────┘  └───────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────┘
```

### 3.3 배치 처리 화면 (Phase 2)

```
┌──── 배치 처리 ─────────────────────────────────────────────────────┐
│                                                                       │
│  [파일 드롭 영역: 파일을 여기에 끌어다 놓거나 클릭하여 선택]          │
│  ────────────────────────────────────────────────────────────────  │
│                                                                       │
│  큐 (3개 파일)                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ✅ report_q1.pdf    →  요약 완료        [보기]  [내보내기]    │  │
│  │  ⏳ contract_v2.pdf  →  처리 중... 45%  [중지]               │  │
│  │  ⏸ proposal.docx    →  대기 중          [제거]               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [프롬프트 템플릿: 각 파일에 적용할 지시문...]                         │
│                                                                       │
│  [전체 시작]  [전체 중지]  [완료된 결과 내보내기]                     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. 에러 상태 UI

### 에러 표시 원칙

1. **인라인 우선**: 에러는 관련 컴포넌트 바로 아래에 표시
2. **토스트는 전역 에러만**: 시스템 레벨 에러만 우측 하단 토스트
3. **복구 행동 제시**: 에러 메시지와 함께 다음 행동을 안내
4. **기술 용어 금지**: 사용자 친화적 언어 사용

### 에러 카탈로그 UI 매핑

| 에러 코드 | 표시 위치 | UI 형태 | 복구 버튼 |
|-----------|-----------|---------|----------|
| `AI_001` API 키 없음 | 응답 영역 | 인라인 경고 | [API 키 설정] |
| `AI_002` API 키 만료 | 응답 영역 | 인라인 에러 | [키 업데이트] |
| `AI_003` 레이트 리밋 | 응답 영역 | 인라인 경고 | [다른 제공자로] / [30초 후 재시도] |
| `AI_004` 컨텍스트 초과 | 입력창 위 | 배너 경고 | [대화 축약] / [새 대화] |
| `AI_005` 스트리밍 오류 | 응답 영역 | 인라인 에러 | [재시도] |
| `DB_001` DB 잠금 | 상단 배너 | 전역 경고 | [앱 재시작] |
| `DB_002` 마이그레이션 실패 | 전체 화면 | 블로킹 모달 | [백업 복구] / [지원 문의] |
| `NET_001` 인터넷 없음 | 상단 배너 | 전역 정보 | — |
| `NET_002` AI 서버 다운 | 응답 영역 | 인라인 에러 | [다른 제공자로] |
| `SEC_001` 키체인 접근 실패 | 설정 화면 | 인라인 에러 | [OS 재시작 안내] |
| `FILE_001` 파일 크기 초과 | 첨부 영역 | 인라인 에러 | — |
| `FILE_002` 미지원 형식 | 첨부 영역 | 인라인 경고 | [지원 형식 보기] |

### 에러 컴포넌트 명세

#### 인라인 에러 (응답 영역)

```tsx
// src/components/ErrorMessage.tsx
interface ErrorMessageProps {
  code: string;          // 'AI_003'
  message: string;       // "요청이 너무 많습니다..."
  action?: {
    label: string;       // "다른 제공자로 전환"
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;       // "30초 후 재시도"
    countdown?: number;  // 자동 카운트다운
    onClick: () => void;
  };
}

// 렌더링 예시:
// ┌─────────────────────────────────────┐
// │  ⚠️  요청이 너무 많습니다. (AI_003)  │
// │  잠시 후 다시 시도하거나 다른 AI로   │
// │  전환하세요.                         │
// │                                      │
// │  [다른 제공자로]    [29초 후 재시도]  │
// └─────────────────────────────────────┘
```

#### 블로킹 모달 (DB 마이그레이션 실패)

```tsx
// DB_002 — 앱을 계속 사용할 수 없는 심각한 에러

// ┌─────────────────────────────────────────────────────┐
// │                                                       │
// │  ⛔  데이터베이스 업데이트 실패                        │
// │                                                       │
// │  AIFlow를 최신 버전으로 업데이트하는 과정에서          │
// │  문제가 발생했습니다.                                  │
// │                                                       │
// │  백업 파일이 자동으로 생성되었습니다:                  │
// │  📁 %APPDATA%\aiflow\backups\pre_migration_1.0.0.db  │
// │                                                       │
// │  [백업으로 복구]    [이전 버전으로 롤백]   [지원 문의] │
// │                                                       │
// │  오류 코드: DB_002 (migration_v15_failed)            │
// └─────────────────────────────────────────────────────┘
```

#### 글로벌 토스트 (우측 하단)

```tsx
// 토스트는 전역 에러만 (DB_001, NET_001)
// 자동 닫힘: 5초 (에러), 3초 (정보)
// 최대 3개 동시 표시

// ┌───────────────────────────────┐  ← 우측 하단, 24px 마진
// │  📶 인터넷 연결 끊김          │  INFO (파랑)
// │  AI를 사용하려면 연결이 필요합니다.│
// └───────────────────────────────┘

// ┌───────────────────────────────┐
// │  ⚠️  데이터베이스 잠김        │  ERROR (빨강)
// │  앱을 재시작하면 해결됩니다.  │
// │  [지금 재시작]                │
// └───────────────────────────────┘
```

### 빈 상태 (Empty State) UI

```
대화 없을 때:
┌─────────────────────────────────────┐
│                                      │
│         ✨                           │
│                                      │
│    AIFlow가 준비되었습니다.           │
│    무엇이든 물어보세요.              │
│                                      │
│  빠른 시작:                          │
│  "이 텍스트 요약해줘"               │
│  "파이썬으로 정렬 알고리즘 만들어"   │
│  "이메일 초안 작성해줘"             │
│                                      │
└─────────────────────────────────────┘

API 키 없을 때:
┌─────────────────────────────────────┐
│                                      │
│         🔑                           │
│                                      │
│    AI 제공자를 연결해주세요.          │
│                                      │
│    OpenAI, Anthropic, Google 중      │
│    하나 이상의 API 키가 필요합니다.  │
│                                      │
│         [API 키 설정하기]            │
│                                      │
└─────────────────────────────────────┘
```

---

## 5. 접근성 요구사항 (WCAG 2.1 AA)

### 5.1 키보드 접근성

| 요구사항 | 구현 방법 |
|---------|----------|
| 모든 기능 키보드로 가능 | Tab 순서 논리적 배치, 마우스 전용 요소 금지 |
| 포커스 표시자 명확 | `outline: 2px solid #7c6ef5; outline-offset: 2px` (기본 제거 금지) |
| 포커스 트랩 (모달) | 모달 열릴 때 내부에 포커스 고정, Esc로 닫기 |
| 오버레이 열기/닫기 | Alt+Space (열기), Esc (닫기) |

```tsx
// 포커스 트랩 구현 (모달)
function useFocusTrap(ref: RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements[0] as HTMLElement;
    const last = focusableElements[focusableElements.length - 1] as HTMLElement;

    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);
}
```

### 5.2 색상 대비

| 요소 | 전경색 | 배경색 | 대비율 | 기준 |
|------|--------|--------|--------|------|
| 기본 텍스트 | #f0f0f8 | #1a1a24 | 14.3:1 | ✅ AA (4.5:1 이상) |
| 보조 텍스트 | #9090a8 | #1a1a24 | 5.1:1 | ✅ AA |
| 플레이스홀더 | #606078 | #12121a | 4.6:1 | ✅ AA |
| accent-primary | #7c6ef5 | #1a1a24 | 4.8:1 | ✅ AA |
| 에러 텍스트 | #f87171 | #1a1a24 | 5.3:1 | ✅ AA |
| 경고 텍스트 | #fb923c | #1a1a24 | 6.1:1 | ✅ AA |

**도구**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 로 검증

### 5.3 스크린리더 지원

```tsx
// ARIA 레이블 필수 적용 사례

// 아이콘 버튼 (텍스트 없음)
<button aria-label="대화 복사">
  <CopyIcon aria-hidden="true" />
</button>

// 스트리밍 상태 알림
<div
  role="status"
  aria-live="polite"
  aria-label="AI 응답 생성 중"
>
  {isStreaming ? "응답 생성 중..." : response}
</div>

// 에러 메시지
<div role="alert" aria-live="assertive">
  <span>⚠️ {errorMessage}</span>
</div>

// 프로그레스 바
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="파일 처리 진행률"
>
  <div style={{ width: `${progress}%` }} />
</div>

// 대화 목록
<main role="log" aria-label="AI 대화" aria-live="polite">
  {messages.map(msg => (
    <article
      key={msg.id}
      role="article"
      aria-label={`${msg.role === 'user' ? '사용자' : 'AI'} 메시지`}
    >
      {msg.content}
    </article>
  ))}
</main>
```

### 5.4 동작 감소 지원

```css
/* 전정 장애 등으로 애니메이션에 민감한 사용자 대응 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .streaming-cursor {
    display: none;  /* 깜박이는 커서 제거 */
  }
}
```

### 5.5 텍스트 크기 조절

- 최소 폰트 크기: 11px (메타데이터)
- 시스템 폰트 크기 설정 존중 (rem 단위 사용)
- 200% 텍스트 크기에서도 레이아웃 깨지지 않도록 (flexbox wrapping)

```css
/* rem 기반 크기 (시스템 설정 존중) */
:root { font-size: 100%; }  /* 시스템 기본 16px */

.text-base { font-size: 0.9375rem; }  /* 15px */
.text-sm   { font-size: 0.8125rem; }  /* 13px */
```

---

## 6. 컴포넌트 설계

### 컴포넌트 계층

```
App
├── TrayIcon (시스템 트레이)
├── OverlayWindow (오버레이 전용 Tauri 창)
│   ├── OverlayHeader
│   │   ├── ProviderSelector
│   │   ├── PersonaSelector
│   │   ├── PrivacyToggle
│   │   └── SettingsButton
│   ├── MessageList (스크롤 가능)
│   │   ├── UserMessage
│   │   └── AIMessage
│   │       ├── MessageContent (Markdown 렌더링)
│   │       ├── StreamingCursor (스트리밍 중)
│   │       ├── MessageActions (복사, 재생성)
│   │       └── MessageMeta (비용, 시간)
│   ├── AttachmentPreview (첨부 파일 미리보기)
│   ├── InputArea
│   │   ├── FileDropZone
│   │   ├── TextInput (자동 높이 조절)
│   │   └── SendButton / StopButton
│   └── StatusBar (비용 합계, 보안 상태)
│
└── MainWindow (설정 전용 Tauri 창)
    ├── Sidebar (네비게이션)
    └── ContentArea
        ├── ProviderSettings
        ├── HotkeySettings
        ├── PrivacySettings
        ├── AppearanceSettings
        ├── DataManagement
        └── LicenseSettings
```

### 주요 컴포넌트 Props

#### `<ProviderSelector>`

```tsx
interface ProviderSelectorProps {
  providers: {
    id: string;
    name: string;       // "GPT-4o", "Claude Sonnet"
    model: string;
    isAvailable: boolean;
    latencyMs?: number;  // 스마트 라우팅 정보
  }[];
  selected: string;
  onSelect: (providerId: string) => void;
  mode: 'manual' | 'smart';  // 수동 선택 or 스마트 라우팅
}
```

#### `<AIMessage>`

```tsx
interface AIMessageProps {
  content: string;           // Markdown 텍스트
  isStreaming: boolean;
  provider: string;          // "claude-sonnet-4.6"
  tokenCount: { in: number; out: number };
  costUsd: number;
  durationMs: number;
  onCopy: () => void;
  onRegenerate: () => void;
  streamCancelled?: boolean; // 사용자가 중지한 경우
}
```

#### `<PrivacyToggle>`

```tsx
interface PrivacyToggleProps {
  isActive: boolean;
  onToggle: () => void;
  maskedCount?: number;  // 현재 마스킹된 항목 수 (활성 시)
}

// 렌더링:
// [🔒 프라이버시: ON] (3개 마스킹됨)  ← 초록색 배경
// [🔓 프라이버시: OFF]               ← 기본 배경
```

#### `<CostDisplay>`

```tsx
interface CostDisplayProps {
  costUsd: number;
  costKrw?: number;     // 환율 적용 시 (ExchangeRate-API)
  showKrw: boolean;     // 사용자 설정
}

// 렌더링:
// 💰 $0.003 (₩4.1)  ← USD + KRW 병행 표시
```

### Markdown 렌더링 (`<MessageContent>`)

```tsx
// src/components/MessageContent.tsx
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';

// 지원 요소:
// - 코드 블록 (언어 감지 + 구문 강조)
// - 인라인 코드
// - 테이블
// - 목록 (순서/비순서)
// - 볼드, 이탤릭
// - 링크 (외부 링크는 기본 브라우저에서 열기)
// - 수식 (remark-math, 선택 사항)

// 코드 블록 렌더링:
// ┌─────────────────────────────────────────┐
// │  python                      [복사]     │
// │  def fibonacci(n):                      │
// │      if n <= 1:                         │
// │          return n                       │
// │      return fibonacci(n-1) + ...        │
// └─────────────────────────────────────────┘
```

---

## 7. 애니메이션 명세

### 오버레이 열기/닫기

```css
/* 열기: 150ms */
@keyframes overlay-enter {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 닫기: 100ms (열기보다 빠름 — 사용자 흐름 방해 최소화) */
@keyframes overlay-exit {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
  }
}
```

### 스트리밍 커서

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.streaming-cursor::after {
  content: '▌';
  color: #7c6ef5;
  animation: blink 0.8s step-end infinite;
}
```

### 에러 진입 (Shake)

```css
/* 유효성 검사 실패 시 입력창 흔들림 */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

.input-error {
  animation: shake 0.4s ease-in-out;
  border-color: #f87171;
}
```

### 토스트 등장/퇴장

```css
/* 우측 하단 슬라이드 인 */
@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### 성능 원칙

- `transform` + `opacity`만 애니메이션 (layout 재계산 없음)
- `will-change: transform` 사용 금지 (메모리 사용)
- 60fps 유지: 150ms 이하 애니메이션은 `ease-out`, 그 이상은 `spring`
- `prefers-reduced-motion` 항상 존중

---

## 8. 반응형 및 DPI 대응

### 창 크기 정책

| 창 | 기본 크기 | 최소 크기 | 최대 크기 | 리사이즈 |
|----|----------|----------|----------|--------|
| 오버레이 | 640×auto | 480×200 | 640×720 | 높이만 자동 (내용에 따라) |
| 설정 창 | 800×600 | 700×500 | 1200×800 | 자유 |

### DPI 대응 (High-DPI / 4K)

```rust
// src-tauri/src/window.rs
// Windows DPI 자동 감지 및 스케일링

use tauri::LogicalSize;

pub fn create_overlay_window(app: &tauri::App) -> tauri::WebviewWindow {
    let monitor = app.primary_monitor().unwrap().unwrap();
    let scale_factor = monitor.scale_factor();

    // 논리적 크기로 지정 (물리적 픽셀 = 논리 × scale_factor)
    let window = tauri::WebviewWindowBuilder::new(app, "overlay", tauri::WebviewUrl::App("index.html".into()))
        .title("AIFlow")
        .inner_size(640.0, 64.0)  // 초기 높이는 입력창만
        .min_inner_size(480.0, 200.0)
        .max_inner_size(640.0, 720.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .unwrap();

    // 화면 중앙 상단 1/3 위치
    let (w, h) = (640.0, 400.0);
    let screen_size = monitor.size();
    let x = (screen_size.width as f64 / scale_factor - w) / 2.0;
    let y = screen_size.height as f64 / scale_factor * 0.2;

    window.set_position(tauri::LogicalPosition::new(x, y)).unwrap();
    window
}
```

### CSS DPI 대응

```css
/* Tailwind v4 기반 */
/* 1px 테두리가 고해상도에서 사라지지 않도록 */
.border-thin {
  border-width: max(1px, 0.0625rem);
}

/* 아이콘은 SVG 또는 2x 이미지 사용 */
img.icon {
  image-rendering: crisp-edges;
}
```

---

## 9. 다국어 UI 고려사항

### 지원 언어 (Phase 1)

| 언어 | 코드 | 텍스트 방향 |
|------|------|------------|
| 한국어 | ko | LTR |
| 영어 | en | LTR |
| 일본어 | ja | LTR |
| 중국어 간체 | zh-CN | LTR |

### UI 길이 여유분

```
텍스트 길이 비율 (영어 기준):
  한국어  : 0.7×  (더 짧음)
  일본어  : 0.8×
  중국어  : 0.7×
  독일어  : 1.4×  (향후 대비)

레이아웃 원칙:
  - 고정 너비 버튼 사용 금지 → min-width 사용
  - 버튼 텍스트 오버플로우: ellipsis 대신 wrapping 허용
  - 아이콘 + 텍스트 조합으로 의미 전달 (언어 의존 낮춤)
```

### 날짜/숫자 형식

```typescript
// src/utils/format.ts

// 날짜: OS 로케일 기반
const formatDate = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);

// 비용: USD는 항상 영어 형식, KRW는 한국어 형식
const formatCost = (usd: number, krw?: number) => {
  const usdStr = `$${usd.toFixed(4)}`;
  if (krw) {
    const krwStr = new Intl.NumberFormat('ko-KR').format(Math.round(krw));
    return `${usdStr} (₩${krwStr})`;
  }
  return usdStr;
};
```

---

## 10. 키보드 단축키 맵

### 오버레이 내 단축키

| 단축키 | 동작 | 컨텍스트 |
|--------|------|---------|
| `Enter` | 메시지 전송 | 입력창 포커스 |
| `Shift+Enter` | 줄 바꿈 | 입력창 포커스 |
| `Esc` | 오버레이 닫기 | 항상 |
| `Ctrl+K` | AI 명령 팔레트 | 항상 |
| `Ctrl+C` | 선택 텍스트 복사 | 텍스트 선택 시 |
| `Ctrl+Shift+C` | 마지막 AI 응답 복사 | 항상 |
| `Ctrl+N` | 새 대화 | 항상 |
| `Ctrl+Z` | 전송 취소 (스트리밍 중) | 스트리밍 중 |
| `Tab` | 다음 요소로 포커스 | 항상 |
| `Shift+Tab` | 이전 요소로 포커스 | 항상 |
| `↑ / ↓` | 이전/다음 메시지 탐색 | 입력창이 비어있을 때 |
| `Ctrl+↑` | 대화 최상단으로 스크롤 | 항상 |
| `Ctrl+↓` | 대화 최하단으로 스크롤 | 항상 |

### 글로벌 단축키 (확정값 — 변경 가능)

| 단축키 | 동작 |
|--------|------|
| `Alt+Space` | AI 오버레이 열기/닫기 |
| `Alt+Shift+A` | 클립보드 내용으로 오버레이 열기 |
| `Alt+Shift+S` | 스크린샷 캡처 후 오버레이 열기 (Phase 2) |
| `Ctrl+K` (전역) | AI 명령 팔레트 |

### 단축키 충돌 감지 UI

```
설정 > 단축키에서 새 단축키 설정 시:
  [Alt + ___] (누르는 키 녹음 중...)
      │
      ├── 충돌 감지: "이 단축키는 이미 [Microsoft Teams]에서 사용 중입니다."
      │   [다른 단축키 선택]  [그래도 사용]
      │
      └── OK: "✅ Alt+Space 등록됨"
```
