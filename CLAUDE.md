# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turborepo + pnpm モノレポ。

### Apps

- **apps/web**: Next.js 16 web application (port 3000)
- **apps/admin**: Next.js 16 admin dashboard (port 3030)
- **apps/mobile**: Expo/React Native mobile application
- **apps/api**: Express.js API server (port 8080)
- **apps/cron**: 定期実行タスク（タスク 1 回実行で exit するモデル。本番は EventBridge / CronJob 等で起動）
- **apps/worker**: 常駐型 worker（BullMQ ベース）

### Packages

- **packages/schema**: Shared Zod schemas (`@repo/api-schema`)
- **packages/db**: Prisma schema / migrations / generated client + `createPrismaClient` factory (`@repo/db`)
- **packages/logger**: `ILogger` + pino/winston/console/silent + AsyncLocalStorage context (`@repo/logger`)
- **packages/errors**: `Result<T>` + `ApiError` + 業務エラー生成ヘルパ (`@repo/errors`)
- **packages/redis**: `createRedisClient` factory（BullMQ / Pub/Sub 対応）(`@repo/redis`)
- **packages/queue**: Queue 抽象 (`JobQueue<T>` / `JobProcessor<T>` / `JobConsumer`) + BullMQ 実装 (`@repo/queue`)。ハンドラ側は実装を知らないため、SQS / Cloud Tasks 等への差し替えが可能
- **packages/domain**: api / cron / worker が共有するドメイン型 (`@repo/domain`)。型と純粋関数のみ・依存ゼロ。**Repository interface と Prisma 型は置かない**（`packages/domain/README.md` 参照）
- **packages/storage**: `createStorage` factory + local / S3 実装 (`@repo/storage`)
- **packages/eslint-config** / **packages/typescript-config**: 共有 lint / tsconfig

**共通パッケージの方針**: `db` / `logger` / `errors` / `redis` / `storage` は server-side app 横断で使う共通基盤。client は **factory のみを export** し、各 app の `src/index.ts` で 1 回生成して Repository に DI する。新規 server-side app (cron / worker / batch) も同じ流儀に従う。

**env の検証は各 app の `src/env.ts` にインラインで定義する**（Zod スキーマ + `safeParse → process.exit(1)`）。共通の env 検証パッケージは持たず、`apps/{app}/src/env.ts` 単独で env 仕様が完結するようにする。`apps/web` / `apps/admin` は `server-only` でガードして client component からの import を防ぐ。`apps/mobile` は RN に server が無く `process.exit` も使えないため、`EXPO_PUBLIC_*` を静的に列挙して検証し、不正なら throw する（詳細は `apps/mobile/CLAUDE.md`）。

### Infra

- **infra/terraform**: AWS Infrastructure as Code

### 作業時に参照するドキュメント

各ディレクトリでの作業時は **対応する `CLAUDE.md` を参照してください**:

- API → `apps/api/CLAUDE.md`（レイヤードアーキテクチャ / Result型 / テスト戦略 / dotenvx / Admin方針 / DI assembly）
- Web → `apps/web/CLAUDE.md`
- Admin → `apps/admin/CLAUDE.md`
- Mobile → `apps/mobile/CLAUDE.md`
- Cron → `apps/cron/CLAUDE.md`（task / repository 構造 / env 検証 / graceful shutdown / Docker / 本番起動想定）
- Worker → `apps/worker/CLAUDE.md`（Queue 抽象 / BullMQ → 他実装への切り替え方 / 新 Queue の追加手順 / 冪等性）
- スキーマ → `packages/schema/CLAUDE.md`（スキーマ命名規則）
- Terraform → `infra/terraform/CLAUDE.md`

アーキテクチャ・規約のトピック別まとめは [`docs/onboarding/`](docs/onboarding/README.md)（人間向けキャッチアップ。正典は各 `CLAUDE.md`）。

## Common Commands (root)

```bash
pnpm dev          # 全アプリを dev 起動
pnpm build        # 全アプリをビルド
pnpm lint         # ESLint
pnpm lint:fix     # ESLint 自動修正
pnpm test         # テスト
```

各アプリ固有のコマンドは対応サブディレクトリの `CLAUDE.md` を参照。前提は Node.js >=18 / pnpm >=9（インフラ作業時は Terraform + AWS CLI）。

## Code Style and Linting

ESLint v9 flat config (`eslint.config.{js,mjs}`)。**全アプリ共通ルール**。**ファイル変更後は `pnpm lint:fix` を実行する**。

- **プラグイン定義**: Web / Admin は `eslint-config-next`、Mobile は `eslint-config-expo/flat` を使うため `@typescript-eslint` を再定義してはいけない（"Cannot redefine plugin" エラー）。API は全プラグインを自前で定義。

### 共通ルール

- **No semicolons** (`semi: ["error", "never"]`)
- **Double quotes** (`quotes: ["error", "double"]`)
- **Object curly spacing**: `{ foo }` (not `{foo}`)
- **Strict equality**: `===` (not `==`)
- **Import ordering**: builtin → external → internal (`@repo`) → parent → sibling → index、グループ間に空行
- **Sort object keys** alphabetically (2+ keys)。例外:
  - `id` は常に先頭
  - `createdAt` / `updatedAt` / `deletedAt`（および snake_case）は常に末尾
  - 例: `{ id, color, name, sortOrder, createdAt, updatedAt }`
- **バレルエクスポート（index.ts）**: ファイル名のアルファベット順
- **React JSX props**: callbacks last, shorthand first, reserved first
- **TypeScript**: No `any` (warn), no empty functions, `async` for Promise-returning functions
- **Naming conventions**: Variables は camelCase / UPPER_CASE / PascalCase、Functions は camelCase / PascalCase、Types は PascalCase
- **Prefer**: `const` over `let`/`var`、template literals、arrow callbacks

### 関数名

- **必ず動詞から始める**（例: `getUserById`, `createOrder`, `sendWelcomeMail`）。名詞だけの関数名（`userValidation`, `orderTotal`）は使わない
- **boolean を返す関数は `is` / `should` / `can` / `has` などの述語プレフィックスで始める**:
  - 良い例: `isActiveUser`, `shouldRetryJob`, `canEditMemo`, `hasAdminRole`
  - 悪い例: `activeUser`, `retryJob`（retry するように見える）, `adminRole`
  - **例外**: 複数の条件をまとめて検証する関数は `check` / `verify` / `validate` から始めてよい（例: `checkOrderPreconditions`, `verifyWebhookSignature`, `validateCsvRow`）。ただし単一条件の真偽判定に `check` は使わず、述語プレフィックスを優先する
  - **例外**: 処理を実行して成否を boolean で返すアクション系の関数は、述語プレフィックスにせず動作を表す動詞のままにする（例: `tryRefresh`, `saveDraft`）。述語プレフィックスの対象は「判定だけを行う関数」
- **処理内容が明確にわかる名前にする**:
  - 悪い例: `parseCsvLine`, `toHalfWidth`, `parseAmount`
  - 良い例: `splitCsvLineWithQuotes`, `convertFullWidthToHalfWidth`, `convertCommaAmountToNumber`

### Function style

- **API / cron / worker**: `function` 宣言は使わず、`const` + アロー関数で統一（例: `export const foo = async () => {}`）
- **Web / Mobile / Admin**: コンポーネントは `function` に統一

### Class member style (全 apps / packages 共通)

- **`constructor` 以外のクラスメンバー（メソッド・プロパティ）は必ず `public` / `private` を明示する**（`@typescript-eslint/explicit-member-accessibility`）。修飾子を省略してデフォルトの `public` 扱いにしない。`protected` は継承を使う場合のみ
- **`private` なメンバー（メソッド・プロパティ・constructor parameter property を含む）は `_` プレフィックスを必須にする**（`@typescript-eslint/naming-convention`）
- `constructor` 自体には修飾子を書かない

```typescript
class PrismaUserRepository implements UserRepository {
  constructor(private readonly _prisma: PrismaClient) {}

  public async findById(id: number): Promise<User | null> {
    const row = await this._prisma.user.findUnique({ where: { id } })
    return row ? this._toDomain(row) : null
  }

  private _toDomain(row: PrismaUser): User {
    return { id: row.id, name: row.name }
  }
}
```

### Prisma 型の import 境界（server-side app）

`@repo/db` を依存に持つ app（api / cron / worker）は `@repo/eslint-config/prisma-boundary` を spread し、`@repo/db` からの import を `src/repository/**` 以外では `createPrismaClient` / `CreatePrismaClientOptions` / `PrismaClient` の 3 つだけに限定する（許可リスト方式なのでモデルが増えても設定変更は不要）。業務ロジック（service / jobs / controller）は `@repo/domain` の型を使う。新しい server-side app を追加したら同じフラグメントを spread する。

- **lint の限界**: 検出できるのは `@repo/db` からの直接 import だけ。repository の `interface` が戻り値に Prisma 型を使うと service / jobs へ推論で伝播するが検出できない。`interface` の引数・戻り値を domain 型にする規約はレビューで担保する（詳細は `packages/eslint-config/README.md`）

### @repo パッケージの import 境界（フロント）

`apps/web` / `apps/admin` / `apps/mobile` は `@repo/eslint-config/frontend-boundary` を spread し、`@repo/*` の import を **`@repo/api-schema` だけ**に限定する（許可リスト方式なのでパッケージが増えても設定変更は不要）。フロントは DB を直接触らず必ず Express API を経由する設計なので、共有する契約は API スキーマだけになる。

- `@repo/domain` を許可しないのは意図的。domain 型は `createdAt: Date` だが API のワイヤーフォーマットは `created_at: string` なので、フロントが使うべき型は `@repo/api-schema` 側
- server で動く処理（API 呼び出し・env 参照）は `import "server-only"` を先頭に置いたモジュールに閉じ、client component から import されたらビルドが落ちるようにする

### Comment style

- ブロックコメントは `/** */` 形式で統一（`//` は使わない）。1 行の内容でも `/**` / ` * 内容` / ` */` の複数行形式で書く

## Documentation Guidelines

仕様書・設計書は `docs/spec/` 配下、機能単位でディレクトリを切る。

- ファイル構成: `docs/spec/{feature}/README.md`（人間向け：背景・全体像・図） + `step{n}-{db|api|web|mobile|admin}-{feature}.md`（実装手順）
- 全て日本語で記述
- README.md には **目次（Table of Contents）必須**: GitHub Markdown アンカーリンク形式、`##` / `###` 見出しを全て含める
- step ファイル: 実装手順に番号を振らない、各ファイルは「対応内容」「動作確認」セクションを含める
- テンプレート: `docs/spec/template/README.md` および `docs/spec/template/step1-template.md`
- **図は Mermaid で記載する**: フロー図 / シーケンス図 / ER 図 / 状態遷移図はすべて ` ```mermaid ` コードフェンスを使う。ASCII アートは使わない

**新機能を実装する前に必ず `design-feature` skill で設計書を作成する**。デザインのモックが必要なときは `design-mock` skill を使う（テーマヒアリング → admin 参照 → モック作成 → 承認後に仕様書追記）。

## Important Notes

- スキーマパッケージは依存アプリより先にビルドする必要がある。スキーマ変更時は `cd packages/schema && pnpm build`
- Terraform state は S3 + S3 ネイティブロック（`use_lockfile = true`、Terraform 1.10+）構成（bootstrap で構成済み）
