# TODO — 設計書を main から外して kentakki416 だけで管理する

`docs/spec/` がどのブランチからも無くなり、設計書がこのブランチの `docs/kentakki416/tasks/{feature}/` にだけある状態にする。main の規約と参照もそれに合わせる。

- 対象: main から削除する PR（#135、base は main）/ このブランチの `docs/kentakki416/tasks/`
- 判断: `judge-yourself.md` の Q1 は a 案で PR を作成済み（明示の回答は無し）

## 1. 調査

- [x] main とこのブランチの docs/spec の差を確認する
- [x] main で docs/spec を参照している箇所を洗い出す
- [x] docs/spec を触る未マージの PR が無いことを確認する

## 2. このブランチへ移す

- [x] main の docs/spec を取り込む
- [x] push する
- [x] docs/spec を docs/kentakki416/tasks に移す
- [x] 移した設計書の相対リンクとパスの表記を直す
- [ ] push する（ユーザーに依頼）

## 3. main から消す

- [x] docs/spec を削除する
- [x] CLAUDE.md の設計書の置き場所を書き換える
- [x] ルート README の索引から外す
- [x] .claude の design-mock skill の置き場所を書き換える
- [x] コードとドキュメントに残る参照を直す（a 案）
- [x] PR を出す（#135）
- [ ] 置き場所の変更（docs/kentakki416/tasks）を PR に反映する
- [ ] セルフレビューの指摘を直す
- [ ] マージする

## 4. skill とメモ

- [x] design-feature / design-step / design-mock skill の置き場所を書き換える
- [x] 「設計書の PR を先に出す」の運用メモを直す

## 5. 完了

- [ ] TODO.md / judge-yourself.md を削除する
