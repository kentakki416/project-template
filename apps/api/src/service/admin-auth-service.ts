import { Admin, normalizeEmail } from "@repo/domain"
import { err, forbiddenError, notFoundError, ok, Result, unauthorizedError } from "@repo/errors"
import { logger } from "@repo/logger"

import { type IGoogleOAuthClient } from "../client/google-oauth"
import { AdminRepository, RefreshTokenRepository } from "../repository"

import {
  REFRESH_TTL_SECONDS,
  refreshTokens,
  type RefreshTokensSuccess,
  type RefreshVerifier,
  type TokenGenerators,
} from "./auth-service"

export type AuthenticateAdminSuccess = {
  accessToken: string
  admin: Admin
  refreshToken: string
}

/**
 * dev-login でサインインできる admin の email のドメイン（seed の admin@dev.local）
 */
const DEV_ADMIN_EMAIL_DOMAIN = "@dev.local"

type Repositories = {
  adminRepository: AdminRepository
  refreshTokenRepository: RefreshTokenRepository
}

/**
 * admin の Access/Refresh Token を発行し、refresh の jti を保存する
 */
const issueAdminTokens = async (
  adminId: number,
  repo: { refreshTokenRepository: RefreshTokenRepository },
  tokenGenerators: TokenGenerators,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = tokenGenerators.generateAccessToken(adminId)
  const { jti, token: refreshToken } = tokenGenerators.generateRefreshToken(adminId)
  await repo.refreshTokenRepository.save(jti, adminId, REFRESH_TTL_SECONDS)
  return { accessToken, refreshToken }
}

/**
 * admin の Google 認証
 *
 * Google で確認済みの email が admins に登録されていればトークンを発行する。
 * 未確認・未登録は 403。admins の行はここでは作らない（事前登録制。admin:create コマンドで作る）
 */
export const authenticateAdminWithGoogle = async (
  input: { code: string; redirectUri: string },
  repo: Repositories,
  googleAuthClient: IGoogleOAuthClient,
  tokenGenerators: TokenGenerators,
): Promise<Result<AuthenticateAdminSuccess>> => {
  logger.info("AdminAuthService: Starting Google authentication")

  const googleUser = await googleAuthClient.getUserInfo(input.code, input.redirectUri)
  if (!googleUser.emailVerified) {
    logger.info("AdminAuthService: Google email is not verified", { googleId: googleUser.id })
    return err(forbiddenError("Google email is not verified"))
  }

  const admin = await repo.adminRepository.findByEmail(normalizeEmail(googleUser.email))
  if (!admin) {
    /**
     * email は PII なのでログに出さない
     */
    logger.info("AdminAuthService: Google account is not an admin", { googleId: googleUser.id })
    return err(forbiddenError("Not an admin"))
  }

  const signedInAdmin = await repo.adminRepository.recordSignIn(admin.id, {
    profile: { avatarUrl: googleUser.picture ?? null, name: googleUser.name },
    signedInAt: new Date(),
  })
  const tokens = await issueAdminTokens(admin.id, repo, tokenGenerators)

  logger.info("AdminAuthService: Admin signed in", { adminId: admin.id })

  return ok({ ...tokens, admin: signedInAdmin })
}

/**
 * 開発環境専用の admin ログイン
 *
 * email で seed 済みの admin（admin@dev.local）を引き当ててトークンを発行し、最終サインイン日時を更新する。
 * production での誤実行を防ぐガードは呼び出し側（index.ts / router / controller / ADMIN_PUBLIC_PATHS）で行う。
 * production 以外でも、@dev.local 以外の admin（admin:create で登録した実在の人）には Google を通さずにはなれない
 */
export const loginAsDevAdmin = async (
  input: { email: string },
  repo: Repositories,
  tokenGenerators: TokenGenerators,
): Promise<Result<AuthenticateAdminSuccess>> => {
  logger.debug("AdminAuthService: dev-login attempt")

  const email = normalizeEmail(input.email)
  if (!email.endsWith(DEV_ADMIN_EMAIL_DOMAIN)) {
    return err(notFoundError("Dev admin not found"))
  }

  const admin = await repo.adminRepository.findByEmail(email)
  if (!admin) {
    return err(notFoundError("Dev admin not found"))
  }

  const signedInAdmin = await repo.adminRepository.recordSignIn(admin.id, { signedInAt: new Date() })
  const tokens = await issueAdminTokens(admin.id, repo, tokenGenerators)

  logger.info("AdminAuthService: dev-login success", { adminId: admin.id })

  return ok({ ...tokens, admin: signedInAdmin })
}

/**
 * admin の Refresh Token のローテーション
 *
 * auth-service の refreshTokens の前に、admin がまだ admins にいるかを確かめる。
 * 確かめないと、admins から消した admin も refresh のたびに 7 日延びて使い続けられる。
 * いなければ jti を消して 401
 */
export const refreshAdminTokens = async (
  input: { refreshToken: string },
  repo: Repositories,
  verifier: RefreshVerifier,
  generators: TokenGenerators,
): Promise<Result<RefreshTokensSuccess>> => {
  const payload = verifier(input.refreshToken)
  if (payload && !(await repo.adminRepository.findById(payload.userId))) {
    logger.info("AdminAuthService: Admin no longer exists", { adminId: payload.userId })
    await repo.refreshTokenRepository.delete(payload.jti)
    return err(unauthorizedError("Admin no longer exists"))
  }
  return refreshTokens(input, { refreshTokenRepository: repo.refreshTokenRepository }, verifier, generators)
}
