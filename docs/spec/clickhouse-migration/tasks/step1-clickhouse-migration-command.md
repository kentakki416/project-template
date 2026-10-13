# step1-clickhouse-migration-command

ClickHouse の migration コマンド（`packages/clickhouse-migration`）を作り、ローカルの ClickHouse の DDL をすべてこのコマンド経由にする。`infra/clickhouse/init/` の init スクリプトは廃止する。migration イメージにも同梱し、コンテナからも同じコマンドを流せるようにする（AWS で動かすのは step2・4）。

AWS の環境には影響しない（Terraform・deploy workflow は触らない。migration イメージの中身は増えるが、`CMD` は Drizzle のまま）。

設計: [`../README.md`](../README.md#migration-コマンドの処理) / [環境の差の吸収](../README.md#環境の差の吸収) / [ローカルの CDC](../README.md#ローカルの-cdc)

## 対応内容

### ディレクトリ構成

```
packages/clickhouse-migration/      # @repo/clickhouse-migration（新設）
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── README.md
├── migrations/                     # 版管理する migration（1 回だけ適用）
│   └── 1_create_events.sql
├── views/                          # CDC の view（毎回作り直す）。ファイル名 = CDC 対象テーブル名
│   ├── memos.sql
│   └── users.sql
├── src/
│   ├── index.ts                    # 処理の順序だけを書く
│   ├── env.ts
│   ├── cdc-view-variables.ts       # CDC の実装ごとの置き換え値
│   ├── definition-files.ts         # migrations/ ・ views/ ・ cdc-tables.json の読み込みと検査
│   ├── render-view-sql.ts
│   ├── rebuild-local-cdc.ts
│   ├── run-versioned-migrations.ts
│   └── apply-views.ts
└── test/
    ├── definition-files.test.ts
    └── render-view-sql.test.ts

infra/clickhouse/
├── cdc-tables.json                 # 新設。CDC の対象一覧（Terraform と migration コマンドが読む）
└── users.d/materialized-postgresql.xml   # そのまま
```

`infra/clickhouse/init/` は丸ごと削除する。

### `infra/clickhouse/cdc-tables.json`

```json
["users", "memos"]
```

- `public` スキーマのテーブル名だけを並べる。ClickHouse 側のテーブル名も同じにする
- JSON はコメントを書けないため、意味と変更手順は `packages/clickhouse-migration/README.md` と `packages/data-warehouse/README.md` に書く

### `migrations/1_create_events.sql`

`infra/clickhouse/init/01-events.sql` を移す。**`project_template.` の修飾を外す**（init スクリプトは DB 未指定で実行されたため修飾が必要だったが、migration は接続先の database で実行される）。冒頭のコメントのうち「entrypoint が DB 指定なしで実行する」の段落は消し、ReplacingMergeTree の理由は残す。

```sql
CREATE TABLE IF NOT EXISTS events
(
    event_id       UUID,
    event_name     LowCardinality(String),
    occurred_at    DateTime64(3),
    received_at    DateTime64(3),
    user_id        UInt64,
    source         LowCardinality(String),
    properties     String,
    schema_version UInt16 DEFAULT 1
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event_name, occurred_at, user_id, event_id)
TTL toDateTime(occurred_at) + INTERVAL 2 YEAR;
```

- ファイル名は `<版番号>_<説明>.sql`。版番号は 1 からの連番（`clickhouse-migrations` は版番号を `UInt32` に入れるため、タイムスタンプ形式は使わない）
- 既存のローカル環境ではすでに `events` があるが、`IF NOT EXISTS` なので何もせずに履歴だけ記録される

### `views/users.sql` / `views/memos.sql`

`03-postgres-cdc-views.sh` が作っていた view と同じ名前・列・型にする。

```sql
CREATE OR REPLACE VIEW v_users AS
SELECT * EXCEPT (${CDC_META_COLUMNS}) REPLACE (toUInt64(id) AS id)
FROM ${CDC_DATABASE}.users FINAL
WHERE ${CDC_LIVE_FILTER}
```

```sql
CREATE OR REPLACE VIEW v_memos AS
SELECT * EXCEPT (${CDC_META_COLUMNS}) REPLACE (toUInt64(id) AS id)
FROM ${CDC_DATABASE}.memos FINAL
WHERE ${CDC_LIVE_FILTER}
```

- 1 ファイル 1 文。ファイル名（拡張子を除く）が CDC 対象のテーブル名と一致していること（検査する）
- 列を消したとき（ケース 5）は `EXCEPT (${CDC_META_COLUMNS}, <消した列>)` のように足す

### `package.json`

```json
{
  "name": "@repo/clickhouse-migration",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "lint": "eslint 'src/**/*.ts' 'test/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' 'test/**/*.ts' --fix",
    "migrate": "turbo run migrate:run --filter=@repo/clickhouse-migration",
    "migrate:run": "tsx src/index.ts",
    "test": "vitest run",
    "test:ci": "vitest run"
  },
  "dependencies": {
    "@clickhouse/client": "^1.14.0",
    "@repo/logger": "workspace:^",
    "clickhouse-migrations": "^1.5.0",
    "zod": "<apps と同じ版>"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:^",
    "@repo/typescript-config": "workspace:^",
    "@types/node": "^24.10.1",
    "eslint": "^9.39.1",
    "tsx": "<packages/db と同じ版>",
    "typescript": "^5.9.3",
    "vitest": "^4.1.5"
  }
}
```

- **人が使うのは `migrate`、コンテナが使うのは `migrate:run`。** `@repo/logger` は `dist/` を読むため、事前にビルドが要る。`migrate` は turbo 経由で依存パッケージをビルドしてから `migrate:run` を実行する。コンテナではイメージのビルド時にビルド済みなので `migrate:run` を直接起動する
- `turbo.json` に `migrate:run` タスク（`dependsOn: ["^build"]`、`cache: false`）を足す
- アプリではないのでビルド（`dist/`）は作らない。`tsx` で直接実行する（`packages/db` の `db:seed` と同じ）

### `src/env.ts`

各 app の `src/env.ts` と同じく Zod で検証し、不正なら `process.exit(1)` する。**既定値はローカルの docker compose で動く値にする**（`.env` を置かずに `migrate` だけで動くように）。

```ts
import { z } from "zod"

/**
 * ClickHouse の migration コマンドの環境変数スキーマ
 *
 * 既定値はローカルの docker compose（ClickHouse 8124 / Postgres はコンテナ内の postgres:5432）。
 * AWS では ECS のタスク定義が secret と environment で上書きする。
 */
const envSchema = z.object({
  /**
   * CDC の実装。view の定義に埋める値と、ローカルの CDC を作り直すかを決める。
   * none は CDC を張っていない環境（view を作らない）。
   */
  DATA_WAREHOUSE_CDC: z
    .enum(["materialized_postgresql", "clickpipes", "none"])
    .default("materialized_postgresql"),
  DATA_WAREHOUSE_DATABASE: z.string().default("project_template"),
  DATA_WAREHOUSE_PASSWORD: z.string().default("password"),
  DATA_WAREHOUSE_URL: z.string().url().default("http://localhost:8124"),
  DATA_WAREHOUSE_USER: z.string().default("default"),
  /**
   * ローカルの MaterializedPostgreSQL が接続する Postgres。
   * **ClickHouse のコンテナから見た**ホスト名なので、docker compose のサービス名になる。
   * DATA_WAREHOUSE_CDC が materialized_postgresql のときだけ使う。
   */
  LOCAL_CDC_POSTGRES_DATABASE: z.string().default("project-template_dev"),
  LOCAL_CDC_POSTGRES_HOST: z.string().default("postgres:5432"),
  LOCAL_CDC_POSTGRES_PASSWORD: z.string().default("password"),
  LOCAL_CDC_POSTGRES_USER: z.string().default("postgres"),
})
```

- `LOCAL_CDC_POSTGRES_DATABASE` の既定値は `docker-compose.yaml` の `POSTGRES_DB` と合わせる。docker-compose.yaml と同じく `TODO: プロジェクト名に変更` を付ける

### `src/cdc-view-variables.ts`

```ts
import type { CdcMode } from "./env"

/**
 * CDC の実装ごとに view の SQL へ埋める値。
 *
 * view の名前・列・型を環境間で揃え、定義だけを変えるためのもの。
 * none は view を作らないので持たない。
 */
export const CDC_VIEW_VARIABLES: Record<Exclude<CdcMode, "none">, Record<string, string>> = {
  clickpipes: {
    CDC_DATABASE: "pg_cdc",
    CDC_LIVE_FILTER: "_peerdb_is_deleted = 0",
    CDC_META_COLUMNS: "_peerdb_synced_at, _peerdb_is_deleted, _peerdb_version",
  },
  materialized_postgresql: {
    CDC_DATABASE: "pg_cdc",
    CDC_LIVE_FILTER: "_sign = 1",
    CDC_META_COLUMNS: "_sign, _version",
  },
}
```

### `src/definition-files.ts`

ファイルの読み込みと、DB に触る前の検査をまとめる。検査はすべて純粋関数にしてテストする。

| 関数 | 内容 |
| --- | --- |
| `readMigrationFileNames(dir)` | `*.sql` のファイル名一覧 |
| `findDuplicateMigrationVersions(fileNames)` | `<版番号>_` を数値で解釈し、重複している版番号を返す。`<版番号>_` の形でないファイルもエラーにする（`clickhouse-migrations` は NaN を弾くが、重複は検知しないため） |
| `readCdcTables(path)` | `cdc-tables.json` を読み、文字列の配列であることを Zod で検証する |
| `readViewDefinitions(dir)` | `{ table, sql }` の配列（`table` はファイル名から） |
| `verifyViewsMatchCdcTables(cdcTables, viewTables)` | 一覧にあって view が無いもの、view があって一覧に無いものを返す |

### `src/render-view-sql.ts`

```ts
/**
 * view の SQL の ${NAME} を置き換える。
 *
 * 未定義の変数はエラーにする（置き換え漏れのまま ClickHouse に送ると、
 * 構文エラーで止まるならまだしも、別の列名として解釈されうるため）。
 */
export const renderViewSql = (template: string, variables: Record<string, string>): string =>
  template.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const value = variables[name]
    if (value === undefined) throw new Error(`undefined variable in view sql: ${name}`)
    return value
  })
```

### `src/run-versioned-migrations.ts`

`clickhouse-migrations` の CLI を子プロセスで起動する。**ライブラリの関数は呼ばない**（エラー時に `process.exit(1)` するため）。

```ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"

/**
 * 未適用の migration を適用する。database が無ければ作る（ENGINE は指定しない）。
 */
export const runVersionedMigrations = async (params: {
  database: string
  migrationsDir: string
  password: string
  url: string
  username: string
}): Promise<void> => {
  await promisify(execFile)(CLI_PATH, ["migrate"], {
    env: {
      ...process.env,
      CH_MIGRATIONS_DB: params.database,
      CH_MIGRATIONS_HOME: params.migrationsDir,
      CH_MIGRATIONS_HOST: params.url,
      CH_MIGRATIONS_PASSWORD: params.password,
      CH_MIGRATIONS_TIMEOUT: "60000",
      CH_MIGRATIONS_USER: params.username,
    },
  })
}
```

- `CLI_PATH` はパッケージの `node_modules/.bin/clickhouse-migrations`。実装時に `clickhouse-migrations` の `package.json` の `bin` を確認して解決する
- CLI の stdout / stderr はそのまま流す（`stdio: "inherit"` 相当。`execFile` ではなく `spawn` にして終了コードを見る形でもよい）。終了コードが 0 以外なら throw する
- `CH_MIGRATIONS_SUBSTITUTE_ENV` は設定しない（版管理する migration は環境に依存させない）

### `src/rebuild-local-cdc.ts`

`DATA_WAREHOUSE_CDC=materialized_postgresql` のときだけ呼ぶ。

```ts
/**
 * ローカルの CDC（MaterializedPostgreSQL）を作り直し、全テーブルの取り込みを待つ。
 *
 * テーブル単位の DETACH PERMANENTLY → ATTACH では、ClickHouse 24.10 で
 * 付け直した後の変更が反映されなかったため、database ごと作り直す。
 * replication slot と publication も DROP DATABASE で一緒に消え、作り直される。
 */
export const rebuildLocalCdc = async (client: ClickHouseClient, params: {...}): Promise<void> => {
  await client.command({ query: "DROP DATABASE IF EXISTS pg_cdc SYNC" })
  await client.command({
    query: `CREATE DATABASE pg_cdc
      ENGINE = MaterializedPostgreSQL('${host}', '${database}', '${user}', '${password}')
      SETTINGS materialized_postgresql_tables_list = '${tables.join(",")}'`,
  })
  await waitForCdcTables(client, tables, { timeoutMs: 60_000 })
}
```

- `waitForCdcTables` は `EXISTS TABLE pg_cdc.<table>` を 1 秒ごとに確認する。タイムアウトしたら、現れなかったテーブル名と「Postgres にテーブルが無い。`pnpm --filter api db:migrate` を先に実行する」旨を含めて throw する
- 値は env 由来で、外部入力ではないが、`'` を含む値はエラーにして埋め込まない

### `src/apply-views.ts`

```ts
/**
 * CDC の view を全部作り直す（CREATE OR REPLACE VIEW）。
 *
 * view はデータを持たないため、作り直しても過去のデータは消えない。
 * 元テーブルが無い view は、clickpipes では警告して skip する
 * （CDC 対象に足した直後で、ClickPipe の初回の取り込みが終わっていない）。
 * materialized_postgresql では作り直しの後に待っているので、無ければエラーにする。
 */
export const applyViews = async (client, params: { cdcMode, views }): Promise<void> => { ... }
```

- 元テーブルの有無は `EXISTS TABLE pg_cdc.<table>` で確認する
- skip したテーブルは最後にまとめて警告として出す（`logger.warn`）。終了コードは 0

### `src/index.ts`

処理の順序だけを書く。各処理の開始と結果を `logger.info` で出す。

1. env の検証（`import { env } from "./env"`）
2. `findDuplicateMigrationVersions` / `verifyViewsMatchCdcTables` で検査。問題があれば DB に触る前に失敗する
3. `materialized_postgresql` なら `rebuildLocalCdc`
4. `runVersionedMigrations`
5. `none` 以外なら `applyViews`
6. ClickHouse の client を close して終了。どこかで throw されたら `logger.error` を出して `process.exitCode = 1`

ClickHouse の client は `@clickhouse/client` の `createClient({ url, username, password, database })` を `index.ts` で 1 回だけ作り、各処理に渡す。`rebuildLocalCdc` は `pg_cdc` を、`applyViews` は `DATA_WAREHOUSE_DATABASE` を対象にするので、client の既定 database は `DATA_WAREHOUSE_DATABASE` にして `pg_cdc` は修飾して書く。ただし `DATA_WAREHOUSE_DATABASE` は手順 4 で初めて作られるため、手順 3 では database を指定しない client を使う（`rebuildLocalCdc` 用に別の client を作るか、手順 4 の後に既定 database 付きの client を作る）。

### migration イメージ（`packages/db/Dockerfile.migration`）

Drizzle と同じイメージに同梱する（ECR リポジトリを増やさないため）。`CMD` は Drizzle のまま変えず、ClickHouse はタスク定義の `command` で起動する（step2）。

- pruner: `turbo prune @repo/db @repo/clickhouse-migration --docker`
- runner: install の後に `pnpm turbo run build --filter=@repo/clickhouse-migration^...`（`@repo/logger` のビルド）
- `infra/clickhouse/cdc-tables.json` を `/app/infra/clickhouse/` に COPY する（`turbo prune` は workspace 外のファイルを含めないため）
- 先頭のコメントを「migration 専用イメージ（Drizzle / ClickHouse）」に更新する。ClickHouse の起動コマンドは `pnpm --filter @repo/clickhouse-migration migrate:run`

### `docker-compose.yaml`

- ClickHouse の `./infra/clickhouse/init:/docker-entrypoint-initdb.d` の mount を消す
- `depends_on: postgres`（init スクリプトが Postgres に繋ぐための待ち合わせ）のコメントを「migration コマンドが作る MaterializedPostgreSQL が Postgres に繋ぐ」旨に直す（依存自体は残してよい）

### ドキュメント

| ファイル | 変更 |
| --- | --- |
| `packages/clickhouse-migration/README.md`（新設） | 4 種類の置き場所、コマンド、変更のケースごとの作業（設計書の表へのリンクでよい）、版番号の規則、`cdc-tables.json` の書き方 |
| ルートの `README.md` | セットアップ手順 5 を `pnpm --filter @repo/clickhouse-migration migrate` に置き換える。パッケージ一覧に `packages/clickhouse-migration` を足す |
| `CLAUDE.md`（ルート） | Packages の一覧に `packages/clickhouse-migration` を足す |
| `docs/setup/api.md` | ClickHouse の初期化に触れていれば同様に置き換える |
| `packages/db/README.md` | DB の作り直し手順の 4（CDC を張り直す）を migration コマンドに置き換える。1 の `DROP DATABASE pg_cdc` は残す（Postgres の DB を消すには replication slot を先に外す必要がある） |
| `packages/data-warehouse/README.md` | 「業務データ（Postgres からの CDC）」の手順、`infra/clickhouse/init/` へのリンクを migration コマンドに置き換える |
| `docs/spec/user-behavior-events/tasks/step1-infra-clickhouse.md` | 実装済みの step なので書き換えない |

## 動作確認

### ユニットテスト

`pnpm --filter @repo/clickhouse-migration test`

- `findDuplicateMigrationVersions`: `1_a.sql` と `001_b.sql` を重複として返す / `a.sql`・`0_a.sql` をエラーにする / 連番なら空
- `verifyViewsMatchCdcTables`: 過不足の両方向を返す
- `renderViewSql`: 全変数を置き換える / 未定義の変数で throw する / `$` を含まない SQL はそのまま

### ローカル（既存の環境）

既存の volume（init スクリプトで作られた `events` と view がある状態）で:

```bash
docker compose up -d
pnpm --filter api db:migrate
pnpm --filter @repo/clickhouse-migration migrate
```

- 成功し、`SELECT * FROM project_template._migrations` に `1_create_events.sql` が 1 行ある
- `SHOW CREATE VIEW project_template.v_users` の WHERE が `_sign = 1` になっている
- 2 回続けて実行しても成功し、`_migrations` は 1 行のまま

### ローカル（空の環境）

```bash
docker compose down -v && docker compose up -d
pnpm --filter api db:migrate && pnpm --filter api db:seed
pnpm --filter @repo/clickhouse-migration migrate
```

- `events` / `v_users` / `v_memos` ができ、`SELECT count() FROM project_template.v_users` が seed の件数になる
- Postgres で users に 1 行足すと、数秒後に `v_users` の件数が増える

### 変更のケース（ローカル）

- **列の追加**: Postgres で `ALTER TABLE users ADD COLUMN ...` → migrate → `v_users` に新しい列が出て、その後の INSERT も反映される（作り直しでテーブルの同期が戻っていること）
- **CDC 対象の追加**: Postgres にテーブルを作り、`cdc-tables.json` と `views/<table>.sql` を足して migrate → view ができる
- **一覧と view のずれ**: `cdc-tables.json` だけに足して migrate → DB に触る前にエラーで止まる
- **Postgres にテーブルが無い**: `cdc-tables.json` と view に存在しないテーブルを足して migrate → 60 秒で「`db:migrate` を先に」のエラー
- **版番号の重複**: `1_x.sql` を足して migrate → DB に触る前にエラー
- **適用済みファイルの変更**: `1_create_events.sql` を書き換えて migrate → `clickhouse-migrations` がチェックサムの不一致で止まる（確認後に戻す）

### migration イメージ

```bash
docker build -f packages/db/Dockerfile.migration -t migration-local .
docker run --rm --network <compose のネットワーク> \
  -e DATA_WAREHOUSE_URL=http://clickhouse:8123 \
  migration-local pnpm --filter @repo/clickhouse-migration migrate:run
```

- ローカルと同じ結果になる（`LOCAL_CDC_POSTGRES_HOST` の既定値 `postgres:5432` はコンテナ内からも同じ）
- 引数なしで起動すると今までどおり Drizzle の migrate が動く

### lint

`pnpm lint:fix` → `pnpm lint` がエラーなし。
