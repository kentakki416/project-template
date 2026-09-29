/**
 * 全プロジェクト共通の ESLint ルール定義
 *
 * apps / packages 双方の eslint.config.* から spread して使う:
 *
 *   const { commonPlugins, commonRules } = require("@repo/eslint-config/common-rules")
 *   plugins: { ...commonPlugins },
 *   rules: { ...commonRules, "app-specific-rule": "error" }
 *
 * naming-convention は配列全体で上書きされる仕様のため、selector を個別に
 * 上書きしたい場合 (mobile の variable に filter を足す等) は
 * `commonNamingConvention` を import してから map で書き換える。
 */

const stylistic = require("@stylistic/eslint-plugin")

/**
 * 本体の formatting ルールが検査していなかったノード種別。
 *
 * ESLint 本体の formatting ルール (indent / quotes / semi 等) は v8.53.0 で
 * deprecated、v11.0.0 で削除される。後継の `@stylistic/eslint-plugin` は
 * 同名・同オプションだが、本体が持っていなかった TS 構文 (`type` / `interface`
 * / `enum` / decorator など) の検査が追加されている。
 *
 * そのまま入れ替えると「移行したら既存コードが一斉に整形された」状態になり、
 * deprecated 対応と整形が 1 つの差分に混ざってしまう。ここでは検査範囲を本体と
 * 同じに保ち、TS 構文まで広げるかどうかは別の判断として切り離す。
 *
 * この一覧は本体 indent の KNOWN_NODES に無いノード種別（= 本体が
 * 「構造を知らない」として検査を諦めていたもの）と一致する。
 */
const CORE_UNCHECKED_NODE_TYPES = new Set([
  "AccessorProperty",
  "Decorator",
  "ImportAttribute",
  "JSXSpreadChild",
])

const isNodeTypeUncheckedByCoreRules = (nodeType) =>
  nodeType.startsWith("TS") || CORE_UNCHECKED_NODE_TYPES.has(nodeType)

/**
 * TS 固有ノードへの報告だけを落として、本体ルールと同じ検査範囲にしたルールを作る。
 *
 * `indent` は `ignoredNodes` オプションで同じ除外ができるのでラップ不要。
 * `semi` / `object-curly-spacing` はノードを絞るオプションを持たないのでここで包む。
 */
const createCoreCompatibleRule = (rule) => ({
  ...rule,
  create: (context) =>
    rule.create(
      Object.create(context, {
        report: {
          value: (descriptor) => {
            if (descriptor.node && isNodeTypeUncheckedByCoreRules(descriptor.node.type)) {
              return
            }
            context.report(descriptor)
          },
        },
      }),
    ),
})

/**
 * formatting 系ルールを提供する plugin。
 *
 * commonRules を spread する config は、同じ config オブジェクトに
 * `plugins: { ...commonPlugins }` も並べる必要がある
 * (plugin 未登録の namespace を rules で参照すると ESLint が起動時に落ちる)。
 * eslint-config-next / eslint-config-expo は `@stylistic` を登録しないので
 * `@typescript-eslint` のような "Cannot redefine plugin" は起きない
 * (このモジュールが唯一の生成元なので、全 app が同じオブジェクトを受け取る)。
 */
const commonPlugins = {
  "@stylistic": {
    ...stylistic,
    rules: {
      ...stylistic.rules,
      "object-curly-spacing": createCoreCompatibleRule(stylistic.rules["object-curly-spacing"]),
      semi: createCoreCompatibleRule(stylistic.rules.semi),
    },
  },
}

const commonNamingConvention = [
  {
    format: ["camelCase", "UPPER_CASE", "PascalCase"],
    selector: "variable",
  },
  {
    format: ["camelCase", "PascalCase"],
    selector: "function",
  },
  {
    format: ["PascalCase"],
    selector: "typeLike",
  },
  {
    format: ["camelCase"],
    leadingUnderscore: "require",
    modifiers: ["private"],
    selector: "memberLike",
  },
]

const commonRules = {
  /**
   * インデント
   *
   * SwitchCase のデフォルトが本体は 0 / @stylistic は 1 なので明示する。
   * ignoredNodes は CORE_UNCHECKED_NODE_TYPES と同じ除外をオプションで再現したもの。
   */
  "@stylistic/indent": [
    "error",
    2,
    {
      SwitchCase: 0,
      ignoredNodes: [
        "[type=/^TS/]",
        "AccessorProperty",
        "Decorator",
        "ImportAttribute",
        "JSXSpreadChild",
      ],
    },
  ],

  /** Console */
  "no-console": ["warn", { allow: ["warn", "error"] }],

  /** 未使用変数 */
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      args: "after-used",
      argsIgnorePattern: "^_",
      ignoreRestSiblings: true,
      varsIgnorePattern: "^_",
    },
  ],

  /** コードスタイル */
  "@stylistic/object-curly-spacing": ["error", "always"],
  "@stylistic/quotes": ["error", "double"],
  "@stylistic/semi": ["error", "never"],
  "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
  "@stylistic/padded-blocks": ["error", "never"],
  "@stylistic/no-trailing-spaces": "error",
  "@stylistic/no-multi-spaces": "error",

  /** Import 順序 */
  "import/order": [
    "error",
    {
      alphabetize: {
        caseInsensitive: true,
        order: "asc",
      },
      groups: [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index",
      ],
      "newlines-between": "always",
      pathGroups: [
        {
          group: "internal",
          pattern: "@repo/**",
          position: "before",
        },
      ],
      pathGroupsExcludedImportTypes: ["builtin"],
    },
  ],
  "import/no-duplicates": ["error", { "prefer-inline": true }],

  /** TypeScript: 型安全性 */
  "@typescript-eslint/no-empty-function": "error",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/promise-function-async": "warn",

  /**
   * TypeScript: return await の一貫性
   *
   * ESLint 本体の `no-return-await` は v8.46.0 で deprecated（`replacedBy` は空）。
   * 「`return await` は無駄」という前提がエンジン最適化で崩れたのが理由で、
   * 「try / catch の外では await を外す・中では付ける」という判定自体は今も有効なため、
   * 型情報を使って Promise だけを対象にする後継ルールへ置き換えた。
   * デフォルトの `in-try-catch` が本体の挙動（try 内は報告しない）と同じ判定を含む。
   */
  "@typescript-eslint/return-await": "error",

  /** TypeScript: クラスメンバーのアクセス修飾子を明示（constructor は除外） */
  "@typescript-eslint/explicit-member-accessibility": [
    "error",
    {
      accessibility: "explicit",
      overrides: {
        constructors: "off",
      },
    },
  ],

  /** TypeScript: 命名規則（private メンバーには _ プレフィックス必須） */
  "@typescript-eslint/naming-convention": ["error", ...commonNamingConvention],

  /** コード品質 */
  eqeqeq: ["error", "always"],
  "no-unneeded-ternary": "error",
  "no-var": "error",
  "prefer-arrow-callback": "error",
  "prefer-const": "error",
  "prefer-template": "error",
}

module.exports = {
  commonNamingConvention,
  commonPlugins,
  commonRules,
}
