# step1-admin-demo-isolation

TailAdmin のデモ画面とデモだけが使う部品・画像・CSS を `/demo` の下にまとめ、土台から切り離す。使われていない依存・画像・型定義は消す。ホーム（`/`）は空のダッシュボードにする。

画面の見た目は変えない（URL が `/demo/...` に変わるだけ）。

設計: [`../README.md`](../README.md#デモの置き場所) / [仕様: デモと土台](../README.md#デモと土台)

## 対応内容

### ページの移動

`git mv` で移す（中身は import のパスだけ直す）。

| 今 | 移動先（URL） |
| --- | --- |
| `app/(dashboard)/page.tsx`（EC のダッシュボード） | `app/(dashboard)/demo/ecommerce/page.tsx`（`/demo/ecommerce`） |
| `app/(dashboard)/{blank,calendar,profile}/` | `app/(dashboard)/demo/{blank,calendar,profile}/` |
| `app/(dashboard)/charts/{bar,line,pie,radar}/` | `app/(dashboard)/demo/charts/...` |
| `app/(dashboard)/forms/elements/` | `app/(dashboard)/demo/forms/elements/` |
| `app/(dashboard)/tables/basic/` | `app/(dashboard)/demo/tables/basic/` |
| `app/(dashboard)/ui/{alerts,avatars,badge,buttons,images,modals,videos}/` | `app/(dashboard)/demo/ui/...` |
| `app/(auth)/signup/` | `app/(auth)/demo/signup/`（`/demo/signup`） |

- `app/(auth)/signin/` は残す（step5 で作り直し、その時に今のフォームを `/demo/signin` に移す）
- `app/(dashboard)/demo/layout.tsx` を新設し、デモの CSS（後述）を読み込む。中身は `children` を返すだけ

### 部品の移動

| 今 | 移動先 | 理由 |
| --- | --- | --- |
| `components/features/ecommerce/` | `components/demo/ecommerce/` | サンプルデータ |
| `components/features/example/` | `components/demo/example/` | 見本 |
| `components/features/calendar/` | `components/demo/calendar/` | サンプルの予定 |
| `components/features/user-profile/` | `components/demo/user-profile/` | 固定の人物（Musharof） |
| `components/features/auth/SignUpForm.tsx` | `components/demo/auth/SignUpForm.tsx` | admin にサインアップは無い |
| `components/ui/charts/` | `components/demo/charts/` | props が無く、系列と色が固定 |
| `components/ui/images/` | `components/demo/images/` | props が無く、画像が固定 |
| `components/ui/ChartTab.tsx` | `components/demo/ecommerce/ChartTab.tsx` | ecommerce だけが使う |
| `components/features/videos/` | 削除 | どこからも import されていない |

`components/ui/` のうち props で動く汎用の部品（alert / avatar / badge / button / dropdown / form / modal / table / video）と `components/layout/`（`ComponentCard` / `PageBreadCrumb` を含む）は土台に残す。

### ホーム（`app/(dashboard)/page.tsx`）

`PageBreadCrumb`（「ホーム」）と `ComponentCard` 1 枚の空のダッシュボードにする。本文は「ここにダッシュボードを作ります。UI 部品の見本はサイドバーの「デモ」にあります。」。

### サイドバー

`AppSidebar.tsx` の `navItems` / `othersItems`（`main` / `others` の 2 つに固定）を、見出し付きのセクションの配列にする。

```typescript
/** components/layout/nav-items.tsx */

export type NavItem = {
  icon: React.ReactNode
  name: string
  path?: string
  subItems?: { name: string; path: string }[]
}

/**
 * サイドバーのセクション（見出し + 項目）
 */
export type NavSection = {
  items: NavItem[]
  title: string
}

/**
 * 土台のメニュー。プロジェクトの画面はここに足す
 */
export const mainNavSection: NavSection = {
  items: [{ icon: <GridIcon />, name: "ホーム", path: "/" }],
  title: "メニュー",
}
```

```typescript
/** components/demo/demo-nav-items.tsx */

/**
 * デモの画面のメニュー。デモを消すときはこのファイルと AppSidebar の import を消す
 */
export const demoNavSection: NavSection = {
  items: [
    { icon: <GridIcon />, name: "Dashboard", subItems: [{ name: "Ecommerce", path: "/demo/ecommerce" }] },
    /** 今の navItems / othersItems の項目をすべて /demo/... にして並べる */
  ],
  title: "デモ",
}
```

- `AppSidebar` は `[mainNavSection, demoNavSection]` を描く。サブメニューの開閉状態は `{ sectionIndex, itemIndex }` で持つ
- `pro` / `new` のバッジ（TailAdmin Pro の名残。すべて `false`）は消す
- 見出しは「メニュー」「デモ」（日本語化は土台の部分だけ。デモの項目名は英語のまま）

### 画像（`public/images/`）

| 対象 | 対応 |
| --- | --- |
| デモ（とヘッダーの固定のサンプル）だけが使う `user/` `country/` `brand/` `product/` `grid-image/` | `public/images/demo/` に移し、参照するパスを直す |
| どこからも参照されない `cards/` `carousel/` `chat/` `icons/` `task/` `video-thumb/` | 削除（約 4.7MB） |
| 参照されないファイル: `user/` の 15 枚、`country-08`、`brand-09〜15`、`error/` の 404 以外の 8 枚、`images/favicon.ico`（`app/favicon.ico` と同じ） | 削除 |
| `logo/` `shape/` `error/404*.svg` | 土台なので残す（ロゴは step2 で置き換える） |

ヘッダーの `UserDropdown` / `NotificationDropdown` の固定のサンプル画像も `/images/demo/user/...` を指すようにする（中身は step7 で props にする）。

### CSS

`app/globals.css` からデモだけが使うブロックを `components/demo/demo.css` に移し、使われていないブロックは消す。

| ブロック | 対応 |
| --- | --- |
| Calendar（`modal-title` / `modal-footer` / `btn*` / `n-chk` / `form-check*` / `fc-*` / `.custom-calendar` / `.form-check-input`）、DropZone（`dropzone`）、地図（`mapOne` / `map-btn` / jvectormap）、apexcharts | `demo.css` へ |
| swiper / carousel と `--shadow-slider-navigation`、`.input-date-icon`、`.taskCheckbox` / `.task` | 削除（どこからも使われていない） |
| flatpickr | 残す（土台の `DatePicker` が使う） |

```css
/* components/demo/demo.css */
/* globals.css のテーマ（色・余白）を @apply で使うため */
@reference "../../app/globals.css";
```

- `app/layout.tsx` の `import "flatpickr/dist/flatpickr.css"` は消す（`DatePicker` が自分で読む。デモの `StatisticsChart` には同じ import を足す）
- `eslint.config.mjs` の `settings.tailwindcss.cssFiles` に `"src/components/demo/*.css"` を足す（デモのクラス名が未定義と言われないように）

### 依存

| 依存 | 対応 |
| --- | --- |
| `react-dnd` / `react-dnd-html5-backend` / `swiper` / `@fullcalendar/list` / `@tailwindcss/forms` | 削除（どこからも import されていない） |
| `jsvectormap.d.ts` | 削除（宣言しているモジュールを誰も import していない） |
| `@fullcalendar/*` / `@react-jvectormap/*`（と `overrides`）/ `apexcharts` / `react-apexcharts` / `react-dropzone` | デモだけが使う。残し、`apps/admin/README.md` の「デモを消す手順」に列挙する |

### 土台からデモを import させない lint

```javascript
/** eslint.config.mjs に足す */
  {
    /**
     * 土台はデモを import しない（デモを消しても土台が壊れないように）。
     * デモの画面と部品自身は対象外。サイドバーのデモの項目だけは例外
     */
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/app/(dashboard)/demo/**", "src/app/(auth)/demo/**", "src/components/demo/**"],
    rules: {
      "import/no-restricted-paths": ["error", {
        zones: [{
          except: ["./demo-nav-items.tsx"],
          from: "./src/components/demo",
          message: "土台からデモを import しない。デモを消したときに壊れる",
          target: "./src",
        }],
      }],
    },
  },
```

`frontend-boundary` の `no-restricted-imports` とは別のルールなので、設定が上書きし合わない。

### そのほか

- `components/layout/PageBreadCrumb.tsx` の Alpine.js の名残（`x-text="pageName"`）を消す
- `.claude/skills/design-mock/SKILL.md` の参照先（`(dashboard)/page.tsx` / `(dashboard)/ui/`）を `(dashboard)/demo/...` に直す
- `apps/admin/README.md`: デモの置き場所と「デモを消す手順」（ディレクトリ・サイドバーの import・依存）を書く。技術スタックの FullCalendar / ApexCharts は「デモだけが使う」と書き直す
- `apps/admin/CLAUDE.md`: 「TailAdmin の画面がそのまま入っている」を、土台とデモの分け方に書き直す。新しい画面は `app/(dashboard)/{feature}/` に、デモは `/demo` に置く

## 動作確認

```bash
pnpm --filter admin lint
pnpm --filter admin build
```

- `build` が通ること（ページの移動漏れ・import のパスの誤りが無い）
- `lint` で `import/no-restricted-paths` の違反が無いこと。試しに `app/(dashboard)/page.tsx` から `components/demo/...` を import すると lint が落ちることを確かめる（確認後に戻す）

`verify-web-page` skill で画面を確認する（port 3030）。

| 確認 | 期待 |
| --- | --- |
| `/` | 空のダッシュボード |
| サイドバー | 「メニュー」に「ホーム」、「デモ」に今までの項目 |
| デモの全ページ（`/demo/ecommerce` / `/demo/calendar` / `/demo/charts/*` / `/demo/forms/elements` / `/demo/tables/basic` / `/demo/ui/*` / `/demo/profile` / `/demo/blank` / `/demo/signup`） | 移動前と同じ見た目（画像の切れ・CSS の崩れが無い）。console にエラーが無い |
| 旧 URL（`/calendar` など） | 404 |
| ダークモード | デモの全ページが移動前と同じ |

PR には移動前後の `/demo/ecommerce`・`/demo/calendar`（デモの CSS を使う代表）のスクリーンショットを付ける。
