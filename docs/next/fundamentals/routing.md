# ルーティング基礎

## 概要

Next.jsのApp Routerは、ファイルシステムベースのルーティングを採用しています。`app` ディレクトリ内のフォルダ構造が、そのままアプリケーションのURL構造になります。

**主な特徴:**
- ファイルシステムベースの直感的なルーティング
- 動的ルート（Dynamic Routes）
- ルートグループ（Route Groups）
- パラレルルート（Parallel Routes）
- インターセプトルート（Intercepting Routes）
- プログラマティックナビゲーション

## 基本的な使い方

### 静的ルート

フォルダ構造がそのままURLになります:

```
app/
├── page.tsx           # /
├── about/
│   └── page.tsx       # /about
├── blog/
│   └── page.tsx       # /blog
└── contact/
    └── page.tsx       # /contact
```

```tsx
// app/about/page.tsx
export default function AboutPage() {
  return <h1>About Us</h1>
}
```

### 動的ルート

ブラケット `[param]` を使って動的セグメントを定義します:

```tsx
// app/blog/[slug]/page.tsx
interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params
  return <h1>Blog Post: {slug}</h1>
}
```

**アクセス例:**
- `/blog/hello-world` → `slug = "hello-world"`
- `/blog/nextjs-guide` → `slug = "nextjs-guide"`

### ネストされた動的ルート

```
app/
└── shop/
    └── [category]/
        └── [product]/
            └── page.tsx    # /shop/[category]/[product]
```

```tsx
// app/shop/[category]/[product]/page.tsx
interface PageProps {
  params: Promise<{
    category: string
    product: string
  }>
}

export default async function ProductPage({ params }: PageProps) {
  const { category, product } = await params
  return (
    <div>
      <p>Category: {category}</p>
      <p>Product: {product}</p>
    </div>
  )
}
```

### Catch-allセグメント

`[...slug]` で複数のセグメントをキャッチします:

```tsx
// app/docs/[...slug]/page.tsx
interface PageProps {
  params: Promise<{ slug: string[] }>
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params
  return <div>Path: {slug.join('/')}</div>
}
```

**アクセス例:**
- `/docs/a` → `slug = ["a"]`
- `/docs/a/b` → `slug = ["a", "b"]`
- `/docs/a/b/c` → `slug = ["a", "b", "c"]`

### Optional Catch-allセグメント

`[[...slug]]` でルートパス自体もマッチします:

```tsx
// app/shop/[[...slug]]/page.tsx
interface PageProps {
  params: Promise<{ slug?: string[] }>
}

export default async function ShopPage({ params }: PageProps) {
  const { slug } = await params
  if (!slug) {
    return <h1>Shop Home</h1>
  }
  return <div>Path: {slug.join('/')}</div>
}
```

**アクセス例:**
- `/shop` → `slug = undefined`
- `/shop/a` → `slug = ["a"]`
- `/shop/a/b` → `slug = ["a", "b"]`

## 詳細な説明

### ナビゲーション

#### Linkコンポーネント

```tsx
import Link from 'next/link'

export default function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/blog/hello-world">Blog Post</Link>

      {/* 動的なhref */}
      <Link href={`/blog/${slug}`}>Dynamic Post</Link>

      {/* プリフェッチ無効化 */}
      <Link href="/heavy-page" prefetch={false}>Heavy Page</Link>

      {/* 外部リンク */}
      <Link href="https://example.com" target="_blank" rel="noopener noreferrer">
        External
      </Link>
    </nav>
  )
}
```

#### useRouter（Client Componentのみ）

```tsx
'use client'

import { useRouter } from 'next/navigation'

export default function LoginButton() {
  const router = useRouter()

  const handleLogin = async () => {
    await login()
    router.push('/dashboard') // ナビゲーション
    router.refresh()          // 現在のルートを再取得
  }

  return <button onClick={handleLogin}>Login</button>
}
```

**useRouterのメソッド:**
- `router.push(href)` - 指定URLに遷移
- `router.replace(href)` - 履歴を置き換えて遷移
- `router.refresh()` - 現在のルートを再取得
- `router.back()` - 前のページに戻る
- `router.forward()` - 次のページに進む
- `router.prefetch(href)` - 事前読み込み

#### redirect（Server Componentのみ）

```tsx
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <div>Profile</div>
}
```

#### permanentRedirect

```tsx
import { permanentRedirect } from 'next/navigation'

export default async function OldPage() {
  permanentRedirect('/new-page') // 308リダイレクト
}
```

### クエリパラメータとハッシュ

#### searchParamsの使用

```tsx
// app/search/page.tsx
interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q
  const filter = params.filter

  return (
    <div>
      <p>Query: {query}</p>
      <p>Filter: {filter}</p>
    </div>
  )
}
```

**アクセス例:**
- `/search?q=nextjs&filter=latest`

#### useSearchParams（Client Component）

```tsx
'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchForm() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')

  return <div>Current query: {query}</div>
}
```

#### クエリパラメータの更新

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function FilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = (filter: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('filter', filter)
    router.push(`?${params.toString()}`)
  }

  return (
    <div>
      <button onClick={() => updateFilter('latest')}>Latest</button>
      <button onClick={() => updateFilter('popular')}>Popular</button>
    </div>
  )
}
```

### ルートセグメント設定

各ルートで特別な動作を設定できます:

```tsx
// app/blog/page.tsx
export const dynamic = 'force-dynamic'      // 常に動的レンダリング
export const dynamicParams = true           // generateStaticParams以外も許可
export const revalidate = 3600              // 1時間ごとに再生成
export const fetchCache = 'force-cache'     // fetch()のキャッシュ戦略
export const runtime = 'nodejs'             // 'nodejs' | 'edge'
export const preferredRegion = 'auto'       // デプロイリージョン

export default function BlogPage() {
  return <div>Blog</div>
}
```

### generateStaticParams

動的ルートを静的生成する場合に使用:

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(res => res.json())

  return posts.map((post: any) => ({
    slug: post.slug,
  }))
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <div>Post: {slug}</div>
}
```

## ベストプラクティス

### 1. Linkコンポーネントを優先

```tsx
// ✅ Good: Linkを使う
<Link href="/about">About</Link>

// ❌ Bad: aタグを直接使う（フルページリロードが発生）
<a href="/about">About</a>
```

### 2. プリフェッチを活用

```tsx
// ✅ Good: 重要なページは事前読み込み（デフォルト）
<Link href="/dashboard">Dashboard</Link>

// ✅ Good: 重いページはプリフェッチ無効化
<Link href="/analytics" prefetch={false}>Analytics</Link>
```

### 3. 動的ルートのバリデーション

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound() // 404ページを表示
  }

  return <article>{post.content}</article>
}
```

### 4. searchParamsの型安全性

```tsx
import { z } from 'zod'

const searchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sort: z.enum(['asc', 'desc']).default('asc'),
})

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const { page, limit, sort } = searchParamsSchema.parse(params)

  return <div>Page {page}</div>
}
```

## よくある落とし穴

### 1. paramsとsearchParamsはPromise（Next.js 15+）

```tsx
// ❌ Bad: 直接アクセス（Next.js 15+ではエラー）
export default function Page({ params }: PageProps) {
  const slug = params.slug
}

// ✅ Good: awaitで解決
export default async function Page({ params }: PageProps) {
  const { slug } = await params
}
```

### 2. useRouterのインポート元

```tsx
// ❌ Bad: pages routerのuseRouter
import { useRouter } from 'next/router'

// ✅ Good: app routerのuseRouter
import { useRouter } from 'next/navigation'
```

### 3. Server ComponentでuseRouterを使用

```tsx
// ❌ Bad: Server ComponentでuseRouterは使えない
export default function Page() {
  const router = useRouter() // エラー
}

// ✅ Good: redirect()を使う
import { redirect } from 'next/navigation'

export default async function Page() {
  const session = await getSession()
  if (!session) redirect('/login')
}
```

### 4. 動的ルートの優先順位

```
app/
├── blog/
│   ├── [slug]/
│   │   └── page.tsx      # /blog/* (最後に評価)
│   └── latest/
│       └── page.tsx      # /blog/latest (優先)
```

静的ルートが動的ルートより優先されます。

## 関連リソース

- [Next.js Routing公式ドキュメント](https://nextjs.org/docs/app/building-your-application/routing)
- [App Router](./app-router.md)
- [動的ルート詳細](../routing-advanced/dynamic-routes.md)
- [ミドルウェア](../routing-advanced/middleware.md)
- [Link APIリファレンス](https://nextjs.org/docs/app/api-reference/components/link)
