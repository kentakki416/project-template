# 行動イベント基盤：MVP 対象外の設計

[`README.md`](./README.md) の MVP では見送った項目と、着手するときの設計案。

## 目次

- [ログ経由の配送](#ログ経由の配送)
- [BigQuery など他バックエンドへの移行](#bigquery-など他バックエンドへの移行)
- [匿名ユーザーの追跡](#匿名ユーザーの追跡)
- [DB 状態のレプリケーション](#db-状態のレプリケーション)
- [admin への分析画面](#admin-への分析画面)

## ログ経由の配送

### 着手トリガー

- **サービスが多言語化**し、各言語に `@repo/events` 相当を用意するのが辛くなった
- **api を serverless（Lambda 等）に移し**、常駐 worker が使えなくなった
- **既に Vector / Fluent Bit を運用**していて、宛先を 1 つ足すだけで済む状況になった

### 対象範囲

| | MVP（Queue 経由） | ログ経由に切り替えた後 |
| --- | --- | --- |
| アプリ側 | `@repo/queue` に enqueue | `logger` に構造化 JSON を出すだけ |
| 運搬 | Redis + `apps/worker` | Vector / Fluent Bit |
| 新しいインフラ | なし（既存） | **Vector 等の常駐プロセス** |
| 欠落耐性 | BullMQ のリトライ | Vector のディスクバッファ + リトライ |
| 運用ログとの関係 | 完全に別経路 | **同じ stdout に混ざるため再分離が必要** |

### 設計案

`EventTracker` の interface はそのままに、実装だけ差し替える。**service 層のコードは 1 行も変わらない。**

```
QueueEventTracker  →  LogEventTracker
                        ↓ logger.info({ type: "event", ... })
                      stdout
                        ↓ Vector が type: "event" だけを抽出
                      ClickHouse
```

`TrackedEvent` 型をそのまま JSON にして出せるので、**型安全性は維持できる**（`logger.info("memo_deleted")` のような生の文字列呼び出しにはしない）。

運用ログと同じ stdout に流れるため、Vector 側で `type` フィールドによるルーティングが必須になる。ここを怠ると、分けたはずの運用ログが ClickHouse に混入する。

### 現在の AWS 構成との差分

現状 ECS は `awslogs` ドライバで CloudWatch Logs に送っている（`infra/terraform/aws/modules/ecs-workload/main.tf`）。ここから ClickHouse に流すには次のどちらかが必要になる。

- **サイドカーで Vector を常駐させる**（タスク定義にコンテナを 1 つ追加）
- **CloudWatch subscription filter → Kinesis Firehose → 変換 → ClickHouse**（AWS 側の配管が増える）

### このアプローチが解決しないこと

**`POST /api/events` は残る。** `apps/mobile` はユーザーの端末で動くため収集できる stdout がなく、web の `memo_viewed` もブラウザ側の出来事だからである。ログ経由にしても**クライアント起点のイベントはネットワークを越える必要がある**ため、構成は単純にならない。

節約できるのはサーバー側（api / worker / cron）の送出だけ。

### 着手時のチェックリスト

- [ ] `EventTracker` の interface が変わっていないか確認する
- [ ] Vector の設定で `type: "event"` 以外（= 運用ログ）が ClickHouse に混入しないことを確認する
- [ ] Vector のディスクバッファ上限と、溢れたときの挙動を決める
- [ ] ローカル開発でも Vector を動かすか、開発時は Queue 実装のままにするかを決める
- [ ] `POST /api/events` 側の経路は変更不要であることを確認する

## BigQuery など他バックエンドへの移行

### 着手トリガー

- 組織のデータ基盤が既に BigQuery に寄っていて、**そこに集約した方が分析者にとって都合が良い**
- ClickHouse の運用（アップグレード・バックアップ・スケール）が負担になった
- マネージドサービスに寄せてインフラ管理を減らしたくなった

### 対象範囲

`@repo/data-warehouse` を技術名ではなく役割名にしているのはこのため。`DataWarehouse` interface の実装を 1 つ足し、factory の分岐を 1 つ増やすだけで済むようにしてある。

| | 変更が必要か |
| --- | --- |
| `apps/worker` の `EventRepository` | ❌ 不要（`DataWarehouse` にしか依存していない） |
| ジョブハンドラ・`@repo/events`・`apps/api` | ❌ 不要 |
| `createDataWarehouse` の分岐 | ✅ `"bigquery"` を追加 |
| `BigQueryDataWarehouse` 実装 | ✅ 新規 |
| **テーブル定義（DDL）** | ✅ **新規に書き直す**（抽象化の対象外） |
| 分析クエリ | ✅ SQL 方言が違うので書き直す |

### 注意: interface は意図的に狭い

`DataWarehouse` が `insertAll` と `close` しか持たないのは、**ClickHouse と BigQuery の差が大きく、汎用 API を作ると必ず漏れる**ため。

| | ClickHouse | BigQuery |
| --- | --- | --- |
| 挿入 | 大きなバッチが有利。小さな INSERT を大量に受けるとマージ負荷で劣化 | ストリーミング挿入に行単位のクォータと課金がある |
| エラー | throw | **部分失敗を戻り値で返す**（throw しない） |
| 論理単位 | database | dataset |
| パーティション / TTL | `PARTITION BY` / `TTL` | パーティション列 + 有効期限（構文が別物） |
| 重複排除 | `ReplacingMergeTree` | **同等機能なし**。`insertId` による best-effort か、クエリ側で `ROW_NUMBER()` 等で排除 |

最後の行が移行時の最大の争点になる。現設計は BullMQ の at-least-once を `ReplacingMergeTree` で吸収しているが、BigQuery にはこれが無い。

### 着手時のチェックリスト

- [ ] `DataWarehouse` interface が `insertAll` / `close` のままか確認する（増えていたら両実装を揃える）
- [ ] **重複排除の方針を決める**（`insertId` による best-effort か、クエリ側で排除するか）
- [ ] BigQuery 側の DDL を書く（パーティション列と有効期限）
- [ ] ストリーミング挿入のクォータと課金見積もりを確認する
- [ ] 既存データを移行するか、ある時点から切り替えるだけにするかを決める
- [ ] `apps/worker/src/env.ts` の `DATA_WAREHOUSE_*` で表現できるか確認する（できなければ env 名を見直す）

## 匿名ユーザーの追跡

### 着手トリガー

- **獲得ファネル**（訪問 → 登録 → 初回利用）を分析したくなった
- 「登録に至らなかった人がどこで離脱したか」を知りたくなった

### 対象範囲

| | MVP | 匿名追跡を入れた後 |
| --- | --- | --- |
| 対象 | ログイン済みユーザーのみ | 未ログインの訪問者も含む |
| 識別子 | `user_id` のみ | `anonymous_id` + ログイン後に `user_id` と紐付け |
| 同意 | 不要 | **要検討**（Cookie 同意・プライバシーポリシー） |

### 設計案

- `anonymous_id`（UUID）を first-party cookie に発行する
- ログイン成功時に `identify` イベントを送り、`anonymous_id` ↔ `user_id` の対応表を別テーブルに保存する
- 分析時は対応表で join し、ログイン前の行動を遡って本人のものとして扱う

### 着手時のチェックリスト

- [ ] `events` テーブルに `anonymous_id` カラムを追加（既存行は空になるので集計クエリの条件を見直す）
- [ ] `user_id` を必須から nullable に変更する
- [ ] Cookie 同意の要否を法務観点で確認する
- [ ] プライバシーポリシーに追記する
- [ ] `POST /api/events` を未認証でも受け付けるようにする（現在は認証必須）

## DB 状態のレプリケーション

### 着手トリガー

- 「ユーザー数の推移」「メモ数の分布」のような **状態の集計** を ClickHouse 側で完結させたくなった
- 分析クエリがアプリ DB に負荷をかけ始めた

### 対象範囲

行動イベントとは逆に、**Postgres にある状態はいつでも取り込み直せる**ため急がない。日次のスナップショット取り込みで足りることが多い。

### 設計案

- 素朴な案: `apps/cron` に日次タスクを追加し、`users` / `memos` を全件 SELECT して ClickHouse に洗い替える
- 規模が大きくなったら CDC（Debezium 等）を検討する

### 着手時のチェックリスト

- [ ] 洗い替えとイベントで時刻の意味がずれないよう、スナップショット日時を持たせる
- [ ] 全件 SELECT がアプリ DB に与える負荷を確認する（read replica を使う）

## admin への分析画面

### 着手トリガー

- 非エンジニアが自分で数字を見たいと言い始めた

### 設計案

MVP では ClickHouse に直接クエリする運用（エンジニアが SQL を書く）で足りる。画面が必要になったら、まず Metabase / Redash のような BI ツールを ClickHouse に繋ぐことを検討し、**admin に作り込むのは最後の手段**にする。自前実装は要件が固まる前に作ると確実に作り直しになる。
