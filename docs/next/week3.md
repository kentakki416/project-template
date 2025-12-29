# 第3週: 実践編

## 今週のゴール

- NextAuth.jsを使って認証機能を実装できる
- Zodでフォームバリデーションを実装できる
- ミドルウェアでルート保護ができる
- 画像最適化を理解して実装できる

## Day 15-16: 認証機能の実装

### 学習内容

#### 1. NextAuth.js (Auth.js v5) とは

**Auth.js (旧NextAuth.js):**
- Next.jsに特化した認証ライブラリ
- 複数の認証プロバイダーをサポート (Google, GitHub, Email等)
- セッション管理
- JWT / Database Session対応

**主な機能:**
- ソーシャルログイン (OAuth)
- メール/パスワード認証
- セッション管理
- CSRF保護
- 暗号化

#### 2. Auth.jsのセットアップ

**インストール:**

```bash
pnpm add next-auth@beta
```

**環境変数の設定:**

```bash
# .env.local
# ランダムな文字列を生成: openssl rand -base64 32
AUTH_SECRET="your-random-secret-here"

# 本番環境のURL
AUTH_URL="http://localhost:3000"
```

**基本設定:**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // ここで認証ロジックを実装
        const { email, password } = credentials

        // 実際はデータベースからユーザーを取得
        if (email === 'user@example.com' && password === 'password') {
          return {
            email: 'user@example.com',
            id: '1',
            name: 'Test User',
          }
        }

        return null
      },
    }),
  ],
  pages: {
    signIn: '/login', // カスタムログインページ
  },
})
```

**APIルートの設定:**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

#### 3. ログイン/ログアウト機能の実装

**ログインページ:**

```tsx
// app/login/page.tsx
import { signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default function LoginPage() {
  async function handleLogin(formData: FormData) {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      // エラー処理
      console.error('Login failed:', result.error)
      return
    }

    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-6">Login</h1>

        <form action={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-2 border rounded"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-4 py-2 border rounded"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            Login
          </button>
        </form>
      </div>
    </main>
  )
}
```

**ログアウトボタン:**

```tsx
// app/components/LogoutButton.tsx
import { signOut } from '@/lib/auth'

export default function LogoutButton() {
  return (
    <form
      action={async () => {
        'use server'
        await signOut()
      }}
    >
      <button
        type="submit"
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Logout
      </button>
    </form>
  )
}
```

#### 4. セッション情報の取得

**Server Componentでセッション取得:**

```tsx
// app/dashboard/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogoutButton from '../components/LogoutButton'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
      <p className="text-lg mb-4">
        Welcome, {session.user?.name || session.user?.email}!
      </p>
      <LogoutButton />
    </main>
  )
}
```

**Client Componentでセッション取得:**

```tsx
// app/components/UserInfo.tsx
'use client'

import { useSession } from 'next-auth/react'

export default function UserInfo() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session) {
    return <div>Not logged in</div>
  }

  return (
    <div>
      <p>Logged in as: {session.user?.email}</p>
    </div>
  )
}
```

**SessionProviderの設定 (Client Component用):**

```tsx
// app/providers.tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

#### 5. データベース連携 (Drizzle Adapter)

**スキーマ定義:**

```typescript
// lib/db/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp' }),
  id: text('id').primaryKey(),
  image: text('image'),
  name: text('name'),
  password: text('password'), // ハッシュ化されたパスワード
})

export const sessions = sqliteTable('sessions', {
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
  id: text('id').primaryKey(),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = sqliteTable('accounts', {
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  id: text('id').primaryKey(),
  id_token: text('id_token'),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  scope: text('scope'),
  session_state: text('session_state'),
  token_type: text('token_type'),
  type: text('type').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const verificationTokens = sqliteTable('verificationTokens', {
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
})
```

**Drizzle Adapterの設定:**

```bash
pnpm add @auth/drizzle-adapter
```

```typescript
// lib/auth.ts
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from './db'

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const { email, password } = credentials

        // データベースからユーザーを取得
        // const user = await db.query.users.findFirst({
        //   where: eq(users.email, email),
        // })

        // パスワードの検証
        // const isValid = await bcrypt.compare(password, user.password)

        // if (!isValid) return null

        return {
          email,
          id: '1',
          name: 'User',
        }
      },
    }),
  ],
  session: {
    strategy: 'database',
  },
})
```

#### 6. ソーシャルログイン (GitHub)

**GitHubアプリの作成:**
1. https://github.com/settings/developers にアクセス
2. "New OAuth App" をクリック
3. 以下を入力:
   - Application name: My Next.js App
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3000/api/auth/callback/github

**環境変数の設定:**

```bash
# .env.local
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"
```

**Auth.jsの設定:**

```typescript
// lib/auth.ts
import GitHub from 'next-auth/providers/github'

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
})
```

**ログインページにGitHubボタンを追加:**

```tsx
// app/login/page.tsx
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  async function handleGitHubLogin() {
    'use server'
    await signIn('github', { redirectTo: '/dashboard' })
  }

  return (
    <div>
      <form action={handleGitHubLogin}>
        <button
          type="submit"
          className="w-full bg-gray-800 text-white py-2 rounded"
        >
          Login with GitHub
        </button>
      </form>
    </div>
  )
}
```

### 実践課題

1. Auth.jsをセットアップして基本的なログイン機能を実装してください
2. ダッシュボードページを作成して、未認証ユーザーをリダイレクトしてください
3. GitHubログインを実装してください (オプション)

### 理解度チェック

- [ ] Auth.jsの基本的な設定ができる
- [ ] ログイン/ログアウト機能を実装できる
- [ ] セッション情報を取得できる
- [ ] ルートを認証で保護できる

---

## Day 17-18: フォームバリデーション

### 学習内容

#### 1. Zodとは

**Zodの特徴:**
- TypeScriptファーストのスキーマバリデーションライブラリ
- 型推論が強力
- エラーメッセージのカスタマイズが容易
- Next.jsと相性が良い

**インストール:**

```bash
pnpm add zod
```

#### 2. 基本的なスキーマ定義

**シンプルなスキーマ:**

```typescript
// lib/validations/user.ts
import { z } from 'zod'

export const createUserSchema = z.object({
  age: z.number().min(0).max(120).optional(),
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// TypeScript型を推論
export type CreateUserInput = z.infer<typeof createUserSchema>
```

**複雑なバリデーション:**

```typescript
// lib/validations/post.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  // 必須フィールド
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must be less than 100 characters'),

  // 任意フィールド
  content: z.string().optional(),

  // デフォルト値
  published: z.boolean().default(false),

  // 配列
  tags: z.array(z.string()).min(1, 'At least one tag is required'),

  // ネストされたオブジェクト
  author: z.object({
    email: z.string().email(),
    name: z.string(),
  }),

  // カスタムバリデーション
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),

  // 日付
  publishedAt: z.date().optional(),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
```

#### 3. Server Actionsでのバリデーション

**基本的な使い方:**

```tsx
// app/actions/user.ts
'use server'

import { createUserSchema } from '@/lib/validations/user'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  // FormDataをオブジェクトに変換
  const rawData = {
    age: formData.get('age')
      ? parseInt(formData.get('age') as string)
      : undefined,
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
  }

  // Zodでバリデーション
  const result = createUserSchema.safeParse(rawData)

  if (!result.success) {
    // エラーを返す
    return {
      errors: result.error.flatten().fieldErrors,
      success: false,
    }
  }

  // バリデーション成功 - データベースに保存
  const user = result.data
  // await db.user.create({ data: user })

  console.log('User created:', user)

  revalidatePath('/users')
  return { success: true }
}
```

**エラーを表示するフォーム:**

```tsx
// app/users/CreateUserForm.tsx
'use client'

import { createUser } from '../actions/user'
import { useFormState } from 'react-dom'

export default function CreateUserForm() {
  const [state, formAction] = useFormState(createUser, {
    success: false,
  })

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="name" className="block mb-2">
          Name
        </label>
        <input
          id="name"
          name="name"
          className="w-full px-4 py-2 border rounded"
        />
        {state?.errors?.name && (
          <p className="text-red-500 text-sm mt-1">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block mb-2">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="w-full px-4 py-2 border rounded"
        />
        {state?.errors?.email && (
          <p className="text-red-500 text-sm mt-1">
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block mb-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="w-full px-4 py-2 border rounded"
        />
        {state?.errors?.password && (
          <p className="text-red-500 text-sm mt-1">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="age" className="block mb-2">
          Age (optional)
        </label>
        <input
          id="age"
          name="age"
          type="number"
          className="w-full px-4 py-2 border rounded"
        />
        {state?.errors?.age && (
          <p className="text-red-500 text-sm mt-1">
            {state.errors.age[0]}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 rounded"
      >
        Create User
      </button>

      {state?.success && (
        <p className="text-green-500">User created successfully!</p>
      )}
    </form>
  )
}
```

#### 4. 高度なバリデーション

**カスタムエラーメッセージ:**

```typescript
import { z } from 'zod'

export const passwordSchema = z
  .object({
    confirmPassword: z.string(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[a-z]/, 'Password must contain lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
```

**条件付きバリデーション:**

```typescript
import { z } from 'zod'

export const userSchema = z
  .object({
    age: z.number().optional(),
    country: z.string().optional(),
    isAdult: z.boolean(),
    name: z.string(),
  })
  .refine(
    (data) => {
      // 成人の場合は年齢が必須
      if (data.isAdult) {
        return data.age !== undefined && data.age >= 18
      }
      return true
    },
    {
      message: 'Age is required and must be 18 or older for adults',
      path: ['age'],
    }
  )
```

**変換とコアース:**

```typescript
import { z } from 'zod'

export const formSchema = z.object({
  // 文字列を数値に変換
  age: z.coerce.number(),

  // 文字列を日付に変換
  birthDate: z.coerce.date(),

  // 文字列をブール値に変換
  subscribe: z
    .string()
    .transform((val) => val === 'true' || val === 'on'),

  // カスタム変換
  tags: z
    .string()
    .transform((val) => val.split(',').map((tag) => tag.trim())),
})
```

#### 5. react-hook-formとの統合

**インストール:**

```bash
pnpm add react-hook-form @hookform/resolvers
```

**使用例:**

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const formSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
})

type FormData = z.infer<typeof formSchema>

export default function SignupForm() {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    // Server Actionを呼び出す
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label>Name</label>
        <input {...register('name')} className="border px-4 py-2" />
        {errors.name && (
          <p className="text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label>Email</label>
        <input
          {...register('email')}
          type="email"
          className="border px-4 py-2"
        />
        {errors.email && (
          <p className="text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label>Password</label>
        <input
          {...register('password')}
          type="password"
          className="border px-4 py-2"
        />
        {errors.password && (
          <p className="text-red-500">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

### 実践課題

1. Zodでユーザー登録フォームのスキーマを定義してください
2. Server Actionでバリデーションを実装してください
3. エラーメッセージを表示するフォームを作成してください

### 理解度チェック

- [ ] Zodで基本的なスキーマを定義できる
- [ ] Server Actionsでバリデーションを実装できる
- [ ] エラーメッセージを適切に表示できる
- [ ] カスタムバリデーションを作成できる

---

## Day 19-20: レイアウトとスタイリング

### 学習内容

#### 1. Tailwind CSS v4の基礎

**設定確認:**

```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

```css
/* app/globals.css */
@import 'tailwindcss';

/* カスタムスタイル */
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
}
```

**よく使うクラス:**

```tsx
// レイアウト
<div className="container mx-auto px-4">
  {/* コンテンツ */}
</div>

// Flexbox
<div className="flex items-center justify-between gap-4">
  {/* アイテム */}
</div>

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* アイテム */}
</div>

// レスポンシブ
<div className="text-sm md:text-base lg:text-lg">
  {/* テキスト */}
</div>
```

#### 2. レイアウトの階層化

**ネストされたレイアウト:**

```tsx
// app/layout.tsx (ルートレイアウト)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <header className="bg-gray-800 text-white p-4">
          <nav className="container mx-auto">
            <h1 className="text-2xl font-bold">My App</h1>
          </nav>
        </header>
        {children}
        <footer className="bg-gray-200 p-4 mt-auto">
          <p className="text-center">© 2025 My App</p>
        </footer>
      </body>
    </html>
  )
}
```

```tsx
// app/dashboard/layout.tsx (ダッシュボード専用レイアウト)
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* サイドバー */}
      <aside className="w-64 bg-gray-100 p-4">
        <nav className="space-y-2">
          <a href="/dashboard" className="block p-2 rounded hover:bg-gray-200">
            Dashboard
          </a>
          <a href="/dashboard/profile" className="block p-2 rounded hover:bg-gray-200">
            Profile
          </a>
          <a href="/dashboard/settings" className="block p-2 rounded hover:bg-gray-200">
            Settings
          </a>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}
```

#### 3. 画像最適化

**next/imageコンポーネント:**

```tsx
import Image from 'next/image'

export default function ImageExample() {
  return (
    <div>
      {/* ローカル画像 */}
      <Image
        src="/images/profile.jpg"
        alt="Profile"
        width={400}
        height={400}
        className="rounded-full"
      />

      {/* 外部画像 */}
      <Image
        src="https://example.com/image.jpg"
        alt="External"
        width={800}
        height={600}
        priority // LCPの場合はpriorityを指定
      />

      {/* fill を使った親要素いっぱいに表示 */}
      <div className="relative w-full h-64">
        <Image
          src="/images/banner.jpg"
          alt="Banner"
          fill
          className="object-cover"
        />
      </div>
    </div>
  )
}
```

**外部画像の設定:**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'example.com',
        protocol: 'https',
      },
      {
        hostname: 'images.unsplash.com',
        protocol: 'https',
      },
    ],
  },
}

export default config
```

#### 4. フォントの最適化

**Google Fontsの使用:**

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-inter',
})

const robotoMono = Roboto_Mono({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-roboto-mono',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  )
}
```

```css
/* app/globals.css */
@import 'tailwindcss';

@theme {
  --font-family-sans: var(--font-inter), system-ui, sans-serif;
  --font-family-mono: var(--font-roboto-mono), monospace;
}
```

### 実践課題

1. ダッシュボードレイアウトを作成してください (サイドバー + メインコンテンツ)
2. 画像最適化を実装してください
3. カスタムフォントを設定してください

### 理解度チェック

- [ ] Tailwind CSSで基本的なレイアウトを組める
- [ ] ネストされたレイアウトを実装できる
- [ ] next/imageで画像を最適化できる
- [ ] カスタムフォントを設定できる

---

## Day 21: 総合実践プロジェクト

### 第3週の総まとめ

#### 学んだ主要概念

1. **認証機能**
   - Auth.js (NextAuth.js v5)
   - ログイン/ログアウト
   - セッション管理
   - ルート保護

2. **フォームバリデーション**
   - Zodスキーマ定義
   - Server Actionsでのバリデーション
   - エラーハンドリング
   - react-hook-formとの統合

3. **レイアウトとスタイリング**
   - Tailwind CSS v4
   - ネストされたレイアウト
   - 画像最適化
   - フォント最適化

### 実践プロジェクト: 会員制ブログサービス

**要件:**
- ユーザー登録/ログイン機能
- 認証されたユーザーのみが記事を投稿可能
- 記事一覧・詳細表示
- プロフィール編集
- レスポンシブデザイン

**技術スタック:**
- Next.js 16
- Auth.js
- Drizzle ORM + Turso
- Zod
- Tailwind CSS v4

**目標時間:** 4-5時間

### 次週の予習

第4週では以下を学びます:
- パフォーマンス最適化
- キャッシング戦略
- SEO対策
- Vercelへのデプロイ

---

**前に戻る:** [第2週: データフェッチング編](./week2.md)
**次に進む:** [第4週: 応用・本番環境編](./week4.md)
