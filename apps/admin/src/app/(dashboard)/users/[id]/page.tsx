import { Metadata } from "next"
import { notFound } from "next/navigation"
import React from "react"

import BackToUserListButton from "@/components/features/user/BackToUserListButton"
import UserDetailCards from "@/components/features/user/UserDetailCards"
import PageBreadcrumb from "@/components/layout/PageBreadCrumb"
import { convertUserIdParamToNumber } from "@/features/user/user-list-params"
import { userApi } from "@/features/user/user.api"
import { ApiClientError } from "@/libs/api-client"

export const metadata: Metadata = {
  title: "ユーザー詳細",
}

type Props = {
  params: Promise<{ id: string }>
}

/**
 * ユーザー詳細。基本情報と、紐付けているログイン方法を出す
 */
export default async function UserDetailPage({ params }: Props) {
  /**
   * 1.5 / 0 / -1 / DB の範囲を超える ID を api に渡すと 400 になり、404 の画面にならないので、ここで弾く
   */
  const id = convertUserIdParamToNumber((await params).id)
  if (id === null) {
    notFound()
  }

  const user = await userApi.getDetail(id).catch((error: unknown) => {
    if (error instanceof ApiClientError && error.status === 404) notFound()
    throw error
  })

  return (
    <div>
      <PageBreadcrumb pageTitle="ユーザー詳細" />
      <div className="mb-4">
        <BackToUserListButton />
      </div>
      <UserDetailCards user={user} />
    </div>
  )
}
