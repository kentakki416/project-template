# =============================================================================
# IAM Resources for ECS
# =============================================================================

# AWS管理ポリシーの参照
data "aws_iam_policy" "ecs_task_execution" {
  name = "AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy" "ecs_infrastructure_lb" {
  count = var.enable_blue_green ? 1 : 0
  name  = "AmazonECSInfrastructureRolePolicyForLoadBalancers"
}

# ECS Task Execution Role
# - Fargateタスクの実行に必要な権限を提供
# - ECR、CloudWatch Logs、Secrets Managerへのアクセス権限
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.task_definition_family}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# ECS Task Execution Role Policy Attachment
# - ECRからのイメージプル、CloudWatch Logsへの書き込み権限を提供
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

# =============================================================================
# IAM Role for ECS ALB Service (Blue/Green deployment)
# =============================================================================

# ECS ALB Service Role
# - Blue/Greenデプロイ時にECSがターゲットグループを管理するためのロール
resource "aws_iam_role" "ecs_alb_service_role" {
  count = var.enable_blue_green ? 1 : 0

  name = "${var.service_name}-alb-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# ECS ALB Service Role Policy Attachment
# - ターゲットグループの登録/解除権限を提供
resource "aws_iam_role_policy_attachment" "ecs_alb_service_role_policy" {
  count = var.enable_blue_green ? 1 : 0

  role       = aws_iam_role.ecs_alb_service_role[0].name
  policy_arn = data.aws_iam_policy.ecs_infrastructure_lb[0].arn
}
