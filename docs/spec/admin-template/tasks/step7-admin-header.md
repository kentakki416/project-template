# step7-admin-header

ヘッダーの通知・ユーザーメニュー・検索を、データを props で受け取る作りにする。`(dashboard)/layout.tsx` を Server Component にしてデータを取り、クライアントのシェルに渡す。マイページ（`/profile`）を作る。

設計: [`../README.md`](../README.md#ヘッダーへのデータの渡し方) / [仕様: ヘッダー](../README.md#ヘッダー) / [仕様: マイページ](../README.md#マイページ)

## 対応内容

### 変更するファイル

```
apps/admin/src/
├── app/(dashboard)/layout.tsx                    # Server Component にし、admin と通知を取る
├── app/(dashboard)/profile/page.tsx              # 新設 マイページ
├── components/layout/AdminShell.tsx              # 新設 今の layout の中身（client）
├── components/layout/AppHeader.tsx               # props を受け取って下に渡す
├── components/features/header/HeaderSearch.tsx   # 新設 AppHeader から切り出す
├── components/features/header/NotificationDropdown.tsx
├── components/features/header/UserDropdown.tsx
├── components/features/profile/AdminProfileCards.tsx  # 新設
├── features/admin/admin.api.ts                   # 新設 getMe
├── features/notification/notification.api.ts     # 新設 getNotifications / markAllAsRead（空の実装）
├── features/notification/notification.actions.ts # 新設 markAllAsReadAction
└── features/notification/notification.types.ts   # 新設 Notification 型
```

### 型

```typescript
/** features/notification/notification.types.ts */

/**
 * ヘッダーに出す通知。中身（何を通知するか）はプロジェクトごとに決める
 */
export type Notification = {
  id: string
  /** 通知を出した人などのアイコン。無ければベルのアイコンを出す */
  avatarUrl?: string
  body: string
  /** クリックしたときの遷移先。無ければ遷移しない */
  href?: string
  isRead: boolean
  createdAt: string
}
```

ヘッダーに渡す admin の型は `GetAdminMeResponse`（`@repo/api-schema`）をそのまま使う。

### データの取得

```typescript
/** features/admin/admin.api.ts */
import "server-only"

/**
 * admin の API 通信層
 */
export const adminApi = {
  getMe: async (): Promise<GetAdminMeResponse> => {
    const raw = await apiClient.get<unknown>("/api/admin/me")
    return getAdminMeResponseSchema.parse(raw)
  },
}
```

```typescript
/** features/notification/notification.api.ts */
import "server-only"

/**
 * 通知の API 通信層
 *
 * テンプレートでは通知の元を持たないため、常に空を返す。
 * プロジェクトで通知を作るときは、ここを API の呼び出しに差し替える（画面側は変えなくてよい）
 */
export const notificationApi = {
  getList: async (): Promise<Notification[]> => [],

  markAllAsRead: async (): Promise<void> => {},
}
```

```typescript
/** features/notification/notification.actions.ts */
"use server"

/**
 * 通知をすべて既読にする。ヘッダーは全画面にあるので feature の actions に置く
 */
export const markAllAsReadAction = async () => {
  await notificationApi.markAllAsRead()
  revalidatePath("/", "layout")
}
```

### layout とシェル

```typescript
/** app/(dashboard)/layout.tsx */

/**
 * サイドバー付きの画面の枠。サインイン中の admin と通知を取ってシェルに渡す
 * 認証は proxy が済ませている。api の 401（refresh も失敗）はサインイン画面に送る
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [admin, notifications] = await Promise.all([
    adminApi.getMe(),
    notificationApi.getList(),
  ])

  return (
    <AdminShell
      admin={admin}
      markAllAsReadAction={markAllAsReadAction}
      notifications={notifications}
      search={{ action: "/users", placeholder: "ユーザーを検索" }}
    >
      {children}
    </AdminShell>
  )
}
```

- `adminApi.getMe` が 401 の `ApiClientError` を投げたら（refresh も失敗した = cookie は消えている）、`redirect("/signin")` する
- `AdminShell` は今の `(dashboard)/layout.tsx` の中身（`useSidebar` で本文の左の余白を変える部分）をそのまま移した client component。受け取った props（`admin` / `markAllAsReadAction` / `notifications` / `search`）をそのまま `AppHeader` に渡し、`AppHeader` は `UserDropdown` / `NotificationDropdown` / `HeaderSearch` に配る
- Server Action は Server Component から client component に props で渡せる（関数の参照が送られる）

### `AppHeader`

```typescript
type AppHeaderProps = {
  admin: GetAdminMeResponse
  /** 通知をすべて既読にする Server Action。省略すると「すべて既読にする」を出さない */
  markAllAsReadAction?: () => Promise<void>
  notifications: Notification[]
  /** 省略すると検索欄を出さない */
  search?: HeaderSearchProps
}
```

- 検索欄を `HeaderSearch` に切り出す。⌘K / Ctrl+K でフォーカスする処理も一緒に移す
- ロゴは step2 の `AppLogo` のまま

### `HeaderSearch`

```typescript
export type HeaderSearchProps = {
  /** 検索の遷移先。入力は ?q= で渡す */
  action: string
  placeholder?: string
}
```

- `<form action={action} method="get">` に `name="q"` の input を置く。Enter で `/users?q=...` に遷移する（JavaScript が無くても動く）
- 見た目は今の検索欄（TailAdmin のデモ）のまま。placeholder だけ props から出す

### `NotificationDropdown`

```typescript
type NotificationDropdownProps = {
  /** すべて既読にする処理。省略すると「すべて既読にする」を出さない */
  markAllAsReadAction?: () => Promise<void>
  notifications: Notification[]
}
```

- 8 件の固定の通知を消し、`notifications` を描く。1 件の見た目（アイコン・本文・経過時間）は今のものを使う。経過時間は `formatRelativeTime()`（`libs/date.ts` に足す。「5 分前」の形）
- ベルの印（オレンジの点）は未読（`isRead === false`）が 1 件以上あるときだけ出す。今の「開いたら消える」ローカルの state はやめる
- 見出しを「通知」、0 件のときは「通知はありません」を一覧の位置に出す。デモには空の状態が無いため、トークンから作る（ベルのアイコン 24px `text-gray-400` と `text-sm text-gray-500 dark:text-gray-400` の文を縦に並べて中央に置く）
- デモとの差を直す: 見出しの区切り線を `dark:border-gray-800`（今は `gray-700`）、見出しの文字を `dark:text-white/90`（今は `gray-200`）
- 下の「View All Notifications」（`/` へのリンク）は消し、未読があり `markAllAsReadAction` があるときだけ「すべて既読にする」（`<form action={markAllAsReadAction}>` の中の素の `<button type="submit">`。見た目はデモのフッターのリンクのクラス。`DropdownItem` の `tag="button"` は `preventDefault` するので submit に使わない）を出す
- `href` がある通知は `DropdownItem` を `Link` にする。無ければ遷移しない

### `UserDropdown`

```typescript
type UserDropdownProps = {
  admin: Pick<GetAdminMeResponse, "avatar_url" | "email" | "name">
}
```

- アイコン・名前・email を props から出す。アイコンが無ければ名前（無ければ email）の頭文字（`ui/avatar/AvatarText`）
- 名前が無ければ email を出す
- メニューは「マイページ」（`/profile`）と「ログアウト」（step5 の `logoutAction`）だけにする。「Account settings」「Support」は消す

### マイページ（`app/(dashboard)/profile/page.tsx`）

- `adminApi.getMe()` を呼び、`AdminProfileCards` に渡す。`metadata.title` は「マイページ」
- 見た目は step6 のユーザー詳細と同じく TailAdmin のデモのプロフィール画面に合わせる（クラスは step6 の「詳細」）。編集ボタンとモーダルは置かない
- 表示する項目: 名前 / email / 登録日時 / 最終サインイン日時（`formatDateTime`。未サインインなら「-」）
- 「名前とアイコンは Google アカウントのものを表示しています」と注記する

## 動作確認

`verify-web-page` skill で行う。

| 確認 | 期待 |
| --- | --- |
| dev admin でログインしてヘッダーを見る | 「Admin (dev)」と `admin@dev.local`、頭文字のアイコン |
| ユーザーメニュー → マイページ | `/profile` に admin の情報 |
| ユーザーメニュー → ログアウト | `/signin` に戻る |
| ベルを押す | 「通知はありません」。ベルに印が無い |
| `notificationApi.getList` を一時的に未読 2 件・既読 1 件を返すように変えて開く | 印が付き、3 件が出る。「すべて既読にする」が出る（確認後に戻す） |
| ヘッダーの検索に `bob` を入れて Enter | `/users?q=bob` で bob だけの一覧 |
| ⌘K | 検索欄にフォーカスする |
| api を止めた状態で画面を開く | Next.js のエラー画面（`global-error`）。サインイン画面には送らない |
| access / refresh の cookie を両方消して画面遷移 | proxy で `/signin` へ |
| ダークモード・スマホ幅 | ヘッダー・ドロップダウン・マイページが崩れない |

PR にはヘッダー（ユーザーメニューと通知を開いた状態）とマイページのスクリーンショット（ライト / ダーク）を付ける。
