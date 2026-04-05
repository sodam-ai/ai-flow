# AIFlow

**One hotkey to rule all AIs.** A local desktop AI hub that lets you chat with GPT, Claude, Gemini, and local LLMs from any app — with knowledge bases, multi-step agents, and workflow automation.

[Korean](README.ko.md) | [Japanese](README.ja.md) | [Chinese](README.zh.md)

---

## What is AIFlow?

AIFlow is a **Windows desktop application** that brings all your AI providers into one place. Press `Alt+Space` from any app to summon AIFlow, ask your question, and get a streaming response — all with real-time cost tracking, encrypted local storage, and zero cloud dependency.

**No cloud account. No data collection. Everything stays on your machine.**

---

## Key Features

### Core Chat
| Feature | Description |
|---------|-------------|
| **Global Hotkey** (`Alt+Space`) | Summon AIFlow from any app (Word, Chrome, games, anything) |
| **Multi-Provider** | GPT-4o, Claude Sonnet, Gemini Flash + 8 more providers (11 total) |
| **API Key Validation** | Keys validated against the provider API before saving |
| **Real-Time Cost** | Token count + USD + KRW dual-currency cost display per message |
| **OS Keychain Security** | API keys stored in Windows Credential Manager (never in files) |
| **Encrypted Database** | SQLCipher AES-256 encryption for all conversations |
| **AI Personas** | 6 built-in roles (Developer, Writer, Translator, Analyst, Legal, Summarizer) |
| **Prompt Library** | Save, tag, and search prompts with `{{variable}}` slots |
| **Command Palette** (`Ctrl+K`) | Natural-language access to all app features |
| **File Drag & Drop** | Drop PDF, TXT, MD, code, or images directly into AI chat |
| **Clipboard → AI** (`Alt+Shift+A`) | Send clipboard content to AI instantly from any app |
| **Screenshot → AI** (`Ctrl+Shift+S`) | Send a screenshot to Vision AI |
| **System Tray** | Runs in background with quick-access tray menu |

### Phase 2 — Power Features
| Feature | Description |
|---------|-------------|
| **Multi-AI Compare** | Stream 2~3 models side-by-side, pick the best response |
| **Smart Routing** | Auto-selects best AI based on prompt complexity (0–100 score) |
| **Privacy Mode** | Local PII scanner (SSN, phone, email) with mask-before-send |
| **Local LLM** | Auto-detects Ollama / LM Studio, uses local models for free |
| **Cost Dashboard** | Per-model cost breakdown, daily charts, USD + KRW |
| **Monthly Budget** | Set spending limit, get alerts at 80% threshold |
| **Prompt Versions** | Auto-saved edit history, compare and restore any version |
| **Completion Alerts** | OS notification when AI response finishes (if minimized) |
| **Workflow Builder** | Multi-step AI automation pipelines with 15 built-in templates |
| **Batch Queue** | Process hundreds of items automatically |
| **MCP Market** | File, Git, Browser AI tools via MCP protocol |
| **Browser Extension** | Send current page to AIFlow with one click |

### Phase 3 — Intelligence Features
| Feature | Description |
|---------|-------------|
| **Knowledge Base (RAG)** | Index your documents and search them with full-text AI queries |
| **AI Agent** | Multi-step autonomous task execution with approval gate for sensitive actions |
| **Conversation Branching** | Fork any conversation at any message, explore different paths |
| **Workflow Export/Import** | Share workflows as JSON files between machines |
| **Conditional Workflows** | Improved branching and condition support in workflow steps |

### Phase 5 — Voice I/O ✅ Complete
| Feature | Description |
|---------|-------------|
| **Voice Input** (`Alt+Shift+V`) | Whisper API STT — press once from anywhere to start recording |
| **Live Waveform** | Real-time frequency bars during recording (8-channel) |
| **Silence Auto-Stop** | Auto-stops after 2.5s of silence + 60s hard timeout |
| **TTS Playback** | Read AI responses aloud via Web Speech API, speed adjustable |
| **Multilingual** | Whisper language hint (auto-detect or ISO 639-1) |

### Phase 6 — Vision AI & Auto Updater ✅ Complete
| Feature | Description |
|---------|-------------|
| **Screenshot Vision AI** (`Ctrl+Shift+S`) | Capture full screen → send to GPT-4o / Claude / Gemini Vision |
| **Multi-Provider Vision** | Auto-formats for OpenAI `image_url`, Anthropic `base64 source`, Google `inline_data` |
| **Screenshot Preview** | Thumbnail in ChatInput with "Vision" badge and X remove button |
| **Auto Updater** | GitHub Releases-based updater with Ed25519 signature verification (ASVS 10.3.1-3) |
| **Update Banner** | Non-intrusive top banner — progress bar + restart prompt |
| **Sidebar Date Grouping** | Conversations bucketed: Pinned / Today / Yesterday / This Week / Older |

### Phase 4 — Security Hardening & UX Completion
| Feature | Description |
|---------|-------------|
| **Agent Web Search** | AI Agent searches DuckDuckGo in real time (`search_web` tool) |
| **Agent URL Fetch** | AI Agent reads web page content (`read_url` tool, SSRF defense included) |
| **Prompt Version Restore** | Version history accordion UI — restore any previous version in one click |
| **Local LLM Model Picker** | Select Ollama/LM Studio models directly from dropdown, 30s TTL cache |
| **Privacy & Audit Dashboard** | PII detection stats by type + masking rate + immutable audit log viewer |
| **Multi-AI Compare (upgraded)** | Column accent colors, markdown export, API-key filtering, adopt feature |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust backend) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Database | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 256k iterations) |
| Full-Text Search | SQLite FTS5 (Knowledge Base RAG) |
| API Keys | Windows Credential Manager via OS keychain |
| State | Zustand |
| Streaming | Tauri ipc::Channel |
| AI Calls | Rust reqwest (no CORS, keys never reach frontend) |
| Voice STT | Whisper API (OpenAI) — webm/opus, 25 MB limit |
| TTS | Web Speech API (browser-native) |
| Screen Capture | `screenshots` crate (0.8) + `image` crate (0.24) |
| Auto Updater | tauri-plugin-updater v2 (Ed25519 signature verification) |
| i18n | react-i18next |

---

## Getting Started

### Prerequisites

- **Windows 10 21H2+** or **Windows 11**
- At least one AI API key (OpenAI, Anthropic, or Google)

### Install from Release

1. Download the latest `.msi` from [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)
2. Run the installer
3. AIFlow appears in your system tray
4. Press `Alt+Space` to open the overlay
5. Go to **Settings** and add your API key

### Build from Source

#### Requirements

- Rust toolchain (MSVC target): `rustup default stable`
- Visual Studio Build Tools (C++ workload)
- Strawberry Perl: `choco install strawberryperl -y` (required for SQLCipher)
- Node.js 20+: `choco install nodejs-lts -y`

#### Steps

```bash
# Clone the repository
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production (.msi installer)
npm run tauri:build
```

---

## How to Use Key Features

### Knowledge Base (RAG)

1. Click **지식베이스** (database icon) in the sidebar
2. Click **새 지식베이스** to create a knowledge base
3. Select files to index (`.txt`, `.md`, `.py`, `.ts`, `.rs`, `.json`, etc.)
4. Use the search box to query your documents — results highlight matching text
5. The AI Agent can automatically search your knowledge base during task execution

### AI Agent

1. Click **AI 에이전트** (beaker icon) in the sidebar
2. Type your goal in the input box (e.g., "Summarize all documents in my knowledge base")
3. The agent plans steps, then executes them one by one
4. Steps that require file write or workflow execution show an **approval gate** — review before proceeding
5. You can cancel the agent at any time

### Conversation Branching

1. In any conversation, hover over a message
2. Click the **Fork** button to branch from that point
3. A new conversation is created with all messages up to that point copied
4. Explore different AI responses without losing your original thread

### Workflow Export/Import

1. Open **워크플로우 빌더** and select a workflow
2. Click **내보내기** to download a `.json` file
3. On another machine, click **가져오기** and select the file
4. The workflow is recreated with all steps intact

---

## Environment Variables

AIFlow does **not** require a `.env` file. All secrets are stored in the OS keychain.

| Variable | Purpose | Where set |
|----------|---------|-----------|
| AI API Keys | Provider authentication | OS Keychain (Settings UI) |
| DB Master Key | Database encryption | OS Keychain (auto-generated on first run) |
| Device ID | License verification | OS Keychain (random UUID) |

---

## Project Structure

```
ai-flow/
├── .PRD/                     # Product Requirements Documents
├── src/                      # React frontend
│   ├── components/           # UI components (chat, overlay, prompts, palette)
│   │   └── chat/             # Chat-specific components
│   ├── stores/               # Zustand state management
│   ├── lib/                  # Utilities, IPC, schemas, providers
│   ├── views/                # Page-level views
│   │   ├── KnowledgeBaseView.tsx  # RAG document management + search
│   │   ├── AgentView.tsx          # AI Agent run management
│   │   ├── WorkflowBuilderView.tsx
│   │   ├── BatchQueueView.tsx
│   │   ├── CostReportView.tsx
│   │   └── SettingsView.tsx
│   └── types/                # TypeScript types
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── commands/         # Tauri IPC commands (thin adapters)
│   │   │   ├── knowledge_base.rs  # KB/RAG commands
│   │   │   └── agent.rs           # Agent + branching + export/import
│   │   ├── services/         # Business logic
│   │   │   ├── knowledge_base.rs  # FTS5 indexing + search
│   │   │   ├── agent.rs           # Multi-step agent execution engine
│   │   │   ├── workflow.rs        # Workflow + export/import
│   │   │   ├── mcp.rs             # MCP + path security
│   │   │   └── providers/         # AI provider implementations
│   │   ├── models/           # Serde data structs
│   │   └── db/               # SQLCipher + migrations runner
│   └── migrations/           # SQL migrations (001~018)
│       ├── 016_knowledge_base.sql  # Knowledge bases, documents, FTS5
│       ├── 017_agent_runs.sql      # Agent runs, steps, tools
│       └── 018_conversation_branches.sql  # Branching + workflow exports
├── README.md                 # This file (English)
├── README.ko.md              # Korean
├── README.ja.md              # Japanese
├── README.zh.md              # Chinese
├── .resume.md                # Work continuation guide
└── LICENSE                   # MIT License (SoDam AI Studio)
```

---

## Architecture

```
┌─ Main Window (React) ──────────────────────────────┐
│  Chat (streaming, multi-compare, branching)         │
│  KnowledgeBaseView (RAG, FTS5 search)               │
│  AgentView (multi-step execution, approval gate)    │
│  WorkflowBuilderView (pipelines, export/import)     │
│  CostReportView (budget, per-model breakdown)       │
│  Zustand + Zod + i18n                               │
└──────────────────────────┬──────────────────────────┘
                           │ Tauri IPC
┌──────────────────────────▼──────────────────────────┐
│  Rust Backend                                        │
│  commands/   → IPC entry points (validation only)   │
│  services/   → Business logic                        │
│    ├─ knowledge_base.rs  (FTS5 RAG)                  │
│    ├─ agent.rs           (re-entrant step engine)    │
│    ├─ workflow.rs        (pipeline + export/import)  │
│    ├─ routing.rs         (smart AI selection)        │
│    ├─ privacy.rs         (local PII scanner)         │
│    ├─ cost.rs + cost_report.rs                       │
│    └─ providers/         (OpenAI, Anthropic, Google) │
│  db/         → SQLCipher (AES-256) + backups         │
└───────────┬──────────────┬──────────────────────────┘
            │              │
    OS Keychain       SQLCipher DB          AI Provider APIs
    (API keys)        (encrypted)           (SSE streaming)
```

**4-Layer Architecture:**
1. `commands/` — IPC entry points (input validation only, no business logic)
2. `services/` — Pure business logic (Provider Trait abstraction)
3. `models/` — Serde structs (no logic)
4. `db/` — SQL execution only

---

## Security

| Area | Implementation |
|------|----------------|
| API Key Storage | OS Keychain only — never in code, files, or DB |
| API Key Validation | Live API call validation before saving |
| Database | SQLCipher AES-256 + PBKDF2-SHA512 (256,000 iterations) |
| DB Master Key | Auto-generated random 32-byte key, stored in OS Keychain |
| IPC Parameters | Zod validation on frontend + Rust type system on backend |
| Streaming | Tauri ipc::Channel (not EventSystem), with cancellation |
| CSP | `default-src 'self'` (no unsafe-eval) |
| Audit Log | Immutable INSERT-only — DB triggers block UPDATE/DELETE |
| Privacy Mode | 100% local PII scanner — data never leaves machine |
| SSRF Defense | Agent URL fetch blocks localhost/private IPs/metadata endpoints (CWE-918) |
| Redirect Recheck | Final URL re-validated after HTTP redirects (bypass prevention) |
| Control Char Strip | OWASP ASVS 5.2.3 — control chars removed from web search results |
| HTML Stripping | script/style/tags removed from URL content, 50KB cap |
| Template Injection | `{{input}}` values sanitized before AI substitution |
| FTS5 Injection | Search queries wrapped in double-quotes, special chars stripped |
| Path Security | `canonicalize()` on all MCP file paths (symlink traversal prevention) |
| Input Limits | All text inputs have max length validation (goal: 2KB, query: 500 chars) |
| File Access | Absolute path check + extension allowlist + 5MB size limit for KB |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **1a** | Core MVP (chat, cost, security, i18n) | ✅ Complete |
| **1b** | Hotkey, overlay, personas, prompts, tray, file drop | ✅ Complete |
| **2** | Multi-AI compare, smart routing, privacy, cost dashboard, budget, workflows | ✅ Complete |
| **3** | RAG knowledge base, AI agent, conversation branching, workflow export/import | ✅ Complete |
| **4** | Agent web search/URL fetch, prompt version restore, local LLM picker, audit dashboard | ✅ Complete |
| **5** | Voice STT (Whisper API) + TTS + global `Alt+Shift+V` shortcut | ✅ Complete |
| **6** | Screenshot Vision AI (`Ctrl+Shift+S`) + Auto Updater (Ed25519) + UI/UX improvements | ✅ Complete |
| **7** | Knowledge base UI polish, agent tool expansion, GitHub Actions CI/CD | Planned |

---

## For Non-Developers (Vibe Coding Guide)

> **You don't need to know how to code to use or modify AIFlow.**
> This guide is for anyone who wants to customize the app using only natural language.

### How to Change or Add Features (No Coding Required)

1. **Open this project** in [Cursor](https://cursor.sh), [Windsurf](https://codeium.com/windsurf), or any AI-enabled editor
2. **Describe what you want** in plain language:
   - *"Add a dark blue theme option to the settings"*
   - *"Make the AI response text larger"*
   - *"Add support for the Mistral AI provider"*
3. **The AI generates the code** — you review and press Accept
4. **Test it**: type `npm run tauri:dev` in the terminal — the app opens with your changes
5. **Done!** No programming knowledge needed.

### Golden Rule
> **Never put API keys directly in any code file.**
> Always enter them through the AIFlow Settings UI — they are stored safely in Windows Credential Manager.

### Common Requests in Plain Language

| What you want | What to say to the AI |
|---|---|
| Add a new AI provider | "Add support for [Provider Name] in `src-tauri/src/services/providers/`" |
| Change a UI color | "Change the sidebar color to navy blue using Tailwind classes" |
| Add a new language | "Add Spanish translations to `src/i18n/` following the existing Korean pattern" |
| Add a new knowledge base file type | "Allow `.docx` files in `src-tauri/src/services/knowledge_base.rs`" |
| Change the global hotkey | "Change the overlay hotkey from Alt+Space to Ctrl+Alt+A in `src-tauri/src/lib.rs`" |
| Fix a bug | Describe the bug: "When I search in the knowledge base, it crashes if the query has special characters" |

---

## Operational Notes

- **Database location**: `%APPDATA%\ai-flow\aiflow.db` (SQLCipher encrypted)
- **DB Backups**: Automatically saved to `%APPDATA%\ai-flow\backups\` before each migration (last 5 kept)
- **API keys**: Stored in Windows Credential Manager under the `aiflow` service name
- **Knowledge Base**: Indexed documents are stored as text chunks in the encrypted DB (original files not copied)
- **Agent runs**: Stored in DB — you can review all past runs in the Agent view
- **Logs**: Tauri dev console or `%APPDATA%\ai-flow\logs\`
- **Dev server port**: 1420 (configured in `package.json`)
- **SQLCipher build**: Requires Strawberry Perl on Windows for the C compiler

---

## Links

- [PRD Documents](.PRD/README.md) — Product requirements and design decisions
- [GitHub Issues](https://github.com/sodam-ai/ai-flow/issues)
- [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)

---

## License

[MIT License](LICENSE) — Copyright © 2026 SoDam AI Studio
