# step5-admin-auth-screens

admin の画面側の認証を作る。サインイン画面・Google の callback・dev ログイン・cookie・proxy による認証ガードとトークンの更新（refresh）・api-client・ログアウト。api 側は step4 で作ってある。

この step の後は、サインインしないと admin のどの画面も開けない。

設計: [`../README.md`](../README.md#admin-認証) / [仕様: admin のサインイン](../README.md#admin-のサインイン)

## 対応内容

### 変更するファイル

```
apps/admin/
├── .env.local                              # dotenvx で GOOGLE_CLIENT_ID / NEXT_PUBLIC_APP_URL を足す
├── src/env.ts                              # GOOGLE_CLIENT_ID / NEXT_PUBLIC_APP_URL
├── src/proxy.ts                            # 新設 認証ガードと refresh
├── src/libs/auth-cookies.ts                # 新設 cookie の名前と属性（proxy からも使う）
├── src/libs/auth.ts                        # 新設 cookie の読み書き（server-only）
├── src/libs/safe-redirect.ts               # 新設 サインイン後の戻り先の検査
├── src/libs/api-client.ts                  # Bearer を付ける。refresh はしない
├── src/features/auth/auth.actions.ts       # 新設 logoutAction
├── src/app/(auth)/signin/page.tsx          # 作り直す
├── src/app/(auth)/signin/actions.ts        # 新設 startGoogleOAuth
├── src/app/(auth)/demo/signin/page.tsx     # 新設 今の email + パスワードのフォームをデモへ
├── src/app/api/auth/callback/google/route.ts  # 新設
├── src/app/api/dev/login/route.ts          # 新設
├── src/components/features/auth/GoogleSignInButton.tsx  # 新設
├── src/components/demo/auth/SignInForm.tsx # components/features/auth/ から移す
├── src/components/demo/demo-nav-items.tsx  # Authentication の Sign In を /demo/signin に
└── src/components/features/header/UserDropdown.tsx      # 「ログアウト」を logoutAction に繋ぐ
.claude/skills/verify-web-page/SKILL.md     # admin の確認でのログインの仕方
```

ドキュメント: `apps/admin/CLAUDE.md`（env の表・認証の節・Google Cloud の redirect URI）、`docs/onboarding/auth.md`（「Admin API は現時点は認証なし」を書き換え、admin の認証の節を足す。README の「admin 認証」の表・proxy での refresh・関連ファイル）。

### env

```typescript
/** src/env.ts に足す */

  /**
   * Google OAuth のクライアント ID（web と同じクライアントを使う）
   */
  GOOGLE_CLIENT_ID: z.string().default("dummy"),

  /**
   * admin 自身の origin（OAuth の redirect_uri と、戻り先の検査に使う）
   */
  NEXT_PUBLIC_APP_URL: z.string().url(),
```

```bash
cd apps/admin
pnpm exec dotenvx set NEXT_PUBLIC_APP_URL "http://localhost:3030" -f .env.local
pnpm exec dotenvx set GOOGLE_CLIENT_ID "<web と同じ値>" -f .env.local
```

Google Cloud の OAuth クライアントの「承認済みのリダイレクト URI」に `http://localhost:3030/api/auth/callback/google`（と各環境の admin の URL）を足す。手順を `apps/admin/CLAUDE.md` に書く。

### cookie（`src/libs/auth-cookies.ts` / `src/libs/auth.ts`）

cookie の名前と属性は `libs/auth-cookies.ts` に置く。proxy からも import するので、`next/headers` を import しない。

```typescript
/** src/libs/auth-cookies.ts */
/**
 * web（app_*）と同じホストで動くと cookie を共有するため、名前を分ける
 */
export const ACCESS_TOKEN_COOKIE = "admin_access_token"
export const OAUTH_REDIRECT_COOKIE = "admin_oauth_redirect"
export const OAUTH_STATE_COOKIE = "admin_oauth_state"
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token"
```

属性（httpOnly / `sameSite: "lax"` / production は `secure`、access 15 分・refresh 7 日）も `ACCESS_TOKEN_COOKIE_OPTIONS` / `REFRESH_TOKEN_COOKIE_OPTIONS` としてここに置く。proxy はこれを使って `NextResponse` の cookie に書く。

`libs/auth.ts` は先頭に `import "server-only"` を置き（web の `libs/auth.ts` には無いが、root の CLAUDE.md の規約に合わせる）、`next/headers` の `cookies()` で `setAuthCookies` / `clearAuthCookies` / `getAccessToken` / `getRefreshToken` を web と同じ形で作る。cookie を書く関数は Server Action と Route Handler からだけ呼ぶ（Server Component では書けない）。

### api-client（`src/libs/api-client.ts`）

`apps/web/src/libs/api-client.ts` の `ApiClientError` と Bearer の付与だけを同じにし、**401 で refresh して再試行する部分は持たない**。Server Component から呼ばれると cookie を書けず、api 側だけ refresh token が作り直されてセッションが切れるため。refresh は proxy で済ませてから画面が描かれる（README の「admin 認証」）。

- 401 は `ApiClientError(401)` を投げる。画面（step7 の layout）が受けてサインイン画面に送る

### proxy（`src/proxy.ts`）

1 つのリクエストで次の順に判定する。

```mermaid
flowchart TD
    A[リクエスト] --> B{公開のパス?}
    B -- はい --> Z[そのまま通す]
    B -- いいえ --> C{access の cookie があり<br/>期限まで 30 秒以上?}
    C -- はい --> Z
    C -- いいえ --> D{refresh の cookie がある?}
    D -- いいえ --> S[/signin?redirect=... へ]
    D -- はい --> E[POST /api/admin/auth/refresh]
    E -- 200 --> F[レスポンスに新しい cookie を付け<br/>リクエストの Cookie ヘッダーも書き換えて通す]
    E -- 401 --> S
    E -- 5xx / 通信エラー --> Z
```

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

/**
 * access token の期限が近いか。署名は検証しない（検証は api が行う）。exp を読むだけ
 */
const isExpiringSoon = (token: string): boolean => { /* payload を base64url で読み、exp - 30 秒 < 今 */ }

export const config = {
  /**
   * public/ の画像（/images/...）と favicon はサインイン前にも読めるように除外する
   */
  matcher: ["/((?!_next/static|_next/image|favicon.svg|images/).*)"],
}
```

- refresh に成功したら、`NextResponse.next({ request: { headers } })` で同じリクエストの `Cookie` ヘッダーを新しい access / refresh に書き換え、レスポンスにも `Set-Cookie` を付ける。こうすると、その画面の Server Component が新しい access token で api を呼べる
- **refresh が 401 でも cookie は消さない。** 同時に来た別のリクエスト（画面の先読みなど）が先に refresh に成功していると、この refresh token はもう無効になっている。ここで消すと、成功した側が付けた新しい cookie まで消える。そのまま `/signin?redirect=...` に送り、サインイン画面が有効な access の cookie を見つけたら `redirect` に戻す
- api が落ちている（5xx・通信エラー）ときは、そのまま通す。画面の api 呼び出しが失敗してエラー画面になる（サインイン画面に送ると、api の障害でサインインし直しを求めることになる）

### サインイン後の戻り先（`src/libs/safe-redirect.ts`）

`/` で始まるかどうかの文字列の検査だけでは、`/\evil.example.com` や `/\t/evil.example.com` が通り、ブラウザの URL の解釈で外のサイトになる。URL として解釈してから origin を比べる。

```typescript
/**
 * サインイン後の戻り先を、自分の origin の中のパスに限る（オープンリダイレクト対策）
 * 外を指すもの・解釈できないものは "/" にする
 */
export const toSafeRedirectPath = (value: string | null | undefined, appOrigin: string): string => {
  if (!value) return "/"
  try {
    const url = new URL(value, appOrigin)
    return url.origin === appOrigin ? `${url.pathname}${url.search}` : "/"
  } catch {
    return "/"
  }
}
```

proxy で `redirect` を付けるとき、サインイン画面で読むとき、`admin_oauth_redirect` cookie に入れるとき、callback で取り出すときの 4 か所で通す。

### サインイン画面

```typescript
/** src/app/(auth)/signin/actions.ts */
"use server"

/**
 * Google OAuth の開始。state と戻り先を cookie（5 分・httpOnly）に保存して Google の認可画面へ送る
 */
export const startGoogleOAuth = async (formData: FormData) => {
  /** web の startGoogleOAuth と同じ。redirect_uri は `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google` */
  /** formData の redirect は toSafeRedirectPath を通して OAUTH_REDIRECT_COOKIE に入れる */
}
```

`page.tsx` は Server Component（`searchParams` は Promise なので `await` する）。`(auth)/layout.tsx`（TailAdmin の左右 2 分割）の左側に置く。

- 有効な access の cookie があれば、`toSafeRedirectPath(redirect)` に戻す（サインイン済みでここに来た場合。proxy の refresh の競合の後もここで戻れる）
- 見出し「サインイン」、説明「管理画面に登録された Google アカウントでサインインしてください」
- `GoogleSignInButton`（今の `SignInForm` の Google ボタンと同じ見た目。`<form action={startGoogleOAuth}>` の submit ボタン。`redirect` を hidden で渡す）
- エラーは `ui/alert/Alert`（`variant="error"`）で出す

| `?error=` | 表示 |
| --- | --- |
| `not_admin` | このアカウントには管理画面の権限がありません |
| `oauth_denied` | Google アカウントへのアクセスが拒否されました |
| `state_mismatch` | セッションが切れました。もう一度お試しください |
| `auth_failed` / その他 | サインインに失敗しました。もう一度お試しください |

- production 以外では、区切り線の下に「dev admin でログイン」ボタン（`/api/dev/login` へのリンク）を出す

今の `SignInForm`（email + パスワード）は `components/demo/auth/` に移し、`/demo/signin` で見られるようにする。デモのサイドバーの「Authentication > Sign In」の行き先も `/demo/signin` に変える（step1 までは `/signin` を指している）。

### Google の callback（`src/app/api/auth/callback/google/route.ts`）

`apps/web` の callback と同じ流れで、呼ぶ先・失敗の扱い・戻り先だけ変える。

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

/** 戻り先は cookie から取り出して消し、もう一度 toSafeRedirectPath を通す */
const redirectTo = toSafeRedirectPath(store.get(OAUTH_REDIRECT_COOKIE)?.value, env.NEXT_PUBLIC_APP_URL)
store.delete(OAUTH_REDIRECT_COOKIE)
return NextResponse.redirect(new URL(redirectTo, req.url))
```

### dev ログイン（`src/app/api/dev/login/route.ts`）

`apps/web/src/app/api/dev/login/route.ts` と同じ多重ガード（Route Handler / proxy / api のそれぞれで production を弾く）。admin は 1 人なので `?as=` は取らず、`admin@dev.local` で `/api/admin/auth/dev-login` を呼ぶ。失敗したら「`pnpm --filter @repo/db db:seed` を流したか」を返す。

### ログアウト（`src/features/auth/auth.actions.ts`）

ヘッダーのユーザーメニュー（全画面）から呼ぶので、`apps/web/CLAUDE.md` の置き場所の規約（複数の画面で同じ action は `features/{feature}/{feature}.actions.ts`）に従う。

```typescript
"use server"

/**
 * ログアウト。api の refresh token を無効にしてから cookie を消す
 * logout の api は公開のパス（refresh token で本人を確かめる）なので、access token が切れていても呼べる
 * api が失敗しても cookie は消す（手元のセッションは必ず終える）
 */
export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await apiClient.post("/api/admin/auth/logout", { refresh_token: refreshToken })
    } catch {
      /** api 失敗時も Cookie はクリアする */
    }
  }
  await clearAuthCookies()
  redirect("/signin")
}
```

`UserDropdown` の「Sign out」（今は `/signin` へのリンク）を `<form action={logoutAction}>` の中の submit ボタンにする。見た目は今の項目と同じクラスの素の `<button type="submit">` にする（`DropdownItem` の `tag="button"` は `preventDefault` するので submit できない）。表示の中身（名前・email）は step7 で直す。

### verify-web-page skill

`.claude/skills/verify-web-page/SKILL.md` の「admin は認証なし」の記述を消し、admin の画面を確認するときは先に `http://localhost:3030/api/dev/login` を開いてログインする手順にする（web 用の `app_access_token` の cookie の注入は admin では効かない）。

## 動作確認

`verify-web-page` skill で行う（port 3030）。

```bash
pnpm --filter @repo/db db:seed
pnpm dev
```

| 確認 | 期待 |
| --- | --- |
| cookie なしで `/`・`/demo/charts/bar` を開く | `/signin?redirect=...` に送られる |
| `/signin` で「dev admin でログイン」 | `/` に入れる。cookie に `admin_access_token` / `admin_refresh_token`（httpOnly） |
| サインイン後に `/signin?redirect=/demo/ui/alerts` を開く | `/demo/ui/alerts` に戻る |
| `redirect` に `//evil.example.com`・`/\evil.example.com`・`https://evil.example.com` | どれも `/` に戻る（外に出ない） |
| web（:3000）で alice としてログインした状態で admin を開く | admin はサインイン画面のまま（web の cookie では入れない） |
| `admin_access_token` だけを消して画面を開く | proxy が refresh し、画面が開く。cookie が新しくなり、Redis の古い `admin_refresh_token:{jti}` が消えている |
| `admin_refresh_token` を壊れた値にし、`admin_access_token` も消して画面を開く | `/signin?redirect=...` に送られる |
| api を止めて、`admin_access_token` だけを消して画面を開く | サインイン画面に送られない（エラー画面になる） |
| ユーザーメニューの「ログアウト」 | `/signin` に戻り、cookie が消え、Redis の `admin_refresh_token:*` が消える |
| Google でサインイン（登録済みの email） | `/` に入れる。DB の `admins.name` / `avatar_url` / `last_signed_in_at` が更新される |
| Google でサインイン（未登録の email） | `/signin?error=not_admin` で権限が無い旨が出る |
| favicon と `/images/...` の画像 | サインイン前でも読める（サインイン画面にリダイレクトされない） |

Google を使う 2 つは、Google Cloud に redirect URI を登録した後に手で確認する。

サインイン画面の見た目は TailAdmin のデモの `/signin` と並べ、Google のボタン・見出し・説明文・エラー表示（`Alert`）の色と寸法を `getComputedStyle` で比べる（ライト / ダーク）。PR には `/signin`（エラー表示ありとなし）のスクリーンショットをデモと並べて付ける。
