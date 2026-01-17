import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // TypeScriptファイルのみに型情報を適用
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "indent": ["error", 2], // インデントを2スペースに統一（タブも2スペースに変換）
      // === Console ===
      "no-console": ["warn", { allow: ["warn", "error"] }], // console.log は警告、warn/error は許可

      // === コードスタイル ===
      "object-curly-spacing": ["error", "always"], // { foo } のようにスペースを入れる
      "semi": ["error", "never"], // セミコロンを禁止
      "quotes": ["error", "double"], // ダブルクォートを強制
      "no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }], // 連続する空行は最大1行、ファイルの先頭/末尾は0行
      "padded-blocks": ["error", "never"], // ブロックの開始/終了での空行を禁止
      "no-trailing-spaces": "error", // 行末のスペースを禁止

      // === Import順序 ===
      "import/order": [
        "error",
        {
          groups: [
            "builtin", // Node.jsの組み込みモジュール（例: fs, path）
            "external", // 外部ライブラリ（node_modules）
            "internal", // 内部モジュール（@repo/など）
            "parent", // 親ディレクトリからのインポート
            "sibling", // 同じディレクトリまたは兄弟ディレクトリからのインポート
            "index", // カレントディレクトリのindexファイル
          ],
          "newlines-between": "always", // グループ間に改行を挿入
          alphabetize: {
            order: "asc", // 各グループ内でアルファベット順にソート
            caseInsensitive: true, // 大文字小文字を区別しない
          },
          pathGroups: [
            {
              pattern: "@repo/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
      'import/no-duplicates': ['error', { 'prefer-inline': true }], // 同じソースからの重複importを禁止、inline type importを推奨

      // === React: JSXインデント ===
      "react/jsx-indent": ["error", 2], // JSX要素のインデントを2スペースに強制（子要素は親要素より深くインデント）
      "react/jsx-indent-props": ["error", 2], // JSX属性のインデントを2スペースに強制

      // === React: JSXタグのスペース ===
      "react/jsx-tag-spacing": ["error", {
        "closingSlash": "never",        // </> の / の前のスペース禁止
        "beforeSelfClosing": "always",  // <Component /> の /> 前にスペース必須
        "afterOpening": "never",        // < の後のスペース禁止（< Image> をエラーに）
        "beforeClosing": "never"        // > の前のスペース禁止
      }],      

      // === TypeScript: 型安全性 ===
      "@typescript-eslint/no-explicit-any": "warn", // any型は警告
      "@typescript-eslint/no-empty-function": "error", // 空の関数を禁止
      "@typescript-eslint/no-unnecessary-type-assertion": "error", // 不要な型アサーションを禁止
      "@typescript-eslint/promise-function-async": "warn", // Promiseを返す関数はasyncに

      // === TypeScript: 命名規則 ===
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"], // 変数: camelCase, UPPER_CASE, PascalCase
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"], // 関数: camelCase, PascalCase
        },
        {
          selector: "typeLike",
          format: ["PascalCase"], // 型: PascalCase
        },
      ],

      // === コード品質: 比較と構文 ===
      "eqeqeq": ["error", "always"], // === と !== を強制（== と != を禁止）
      "no-return-await": "error", // 不要な return await を禁止
      "no-var": "error", // var を禁止（const/let を使用）
      "prefer-const": "error", // 再代入しない変数は const にする
      "prefer-template": "error", // 文字列結合ではなくテンプレートリテラルを使用
      "prefer-arrow-callback": "error", // コールバック関数はアロー関数にする
      "no-unneeded-ternary": "error", // 不要な三項演算子を禁止（例: x ? true : false → x）
    },
  },
]);

export default eslintConfig;
