# TypeScript Generics の実践的パターン - 型の再利用性を極める

## はじめに

Generics は TypeScript の型システムにおいて、コードの再利用性と型安全性を両立させるための基盤となる機能です。「型のパラメータ化」により、さまざまな型に対応できる汎用的なコンポーネントを作成できます。

## 制約（Constraints）の活用

型パラメータに制約を加えることで、より安全で表現力豊かな型を定義できます。

### keyof を使った制約

オブジェクトのキーに対する制約を定義することで、型安全なプロパティアクセスが可能になります。

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

const user = { id: 1, name: 'Alice', age: 30 }

const name = getProperty(user, 'name')    // string
const age = getProperty(user, 'age')      // number
// getProperty(user, 'invalid')           // Error
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

const user = findById(users, 1)
```

## デフォルト型パラメータ

型パラメータにデフォルト値を指定することで、使いやすさが向上します。

```typescript
interface ApiResponse<T = unknown> {
  data: T
  status: number
  message: string
}

// デフォルトは unknown
const response1: ApiResponse = {
  data: { foo: 'bar' },
  message: 'OK',
  status: 200,
}

// 明示的に型を指定
interface User {
  id: number
  name: string
}

const response2: ApiResponse<User> = {
  data: { id: 1, name: 'Alice' },
  message: 'OK',
  status: 200,
}
```

## 実践的なパターン

### Result 型によるエラーハンドリング

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
    return { error: 'Division by zero', success: false }
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
userRepo.save({ email: 'alice@example.com', id: 1, name: 'Alice' })
const user = userRepo.findById(1)
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

## ベストプラクティス

### 1. 制約は明示的に

```typescript
// ✅ 制約を明示することで意図を明確に
function sortBy<T extends { id: number }>(
  items: T[],
  key: keyof T
): T[] {
  return items.sort((a, b) => a.id - b.id)
}
```

### 2. デフォルト型は安全な型を選ぶ

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

### 3. 型パラメータの数は最小限に

```typescript
// ✅ 必要最小限の型パラメータ
function process<T>(value: T): T {
  return value
}

// ❌ 型パラメータが多すぎる
function processComplex<T, U, V, W, X>(
  a: T, b: U, c: V, d: W, e: X
): X {
  return e
}
```

## まとめ

Generics は TypeScript の型システムにおいて、以下のような強力な機能を提供します：

- **再利用性**: 同じロジックをさまざまな型に対して適用可能
- **型安全性**: コンパイル時に型チェックを行い、実行時エラーを防ぐ
- **表現力**: 複雑な型関係を正確に表現できる
- **推論**: 多くの場合、TypeScript が自動的に型を推論

実践的なパターンとしては：

1. **制約を活用**: `extends` で型パラメータに制約を加える
2. **デフォルト型**: 使いやすさのためにデフォルト型を設定
3. **Result 型**: エラーハンドリングを型安全に
4. **Event Emitter**: イベント駆動アーキテクチャを型安全に
5. **Repository**: データアクセスレイヤーを汎用的に

Generics をマスターすることで、より堅牢で保守性の高い TypeScript コードを書くことができます。
