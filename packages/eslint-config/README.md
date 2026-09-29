# @repo/eslint-config

モノレポ全体で共通利用する ESLint v9 (flat config) のルール群を提供する。**全 apps / packages の `eslint.config.js` は本パッケージを参照する**。

## 目次

- [役割](#役割)
- [公開 API](#公開-api)
- [Prisma 型の import 境界](#prisma-型の-import-境界)
- [使い方（新規 app 追加時）](#使い方新規-app-追加時)
- [関連](#関連)

## 役割

- 全 apps / packages で **同じ lint ルール** を強制（命名規則 / import 順 / クォート / セミコロン等）
- 共通 rule セット（`common-rules`）と完成済み flat config（`index.js`）を export し、apps 側は自身の framework (Next / Expo / Express) 用 config に merge する形で利用

## 公開 API

3 つのエントリがあり、用途で使い分ける。

| Export | 形 | 用途 |
| --- | --- | --- |
| `@repo/eslint-config/common-rules` | `{ commonRules, commonNamingConvention }`（**rules オブジェクト**） | 全 apps / packages 共通の rule set（命名・import 順・style 等）。framework config の `rules` に展開して使う（→ [使い方](#使い方新規-app-追加時)） |
| `@repo/eslint-config`（= `index.js`） | **完成済み flat config 配列** | TS 向けの最小 flat config。framework を使わない packages 側は `module.exports = require("@repo/eslint-config")` でそのまま利用できる |
| `@repo/eslint-config/prisma-boundary` | **flat config 配列（フラグメント）** | Prisma 型の import 境界。`@repo/db` を依存に持つ server-side app が spread する（→ [Prisma 型の import 境界](#prisma-型の-import-境界)） |

## Prisma 型の import 境界

`@repo/db` を依存に持つ server-side app（api / cron / worker / 将来の push）は、Prisma の型が業務ロジックへ漏れないように本フラグメントを spread する。

```js
// apps/worker/eslint.config.js
const baseConfig = require("@repo/eslint-config")
const prismaBoundary = require("@repo/eslint-config/prisma-boundary")

module.exports = [...baseConfig, ...prismaBoundary]
```

| 項目 | 内容 |
| --- | --- |
| 制限する型 | `@repo/db` からの `AuthAccount` / `Memo` / `Prisma` / `User` の import（`import type` も検出する） |
| 制限しない型 | `PrismaClient`（composition root と graceful shutdown で `$disconnect()` のために必要） |
| 許可する層 | `src/repository/**/*.ts` のみ。Repository 実装だけが「DB row → domain 型」の変換責務を持つ |
| 業務ロジックが使う型 | `@repo/domain`（`packages/domain`） |

### このルールの限界

**検出できるのは `@repo/db` からの直接 import だけ。** repository 層の `interface` が戻り値に Prisma 型を使った場合、その型は推論で service / jobs へ伝播するが lint では検出できない（実際に `apps/worker` で起きた）。

```ts
/** ✗ lint は通るが Prisma 型が jobs へ伝播する */
import type { Memo } from "@repo/db"        // repository/ 配下なので許可される

export interface MemoRepository {
  findById(id: number): Promise<Memo | null>  // ← 戻り値経由で漏れる
}
```

「`interface` の引数・戻り値を domain 型にする」規約は各 app の `CLAUDE.md` とコードレビューで担保する。

## 使い方（新規 app 追加時）

`commonRules` は flat config エントリではなく **rules オブジェクト** なので、framework の config を先に並べ、`rules` の中に展開して使う。

```js
// apps/web/eslint.config.mjs（Next.js の例）
import nextVitals from "eslint-config-next/core-web-vitals"

import eslintConfigCommonRules from "@repo/eslint-config/common-rules"

const { commonRules } = eslintConfigCommonRules

export default [
  ...nextVitals,                       // framework の config を先に置く
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      ...commonRules,                  // 共通ルールを展開
      "react/jsx-indent": ["error", 2], // app 固有のルールを上書き / 追加
    },
  },
]
```

> **注意**: `eslint-config-next` / `eslint-config-expo` を使う app は **`@typescript-eslint` プラグインを再定義してはいけない**（"Cannot redefine plugin" エラー）。`common-rules` は再定義を避けた形になっている。

## 関連

- ルートの [CLAUDE.md](../../CLAUDE.md) — Code Style 全体の正本
- 各 app の `eslint.config.js` — このパッケージの使用例
