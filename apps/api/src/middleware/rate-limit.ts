import rateLimit from "express-rate-limit"

/**
 * 上限（1 分あたり 300 リクエスト）は、フロントが複数の API を並列に呼んでも超えず、機械的な連打は止まる値にしている。
 *
 * カウントは in-memory でインスタンスごとに持つので、複数インスタンスでは実効の上限がインスタンス数倍になる。
 * 厳密に制限するなら Redis ストアか WAF を使う
 */
export const apiRateLimiter = rateLimit({
  legacyHeaders: false,
  limit: 300,
  message: { error: "Too many requests", status_code: 429 },
  standardHeaders: "draft-7",
  windowMs: 60 * 1000,
})
