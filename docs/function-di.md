## ディレクトリ構成
```bash

src/
├─ domain/
│  ├─ types.ts
│
├─ services/
│  ├─ grantItem.ts              # ユースケース（入口）
│  ├─ itemGrantRegistry.ts      # DI用レジストリ型
│  ├─ handlers/
│  │  ├─ grantGold.ts
│  │  ├─ grantClothes.ts
│  │  └─ grantFurniture.ts
│
├─ composition/
│  ├─ productionRegistry.ts     # 本番DI
│  └─ testRegistry.ts           # テストDI
│
└─ index.ts
```

## domain/types.ts

ユースケースに必要な型だけを定義

```ts
export type ItemType =
  | "GOLD"
  | "CLOTHES"
  | "FURNITURE"

export type GrantReason =
  | "GACHA"
  | "QUEST"
  | "ADMIN"

export interface GrantItemCommand {
  userId: string
  itemType: ItemType
  itemId?: string
  amount: number
  reason: GrantReason
  traceId: string
}

export interface GrantedItem {
  itemType: ItemType
  itemId?: string
  amount: number
}

export interface GrantItemResult {
  userId: string
  grantedItems: GrantedItem[]
}
```

## services/itemGrantRegistry.ts

関数DIの中核（Strategy定義）

```ts
import { GrantItemCommand, GrantedItem, ItemType } from "../domain/types"

export type ItemGrantHandler = (
  command: GrantItemCommand
) => Promise<GrantedItem[]>

export type ItemGrantRegistry = Record<ItemType, ItemGrantHandler>
```

## services/handlers/grantGold.ts

ゴールド付与の責務だけを持つ

```ts
import { ItemGrantHandler } from "../itemGrantRegistry"

export const grantGold: ItemGrantHandler = async (cmd) => {
  // walletRepository.addGold(cmd.userId, cmd.amount)
  // goldHistoryRepository.save(...)

  return [
    {
      itemType: "GOLD",
      amount: cmd.amount,
    },
  ]
}
```
## services/handlers/grantClothes.ts
```ts
import { ItemGrantHandler } from "../itemGrantRegistry"

export const grantClothes: ItemGrantHandler = async (cmd) => {
  if (!cmd.itemId) {
    throw new Error("CLOTHES requires itemId")
  }

  // inventoryRepository.addClothes(cmd.userId, cmd.itemId)
  // circulationRepository.increment(cmd.itemId)

  return [
    {
      itemType: "CLOTHES",
      itemId: cmd.itemId,
      amount: 1,
    },
  ]
}
```

## services/handlers/grantFurniture.ts
```ts
import { ItemGrantHandler } from "../itemGrantRegistry"

export const grantFurniture: ItemGrantHandler = async (cmd) => {
  if (!cmd.itemId) {
    throw new Error("FURNITURE requires itemId")
  }

  // furnitureRepository.add(cmd.userId, cmd.itemId, cmd.amount)

  return [
    {
      itemType: "FURNITURE",
      itemId: cmd.itemId,
      amount: cmd.amount,
    },
  ]
}
```

## services/grantItem.ts

ユースケース（分岐しない・依存しない）
```ts
import {
  GrantItemCommand,
  GrantItemResult,
} from "../domain/types"
import { ItemGrantRegistry } from "./itemGrantRegistry"

export async function grantItem(
  command: GrantItemCommand,
  registry: ItemGrantRegistry
): Promise<GrantItemResult> {
  const handler = registry[command.itemType]

  if (!handler) {
    throw new Error(`Unsupported item type: ${command.itemType}`)
  }

  const grantedItems = await handler(command)

  return {
    userId: command.userId,
    grantedItems,
  }
}
```
## composition/productionRegistry.ts

本番用DI（依存の組み立て）
```ts
import { ItemGrantRegistry } from "../services/itemGrantRegistry"
import { grantGold } from "../services/handlers/grantGold"
import { grantClothes } from "../services/handlers/grantClothes"
import { grantFurniture } from "../services/handlers/grantFurniture"

export const productionRegistry: ItemGrantRegistry = {
  GOLD: grantGold,
  CLOTHES: grantClothes,
  FURNITURE: grantFurniture,
}

composition/testRegistry.ts

テスト用DI（完全差し替え）

import { ItemGrantRegistry } from "../services/itemGrantRegistry"

export const testRegistry: ItemGrantRegistry = {
  GOLD: async () => [
    { itemType: "GOLD", amount: 999 },
  ],
  CLOTHES: async () => [],
  FURNITURE: async () => [],
}
```
## index.ts

利用例
```ts
import { grantItem } from "./services/grantItem"
import { productionRegistry } from "./composition/productionRegistry"

await grantItem(
  {
    userId: "user-1",
    itemType: "GOLD",
    amount: 100,
    reason: "QUEST",
    traceId: "trace-001",
  },
  productionRegistry
)
```
## このコードベースが示していること（※コメント不要）

grantItem は 何も知らない

処理分岐は registry に閉じ込められている

switch は存在しない

依存は 呼び出し時に注入

テスト・本番で 完全差し替え可能

クラス・DIコンテナ不要