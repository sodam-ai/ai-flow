# AIFlow

一款适用于 Windows 的本地桌面 AI 聊天应用。连接多个 AI 提供商、管理对话、构建自定义 AI 人格 —— 所有 API 密钥均安全存储于 Windows 凭据管理器中，绝不写入任何数据库。

**版本：** 0.1.0 | **许可证：** SoDam AI Studio | **平台：** Windows 10/11

---

## 目录

1. [功能特性](#功能特性)
2. [应用截图](#应用截图)
3. [系统要求](#系统要求)
4. [非开发者快速入门](#非开发者快速入门)
5. [新手完全指南](#新手完全指南)
6. [开发者环境搭建](#开发者环境搭建)
7. [环境变量](#环境变量)
8. [添加 API 密钥](#添加-api-密钥)
9. [使用 Ollama（免费、无需 API 密钥）](#使用-ollama免费无需-api-密钥)
10. [目录结构](#目录结构)
11. [开发命令](#开发命令)
12. [安全说明](#安全说明)
13. [贡献指南](#贡献指南)
14. [许可证](#许可证)

---

## 功能特性

### 支持的 AI 提供商

- **OpenAI** — GPT-4.1、o3、o4-mini
- **Anthropic** — Claude 4.6（Sonnet、Haiku、Opus）
- **Google Gemini** — 2.5 Pro
- **Ollama** — 在本地离线运行任意模型，无需 API 密钥
- **Mistral** — Mistral Large、Codestral 等
- **Groq** — 超高速推理
- **DeepSeek** — DeepSeek-V3、DeepSeek-R1
- **Cohere** — Command R+
- **xAI** — Grok
- **Azure OpenAI** — 通过 Azure 使用企业级 OpenAI
- **OpenAI 兼容端点** — 任何符合 OpenAI 规范的接口（LM Studio、vLLM 等）

### 聊天功能

- 实时流式响应
- 每条消息及每次会话的费用实时显示（美元 USD + 人民币 CNY + 韩元 KRW）
- 对话置顶、重命名与删除
- 对话历史本地存储于 SQLite 数据库

### 角色系统

- 创建自定义 AI 人格，包含名称、头像和系统提示词
- 为每个角色指定默认模型
- 在每次对话中自由切换角色

### 提示词库

- 保存可复用的提示词模板
- 使用 `{{变量}}` 槽位实现填空式提示词
- 按类别整理模板

### 生产力工具

- **Alt+Shift+A** 全局快捷键：捕获剪贴板内容并打开 AIFlow，立即准备发送
- 深色模式
- 通过 Ollama 本地模型支持离线使用
- 系统托盘图标，快速访问

### 安全特性

- API 密钥**仅**存储于 Windows 凭据管理器（OS 密钥链）中
- 密钥绝不写入 SQLite 数据库或任何日志文件
- 所有外部 API 请求仅使用 HTTPS
- 对所有出站连接实施 SSRF 防护
- 使用参数化 SQL，防止注入攻击

---

## 应用截图

> 截图将在首次公开发布后添加。

| 主聊天界面 | 角色设置 | 提示词库 |
|-----------|---------|---------|
| *(即将推出)* | *(即将推出)* | *(即将推出)* |

---

## 系统要求

### 运行预构建安装包

- Windows 10 版本 1903 或更高版本（64 位）
- 网络连接（用于云端 AI 提供商）
- 至少一个支持的提供商的 API 密钥 — 或使用 [Ollama](#使用-ollama免费无需-api-密钥) 进行免费本地使用

### 从源码构建

| 工具 | 最低版本 | 下载地址 |
|------|---------|---------|
| Node.js | 20.x LTS | https://nodejs.org |
| Rust | 1.77+ | https://rustup.rs |
| Windows Build Tools | — | 包含在 Visual Studio Build Tools 中 |

---

## 非开发者快速入门

> 本节专为从未运行过代码的用户编写。如果您是开发者，请跳至[开发者环境搭建](#开发者环境搭建)。

### 第一步 — 下载 AIFlow

1. 前往本仓库的 [Releases 页面](../../releases)。
2. 下载名为 `AIFlow_0.1.0_x64-setup.exe` 的文件。
3. 双击下载好的文件，按照安装向导提示操作。
4. AIFlow 将出现在您的开始菜单和桌面上。

### 第二步 — 打开 AIFlow

1. 双击桌面上的 AIFlow 图标（或在开始菜单中搜索"AIFlow"）。
2. 应用程序窗口将打开。

### 第三步 — 添加 API 密钥

要与 AI 进行对话，您需要从某个提供商处获取 API 密钥。可以把 API 密钥理解为一个密码，它允许 AIFlow 代表您与该 AI 服务进行通信。

**获取免费或付费 API 密钥的途径：**
- OpenAI：https://platform.openai.com/api-keys
- Anthropic：https://console.anthropic.com/account/keys
- Google Gemini：https://aistudio.google.com/app/apikey
- Groq（提供免费层级）：https://console.groq.com/keys

**在 AIFlow 中添加密钥：**
1. 点击**设置**图标（齿轮图标，位于窗口左下角）。
2. 选择您想要使用的提供商（例如"OpenAI"）。
3. 将您的 API 密钥粘贴到输入框中。
4. 点击**保存**。

您的密钥将存储在 Windows 凭据管理器中 —— 与 Windows 存储 Wi-Fi 密码的位置相同。密钥绝不会以明文形式离开您的电脑。

### 第四步 — 开始聊天

1. 点击左侧边栏中的**新建对话**。
2. 从下拉菜单中选择一个模型（例如"gpt-4.1"）。
3. 输入您的消息，按 **Enter** 或点击**发送**。

就是这样。AIFlow 的使用方式就像聊天应用一样 —— 只需输入，AI 就会回复。

### 第五步 — 使用快捷键（可选）

如果您复制了某些内容（文字、代码、错误信息），想快速发送给 AIFlow：

1. 像往常一样用 **Ctrl+C** 复制任意文字。
2. 按 **Alt+Shift+A**。
3. AIFlow 将打开，并自动填入您剪贴板中的内容，随时准备发送。

---

## 新手完全指南

> 本节专为完全没有技术背景的新手编写。即使您从未安装过软件以外的东西，也能看懂这里的每一步。

### 什么是 AIFlow？

AIFlow 是一款安装在您电脑上的聊天程序，它可以连接到各种 AI 服务（比如 ChatGPT、Claude、Gemini 等），让您在一个地方与所有 AI 对话。与直接使用网页版不同，AIFlow 运行在您的本地电脑上，数据更安全。

### 什么是 API 密钥？

API 密钥是一串字符（通常是几十个英文字母和数字的组合），就像一把"钥匙"，让您的程序能够使用某个 AI 服务。每个 AI 服务商都会提供自己的 API 密钥。

**注意：** API 密钥通常是**付费的**，但很多服务商（如 Groq、Google Gemini）提供免费额度，足够个人日常使用。

### 如何获取 API 密钥（以 Groq 为例，完全免费）

Groq 提供免费 API 密钥，速度极快，非常适合新手入门：

1. 打开浏览器，访问 https://console.groq.com/keys
2. 点击**Sign Up（注册）**，用您的邮箱创建账号
3. 注册完成后，点击**Create API Key（创建 API 密钥）**
4. 给密钥起一个名字（随便起，比如"我的AIFlow"），点击**Submit**
5. 页面上会显示一串以 `gsk_` 开头的字符 —— 这就是您的 API 密钥
6. 点击复制按钮将其复制到剪贴板（**这串字符只显示一次，请妥善保存！**）

### 如何在 AIFlow 中输入 API 密钥

1. 打开 AIFlow
2. 点击窗口**左下角**的齿轮图标（设置）
3. 在提供商列表中找到 **Groq**，点击它
4. 在 **API Key** 输入框中粘贴刚才复制的密钥（Ctrl+V）
5. 点击**保存**
6. 现在您可以在新建对话时选择 Groq 的模型开始聊天了！

### 如何完全免费使用（Ollama 本地 AI）

如果您不想注册任何账号或付费，可以使用 Ollama 在本地运行 AI 模型，完全离线，完全免费：

1. 访问 https://ollama.com/download/windows 下载并安装 Ollama
2. 打开"命令提示符"（按 Win+R，输入 cmd，按回车）
3. 输入以下命令下载一个 AI 模型：
   ```
   ollama pull llama3.2
   ```
4. 等待下载完成（约 2-4 GB，需要一些时间）
5. 打开 AIFlow，在设置中选择 **Ollama**，保存默认配置
6. 新建对话，在模型下拉菜单中选择 Ollama 下的模型即可

详细的 Ollama 使用说明请参见[使用 Ollama](#使用-ollama免费无需-api-密钥)章节。

### 常见问题

**问：AIFlow 会把我的聊天记录发给别人吗？**
不会。您的聊天记录只保存在您电脑本地的数据库文件中，不会上传到任何服务器。消息只会发送给您选择的 AI 提供商（如 OpenAI），这和您直接使用他们的网站是一样的。

**问：API 密钥安全吗？存在哪里？**
非常安全。AIFlow 将 API 密钥存储在 Windows 凭据管理器中，这是 Windows 系统内置的安全存储区域（和存储 Wi-Fi 密码的地方相同），绝不会写入任何文件或数据库。

**问：如果我不小心关掉了 AIFlow，对话还在吗？**
在。所有对话历史都保存在本地数据库中，重新打开 AIFlow 后可以在左侧边栏中找到所有历史对话。

---

## 开发者环境搭建

### 1. 克隆仓库

```bash
git clone <repository-url>
cd ai-flow
```

### 2. 安装 Node.js 依赖

```bash
npm install
```

### 3. 安装 Rust（如果尚未安装）

```bash
# Windows (PowerShell)
winget install Rustlang.Rustup
# 或访问 https://rustup.rs 按照安装向导操作
```

安装 Rust 后，重启终端并验证：

```bash
rustc --version   # 应显示 1.77 或更高版本
cargo --version
```

### 4. 复制环境变量文件

```bash
cp .env.example .env
```

如需覆盖默认值，请编辑 `.env`（参见[环境变量](#环境变量)章节）。

### 5. 以开发模式运行

```bash
npm run dev
```

此命令同时启动 Vite 开发服务器（端口 1420）和 Tauri 窗口。React 前端支持热重载；Rust 代码的更改需要重新编译 Cargo。

---

## 环境变量

在运行应用之前，请将 `.env.example` 复制为 `.env`。切勿将真实密钥提交到版本控制系统中。

```
# .env.example

# Tauri 开发服务器端口（默认：1420）
VITE_DEV_PORT=1420

# 设置为 1 可在没有真实 Tauri 后端的情况下运行 UI（仅浏览器模拟模式）
TAURI_MOCK=

# 在 E2E 测试套件中启用密钥链测试
KEYCHAIN_TEST=
```

所有 AI 提供商的 API 密钥均在运行时通过设置界面管理，并存储在 OS 密钥链中。它们**不是**环境变量，绝对不应放入 `.env` 文件。

---

## 添加 API 密钥

API 密钥通过 AIFlow 内部的设置面板添加，而非通过环境变量或配置文件。

1. 打开 AIFlow。
2. 点击左下角的**设置**图标。
3. 在**提供商**区域，找到您要配置的提供商。
4. 点击提供商名称以展开其设置。
5. 将您的 API 密钥粘贴到 **API 密钥**输入框中。
6. 点击**保存**。

AIFlow 会立即将密钥存储在 **Windows 凭据管理器**（`控制面板 > 凭据管理器 > Windows 凭据`）中。您可以随时在此处查看或删除密钥。

如需从 AIFlow 中移除密钥：打开设置，选择对应提供商，点击**移除密钥**。

---

## 使用 Ollama（免费、无需 API 密钥）

Ollama 允许您在自己的电脑上本地运行大型语言模型。无需 API 密钥，无需网络连接，无需使用费用。

### 安装 Ollama

1. 从 https://ollama.com/download/windows 下载 Ollama
2. 运行安装程序。
3. Ollama 将作为后台服务运行，地址为 `http://localhost:11434`。

### 下载模型

打开终端（命令提示符或 PowerShell）并运行：

```bash
# 小型快速模型（约需 4 GB 内存）
ollama pull llama3.2

# 更大、能力更强的模型（约需 8 GB 内存）
ollama pull llama3.1:8b

# 专注于代码的模型
ollama pull codellama
```

### 在 AIFlow 中连接 Ollama

1. 打开 AIFlow 设置。
2. 从提供商列表中选择 **Ollama**。
3. 基础 URL 默认为 `http://localhost:11434` —— 除非您更改了 Ollama 的端口，否则保持默认即可。
4. 点击**保存**。
5. 在任意对话中，从模型下拉菜单的 Ollama 分区选择一个模型。

Ollama 模型完全在您的本地机器上运行，不会向外部服务器发送任何数据。

---

## 目录结构

```
ai-flow/
├── src/                        # React 前端（TypeScript）
│   ├── App.tsx                 # 根应用组件
│   ├── main.tsx                # React 入口点
│   ├── index.css               # 全局样式（Tailwind v4）
│   ├── components/             # 可复用 UI 组件
│   │   ├── chat/               # 聊天气泡、消息列表、输入框
│   │   ├── palette/            # 命令面板
│   │   ├── persona/            # 角色选择器和编辑器
│   │   ├── prompt/             # 提示词模板选择器
│   │   ├── sidebar/            # 对话列表侧边栏
│   │   └── ui/                 # 通用设计系统组件
│   ├── views/                  # 全页面视图
│   │   ├── OverlayApp.tsx      # Alt+Shift+A 剪贴板浮层
│   │   └── SettingsView.tsx    # 设置面板
│   ├── stores/                 # Zustand 全局状态
│   │   ├── chatStore.ts        # 当前对话和消息
│   │   ├── personaStore.ts     # 角色列表和选择
│   │   ├── promptStore.ts      # 提示词库模板
│   │   └── settingsStore.ts    # 提供商配置、主题、偏好设置
│   ├── lib/                    # 工具函数和辅助方法
│   └── types/                  # 共享 TypeScript 类型定义
│
├── src-tauri/                  # Rust 后端（Tauri 2）
│   ├── src/
│   │   ├── main.rs             # Tauri 应用入口点
│   │   ├── lib.rs              # 插件注册与初始化
│   │   ├── commands/           # Tauri IPC 命令（从前端调用）
│   │   ├── db/                 # SQLite 连接和查询辅助
│   │   ├── keychain/           # OS 凭据管理器集成
│   │   ├── models/             # Rust 数据模型 / DTO
│   │   ├── services/           # AI 提供商 HTTP 客户端
│   │   ├── shortcut.rs         # 全局键盘快捷键处理器
│   │   └── tray.rs             # 系统托盘图标和菜单
│   ├── migrations/             # SQLite 数据库迁移文件（按顺序执行）
│   │   ├── 20260327000001_core.sql
│   │   ├── 20260327000002_chat.sql
│   │   ├── 20260327000003_attachments.sql
│   │   ├── 20260327000004_prompts.sql
│   │   ├── 20260327000005_personas.sql
│   │   └── 20260327000006_privacy.sql
│   ├── capabilities/           # Tauri 权限清单
│   ├── icons/                  # 应用图标（.ico、.png）
│   ├── Cargo.toml              # Rust 依赖配置
│   ├── build.rs                # 构建脚本
│   └── tauri.conf.json         # Tauri 应用配置
│
├── tests/                      # 测试套件
│   └── contract/               # 契约测试（前端 ↔ 后端 IPC）
│
├── index.html                  # HTML 壳文件
├── vite.config.ts              # Vite 打包器配置
├── vitest.config.ts            # Vitest 单元测试配置
├── tsconfig.json               # TypeScript 编译器配置
├── package.json                # Node.js 项目清单
└── .env.example                # 环境变量模板
```

---

## 开发命令

### 前端（Node.js / Vite）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 以开发模式启动完整 Tauri 应用 |
| `npm run dev:ts` | 仅启动 Vite 开发服务器（不含 Tauri 窗口） |
| `npm run dev:mock` | 使用模拟 Tauri 后端启动 Vite（浏览器测试） |
| `npm run build` | 构建生产版 `.msi` 安装包 |
| `npm run preview` | 预览生产版 Vite 构建 |
| `npm run lint` | 对所有源文件运行 ESLint |
| `npm run typecheck` | 执行类型检查（不输出编译文件） |

### 测试

| 命令 | 说明 |
|------|------|
| `npm run test:unit:ts` | 使用 Vitest 运行 TypeScript 单元测试 |
| `npm run test:unit:rust` | 使用 Cargo 运行 Rust 单元测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run test:contract` | 运行 IPC 契约测试 |
| `npm run test:security` | 运行 `cargo audit` + `npm audit` |
| `npm run test:types` | TypeScript 类型检查 |
| `npm run test:watch` | 以监听模式运行 Vitest |
| `npm run test:coverage` | 生成覆盖率报告（TS + Rust） |
| `npm run test:all` | 按顺序运行完整测试套件 |

### Rust / Cargo（在 `src-tauri/` 目录下运行）

```bash
# 运行 Rust 单元测试
cargo test

# 检查依赖项中已知的安全漏洞
cargo audit

# 生成测试覆盖率报告（需要 cargo-tarpaulin）
cargo tarpaulin
```

---

## 安全说明

AIFlow 在设计时将敏感凭证的安全处理放在首位。

### API 密钥存储

- API 密钥**仅**通过 OS 密钥链 API 存储在 Windows 凭据管理器中。
- 密钥**绝不**写入 SQLite 数据库、日志文件、配置文件或环境变量。
- 密钥**绝不**传输给除指定 AI 提供商端点之外的任何服务器。
- 您可以随时在 `控制面板 > 凭据管理器 > Windows 凭据` 中直接查看、编辑或删除存储的密钥。

**这意味着什么？** 即使有人盗取了您的数据库文件或日志文件，也无法获取您的任何 API 密钥，因为密钥根本不在那里。

### 网络安全

- 所有外部 API 请求仅使用 HTTPS。对 AI 提供商的明文 HTTP 连接将被阻断。
- 出站请求会与允许列表进行校验，以防止服务器端请求伪造（SSRF）攻击。
- AIFlow 不收集、不传输任何遥测数据、分析数据或使用数据。

### 数据库安全

- 所有 SQL 查询均使用参数化语句。代码库中任何地方都不使用原始字符串拼接 SQL。
- SQLite 数据库仅存储对话历史和偏好设置 —— 不含任何密钥或敏感信息。

### 依赖项审计

随时运行 `npm run test:security` 以检查 Rust 和 Node.js 依赖树中已知的 CVE 漏洞。

---

## 贡献指南

欢迎贡献代码。请按照以下步骤操作：

1. **Fork** 仓库，并从 `main` 分支创建新分支。

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **进行更改。** 保持提交的专注性和原子性。

3. 提交 Pull Request 之前，**运行测试套件**。

   ```bash
   npm run test:all
   ```

4. **运行 Lint 和类型检查。**

   ```bash
   npm run lint
   npm run typecheck
   ```

5. 向 `main` 分支**提交 Pull Request**，说明您更改的内容和原因。

### 代码风格

- TypeScript：遵循现有的 ESLint 配置（`eslint.config.js`）。
- Rust：提交前运行 `cargo fmt` 和 `cargo clippy`。
- 提交消息：使用祈使语气（`Add feature X`、`Fix bug in Y`）。

### 报告 Bug

请提交 GitHub Issue，并包含以下信息：
- 您的 Windows 版本
- AIFlow 版本
- 重现问题的步骤
- 预期行为与实际行为
- 应用中显示的任何错误信息

### 安全漏洞

对于安全漏洞，请**不要**提交公开的 GitHub Issue。请通过仓库中列出的邮箱直接联系维护者。

---

## 许可证

版权所有 (c) 2026 SoDam AI Studio。保留所有权利。

本软件为专有软件，归 SoDam AI Studio 所有。未经 SoDam AI Studio 的明确书面许可，不得以任何形式复制、修改、分发本软件或将其用于任何产品。

如有许可证相关咨询，请联系 SoDam AI Studio。
