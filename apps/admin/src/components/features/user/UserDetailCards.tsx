import React from "react"

import { GetAdminUserResponse } from "@repo/api-schema"

import AuthProviderBadge from "@/components/features/user/AuthProviderBadge"
import UserAvatar from "@/components/features/user/UserAvatar"
import { formatDateTime } from "@/libs/date"

type Props = {
  user: GetAdminUserResponse
}

/**
 * ユーザー詳細のカード。見た目は TailAdmin のデモのプロフィール画面に合わせる（編集のボタンは置かない）
 */
export default function UserDetailCards({ user }: Props) {
  const infoItems = [
    { label: "ユーザー ID", value: String(user.id) },
    { label: "名前", value: user.name ?? "-" },
    { label: "メールアドレス", value: user.email ?? "-" },
    { label: "登録日時", value: formatDateTime(user.created_at) },
    { label: "更新日時", value: formatDateTime(user.updated_at) },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3">
      <h3 className="mb-5 text-lg font-semibold text-gray-800 lg:mb-7 dark:text-white/90">ユーザー詳細</h3>

      <div className="mb-6 rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
        <div className="flex w-full flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
            <UserAvatar avatarUrl={user.avatar_url} name={user.name} size="lg" />
          </div>
          <div className="text-left">
            <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">{user.name ?? "（名前なし）"}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email ?? "-"}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
        <h4 className="mb-4 text-lg font-semibold text-gray-800 lg:mb-6 dark:text-white/90">基本情報</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32">
          {infoItems.map((item) => (
            <div key={item.label}>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800">
        <h4 className="mb-4 text-lg font-semibold text-gray-800 lg:mb-6 dark:text-white/90">ログイン方法</h4>
        {user.auth_accounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">紐付けているログイン方法はありません</p>
        ) : (
          <div>
            {user.auth_accounts.map((account) => (
              <div
                key={`${account.provider}-${account.created_at}`}
                className="flex flex-col justify-between gap-4 border-b border-gray-200 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-end dark:border-gray-800"
              >
                <AuthProviderBadge provider={account.provider} />
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">紐付けた日時</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDateTime(account.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
