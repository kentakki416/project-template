# TODO — ClickHouse の migration コマンドと deploy への組み込み

ClickHouse の DDL（events / CDC の view）を版管理して local / dev / min / prd に適用でき、deploy がフラグを見て ClickHouse・CDC の反映要否を判定できる状態にする。

- 対象: 設計書 `docs/spec/clickhouse-migration/`（このブランチ）→ 設計書 PR → 実装 PR（step ごと）
- 判断待ち: `judge-yourself.md` の Q1〜Q6（⏸ 印の項目）

## 1. 調査

- [x] ClickHouse の DDL の置き場所と適用方法を洗い出す
- [x] deploy / Terraform の migration 構成を確認する
- [x] ClickPipes の変更ケースごとの挙動を調べる
- [x] MaterializedPostgreSQL の変更時の挙動を調べる
- [x] view の列が作成時に固定されることを実機で確認する
- [x] migration ツールと Drizzle / Atlas の対応状況を比較する
- [x] ClickPipes の Terraform 対応と RDS の前提条件を調べる

## 2. 設計書

- [ ] ⏸ Q1〜Q6 README（仕様 / 設計）を書く
- [ ] ⏸ Q1 Q5 step: migration コマンドと view の管理
- [ ] ⏸ Q2 Q3 step: Terraform のフラグと ClickHouse Cloud / ClickPipe
- [ ] ⏸ Q6 step: RDS の論理レプリケーションと接続経路
- [ ] ⏸ Q4 step: deploy workflow への組み込み
- [ ] ⏸ Q1 step: ローカルの init スクリプトを migration に移す
- [ ] docs/spec/README.md に追記する

## 3. 設計書 PR

- [ ] 設計書用ブランチを切って PR を出す

## 4. 実装

- [ ] ⏸ step ごとに PR を積む（設計書 PR の上）

## 5. 完了

- [ ] data-warehouse / db / ルートの README を更新する
- [ ] TODO.md / judge-yourself.md を削除する
