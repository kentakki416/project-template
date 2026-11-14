export interface RefreshTokenRepository {
  delete(jti: string): Promise<void>
  findUserId(jti: string): Promise<number | null>
  save(jti: string, userId: number, ttlSeconds: number): Promise<void>
}
