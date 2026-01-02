# メタデータ

## 概要

Next.jsのMetadata APIを使用すると、SEO対策のためのHTMLメタタグを簡単に設定できます。App Routerでは、`layout.tsx`または`page.tsx`で`metadata`オブジェクトをエクスポートするか、`generateMetadata`関数を使って動的にメタデータを生成します。

**主な特徴:**
- TypeScriptによる型安全性
- 静的および動的メタデータのサポート
- Open Graph、Twitter Cardの自動生成
- ファイルベースのメタデータ（favicon、OG画像など）
- sitemap.xmlとrobots.txtの自動生成

## 基本的な使い方

### 静的メタデータ

```tsx
// app/about/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn more about our company',
}

export default function AboutPage() {
  return <div>About content</div>
}
```

### 動的メタデータ

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(res => res.json())

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(res => res.json())

  return <article>{post.content}</article>
}
```

## 詳細な説明

### メタデータのマージ

子ルートのメタデータが親のメタデータをマージ・上書きします:

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',
  },
}
```

```tsx
// app/blog/page.tsx
export const metadata = {
  title: 'Blog', // → "Blog | My App"
}
```

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const { slug } = await params
  const post = await getPost(slug)

  return {
    title: post.title, // → "Post Title | My App"
  }
}
```

### 完全なメタデータ設定例

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',
  },
  description: 'My application description',
  keywords: ['Next.js', 'React', 'TypeScript'],
  authors: [{ name: 'Your Name', url: 'https://yoursite.com' }],
  creator: 'Your Name',
  publisher: 'Your Company',
  metadataBase: new URL('https://yoursite.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'ja-JP': '/ja-JP',
    },
  },
  openGraph: {
    title: 'My App',
    description: 'My application description',
    url: 'https://yoursite.com',
    siteName: 'My App',
    images: [
      {
        url: 'https://yoursite.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'My App',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My App',
    description: 'My application description',
    creator: '@yourusername',
    images: ['https://yoursite.com/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-verification-code',
    yandex: 'yandex-verification-code',
  },
}
```

### Open Graph (OG)

```tsx
export const metadata = {
  openGraph: {
    title: 'My Page',
    description: 'Page description',
    url: 'https://example.com',
    siteName: 'My Site',
    images: [
      {
        url: 'https://example.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'OG Image',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
}
```

記事ページの場合:

```tsx
export const metadata = {
  openGraph: {
    type: 'article',
    publishedTime: '2024-01-01T00:00:00.000Z',
    modifiedTime: '2024-01-02T00:00:00.000Z',
    authors: ['Author Name'],
    tags: ['Next.js', 'React'],
  },
}
```

### Twitter Card

```tsx
export const metadata = {
  twitter: {
    card: 'summary_large_image',
    title: 'My Page',
    description: 'Page description',
    creator: '@username',
    images: ['https://example.com/twitter-image.jpg'],
  },
}
```

**カードタイプ:**
- `summary`: 小さい画像
- `summary_large_image`: 大きい画像
- `app`: アプリカード
- `player`: メディアプレイヤー

### robots.txt

```tsx
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  }
}
```

### sitemap.xml

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetch('https://api.example.com/posts').then(res => res.json())

  const postUrls = posts.map((post: any) => ({
    url: `https://example.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    ...postUrls,
  ]
}
```

### favicon

ファイルベースのメタデータ:

```
app/
├── favicon.ico          # /favicon.ico
├── icon.png            # /icon.png
├── apple-icon.png      # /apple-icon.png
└── manifest.webmanifest # /manifest.webmanifest
```

動的に生成:

```tsx
// app/icon.tsx
import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'blue',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        A
      </div>
    ),
    {
      ...size,
    }
  )
}
```

### OG画像の動的生成

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
      </div>
    ),
    {
      ...size,
    }
  )
}
```

### manifest.json

```tsx
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My App',
    short_name: 'App',
    description: 'My application description',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
```

## ベストプラクティス

### 1. metadataBaseを設定

```tsx
// ✅ Good: ルートレイアウトでmetadataBaseを設定
export const metadata = {
  metadataBase: new URL('https://example.com'),
  openGraph: {
    images: '/og-image.jpg', // → https://example.com/og-image.jpg
  },
}

// ❌ Bad: 毎回フルURLを指定
export const metadata = {
  openGraph: {
    images: 'https://example.com/og-image.jpg',
  },
}
```

### 2. titleテンプレートを活用

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
}

// app/blog/page.tsx
export const metadata = {
  title: 'Blog', // → "Blog | My App"
}
```

### 3. 動的メタデータでキャッシュを活用

```tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  // ✅ Good: fetch APIはデフォルトでキャッシュされる
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(res => res.json())

  return {
    title: post.title,
  }
}
```

### 4. 構造化データ (JSON-LD) を追加

```tsx
export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    datePublished: post.publishedAt,
    image: post.image,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>{post.content}</article>
    </>
  )
}
```

## よくある落とし穴

### 1. metadataBaseの設定忘れ

```tsx
// ❌ Bad: metadataBaseがないと相対URLが機能しない
export const metadata = {
  openGraph: {
    images: '/og-image.jpg', // 正しく解決されない
  },
}

// ✅ Good: metadataBaseを設定
export const metadata = {
  metadataBase: new URL('https://example.com'),
  openGraph: {
    images: '/og-image.jpg', // → https://example.com/og-image.jpg
  },
}
```

### 2. 動的メタデータでのawait忘れ

```tsx
// ❌ Bad: paramsはPromise（Next.js 15+）
export async function generateMetadata({ params }: PageProps) {
  const slug = params.slug // エラー
}

// ✅ Good: awaitで解決
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
}
```

### 3. Client Componentでのメタデータ

```tsx
// ❌ Bad: Client Componentではmetadataを使えない
'use client'

export const metadata = {
  title: 'My Page', // 無視される
}
```

Client Componentでメタデータを変更したい場合は、親のServer Componentで設定するか、`next/head`を使用します。

### 4. OG画像のサイズ

```tsx
// ❌ Bad: 不適切なサイズ
export const metadata = {
  openGraph: {
    images: [
      {
        url: '/og-image.jpg',
        width: 800, // 小さすぎる
        height: 400,
      },
    ],
  },
}

// ✅ Good: 推奨サイズ 1200x630
export const metadata = {
  openGraph: {
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
}
```

## 関連リソース

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Schema.org](https://schema.org/)
- [Google Search Central](https://developers.google.com/search/docs)
