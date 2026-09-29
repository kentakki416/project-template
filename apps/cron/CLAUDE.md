# apps/cron

定期実行されるタスク群を 1 つの Node.js プロセスにまとめたパッケージ。本番では EventBridge → ECS Scheduled Task を想定（タスク 1 回実行して exit するモデル）。

## 含まれるタスク

| コマンド | 用途 |
| --- | --- |
| `pnpm cleanup:old-memos` | `CLEANUP_MEMO_OLDER_THAN_DAYS` (default: 90) 日より前の memo を一括削除（DB cleanup の例） |

新タスクは `src/task/<name>.ts` を 1 ファイル追加し、`package.json` の scripts にエントリを追加する。

## Commands

```bash
pnpm dev              # tsx watch で src/index.ts を起動（起動確認用）
pnpm build            # dist/ にコンパイル
pnpm cleanup:old-memos # 単発実行
pnpm lint             # ESLint
pnpm test             # Vitest（DB 不要、Prisma は mock）
```

## ディレクトリ構成

```
apps/cron/
  src/
    index.ts                      # 起動確認用エントリポイント（本番では使わない）
    env.ts                        # Zod による env 検証 (safeParse → process.exit(1))
    task/                         # 1 ファイル = 1 cron タスク。フラット配置。サブディレクトリは切らない
      cleanup-old-memos.ts        # env を組み立てて service を呼ぶだけ
    service/                      # 業務ロジック層（純粋関数 + Repository を引数 DI）
      index.ts                    # barrel: export * as memo from "./memo"
      memo/
        cleanup-old-memos.ts
        index.ts
    runtime/
      graceful-shutdown.ts        # SIGTERM / SIGINT で Prisma を $disconnect して exit
    repository/prisma/            # DB アクセスを集約（apps/api と同じ構造）
      memo-repository.ts
      index.ts                    # barrel export
  test/                           # vitest ユニットテスト
```

## レイヤード設計のルール

- **`task/<name>.ts`**: cron 1 本 = 1 ファイル。env を組み立てて Prisma client / Repository を生成し、service に DI するだけ。閾値計算や件数集計などのドメインロジックは書かない。サブディレクトリは切らない
- **`service/<domain>/`**: 業務ロジック層。`export const` のアロー関数で定義し、Repository は単一でも `repo: { xxxRepository }` のオブジェクト引数で受ける（将来 Repository が増えてもシグネチャを変えなくて済む）。`service/index.ts` で `export * as <domain> from "./<domain>"` してバレル、task からは `service.<domain>.<method>(input, { xxxRepository })` で呼ぶ。`apps/api` の service と同じ流儀。**Repository class を service の中に書かない**
- **`repository/prisma/`**: `interface XxxRepository` + `class PrismaXxxRepository implements XxxRepository` のペア。`index.ts` で barrel export。**interface の引数・戻り値に Prisma の型を出さず、必要なら `@repo/domain` の型を使う**
- **`runtime/`**: プロセスライフサイクル関連（graceful shutdown 等）
- **`lib/`** (任意): env も DB も知らない純関数のみ
- **`client/<service>/`** (任意): 外部 API クライアント class。env を直接 import せずコンストラクタ DI

### Repository の interface 分離

cron 側の Repository (`PrismaMemoRepository`) は apps/api 側と意図的に分離している。`api` は CRUD ベース、`cron` は batch 削除など別の操作セットを持つので、共有 interface を作ると不要なメソッドが両方に漏れる。**各 app で必要な操作のみを持つ独自 interface を定義する**方針。

ドメイン型（`Memo` / `User` 等）は逆に `@repo/domain` で共有する。api / cron / worker は 1 つの DB と Prisma schema を共有する単一アプリの実行形態違いなので、型を app ごとに複製しても独立性は得られず drift のリスクだけが増える。

### Prisma の型は repository 実装の内側に閉じる

**`@repo/eslint-config/prisma-boundary` で lint 強制している**（`eslint.config.js` で spread 済み）。`@repo/db` の Prisma 型（`Memo` / `User` / `AuthAccount` / `Prisma`）を import してよいのは以下だけ:

- `repository/prisma/*.ts` の **実装クラスの内側**（`_toDomainXxx` のような変換関数の引数）
- `src/task/*.ts`（`createPrismaClient` の呼び出し。`PrismaClient` 型は制限対象外）
- `src/runtime/graceful-shutdown.ts`（`$disconnect()` のための `PrismaClient` 型）

現状の `MemoRepository` は `deleteOlderThan(threshold: Date): Promise<number>` のみで Prisma 型を一切公開していない。新しい操作を追加するときもこの形を保つ。

### env / errors / logger

- `@repo/logger`: ログ出力
- `@repo/db`: `createPrismaClient` で PrismaClient を生成
- `@repo/errors`: 業務エラーが必要になったら使う（現状の cleanup タスクでは throw で十分）
- env 検証は `src/env.ts` に Zod スキーマをインラインで定義（`safeParse → process.exit(1)` パターン。apps/api と同じ）

## 本番起動（想定）

本番では以下のいずれかで定期起動する想定（今回は apps/cron のコードのみ。スケジュール側の実装はスコープ外）:

- **AWS**: EventBridge Schedule → ECS Scheduled Task → `dist/task/<name>.js` を直接起動
- **GitHub Actions**: `.github/workflows/cron-*.yml` で `schedule:` トリガー + `pnpm --filter cron <task>`
- **Kubernetes**: CronJob で `node dist/task/<name>.js`

Dockerfile はマルチステージ (turbo prune ベース) で用意済み (`apps/cron/Dockerfile`)。CMD はデフォルトで `cleanup-old-memos` を呼ぶが、ECS Task Definition の command で別 task に差し替え可能。

## テスト戦略

- **Repository / Service の unit test**: Prisma は `vi.fn()` で mock（DB 不要、並列実行可）
- **Controller integration テストのような統合テストは現状無し**（task はエントリポイントから直接 service を呼ぶフラットな構造のため）

apps/api と同じく `describe("正常系" / "異常系")` の入れ子で分類する。

## コードスタイル

ルート `CLAUDE.md` の「Code Style and Linting」と同じ規約に従う。**Function style は API と同じく `const + arrow function`**。クラスメンバーは `public` / `private` を明示し、private には `_` プレフィックス必須。
