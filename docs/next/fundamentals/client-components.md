# Client Components

## 概要

Client Componentsは、クライアント側（ブラウザ）で実行されるReactコンポーネントです。Next.js App Routerでは、`'use client'`ディレクティブを使って明示的にClient Componentを宣言します。

**主な特徴:**
- ブラウザで実行される
- Reactフック（useState, useEffect等）が使える
- ブラウザAPI（window, localStorage等）が使える
- イベントハンドラー（onClick, onChange等）が使える
- インタラクティブなUIを実装できる

**制限事項:**
- JavaScriptバンドルサイズに含まれる
- 初期HTMLには含まれない（クライアントサイドでハイドレーション）
- バックエンドリソースに直接アクセスできない

## 基本的な使い方

### Client Componentの作成

```tsx
// components/Counter.tsx
'use client' // Client Componentであることを宣言

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### Reactフックの使用

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function Timer() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return <div>Current time: {time.toLocaleTimeString()}</div>
}
```

### ブラウザAPIの使用

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div>
      Window size: {size.width} x {size.height}
    </div>
  )
}
```

## 詳細な説明

### 'use client'ディレクティブの配置

`'use client'`は、ファイルの最上部に配置します:

```tsx
// ✅ Good: ファイルの最上部
'use client'

import { useState } from 'react'

export default function Component() {
  const [state, setState] = useState(0)
  return <div>{state}</div>
}
```

```tsx
// ❌ Bad: importの後
import { useState } from 'react'

'use client' // エラー

export default function Component() {
  return <div>...</div>
}
```

### Client Componentの境界

`'use client'`を宣言したファイルとそのimportは、すべてClient Componentになります:

```tsx
// components/ClientComponent.tsx
'use client'

import { ChildComponent } from './ChildComponent' // これもClient Component

export default function ClientComponent() {
  return <ChildComponent />
}
```

```tsx
// components/ChildComponent.tsx
// 'use client'がなくても、ClientComponentからimportされるのでClient Component
import { useState } from 'react'

export function ChildComponent() {
  const [state, setState] = useState(0)
  return <div>{state}</div>
}
```

### Server ComponentとClient Componentの組み合わせ

#### パターン1: Client Component内でServer Componentを使う（childrenパターン）

```tsx
// app/page.tsx (Server Component)
import ClientWrapper from '@/components/ClientWrapper'
import ServerData from '@/components/ServerData'

export default function Page() {
  return (
    <ClientWrapper>
      <ServerData />
    </ClientWrapper>
  )
}
```

```tsx
// components/ClientWrapper.tsx (Client Component)
'use client'

import { useState } from 'react'

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        Toggle
      </button>
      {isExpanded && children}
    </div>
  )
}
```

```tsx
// components/ServerData.tsx (Server Component)
export default async function ServerData() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

#### パターン2: Server ComponentからClient Componentにpropsを渡す

```tsx
// app/page.tsx (Server Component)
import ClientComponent from '@/components/ClientComponent'

export default async function Page() {
  const data = await fetchData()

  return <ClientComponent data={data} />
}
```

```tsx
// components/ClientComponent.tsx (Client Component)
'use client'

import { useState } from 'react'

interface Props {
  data: any
}

export default function ClientComponent({ data }: Props) {
  const [selected, setSelected] = useState(data[0])

  return (
    <div>
      {data.map((item: any) => (
        <button key={item.id} onClick={() => setSelected(item)}>
          {item.name}
        </button>
      ))}
      <div>Selected: {selected.name}</div>
    </div>
  )
}
```

### Context Providerの使用

Context Providerは必ずClient Componentである必要があります:

```tsx
// app/providers.tsx
'use client'

import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext<{
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}>({
  theme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

```tsx
// app/layout.tsx (Server Component)
import { ThemeProvider } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

### サードパーティライブラリの使用

ブラウザAPIを使うライブラリは、Client Componentでのみ使用可能:

```tsx
'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti' // ブラウザ専用ライブラリ

export default function CelebrationButton() {
  const handleClick = () => {
    confetti({
      particleCount: 100,
      spread: 70,
    })
  }

  return <button onClick={handleClick}>Celebrate!</button>
}
```

ライブラリに`'use client'`がない場合、ラッパーを作成:

```tsx
// components/ChartWrapper.tsx
'use client'

import Chart from 'some-chart-library'

export default function ChartWrapper(props: any) {
  return <Chart {...props} />
}
```

## ベストプラクティス

### 1. Client Componentは必要最小限に

```tsx
// ✅ Good: インタラクティブな部分だけClient Component
// app/page.tsx (Server Component)
import InteractiveButton from '@/components/InteractiveButton'

export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
      <InteractiveButton /> {/* ここだけClient Component */}
    </div>
  )
}

// ❌ Bad: ページ全体をClient Componentにする
'use client'

export default function Page() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData().then(setData)
  }, [])

  return data ? (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
      <InteractiveButton />
    </div>
  ) : null
}
```

### 2. Client Componentを葉（leaf）に配置

```tsx
// ✅ Good: 葉のコンポーネントのみClient Component
export default async function Page() {
  const data = await fetchData()

  return (
    <div>
      <Header data={data} /> {/* Server Component */}
      <Content data={data} /> {/* Server Component */}
      <LikeButton />       {/* Client Component */}
    </div>
  )
}
```

### 3. propsの型を明示的に定義

```tsx
'use client'

import { useState } from 'react'

interface Props {
  initialCount: number
  onCountChange?: (count: number) => void
}

export default function Counter({ initialCount, onCountChange }: Props) {
  const [count, setCount] = useState(initialCount)

  const handleIncrement = () => {
    const newCount = count + 1
    setCount(newCount)
    onCountChange?.(newCount)
  }

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  )
}
```

### 4. useEffectのクリーンアップ

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function WebSocketComponent() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const ws = new WebSocket('wss://example.com')

    ws.onmessage = (event) => {
      setData(event.data)
    }

    // ✅ Good: クリーンアップ関数でリソースを解放
    return () => {
      ws.close()
    }
  }, [])

  return <div>{data}</div>
}
```

## よくある落とし穴

### 1. Server ComponentでClient Component専用フックを使用

```tsx
// ❌ Bad: Server ComponentでuseStateは使えない
export default function Page() {
  const [count, setCount] = useState(0) // エラー
  return <div>{count}</div>
}

// ✅ Good: 'use client'を追加
'use client'

export default function Page() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}
```

### 2. Client ComponentでServer Componentをimport

```tsx
// ❌ Bad: Client ComponentでServer Componentを直接import
'use client'

import ServerComponent from './ServerComponent' // エラー

export default function ClientComponent() {
  return <ServerComponent />
}

// ✅ Good: childrenとして受け取る
'use client'

export default function ClientComponent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

### 3. 環境変数の誤用

```tsx
'use client'

export default function Page() {
  // ❌ Bad: NEXT_PUBLIC_なしの環境変数はundefined
  const apiKey = process.env.SECRET_API_KEY // undefined

  // ✅ Good: NEXT_PUBLIC_プレフィックスをつける
  const publicUrl = process.env.NEXT_PUBLIC_API_URL
}
```

### 4. 無限ループのuseEffect

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function Component() {
  const [data, setData] = useState([])

  // ❌ Bad: 依存配列にdataがあり、useEffect内でdataを更新
  useEffect(() => {
    setData([...data, 'new item']) // 無限ループ
  }, [data])

  // ✅ Good: 依存配列を正しく設定
  useEffect(() => {
    fetchData().then(setData)
  }, []) // 初回のみ実行
}
```

## 関連リソース

- [React Client Components](https://react.dev/reference/rsc/use-client)
- [Next.js Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Server Components](./server-components.md)
- [Reactフック](https://react.dev/reference/react/hooks)
- [Context API](https://react.dev/reference/react/useContext)
