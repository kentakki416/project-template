import {
  and,
  authAccounts,
  count,
  desc,
  DrizzleClient,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
  users,
} from "@repo/db"
import { AuthProvider, User } from "@repo/domain"

import type { TransactionContext } from "../transaction"
import type { CreateUserInput, SearchUsersInput, SearchUsersResult, UserRepository } from "../user-repository"

import { resolveDrizzleClient } from "./transaction-runner"

/**
 * Drizzleの型
 */
type UserRow = typeof users.$inferSelect

/**
 * LIKE の特殊文字（\ % _）を文字そのものとして扱う。Postgres の LIKE の既定のエスケープ文字は \
 */
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Drizzle実装のユーザーリポジトリ
 */
export class DrizzleUserRepository implements UserRepository {
  private _db: DrizzleClient

  constructor(db: DrizzleClient) {
    this._db = db
  }

  public async findById(id: number): Promise<User | null> {
    const [row] = await this._db.select().from(users).where(eq(users.id, id))
    if (!row) return null
    return this._toDomainUser(row)
  }

  public async findByEmail(email: string): Promise<User | null> {
    const [row] = await this._db.select().from(users).where(eq(users.email, email))
    if (!row) return null
    return this._toDomainUser(row)
  }

  /**
   * ユーザーを検索する。新しい順（同じ作成日時は id の降順）に limit 件を返し、条件に合う全件数も返す
   */
  public async search(input: SearchUsersInput): Promise<SearchUsersResult> {
    const pattern = input.query ? `%${escapeLikePattern(input.query)}%` : undefined
    /**
     * and() は undefined の条件を無視する
     */
    const where = and(
      pattern ? or(ilike(users.name, pattern), ilike(users.email, pattern)) : undefined,
      input.provider
        ? exists(
          this._db
            .select({ one: sql`1` })
            .from(authAccounts)
            .where(and(eq(authAccounts.userId, users.id), eq(authAccounts.provider, input.provider))),
        )
        : undefined,
      input.createdFrom ? gte(users.createdAt, input.createdFrom) : undefined,
      input.createdBefore ? lt(users.createdAt, input.createdBefore) : undefined,
    )

    const [[{ total }], rows] = await Promise.all([
      this._db.select({ total: count() }).from(users).where(where),
      this._db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(input.limit)
        .offset(input.offset),
    ])

    /**
     * そのページのユーザーのログイン方法をまとめて引く（行ごとに引かない）
     */
    const accounts = rows.length === 0
      ? []
      : await this._db
        .select({ provider: authAccounts.provider, userId: authAccounts.userId })
        .from(authAccounts)
        .where(inArray(authAccounts.userId, rows.map((row) => row.id)))
        .orderBy(authAccounts.createdAt, authAccounts.id)

    /**
     * ユーザーごとのログイン方法。同じ方法を 2 つ紐付けていても（Google のアカウントを 2 つなど）1 つにまとめる
     */
    const providersByUserId = new Map<number, Set<AuthProvider>>()
    for (const account of accounts) {
      const providers = providersByUserId.get(account.userId) ?? new Set<AuthProvider>()
      providers.add(account.provider)
      providersByUserId.set(account.userId, providers)
    }

    return {
      totalCount: total,
      users: rows.map((row) => ({
        ...this._toDomainUser(row),
        providers: [...(providersByUserId.get(row.id) ?? [])],
      })),
    }
  }

  public async create(data: CreateUserInput, tx?: TransactionContext): Promise<User> {
    const client = resolveDrizzleClient(this._db, tx)
    const [row] = await client
      .insert(users)
      .values({
        avatarUrl: data.avatarUrl,
        email: data.email,
        name: data.name,
      })
      .returning()
    return this._toDomainUser(row)
  }

  /**
   * Drizzleの型 → ドメインの型に変換
   */
  private _toDomainUser(row: UserRow): User {
    return {
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      email: row.email,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
    }
  }
}
