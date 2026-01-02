# Server Components

## 概要

React Server Components (RSC) は、サーバー側でレンダリングされるコンポーネントです。Next.js App Routerでは、すべてのコンポーネントがデフォルトでServer Componentになります。

**主な特徴:**
- サーバー側でのみ実行される
- バックエンドリソースに直接アクセス可能（データベース、ファイルシステム、API）
- JavaScriptバンドルサイズを削減
- 機密情報（APIキー、トークン）を安全に扱える
- SEOに優れている

**制限事項:**
- ブラウザAPIは使用不可（`window`, `document`, `localStorage`など）
- Reactフック（`useState`, `useEffect`など）は使用不可
- イベントハンドラー（`onClick`, `onChange`など）は使用不可

## 基本的な使い方

### Server Componentの作成

```tsx
// app/blog/page.tsx
// デフォルトでServer Component（'use server'は不要）

export default async function BlogPage() {
  // サーバー側でデータフェッチ
  const posts = await fetch('https://api.example.com/posts').then(res => res.json())

  return (
    <div>
      <h1>Blog Posts</h1>
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
  // データベースに直接アクセス
  const allUsers = await db.select().from(users)

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {allUsers.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

### APIキーの安全な使用

```tsx
// app/weather/page.tsx
// APIキーはサーバー側でのみ使用され、クライアントに送信されない
export default async function WeatherPage() {
  const apiKey = process.env.WEATHER_API_KEY
  const weather = await fetch(
    `https://api.weather.com/data?key=${apiKey}`
  ).then(res => res.json())

  return (
    <div>
      <h1>Weather</h1>
      <p>Temperature: {weather.temp}°C</p>
    </div>
  )
}
```

## 詳細な説明

### Server ComponentとClient Componentの違い

| 機能 | Server Component | Client Component |
|------|-----------------|-----------------|
| データフェッチ | ✅ async/await | ✅ useEffect + fetch |
| バックエンドリソースアクセス | ✅ 直接アクセス可能 | ❌ API経由のみ |
| Reactフック | ❌ 使用不可 | ✅ 使用可能 |
| ブラウザAPI | ❌ 使用不可 | ✅ 使用可能 |
| イベントハンドラー | ❌ 使用不可 | ✅ 使用可能 |
| JavaScriptバンドル | 含まれない | 含まれる |
| 実行場所 | サーバー | クライアント |

### async Server Component

Server Componentは`async`関数にできます:

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  // 複数のデータを並列フェッチ
  const [posts, categories] = await Promise.all([
    fetch('https://api.example.com/posts').then(res => res.json()),
    fetch('https://api.example.com/categories').then(res => res.json()),
  ])

  return (
    <div>
      <h1>Posts</h1>
      {/* レンダリング */}
    </div>
  )
}
```

### ストリーミングとSuspense

Server Componentは、Suspenseと組み合わせてストリーミングできます:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'

async function SlowData() {
  const data = await fetch('https://api.example.com/slow-endpoint')
  return <div>{data}</div>
}

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* すぐに表示 */}
      <FastContent />

      {/* 遅延読み込み */}
      <Suspense fallback={<div>Loading...</div>}>
        <SlowData />
      </Suspense>
    </div>
  )
}
```

### Server ComponentからClient Componentへのprops

Server ComponentからClient Componentにpropsを渡す際の注意点:

```tsx
// app/page.tsx (Server Component)
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      {/* ✅ Good: シリアライズ可能なデータ */}
      <ClientComponent data={data} count={10} />

      {/* ❌ Bad: 関数は渡せない */}
      <ClientComponent onClick={() => {}} />

      {/* ❌ Bad: Dateオブジェクトは文字列に変換される */}
      <ClientComponent date={new Date()} />
    </div>
  )
}
```

**シリアライズ可能な型:**
- 文字列、数値、真偽値
- 配列、オブジェクト
- Promiseは自動的に解決される
- Server Componentを直接渡すことも可能

### Server ComponentとClient Componentの合成

```tsx
// app/layout.tsx (Server Component)
import ClientNav from './ClientNav'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getUser()

  return (
    <html>
      <body>
        {/* Client Component */}
        <ClientNav user={user} />

        {/* Server Component（children） */}
        {children}
      </body>
    </html>
  )
}
```

```tsx
// app/ClientNav.tsx (Client Component)
'use client'

import { useState } from 'react'

export default function ClientNav({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav>
      <button onClick={() => setIsOpen(!isOpen)}>
        Menu
      </button>
      {isOpen && <div>Welcome, {user.name}</div>}
    </nav>
  )
}
```

### サードパーティライブラリの使用

Server Componentでサードパーティライブラリを使用する場合:

```tsx
// app/page.tsx
import { format } from 'date-fns' // Server専用ライブラリ

export default function Page() {
  const formatted = format(new Date(), 'yyyy-MM-dd')
  return <div>{formatted}</div>
}
```

ライブラリがブラウザAPIを使用する場合、Client Componentでラップする必要があります。

## ベストプラクティス

### 1. デフォルトでServer Componentを使う

```tsx
// ✅ Good: インタラクションが不要ならServer Component
export default async function ProductList() {
  const products = await fetchProducts()
  return <div>{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
}

// ❌ Bad: 不要なClient Component化
'use client'
export default function ProductList() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetchProducts().then(setProducts)
  }, [])

  return <div>{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
}
```

### 2. データフェッチはできるだけサーバー側で

```tsx
// ✅ Good: Server Componentでデータフェッチ
export default async function Page() {
  const data = await fetch('https://api.example.com/data').then(res => res.json())
  return <ClientComponent data={data} />
}

// ❌ Bad: Client Componentで無駄なフェッチ
'use client'
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('https://api.example.com/data')
      .then(res => res.json())
      .then(setData)
  }, [])

  return data ? <div>{data}</div> : <div>Loading...</div>
}
```

### 3. Client Componentは葉（leaf）に配置

```tsx
// ✅ Good: インタラクティブな部分だけClient Component
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <Header />
      <StaticContent data={data} />
      <InteractiveButton /> {/* ここだけClient Component */}
    </div>
  )
}
```

### 4. 環境変数の使い分け

```tsx
// Server Component
export default function Page() {
  // ✅ Good: すべての環境変数にアクセス可能
  const apiKey = process.env.SECRET_API_KEY
  const publicUrl = process.env.NEXT_PUBLIC_API_URL
}

// Client Component
'use client'
export default function Page() {
  // ⚠️ Warning: NEXT_PUBLIC_*のみアクセス可能
  const publicUrl = process.env.NEXT_PUBLIC_API_URL
  const apiKey = process.env.SECRET_API_KEY // undefined!
}
```

## よくある落とし穴

### 1. Server ComponentでuseStateを使用

```tsx
// ❌ Bad: Server ComponentでReactフックは使えない
export default function Page() {
  const [count, setCount] = useState(0) // エラー
  return <div>{count}</div>
}

// ✅ Good: Client Componentにする
'use client'
export default function Page() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}
```

### 2. Server ComponentでonClickを使用

```tsx
// ❌ Bad: Server Componentでイベントハンドラーは使えない
export default function Page() {
  return <button onClick={() => alert('Hi')}>Click</button> // エラー
}

// ✅ Good: Client Componentにする
'use client'
export default function Page() {
  return <button onClick={() => alert('Hi')}>Click</button>
}
```

### 3. Client ComponentでServer Componentをimport

```tsx
// ❌ Bad: Client ComponentでServer Componentを直接import
'use client'
import ServerComponent from './ServerComponent' // エラー

export default function ClientComponent() {
  return <ServerComponent />
}

// ✅ Good: propsとして渡す
'use client'
export default function ClientComponent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

// 親（Server Component）
export default function Parent() {
  return (
    <ClientComponent>
      <ServerComponent />
    </ClientComponent>
  )
}
```

### 4. シリアライズ不可能なpropsを渡す

```tsx
// ❌ Bad: 関数をpropsで渡す
export default async function Page() {
  const handleClick = () => console.log('clicked')
  return <ClientComponent onClick={handleClick} /> // エラー
}

// ✅ Good: Client Component内で定義
'use client'
export default function ClientComponent() {
  const handleClick = () => console.log('clicked')
  return <button onClick={handleClick}>Click</button>
}
```

## 関連リソース

- [React Server Components公式ドキュメント](https://react.dev/reference/rsc/server-components)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Client Components](./client-components.md)
- [データフェッチング](../data/data-fetching.md)
- [レンダリング戦略](../rendering/rendering-strategies.md)
