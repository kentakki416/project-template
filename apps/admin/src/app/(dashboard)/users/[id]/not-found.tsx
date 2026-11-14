import Link from "next/link"
import React from "react"

import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

/**
 * ユーザー詳細で、ID のユーザーがいない・ID が数値でないときの画面
 */
export default function UserNotFound() {
  return (
    <div>
      <PageBreadcrumb pageTitle="ユーザー詳細" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
        <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">ユーザーが見つかりません</h3>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          URL が間違っているか、ユーザーが削除された可能性があります。
        </p>
        <Link
          className="shadow-theme-xs inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200"
          href="/users"
        >
          ユーザー一覧へ
        </Link>
      </div>
    </div>
  )
}
