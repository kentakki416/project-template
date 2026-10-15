# step6-admin-user-management

ユーザー管理（一覧・詳細）を、api に繋いだ見本として作る。一覧の検索・絞り込み・ページングは api で行い、`DataTable` にサーバー側のモードを足す。

設計: [`../README.md`](../README.md#ユーザー一覧の検索絞り込みページング) / [DataTable のサーバー側モード](../README.md#datatable-のサーバー側モード) / [仕様: ユーザー管理](../README.md#ユーザー管理)

## 対応内容

### 変更するファイル

```
packages/domain/src/
├── const/auth-provider.ts            # 新設 AUTH_PROVIDERS
├── types/auth-provider.ts            # 新設 AuthProvider
├── types/auth-account.ts             # provider を AuthProvider に
└── index.ts
packages/db/
├── src/index.ts                      # 演算子の re-export を足す
├── src/drizzle/schema/auth-account.ts  # provider に enum と CHECK
└── drizzle/migrations/<timestamp>_add_auth_provider_check/   # db:generate
packages/schema/
├── package.json                      # @repo/domain を dependencies に
└── src/api-schema/admin/user.ts      # 新設（admin/index.ts に足す）
apps/api/
├── src/repository/user-repository.ts            # search
├── src/repository/auth-account-repository.ts    # findByUserId
├── src/repository/drizzle/user-repository.ts
├── src/repository/drizzle/auth-account-repository.ts
├── src/service/user-service.ts                  # searchUsers / getUserDetail
├── src/controller/admin/user/{list,detail}.ts   # 新設
├── src/routes/admin-router.ts                   # userList / userDetail
├── src/index.ts
└── test/...
apps/admin/src/
├── app/(dashboard)/users/page.tsx               # 新設 一覧
├── app/(dashboard)/users/[id]/page.tsx          # 新設 詳細
├── app/(dashboard)/users/[id]/not-found.tsx     # 新設
├── features/user/user.api.ts                    # 新設
├── features/user/user-list-params.ts            # 新設 URL ⇔ api のパラメータ変換
├── components/features/user/UserTable.tsx       # 新設（DataTable の列定義）
├── components/features/user/UserDetailCards.tsx # 新設
├── components/features/user/AuthProviderBadge.tsx  # 新設
├── components/ui/table/DataTable.tsx            # server モード・dateRange・行リンク・0 件表示・見た目をデモに合わせる
├── components/ui/table/Pagination.tsx           # 見た目とページ番号の出し方をデモに合わせる
├── libs/date.ts                                 # toStartOfDayIso を足す（formatDateTime は step2）
├── hooks/useGoBack.ts                           # 履歴が無いときの戻り先を引数で受け取る
├── components/layout/nav-items.tsx              # 「ユーザー管理」を足す
└── components/layout/AppSidebar.tsx             # 選択中の判定を前方一致に
```

### `packages/domain`

```typescript
/** src/const/auth-provider.ts */

/**
 * ログイン方法（auth_accounts.provider）。dev は開発環境専用の dev-login
 */
export const AUTH_PROVIDERS = ["google", "dev"] as const
```

```typescript
/** src/types/auth-provider.ts */
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]
```

`AuthAccount.provider` を `AuthProvider` にし、`apps/api` の `CreateAuthAccountInput.provider` も合わせる。

### `packages/db`

```typescript
/** src/drizzle/schema/auth-account.ts */
    provider: text("provider", { enum: AUTH_PROVIDERS }).notNull(),
  ...
  (table) => [
    check(
      "auth_accounts_provider_check",
      sql`${table.provider} IN (${sql.join(AUTH_PROVIDERS.map((provider) => sql`${provider}`), sql`, `)})`,
    ),
    /** 既存の foreignKey / index / uniqueIndex はそのまま */
  ],
```

- `pnpm --filter @repo/db db:generate --name add_auth_provider_check`
- 既存の行に `google` / `dev` 以外があると migration が失敗する。プロジェクトで別のプロバイダを足していたら、先に `AUTH_PROVIDERS` に足す
- `src/index.ts` の演算子の re-export に `count` / `exists` / `gte` / `ilike` / `inArray` / `or` を足す（アルファベット順）

### `packages/schema`（`api-schema/admin/user.ts`）

```typescript
import { z } from "zod"

import { AUTH_PROVIDERS } from "@repo/domain"

/**
 * ログイン方法のスキーマ。admin の絞り込みの選択肢は `authProviderSchema.options` から作る
 */
export const authProviderSchema = z.enum(AUTH_PROVIDERS)

// ========================================================
// GET /api/admin/users - ユーザー一覧（検索・絞り込み・ページング）
// ========================================================

/**
 * ユーザー一覧のクエリ文字列スキーマ
 *
 * created_from は以上、created_before は未満。日の区切り（タイムゾーン）は呼び出し側で決め、
 * オフセット付きの ISO 8601 で渡す
 */
export const getAdminUserListQueryStringSchema = z.object({
  created_before: z.string().datetime({ offset: true }).optional(),
  created_from: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  provider: authProviderSchema.optional(),
  q: z.string().trim().max(100).optional(),
})

/**
 * ユーザー一覧のレスポンススキーマ
 */
export const getAdminUserListResponseSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total_count: z.number(),
  users: z.array(z.object({
    id: z.number(),
    avatar_url: z.string().nullable(),
    email: z.string().nullable(),
    name: z.string().nullable(),
    providers: z.array(authProviderSchema),
    created_at: z.string(),
  })),
})

// ========================================================
// GET /api/admin/users/:id - ユーザー詳細
// ========================================================

export const getAdminUserPathParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const getAdminUserResponseSchema = z.object({
  id: z.number(),
  auth_accounts: z.array(z.object({
    provider: authProviderSchema,
    created_at: z.string(),
  })),
  avatar_url: z.string().nullable(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
```

各スキーマに `z.infer` の型を並べる。`provider_account_id`（Google の ID）は画面で使わないので返さない。

### `apps/api` の Repository

```typescript
/** src/repository/user-repository.ts に足す */

/**
 * ユーザー検索の条件。query は name / email の部分一致（大文字小文字を区別しない）
 */
export type SearchUsersInput = {
  createdBefore?: Date
  createdFrom?: Date
  limit: number
  offset: number
  provider?: AuthProvider
  query?: string
}

/**
 * 一覧の 1 行。ログイン方法の一覧を持つ
 */
export type UserWithProviders = User & {
  providers: AuthProvider[]
}

export type SearchUsersResult = {
  totalCount: number
  users: UserWithProviders[]
}

export interface UserRepository {
  /** 既存のメソッドはそのまま */
  search(input: SearchUsersInput): Promise<SearchUsersResult>
}
```

```typescript
/** src/repository/drizzle/user-repository.ts */

/**
 * LIKE の特殊文字（\ % _）を文字そのものとして扱う。Postgres の LIKE の既定のエスケープ文字は \
 */
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`)

public async search(input: SearchUsersInput): Promise<SearchUsersResult> {
  const pattern = input.query ? `%${escapeLikePattern(input.query)}%` : undefined
  /** and() は undefined の条件を無視する */
  const where = and(
    pattern ? or(ilike(users.name, pattern), ilike(users.email, pattern)) : undefined,
    input.provider
      ? exists(
        this._db.select({ one: sql`1` }).from(authAccounts)
          .where(and(eq(authAccounts.userId, users.id), eq(authAccounts.provider, input.provider))),
      )
      : undefined,
    input.createdFrom ? gte(users.createdAt, input.createdFrom) : undefined,
    input.createdBefore ? lt(users.createdAt, input.createdBefore) : undefined,
  )

  const [{ total }] = await this._db.select({ total: count() }).from(users).where(where)
  const rows = await this._db.select().from(users).where(where)
    /** ページをまたいで順序がぶれないよう id で一意にする */
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(input.limit)
    .offset(input.offset)

  /** そのページのユーザーのログイン方法をまとめて引く（行ごとに引かない） */
  const accounts = rows.length === 0 ? [] : await this._db
    .select({ provider: authAccounts.provider, userId: authAccounts.userId })
    .from(authAccounts)
    .where(inArray(authAccounts.userId, rows.map((row) => row.id)))

  return {
    totalCount: total,
    users: rows.map((row) => ({
      ...this._toDomainUser(row),
      providers: accounts.filter((a) => a.userId === row.id).map((a) => a.provider),
    })),
  }
}
```

`AuthAccountRepository` に `findByUserId(userId: number): Promise<AuthAccount[]>`（`created_at` の昇順）を足す。

### `apps/api` の Service

```typescript
/** src/service/user-service.ts に足す */

/**
 * ユーザーを検索する（admin の一覧）
 */
export const searchUsers = async (
  input: { createdBefore?: Date; createdFrom?: Date; page: number; perPage: number; provider?: AuthProvider; query?: string },
  repo: { userRepository: UserRepository },
): Promise<Result<SearchUsersResult>> => {
  const result = await repo.userRepository.search({
    createdBefore: input.createdBefore,
    createdFrom: input.createdFrom,
    limit: input.perPage,
    offset: (input.page - 1) * input.perPage,
    provider: input.provider,
    /** 空白だけの検索語は条件にしない */
    query: input.query || undefined,
  })
  return ok(result)
}

/**
 * ユーザーの詳細（ログイン方法を含む）。無ければ 404
 */
export const getUserDetail = async (
  userId: number,
  repo: { authAccountRepository: AuthAccountRepository; userRepository: UserRepository },
): Promise<Result<{ authAccounts: AuthAccount[]; user: User }>> => { /* ... */ }
```

- 総件数を超えたページを指定されたら、`users` が空で `total_count` はそのまま返す（エラーにしない）

### `apps/api` の Controller / Router

| Controller | 処理 |
| --- | --- |
| `AdminUserListController` | `parseRequest(getAdminUserListQueryStringSchema, req.query)` → `service.user.searchUsers`（`created_*` は `new Date()` に） → `getAdminUserListResponseSchema` で整形 |
| `AdminUserDetailController` | `parseRequest(getAdminUserPathParamSchema, req.params)` → `service.user.getUserDetail` → `getAdminUserResponseSchema` で整形 |

`adminRouter` に `userList?` / `userDetail?` を足し、`GET /users` / `GET /users/:id` を登録する。

### admin の API 通信（`features/user/`）

```typescript
/** features/user/user.api.ts */
import "server-only"

/**
 * ユーザー管理の API 通信層
 */
export const userApi = {
  getDetail: async (id: number): Promise<GetAdminUserResponse> => {
    const raw = await apiClient.get<unknown>(`/api/admin/users/${id}`)
    return getAdminUserResponseSchema.parse(raw)
  },

  getList: async (query: GetAdminUserListQueryString): Promise<GetAdminUserListResponse> => {
    const raw = await apiClient.get<unknown>(`/api/admin/users?${toSearchParams(query)}`)
    return getAdminUserListResponseSchema.parse(raw)
  },
}
```

`features/user/user-list-params.ts` は、画面の URL の検索パラメータ（`q` / `provider` / `created_from` / `created_to`（日付・両端を含む）/ `page` / `per_page`）を api のクエリに変換する純粋関数。

- `created_from=2026-10-01` → `created_from=2026-10-01T00:00:00+09:00`（`toStartOfDayIso`。step2 の設定のタイムゾーンで日の始まりを出す）
- `created_to=2026-10-31` → `created_before=2026-11-01T00:00:00+09:00`（翌日の始まり。終了日を含めるため）
- 不正な値（`page=abc`、存在しない provider、日付の形でない文字列）は捨てて既定値にする。URL を手で書き換えられても api の 400 にしない

`getDetail` は api の 404 を `ApiClientError` で受け、ページで `notFound()` を呼ぶ。

### `DataTable` のサーバー側モード

既存の props はそのままで、次を足す。`server` を指定しないときの挙動は変えない。

```typescript
/**
 * サーバー側で検索・絞り込み・ページングするときの設定
 * 指定すると状態を URL の検索パラメータで持ち、data はその 1 ページ分として扱う
 */
type ServerModeConfig = {
  /** 条件に合う全件数（フッターとページ数に使う） */
  totalCount: number
}

/**
 * フィルタ定義。type を省略したら select（既存）
 * server モードでは key が URL の検索パラメータ名になる。dateRange は `{key}_from` / `{key}_to`
 */
export type FilterConfig<T> =
  | { key: keyof T & string; label: string; options: { label: string; value: string }[]; type?: "select" }
  | { key: string; label: string; type: "dateRange" }

type DataTableProps<T> = {
  /** 既存の props */
  /** 該当 0 件のときの表示 */
  emptyMessage?: string
  /** 行のリンク先。指定すると行のクリックで遷移する */
  getRowHref?: (row: T) => string
  server?: ServerModeConfig
}
```

- server モードの状態は `useSearchParams()` から読み、変更は `router.replace(`${pathname}?${params}`, { scroll: false })` で書く。検索語は 300ms 間引く。検索語・絞り込み・件数を変えたら `page` を消す
- 読み込み中は `useTransition` の `isPending` でテーブルを薄くする
- 絞り込みはポップオーバーの中で選び、「適用」で反映してポップオーバーを閉じる（client モードも同じ）。「リセット」は条件を空にしてすぐ反映する
- `dateRange` はポップオーバーの中に `DatePicker` を 2 つ（開始・終了）並べる。片方だけでもよい
- 行のクリックは `router.push(getRowHref(row))`。キーボードで辿れるよう、名前の列は `UserTable` 側で `Link` にする
- フッターの文言は日本語にする（「全 N 件中 X〜Y 件」「表示件数」）。デモの画面も同じ DataTable を使うので、デモでも日本語になる

### DataTable / Pagination の見た目

TailAdmin のデモから実測した値に合わせる。検索・Filter・表・フッターは `/products-list`、表示件数の選択は `/data-tables`（`/products-list` には無い）に合わせる。

| 部分 | クラス（デモ） |
| --- | --- |
| 枠 | `overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3`（今の `dark:border-white/5` は誤り。区切り線もすべて `gray-800`） |
| ツールバー | `flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800` |
| 表示件数 | 「Show」「entries」の位置に「表示件数」。文字は `text-gray-500 dark:text-gray-400`（16px）。select は `shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-9 appearance-none rounded-lg border border-gray-300 bg-transparent py-2 pr-8 pl-3 text-sm text-gray-800 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90` + 右に 16px の下向きの矢印 |
| 検索 | 左に 20px の TailAdmin の虫眼鏡（`left-4`、`text-gray-500 dark:text-gray-400`）。input は `shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pr-4 pl-11 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden sm:w-[300px] sm:min-w-[300px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30` |
| Filter ボタン | `shadow-theme-xs flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 sm:w-auto sm:min-w-[100px] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400` + 20px のスライダーのアイコン（デモの SVG） |
| ポップオーバー | `absolute right-0 z-10 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800`。項目は `mb-5`、ラベルは `mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300`、入力は検索と同じクラスで `h-10 px-4`。「適用」は `bg-brand-500 hover:bg-brand-600 h-10 w-full rounded-lg px-3 py-2 text-sm font-medium text-white` |
| 見出しの行 | `tr`: `border-b border-gray-200 dark:border-gray-800`。`th`: `px-5 py-4 text-left`、文字は `text-theme-xs font-medium text-gray-500 dark:text-gray-400` |
| 本文の行 | `tbody`: `divide-y divide-gray-200 dark:divide-gray-800`。`tr`: `transition hover:bg-gray-50 dark:hover:bg-gray-900`（`getRowHref` があれば `cursor-pointer`）。`td`: `px-5 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-400` |
| フッター | `flex flex-col items-center justify-between gap-4 border-t border-gray-200 px-5 py-4 sm:flex-row dark:border-gray-800`。件数の文は `text-sm font-medium text-gray-500 dark:text-gray-400` で、数字だけ `text-gray-800 dark:text-white/90` |
| 前へ / 次へ | 42px の矢印のボタン: `shadow-theme-xs flex items-center gap-2 rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2.5 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200` |
| ページ番号 | `flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium`。選択中は `bg-brand-500 text-white`、それ以外は `hover:bg-brand-500 text-gray-700 dark:text-gray-400 hover:text-white`。間隔は `gap-0.5`。スマホ幅は番号を隠して「X / Y ページ」 |

- ページ番号の出し方: デモの `/products-list` は全ページを並べるため、件数が多いと並びきらない。`/data-tables` と同じく「1、…、今のページの前後 2 つ、…、最後」にする。デモの不具合（最後のページのボタンが出ない）は直す
- 0 件のときは件数の文を「全 0 件」にする（デモは「1 to 0 of 0」と出る不具合がある）
- 0 件の行の表示はデモに無いため、トークンから作る: `px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400`
- 列見出しの並び替えのアイコンは付けない（並び替えは [MVP 対象外](../README.md#mvp-対象外将来検討)）
- Filter のバッジ（適用中の条件の数）と「リセット」はデモに無い追加。バッジは `bg-brand-500 text-white` の 20px の丸、「リセット」は `text-xs text-brand-500 hover:text-brand-600`

client モード（デモの表）も同じ見た目になる。

### 画面

**一覧（`app/(dashboard)/users/page.tsx`）**: Server Component。`searchParams` を `user-list-params.ts` で api のクエリにし、`userApi.getList` を呼び、`UserTable`（client）に渡す。`metadata.title` は「ユーザー管理」。

```typescript
/** components/features/user/UserTable.tsx（列定義の抜粋） */
const columns: Column<UserRow>[] = [
  { header: "ユーザー", render: (row) => <UserNameCell user={row} /> },
  { header: "メールアドレス", render: (row) => row.email ?? "-" },
  {
    header: (
      <Tooltip content="ユーザーが紐付けているログイン方法" placement="top">
        <span className="inline-flex items-center gap-1">ログイン方法<InfoIcon className="size-4" /></span>
      </Tooltip>
    ),
    render: (row) => row.providers.map((p) => <AuthProviderBadge key={p} provider={p} />),
  },
  { header: "登録日時", render: (row) => formatDateTime(row.created_at) },
]

const filters: FilterConfig<UserRow>[] = [
  {
    key: "provider",
    label: "ログイン方法",
    options: authProviderSchema.options.map((p) => ({ label: AUTH_PROVIDER_LABELS[p], value: p })),
  },
  { key: "created", label: "登録日", type: "dateRange" },
]
```

- `Column.header` を `ReactNode` に広げる（Tooltip を入れるため）。`key` が無い列の React の key は列の index にする
- `AuthProviderBadge` は `ui/badge/Badge`（google: `primary`、dev: `warning`）。`AUTH_PROVIDER_LABELS` は `{ dev: "開発用", google: "Google" }`
- `UserNameCell` は TailAdmin の表のアバター + 名前のセル（`RecentOrders` / `BasicTableOne` と同じ見た目）。アイコンが無ければ名前の頭文字（`ui/avatar/AvatarText`）

**詳細（`app/(dashboard)/users/[id]/page.tsx`）**: `params.id` を数値にできなければ `notFound()`。`userApi.getDetail` を呼び、`UserDetailCards` に渡す。

- 見た目は TailAdmin のデモのプロフィール画面（https://demo.tailadmin.com/profile ）に合わせる。編集ボタンは置かない
  - 外枠: `rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3`、見出し `mb-5 text-lg font-semibold text-gray-800 lg:mb-7 dark:text-white/90`
  - 上段（アイコン・名前・email）: アイコンは `size-20` の丸（`overflow-hidden rounded-full border border-gray-200 dark:border-gray-800`）、名前は `mb-2 text-lg font-semibold text-gray-800 dark:text-white/90`、email は `text-sm text-gray-500 dark:text-gray-400`
  - 基本情報のカード: `mb-6 rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800`、見出し `mb-4 text-lg font-semibold text-gray-800 lg:mb-6 dark:text-white/90`、格子 `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32`。ラベル `mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400`、値 `text-sm font-medium text-gray-800 dark:text-white/90`
  - ログイン方法のカード: 同じカードの中に、デモのセキュリティ欄の行（`flex flex-col justify-between gap-4 border-b border-gray-200 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-end dark:border-gray-800`）でログイン方法のバッジと紐付けた日時を並べる
- 「一覧に戻る」は `useGoBack("/users")`。`useGoBack` に履歴が無いときの戻り先の引数を足す（既定は今の `/`）。一覧の検索条件は URL にあるので、戻ると同じ条件の一覧になる
- `not-found.tsx` は「ユーザーが見つかりません」と一覧へのリンク

`nav-items.tsx` の `mainNavSection` に「ユーザー管理」（`/users`、`GroupIcon`）を足す。`/users/{id}` でもこの項目を選択中にする（`AppSidebar` の `isActive` を、`/` 以外はパスの segment 境界での前方一致にする）。

## 動作確認

### テスト

| テスト | 種類 | 確認すること |
| --- | --- | --- |
| `test/repository/user-repository.test.ts`（追加） | 実 DB | 部分一致（name / email、大文字小文字）/ `%` `_` `\` を文字として扱う / provider（google と dev の両方を持つユーザーはどちらでも出る）/ **登録日の境界（`created_from` ちょうどは含む、`created_before` ちょうどは含まない）** / 並び順（同じ `created_at` は id の降順）/ limit・offset と `totalCount`（絞り込み後の件数）/ 範囲外のページは空 / `providers` が正しく付く |
| `test/repository/auth-account-repository.test.ts`（追加） | 実 DB | `findByUserId` の並び順 / 0 件 |
| `test/service/user-service/searchUsers.test.ts` | ユニット | page → offset の計算 / 空の検索語を条件にしない |
| `test/service/user-service/getUserDetail.test.ts` | ユニット | 正常系 / 存在しない ID は 404 |
| `test/controller/admin/user/list.test.ts` | インテグレーション | 正常系: レスポンス全体を `toEqual`、既定値（page=1 / per_page=20）。異常系: `per_page=101` / `page=0` / 不正な provider / オフセットの無い日時は 400。admin のトークンなし 401 / **user のトークンで 401** |
| `test/controller/admin/user/detail.test.ts` | インテグレーション | 正常系 / 存在しない ID は 404 / `id=abc` は 400 |
| `packages/db` の migration | — | `CHECK` に違反する provider の insert が失敗する（repository のテストで 1 件） |

admin 側の `user-list-params.ts` は純粋関数なので、変換（日付の境界・不正な値の切り捨て）をここで確かめる。admin にはまだテストの仕組みが無いため、この step では `apps/admin` に Vitest を足さず、api 側のテストと画面の確認で担保する。

```bash
pnpm --filter api test
```

### 画面

`verify-web-page` skill で行う。seed のユーザー（alice / bob）に加え、確認用に 30 人ほど入れる（入れたら確認後に消す）。

| 確認 | 期待 |
| --- | --- |
| `/users` を開く | 新しい順に 20 件。フッターに「全 N 件中 1〜20 件」とページ番号 |
| 検索欄に `ali` | 0.3 秒後に alice だけになり、URL が `?q=ali` になる |
| Filter で「開発用」 | dev のユーザーだけ。ボタンにバッジ 1 |
| Filter で登録日を今日〜今日 | 今日登録したユーザーだけ（日本時間の今日） |
| 2 ページ目に移ってから検索語を変える | 1 ページ目に戻る |
| 表示件数を 50 | 1 ページに 50 件まで |
| 条件を入れた状態でリロード / URL を別タブで開く | 同じ状態で出る |
| 該当なしの語で検索 | 「該当するユーザーがいません」 |
| 行をクリック | `/users/{id}` に移り、基本情報とログイン方法が出る |
| 詳細で「一覧に戻る」 | 同じ検索条件の一覧に戻る |
| `/users/999999` / `/users/abc` | 「ユーザーが見つかりません」 |
| 「ログイン方法」の見出しにマウスを乗せる | Tooltip が出る |
| ダークモード | 一覧・フィルタ・詳細が崩れない |
| デモの `/products-list` / `/data-tables` / `/profile` と並べる | 枠線・検索欄・Filter・ポップオーバー・見出し・行・フッター・ページ番号・詳細のカードの色と寸法が一致する（`browser_evaluate` の `getComputedStyle` で数値を比べる。ライト / ダーク） |
| デモの表（`/demo/tables/basic` など client モードの表） | 同じ見た目に変わり、ブラウザ側の検索・絞り込みがこれまでどおり動く |

PR には一覧（絞り込みあり）・0 件・詳細のスクリーンショット（ライト / ダーク）を、デモと並べて付ける。
