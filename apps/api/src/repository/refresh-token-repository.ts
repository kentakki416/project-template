/**
 * Refresh Token リポジトリのインターフェース
 * Refresh Token は jti（JWT ID）をキーに userId を保存する。
 */
export interface RefreshTokenRepository {
  delete(jti: string): Promise<void>
  findUserId(jti: string): Promise<number | null>
  save(jti: string, userId: number, ttlSeconds: number): Promise<void>
}
