# Next.js 技術リファレンス

Next.js開発に必要な知識を体系的にまとめた技術リファレンスです。

## 目次

### 基礎（Fundamentals）

Next.jsの核となる概念を理解するための基礎ドキュメント

- [App Router](./fundamentals/app-router.md) - App Routerの基本概念とPages Routerとの違い
- [ルーティング基礎](./fundamentals/routing.md) - ファイルベースルーティング、動的ルート、ナビゲーション
- [Server Components](./fundamentals/server-components.md) - サーバーコンポーネントの特徴と使い方
- [Client Components](./fundamentals/client-components.md) - クライアントコンポーネントとReactフック
- [レイアウト](./fundamentals/layouts.md) - レイアウトシステムとネスト構造
- [メタデータ](./fundamentals/metadata.md) - SEO対策とメタデータAPI

### データ管理（Data）

データの取得、変更、キャッシュに関するドキュメント

- [データフェッチング](./data/data-fetching.md) - fetch API、並列フェッチング、エラーハンドリング
- [Server Actions](./data/server-actions.md) - フォーム送信とデータミューテーション
- [API Routes](./data/api-routes.md) - Route HandlersによるAPI実装
- [キャッシング](./data/caching.md) - キャッシング戦略とレイヤー
- [再検証](./data/revalidation.md) - revalidate、revalidatePath、revalidateTag

### レンダリング（Rendering）

レンダリング戦略とパフォーマンス最適化

- [レンダリング戦略](./rendering/rendering-strategies.md) - SSG、ISR、SSR、CSRの使い分け
- [ストリーミング](./rendering/streaming.md) - SuspenseとReact Server Componentsのストリーミング
- [Partial Prerendering](./rendering/partial-prerendering.md) - PPRの仕組みと活用
- [Edge Runtime](./rendering/edge-runtime.md) - Edge RuntimeとNode.js Runtimeの違い

### 高度なルーティング（Routing Advanced）

より高度なルーティング機能

- [動的ルート詳細](./routing-advanced/dynamic-routes.md) - Catch-all、Optional Catch-all、generateStaticParams
- [パラレルルート](./routing-advanced/parallel-routes.md) - 並列レンダリングと条件付き表示
- [インターセプトルート](./routing-advanced/intercepting-routes.md) - モーダルとルートインターセプション
- [ルートグループ](./routing-advanced/route-groups.md) - URLに影響しないルートのグループ化
- [ミドルウェア](./routing-advanced/middleware.md) - リクエストの事前処理と認証

### 最適化（Optimization）

パフォーマンスとバンドルサイズの最適化

- [画像最適化](./optimization/image-optimization.md) - next/imageとImage Component
- [フォント最適化](./optimization/font-optimization.md) - next/fontとGoogle Fonts
- [コード分割](./optimization/code-splitting.md) - dynamic importとReact.lazy
- [パフォーマンス](./optimization/performance.md) - Core Web Vitals、Lighthouse
- [バンドル分析](./optimization/bundle-analysis.md) - webpack-bundle-analyzerとバンドルサイズ削減

### ビルドとデプロイ（Build & Deploy）

本番環境へのビルドとデプロイ

- [ビルドプロセス](./build-deploy/build-process.md) - next build、静的最適化、出力モード
- [静的エクスポート](./build-deploy/static-export.md) - output: 'export'と完全静的サイト生成
- [環境変数](./build-deploy/environment-variables.md) - .env、NEXT_PUBLIC_、ランタイム環境変数
- [デプロイ](./build-deploy/deployment.md) - Vercel、Docker、セルフホスティング
- [next.config.js](./build-deploy/config.md) - 設定ファイルの詳細

### スタイリング（Styling）

CSS とスタイリング手法

- [Tailwind CSS](./styling/tailwind.md) - Tailwind CSS v4の設定と使い方

### エラーハンドリング（Error Handling）

エラー処理と例外処理

- [Error Boundaries](./error-handling/error-boundaries.md) - error.tsxとエラーハンドリング
- [Not Found](./error-handling/not-found.md) - 404ページとnotFound()関数
- [エラーレポーティング](./error-handling/error-reporting.md) - Sentryなどの統合

### セキュリティ（Security）

認証、認可、セキュリティ対策

- [認証](./security/authentication.md) - Auth.js（NextAuth.js）、セッション管理
- [認可](./security/authorization.md) - ロールベースアクセス制御、権限管理
- [CSRF保護](./security/csrf-protection.md) - Server ActionsとCSRFトークン
- [セキュリティヘッダー](./security/security-headers.md) - CSP、HSTS、X-Frame-Options

### 高度なトピック（Advanced）

上級者向けの機能と設定

- [国際化](./advanced/internationalization.md) - i18n、多言語対応、next-intl
- [Instrumentation](./advanced/instrumentation.md) - APM、トレーシング、モニタリング
- [カスタムサーバー](./advanced/custom-server.md) - Express統合、カスタムサーバー実装
- [Monorepo](./advanced/monorepo.md) - Turborepo、pnpm workspaces

### マイグレーション（Migration）

バージョン移行とアップグレード

- [Pages → App Router移行](./migration/pages-to-app.md) - 段階的な移行戦略
- [バージョンアップグレード](./migration/version-upgrade.md) - Next.js 14 → 15、破壊的変更

## 学習の進め方

### 初学者向け

1. **基礎から始める**
   - [App Router](./fundamentals/app-router.md)
   - [ルーティング基礎](./fundamentals/routing.md)
   - [Server Components](./fundamentals/server-components.md)
   - [Client Components](./fundamentals/client-components.md)

2. **データ管理を学ぶ**
   - [データフェッチング](./data/data-fetching.md)
   - [Server Actions](./data/server-actions.md)

3. **スタイリングとレイアウト**
   - [レイアウト](./fundamentals/layouts.md)
   - [Tailwind CSS](./styling/tailwind.md)

### 中級者向け

1. **レンダリング戦略**
   - [レンダリング戦略](./rendering/rendering-strategies.md)
   - [キャッシング](./data/caching.md)
   - [再検証](./data/revalidation.md)

2. **高度なルーティング**
   - [動的ルート詳細](./routing-advanced/dynamic-routes.md)
   - [ミドルウェア](./routing-advanced/middleware.md)

3. **最適化**
   - [パフォーマンス](./optimization/performance.md)
   - [画像最適化](./optimization/image-optimization.md)

### 上級者向け

1. **セキュリティ**
   - [認証](./security/authentication.md)
   - [CSRF保護](./security/csrf-protection.md)

2. **本番環境**
   - [ビルドプロセス](./build-deploy/build-process.md)
   - [デプロイ](./build-deploy/deployment.md)

3. **高度なトピック**
   - [国際化](./advanced/internationalization.md)
   - [Monorepo](./advanced/monorepo.md)

## 推奨リソース

### 公式ドキュメント
- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [React公式ドキュメント](https://react.dev/)
- [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)

### 学習リソース
- [Next.js Learn](https://nextjs.org/learn) - 公式の無料学習コース
- [Vercel Examples](https://github.com/vercel/next.js/tree/canary/examples) - 公式サンプルコード集

### コミュニティ
- [Next.js Discord](https://discord.gg/nextjs)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

## このリファレンスの使い方

- **目的別に探す**: 上記の目次から、実装したい機能に関連するドキュメントを探してください
- **体系的に学ぶ**: 「学習の進め方」セクションを参考に、順を追って学習してください
- **リファレンスとして使う**: 実装中に不明点があれば、該当するドキュメントを参照してください

各ドキュメントには以下の情報が含まれています：
- **概要**: 機能の説明と主な特徴
- **基本的な使い方**: 最小限の実装例
- **詳細な説明**: より高度な使用方法
- **ベストプラクティス**: 推奨される実装方法
- **よくある落とし穴**: 避けるべきパターン
- **関連リソース**: 関連ドキュメントへのリンク
