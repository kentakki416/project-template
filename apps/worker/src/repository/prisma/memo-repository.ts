import type { Memo as PrismaMemo, PrismaClient } from "@repo/db"
import type { Memo } from "@repo/domain"

/**
 * worker 側で必要な memo 操作の interface。
 *
 * apps/api / apps/cron の MemoRepository とは意図的に分離している。
 * 各 app は必要な操作のみを持つ独自 interface を定義する方針。
 *
 * 戻り値は Prisma の型ではなく `@repo/domain` の domain 型にする。
 * Prisma の型を契約に出すと jobs 配下の業務ロジックが永続化モデルに型付けされてしまうため。
 */
export interface MemoRepository {
  findById(id: number): Promise<Memo | null>
}

/**
 * Prisma 実装の MemoRepository
 */
export class PrismaMemoRepository implements MemoRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async findById(id: number): Promise<Memo | null> {
    const memo = await this._prisma.memo.findUnique({ where: { id } })
    if (!memo) return null
    return this._toDomainMemo(memo)
  }

  /**
   * Prisma の型 → ドメインの型に変換
   */
  private _toDomainMemo(prismaMemo: PrismaMemo): Memo {
    return {
      id: prismaMemo.id,
      body: prismaMemo.body,
      title: prismaMemo.title,
      createdAt: prismaMemo.createdAt,
      updatedAt: prismaMemo.updatedAt,
    }
  }
}
