# API Routes (Route Handlers)

## 概要

Route Handlersは、Next.js App RouterでのAPIエンドポイントの作成方法です。`route.ts`ファイルを使ってREST APIを実装できます。

**主な特徴:**
- Web Request/Response API標準
- HTTPメソッド（GET, POST, PUT, DELETE等）のサポート
- ストリーミングレスポンス
- Edge/Node.jsランタイムの選択
- ミドルウェアサポート

## 基本的な使い方

```tsx
// app/api/hello/route.ts
export async function GET() {
  return Response.json({ message: 'Hello World' })
}
```

詳細は [Route Handlers公式ドキュメント](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) を参照してください。
