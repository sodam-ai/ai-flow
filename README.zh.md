# AIFlow

**一个快捷键调用所有AI。** 从任何应用中与GPT、Claude、Gemini和本地LLM对话的本地桌面AI中心。

[English](README.md) | [Korean](README.ko.md) | [Japanese](README.ja.md)

---

## 什么是AIFlow？

AIFlow是一款将多个AI提供商集成于一体的**Windows桌面应用**。在任何应用中按`Alt+Space`即可唤出AIFlow，提问后可获得实时流式响应和费用显示。

**无需云账号。不收集数据。一切都存储在本地。**

## 核心功能

| 功能 | 说明 |
|------|------|
| **全局快捷键** (`Alt+Space`) | 从任何应用唤出AIFlow |
| **多提供商** | GPT-4o、Claude Sonnet、Gemini Flash + 8个以上 |
| **实时费用** | 每条消息显示令牌数 + USD + KRW费用 |
| **OS密钥链安全** | API密钥存储在Windows凭据管理器中 |
| **加密数据库** | SQLCipher AES-256加密所有对话 |
| **AI角色** | 6种内置（开发者、文案、翻译、分析师、法务、摘要） |
| **提示词库** | 保存、标签、搜索 + `{{变量}}`插槽 |
| **命令面板** (`Ctrl+K`) | 自然语言访问应用功能 |
| **文件拖放** | 将PDF、TXT、代码、图片直接拖入AI聊天 |
| **自动更新** | Ed25519签名验证 + 防降级 |

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面 | Tauri 2 (Rust后端) |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| 数据库 | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 25万次迭代) |
| API密钥 | Windows凭据管理器 (OS密钥链) |

## 快速开始

```bash
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow && npm install && npm run dev
```

## 许可证

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
