## ディレクトリ構成
```bash

apps/api/src/
├─ types/domain/
│  ├─ item.ts                   # アイテム関連のドメイン型
│
├─ service/
│  ├─ grant-item-service.ts     # ユースケース(入口)
│  ├─ item-grant-registry.ts    # DI用レジストリ型
│  ├─ handlers/
│  │  ├─ grant-gold.ts
│  │  ├─ grant-clothes.ts
│  │  └─ grant-furniture.ts
│
├─ di/
│  ├─ production-registry.ts    # 本番DI
│  └─ test-registry.ts          # テストDI
│
└─ controller/
   └─ item-controller.ts         # 利用例
```

## types/domain/item.ts

ユースケースに必要な型だけを定義

```ts
export type ItemType =
  | 'GOLD'
  | 'CLOTHES'
  | 'FURNITURE'

export type GrantReason =
  | 'GACHA'
  | 'QUEST'
  | 'ADMIN'

export interface GrantItemCommand {
  amount: number
  itemId?: string
  itemType: ItemType
  reason: GrantReason
  traceId: string
  userId: string
}

export interface GrantedItem {
  amount: number
  itemId?: string
  itemType: ItemType
}

export interface GrantItemResult {
  grantedItems: GrantedItem[]
  userId: string
}
```

## service/item-grant-registry.ts

関数DIの中核(Strategy定義)

```ts
import { GrantItemCommand, GrantedItem, ItemType } from '../types/domain/item'

export type ItemGrantHandler = (
  command: GrantItemCommand
) => Promise<GrantedItem[]>

export type ItemGrantRegistry = Record<ItemType, ItemGrantHandler>
```

## service/handlers/grant-gold.ts

ゴールド付与の責務だけを持つ

```ts
import { ItemGrantHandler } from '../item-grant-registry'

export const grantGold: ItemGrantHandler = async (cmd) => {
  // walletRepository.addGold(cmd.userId, cmd.amount)
  // goldHistoryRepository.save(...)

  return [
    {
      amount: cmd.amount,
      itemType: 'GOLD',
    },
  ]
}
```
## service/handlers/grant-clothes.ts
```ts
import { ItemGrantHandler } from '../item-grant-registry'

export const grantClothes: ItemGrantHandler = async (cmd) => {
  if (!cmd.itemId) {
    throw new Error('CLOTHES requires itemId')
  }

  // inventoryRepository.addClothes(cmd.userId, cmd.itemId)
  // circulationRepository.increment(cmd.itemId)

  return [
    {
      amount: 1,
      itemId: cmd.itemId,
      itemType: 'CLOTHES',
    },
  ]
}
```

## service/handlers/grant-furniture.ts
```ts
import { ItemGrantHandler } from '../item-grant-registry'

export const grantFurniture: ItemGrantHandler = async (cmd) => {
  if (!cmd.itemId) {
    throw new Error('FURNITURE requires itemId')
  }

  // furnitureRepository.add(cmd.userId, cmd.itemId, cmd.amount)

  return [
    {
      amount: cmd.amount,
      itemId: cmd.itemId,
      itemType: 'FURNITURE',
    },
  ]
}
```

## service/grant-item-service.ts

ユースケース(分岐しない・依存しない)
```ts
import {
  GrantItemCommand,
  GrantItemResult,
} from '../types/domain/item'
import { ItemGrantRegistry } from './item-grant-registry'

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
    grantedItems,
    userId: command.userId,
  }
}
```
## di/production-registry.ts

本番用DI(依存の組み立て)
```ts
import { ItemGrantRegistry } from '../service/item-grant-registry'
import { grantGold } from '../service/handlers/grant-gold'
import { grantClothes } from '../service/handlers/grant-clothes'
import { grantFurniture } from '../service/handlers/grant-furniture'

export const productionRegistry: ItemGrantRegistry = {
  CLOTHES: grantClothes,
  FURNITURE: grantFurniture,
  GOLD: grantGold,
}
```

## di/test-registry.ts

テスト用DI(完全差し替え)

```ts
import { ItemGrantRegistry } from '../service/item-grant-registry'

export const testRegistry: ItemGrantRegistry = {
  CLOTHES: async () => [],
  FURNITURE: async () => [],
  GOLD: async () => [
    { amount: 999, itemType: 'GOLD' },
  ],
}
```

## controller/item-controller.ts

利用例
```ts
import { grantItem } from '../service/grant-item-service'
import { productionRegistry } from '../di/production-registry'

await grantItem(
  {
    amount: 100,
    itemType: 'GOLD',
    reason: 'QUEST',
    traceId: 'trace-001',
    userId: 'user-1',
  },
  productionRegistry
)
```

## 既存実装との対応関係

このプロジェクトでは、`apps/api/src/service/auth-service.ts` で既に関数DIパターンが使われています:

```ts
// service/auth-service.ts の例
export const authenticateWithGoogle = async (
    code: string,
    repository: {
        authAccountRepository: AuthAccountRepository
        userRegistrationRepository: UserRegistrationRepository
    },
    googleAuthClient: GoogleOAuthClient
): Promise<AuthenticateWithGoogleResult> => {
    // リポジトリとクライアントは引数として注入される
    // ...実装...
}
```

## このコードベースが示していること

- `grantItem` は 何も知らない
- 処理分岐は `registry` に閉じ込められている
- `switch` は存在しない
- 依存は 呼び出し時に注入
- テスト・本番で 完全差し替え可能
- クラス・DIコンテナ不要
