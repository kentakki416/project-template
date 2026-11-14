import { AuthAccount, AuthAccountWithUser, AuthProvider } from "@repo/domain"

import type { TransactionContext } from "./transaction"

export type CreateAuthAccountInput = {
  provider: AuthProvider
  providerAccountId: string
  userId: number
}

export interface AuthAccountRepository {
  create(data: CreateAuthAccountInput, tx?: TransactionContext): Promise<AuthAccount>
  findByProvider(
    provider: AuthProvider,
    providerAccountId: string
  ): Promise<AuthAccountWithUser | null>
  findByUserId(userId: number): Promise<AuthAccount[]>
}
