import { SearchUsersInput, SearchUsersResult, UserRepository } from "../../../src/repository"
import { searchUsers } from "../../../src/service/user-service"

const mockSearch = vi.fn<(_0: SearchUsersInput) => Promise<SearchUsersResult>>()
const mockUserRepository: UserRepository = {
  create: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  search: mockSearch,
}

const repo = { userRepository: mockUserRepository }

describe("searchUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearch.mockResolvedValue({ totalCount: 0, users: [] })
  })

  describe("正常系", () => {
    it("page と perPage から offset を計算し、条件をそのまま渡して結果を返す", async () => {
      const createdBefore = new Date("2026-11-01T00:00:00+09:00")
      const createdFrom = new Date("2026-10-01T00:00:00+09:00")
      mockSearch.mockResolvedValue({ totalCount: 41, users: [] })

      const result = await searchUsers(
        { createdBefore, createdFrom, page: 3, perPage: 20, provider: "google", query: "alice" },
        repo,
      )

      expect(result).toEqual({ ok: true, value: { totalCount: 41, users: [] } })
      expect(mockSearch).toHaveBeenCalledWith({
        createdBefore,
        createdFrom,
        limit: 20,
        offset: 40,
        provider: "google",
        query: "alice",
      })
    })

    it("1 ページ目は offset 0", async () => {
      await searchUsers({ page: 1, perPage: 10 }, repo)

      expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 0 }))
    })

    it("空の検索語は条件にしない", async () => {
      await searchUsers({ page: 1, perPage: 20, query: "" }, repo)

      expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }))
    })
  })
})
