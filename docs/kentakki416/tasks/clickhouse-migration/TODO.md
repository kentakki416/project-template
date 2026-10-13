# TODO — ClickHouse の migration コマンドと deploy への組み込み

ClickHouse の DDL（events / CDC の view）を版管理して local / dev / min / prd に適用でき、deploy がフラグを見て ClickHouse・CDC の反映要否を判定できる状態にする。

- 対象: 設計書 `docs/spec/clickhouse-migration/`（このブランチ）→ 設計書 PR → 実装 PR（step ごと）
- 判断: `judge-yourself.md` の Q1〜Q6 はすべて推奨案（a）で確定

## 1. 調査

- [x] ClickHouse の DDL の置き場所と適用方法を洗い出す
- [x] deploy / Terraform の migration 構成を確認する
- [x] ClickPipes の変更ケースごとの挙動を調べる
- [x] MaterializedPostgreSQL の変更時の挙動を調べる
- [x] view の列が作成時に固定されることを実機で確認する
- [x] migration ツールと Drizzle / Atlas の対応状況を比較する
- [x] ClickPipes の Terraform 対応と RDS の前提条件を調べる
- [x] ローカルの CDC の付け直しが効かないことを実機で確認する

## 2. 設計書

- [x] README（仕様 / 設計）を書く
- [x] step1: migration コマンドとローカル
- [x] step2: Terraform の enable_data_warehouse
- [x] step3: Terraform の enable_cdc（ClickPipes / bastion / RDS）
- [x] step4: deploy workflow への組み込み
- [x] deferred（CDC の運用強化）を書く
- [x] docs/spec/README.md に追記する

## 3. 設計書 PR

- [x] 設計書用ブランチを切って PR を出す（#109）

## 4. 実装（設計書 PR の上に積む）

- [x] step1 の PR（#110）
- [x] step2 の PR（#111）
- [ ] step3 の PR
- [ ] step4 の PR

## 5. 完了

- [ ] AWS 上の動作確認（dev）
- [ ] TODO.md / judge-yourself.md を削除する
