# apps/admin

Next.js 16 (App Router) の admin ダッシュボード（port 3030）。Tailwind CSS v4 + PostCSS。

## Commands

```bash
pnpm dev          # http://localhost:3030 で起動
pnpm build        # 本番ビルド
pnpm start        # 本番サーバー起動
```

## アーキテクチャ

`apps/web` と同じ App Router / API 通信ルールに従う（詳細は `apps/web/CLAUDE.md` を参照）。Admin 固有の方針のみここに記載する。

- 型・スキーマは `@repo/api-schema/admin/` から import（Admin 固有のレスポンスが必要な場合）
- Admin 向け API は `/api/admin/` 配下を呼び出す（API 側の方針は `apps/api/CLAUDE.md` の「Admin API」参照）

## 土台とデモ

TailAdmin の画面は「デモ」として URL `/demo/...` の下に分けてある（`src/app/(dashboard)/demo/`・`src/app/(auth)/demo/`・`src/components/demo/`・`public/images/demo/`）。実プロジェクトで消すときの手順は `README.md` の「デモを消す手順」。

- **新しい画面は土台に作る**: `src/app/(dashboard)/{feature}/`。サイドバーの項目は `src/components/layout/nav-items.tsx` の `mainNavSection` に足す
- **土台からデモを import しない**（lint の `import/no-restricted-paths` で落ちる）。デモの部品を使いたくなったら、props で動く形にして `src/components/ui/` に移す
- デモだけが使う CSS は `src/components/demo/demo.css`（`(dashboard)/demo/layout.tsx` で読み込む）。`globals.css` に足さない

## 環境変数

`src/env.ts` に Zod スキーマをインラインで定義し、import 時に `safeParse` → 失敗なら `process.exit(1)`。先頭で `import "server-only"` しているので client component からは import できない。

| 変数 | 必須 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `API_URL` | no | `http://localhost:8080` | Express API の origin |
| `GOOGLE_CLIENT_ID` | no | `dummy` | Google OAuth のクライアント ID（web と同じクライアント） |
| `NEXT_PUBLIC_APP_URL` | yes | - | admin 自身の URL（OAuth の redirect_uri とサインイン後の戻り先の検査に使う）。末尾の `/` は付いていてもよい |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |

値は `.env.local` に置き、**dotenvx で暗号化して git にコミットする**（api / web / cron / worker と同じ方式）。復号鍵は root の `.env.keys`（git 管理外）で、各 app の `.env.keys` はそこへの symlink。公開鍵は全 app で共有している。

`dev` / `build` / `start` はいずれも `dotenvx run -f .env.local -- ` を通す。

```bash
# 値を追加・変更するときは手書きせず dotenvx を使う
cd apps/admin && pnpm exec dotenvx set API_URL "http://localhost:8080" -f .env.local
```

## API 接続

admin は DB を直接触らず、必ず Express API を経由する。

1. Server Component・Server Action・Route Handler から `src/libs/api-client.ts` の `apiClient` を呼ぶ（`server-only` なので client component からは import できない）。admin の access token を Bearer で付ける
2. レスポンスは `@repo/api-schema` の `admin/` のスキーマで parse する。**独自に型を書かない**
3. client component にデータが必要な場合は Server Component で取得して props で渡す

**API に繋いだ画面の見本はユーザー管理**（`src/app/(dashboard)/users/`・`src/features/user/`・`src/components/features/user/`）。一覧の検索・絞り込み・ページングは `DataTable` の `server` モードで、条件を URL の検索パラメータ（`q` / `page` / `per_page` / 絞り込みの key）に持つ。画面（Server Component）は `searchParams` を api のクエリに変換して呼ぶ（不正な値は既定値に戻し、api の 400 にしない）。データが少なく api で絞らない表は、`server` を渡さない client モードで使う（見本は `/demo/tables/data-table`）。

`@repo/*` のうち admin が import できるのは `@repo/api-schema` だけで、これは lint で強制している（`@repo/eslint-config/frontend-boundary`）。

## ヘッダー

`src/app/(dashboard)/layout.tsx`（Server Component）がサインイン中の admin（`/api/admin/me`）と通知を取り、`AdminShell`（client）→ `AppHeader` に props で渡す。layout で `/api/admin/me` を呼ぶので、画面を直接開いたとき・再読み込み（`router.refresh` を含む）のときは api が token を確かめる（proxy は期限しか見ない）。**クライアント側の遷移では layout は描き直されないので、機密を出す画面は自分で api を呼ぶ。**通知が取れなくても画面は出す（空で続ける）。通知の元は `src/features/notification/notification.api.ts` を差し替える（`README.md` の「ヘッダー」）。

## 認証

一般ユーザー（web）とは別の、admin 専用の認証。`admins` に登録された Google アカウントだけがサインインできる（流れと理由は `docs/onboarding/auth.md` の「admin の認証」、設計は `docs/spec/admin-template/README.md` の「admin 認証」）。

- cookie は `admin_access_token` / `admin_refresh_token` / `admin_oauth_state` / `admin_oauth_redirect`（名前と属性は `src/libs/auth-cookies.ts`、読み書きは `src/libs/auth.ts`）。web の `app_*` と同じホストで動くと共有されるので、名前を分けている
- **`src/proxy.ts` は cookie の有無と期限（exp）しか見ない UX 用のガード。** 署名は api が確かめる。api を呼ばずに機密を描く画面を作らない（偽の cookie でも画面までは開ける）
- **access token の更新（refresh）は `src/proxy.ts` だけが行う。** `apiClient` は refresh しない（Server Component の中では cookie を書けず、セッションが切れる）
- `apiClient` は api の 401 で `/api/auth/signout`（cookie を消してサインイン画面へ送る）に redirect する。redirect は例外で実現しているので、**認証必須の API の呼び出しを try/catch で囲むときは catch の先頭で `unstable_rethrow(error)` する**
- サインインの前に開ける画面・Route Handler は `src/proxy.ts` の `PUBLIC_PATHS` に足す。公開のパスで token を更新するのはサインイン画面だけ
- サインイン後の戻り先は `src/libs/safe-redirect.ts` の `resolveSafeRedirectPath` を必ず通す（外のサイトに飛ばさない）
- ログアウトは `src/features/auth/auth.actions.ts` の `logoutAction`
- ローカルでは `http://localhost:3030/api/dev/login` を開くと、seed で入れた `admin@dev.local` としてログインできる（production では 404）

Google Cloud の OAuth クライアント（web と同じもの）の「承認済みのリダイレクト URI」に、admin の callback を足す。

| 環境 | redirect URI |
| --- | --- |
| ローカル | `http://localhost:3030/api/auth/callback/google` |
| 各環境 | `{NEXT_PUBLIC_APP_URL の origin}/api/auth/callback/google` |

## 動作確認（必須）

UI コードを実装・修正したら **必ず Playwright MCP で実画面の動作確認** を行う（詳細は `apps/web/CLAUDE.md` の「動作確認（必須）」セクションを参照）。port は 3030。`pnpm build` だけで「動作確認済み」と報告するのは禁止。

## PR 作成時の before/after スクショ（必須）

見た目に影響する Admin の PR も `docs/screenshots/{feature}/{before,after}.png` を PR 本文に含める（詳細は `apps/web/CLAUDE.md` の「PR 作成時の before/after スクショ（必須）」セクションを参照）。
