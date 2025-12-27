# TypeScript 中級者・上級者向け技術記事集

TypeScript の型システムを深く理解し、実践的に活用するための技術記事集です。

## 記事一覧

### 1. [Conditional Types の実践的パターン](./conditional-types-patterns.md)

TypeScript の型レベルプログラミングの核となる Conditional Types について、基本から応用まで解説しています。

**主なトピック:**
- `infer` キーワードによる型の推論・抽出
- 再帰的な Conditional Types
- Template Literal Types との組み合わせ
- Distributive Conditional Types
- 実践的なユースケース

**対象読者:** 型システムの基本を理解しており、より高度な型操作を学びたい方

---

### 2. [Brand Types と Nominal Typing](./brand-types-nominal-typing.md)

構造的型付けの TypeScript で、名目的型付けを実現する Brand Types パターンを紹介しています。

**主なトピック:**
- 構造的型付けの問題点
- Brand Types の実装方法
- バリデーション付き Brand Types
- ID や単位を持つ数値の型安全な扱い
- 実行時オーバーヘッドゼロでの型安全性向上

**対象読者:** より厳密な型安全性を求める方、ドメイン駆動設計に興味がある方

---

### 3. [`as` vs `satisfies` の使い分け](./as-vs-satisfies.md)

TypeScript 4.9 で導入された `satisfies` 演算子と、従来の `as` 型アサーションの違いと使い分けを解説しています。

**主なトピック:**
- `as` と `satisfies` の根本的な違い
- 型推論の保持と型チェックの両立
- 設定オブジェクトやイベントハンドラでの実践例
- `as const` との組み合わせパターン
- それぞれを使うべき場面

**対象読者:** TypeScript 4.9 以降を使用しており、より型安全なコードを書きたい方

---

### 4. [Generics の実践的パターン](./generics-advanced-patterns.md)

TypeScript の型システムの基盤となる Generics について、基本から応用まで幅広く解説しています。

**主なトピック:**
- 型パラメータと制約（constraints）の活用
- デフォルト型パラメータと複数の型パラメータ
- ジェネリック関数・クラスの実装パターン
- Utility Types の実装方法
- Result 型、Event Emitter、API クライアントなどの実践例
- よくある落とし穴と解決策

**対象読者:** 再利用可能で型安全なコンポーネントを作成したい方、Generics をより深く理解したい方

---

### 5. [Zod との型連携パターン](./zod-type-integration.md)

実行時バリデーションライブラリ Zod と TypeScript の型システムを統合する実践的なパターンを紹介しています。

**主なトピック:**
- API レスポンスの型安全な処理
- リクエスト・レスポンスの共有スキーマ
- フォームバリデーションとの統合
- Discriminated Union の実装
- Transform/Preprocess による型変換
- 環境変数の型安全な検証

**対象読者:** API 開発や外部データの扱いで、実行時バリデーションと型安全性を両立したい方

---

## 推奨学習順序

1. **初めての方:** Generics → `as` vs `satisfies` → Brand Types
2. **型システムを深めたい方:** Generics → Conditional Types → Zod との型連携
3. **実務で即使いたい方:** Generics → Zod との型連携 → Brand Types → `as` vs `satisfies`

## 前提知識

これらの記事は中級者・上級者向けのため、以下の知識を前提としています：

- TypeScript の基本的な型（プリミティブ型、オブジェクト型、Union/Intersection など）
- Generics の基本的な使い方
- Utility Types（`Pick`、`Omit`、`Partial` など）の理解
- 型の代入性（Assignability）の概念

## 関連リソース

- [TypeScript 公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Zod 公式ドキュメント](https://zod.dev/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

## フィードバック

記事の内容に関するフィードバックや改善提案があれば、Issue または PR でお知らせください。

---

**最終更新:** 2025-12-17
