# infra/terraform

AWS デプロイ用の Infrastructure as Code (Terraform)。

## 構造

```
aws/
├── bootstrap/    # S3 backend のみ（state lock は S3 ネイティブの use_lockfile、初回のみ apply、local state）
├── account/      # OIDC provider / GitHub Actions IAM role / ECR（AWS アカウント単位で共有、remote state）
├── env/          # 環境別設定（dev / staging / prod、remote state）
└── modules/      # 再利用可能な Terraform モジュール
```

リソースの「生存期間」で 3 層に分かれている:

- **bootstrap**: 一度きり apply。chicken-and-egg のため local state
- **account**: アカウント単位で共有するリソース（OIDC, ECR）。env をまたいで使う
- **env**: 環境ごとに分離するリソース（VPC, ECS, RDS, ALB ...）

## Commands

```bash
cd aws/env/dev
terraform init    # 初回のみ
terraform plan    # 変更プレビュー
terraform apply   # デプロイ
terraform destroy # 削除

# Lint / Validate
terraform fmt -check -recursive -diff
terraform validate
tflint --init
tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
trivy config aws/env/dev -c .trivy.yml
```

## IAM ポリシーの記述規約

IAM の trust policy / permission policy は `jsonencode()` のインライン記述を使わず、必ず `data "aws_iam_policy_document"` に切り出して resource 名で識別できるようにする:

- **trust policy**: `data "aws_iam_policy_document" "{role名}_trust"`（attach 先 `aws_iam_role` の resource 名 + `_trust` suffix）
- **permission policy**: attach 先の `aws_iam_policy` / `aws_iam_role_policy` と同じ resource 名（suffix なし = permission と識別）
- data source は参照する resource の**直前**に配置する
- permission policy の statement には `sid` を付けて自己文書化する（単純な service trust は省略可）
- attach 先 resource が `count` 付きで、policy document がその counted resource を参照する場合のみ、data source 側にも同じ `count` を付ける
- ECR lifecycle policy など IAM policy document ではない JSON は対象外（`jsonencode` のまま）

```hcl
/** trust policy の例 */
data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}
```

## CI/CD 運用

GitHub Actions で apply を管理する:

| 層 | CI (PR で plan) | CD (手動 apply) |
|---|---|---|
| `bootstrap` | なし（local state、CI 対象外） | ローカルで `terraform apply` |
| `account` | `terraform-aws-account-ci.yml` | `terraform-aws-account-apply.yml`（workflow_dispatch） |
| `env/dev` | `terraform-aws-env-ci.yml` | `terraform-aws-env-apply.yml`（workflow_dispatch） |

リリース頻度が大きく違うため env/dev と account でワークフローを分離している。fmt と tflint は `terraform-aws-env-ci.yml` 側で aws/ 配下を recursive にチェックするため、`terraform-aws-account-ci.yml` 側は validate / trivy / plan のみ実施する。

### account の初回 apply はローカルから実行

`account/` の GitHub Actions IAM role を作成・変更するときは、CI が assume する role 自身を書き換えるため、**初回 (および role を rename/replace する変更) はローカルで `terraform apply`** する必要がある。

```bash
cd infra/terraform/aws/account
terraform apply
# apply 後、新しい dev role の ARN を取得して GitHub Settings → Environments → dev →
# Secrets の AWS_ROLE_ARN を再登録する
terraform output -raw github_actions_dev_role_arn
```

secret 更新後は次回以降の変更を `terraform-aws-account-apply.yml` から普通に実行可能。

### OIDC role が壊れた時の fallback

`account/` の apply で OIDC role の trust policy を壊すと、GitHub Actions が自分自身を AssumeRole できなくなり CI 経由の apply が不可能になる。その場合はローカルから AWS root 資格情報で `cd infra/terraform/aws/account && terraform apply` を実行して復旧する。

## 注意事項

- **AWS CLI で `aws configure` を済ませた上で実行**する
- Terraform state は S3 + S3 ネイティブロック（`use_lockfile = true`、Terraform 1.10+）構成（bootstrap で構成済み）
- `tflint` および `trivy` でセキュリティ/ポリシーチェックを行う
