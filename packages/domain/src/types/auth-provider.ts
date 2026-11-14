import type { AUTH_PROVIDERS } from "../const/auth-provider"

/**
 * ログイン方法
 */
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]
