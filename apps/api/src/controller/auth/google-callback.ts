import { Request, Response } from "express"

import {
  authGoogleCallbackRequestSchema,
  authGoogleCallbackResponseSchema,
} from "@repo/api-schema"

import { IGoogleOAuthClient } from "../../client/google-oauth"
import { generateToken } from "../../lib/jwt"
import { logger } from "../../log"
import { AuthAccountRepository, UserRegistrationRepository } from "../../repository/mysql"
import * as service from "../../service"

/**
 * Google からのコールバックを処理し、フロントエンドにリダイレクトするAPI
 */
export class AuthGoogleCallbackController {
  constructor(
    private authAccountRepository: AuthAccountRepository,
    private userRegistrationRepository: UserRegistrationRepository,
    private googleOAuthClient: IGoogleOAuthClient
  ) {}

  async execute(req: Request, res: Response) {
    try {
      logger.info("AuthGoogleCallbackController: Starting Google OAuth callback process")

      // リクエストスキーマのバリデーション
      const validatedRequest = authGoogleCallbackRequestSchema.parse(req.query)

      // Service 層を呼び出して認証処理
      const result = await service.auth.authenticateWithGoogle(
        validatedRequest.code,
        {
          authAccountRepository: this.authAccountRepository,
          userRegistrationRepository: this.userRegistrationRepository,
        },
        this.googleOAuthClient,
        generateToken
      )

      logger.info("AuthGoogleCallbackController: Authentication successful", {
        isNewUser: result.isNewUser,
        userId: result.user.id,
      })

      // レスポンスデータのバリデーション
      const response = authGoogleCallbackResponseSchema.parse({
        is_new_user: result.isNewUser,
        token: result.jwtToken,
        user: {
          avatar_url: result.user.avatarUrl,
          created_at: result.user.createdAt.toISOString(),
          email: result.user.email,
          id: result.user.id,
          name: result.user.name,
        },
      })

      /**
       * フロントエンドの /api/auth/callback にリダイレクト
       * トークンとユーザー情報をクエリパラメータで渡す
       */
      const callbackUrl = new URL("/api/auth/callback", process.env.FRONTEND_URL || "http://localhost:3000")
      callbackUrl.searchParams.set("token", response.token)
      callbackUrl.searchParams.set("user", JSON.stringify({
        avatar_url: response.user.avatar_url,
        email: response.user.email,
        id: response.user.id,
        name: response.user.name,
      }))

      res.redirect(callbackUrl.toString())
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        logger.warn("AuthGoogleCallbackController: Validation error", {
          error: "Invalid request parameters",
        })
      } else {
        logger.error(
          "AuthGoogleCallbackController: Authentication failed",
          error instanceof Error ? error : new Error("Unknown error")
        )
      }

      /**
       * エラー時もフロントエンドのサインインページにリダイレクト
       */
      const signinUrl = new URL("/signin", process.env.FRONTEND_URL || "http://localhost:3000")
      signinUrl.searchParams.set("error", "auth_failed")
      res.redirect(signinUrl.toString())
    }
  }
}
