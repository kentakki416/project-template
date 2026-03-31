# Admin Dashboard

Next.js 16 (App Router) を使用した管理画面アプリケーション

## 概要

[TailAdmin](https://github.com/TailAdmin/free-nextjs-admin-dashboard) をベースに構築した管理画面ダッシュボードです。

- **ベースプロジェクト**: [TailAdmin Free Next.js Admin Dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard)
- **プレビュー**: [https://nextjs-free-demo.tailadmin.com](https://nextjs-free-demo.tailadmin.com)
- **公式サイト**: [https://tailadmin.com](https://tailadmin.com)

### 技術スタック

- Next.js 16.x (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- ApexCharts（チャート）
- FullCalendar（カレンダー）

## アーキテクチャ

### Route Group の構成

- **`(auth)/`** - 認証ページ（サイドバーなし、専用レイアウト）
- **`(dashboard)/`** - 管理画面（サイドバー + ヘッダー付きレイアウト）

### 主要ディレクトリの責務

| ディレクトリ | 責務 |
|---|---|
| `components/` | 機能単位で分割された共通コンポーネント |
| `context/` | グローバル状態管理（サイドバー開閉、テーマ切り替え） |
| `icons/` | SVGアイコン（`@svgr/webpack` で React コンポーネントとして読み込み） |
| `layout/` | レイアウト構造のコンポーネント（サイドバー、ヘッダー） |
| `hooks/` | カスタム React Hooks |

## 開発コマンド

```bash
# 開発サーバー起動（ポート 3030）
pnpm dev

# ビルド
pnpm build

# 本番サーバー起動
pnpm start

# リント
pnpm lint
pnpm lint:fix
```
