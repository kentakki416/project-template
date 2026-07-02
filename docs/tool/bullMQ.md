# BullMQ

[`@repo/queue`](../../packages/queue/README.md) のデフォルト Queue 実装に使っているジョブキューライブラリ。

## 目次

- [概要](#概要)
- [主な特徴](#主な特徴)
- [他のジョブキューとの比較（SQS / Cloud Tasks）](#他のジョブキューとの比較sqs--cloud-tasks)
- [参考リンク](#参考リンク)

## 概要

**BullMQ は Redis をバックエンドにした Node.js 製のジョブキュー**（旧 `bull` の後継、TypeScript 製）。producer がジョブ（データ）を Redis に積み、worker が **pull 型**（ブロッキングで能動的に取りに行く）で取り出して処理する。配信保証は **at-least-once**。

キューの状態（待機 / 実行中 / 完了 / 失敗 / 遅延）はすべて Redis に永続化され、操作は Lua スクリプトでアトミックに行われるため、プロセスが落ちてもジョブが失われにくい。

## 主な特徴

| 特徴 | 説明 |
| --- | --- |
| **Redis 永続化** | ジョブと状態を Redis に保存。worker が落ちても再起動で再開できる |
| **pull 型** | worker が Redis をブロッキングで待ち受け、能動的にジョブを取得 |
| **at-least-once** | 完了するまでジョブは消えず、stalled / リトライで **複数回実行されうる** → ハンドラは冪等に書く |
| **リトライ + backoff** | 失敗ジョブを `attempts` 回まで自動再試行（`exponential` / `fixed`） |
| **遅延 / 繰り返し** | `delay` で「N ミリ秒後」、cron 式で定期実行 |
| **並行数 / 優先度 / レート制限** | worker ごとの `concurrency`、ジョブ優先度、単位時間あたりの処理数制限 |
| **stalled 検出** | worker が突然死したジョブを検出して別 worker が再処理 |
| **自動クリーンアップ / Flows** | `removeOnComplete` / `removeOnFail`、親子ジョブの依存（`FlowProducer`） |

## 他のジョブキューとの比較（SQS / Cloud Tasks）

`@repo/queue` は実装を差し替え可能（[設計の意図](../../packages/queue/README.md#設計の意図)）なので、乗り換え先候補との違いを整理する。

| 観点 | **BullMQ** | **Amazon SQS** | **Google Cloud Tasks** |
| --- | --- | --- | --- |
| バックエンド | Redis（**自前運用**） | フルマネージド | フルマネージド |
| 配信モデル | **pull**（worker がブロッキング取得） | **pull**（long polling） | **push**（HTTP エンドポイントへ配信） |
| 配信保証 | at-least-once | at-least-once（FIFO キューは exactly-once 風） | at-least-once |
| 順序保証 | 基本なし（同一優先度はほぼ投入順） | 標準: なし / **FIFO キュー: 厳密順序** | なし |
| 遅延・スケジュール | あり | あり（最大 15 分） | あり（指定時刻、長期も可） |
| リトライ | `attempts` + backoff をネイティブ指定 | 可視性タイムアウト + DLQ（backoff 曲線は無し） | リトライ回数 + min/max backoff をネイティブ指定 |
| レート制限 | worker concurrency / rate limiter | （基本なし、スループットでスケール） | dispatch rate / 同時実行数をネイティブ指定 |
| メッセージ最大サイズ | Redis 依存（大きめも可） | 256 KB（超過は S3 併用） | 約 1 MB（HTTP body） |
| 運用コスト | Redis の運用が必要 | 不要 | 不要 |

要点:
- **pull か push か** が worker 構成に直結する。BullMQ / SQS は worker がポーリングする常駐型、Cloud Tasks は HTTP ハンドラに push されるので「常駐 worker 不要」にできる。
- **どれも at-least-once** が基本。厳密な順序や重複排除が要るなら SQS FIFO のような専用機能が要る。BullMQ で乗り換えても**冪等性の前提は変わらない**。
- **運用 vs マネージド**: BullMQ は Redis を自前で持つ分コントロールが効くが運用責任を負う。SQS / Cloud Tasks は運用不要な代わりにサイズ上限や機能の制約がある。

## 参考リンク

- 公式ドキュメント: https://docs.bullmq.io/
- GitHub: https://github.com/taskforcesh/bullmq
