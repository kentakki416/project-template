# APIサーバーのセットアップ (apps/api)

## 目次

1. [プロジェクトの作成](#プロジェクトの作成)
2. [package.jsonの設定](#packagejsonの設定)
3. [TypeScript設定](#typescript設定)
4. [ESLint設定](#eslint設定)
5. [Expressサーバーの作成](#expressサーバーの作成)
6. [環境変数の設定](#環境変数の設定)
7. [開発サーバーの起動](#開発サーバーの起動)

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

    # 開発環境の依存パッケージ
    pnpm add -D typescript @types/node @types/express @types/cors ts-node-dev
    ```
    ＜解説＞
    * `express`: Node.jsのWebフレームワーク
    * `dotenv`: 環境変数を.envファイルから読み込む
    * `cors`: CORS（クロスオリジンリソース共有）を有効化
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
        "build": "tsc",
        "start": "node dist/index.js",
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      ...
    }
    ```
    ＜解説＞
    * `dev`: 開発サーバーを起動（ホットリロード有効）
    * `build`: TypeScriptをJavaScriptにコンパイル
    * `start`: コンパイルされたJavaScriptを実行（本番環境用）

## TypeScript設定

1. typescriptの初期化コマンドを実行
    ```bash
    tsc --init
    ```

2. TypeScript設定を記述
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
        // ソースコードのルートディレクトリ
        "rootDir": "./src",
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
      // コンパイル対象のファイル
      "include": ["src/**/*"],
      // コンパイル対象から除外するディレクトリ
      "exclude": ["node_modules", "dist"]
    }
    ```

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

    module.exports = defineConfig([
      {
        files: ['**/*.ts'],
        languageOptions: {
          parser: typescriptParser,
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            project: './tsconfig.json',
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
          'semi': ['error', 'never'],                   // セミコロンを禁止
          'quotes': ['error', 'single'],                 // シングルクォートを強制
          
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
            natural: false,        // 自然順ソートを無効化
            minKeys: 2,            // 2つ以上のキーがある場合のみ適用
          }],
          
          // === TypeScript: 型安全性 ===
          '@typescript-eslint/no-explicit-any': 'warn',                    // any型は警告
          '@typescript-eslint/no-empty-function': 'error',                 // 空の関数を禁止
          '@typescript-eslint/no-unnecessary-type-assertion': 'error',     // 不要な型アサーションを禁止
          '@typescript-eslint/promise-function-async': 'warn',             // Promiseを返す関数はasyncに
          
          // === TypeScript: 命名規則 ===
          '@typescript-eslint/naming-convention': [
            'error',
            {
              selector: 'variable',
              format: ['camelCase', 'UPPER_CASE', 'PascalCase'],  // 変数: camelCase, UPPER_CASE, PascalCase
            },
            {
              selector: 'function',
              format: ['camelCase', 'PascalCase'],                 // 関数: camelCase, PascalCase
            },
            {
              selector: 'typeLike',
              format: ['PascalCase'],                              // 型: PascalCase
            },
          ],
          
          // === コード品質: 比較と構文 ===
          'eqeqeq': ['error', 'always'],           // === と !== を強制（== と != を禁止）
          'no-return-await': 'error',              // 不要な return await を禁止
          'no-var': 'error',                       // var を禁止（const/let を使用）
          'prefer-const': 'error',                 // 再代入しない変数は const にする
          'prefer-template': 'error',              // 文字列結合ではなくテンプレートリテラルを使用
          'prefer-arrow-callback': 'error',        // コールバック関数はアロー関数にする
          'no-unneeded-ternary': 'error',          // 不要な三項演算子を禁止（例: x ? true : false → x）
        },
      },
      {
        ignores: ['node_modules/**', 'dist/**'],
      },
    ])
    ```
    ＜解説＞
    **コードスタイル:**
    * `object-curly-spacing`: `{ }` 内にスペースを入れる
    * `semi`: セミコロンを使用しない
    * `quotes`: シングルクォート `'` を強制（ダブルクォート `"` を禁止）
    
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

4. package.jsonにlintスクリプトを追加
    ```json
    {
      "scripts": {
        "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
        "build": "tsc",
        "start": "node dist/index.js",
        "lint": "eslint 'src/**/*.ts'",
        "test": "echo \"Error: no test specified\" && exit 1"
      }
    }
    ```

5. Lintを実行
    ```bash
    pnpm run lint
    ```

## Expressサーバーの作成

1. src/index.tsを作成
    ```bash
    mkdir src
    touch src/index.ts
    ```

2. 基本的なExpressサーバーを実装
    ```typescript
    import express, { Request, Response } from 'express'
    import cors from 'cors'
    import dotenv from 'dotenv'

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

    // サーバー起動
    app.listen(PORT, () => {
      console.log(`🚀 API Server is running on http://localhost:${PORT}`)
    })
    ```
    ＜解説＞
    * `dotenv.config()`: 環境変数ファイルを読み込み
    * `app.use(cors())`: CORS（クロスオリジン）を有効化
    * `app.use(express.json())`: JSONボディのパースを有効化
    * `/`: ルートエンドポイント（API情報を返す）
    * `/health`: ヘルスチェック用エンドポイント


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
    DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_trainer_dev"

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
    ```

## ビルドと本番起動

1. ビルドを実行
    ```bash
    cd apps/api
    pnpm run build
    ```
    ＜解説＞
    * `dist/` ディレクトリにコンパイルされたJavaScriptが出力される

2. 本番環境で起動
    ```bash
    pnpm run start
    ```
    ＜解説＞
    * コンパイルされた `dist/index.js` を実行
    * 環境変数 `NODE_ENV=production` を設定推奨
