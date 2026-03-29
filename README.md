# AIFlow

**One hotkey to rule all AIs.** A local desktop AI hub that lets you chat with GPT, Claude, Gemini, and local LLMs from any app using a single shortcut.

[Korean](README.ko.md) | [Japanese](README.ja.md) | [Chinese](README.zh.md)

---

## What is AIFlow?

AIFlow is a **Windows desktop application** that brings all your AI providers into one place. Press `Alt+Space` from any app to summon AIFlow, ask your question, and get a streaming response with real-time cost tracking.

**No cloud account. No data collection. Everything stays on your machine.**

## Key Features

| Feature | Description |
|---------|-------------|
| **Global Hotkey** (`Alt+Space`) | Summon AIFlow from any app (Word, Chrome, games, anything) |
| **Multi-Provider** | GPT-4o, Claude Sonnet, Gemini Flash + 8 more providers |
| **Real-Time Cost** | Token count + USD + KRW cost displayed per message |
| **OS Keychain Security** | API keys stored in Windows Credential Manager (never in files) |
| **Encrypted Database** | SQLCipher AES-256 encryption for all conversations |
| **AI Personas** | 6 built-in roles (Developer, Writer, Translator, Analyst, Legal, Summarizer) |
| **Prompt Library** | Save, tag, search prompts with `{{variable}}` slots |
| **Command Palette** (`Ctrl+K`) | Natural language access to all app features |
| **File Drag & Drop** | Drop PDF, TXT, MD, code, or images directly into AI chat |
| **Auto Updater** | Ed25519 signed updates with downgrade protection |
| **Dark Mode** | Dark theme by default, clean minimal UI |
| **i18n** | Korean + English (more languages planned) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust backend) |
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| Database | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 250k iterations) |
| API Keys | Windows Credential Manager via OS keychain |
| State | Zustand |
| Streaming | Tauri ipc::Channel |
| AI Calls | Rust reqwest (no CORS, keys never reach frontend) |
| i18n | react-i18next |

## Getting Started

### Prerequisites

- **Windows 10 21H2+** or **Windows 11**
- At least one AI API key (OpenAI, Anthropic, or Google)

### Install from Release

1. Download the latest `.msi` from [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)
2. Run the installer
3. AIFlow appears in your system tray
4. Press `Alt+Space` to open the overlay
5. Go to Settings and add your API key

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
npm run dev

# Build for production (.msi)
npm run build
```

## Environment Variables

AIFlow does **not** require a `.env` file. All secrets are stored in the OS keychain.

| Variable | Purpose | Where |
|----------|---------|-------|
| AI API Keys | Provider authentication | OS Keychain (Settings UI) |
| DB Master Key | Database encryption | OS Keychain (auto-generated) |
| Device ID | License verification | OS Keychain (random UUID) |

## Project Structure

```
ai-flow/
├── .PRD/                  # Product Requirements Documents (17 files)
├── src/                   # React frontend
│   ├── components/        # UI components (shadcn/ui)
│   ├── stores/            # Zustand state management
│   ├── lib/               # Utilities, IPC, schemas
│   ├── views/             # Page-level components
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/      # Tauri IPC commands (thin adapters)
│   │   ├── services/      # Business logic (Provider Trait, chat, cost)
│   │   ├── models/        # Data structures (serde)
│   │   └── db/            # SQLCipher connection pool + migrations
│   └── migrations/        # SQL migration files
├── README.md              # This file (English)
├── README.ko.md           # Korean
├── README.ja.md           # Japanese
├── README.zh.md           # Chinese
└── LICENSE                # MIT License (SoDam AI Studio)
```

## Architecture

```
┌─ React WebView ──────────┐    ┌─ Rust Backend ──────────────┐
│  UI + Zod validation      │◄──►│  commands/ (IPC adapters)   │
│  Zustand state            │    │  services/ (business logic) │
│  react-i18next            │    │  models/  (data structs)    │
└──────────────────────────┘    │  db/     (SQLCipher pool)   │
                                └──────────────┬──────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                    OS Keychain          SQLCipher DB         AI Provider APIs
                    (API keys)           (encrypted)          (HTTPS TLS 1.3)
```

**4-Layer Architecture** (mandatory):
1. `commands/` — IPC entry points (input validation only, no business logic)
2. `services/` — Pure business logic (Provider Trait abstraction)
3. `models/` — Serde structs (no logic)
4. `db/` — SQL execution only (no business logic)

## Security

- API keys: OS Keychain only (never in code, files, or database)
- Database: SQLCipher AES-256 + PBKDF2-SHA512 (250,000 iterations)
- IPC: All parameters validated with Zod schemas
- Streaming: Tauri ipc::Channel (not EventSystem)
- CSP: `default-src 'self'` (no unsafe-eval)
- Audit: Immutable INSERT-only audit log
- Updates: Ed25519 signature verification

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **1a** | Core MVP (chat, cost, security, i18n) | In Progress |
| **1b** | Hotkey, personas, prompts, updater | Planned |
| **2** | Multi-AI, smart routing, privacy mode, Pro tier | Planned |
| **3** | RAG, voice, agents, plugin API | Planned |

## License

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio

## Links

- [PRD Documents](.PRD/README.md) (17 documents, 40 design decisions)
- [GitHub Issues](https://github.com/sodam-ai/ai-flow/issues)
