import { Request, Response } from "express"

import { getAdminUserPathParamSchema, getAdminUserResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../../lib/parse-schema"
import { sendError } from "../../../lib/send-error"
import { AuthAccountRepository, UserRepository } from "../../../repository"
import * as service from "../../../service"

/**
 * GET /api/admin/users/:id
 *
 * ユーザーの詳細を、紐付けているログイン方法と合わせて返す
 */
export class AdminUserDetailController {
  constructor(
    private _userRepository: UserRepository,
    private _authAccountRepository: AuthAccountRepository,
  ) {}

  public async execute(req: Request, res: Response) {
    const { id } = parseRequest(getAdminUserPathParamSchema, req.params)

    const result = await service.user.getUserDetail(id, {
      authAccountRepository: this._authAccountRepository,
      userRepository: this._userRepository,
    })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const { authAccounts, user } = result.value
    const response = parseResponse(getAdminUserResponseSchema, {
      id: user.id,
      auth_accounts: authAccounts.map((account) => ({
        provider: account.provider,
        created_at: account.createdAt.toISOString(),
      })),
      avatar_url: user.avatarUrl,
      email: user.email,
      name: user.name,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    })

    return res.status(200).json(response)
  }
}
