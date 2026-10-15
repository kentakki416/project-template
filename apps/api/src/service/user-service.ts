import { AuthAccount, AuthProvider, User } from "@repo/domain"
import { err, notFoundError, ok, Result } from "@repo/errors"
import { logger } from "@repo/logger"

import { AuthAccountRepository, SearchUsersResult, UserRepository } from "../repository"

/**
 * ユーザーIDからユーザー情報を取得
 */
export const getUserById = async (
  userId: number,
  repo: { userRepository: UserRepository }
): Promise<Result<User>> => {
  logger.debug("UserService: Fetching user by ID", {
    userId,
  })
  const user = await repo.userRepository.findById(userId)
  if (!user) {
    logger.debug("UserService: User not found", {
      userId,
    })
    return err(notFoundError("User not found"))
  }
  logger.debug("UserService: User found", {
    userId: user.id,
  })
  return ok(user)
}

/**
 * ユーザーを検索する（admin のユーザー一覧）。page は 1 始まり。
 * 全件数を超えたページを指定されたら、users は空で totalCount はそのまま返す（エラーにしない）
 */
export const searchUsers = async (
  input: {
    createdBefore?: Date
    createdFrom?: Date
    page: number
    perPage: number
    provider?: AuthProvider
    query?: string
  },
  repo: { userRepository: UserRepository }
): Promise<Result<SearchUsersResult>> => {
  const result = await repo.userRepository.search({
    createdBefore: input.createdBefore,
    createdFrom: input.createdFrom,
    limit: input.perPage,
    offset: (input.page - 1) * input.perPage,
    provider: input.provider,
    /**
     * 空の検索語は条件にしない
     */
    query: input.query || undefined,
  })
  return ok(result)
}

/**
 * ユーザーの詳細を、紐付けているログイン方法と合わせて取得する（admin のユーザー詳細）。無ければ 404
 */
export const getUserDetail = async (
  userId: number,
  repo: { authAccountRepository: AuthAccountRepository; userRepository: UserRepository }
): Promise<Result<{ authAccounts: AuthAccount[]; user: User }>> => {
  const user = await repo.userRepository.findById(userId)
  if (!user) {
    logger.debug("UserService: User not found", { userId })
    return err(notFoundError("User not found"))
  }
  const authAccounts = await repo.authAccountRepository.findByUserId(userId)
  return ok({ authAccounts, user })
}
