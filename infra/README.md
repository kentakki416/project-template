# infra

AWS デプロイ用の Infrastructure as Code (Terraform)。テンプレートはこのままだと動かないので、**初回セットアップは下記の順序を必ず守ること**。

## 目次

- [構成](#構成)
- [前提ツール](#前提ツール)
- [初回セットアップ手順](#初回セットアップ手順)
  - [1. AWS 認証の準備](#1-aws-認証の準備)
  - [2. プロジェクト名・ドメイン名の置き換え](#2-プロジェクト名ドメイン名の置き換え)
  - [3. bootstrap (state バックエンドを作る)](#3-bootstrap-state-バックエンドを作る)
  - [4. backend.tf の bucket / table を bootstrap 出力に差し替え](#4-backendtf-の-bucket--table-を-bootstrap-出力に差し替え)
  - [5. account (ECR + GitHub Actions OIDC)](#5-account-ecr--github-actions-oidc)
  - [6. env/prd を apply (hosted zone を所有)](#6-envprd-を-apply-hosted-zone-を所有)
  - [7. ドメインレジストラに NS を登録 (DNS 委任)](#7-ドメインレジストラに-ns-を登録-dns-委任)
  - [8. env/dev を apply (prd の hosted zone を参照)](#8-envdev-を-apply-prd-の-hosted-zone-を参照)
  - [9. seed-secrets.sh で外部 Secret を投入](#9-seed-secretssh-で外部-secret-を投入)
  - [10. ECR にイメージを push して ECS service の desired\_count を 1 に上げる](#10-ecr-にイメージを-push-して-ecs-service-の-desired_count-を-1-に上げる)
- [dev / prd の差分](#dev--prd-の差分)
- [日常運用コマンド](#日常運用コマンド)
- [関連ドキュメント](#関連ドキュメント)

## 構成

```
infra/terraform/aws/
├── bootstrap/   # S3 backend + DynamoDB state lock。一度だけローカル apply (local state)
├── account/     # OIDC provider / GitHub Actions IAM role / ECR (アカウント単位、remote state)
├── env/
│   ├── dev/     # dev 環境 (通常 rolling デプロイ、api.dev.<domain>)
│   └── prd/     # prd 環境 (Blue/Green デプロイ、api.<domain>、hosted zone を所有)
└── modules/     # 再利用可能な module (vpc / alb / ecs-cluster / ecs-workload / rds / elasticache / acm / route53 / secrets)
```

リソースの「生存期間」で 3 層に分かれており、apply の頻度と権限の境界が異なる:

| 層 | 何を作るか | apply 頻度 | state |
|---|---|---|---|
| `bootstrap` | tfstate 置き場 (S3 + DynamoDB) | 1 度だけ | local |
| `account` | OIDC / IAM role / ECR | role を増やす時のみ | remote |
| `env/*` | VPC / ECS / RDS / ALB / ACM / Route53 ... | 機能追加のたび | remote |

## 前提ツール

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.0
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2 (`aws configure` 済み)
- [tflint](https://github.com/terraform-linters/tflint) (任意、CI で使うため推奨)
- [trivy](https://aquasecurity.github.io/trivy/) (任意、CI で使うため推奨)
- [jq](https://jqlang.github.io/jq/) (`seed-secrets.sh` で必要)

## 初回セットアップ手順

### 1. AWS 認証の準備

ローカルから `terraform apply` を実行するために IAM ユーザー (もしくは SSO セッション) で `aws configure` を済ませる。bootstrap / account 層は CI から触れないため、必ずローカルから流す前提。

```bash
aws configure          # AWS Access Key, Secret, Default region (ap-northeast-1) を入力
aws sts get-caller-identity   # 認証確認
```

### 2. プロジェクト名・ドメイン名の置き換え

テンプレート同梱の以下のデフォルト値を、実際のプロジェクト名・ドメインに置き換えること。各ファイルに `TODO` コメントが付いている。

| ファイル | 変数 | 既定値 | 変更例 |
|---|---|---|---|
| `aws/bootstrap/variables.tf` | `project_name` | `project-template` | `my-app` |
| `aws/bootstrap/variables.tf` | `s3_bucket_name` | `project-template-terraform-state-20250101` | `my-app-tfstate-20260614` (世界一意) |
| `aws/bootstrap/variables.tf` | `dynamodb_table_name` | `project-template-terraform-state-lock` | `my-app-tfstate-lock` |
| `aws/account/variables.tf` | `project_name` / `github_repository` | `project-template` / `owner/repo` | プロジェクト名 / `owner/my-app` |
| `aws/env/{dev,prd}/variables.tf` | `project_name` | `project-template` | プロジェクト名 |
| `aws/env/{dev,prd}/variables.tf` | `domain_name` | `project-template.com` | 実ドメイン (例: `my-app.com`) |
| `aws/env/{dev,prd}/backend.tf` | `bucket` / `dynamodb_table` | テンプレ既定値 | bootstrap 出力に揃える (手順 4) |

> `domain_name` は dev と prd で **同じ値** にすること。dev は data source で prd の hosted zone を参照する。

### 3. bootstrap (state バックエンドを作る)

```bash
cd infra/terraform/aws/bootstrap
terraform init    # 初回のみ
terraform apply

# 作成された bucket / table 名を確認
terraform output
# s3_bucket_name      = "my-app-tfstate-20260614"
# dynamodb_table_name = "my-app-tfstate-lock"
```

bootstrap だけは local state (S3 と chicken-and-egg のため)。生成された `terraform.tfstate` はリポジトリに含めない (`.gitignore` 済み)。

### 4. backend.tf の bucket / table を bootstrap 出力に差し替え

`account/backend.tf` と `env/{dev,prd}/backend.tf` の `bucket` / `dynamodb_table` を、手順 3 で出力された名前に書き換える (`# TODO:` コメントの行)。

```hcl
terraform {
  backend "s3" {
    bucket         = "my-app-tfstate-20260614"      # ← bootstrap output に差し替え
    key            = "prd/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "my-app-tfstate-lock"           # ← bootstrap output に差し替え
    encrypt        = true
  }
}
```

### 5. account (ECR + GitHub Actions OIDC)

```bash
cd infra/terraform/aws/account
terraform init
terraform apply

# GitHub Actions が AssumeRole する role の ARN を取得
terraform output -raw github_actions_dev_role_arn
terraform output -raw github_actions_prd_role_arn
```

出力された role ARN を **GitHub Settings → Environments → dev / prd → Secrets** の `AWS_ROLE_ARN` に登録する。これで GitHub Actions から `env/dev` / `env/prd` の apply が回せるようになる。

> ⚠️ `account/` の OIDC role を変更するときは、CI が assume している role 自身を書き換えるため、**初回および role rename 系の変更はローカル apply 必須**。詳細は `infra/terraform/CLAUDE.md` を参照。

### 6. env/prd を apply (hosted zone を所有)

prd を **dev より先に** apply すること。`env/prd` で `aws_route53_zone.primary` を作り、dev はそれを data source で読む構造。

```bash
cd infra/terraform/aws/env/prd
terraform init
terraform apply

# Route53 zone と API URL を確認
terraform output route53_name_servers   # ← 4 つの NS が出力される
terraform output api_url                # 例: https://api.my-app.com
```

### 7. ドメインレジストラに NS を登録 (DNS 委任)

手順 6 で出力された 4 つの NS レコードを、ドメインを購入したレジストラ (Route 53 Registrar / お名前.com / Cloudflare 等) のネームサーバー設定画面で登録する。これを終えないと:

- DNS が引けないので ACM 証明書の DNS 検証が完了しない (apply は通るが Certificate が PENDING_VALIDATION のまま)
- `api.<domain>` でアクセスできない

伝播確認:

```bash
dig +short NS my-app.com    # ← 手順 6 の name_servers と一致するか確認
dig +short api.my-app.com   # ← ALB の DNS 名が返ってくれば OK
```

### 8. env/dev を apply (prd の hosted zone を参照)

```bash
cd infra/terraform/aws/env/dev
terraform init
terraform apply

# dev の API URL を確認
terraform output api_url    # 例: https://api.dev.my-app.com
```

### 9. seed-secrets.sh で外部 Secret を投入

Terraform は「箱」 (Secrets Manager の secret) と JWT 鍵だけ作る方針。`DATABASE_URL` / `REDIS_HOST` / `GOOGLE_*` / `LIVEKIT_*` / `FRONTEND_URL` は `scripts/seed-secrets.sh` で投入する。

```bash
# 環境変数を export (direnv で .envrc に書いておくと毎回入力不要)
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export LIVEKIT_HOST=...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export FRONTEND_URL=https://my-app.com

# dev に投入
./scripts/seed-secrets.sh dev

# prd に投入
./scripts/seed-secrets.sh prd
```

スクリプトは terraform output から RDS / Redis のエンドポイントを引いて `DATABASE_URL` / `REDIS_HOST` を構築する。

### 10. ECR にイメージを push して ECS service の desired_count を 1 に上げる

初回 apply 時、ECR がまだ空なので `worker` の `desired_count` は `0` にしてある (`CannotPullContainerError` 防止)。GitHub Actions の deploy workflow で API / worker / migration の image を push し、Prisma migration を `aws ecs run-task` で実行した後、`apps/worker` の `desired_count` を `1` に変更する。

```hcl
# env/{dev,prd}/main.tf の module "ecs_worker"
desired_count = 1   # 0 から 1 に変更して再 apply
```

## dev / prd の差分

| 項目 | dev | prd |
|---|---|---|
| デプロイ戦略 | rolling (deployment_circuit_breaker 付き) | **Blue/Green** (POST_TEST_TRAFFIC_SHIFT で SSM 承認待機) |
| ALB test listener (port 9000) | 無し | 有り (test_listener_allowed_cidrs で CIDR 制限可) |
| API FQDN | `api.dev.<domain>` | `api.<domain>` |
| ACM 証明書 | `*.dev.<domain>` | `*.<domain>` |
| Route53 hosted zone | data source で参照 | **`aws_route53_zone` で作成 / 所有** |
| VPC CIDR | `10.0.0.0/16` | `10.1.0.0/16` |
| state key | `dev/terraform.tfstate` | `prd/terraform.tfstate` |
| RDS / ElastiCache | 最小構成 (single AZ, snapshot OFF, TLS OFF) | dev と同等 (※将来本番強化したい場合は別途) |

## 日常運用コマンド

```bash
# env apply
cd infra/terraform/aws/env/<dev|prd>
terraform plan
terraform apply

# fmt / lint / security
cd infra/terraform
terraform fmt -check -recursive -diff
tflint --init && tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
trivy config aws/env/dev -c .trivy.yml

# Blue/Green デプロイの承認 (POST_TEST_TRAFFIC_SHIFT で停止中)
aws ssm put-parameter --name "/my-app-prd-api/deploy/approval" --value "approved" --overwrite
# 拒否してロールバック
aws ssm put-parameter --name "/my-app-prd-api/deploy/approval" --value "rejected" --overwrite
```

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [`terraform/CLAUDE.md`](terraform/CLAUDE.md) | Terraform 層構造 / CI ワークフロー / OIDC role 復旧手順 |
| [`../docs/spec/shared-packages/README.md`](../docs/spec/shared-packages/README.md) | server-side app が共有する `@repo/db` / `logger` / `errors` / `redis` の設計 |
| [`../apps/api/README.md`](../apps/api/README.md) | API サーバーのローカル起動とテスト手順 |
