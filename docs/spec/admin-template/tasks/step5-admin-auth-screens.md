# step5-admin-auth-screens

admin の画面側の認証を作る。サインイン画面・Google の callback・dev ログイン・cookie・proxy による認証ガード・401 で refresh する api-client・ログアウト。api 側は step4 で作ってある。

この step の後は、サインインしないと admin のどの画面も開けない。

設計: [`../README.md`](../README.md#admin-認証) / [仕様: admin のサインイン](../README.md#admin-のサインイン)

## 対応内容

### 変更するファイル

```
apps/admin/
├── .env.local                              # dotenvx で GOOGLE_CLIENT_ID / NEXT_PUBLIC_APP_URL を足す
├── src/env.ts                              # GOOGLE_CLIENT_ID / NEXT_PUBLIC_APP_URL
├── src/proxy.ts                            # 新設 認証ガード
├── src/libs/auth.ts                        # 新設 cookie 操作
├── src/libs/auth-actions.ts                # 新設 logoutAction
├── src/libs/api-client.ts                  # 認証ヘッダーと 401 → refresh → 再試行
├── src/app/(auth)/signin/page.tsx          # 作り直す
├── src/app/(auth)/signin/actions.ts        # 新設 startGoogleOAuth
├── src/app/(auth)/demo/signin/page.tsx     # 新設 今の email + パスワードのフォームをデモへ
├── src/app/api/auth/callback/google/route.ts  # 新設
├── src/app/api/dev/login/route.ts          # 新設
├── src/components/features/auth/GoogleSignInButton.tsx  # 新設
├── src/components/demo/auth/SignInForm.tsx # components/features/auth/ から移す
└── src/components/features/header/UserDropdown.tsx      # 「ログアウト」を logoutAction に繋ぐ
```

ドキュメント: `apps/admin/CLAUDE.md`（env の表・認証の節）、`docs/onboarding/auth.md`（admin の認証の節を足す。README の「admin 認証」の表と関連ファイル）。

### env

```typescript
/** src/env.ts に足す */

  /**
   * Google OAuth のクライアント ID（web と同じクライアントを使う）
   */
  GOOGLE_CLIENT_ID: z.string().default("dummy"),

  /**
   * admin 自身の origin（OAuth の redirect_uri を組み立てる）
   */
  NEXT_PUBLIC_APP_URL: z.string().url(),
```

```bash
cd apps/admin
pnpm exec dotenvx set NEXT_PUBLIC_APP_URL "http://localhost:3030" -f .env.local
pnpm exec dotenvx set GOOGLE_CLIENT_ID "<web と同じ値>" -f .env.local
```

Google Cloud の OAuth クライアントの「承認済みのリダイレクト URI」に `http://localhost:3030/api/auth/callback/google`（と各環境の admin の URL）を足す。手順を `apps/admin/CLAUDE.md` に書く。

### cookie（`src/libs/auth.ts`）

`apps/web/src/libs/auth.ts` と同じ作りで、名前だけ変える。

```typescript
/**
 * web（app_*）と同じホストで動くと cookie を共有するため、名前を分ける
 */
export const ACCESS_TOKEN_COOKIE = "admin_access_token"
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token"
export const OAUTH_STATE_COOKIE = "admin_oauth_state"
export const OAUTH_REDIRECT_COOKIE = "admin_oauth_redirect"
```

`setAuthCookies` / `clearAuthCookies` / `getAccessToken` / `getRefreshToken` も web と同じ（httpOnly / `sameSite: "lax"` / production は `secure`、access 15 分・refresh 7 日）。

### api-client（`src/libs/api-client.ts`）

`apps/web/src/libs/api-client.ts` と同じ作りにする（`ApiClientError`、Bearer の付与、401 なら 1 回だけ refresh して再試行、refresh に失敗したら cookie を消す）。refresh の先は `/api/admin/auth/refresh`。

### proxy（`src/proxy.ts`）

`apps/web/src/proxy.ts` と同じ作り（cookie の有無だけを見る。access か refresh があれば通す）。

```typescript
const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/api/dev/login"]
  : []

const PUBLIC_PATHS = [
  "/signin",
  "/api/auth/callback/google",
  /** サインイン・サインアップのフォームの見本（デモ）。サインインしなくても見られる */
  "/demo/signin",
  "/demo/signup",
  ...DEV_ONLY_PUBLIC_PATHS,
]

export const config = {
  /**
   * public/ の画像は /images/... で配信される。サインイン画面の背景などを
   * サインイン前にも読めるように除外する
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
}
```

未認証は `/signin?redirect=<元のパス>` に送る。サインイン後は `redirect` の値に戻す（`/` で始まるパスだけを受け付け、`//` で始まるものは捨てる。オープンリダイレクト対策）。Google を経由する間は `admin_oauth_redirect` cookie（state と同じ 5 分・httpOnly）に入れておき、callback で読んで消す。

### サインイン画面

```typescript
/** src/app/(auth)/signin/actions.ts */
"use server"

/**
 * Google OAuth の開始。state を cookie に保存して Google の認可画面へ送る
 * サインイン後の戻り先（redirect）も state と一緒に cookie に入れる
 */
export const startGoogleOAuth = async (formData: FormData) => { /* web の startGoogleOAuth と同じ。redirect_uri は `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google` */ }
```

`page.tsx` は Server Component。`(auth)/layout.tsx`（TailAdmin の左右 2 分割）の左側に置く。

- 見出し「サインイン」、説明「管理画面に登録された Google アカウントでサインインしてください」
- `GoogleSignInButton`（今の `SignInForm` の Google ボタンと同じ見た目。`<form action={startGoogleOAuth}>` の submit ボタン）
- エラーは `ui/alert/Alert`（`variant="error"`）で出す

| `?error=` | 表示 |
| --- | --- |
| `not_admin` | このアカウントには管理画面の権限がありません |
| `oauth_denied` | Google アカウントへのアクセスが拒否されました |
| `state_mismatch` | セッションが切れました。もう一度お試しください |
| `auth_failed` / その他 | サインインに失敗しました。もう一度お試しください |

- production 以外では、区切り線の下に「dev admin でログイン」ボタン（`/api/dev/login` へのリンク）を出す

今の `SignInForm`（email + パスワード）は `components/demo/auth/` に移し、`/demo/signin` で見られるようにする（デモのサイドバーにも足す）。

### Google の callback（`src/app/api/auth/callback/google/route.ts`）

`apps/web` の callback と同じ流れで、呼ぶ先と失敗の扱いだけ変える。

```typescript
const apiRes = await fetch(`${env.API_URL}/api/admin/auth/google`, { /* code, redirect_uri */ })

if (apiRes.status === 403) {
  return NextResponse.redirect(new URL("/signin?error=not_admin", req.url))
}
if (!apiRes.ok) {
  return NextResponse.redirect(new URL("/signin?error=auth_failed", req.url))
}

const json = adminAuthGoogleResponseSchema.parse(await apiRes.json())
await setAuthCookies(json.access_token, json.refresh_token)
return NextResponse.redirect(new URL(redirectTo, req.url))
```

### dev ログイン（`src/app/api/dev/login/route.ts`）

`apps/web/src/app/api/dev/login/route.ts` と同じ多重ガード（Route Handler / proxy / api のそれぞれで production を弾く）。admin は 1 人なので `?as=` は取らず、`admin@dev.local` で `/api/admin/auth/dev-login` を呼ぶ。失敗したら「`pnpm --filter @repo/db db:seed` を流したか」を返す。

### ログアウト

```typescript
/** src/libs/auth-actions.ts */
"use server"

/**
 * ログアウト。api の refresh token を無効にしてから cookie を消す
 * api が失敗しても cookie は消す（手元のセッションは必ず終える）
 */
export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await apiClient.post("/api/admin/auth/logout", { refresh_token: refreshToken })
    } catch {
      /** api 失敗時も cookie はクリアする */
    }
  }
  await clearAuthCookies()
  redirect("/signin")
}
```

`UserDropdown` の「Sign out」（今は `/signin` へのリンク）を `<form action={logoutAction}>` のボタンにする。表示の中身（名前・email）は step7 で直す。

## 動作確認

`verify-web-page` skill で行う（port 3030）。

```bash
pnpm --filter @repo/db db:seed
pnpm dev
```

| 確認 | 期待 |
| --- | --- |
| cookie なしで `/`・`/users`・`/demo/charts/bar` を開く | `/signin?redirect=...` に送られる |
| `/signin` で「dev admin でログイン」 | `/` に入れる。cookie に `admin_access_token` / `admin_refresh_token`（httpOnly） |
| サインイン後に `/signin?redirect=/demo/ui/alerts` から入り直す | `/demo/ui/alerts` に戻る |
| `redirect=//evil.example.com` | `/` に戻る（外に出ない） |
| web（:3000）で alice としてログインした状態で admin を開く | admin はサインイン画面のまま（web の cookie では入れない） |
| `admin_access_token` だけを消してリロード | refresh されて画面が開き、cookie が新しくなる |
| ユーザーメニューの「ログアウト」 | `/signin` に戻り、cookie が消え、Redis の `admin_refresh_token:*` が消える |
| Google でサインイン（登録済みの email） | `/` に入れる。DB の `admins.name` / `avatar_url` / `last_signed_in_at` が更新される |
| Google でサインイン（未登録の email） | `/signin?error=not_admin` で権限が無い旨が出る |

Google を使う 2 つは、Google Cloud に redirect URI を登録した後に手で確認する。

サインイン画面の見た目は TailAdmin のデモの `/signin` と並べ、Google のボタン・見出し・説明文・エラー表示（`Alert`）の色と寸法を `getComputedStyle` で比べる（ライト / ダーク）。PR には `/signin`（エラー表示ありとなし）のスクリーンショットをデモと並べて付ける。
