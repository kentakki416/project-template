import axios from "axios"

import { Memo } from "./memo.entity"

const client = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL })

export const memoApi = {
  async create(title: string, body: string): Promise<Memo> {
    const result = await client.post("/api/memo", { title, body })
    return new Memo(result.data) // 型安全ではない
  }
}