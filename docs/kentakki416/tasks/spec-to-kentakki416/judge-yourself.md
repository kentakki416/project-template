# judge-yourself.md

**回答があるまで、下記に関わる設計・ドキュメント・コードは fix しない。**

- 対象: main から `docs/spec/` を削除する PR（未作成）
- 作業の流れ: `TODO.md`
- ステータス: **回答待ち（未 fix）**

各項目の「あなたの回答」欄に記号か自由記述を書いてください。

---

## Q1 — main に残る `docs/spec/` への参照（57 行・39 ファイル）をどうするか

`docs/spec/` を消すと、main の次の箇所が存在しないパスを指す。

- コード・Terraform・workflow・Dockerfile のコメント「設計: docs/spec/...」: 約 30 行（`apps/api/src`、`packages/*/src`、`infra/terraform`、`.github/workflows` など）
- markdown のリンク: 13 行（`docs/tech-stack/clickhouse/`、`docs/tech-stack/bullmq.md`、`packages/events/README.md`、`packages/data-warehouse/README.md`、ルートの `README.md`）
- `CLAUDE.md` 類の本文: 5 行（ルート、`apps/api`、`apps/admin`、`infra/terraform`）
- `.claude/`（design-mock skill と README）: 8 行
- うち 2 行は今も存在しないパス（`docs/spec/shared-packages/`、`docs/spec/aws-deploy/`）

どの案でも、ルート `CLAUDE.md` の「設計書は `docs/spec/{feature}/` に置く」と、`.claude/` の design-mock skill・README は「`kentakki416` ブランチの `docs/spec/` に置く」に書き換え、ルート `README.md` の索引の行は消す。

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | パスの記載は残す。ルート `CLAUDE.md` に「`docs/spec/` は `kentakki416` ブランチにある」と 1 か所書き、markdown のリンクだけはリンクを外してパスの文字列にする **（推奨）** | 差分が小さい（約 15 行）/ コードから設計の理由に辿る道が残る（`git show kentakki416:docs/spec/...`）/ 存在しない 2 行だけ消せば済む | main だけを見る人には、開けないパスが約 40 行残る / ブランチ名に依存した案内になる |
| b | 参照をすべて消す | main に切れた参照が残らない | 57 行・39 ファイルの差分 / 「なぜこうなっているか」をコードから辿れなくなる |
| c | 理由の要点を `docs/tech-stack/` や `docs/onboarding/` に移し、参照をそちらに付け替える | main だけで理由が読める | 作業が大きい（設計書を読み直して要約する）/ 設計書と要約の二重管理になる |

> **推奨は a。** 設計書を読むのは実質このブランチを持つ人だけで、パスが残っていれば辿れる。c は「main に設計書は不要」という方針と逆向きに文書を増やす。

**あなたの回答**:

---

## 回答があるまで私がやらないこと

- main から `docs/spec/` を削除する PR の作成（参照の直し方で差分が変わるため、まとめて 1 つの PR にする）
