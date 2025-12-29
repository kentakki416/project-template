# 第1週: Next.js基礎編

## 今週のゴール

- Next.jsプロジェクトを自分で作成・起動できる
- App Routerの仕組みを理解し、ページを作成できる
- Server ComponentsとClient Componentsの違いを説明できる
- レイアウトとネストされたルーティングを実装できる

## Day 1-2: 環境構築とプロジェクト作成

### 学習内容

#### 1. Next.jsとは何か

**Next.jsの定義:**
Next.jsは、Reactベースのフルスタックフレームワークです。Reactが提供するUI構築機能に加えて、以下の機能を標準装備しています:

- サーバーサイドレンダリング(SSR)
- 静的サイト生成(SSG)
- ファイルベースルーティング
- APIルート
- 画像最適化
- 自動コード分割

**Reactとの違い:**

| 項目 | React | Next.js |
|------|-------|---------|
| 種類 | UIライブラリ | フルスタックフレームワーク |
| ルーティング | 自分で設定(React Router等) | ファイルベースで自動 |
| レンダリング | クライアントサイド(CSR) | SSR/SSG/ISR/CSR全て対応 |
| API開発 | 別途サーバーが必要 | APIルートで同じプロジェクト内に実装可能 |
| 設定 | webpack等の設定が必要 | ゼロコンフィグで動作 |

**従来のReactアプリの課題とNext.jsの解決策:**

```javascript
// 従来のReact (CRA) の問題点
// 1. 初回ロード時に白い画面が表示される
// 2. SEOに弱い（クローラーがJSを実行しないと内容が見えない）
// 3. ルーティング設定が複雑

// Next.jsでの解決
// 1. サーバーでHTMLを生成してから送信 → 即座に内容表示
// 2. HTMLに内容が含まれているのでSEOに強い
// 3. ファイルを置くだけでルーティング完成
```

#### 2. 開発環境のセットアップ

**必要なツール:**

```bash
# Node.jsのバージョン確認 (18.0.0以上が必要)
node --version

# pnpmのインストール (推奨)
npm install -g pnpm

# pnpmのバージョン確認
pnpm --version
```

**新規プロジェクトの作成:**

```bash
# Next.jsプロジェクトの作成
pnpm create next-app@latest my-next-app

# 対話形式で以下を選択:
# ✔ Would you like to use TypeScript? … Yes
# ✔ Would you like to use ESLint? … Yes
# ✔ Would you like to use Tailwind CSS? … Yes
# ✔ Would you like your code inside a `src/` directory? … No
# ✔ Would you like to use App Router? … Yes
# ✔ Would you like to use Turbopack for `next dev`? … Yes
# ✔ Would you like to customize the import alias? … No

# プロジェクトディレクトリに移動
cd my-next-app

# 開発サーバーの起動
pnpm dev
```

**プロジェクト構造の理解:**

```
my-next-app/
├── app/                    # App Routerのルート (重要!)
│   ├── layout.tsx         # 全ページ共通のレイアウト
│   ├── page.tsx           # トップページ (/)
│   └── globals.css        # グローバルスタイル
├── public/                # 静的ファイル (画像など)
├── next.config.ts         # Next.jsの設定ファイル
├── package.json           # 依存パッケージ管理
└── tsconfig.json          # TypeScript設定
```

**重要な概念:**

- `app/` ディレクトリがルーティングの起点
- `page.tsx` がそのルートのページコンポーネント
- `layout.tsx` が共通レイアウト

#### 3. 最初のページを作成

**`app/page.tsx` を編集:**

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">
        Next.jsへようこそ!
      </h1>
      <p className="text-lg text-gray-700">
        これがあなたの最初のNext.jsページです。
      </p>
    </main>
  )
}
```

**ブラウザで確認:**
- http://localhost:3000 にアクセス
- 変更を保存すると自動的にブラウザがリロードされる (Hot Reload)

### 実践課題

1. `app/page.tsx` を編集して、自己紹介ページを作成してください
2. Tailwind CSSを使ってスタイリングしてみてください
3. 開発サーバーを停止(Ctrl+C)して、再起動してみてください

### 理解度チェック

- [ ] Next.jsとReactの違いを説明できる
- [ ] プロジェクトを作成して開発サーバーを起動できる
- [ ] `app/page.tsx` がトップページであることを理解している
- [ ] Hot Reloadの動作を確認できた

---

## Day 3-4: App Routerとルーティング

### 学習内容

#### 1. ファイルベースルーティングの仕組み

**従来のルーティング(React Routerの例):**

```tsx
// 従来のReactでのルーティング設定
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogPost />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Next.jsのファイルベースルーティング:**

```
app/
├── page.tsx                  → /
├── about/
│   └── page.tsx             → /about
├── blog/
│   ├── page.tsx             → /blog
│   └── [id]/
│       └── page.tsx         → /blog/123 (動的ルート)
└── dashboard/
    ├── layout.tsx           → /dashboard/* 共通レイアウト
    ├── page.tsx             → /dashboard
    └── settings/
        └── page.tsx         → /dashboard/settings
```

**重要なファイル名の規則:**

| ファイル名 | 役割 |
|-----------|------|
| `page.tsx` | そのルートのページコンポーネント |
| `layout.tsx` | そのルート以下の共通レイアウト |
| `loading.tsx` | ローディング中に表示するUI |
| `error.tsx` | エラー時に表示するUI |
| `not-found.tsx` | 404エラー時のUI |

#### 2. 静的ルートの作成

**Aboutページの作成:**

```bash
# ディレクトリとファイルを作成
mkdir app/about
touch app/about/page.tsx
```

```tsx
// app/about/page.tsx
export default function AboutPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">About Us</h1>
      <p className="text-lg text-gray-700 mb-4">
        このサイトはNext.jsの学習用に作成されました。
      </p>
      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-2">使用技術</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Next.js 16</li>
          <li>React 19</li>
          <li>TypeScript</li>
          <li>Tailwind CSS v4</li>
        </ul>
      </section>
    </main>
  )
}
```

#### 3. 動的ルートの作成

**ブログ記事の詳細ページ(動的ルート):**

```bash
# 動的ルートのディレクトリ作成
mkdir -p app/blog/[id]
touch app/blog/page.tsx
touch app/blog/[id]/page.tsx
```

**動的ルートの命名規則:**
- `[id]` → 単一の動的セグメント
- `[...slug]` → キャッチオールセグメント(複数のパスセグメントをキャッチ)
- `[[...slug]]` → オプショナルキャッチオール

```tsx
// app/blog/page.tsx (ブログ一覧ページ)
import Link from 'next/link'

const posts = [
  { id: 1, title: 'Next.jsの基礎' },
  { id: 2, title: 'App Routerの使い方' },
  { id: 3, title: 'Server Componentsとは' },
]

export default function BlogPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.id}`}
              className="text-xl text-blue-600 hover:underline"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

```tsx
// app/blog/[id]/page.tsx (ブログ詳細ページ)
interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function BlogPostPage({ params }: PageProps) {
  const { id } = await params

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">
        Blog Post #{id}
      </h1>
      <p className="text-gray-700">
        これはブログ記事{id}の内容です。
      </p>
    </main>
  )
}
```

**重要なポイント:**
- Next.js 15以降、`params`は非同期プロパティになりました
- `await params` でパラメータを取得する必要があります
- 型定義に`Promise`を含める必要があります

#### 4. Linkコンポーネントによるナビゲーション

**`<Link>`の基本:**

```tsx
import Link from 'next/link'

// 基本的な使い方
<Link href="/about">About</Link>

// 動的ルートへのリンク
<Link href={`/blog/${post.id}`}>
  {post.title}
</Link>

// 外部リンク (target="_blank"を追加)
<Link href="https://nextjs.org" target="_blank">
  Next.js公式サイト
</Link>
```

**`<Link>`と`<a>`の違い:**

| 項目 | `<Link>` | `<a>` |
|------|---------|-------|
| ページ遷移 | クライアントサイド遷移(高速) | フルページリロード(遅い) |
| プリフェッチ | 自動でプリフェッチ | なし |
| 使用場面 | 内部ページへの遷移 | 外部サイトへのリンク |

#### 5. ナビゲーションバーの作成

```tsx
// app/components/Navbar.tsx
import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex gap-6">
        <Link href="/" className="hover:text-gray-300">
          Home
        </Link>
        <Link href="/about" className="hover:text-gray-300">
          About
        </Link>
        <Link href="/blog" className="hover:text-gray-300">
          Blog
        </Link>
      </div>
    </nav>
  )
}
```

```tsx
// app/layout.tsx (ナビゲーションバーを全ページに表示)
import Navbar from './components/Navbar'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
```

### 実践課題

1. `/contact` ページを作成してください
2. ブログ記事一覧に5つの記事を追加してください
3. ナビゲーションバーに現在のページをハイライトする機能を追加してください (ヒント: `usePathname` フックを使用)

### 理解度チェック

- [ ] ファイルベースルーティングの仕組みを理解している
- [ ] 静的ルートと動的ルートの違いを説明できる
- [ ] `Link`コンポーネントを使ってページ遷移を実装できる
- [ ] `params`を使って動的パラメータを取得できる

---

## Day 5-6: Server ComponentsとClient Components

### 学習内容

#### 1. Server Componentsとは

**Next.js 13以降の大きな変更:**
App Routerでは、デフォルトで全てのコンポーネントが**Server Component**になります。

**Server Componentの特徴:**

```tsx
// app/blog/page.tsx
// これはServer Component (デフォルト)
export default async function BlogPage() {
  // サーバー上で実行される
  const res = await fetch('https://api.example.com/posts')
  const posts = await res.json()

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </div>
  )
}
```

**メリット:**
- データフェッチングをサーバーで実行できる
- データベースやAPIキーに直接アクセス可能
- バンドルサイズが小さくなる(クライアントに送信されない)
- SEOに有利(サーバーでHTMLが生成される)

**制限:**
- `useState`, `useEffect`などのReact Hooksが使えない
- ブラウザAPIが使えない(window, document等)
- イベントハンドラが使えない(onClick等)

#### 2. Client Componentsとは

**Client Componentの作成:**

```tsx
'use client'  // この行が必要!

import { useState } from 'react'

// これはClient Component
export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

**`'use client'`ディレクティブ:**
- ファイルの先頭に記述
- このファイルとそれがインポートする全てのファイルがクライアントコンポーネントになる

**Client Componentが必要な場面:**
- インタラクティブな機能(ボタンのクリック等)
- React Hooks(`useState`, `useEffect`等)の使用
- ブラウザAPI(`localStorage`, `window`等)の使用
- イベントリスナー

#### 3. Server ComponentsとClient Componentsの組み合わせ

**推奨パターン:**

```tsx
// app/blog/[id]/page.tsx (Server Component)
// サーバーでデータ取得
async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`)
  return res.json()
}

// Client Componentをインポート
import LikeButton from './LikeButton'
import Comments from './Comments'

export default async function BlogPostPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {/* Client Componentを埋め込む */}
      <LikeButton initialLikes={post.likes} />

      {/* Client Componentにデータを渡す */}
      <Comments postId={post.id} />
    </article>
  )
}
```

```tsx
// app/blog/[id]/LikeButton.tsx (Client Component)
'use client'

import { useState } from 'react'

export default function LikeButton({
  initialLikes
}: {
  initialLikes: number
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [isLiked, setIsLiked] = useState(false)

  const handleLike = () => {
    if (isLiked) {
      setLikes(likes - 1)
    } else {
      setLikes(likes + 1)
    }
    setIsLiked(!isLiked)
  }

  return (
    <button
      onClick={handleLike}
      className={`px-4 py-2 rounded ${
        isLiked ? 'bg-red-500' : 'bg-gray-300'
      }`}
    >
      ❤️ {likes}
    </button>
  )
}
```

#### 4. コンポーネント設計のベストプラクティス

**原則: できるだけServer Componentを使う**

```tsx
// ❌ 悪い例: 全体をClient Componentにする
'use client'

export default function BlogPage() {
  const [search, setSearch] = useState('')

  // この部分はサーバーで実行できるのに...
  const posts = await fetchPosts()

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <PostList posts={posts} />
    </div>
  )
}
```

```tsx
// ✅ 良い例: インタラクティブな部分だけClient Component
// app/blog/page.tsx (Server Component)
import SearchInput from './SearchInput'
import PostList from './PostList'

export default async function BlogPage() {
  // サーバーでデータ取得
  const posts = await fetchPosts()

  return (
    <div>
      <SearchInput /> {/* Client Component */}
      <PostList posts={posts} /> {/* Server Component */}
    </div>
  )
}
```

```tsx
// app/blog/SearchInput.tsx (Client Component)
'use client'

import { useState } from 'react'

export default function SearchInput() {
  const [search, setSearch] = useState('')

  return (
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

**判断基準:**

| 機能 | 推奨 |
|-----|------|
| 静的コンテンツの表示 | Server Component |
| データベースアクセス | Server Component |
| APIキーの使用 | Server Component |
| ユーザー入力の処理 | Client Component |
| useState/useEffect | Client Component |
| ブラウザAPI | Client Component |

#### 5. 実践例: 検索可能なブログリスト

```tsx
// app/blog/page.tsx (Server Component)
import { Suspense } from 'react'
import SearchBar from './SearchBar'
import PostList from './PostList'

async function getPosts() {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  return res.json()
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const posts = await getPosts()

  // 検索フィルタリング
  const filteredPosts = q
    ? posts.filter((p: any) =>
        p.title.toLowerCase().includes(q.toLowerCase())
      )
    : posts

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>

      {/* 検索バー (Client Component) */}
      <SearchBar />

      {/* 投稿リスト (Server Component) */}
      <Suspense fallback={<div>Loading...</div>}>
        <PostList posts={filteredPosts} />
      </Suspense>
    </main>
  )
}
```

```tsx
// app/blog/SearchBar.tsx (Client Component)
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/blog?q=${query}`)
  }

  return (
    <form onSubmit={handleSearch} className="mb-8">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
        className="px-4 py-2 border rounded-lg w-full max-w-md"
      />
      <button
        type="submit"
        className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        Search
      </button>
    </form>
  )
}
```

```tsx
// app/blog/PostList.tsx (Server Component)
import Link from 'next/link'

interface Post {
  id: number
  title: string
  body: string
}

export default function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul className="space-y-4">
      {posts.slice(0, 10).map((post) => (
        <li key={post.id} className="border p-4 rounded-lg">
          <Link
            href={`/blog/${post.id}`}
            className="text-xl font-semibold text-blue-600 hover:underline"
          >
            {post.title}
          </Link>
          <p className="text-gray-600 mt-2">{post.body}</p>
        </li>
      ))}
    </ul>
  )
}
```

### 実践課題

1. カウンターコンポーネントを作成してください
2. トップページにカウンターを配置してください
3. ブログ一覧に検索機能を実装してください

### 理解度チェック

- [ ] Server ComponentsとClient Componentsの違いを説明できる
- [ ] `'use client'`ディレクティブの役割を理解している
- [ ] どちらを使うべきか判断できる
- [ ] Server ComponentとClient Componentを組み合わせて使える

---

## Day 7: 復習とミニプロジェクト

### 第1週の総まとめ

#### 学んだ主要概念

1. **Next.jsの基本**
   - Reactのフルスタックフレームワーク
   - ファイルベースルーティング
   - ゼロコンフィグで動作

2. **App Router**
   - `app/`ディレクトリがルーティングの基準
   - `page.tsx`がページコンポーネント
   - `layout.tsx`が共通レイアウト
   - 動的ルート: `[id]`

3. **Server Components vs Client Components**
   - デフォルトはServer Component
   - インタラクティブな機能にはClient Component
   - `'use client'`ディレクティブ

### ミニプロジェクト: シンプルなブログサイト

**要件:**
- トップページ
- ブログ一覧ページ
- ブログ詳細ページ
- Aboutページ
- ナビゲーションバー
- 検索機能(オプション)

**目標時間:** 2-3時間

### 次週の予習

第2週では以下を学びます:
- Server Actions
- データベース連携
- フォーム処理
- エラーハンドリング

---

**前に戻る:** [カリキュラムトップ](./README.md)
**次に進む:** [第2週: データフェッチング編](./week2.md)
