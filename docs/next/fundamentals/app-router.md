# App Router

## 概要

App Routerは、Next.js 13で導入され、Next.js 14以降で推奨されているルーティングシステムです。従来のPages Routerに代わる新しいアーキテクチャで、React Server Componentsをベースに構築されています。

**主な特徴:**
- ファイルシステムベースのルーティング
- Server ComponentsとClient Componentsの統合
- レイアウトとテンプレートによる柔軟なUI構造
- ストリーミングとSuspenseのネイティブサポート
- データフェッチングの改善

**Pages Routerとの違い:**
| 機能 | Pages Router | App Router |
|------|-------------|-----------|
| ディレクトリ | `pages/` | `app/` |
| デフォルトコンポーネント | Client Component | Server Component |
| データフェッチング | `getServerSideProps`, `getStaticProps` | `async`コンポーネント, `fetch` |
| レイアウト | `_app.tsx` のみ | ネストされた `layout.tsx` |
| ローディング状態 | 手動実装 | `loading.tsx` |
| エラーハンドリング | `_error.tsx` | `error.tsx` |

## 基本的な使い方

### ディレクトリ構造

```
app/
├── layout.tsx          # ルートレイアウト（必須）
├── page.tsx           # トップページ（/）
├── loading.tsx        # ローディングUI
├── error.tsx          # エラーUI
├── not-found.tsx      # 404ページ
├── about/
│   └── page.tsx       # /about
├── blog/
│   ├── layout.tsx     # ブログ専用レイアウト
│   ├── page.tsx       # /blog
│   └── [slug]/
│       └── page.tsx   # /blog/[slug]
└── dashboard/
    ├── layout.tsx
    ├── page.tsx       # /dashboard
    └── settings/
        └── page.tsx   # /dashboard/settings
```

### 最小構成

```tsx
// app/layout.tsx（必須）
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return <h1>ホームページ</h1>
}
```

### ページの作成

```tsx
// app/about/page.tsx
export default function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
      <p>私たちについて</p>
    </div>
  )
}
```

## 詳細な説明

### 特殊ファイル

App Routerでは、特定の名前を持つファイルが特別な役割を果たします:

#### page.tsx
- ルートのUIを定義
- このファイルがある場合のみ、そのルートが公開される

```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <h1>Dashboard</h1>
}
```

#### layout.tsx
- 複数のページで共有されるUI
- 子レイアウトや子ページをラップする
- ナビゲーション時に再レンダリングされない（状態が保持される）

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      <nav>Dashboard Navigation</nav>
      <main>{children}</main>
    </div>
  )
}
```

#### template.tsx
- layoutと似ているが、ナビゲーション時に新しいインスタンスが作成される
- 状態がリセットされる

```tsx
// app/template.tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

#### loading.tsx
- Suspense境界を自動的に作成
- ページロード中に表示されるUI

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div>Loading...</div>
}
```

#### error.tsx
- Error Boundaryを自動的に作成
- エラー発生時に表示されるUI
- Client Componentである必要がある

```tsx
// app/dashboard/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>エラーが発生しました</h2>
      <button onClick={reset}>再試行</button>
    </div>
  )
}
```

#### not-found.tsx
- 404エラー時に表示されるUI

```tsx
// app/not-found.tsx
export default function NotFound() {
  return <h2>ページが見つかりません</h2>
}
```

### ルートグループ

括弧 `()` を使うと、URLに影響を与えずにルートをグループ化できます:

```
app/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx    # /about
│   └── blog/
│       └── page.tsx    # /blog
└── (shop)/
    ├── cart/
    │   └── page.tsx    # /cart
    └── checkout/
        └── page.tsx    # /checkout
```

### プライベートフォルダ

アンダースコア `_` で始まるフォルダはルーティングから除外されます:

```
app/
├── _lib/              # ルーティングから除外
│   └── utils.ts
└── dashboard/
    └── page.tsx       # /dashboard
```

### ルートハンドラー（API Routes）

`route.ts` ファイルでAPIエンドポイントを定義できます:

```tsx
// app/api/users/route.ts
export async function GET() {
  return Response.json({ users: [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  return Response.json({ success: true })
}
```

## ベストプラクティス

### 1. Server Componentをデフォルトに

```tsx
// ✅ Good: デフォルトでServer Component
export default async function Page() {
  const data = await fetch('...')
  return <div>{data}</div>
}

// ❌ Bad: 不要なClient Component化
'use client'
export default function Page() {
  return <div>Static content</div>
}
```

### 2. レイアウトで共通UIを定義

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.NodeNode
}) {
  return (
    <div>
      <DashboardNav /> {/* すべての /dashboard/* で共有 */}
      {children}
    </div>
  )
}
```

### 3. loadingとerrorを活用

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <Skeleton />
}

// app/dashboard/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error, reset: () => void }) {
  return <ErrorDisplay error={error} onReset={reset} />
}
```

### 4. メタデータを適切に設定

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)
  return {
    title: post.title,
    description: post.excerpt,
  }
}
```

## よくある落とし穴

### 1. layout.tsxでのuseStateの使用

```tsx
// ❌ Bad: layoutは再レンダリングされないため、状態が期待通りに動かない
export default function Layout({ children }) {
  const [state, setState] = useState(0)
  return <div onClick={() => setState(state + 1)}>{children}</div>
}

// ✅ Good: template.tsxを使うか、Client Componentで状態管理
'use client'
export default function Template({ children }) {
  const [state, setState] = useState(0)
  return <div onClick={() => setState(state + 1)}>{children}</div>
}
```

### 2. ルートレイアウトの欠落

```tsx
// ❌ Bad: app/layout.tsx がない
// エラー: Your page must have a root layout.

// ✅ Good: app/layout.tsx を必ず作成
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

### 3. page.tsxとroute.tsの併用

```
app/
└── api/
    └── users/
        ├── page.tsx    # ❌ Bad
        └── route.ts    # ❌ Bad
```

同じルートに `page.tsx` と `route.ts` を両方配置するとエラーになります。

### 4. 動的セグメントの誤解

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // ❌ Bad: Next.js 15では params は Promise
  const slug = params.slug

  // ✅ Good: await で解決
  const { slug } = await params
}
```

## 関連リソース

- [Next.js App Router公式ドキュメント](https://nextjs.org/docs/app)
- [App Router段階的な採用ガイド](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [Server ComponentsとClient Components](./server-components.md)
- [ルーティング基礎](./routing.md)
- [レイアウト](./layouts.md)
