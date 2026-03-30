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
| **多提供商** | GPT-4o、Claude Sonnet、Gemini Flash + 8个以上（共11个） |
| **API密钥验证** | 保存前自动通过提供商API验证密钥有效性 |
| **实时费用** | 每条消息显示令牌数 + USD + KRW双币费用 |
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
| 流式传输 | Tauri ipc::Channel (SSE解析) |
| AI调用 | Rust reqwest (无CORS，密钥绝不暴露给前端) |

## 快速开始

### 安装

1. 从[GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)下载最新`.msi`
2. 运行安装程序
3. 按`Alt+Space`打开悬浮窗
4. 在设置中添加API密钥

### 从源码构建

```bash
# 前置条件（管理员PowerShell）
choco install strawberryperl -y   # SQLCipher构建所需
choco install nodejs-lts -y

# 克隆仓库
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow && npm install && npm run dev
```

## 安全

- **API密钥验证**: 保存前通过免费API调用验证有效性
- **API密钥存储**: 仅OS密钥链（代码、文件、数据库中绝无明文）
- **数据库**: SQLCipher AES-256 + PBKDF2-SHA512（25万次迭代）
- **审计日志**: 不可变INSERT-only日志

## 非开发者指南（AI自然语言编程）

1. 在[Cursor](https://cursor.sh)等AI编辑器中打开项目
2. 用自然语言描述你想要的功能（例如："添加深蓝色主题选项"）
3. AI生成代码 — 你只需确认并接受
4. 用`npm run dev`测试 — 更改立即在应用中生效

## 许可证

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
