import cors from 'cors'
import dotenv from 'dotenv'
import express, { Request, Response } from 'express'

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
