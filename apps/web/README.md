# Web Application

Next.js 16 (App Router) を使用した Web アプリケーション

## アーキテクチャ

### ディレクトリ構成

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Route Group（認証関連）
│   │   │   ├── login/
│   │   │   │   ├── page.tsx           # ログインページ
│   │   │   │   └── actions.ts         # Server Actions
│   │   │   └── signup/
│   │   │       ├── page.tsx           # サインアップページ
│   │   │       └── actions.ts         # Server Actions
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # ダッシュボードページ
│   │   │   ├── actions.ts             # Server Actions
│   │   │   ├── layout.tsx             # ダッシュボードレイアウト
│   │   │   └── loading.tsx            # ローディングUI
│   │   ├── api/                       # API Route Handlers
│   │   │   └── webhook/
│   │   │       └── stripe/
│   │   │           └── route.ts       # POST /api/webhook/stripe
│   │   ├── layout.tsx                 # ルートレイアウト
│   │   ├── page.tsx                   # ホームページ
│   │   ├── loading.tsx                # グローバルローディングUI
│   │   ├── error.tsx                  # グローバルエラーUI
│   │   └── globals.css                # グローバルスタイル
│   ├── components/                    # 共通コンポーネント
│   │   └── ui/                        # 汎用UIコンポーネント
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── input.tsx
│   ├── hooks/                         # カスタムReact Hooks
│   │   ├── use-auth.ts                # 認証状態管理
│   │   └── use-debounce.ts            # デバウンス処理
│   ├── lib/
│   │   ├── actions/                   # 共通Server Actions
│   │   │   └── auth.ts                # 認証関連
│   │   ├── api/                       # API呼び出しロジック
│   │   │   └── client.ts              # fetch wrapper
│   │   └── utils/
│   │       └── format.ts              # ユーティリティ関数
│   ├── types/                         # グローバル型定義
│   │   └── index.ts
│   └── middleware.ts                  # ミドルウェア（認証チェックなど）
├── .env.local                         # 環境変数
└── public/                            # 静的ファイル
    └── images/
```

### 各ディレクトリの責務

#### `app/`
- **役割**: ページとルーティング
- **ルール**: ファイルベースルーティング。`page.tsx` がページとして認識される
- **Server Component**: デフォルトでサーバーコンポーネント（`'use client'` がない限り）

#### `app/(auth)/`
- **役割**: Route Group（認証関連ページをグループ化）
- **メリット**: レイアウトやURLに影響を与えずにページをグループ化できる
- **例**: `(auth)/login` → URL は `/login`、`(auth)` は URL に現れない

#### `app/[page]/actions.ts`
- **役割**: ページ専用の Server Actions
- **使用タイミング**: フォーム送信、データ変更（mutation）
- **例**: ログイン、サインアップ、プロフィール更新
- **必須**: `'use server'` ディレクティブ

**例:**
```typescript
// src/app/login/actions.ts
'use server'

import { LoginRequestSchema } from '@repo/api-schema'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  // バリデーション
  const validation = LoginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validation.success) {
    return { error: validation.error.message }
  }

  // API呼び出し
  const response = await fetch(`${process.env.API_URL}/api/auth/login`, {
    body: JSON.stringify(validation.data),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    return { error: 'ログインに失敗しました' }
  }

  // リダイレクト
  redirect('/dashboard')
}
```

#### `app/api/`
- **役割**: API Route Handlers（REST API）
- **使用タイミング**:
  - 外部公開API
  - モバイルアプリから呼び出し
  - Webhook受信（Stripe、SendGrid等）
- **注意**: ページ内で完結する処理は Server Actions を使う

**例:**
```typescript
// src/app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')!
  const body = await request.text()

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // イベント処理
    switch (event.type) {
      case 'payment_intent.succeeded':
        // 処理
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}
```

---

### Server Actions と API Route Handlers の使い分け

| 用途 | Server Actions | API Route Handlers |
|------|---------------|-------------------|
| フォーム送信 | ⭐ 推奨 | △ 使える |
| ページ内データ変更 | ⭐ 推奨 | △ 使える |
| 外部公開API | ❌ 使えない | ⭐ 推奨 |
| Webhook受信 | ❌ 使えない | ⭐ 推奨 |
| モバイルアプリから呼び出し | ❌ 使えない | ⭐ 推奨 |

**推奨方針:**
- **基本はServer Actionsを使う**（フォーム送信、ページ内完結の処理）
- **外部公開が必要な場合のみAPI Route Handlers**

---

#### `components/`

3層構造（ui / features / layout）で分類する。画面ベースではなく機能ベースで分ける。

| 層 | 配置するもの | 依存ルール |
|---|---|---|
| **ui/** | props だけで動く汎用パーツ。ビジネスロジックを持たない | 他の層に依存しない |
| **features/** | 特定のドメイン・機能に紐づくコンポーネント | `ui/` と `layout/` を使ってよい |
| **layout/** | ページの構造やレイアウトを決めるコンポーネント | `ui/` を使ってよい |

**理由:**
- 画面ベースだと複数画面で使うコンポーネントの置き場所に困り、再利用性が下がる
- `ui/` を分離することで依存方向が明確になり、安全に再利用・テストできる
- App Router がルーティングを担うため、`components/` は画面に縛られる必要がない
- web / admin / mobile で同じ考え方を採用し、アプリ間の認知負荷を統一する

**判断基準:** ドメイン知識なしで動く → `ui/` / レイアウト系 → `layout/` / それ以外 → `features/{domain}/`

#### `hooks/`
- **役割**: カスタムReact Hooks
- **使用タイミング**: Client Componentでの状態管理、副作用
- **注意**: Server Componentでは使えない（`'use client'` が必要）
- **命名規則**: `use-*`（例: `use-auth.ts`, `use-debounce.ts`）

**例:**
```typescript
// src/hooks/use-debounce.ts
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

#### `lib/actions/`
- **役割**: 複数ページで使う共通Server Actions
- **例**: ログイン、ログアウト、ユーザー情報更新
- **必須**: `'use server'` ディレクティブ

**例:**
```typescript
// src/lib/actions/auth.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  ;(await cookies()).delete('session')
  redirect('/login')
}
```

#### `lib/api/`
- **役割**: フロントエンドからAPIを呼び出すためのロジック
- **例**: `fetch` wrapper、エラーハンドリング
- **推奨**: クラス型で実装してテストしやすくする

**例:**
```typescript
// src/lib/api/client.ts
import { GetUserResponse, GetUserResponseSchema } from '@repo/api-schema'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async getUser(userId: string): Promise<GetUserResponse> {
    const response = await fetch(`${this.baseUrl}/api/user/${userId}`)

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to fetch user')
    }

    const data = await response.json()

    // Zodでレスポンスを検証
    return GetUserResponseSchema.parse(data)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

#### `middleware.ts`
- **役割**: リクエスト前に実行される処理
- **使用例**: 認証チェック、リダイレクト、ヘッダー追加
- **実行タイミング**: すべてのルートで実行される

**例:**
```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')

  // 認証が必要なパス
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

---

## 開発コマンド

```bash
# 開発サーバー起動（ホットリロード）
pnpm dev

# ビルド
pnpm build

# 本番サーバー起動
pnpm start

# リント
pnpm lint
pnpm lint:fix
```
