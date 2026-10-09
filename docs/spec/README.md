# 機能仕様クイックリファレンス

このプロジェクトで実装されている / 設計中の機能の一覧です。各機能の詳細は `./{feature}/README.md` を参照してください。

このファイルは `design-feature` skill で新機能を設計するたびに更新されます。

## 目次

- [機能一覧](#機能一覧)
- [ステータスの定義](#ステータスの定義)
- [運用ルール](#運用ルール)

## 機能一覧

| 機能名 | ステータス | 概要 | リンク |
|---|---|---|---|
| user-behavior-events | 設計中 | ユーザー行動を時系列イベントとして ClickHouse に蓄積する。DB に痕跡が残らない操作（削除・閲覧・離脱）を優先して記録し、運用ログとは別系統にする | [./user-behavior-events/README.md](./user-behavior-events/README.md) |
| minimal-deploy | 設計中 | アイドル時の固定費をほぼゼロにした本番構成（Lambda + API Gateway + PlanetScale + Upstash、月 ~$7。worker は必要なときだけ Fargate Spot で作る）。実装は env で切り替え、同じアプリ・同じイメージを minimal と prd（ECS）の両方にデプロイできるようにする | [./minimal-deploy/README.md](./minimal-deploy/README.md) |
| dev-login | 完了 | 開発環境専用ログイン。Google OAuth を介さず seed 済み dev ユーザー（alice/bob）として 1 クリックでログインできる | [./dev-login/README.md](./dev-login/README.md) |

## ステータスの定義

- **設計中**: `docs/spec/{feature}/README.md` および `tasks/step*.md` を作成中。実装には未着手
- **実装中**: 設計が完了し、コードを実装中。一部の step が完了している場合もこのステータス
- **完了**: 全 step が実装され、テストが通っている

## 運用ルール

- 新機能を作るときは `design-feature` skill を使い、このファイルにエントリを必ず追加する
- ステータスが変わったらこのファイルも更新する
- 不要になった機能は削除し、過去の経緯を `docs/spec/{feature}/README.md` に記録してから機能ディレクトリ自体をアーカイブ（必要に応じて）
