# 第4週: 応用・本番環境編

## 今週のゴール

- パフォーマンス最適化の手法を理解して実装できる
- キャッシング戦略を適切に使い分けられる
- SEO対策を実装できる
- Vercelへデプロイして本番環境を構築できる

## Day 22-23: パフォーマンス最適化

### 学習内容

#### 1. レンダリング戦略の理解

**Next.jsの4つのレンダリング方法:**

| 方法 | タイミング | 用途 | キャッシュ |
|-----|----------|------|----------|
| Static Site Generation (SSG) | ビルド時 | ほとんど変わらないページ | あり |
| Incremental Static Regeneration (ISR) | ビルド時 + 定期的 | 時々更新されるページ | あり (TTL付き) |
| Server-Side Rendering (SSR) | リクエスト毎 | リアルタイムデータ | なし |
| Client-Side Rendering (CSR) | ブラウザ上 | インタラクティブなUI | なし |

#### 2. 静的生成 (SSG)

**デフォルトの動作:**

```tsx
// app/about/page.tsx
// これは自動的にSSG (ビルド時に生成)
export default function AboutPage() {
  return (
    <div>
      <h1>About Us</h1>
      <p>This page is statically generated at build time.</p>
    </div>
  )
}
```

**動的ルートの静的生成:**

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  // ビルド時に生成するパスを指定
  const posts = await fetch('https://api.example.com/posts').then(
    (res) => res.json()
  )

  return posts.map((post: any) => ({
    slug: post.slug,
  }))
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params

  // ビルド時にデータを取得
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (res) => res.json()
  )

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

#### 3. Incremental Static Regeneration (ISR)

**revalidateオプション:**

```tsx
// app/news/page.tsx
export const revalidate = 3600 // 1時間ごとに再生成

export default async function NewsPage() {
  const news = await fetch('https://api.example.com/news').then(
    (res) => res.json()
  )

  return (
    <div>
      <h1>Latest News</h1>
      {news.map((item: any) => (
        <article key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
        </article>
      ))}
    </div>
  )
}
```

**On-Demand Revalidation (オンデマンド再検証):**

```tsx
// app/actions/revalidate.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

// パスベースの再検証
export async function revalidateNews() {
  revalidatePath('/news')
}

// タグベースの再検証
export async function revalidateNewsByTag() {
  revalidateTag('news')
}
```

```tsx
// タグ付きfetch
export default async function NewsPage() {
  const news = await fetch('https://api.example.com/news', {
    next: { tags: ['news'] },
  })

  // ...
}
```

#### 4. Dynamic Rendering (動的レンダリング)

**動的関数の使用:**

```tsx
// app/dashboard/page.tsx
import { cookies, headers } from 'next/headers'

// cookies()やheaders()を使うと自動的に動的レンダリング
export default async function DashboardPage() {
  const cookieStore = await cookies()
  const headersList = await headers()

  const userId = cookieStore.get('userId')
  const userAgent = headersList.get('user-agent')

  return (
    <div>
      <h1>Dashboard</h1>
      <p>User ID: {userId?.value}</p>
      <p>User Agent: {userAgent}</p>
    </div>
  )
}
```

**強制的に動的レンダリング:**

```tsx
// app/realtime/page.tsx
export const dynamic = 'force-dynamic' // SSR強制
export const revalidate = 0 // キャッシュ無効化

export default async function RealtimePage() {
  const data = await fetch('https://api.example.com/realtime')

  return <div>{/* リアルタイムデータ */}</div>
}
```

#### 5. コード分割と遅延ロード

**dynamic()による遅延ロード:**

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'

// Client Componentの遅延ロード
const HeavyChart = dynamic(() => import('./components/HeavyChart'), {
  loading: () => <p>Loading chart...</p>,
  ssr: false, // SSRを無効化 (ブラウザ専用コンポーネント)
})

export default function HomePage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <HeavyChart data={[1, 2, 3]} />
    </div>
  )
}
```

**Suspenseによる段階的ロード:**

```tsx
import { Suspense } from 'react'

async function SlowComponent() {
  await new Promise((resolve) => setTimeout(resolve, 3000))
  return <div>Slow content loaded!</div>
}

export default function Page() {
  return (
    <div>
      <h1>My Page</h1>

      {/* 即座に表示 */}
      <p>This loads immediately</p>

      {/* ローディング表示 → 3秒後に表示 */}
      <Suspense fallback={<div>Loading slow content...</div>}>
        <SlowComponent />
      </Suspense>
    </div>
  )
}
```

**複数のSuspense境界:**

```tsx
import { Suspense } from 'react'

async function Comments() {
  const comments = await fetchComments()
  return <div>{/* コメント表示 */}</div>
}

async function RelatedPosts() {
  const posts = await fetchRelatedPosts()
  return <div>{/* 関連記事表示 */}</div>
}

export default function BlogPost() {
  return (
    <article>
      <h1>Blog Post</h1>

      {/* それぞれ独立してロード */}
      <Suspense fallback={<div>Loading comments...</div>}>
        <Comments />
      </Suspense>

      <Suspense fallback={<div>Loading related posts...</div>}>
        <RelatedPosts />
      </Suspense>
    </article>
  )
}
```

#### 6. バンドルサイズの最適化

**Bundle Analyzerの使用:**

```bash
pnpm add -D @next/bundle-analyzer
```

```typescript
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const config = {
  // Next.js設定
}

export default withBundleAnalyzer(config)
```

```bash
# バンドルサイズを分析
ANALYZE=true pnpm build
```

**Tree Shakingのための注意点:**

```tsx
// ❌ 悪い例: デフォルトインポート (全体が読み込まれる)
import _ from 'lodash'
const result = _.uniq([1, 2, 2, 3])

// ✅ 良い例: 名前付きインポート (必要な部分のみ)
import { uniq } from 'lodash-es'
const result = uniq([1, 2, 2, 3])
```

### 実践課題

1. ブログ一覧ページにISRを実装してください (revalidate: 60秒)
2. 重いコンポーネントをdynamic()で遅延ロードしてください
3. Bundle Analyzerでバンドルサイズを確認してください

### 理解度チェック

- [ ] SSG, ISR, SSRの違いを説明できる
- [ ] revalidateとrevalidatePathを使い分けられる
- [ ] Suspenseで段階的ロードを実装できる
- [ ] dynamic()でコンポーネントを遅延ロードできる

---

## Day 24-25: SEO対策とメタデータ

### 学習内容

#### 1. メタデータの基礎

**静的メタデータ:**

```tsx
// app/about/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  description: 'Learn more about our company and team',
  title: 'About Us',
}

export default function AboutPage() {
  return <div>About content</div>
}
```

**動的メタデータ:**

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params

  // データベースやAPIから記事を取得
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (res) => res.json()
  )

  return {
    description: post.excerpt,
    openGraph: {
      images: [post.image],
      title: post.title,
    },
    title: post.title,
    twitter: {
      card: 'summary_large_image',
      images: [post.image],
      title: post.title,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (res) => res.json()
  )

  return <article>{/* 記事内容 */}</article>
}
```

#### 2. 共通メタデータ

**ルートレイアウトでの設定:**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  applicationName: 'My Next.js App',
  authors: [{ name: 'Your Name' }],
  creator: 'Your Name',
  description: 'A modern web application built with Next.js',
  keywords: ['Next.js', 'React', 'TypeScript', 'Web Development'],
  metadataBase: new URL('https://example.com'),
  openGraph: {
    description: 'A modern web application built with Next.js',
    locale: 'ja_JP',
    siteName: 'My Next.js App',
    title: 'My Next.js App',
    type: 'website',
    url: 'https://example.com',
  },
  title: {
    default: 'My Next.js App',
    template: '%s | My Next.js App',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@yourusername',
  },
}

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

**titleテンプレートの使用:**

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    default: 'My App',
    template: '%s | My App', // 子ページで "About" → "About | My App"
  },
}

// app/about/page.tsx
export const metadata = {
  title: 'About', // → "About | My App"
}
```

#### 3. Open GraphとTwitter Card

**詳細なOGP設定:**

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  return {
    description: post.excerpt,
    openGraph: {
      authors: [post.author.name],
      description: post.excerpt,
      images: [
        {
          alt: post.title,
          height: 630,
          url: post.image,
          width: 1200,
        },
      ],
      locale: 'ja_JP',
      publishedTime: post.publishedAt,
      title: post.title,
      type: 'article',
      url: `https://example.com/blog/${slug}`,
    },
    title: post.title,
    twitter: {
      card: 'summary_large_image',
      creator: `@${post.author.twitter}`,
      description: post.excerpt,
      images: [post.image],
      title: post.title,
    },
  }
}
```

#### 4. 構造化データ (JSON-LD)

**記事の構造化データ:**

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    datePublished: post.publishedAt,
    description: post.excerpt,
    headline: post.title,
    image: post.image,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>
    </>
  )
}
```

**パンくずリストの構造化データ:**

```tsx
export default function BlogPostPage() {
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        item: 'https://example.com',
        name: 'Home',
        position: 1,
      },
      {
        '@type': 'ListItem',
        item: 'https://example.com/blog',
        name: 'Blog',
        position: 2,
      },
      {
        '@type': 'ListItem',
        item: 'https://example.com/blog/my-post',
        name: 'My Post',
        position: 3,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* コンテンツ */}
    </>
  )
}
```

#### 5. サイトマップとRobots.txt

**サイトマップの生成:**

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 動的ページを取得
  const posts = await fetch('https://api.example.com/posts').then(
    (res) => res.json()
  )

  const postUrls = posts.map((post: any) => ({
    changeFrequency: 'weekly' as const,
    lastModified: new Date(post.updatedAt),
    priority: 0.8,
    url: `https://example.com/blog/${post.slug}`,
  }))

  return [
    {
      changeFrequency: 'yearly',
      lastModified: new Date(),
      priority: 1,
      url: 'https://example.com',
    },
    {
      changeFrequency: 'monthly',
      lastModified: new Date(),
      priority: 0.9,
      url: 'https://example.com/about',
    },
    {
      changeFrequency: 'weekly',
      lastModified: new Date(),
      priority: 0.9,
      url: 'https://example.com/blog',
    },
    ...postUrls,
  ]
}
```

**Robots.txtの生成:**

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: '/',
        userAgent: '*',
      },
      {
        disallow: '/admin',
        userAgent: '*',
      },
      {
        disallow: '/api',
        userAgent: '*',
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

#### 6. favicon と app icons

**ファビコンの設置:**

```
app/
├── favicon.ico          # デフォルトのファビコン
├── icon.png            # アプリアイコン
├── apple-icon.png      # Apple Touch Icon
└── manifest.json       # Web App Manifest (PWA用)
```

**動的アイコン生成:**

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  height: 32,
  width: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(to bottom, #3b82f6, #8b5cf6)',
          display: 'flex',
          fontSize: 24,
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        M
      </div>
    ),
    {
      ...size,
    }
  )
}
```

### 実践課題

1. ブログ記事にOGPとTwitter Cardを設定してください
2. 構造化データ (JSON-LD) を実装してください
3. sitemap.tsとrobots.tsを作成してください

### 理解度チェック

- [ ] 静的・動的メタデータを設定できる
- [ ] OGPとTwitter Cardを実装できる
- [ ] 構造化データを追加できる
- [ ] サイトマップとrobots.txtを生成できる

---

## Day 26-27: デプロイと環境設定

### 学習内容

#### 1. Vercelへのデプロイ準備

**環境変数の整理:**

```bash
# .env.local (ローカル開発用 - Gitにコミットしない)
DATABASE_URL="file:./dev.db"
AUTH_SECRET="local-secret"

# .env.production (本番環境用 - Gitにコミットしない)
DATABASE_URL="production-database-url"
AUTH_SECRET="production-secret"
```

**環境変数の型定義:**

```typescript
// env.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      AUTH_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_APP_URL: string
    }
  }
}

export {}
```

**next.configでの環境変数検証:**

```typescript
// next.config.ts
const config = {
  // 設定...
}

// 必須の環境変数をチェック
const requiredEnvVars = ['DATABASE_URL', 'AUTH_SECRET']

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
})

export default config
```

#### 2. Vercelプロジェクトの作成

**GitHubとの連携:**

1. https://vercel.com にアクセス
2. "Add New Project" をクリック
3. GitHubリポジトリをインポート
4. プロジェクト設定:
   - Framework Preset: Next.js (自動検出)
   - Root Directory: ./
   - Build Command: `pnpm build`
   - Output Directory: .next

**環境変数の設定:**

Vercelダッシュボードで:
- Settings → Environment Variables
- 各環境変数を追加:
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `AUTH_URL` (本番URL)

**環境ごとの設定:**

- Production: 本番環境
- Preview: プルリクエスト毎のプレビュー
- Development: ローカル開発環境

#### 3. ドメイン設定

**カスタムドメインの追加:**

1. Vercelダッシュボード → Settings → Domains
2. "Add Domain" をクリック
3. ドメイン名を入力 (例: example.com)
4. DNSレコードを設定:

```
# Aレコード
Type: A
Name: @
Value: 76.76.21.21

# CNAMEレコード (www)
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

5. SSL証明書は自動発行

#### 4. パフォーマンス監視

**Vercel Analyticsの追加:**

```bash
pnpm add @vercel/analytics
```

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

**Vercel Speed Insightsの追加:**

```bash
pnpm add @vercel/speed-insights
```

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
```

#### 5. 継続的デプロイメント

**GitHubとの連携フロー:**

```bash
# 機能ブランチを作成
git checkout -b feature/new-feature

# コードを変更してコミット
git add .
git commit -m "Add new feature"

# GitHubにプッシュ
git push origin feature/new-feature
```

→ Vercelが自動的にプレビューデプロイを作成

**プルリクエスト:**

1. GitHubでPRを作成
2. Vercelがプレビュー環境を自動デプロイ
3. プレビューURLで動作確認
4. PRをマージ
5. 自動的に本番環境にデプロイ

#### 6. エラー監視とログ

**Sentryの統合:**

```bash
pnpm add @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

**Vercelのログ確認:**

- Vercelダッシュボード → Deployments
- 各デプロイのログを確認
- エラーやビルドログを確認

### 実践課題

1. GitHubにリポジトリを作成してプッシュしてください
2. Vercelにデプロイしてください
3. 環境変数を設定してください
4. カスタムドメインを設定してください (オプション)

### 理解度チェック

- [ ] Vercelにプロジェクトをデプロイできる
- [ ] 環境変数を適切に設定できる
- [ ] 継続的デプロイメントの仕組みを理解している
- [ ] Analyticsで分析できる

---

## Day 28-30: 最終プロジェクトとポートフォリオ作成

### 第4週の総まとめ

#### 学んだ主要概念

1. **パフォーマンス最適化**
   - SSG, ISR, SSRの使い分け
   - コード分割と遅延ロード
   - Suspenseによる段階的ロード
   - バンドルサイズ最適化

2. **SEO対策**
   - メタデータの設定
   - OGPとTwitter Card
   - 構造化データ (JSON-LD)
   - サイトマップとrobots.txt

3. **デプロイと本番環境**
   - Vercelへのデプロイ
   - 環境変数の管理
   - 継続的デプロイメント
   - パフォーマンス監視

### 最終プロジェクト: ポートフォリオサイト

**要件:**

**必須機能:**
- トップページ (自己紹介)
- プロジェクト一覧ページ
- プロジェクト詳細ページ
- お問い合わせフォーム
- ブログ機能 (簡易版)

**技術要件:**
- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Drizzle ORM + Turso
- Zod バリデーション
- 完全なSEO対策
- Vercelへのデプロイ

**パフォーマンス目標:**
- Lighthouse Performance: 90+
- Lighthouse SEO: 100
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s

**実装の流れ:**

1. **Day 28: 設計とセットアップ**
   - ワイヤーフレーム作成
   - データベーススキーマ設計
   - プロジェクト初期化
   - 基本レイアウト作成

2. **Day 29: 機能実装**
   - トップページ実装
   - プロジェクト一覧・詳細ページ
   - お問い合わせフォーム (Server Actions + Zod)
   - ブログ機能 (ISR使用)
   - SEO対策完全実装

3. **Day 30: 最適化とデプロイ**
   - パフォーマンス最適化
   - Lighthouse監査
   - Vercelへのデプロイ
   - カスタムドメイン設定 (オプション)
   - 最終チェックとドキュメント作成

### 学習の振り返り

#### 1ヶ月で習得したスキル

**Week 1:**
- ✅ Next.js基礎
- ✅ App Routerの理解
- ✅ Server/Client Components

**Week 2:**
- ✅ Server Actions
- ✅ APIルート
- ✅ データベース連携

**Week 3:**
- ✅ 認証機能
- ✅ フォームバリデーション
- ✅ 画像最適化

**Week 4:**
- ✅ パフォーマンス最適化
- ✅ SEO対策
- ✅ Vercelデプロイ

### 次のステップ

**さらなる学習:**

1. **フレームワーク・ライブラリ:**
   - tRPC (型安全なAPI)
   - Prisma (高度なORM)
   - React Query (データフェッチング)

2. **アーキテクチャ:**
   - モノレポ (Turborepo)
   - マイクロフロントエンド
   - BFF (Backend for Frontend)

3. **インフラ:**
   - Docker
   - Kubernetes
   - AWS/GCP

4. **テスト:**
   - Vitest
   - Playwright (E2Eテスト)
   - Storybook

**おすすめリソース:**

- [Next.js Examples](https://github.com/vercel/next.js/tree/canary/examples)
- [Patterns.dev](https://www.patterns.dev/)
- [web.dev](https://web.dev/)
- [Next.js Blog](https://nextjs.org/blog)

### 完走おめでとうございます! 🎉

1ヶ月間のNext.js学習カリキュラムを完了しました。

あなたは今、以下のことができるようになっています:
- Next.js App Routerを使った本格的なWebアプリケーション開発
- データベースと連携したフルスタックアプリケーションの構築
- 認証機能の実装
- パフォーマンスとSEOを考慮した最適化
- 本番環境へのデプロイ

この知識を活かして、素晴らしいWebアプリケーションを開発してください!

---

**前に戻る:** [第3週: 実践編](./week3.md)
**トップに戻る:** [カリキュラムトップ](./README.md)
