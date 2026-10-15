# TODO — admin を実プロジェクトで使えるテンプレートにする

apps/admin のデモと土台を分け、admin 認証・API に繋いだユーザー管理・データを外から渡すヘッダー・Tooltip を揃え、実プロジェクトではデモを消すだけで使い始められる状態にする。

- 対象: 設計書 `docs/spec/admin-template/`（未作成）→ 設計書 PR → 実装 PR（step ごと。設計書 PR の上に順に積む）
- 判断: `judge-yourself.md` の Q1〜Q6 はすべて推奨案で確定（2026-10-15）

## 1. 調査

- [x] admin の現状（デモ・ヘッダー・認証・API 接続）を洗い出す
- [x] web / api の認証の仕組みを確認する
- [x] JWT の secret の配布経路を確認する
- [x] 本番 DB でコマンドを流す経路を確認する
- [ ] TailAdmin demo の Tooltip・テーブル・詳細画面の見た目を確認する

## 2. 設計書

- [ ] README（仕様 / 設計）を書く
- [ ] step1: デモの隔離
- [ ] step2: ブランド設定の集約
- [ ] step3: Tooltip コンポーネント
- [ ] step4: admins テーブルと admin 認証
- [ ] step5: ユーザー管理画面
- [ ] step6: ヘッダー部品にデータを外から渡す
- [ ] docs/spec/README.md に追記する

## 3. 設計書 PR

- [ ] 設計書用ブランチを切って PR を出す

## 4. 実装（設計書 PR の上に積む）

- [ ] step1 の PR
- [ ] step2 の PR
- [ ] step3 の PR
- [ ] step4 の PR
- [ ] step5 の PR
- [ ] step6 の PR

## 5. 完了

- [ ] すべての PR を main にマージする
- [ ] docs/spec/README.md の状態を「完了」にする
- [ ] TODO.md / judge-yourself.md を削除する
