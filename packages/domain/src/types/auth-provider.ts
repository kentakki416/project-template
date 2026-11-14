import type { AUTH_PROVIDERS } from "../const/auth-provider"

export type AuthProvider = (typeof AUTH_PROVIDERS)[number]
