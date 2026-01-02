# キャッシング

## 概要

Next.jsは、複数のレベルでキャッシングを行い、パフォーマンスを最適化します。

**キャッシングレイヤー:**
- Request Memoization（リクエスト重複排除）
- Data Cache（fetch cache）
- Full Route Cache（ビルド時の静的生成）
- Router Cache（クライアントサイドキャッシュ）

詳細は [キャッシング公式ドキュメント](https://nextjs.org/docs/app/building-your-application/caching) を参照してください。
