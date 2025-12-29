# 第2週: データフェッチング編

## 今週のゴール

- Server Actionsを使ってフォームを処理できる
- APIルートを作成してRESTful APIを実装できる
- 外部APIからデータを取得できる
- エラーハンドリングとローディング状態を実装できる

## Day 8-9: Server Actionsの基礎

### 学習内容

#### 1. Server Actionsとは

**従来のフォーム送信:**

```tsx
// 従来のReact: クライアント側でAPI呼び出し
'use client'

import { useState } from 'react'

export default function Form() {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // クライアントからAPIを呼び出す
    const res = await fetch('/api/create-user', {
      body: JSON.stringify({ name }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    const data = await res.json()
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        onChange={(e) => setName(e.target.value)}
        value={name}
      />
      <button type="submit">Submit</button>
    </form>
  )
}
```

**Server Actionsの方法:**

```tsx
// Server Actionsを使った方法
// app/actions/user.ts
'use server'

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string

  // サーバー側で直接データベースにアクセス可能
  // await db.user.create({ data: { name } })

  console.log('User created:', name)
  return { success: true }
}
```

```tsx
// app/form/page.tsx
import { createUser } from '../actions/user'

export default function FormPage() {
  return (
    <form action={createUser}>
      <input name="name" required />
      <button type="submit">Submit</button>
    </form>
  )
}
```

**Server Actionsの特徴:**

| 項目 | 従来の方法 | Server Actions |
|-----|----------|----------------|
| API呼び出し | 必要 | 不要 |
| エンドポイント作成 | 必要 | 不要 |
| データベースアクセス | APIルート経由 | 直接アクセス可能 |
| JavaScriptなしで動作 | ✗ | ✓ (Progressive Enhancement) |
| コード量 | 多い | 少ない |

#### 2. Server Actionsの基本的な使い方

**ファイル全体をServer Actionにする:**

```tsx
// app/actions/post.ts
'use server'  // ファイル全体がServer Actions

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // サーバー側の処理
  console.log({ content, title })

  return { success: true }
}

export async function deletePost(id: string) {
  // サーバー側の処理
  console.log('Deleting post:', id)

  return { success: true }
}
```

**インライン Server Action:**

```tsx
// app/form/page.tsx
export default function FormPage() {
  async function handleSubmit(formData: FormData) {
    'use server'  // この関数だけがServer Action

    const name = formData.get('name') as string
    console.log('Submitted:', name)
  }

  return (
    <form action={handleSubmit}>
      <input name="name" required />
      <button type="submit">Submit</button>
    </form>
  )
}
```

#### 3. FormDataの扱い方

**基本的な取得方法:**

```tsx
'use server'

export async function createUser(formData: FormData) {
  // 個別に取得
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const age = formData.get('age') as string

  // 数値に変換
  const ageNumber = parseInt(age, 10)

  // チェックボックス
  const subscribe = formData.get('subscribe') === 'on'

  return { age: ageNumber, email, name, subscribe }
}
```

**複数の値を取得:**

```tsx
'use server'

export async function updatePreferences(formData: FormData) {
  // 複数選択の値を配列で取得
  const hobbies = formData.getAll('hobbies') as string[]

  console.log(hobbies) // ['reading', 'gaming', 'music']

  return { hobbies }
}
```

#### 4. Client ComponentからServer Actionsを呼び出す

**useFormStateを使った状態管理:**

```tsx
// app/actions/todo.ts
'use server'

export async function createTodo(
  prevState: any,
  formData: FormData
) {
  const title = formData.get('title') as string

  // バリデーション
  if (!title || title.length < 3) {
    return {
      error: 'Title must be at least 3 characters',
      success: false,
    }
  }

  // データベースに保存 (例)
  // await db.todo.create({ data: { title } })

  return {
    message: 'Todo created successfully!',
    success: true,
  }
}
```

```tsx
// app/todo/CreateTodoForm.tsx
'use client'

import { useFormState } from 'react-dom'
import { createTodo } from '../actions/todo'

export default function CreateTodoForm() {
  const [state, formAction] = useFormState(createTodo, {
    success: false,
  })

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <input
          name="title"
          placeholder="Todo title"
          className="border px-4 py-2 rounded w-full"
        />
        {state?.error && (
          <p className="text-red-500 text-sm mt-1">
            {state.error}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Create Todo
      </button>

      {state?.success && (
        <p className="text-green-500">{state.message}</p>
      )}
    </form>
  )
}
```

**useFormStatusを使ったローディング状態:**

```tsx
'use client'

import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-4 py-2 rounded ${
        pending ? 'bg-gray-400' : 'bg-blue-500'
      } text-white`}
    >
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  )
}

export default function MyForm() {
  async function handleSubmit(formData: FormData) {
    'use server'
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return (
    <form action={handleSubmit}>
      <input name="title" />
      <SubmitButton />
    </form>
  )
}
```

#### 5. 実践例: Todoアプリの作成

```tsx
// app/todo/page.tsx
import { createTodo, deleteTodo, toggleTodo } from './actions'

interface Todo {
  completed: boolean
  id: string
  title: string
}

// モックデータ (本来はデータベースから取得)
const todos: Todo[] = [
  { completed: false, id: '1', title: 'Learn Next.js' },
  { completed: false, id: '2', title: 'Build an app' },
]

export default function TodoPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Todo List</h1>

      {/* 新規作成フォーム */}
      <form action={createTodo} className="mb-8">
        <div className="flex gap-2">
          <input
            name="title"
            placeholder="Add a new todo..."
            className="border px-4 py-2 rounded flex-1"
            required
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded"
          >
            Add
          </button>
        </div>
      </form>

      {/* Todo一覧 */}
      <ul className="space-y-2">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center gap-4 border p-4 rounded"
          >
            {/* チェックボックス */}
            <form action={toggleTodo}>
              <input type="hidden" name="id" value={todo.id} />
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-5 h-5"
              />
            </form>

            {/* タイトル */}
            <span
              className={`flex-1 ${
                todo.completed ? 'line-through text-gray-400' : ''
              }`}
            >
              {todo.title}
            </span>

            {/* 削除ボタン */}
            <form action={deleteTodo}>
              <input type="hidden" name="id" value={todo.id} />
              <button
                type="submit"
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

```tsx
// app/todo/actions.ts
'use server'

import { revalidatePath } from 'next/cache'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string

  // データベースに保存
  // await db.todo.create({ data: { title, completed: false } })

  console.log('Created todo:', title)

  // ページを再レンダリング
  revalidatePath('/todo')
}

export async function toggleTodo(formData: FormData) {
  const id = formData.get('id') as string

  // データベースで状態を切り替え
  // await db.todo.update({
  //   where: { id },
  //   data: { completed: { not: true } }
  // })

  console.log('Toggled todo:', id)
  revalidatePath('/todo')
}

export async function deleteTodo(formData: FormData) {
  const id = formData.get('id') as string

  // データベースから削除
  // await db.todo.delete({ where: { id } })

  console.log('Deleted todo:', id)
  revalidatePath('/todo')
}
```

### 実践課題

1. Server Actionを使って簡単なお問い合わせフォームを作成してください
2. `useFormState`を使ってバリデーションエラーを表示してください
3. `useFormStatus`を使って送信中のローディング状態を表示してください

### 理解度チェック

- [ ] Server Actionsの基本的な使い方を理解している
- [ ] FormDataから値を取得できる
- [ ] `useFormState`でフォームの状態を管理できる
- [ ] `revalidatePath`でページを再レンダリングできる

---

## Day 10-11: APIルートとRESTful API

### 学習内容

#### 1. APIルートとは

**Next.jsのAPIルート:**
- `app/api/` ディレクトリ内に配置
- `route.ts` ファイルでエンドポイントを定義
- HTTP メソッド(GET, POST, PUT, DELETE等)ごとに関数をエクスポート

**基本的な構造:**

```
app/
└── api/
    ├── hello/
    │   └── route.ts          → /api/hello
    ├── users/
    │   ├── route.ts          → /api/users
    │   └── [id]/
    │       └── route.ts      → /api/users/123
    └── posts/
        └── route.ts          → /api/posts
```

#### 2. GET リクエストの実装

**シンプルなGETエンドポイント:**

```tsx
// app/api/hello/route.ts
export async function GET() {
  return Response.json({
    message: 'Hello from Next.js API!',
  })
}
```

**動的ルートでのGET:**

```tsx
// app/api/users/[id]/route.ts
interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params

  // データベースからユーザーを取得 (例)
  // const user = await db.user.findUnique({ where: { id } })

  const user = {
    email: `user${id}@example.com`,
    id,
    name: `User ${id}`,
  }

  return Response.json(user)
}
```

**クエリパラメータの取得:**

```tsx
// app/api/posts/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '10'

  console.log({ limit, page })

  // データベースからページネーション付きで取得
  const posts = [
    { id: 1, title: 'Post 1' },
    { id: 2, title: 'Post 2' },
  ]

  return Response.json({
    limit: parseInt(limit),
    page: parseInt(page),
    posts,
  })
}
```

#### 3. POST リクエストの実装

**JSONボディの処理:**

```tsx
// app/api/users/route.ts
export async function POST(request: Request) {
  // リクエストボディをJSONとしてパース
  const body = await request.json()
  const { email, name } = body

  // バリデーション
  if (!name || !email) {
    return Response.json(
      { error: 'Name and email are required' },
      { status: 400 }
    )
  }

  // データベースに保存 (例)
  // const user = await db.user.create({
  //   data: { name, email }
  // })

  const user = {
    createdAt: new Date().toISOString(),
    email,
    id: Math.random().toString(),
    name,
  }

  return Response.json(user, { status: 201 })
}
```

#### 4. その他のHTTPメソッド

**PUT (更新):**

```tsx
// app/api/users/[id]/route.ts
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  // データベースで更新
  // const user = await db.user.update({
  //   where: { id },
  //   data: body
  // })

  return Response.json({
    id,
    message: 'User updated',
    ...body,
  })
}
```

**DELETE (削除):**

```tsx
// app/api/users/[id]/route.ts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // データベースから削除
  // await db.user.delete({ where: { id } })

  return Response.json({
    message: 'User deleted',
  })
}
```

#### 5. エラーハンドリング

**try-catchでエラーをキャッチ:**

```tsx
// app/api/users/route.ts
export async function GET() {
  try {
    // データベースアクセス
    // const users = await db.user.findMany()

    throw new Error('Database connection failed')

    // return Response.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)

    return Response.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
```

**カスタムエラーレスポンス:**

```tsx
// app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // const user = await db.user.findUnique({ where: { id } })

  const user = null // 見つからなかったとする

  if (!user) {
    return Response.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  return Response.json(user)
}
```

#### 6. ヘッダーとCORS

**カスタムヘッダーの設定:**

```tsx
// app/api/data/route.ts
export async function GET() {
  const data = { message: 'Hello' }

  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60',
      'Content-Type': 'application/json',
    },
  })
}
```

**CORSの設定:**

```tsx
// app/api/public/route.ts
export async function GET(request: Request) {
  const data = { message: 'Public API' }

  return Response.json(data, {
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Origin': '*',
    },
    status: 204,
  })
}
```

#### 7. 実践例: CRUD APIの実装

```tsx
// app/api/todos/route.ts
// GET /api/todos - 一覧取得
// POST /api/todos - 新規作成

let todos = [
  { completed: false, id: '1', title: 'Learn Next.js' },
  { completed: false, id: '2', title: 'Build an API' },
]

export async function GET() {
  return Response.json({ todos })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { title } = body

  if (!title) {
    return Response.json(
      { error: 'Title is required' },
      { status: 400 }
    )
  }

  const newTodo = {
    completed: false,
    id: Date.now().toString(),
    title,
  }

  todos.push(newTodo)

  return Response.json(newTodo, { status: 201 })
}
```

```tsx
// app/api/todos/[id]/route.ts
// GET /api/todos/:id - 詳細取得
// PUT /api/todos/:id - 更新
// DELETE /api/todos/:id - 削除

let todos = [
  { completed: false, id: '1', title: 'Learn Next.js' },
  { completed: false, id: '2', title: 'Build an API' },
]

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params
  const todo = todos.find((t) => t.id === id)

  if (!todo) {
    return Response.json(
      { error: 'Todo not found' },
      { status: 404 }
    )
  }

  return Response.json(todo)
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()

  const index = todos.findIndex((t) => t.id === id)

  if (index === -1) {
    return Response.json(
      { error: 'Todo not found' },
      { status: 404 }
    )
  }

  todos[index] = { ...todos[index], ...body }

  return Response.json(todos[index])
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params

  const index = todos.findIndex((t) => t.id === id)

  if (index === -1) {
    return Response.json(
      { error: 'Todo not found' },
      { status: 404 }
    )
  }

  todos.splice(index, 1)

  return Response.json({ message: 'Todo deleted' })
}
```

### 実践課題

1. `/api/posts` エンドポイントを作成してください (GET, POST)
2. `/api/posts/[id]` エンドポイントを作成してください (GET, PUT, DELETE)
3. クエリパラメータでページネーションを実装してください

### 理解度チェック

- [ ] APIルートの基本的な構造を理解している
- [ ] GET, POST, PUT, DELETEを実装できる
- [ ] リクエストボディとクエリパラメータを扱える
- [ ] 適切なステータスコードを返せる

---

## Day 12-13: データベース連携

### 学習内容

#### 1. データベース選択とセットアップ

**推奨データベース:**

| データベース | 用途 | 特徴 |
|------------|------|------|
| PostgreSQL (Supabase) | 本格的なアプリ | リレーショナル、無料枠あり |
| SQLite (Turso) | 学習・小規模 | セットアップ簡単、エッジ対応 |
| MongoDB (MongoDB Atlas) | ドキュメント指向 | スキーマレス、NoSQL |

**今回はTurso (SQLite)を使用:**

```bash
# Tursoのインストール
curl -sSfL https://get.tur.so/install.sh | bash

# ログイン
turso auth login

# データベース作成
turso db create my-nextjs-db

# 接続URL取得
turso db show my-nextjs-db

# トークン作成
turso db tokens create my-nextjs-db
```

#### 2. Drizzle ORMのセットアップ

**Drizzleのインストール:**

```bash
pnpm add drizzle-orm @libsql/client
pnpm add -D drizzle-kit
```

**環境変数の設定:**

```bash
# .env.local
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-auth-token"
```

**Drizzle設定ファイル:**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dbCredentials: {
    authToken: process.env.TURSO_AUTH_TOKEN!,
    url: process.env.TURSO_DATABASE_URL!,
  },
  dialect: 'sqlite',
  out: './drizzle',
  schema: './lib/db/schema.ts',
})
```

**データベース接続:**

```typescript
// lib/db/index.ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const client = createClient({
  authToken: process.env.TURSO_AUTH_TOKEN!,
  url: process.env.TURSO_DATABASE_URL!,
})

export const db = drizzle(client, { schema })
```

#### 3. スキーマ定義

**Todoテーブルの定義:**

```typescript
// lib/db/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const todos = sqliteTable('todos', {
  completed: integer('completed', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
})

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
```

**マイグレーションの実行:**

```bash
# マイグレーションファイル生成
pnpm drizzle-kit generate

# マイグレーション実行
pnpm drizzle-kit push
```

#### 4. CRUD操作の実装

**作成 (Create):**

```tsx
// app/actions/todo.ts
'use server'

import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string

  if (!title || title.length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }

  await db.insert(todos).values({
    title,
  })

  revalidatePath('/todos')
  return { success: true }
}
```

**読み取り (Read):**

```tsx
// app/todos/page.tsx
import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export default async function TodosPage() {
  // 全件取得 (作成日時の降順)
  const allTodos = await db
    .select()
    .from(todos)
    .orderBy(desc(todos.createdAt))

  return (
    <div>
      <h1>Todos</h1>
      <ul>
        {allTodos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

**更新 (Update):**

```tsx
// app/actions/todo.ts
'use server'

import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function toggleTodo(id: number) {
  // 現在の状態を取得
  const [todo] = await db
    .select()
    .from(todos)
    .where(eq(todos.id, id))

  if (!todo) {
    return { error: 'Todo not found' }
  }

  // 状態を反転
  await db
    .update(todos)
    .set({ completed: !todo.completed })
    .where(eq(todos.id, id))

  revalidatePath('/todos')
  return { success: true }
}
```

**削除 (Delete):**

```tsx
// app/actions/todo.ts
'use server'

import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function deleteTodo(id: number) {
  await db.delete(todos).where(eq(todos.id, id))

  revalidatePath('/todos')
  return { success: true }
}
```

#### 5. 複雑なクエリ

**条件付き検索:**

```typescript
import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'
import { and, eq, like } from 'drizzle-orm'

// 未完了のTodoのみ取得
const incompleteTodos = await db
  .select()
  .from(todos)
  .where(eq(todos.completed, false))

// タイトルで検索
const searchTodos = await db
  .select()
  .from(todos)
  .where(like(todos.title, '%Next.js%'))

// 複数条件
const filteredTodos = await db
  .select()
  .from(todos)
  .where(
    and(
      eq(todos.completed, false),
      like(todos.title, '%Next.js%')
    )
  )
```

**件数制限:**

```typescript
import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'

// 最新5件のみ
const latestTodos = await db
  .select()
  .from(todos)
  .limit(5)
  .orderBy(desc(todos.createdAt))

// ページネーション
const page = 2
const pageSize = 10
const offset = (page - 1) * pageSize

const paginatedTodos = await db
  .select()
  .from(todos)
  .limit(pageSize)
  .offset(offset)
```

### 実践課題

1. Tursoデータベースをセットアップしてください
2. Drizzle ORMを設定してください
3. Todoアプリのスキーマを定義してマイグレーションを実行してください
4. CRUD操作を全て実装してください

### 理解度チェック

- [ ] データベースのセットアップができる
- [ ] Drizzle ORMでスキーマを定義できる
- [ ] CRUD操作を実装できる
- [ ] 条件付きクエリを書ける

---

## Day 14: 復習と実践プロジェクト

### 第2週の総まとめ

#### 学んだ主要概念

1. **Server Actions**
   - フォーム処理の簡略化
   - `'use server'`ディレクティブ
   - `useFormState`と`useFormStatus`
   - `revalidatePath`でページ更新

2. **APIルート**
   - `/api/` ディレクトリでRESTful API作成
   - HTTP メソッド (GET, POST, PUT, DELETE)
   - エラーハンドリング
   - CORS設定

3. **データベース連携**
   - Turso (SQLite) のセットアップ
   - Drizzle ORMの使用
   - スキーマ定義とマイグレーション
   - CRUD操作の実装

### 実践プロジェクト: フル機能Todoアプリ

**要件:**
- Todoの作成・読み取り・更新・削除
- データベース連携 (Turso + Drizzle)
- Server Actionsによるフォーム処理
- 完了/未完了の切り替え
- 検索機能
- ページネーション

**目標時間:** 3-4時間

### 次週の予習

第3週では以下を学びます:
- 認証機能の実装 (NextAuth.js)
- フォームバリデーション (Zod)
- ミドルウェア
- 画像最適化

---

**前に戻る:** [第1週: 基礎編](./week1.md)
**次に進む:** [第3週: 実践編](./week3.md)
