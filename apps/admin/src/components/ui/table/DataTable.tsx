"use client"

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import React, { ReactNode, useEffect, useMemo, useState, useTransition } from "react"
import { twMerge } from "tailwind-merge"

import DatePicker from "../form/DatePicker"

import Pagination from "./Pagination"

/**
 * テーブルカラム定義
 */
export type Column<T> = {
  /** セルに足すクラス名 */
  className?: string
  /** カラムヘッダー（Tooltip なども入れられる） */
  header: ReactNode
  /** T のキーを指定して単純にテキスト表示する場合 */
  key?: keyof T
  /** カスタム描画関数。key より優先される */
  render?: (row: T) => ReactNode
}

/**
 * 検索設定
 */
type SearchConfig<T> = {
  /** client モードで検索する行の項目。server モードでは使わない（検索は api が行う） */
  filterKeys?: (keyof T)[]
  /** プレースホルダーテキスト */
  placeholder?: string
}

/**
 * ページネーション設定
 */
type PaginationConfig = {
  /** 最初の件数。省略したら pageSizeOptions の先頭 */
  defaultPageSize?: number
  /** 1ページあたりの表示件数の選択肢 */
  pageSizeOptions?: number[]
}

/**
 * フィルタ定義。type を省略したら select
 * - client モード: select の key は行のフィールド名
 * - server モード: key は URL の検索パラメータ名（行のフィールドと一致しなくてよい）。
 *   dateRange は server モードだけで、`{key}_from` / `{key}_to`（`YYYY-MM-DD`、両端を含む）
 */
export type FilterConfig =
  | { key: string; label: string; options: { label: string; value: string }[]; type?: "select" }
  | { key: string; label: string; type: "dateRange" }

/**
 * サーバー側で検索・絞り込み・ページングするときの設定。
 * 指定すると状態を URL の検索パラメータ（q / page / per_page / 絞り込みの key）で持ち、data はその 1 ページ分として扱う
 */
type ServerModeConfig = {
  /** 条件に合う全件数（フッターとページ数に使う） */
  totalCount: number
}

/**
 * DataTable の Props
 */
type DataTableProps<T> = {
  /** カラム定義 */
  columns: Column<T>[]
  /** テーブルに表示するデータ配列 */
  data: T[]
  /** 該当 0 件のときの表示 */
  emptyMessage?: string
  /** フィルタ定義。指定するとフィルタのボタンを表示 */
  filters?: FilterConfig[]
  /** 行のリンク先。指定すると行のクリックで遷移する */
  getRowHref?: (row: T) => string
  /** 各行のユニークキーを取得する関数 */
  getRowKey: (row: T) => string | number
  /** ページネーション設定。指定するとページネーションを表示 */
  pagination?: PaginationConfig
  /** 検索設定。指定すると検索バーを表示 */
  search?: SearchConfig<T>
  /** 指定すると検索・絞り込み・ページングをサーバー側に任せる */
  server?: ServerModeConfig
}

/**
 * 絞り込みの値。select は key、dateRange は `{key}_from` / `{key}_to` に入れる
 */
type FilterValues = Record<string, string>

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20]

const SEARCH_DEBOUNCE_MS = 300

const PAGE_PARAM = "page"
const PER_PAGE_PARAM = "per_page"
const QUERY_PARAM = "q"

const FIELD_CLASS_NAME =
  "shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 w-full rounded-lg border border-gray-300 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"

const CELL_CLASS_NAME = "px-5 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-400"

/**
 * フィルタが使う値の名前（select は key、dateRange は `{key}_from` / `{key}_to`）
 */
const listFilterValueKeys = (filter: FilterConfig): string[] =>
  filter.type === "dateRange" ? [`${filter.key}_from`, `${filter.key}_to`] : [filter.key]

/**
 * 値が入っているフィルタの数（dateRange は片方だけでも 1 つと数える）
 */
const countActiveFilters = (filters: FilterConfig[], values: FilterValues): number =>
  filters.filter((filter) => listFilterValueKeys(filter).some((key) => values[key])).length

const resolvePageSizeOptions = (pagination?: PaginationConfig): number[] =>
  pagination?.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS

const resolveDefaultPageSize = (pagination?: PaginationConfig): number =>
  pagination?.defaultPageSize ?? resolvePageSizeOptions(pagination)[0]

/**
 * 検索パラメータを正の整数として読む。読めなければ fallback
 */
const parsePositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 今の検索パラメータに updates を当てた URL を作る。値が空の項目は消す。shouldResetPage なら page も消す
 */
const buildUrlWithSearchParams = (
  pathname: string,
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
  shouldResetPage: boolean,
): string => {
  const params = new URLSearchParams(searchParams.toString())
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  if (shouldResetPage) params.delete(PAGE_PARAM)
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

/**
 * テーブル。検索・絞り込み・ページングを、ブラウザ側（client モード）か
 * サーバー側（server モード: 状態を URL に持ち、data は 1 ページ分）で行う
 */
export default function DataTable<T>(props: DataTableProps<T>) {
  if (props.server) {
    return <ServerStateDataTable {...props} server={props.server} />
  }
  return <ClientStateDataTable {...props} />
}

/**
 * server モード。状態を URL の検索パラメータで持ち、変えたら router.replace で画面（Server Component）に取り直させる。
 * useSearchParams はここでだけ呼ぶ（client モードを静的なページで使っても Suspense が要らないように）
 */
function ServerStateDataTable<T>({
  columns,
  data,
  emptyMessage,
  filters,
  getRowHref,
  getRowKey,
  pagination,
  search,
  server,
}: DataTableProps<T> & { server: ServerModeConfig }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const urlQuery = searchParams.get(QUERY_PARAM) ?? ""
  const [query, setQuery] = useState(urlQuery)
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  /**
   * 自分で URL に書いた検索語。URL がこの値になったのは自分の書き込みなので、入力欄には戻さない
   * （書き込みの間に打った文字を消さないため）
   */
  const [requestedQuery, setRequestedQuery] = useState<string | null>(null)

  /**
   * ブラウザの戻る・進むなどで URL の検索語が外から変わったら、入力欄をそれに合わせる
   */
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    if (urlQuery === requestedQuery) setRequestedQuery(null)
    else setQuery(urlQuery)
  }

  /**
   * 選択肢に無い件数（URL の手書きなど）は既定にする。画面（api の呼び出し）も同じ扱いにしておく
   */
  const urlPerPage = parsePositiveInt(searchParams.get(PER_PAGE_PARAM), resolveDefaultPageSize(pagination))
  const perPage = resolvePageSizeOptions(pagination).includes(urlPerPage) ? urlPerPage : resolveDefaultPageSize(pagination)
  const currentPage = parsePositiveInt(searchParams.get(PAGE_PARAM), 1)
  const appliedFilterValues = useMemo(() => {
    const values: FilterValues = {}
    for (const key of (filters ?? []).flatMap(listFilterValueKeys)) {
      const value = searchParams.get(key)
      if (value) values[key] = value
    }
    return values
  }, [filters, searchParams])

  /**
   * 検索パラメータを書き換えて URL を差し替える。条件を変えたときは page を消して 1 ページ目に戻す
   */
  const replaceSearchParams = (updates: Record<string, string | undefined>, shouldResetPage: boolean) => {
    const url = buildUrlWithSearchParams(pathname, searchParams, updates, shouldResetPage)
    startTransition(() => {
      router.replace(url, { scroll: false })
    })
  }

  /**
   * 検索語は 300ms 間引いて URL に書く
   */
  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery === urlQuery) return
    const timer = setTimeout(() => {
      setRequestedQuery(trimmedQuery)
      const url = buildUrlWithSearchParams(pathname, searchParams, { [QUERY_PARAM]: trimmedQuery }, true)
      startTransition(() => {
        router.replace(url, { scroll: false })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [pathname, query, router, searchParams, urlQuery])

  const filterKeys = (filters ?? []).flatMap(listFilterValueKeys)

  return (
    <DataTableView
      columns={columns}
      currentPage={currentPage}
      emptyMessage={emptyMessage}
      filterValues={appliedFilterValues}
      filters={filters}
      getRowHref={getRowHref}
      getRowKey={getRowKey}
      isPending={isPending}
      pageSizeOptions={pagination ? resolvePageSizeOptions(pagination) : undefined}
      perPage={perPage}
      query={query}
      rows={data}
      searchPlaceholder={search ? search.placeholder ?? "検索..." : undefined}
      totalCount={server.totalCount}
      onFiltersApply={(values) =>
        replaceSearchParams(Object.fromEntries(filterKeys.map((key) => [key, values[key]])), true)
      }
      onPageChange={(page) => replaceSearchParams({ [PAGE_PARAM]: String(page) }, false)}
      onPerPageChange={(size) => replaceSearchParams({ [PER_PAGE_PARAM]: String(size) }, true)}
      onQueryChange={setQuery}
    />
  )
}

/**
 * client モード。状態を state で持ち、渡された data をブラウザ側で検索・絞り込み・ページングする
 */
function ClientStateDataTable<T>({
  columns,
  data,
  emptyMessage,
  filters,
  getRowHref,
  getRowKey,
  pagination,
  search,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(resolveDefaultPageSize(pagination))
  const [query, setQuery] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})

  const filteredRows = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase()
    return data.filter((row) => {
      const matchesFilters = (filters ?? []).every((filter) => {
        if (filter.type === "dateRange") return true
        const selected = filterValues[filter.key]
        return !selected || String(row[filter.key as keyof T]) === selected
      })
      if (!matchesFilters) return false
      if (!lowerQuery || !search?.filterKeys) return true
      return search.filterKeys.some((key) => {
        const value = row[key]
        return value !== null && value !== undefined && String(value).toLowerCase().includes(lowerQuery)
      })
    })
  }, [data, filters, filterValues, query, search])

  const rows = pagination
    ? filteredRows.slice((currentPage - 1) * perPage, currentPage * perPage)
    : filteredRows

  return (
    <DataTableView
      columns={columns}
      currentPage={currentPage}
      emptyMessage={emptyMessage}
      filterValues={filterValues}
      filters={filters}
      getRowHref={getRowHref}
      getRowKey={getRowKey}
      isPending={false}
      pageSizeOptions={pagination ? resolvePageSizeOptions(pagination) : undefined}
      perPage={perPage}
      query={query}
      rows={rows}
      searchPlaceholder={search ? search.placeholder ?? "検索..." : undefined}
      totalCount={pagination ? filteredRows.length : undefined}
      onFiltersApply={(values) => {
        setFilterValues(values)
        setCurrentPage(1)
      }}
      onPageChange={setCurrentPage}
      onPerPageChange={(size) => {
        setPerPage(size)
        setCurrentPage(1)
      }}
      onQueryChange={(value) => {
        setQuery(value)
        setCurrentPage(1)
      }}
    />
  )
}

type DataTableViewProps<T> = {
  columns: Column<T>[]
  currentPage: number
  emptyMessage?: string
  filterValues: FilterValues
  filters?: FilterConfig[]
  getRowHref?: (row: T) => string
  getRowKey: (row: T) => string | number
  /** 読み込み中（server モードで URL を変えた直後）。テーブルを薄くする */
  isPending: boolean
  onFiltersApply: (values: FilterValues) => void
  onPageChange: (page: number) => void
  onPerPageChange: (size: number) => void
  onQueryChange: (query: string) => void
  /** 指定すると表示件数の選択を出す */
  pageSizeOptions?: number[]
  perPage: number
  query: string
  rows: T[]
  /** 指定すると検索バーを出す */
  searchPlaceholder?: string
  /** 指定するとフッター（件数とページ番号）を出す */
  totalCount?: number
}

/**
 * テーブルの見た目。見た目は TailAdmin のデモに合わせる（検索・Filter・表・フッターは /products-list、表示件数は /data-tables）
 */
function DataTableView<T>({
  columns,
  currentPage,
  emptyMessage,
  filterValues,
  filters,
  getRowHref,
  getRowKey,
  isPending,
  onFiltersApply,
  onPageChange,
  onPerPageChange,
  onQueryChange,
  pageSizeOptions,
  perPage,
  query,
  rows,
  searchPlaceholder,
  totalCount,
}: DataTableViewProps<T>) {
  const router = useRouter()
  const hasFilters = filters !== undefined && filters.length > 0
  const hasToolbar = pageSizeOptions !== undefined || searchPlaceholder !== undefined || hasFilters
  const totalPages = totalCount === undefined ? 1 : Math.max(1, Math.ceil(totalCount / perPage))
  const firstIndex = (currentPage - 1) * perPage + 1
  const lastIndex = firstIndex + rows.length - 1

  /**
   * 行のクリックで遷移する。行の中のリンク・ボタン・入力欄のクリックは、それぞれに任せる
   */
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!getRowHref) return
    if ((event.target as HTMLElement).closest("a, button, input, select, label")) return
    router.push(getRowHref(row))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      {hasToolbar && (
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          {pageSizeOptions ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-500 dark:text-gray-400">表示件数</span>
              <div className="relative z-20 bg-transparent">
                <select
                  aria-label="表示件数"
                  className="shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-9 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none py-2 pr-8 pl-3 text-sm text-gray-800 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  value={perPage}
                  onChange={(event) => onPerPageChange(Number(event.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} className="text-gray-500 dark:bg-gray-900 dark:text-gray-400" value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <SelectArrow />
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            {searchPlaceholder !== undefined && (
              <div className="relative flex-1 sm:flex-auto">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  <svg className="fill-current" fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                    <path
                      clipRule="evenodd"
                      d="M3.04199 9.37363C3.04199 5.87693 5.87735 3.04199 9.37533 3.04199C12.8733 3.04199 15.7087 5.87693 15.7087 9.37363C15.7087 12.8703 12.8733 15.7053 9.37533 15.7053C5.87735 15.7053 3.04199 12.8703 3.04199 9.37363ZM9.37533 1.54199C5.04926 1.54199 1.54199 5.04817 1.54199 9.37363C1.54199 13.6991 5.04926 17.2053 9.37533 17.2053C11.2676 17.2053 13.0032 16.5344 14.3572 15.4176L17.1773 18.238C17.4702 18.5309 17.945 18.5309 18.2379 18.238C18.5308 17.9451 18.5309 17.4703 18.238 17.1773L15.4182 14.3573C16.5367 13.0033 17.2087 11.2669 17.2087 9.37363C17.2087 5.04817 13.7014 1.54199 9.37533 1.54199Z"
                      fillRule="evenodd"
                    />
                  </svg>
                </span>
                <input
                  aria-label={searchPlaceholder}
                  className={`${FIELD_CLASS_NAME} h-11 py-2.5 pr-4 pl-11 sm:w-[300px] sm:min-w-[300px]`}
                  placeholder={searchPlaceholder}
                  type="text"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                />
              </div>
            )}
            {hasFilters && <FilterPopover appliedValues={filterValues} filters={filters} onApply={onFiltersApply} />}
          </div>
        </div>
      )}

      <div className={`custom-scrollbar overflow-x-auto transition-opacity ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              {columns.map((column, index) => (
                <th
                  key={column.key !== undefined ? String(column.key) : index}
                  className="px-5 py-4 text-left text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={columns.length}>
                  {emptyMessage ?? "データがありません"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  className={`transition hover:bg-gray-50 dark:hover:bg-gray-900 ${getRowHref ? "cursor-pointer" : ""}`}
                  onClick={(event) => handleRowClick(event, row)}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key !== undefined ? String(column.key) : index}
                      className={twMerge(CELL_CLASS_NAME, column.className)}
                    >
                      {column.render
                        ? column.render(row)
                        : column.key !== undefined
                          ? String(row[column.key] ?? "")
                          : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalCount !== undefined && (
        <div className="flex flex-col items-center justify-between border-t border-gray-200 px-5 py-4 sm:flex-row dark:border-gray-800">
          <div className="pb-3 sm:pb-0">
            <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              全 <span className="text-gray-800 dark:text-white/90">{totalCount}</span> 件
              {rows.length > 0 && (
                <>
                  中 <span className="text-gray-800 dark:text-white/90">{firstIndex}</span>〜
                  <span className="text-gray-800 dark:text-white/90">{lastIndex}</span> 件
                </>
              )}
            </span>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  )
}

/**
 * select の右の下向きの矢印（TailAdmin のデモの /data-tables と同じ）
 */
function SelectArrow() {
  return (
    <span className="pointer-events-none absolute top-1/2 right-2 z-30 -translate-y-1/2 text-gray-500 dark:text-gray-400">
      <svg className="stroke-current" fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.8335 5.9165L8.00016 10.0832L12.1668 5.9165" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
      </svg>
    </span>
  )
}

type FilterPopoverProps = {
  appliedValues: FilterValues
  filters: FilterConfig[]
  onApply: (values: FilterValues) => void
}

/**
 * Filter のボタンとポップオーバー。中で選んだ値は「適用」で反映する。「リセット」は空にしてすぐ反映する。
 * ポップオーバーは body の直下に出す（表の枠は overflow-hidden なので、中に置くと行が少ないときに切れる）
 */
function FilterPopover({ appliedValues, filters, onApply }: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftValues, setDraftValues] = useState<FilterValues>(appliedValues)
  const activeFilterCount = countActiveFilters(filters, appliedValues)

  const handleOpenChange = (open: boolean) => {
    if (open) setDraftValues(appliedValues)
    setIsOpen(open)
  }

  const { context, floatingStyles, refs } = useFloating({
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    onOpenChange: handleOpenChange,
    open: isOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
  })
  const { setFloating, setReference } = refs
  const { getFloatingProps, getReferenceProps } = useInteractions([
    useClick(context),
    useDismiss(context, {
      /**
       * 日付のカレンダーもポップオーバーの外（body の直下）に出るので、そこでのクリックでは閉じない
       */
      outsidePress: (event) => !(event.target as Element | null)?.closest(".flatpickr-calendar"),
    }),
    useRole(context, { role: "dialog" }),
  ])

  const updateDraftValue = (key: string, value: string) => {
    setDraftValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <>
      <button
        ref={setReference}
        className="shadow-theme-xs flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 sm:w-auto sm:min-w-[100px] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
        type="button"
        {...getReferenceProps()}
      >
        <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.6537 5.90414C14.6537 4.48433 13.5027 3.33331 12.0829 3.33331C10.6631 3.33331 9.51206 4.48433 9.51204 5.90415M14.6537 5.90414C14.6537 7.32398 13.5027 8.47498 12.0829 8.47498C10.663 8.47498 9.51204 7.32398 9.51204 5.90415M14.6537 5.90414L17.7087 5.90411M9.51204 5.90415L2.29199 5.90411M5.34694 14.0958C5.34694 12.676 6.49794 11.525 7.91777 11.525C9.33761 11.525 10.4886 12.676 10.4886 14.0958M5.34694 14.0958C5.34694 15.5156 6.49794 16.6666 7.91778 16.6666C9.33761 16.6666 10.4886 15.5156 10.4886 14.0958M5.34694 14.0958L2.29199 14.0958M10.4886 14.0958L17.7087 14.0958"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
        Filter
        {activeFilterCount > 0 && (
          <span className="bg-brand-500 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white">
            {activeFilterCount}
          </span>
        )}
      </button>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={setFloating}
            className="z-99999 w-56 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {filters.map((filter) => (
              <div key={filter.key} className="mb-5">
                <label
                  className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300"
                  htmlFor={`filter-${filter.key}`}
                >
                  {filter.label}
                </label>
                {filter.type === "dateRange" ? (
                  <div className="space-y-2">
                    <DatePicker
                      id={`filter-${filter.key}`}
                      placeholder="開始日"
                      value={draftValues[`${filter.key}_from`] ?? ""}
                      onChange={(_dates, dateStr) => updateDraftValue(`${filter.key}_from`, dateStr)}
                    />
                    <DatePicker
                      id={`filter-${filter.key}-to`}
                      placeholder="終了日"
                      value={draftValues[`${filter.key}_to`] ?? ""}
                      onChange={(_dates, dateStr) => updateDraftValue(`${filter.key}_to`, dateStr)}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      className={`${FIELD_CLASS_NAME} h-10 appearance-none px-4 py-2.5 pr-8`}
                      id={`filter-${filter.key}`}
                      value={draftValues[filter.key] ?? ""}
                      onChange={(event) => updateDraftValue(filter.key, event.target.value)}
                    >
                      <option className="text-gray-500 dark:bg-gray-900 dark:text-gray-400" value="">
                        すべて
                      </option>
                      {filter.options.map((option) => (
                        <option
                          key={option.value}
                          className="text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                )}
              </div>
            ))}
            <button
              className="bg-brand-500 hover:bg-brand-600 h-10 w-full rounded-lg px-3 py-2 text-sm font-medium text-white"
              type="button"
              onClick={() => {
                onApply(draftValues)
                setIsOpen(false)
              }}
            >
              適用
            </button>
            <button
              className="text-brand-500 hover:text-brand-600 mt-3 block w-full text-center text-xs"
              type="button"
              onClick={() => {
                setDraftValues({})
                onApply({})
              }}
            >
              リセット
            </button>
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
