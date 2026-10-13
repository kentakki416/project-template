# judge-yourself.md

**回答があるまで、下記に関わる設計・ドキュメント・コードは fix しない。**

- 対象: 設計書 `docs/spec/clickhouse-migration/`（未作成）
- 作業の流れ: `TODO.md`
- ステータス: **回答済み（全 Q 推奨案。2026-10-14）**。設計書に反映中

各項目の「あなたの回答」欄に記号か自由記述を書いてください。

---

## Q1 — ClickHouse の migration ツールに何を使うか

- Drizzle は ClickHouse に対応していない（drizzle-kit の dialect に無く、ClickHouse dialect の PR #6125 は未マージ）
- golang-migrate は HTTPS（8443）で繋げず、既定の履歴テーブル（TinyLog）が ClickHouse Cloud で使えないため候補から外した
- ClickHouse の DDL はトランザクションが無い。どのツールでも途中で失敗したファイルは再実行になるので、DDL は `IF NOT EXISTS` などで冪等に書く前提
- local と Cloud で CDC のメタ列と DB 名が違う（`_sign` / `_peerdb_is_deleted`）ので、SQL に環境変数を差し込めることが要る

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | npm の `clickhouse-migrations` **（推奨）** | worker と同じ `@clickhouse/client`（HTTPS 8443）で動き、pnpm と既存の migration イメージ（Node）にそのまま載る / `${VAR}` の置換で local と Cloud の差を 1 ファイルに書ける / 無料（MIT）、最終リリース 2026-09 | 個人のリポジトリ（VVVi/clickhouse-migrations）/ ロックが無い（deploy の concurrency で直列化する前提）/ down migration が無い / 毎回作り直す view（Q5 a）は自前で数十行足す |
| b | Atlas | 宣言的に差分を出せ、view も「あるべき姿」に収束させられる / lint と公式の GitHub Action がある | ClickHouse のドライバは有料の Atlas Pro だけ（$9/開発者/月 + CI/CD は $59/月で DB 2 つまで、追加 $39/DB/月。dev / min / prd で約 $98/月〜）/ CI に Atlas Cloud のトークンが要る / native の 9440 で接続する / Cloud から読むと `Shared*` エンジンになり、ローカルとの差を調整する設定が要る |
| c | goose | ClickHouse 公式が推奨している / `${VAR}` の置換がある / MIT | Go のバイナリを migration イメージと各開発者の手元に入れる / 全ファイルに `-- +goose NO TRANSACTION` が要る / Cloud へは native の 9440（HTTPS は未確認） |
| d | dbmate | npm で入る / `clickhouse+https` で 8443 に繋がる | SQL の中で環境変数を置換できず、local と Cloud で別ファイルになる / 後続の文が失敗しても適用済みとして記録される不具合が未解決（issue #675） |

> **推奨は a。** Node・HTTPS・環境変数の置換を既存構成のまま満たすのは a だけ。Atlas の宣言的管理は、対象が events と view 数個の規模では約 $98/月〜の費用に見合わない。migration ファイルは素の SQL なので、後でツールを替えても書き直しはほぼ無い。

**あなたの回答**: a（推奨案。2026-10-14）

---

## Q2 — ClickHouse と CDC のフラグを 1 つにするか 2 つにするか

- CDC を張るには、RDS の `rds.logical_replication=1`（パラメータグループの変更 + **再起動**）、レプリケーション用ユーザー、ClickPipes からの接続経路（Q6）が要る。ClickHouse（events）だけならどれも要らない
- フラグは dev / min / prd の `variables.tf` に置く。min の `enable_worker` と同じく CI の apply は変数を渡さないので、既定値を変えてコミットして切り替える
- 既定値は dev=false / min=false / prd=true を想定。min は今 `DATA_WAREHOUSE_TYPE=clickhouse`（接続先は dummy）なので、false にすると worker は `none` に変わる

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | 2 つ: `enable_data_warehouse` と `enable_cdc`（後者は前者が true のときだけ有効） **（推奨）** | dev で events だけ見たいときに RDS の再起動や接続経路が付いてこない / CDC の前提（RDS 設定・接続経路）を CDC の有無に閉じ込められる | 組み合わせが 3 通りになり、Terraform と migration の両方に CDC 有無の分岐が要る |
| b | 1 つ: `enable_data_warehouse`（true なら CDC も張る） | 分岐が少ない / 環境間で構成が揃う | ClickHouse を立てるだけで RDS の再起動と接続経路（bastion など）が付いてくる |

> **推奨は a。** CDC の前提は RDS の再起動を伴うほど重く、events だけ欲しい場面と切り離せた方がよい。

**あなたの回答**: a（推奨案。2026-10-14）

---

## Q3 — ClickHouse Cloud のサービスと ClickPipe を何で作るか

- 今は prd でもサービスは Terraform の管理外で、接続情報は dummy の placeholder
- ClickHouse 公式の Terraform provider（`ClickHouse/clickhouse`、最新 v3.38.0 / 2026-10-12）で、サービス（`clickhouse_service`。アイドル時に止める設定あり）と Postgres CDC の ClickPipe（`clickhouse_clickpipe`。v3.14.0 で GA）を作れる。同期するテーブルは `table_mappings` に宣言し、追加・削除は 1 回の apply で済む
- 既存の mapping の設定を変えることはできず、外す → apply → 戻す（= そのテーブルの再取り込み）になる
- Terraform の apply は deploy と別の手動 workflow。Postgres にテーブルが無いと ClickPipe に追加できないので、a では「CDC 対象テーブルの追加」が deploy（Drizzle）→ apply（ClickPipe に追加）→ 次の migration（view 作成）の順になる
- a / b ともに ClickHouse Cloud の API キー（organization 単位）を CI に持たせる

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | サービスも ClickPipe も Terraform で作る **（推奨）** | フラグが本当に「作る / 作らない」を決める / 同期するテーブルの一覧がコードレビューを通る / サービスのパスワードを Secrets Manager に直接書け、dummy の placeholder が無くなる | Cloud の API キーを Terraform の CI に置く / テーブルの追加・削除が deploy → apply → migration の 3 段になる |
| b | サービスは Terraform、ClickPipe のテーブルの追加・削除は deploy が OpenAPI で行う | テーブル追加が 1 回の deploy で完結する（Drizzle → ClickPipe に追加 → view） | Terraform と deploy の両方が ClickPipe を触るのでドリフト対策（`ignore_changes` など）が要る / 差分を取って API を叩くスクリプトを自前で持つ / API キーが deploy 側にも要る |
| c | どちらも手動（コンソール）。Terraform は接続情報の配線だけ | API キーを CI に置かない | フラグが作成を制御しない / テーブルの一覧がコードに残らず、環境ごとにずれる |

> **推奨は a。** 「infra 側で作るかどうかを決める」という要件をそのまま満たし、同期対象がコードに残る。3 段になるのはテーブルの追加・削除のときだけで、頻度は低い。

**あなたの回答**: a（推奨案。2026-10-14）

---

## Q4 — ClickHouse の migration を deploy のどこで流し、要否をどう判定するか

- 今の `migrate` job は Drizzle 専用イメージの ECS one-shot タスクを run-task する。タスクが受け取る secret は `DATABASE_URL` だけ
- min は worker の ECS Service があるかどうかで worker の deploy 要否を判定している（Terraform の `enable_worker` が唯一の正本）
- GitHub Actions の runner から ClickHouse Cloud に直接繋ぐには、Cloud の IP 許可リストを GitHub の runner 全体に開ける必要がある

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | 別の one-shot タスク（`{env}-dwh-migration`）を `enable_data_warehouse` のときだけ Terraform で作る。workflow はその task definition の有無で job を実行 / skip し、CDC の有無はタスクの環境変数で渡す **（推奨）** | 判定の正本が Terraform のフラグ 1 箇所（min の worker と同じ作法）/ skip が GitHub の画面で見える / ClickHouse の失敗で api の deploy が止まらない（待つのは worker だけ） | Terraform の task definition と workflow の job が 3 環境分増える |
| b | 既存の migration タスクで Drizzle に続けて流し、コマンド側が `DATA_WAREHOUSE_TYPE=none` なら何もせず終わる | workflow の変更がほぼ無い / Drizzle → ClickHouse の順序が自然に保証される | ClickHouse の失敗で api を含む全 deploy が止まる / skip したかどうかはログを見ないと分からない / Drizzle 用タスクに ClickHouse の秘密情報が渡る |
| c | runner から直接 ClickHouse に繋ぎ、GitHub Environment の変数で判定する | ECS タスクが要らない | Terraform のフラグと GitHub の変数の二重管理 / Cloud の IP 許可リストを GitHub の runner 全体に開ける / 秘密情報を GitHub にも複製する |

> **推奨は a。** 判定の正本を Terraform のフラグに一本化でき、ClickHouse は分析用なので、その失敗で api の deploy まで止めない方がよい。

**あなたの回答**: a（推奨案。2026-10-14）

---

## Q5 — CDC の view をどう管理するか

- view の列は作成時に固定される（実機で確認。元テーブルに列を足しても view に出ず、列を消すと view を読むクエリが落ちる）。`CREATE OR REPLACE VIEW` で作り直すと追随する
- ClickPipes: 列の追加は自動で反映されるが、**そのテーブルに次の書き込みが来たとき**に反映される。列の削除は反映されず、ClickHouse 側に列が残って以降は NULL になる。型の変更・列名の変更は自動では追随せず、再取り込みが要る
- ローカルの MaterializedPostgreSQL は、列の追加・削除・型の変更のどれでもそのテーブルの同期を止める。テーブルを外して付け直す（全件の再取り込み）と戻る

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | 毎回作り直す: view を `SELECT * EXCEPT (メタ列) REPLACE (...)` で定義し、migration のたびに全 view を `CREATE OR REPLACE` する **（推奨）** | 列の追加（ケース 3）で ClickHouse 側のファイルを書かなくてよい / ClickPipes への反映が遅れても、次の実行で追いつき失敗しない | view の列は「その時点の ClickHouse のテーブル」に従う。列の削除（ケース 5）は view の `EXCEPT` に列名を足して隠す運用が要る / view の変更履歴は git にしか残らない |
| b | 版管理する: view を明示した列で定義し、Postgres の列を変えるたびに migration を書く | view が列の契約になり、環境間で列が必ず一致する / 履歴が migration として残る | Postgres の列を変えるたびに ClickHouse の migration も要る / Cloud では列の反映前に migration が走ると view の作成が失敗するので、待ち合わせかリトライが要る |

> **推奨は a。** ClickPipes の列の反映が「次の書き込み」まで遅れるため、b は deploy のタイミング次第で失敗する。a なら Postgres 側の列追加に ClickHouse 側の作業が要らない。

**あなたの回答**: a（推奨案。2026-10-14）

---

## Q6 — ClickPipes から RDS（dev / prd）への接続経路をどうするか

- RDS は外に出られない isolated subnet にあり、ClickHouse Cloud 側の ClickPipes から直接は届かない
- ClickPipes が対応する経路は「IP 許可リスト」「AWS PrivateLink（VPC resource）」「SSH トンネル」の 3 つ
- min は PlanetScale Postgres で公開エンドポイントのため、経路は要らない（ClickPipes は PlanetScale に対応。ただし PlanetScale Postgres 自体が early access）
- ClickHouse Cloud の Basic tier には Private Networking が無い。ClickPipes の PrivateLink がどの tier で使えるかは未確認。AWS の料金表では VPC リソースの利用側に $0.10/時（約 $73/月）かかる（ClickHouse 側に転嫁されるかは未確認）

| | 選択肢 | メリット | デメリット |
|---|---|---|---|
| a | SSH トンネル: public subnet に bastion（EC2）を置き、ClickPipes の固定 IP からだけ 22 番を許可する **（推奨）** | Basic tier でも使える / 月 $10 未満（t4g.nano + public IPv4）/ 鍵は provider の `clickhouse_clickpipes_ssh_key` で Terraform 管理できる | EC2 を 1 台運用する（OS の更新）/ インターネットに SSH の口が開く（IP で絞る） |
| b | AWS PrivateLink（VPC resource） | インターネットに口を開けない / 運用するサーバーが無い | Basic tier で使えない可能性が高く、使えなければ上位 tier の費用になる / VPC リソースの時間課金（約 $73/月相当。負担先は未確認）/ リージョンをまたげない |
| c | RDS を public にして ClickPipes の IP を許可する | 追加のサーバーも費用もほぼ無い | DB がインターネットから到達可能になる / 今の isolated subnet から移す変更が要る |

> **推奨は a。** dev / prd とも Basic tier のまま安く組め、Terraform で完結する。CDC は `enable_cdc` のときだけなので、bastion もそのときだけ作る。

**あなたの回答**: a（推奨案。2026-10-14）

---

## 回答があるまで私がやらないこと

- 設計書 README（仕様 / 設計）を書く（Q1〜Q6）
- step: migration コマンドと view の管理（Q1, Q5）
- step: Terraform のフラグと ClickHouse Cloud / ClickPipe（Q2, Q3）
- step: RDS の論理レプリケーションと接続経路（Q6）
- step: deploy workflow への組み込み（Q4）
- step: ローカルの init スクリプトを migration に移す（Q1）
- 実装 PR
