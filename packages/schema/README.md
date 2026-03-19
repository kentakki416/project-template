# @repo/api-schema

API のリクエスト・レスポンススキーマを Zod で定義する共有パッケージです。

## 概要

- Zod スキーマによる API のバリデーションと TypeScript 型の自動生成
- API サーバー (`apps/api`) とフロントエンド (`apps/web`, `apps/admin`, `apps/mobile`) で共通利用

## ディレクトリ構成

```
src/
├── index.ts              # エントリポイント
└── api-schema/
    ├── index.ts          # スキーマの再エクスポート
    ├── auth.ts           # 認証関連スキーマ
    ├── health.ts         # ヘルスチェックスキーマ
    └── user.ts           # ユーザー関連スキーマ
```

## コマンド

```bash
pnpm build     # TypeScript をコンパイル
pnpm dev       # ウォッチモードで開発
pnpm lint      # ESLint 実行
pnpm lint:fix  # ESLint 自動修正
```

## 使い方

### スキーマの定義

`src/api-schema/` に Zod スキーマを定義し、`src/api-schema/index.ts` からエクスポートします。

### 他パッケージからのインポート

```typescript
import { SomeSchema, SomeType } from '@repo/api-schema'
```

## 注意事項

- スキーマを変更した場合は `pnpm build` で再ビルドが必要です
- 新しい API エンドポイントを追加する際は、先にこのパッケージでスキーマを定義してください