import type { Redis } from "@repo/redis"

import type { RefreshTokenRepository } from "../refresh-token-repository"

/**
 * keyPrefix を一般ユーザーと admin で分けて、同じ Redis の中で jti が混ざらないようにする
 */
export class IoRedisRefreshTokenRepository implements RefreshTokenRepository {
  private _keyPrefix: string
  private _redis: Redis

  constructor(redis: Redis, keyPrefix = "refresh_token") {
    this._keyPrefix = keyPrefix
    this._redis = redis
  }

  private _keyOf(jti: string): string {
    return `${this._keyPrefix}:${jti}`
  }

  public async save(jti: string, userId: number, ttlSeconds: number): Promise<void> {
    await this._redis.set(this._keyOf(jti), String(userId), "EX", ttlSeconds)
  }

  public async findUserId(jti: string): Promise<number | null> {
    const raw = await this._redis.get(this._keyOf(jti))
    return raw === null ? null : Number(raw)
  }

  public async delete(jti: string): Promise<void> {
    await this._redis.del(this._keyOf(jti))
  }
}
