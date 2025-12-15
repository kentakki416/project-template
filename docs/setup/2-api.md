# APIサーバーのセットアップ (apps/api)

## 目次

1. [プロジェクトの作成](#プロジェクトの作成)
2. [package.jsonの設定](#packagejsonの設定)
3. [TypeScript設定](#typescript設定)
4. [ESLint設定](#eslint設定)
5. [Expressサーバーの作成](#expressサーバーの作成)
6. [環境変数の設定](#環境変数の設定)
7. [開発サーバーの起動](#開発サーバーの起動)
8. [Jestのセットアップ](#jestのセットアップ)

---

## プロジェクトの作成

1. apps/apiディレクトリを作成
    ```bash
    mkdir -p apps/api
    cd apps/api
    ```

2. package.jsonを作成
    ```bash
    pnpm init
    ```

## package.jsonの設定

1. 必要なパッケージをインストール
    ```bash
    # 本番環境の依存パッケージ
    pnpm add express dotenv cors
    pnpm add @repo/api-schema@workspace:^

    # 開発環境の依存パッケージ
    pnpm add -D typescript @types/node @types/express @types/cors ts-node-dev
    ```
    ＜解説＞
    * `express`: Node.jsのWebフレームワーク
    * `dotenv`: 環境変数を.envファイルから読み込む
    * `cors`: CORS（クロスオリジンリソース共有）を有効化
    * `@repo/api-schema`: モノレポ内の共有スキーマパッケージ（API契約を定義）
    * `typescript`: TypeScriptコンパイラ
    * `@types/*`: TypeScriptの型定義ファイル
    * `ts-node-dev`: TypeScriptファイルを直接実行し、ファイル変更時に自動再起動

2. package.jsonのscriptsを設定
    ```json
    {
      "name": "api",
      "version": "1.0.0",
      "main": "dist/index.js",
      "scripts": {
        "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
        "build": "tsc --project tsconfig.build.json",
        "start": "node dist/index.js",
        "lint": "eslint 'src/**/*.ts' 'test/**/*.ts'",
        "lint:fix": "eslint 'src/**/*.ts' 'test/**/*.ts' --fix",
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage"
      },
      ...
    }
    ```
    ＜解説＞
    * `dev`: 開発サーバーを起動（ホットリロード有効）
    * `build`: ビルド専用の設定ファイル（tsconfig.build.json）を使用してコンパイル
    * `start`: コンパイルされたJavaScriptを実行（本番環境用）
    * `lint`: ESLintでコードをチェック（srcとtest両方を対象）
    * `lint:fix`: ESLintで自動修正可能な問題を修正
    * `test`: Jestでテストを実行
    * `test:watch`: ファイル変更を監視してテストを自動実行
    * `test:coverage`: カバレッジレポート付きでテストを実行

## TypeScript設定

1. typescriptの初期化コマンドを実行
    ```bash
    tsc --init
    ```

2. tsconfig.json（開発・IDE用）を記述
    ```json
    {
      "compilerOptions": {
        // コンパイルターゲット: ES2020にコンパイル
        "target": "ES2020",
        // モジュールシステム: CommonJS（Node.js標準）
        "module": "commonjs",
        // 使用するライブラリ: ES2020の標準ライブラリ
        "lib": ["ES2020"],
        // 出力ディレクトリ: コンパイル後のファイル出力先
        "outDir": "./dist",
        // モジュール解決方法: Node.js方式
        "moduleResolution": "node",
        // ベースURL: 相対パスの基準となるディレクトリ
        "baseUrl": "./",
        // パスエイリアス: @/でsrcディレクトリを参照可能
        "paths": {
          "@/*": ["src/*"]
        },
        // ESモジュールとCommonJSの相互運用性を有効化
        "esModuleInterop": true,
        // ファイル名の大文字小文字の一貫性を強制
        "forceConsistentCasingInFileNames": true,
        // 厳格な型チェックを有効化
        "strict": true,
        // ライブラリの型チェックをスキップ（ビルド時間短縮）
        "skipLibCheck": true,
        // JSONファイルをモジュールとしてインポート可能にする
        "resolveJsonModule": true,
        // 型定義ファイル（.d.ts）を生成
        "declaration": true,
        // デバッグ用のソースマップを生成
        "sourceMap": true
      },
      // コンパイル対象のファイル（ESLintとIDEがsrcとtestの両方を認識）
      "include": ["src/**/*", "test/**/*"],
      // コンパイル対象から除外するディレクトリ
      "exclude": ["node_modules", "dist"]
    }
    ```
    ＜解説＞
    * `include: ["src/**/*", "test/**/*"]`: ESLintとIDEがテストファイルも認識できるようにする
    * `rootDir` を設定しない: ビルド時は `tsconfig.build.json` を使用するため

3. tsconfig.build.json（ビルド専用）を作成
    ```bash
    touch tsconfig.build.json
    ```

4. tsconfig.build.jsonを記述
    ```json
    {
      "extends": "./tsconfig.json",
      "compilerOptions": {
        // ビルド用: srcディレクトリのみをビルド対象とする
        "rootDir": "./src"
      },
      // ビルド対象: srcのみ
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist", "test"]
    }
    ```
    ＜解説＞
    * `tsconfig.json` を継承し、ビルド専用の設定を追加
    * `rootDir: "./src"`: ビルド時はsrcディレクトリのみをルートとする
    * `include: ["src/**/*"]`: ビルド対象はsrcのみ（testは除外）
    * `pnpm build` 実行時はこの設定ファイルが使用される

## ESLint設定

1. ESLint関連パッケージをインストール
    ```bash
    pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-import eslint-import-resolver-typescript
    ```
    ＜解説＞
    * `eslint`: ESLint本体
    * `@typescript-eslint/eslint-plugin`: TypeScript用ESLintルール
    * `@typescript-eslint/parser`: TypeScriptパーサー
    * `eslint-plugin-import`: import文の順序とグループ化
    * `eslint-import-resolver-typescript`: TypeScriptのパスエイリアスを解決

2. eslint.config.jsを作成
    ```bash
    touch eslint.config.js
    ```

3. ESLint設定を記述
    ```javascript
    const { defineConfig } = require('eslint/config')
    const typescriptEslint = require('@typescript-eslint/eslint-plugin')
    const typescriptParser = require('@typescript-eslint/parser')
    const importPlugin = require('eslint-plugin-import')
    const jestPlugin = require('eslint-plugin-jest')

    module.exports = defineConfig([
      {
        files: ['src/**/*.ts', 'test/**/*.ts'],
        languageOptions: {
          parser: typescriptParser,
          parserOptions: {
            ecmaVersion: 2020,
            project: './tsconfig.json',
            sourceType: 'module',
          },
        },
        plugins: {
          '@typescript-eslint': typescriptEslint,
          import: importPlugin,
        },
        settings: {
          'import/resolver': {
            typescript: {
              alwaysTryTypes: true,
              project: './tsconfig.json',
            },
          },
        },
        rules: {
          // === Console ===
          'no-console': ['warn', { allow: ['warn', 'error'] }], // console.log は警告、warn/error は許可

          // === 未使用変数 ===
          '@typescript-eslint/no-unused-vars': ['error', {
            argsIgnorePattern: '^_',  // _で始まる引数は除外
            varsIgnorePattern: '^_',  // _で始まる変数は除外
          }],

          // === コードスタイル ===
          'object-curly-spacing': ['error', 'always'],  // { foo } のようにスペースを入れる
          'quotes': ['error', 'single'],                 // シングルクォートを強制
          'semi': ['error', 'never'],                   // セミコロンを禁止
          'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }], // 連続する空行は最大1行、ファイルの先頭/末尾は0行
          'padded-blocks': ['error', 'never'], // ブロックの開始/終了での空行を禁止
          'no-trailing-spaces': 'error', // 行末のスペースを禁止

          // === Import順序 ===
          'import/order': [
            'error',
            {
              groups: [
                'builtin',   // Node.jsの組み込みモジュール（例: fs, path）
                'external',  // 外部ライブラリ（node_modules）
                'internal',  // 内部モジュール（@repo/など）
                'parent',    // 親ディレクトリからのインポート
                'sibling',  // 同じディレクトリまたは兄弟ディレクトリからのインポート
                'index',    // カレントディレクトリのindexファイル
              ],
              'newlines-between': 'always', // グループ間に改行を挿入
              alphabetize: {
                order: 'asc', // 各グループ内でアルファベット順にソート
                caseInsensitive: true, // 大文字小文字を区別しない
              },
              pathGroups: [
                {
                  pattern: '@repo/**',
                  group: 'internal',
                  position: 'before',
                },
              ],
              pathGroupsExcludedImportTypes: ['builtin'],
            },
          ],

          // === オブジェクトキーの順序 ===
          'sort-keys': ['error', 'asc', {
            caseSensitive: true,   // 大文字小文字を区別
            minKeys: 2,            // 2つ以上のキーがある場合のみ適用
            natural: false,        // 自然順ソートを無効化
          }],

          // === TypeScript: 型安全性 ===
          '@typescript-eslint/no-empty-function': 'error',                 // 空の関数を禁止
          '@typescript-eslint/no-explicit-any': 'warn',                    // any型は警告
          '@typescript-eslint/no-unnecessary-type-assertion': 'error',     // 不要な型アサーションを禁止
          '@typescript-eslint/promise-function-async': 'warn',             // Promiseを返す関数はasyncに

          // === TypeScript: 命名規則 ===
          '@typescript-eslint/naming-convention': [
            'error',
            {
              format: ['camelCase', 'UPPER_CASE', 'PascalCase'],  // 変数: camelCase, UPPER_CASE, PascalCase
              selector: 'variable',
            },
            {
              format: ['camelCase', 'PascalCase'],                 // 関数: camelCase, PascalCase
              selector: 'function',
            },
            {
              format: ['PascalCase'],                              // 型: PascalCase
              selector: 'typeLike',
            },
          ],

          // === コード品質: 比較と構文 ===
          'eqeqeq': ['error', 'always'],           // === と !== を強制（== と != を禁止）
          'no-return-await': 'error',              // 不要な return await を禁止
          'no-unneeded-ternary': 'error',          // 不要な三項演算子を禁止（例: x ? true : false → x）
          'no-var': 'error',                       // var を禁止（const/let を使用）
          'prefer-arrow-callback': 'error',        // コールバック関数はアロー関数にする
          'prefer-const': 'error',                 // 再代入しない変数は const にする
          'prefer-template': 'error',              // 文字列結合ではなくテンプレートリテラルを使用
        },
      },
      {
        ignores: ['dist/**', 'node_modules/**', 'src/prisma/generated/**'],
      },
      {
        files: ['test/**/*.ts'],
        plugins: {
          jest: jestPlugin,
        },
        rules: {
          'jest/expect-expect': 'error',
          'jest/no-disabled-tests': 'warn',
          'jest/no-focused-tests': 'error',
          'jest/valid-expect': 'error',
        },
      },
    ])

    ```
    ＜解説＞
    **コードスタイル:**
    * `object-curly-spacing`: `{ }` 内にスペースを入れる
    * `semi`: セミコロンを使用しない
    * `quotes`: シングルクォート `'` を強制（ダブルクォート `"` を禁止）
    * `no-multiple-empty-lines`: 連続する空行は最大1行、ファイルの先頭/末尾は0行
    * `padded-blocks`: ブロックの開始/終了での空行を禁止
    * `no-trailing-spaces`: 行末のスペースを禁止

    **Import順序:**
    * `import/order`: import文をグループ化して順序を制御
      * 外部ライブラリ（`node_modules`）が最初
      * 自分のpackages（`@repo/**`）がその後に配置
      * グループ間に改行を自動挿入
      * 各グループ内でアルファベット順にソート
    
    **TypeScript型安全性:**
    * `@typescript-eslint/no-explicit-any`: any型の使用を警告
    * `@typescript-eslint/no-empty-function`: 空の関数を禁止
    * `@typescript-eslint/no-unnecessary-type-assertion`: 不要な型アサーションを禁止
    * `@typescript-eslint/promise-function-async`: Promiseを返す関数はasyncにする
    * `@typescript-eslint/naming-convention`: 命名規則（変数はcamelCase/UPPER_CASE/PascalCase、関数はcamelCase/PascalCase、型はPascalCase）
    
    **コード品質:**
    * `eqeqeq`: === と !== を強制（== と != を禁止）
    * `no-var`: var禁止（const/letを使用）
    * `prefer-const`: 再代入しない変数はconstにする
    * `prefer-template`: テンプレートリテラル優先
    * `prefer-arrow-callback`: アロー関数優先
    * `no-unneeded-ternary`: 不要な三項演算子を禁止

    **jest設定:**
    * `jest/expect-expect`: expectが含まれないテストを検出
    * `jest/no-disabled-tests`: 無効化されたテスト（`test.skip`）を警告
    * `jest/no-focused-tests`: フォーカスされたテスト（`test.only`）を禁止
    * `jest/valid-expect`: 正しいexpect構文を強制

4. Lintを実行
    ```bash
    pnpm run lint
    ```
    ＜解説＞
    * `src` と `test` ディレクトリの両方がチェックされる
    * エラーがあれば修正し、自動修正可能なものは `pnpm run lint:fix` で修正できる

## Expressサーバーの作成

1. src/index.tsを作成
    ```bash
    mkdir src
    touch src/index.ts
    ```

2. 基本的なExpressサーバーを実装
    ```typescript
    import cors from 'cors'
    import dotenv from 'dotenv'
    import express, { Request, Response } from 'express'

    import {
      getUserRequestSchema,
      getUserResponseSchema,
      type GetUserRequest,
      type GetUserResponse,
    } from '@repo/api-schema'

    // 環境変数を読み込み
    dotenv.config({ path: '.env.local' })

    const app = express()
    const PORT = process.env.PORT || 8080

    // ミドルウェア
    app.use(cors())
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    // ルートエンドポイント
    app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'API Server is running',
        version: '1.0.0',
      })
    })

    // ヘルスチェックエンドポイント
    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok' })
    })

    // ユーザー取得API: GET /api/user/:id
    app.get('/api/user/:id', (req: Request, res: Response) => {
      try {
        // リクエストパラメータをバリデーション
        const requestData: GetUserRequest = {
          id: req.params.id,
        }
        const validatedRequest = getUserRequestSchema.parse(requestData)

        // 固定値のレスポンスデータを返す
        const responseData: GetUserResponse = {
          id: validatedRequest.id,
          message: `ユーザーID ${validatedRequest.id} の情報を取得しました`,
          timestamp: new Date().toISOString(),
        }
        const validatedResponse = getUserResponseSchema.parse(responseData)

        res.json(validatedResponse)
      } catch (error) {
        // バリデーションエラーの場合
        if (error instanceof Error) {
          res.status(400).json({
            error: 'バリデーションエラー',
            message: error.message,
          })
        } else {
          res.status(500).json({
            error: 'サーバーエラー',
            message: '予期しないエラーが発生しました',
          })
        }
      }
    })

    // サーバー起動
    app.listen(PORT, () => {
      console.log(`🚀 API Server is running on http://localhost:${PORT}`)
    })
    ```
    ＜解説＞
    * `@repo/api-schema`: モノレポ内の共有スキーマパッケージからバリデーションスキーマと型をインポート
    * `dotenv.config()`: 環境変数ファイルを読み込み
    * `app.use(cors())`: CORS（クロスオリジン）を有効化
    * `app.use(express.json())`: JSONボディのパースを有効化
    * `/`: ルートエンドポイント（API情報を返す）
    * `/health`: ヘルスチェック用エンドポイント
    * `/api/user/:id`: ユーザー取得API（Zodスキーマでバリデーション実施）


## 環境変数の設定

1. .env.exampleを作成
    ```bash
    touch .env.example
    ```

2. 環境変数のテンプレートを記述
    ```env
    # Server
    PORT=8080
    NODE_ENV=development

    # CORS
    CORS_ORIGIN=http://localhost:3000

    # Database
    DATABASE_URL="mysql://mysql:password@localhost:3306/project_template_dev"

    # Google OAuth
    GOOGLE_CLIENT_ID="your-client-id"
    GOOGLE_CLIENT_SECRET="your-client-secret"
    GOOGLE_CALLBACK_URL="http://localhost:8080/api/auth/google/callback"

    # Redis
    REDIS_URL=redis://localhost:6379

    # JWT
    JWT_SECRET=your-secret-key-change-in-production
    JWT_EXPIRATION=7d

    # Frontend URL
    FRONTEND_URL="http://localhost:3000"
    ```

3. .env.localを作成（Gitには含めない）
    ```bash
    cp .env.example .env.local
    ```
    ＜解説＞
    * `.env.local`はGitignoreに含まれる
    * ローカル開発用の実際の値を記述

## 開発サーバーの起動

1. 個別に起動する場合
    ```bash
    cd apps/api
    pnpm run dev
    ```
    ＜解説＞
    * ファイルを変更すると自動的に再起動される
    * デフォルトで `http://localhost:8080` で起動

2. Turborepoから起動する場合
    ```bash
    # プロジェクトルートで
    pnpm run dev
    ```
    ＜解説＞
    * 全てのアプリケーション（web、api、mobileなど）が同時に起動
    * `turbo.json` の `pipeline.dev` 設定に従って実行

3. 動作確認
    ```bash
    # ブラウザまたはcurlでアクセス
    curl http://localhost:8080
    # レスポンス: {"message":"API Server is running","version":"1.0.0"}

    curl http://localhost:8080/health
    # レスポンス: {"status":"ok"}

    curl http://localhost:8080/api/user/123
    # レスポンス: {"id":"123","message":"ユーザーID 123 の情報を取得しました","timestamp":"2024-01-01T00:00:00.000Z"}
    ```

## ビルドと本番起動

1. ビルドを実行
    ```bash
    cd apps/api
    pnpm run build
    ```
    ＜解説＞
    * `tsconfig.build.json` を使用してビルド（`test` ディレクトリは除外される）
    * `dist/` ディレクトリにコンパイルされたJavaScriptが出力される

2. 本番環境で起動
    ```bash
    pnpm run start
    ```
    ＜解説＞
    * コンパイルされた `dist/index.js` を実行
    * 環境変数 `NODE_ENV=production` を設定推奨

---

## Jestのセットアップ

### 1. 必要なパッケージをインストール

```bash
cd apps/api
pnpm add -D jest @types/jest ts-jest supertest @types/supertest eslint-plugin-jest
```

＜解説＞
* `jest`: テストフレームワーク本体
* `@types/jest`: Jestの型定義ファイル
* `ts-jest`: TypeScriptファイルをJestで実行するためのプリセット
* `supertest`: HTTPアサーション用ライブラリ（Express APIテスト用）
* `@types/supertest`: supertestの型定義ファイル
* `eslint-plugin-jestt`: jestのeslintルールファイル

### 2. Jest設定ファイルを作成

```bash
touch jest.config.js
```

### 3. jest.config.jsを記述

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['<rootDir>/test/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
}
```

＜解説＞
* `preset: 'ts-jest'`: TypeScriptファイルを直接テスト
* `testEnvironment: 'node'`: Node.js環境でテストを実行
* `roots`: テストファイルの検索ルート（`src` と同じ階層の `test` ディレクトリ）
* `testMatch`: テストファイルのパターン（`test` ディレクトリ配下のすべての `.ts` ファイル）
* `moduleFileExtensions`: 対応する拡張子
* `collectCoverageFrom`: カバレッジ収集対象（エントリーポイントは除外）
* `moduleNameMapper`: パスエイリアス（`@/`を`src/`にマッピング）
* `testTimeout`: テストタイムアウト（デフォルト10秒）

### 4. テストファイルの配置

テストファイルは `src` と同じ階層に `test` ディレクトリを作成して配置します。この方法により、以下のメリットがあります：
* `tsconfig.build.json` を使用したビルド時に、testディレクトリが自動的に除外される
* `tsconfig.json` の `include` に `test/**/*` を含めることで、ESLintとIDEが正しく動作する

```
apps/api/
├── src/
│   ├── controller/
│   │   └── user/
│   │       └── get.ts
│   ├── service/
│   │   └── user-service.ts
│   └── repository/
│       └── mysql/
│           └── user.ts
├── test/
│   ├── controller/
│   │   └── user/
│   │       └── get.ts
│   ├── service/
│   │   └── user-service.ts
│   └── repository/
│       └── mysql/
│           └── user.ts
```

＜解説＞
* テストディレクトリ構造は `src` と同じ構造にする
* `tsconfig.json` の `include: ["src/**/*"]` により、`test` ディレクトリはビルド対象から自動的に除外される
* `testMatch: ['<rootDir>/test/**/*.ts']` により、`test` ディレクトリ配下のすべての `.ts` ファイルがテスト対象となる
* ファイル名に `.test.ts` や `.spec.ts` という拡張子は不要（`user-service.ts` のような名前でも可）

### 6. 簡単なテスト例

#### 例1: Service層のテスト

```typescript
// test/service/user-service.ts
import { getUser } from '../../src/service/user-service'
import { UserRepository } from '../../src/repository/mysql/user'

describe('UserService', () => {
  describe('getUser', () => {
    it('should return user data when user exists', async () => {
      // モックリポジトリを作成
      const mockUserRepository: UserRepository = {
        findById: jest.fn().mockResolvedValue({
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
        }),
      }

      const result = await getUser({ id: '1' }, mockUserRepository)

      expect(result).toEqual({
        email: 'test@example.com',
        id: '1',
        name: 'Test User',
      })
      expect(mockUserRepository.findById).toHaveBeenCalledWith('1')
    })

    it('should return null when user does not exist', async () => {
      const mockUserRepository: UserRepository = {
        findById: jest.fn().mockResolvedValue(null),
      }

      const result = await getUser({ id: '999' }, mockUserRepository)

      expect(result).toBeNull()
    })
  })
})
```

#### 例2: API エンドポイントのテスト（supertest使用）

```typescript
// test/api.ts
import request from 'supertest'
import express from 'express'

// テスト用のExpressアプリを作成
const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/user/:id', (req, res) => {
  res.json({
    email: 'test@example.com',
    id: req.params.id,
    name: 'Test User',
  })
})

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return status ok', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ status: 'ok' })
    })
  })

  describe('GET /api/user/:id', () => {
    it('should return user data', async () => {
      const response = await request(app).get('/api/user/1')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('id', '1')
      expect(response.body).toHaveProperty('name', 'Test User')
    })
  })
})
```

### 7. テストの実行

```bash
# 全テストを実行
pnpm test

# Watch モードで実行（ファイル変更時に自動実行）
pnpm test:watch

# カバレッジレポート付きで実行
pnpm test:coverage
```