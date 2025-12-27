# TypeScript Generics の実践的パターン - 型の再利用性を極める

## はじめに

Generics は TypeScript の型システムにおいて、コードの再利用性と型安全性を両立させるための基盤となる機能です。「型のパラメータ化」により、さまざまな型に対応できる汎用的なコンポーネントを作成できます。本記事では、基本的な使い方から実践的なパターンまで、Generics を使いこなすためのテクニックを紹介します。

## Generics の基本

最もシンプルな例から始めましょう。

```typescript
function identity<T>(value: T): T {
  return value
}

const num = identity<number>(42)        // number
const str = identity<string>('hello')   // string
const inferred = identity(true)         // boolean (型推論)
```

`<T>` は型パラメータで、関数呼び出し時に具体的な型が決まります。多くの場合、TypeScript は引数から型を推論してくれるため、明示的な型指定は不要です。

## 制約（Constraints）の活用

型パラメータに制約を加えることで、より安全で表現力豊かな型を定義できます。

### 基本的な制約

```typescript
interface HasLength {
  length: number
}

function logLength<T extends HasLength>(value: T): T {
  console.log(value.length)
  return value
}

logLength('hello')           // OK: string has length
logLength([1, 2, 3])         // OK: array has length
logLength({ length: 10 })    // OK: object has length
// logLength(42)             // Error: number doesn't have length
```

### keyof を使った制約

オブジェクトのキーに対する制約を定義することで、型安全なプロパティアクセスが可能になります。

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user = { id: 1, name: 'Alice', age: 30 }

const name = getProperty(user, 'name')    // string
const age = getProperty(user, 'age')      // number
// getProperty(user, 'invalid')           // Error: 'invalid' is not a key of user
```

### 複数の制約

```typescript
interface Identifiable {
  id: number
}

interface Nameable {
  name: string
}

function findById<T extends Identifiable & Nameable>(
  items: T[],
  id: number
): T | undefined {
  return items.find(item => item.id === id)
}

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
]

const user = findById(users, 1)  // { id: number; name: string; email: string; } | undefined
```

## デフォルト型パラメータ

TypeScript 2.3 以降、型パラメータにデフォルト値を指定できます。

```typescript
interface ApiResponse<T = unknown> {
  data: T
  status: number
  message: string
}

// デフォルトは unknown
const response1: ApiResponse = {
  data: { foo: 'bar' },
  status: 200,
  message: 'OK'
}

// 明示的に型を指定
interface User {
  id: number
  name: string
}

const response2: ApiResponse<User> = {
  data: { id: 1, name: 'Alice' },
  status: 200,
  message: 'OK'
}
```

### 条件付きデフォルト型

```typescript
type Container<T, U = T extends any[] ? T[0] : T> = {
  value: T
  unwrapped: U
}

const arr: Container<number[]> = {
  value: [1, 2, 3],
  unwrapped: 1  // number (配列の要素型)
}

const str: Container<string> = {
  value: 'hello',
  unwrapped: 'world'  // string (そのままの型)
}
```

## 複数の型パラメータ

複数の型パラメータを使うことで、より柔軟な型定義が可能になります。

### Map/Reduce パターン

```typescript
function map<T, U>(array: T[], fn: (item: T) => U): U[] {
  return array.map(fn)
}

const numbers = [1, 2, 3, 4, 5]
const strings = map(numbers, n => n.toString())  // string[]
const doubled = map(numbers, n => n * 2)         // number[]
```

### Pair 型の実装

```typescript
class Pair<T, U> {
  constructor(
    public first: T,
    public second: U
  ) {}

  map<V, W>(
    fn1: (value: T) => V,
    fn2: (value: U) => W
  ): Pair<V, W> {
    return new Pair(fn1(this.first), fn2(this.second))
  }
}

const pair = new Pair(42, 'hello')
const mapped = pair.map(n => n * 2, s => s.toUpperCase())
// Pair<number, string>
```

## ジェネリック関数の高度なパターン

### 関数のオーバーロードと Generics

```typescript
function create<T>(value: T): T
function create<T>(factory: () => T): T
function create<T>(valueOrFactory: T | (() => T)): T {
  if (typeof valueOrFactory === 'function') {
    return (valueOrFactory as () => T)()
  }
  return valueOrFactory
}

const num = create(42)                    // number
const str = create(() => 'hello')         // string
```

### 型ガードとの組み合わせ

```typescript
function isArray<T>(value: T | T[]): value is T[] {
  return Array.isArray(value)
}

function process<T>(value: T | T[]): T[] {
  if (isArray(value)) {
    return value
  }
  return [value]
}

process(42)          // number[]
process([1, 2, 3])   // number[]
```

### Promise を返すジェネリック関数

```typescript
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url)
  return response.json()
}

interface User {
  id: number
  name: string
}

const user = await fetchData<User>('/api/users/1')
// user is User
```

## ジェネリッククラスの実践例

### Stack の実装

```typescript
class Stack<T> {
  private items: T[] = []

  push(item: T): void {
    this.items.push(item)
  }

  pop(): T | undefined {
    return this.items.pop()
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1]
  }

  get size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }
}

const numberStack = new Stack<number>()
numberStack.push(1)
numberStack.push(2)
numberStack.pop()  // 2

const stringStack = new Stack<string>()
stringStack.push('hello')
stringStack.push('world')
```

### Repository パターン

```typescript
interface Entity {
  id: number
}

class Repository<T extends Entity> {
  private items: Map<number, T> = new Map()

  save(item: T): void {
    this.items.set(item.id, item)
  }

  findById(id: number): T | undefined {
    return this.items.get(id)
  }

  findAll(): T[] {
    return Array.from(this.items.values())
  }

  delete(id: number): boolean {
    return this.items.delete(id)
  }

  update(id: number, updates: Partial<T>): T | undefined {
    const item = this.items.get(id)
    if (!item) return undefined

    const updated = { ...item, ...updates }
    this.items.set(id, updated)
    return updated
  }
}

interface User extends Entity {
  name: string
  email: string
}

const userRepo = new Repository<User>()
userRepo.save({ id: 1, name: 'Alice', email: 'alice@example.com' })
const user = userRepo.findById(1)
```

### Builder パターン

```typescript
class QueryBuilder<T> {
  private conditions: Array<(item: T) => boolean> = []
  private sortFn?: (a: T, b: T) => number
  private limitCount?: number

  where(predicate: (item: T) => boolean): this {
    this.conditions.push(predicate)
    return this
  }

  sortBy(fn: (a: T, b: T) => number): this {
    this.sortFn = fn
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  execute(items: T[]): T[] {
    let result = items.filter(item =>
      this.conditions.every(condition => condition(item))
    )

    if (this.sortFn) {
      result = result.sort(this.sortFn)
    }

    if (this.limitCount !== undefined) {
      result = result.slice(0, this.limitCount)
    }

    return result
  }
}

interface Product {
  id: number
  name: string
  price: number
  category: string
}

const products: Product[] = [
  { id: 1, name: 'Laptop', price: 1000, category: 'Electronics' },
  { id: 2, name: 'Mouse', price: 20, category: 'Electronics' },
  { id: 3, name: 'Desk', price: 300, category: 'Furniture' }
]

const result = new QueryBuilder<Product>()
  .where(p => p.category === 'Electronics')
  .where(p => p.price < 500)
  .sortBy((a, b) => a.price - b.price)
  .limit(5)
  .execute(products)
```

## Utility Types の実装

TypeScript 標準の Utility Types を Generics で実装する例を見てみましょう。

### Partial の実装

```typescript
type MyPartial<T> = {
  [P in keyof T]?: T[P]
}

interface User {
  id: number
  name: string
  email: string
}

type PartialUser = MyPartial<User>
// { id?: number; name?: string; email?: string; }
```

### Required の実装

```typescript
type MyRequired<T> = {
  [P in keyof T]-?: T[P]
}

interface OptionalUser {
  id?: number
  name?: string
}

type RequiredUser = MyRequired<OptionalUser>
// { id: number; name: string; }
```

### Pick の実装

```typescript
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

type UserBasicInfo = MyPick<User, 'id' | 'name'>
// { id: number; name: string; }
```

### Record の実装

```typescript
type MyRecord<K extends keyof any, T> = {
  [P in K]: T
}

type UserRoles = MyRecord<'admin' | 'user' | 'guest', boolean>
// { admin: boolean; user: boolean; guest: boolean; }
```

## 実践的なパターン

### Result 型による エラーハンドリング

```typescript
type Success<T> = {
  success: true
  value: T
}

type Failure<E> = {
  success: false
  error: E
}

type Result<T, E = Error> = Success<T> | Failure<E>

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { success: false, error: 'Division by zero' }
  }
  return { success: true, value: a / b }
}

const result = divide(10, 2)
if (result.success) {
  console.log(result.value)  // number
} else {
  console.error(result.error)  // string
}
```

### 型安全な Event Emitter

```typescript
type EventMap = {
  [key: string]: any
}

class TypedEventEmitter<Events extends EventMap> {
  private listeners: {
    [K in keyof Events]?: Array<(data: Events[K]) => void>
  } = {}

  on<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event]!.push(listener)
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const eventListeners = this.listeners[event]
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data))
    }
  }

  off<K extends keyof Events>(
    event: K,
    listener: (data: Events[K]) => void
  ): void {
    const eventListeners = this.listeners[event]
    if (eventListeners) {
      this.listeners[event] = eventListeners.filter(l => l !== listener) as any
    }
  }
}

interface AppEvents {
  userLogin: { userId: number; username: string }
  userLogout: { userId: number }
  message: { text: string; timestamp: number }
}

const emitter = new TypedEventEmitter<AppEvents>()

emitter.on('userLogin', (data) => {
  console.log(data.userId, data.username)  // 型安全
})

emitter.emit('userLogin', { userId: 1, username: 'Alice' })
// emitter.emit('userLogin', { invalid: true })  // Error
```

### ジェネリックな API クライアント

```typescript
interface ApiEndpoints {
  '/users': {
    GET: { response: User[] }
    POST: { request: { name: string; email: string }; response: User }
  }
  '/users/:id': {
    GET: { response: User }
    PUT: { request: Partial<User>; response: User }
    DELETE: { response: void }
  }
}

class ApiClient<Endpoints extends Record<string, any>> {
  constructor(private baseUrl: string) {}

  async request<
    Path extends keyof Endpoints,
    Method extends keyof Endpoints[Path]
  >(
    path: Path,
    method: Method,
    ...args: Endpoints[Path][Method] extends { request: infer R }
      ? [data: R]
      : []
  ): Promise<Endpoints[Path][Method] extends { response: infer R } ? R : never> {
    const url = `${this.baseUrl}${String(path)}`
    const [data] = args

    const response = await fetch(url, {
      method: String(method),
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    return response.json()
  }
}

const api = new ApiClient<ApiEndpoints>('https://api.example.com')

// 型安全な API 呼び出し
const users = await api.request('/users', 'GET')  // User[]
const newUser = await api.request('/users', 'POST', {
  name: 'Alice',
  email: 'alice@example.com'
})  // User
```

### ジェネリックな State Management

```typescript
type Action<T extends string = string, P = any> = {
  type: T
  payload: P
}

type Reducer<S, A extends Action> = (state: S, action: A) => S

class Store<S, A extends Action> {
  private state: S
  private listeners: Array<(state: S) => void> = []

  constructor(
    private reducer: Reducer<S, A>,
    initialState: S
  ) {
    this.state = initialState
  }

  getState(): S {
    return this.state
  }

  dispatch(action: A): void {
    this.state = this.reducer(this.state, action)
    this.listeners.forEach(listener => listener(this.state))
  }

  subscribe(listener: (state: S) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
}

// 使用例
interface CounterState {
  count: number
}

type CounterAction =
  | Action<'INCREMENT', number>
  | Action<'DECREMENT', number>
  | Action<'RESET'>

const counterReducer: Reducer<CounterState, CounterAction> = (state, action) => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + action.payload }
    case 'DECREMENT':
      return { count: state.count - action.payload }
    case 'RESET':
      return { count: 0 }
    default:
      return state
  }
}

const store = new Store(counterReducer, { count: 0 })

store.subscribe(state => console.log('State:', state))
store.dispatch({ type: 'INCREMENT', payload: 5 })
store.dispatch({ type: 'DECREMENT', payload: 2 })
```

## よくある落とし穴と解決策

### 型パラメータの推論が効かない

```typescript
// ❌ 推論が効かない
function createArray<T>(length: number, value: T): T[] {
  return Array(length).fill(value)
}

const arr = createArray(5, 0)  // any[]

// ✅ 明示的に型を指定
const arr2 = createArray<number>(5, 0)  // number[]

// ✅ または、デフォルト型を使う
function createArray2<T = number>(length: number, value: T): T[] {
  return Array(length).fill(value)
}
```

### Generics の variance（変性）

```typescript
// Generics は invariant（不変）
class Container<T> {
  constructor(public value: T) {}
}

const numContainer: Container<number> = new Container(42)
// const anyContainer: Container<any> = numContainer  // Error

// 解決策: 共変性を利用
interface ReadonlyContainer<out T> {  // TypeScript 4.7+
  readonly value: T
}

const readonlyNum: ReadonlyContainer<number> = { value: 42 }
const readonlyAny: ReadonlyContainer<any> = readonlyNum  // OK
```

### 型パラメータのスコープ

```typescript
// ❌ 型パラメータは関数スコープ
class Wrapper<T> {
  // これは動かない
  method<T>(value: T): T {  // この T はクラスの T とは別物
    return value
  }
}

// ✅ 別の名前を使うか、クラスの T を使う
class Wrapper2<T> {
  method(value: T): T {  // クラスの T を使用
    return value
  }

  transform<U>(fn: (value: T) => U): U {  // 別の型パラメータ
    return fn(this.value)
  }

  constructor(private value: T) {}
}
```

### 空の配列の型推論

```typescript
// ❌ never[] として推論される
const arr = []

// ✅ 型アノテーションを使う
const arr2: number[] = []

// ✅ または Generic Array を使う
const arr3 = Array<number>()
```

## パフォーマンスとベストプラクティス

### 型パラメータの数は最小限に

```typescript
// ❌ 型パラメータが多すぎる
function process<T, U, V, W, X>(
  a: T, b: U, c: V, d: W, e: X
): X {
  return e
}

// ✅ 必要最小限に
function process2<T>(value: T): T {
  return value
}
```

### 適切なデフォルト値の設定

```typescript
// ✅ unknown をデフォルトにすることで安全性を確保
interface Response<T = unknown> {
  data: T
  status: number
}

// ❌ any は避ける
interface UnsafeResponse<T = any> {
  data: T
  status: number
}
```

### 制約は明示的に

```typescript
// ✅ 制約を明示することで意図を明確に
function sortBy<T extends { id: number }>(
  items: T[],
  key: keyof T
): T[] {
  return items.sort((a, b) => {
    return a.id - b.id
  })
}

// ❌ 制約がないと型安全性が失われる
function sortByUnsafe<T>(items: T[], key: keyof T): T[] {
  return items.sort((a, b) => {
    // a.id, b.id が存在するかわからない
    return (a as any).id - (b as any).id
  })
}
```

## まとめ

Generics は TypeScript の型システムにおいて、以下のような強力な機能を提供します：

- **再利用性**: 同じロジックをさまざまな型に対して適用可能
- **型安全性**: コンパイル時に型チェックを行い、実行時エラーを防ぐ
- **表現力**: 複雑な型関係を正確に表現できる
- **推論**: 多くの場合、TypeScript が自動的に型を推論してくれる

実践的なパターンとしては：

1. **制約を活用**: `extends` で型パラメータに制約を加える
2. **デフォルト型**: 使いやすさのためにデフォルト型を設定
3. **複数の型パラメータ**: 必要に応じて複数の型パラメータを使い分ける
4. **Utility Types**: 標準の Utility Types を理解し、カスタムで実装する

Generics をマスターすることで、より堅牢で保守性の高い TypeScript コードを書くことができます。基本を理解した上で、実際のプロジェクトで少しずつ応用していくことをお勧めします。
