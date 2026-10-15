import { Metadata } from "next"
import React from "react"

import ComponentCard from "@/components/layout/ComponentCard"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"

export const metadata: Metadata = {
  title: "ホーム",
}

/**
 * ホーム。プロジェクトのダッシュボードはここに作る
 */
export default function HomePage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="ホーム" />
      <ComponentCard title="ダッシュボード">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ここにダッシュボードを作ります。UI 部品の見本はサイドバーの「デモ」にあります。
        </p>
      </ComponentCard>
    </div>
  )
}
