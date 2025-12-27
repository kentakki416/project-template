# Conditional Types の実践的パターン - TypeScript 型レベルプログラミング

## はじめに

Conditional Types は TypeScript の型システムにおいて最も強力な機能の一つです。`T extends U ? X : Y` という三項演算子のような構文で、型レベルでの条件分岐を実現します。本記事では、基本的な使い方から実践的なパターンまで、Conditional Types を使いこなすためのテクニックを紹介します。

## 基本的な Conditional Types

最もシンプルな例から始めましょう。

```typescript
type IsString<T> = T extends string ? true : false

type A = IsString<string>  // true
type B = IsString<number>  // false
```

この型は、`T` が `string` 型に代入可能かどうかをチェックし、真偽値の型を返します。

## `infer` キーワードの威力

`infer` は Conditional Types の中で型を推論・抽出するためのキーワードです。これにより、既存の型から部分的な型情報を取り出すことができます。

### 関数の戻り値の型を抽出

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

function getUser() {
  return { id: 1, name: 'Alice' }
}

type User = ReturnType<typeof getUser>
// { id: number; name: string; }
```

### 関数の引数の型を抽出

```typescript
type Parameters<T> = T extends (...args: infer P) => any ? P : never

function createUser(name: string, age: number) {
  return { name, age }
}

type CreateUserParams = Parameters<typeof createUser>
// [name: string, age: number]
```

### Promise の中身を取り出す

```typescript
type Awaited<T> = T extends Promise<infer U> ? U : T

type A = Awaited<Promise<string>>  // string
type B = Awaited<number>           // number
```

### 配列の要素型を抽出

```typescript
type ElementType<T> = T extends (infer E)[] ? E : never

type A = ElementType<string[]>  // string
type B = ElementType<number[]>  // number
```

## 再帰的な Conditional Types

TypeScript 4.1 以降、Conditional Types を再帰的に使用できるようになりました。これにより、複雑な型操作が可能になります。

### ネストした Promise を完全に unwrap する

```typescript
type DeepAwaited<T> = T extends Promise<infer U>
  ? DeepAwaited<U>
  : T

type A = DeepAwaited<Promise<Promise<Promise<string>>>>  // string
type B = DeepAwaited<Promise<number>>                    // number
type C = DeepAwaited<string>                             // string
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

### 配列をフラット化する型

```typescript
type Flatten<T> = T extends (infer Item)[]
  ? Item extends any[]
    ? Flatten<Item>
    : Item
  : T

type A = Flatten<number[]>           // number
type B = Flatten<number[][]>         // number
type C = Flatten<number[][][]>       // number
type D = Flatten<string>             // string
```

## Template Literal Types との組み合わせ

TypeScript 4.1 で導入された Template Literal Types と組み合わせることで、文字列レベルの型操作が可能になります。

### イベント名から型を生成

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`

type MouseEventName = EventName<'click'>  // 'onClick'
type KeyEventName = EventName<'press'>    // 'onPress'
```

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

### キャメルケースをスネークケースに変換

```typescript
type CamelToSnake<S extends string> =
  S extends `${infer T}${infer U}`
    ? U extends Uncapitalize<U>
      ? `${Uncapitalize<T>}${CamelToSnake<U>}`
      : `${Uncapitalize<T>}_${CamelToSnake<U>}`
    : S

type A = CamelToSnake<'userId'>      // 'user_id'
type B = CamelToSnake<'firstName'>   // 'first_name'
```

## 実践的なユースケース

### 型安全な Pick 実装

特定のキーのみを持つオブジェクトを生成する型です。

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

### 関数のオーバーロードから全ての戻り値の型を取得

```typescript
type AllReturnTypes<T> = T extends {
  (...args: any[]): infer R1
  (...args: any[]): infer R2
  (...args: any[]): infer R3
}
  ? R1 | R2 | R3
  : T extends (...args: any[]) => infer R
  ? R
  : never

function process(x: string): string
function process(x: number): number
function process(x: string | number): string | number {
  return x
}

type Results = AllReturnTypes<typeof process>
// string | number
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

## パフォーマンスの考慮事項

再帰的な Conditional Types は強力ですが、複雑すぎる型はコンパイルパフォーマンスに影響します。

```typescript
// ❌ 避けるべき: 深すぎる再帰
type VeryDeepRecursion<T, Depth extends number = 50> =
  Depth extends 0 ? T : VeryDeepRecursion<T, Subtract<Depth, 1>>

// ✅ 推奨: 適度な深さに制限
type ModerateRecursion<T, Depth extends number = 5> =
  Depth extends 0 ? T : ModerateRecursion<T, Subtract<Depth, 1>>
```

## まとめ

Conditional Types は TypeScript の型システムにおいて、以下のような強力な機能を提供します：

- `infer` による型の推論・抽出
- 再帰的な型操作による複雑な変換
- Template Literal Types との組み合わせによる文字列操作
- Distributive な振る舞いによる Union 型の処理

これらのパターンを理解することで、より型安全で表現力豊かなコードを書くことができます。ただし、複雑すぎる型はコンパイル時間やメンテナンス性に影響するため、実用性とのバランスを考慮することが重要です。

実際のプロジェクトでは、まず標準の Utility Types（`Pick`、`Omit`、`ReturnType` など）で解決できないか検討し、必要に応じてカスタム Conditional Types を実装していくアプローチをお勧めします。
