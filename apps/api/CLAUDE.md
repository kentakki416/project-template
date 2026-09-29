# apps/api

Express.js API サーバー（port 8080）。

## Commands

```bash
pnpm dev           # ホットリロード起動
pnpm test          # ローカル用（dotenvx で .env.local を復号して vitest run）
pnpm test:ci       # CI 用（env は外部から渡す前提。generate + migrate + vitest run）
pnpm test:watch    # 変更ファイルだけ再実行
pnpm test:coverage # カバレッジ計測（coverage/ に出力）
```

テストランナーは Vitest。`describe` / `it` / `expect` / `vi` は `globals: true` で展開済みなので import 不要。

## レイヤード構成

`Router → Controller → Service → Repository → (Prisma / Redis)`

**新機能は必ず既存実装を読んでパターンを合わせる**: `src/routes/memo-router.ts` / `src/controller/memo/` / `src/service/memo-service.ts` / `src/repository/prisma/memo-repository.ts`。

| レイヤー | 場所 | 守ること |
| --- | --- | --- |
| Router | `src/routes/` | controllers は optional なオブジェクトで受け、存在する場合のみルート登録 |
| Controller | `src/controller/{feature}/` | API と 1 対 1。**try-catch を書かない**。`Result` は必ず `sendError` 経由で返す |
| Service | `src/service/` | `export const` のアロー関数。**戻り値は必ず `Promise<Result<T>>`** |
| Repository | interface は `src/repository/`、実装は `src/repository/prisma/` `src/repository/redis/` | **service / controller は `src/repository` バレルから interface だけ import する**（実装ディレクトリから import しない） |
| Domain 型 | `@repo/domain` | api / cron / worker で共有。`@repo/api-schema` にも Prisma にも依存しない |

- **Service の Repository 引数は単一でも `repo: { xxxRepository }` のオブジェクトにまとめる**。将来 Repository が増えてもシグネチャを変えずに済むため
- **DI は `src/index.ts`** で Repository → Controller → Router の順に組み立てる。実装クラスを import してよいのはここと Controller インテグレーションテストだけ
- **トランザクション**: 抽象は `src/repository/transaction.ts`、Prisma 実装は `src/repository/prisma/transaction-runner.ts`。`TransactionContext` は不透明トークンなので、service から `tx` で直接クエリを書くことはできない（型エラーになる）

## エラーハンドリング（Result 型）

`@repo/errors` の `Result<T>` を使う。**業務エラー（4xx）は値で返し、想定外エラー（DB 障害等）は throw する**、が原則。

- **Service**: 業務エラーは `return err(conflictError(...))`。想定外エラーは **catch せずそのまま伝播させる**
- **Controller**: **try-catch を書かない**。`if (!result.ok)` は必ず `sendError`（`src/lib/send-error.ts`）経由で返す。`res.status().json()` を直接書くとログを書き忘れるため
- Service から別 Service を呼ぶときも `ok` 判定し、そのまま re-return するか再解釈する（例: pre-condition の 404 を 400 に変換）
- 想定外の throw / スキーマ違反は `src/middleware/unhandled-exception-handler.ts` が処理する（リクエストスキーマ違反 → 400 + `warn`、レスポンススキーマ違反とその他 → 500 + `error`）

try/catch を許容するのは次の 2 つだけ。

- **副次処理の意図的な握りつぶし**: 通知送信の失敗などメイン処理を成功扱いにしたい場合。`logger.warn` してから続行する
- **エラーを値に変換する必要がある場合**: `health-service` が個別のサービスチェック失敗を `status: "error"` に集約して必ず両方の status を返す、など

## テスト戦略

参考にする実装: `test/service/memo-service/`（ユニット）/ `test/controller/memo/`（インテグレーション）。

- **Service はユニットテスト**（`vi.fn()` で Repository をモック、DB 不要）、**Controller はインテグレーションテスト**（`supertest` で HTTP レイヤーから検証）
- **`describe` を「正常系」「異常系」で必ず分類する**。トップレベルはテスト対象（関数名 / エンドポイント）にし、その直下に分類の `describe` を置く。異常系の抜け漏れに気付きやすくするため
- **自前インフラ（Postgres / Redis）はモックしない**。キー名・TTL・型変換・SQL の誤りは mock では検出できない。**実 Redis を `vi.fn()` で差し替えるのは禁止**。モックしてよいのは外部 SaaS（Google OAuth / S3 / 課金 API）だけ
- **エラーメッセージ等の文字列は assertion しない**。文言変更・i18n・ログ改善のたびに無関係なテストが落ちるため。Service は `Result` の構造（`ok` / `statusCode` / `type`）、Controller は HTTP ステータスとボディの存在のみ検証する
- **アサーションは最終状態まで含める**。呼び出し回数だけでなく DB / Redis の結果まで確認する
- **オブジェクトは一括 assertion にする**。API レスポンス（外部契約）は `toEqual` + `expect.any(...)`（フィールド増減で落ちる方が望ましい）、DB 行（内部状態）は `toMatchObject`
- **境界値テストは必須**（日付フィルタの境界、条件分岐の境界）

## Admin API 設計方針（未実装）

Admin 向けエンドポイントはまだ 1 つも実装されていない（`src/routes/` には auth / health / memo / user のみ）。追加するときの方針:

- すべて `/api/admin/` 配下に置き、ユーザー向け API と分離する
- Controller / Service は共通のものを使い、`admin-router.ts` を新設してマッピングする
- スキーマは `@repo/api-schema` の `admin/` に集約。既存と同一なら re-export し、Admin 固有のレスポンスが必要になった時点で新規定義する
- 認証は当面無し（`PUBLIC_PATHS`）。`ADMIN_USE_DUMMY=true` で DB 不要のダミーモードになる

## 環境変数

`src/env.ts` に Zod スキーマをインラインで定義し、import 時に `safeParse` → 失敗なら `process.exit(1)`。値は `.env.local` に置き dotenvx で暗号化して git にコミットする（復号鍵は root の `.env.keys`）。

```bash
# 値の追加・変更は手書きせず dotenvx を使う
pnpm exec dotenvx set KEY "value" -f .env.local
```

## 新エンドポイント追加の手順

1. `@repo/api-schema` にスキーマを定義（命名規則は `packages/schema/CLAUDE.md`）
2. Domain 型 → Repository → Service → Controller → Router の順に実装
3. `src/index.ts` の DI 組み立てに追加
4. Service のユニットテストと Controller のインテグレーションテストを書く
