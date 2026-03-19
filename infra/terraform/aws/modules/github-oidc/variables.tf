# =============================================================================
# GitHub OIDC Module Variables
# =============================================================================

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "environment" {
  description = "環境名（dev, stg, prd）"
  type        = string
}

variable "github_repository" {
  description = "GitHubリポジトリ（例: owner/repo-name）"
  type        = string
}

variable "ecr_push_policy_arn" {
  description = "ECRプッシュ用IAMポリシーのARN"
  type        = string
}

variable "ecs_task_execution_role_arn" {
  description = "ECSタスク実行ロールのARN"
  type        = string
}

variable "tags" {
  description = "リソースに付与するタグ"
  type        = map(string)
  default     = {}
}
