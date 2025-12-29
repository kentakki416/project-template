# Conditional Types の実践的パターン - TypeScript 型レベルプログラミング

## はじめに

Conditional Types は TypeScript の型システムにおいて最も強力な機能の一つです。`T extends U ? X : Y` という三項演算子のような構文で、型レベルでの条件分岐を実現します。本記事では、実践的なパターンを中心に解説します。

## `infer` キーワード - 型の推論と抽出

`infer` は Conditional Types の中で型を推論・抽出するためのキーワードです。これにより、既存の型から部分的な型情報を取り出すことができます。

### 関数の戻り値と引数の型を抽出

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

function getUser() {
  return { id: 1, name: 'Alice' }
}

type User = ReturnType<typeof getUser>
// { id: number; name: string; }
```

```typescript
type Parameters<T> = T extends (...args: infer P) => any ? P : never

function createUser(name: string, age: number) {
  return { age, name }
}

type CreateUserParams = Parameters<typeof createUser>
// [name: string, age: number]
```

### Promise と配列の中身を取り出す

```typescript
type Awaited<T> = T extends Promise<infer U> ? U : T

type A = Awaited<Promise<string>>  // string
type B = Awaited<number>           // number
```

```typescript
type ElementType<T> = T extends (infer E)[] ? E : never

type A = ElementType<string[]>  // string
type B = ElementType<number[]>  // number
```

## 再帰的な Conditional Types

TypeScript 4.1 以降、Conditional Types を再帰的に使用できるようになりました。

### ネストした Promise を完全に unwrap する

```typescript
type DeepAwaited<T> = T extends Promise<infer U>
  ? DeepAwaited<U>
  : T

type A = DeepAwaited<Promise<Promise<Promise<string>>>>  // string
```

### 深くネストされたオブジェクトを Readonly にする

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P]
}

interface User {
  name: string
  profile: {
    age: number
    address: {
      city: string
    }
  }
}

type ReadonlyUser = DeepReadonly<User>
// すべてのプロパティが readonly になる
```

## Template Literal Types との組み合わせ

Template Literal Types と組み合わせることで、文字列レベルの型操作が可能になります。

### API エンドポイントのパスから型を抽出

```typescript
type ExtractParams<T extends string> =
  T extends `${infer _Start}/:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<`/${Rest}`>
    : T extends `${infer _Start}/:${infer Param}`
    ? Param
    : never

type Params = ExtractParams<'/users/:userId/posts/:postId'>
// 'userId' | 'postId'
```

このパターンを使えば、API ルートから自動的にパラメータ型を生成できます。

## 実践的なユースケース

### 型安全な Pick 実装

特定の値の型を持つプロパティのみを抽出する型です。

```typescript
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K]
}

interface User {
  id: number
  name: string
  age: number
  email: string
}

type StringFields = PickByValue<User, string>
// { name: string; email: string; }

type NumberFields = PickByValue<User, number>
// { id: number; age: number; }
```

### オプショナルなプロパティを必須にする

```typescript
type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

interface User {
  id: number
  name?: string
  email?: string
}

type UserWithRequiredEmail = RequiredKeys<User, 'email'>
// { id: number; name?: string; email: string; }
```

### Union から特定の型を除外

```typescript
type ExcludeByType<T, U> = T extends U ? never : T

type Mixed = string | number | boolean | null
type NoNull = ExcludeByType<Mixed, null>
// string | number | boolean
```

## Distributive Conditional Types

Union 型に対して Conditional Types を適用すると、各メンバーに対して分配されます。

```typescript
type ToArray<T> = T extends any ? T[] : never

type A = ToArray<string | number>
// string[] | number[] （not (string | number)[]）
```

この挙動を避けたい場合は、型パラメータを配列で囲みます。

```typescript
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never

type B = ToArrayNonDist<string | number>
// (string | number)[]
```

## まとめ

Conditional Types は TypeScript の型システムにおいて、以下のような強力な機能を提供します：

- `infer` による型の推論・抽出
- 再帰的な型操作による複雑な変換
- Template Literal Types との組み合わせによる文字列操作
- Distributive な振る舞いによる Union 型の処理

これらのパターンを理解することで、より型安全で表現力豊かなコードを書くことができます。ただし、複雑すぎる型はコンパイル時間やメンテナンス性に影響するため、実用性とのバランスを考慮することが重要です。

実際のプロジェクトでは、まず標準の Utility Types（`Pick`、`Omit`、`ReturnType` など）で解決できないか検討し、必要に応じてカスタム Conditional Types を実装していくアプローチをお勧めします。
