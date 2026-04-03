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
| `components/` | 3層構造（ui / features / layout）で分類されたコンポーネント |
| `context/` | グローバル状態管理（サイドバー開閉、テーマ切り替え） |
| `icons/` | SVGアイコン（`@svgr/webpack` で React コンポーネントとして読み込み） |
| `layout/` | レイアウト構造のコンポーネント（サイドバー、ヘッダー） |
| `hooks/` | カスタム React Hooks |

## コンポーネントの分類方針

`components/` は以下の3層で分類する。画面ベースではなく機能ベースで分ける。

| 層 | 配置するもの | 依存ルール |
|---|---|---|
| **ui/** | props だけで動く汎用パーツ。ビジネスロジックを持たない | 他の層に依存しない |
| **features/** | 特定のドメイン・機能に紐づくコンポーネント | `ui/` と `layout/` を使ってよい |
| **layout/** | ページの構造やレイアウトを決めるコンポーネント | `ui/` を使ってよい |

**理由:**
- 画面ベースだと複数画面で使うコンポーネントの置き場所に困り、再利用性が下がる
- `ui/` を分離することで依存方向が明確になり、安全に再利用・テストできる
- App Router がルーティングを担うため、`components/` は画面に縛られる必要がない
- web / admin / mobile で同じ考え方を採用し、アプリ間の認知負荷を統一する

**判断基準:** ドメイン知識なしで動く → `ui/` / レイアウト系 → `layout/` / それ以外 → `features/{domain}/`

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
