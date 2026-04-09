# AIFlow

**One hotkey to rule all AIs.** A local desktop AI hub that lets you chat with GPT, Claude, Gemini, and local LLMs from any app — with knowledge bases, multi-step agents, and workflow automation.

[한국어](README.md)

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

### Phase 7 — GitHub Actions CI/CD ✅ Complete
| Feature | Description |
|---------|-------------|
| **Release Workflow** | `v*.*.*` tag push → MSI build + Ed25519 signing + GitHub Release upload |
| **PR Check Gate** | TypeScript type-check + `cargo check` + `cargo clippy` on every PR and push |
| **Auto `latest.json`** | Auto Updater endpoint — version metadata attached to each GitHub Release |
| **Least-Privilege** | Release: `contents: write` only; PR check: `contents: read` only |
| **Rust Cache** | `swatinem/rust-cache` — dramatically reduces Windows CI build time |

### Phase 8 — Knowledge Base UI Security & UX Upgrade ✅ Complete
| Feature | Description |
|---------|-------------|
| **XSS Fix** | Removed `dangerouslySetInnerHTML` → `SnippetHighlight` component safely parses only FTS5 `<mark>` tags (ASVS 5.3.3) |
| **File Type Color Badges** | 11 extension types color-coded: `.md`, `.rs`, `.py`, `.ts`, `.tsx`, `.js`, `.json`, `.toml`, `.yaml`, `.csv` |
| **Inline Delete Confirm** | Removed `window.confirm()` → two-step inline confirmation button (WCAG 2.1 + security) |
| **Full Accessibility** | `role=dialog/list/menu/menuitem/alert`, `aria-expanded`, `aria-modal`, `aria-labelledby` applied throughout |
| **KB Context Bar Upgrade** | Chip bar above chat input — atomic `clearAll` callback, doc count badge, violet active state |
| **Click-Toggle Dropdown** | CSS `:hover` dropdown → click-toggle + `mousedown` outside-click handler (touch-safe, keyboard-accessible) |

### Phase 9 — Chat Full-Text Search (`Ctrl+F`) ✅ Complete
| Feature | Description |
|---------|-------------|
| **In-Conversation Search** | `Ctrl+F` → slide-down search bar, real-time filtering of current conversation messages |
| **Result Counter + Navigation** | "X / Y results" display, prev (▲·Shift+Enter) / next (▼·Enter) navigation, wraps around |
| **Auto-Scroll** | Smooth scroll to current focused result, violet ring-2 highlight on active match |
| **Search Excerpt** | Matched message shows 45-char context snippet with violet-highlighted match text |
| **Esc to Close** | Escape closes search bar with priority over other modal handlers (`capture:true`) |
| **Security** | Client-side filter (zero IPC calls), ASVS 5.1.1 (maxLength=500), ASVS 5.3.3 (XSS-safe), `CSS.escape()` defense |

### Phase 10 — Per-Conversation Active KB Persistence ✅ Complete
| Feature | Description |
|---------|-------------|
| **Session-Persistent KB Context** | KbContextBar chip state is now saved per conversation — survives app restart & conversation switching |
| **Migration 019** | `conversations.active_kb_ids TEXT DEFAULT '[]'` — JSON array, zero-friction for existing rows |
| **Atomic Replacement** | toggle/clearAll replaces the whole array in a single UPDATE — no partial-update inconsistency |
| **Race Condition Defense** | `activeKbConvIdRef` ref guards against stale writes during conversation switches |
| **Input Validation** | Rust: max 20, positive int, dedup, `rows_affected` check / TS: mirrored checks (defense in depth) |
| **Data Integrity** | `serde_json::to_string()` serialization — no string interpolation, eliminates SQL injection at the storage layer |

### Phase 21 — AgentView Full Accessibility ✅ Complete
| Feature | Description |
|---------|-------------|
| **Approval Gate Accessibility** | `role="alert"` — screen reader announces approval request the moment it appears (WCAG 4.1.3) |
| **Approve/Deny Buttons** | `focus-visible:ring-2`, `aria-label` with step title — full keyboard control of security flow |
| **Progress Bar** | `role="progressbar"`, `aria-valuenow/min/max`, `aria-label` (WCAG 4.1.2) |
| **Run History Sidebar** | `<nav aria-label>`, selected item `aria-current`, each button `aria-label` with goal + status |
| **All Buttons Complete** | Start/Cancel/Tools toggle/Error dismiss/Example chips/Expand toggle — focus rings + labels throughout |
| **Security** | Zero new IPC, no `innerHTML` |

### Phase 20 — PrivacyToggle + UpdateBanner + ModelSelector Accessibility ✅ Complete
| Feature | Description |
|---------|-------------|
| **PrivacyToggle** | `role="switch"` + `aria-checked` — announces toggle state to screen readers (WCAG 4.1.2) |
| | `aria-label` with state description, SVG `aria-hidden`, `focus-visible:ring-2 ring-blue-500/50` |
| **UpdateBanner** | Install/Restart/Dismiss buttons: `focus-visible:ring-2` + `aria-label` |
| **ModelSelector** | Trigger: `aria-label="AI 모델 선택"` + `focus-visible:ring-2` |
| | Cloud/Local option buttons: `focus-visible:ring-1 ring-inset`; rescan button: `focus-visible:ring-1` |

### Phase 19 — Chat Header + WelcomeView Full UX Upgrade ✅ Complete
| Feature | Description |
|---------|-------------|
| **Suggested Prompt Chips** | 4 clickable example prompt chips in WelcomeView — eliminates blank-slate anxiety |
| **Feature Card Semantics** | `role="list/listitem"`, emoji `aria-hidden`, removed misleading hover affordance on non-interactive cards |
| **Shortcut Semantics** | `<p>` list → `<dl>/<dt>/<dd>` structure (HTML5 definition list standard) |
| **CTA Button** | `focus-visible:ring-2 ring-violet-400 ring-offset-2`, SVG `aria-hidden` |
| **Compare Button** | `aria-label`, `focus-visible:ring-2`, SVG `aria-hidden` |
| **Branch Button** | `focus-visible:ring-2`, `aria-pressed={showBranchPanel}`, fixed toggle behavior |

### Phase 18 — KnowledgeBaseView + App.tsx Accessibility ✅ Complete
| Feature | Description |
|---------|-------------|
| **Hover-Only Delete Buttons Fixed** | `opacity-0 group-hover:opacity-100` → `group-focus-within:opacity-100` added (WCAG 2.1.1) + `focus-visible:ring-1` |
| **KB Search maxLength** | `maxLength={500}` (ASVS 5.1.1) |
| **Sidebar Nav Buttons** | All 9 view buttons get `aria-current="page"` when active (WCAG 4.1.2) |

### Phase 17 — SettingsView Security & Accessibility ✅ Complete
| Feature | Description |
|---------|-------------|
| **API Key Delete Inline Confirm** | Trash → `confirmDelete` state → red warning box — 2-step confirm before irreversible OS keychain deletion |
| **Delete Success Toast** | `addToast("success")` feedback (no more silent success) |
| **Persona Delete Inline Confirm** | `confirmDeletePersonaId` state + inline red confirm, `role="alert"` (WCAG 4.1.3) |
| **maxLength=200** | API key input length bounded (ASVS 5.1.1) |
| **aria-labels + focus rings** | All buttons: `aria-label` + `focus-visible:ring` throughout |
| **Shortcuts List Complete** | 6 → 10 shortcuts — Alt+Shift+V, Ctrl+F, Ctrl+Shift+S, ?/Ctrl+/ added |

### Phase 16 — ChatInput Completion (Image Paste + Char Count + Error Feedback) ✅ Complete
| Feature | Description |
|---------|-------------|
| **Image Paste** | Ctrl+V with image → auto-attached as Vision AI input (FileReader base64, image/* filter only) |
| **Character Counter** | Shows char count at bottom-right of textarea when ≥2,000 chars — normal/warn(2K+)/danger(6K+) colors |
| **Screenshot Error Toast** | Removes `console.warn` → `addToast("error", ...)` — user immediately notified (silent failure eliminated) |
| **Image Paste Feedback** | 2-second "이미지 첨부됨" badge with ImagePlus icon after paste |
| **ARIA Improvements** | `aria-label` on textarea, conditional `aria-describedby` for char counter, `aria-live="polite"` |
| **Security** | Zero new IPC, FileReader image/* filter, safe base64 extraction, client-side only |

### Phase 15 — PersonaSelector + PromptLibraryModal Accessibility & Security ✅ Complete
| Feature | Description |
|---------|-------------|
| **Instant Delete Removed (2 places)** | Trash buttons in PersonaSelector and PromptLibraryModal → inline red confirmation (X/Check) |
| **Keyboard Accessibility Fix (2 places)** | `group-hover:flex` → `group-focus-within:flex` added — keyboard users can reach all action buttons |
| **Full ARIA** | PersonaSelector: `role=listbox/option`, `aria-selected`, `aria-expanded`, `aria-haspopup` |
| | PromptLibraryModal: `role=dialog/list/listitem/group`, `aria-modal`, `aria-labelledby`, `aria-pressed` |
| **Pencil Icon Consistency** | PromptLibraryModal "Edit" text button → Pencil icon (matches ConversationItem) |
| **Sidebar Search Hardening** | `maxLength=200` (ASVS 5.1.1) + `aria-label="대화 목록 검색"` added |
| **Security** | Zero new IPC, all inputs bounded, no `innerHTML` |

### Phase 14 — Conversation Management Completion ✅ Complete
| Feature | Description |
|---------|-------------|
| **Inline Rename** | Double-click title or pencil button → inline input → Enter saves, Esc cancels |
| **Inline Delete Confirm** | Immediate delete replaced with red warning box + cancel/delete buttons |
| **Keyboard Accessibility Fix** | CSS `hover-only` buttons → `group-focus-within:flex` added so keyboard users can reach Pin/Rename/Delete |
| **role="alert"** | Delete confirmation box announces to screen readers on appearance (WCAG 4.1.3) |
| **Input Validation** | `maxLength=100` + trim + non-empty check (ASVS 5.1.1) |
| **Pencil Button** | Visible rename button on hover (NNGroup: Recognition over Recall) |
| **Security** | Zero new IPC, no `innerHTML`, bounded input length |

### Phase 13 — Prompt Version Diff View ✅ Complete
| Feature | Description |
|---------|-------------|
| **Version Diff Modal** | Line-by-line comparison between a saved version and the current editor content — removed lines in red (-), added lines in green (+) |
| **Pure TS LCS Algorithm** | Zero external diff libraries — Myers-style LCS in pure TypeScript (zero supply chain risk) |
| **+N / -N Stats** | Added/removed line counts shown in the modal header at a glance |
| **Restore from Diff** | "Restore v{N}" button directly inside the diff modal |
| **Inline Confirm** | `window.confirm()` replaced by inline amber confirmation box (WCAG compliant) |
| **Toast Feedback** | `alert()` replaced by toastStore success/error notifications |
| **Full Accessibility** | `role=dialog`, `aria-modal`, `aria-labelledby`, focus-on-open, Escape close, backdrop dismiss |
| **Security** | Zero new IPC calls, no `innerHTML`, all text rendered as React nodes — zero XSS surface |

### Phase 12 — Keyboard Shortcuts Help Modal (`?` / `Ctrl+/`) ✅ Complete
| Feature | Description |
|---------|-------------|
| **`?` Shortcut** | Press `?` outside inputs → instantly opens full shortcut modal (GitHub/Gmail standard) |
| **`Ctrl+/` Shortcut** | Works everywhere, including in input fields (VS Code standard) |
| **Categorized Groups** | Global / Chat / Search Bar / Help — 4 groups, 13+ shortcuts organized |
| **Full Accessibility** | `role=dialog`, `aria-modal`, `aria-labelledby`, focus-on-open, backdrop dismiss, Escape close (WCAG 2.1 AA) |
| **Command Palette Integration** | Ctrl+K → search "Keyboard Shortcuts" → Enter to open |
| **Chat Header `?` Button** | Discoverable hint button at the right of the chat header (NNGroup: Recognition over Recall) |
| **Security** | Static constants only, zero IPC, zero XSS surface |

### Phase 11 — Copy / Export UX Completion ✅ Complete
| Feature | Description |
|---------|-------------|
| **Copy Button Visual Feedback** | Icon swaps Copy → Check (emerald) for 1.5s on click + toast "Copied to clipboard" |
| **Copy Error Handling** | Clipboard permission denial surfaces via error toast (no silent failure) |
| **Timer Cleanup** | `useRef` + `useEffect` cleanup prevents memory leaks on component unmount |
| **aria-live Announce** | Screen readers hear copy completion in real-time (WCAG 4.1.3) |
| **Export Menu Accessibility** | CSS `:hover` → click-toggle + `mousedown` outside-click + Escape key dismissal |
| **Full ARIA** | `role=menu/menuitem`, `aria-haspopup`, `aria-expanded`, `aria-label` applied throughout |
| **Rich Menu Items** | Each option has icon + title + description with color coding (sky / amber) |
| **Lucide Icon Consistency** | Download, FileText, FileCode, ChevronDown replace all inline SVGs |
| **Export Success Feedback** | Toast confirms file was exported successfully |

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

1. Click the **Knowledge Base** icon (database icon) in the sidebar
2. Click **New Knowledge Base** to create one, then open it
3. Drop or select files to index (`.txt`, `.md`, `.py`, `.ts`, `.rs`, `.json`, `.toml`, `.yaml`, `.csv`, etc.)
4. Use the search box to query documents — results show color-coded file type badges and highlighted matching text
5. To delete a document, click the trash icon and confirm inline (no popup dialogs)
6. **Smart Context Injection**: Above the chat input, click any KB chip to activate it — every AI message will automatically include matching KB context from that knowledge base
7. The AI Agent can also automatically search your knowledge bases during task execution

### Chat Search (`Ctrl+F`) — Phase 9

1. While in any conversation, press `Ctrl+F` — a search bar slides down below the chat header
2. Type your search term → messages matching the query are filtered in real time
3. Matching messages show a violet border + excerpt snippet (context + highlighted match text)
4. `Enter` (or ▼ button) → next result, `Shift+Enter` (or ▲ button) → previous result
5. Counter shows "X / Y results" at all times
6. `Esc` or X button to close and clear the search

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
├── .github/
│   └── workflows/
│       ├── release.yml       # v*.*.* tag push → MSI build + Ed25519 signing + GitHub Release
│       └── check.yml         # PR/push gate: TypeScript tsc + cargo check + cargo clippy
├── src/                      # React frontend
│   ├── components/           # UI components (chat, overlay, prompts, palette)
│   │   └── chat/             # Chat-specific components
│   │       ├── ChatSearchBar.tsx   # Ctrl+F in-conversation search bar (Phase 9)
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
│       ├── 018_conversation_branches.sql  # Branching + workflow exports
│       └── 019_conversation_kb.sql  # Per-conversation active KB IDs (Phase 10)
├── README.en.md              # This file (English)
├── README.md                 # Korean (default)
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
| Voice Security | Audio bytes never written to disk (memory-only base64 over IPC), 25 MB / 60s hard limits |
| Vision Security | Screenshot 10 MB cap, bytes never written to disk (memory base64 only) |
| Update Signing | Ed25519 asymmetric key — only public key bundled in app, `minVersion` downgrade prevention |
| XSS Defense (KB) | No `dangerouslySetInnerHTML` for FTS5 `snippet()` output — only `<mark>` tags parsed safely in React (ASVS 5.3.3) |
| Delete Confirm UI | `window.confirm()` removed — inline two-step confirmation (focus flow protection, WCAG 2.1) |

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
| **7** | GitHub Actions CI/CD — release workflow + PR check gate (TypeScript + Rust) | ✅ Complete |
| **8** | Knowledge Base UI full upgrade — XSS fix (ASVS 5.3.3), file type badges, full accessibility | ✅ Complete |
| **9** | Chat full-text search (`Ctrl+F`) — in-conversation real-time search, highlight, auto-scroll | ✅ Complete |
| **10** | Per-conversation active KB persistence — restore KB context across restart/switch (migration 019) | ✅ Complete |
| **11** | Copy / Export UX completion — visual feedback, accessible menu, Lucide icon consistency | ✅ Complete |
| **12** | Keyboard shortcuts help modal (`?` / `Ctrl+/`) — categorized shortcut catalog, command palette integration | ✅ Complete |
| **13** | Prompt version diff view — line-level LCS diff, inline confirm, toast feedback, WCAG accessibility | ✅ Complete |
| **14** | Conversation management — inline rename (double-click/Pencil), inline confirm delete, keyboard accessibility fix | ✅ Complete |
| **15** | PersonaSelector + PromptLibraryModal — inline confirm delete, full ARIA, focus-within keyboard a11y | ✅ Complete |
| **16** | ChatInput completion — image paste (Vision AI), char counter, screenshot error toast | ✅ Complete |
| **17** | Agent tool expansion (file write, shell exec — approval gate required), local Whisper STT | Planned |

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
