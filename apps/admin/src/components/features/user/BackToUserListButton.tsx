"use client"

import useGoBack from "@/hooks/useGoBack"
import { ChevronLeftIcon } from "@/icons"

/**
 * 「一覧に戻る」。一覧の検索条件は URL にあるので、履歴で戻ると同じ条件の一覧になる
 */
export default function BackToUserListButton() {
  const goBack = useGoBack("/users")
  return (
    <button
      className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      type="button"
      onClick={goBack}
    >
      <ChevronLeftIcon />
      一覧に戻る
    </button>
  )
}
