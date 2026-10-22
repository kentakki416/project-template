# Admin Dashboard

Next.js 16 (App Router) を使用した管理画面アプリケーション

## 目次

- [概要](#概要)
  - [技術スタック](#技術スタック)
- [ローカルで Google でサインインする](#ローカルで-google-でサインインする)
  - [うまくいかないとき](#うまくいかないとき)
- [アーキテクチャ](#アーキテクチャ)
  - [Route Group の構成](#route-group-の構成)
  - [ディレクトリ構成](#ディレクトリ構成)
  - [依存の方向](#依存の方向)
  - [設計原則](#設計原則)
  - [コンポーネントの分類基準](#コンポーネントの分類基準)
- [ブランドを変える](#ブランドを変える)
- [デモ](#デモ)
  - [デモを消す手順](#デモを消す手順)
- [API 設計方針](#api-設計方針)
  - [API 通信方式](#api-通信方式)

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
- ApexCharts（グラフ）・FullCalendar（カレンダー）・jvectormap（地図）・react-dropzone（ファイルのドロップ）はデモだけが使う（[デモ](#デモ)）

## ローカルで Google でサインインする

サインインできるのは、`admins` テーブルに email を登録した Google アカウントだけ。画面を見るだけなら Google の設定は要らない。サインイン画面の「dev admin でログイン」で、seed の `admin@dev.local` として入れる。

前提として、Postgres を起動して migration を流しておく（[`docs/setup/api.md`](../../docs/setup/api.md) の 4・5）。

1. **Google Cloud で OAuth クライアントを用意する**

   OAuth クライアントは web と同じものを使う（api は 1 組の client ID / secret で web と admin の両方の code を交換する）。種類は「ウェブ アプリケーション」。「承認済みのリダイレクト URI」に `http://localhost:3030/api/auth/callback/google` を足す。admin は `NEXT_PUBLIC_APP_URL` の origin からこの URI を作り、Google は完全一致で照合する（各環境の値は [`CLAUDE.md` の「認証」](CLAUDE.md#認証)）。

   OAuth 同意画面がテスト中なら、サインインに使うアカウントをテストユーザーに足す。

2. **client ID と client secret を `.env.local` に入れる**

   admin と api に、同じクライアントの値を入れる。client secret は api だけが持つ。web でも Google でサインインするなら、web の `GOOGLE_CLIENT_ID` も同じクライアントにそろえ、web の redirect URI（`http://localhost:3000/api/auth/callback/google`）も登録する。

   | ファイル | キー |
   | --- | --- |
   | `apps/admin/.env.local` | `GOOGLE_CLIENT_ID` |
   | `apps/api/.env.local` | `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` |
   | `apps/web/.env.local` | `GOOGLE_CLIENT_ID`（web でも Google でサインインするとき） |

   ```bash
   # プロジェクトルートで実行する（apps/* に cd してから実行すると .env.keys のシンボリックリンクが壊れる）
   npx dotenvx set GOOGLE_CLIENT_ID "<client ID>" -f apps/admin/.env.local
   npx dotenvx set GOOGLE_CLIENT_ID "<client ID>" -f apps/api/.env.local
   npx dotenvx set GOOGLE_CLIENT_SECRET "<client secret>" -f apps/api/.env.local
   ```

   env は起動したときにしか読まないので、`pnpm dev` を起動し直す。`.env.local` は暗号化してコミットしている、チームで共有のファイル。自分用のクライアントに差し替えたときは、チームで使うと決めるまでコミットしない。

3. **サインインする Google アカウントを `admins` に登録する**

   ```bash
   pnpm --filter @repo/db admin:create --email <Google アカウントの email>
   ```

   `DATABASE_URL` を渡さなければ、ローカルの dev DB（`localhost:5433` の `project-template_dev`）に登録する。登録済みなら何もしない。dev / min / prd では GitHub Actions の「Admin Create」で登録する（[`docs/onboarding/deploy-prd.md`](../../docs/onboarding/deploy-prd.md#admin-を登録する)）。

4. **サインインする**

   `http://localhost:3030/signin` の「Google でサインイン」を押し、手順 3 で登録したアカウントを選ぶ。

### うまくいかないとき

| 症状 | 原因 |
| --- | --- |
| Google の画面に `redirect_uri_mismatch` が出る | 手順 1 の redirect URI が登録されていない。または `NEXT_PUBLIC_APP_URL` の origin と一致していない |
| Google の画面に `invalid_client` が出る | `apps/admin/.env.local` の `GOOGLE_CLIENT_ID` が間違っている。または env を変えた後に起動し直していない |
| Google の画面に `access_denied` が出て先に進めない | OAuth 同意画面がテスト中で、そのアカウントがテストユーザーに入っていない |
| サインイン画面に「このアカウントには管理画面の権限がありません」が出る | 選んだアカウントの email が `admins` に無い（手順 3）。または Google でその email が確認されていない |
| サインイン画面に「サインインに失敗しました」が出る | api が code を token に交換できなかった。api が起動しているか、api の `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` が admin と同じクライアントのものかを確かめる |

## アーキテクチャ

### Route Group の構成

- **`(auth)/`** - 認証ページ（サイドバーなし、専用レイアウト）
- **`(dashboard)/`** - 管理画面（サイドバー + ヘッダー付きレイアウト）

### ディレクトリ構成

```
src/
  app/                        # ルーティング + ページ構成（薄く保つ）
    (auth)/                   # 認証ページ（サイドバーなし、専用レイアウト）
      demo/                   #   デモ（フォームの見本）
    (dashboard)/              # 管理画面（サイドバー + ヘッダー付きレイアウト）
      demo/                   #   デモ（TailAdmin の画面と UI 部品の見本。URL は /demo/...）
  components/
    ui/                       # 汎用UIコンポーネント（Button, Input等）
    layout/                   # レイアウト系（AppHeader, AppSidebar, Backdrop等）
    features/                 # 機能固有のUIコンポーネント
      {feature}/              #   例: auth/GoogleSignInButton.tsx, header/UserDropdown.tsx
    demo/                     # デモだけが使う部品・CSS・サイドバーの項目
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

## ブランドを変える

| 変えるもの | 場所 |
| --- | --- |
| アプリ名・説明・言語・タイムゾーン | `src/config/app.ts`。サイドバー・ヘッダー・サインイン画面のロゴの文字と、タブのタイトル（`<ページ名> \| <アプリ名>`）がここから決まる |
| ロゴ | `src/components/layout/AppLogo.tsx`。既定はアプリ名の頭文字のアイコン + アプリ名。画像のロゴにするときは中身を `<Image>` に差し替える（呼び出し側は変えない） |
| favicon | `public/favicon.svg`（`src/app/layout.tsx` の `metadata.icons` で指している） |
| ブランドの色 | `src/app/globals.css` の `@theme` の `--color-brand-*` |

日時は `src/libs/date.ts` の `formatDateTime()` で、`src/config/app.ts` のタイムゾーンで表示する。Server Component はサーバーのタイムゾーン（本番は UTC のことが多い）で動くので、`toLocaleString()` を直接使わない。

## ヘッダー

ヘッダーの表示するデータは `src/app/(dashboard)/layout.tsx`（Server Component）で取り、`AdminShell` → `AppHeader` に props で渡す。

| 部品 | データ | 変えるとき |
| --- | --- | --- |
| ユーザーメニュー | サインイン中の admin（`/api/admin/me`） | メニューの項目は `src/components/features/header/UserDropdown.tsx` |
| 通知 | `src/features/notification/notification.api.ts` の `getList`（テンプレートでは常に空） | 通知を作るときは `getList` / `markAllAsRead` を api の呼び出しに差し替える。画面側は変えなくてよい |
| 検索 | layout の `search`（行き先と placeholder。入力は `?q=` で渡す） | 行き先を変える。`search` を渡さなければ検索欄を出さない |

## デモ

TailAdmin の画面（EC のダッシュボード・カレンダー・フォーム / テーブル / UI 部品 / グラフの見本・サインアップ画面など）は、URL `/demo/...` の下にまとめている。サイドバーでは「デモ」の見出しの下に並ぶ。UI 部品の使い方の見本として残しているので、実プロジェクトで要らなくなったら下の手順で消す。

| 置き場所 | 中身 |
| --- | --- |
| `src/app/(dashboard)/demo/` | サイドバー付きのデモ画面 |
| `src/app/(auth)/demo/` | サインイン・サインアップのフォームの見本 |
| `src/components/demo/` | デモの画面だけが使う部品・CSS（`demo.css`） |
| `src/components/demo/demo-nav-items.tsx` | サイドバーの「デモ」の項目 |
| `public/images/demo/` | デモだけが使う画像 |

土台（`src/components/ui/` など）はデモを import しない。lint（`import/no-restricted-paths`）で強制しているので、デモを消しても土台は壊れない。

route group（`(demo)`）ではなく URL も `/demo` に分けているのは、デモの `/profile`（プロフィールの見本）などが土台の画面と同じ URL になってぶつかるため。

### デモを消す手順

1. 上の表のディレクトリとファイルを消す
2. `src/components/layout/AppSidebar.tsx` の `demoNavSection` の import と、`navSections` からの指定を消す
3. `src/proxy.ts` の `PUBLIC_PATHS` から `/demo/signin`・`/demo/signup` を消す
4. `eslint.config.mjs` の、デモの import の制限（`import/no-restricted-paths` の設定ごと）と、`settings.tailwindcss.cssFiles` の `src/components/demo/*.css` を消す
5. デモだけが使う依存を消す: `pnpm remove @fullcalendar/core @fullcalendar/daygrid @fullcalendar/interaction @fullcalendar/react @fullcalendar/timegrid @react-jvectormap/core @react-jvectormap/world apexcharts react-apexcharts react-dropzone`（`package.json` の `overrides` も消す）
6. `.claude/skills/design-mock/SKILL.md` が参考の画面としてデモを挙げているので、参照先を実プロジェクトの画面に変える

## API 設計方針

- Admin が利用する API はすべて `/api/admin/` プレフィックスを付与する
- ローカルは docker compose の Postgres / Redis と seed のデータで動かす（`pnpm --filter @repo/db db:seed` で dev 用の admin `admin@dev.local` も入る）

### API 通信方式

ブラウザから Express API を直接 fetch しない。Next.js の Server Components / Server Actions / Route Handlers を経由してサーバー間通信する。

**メリット:**
- CORS 設定が不要（サーバー間通信のため）
- 認証トークンをサーバー側で管理できる
- Express API を内部ネットワークに閉じられる

#### データ取得（GET）

| 用途 | 方式 | 例 |
|------|------|----|
| ページの初期データ表示 | Server Component で `apiClient.get()` | ダッシュボード、一覧テーブル |
| Client Component からの動的データ取得 | Route Handler (`app/api/*/route.ts`) | タブ切替、検索、モーダル内の詳細取得 |

#### データ変更（POST/PUT/DELETE）

| 用途 | 方式 | 例 |
|------|------|----|
| フォーム送信・ボタンによる CRUD | Server Action (`"use server"`) | 作成・更新・削除モーダル |
| Server Action が適さない場合 | Route Handler | ファイルアップロード等 |

