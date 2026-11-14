import { Request, Response } from "express"

import { getAdminUserListQueryStringSchema, getAdminUserListResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../../lib/parse-schema"
import { sendError } from "../../../lib/send-error"
import { UserRepository } from "../../../repository"
import * as service from "../../../service"

/**
 * GET /api/admin/users
 *
 * ユーザーを検索・絞り込みし、1 ページ分と全件数を返す
 */
export class AdminUserListController {
  constructor(private _userRepository: UserRepository) {}

  public async execute(req: Request, res: Response) {
    const query = parseRequest(getAdminUserListQueryStringSchema, req.query)

    const result = await service.user.searchUsers(
      {
        createdBefore: query.created_before ? new Date(query.created_before) : undefined,
        createdFrom: query.created_from ? new Date(query.created_from) : undefined,
        page: query.page,
        perPage: query.per_page,
        provider: query.provider,
        query: query.q,
      },
      { userRepository: this._userRepository },
    )

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(getAdminUserListResponseSchema, {
      page: query.page,
      per_page: query.per_page,
      total_count: result.value.totalCount,
      users: result.value.users.map((user) => ({
        id: user.id,
        avatar_url: user.avatarUrl,
        email: user.email,
        name: user.name,
        providers: user.providers,
        created_at: user.createdAt.toISOString(),
      })),
    })

    return res.status(200).json(response)
  }
}
