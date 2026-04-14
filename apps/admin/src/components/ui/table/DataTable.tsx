"use client"

import { ReactNode, useMemo, useState } from "react"

import Pagination from "./Pagination"

import { Table, TableBody, TableCell, TableHeader, TableRow } from "./index"

/**
 * テーブルカラム定義
 */
export type Column<T> = {
  /** セルのカスタムクラス名 */
  className?: string
  /** カラムヘッダーに表示するラベル */
  header: string
  /** T のキーを指定して単純にテキスト表示する場合 */
  key?: keyof T
  /** カスタム描画関数。key より優先される */
  render?: (row: T) => ReactNode
}

/**
 * 検索設定
 */
type SearchConfig<T> = {
  /** 検索対象のフィールド（T のキー配列） */
  filterKeys: (keyof T)[]
  /** プレースホルダーテキスト */
  placeholder?: string
}

/**
 * ページネーション設定
 */
type PaginationConfig = {
  /** 1ページあたりの表示件数の選択肢 */
  pageSizeOptions?: number[]
}

/**
 * DataTable の Props
 */
type DataTableProps<T> = {
  /** カラム定義 */
  columns: Column<T>[]
  /** テーブルに表示するデータ配列 */
  data: T[]
  /** 各行のユニークキーを取得する関数 */
  getRowKey: (row: T) => string | number
  /** ページネーション設定。指定するとページネーションを表示 */
  pagination?: PaginationConfig
  /** 検索設定。指定すると検索バーを表示 */
  search?: SearchConfig<T>
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20]

export default function DataTable<T>({
  columns,
  data,
  getRowKey,
  pagination,
  search,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(
    pagination?.pageSizeOptions?.[0] ?? DEFAULT_PAGE_SIZE_OPTIONS[0]
  )
  const [searchQuery, setSearchQuery] = useState("")

  /**
   * 検索フィルタ
   */
  const filteredData = useMemo(() => {
    if (!search || !searchQuery) return data
    const lower = searchQuery.toLowerCase()
    return data.filter((row) =>
      search.filterKeys.some((key) => {
        const value = row[key]
        return value !== null && value !== undefined && String(value).toLowerCase().includes(lower)
      })
    )
  }, [data, search, searchQuery])

  /**
   * ページネーション
   */
  const totalPages = pagination
    ? Math.max(1, Math.ceil(filteredData.length / perPage))
    : 1

  const displayData = useMemo(() => {
    if (!pagination) return filteredData
    const start = (currentPage - 1) * perPage
    return filteredData.slice(start, start + perPage)
  }, [filteredData, pagination, currentPage, perPage])

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handlePerPageChange = (size: number) => {
    setPerPage(size)
    setCurrentPage(1)
  }

  const pageSizeOptions =
    pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS

  return (
    <div>
      {/* ツールバー（検索バー・件数切替） */}
      {(search || pagination) && (
        <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          {pagination && (
            <div className="flex items-center gap-2">
              <span className="text-theme-sm text-gray-600 dark:text-gray-400">
                Show
              </span>
              <select
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-theme-sm text-gray-600 dark:text-gray-400">
                entries
              </span>
            </div>
          )}
          {search && (
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-700 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:w-[300px]"
                placeholder={search.placeholder ?? "検索..."}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* テーブル */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/5">
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={String(col.key ?? col.header)}
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
            {displayData.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={String(col.key ?? col.header)}
                    className={
                      col.className ??
                      "px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400"
                    }
                  >
                    {col.render
                      ? col.render(row)
                      : col.key !== null && col.key !== undefined
                        ? String(row[col.key] ?? "")
                        : null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {pagination && (
        <div className="mt-5 flex flex-col items-center justify-between gap-4 xl:flex-row">
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">
            Showing {Math.min((currentPage - 1) * perPage + 1, filteredData.length)}{" "}
            to {Math.min(currentPage * perPage, filteredData.length)} of{" "}
            {filteredData.length} entries
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
