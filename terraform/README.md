# Terraform Infrastructure

![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)

## 概要

本プロジェクトのAWSインフラストラクチャをTerraformで管理しています。

## インフラ構成図

[`docs/infrastructure.drawio`](docs/infrastructure.drawio) に draw.io 形式のインフラ構成図があります。

```
┌─────────────────────────────────────────────────────────────┐
│ AWS Cloud                                                   │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ VPC (10.0.0.0/16)                                     │  │
│  │                                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐             │  │
│  │  │ Public Subnet   │  │ Public Subnet   │             │  │
│  │  │ AZ-a            │  │ AZ-c            │             │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │             │  │
│  │  │  │    ALB    │◄─┼──┼──┤ Internet  │  │             │  │
│  │  │  └───────────┘  │  │  │  Gateway  │  │             │  │
│  │  │  ┌───────────┐  │  │  └───────────┘  │             │  │
│  │  │  │ NAT GW    │  │  │                 │             │  │
│  │  │  └─────┬─────┘  │  │                 │             │  │
│  │  └────────┼────────┘  └─────────────────┘             │  │
│  │           │                                           │  │
│  │  ┌────────┼────────┐  ┌─────────────────┐             │  │
│  │  │ Private Subnet  │  │ Private Subnet  │             │  │
│  │  │ AZ-a            │  │ AZ-c            │             │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  ┌───────┐ │  │
│  │  │  │ ECS       │  │  │  │ ECS       │  │  │ ECR   │ │  │
│  │  │  │ Fargate   │  │  │  │ Fargate   │  │  │       │ │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  └───────┘ │  │
│  │  └─────────────────┘  └─────────────────┘             │  │
│  │                                                       │  │
│  │  ┌─────────────────┐                                  │  │
│  │  │ CloudWatch Logs │                                  │  │
│  │  └─────────────────┘                                  │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## ディレクトリ構成

```
terraform/
├── aws/
│   ├── bootstrap/        # S3バックエンド・DynamoDBステートロック
│   ├── env/
│   │   └── dev/          # 開発環境の設定
│   └── modules/
│       ├── alb/          # Application Load Balancer
│       ├── ecr/          # Elastic Container Registry
│       ├── ecs/          # ECS Fargate クラスター・サービス
│       └── vpc/          # VPC・サブネット・セキュリティグループ
├── .checkov.yml          # Checkovポリシー設定
├── .tflint.hcl           # TFLint設定
├── .trivy.yml            # Trivy設定
└── README.md
```

## クイックスタート

### 必要なツール

```bash
brew install terraform
brew install tfsec
python3 -m pip install checkov
brew install trivy
```

### AWS認証

ローカルで実行する場合、管理者からシークレット情報をもらい、AWS認証情報を設定してください。

```bash
aws configure
export AWS_DEFAULT_REGION="ap-northeast-1"
```

### Terraform 初期化

```bash
cd aws/env/dev
terraform init
```

## 実行コマンド

### 差分検知

```bash
cd aws/env/dev
terraform plan
```

### デプロイ

```bash
cd aws/env/dev
terraform apply
```

### 削除

```bash
cd aws/env/dev
terraform destroy
```

## 開発コマンド

### フォーマット整形

```bash
terraform fmt -check -recursive -diff
```

### バリデーションチェック

```bash
cd aws/env/dev
terraform validate
```

### TFLint

```bash
tflint --init
tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
```

### Checkov ポリシーチェック

```bash
checkov -d . --framework terraform --config-file .checkov.yml
```

## セキュリティチェック

### Trivy 脆弱性チェック

```bash
trivy config aws/env/dev -c .trivy.yml
```

## Terraformモジュール一覧

| モジュール | 説明 |
|-----------|------|
| `vpc` | VPC、サブネット（パブリック/プライベート）、Internet Gateway、NAT Gateway、ルートテーブル、セキュリティグループ |
| `alb` | Application Load Balancer、ターゲットグループ、リスナー |
| `ecs` | ECS Fargate クラスター、タスク定義、サービス、IAMロール、CloudWatch Logs |
| `ecr` | Elastic Container Registry（Dockerイメージ管理） |
