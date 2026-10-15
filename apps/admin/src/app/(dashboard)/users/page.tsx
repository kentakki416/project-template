import { Metadata } from "next"
import React from "react"

import UserTable from "@/components/features/user/UserTable"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"
import { convertSearchParamsToUserListQuery } from "@/features/user/user-list-params"
import { userApi } from "@/features/user/user.api"

export const metadata: Metadata = {
  title: "ユーザー管理",
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * ユーザー一覧。検索・絞り込み・ページングの条件は URL に持ち、api で行う
 */
export default async function UserListPage({ searchParams }: Props) {
  const query = convertSearchParamsToUserListQuery(await searchParams)
  const { total_count: totalCount, users } = await userApi.getList(query)

  return (
    <div>
      <PageBreadcrumb pageTitle="ユーザー管理" />
      <UserTable totalCount={totalCount} users={users} />
    </div>
  )
}
