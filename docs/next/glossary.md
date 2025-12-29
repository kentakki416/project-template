# Next.js 用語集

このドキュメントでは、Next.jsに関連する重要な用語を分かりやすく解説します。

## A

### App Router
Next.js 13で導入された新しいルーティングシステム。`app/`ディレクトリを使用し、ファイルベースのルーティング、レイアウト、Server Componentsなどの機能を提供します。

**従来のPages Routerとの違い:**
- `app/`ディレクトリを使用 (Pages Routerは`pages/`)
- Server ComponentsとClient Componentsの明確な区別
- レイアウトのネスト機能
- より柔軟なデータフェッチング

---

## C

### Client Component
ブラウザ上で実行されるReactコンポーネント。ファイルの先頭に`'use client'`ディレクティブを記述することで指定します。

**特徴:**
- React Hooks (`useState`, `useEffect`等) が使用可能
- ブラウザAPIへのアクセスが可能
- イベントハンドラが使用可能
- バンドルサイズに含まれる

**使用場面:**
- ユーザーインタラクション (ボタンクリックなど)
- ブラウザAPI (`localStorage`, `window`など)
- React Hooks

### CSR (Client-Side Rendering)
ブラウザ上でJavaScriptを実行してHTMLを生成するレンダリング方法。

**メリット:**
- インタラクティブなUIが実装しやすい
- サーバー負荷が軽い

**デメリット:**
- 初回表示が遅い
- SEOに不利
- JavaScriptが無効だと動作しない

---

## D

### Dynamic Rendering
リクエストごとにサーバーでHTMLを生成するレンダリング方法。SSRとほぼ同義。

**自動的にDynamic Renderingになるケース:**
- `cookies()`, `headers()`などの動的関数を使用
- `searchParams`を使用
- `dynamic = 'force-dynamic'`を設定

---

## H

### Hot Reload (ホットリロード)
開発中にコードを変更すると、ブラウザを手動でリロードせずに自動的に変更が反映される機能。Fast Refreshとも呼ばれます。

---

## I

### ISR (Incremental Static Regeneration)
静的生成されたページを、一定時間経過後に再生成する仕組み。

**使い方:**
```tsx
export const revalidate = 60 // 60秒ごとに再生成
```

**メリット:**
- ビルド時間が短い (全ページを生成する必要がない)
- 常に最新に近いコンテンツを提供
- 高速なページ表示

**使用場面:**
- ニュースサイト
- ブログ
- ECサイトの商品ページ

---

## L

### Layout (レイアウト)
複数のページで共有されるUIコンポーネント。ヘッダー、フッター、サイドバーなどを定義します。

**特徴:**
- `layout.tsx`ファイルで定義
- ネスト可能 (親レイアウト → 子レイアウト)
- ページ遷移時に再レンダリングされない

---

## M

### Metadata (メタデータ)
ページのタイトル、説明、OGP画像などのSEOに関連する情報。

**静的メタデータ:**
```tsx
export const metadata = {
  description: 'Page description',
  title: 'Page Title',
}
```

**動的メタデータ:**
```tsx
export async function generateMetadata({ params }) {
  return {
    title: `Post ${params.id}`,
  }
}
```

### Middleware (ミドルウェア)
リクエストが処理される前に実行されるコード。認証チェック、リダイレクト、ヘッダー追加などに使用します。

**設置場所:** `middleware.ts` (プロジェクトルート)

**使用例:**
```tsx
export function middleware(request: NextRequest) {
  // 認証チェック
  // リダイレクト
  // ヘッダー追加
}
```

---

## P

### Pages Router
Next.js 12以前のデフォルトルーティングシステム。`pages/`ディレクトリを使用します。

**App Routerとの違い:**
- Server ComponentsとClient Componentsの区別がない
- `getServerSideProps`, `getStaticProps`でデータ取得
- レイアウトの共有が複雑

### Prefetch (プリフェッチ)
ユーザーがリンクをクリックする前に、リンク先のページをバックグラウンドで読み込む機能。`<Link>`コンポーネントがデフォルトで行います。

**効果:**
- ページ遷移が高速になる
- ユーザー体験が向上

---

## R

### Revalidation (再検証)
キャッシュされたデータを再取得し、ページを更新する仕組み。

**2つの方法:**
1. **Time-based:** 一定時間ごとに再検証
   ```tsx
   export const revalidate = 60
   ```

2. **On-demand:** 手動で再検証
   ```tsx
   revalidatePath('/blog')
   revalidateTag('posts')
   ```

### Route Handler (ルートハンドラ)
APIエンドポイントを作成する機能。`app/api/`ディレクトリに`route.ts`ファイルを配置します。

**例:**
```tsx
// app/api/hello/route.ts
export async function GET() {
  return Response.json({ message: 'Hello' })
}
```

---

## S

### Server Actions
サーバー上で実行される関数。フォーム送信やデータ変更に使用します。

**特徴:**
- `'use server'`ディレクティブで定義
- APIエンドポイントを作成せずに済む
- 型安全
- JavaScriptなしでも動作

**使い方:**
```tsx
'use server'
export async function createPost(formData: FormData) {
  // サーバー上で実行される
}
```

### Server Component
サーバー上でのみ実行されるReactコンポーネント。App Routerではデフォルトです。

**特徴:**
- データベースやAPIに直接アクセス可能
- バンドルサイズに含まれない
- SEOに有利

**制限:**
- React Hooksが使えない
- ブラウザAPIが使えない
- イベントハンドラが使えない

### SSG (Static Site Generation)
ビルド時に全てのHTMLを生成する方法。

**メリット:**
- 最速のページ表示
- サーバー負荷がほぼゼロ
- CDNでキャッシュ可能

**デメリット:**
- ビルド時間が長い (ページ数が多い場合)
- リアルタイム性がない

**使用場面:**
- ドキュメント
- ブログ
- ランディングページ

### SSR (Server-Side Rendering)
リクエストごとにサーバーでHTMLを生成する方法。

**メリット:**
- リアルタイムデータを表示可能
- SEOに有利
- 初回表示が速い (CSRと比較)

**デメリット:**
- サーバー負荷が高い
- 表示までに時間がかかる (SSGと比較)

**使用場面:**
- ダッシュボード
- ユーザー固有のページ
- リアルタイム性が必要なページ

### Suspense (サスペンス)
非同期処理中にローディング状態を表示するReactの機能。

**使い方:**
```tsx
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

**効果:**
- 段階的なページロード
- ユーザー体験の向上

---

## T

### Turbopack
Vercelが開発している次世代バンドラー。Webpackよりも高速です。

**使い方:**
```bash
next dev --turbo
```

---

## Z

### Zod
TypeScriptファーストのスキーマバリデーションライブラリ。

**特徴:**
- 型推論が強力
- エラーメッセージのカスタマイズが容易
- Next.jsと相性が良い

**使用例:**
```tsx
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

type User = z.infer<typeof schema>
```

---

## その他の重要な概念

### Hydration (ハイドレーション)
サーバーで生成されたHTMLに、ブラウザ上でJavaScriptを適用してインタラクティブにするプロセス。

**流れ:**
1. サーバーがHTMLを生成
2. ブラウザがHTMLを表示 (この時点では静的)
3. JavaScriptがロードされ、HTMLに適用される
4. ページがインタラクティブになる

### File-based Routing (ファイルベースルーティング)
ファイルの配置によってURLが自動的に決まるルーティング方式。

**例:**
```
app/
├── page.tsx           → /
├── about/
│   └── page.tsx      → /about
└── blog/
    └── [id]/
        └── page.tsx  → /blog/123
```

### Edge Runtime
Vercelのエッジネットワーク上で実行される軽量なランタイム。

**特徴:**
- 世界中のエッジロケーションで実行
- 低レイテンシー
- Node.js APIの一部が使用不可

**使い方:**
```tsx
export const runtime = 'edge'
```

---

**トップに戻る:** [カリキュラムトップ](./README.md)
