"use client"

import { useRouter } from "next/navigation"

export function RefreshButton() {
  const router = useRouter()

  return (
    <button
      className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
      type="button"
      onClick={() => router.refresh()}
    >
      再取得
    </button>
  )
}
