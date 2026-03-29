# AIFlow

A local desktop AI chat application for Windows. Connect to multiple AI providers, manage conversations, and build custom AI personas — all with your API keys stored securely in the Windows Credential Manager, never in any database.

**Version:** 0.1.0 | **License:** SoDam AI Studio | **Platform:** Windows 10/11

---

## Table of Contents

1. [Features](#features)
2. [Screenshots](#screenshots)
3. [Requirements](#requirements)
4. [Non-Developer Quick Start](#non-developer-quick-start)
5. [Developer Setup](#developer-setup)
6. [Environment Variables](#environment-variables)
7. [Adding API Keys](#adding-api-keys)
8. [Using Ollama (Free, No API Key)](#using-ollama-free-no-api-key)
9. [Folder Structure](#folder-structure)
10. [Development Commands](#development-commands)
11. [Security](#security)
12. [Contributing](#contributing)
13. [License](#license)

---

## Features

### AI Providers
- **OpenAI** — GPT-4.1, o3, o4-mini
- **Anthropic** — Claude 4.6 (Sonnet, Haiku, Opus)
- **Google Gemini** — 2.5 Pro
- **Ollama** — Run any local model offline, no API key required
- **Mistral** — Mistral Large, Codestral, and more
- **Groq** — Ultra-fast inference
- **DeepSeek** — DeepSeek-V3, DeepSeek-R1
- **Cohere** — Command R+
- **xAI** — Grok
- **Azure OpenAI** — Enterprise-grade OpenAI via Azure
- **OpenAI-Compatible** — Any OpenAI-spec endpoint (LM Studio, vLLM, etc.)

### Chat
- Real-time streaming responses
- Live cost display in USD and KRW per message and per session
- Pin, rename, and delete conversations
- Conversation history stored locally in SQLite

### Persona System
- Create custom AI personalities with a name, avatar, and system prompt
- Assign a default model to each persona
- Switch personas per conversation

### Prompt Library
- Save reusable prompt templates
- Use `{{variable}}` slots for fill-in-the-blank prompts
- Organize templates by category

### Productivity
- **Alt+Shift+A** global shortcut: captures clipboard content and opens AIFlow ready to send
- Dark mode
- Offline support via Ollama local models
- System tray icon for quick access

### Security
- API keys stored **only** in Windows Credential Manager (OS keychain)
- Keys are never written to the SQLite database or any log file
- HTTPS-only for all external API requests
- SSRF protection on all outbound connections
- Parameterized SQL to prevent injection attacks

---

## Screenshots

> Screenshots will be added after the first public release.

| Main Chat | Persona Settings | Prompt Library |
|-----------|-----------------|----------------|
| *(coming soon)* | *(coming soon)* | *(coming soon)* |

---

## Requirements

### For Running the Pre-built Installer

- Windows 10 version 1903 or later (64-bit)
- Internet connection (for cloud AI providers)
- An API key from at least one supported provider — or [Ollama](#using-ollama-free-no-api-key) for free local use

### For Building from Source

| Tool | Minimum Version | Download |
|------|----------------|---------|
| Node.js | 20.x LTS | https://nodejs.org |
| Rust | 1.77+ | https://rustup.rs |
| Windows Build Tools | — | Included with Visual Studio Build Tools |

---

## Non-Developer Quick Start

> This section is written for people who have never run code before. If you are a developer, skip to [Developer Setup](#developer-setup).

### Step 1 — Download AIFlow

1. Go to the [Releases page](../../releases) of this repository.
2. Download the file named `AIFlow_0.1.0_x64-setup.exe`.
3. Double-click the downloaded file and follow the installer prompts.
4. AIFlow will appear in your Start menu and on your Desktop.

### Step 2 — Open AIFlow

1. Double-click the AIFlow icon on your Desktop (or search for "AIFlow" in the Start menu).
2. The application window will open.

### Step 3 — Add an API Key

To chat with an AI, you need an API key from one of the providers. Think of an API key as a password that lets AIFlow talk to that AI service on your behalf.

**To get a free or paid API key:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/account/keys
- Google Gemini: https://aistudio.google.com/app/apikey
- Groq (free tier available): https://console.groq.com/keys

**To add a key in AIFlow:**
1. Click the **Settings** icon (gear icon, bottom-left of the window).
2. Select the provider you want (e.g., "OpenAI").
3. Paste your API key into the field.
4. Click **Save**.

Your key is stored in the Windows Credential Manager — the same place Windows stores Wi-Fi passwords. It never leaves your computer in plain text.

### Step 4 — Start Chatting

1. Click **New Conversation** in the left sidebar.
2. Select a model from the dropdown (e.g., "gpt-4.1").
3. Type your message and press **Enter** or click **Send**.

That is all. AIFlow works like a chat application — just type and the AI responds.

### Step 5 — Use the Quick Shortcut (Optional)

If you copy something (text, code, an error message) and want to quickly send it to AIFlow:

1. Copy any text with **Ctrl+C** as normal.
2. Press **Alt+Shift+A**.
3. AIFlow opens with your clipboard text ready to send.

---

## Developer Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-flow
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Install Rust (if not already installed)

```bash
# Windows (PowerShell)
winget install Rustlang.Rustup
# Or visit https://rustup.rs and follow the installer
```

After installing Rust, restart your terminal and verify:

```bash
rustc --version   # should show 1.77 or later
cargo --version
```

### 4. Copy the environment file

```bash
cp .env.example .env
```

Edit `.env` if you need to override any defaults (see [Environment Variables](#environment-variables)).

### 5. Run in development mode

```bash
npm run dev
```

This starts both the Vite dev server (port 1420) and the Tauri window. Hot reload is active for the React frontend; Rust changes require a Cargo recompile.

---

## Environment Variables

Copy `.env.example` to `.env` before running the application. Never commit real keys to version control.

```
# .env.example

# Tauri development port (default: 1420)
VITE_DEV_PORT=1420

# Set to 1 to run the UI without a real Tauri backend (browser-only mock)
TAURI_MOCK=

# Enable keychain tests in E2E suite
KEYCHAIN_TEST=
```

All AI provider API keys are managed at runtime through the Settings UI and stored in the OS keychain. They are **not** environment variables and should never be placed in `.env`.

---

## Adding API Keys

API keys are added through the Settings panel inside AIFlow, not through environment variables or config files.

1. Open AIFlow.
2. Click the **Settings** icon in the bottom-left corner.
3. In the **Providers** section, find the provider you want to configure.
4. Click on the provider name to expand its settings.
5. Paste your API key into the **API Key** field.
6. Click **Save**.

AIFlow immediately stores the key in **Windows Credential Manager** (`Control Panel > Credential Manager > Windows Credentials`). You can verify this or delete keys there at any time.

To remove a key from AIFlow: open Settings, select the provider, and click **Remove Key**.

---

## Using Ollama (Free, No API Key)

Ollama lets you run large language models locally on your own computer. No API key, no internet connection, no usage fees.

### Install Ollama

1. Download Ollama from https://ollama.com/download/windows
2. Run the installer.
3. Ollama runs as a background service on `http://localhost:11434`.

### Download a Model

Open a terminal (Command Prompt or PowerShell) and run:

```bash
# Small, fast model (~4 GB RAM required)
ollama pull llama3.2

# Larger, more capable model (~8 GB RAM required)
ollama pull llama3.1:8b

# Code-focused model
ollama pull codellama
```

### Connect Ollama in AIFlow

1. Open AIFlow Settings.
2. Select **Ollama** from the provider list.
3. The base URL defaults to `http://localhost:11434` — leave it as-is unless you changed Ollama's port.
4. Click **Save**.
5. In any conversation, select a model from the Ollama section of the model dropdown.

Ollama models run entirely on your machine. No data is sent to external servers.

---

## Folder Structure

```
ai-flow/
├── src/                        # React frontend (TypeScript)
│   ├── App.tsx                 # Root application component
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles (Tailwind v4)
│   ├── components/             # Reusable UI components
│   │   ├── chat/               # Chat bubble, message list, input bar
│   │   ├── palette/            # Command palette
│   │   ├── persona/            # Persona selector and editor
│   │   ├── prompt/             # Prompt template picker
│   │   ├── sidebar/            # Conversation list sidebar
│   │   └── ui/                 # Generic design system components
│   ├── views/                  # Full-page views
│   │   ├── OverlayApp.tsx      # Alt+Shift+A clipboard overlay
│   │   └── SettingsView.tsx    # Settings panel
│   ├── stores/                 # Zustand global state
│   │   ├── chatStore.ts        # Active conversation and messages
│   │   ├── personaStore.ts     # Persona list and selection
│   │   ├── promptStore.ts      # Prompt library templates
│   │   └── settingsStore.ts    # Provider config, theme, preferences
│   ├── lib/                    # Utility functions and helpers
│   └── types/                  # Shared TypeScript type definitions
│
├── src-tauri/                  # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── main.rs             # Tauri application entry point
│   │   ├── lib.rs              # Plugin registration and setup
│   │   ├── commands/           # Tauri IPC commands (called from frontend)
│   │   ├── db/                 # SQLite connection and query helpers
│   │   ├── keychain/           # OS Credential Manager integration
│   │   ├── models/             # Rust data models / DTOs
│   │   ├── services/           # AI provider HTTP clients
│   │   ├── shortcut.rs         # Global keyboard shortcut handler
│   │   └── tray.rs             # System tray icon and menu
│   ├── migrations/             # SQLite schema migrations (ordered)
│   │   ├── 20260327000001_core.sql
│   │   ├── 20260327000002_chat.sql
│   │   ├── 20260327000003_attachments.sql
│   │   ├── 20260327000004_prompts.sql
│   │   ├── 20260327000005_personas.sql
│   │   └── 20260327000006_privacy.sql
│   ├── capabilities/           # Tauri permission manifests
│   ├── icons/                  # Application icons (.ico, .png)
│   ├── Cargo.toml              # Rust dependencies
│   ├── build.rs                # Build script
│   └── tauri.conf.json         # Tauri application configuration
│
├── tests/                      # Test suites
│   └── contract/               # Contract tests (frontend ↔ backend IPC)
│
├── index.html                  # HTML shell
├── vite.config.ts              # Vite bundler configuration
├── vitest.config.ts            # Vitest unit test configuration
├── tsconfig.json               # TypeScript compiler config
├── package.json                # Node.js project manifest
└── .env.example                # Environment variable template
```

---

## Development Commands

### Frontend (Node.js / Vite)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the full Tauri app in development mode |
| `npm run dev:ts` | Start only the Vite dev server (no Tauri window) |
| `npm run dev:mock` | Start Vite with mock Tauri backend (browser testing) |
| `npm run build` | Build the production `.msi` installer |
| `npm run preview` | Preview the production Vite build |
| `npm run lint` | Run ESLint on all source files |
| `npm run typecheck` | Type-check without emitting output |

### Testing

| Command | Description |
|---------|-------------|
| `npm run test:unit:ts` | Run TypeScript unit tests with Vitest |
| `npm run test:unit:rust` | Run Rust unit tests with Cargo |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:contract` | Run IPC contract tests |
| `npm run test:security` | Run `cargo audit` + `npm audit` |
| `npm run test:types` | TypeScript type check |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Generate coverage reports (TS + Rust) |
| `npm run test:all` | Run the full test suite in sequence |

### Rust / Cargo (run from `src-tauri/`)

```bash
# Run Rust unit tests
cargo test

# Check for known security vulnerabilities in dependencies
cargo audit

# Generate test coverage report (requires cargo-tarpaulin)
cargo tarpaulin
```

---

## Security

AIFlow is designed with a security-first approach for handling sensitive credentials.

### API Key Storage

- API keys are stored **exclusively** in the Windows Credential Manager via the OS keychain API.
- Keys are **never** written to the SQLite database, log files, configuration files, or environment variables.
- Keys are **never** transmitted to any server other than the designated AI provider endpoint.
- You can inspect, edit, or delete stored keys directly in `Control Panel > Credential Manager > Windows Credentials` at any time.

### Network

- All external API requests use HTTPS only. Plain HTTP connections to AI providers are blocked.
- Outbound requests are validated against an allowlist to prevent Server-Side Request Forgery (SSRF) attacks.
- No telemetry, analytics, or usage data is collected or transmitted by AIFlow.

### Database

- All SQL queries use parameterized statements. Raw string interpolation into SQL is not used anywhere in the codebase.
- The SQLite database stores conversation history and preferences only — no secrets.

### Dependency Auditing

Run `npm run test:security` at any time to check both the Rust and Node.js dependency trees for known CVEs.

---

## Contributing

Contributions are welcome. Please follow these steps:

1. **Fork** the repository and create a new branch from `main`.

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes.** Keep commits focused and atomic.

3. **Run the test suite** before opening a pull request.

   ```bash
   npm run test:all
   ```

4. **Run the linter and type checker.**

   ```bash
   npm run lint
   npm run typecheck
   ```

5. **Open a Pull Request** against `main`. Describe what you changed and why.

### Code Style

- TypeScript: follow the existing ESLint configuration (`eslint.config.js`).
- Rust: run `cargo fmt` and `cargo clippy` before committing.
- Commit messages: use the imperative mood (`Add feature X`, `Fix bug in Y`).

### Reporting Bugs

Please open a GitHub Issue and include:
- Your Windows version
- AIFlow version
- Steps to reproduce the issue
- Expected vs. actual behavior
- Any error messages shown in the app

### Security Vulnerabilities

Do **not** open a public issue for security vulnerabilities. Please contact the maintainers directly via the email listed in the repository.

---

## License

Copyright (c) 2026 SoDam AI Studio. All rights reserved.

This software is proprietary and owned by SoDam AI Studio. No part of this software may be copied, modified, distributed, or used in any product without explicit written permission from SoDam AI Studio.

For licensing inquiries, please contact SoDam AI Studio.
