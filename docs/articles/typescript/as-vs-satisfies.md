# `as` vs `satisfies` - TypeScript 型アサーションの正しい使い分け

## はじめに

TypeScript 4.9 で導入された `satisfies` 演算子は、既存の `as` による型アサーションとは異なるアプローチで型安全性を提供します。本記事では、両者の違いと適切な使い分けについて、実践的な例とともに解説します。

## `as` 型アサーション - 従来の方法

`as` は型アサーションとして、コンパイラに「この値はこの型である」と明示的に伝えます。

```typescript
const value = 'hello' as string
const num = '123' as any as number  // double assertion
```

### `as` の問題点

`as` は強力ですが、型安全性を犠牲にする可能性があります。

```typescript
interface User {
  id: number
  name: string
  email: string
}

const user = {
  id: 1,
  name: 'Alice',
} as User  // ❌ email が無いのに User 型として扱われる

console.log(user.email.toLowerCase())  // 実行時エラー！
```

さらに、`as` を使うと型推論が失われます。

```typescript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} as const  // すべてのプロパティが readonly になる

// 型推論の問題
const settings = {
  development: { apiUrl: 'http://localhost:3000' },
  production: { apiUrl: 'https://api.example.com' },
} as Record<string, { apiUrl: string }>

// settings.development の型が { apiUrl: string } になり、
// より具体的な情報（'development' | 'production' のキー）が失われる
type EnvKeys = keyof typeof settings  // string （具体的なキー情報が失われた）
```

## `satisfies` 演算子 - 型チェックと推論の両立

`satisfies` は「この値が指定した型を満たすことを確認する」演算子です。重要なのは、型アサーションではなく型チェックであり、元の型情報を保持することです。

```typescript
interface User {
  id: number
  name: string
  email: string
}

const user = {
  id: 1,
  name: 'Alice',
} satisfies Partial<User>  // ✅ Partial<User> を満たすかチェック

// user の型は推論された型 { id: number; name: string } のまま
type UserType = typeof user  // { id: number; name: string }
```

## 主な違いの比較

### 1. 型の厳密さ

```typescript
// as: 不足しているプロパティがあっても通る
const user1 = {
  id: 1,
} as User  // ❌ コンパイルエラーにならない

// satisfies: 不足していればエラー
const user2 = {
  id: 1,
} satisfies User  // ✅ コンパイルエラー！name と email が無い
```

### 2. 型推論の保持

```typescript
type Color = 'red' | 'green' | 'blue'

interface Theme {
  primary: Color
  secondary: Color
}

// as を使った場合
const theme1 = {
  primary: 'red',
  secondary: 'blue',
} as Theme

type Primary1 = typeof theme1.primary  // Color（'red' ではない）

// satisfies を使った場合
const theme2 = {
  primary: 'red',
  secondary: 'blue',
} satisfies Theme

type Primary2 = typeof theme2.primary  // 'red'（具体的な値が保持される）

// これにより、より厳密な型チェックが可能
if (theme2.primary === 'red') {
  // TypeScript は theme2.primary が 'red' であることを知っている
}
```

### 3. オブジェクトのキーの扱い

```typescript
// as の場合
const routes1 = {
  home: '/',
  about: '/about',
  contact: '/contact',
} as Record<string, string>

type Route1Keys = keyof typeof routes1  // string

// satisfies の場合
const routes2 = {
  home: '/',
  about: '/about',
  contact: '/contact',
} satisfies Record<string, string>

type Route2Keys = keyof typeof routes2  // 'home' | 'about' | 'contact'

// これにより、タイプセーフなアクセスが可能
function navigate(route: Route2Keys) {
  window.location.href = routes2[route]
}

navigate('home')     // ✅ OK
navigate('profile')  // ❌ 型エラー
```

## 実践的なユースケース

### 1. 設定オブジェクトの型チェック

```typescript
type Environment = 'development' | 'staging' | 'production'

interface Config {
  apiUrl: string
  apiKey: string
  debug: boolean
}

// as を使うと型推論が失われる
const config1 = {
  development: { apiKey: 'dev-key', apiUrl: 'http://localhost:3000', debug: true },
  production: { apiKey: 'prod-key', apiUrl: 'https://api.example.com', debug: false },
  staging: { apiKey: 'stage-key', apiUrl: 'https://staging.example.com', debug: true },
} as Record<Environment, Config>

type Env1 = keyof typeof config1  // string

// satisfies で型推論を保持
const config2 = {
  development: { apiKey: 'dev-key', apiUrl: 'http://localhost:3000', debug: true },
  production: { apiKey: 'prod-key', apiUrl: 'https://api.example.com', debug: false },
  staging: { apiKey: 'stage-key', apiUrl: 'https://staging.example.com', debug: true },
} satisfies Record<Environment, Config>

type Env2 = keyof typeof config2  // 'development' | 'staging' | 'production'

// より型安全なアクセス
function getConfig(env: Env2) {
  return config2[env]
}
```

### 2. API レスポンスのバリデーション

```typescript
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

interface User {
  id: number
  name: string
  email: string
}

// as: 型が合っているか確認されない
const response1 = {
  data: { email: 'user@example.com', id: 1, name: 'Alice' },
  message: 'Success',
  status: 200,
  // timestamp: Date.now(), // 余計なプロパティがあっても気づかない
} as ApiResponse<User>

// satisfies: 型が合っているか確認される
const response2 = {
  data: { email: 'user@example.com', id: 1, name: 'Alice' },
  message: 'Success',
  status: 200,
  // timestamp: Date.now(), // ❌ エラー：余計なプロパティ
} satisfies ApiResponse<User>

// response2.data の型は具体的に推論される
type DataType = typeof response2.data
// { id: number; name: string; email: string; }
```

### 3. イベントハンドラのマップ

```typescript
type EventMap = {
  click: { x: number; y: number }
  keypress: { key: string }
  scroll: { scrollTop: number }
}

// as を使った場合
const handlers1 = {
  click: (e: { x: number; y: number }) => console.log(e.x, e.y),
  keypress: (e: { key: string }) => console.log(e.key),
} as Partial<{
  [K in keyof EventMap]: (e: EventMap[K]) => void
}>

type Handler1Keys = keyof typeof handlers1  // string | number | symbol

// satisfies を使った場合
const handlers2 = {
  click: (e: { x: number; y: number }) => console.log(e.x, e.y),
  keypress: (e: { key: string }) => console.log(e.key),
} satisfies Partial<{
  [K in keyof EventMap]: (e: EventMap[K]) => void
}>

type Handler2Keys = keyof typeof handlers2  // 'click' | 'keypress'

// 型安全な呼び出し
function triggerEvent<K extends keyof typeof handlers2>(
  event: K,
  data: EventMap[K]
) {
  handlers2[event]?.(data)
}

triggerEvent('click', { x: 10, y: 20 })  // ✅ OK
triggerEvent('scroll', { scrollTop: 0 }) // ❌ 型エラー
```

### 4. 定数の型チェックと推論の保持

```typescript
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
  path: string
  method: HTTPMethod
}

// as const だけでは構造のチェックができない
const endpoints1 = {
  getUser: { method: 'GET', path: '/users/:id' },
  createUser: { method: 'POST', path: '/users' },
  updateUser: { method: 'PUT', path: '/users/:id' },
} as const

// 型エラーにならない（method が HTTPMethod に含まれない値でも）
const badEndpoint = {
  invalid: { method: 'INVALID', path: '/bad' },
} as const

// satisfies と as const を組み合わせる
const endpoints2 = {
  createUser: { method: 'POST', path: '/users' },
  getUser: { method: 'GET', path: '/users/:id' },
  updateUser: { method: 'PUT', path: '/users/:id' },
} satisfies Record<string, Endpoint> as const

// ✅ 型チェックと literal types の両方が得られる
type Method = typeof endpoints2.getUser.method  // 'GET'（具体的な値）

// ❌ 型エラー：method が HTTPMethod に含まれない
const badEndpoint2 = {
  invalid: { method: 'INVALID', path: '/bad' },
} satisfies Record<string, Endpoint> as const
```

## 組み合わせパターン

`satisfies` と `as const` を組み合わせることで、最大限の型安全性を得られます。

```typescript
type Color = { r: number; g: number; b: number }

const palette = {
  blue: { b: 255, g: 0, r: 0 },
  green: { b: 0, g: 255, r: 0 },
  red: { b: 0, g: 0, r: 255 },
} satisfies Record<string, Color> as const

// ✅ 型チェック（Record<string, Color> を満たすか）
// ✅ readonly（as const）
// ✅ 具体的な値の型（'red' | 'green' | 'blue'）

type PaletteKeys = keyof typeof palette  // 'red' | 'green' | 'blue'
type RedColor = typeof palette.red       // { readonly r: 0; readonly g: 0; readonly b: 255; }
```

## いつどちらを使うべきか

### `satisfies` を使うべき場合

- ✅ オブジェクトのキー情報を保持したい
- ✅ 具体的な値の型を保持したい
- ✅ 型に準拠しているかチェックしつつ、推論も活かしたい
- ✅ 設定オブジェクトや定数の定義

### `as` を使うべき場合

- ✅ 外部ライブラリの型定義が不正確な場合（一時的な回避策）
- ✅ JSON.parse の結果など、実行時にしか型が分からない場合
- ✅ 型の変換が必要な場合（double assertion: `as unknown as T`）

### 使わない方が良い場合

- ❌ バリデーションの代わりとして使う（実行時チェックは別途必要）
- ❌ 型エラーを無理やり回避するため
- ❌ `any` への型アサーション（型安全性が完全に失われる）

## まとめ

| 特徴 | `as` | `satisfies` |
|------|------|-------------|
| 型の強制 | ✅ | ❌ |
| 型のチェック | ❌（弱い） | ✅（厳密） |
| 型推論の保持 | ❌ | ✅ |
| キー情報の保持 | ❌ | ✅ |
| 値の具体的な型 | ❌ | ✅ |

**ベストプラクティス:**

1. 基本的には `satisfies` を優先する
2. `as const` と組み合わせて readonly と具体的な型の両方を得る
3. `as` は本当に必要な場合のみ使用する
4. `as any` や `as unknown` は最終手段として、コメントで理由を明記する

```typescript
// ✅ 推奨パターン
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} satisfies Config as const

// ⚠️ 必要な場合のみ
const data = JSON.parse(jsonString) as UserData

// ❌ 避けるべき
const value = someValue as any
```

`satisfies` を適切に使うことで、TypeScript の型推論を最大限に活かしながら、型安全性も確保できます。TypeScript 4.9 以降を使っているプロジェクトでは、積極的に `satisfies` を活用することをお勧めします。
