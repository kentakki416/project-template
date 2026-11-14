import { AuthProvider, User } from "@repo/domain"

import type { TransactionContext } from "./transaction"

export type CreateUserInput = {
  avatarUrl?: string
  email?: string
  name?: string
}

/**
 * query は name / email の部分一致（大文字小文字を区別しない）。
 * createdFrom は以上、createdBefore は未満
 */
export type SearchUsersInput = {
  createdBefore?: Date
  createdFrom?: Date
  limit: number
  offset: number
  provider?: AuthProvider
  query?: string
}

export type UserWithProviders = User & {
  providers: AuthProvider[]
}

export type SearchUsersResult = {
  totalCount: number
  users: UserWithProviders[]
}

export interface UserRepository {
  create(data: CreateUserInput, tx?: TransactionContext): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: number): Promise<User | null>
  search(input: SearchUsersInput): Promise<SearchUsersResult>
}
