# Brand Types と Nominal Typing - TypeScript で実現する厳密な型安全性

## はじめに

TypeScript は構造的型付け（Structural Typing）を採用しています。これは、型の互換性が名前ではなく構造で決まることを意味します。多くの場合これは便利ですが、同じ構造を持つ異なる概念を区別したい場合に問題となります。

本記事では、Brand Types を使って Nominal Typing（名目的型付け）を実現し、より厳密な型安全性を獲得する方法を紹介します。

## 構造的型付けの問題点

まず、TypeScript の構造的型付けで発生する問題を見てみましょう。

```typescript
type UserId = string
type ProductId = string

function getUser(id: UserId) {
  // ユーザーを取得
  console.log(`Getting user: ${id}`)
}

function getProduct(id: ProductId) {
  // 商品を取得
  console.log(`Getting product: ${id}`)
}

const userId: UserId = 'user_123'
const productId: ProductId = 'prod_456'

getUser(userId)        // OK
getUser(productId)     // ❌ 実行時エラーになりうるが、型チェックは通る
getProduct(userId)     // ❌ 同様に型チェックは通る
```

どちらも `string` 型なので、TypeScript は区別できません。これは実行時バグの原因となります。

## Brand Types の基本

Brand Types は、型に「ブランド」を付けることで、構造的には同じでも名目的には異なる型を作り出す技法です。

```typescript
// ブランド型の基本的な実装
type Brand<K, T> = K & { __brand: T }

type UserId = Brand<string, 'UserId'>
type ProductId = Brand<string, 'ProductId'>

function getUser(id: UserId) {
  console.log(`Getting user: ${id}`)
}

function getProduct(id: ProductId) {
  console.log(`Getting product: ${id}`)
}

// 型ガード関数で値を作成
function createUserId(id: string): UserId {
  return id as UserId
}

function createProductId(id: string): ProductId {
  return id as ProductId
}

const userId = createUserId('user_123')
const productId = createProductId('prod_456')

getUser(userId)        // ✅ OK
getUser(productId)     // ❌ 型エラー！
getProduct(userId)     // ❌ 型エラー！
getProduct(productId)  // ✅ OK
```

これで、同じ `string` 型でも `UserId` と `ProductId` を型レベルで区別できるようになりました。

## バリデーション付き Brand Types

Brand Types の真価は、作成時にバリデーションを組み込めることです。

```typescript
type Email = Brand<string, 'Email'>
type Url = Brand<string, 'Url'>

function createEmail(value: string): Email | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return null
  }
  return value as Email
}

function createUrl(value: string): Url | null {
  try {
    new URL(value)
    return value as Url
  } catch {
    return null
  }
}

function sendEmail(to: Email, subject: string) {
  console.log(`Sending email to ${to}: ${subject}`)
}

const email = createEmail('user@example.com')
const invalidEmail = createEmail('invalid-email')
const url = createUrl('https://example.com')

if (email) {
  sendEmail(email, 'Hello')  // ✅ OK
}

// sendEmail(invalidEmail, 'Hello')  // ❌ 型エラー（null の可能性）
// sendEmail(url, 'Hello')            // ❌ 型エラー（型が違う）
// sendEmail('user@example.com', 'Hello')  // ❌ 型エラー（生の string は使えない）
```

## 数値型の Brand Types

数値型にも同様に適用できます。これは特に単位や制約のある数値で有用です。

```typescript
type PositiveNumber = Brand<number, 'PositiveNumber'>
type Percentage = Brand<number, 'Percentage'>
type Celsius = Brand<number, 'Celsius'>
type Fahrenheit = Brand<number, 'Fahrenheit'>

function createPositiveNumber(n: number): PositiveNumber | null {
  return n > 0 ? (n as PositiveNumber) : null
}

function createPercentage(n: number): Percentage | null {
  return n >= 0 && n <= 100 ? (n as Percentage) : null
}

function createCelsius(n: number): Celsius {
  return n as Celsius
}

function createFahrenheit(n: number): Fahrenheit {
  return n as Fahrenheit
}

// 温度変換関数
function celsiusToFahrenheit(c: Celsius): Fahrenheit {
  return createFahrenheit((c as number) * 9 / 5 + 32)
}

function fahrenheitToCelsius(f: Fahrenheit): Celsius {
  return createCelsius((f as number - 32) * 5 / 9)
}

const temp = createCelsius(25)
const converted = celsiusToFahrenheit(temp)

// fahrenheitToCelsius(temp)  // ❌ 型エラー！Celsius を Fahrenheit の引数には渡せない
```

## 実践的なユースケース

### ユーザー権限のチェック

```typescript
type AuthenticatedUserId = Brand<string, 'AuthenticatedUserId'>
type AdminUserId = Brand<AuthenticatedUserId, 'AdminUserId'>

function authenticateUser(id: string, password: string): AuthenticatedUserId | null {
  // 認証ロジック
  if (password === 'correct') {
    return id as AuthenticatedUserId
  }
  return null
}

function promoteToAdmin(id: AuthenticatedUserId): AdminUserId {
  // 管理者権限の付与
  return id as AdminUserId
}

function deleteUser(userId: AuthenticatedUserId) {
  console.log(`Deleting user: ${userId}`)
}

function deleteAllUsers(adminId: AdminUserId) {
  console.log(`Admin ${adminId} is deleting all users`)
}

const userId = authenticateUser('user_123', 'correct')

if (userId) {
  deleteUser(userId)              // ✅ OK
  // deleteAllUsers(userId)       // ❌ 型エラー！管理者権限が必要

  const adminId = promoteToAdmin(userId)
  deleteAllUsers(adminId)         // ✅ OK
}
```

### データベース ID の型安全性

```typescript
type EntityId<T extends string> = Brand<string, T>

type UserId = EntityId<'User'>
type PostId = EntityId<'Post'>
type CommentId = EntityId<'Comment'>

interface User {
  id: UserId
  name: string
}

interface Post {
  id: PostId
  authorId: UserId
  title: string
}

interface Comment {
  id: CommentId
  postId: PostId
  authorId: UserId
  content: string
}

function findUserById(id: UserId): User | null {
  // ユーザー検索
  return null
}

function findPostById(id: PostId): Post | null {
  // 投稿検索
  return null
}

function createComment(postId: PostId, authorId: UserId, content: string): Comment {
  return {
    authorId,
    content,
    id: 'comment_1' as CommentId,
    postId,
  }
}

const user: User = { id: 'user_123' as UserId, name: 'Alice' }
const post: Post = { authorId: user.id, id: 'post_456' as PostId, title: 'Hello' }

// ✅ 正しい使い方
createComment(post.id, user.id, 'Great post!')

// ❌ 型エラー：引数の順序が逆
// createComment(user.id, post.id, 'Great post!')

// ❌ 型エラー：間違った ID を渡している
// findUserById(post.id)
```

## Array と Brand Types

配列型と組み合わせることで、さらに厳密な型を定義できます。

```typescript
type NonEmptyArray<T> = Brand<T[], 'NonEmptyArray'> & [T, ...T[]]

function createNonEmptyArray<T>(arr: T[]): NonEmptyArray<T> | null {
  return arr.length > 0 ? (arr as NonEmptyArray<T>) : null
}

function processItems<T>(items: NonEmptyArray<T>): T {
  // 必ず要素があることが保証されているので、安全に [0] にアクセスできる
  return items[0]
}

const items = createNonEmptyArray([1, 2, 3])
const emptyItems = createNonEmptyArray([])

if (items) {
  processItems(items)  // ✅ OK
}

// processItems(emptyItems)  // ❌ 型エラー
```

## より高度な例: 範囲制約のある数値

```typescript
type Range<Min extends number, Max extends number> = {
  __min: Min
  __max: Max
}

type RangedNumber<Min extends number, Max extends number> =
  Brand<number, Range<Min, Max>>

type Age = RangedNumber<0, 150>
type Month = RangedNumber<1, 12>
type Day = RangedNumber<1, 31>

function createAge(n: number): Age | null {
  return n >= 0 && n <= 150 ? (n as Age) : null
}

function createMonth(n: number): Month | null {
  return n >= 1 && n <= 12 ? (n as Month) : null
}

function createDay(n: number): Day | null {
  return n >= 1 && n <= 31 ? (n as Day) : null
}

interface DateOfBirth {
  year: number
  month: Month
  day: Day
}

function calculateAge(dob: DateOfBirth): Age | null {
  const today = new Date()
  const birthDate = new Date(dob.year, (dob.month as number) - 1, dob.day as number)
  const age = today.getFullYear() - birthDate.getFullYear()
  return createAge(age)
}

const month = createMonth(12)
const day = createDay(25)

if (month && day) {
  const dob: DateOfBirth = { day, month, year: 1990 }
  const age = calculateAge(dob)
  console.log(age)
}

// createMonth(13)  // null が返る
// createDay(32)    // null が返る
```

## パフォーマンスへの影響

Brand Types は実行時には何の影響もありません。すべて型レベルでの操作です。

```typescript
type UserId = Brand<string, 'UserId'>

const id: UserId = 'user_123' as UserId

// コンパイル後は単純に
const id = 'user_123'
```

JavaScript にコンパイルされる際、Brand Types の情報は完全に消えます。

## まとめ

Brand Types を使うことで：

- ✅ 同じプリミティブ型でも異なる概念を型レベルで区別できる
- ✅ バリデーションを型システムに組み込める
- ✅ 実行時のオーバーヘッドはゼロ
- ✅ 誤った値の使用をコンパイル時に検出できる

**使うべき場面：**
- ID や識別子を扱うとき
- 単位や制約のある数値（温度、パーセンテージなど）
- バリデーション済みデータ（Email、URL など）
- 権限レベルや状態を表す型

**注意点：**
- `as` によるキャストが必要なため、作成関数を必ず用意する
- 過度に使うとコードが冗長になる可能性がある
- チーム全体での理解と合意が必要

Brand Types は、TypeScript の構造的型付けの制約を補完し、より堅牢なコードを書くための強力なパターンです。適切に使うことで、多くの実行時エラーをコンパイル時に防ぐことができます。
