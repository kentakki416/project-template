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

### ディレクトリ構成

```
src/
  app/                        # ルーティング + ページ構成（薄く保つ）
    (auth)/                   # 認証ページ（サイドバーなし、専用レイアウト）
    (dashboard)/              # 管理画面（サイドバー + ヘッダー付きレイアウト）
  components/
    ui/                       # 汎用UIコンポーネント（Button, Input等）
    layout/                   # レイアウト系（AppHeader, AppSidebar, Backdrop等）
    features/                 # 機能固有のUIコンポーネント
      {feature}/              #   例: auth/SignInForm.tsx, ecommerce/EcommerceMetrics.tsx
  features/                   # ロジックのみ（レンダリングなし）
    {feature}/
      {feature}.context.tsx   #   状態管理（React Context）
  hooks/                      # 共有カスタムフック
  icons/                      # SVGアイコン（@svgr/webpack）
  libs/                       # ユーティリティ（APIクライアント等）
```

### 依存の方向

```
app/ → components/ → features/(ロジック)
                   → hooks/
                   → icons/
```

上位から下位への一方向のみ。`features/`（ロジック）はUIに依存しない。

### 設計原則

| 原則 | 内容 |
|---|---|
| **ルートファイルは薄く** | `app/`にはビジネスロジックを書かず、コンポーネントの組み合わせのみ |
| **features/ = ロジック層** | 状態管理・型定義を機能単位で凝集。レンダリングは持たない |
| **components/ = UI層** | 見た目を担当。`features/`のロジックはprops経由で受け取る |
| **状態管理はfeatures内** | Context等のstateは各featureに配置 |

### コンポーネントの分類基準

| 層 | 配置するもの | 依存ルール |
|---|---|---|
| **ui/** | propsだけで動く汎用パーツ。ビジネスロジックを持たない | 他の層に依存しない |
| **features/** | 特定のドメイン・機能に紐づくコンポーネント | `ui/`と`layout/`を使ってよい |
| **layout/** | ページの構造やレイアウトを決めるコンポーネント | `ui/`を使ってよい |

**判断基準:** ドメイン知識なしで動く → `ui/` / レイアウト系 → `layout/` / それ以外 → `features/{domain}/`

## API 設計方針

- Admin が利用する API はすべて `/api/admin/` プレフィックスを付与する
- ダミーデータ: 環境変数 `ADMIN_USE_DUMMY=true`（API 側の `.env.local`）で DB 接続なしのダミーデータモードに切替可能

### API 通信方式

ブラウザから Express API を直接 fetch しない。Next.js の Server Components / Server Actions / Route Handlers を経由してサーバー間通信する。

```
[初期表示] Server Component → Express API（サーバー間通信、CORS不要）
[CRUD操作] Client Component → Server Action → Express API（サーバー間通信）
```

**メリット:**
- CORS 設定が不要（サーバー間通信のため）
- 認証トークンをサーバー側で管理できる
- Express API を内部ネットワークに閉じられる

| 用途 | 方式 |
|------|------|
| ダッシュボードの初期データ表示 | Server Component で直接取得 |
| テーブルの一覧取得 | Server Component で直接取得 |
| 作成・更新・削除（モーダル操作等） | Server Action |
| 外部公開が必要なAPI | Route Handler（必要になった場合のみ） |

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
