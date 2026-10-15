"use client"

import Link from "next/link"

import { ADMIN_USER_LIST_MAX_QUERY_LENGTH, authProviderSchema, GetAdminUserListResponse } from "@repo/api-schema"

import AuthProviderBadge from "@/components/features/user/AuthProviderBadge"
import UserAvatar from "@/components/ui/avatar/UserAvatar"
import { Column, DataTable, FilterConfig } from "@/components/ui/table"
import Tooltip from "@/components/ui/tooltip/Tooltip"
import { AUTH_PROVIDER_LABELS } from "@/features/user/auth-provider-labels"
import { USER_LIST_PAGE_SIZE_OPTIONS } from "@/features/user/user-list-params"
import { InfoIcon } from "@/icons"
import { formatDateTime } from "@/libs/date"

type UserRow = GetAdminUserListResponse["users"][number]

const columns: Column<UserRow>[] = [
  {
    header: "ユーザー",
    render: (row) => (
      <div className="flex items-center gap-3">
        <UserAvatar avatarUrl={row.avatar_url} name={row.name} size="sm" />
        <Link
          className="text-theme-sm font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
          href={`/users/${row.id}`}
        >
          {row.name ?? "名前未設定"}
        </Link>
      </div>
    ),
  },
  { header: "メールアドレス", render: (row) => row.email ?? "-" },
  {
    header: (
      <Tooltip content="ユーザーが紐付けているログイン方法" placement="top">
        <span className="inline-flex items-center gap-1" tabIndex={0}>
          ログイン方法
          {/**
           * SVGR が viewBox を消すので、小さく描くときは viewBox を渡す（渡さないと切れる）
           */}
          <InfoIcon className="size-4" viewBox="0 0 24 24" />
        </span>
      </Tooltip>
    ),
    render: (row) => (
      <div className="flex gap-1">
        {row.providers.map((provider) => (
          <AuthProviderBadge key={provider} provider={provider} />
        ))}
      </div>
    ),
  },
  { header: "登録日時", render: (row) => formatDateTime(row.created_at) },
]

const filters: FilterConfig[] = [
  {
    key: "provider",
    label: "ログイン方法",
    options: authProviderSchema.options.map((provider) => ({ label: AUTH_PROVIDER_LABELS[provider], value: provider })),
  },
  { key: "created", label: "登録日", type: "dateRange" },
]

type Props = {
  /** api が実際に使ったページと件数 */
  page: number
  perPage: number
  totalCount: number
  users: UserRow[]
}

/**
 * ユーザー一覧の表。検索・絞り込み・ページングは URL に持ち、api で行う（DataTable の server モード）
 */
export default function UserTable({ page, perPage, totalCount, users }: Props) {
  return (
    <DataTable
      columns={columns}
      data={users}
      emptyMessage="該当するユーザーがいません"
      filters={filters}
      getRowHref={(row) => `/users/${row.id}`}
      getRowKey={(row) => row.id}
      pagination={{ pageSizeOptions: USER_LIST_PAGE_SIZE_OPTIONS }}
      search={{ maxLength: ADMIN_USER_LIST_MAX_QUERY_LENGTH, placeholder: "名前・メールアドレスで検索" }}
      server={{ page, perPage, totalCount }}
    />
  )
}
