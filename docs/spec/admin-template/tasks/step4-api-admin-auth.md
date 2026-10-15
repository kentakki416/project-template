# step4-api-admin-auth

admin 認証の DB・api・鍵の配布・admin の登録コマンドを作る。admin の画面側（サインイン画面・cookie・proxy）は step5。

この step の後は、api に admin のトークンで入れる（curl とテストで確認する）。admin の画面はまだ認証なしで開ける。

設計: [`../README.md`](../README.md#admin-認証) / [鍵の配布](../README.md#admin-の-jwt-の鍵の配布) / [登録コマンド](../README.md#admin-の登録コマンド) / [ADMIN_USE_DUMMY の廃止](../README.md#admin_use_dummy-の廃止)

## 対応内容

### 変更するファイル

```
packages/domain/src/
├── rules/email.ts                    # 新設 normalizeEmail
├── types/admin.ts                    # 新設 Admin
└── index.ts
packages/db/
├── Dockerfile.migration              # @repo/db の依存（@repo/domain）もビルドする
├── package.json                      # @repo/domain を dependencies に、admin:create を scripts に
├── src/drizzle/schema/admin.ts       # 新設
├── src/drizzle/schema/index.ts
├── drizzle/migrations/<timestamp>_add_admins/   # db:generate で生成
├── drizzle/create-admin.ts           # 新設 admin:create コマンド
└── drizzle/seed.ts                   # dev 用 admin を足す
packages/logger/src/context.ts        # LogContext に adminId を足す
packages/schema/src/api-schema/
├── admin/auth.ts                     # 新設
├── admin/me.ts                       # 新設
├── admin/index.ts                    # 新設
└── index.ts
apps/api/
├── src/env.ts                        # JWT_ADMIN_* を足し、ADMIN_USE_DUMMY を消す
├── src/const/index.ts                # ADMIN_PATH_PREFIX / ADMIN_PUBLIC_PATHS
├── src/client/google-oauth.ts        # verified_email を取る
├── src/lib/is-path-under-prefix.ts   # 新設（auth.ts の matchesPathPrefix を移して改名）
├── src/lib/admin-jwt.ts              # 新設
├── src/middleware/auth.ts            # /api/admin を見ない
├── src/middleware/admin-auth.ts      # 新設
├── src/middleware/request-logger.ts  # 完了のログに adminId を足す
├── src/repository/admin-repository.ts            # 新設 interface
├── src/repository/index.ts                       # admin-repository を足す
├── src/repository/drizzle/admin-repository.ts    # 新設
├── src/repository/drizzle/index.ts               # admin-repository を足す
├── src/repository/redis/refresh-token-repository.ts  # キーの接頭辞を受け取る
├── src/service/admin-auth-service.ts # 新設
├── src/service/admin-service.ts      # 新設
├── src/service/auth-service.ts       # TokenGenerators / REFRESH_TTL_SECONDS を export
├── src/controller/admin/auth/{google,refresh,logout,dev-login}.ts  # 新設
├── src/controller/admin/me/get.ts    # 新設
├── src/routes/admin-router.ts        # 新設
├── src/index.ts                      # DI
├── .env.local                        # dotenvx で JWT_ADMIN_* を足す
└── test/...                          # 後述
infra/terraform/aws/env/{dev,min,prd}/main.tf
scripts/deploy/seed-secrets.sh
.github/actions/run-one-shot-task/action.yml      # command 入力
.github/actions/run-deployed-migration/action.yml # command 入力を渡す
.github/workflows/admin-create.yml               # 新設
.github/workflows/deploy-aws-min.yml
turbo.json
```

ドキュメント: `apps/api/CLAUDE.md`（Admin API 設計方針を実装に合わせる）、`docs/onboarding/deploy-prd.md`（admin の登録手順）、`apps/admin/CLAUDE.md` / `apps/admin/README.md`（`ADMIN_USE_DUMMY` の記述を消す）。`docs/onboarding/auth.md` は画面までそろう step5 で書く。

### `packages/domain`

```typescript
/** src/types/admin.ts */

/**
 * 管理画面にサインインできる人
 */
export type Admin = {
  id: number
  avatarUrl: string | null
  /**
   * 小文字にそろえた email
   */
  email: string
  lastSignedInAt: Date | null
  name: string | null
  createdAt: Date
  updatedAt: Date
}
```

```typescript
/** src/rules/email.ts */

/**
 * email の大文字小文字と前後の空白の差をなくす。admins の照合と登録で同じ形にそろえる
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()
```

`index.ts` に `normalizeEmail` と `Admin` をファイル名順で足す。

### `packages/db`

`package.json` の `dependencies` に `"@repo/domain": "workspace:^"`、`scripts` に `"admin:create": "tsx drizzle/create-admin.ts"` を足す。`@repo/domain` は `dist/` を読むので、`db:generate` / `db:seed` / `admin:create` の前に `@repo/domain` をビルドしておく（root の `pnpm build` で順に解決される）。

`Dockerfile.migration` のビルドの行に `@repo/db` の依存を足す（今は `@repo/data-warehouse` の依存だけをビルドしており、`@repo/domain` の `dist/` が無いまま `admin:create` が落ちる）。

```dockerfile
RUN pnpm turbo run build --filter=@repo/data-warehouse^... --filter=@repo/db^...
```

```typescript
/** src/drizzle/schema/admin.ts */
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { timestamps } from "./columns"

/**
 * 管理画面にサインインできる人（事前登録制。users とは関係を持たない）
 */
export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    avatarUrl: text("avatar_url"),
    /**
     * 小文字にそろえて保存する（normalizeEmail）
     */
    email: text("email").notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { mode: "date", precision: 3 }),
    name: text("name"),
    ...timestamps,
  },
  (table) => [uniqueIndex("admins_email_key").on(table.email)],
)
```

`schema/index.ts` に `export * from "./admin"` を足し、`pnpm --filter @repo/db db:generate --name add_admins` で migration を作る。

```typescript
/** drizzle/create-admin.ts */
/* eslint-disable no-console */
import { parseArgs } from "node:util"

import { normalizeEmail } from "@repo/domain"

import { createDrizzleClient } from "../src/drizzle/client"
import { admins } from "../src/drizzle/schema"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

/**
 * admins に email を登録する。既にあれば何もしない
 *
 * 使い方: pnpm --filter @repo/db admin:create --email someone@example.com
 * 本番は .github/workflows/admin-create.yml から migration イメージで流す
 */
const main = async () => {
  const { values } = parseArgs({ options: { email: { type: "string" } } })
  if (!values.email || !EMAIL_PATTERN.test(values.email)) {
    throw new Error("Usage: admin:create --email <email>")
  }
  const email = normalizeEmail(values.email)

  const db = createDrizzleClient()
  try {
    const [created] = await db
      .insert(admins)
      .values({ email })
      .onConflictDoNothing({ target: admins.email })
      .returning({ id: admins.id })
    console.log(created ? `Created admin (id=${created.id})` : "Admin already exists")
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- ログに email を出さない（Actions のログに入力値は残るが、コマンドの出力にまで重ねない）

`seed.ts` に dev 用の admin を足す（production では seed 自体がスキップされる）。

```typescript
const DEV_ADMIN_EMAIL = "admin@dev.local"

const seedDevAdmin = async () => {
  await db
    .insert(admins)
    .values({ email: DEV_ADMIN_EMAIL, name: "Admin (dev)" })
    .onConflictDoNothing({ target: admins.email })
  console.log(`Seeded dev admin: ${DEV_ADMIN_EMAIL}`)
}
```

### `packages/schema`

`api-schema/admin/` を新設し、`api-schema/index.ts` に `export * from "./admin"` を足す（ファイル名順）。リクエストが一般ユーザーの API と同じものは re-export する。

```typescript
/** api-schema/admin/auth.ts */
import { z } from "zod"

import {
  authDevLoginRequestSchema,
  authGoogleRequestSchema,
  authLogoutRequestSchema,
  authLogoutResponseSchema,
  authRefreshRequestSchema,
  authRefreshResponseSchema,
} from "../auth"

// ========================================================
// POST /api/admin/auth/google - admin の Google OAuth 認証
// ========================================================

/**
 * 一般ユーザーの Google 認証と同じ（code と redirect_uri）
 */
export const adminAuthGoogleRequestSchema = authGoogleRequestSchema

/**
 * admin の Google 認証のレスポンス。admins に登録が無い email は 403
 */
export const adminAuthGoogleResponseSchema = z.object({
  access_token: z.string(),
  admin: z.object({
    id: z.number(),
    avatar_url: z.string().nullable(),
    email: z.string(),
    name: z.string().nullable(),
  }),
  refresh_token: z.string(),
})

/**
 * POST /api/admin/auth/dev-login / refresh / logout も同じ形で、レスポンスごとに z.object を書き下す
 * （packages/schema/CLAUDE.md の「共通スキーマは作らない」。既存の auth.ts もそうしている）
 */
```

```typescript
/** api-schema/admin/me.ts */

// ========================================================
// GET /api/admin/me - サインイン中の admin
// ========================================================

/**
 * サインイン中の admin のレスポンススキーマ
 */
export const getAdminMeResponseSchema = z.object({
  id: z.number(),
  avatar_url: z.string().nullable(),
  email: z.string(),
  last_signed_in_at: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.string(),
})

export type GetAdminMeResponse = z.infer<typeof getAdminMeResponseSchema>
```

各スキーマに `z.infer` の型を並べる（`packages/schema/CLAUDE.md`）。

### `apps/api` の env と鍵

```typescript
/** src/env.ts（ADMIN_USE_DUMMY を消し、JWT の鍵の並びに足す） */

  /**
   * admin の Access Token の署名鍵。一般ユーザーの鍵と分け、user のトークンを admin で通さない
   */
  JWT_ADMIN_ACCESS_SECRET: z.string().min(32),

  JWT_ADMIN_REFRESH_SECRET: z.string().min(32),
```

```bash
cd apps/api
pnpm exec dotenvx set JWT_ADMIN_ACCESS_SECRET "$(openssl rand -hex 32)" -f .env.local
pnpm exec dotenvx set JWT_ADMIN_REFRESH_SECRET "$(openssl rand -hex 32)" -f .env.local
```

`test/vitest.setup.ts` に 32 文字以上の既定値（一般ユーザーの鍵とは別の値）、`turbo.json` の `test:ci.env` に 2 つのキーを足す。

admin の鍵が一般ユーザーの鍵と同じ値なら起動を止める（写し間違えると、鍵を分けた意味が無くなるため）。

```typescript
/** src/env.ts の apiEnvSchema の末尾 */
  .refine(
    (env) => env.JWT_ADMIN_ACCESS_SECRET !== env.JWT_ACCESS_SECRET && env.JWT_ADMIN_REFRESH_SECRET !== env.JWT_REFRESH_SECRET,
    { message: "admin の JWT の鍵は一般ユーザーの鍵と別の値にする", path: ["JWT_ADMIN_ACCESS_SECRET"] },
  )
```

```typescript
/** src/lib/admin-jwt.ts */

export type AdminAccessTokenPayload = {
  adminId: number
  exp?: number
  iat?: number
}

export type AdminRefreshTokenPayload = {
  adminId: number
  exp?: number
  iat?: number
  jti: string
}

/**
 * admin の Access Token を生成する。有効期限は一般ユーザーと同じ env を使う
 */
export const generateAdminAccessToken = (adminId: number): string =>
  jwt.sign({ adminId }, JWT_ADMIN_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION })

/**
 * admin の Access Token を検証する。payload の adminId が数値でなければ失敗にする
 * （鍵を写し間違えて user のトークン `{ userId }` が署名を通っても、ここで落とす）
 */
export const verifyAdminAccessToken = (token: string): AdminAccessTokenPayload | null => {
  try {
    const payload = jwt.verify(token, JWT_ADMIN_ACCESS_SECRET)
    if (typeof payload !== "object" || typeof payload.adminId !== "number") return null
    return payload as AdminAccessTokenPayload
  } catch {
    return null
  }
}

/** generateAdminRefreshToken / verifyAdminRefreshToken も同じ形で作る（refresh は jti も文字列であることを確かめる） */
```

### `apps/api` の Google クライアント

`googleUserInfoResponseSchema` に `verified_email: z.boolean().optional()` を足し、`GoogleUserInfo` に `emailVerified: boolean`（`data.verified_email === true`）を足す。必須にすると、Google が項目を返さなかったときに一般ユーザーのサインインまで 500 になるため、無いときは「未確認」として扱う。既存のテストの `GoogleUserInfo` のモックにも値を足す。

### `apps/api` のミドルウェア

`auth.ts` の `matchesPathPrefix` を `lib/is-path-under-prefix.ts` に移し、boolean を返す関数の命名規約（`is` で始める）に合わせて `isPathUnderPrefix` に改名して、両方のミドルウェアから使う。**Express 5 の mount と Router は URL の大文字小文字を区別しない**ので、パスの比較は小文字にそろえてから行う。

```typescript
/** src/lib/is-path-under-prefix.ts */

/**
 * 完全一致 or path segment 境界での prefix 一致をチェックする（大文字小文字は区別しない）
 *
 * Express は /API/Admin/users も /api/admin に mount した Router に渡すため、
 * 文字列のまま比べると認証の判定だけがすり抜ける
 */
export const isPathUnderPrefix = (path: string, prefix: string): boolean => {
  const p = path.toLowerCase()
  const q = prefix.toLowerCase()
  return p === q || p.startsWith(`${q}/`)
}
```

```typescript
/** src/const/index.ts */

/**
 * admin の API を mount するパス。ここから下は adminAuthMiddleware だけが認証する
 */
export const ADMIN_PATH_PREFIX = "/api/admin"

const ADMIN_DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/auth/dev-login"]
  : []

/**
 * admin の API のうち、admin の access token を求めないパス（ADMIN_PATH_PREFIX からの相対）
 * logout は refresh token で本人を確かめるので、access token が切れていても呼べるようにする
 */
export const ADMIN_PUBLIC_PATHS: readonly string[] = [
  "/auth/google",
  "/auth/logout",
  "/auth/refresh",
  ...ADMIN_DEV_ONLY_PUBLIC_PATHS,
]
```

```typescript
/** src/middleware/auth.ts の先頭 */

  /**
   * admin の API は adminAuthMiddleware が認証する。ここで user のトークンとして
   * 検証すると、admin のトークンが 401 になる。
   * 大文字小文字の違うパス（/API/ADMIN/...）もここで外れるが、admin の Router に届く前に
   * mount の中の adminAuthMiddleware を必ず通るので、user のトークンでは入れない
   */
  if (isPathUnderPrefix(req.path, ADMIN_PATH_PREFIX)) {
    return next()
  }
```

```typescript
/** src/middleware/admin-auth.ts */

export interface AdminAuthRequest extends Request {
  adminId?: number
}

/**
 * admin の Access Token で認証する。
 * index.ts で `app.use(ADMIN_PATH_PREFIX, adminAuthMiddleware, adminRouter(...))` と mount の中に置く。
 * 全体に適用して req.path で判定すると、大文字小文字の違うパスですり抜けるため。
 * ここでの req.path は mount からの相対（/auth/google など）
 * user のトークンは鍵が違うので verifyAdminAccessToken で必ず失敗する
 */
export const adminAuthMiddleware = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  if (ADMIN_PUBLIC_PATHS.some(p => isPathUnderPrefix(req.path, p))) return next()

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    const errorResponse: ErrorResponse = { error: "No token provided", status_code: 401 }
    return res.status(401).json(errorResponse)
  }

  const payload = verifyAdminAccessToken(authHeader.substring(7))
  if (!payload) {
    const errorResponse: ErrorResponse = { error: "Invalid or expired token", status_code: 401 }
    return res.status(401).json(errorResponse)
  }

  req.adminId = payload.adminId
  /**
   * requestLogger は全体に掛かっていて、ここより先に動く（userId しか積めない）。
   * 以降のログに adminId が付くよう、今のログのコンテキストに足して続きを動かす
   */
  return logContext.run({ ...logContext.getStore(), adminId: payload.adminId }, () => next())
}
```

### `apps/api` の Repository

```typescript
/** src/repository/admin-repository.ts */

/**
 * サインインしたときに更新する値。profile は Google から取った名前とアイコン（dev ログインでは渡さず、今の値のまま）
 */
export type RecordAdminSignInInput = {
  profile?: { avatarUrl: string | null; name: string }
  signedInAt: Date
}

/**
 * admin リポジトリのインターフェース
 */
export interface AdminRepository {
  findByEmail(email: string): Promise<Admin | null>
  findById(id: number): Promise<Admin | null>
  recordSignIn(id: number, data: RecordAdminSignInInput): Promise<Admin>
}
```

`DrizzleAdminRepository` は `DrizzleUserRepository` と同じ形で作る（`_toDomainAdmin` で row → domain）。`recordSignIn` は `last_signed_in_at` と、`profile` があれば `name` / `avatar_url` を更新して `returning()` する。

`IoRedisRefreshTokenRepository` はキーの接頭辞をコンストラクタで受け取る（既定は今の `refresh_token`）。admin 用は `index.ts` で `new IoRedisRefreshTokenRepository(redis, "admin_refresh_token")` として作る。

### `apps/api` の Service

`auth-service.ts` の `TokenGenerators` / `RefreshVerifier` / `RefreshTokensSuccess` 型と `REFRESH_TTL_SECONDS` を export する。logout は admin でも `service.auth.logout` をそのまま使い、refresh は admins にいるかを確かめる `refreshAdminTokens` を通す。

```typescript
/** src/service/admin-auth-service.ts */

export type AuthenticateAdminSuccess = {
  accessToken: string
  admin: Admin
  refreshToken: string
}

type Repositories = {
  adminRepository: AdminRepository
  refreshTokenRepository: RefreshTokenRepository
}

/**
 * admin の Google 認証
 *
 * Google で確認済みの email が admins に登録されていればトークンを発行する。
 * 未確認・未登録は 403。admins の行はここでは作らない（事前登録制）
 */
export const authenticateAdminWithGoogle = async (
  input: { code: string; redirectUri: string },
  repo: Repositories,
  googleAuthClient: IGoogleOAuthClient,
  tokenGenerators: TokenGenerators,
): Promise<Result<AuthenticateAdminSuccess>> => {
  const googleUser = await googleAuthClient.getUserInfo(input.code, input.redirectUri)
  if (!googleUser.emailVerified) {
    return err(forbiddenError("Google email is not verified"))
  }

  const admin = await repo.adminRepository.findByEmail(normalizeEmail(googleUser.email))
  if (!admin) {
    /** email は PII なのでログに出さない */
    logger.info("AdminAuthService: Google account is not an admin", { googleId: googleUser.id })
    return err(forbiddenError("Not an admin"))
  }

  const signedInAdmin = await repo.adminRepository.recordSignIn(admin.id, {
    profile: { avatarUrl: googleUser.picture ?? null, name: googleUser.name },
    signedInAt: new Date(),
  })

  return ok({ ...(await issueAdminTokens(admin.id, repo, tokenGenerators)), admin: signedInAdmin })
}

/**
 * 開発環境専用の admin ログイン。seed 済みの admin（admin@dev.local）を email で引く
 * production のガードは呼び出し側（index.ts / router / controller / ADMIN_PUBLIC_PATHS）で行う
 */
export const loginAsDevAdmin = async (...) => { /* 見つからなければ 404。見つかれば recordSignIn(admin.id, { signedInAt }) で最終サインイン日時だけを更新する */ }

/**
 * admin の Refresh Token のローテーション
 *
 * auth-service の refreshTokens の前に、admin がまだ admins にいるかを確かめる。
 * 確かめないと、admins から消した admin も refresh のたびに 7 日延びて使い続けられる。
 * いなければ jti を消して 401
 */
export const refreshAdminTokens = async (
  input: { refreshToken: string },
  repo: Repositories,
  verifier: RefreshVerifier,
  generators: TokenGenerators,
): Promise<Result<RefreshTokensSuccess>> => {
  const payload = verifier(input.refreshToken)
  if (payload && !(await repo.adminRepository.findById(payload.userId))) {
    await repo.refreshTokenRepository.delete(payload.jti)
    return err(unauthorizedError("Admin no longer exists"))
  }
  return refreshTokens(input, { refreshTokenRepository: repo.refreshTokenRepository }, verifier, generators)
}

/** issueAdminTokens: generateAccessToken / generateRefreshToken して refresh の jti を保存する（authenticateAdminWithGoogle と loginAsDevAdmin で共有） */
```

```typescript
/** src/service/admin-service.ts */

/**
 * admin を ID で取得する（GET /api/admin/me）
 */
export const getAdminById = async (
  adminId: number,
  repo: { adminRepository: AdminRepository },
): Promise<Result<Admin>> => { /* 無ければ 401（トークンの admin が admins から消された。api-client がサインイン画面に送る） */ }
```

`service/index.ts` に `export * as adminAuth from "./admin-auth-service"` と `export * as admin from "./admin-service"` を、ファイル名順（`admin-auth-service` → `admin-service`）で足す。

### `apps/api` の Controller / Router / DI

| Controller | 処理 |
| --- | --- |
| `AdminAuthGoogleController` | `service.adminAuth.authenticateAdminWithGoogle` に admin 用の発行関数（`generateAdminAccessToken` / `generateAdminRefreshToken`）と admin 用の refresh token Repository を渡す |
| `AdminAuthRefreshController` | `service.adminAuth.refreshAdminTokens` に admin 用の検証関数・発行関数・Repository を渡す。検証関数は `{ jti, userId: payload.adminId }` に詰め替える |
| `AdminAuthLogoutController` | `service.auth.logout` に admin 用の検証関数と Repository を渡す |
| `AdminAuthDevLoginController` | production なら 404（dev-login と同じ多重ガード） |
| `AdminMeGetController` | `req.adminId!` で `service.admin.getAdminById` |

```typescript
/** src/routes/admin-router.ts */

type AdminRouterControllers = {
  authDevLogin?: AdminAuthDevLoginController
  authGoogle?: AdminAuthGoogleController
  authLogout?: AdminAuthLogoutController
  authRefresh?: AdminAuthRefreshController
  meGet?: AdminMeGetController
}

/**
 * admin の API のルーター（/api/admin に mount する）
 * 認証は adminAuthMiddleware が済ませている
 */
export const adminRouter = (controllers: AdminRouterControllers): Router => {
  const router = Router()

  /** POST /api/admin/auth/google */
  if (controllers.authGoogle) {
    const controller = controllers.authGoogle
    router.post("/auth/google", async (req, res) => controller.execute(req, res))
  }
  /** dev-login / refresh / logout / GET /me も同じ形 */

  return router
}
```

`index.ts`:

- `const adminRepository = new DrizzleAdminRepository(db)`、`const adminRefreshTokenRepository = new IoRedisRefreshTokenRepository(redis, "admin_refresh_token")`
- `app.use(ADMIN_PATH_PREFIX, adminAuthMiddleware, adminRouter({ ... }))`。admin の認証ミドルウェアは全体には適用しない（mount の中に置くことで、Router に届くリクエストは必ず admin の認証を通る）。dev-login の controller は production 以外でだけ作る
- ログの `adminId`: `requestLogger` は全体に掛かっていて `adminAuthMiddleware`（mount の中）より先に動くので、`req.adminId` をその時点では読めない。途中のログは `adminAuthMiddleware` が `logContext` に `adminId` を足して積み（上のコード）、`requestLogger` の完了のログ（`res.on("finish")`）は終わった時点の `req.adminId` を読んで足す。`LogContext` に `adminId?: number` を足す

### Terraform

`env/{dev,min,prd}/main.tf` に、既存の JWT の鍵と同じ形で足す。

```hcl
resource "random_password" "jwt_admin_access_secret" {
  length  = 64
  special = false

  lifecycle {
    ignore_changes = [length, special, override_special, min_lower, min_upper, min_numeric, min_special]
  }
}
# jwt_admin_refresh_secret も同じ

module "app_secrets" {
  initial_values = {
    JWT_ADMIN_ACCESS_SECRET  = random_password.jwt_admin_access_secret.result
    JWT_ADMIN_REFRESH_SECRET = random_password.jwt_admin_refresh_secret.result
    # 既存のキーはそのまま
  }
}
```

- dev / prd は `local.secret_keys.api` に `"JWT_ADMIN_ACCESS_SECRET", "JWT_ADMIN_REFRESH_SECRET"` を足す
- min は api が Lambda なので、`deploy-aws-min.yml` の `SECRET_KEYS_JSON` に足す
- `initial_values` に足すのは新しく作る環境のため。既存の環境は `ignore_changes` で反映されないので `seed-secrets.sh` で入れる

### `scripts/deploy/seed-secrets.sh`

Secrets Manager に無いときだけ生成して足す。既にあれば触らない（作り直すと全 admin のセッションが切れる）。

先に、今の secret の読み込みの失敗を止まるように変える。今は `get-secret-value` の失敗を `'{}'` として扱っており、ここで鍵を必ず生成するようになると、読み込みに失敗したときに「生成した 2 つの鍵だけ」で secret 全体を上書きし、`DB_PASSWORD` や JWT の鍵を消してしまう。secret は Terraform が初期値付きで作るので、読めないのは異常として止めてよい。

```bash
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --query SecretString --output text) || {
  echo "ERROR: failed to read ${SECRET_NAME}. Run terraform apply first, or check AWS credentials" >&2
  exit 1
}
```

```bash
# ============================================================================
# admin の JWT の鍵: 無ければ生成する
# ============================================================================
# module.app_secrets は初回 apply でしか initial_values を書かないため、
# 鍵を足す前に作った環境にはここで入れる
echo "==> Admin JWT secrets (generated if missing)"
for key in JWT_ADMIN_ACCESS_SECRET JWT_ADMIN_REFRESH_SECRET; do
  if [ -z "$(echo "$CURRENT" | jq -r --arg k "$key" '.[$k] // empty')" ]; then
    add_kv "$key" "$(openssl rand -hex 32)" "generated"
  else
    echo "  - $key (exists, kept)"
  fi
done
```

依存コマンドの確認に `openssl` を足し、冒頭の説明にこの項目を足す。

### admin の登録 workflow

`run-one-shot-task` に `command`（JSON 配列の文字列、省略可）の入力を足し、指定されたらコンテナの起動コマンドを差し替える。コンテナ名はタスク定義の family と同じ（ecs-workload module の規約）。

```yaml
    - name: Run task and wait for it to stop
      shell: bash
      env:
        # 入力は env で渡し、run の中に ${{ }} で展開しない
        COMMAND: ${{ inputs.command }}
        # 既存の env はそのまま
```

```bash
OVERRIDES_ARGS=()
if [ -n "${COMMAND}" ]; then
  OVERRIDES_ARGS=(--overrides "$(jq -cn --arg name "${FAMILY}" --argjson command "${COMMAND}" \
    '{containerOverrides: [{name: $name, command: $command}]}')")
fi
RUN_RESULT=$(aws ecs run-task ... "${OVERRIDES_ARGS[@]}")
```

`run-deployed-migration` にも `command` を足して `run-one-shot-task` に渡す。

```yaml
# .github/workflows/admin-create.yml
name: Admin Create

# =============================================================================
# 管理画面にサインインできる admin を登録する（admins に email を足す）
# =============================================================================
# 最後に deploy した migration イメージで packages/db の admin:create を流す。
# 登録済みの email なら何もしない。

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options: [dev, min, prd]
      email:
        description: "admin にする Google アカウントの email"
        required: true
        type: string

concurrency:
  group: deploy-aws-${{ inputs.environment }}
  cancel-in-progress: false

permissions:
  id-token: write
  contents: read

jobs:
  create:
    name: Create admin (${{ inputs.environment }})
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      # 入力値をシェルに直接展開しない（コマンドインジェクション対策）。JSON は jq で組み立てる
      - name: Build command
        id: command
        env:
          EMAIL: ${{ inputs.email }}
        run: |
          set -euo pipefail
          # email に使える文字だけを許す（$ や ' やバッククォートを通さない）
          if ! [[ "${EMAIL}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
            echo "::error::Invalid email"
            exit 1
          fi
          echo "command=$(jq -cn --arg email "${EMAIL}" '["pnpm","--filter","@repo/db","admin:create","--email",$email]')" >> "$GITHUB_OUTPUT"

      - name: Configure AWS credentials with OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Run admin:create
        uses: ./.github/actions/run-deployed-migration
        with:
          environment: ${{ inputs.environment }}
          task-definition: project-template-${{ inputs.environment }}-migration
          command: ${{ steps.command.outputs.command }}
```

`docs/onboarding/deploy-prd.md` に「admin を登録する」手順（この workflow を流す → 管理画面で Google でサインインする）を足す。

### 既存の環境への反映の順番

step4 を main に入れた後、deploy の前に環境ごとに次を行う（`docs/onboarding/deploy-prd.md` にも書く）。

1. `scripts/deploy/seed-secrets.sh <env>` で admin の鍵を Secrets Manager に足す
2. Terraform を apply する（dev / prd は ECS の `secret_keys` が増える）
3. deploy する（migration で `admins` ができ、api が新しい鍵を読む）
4. `Admin Create` workflow で admin を登録する

1 より先に 2 / 3 を行うと、ECS のタスクが起動できない（Secrets Manager に無いキーを参照するため）。

## 動作確認

### テスト

`test/controller/helper.ts` に `createAdminTestApp(router)`（`authMiddleware` を全体に、`adminAuthMiddleware` + 渡した Router を `/api/admin` に mount。本番の `index.ts` と同じ形）と `createTestAdmin()`（admins に行を作り admin の access token を返す）を足す。

| テスト | 種類 | 確認すること |
| --- | --- | --- |
| `test/repository/admin-repository.test.ts` | 実 DB | `findByEmail` / `findById` / `recordSignIn`（profile ありは 3 列、なしは `last_signed_in_at` だけが変わる。`updated_at` も変わる） |
| `test/service/admin-auth-service/refreshAdminTokens.test.ts` | ユニット | 正常系: admins にいればローテーションする。異常系: admins から消えていれば 401 で jti を消す / 検証に失敗したトークンは 401 |
| `test/service/admin-auth-service/authenticateAdminWithGoogle.test.ts` | ユニット | 正常系: 登録済み → トークンと更新済みの admin。異常系: 未確認 email → 403 / 未登録 → 403（どちらもトークンを発行しない・`recordSignIn` を呼ばない）/ email の大文字小文字の違いでも一致する |
| `test/controller/admin/auth/google.test.ts` | インテグレーション | 正常系: 200・DB の 3 列・Redis の `admin_refresh_token:{jti}`。異常系: 未登録 403 / 未確認 403（Redis に何も残らない） |
| `test/controller/admin/auth/refresh.test.ts` | インテグレーション | 正常系: admin の refresh token でローテーションできる。異常系: user の refresh token では 401 |
| `test/controller/admin/auth/logout.test.ts` | インテグレーション | 正常系: admin の refresh token で無効化でき、access token なしでも呼べる。異常系: user の refresh token でも 200（冪等。一般ユーザーの logout と同じ）で、Redis の `admin_refresh_token:*` は残る |
| `test/controller/admin/me/get.test.ts` | インテグレーション | 正常系: admin のトークンで 200。異常系: トークンなし 401 / **user の access token で 401** / admins から消した admin のトークンで 401 / **user の access token で `/API/ADMIN/me`・`/Api/Admin/me` も 401**（大文字小文字ですり抜けない） |
| `test/controller/user/get.test.ts`（追加） | インテグレーション | **admin の access token で `/api/user` が 401** |
| `test/middleware/admin-auth.test.ts` | ユニット | `ADMIN_PUBLIC_PATHS`（大文字の違いを含む）は素通り / それ以外はトークンなし 401 / `/auth/google-foo` は公開扱いにならない（segment 境界）/ payload に `adminId` が無いトークンは 401 |
| `test/lib/is-path-under-prefix.test.ts` | ユニット | 完全一致 / segment 境界 / 大文字小文字を区別しない |

```bash
pnpm --filter api test
```

### 手元で API を叩く

```bash
pnpm --filter @repo/db db:migrate && pnpm --filter @repo/db db:seed
pnpm --filter api dev

# dev admin でトークンを取る
TOKEN=$(curl -s -X POST http://localhost:8080/api/admin/auth/dev-login \
  -H "Content-Type: application/json" -d '{"email":"admin@dev.local"}' | jq -r .access_token)

curl -s http://localhost:8080/api/admin/me -H "Authorization: Bearer ${TOKEN}" | jq
# 期待: 200 で admin@dev.local

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/user -H "Authorization: Bearer ${TOKEN}"
# 期待: 401（admin のトークンは一般ユーザーの API で使えない）

# web で alice としてログインしたときの user の access token で
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/API/ADMIN/me -H "Authorization: Bearer ${USER_TOKEN}"
# 期待: 401（大文字のパスでも admin の認証を通る）
```

### admin の登録コマンド

```bash
pnpm --filter @repo/db admin:create --email Someone@Example.com
# 期待: Created admin。もう一度流すと Admin already exists。DB には someone@example.com で入る
pnpm --filter @repo/db admin:create --email not-an-email
# 期待: 終了コード 1
```

### workflow

dev で `Admin Create` を流し、ログに `Created admin` が出て終了コード 0 になること。同じ email でもう一度流して `Admin already exists` になること。
