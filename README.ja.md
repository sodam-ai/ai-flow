# AIFlow

**ショートカット一つで全てのAIを。** どのアプリからでもGPT、Claude、Gemini、ローカルLLMと対話できるローカルデスクトップAIハブ。

[English](README.md) | [Korean](README.ko.md) | [Chinese](README.zh.md)

---

## AIFlowとは？

AIFlowは複数のAIプロバイダーを一つにまとめた**Windowsデスクトップアプリ**です。どのアプリでも`Alt+Space`を押すとAIFlowが表示され、質問するとリアルタイムストリーミング応答とコスト表示が得られます。

**クラウドアカウント不要。データ収集なし。全てがPC上に保存されます。**

## 主な機能

| 機能 | 説明 |
|------|------|
| **グローバルショートカット** (`Alt+Space`) | どのアプリからでもAIFlowを呼び出し |
| **マルチプロバイダー** | GPT-4o、Claude Sonnet、Gemini Flash + 8社以上 |
| **リアルタイムコスト** | メッセージごとにトークン数 + USD + KRWコスト表示 |
| **OSキーチェーンセキュリティ** | APIキーをWindows資格情報マネージャーに保存 |
| **暗号化DB** | SQLCipher AES-256で全会話を暗号化 |
| **AIペルソナ** | 6種内蔵（開発者、ライター、翻訳者、アナリスト、法務、要約） |
| **プロンプトライブラリ** | 保存、タグ、検索 + `{{変数}}`スロット対応 |
| **コマンドパレット** (`Ctrl+K`) | 自然言語でアプリ機能にアクセス |
| **ファイルドラッグ＆ドロップ** | PDF、TXT、コード、画像をAIチャットに直接送信 |
| **自動アップデーター** | Ed25519署名検証 + ダウングレード防止 |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップ | Tauri 2 (Rustバックエンド) |
| フロントエンド | React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| データベース | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 25万回反復) |
| APIキー | Windows資格情報マネージャー (OSキーチェーン) |

## クイックスタート

```bash
# リポジトリをクローン
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow && npm install && npm run dev
```

## ライセンス

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
