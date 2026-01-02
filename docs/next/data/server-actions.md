# Server Actions

## 概要

Server Actionsは、サーバー側で実行される非同期関数です。フォーム送信やデータ変更を、APIルートを作成せずに直接実行できます。

**主な特徴:**
- `'use server'`ディレクティブで定義
- フォームとのネイティブ統合
- プログレッシブエンハンスメント（JavaScriptなしでも動作）
- 自動的なCSRF保護
- TypeScript型安全性

**ユースケース:**
- フォーム送信
- データの作成・更新・削除
- サーバー側のミューテーション

## 基本的な使い方

### インラインServer Action

```tsx
// app/add-todo/page.tsx
export default function AddTodoPage() {
  async function createTodo(formData: FormData) {
    'use server'

    const title = formData.get('title') as string
    await db.insert(todos).values({ title })
  }

  return (
    <form action={createTodo}>
      <input name="title" type="text" required />
      <button type="submit">Add Todo</button>
    </form>
  )
}
```

### ファイルレベルのServer Actions

```tsx
// app/actions/todo.ts
'use server'

import { db } from '@/lib/db'
import { todos } from '@/lib/db/schema'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string
  await db.insert(todos).values({ title })
}

export async function deleteTodo(id: number) {
  await db.delete(todos).where(eq(todos.id, id))
}
```

```tsx
// app/todos/page.tsx
import { createTodo, deleteTodo } from '@/app/actions/todo'

export default function TodosPage() {
  return (
    <form action={createTodo}>
      <input name="title" type="text" required />
      <button type="submit">Add</button>
    </form>
  )
}
```

## 詳細な説明

### FormDataの取り扱い

```tsx
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const published = formData.get('published') === 'on'

  await db.insert(posts).values({
    title,
    content,
    published,
  })
}
```

### revalidatePathとrevalidateTag

データ変更後にキャッシュを無効化:

```tsx
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string
  await db.insert(todos).values({ title })

  // 特定のパスを再検証
  revalidatePath('/todos')

  // タグベースで再検証
  revalidateTag('todos')
}
```

### リダイレクト

```tsx
'use server'

import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const post = await db.insert(posts).values({...}).returning()
  redirect(`/blog/${post.slug}`)
}
```

### useFormStateとuseFormStatus

Client Componentでフォーム状態を管理:

```tsx
// app/actions/user.ts
'use server'

export async function updateProfile(prevState: any, formData: FormData) {
  const name = formData.get('name') as string

  if (!name || name.length < 3) {
    return { error: '名前は3文字以上必要です' }
  }

  await db.update(users).set({ name })
  return { success: true }
}
```

```tsx
// app/profile/page.tsx
'use client'

import { useFormState } from 'react-dom'
import { updateProfile } from '@/app/actions/user'
import { SubmitButton } from './SubmitButton'

export default function ProfilePage() {
  const [state, formAction] = useFormState(updateProfile, { error: '' })

  return (
    <form action={formAction}>
      <input name="name" type="text" required />
      {state?.error && <p className="error">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
```

```tsx
// app/profile/SubmitButton.tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? '送信中...' : '保存'}
    </button>
  )
}
```

詳細は [Server Actions公式ドキュメント](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) を参照してください。
