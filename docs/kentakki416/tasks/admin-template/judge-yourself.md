# judge-yourself.md

**回答があるまで、下記に関わる設計・ドキュメント・コードは fix しない。**

- 対象: 設計書 `docs/spec/admin-template/`（未作成）
- 作業の流れ: `TODO.md`
- ステータス: **回答待ち（未 fix）**

各項目の「あなたの回答」欄に記号か自由記述を書いてください。

---

## Q1 — admin のサインイン方法を何にするか

- web は Google OAuth → 自前の JWT。code から user info を取る処理（`GoogleOAuthClient`）と JWT の発行は api にあり、admin からも使える
- admins テーブルを users と分けることは決定済み。どの案でも「admins に登録された人だけ入れる」にする
- TailAdmin の `SignInForm` は email + パスワード入力と Google / X ボタンの見た目
- api には全体のレート制限（`apiRateLimiter`）がある。メール送信の仕組みは無い

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | Google OAuth（admins に email を事前登録した人だけ通す）**（推奨）** | パスワードを保存しない（ハッシュ・リセット・ロックアウトが要らない）/ 既存の Google クライアントと JWT 発行をそのまま使える / 2 段階認証は Google アカウント側に任せられる | Google アカウントを持たない運用者は入れない / Google Cloud の OAuth クライアントに admin の redirect URI を環境ごとに足す / ローカル用に Google を通さない dev ログインが別に要る（web の dev-login と同じ作りにする） |
| b | email + パスワード | 外部サービスに依存しない / TailAdmin の `SignInForm` をほぼそのまま使える / Google 側の設定が要らない | パスワードハッシュ（argon2 等）の依存が増える / パスワードリセット（メール送信）・総当たり対策・ロックアウトを自前で作る / パスワード漏洩の責任をこちらが持つ |
| c | 両方（admin ごとに選べる） | 運用者の事情に合わせられる | a と b の実装と運用の負担を両方持つ / テンプレートとしての量が倍になる |

> **推奨は a。** テンプレートが作り込みを強いられる部分（リセット・ロックアウト・ハッシュ）を丸ごと避けられる。web と同じ流れなので、実装と `docs/onboarding/auth.md` の説明がそのまま通じる。

**あなたの回答**:

---

## Q2 — admin のトークンを一般ユーザーのトークンとどう区別するか

- 今の JWT は `{ userId }` だけを入れ、`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` で署名している
- 同じ secret で署名すると、種別の確認を 1 か所忘れただけで user のトークンが admin API を通る（逆も同じ）
- secret は `apps/api/.env.local`（dotenvx）、Terraform の dev / min / prd（`random_password` + Secrets Manager + ECS の `secret_keys`）、`deploy-aws-min.yml`、`turbo.json` に並んでいる
- cookie はポートが違っても同じホストなら共有されるため、admin の cookie 名は web と分ける（どの案でも行う）

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | admin 専用の secret を足す（`JWT_ADMIN_ACCESS_SECRET` / `JWT_ADMIN_REFRESH_SECRET`）**（推奨）** | user のトークンは admin の検証で必ず失敗する（確認漏れがあっても通らない）/ admin の鍵だけを個別に作り直せる | env が 2 つ増え、dotenvx・Terraform 3 環境・deploy workflow・`turbo.json` に追加が要る（Terraform は apply が要る） |
| b | secret は共通にし、payload に種別（`typ: "admin"` / `"user"`）を入れて検証時に確認する | env・Terraform の変更が要らない | 種別の確認を忘れるとそのまま権限の取り違えになる / 既存の user トークンには種別が無いので「種別なし = user」と扱う分岐が残る / 鍵が漏れたら user と admin を同時に失効させるしかない |

> **推奨は a。** 権限の境界を「確認を忘れないこと」ではなく鍵の違いで守れる。増える作業は env の追加だけで、Terraform は既存の `random_password` の並びに 2 つ足す形になる。

**あなたの回答**:

---

## Q3 — 本番で最初の admin をどう登録するか

- 2 人目以降は「admin が admin を追加する画面」があれば足りるが、今回の範囲には入れていない。最初の 1 人はどの案でも画面の外で作る
- ローカルは seed で dev 用の admin を入れる（どの案でも行う）
- 本番 DB には、deploy 済みの migration イメージを ECS で起動する workflow（`postgres-migrate.yml` + `run-deployed-migration`）がある

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | env に許可リスト（`ADMIN_BOOTSTRAP_EMAILS`）を置き、その email で初回ログインしたら admins に作る | DB に触らずに済む / Terraform で env を足すだけ | env を消し忘れると、その Google アカウントが乗っ取られたとき admin を作られる / 「admins に居る人だけ」の原則に例外ができる / Q1 で b（パスワード）を選ぶと初期パスワードの扱いが別に要る |
| b | admin を作るコマンドを packages/db に用意し、migration と同じ経路（workflow_dispatch で ECS の run-task）で流す **（推奨）** | admins テーブルだけが正になる / 実行の記録（Actions のログ）が残る / 2 人目以降の追加にも使える | コマンドと workflow と手順（`docs/onboarding/deploy-prd.md`）を作る / 実行に GitHub Actions の権限が要る |
| c | 手順書に SQL を書き、DB に直接 INSERT する | 作るものが無い | 本番 DB に直接繋ぐ経路と権限が要る / 打ち間違いを防げない / 記録が残らない |

> **推奨は b。** 認証の原則（admins に居る人だけ）に例外を作らず、既存の migration の実行経路に乗るので新しい権限も要らない。

**あなたの回答**:

---

## Q4 — ユーザー一覧の検索・絞り込み・ページングをどこで行うか

- 既存の `DataTable` は受け取った配列をブラウザ側で検索・絞り込み・ページ分けする（全件を渡す前提）
- api の既存の一覧（memo）はページングが無く全件返す
- users は増え続けるテーブルで、件数の上限が読めない

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | サーバー側。api が検索語・絞り込み・`page` / `per_page` を受けて総件数と 1 ページ分を返す。`DataTable` に URL の検索パラメータと連動するモードを足し、今のブラウザ側のモードも残す **（推奨）** | 件数が増えても 1 ページ分しか運ばない / 条件が URL に残り、リロード・共有・戻るで状態が保たれる / 実プロジェクトの一覧画面の見本になる | api にページングと検索の契約（スキーマ・Repository の件数取得）を足す / `DataTable` のモードが 2 つになり props が増える / 入力のたびに api を呼ぶので間引き（debounce）が要る |
| b | ブラウザ側。api は全件返し、今の `DataTable` で絞る | api も `DataTable` も今のまま使え、実装が小さい / 絞り込みが即時 | 件数に比例して api の応答と画面が重くなる / 実プロジェクトでは結局 a に作り直すことになり、見本として使えない |

> **推奨は a。** 見本の役目は「実プロジェクトでそのまま真似できること」。b は件数が増えた時点で作り直しになる。

**あなたの回答**:

---

## Q5 — ユーザー一覧の絞り込み項目を何にするか

- users の列は id / name / email / avatar_url / created_at / updated_at だけ
- ログイン方法は auth_accounts.provider（google / dev）で取れる
- `@repo/domain` に会員種別の定数 `MEMBERSHIP_TIERS`（bronze / silver / gold）があるが、どのテーブルにも列が無い
- 名前・email の部分一致の検索はどの案でも入れる

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | 既存の列だけで作る。ログイン方法（provider）と登録日（期間）**（推奨）** | users の形を変えない（web への影響が無い）/ migration が要らない | provider の絞り込みは auth_accounts との JOIN になる / 「区分で絞る」select の見本が provider だけになる |
| b | users に会員種別の列を足して絞り込みに使う（ログイン方法・登録日も入れる） | domain の定数 → `z.enum` → DB の CHECK 制約の流れを実際のテーブルで見せられる / select の絞り込みの見本として自然 | admin の見本のために一般ユーザーのデータモデルを変える（migration・seed・web の user 型に波及）/ 会員種別を使わないプロジェクトでは最初に列を消す作業が要る |

> **推奨は a。** 見本のためにユーザーのデータモデルを変えると、実プロジェクトで最初にやる作業が「消す」になる。

**あなたの回答**:

---

## Q6 — `ADMIN_USE_DUMMY`（DB なしでダミーデータを返すモード）を残すか

- `apps/admin/CLAUDE.md`・`apps/admin/README.md`・`apps/api/CLAUDE.md`・`docs/onboarding/auth.md` に「DB なしでダミーデータが返る」と書かれているが、実装は api の `env.ts` の定義だけで、使っている箇所が無い（admin 向け API も 0 本）
- ローカルは docker compose で Postgres と Redis が立ち、seed で dev データが入る
- admin 認証を入れると、admin の画面は admins テーブル（DB）なしでは開けなくなる

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | 消す（env の定義と各ドキュメントの記述を削除する）**（推奨）** | 書いてあるのに動かない状態が無くなる / Repository を本物とダミーの 2 系統持たずに済む | DB を立てずに admin の画面を触る手段が無くなる（docker compose の起動が要る） |
| b | 実装する（admin 向け API でダミーの Repository を使う） | DB なしで画面開発ができる | admin 向けの Repository ごとにダミー実装を書き続ける / 認証（admins テーブル）もダミーにしないと画面が開けず、本番で有効になると認証を素通りする危険がある |

> **推奨は a。** ローカルは docker compose + seed で本物のデータが揃うので、ダミーを保守する理由が薄い。認証を素通りできるモードは本番に紛れ込んだときの影響が大きい。

**あなたの回答**:

---

## 回答があるまで私がやらないこと

- README（仕様 / 設計）を書く（Q1〜Q6）
- step4: admins テーブルと admin 認証の設計書と PR（Q1 Q2 Q3 Q6）
- step5: ユーザー管理画面の設計書と PR（Q4 Q5）
