# TODO — ノンブロッキングなマイグレーション

index の追加・カラムの追加や制約の変更・データの移行を、書き込みを止めずに本番へ適用できる仕組みが入った状態にする。

- 対象: 設計書 `docs/kentakki416/tasks/nonblocking-migration/`（このブランチ）→ 実装 PR（step ごと、base は main）
- 判断: `judge-yourself.md` の全 Q 回答済み（Q1: a、Q2: 仕組みは作らず手動、Q3: c、Q4: a）
- 進め方: 1 つの PR にまとめず、step ごとに 1 つずつ進める

## 1. 調査

- [x] 現状の手順と穴を洗い出す
- [x] botchan-platform の仕組みを読む
- [x] drizzle-kit の挙動を使い捨ての DB で確かめる
- [x] deploy の migrate ジョブと待ち方を確認する
- [x] squawk のルールを確認する
- [x] squawk を drizzle-kit の SQL にかけて、CI で検出できるか確かめる

## 2. 設計書

- [x] README の案を書く
- [x] docs/kentakki416/tasks/README.md に追記する
- [x] Q1〜Q4 の回答を README に反映する
- [x] step1: index の作成・削除（オンライン操作）

## 3. 実装

- [x] step1 の PR（#136。2026-11-14 に main へマージ）
- [x] step1 のセルフレビューの指摘を直す（3 回。フォルダの順に交互に流す作りに変更）
- [ ] 止まる変更と書き方・埋め戻しのやり方を drizzle.md に書く（PR #137。レビュー中）

## 4. 保留（行数の多いテーブルができてから）

- [ ] VALIDATE CONSTRAINT を online.sql に足す
- [ ] lock_timeout と、deploy の待ちの上限
- [ ] 危険な DDL の検出（squawk。調査済み）
- [ ] バックフィルの仕組み（今は手動で流す方針）
- [ ] min（PgBouncer 経由）と ECS で動作を確かめる

## 5. 完了

- [ ] docs/kentakki416/tasks/README.md の状態を更新する
- [ ] TODO.md / judge-yourself.md を削除する
