# step2-admin-app-config

アプリ名・説明・言語・タイムゾーンを `src/config/app.ts` にまとめ、ロゴ・タブのタイトル・`lang`・日時の表示をそこから決める。TailAdmin のブランド（ロゴ・favicon・文言）を消す。

設計: [`../README.md`](../README.md#アプリの設定ファイル) / [仕様: アプリ名・ロゴ・表示の設定](../README.md#アプリ名ロゴ表示の設定)

## 対応内容

### 変更するファイル

```
apps/admin/src/
├── config/app.ts                         # 新設
├── libs/date.ts                          # 新設 formatDateTime
├── components/layout/AppLogo.tsx         # 新設
├── components/layout/AppSidebar.tsx      # ロゴを AppLogo に
├── components/layout/AppHeader.tsx       # スマホのロゴを AppLogo に
├── app/layout.tsx                        # metadata・lang・フォント
├── app/global-error.tsx                  # lang
├── app/not-found.tsx                     # © の表記
├── app/favicon.ico                       # 削除（TailAdmin）
├── app/globals.css                       # フォントのフォールバック
├── app/(auth)/layout.tsx                 # ロゴ・説明文・重複した ThemeProvider
└── app/**/page.tsx                       # metadata をページ名だけに
apps/admin/public/favicon.svg             # 新設
apps/admin/public/images/logo/            # 削除（TailAdmin のロゴ 4 枚）
```

### `src/config/app.ts`

```typescript
/**
 * アプリの名前と表示の設定。プロジェクトで最初に書き換える
 *
 * - name: サイドバー・ヘッダー・サインイン画面のロゴの文字、タブのタイトル（`<ページ名> | <name>`）
 * - timeZone: 日時の表示と、日付の絞り込みの日の区切り
 */
export const appConfig = {
  description: "管理画面",
  lang: "ja",
  locale: "ja-JP",
  name: "Admin",
  timeZone: "Asia/Tokyo",
} as const
```

client component からも import する（秘密の値は置かない。env は `src/env.ts`）。

### `AppLogo`

```typescript
type AppLogoProps = {
  /** inverse は暗い背景（サインイン画面の右側）用に文字を白にする */
  tone?: "default" | "inverse"
  /** icon は折りたたんだサイドバー用に頭文字のアイコンだけを出す */
  variant?: "full" | "icon"
}
```

- アイコンは `bg-brand-500` の角丸の正方形に、アプリ名の頭文字（白・太字）。サイズはサイドバーの今のロゴに合わせる（アイコン 32px、full は高さ 32〜40px）
- full はアイコン + アプリ名（`text-gray-800 dark:text-white/90`、`inverse` は白）
- 画像のロゴにしたいプロジェクトは、この部品の中身を `<Image>` に差し替える（呼び出し側は変えない）

使う場所:

| 場所 | 今 | 変更後 |
| --- | --- | --- |
| サイドバー（開いているとき / 折りたたみ） | `logo.svg` / `logo-dark.svg` / `logo-icon.svg` | `<AppLogo />` / `<AppLogo variant="icon" />` |
| ヘッダー（スマホ幅） | `./images/logo/logo.svg`（相対パス。`/demo/charts/bar` のような階層の URL で読めない） | `<AppLogo />` |
| サインイン画面の右側 | `./images/logo/auth-logo.svg` と「Free and Open-Source Tailwind CSS Admin Dashboard Template」 | `<AppLogo tone="inverse" />` と `appConfig.description` |

`public/images/logo/` は使う所が無くなるので消す。

### タブのタイトル・`lang`・favicon

```typescript
/** app/layout.tsx */
export const metadata: Metadata = {
  description: appConfig.description,
  icons: { icon: "/favicon.svg" },
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
}

/** <html lang={appConfig.lang}> */
```

- 各 `page.tsx` の `metadata` は `title` にページ名だけを書き、`description` は消す（TailAdmin の説明文を残さない）。土台は日本語（「ホーム」）、デモは英語のまま（「Bar Chart」）
- `app/global-error.tsx` の `lang` も `appConfig.lang` にする
- `app/not-found.tsx` の `© {year} - TailAdmin` を `appConfig.name` にする
- favicon は `app/favicon.ico`（TailAdmin）を消し、`public/favicon.svg`（`AppLogo` のアイコンと同じ見た目の SVG）を置いて `metadata.icons` で指す。`app/icon.svg` にしないのは、`next.config.ts` の `*.svg` を React 部品に変える svgr の設定が Next.js の icon の扱いと衝突するおそれがあるため

### フォント

TailAdmin の Outfit は欧文だけなので、日本語のフォールバックを足す。

- `app/layout.tsx`: `Outfit({ subsets: ["latin"], variable: "--font-outfit-loaded" })` にして **`<html>`** に `outfit.variable` を付ける。`--font-outfit` は `@theme` で `:root`（= `<html>`）に出るので、`<body>` に付けると `:root` からは `--font-outfit-loaded` が見えず、`--font-outfit` ごと無効になる（日本語のフォールバックも効かなくなる）
- `globals.css`: `--font-outfit: var(--font-outfit-loaded), "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;`

デモのグラフの `fontFamily: "Outfit"` はそのまま（デモは英語）。

### `(auth)/layout.tsx`

ロゴと説明文の差し替えに加え、`ThemeProvider` の二重の囲みを消す（root の layout が既に囲んでいる）。

### 日時の表示（`src/libs/date.ts`）

```typescript
const dateTimeFormatter = new Intl.DateTimeFormat(appConfig.locale, {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: appConfig.timeZone,
  year: "numeric",
})

/**
 * 日時を設定のタイムゾーンの `YYYY/MM/DD HH:mm` で表示する
 * Server Component はサーバーのタイムゾーン（本番は UTC のことが多い）で動くので、toLocaleString を直接使わない
 */
export const formatDateTime = (value: string | Date): string =>
  dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value)
```

step6 で日付の絞り込み用の `toStartOfDayIso`、step7 で通知用の `formatRelativeTime` をここに足す。

### ドキュメント

`apps/admin/README.md` に「ブランドを変える」を書く: `src/config/app.ts`、`AppLogo`、`public/favicon.svg`、ブランドの色（`globals.css` の `@theme` の `--color-brand-*`）。

## 動作確認

```bash
pnpm --filter admin lint
pnpm --filter admin build
grep -rn "TailAdmin\|pimjo" apps/admin/src   # デモの画面の部品の中身を除き、土台に残っていないこと
```

`verify-web-page` skill で確認する。

| 確認 | 期待 |
| --- | --- |
| サイドバー（開いている / 折りたたみ / ホバーで開く） | 「A」のアイコン + 「Admin」/ アイコンだけ |
| スマホ幅で `/demo/charts/bar` を開く | ヘッダーにロゴが出る（今は画像が切れる） |
| `/signin` の右側 | ロゴ（白文字）と「管理画面」 |
| タブのタイトル | `/` は「ホーム \| Admin」、`/demo/charts/bar` は「Bar Chart \| Admin」 |
| `src/config/app.ts` の `name` を `"Sample"` に変える | 全部のロゴとタイトルが変わる（確認後に戻す） |
| favicon | 新しいアイコン |
| ダークモード | ロゴの文字が白系になる |

PR にはサイドバー・サインイン画面・スマホのヘッダーの変更前後のスクリーンショットを付ける。
