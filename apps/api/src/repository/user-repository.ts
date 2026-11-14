import { AuthProvider, User } from "@repo/domain"

import type { TransactionContext } from "./transaction"

/**
 * ユーザー作成時の入力
 */
export type CreateUserInput = {
  avatarUrl?: string
  email?: string
  name?: string
}

/**
 * ユーザー検索の条件。query は name / email の部分一致（大文字小文字を区別しない）。
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

/**
 * 検索結果の 1 行。ユーザーが紐付けているログイン方法を持つ
 */
export type UserWithProviders = User & {
  providers: AuthProvider[]
}

export type SearchUsersResult = {
  totalCount: number
  users: UserWithProviders[]
}

/**
 * ユーザーリポジトリのインターフェース
 */
export interface UserRepository {
  create(data: CreateUserInput, tx?: TransactionContext): Promise<User>
  findByEmail(email: string): Promise<User | null>
  findById(id: number): Promise<User | null>
  search(input: SearchUsersInput): Promise<SearchUsersResult>
}
