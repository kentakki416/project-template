import { ClickHouseDataWarehouse, type ClickHouseConfig } from "./clickhouse-data-warehouse"
import type { DataWarehouse } from "./data-warehouse"

export type DataWarehouseConfig = ClickHouseConfig & {
  type: "clickhouse"
}

/**
 * DataWarehouse の factory
 *
 * 各 app の src/index.ts で 1 回呼び、Repository に DI する。
 * 別バックエンドを足すときは type を追加して分岐を 1 つ増やす。
 */
export const createDataWarehouse = (config: DataWarehouseConfig): DataWarehouse => {
  switch (config.type) {
  case "clickhouse":
    return new ClickHouseDataWarehouse(config)
  }
}
