# =============================================================================
# GitHub OIDC Module Outputs
# =============================================================================

output "role_arn" {
  description = "GitHub Actions 用 IAM ロールの ARN"
  value       = aws_iam_role.github_actions.arn
}

output "oidc_provider_arn" {
  description = "GitHub OIDC プロバイダーの ARN"
  value       = aws_iam_openid_connect_provider.github.arn
}
