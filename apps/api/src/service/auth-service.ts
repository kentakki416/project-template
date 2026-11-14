import { User } from "@repo/domain"
import { err, notFoundError, ok, Result, unauthorizedError } from "@repo/errors"
import { logger } from "@repo/logger"

import { type IGoogleOAuthClient, GoogleUserInfo } from "../client/google-oauth"
import {
  AuthAccountRepository,
  RefreshTokenRepository,
  type TransactionRunner,
  UserRepository,
} from "../repository"

export type AuthenticateWithGoogleSuccess = {
  accessToken: string
  isNewUser: boolean
  refreshToken: string
  user: User
}

type Repositories = {
  authAccountRepository: AuthAccountRepository
  refreshTokenRepository: RefreshTokenRepository
  transactionRunner: TransactionRunner
  userRepository: UserRepository
}

export type TokenGenerators = {
  generateAccessToken: (userId: number) => string
  generateRefreshToken: (userId: number) => { jti: string; token: string }
}

export const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7

export const authenticateWithGoogle = async (
  input: { code: string; redirectUri: string },
  repo: Repositories,
  googleAuthClient: IGoogleOAuthClient,
  tokenGenerators: TokenGenerators
): Promise<Result<AuthenticateWithGoogleSuccess>> => {
  logger.info("AuthService: Starting Google authentication")

  const googleUser: GoogleUserInfo = await googleAuthClient.getUserInfo(input.code, input.redirectUri)
  /**
   * email (PII) はログに残さず、突合に必要な googleId のみ出力する。
   */
  logger.debug("AuthService: Retrieved Google user info", {
    googleId: googleUser.id,
  })

  const existingAccount = await repo.authAccountRepository.findByProvider("google", googleUser.id)

  let user: User
  let isNewUser = false

  if (existingAccount) {
    logger.info("AuthService: Existing user found", { userId: existingAccount.user.id })
    user = existingAccount.user
  } else {
    isNewUser = true
    logger.info("AuthService: Creating new user")
    /**
     * User と AuthAccount を 1 トランザクションで作成。どちらか片方だけが残る不整合を防ぐ。
     */
    user = await repo.transactionRunner.run(async (tx) => {
      const newUser = await repo.userRepository.create(
        {
          avatarUrl: googleUser.picture,
          email: googleUser.email,
          name: googleUser.name,
        },
        tx,
      )
      await repo.authAccountRepository.create(
        {
          provider: "google",
          providerAccountId: googleUser.id,
          userId: newUser.id,
        },
        tx,
      )
      return newUser
    })
    logger.info("AuthService: New user created", { userId: user.id })
  }

  const accessToken = tokenGenerators.generateAccessToken(user.id)
  const { jti, token: refreshToken } = tokenGenerators.generateRefreshToken(user.id)
  await repo.refreshTokenRepository.save(jti, user.id, REFRESH_TTL_SECONDS)

  logger.debug("AuthService: Tokens issued", { userId: user.id })

  return ok({
    accessToken,
    isNewUser,
    refreshToken,
    user,
  })
}

export type LoginAsDevUserSuccess = {
  accessToken: string
  refreshToken: string
  user: User
}

export const loginAsDevUser = async (
  input: { email: string },
  repo: {
    refreshTokenRepository: RefreshTokenRepository
    userRepository: UserRepository
  },
  tokenGenerators: TokenGenerators
): Promise<Result<LoginAsDevUserSuccess>> => {
  /**
   * dev-login は dev 専用（seed 済みテストユーザー）だが、email を既定の info
   * レベルには残さず debug に下げる。
   */
  logger.debug("AuthService: dev-login attempt", { email: input.email })

  const user = await repo.userRepository.findByEmail(input.email)
  if (!user) {
    return err(notFoundError("Dev user not found"))
  }

  const accessToken = tokenGenerators.generateAccessToken(user.id)
  const { jti, token: refreshToken } = tokenGenerators.generateRefreshToken(user.id)
  await repo.refreshTokenRepository.save(jti, user.id, REFRESH_TTL_SECONDS)

  logger.info("AuthService: dev-login success", { userId: user.id })

  return ok({ accessToken, refreshToken, user })
}

export type RefreshTokensSuccess = {
  accessToken: string
  refreshToken: string
}

export type RefreshVerifier = (token: string) => { jti: string; userId: number } | null

export const refreshTokens = async (
  input: { refreshToken: string },
  repo: { refreshTokenRepository: RefreshTokenRepository },
  verifier: RefreshVerifier,
  generators: TokenGenerators
): Promise<Result<RefreshTokensSuccess>> => {
  logger.info("AuthService: Starting refresh token rotation")

  const payload = verifier(input.refreshToken)
  if (!payload) {
    return err(unauthorizedError("Invalid refresh token"))
  }

  const userId = await repo.refreshTokenRepository.findUserId(payload.jti)
  if (userId === null || userId !== payload.userId) {
    return err(unauthorizedError("Refresh token has been revoked"))
  }

  await repo.refreshTokenRepository.delete(payload.jti)

  const accessToken = generators.generateAccessToken(userId)
  const { jti, token: refreshToken } = generators.generateRefreshToken(userId)
  await repo.refreshTokenRepository.save(jti, userId, REFRESH_TTL_SECONDS)

  logger.debug("AuthService: Tokens rotated", { userId })

  return ok({ accessToken, refreshToken })
}

export const logout = async (
  input: { refreshToken: string },
  repo: { refreshTokenRepository: RefreshTokenRepository },
  verifier: RefreshVerifier
): Promise<Result<{ ok: true }>> => {
  logger.info("AuthService: Logout")

  const payload = verifier(input.refreshToken)
  /**
   * 何度呼ばれても同じ結果になるように、Refresh Token の検証に失敗してもエラーにしない
   */
  if (!payload) {
    return ok({ ok: true })
  }
  await repo.refreshTokenRepository.delete(payload.jti)
  return ok({ ok: true })
}
