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
| **マルチプロバイダー** | GPT-4o、Claude Sonnet、Gemini Flash + 8社以上（合計11社） |
| **APIキー検証** | 保存前にプロバイダーAPIで有効性を自動検証 |
| **リアルタイムコスト** | メッセージごとにトークン数 + USD + KRWデュアルコスト表示 |
| **OSキーチェーンセキュリティ** | APIキーをWindows資格情報マネージャーに保存 |
| **暗号化DB** | SQLCipher AES-256で全会話を暗号化 |
| **AIペルソナ** | 6種内蔵（開発者、ライター、翻訳者、アナリスト、法務、要約） |
| **プロンプトライブラリ** | 保存、タグ、検索 + `{{変数}}`スロット対応 |
| **コマンドパレット** (`Ctrl+K`) | 自然言語でアプリ機能にアクセス |
| **ファイルドラッグ＆ドロップ** | PDF、TXT、コード、画像をAIチャットに直接送信 |
| **自動アップデーター** | Ed25519署名検証 + ダウングレード防止 |
| **マルチAI比較** | 2~3つのAIを並べてストリーミング、最適な応答を選択 |
| **スマートルーティング** | 質問の複雑さ分析 → 最適なAIを自動選択 + フォールバックチェーン |
| **プライバシーモード** | PIIスキャナー（マイナンバー、電話、メール等）+ マスキングプレビュー |
| **ローカルLLM** | Ollama/LM Studioを自動検出、無料のローカルモデルを使用 |
| **コストダッシュボード** | モデル別コスト分析、日別チャート、USD + KRW |
| **月間予算** | 支出上限設定、80%到達時にアラート |
| **プロンプトバージョン管理** | 編集時に自動保存、比較・復元 |
| **完了通知** | AI応答完了時にOS通知（最小化中） |
| **スクリーンショット → AI** (`Ctrl+Shift+S`) | 画面キャプチャ → Vision AIに送信 |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップ | Tauri 2 (Rustバックエンド) |
| フロントエンド | React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui |
| データベース | SQLite + SQLCipher (AES-256, PBKDF2-SHA512 25万回反復) |
| APIキー | Windows資格情報マネージャー (OSキーチェーン) |
| ストリーミング | Tauri ipc::Channel (SSEパーシング) |
| AI呼び出し | Rust reqwest (CORSなし、キーがフロントエンドに絶対漏洩しない) |

## クイックスタート

### インストール

1. [GitHub Releases](https://github.com/sodam-ai/ai-flow/releases)から最新の`.msi`をダウンロード
2. インストーラーを実行
3. `Alt+Space`でオーバーレイを開く
4. 設定でAPIキーを登録

### ソースからビルド

```bash
# 前提条件 (管理者PowerShell)
choco install strawberryperl -y   # SQLCipherビルドに必要
choco install nodejs-lts -y

# リポジトリをクローン
git clone https://github.com/sodam-ai/ai-flow.git
cd ai-flow && npm install && npm run dev
```

## セキュリティ

- **APIキー検証**: 保存前に無料API呼び出しで有効性検証
- **APIキー保存**: OSキーチェーンのみ（コード、ファイル、DBに平文なし）
- **データベース**: SQLCipher AES-256 + PBKDF2-SHA512（25万回反復）
- **監査ログ**: 変更不可INSERT専用ログ

## 非開発者向けガイド（AIバイブコーディング）

1. [Cursor](https://cursor.sh)などのAI対応IDEでプロジェクトを開く
2. 自然言語でやりたいことを説明（例：「ダークブルーテーマを追加して」）
3. AIがコードを生成 — 確認して受け入れるだけ
4. `npm run dev`でテスト — 変更が即座にアプリに反映

## ライセンス

[MIT License](LICENSE) - Copyright (c) 2026 SoDam AI Studio
