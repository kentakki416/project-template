# step1-infra-clickhouse

ClickHouse をローカル環境に追加し、`events` テーブルと接続用パッケージ `@repo/clickhouse` を用意する。

## 対応内容

### docker-compose に ClickHouse を追加

既存の postgres / redis と同じく **既定ポートをずらす**（他プロジェクトとの衝突を避けるため）。

```yaml
  clickhouse:
    image: clickhouse/clickhouse-server:24-alpine
    environment:
      CLICKHOUSE_DB: project_template
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: password
      # 開発用。本番は IAM / ネットワーク側で絞る
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    ports:
      # 既定 8123 / 9000 をそのまま使うと他プロジェクトと衝突しうるためずらす
      - '${CLICKHOUSE_HTTP_PORT:-8124}:8123'
      - '${CLICKHOUSE_NATIVE_PORT:-9002}:9000'
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - ./infra/clickhouse/init:/docker-entrypoint-initdb.d
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'localhost:8123/ping']
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - app-network
```

`volumes:` セクションに `clickhouse-data:` を追加する。

### テーブル定義

`infra/clickhouse/init/01-events.sql` を作成する。`/docker-entrypoint-initdb.d` に置くと初回起動時に実行される。

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
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (event_name, occurred_at, user_id)
TTL toDateTime(occurred_at) + INTERVAL 2 YEAR;
```

`ORDER BY` は「特定イベントを期間で絞る」という最頻クエリに合わせている。`properties` は JSON 文字列で持ち、多用する値が固まった時点で MATERIALIZED カラムに昇格させる。

### packages/clickhouse

`@repo/db` / `@repo/redis` と同じく **factory のみ export** する。app 側で `new` させない。

```typescript
/** packages/clickhouse/src/client.ts */
import { createClient, type ClickHouseClient } from "@clickhouse/client"

const DEFAULT_URL = "http://localhost:8124"

export type CreateClickHouseClientOptions = {
  /** 接続 URL。省略時は process.env.CLICKHOUSE_URL */
  url?: string
}

/**
 * ClickHouse クライアントの factory
 *
 * 各 app の src/index.ts で 1 回呼び、EventTracker に DI する。
 * async_insert を有効にしているのは、小さな INSERT を大量に受けると
 * ClickHouse のマージ負荷で劣化するため。サーバー側でバッファリングさせる。
 */
export const createClickHouseClient = (
  options: CreateClickHouseClientOptions = {},
): ClickHouseClient =>
  createClient({
    clickhouse_settings: {
      async_insert: 1,
      /** 書き込みの確定を待たない（行動イベントは欠落を許容する） */
      wait_for_async_insert: 0,
    },
    database: process.env.CLICKHOUSE_DB ?? "project_template",
    password: process.env.CLICKHOUSE_PASSWORD ?? "password",
    url: options.url ?? process.env.CLICKHOUSE_URL ?? DEFAULT_URL,
    username: process.env.CLICKHOUSE_USER ?? "default",
  })
```

`package.json` は `@repo/redis` を雛形にする（`main` / `types` / `sideEffects: false` / `build` は `tsc`）。

### 依存の追加

- `packages/clickhouse` に `@clickhouse/client`
- ルート `docker-compose.yaml` の変更に伴い `docs/setup/api.md` の接続先表に ClickHouse を追記

## 動作確認

```bash
docker compose up -d clickhouse

# 起動確認
curl -s http://localhost:8124/ping   # → Ok.

# テーブルが作られているか
docker exec project-template-clickhouse \
  clickhouse-client -q "SHOW CREATE TABLE project_template.events"

# factory から接続できるか
pnpm --filter @repo/clickhouse build
node -e '
const { createClickHouseClient } = require("./packages/clickhouse/dist/index.js")
createClickHouseClient().query({ query: "SELECT 1", format: "JSONEachRow" })
  .then(r => r.json()).then(console.log)
'
```

- [ ] `curl http://localhost:8124/ping` が `Ok.` を返す
- [ ] `events` テーブルが作成されている
- [ ] factory 経由で `SELECT 1` が実行できる
- [ ] 既存の `docker compose up -d` が postgres / redis ともども問題なく起動する
