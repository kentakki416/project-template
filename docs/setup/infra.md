# Infra セットアップ手順

AWS デプロイ用 Infrastructure as Code (Terraform) の **初回セットアップ手順**。テンプレートはこのままだと動かないので、下記の順序を必ず守ること。

設計やレイヤー構造の概要は [`infra/README.md`](../../infra/README.md) を参照。

## 目次

- [前提ツール](#前提ツール)
- [初回セットアップ手順](#初回セットアップ手順)
  - [1. AWS 認証の準備](#1-aws-認証の準備)
  - [2. プロジェクト名・ドメイン名の置き換え](#2-プロジェクト名ドメイン名の置き換え)
  - [3. bootstrap (state バックエンドを作る)](#3-bootstrap-state-バックエンドを作る)
  - [4. backend.tf の bucket を bootstrap 出力に差し替え](#4-backendtf-の-bucket-を-bootstrap-出力に差し替え)
  - [5. account (ECR + GitHub Actions OIDC)](#5-account-ecr--github-actions-oidc)
  - [6. GitHub Environments の作成と AWS\_ROLE\_ARN 登録](#6-github-environments-の作成と-aws_role_arn-登録)
  - [7. env/prd を apply (hosted zone を所有)](#7-envprd-を-apply-hosted-zone-を所有)
  - [8. ドメインレジストラに NS を登録 (DNS 委任)](#8-ドメインレジストラに-ns-を登録-dns-委任)
  - [9. env/dev を apply (prd の hosted zone を参照)](#9-envdev-を-apply-prd-の-hosted-zone-を参照)
  - [10. seed-secrets.sh で外部 Secret を投入](#10-seed-secretssh-で外部-secret-を投入)
  - [11. deploy workflow で ECR にイメージを push](#11-deploy-workflow-で-ecr-にイメージを-push)

## 前提ツール

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10 (state lock を S3 ネイティブ (`use_lockfile`) で取得するため)
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
| `aws/account/variables.tf` | `project_name` / `github_repository` | `project-template` / `owner/repo` | プロジェクト名 / `owner/my-app` |
| `aws/env/{dev,prd}/variables.tf` | `project_name` | `project-template` | プロジェクト名 |
| `aws/env/{dev,prd}/variables.tf` | `domain_name` | `project-template.com` | 実ドメイン (例: `my-app.com`) |
| `aws/env/{dev,prd}/backend.tf` | `bucket` | テンプレ既定値 | bootstrap 出力に揃える (手順 4) |

> `domain_name` は dev と prd で **同じ値** にすること。dev は data source で prd の hosted zone を参照する。

### 3. bootstrap (state バックエンドを作る)

```bash
cd infra/terraform/aws/bootstrap
terraform init    # 初回のみ
terraform plan
terraform apply

# 作成された bucket 名を確認
terraform output
# s3_bucket_name = "my-app-tfstate-20260614"
```

bootstrap だけは local state (S3 と chicken-and-egg のため)。生成された `terraform.tfstate` はリポジトリに含めない (`.gitignore` 済み)。

State lock は別途 DynamoDB を作らず、Terraform 1.10+ の S3 ネイティブロック (`use_lockfile = true`) で同じバケット内のロックファイルを使う。

### 4. backend.tf の bucket を bootstrap 出力に差し替え

`account/backend.tf` と `env/{dev,prd}/backend.tf` の `bucket` を、作成したリソース名に書き換える。

```hcl
terraform {
  backend "s3" {
    bucket       = "my-app-tfstate-20260614" # ← bootstrap output に差し替え
    key          = "prd/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

### 5. account (ECR + GitHub Actions OIDC)

GitHub Actions が AssumeRole する IAM role と、API / worker / migration の ECR レジストリを作成する。本 layer の apply は **ローカルから実行する**（CI が assume している role 自身を書き換えるため、初回および role rename 系の変更はローカル apply 必須。詳細は [`infra/terraform/CLAUDE.md`](../../infra/terraform/CLAUDE.md) 参照）。

```bash
cd infra/terraform/aws/account
terraform init
terraform apply

# 次手順で使う role ARN を控えておく
terraform output -raw github_actions_dev_role_arn
terraform output -raw github_actions_prd_role_arn
```

ここで出した 2 つの role ARN は手順 6 で GitHub Environment の Secret に登録する。

### 6. GitHub Environments の作成と AWS_ROLE_ARN 登録

GitHub リポジトリの **Settings → Environments** から下表の 3 つを作成し、各 Environment の **Secrets** に `AWS_ROLE_ARN`（手順 5 で出力した値）を登録する。account 側の OIDC role の trust policy はこの Environment 名（`dev` / `prd` / `prd-api-approval`）を sub claim で受け取って AssumeRole を許可しているので、**Environment 名は完全一致**で作る必要がある。

| GitHub Environment | 用途 | Required reviewers | Deployment branches | `AWS_ROLE_ARN` に入れる値 |
|---|---|---|---|---|
| `dev` | dev の deploy / terraform apply | 任意 | 任意 | `github_actions_dev_role_arn` |
| `prd` | prd の deploy / terraform apply | 任意 | `main` 推奨 | `github_actions_prd_role_arn` |
| `prd-api-approval` | `deploy-aws-prd.yml` の `approve-api` job の承認ゲート | **必須**（リリース承認者を 1 名以上） | `main` 推奨 | `github_actions_prd_role_arn` |

#### `prd-api-approval` の挙動

`deploy-aws-prd.yml` の `approve-api` job がこの Environment を参照しているため、prd の本番デプロイ時に GitHub Actions UI に「Review pending deployments」ボタンが出る。承認フロー:

- **Approve**: `approve-api` job が走り、SSM パラメータ `/project-template-prd-api/deploy/approval` を `approved` に書き換え → ECS の deployment hook Lambda が SUCCEEDED を返し、本番トラフィックシフト + 5 分 bake に進む
- **Reject**: `reject-api` job (cleanup) が SSM を `rejected` に書き換え → Blue/Green が自動 rollback

dev は rolling deploy で承認ゲートを持たないため、`dev-api-approval` のような Environment は不要。

### 7. env/prd を apply (hosted zone を所有)

prd を **dev より先に** apply すること。`env/prd` で `aws_route53_zone.primary` を作り、dev はそれを data source で読む構造。

ここから先の apply は GitHub Actions の `terraform-aws-env-apply.yml` (workflow_dispatch) からも実行できる。CI 経由の場合は手順 6 の Environment 登録が完了している必要がある（`AWS_ROLE_ARN` secret が無いと AssumeRole に失敗する）。

```bash
cd infra/terraform/aws/env/prd
terraform init
terraform apply

# Route53 zone と API URL を確認
terraform output route53_name_servers   # ← 4 つの NS が出力される
terraform output api_url                # 例: https://api.my-app.com
```

### 8. ドメインレジストラに NS を登録 (DNS 委任)

手順 7 で出力された 4 つの NS レコードを、ドメインを購入したレジストラ (Route 53 Registrar / お名前.com / Cloudflare 等) のネームサーバー設定画面で登録する。これを終えないと:

- DNS が引けないので ACM 証明書の DNS 検証が完了しない (apply は通るが Certificate が PENDING_VALIDATION のまま)
- `api.<domain>` でアクセスできない

伝播確認:

```bash
dig +short NS my-app.com    # ← 手順 7 の name_servers と一致するか確認
dig +short api.my-app.com   # ← ALB の DNS 名が返ってくれば OK
```

### 9. env/dev を apply (prd の hosted zone を参照)

```bash
cd infra/terraform/aws/env/dev
terraform init
terraform apply

# dev の API URL を確認
terraform output api_url    # 例: https://api.dev.my-app.com
```

### 10. seed-secrets.sh で外部 Secret を投入

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

### 11. deploy workflow で ECR にイメージを push

ここまでで env apply は完了しているが、ECR がまだ空なので ECS task は `CannotPullContainerError` で起動失敗している状態。`ecs_api` / `ecs_worker` の `desired_count` は **最初から `1`** に設定してあり、後から書き換える運用は取らない。代わりに deploy workflow を回して image を push すれば、ECS が自動で再 pull して正常化する。

- dev: GitHub Actions → `Deploy to AWS dev` を `workflow_dispatch` で実行
- prd: GitHub Actions → `Deploy to AWS prd` を `workflow_dispatch` で実行（`approve-api` job で Required reviewers の承認が必要）

両 workflow は以下を 1 回の run でこなす:

1. API / worker / migration の image を build → ECR に push（コミット SHA タグ）
2. migration task definition を新 image に更新して `aws ecs run-task` で Prisma migration を実行
3. ECS service の task definition を新 image に書き換えてデプロイ（dev: rolling 完走 / prd: Blue/Green + 承認待ち）

初回 run 完了後、ECS service は正常に task を pull / 起動できる状態になる。
