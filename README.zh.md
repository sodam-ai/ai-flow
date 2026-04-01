# AIFlow

**一个快捷键调用所有AI。** 从任何应用中与GPT、Claude、Gemini和本地LLM对话的本地桌面AI中心 — 包含知识库、多步骤智能体、工作流自动化。

[English](README.md) | [Korean](README.ko.md) | [Japanese](README.ja.md)

---

## 什么是AIFlow？

AIFlow是一款将多个AI提供商集成于一体的**Windows桌面应用**。在任何应用中按`Alt+Space`即可唤出AIFlow，提问后可获得实时流式响应和费用显示。

**无需云账号。不收集数据。一切都存储在本地。**

---

## 核心功能

### 基础聊天
| 功能 | 说明 |
|------|------|
| **全局快捷键** (`Alt+Space`) | 从任何应用唤出AIFlow（Word、Chrome、游戏等） |
| **多提供商** | GPT-4o、Claude Sonnet、Gemini Flash + 8个以上（共11个） |
| **API密钥验证** | 保存前自动通过提供商API验证密钥有效性 |
| **实时费用** | 每条消息显示令牌数 + USD + KRW双币费用 |
| **OS密钥链安全** | API密钥存储在Windows凭据管理器中（绝不存入文件） |
| **加密数据库** | SQLCipher AES-256加密所有对话 |
| **AI角色** | 6种内置（开发者、文案、翻译、分析师、法务、摘要） |
| **提示词库** | 保存、标签、搜索 + `{{变量}}`插槽 |
| **命令面板** (`Ctrl+K`) | 自然语言访问应用功能 |
| **文件拖放** | 将PDF、TXT、MD、代码、图片直接拖入AI聊天 |
| **剪贴板→AI** (`Alt+Shift+A`) | 从任何应用将剪贴板内容即时发送给AI |
| **截图→AI** (`Ctrl+Shift+S`) | 将截图发送给Vision AI |
| **系统托盘** | 后台运行 + 快速访问托盘菜单 |

### Phase 2 — 进阶功能
| 功能 | 说明 |
|------|------|
| **多AI对比** | 2~3个模型并行流式输出，选择最佳回复 |
| **智能路由** | 根据提示词复杂度（0~100）自动选择最优AI |
| **隐私模式** | 本地PII扫描器（身份证、电话、邮箱）— 发送前遮蔽 |
| **本地LLM** | 自动检测Ollama / LM Studio，免费使用本地模型 |
| **费用仪表板** | 按模型费用分析、日度图表、USD + KRW |
| **月度预算** | 设置消费上限，达到80%时提醒 |
| **提示词版本** | 自动保存编辑历史，比较和恢复任意版本 |
| **完成提醒** | AI响应完成时发送OS通知（最小化时） |
| **工作流构建器** | 15种内置模板，多步骤AI自动化管道 |
| **批量队列** | 自动批量处理数百个条目 |
| **MCP市场** | 文件、Git、浏览器AI工具（MCP协议） |
| **浏览器扩展** | 一键将当前页面发送到AIFlow |

### Phase 3 — 智能功能 ✨ NEW
| 功能 | 说明 |
|------|------|
| **知识库 (RAG)** | 索引文档并通过全文AI查询进行搜索 |
| **AI智能体** | 对敏感操作设有审批门的多步骤自主任务执行 |
| **对话分支** | 在任意消息处分叉对话，探索不同路径 |
| **工作流导出/导入** | 将工作流作为JSON文件在设备间共享 |
| **条件工作流** | 改进的工作流步骤中的分支和条件支持 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面端 | Tauri 2 (Rust后端) |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 数据库 | SQLite + SQLCipher (AES-256，PBKDF2-SHA512 256k次) |
| 全文搜索 | SQLite FTS5 (知识库RAG) |
| API密钥 | Windows凭据管理器 (OS密钥链) |
| 状态管理 | Zustand |
| 流式传输 | Tauri ipc::Channel |
| AI调用 | Rust reqwest (无CORS，密钥不到达前端) |
| 国际化 | react-i18next |

---

## 快速开始

### 前置条件

- **Windows 10 21H2+** 或 **Windows 11**
- 至少一个AI API密钥（OpenAI、Anthropic或Google）

### 从发布版安装

1. 从[GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)下载最新`.msi`
2. 运行安装程序
3. AIFlow出现在系统托盘
4. 按`Alt+Space`打开悬浮窗
5. 进入**设置**添加API密钥

### 从源码构建

#### 要求

- Rust工具链（MSVC目标）：`rustup default stable`
- Visual Studio Build Tools（C++工作负载）
- Strawberry Perl：`choco install strawberryperl -y`（SQLCipher所需）
- Node.js 20+：`choco install nodejs-lts -y`

#### 步骤

```bash
# 克隆仓库
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow

# 安装前端依赖
npm install

# 开发模式运行
npm run tauri:dev

# 生产构建（.msi安装包）
npm run tauri:build
```

---

## 主要功能使用说明

### 知识库 (RAG)

1. 点击侧边栏的**知识库**（数据库图标）
2. 点击**新建知识库**创建知识库
3. 选择要索引的文件（`.txt`、`.md`、`.py`、`.ts`、`.rs`、`.json`等）
4. 用搜索框查询文档 — 结果高亮显示匹配文本
5. AI智能体在任务执行期间可自动搜索知识库

### AI智能体

1. 点击侧边栏的**AI智能体**（烧杯图标）
2. 在输入框中输入目标（例如："总结知识库中的所有文档"）
3. 智能体规划步骤，然后逐一执行
4. 需要文件写入或工作流执行的步骤显示**审批门** — 进行前先审查
5. 可随时取消智能体

### 对话分支

1. 在对话中悬停到某条消息
2. 点击**分叉**按钮从该点分支
3. 创建一个包含到该点为止所有消息副本的新对话
4. 不丢失原始对话线索，探索不同的AI响应

### 工作流导出/导入

1. 打开**工作流构建器**并选择工作流
2. 点击**导出**下载`.json`文件
3. 在另一台设备上点击**导入**并选择文件
4. 工作流连同所有步骤一起重新创建

---

## 环境变量

AIFlow**不需要**`.env`文件。所有密钥存储在OS密钥链中。

| 变量 | 用途 | 设置位置 |
|------|------|----------|
| AI API密钥 | 提供商认证 | OS密钥链（设置界面） |
| DB主密钥 | 数据库加密 | OS密钥链（首次运行时自动生成） |
| 设备ID | 许可证验证 | OS密钥链（随机UUID） |

---

## 安全

| 领域 | 实现方式 |
|------|----------|
| API密钥存储 | 仅OS密钥链 — 绝不存入代码、文件或数据库 |
| API密钥验证 | 保存前通过实时API调用验证 |
| 数据库 | SQLCipher AES-256 + PBKDF2-SHA512（256,000次） |
| DB主密钥 | 自动生成随机32字节密钥，存储在OS密钥链 |
| IPC参数 | 前端Zod验证 + 后端Rust类型系统 |
| 流式传输 | Tauri ipc::Channel（非EventSystem），支持取消 |
| CSP | `default-src 'self'`（无unsafe-eval） |
| 审计日志 | 不可变INSERT专用日志（关键事件、流事件） |
| 隐私模式 | 100%本地PII扫描器 — 数据不离开本机 |
| 模板注入 | `{{input}}`值在AI替换前进行净化 |
| FTS5注入 | 搜索查询用双引号包裹，去除特殊字符 |
| 路径安全 | 对所有MCP文件路径应用`canonicalize()`（防止符号链接遍历） |
| 输入限制 | 所有文本输入有最大长度验证（目标：2KB，查询：500字符） |
| 文件访问 | 绝对路径检查 + 扩展名白名单 + 5MB大小限制（知识库） |

---

## 路线图

| 阶段 | 重点 | 状态 |
|------|------|------|
| **1a** | 核心MVP（聊天、费用、安全、国际化） | ✅ 完成 |
| **1b** | 快捷键、悬浮窗、角色、提示词、托盘、文件拖放 | ✅ 完成 |
| **2** | 多AI对比、智能路由、隐私、费用仪表板、预算、工作流 | ✅ 完成 |
| **3** | RAG知识库、AI智能体、对话分支、工作流导出/导入 | ✅ 完成 |
| **4** | 语音I/O（Whisper.cpp）、智能上下文注入、插件市场 | 计划中 |

---

## 链接

- [PRD文档](.PRD/README.md) — 产品需求和设计决策
- [GitHub Issues](https://github.com/sodam-ai/ai-flow/issues)
- [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)

---

## 许可证

[MIT License](LICENSE) — Copyright © 2026 SoDam AI Studio
