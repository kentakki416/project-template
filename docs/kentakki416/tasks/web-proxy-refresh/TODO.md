# TODO — web のトークンの更新を proxy で行う

web の api-client が Server Component から refresh すると cookie を書けずにセッションが切れる問題を直す。admin-template（#116）で決めた作りに合わせる。

- 対象: main 向けの修正 PR（admin-template とは独立）
- 判断: admin-template の方針（proxy で refresh・api-client は cookie を書かない・401 は cookie を消してからサインイン画面へ）をそのまま使う。新しい判断は無い

## 1. 調査

- [x] api-client を呼んでいる箇所を洗い出す
- [ ] 公開ページ（memo・events）での optional 認証への影響を確認する

## 2. 実装

- [ ] proxy で refresh する
- [ ] api-client から refresh と cookie の書き込みを外す
- [ ] 401 で cookie を消してサインイン画面へ送る Route Handler
- [ ] page.tsx の try/catch を見直す
- [ ] docs/onboarding/auth.md・apps/web/CLAUDE.md を直す

## 3. 確認と PR

- [ ] 画面で動作を確認する
- [ ] PR を出す
