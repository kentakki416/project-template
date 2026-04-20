<!-- TODO: プロジェクト名に変更してください -->
# project-template

Turborepo + pnpm monorepo を使用したフルスタックアプリケーションテンプレート

## 目次

- [プロジェクト構成図](#プロジェクト構成図)
- [技術スタック](#技術スタック)
- [MCP サーバー](#mcp-サーバー)
  - [一覧](#一覧)
  - [使い方](#使い方)
  - [MCP サーバーの追加方法](#mcp-サーバーの追加方法)
- [使い方](#使い方-1)
  - [1. プロジェクトのコピー](#1-プロジェクトのコピー)
  - [2. 環境変数の設定](#2-環境変数の設定)
  - [3. セットアップ](#3-セットアップ)
- [開発ルール](#開発ルール)
  - [1. 命名規則](#1-命名規則)
  - [2. 基本コマンド](#2-基本コマンド)
  - [3. pnpm ワークスペースコマンド](#3-pnpm-ワークスペースコマンド)
  - [4. 環境変数の管理コマンド](#4-環境変数の管理コマンド)
  - [5. Docker環境の起動コマンド](#5-docker環境の起動コマンド)

## プロジェクト構成図

```mermaid
graph TB
    subgraph Apps
        Web["apps/web<br/>Next.js 16 :3000"]
        Admin["apps/admin<br/>Next.js 16 :3030"]
        Mobile["apps/mobile<br/>Expo / React Native"]
        API["apps/api<br/>Express 5 :8080"]
    end

    subgraph Packages
        Schema["packages/schema<br/>Zod スキーマ / 型定義"]
        Terraform["packages/terraform<br/>AWS IaC"]
    end

    subgraph Infrastructure
        MySQL[(MySQL 8.0)]
        Redis[(Redis 7)]
    end

    Web --> API
    Admin --> API
    Mobile --> API
    API --> MySQL
    API --> Redis
    Schema --> Web
    Schema --> Admin
    Schema --> Mobile
    Schema --> API
```

## 技術スタック

#### モノレポ・ビルド
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)

#### バックエンド
![Express](https://img.shields.io/badge/Express%205-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma%207-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)

#### フロントエンド
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%20v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

#### モバイル
![Expo](https://img.shields.io/badge/Expo%2054-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native%200.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)

#### 認証
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google%20OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white)

#### データベース・キャッシュ
![MySQL](https://img.shields.io/badge/MySQL%208.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis%207-DC382D?style=for-the-badge&logo=redis&logoColor=white)

#### インフラ・CI/CD
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)
![ECS Fargate](https://img.shields.io/badge/ECS%20Fargate-FF9900?style=for-the-badge&logo=amazonecs&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## MCP サーバー

このプロジェクトでは [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) を使い、Claude Code に外部ツール・サービスを接続しています。設定は `.mcp.json` に記載されています。

### 一覧

| MCP サーバー | パッケージ | 機能 |
|---|---|---|
| `context7` | `@upstash/context7-mcp` | ライブラリの最新ドキュメントをリアルタイム取得。古い情報に基づくコード生成を防止 |
| `aws-knowledge-mcp-server` | `mcp-remote` (リモート) | AWS公式ナレッジベース。AWSサービスのベストプラクティス・設定例を参照 |
| `github` | `@modelcontextprotocol/server-github` | GitHub操作（Issue・PR作成、コード検索、リポジトリ管理等） |
| `playwright` | `@playwright/mcp` | ブラウザ操作の自動化。E2Eテスト・スクレイピング・UI確認 |
| `serena` | `serena` (uvx) | 言語サーバー統合。シンボル検索・参照検索・コード操作・プロジェクトメモリ管理 |
| `docker` | `mcp/docker` (Docker公式) | コンテナ一覧表示・ログ確認・コンテナ操作。トラブルシューティングが高速化 |
| `sqlite` | `@modelcontextprotocol/server-sqlite` | SQLiteデータベースのスキーマ確認・読み取りクエリ実行。自然言語でDB分析可能 |
| `browser-tools` | `@anthropic-ai/browser-mcp` | Chrome DevTools連携。Consoleログ監視・ネットワーク分析・Lighthouse監査 |
| `drawio` | `@drawio/mcp` | Draw.io図の作成・編集。アーキテクチャ図やフローチャートをAIで生成 |
| `lottiefiles` | `mcp-server-lottiefiles` | LottieFilesからアニメーション検索・取得。UIアニメーション素材の検索 |
| `lottie-creator` | `@nicepkg/lottie-mcp` | Lottieアニメーションの作成・編集。カスタムアニメーション生成 |
| `notion` (無効) | `@notionhq/notion-mcp-server` | Notionページ・DB検索・作成・更新。ドキュメント管理をAIから操作 |
| `slack` (無効) | `@anthropic-ai/mcp-server-slack` | Slackメッセージ送受信・チャンネル操作。チーム連携をAIから実行 |

### 使い方

#### GitHub MCP Server

ブラウザを開かず、Claude Code 内だけで GitHub 操作が完結します。

```
# 使用例（Claude Code に自然言語で指示）
- 「このリポジトリの Issue 一覧を見せて」
- 「PR #42 の変更内容をレビューして」
- 「新しい Issue を作成して: タイトル〇〇、本文△△」
```

**セットアップ**: 環境変数 `GITHUB_PAT` に GitHub Personal Access Token を設定してください。

#### Docker MCP Server

コンテナのトラブルシューティングが爆速になります。

```
# 使用例
- 「Docker のコンテナ一覧を表示して」
- 「api コンテナのログを見て原因を教えて」
- 「停止しているコンテナを再起動して」
```

**前提条件**: Docker Desktop が起動していること。Docker ソケット (`/var/run/docker.sock`) へのアクセスが必要です。

#### SQLite MCP Server

自然言語で DB 分析ができます。ローカル開発時のデータ確認に便利です。

```
# 使用例
- 「users テーブルのスキーマを見せて」
- 「先週登録したユーザーの数を数えて」
- 「orders テーブルから売上上位10件を取得して」
```

**セットアップ**: 環境変数 `SQLITE_DB_PATH` にデータベースファイルのパスを設定してください（デフォルト: `./data/local.db`）。

#### Browser Tools (Chrome DevTools) MCP

ブラウザのデバッグも AI にお任せできます。

```
# 使用例
- 「コンソールに出ているエラーの原因を特定して修正案を出して」
- 「ページの読み込みが遅い原因をネットワークタブから分析して」
- 「Lighthouse 監査を実行してパフォーマンススコアを教えて」
```

#### Playwright MCP

ブラウザ操作の自動化・テスト作成に使用します。

```
# 使用例
- 「ログインフローの E2E テストコードを書いて」
- 「サイトを巡回してデザイン崩れがないかチェックして」
- 「このページのスクリーンショットを撮って」
```

#### Draw.io MCP

アーキテクチャ図やフローチャートを AI で生成・編集できます。

```
# 使用例
- 「このシステムのアーキテクチャ図を draw.io で作成して」
- 「既存の図にマイクロサービス間の通信フローを追加して」
- 「ER図を draw.io 形式で生成して」
```

#### LottieFiles MCP

LottieFiles のアニメーションライブラリから素材を検索・取得します。

```
# 使用例
- 「ローディング用のアニメーションを検索して」
- 「成功時に表示するチェックマークアニメーションを探して」
- 「404ページ用のアニメーション素材を提案して」
```

#### Lottie Creator MCP

Lottie アニメーションをカスタム作成・編集します。

```
# 使用例
- 「ブランドカラーを使ったローディングアニメーションを作成して」
- 「既存の Lottie JSON を編集して速度を変更して」
- 「ボタンのホバーアニメーションを Lottie で作って」
```

#### Notion MCP (無効 - 要セットアップ)

Notion のページやデータベースを AI から直接操作できます。議事録の作成、タスク管理、ドキュメント検索がチャット内で完結します。

```
# 使用例
- 「Notion の〇〇データベースからタスク一覧を取得して」
- 「今日の議事録ページを作成して、参加者は△△」
- 「プロジェクト仕様書のページを検索して内容を要約して」
- 「Notion のタスクのステータスを"完了"に更新して」
```

**使用感**: Notion をブラウザで開かずに、Claude Code 内からページの検索・閲覧・作成・更新ができます。特にドキュメント参照しながらコーディングする場面で、コンテキストスイッチが不要になります。

**有効化手順**:

1. [Notion Integrations](https://www.notion.so/my-integrations) で Internal Integration を作成
2. 作成した Integration の「Internal Integration Secret」をコピー
3. 環境変数を設定:
   ```bash
   export NOTION_API_TOKEN="ntn_xxxxxxxxxxxx"
   ```
4. Notion 上で、アクセスしたいページ/データベースに Integration を接続（ページ右上「...」→「コネクト」→ 作成した Integration を選択）
5. `.mcp.json` のキー名を `_disabled_notion` → `notion` に変更
6. Claude Code を再起動

#### Slack MCP (無効 - 要セットアップ)

Slack のメッセージ送受信・チャンネル操作を AI から実行できます。開発中に Slack を確認したり、通知を送ったりがチャット内で完結します。

```
# 使用例
- 「#dev チャンネルの最新メッセージを10件見せて」
- 「@田中さん に『デプロイ完了しました』と DM して」
- 「#general チャンネルに今日のリリースノートを投稿して」
- 「昨日の #incident チャンネルの議論を要約して」
```

**使用感**: Slack アプリを切り替えずに、開発フロー内でチームとのコミュニケーションが可能になります。「このバグについて Slack で何か報告あった？」→ 検索 → 要約、のような流れが1ステップで完了します。

**有効化手順**:

1. [Slack API](https://api.slack.com/apps) で新しい App を作成
2. 「OAuth & Permissions」で以下の Bot Token Scopes を追加:
   - `channels:history` - パブリックチャンネルのメッセージ読取
   - `channels:read` - チャンネル一覧取得
   - `chat:write` - メッセージ送信
   - `groups:history` - プライベートチャンネルのメッセージ読取
   - `groups:read` - プライベートチャンネル一覧
   - `im:history` - DM読取
   - `im:write` - DM送信
   - `users:read` - ユーザー情報取得
3. App をワークスペースにインストールし、Bot User OAuth Token を取得
4. 環境変数を設定:
   ```bash
   export SLACK_BOT_TOKEN="xoxb-xxxxxxxxxxxx"
   export SLACK_TEAM_ID="T0XXXXXXXXX"  # ワークスペースのチームID
   ```
5. `.mcp.json` のキー名を `_disabled_slack` → `slack` に変更
6. Claude Code を再起動

> **注意**: Slack MCP でメッセージを送信する場合、Claude Code が確認プロンプトを表示します（外部への送信アクションのため）。意図しない送信を防ぐ安全機構です。

### MCP サーバーの追加方法

`.mcp.json` に新しいエントリを追加:

```json
{
  "mcpServers": {
    "new-server": {
      "command": "npx",
      "args": ["-y", "@package/mcp-server@latest"],
      "env": {
        "API_KEY": "${env:MY_API_KEY}"
      }
    }
  }
}
```

- `command`: 実行コマンド（`npx`, `uvx`, `docker` 等）
- `args`: コマンド引数
- `env`: 環境変数。`${env:VAR_NAME}` でシステム環境変数を参照可能
- 追加後、Claude Code を再起動すると利用可能になる

---

## 使い方

### 1. プロジェクトのコピー

`scripts/copy-template.sh` を実行して、テンプレートを新しいプロジェクトとしてコピーします。

```bash
# 例: 相対パスで指定
./scripts/copy-template.sh ../my-new-app

# 例: プロジェクト名を明示的に指定
./scripts/copy-template.sh ../my-new-app my-new-app

# 例: 絶対パスで指定
./scripts/copy-template.sh ~/workspace/my-new-app
```

プロジェクト名を省略した場合、コピー先ディレクトリ名が使用されます。

### 2. 環境変数の設定

各アプリの `.env.local` は [dotenvx](https://dotenvx.com/) で暗号化されています。復号に必要な `.env.keys` をプロジェクトルートに配置してください。

**既存プロジェクトに参加する場合:**

管理者から `.env.keys` を受け取り、プロジェクトルートに配置してください。
各アプリ (`apps/api`, `apps/web`, `apps/mobile`) にはルートへのシンボリックリンクが git に含まれているため、ルートに置くだけで全アプリから参照されます。

```
<project-root>/
├── .env.keys                        ← ここに配置
├── apps/
│   ├── api/.env.keys → ../../.env.keys   (シンボリックリンク)
│   ├── web/.env.keys → ../../.env.keys   (シンボリックリンク)
│   └── mobile/.env.keys → ../../.env.keys (シンボリックリンク)
```

**新規プロジェクトとして始める場合:**

1. 各アプリに `.env.local` を作成し、必要な環境変数を設定:
```bash
# 例: apps/api/.env.local
cp apps/api/.env.local.example apps/api/.env.local  # テンプレートがある場合
```

2. dotenvx で暗号化（`.env.keys` が自動生成される）:
```bash
cd apps/api && pnpm exec dotenvx encrypt -f .env.local
```

3. 生成された `.env.keys` をプロジェクトルートに移動:
```bash
mv apps/api/.env.keys .env.keys
```

4. 他のアプリからシンボリックリンクを作成:
```bash
ln -s ../../.env.keys apps/api/.env.keys
ln -s ../../.env.keys apps/web/.env.keys
ln -s ../../.env.keys apps/mobile/.env.keys
```

> `.env.keys` には復号キーが含まれるため、**git にコミットしないでください**（`.gitignore` で除外済み）。

### 3. セットアップ

```bash
# コピー先に移動
cd <コピー先パス>

# git リポジトリを初期化
git init

# 依存関係のインストール
pnpm install

# Docker 環境の起動（MySQL + Redis）
docker compose up -d

# スキーマパッケージのビルド
cd packages/schema && pnpm build

# 開発サーバーの起動（ルートに戻って）
cd ../..
pnpm dev
```

## 開発ルール

### 1. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ディレクトリ | kebab-case | `user-profile/`, `api-schema/` |
| 一般ファイル（hooks, utils, lib等） | kebab-case | `use-auth.ts`, `api-client.ts`, `format-date.ts` |
| Componentをexportするファイル | PascalCase | `UserProfile.tsx`, `LoginForm.tsx`, `Button.tsx` |
| テストファイル | テスト対象の関数名 + `.test.ts` | `getUserById.test.ts`, `authenticateWithGoogle.test.ts` |

### 2. 基本コマンド

```bash
pnpm dev          # 全アプリを開発モードで起動
pnpm build        # 全アプリをビルド
pnpm lint         # ESLint 実行
pnpm lint:fix     # ESLint 自動修正
pnpm test         # テスト実行
```

### 3. pnpm ワークスペースコマンド

```bash
# 特定のワークスペースでコマンドを実行
pnpm --filter <workspace-name> <command>

# 例: webアプリのみ起動
pnpm --filter web dev

# すべてのワークスペースに依存関係を追加
pnpm add -w <package-name>

# 特定のワークスペースに依存関係を追加
pnpm --filter <workspace-name> add <package-name>

# 特定のワークスペースのdevDependenciesに依存関係を追加
pnpm --filter web add -D @types/node

# 依存関係を削除
pnpm --filter <workspace-name> remove <package-name>

# すべての node_modules を削除して再インストール
pnpm clean && pnpm install
```

### 4. 環境変数の管理コマンド

```bash
# .env.local の暗号化
cd apps/api && pnpm exec dotenvx encrypt -f .env.local

# .env.local の復号化
cd apps/api && pnpm exec dotenvx decrypt -f .env.local
```

### 5. Docker環境の起動コマンド

```bash
# Dockerコンテナを起動
docker compose up -d

# コンテナの状態を確認
docker compose ps

# ログを確認
docker compose logs -f

# コンテナを停止
docker compose down

# データを含めて完全に削除
docker compose down -v
```
