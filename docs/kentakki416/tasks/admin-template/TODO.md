# TODO — admin を実プロジェクトで使えるテンプレートにする

apps/admin のデモと土台を分け、admin 認証・API に繋いだユーザー管理・データを外から渡すヘッダー・Tooltip を揃え、実プロジェクトではデモを消すだけで使い始められる状態にする。

- 対象: 設計書 `docs/kentakki416/tasks/admin-template/`（#116）→ 実装 PR（step ごと。base は常に main。前の step のマージ後に main の上に作り直して出す）
- 判断: `judge-yourself.md` の Q1〜Q6 はすべて推奨案で確定（2026-10-15）

## 1. 調査

- [x] admin の現状（デモ・ヘッダー・認証・API 接続）を洗い出す
- [x] web / api の認証の仕組みを確認する
- [x] JWT の secret の配布経路を確認する
- [x] 本番 DB でコマンドを流す経路を確認する
- [x] TailAdmin demo の Tooltip・テーブル・詳細画面の見た目を確認する
- [x] デモと土台の部品・画像・依存を洗い出す

## 2. 設計書

- [x] README（仕様 / 設計）を書く
- [x] step1: デモの隔離
- [x] step2: アプリの設定
- [x] step3: Tooltip
- [x] step4: admin 認証（api・鍵・登録 workflow）
- [x] step5: admin 認証（画面）
- [x] step6: ユーザー管理
- [x] step7: ヘッダー・マイページ
- [x] docs/kentakki416/tasks/README.md に追記する
- [x] コードと突き合わせてレビューする
- [x] ユーザーに内容と step の切り方を確認する

## 3. 設計書 PR

- [x] 設計書用ブランチを切って PR を出す（#116）
- [x] セルフレビューと CodeRabbit の指摘を直す

## 4. 実装（base は main）

- [x] step1 の PR（#119）
- [x] step2 の PR（#120）
- [x] step3 の PR（#121）
- [x] step1〜3 を main に入れ直す（#123。#119〜#121 は途中のブランチにマージされていた）
- [x] step4 の PR（#122。base を main に変更）
- [x] step5 の PR（#124）
- [x] step6 を実装する（手元。step5 のマージ後に PR）
- [ ] step6 の PR
- [x] step7 を実装する（手元。step6 のマージ後に PR）
- [ ] step7 の PR

## 5. 完了

- [ ] すべての PR を main にマージする
- [ ] docs/kentakki416/tasks/README.md の状態を「完了」にする
- [ ] TODO.md / judge-yourself.md を削除する
