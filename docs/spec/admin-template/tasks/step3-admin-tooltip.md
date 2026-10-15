# step3-admin-tooltip

マウスを乗せる・フォーカスすると説明の吹き出しを出す `Tooltip` を `components/ui/tooltip/` に作る。見た目と動きは TailAdmin のデモ（https://demo.tailadmin.com/tooltips ）と同じにする。デモに見本の画面（`/demo/ui/tooltips`）を足す。

設計: [`../README.md`](../README.md#tooltip-の作り) / [仕様: Tooltip](../README.md#tooltip)

## 対応内容

### 変更するファイル

```
apps/admin/
├── package.json                                  # @floating-ui/react を足す
├── src/components/ui/tooltip/Tooltip.tsx         # 新設
├── src/components/demo/example/TooltipExample.tsx  # 新設 見本
├── src/app/(dashboard)/demo/ui/tooltips/page.tsx # 新設
└── src/components/demo/demo-nav-items.tsx        # UI Elements に Tooltips を足す
```

### デモの Tooltip の作り（実測）

デモは `@floating-ui/dom` で位置を決め、吹き出しを `document.body` の直下に置く。

- 位置: `offset(10)` / `flip({ fallbackAxisSideDirection: "start" })` / `shift({ padding: 8 })` / `arrow({ padding: 8 })`、表示中は `autoUpdate`
- 表示: `mouseenter` / `focus` で出し、`mouseleave` / `blur` で消す。フェードは無い（即時）
- トリガーの中央に合わせ、トリガーとの間は 10px

同じ見た目と動きにするため、同じライブラリの React 版 `@floating-ui/react` を使う。`body` の直下に出す（`FloatingPortal`）ので、`overflow: hidden` の親（DataTable の枠など）の中でも切れない。

### `Tooltip`

```typescript
type TooltipProps = {
  /** トリガー。フォーカスできる要素でなければ tabIndex=0 の span で包む */
  children: React.ReactElement
  /** 吹き出しの中身 */
  content: React.ReactNode
  placement?: "top" | "right" | "bottom" | "left"
  /** デモの 4 種類。既定は default（白） */
  variant?: "default" | "dark" | "plain" | "no-arrow"
}
```

- `useFloating({ middleware: [offset(10), flip({ fallbackAxisSideDirection: "start" }), shift({ padding: 8 }), arrow({ element: arrowRef, padding: 8 })], placement, whileElementsMounted: autoUpdate })`
- `useInteractions([useHover(context), useFocus(context), useDismiss(context), useRole(context, { role: "tooltip" })])`。Esc で消える（`useDismiss`）。`aria-describedby` は `useRole` が付ける
- 吹き出しは `FloatingPortal` の中に描く

### 見た目（デモの実測値）

吹き出しの共通のクラス:

```
z-99999 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium shadow-md
```

（12px / 16px・太さ 500、余白 8px 14px、角丸 8px、`shadow-md`、折り返さない）

| variant | 枠 | 色のクラス |
| --- | --- | --- |
| `default` | `border` | `bg-white text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-white dark:border-gray-700` |
| `dark` | `border` | `bg-gray-950 text-white border-gray-800 dark:bg-gray-800 dark:border-gray-700` |
| `plain` | なし | `bg-gray-800 text-white dark:bg-gray-900` |
| `no-arrow` | なし | `bg-white text-gray-700 dark:bg-gray-900 dark:text-white` |

矢印は `default` と `dark` だけに付ける。12px 角の正方形を 45° 回し、半分（6px）を吹き出しの外に出す。

```
absolute h-3 w-3 rotate-45 {背景} {辺} {枠の色}
```

| | クラス |
| --- | --- |
| 背景 | `dark`: `bg-gray-950 dark:bg-gray-800` / それ以外: `bg-white dark:bg-[#1E2634]` |
| 枠の色 | `dark`: `border-gray-800 dark:border-gray-700` / それ以外: `border-gray-200 dark:border-gray-700` |
| 辺（実際の placement） | top: `border-r border-b` / bottom: `border-l border-t` / left: `border-r border-t` / right: `border-l border-b` |
| 位置（style） | top: `bottom: -6px; left: {x}px` / bottom: `top: -6px; left: {x}px` / left: `right: -6px; top: {y}px` / right: `left: -6px; top: {y}px`（x / y は `middlewareData.arrow`） |

- flip で placement が変わったら、辺と位置は変わった後の placement（`context.placement`）で決める
- ダークの `default` は、矢印（`#1E2634`）が吹き出し（`#101828`）より明るい。デモがそうなっているので合わせる

実測の色:

| variant | ライト: 背景 / 文字 / 枠 | ダーク: 背景 / 文字 / 枠 |
| --- | --- | --- |
| default | #FFFFFF / #344054 / #E4E7EC | #101828 / #FFFFFF / #344054 |
| dark | #0C111D / #FFFFFF / #1D2939 | #1D2939 / #FFFFFF / #344054 |
| plain | #1D2939 / #FFFFFF / なし | #101828 / #FFFFFF / なし |
| no-arrow | #FFFFFF / #344054 / なし | #101828 / #FFFFFF / なし |

### 見本の画面（`/demo/ui/tooltips`）

デモの Tooltips の画面と同じ構成にする: 「Default Tooltip」「White Tooltip」「Dark Tooltip」「Without Arrow」（White / Dark）「Tooltip Placement」（上・右・下・左）。トリガーはデモと同じボタン（`bg-brand-500 shadow-theme-xs inline-flex rounded-lg px-4 py-3 text-sm font-medium text-white`）、文言は「This is a tooltip」。各ブロックは `ComponentCard`。

## 動作確認

```bash
pnpm --filter admin lint
pnpm --filter admin build
```

`verify-web-page` skill で、デモ（https://demo.tailadmin.com/tooltips ）と並べて確認する。

- 4 種類 × 上下左右で、吹き出しの背景・文字・枠・影・角丸・余白・矢印の色と位置を、`browser_evaluate` の `getComputedStyle` でデモと数値で比べる（ライト / ダーク。ダークは `localStorage.theme = "dark"` でリロード）
- トリガーとの間が 10px で、中央に合っている（`getBoundingClientRect` で測る）
- 画面の上端のボタンで `placement="top"` にすると下に反転し、矢印の辺も変わる
- Tab でフォーカスしても出て、Esc で消える。スクリーンリーダー用に `aria-describedby` が付いている
- `overflow: hidden` の親の中（step6 の表の見出し）でも切れない

PR には 4 種類 × ライト / ダークのスクリーンショットをデモと並べて付ける。
