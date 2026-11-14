# TODO — 設計書を main から外して kentakki416 だけで管理する

`docs/spec/` が main から無くなり、このブランチにだけある状態にする。main の規約と参照もそれに合わせる。

- 対象: main から削除する PR（base は main）/ このブランチの `docs/spec/`
- 判断待ち: `judge-yourself.md` の Q1（⏸ 印の項目）

## 1. 調査

- [x] main とこのブランチの docs/spec の差を確認する
- [x] main で docs/spec を参照している箇所を洗い出す
- [x] docs/spec を触る未マージの PR が無いことを確認する

## 2. このブランチへ移す

- [x] main の docs/spec を取り込む
- [ ] push する（ユーザーに依頼）

## 3. main から消す

- [ ] docs/spec を削除する
- [ ] CLAUDE.md の設計書の置き場所を書き換える
- [ ] ルート README の索引から外す
- [ ] .claude の design-mock skill と README の置き場所を書き換える
- [ ] ⏸ Q1 コードとドキュメントに残る参照を直す
- [ ] PR を出す

## 4. 完了

- [ ] 「設計書の PR を先に出す」の運用メモを直す
- [ ] TODO.md / judge-yourself.md を削除する
