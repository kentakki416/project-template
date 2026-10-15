import { AuthAccount, AuthAccountWithUser, AuthProvider } from "@repo/domain"

import type { TransactionContext } from "./transaction"

/**
 * 認証アカウント作成時の入力
 *
 * provider は @repo/domain の AUTH_PROVIDERS のどれか（DB の CHECK 制約も同じ値の集合）。
 * OAuth トークン系は本アプリでは保持しないため input に含めない。
 */
export type CreateAuthAccountInput = {
  provider: AuthProvider
  providerAccountId: string
  userId: number
}

/**
 * 認証アカウントリポジトリのインターフェース
 */
export interface AuthAccountRepository {
  create(data: CreateAuthAccountInput, tx?: TransactionContext): Promise<AuthAccount>
  findByProvider(
    provider: AuthProvider,
    providerAccountId: string
  ): Promise<AuthAccountWithUser | null>
  findByUserId(userId: number): Promise<AuthAccount[]>
}
