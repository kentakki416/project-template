# =============================================================================
# GitHub Actions OIDC Provider & IAM Role
# =============================================================================
# GitHub Actions から AWS リソースへ安全にアクセスするための OIDC 認証設定
# 長期的なアクセスキーの代わりに、短期間のトークンを使用

# GitHub OIDC プロバイダー
# - AWS アカウントに1つだけ作成（複数リポジトリで共有可能）
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["ffffffffffffffffffffffffffffffffffffffff"]

  tags = var.tags
}

# GitHub Actions 用 IAM ロール
resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-actions-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# ECR プッシュポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "ecr_push" {
  role       = aws_iam_role.github_actions.name
  policy_arn = var.ecr_push_policy_arn
}

# ECS デプロイ用ポリシー
resource "aws_iam_policy" "ecs_deploy" {
  name        = "${var.project_name}-ecs-deploy-${var.environment}"
  description = "Policy for deploying to ECS from GitHub Actions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:DescribeServices"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = var.ecs_task_execution_role_arn
      }
    ]
  })

  tags = var.tags
}

# ECS デプロイポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "ecs_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.ecs_deploy.arn
}
