"use client"

import Badge from "@/components/ui/badge/Badge"
import { ClientFilterConfig, Column, DataTable } from "@/components/ui/table"

type Member = {
  id: number
  email: string
  name: string
  role: "Admin" | "Editor" | "Viewer"
  status: "Active" | "Inactive"
}

const FIRST_NAMES = ["Lindsey", "Kaiya", "Zain", "Ahmad", "Leo", "Madelyn", "Emery", "Corey", "Jaxson", "Kianna"]
const LAST_NAMES = ["Curtis", "George", "Geidt", "Rosser", "Dias"]
const ROLES: Member["role"][] = ["Admin", "Editor", "Viewer"]

/**
 * 固定のサンプル 30 件
 */
const members: Member[] = Array.from({ length: 30 }, (_, i) => {
  const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`
  return {
    id: i + 1,
    email: `${name.toLowerCase().replace(" ", ".")}${i + 1}@example.com`,
    name,
    role: ROLES[i % ROLES.length],
    status: i % 4 === 0 ? "Inactive" : "Active",
  }
})

const columns: Column<Member>[] = [
  { header: "Name", key: "name" },
  { header: "Email", key: "email" },
  { header: "Role", key: "role" },
  {
    header: "Status",
    render: (row) => (
      <Badge color={row.status === "Active" ? "success" : "error"} size="sm">
        {row.status}
      </Badge>
    ),
  },
]

const filters: ClientFilterConfig<Member>[] = [
  { key: "role", label: "Role", options: ROLES.map((role) => ({ label: role, value: role })) },
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" },
    ],
  },
]

/**
 * DataTable の client モードの見本
 */
export default function DataTableExample() {
  return (
    <DataTable
      columns={columns}
      data={members}
      emptyMessage="No matching members"
      filters={filters}
      getRowKey={(row) => row.id}
      pagination={{ pageSizeOptions: [5, 10, 20] }}
      search={{ filterKeys: ["name", "email"], placeholder: "Search..." }}
    />
  )
}
