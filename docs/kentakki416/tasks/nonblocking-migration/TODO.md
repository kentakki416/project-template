# TODO — ノンブロッキングなマイグレーション

index の追加・カラムの追加や制約の変更・データの移行を、書き込みを止めずに本番へ適用できる仕組みが入った状態にする。

- 対象: 設計書 `docs/spec/nonblocking-migration/`（このブランチ）→ 実装 PR（step ごと、base は main）
- 判断待ち: `judge-yourself.md` の Q1〜Q4（⏸ 印の項目）

## 1. 調査

- [x] 現状の手順と穴を洗い出す
- [x] botchan-platform の仕組みを読む
- [x] drizzle-kit の挙動を使い捨ての DB で確かめる
- [x] deploy の migrate ジョブと待ち方を確認する
- [x] squawk のルールを確認する

## 2. 設計書

- [x] README の案を書く（推奨案で仮置き）
- [x] docs/spec/README.md に追記する
- [ ] ⏸ Q1〜Q4 回答を README に反映して確定する
- [ ] ⏸ Q1 step1: オンライン操作
- [ ] step2: lock_timeout と待ちの上限
- [ ] ⏸ Q3 step3: 危険な DDL の検出
- [ ] ⏸ Q2 step4: バックフィル
- [ ] step5: ドキュメントの書き換え

## 3. 実装

- [ ] ⏸ Q1 step1 の PR
- [ ] step2 の PR
- [ ] ⏸ Q3 step3 の PR
- [ ] ⏸ Q2 step4 の PR
- [ ] step5 の PR
- [ ] min（PgBouncer 経由）で動作を確かめる

## 4. 完了

- [ ] docs/spec/README.md の状態を「完了」にする
- [ ] TODO.md / judge-yourself.md を削除する
