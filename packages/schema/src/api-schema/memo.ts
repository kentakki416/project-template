import { z } from "zod"

// ===========================
// メモ共通スキーマ
// ===========================

const memoSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

// ===========================
// GET /api/memo - メモ一覧取得
// ===========================

export const getMemoListResponseSchema = z.object({
  memos: z.array(memoSchema),
})

export type GetMemoListResponse = z.infer<typeof getMemoListResponseSchema>

// ===========================
// GET /api/memo/:id - メモ詳細取得
// ===========================

export const getMemoRequestSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
})

export const getMemoResponseSchema = memoSchema

export type GetMemoRequest = z.infer<typeof getMemoRequestSchema>
export type GetMemoResponse = z.infer<typeof getMemoResponseSchema>

// ===========================
// POST /api/memo - メモ作成
// ===========================

export const createMemoRequestSchema = z.object({
  body: z.string().min(1, "本文は必須です"),
  title: z.string().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内です"),
})

export const createMemoResponseSchema = memoSchema

export type CreateMemoRequest = z.infer<typeof createMemoRequestSchema>
export type CreateMemoResponse = z.infer<typeof createMemoResponseSchema>

// ===========================
// PUT /api/memo/:id - メモ更新
// ===========================

export const updateMemoRequestSchema = z.object({
  body: z.string().min(1, "本文は必須です"),
  title: z.string().min(1, "タイトルは必須です").max(255, "タイトルは255文字以内です"),
})

export const updateMemoResponseSchema = memoSchema

export type UpdateMemoRequest = z.infer<typeof updateMemoRequestSchema>
export type UpdateMemoResponse = z.infer<typeof updateMemoResponseSchema>

// ===========================
// DELETE /api/memo/:id - メモ削除
// ===========================

export const deleteMemoRequestSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
})

export const deleteMemoResponseSchema = z.object({
  message: z.string(),
})

export type DeleteMemoRequest = z.infer<typeof deleteMemoRequestSchema>
export type DeleteMemoResponse = z.infer<typeof deleteMemoResponseSchema>
