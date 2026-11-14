import { Metadata } from "next"
import { redirect } from "next/navigation"
import React from "react"

import UserTable from "@/components/features/user/UserTable"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"
import { buildUserListPageSearchParams, convertSearchParamsToUserListQuery } from "@/features/user/user-list-params"
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
  const params = await searchParams
  const query = convertSearchParamsToUserListQuery(params)
  const { page, per_page: perPage, total_count: totalCount, users } = await userApi.getList(query)

  /**
   * 最後のページより後ろ（URL の手書きや、件数が減った後のリロード）は、最後のページに移す
   */
  const lastPage = Math.max(1, Math.ceil(totalCount / perPage))
  if (page > lastPage) {
    redirect(`/users?${buildUserListPageSearchParams(params, lastPage)}`)
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="ユーザー管理" />
      <UserTable page={page} perPage={perPage} totalCount={totalCount} users={users} />
    </div>
  )
}
