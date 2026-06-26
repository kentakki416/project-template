# @repo/storage

バイナリ（PNG / SVG 等）を保存して公開 URL を返す **汎用ストレージ抽象 + 実装 + factory** を提供する共有パッケージ。**全 app（api / worker / cron 等）で利用する**。

## 役割

- `Storage` インターフェース（`save` / `delete`）のみに責務を絞った generic な抽象
- ローカル開発用の `LocalStorage`（filesystem）と本番用の `S3Storage`（S3）を実装として提供
- `createStorage(config)` factory で env 由来の設定から実装を 1 つ選択（strategy）
- 「達成カード画像」等のドメイン的な意味は **呼び出し側が持つ**（変数名 `cardStorage` 等）。本パッケージは特定用途に依存しない

## 公開 API

```ts
import { createStorage, LocalStorage, S3Storage, type Storage, type StorageConfig } from "@repo/storage"
```

| Export | 用途 |
| --- | --- |
| `Storage` | `save(key, body)` / `delete(key)` を持つストレージ抽象 |
| `createStorage(config)` | `StorageConfig` から実装を選択する factory |
| `StorageConfig` | `local` / `s3` の判別可能 union |
| `LocalStorage` | filesystem 実装（ローカル開発向け） |
| `S3Storage` | S3 実装（本番向け） |

### `Storage` インターフェース

| メソッド | 説明 |
| --- | --- |
| `save(key, body)` | `body`（Buffer）を `key` で保存し公開 URL を返す。ContentType は `key` の拡張子から推定 |
| `delete(key)` | 保存済みオブジェクトを削除。存在しない場合は no-op |

### `StorageConfig`

```ts
/** ローカル filesystem */
{ type: "local", baseDir: string, publicUrlPrefix: string }

/** S3 */
{ type: "s3", bucket: string, publicUrlBase: string, region?: string }
```

## 使い方

### factory 経由（推奨）

各 app の `src/index.ts` で env から `StorageConfig` を組み立て、factory を 1 回呼んで Repository / Service に DI する。

```ts
// apps/worker/src/index.ts
import { createStorage } from "@repo/storage"

const storage =
  env.STORAGE_TYPE === "s3"
    ? createStorage({
        type: "s3",
        bucket: env.S3_BUCKET,
        publicUrlBase: env.S3_PUBLIC_URL_BASE,
        region: env.AWS_REGION,
      })
    : createStorage({
        type: "local",
        baseDir: env.STORAGE_LOCAL_DIR,
        publicUrlPrefix: env.STORAGE_LOCAL_URL_PREFIX,
      })

const url = await storage.save("badges/123.png", pngBuffer)
```

### 実装を直接 new する

特定実装に固定したい箇所では `LocalStorage` / `S3Storage` を直接生成してもよい。

```ts
import { S3Storage } from "@repo/storage"

const storage = new S3Storage("my-bucket", "https://cdn.example.com", "ap-northeast-1")
```

## 環境変数

各 app の `src/env.ts` で宣言・検証する（本パッケージは `process.env` を直接読まない。`createStorage` に値で渡す）。`S3Storage` は AWS SDK の標準 credential chain（環境変数 / IAM ロール等）で認証する。

| 変数（例） | 説明 |
| --- | --- |
| `STORAGE_TYPE` | `local` / `s3` の切り替え |
| `S3_BUCKET` / `S3_PUBLIC_URL_BASE` / `AWS_REGION` | `s3` 用 |
| `STORAGE_LOCAL_DIR` / `STORAGE_LOCAL_URL_PREFIX` | `local` 用 |

## 新しいバックエンドの追加（GCS 等）

1. `Storage` を実装したクラスを追加（例: `gcs-storage.ts`）
2. `StorageConfig` の union に `{ type: "gcs", ... }` を追加
3. `createStorage` の `switch` に `case "gcs"` を追加

抽象 (`Storage`) は変えずに union と factory を増やすだけで拡張できる。

## ディレクトリ構成

```
packages/storage/
└── src/
    ├── storage.ts        # Storage 抽象（interface）
    ├── local-storage.ts  # filesystem 実装
    ├── s3-storage.ts     # S3 実装 + ContentType 推定
    ├── create-storage.ts # StorageConfig + createStorage factory
    └── index.ts          # 公開 API の barrel
```

## 設計詳細

→ [`docs/spec/shared-packages/README.md`](../../docs/spec/shared-packages/README.md) を参照。
