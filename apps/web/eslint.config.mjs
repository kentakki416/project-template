import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import tailwindcss from "eslint-plugin-tailwindcss"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "tailwindcss": tailwindcss,
    },
    rules: {
      // Console
      "no-console": ["warn", { allow: ["warn", "error"] }],
      
      // 未使用変数（Next.jsデフォルトで有効なのでスキップ）
      
      // スペース・セミコロン
      "object-curly-spacing": ["error", "always"],
      "quotes": ["error", "single"],
      "semi": ["error", "never"],
      
      // Import順序
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      
      // Objectプロパティのアルファベット順
      "sort-keys": ["error", "asc", {
        caseSensitive: true,
        natural: false,
        minKeys: 2,
      }],
      
      // React
      "react/jsx-sort-props": ["error", {
        callbacksLast: true,
        shorthandFirst: true,
        ignoreCase: true,
        reservedFirst: true,
      }],
      
      // TypeScript固有ルール
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/promise-function-async": "warn",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
      
      // コード品質
      "eqeqeq": ["error", "always"],
      "no-return-await": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",
      "no-unneeded-ternary": "error",
      
      // Tailwind CSS
      "tailwindcss/classnames-order": "error",
      "tailwindcss/no-custom-classname": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
