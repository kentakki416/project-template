# `as` vs `satisfies` - TypeScript 型アサーションの正しい使い分け

## はじめに

TypeScript 4.9 で導入された `satisfies` 演算子は、既存の `as` による型アサーションとは異なるアプローチで型安全性を提供します。本記事では、実践的な例を通じて両者の違いと適切な使い分けを解説します。

## `as` の問題点

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
const settings = {
  development: { apiUrl: 'http://localhost:3000' },
  production: { apiUrl: 'https://api.example.com' },
} as Record<string, { apiUrl: string }>

// 具体的なキー情報（'development' | 'production'）が失われる
type EnvKeys = keyof typeof settings  // string
```

## `satisfies` - 型チェックと推論の両立

`satisfies` は「この値が指定した型を満たすことを確認する」演算子です。重要なのは、型アサーションではなく型チェックであり、元の型情報を保持することです。

```typescript
const user = {
  id: 1,
  name: 'Alice',
} satisfies Partial<User>  // ✅ Partial<User> を満たすかチェック

// user の型は推論された型 { id: number; name: string } のまま
```

### 主な違い

**1. 型の厳密さ**

```typescript
// as: 不足しているプロパティがあっても通る
const user1 = {
  id: 1,
} as User  // ❌ コンパイルエラーにならない

// satisfies: 不足していればエラー
const user2 = {
  id: 1,
} satisfies User  // ✅ コンパイルエラー！
```

**2. 型推論の保持**

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
```

**3. オブジェクトのキーの扱い**

```typescript
const routes = {
  home: '/',
  about: '/about',
  contact: '/contact',
} satisfies Record<string, string>

type RouteKeys = keyof typeof routes  // 'home' | 'about' | 'contact'

// これにより、タイプセーフなアクセスが可能
function navigate(route: RouteKeys) {
  window.location.href = routes[route]
}

navigate('home')     // ✅ OK
navigate('profile')  // ❌ 型エラー
```

## 実践的なユースケース

### 環境別設定オブジェクト

```typescript
type Environment = 'development' | 'staging' | 'production'

interface Config {
  apiUrl: string
  apiKey: string
  debug: boolean
}

// satisfies で型推論を保持
const config = {
  development: { apiKey: 'dev-key', apiUrl: 'http://localhost:3000', debug: true },
  production: { apiKey: 'prod-key', apiUrl: 'https://api.example.com', debug: false },
  staging: { apiKey: 'stage-key', apiUrl: 'https://staging.example.com', debug: true },
} satisfies Record<Environment, Config>

type Env = keyof typeof config  // 'development' | 'staging' | 'production'

// 型安全なアクセス
function getConfig(env: Env) {
  return config[env]
}
```

### `as const` との組み合わせ

`satisfies` と `as const` を組み合わせることで、最大限の型安全性を得られます。

```typescript
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
  path: string
  method: HTTPMethod
}

const endpoints = {
  createUser: { method: 'POST', path: '/users' },
  getUser: { method: 'GET', path: '/users/:id' },
  updateUser: { method: 'PUT', path: '/users/:id' },
} satisfies Record<string, Endpoint> as const

// ✅ 型チェックと literal types の両方が得られる
type Method = typeof endpoints.getUser.method  // 'GET'（具体的な値）
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

**ベストプラクティス:**

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

基本的には `satisfies` を優先し、`as` は本当に必要な場合のみ使用しましょう。`as const` と組み合わせることで readonly と具体的な型の両方を得られます。
