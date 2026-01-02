# レイアウト

## 概要

レイアウト（Layout）は、複数のページで共有されるUIを定義するためのコンポーネントです。Next.js App Routerでは、`layout.tsx`ファイルを使ってネストされたレイアウトを作成できます。

**主な特徴:**
- ページ間で共有されるUI（ナビゲーション、フッターなど）
- ナビゲーション時に再レンダリングされない（状態が保持される）
- ネストが可能
- ルートレイアウトは必須（`app/layout.tsx`）

**レイアウトとテンプレートの違い:**
| 機能 | Layout | Template |
|------|--------|----------|
| 再レンダリング | されない | される |
| 状態の保持 | 保持される | リセットされる |
| ユースケース | ナビゲーション、共通UI | アニメーション、ページリセット |

## 基本的な使い方

### ルートレイアウト（必須）

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <header>
          <nav>Global Navigation</nav>
        </header>
        <main>{children}</main>
        <footer>Global Footer</footer>
      </body>
    </html>
  )
}
```

**重要:** ルートレイアウトは`<html>`と`<body>`タグを含む必要があります。

### ネストされたレイアウト

```
app/
├── layout.tsx              # ルートレイアウト
├── page.tsx               # /
└── dashboard/
    ├── layout.tsx         # ダッシュボードレイアウト
    ├── page.tsx          # /dashboard
    └── settings/
        └── page.tsx      # /dashboard/settings
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <aside>
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/settings">Settings</a>
        </nav>
      </aside>
      <div className="content">{children}</div>
    </div>
  )
}
```

このレイアウトは、`/dashboard`と`/dashboard/settings`の両方で使用されます。

## 詳細な説明

### レイアウトのネスト構造

レイアウトは自動的にネストされます:

```tsx
// app/layout.tsx (ルート)
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GlobalNav />
        {children}  {/* ← ここにネストされたレイアウト + ページが入る */}
      </body>
    </html>
  )
}
```

```tsx
// app/blog/layout.tsx
export default function BlogLayout({ children }) {
  return (
    <div>
      <BlogNav />
      {children}  {/* ← ここにページが入る */}
    </div>
  )
}
```

```tsx
// app/blog/page.tsx
export default function BlogPage() {
  return <h1>Blog Home</h1>
}
```

**レンダリング結果:**
```html
<html>
  <body>
    <GlobalNav />
    <div>
      <BlogNav />
      <h1>Blog Home</h1>
    </div>
  </body>
</html>
```

### メタデータの定義

レイアウトでメタデータを定義できます:

```tsx
// app/blog/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Blog',
    template: '%s | My Blog', // 子ページで "Post Title" → "Post Title | My Blog"
  },
  description: 'My awesome blog',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

### ルートグループとレイアウト

ルートグループを使って、異なるレイアウトを適用できます:

```
app/
├── (marketing)/
│   ├── layout.tsx         # マーケティングレイアウト
│   ├── about/
│   │   └── page.tsx       # /about
│   └── blog/
│       └── page.tsx       # /blog
└── (shop)/
    ├── layout.tsx         # ショップレイアウト
    ├── products/
    │   └── page.tsx       # /products
    └── cart/
        └── page.tsx       # /cart
```

```tsx
// app/(marketing)/layout.tsx
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <MarketingNav />
      {children}
    </div>
  )
}
```

```tsx
// app/(shop)/layout.tsx
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ShopNav />
      <ShoppingCart />
      {children}
    </div>
  )
}
```

### レイアウトとServer/Client Components

レイアウトはデフォルトでServer Componentですが、Client Componentにもできます:

```tsx
// app/dashboard/layout.tsx
'use client' // Client Componentとして宣言

import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div>
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        Toggle Sidebar
      </button>
      {isSidebarOpen && <Sidebar />}
      {children}
    </div>
  )
}
```

### Template vs Layout

`template.tsx`はレイアウトと似ていますが、ナビゲーション時に再レンダリングされます:

```tsx
// app/template.tsx
'use client'

import { useEffect } from 'react'

export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log('Template mounted') // ページ遷移ごとに実行
  }, [])

  return <div className="fade-in">{children}</div>
}
```

**使い分け:**
- **Layout**: 状態を保持したい（サイドバーの開閉状態など）
- **Template**: ページ遷移アニメーション、状態のリセット

## ベストプラクティス

### 1. 共通UIをレイアウトに配置

```tsx
// ✅ Good: ナビゲーションをレイアウトで定義
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  )
}

// ❌ Bad: 各ページで重複してナビゲーションを定義
export default function Page() {
  return (
    <div>
      <Navigation /> {/* 各ページで重複 */}
      <main>Page content</main>
    </div>
  )
}
```

### 2. Server Componentとして定義（可能な場合）

```tsx
// ✅ Good: データフェッチをレイアウトで行う
export default async function DashboardLayout({ children }) {
  const user = await getUser()

  return (
    <div>
      <Header user={user} />
      {children}
    </div>
  )
}

// ❌ Bad: 不要なClient Component化
'use client'

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    getUser().then(setUser)
  }, [])

  return user ? (
    <div>
      <Header user={user} />
      {children}
    </div>
  ) : null
}
```

### 3. レイアウトでのデータフェッチ

```tsx
// app/dashboard/layout.tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ✅ Good: レイアウトでユーザー情報を取得
  const user = await getUser()

  return (
    <div>
      <nav>
        <UserProfile user={user} />
      </nav>
      {children}
    </div>
  )
}
```

### 4. メタデータのテンプレート活用

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
}

// app/blog/layout.tsx
export const metadata = {
  title: {
    template: '%s | Blog | My App',
    default: 'Blog',
  },
}
```

## よくある落とし穴

### 1. レイアウトでのuseState

```tsx
// ❌ Bad: レイアウトは再レンダリングされないため、状態が期待通りに動かない
export default function Layout({ children }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {children}
    </div>
  )
}

// ✅ Good: template.tsxを使う
'use client'

export default function Template({ children }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {children}
    </div>
  )
}
```

### 2. ルートレイアウトの<html>/<body>タグ

```tsx
// ❌ Bad: ルートレイアウト以外で<html>/<body>を使う
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <html> {/* エラー */}
      <body>{children}</body>
    </html>
  )
}

// ✅ Good: ルートレイアウトでのみ使用
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

### 3. レイアウト間でのデータ共有

```tsx
// ❌ Bad: レイアウト間でpropsを渡すことはできない
// app/layout.tsx
export default function RootLayout({ children }) {
  const data = fetchData() // 子レイアウトには渡せない
  return <html><body>{children}</body></html>
}

// ✅ Good: ContextやFetch cacheを使う
// app/providers.tsx
'use client'

import { createContext } from 'react'

export const DataContext = createContext(null)

export function DataProvider({ children, data }) {
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>
}

// app/layout.tsx
export default async function RootLayout({ children }) {
  const data = await fetchData()

  return (
    <html>
      <body>
        <DataProvider data={data}>{children}</DataProvider>
      </body>
    </html>
  )
}
```

### 4. レイアウトでのリダイレクト

```tsx
// ✅ Good: レイアウトでredirectは可能
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <div>{children}</div>
}
```

## 関連リソース

- [Next.js Layouts公式ドキュメント](https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates)
- [App Router](./app-router.md)
- [ルーティング](./routing.md)
- [メタデータ](./metadata.md)
- [テンプレート](https://nextjs.org/docs/app/api-reference/file-conventions/template)
