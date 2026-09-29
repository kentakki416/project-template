# 行動イベント基盤：MVP 対象外の設計

[`README.md`](./README.md) の MVP では見送った項目と、着手するときの設計案。

## 目次

- [Queue 経由の配送](#queue-経由の配送)
- [匿名ユーザーの追跡](#匿名ユーザーの追跡)
- [DB 状態のレプリケーション](#db-状態のレプリケーション)
- [admin への分析画面](#admin-への分析画面)

## Queue 経由の配送

### 着手トリガー

- イベントを **課金・請求・監査の根拠** に使うことになった
- ClickHouse の障害中に落ちたイベントが業務上問題になった
- ClickHouse への書き込み遅延が API のレイテンシに影響し始めた（MVP は `await` しないので通常は影響しない）

### 対象範囲

| | MVP | Queue 経由に切り替えた後 |
| --- | --- | --- |
| 送出 | service から ClickHouse へ直接 | service → `@repo/queue` に enqueue |
| 書き込み | API プロセス | `apps/worker` が消費して ClickHouse へ |
| 欠落 | 許容（プロセス終了時などに落ちる） | BullMQ のリトライで担保 |
| 依存 | ClickHouse | ClickHouse + Redis |

### 設計案

`EventTracker` の interface はそのままに、実装を差し替える。

```
ClickHouseEventTracker  →  QueueEventTracker
                              ↓ enqueue
                           apps/worker の track-event ジョブ
                              ↓
                           ClickHouse
```

`EventTracker` を interface にしておく理由がこれで、**service 層のコードは 1 行も変わらない**。`apps/api/src/index.ts` の DI 組み立てだけを差し替える。

ジョブは冪等にする必要がある（BullMQ は at-least-once）。`event_id` を ClickHouse 側の重複排除キーにしておけば、同じイベントが 2 回届いても `ReplacingMergeTree` か `SELECT DISTINCT` で吸収できる。

### 着手時のチェックリスト

- [ ] `EventTracker` の interface が変わっていないか確認する（変わっていたら両実装を揃える）
- [ ] `packages/queue` に `track-event` の Job 型と queue 名を追加
- [ ] `apps/worker` にジョブハンドラを追加し `consumers` に登録
- [ ] ClickHouse のテーブルを `ReplacingMergeTree(event_id)` に変更するか、集計側で重複排除する
- [ ] worker が落ちている間のキュー滞留量を監視できるようにする

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
