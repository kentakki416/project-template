data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  task_role_arn = var.task_role_arn != null ? var.task_role_arn : var.execution_role_arn

  /**
   * ecs:RunTask の対象となる task definition ARN。
   * family の全 revision を許可するため revision 部分を wildcard にする
   * (実行時に最新 ACTIVE revision が選ばれる)。
   */
  task_definition_arn_wildcard = "arn:aws:ecs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:task-definition/${var.task_definition_family}:*"
}

# =============================================================================
# EventBridge Scheduler 実行ロール (scheduler が ECS RunTask を呼ぶため)
# =============================================================================

resource "aws_iam_role" "scheduler" {
  name = "${var.name}-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        /**
         * confused deputy 対策: 自アカウントの scheduler からの assume のみ許可
         */
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "scheduler" {
  name = "run-task"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecs:RunTask"
        Resource = local.task_definition_arn_wildcard
        Condition = {
          ArnLike = {
            "ecs:cluster" = var.cluster_arn
          }
        }
      },
      {
        /**
         * RunTask 時に task の execution role / task role を ECS へ渡すため
         */
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = distinct([var.execution_role_arn, local.task_role_arn])
      },
    ]
  })
}

# =============================================================================
# EventBridge Scheduler スケジュール (ECS RunTask ターゲット)
# =============================================================================
# - ecs_parameters.task_definition_arn に family 名を渡し、実行時に最新 ACTIVE
#   revision を起動する。CI が deploy 毎に新 revision を register することで
#   image が更新され、schedule 側は再 apply 不要で最新を追従する。

resource "aws_scheduler_schedule" "this" {
  name        = var.name
  state       = var.state
  description = "Scheduled ECS task: ${var.name}"

  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.schedule_expression_timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.cluster_arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = var.task_definition_family
      task_count          = var.task_count
      launch_type         = var.launch_type
      platform_version    = var.platform_version

      network_configuration {
        subnets          = var.subnets
        security_groups  = var.security_groups
        assign_public_ip = var.assign_public_ip
      }
    }
  }
}
