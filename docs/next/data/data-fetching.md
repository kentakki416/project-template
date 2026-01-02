# データフェッチング

## 概要

Next.js App Routerでは、Server Componentsを使ってサーバー側で直接データをフェッチできます。従来の`getServerSideProps`や`getStaticProps`は不要になり、より直感的なデータフェッチングが可能になりました。

**主な特徴:**
- async/awaitを使った自然なデータフェッチング
- fetch APIの拡張（キャッシュ、再検証）
- 並列データフェッチング
- ストリーミングとSuspenseのサポート
- 自動的な重複排除（deduplication）

**データフェッチング方法:**
- Server ComponentsでのAsync/Await
- Server Actions
- Route Handlers (API Routes)
- Client Componentsでのライブラリ（SWR, TanStack Query等）

## 基本的な使い方

### Server Componentでのfetch

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await fetch('https://api.example.com/posts').then(res => res.json())

  return (
    <div>
      <h1>Posts</h1>
      {posts.map((post: any) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

### データベースへの直接アクセス

```tsx
// app/users/page.tsx
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export default async function UsersPage() {
  const allUsers = await db.select().from(users)

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {allUsers.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 並列データフェッチング

```tsx
export default async function DashboardPage() {
  // ✅ Good: Promise.allで並列実行
  const [posts, users, stats] = await Promise.all([
    fetch('https://api.example.com/posts').then(res => res.json()),
    fetch('https://api.example.com/users').then(res => res.json()),
    fetch('https://api.example.com/stats').then(res => res.json()),
  ])

  return (
    <div>
      <h1>Dashboard</h1>
      <Posts data={posts} />
      <Users data={users} />
      <Stats data={stats} />
    </div>
  )
}
```

## 詳細な説明

### fetch APIの拡張

Next.jsは、ネイティブのfetch APIを拡張しています:

#### キャッシュ制御

```tsx
// デフォルト: キャッシュあり（force-cache）
const data = await fetch('https://api.example.com/data')

// キャッシュなし
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store',
})

// 60秒間キャッシュ（ISR）
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 },
})
```

#### タグベースの再検証

```tsx
// タグ付きキャッシュ
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
})

// Server Actionから再検証
'use server'

import { revalidateTag } from 'next/cache'

export async function revalidatePosts() {
  revalidateTag('posts')
}
```

### ストリーミングとSuspense

データの遅い部分だけを遅延ロードできます:

```tsx
import { Suspense } from 'react'

async function SlowData() {
  const data = await fetch('https://api.example.com/slow', {
    cache: 'no-store',
  }).then(res => res.json())

  return <div>{data}</div>
}

async function FastData() {
  const data = await fetch('https://api.example.com/fast').then(res => res.json())

  return <div>{data}</div>
}

export default function Page() {
  return (
    <div>
      {/* すぐに表示 */}
      <FastData />

      {/* 遅延ロード */}
      <Suspense fallback={<div>Loading...</div>}>
        <SlowData />
      </Suspense>
    </div>
  )
}
```

### データフェッチングパターン

#### パターン1: ルートセグメントでのフェッチ

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

#### パターン2: コンポーネントでのフェッチ

```tsx
// components/RecentPosts.tsx
export default async function RecentPosts() {
  const posts = await fetch('https://api.example.com/posts?limit=5').then(res => res.json())

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}

// app/page.tsx
export default function HomePage() {
  return (
    <div>
      <h1>Home</h1>
      <RecentPosts />
    </div>
  )
}
```

#### パターン3: 親から子へpropsで渡す

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div>
      <PostList posts={posts} />
    </div>
  )
}

// components/PostList.tsx
interface Props {
  posts: Post[]
}

export default function PostList({ posts }: Props) {
  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### 自動重複排除（Deduplication）

同じURLへのfetchリクエストは自動的に重複排除されます:

```tsx
async function Post({ id }: { id: string }) {
  // この3つのリクエストは1回だけ実行される
  const post = await fetch(`https://api.example.com/posts/${id}`)
  return <div>{post.title}</div>
}

export default function Page() {
  return (
    <div>
      <Post id="1" />
      <Post id="1" />
      <Post id="1" />
    </div>
  )
}
```

### エラーハンドリング

```tsx
export default async function PostsPage() {
  try {
    const posts = await fetch('https://api.example.com/posts')

    if (!posts.ok) {
      throw new Error('Failed to fetch posts')
    }

    const data = await posts.json()

    return (
      <div>
        {data.map(post => (
          <div key={post.id}>{post.title}</div>
        ))}
      </div>
    )
  } catch (error) {
    return <div>Error loading posts</div>
  }
}
```

error.tsxを使ったエラーハンドリング:

```tsx
// app/posts/error.tsx
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
      <p>{error.message}</p>
      <button onClick={reset}>再試行</button>
    </div>
  )
}
```

### ローディング状態

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return <div>Loading posts...</div>
}
```

または、Suspenseを使用:

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts />
    </Suspense>
  )
}
```

## ベストプラクティス

### 1. Server Componentsでデータフェッチ

```tsx
// ✅ Good: Server Componentでフェッチ
export default async function PostsPage() {
  const posts = await getPosts()
  return <PostList posts={posts} />
}

// ❌ Bad: Client Componentでフェッチ（不要な場合）
'use client'

import { useEffect, useState } from 'react'

export default function PostsPage() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    getPosts().then(setPosts)
  }, [])

  return posts.length ? <PostList posts={posts} /> : <div>Loading...</div>
}
```

### 2. 並列フェッチングを活用

```tsx
// ✅ Good: 並列実行
const [posts, users] = await Promise.all([
  fetch('https://api.example.com/posts'),
  fetch('https://api.example.com/users'),
])

// ❌ Bad: 直列実行（遅い）
const posts = await fetch('https://api.example.com/posts')
const users = await fetch('https://api.example.com/users')
```

### 3. Suspenseで段階的ロード

```tsx
// ✅ Good: 重いデータはSuspenseでラップ
export default function Dashboard() {
  return (
    <div>
      <FastData />
      <Suspense fallback={<Skeleton />}>
        <SlowData />
      </Suspense>
    </div>
  )
}
```

### 4. キャッシュ戦略を適切に選択

```tsx
// 静的データ: デフォルト（force-cache）
const staticData = await fetch('https://api.example.com/static')

// 定期的に更新: revalidate
const newsData = await fetch('https://api.example.com/news', {
  next: { revalidate: 3600 }, // 1時間
})

// リアルタイムデータ: no-store
const realtimeData = await fetch('https://api.example.com/realtime', {
  cache: 'no-store',
})
```

## よくある落とし穴

### 1. Client ComponentでのAsync/Await

```tsx
// ❌ Bad: Client Componentでasync/awaitは使えない
'use client'

export default async function Page() {
  const data = await fetch('...')
  return <div>{data}</div>
}

// ✅ Good: Server Componentで使う
export default async function Page() {
  const data = await fetch('...')
  return <ClientComponent data={data} />
}
```

### 2. useEffectでのデータフェッチ（不要な場合）

```tsx
// ❌ Bad: Server Componentで十分な場合
'use client'

import { useEffect, useState } from 'react'

export default function Page() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('...').then(res => res.json()).then(setData)
  }, [])

  return data ? <div>{data}</div> : null
}

// ✅ Good: Server Componentで直接フェッチ
export default async function Page() {
  const data = await fetch('...').then(res => res.json())
  return <div>{data}</div>
}
```

### 3. fetchの重複（自動重複排除を理解していない）

```tsx
// ℹ️ この2つのfetchは自動的に1回にまとめられる
async function Component1() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}

async function Component2() {
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}
```

### 4. エラーハンドリングの欠如

```tsx
// ❌ Bad: エラーハンドリングなし
export default async function Page() {
  const data = await fetch('...').then(res => res.json())
  return <div>{data}</div>
}

// ✅ Good: error.tsxを使う
// app/error.tsx
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>エラーが発生しました</h2>
      <button onClick={reset}>再試行</button>
    </div>
  )
}
```

## 関連リソース

- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Server Actions](./server-actions.md)
- [キャッシング](./caching.md)
- [再検証](./revalidation.md)
- [API Routes](./api-routes.md)
