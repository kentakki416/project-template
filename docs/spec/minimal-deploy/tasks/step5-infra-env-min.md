# step5-infra-env-min

minimal 環境の Terraform を作る。`infra/terraform/aws/env/min/` を新設し、Lambda / API Gateway / SQS 用の module を追加する。`account/` には GitHub Actions 用の IAM role を足す。**`env/prd` / `env/dev` と既存の module の挙動には手を入れない。**

設計: [`../README.md`](../README.md#iac-の構成)

前提: [step3-api-event-flush-and-lwa](./step3-api-event-flush-and-lwa.md) / [step4-worker-lambda-entry](./step4-worker-lambda-entry.md)（LWA 入りのイメージが必要）

## 対応内容

### PlanetScale（Terraform の管理外）

コンソールで作る。Terraform では管理しない（AWS の外のサービスのため）。

1. Postgres のデータベースを作る。リージョン `AWS ap-northeast-1 (Tokyo)`、クラスター `PS-5`（単一ノード）
2. アプリ用のロールを作り、内蔵 PgBouncer（port 6432）経由の接続文字列を控える（`postgresql://<user>:<password>@<host>:6432/<db>?sslmode=verify-full`。PgBouncer 経由にする理由は [DB（PlanetScale Postgres）](../README.md#dbplanetscale-postgres)）
3. `packages/db` の Pool と同じ startup parameter を付けて接続できるか確認する（[リスク](../README.md#リスクと実装時の確認事項)の確認）

    ```bash
    PGOPTIONS='-c TimeZone=UTC' psql '<2 で控えた接続文字列>' -c 'SHOW TimeZone;'
    ```

    `unsupported startup parameter: options` で拒否されず、`UTC` が返れば OK
4. 自動バックアップの保持期間を確認し、`../README.md` の「DB（PlanetScale Postgres）」に追記する

### Upstash Redis（Terraform の管理外）

refresh token の保存先。PlanetScale と同じくコンソールで作る（Upstash を使う理由は [refresh token の保存先](../README.md#refresh-token-の保存先)）。

1. Redis のデータベースを作る。リージョン `AWS ap-northeast-1 (Tokyo)`、read region は付けない、プラン `Pay as You Go`
2. Eviction が無効になっていることを確認する。有効だと、容量の上限に近づいたときに期限前の refresh token が消され、ユーザーがログアウトされる
3. 月の予算（Budget）を設定する。予算に達すると Upstash が rate limit をかけ、ログインと refresh が失敗するため、想定の使用量より十分大きくする（目安は [refresh token の保存先](../README.md#refresh-token-の保存先)）
4. TLS 付きの接続文字列（`rediss://default:<password>@<endpoint>:6379`）を控える
5. 接続できるか確認する

    ```bash
    redis-cli --tls -u '<4 で控えた接続文字列>' PING
    ```

    `PONG` が返れば OK

### `account/`

**GitHub Actions 用 role**（`github_oidc.tf`）: prd の role と同じ形で `github_actions_min` を足す。trust policy は `repo:<owner>/<repo>:environment:min` だけを許可する。

| attach する policy | 用途 |
| --- | --- |
| `ecr_push`（既存） | イメージの push |
| `ecs_deploy`（既存） | migration の RunTask / cron の task definition 登録 |
| `lambda_deploy_min`（新規） | Lambda のコードと環境変数の更新、version の発行、alias の切り替え、secret の読み取り |
| `AdministratorAccess` | `env/min` の terraform plan / apply（dev / prd と同じ運用。既存の TODO の対象に含める） |

```hcl
data "aws_iam_policy_document" "lambda_deploy_min" {
  statement {
    sid    = "DeployLambdaFunctions"
    effect = "Allow"
    actions = [
      "lambda:GetAlias",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:ListVersionsByFunction",
      "lambda:PublishVersion",
      "lambda:UpdateAlias",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
    ]
    resources = ["arn:aws:lambda:*:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-min-*"]
  }

  statement {
    sid       = "ReadAppSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:*:${data.aws_caller_identity.current.account_id}:secret:/${var.project_name}-min/app-*"]
  }
}

resource "aws_iam_policy" "lambda_deploy_min" {
  name        = "${var.project_name}-lambda-deploy-min"
  description = "Policy for deploying Lambda functions of the minimal environment"
  policy      = data.aws_iam_policy_document.lambda_deploy_min.json
}
```

`outputs.tf` に `github_actions_min_role_arn` を足す。初回はローカルから apply し、GitHub の Environment `min` の Secrets に `AWS_ROLE_ARN` を登録する（`infra/terraform/CLAUDE.md`「account の初回 apply はローカルから実行」と同じ手順）。

**ECR の repository policy**（`ecr.tf`）: api / worker の repository に、Lambda サービスからの pull を許可する。Lambda は関数の作成時に自分で repository policy を書き足すが、IaC の外で policy が変わるのを避けるため明示しておく。

```hcl
data "aws_iam_policy_document" "api_lambda_pull" {
  statement {
    sid     = "AllowLambdaPull"
    effect  = "Allow"
    actions = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "aws:sourceArn"
      values   = ["arn:aws:lambda:*:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*"]
    }
  }
}

resource "aws_ecr_repository_policy" "api_lambda_pull" {
  repository = aws_ecr_repository.api.name
  policy     = data.aws_iam_policy_document.api_lambda_pull.json
}
```

worker の repository にも同じものを `worker_lambda_pull` として足す。

### `modules/sqs-queue`（新規）

queue 本体と DLQ を作る。`maxReceiveCount` は `packages/queue` の `SQS_MAX_RECEIVE_COUNT`（3）と揃える。

```hcl
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name}-dlq"
  message_retention_seconds = 1209600 # 14 日（最大値）。最終失敗したジョブを調べて redrive するための猶予
  sqs_managed_sse_enabled   = true

  tags = var.tags
}

resource "aws_sqs_queue" "this" {
  name                       = var.name
  sqs_managed_sse_enabled    = true
  visibility_timeout_seconds = var.visibility_timeout_seconds

  # packages/queue の SQS_MAX_RECEIVE_COUNT と揃える（BullMQ 実装の attempts: 3 と同じ回数）
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = var.tags
}
```

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `name` | - | queue 名（`project-template-min-track-event` 等） |
| `visibility_timeout_seconds` | `360` | consumer の Lambda タイムアウトの 6 倍（AWS の推奨値）。再試行の間隔にもなる |
| `max_receive_count` | `3` | DLQ に移すまでの受信回数 |
| `tags` | `{}` | |

outputs: `arn` / `url` / `name` / `dlq_arn`。

### `modules/lambda-container`（新規）

コンテナイメージの Lambda 関数、alias `live`、ロググループ、実行ロールを作る。**`image_uri` / `environment` / alias の `function_version` は deploy workflow が更新するので `ignore_changes` にする。**

```hcl
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_in_days

  tags = var.tags
}

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 関数ごとに必要な権限（SQS の送受信など）は env 側で policy document を作って渡す
resource "aws_iam_role_policy" "additional" {
  count = var.additional_policy_json == null ? 0 : 1

  name   = "${var.name}-additional"
  role   = aws_iam_role.lambda.id
  policy = var.additional_policy_json
}

resource "aws_lambda_function" "this" {
  function_name = var.name
  package_type  = "Image"
  image_uri     = var.image_uri
  role          = aws_iam_role.lambda.arn
  architectures = ["x86_64"] # GitHub Actions が linux/amd64 で build するため
  memory_size   = var.memory_size
  timeout       = var.timeout
  publish       = true

  dynamic "image_config" {
    for_each = var.command == null ? [] : [var.command]
    content {
      command = image_config.value
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.this.name
  }

  # image_uri と environment は deploy workflow（deploy-aws-min.yml）が正本。
  # Terraform が古い値で上書きしないよう無視する。
  lifecycle {
    ignore_changes = [environment, image_uri]
  }

  tags = var.tags
}

resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version

  # どの version に向けるかは deploy workflow が決める（切り戻しも alias の付け替えで行う）
  lifecycle {
    ignore_changes = [function_version]
  }
}
```

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `name` | - | 関数名 |
| `image_uri` | - | **作成時だけ**使うイメージ。以降は deploy workflow が更新する |
| `command` | `null` | イメージの `CMD` を上書きする場合に指定（worker は `["node", "dist/lambda-server.js"]`） |
| `memory_size` | `512` | MB |
| `timeout` | `30` | 秒 |
| `additional_policy_json` | `null` | 実行ロールに足す権限 |
| `log_retention_in_days` | `3` | prd の `log_retention_days` と同じ |
| `tags` | `{}` | |

outputs: `function_name` / `function_arn` / `alias_name` / `alias_arn` / `alias_invoke_arn` / `role_arn`。

### `modules/http-api`（新規）

API Gateway HTTP API、`$default` ルート、Lambda 統合、スロットリング、独自ドメインを作る。

```hcl
resource "aws_apigatewayv2_api" "this" {
  name          = var.name
  protocol_type = "HTTP"

  # 独自ドメイン以外（execute-api の URL）からは呼べないようにする
  disable_execute_api_endpoint = true

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_alias_invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000 # HTTP API の上限
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  # express-rate-limit（in-memory）が Lambda では実質効かないため、ステージ全体で上限をかける
  default_route_settings {
    throttling_burst_limit = var.throttling_burst_limit
    throttling_rate_limit  = var.throttling_rate_limit
  }

  tags = var.tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  qualifier     = var.lambda_alias_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_apigatewayv2_domain_name" "this" {
  domain_name = var.domain_name

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = var.tags
}

resource "aws_apigatewayv2_api_mapping" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  domain_name = aws_apigatewayv2_domain_name.this.id
  stage       = aws_apigatewayv2_stage.default.id
}
```

CORS は API Gateway では設定しない（設定すると API Gateway が preflight に自分で応答し、Express の `cors` と二重になる）。

outputs: `api_id` / `target_domain_name` / `hosted_zone_id`（`aws_apigatewayv2_domain_name.this.domain_name_configuration[0]` の値）。

### `env/min/`（新規）

`env/prd` と同じファイル構成にする（`backend.tf` / `provider.tf` / `variables.tf` / `main.tf` / `outputs.tf` / `.trivy.yml` / `.trivyignore`）。

- `backend.tf`: `key = "min/terraform.tfstate"`
- `provider.tf`: prd と同じ。ただし `random` 以外に追加の provider は不要
- `variables.tf`: `environment = "min"`、`vpc_cidr = "10.2.0.0/16"`、`api_subdomain = "api"`、`log_retention_days = 3`、cron の 3 変数（prd と同じ既定値）に加えて次を持つ

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `bootstrap_image_tag` | `"initial"` | Lambda を**作成するときだけ**使うイメージのタグ。初回の手順は step6 |
| `api_throttling_burst_limit` | `100` | API Gateway のバースト上限 |
| `api_throttling_rate_limit` | `50` | API Gateway の 1 秒あたりの上限 |
| `worker_maximum_concurrency` | `2` | SQS イベントソースの同時実行数（設定できる最小値）。DB の接続数を抑える |

`main.tf` の構成（prd と同じ module はパラメータの差分だけを書く）:

```hcl
locals {
  name_prefix = "${var.project_name}-${var.environment}"

  /** common_tags は prd と同じ */
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
    },
    var.additional_tags
  )

  /**
   * SQS の queue 名。packages/queue の *_QUEUE_NAME と一致させること
   * （worker の Lambda は queue 名でジョブハンドラを選ぶ）
   */
  queue_names = ["process-memo", "track-event"]

  public_subnet_cidrs = [for i in range(2) : cidrsubnet(var.vpc_cidr, 8, i + 1)]
  public_subnet_keys  = [for az in var.availability_zones : "public${substr(az, length(az) - 2, 1)}-${substr(az, length(az) - 1, 1)}"]
}

/**
 * VPC: cron / migration（ECS RunTask）のためだけに持つ。public subnet のみで NAT は作らない。
 * タスクには public IP を付けて ECR / Secrets Manager / PlanetScale へ直接出る。
 * inbound は一切開けない。
 */
module "vpc" {
  source = "../../modules/vpc"

  name                    = local.name_prefix
  cidr_block              = var.vpc_cidr
  create_internet_gateway = true
  create_nat_gateway      = false

  subnets = {
    for i, az in var.availability_zones :
    local.public_subnet_keys[i] => {
      availability_zone = az
      cidr_block        = local.public_subnet_cidrs[i]
      subnet_type       = "public"
    }
  }

  security_groups = {
    ecs = {
      description = "Security group for ECS run-once tasks (cron / migration)"
      name        = "${local.name_prefix}-ecs"
    }
  }

  security_group_rules = [
    {
      cidr_blocks         = ["0.0.0.0/0"]
      description         = "All outbound traffic (ECR / Secrets Manager / PlanetScale)"
      from_port           = 0
      protocol            = "-1"
      security_group_name = "ecs"
      to_port             = 0
      type                = "egress"
    },
  ]
}

/**
 * アプリの secret。RDS / ElastiCache が無いので DB_PASSWORD / REDIS_PORT / REDIS_DB は持たない。
 * DATABASE_URL（PlanetScale）と REDIS_URL（Upstash）は scripts/seed-secrets.sh min で投入する。
 */
module "app_secrets" {
  source = "../../modules/secrets"

  name                    = "/${local.name_prefix}/app"
  recovery_window_in_days = 0

  initial_values = {
    JWT_ACCESS_EXPIRATION  = "15m"
    JWT_ACCESS_SECRET      = random_password.jwt_access_secret.result
    JWT_REFRESH_EXPIRATION = "30d"
    JWT_REFRESH_SECRET     = random_password.jwt_refresh_secret.result

    /** ClickHouse Cloud の接続情報。prd と同じく dummy の placeholder（理由は env/prd/main.tf） */
    DATA_WAREHOUSE_DATABASE = "project_template"
    DATA_WAREHOUSE_PASSWORD = "dummy"
    DATA_WAREHOUSE_URL      = "https://dummy.clickhouse.cloud:8443"
    DATA_WAREHOUSE_USER     = "default"

    NODE_ENV = "production"
    PORT     = "8080"
  }

  tags = local.common_tags
}

module "queues" {
  source   = "../../modules/sqs-queue"
  for_each = toset(local.queue_names)

  name = "${local.name_prefix}-${each.key}"
  tags = local.common_tags
}

/** api: 同じ api イメージを LWA で動かす */
data "aws_iam_policy_document" "api_lambda" {
  statement {
    sid       = "SendJobMessages"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [for q in module.queues : q.arn]
  }
}

module "lambda_api" {
  source = "../../modules/lambda-container"

  name                   = "${local.name_prefix}-api"
  image_uri              = "${data.aws_ecr_repository.api.repository_url}:${var.bootstrap_image_tag}"
  memory_size            = 1024 # コールドスタートを縮めるため（CPU はメモリに比例して割り当てられる）
  timeout                = 29   # API Gateway の統合タイムアウト（30 秒）より短くする
  additional_policy_json = data.aws_iam_policy_document.api_lambda.json
  log_retention_in_days  = var.log_retention_days
  tags                   = local.common_tags
}

/** worker: 同じ worker イメージを、起動コマンドだけ Lambda 用の入口に変えて動かす */
data "aws_iam_policy_document" "worker_lambda" {
  statement {
    sid    = "ConsumeJobMessages"
    effect = "Allow"
    actions = [
      "sqs:ChangeMessageVisibility",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
    ]
    resources = [for q in module.queues : q.arn]
  }
}

module "lambda_worker" {
  source = "../../modules/lambda-container"

  name                   = "${local.name_prefix}-worker"
  image_uri              = "${data.aws_ecr_repository.worker.repository_url}:${var.bootstrap_image_tag}"
  command                = ["node", "dist/lambda-server.js"]
  memory_size            = 512
  timeout                = 60 # sqs-queue の visibility_timeout_seconds（360）はこの 6 倍
  additional_policy_json = data.aws_iam_policy_document.worker_lambda.json
  log_retention_in_days  = var.log_retention_days
  tags                   = local.common_tags
}

resource "aws_lambda_event_source_mapping" "worker" {
  for_each = module.queues

  event_source_arn        = each.value.arn
  function_name           = module.lambda_worker.alias_arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = var.worker_maximum_concurrency
  }
}

module "http_api" {
  source = "../../modules/http-api"

  name                    = "${local.name_prefix}-api"
  domain_name             = "${var.api_subdomain}.${var.domain_name}"
  certificate_arn         = module.acm.certificate_arn
  lambda_alias_invoke_arn = module.lambda_api.alias_invoke_arn
  lambda_alias_name       = module.lambda_api.alias_name
  lambda_function_name    = module.lambda_api.function_name
  throttling_burst_limit  = var.api_throttling_burst_limit
  throttling_rate_limit   = var.api_throttling_rate_limit
  tags                    = local.common_tags
}

/**
 * api.<domain> → API Gateway の独自ドメイン。
 * modules/route53 は ALB 向け（evaluate_target_health = true）なので使わず、ここで直接書く。
 * prd と同じ FQDN なので、prd の env と同時に apply しないこと（移行は deferred-migrate-to-standard.md）
 */
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "${var.api_subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    evaluate_target_health = false
    name                   = module.http_api.target_domain_name
    zone_id                = module.http_api.hosted_zone_id
  }
}
```

ほかに prd と同じ形で置くもの（差分だけ記す）:

| リソース | prd との差分 |
| --- | --- |
| `random_password.jwt_*` | 同じ。`db_master` は作らない |
| `data.aws_ecr_repository.*` / `data.aws_route53_zone.primary` / `module.acm` | 同じ |
| `module.ecs_cluster` | `container_insights_enabled = false` |
| `module.ecs_migration` / `module.ecs_cron` | `subnets` を public subnet に。`secret_keys` は migration が `["DATABASE_URL"]`、cron が `["DATABASE_URL", "NODE_ENV"]` |
| `module.cron_schedule` | `subnets` を public subnet に、`assign_public_ip = true` |
| ALB / RDS / ElastiCache / ECS Service | **作らない** |

`outputs.tf`: `api_url` / `lambda_api_function_name` / `lambda_worker_function_name` / `sqs_queue_url_prefix`（`https://sqs.<region>.amazonaws.com/<account>/${local.name_prefix}-`）/ `ecs_cluster_name` / `ecs_migration_task_definition_family` / `ecs_cron_task_definition_family` / `public_subnet_ids` / `ecs_security_group_id` / `app_secret_name`。

### `scripts/seed-secrets.sh`

min は RDS / ElastiCache の output が無いので、既存の「terraform output から組み立てる」処理は自動で skip される。PlanetScale と Upstash の接続文字列を環境変数から受け取る処理を足す。

```bash
# 外部の DB / Redis（minimal 構成の PlanetScale / Upstash 等）。RDS / ElastiCache を持たない環境でだけ使う。
# 変数名を DATABASE_URL / REDIS_URL にしないのは、ローカルのシェルに入っている値を
# 誤って本番の secret に書き込まないため。
add_kv "DATABASE_URL"           "${EXTERNAL_DATABASE_URL:-}"  "env"
add_kv "REDIS_URL"              "${EXTERNAL_REDIS_URL:-}"     "env"
```

RDS / ElastiCache がある環境（dev / prd）では、後段の処理が `DATABASE_URL` / `REDIS_URL` を上書きするので影響しない。ヘッダーコメントの環境変数一覧にも `EXTERNAL_DATABASE_URL` / `EXTERNAL_REDIS_URL` を足す。

### CI / ドキュメント

- `terraform-aws-env-apply.yml` の `environment` の選択肢に `min` を足す
- `terraform-aws-env-ci.yml` は dev だけが対象（ファイル内の TODO）。TODO のとおり matrix にして `dev` / `min` を対象にする
- `infra/terraform/CLAUDE.md` の「構造」と「CI/CD 運用」の表に `env/min` を追記する

## 動作確認

```bash
cd infra/terraform/aws/account && terraform plan   # role / policy / ECR policy の追加だけが出る
cd infra/terraform/aws/env/min
terraform init && terraform validate
terraform fmt -check -recursive -diff ../..
tflint --chdir=. --config=$(pwd)/../../../.tflint.hcl --recursive
trivy config . -c .trivy.yml
terraform plan
```

- [ ] `account/` の plan に、既存リソースの変更・削除が無い（追加だけ）
- [ ] `env/dev` / `env/prd` の plan に差分が出ない（module を追加しただけで既存 module は変えていない）
- [ ] `env/min` の plan に NAT Gateway / ALB / RDS / ElastiCache / ECS Service が無い
- [ ] trivy の指摘は、意図したもの（public subnet の ECS タスクに public IP を付ける等）だけを理由付きで `.trivyignore` に入れる
- [ ] PlanetScale の port 6432（PgBouncer）に `PGOPTIONS='-c TimeZone=UTC'` 付きで接続でき、`SHOW TimeZone` が `UTC` を返す。接続できなければ [リスク](../README.md#リスクと実装時の確認事項)の「だめだった場合」に従う
- [ ] Upstash に `redis-cli --tls` で接続でき、`PING` が `PONG` を返す。Eviction が無効で、月の予算が設定されている
- [ ] apply と初回デプロイは step6 の手順で行う
