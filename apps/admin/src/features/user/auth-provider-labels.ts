import { AuthProvider } from "@repo/api-schema"

/**
 * ログイン方法の表示名
 */
export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  dev: "開発用",
  google: "Google",
}
