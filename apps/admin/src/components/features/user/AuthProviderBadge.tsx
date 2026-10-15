import { AuthProvider } from "@repo/api-schema"

import Badge from "@/components/ui/badge/Badge"
import { AUTH_PROVIDER_LABELS } from "@/features/user/auth-provider-labels"

const AUTH_PROVIDER_COLORS = {
  dev: "warning",
  google: "primary",
} as const satisfies Record<AuthProvider, "primary" | "warning">

/**
 * ログイン方法のバッジ
 */
export default function AuthProviderBadge({ provider }: { provider: AuthProvider }) {
  return (
    <Badge color={AUTH_PROVIDER_COLORS[provider]} size="sm" variant="light">
      {AUTH_PROVIDER_LABELS[provider]}
    </Badge>
  )
}
