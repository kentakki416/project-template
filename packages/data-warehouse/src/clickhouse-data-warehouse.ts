import { createClient, type ClickHouseClient } from "@clickhouse/client"

import type { DataWarehouse } from "./data-warehouse"

export type ClickHouseConfig = {
  database: string
  password: string
  url: string
  username: string
}

/**
 * ClickHouse 実装
 */
export class ClickHouseDataWarehouse implements DataWarehouse {
  private readonly _client: ClickHouseClient

  constructor(config: ClickHouseConfig) {
    this._client = createClient({
      clickhouse_settings: {
        /**
         * 呼び出し側が queue から取り出した分をまとめて INSERT するため、
         * ここでのバッファリングは補助的。**確定は待つ**。
         * 待たないと呼び出し側が成功扱いで処理を完了し、
         * ClickHouse 側で失敗してもリトライが効かなくなる。
         */
        async_insert: 1,
        wait_for_async_insert: 1,
      },
      database: config.database,
      password: config.password,
      url: config.url,
      username: config.username,
    })
  }

  public async insertAll(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return
    await this._client.insert({ format: "JSONEachRow", table, values: rows })
  }

  public async close(): Promise<void> {
    await this._client.close()
  }
}
