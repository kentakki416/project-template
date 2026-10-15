# apps/cron

定期実行されるタスク群を 1 つの Node.js プロセスにまとめたパッケージ。

## 目次

- [タスク一覧](#タスク一覧)
- [セットアップ](#セットアップ)
- [コーディング規約](#コーディング規約)
- [スケジュール（TODO）](#スケジュールtodo)

## タスク一覧

| コマンド | 用途 |
| --- | --- |
| `pnpm cleanup:old-memos` | 古い memo を一括削除する DB cleanup の例 |

## セットアップ

```bash
# ルートで一度だけ
pnpm install
```

## コーディング規約

- **`task/<name>.ts`**: cron 1 本 = 1 ファイル。`runTask` で包み、受け取った DB client で Repository を組み立てて service に DI するだけで、閾値計算や件数集計などのロジックは書かない
- **`service/<domain>/`**: ロジックはここに集約する。env や DB client は直接触らず、現在時刻・閾値などの入力と Repository を引数で受ける（task と unit test から同じ形で呼べる）。Repository は 1 つでも `repo: { xxxRepository }` のオブジェクトで受ける
- **`repository/`**: interface は `repository/<name>.ts`、Drizzle 実装は `repository/drizzle/`。interface は api / worker と共有せず、cron が使う batch 系の操作だけを持つ
- **env**: `src/env.ts` は import した時点で検証し、不正なら exit 1 で止まる。task は先頭で `import { env } from "../env"` するだけでよい
- **失敗と中断**: 失敗は throw するだけでよい。DB の切断と終了コード（失敗は 1、シグナルによる中断は `128 + シグナル番号`）は `src/run-task.ts` が持つ
- **中断に備える**: シグナルを受けると task の完了を待たずに終了する（実行中の DB クエリの完了だけ待ってから切断する）。ループの中でシグナルを見て break する処理は書かず、途中で止まっても次の実行で続きから拾い直せる処理にする
- **コメント**: 層の責務や DI の流れ、終了コードの扱いなど、コードを読めば分かることはコメントに書かない。共通の決まりはこの規約に書く

## スケジュール（TODO）

スケジューラ側 (EventBridge / GitHub Actions / Kubernetes CronJob) の設定は本リポジトリにまだ含めていません。本番運用時は以下のいずれかで定期起動する想定:

- **AWS**: EventBridge Schedule → ECS Scheduled Task で `node dist/task/<name>.js` を起動
- **GitHub Actions**: `.github/workflows/cron-*.yml` で `schedule:` トリガーを設定し `pnpm --filter cron <task>` を実行
- **Kubernetes**: CronJob で `node dist/task/<name>.js`

