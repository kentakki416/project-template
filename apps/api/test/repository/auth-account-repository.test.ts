import { authAccounts, users } from "@repo/db"

import { DrizzleAuthAccountRepository } from "../../src/repository/drizzle/auth-account-repository"
import { DrizzleUserRepository } from "../../src/repository/drizzle/user-repository"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../controller/setup"

const authAccountRepository = new DrizzleAuthAccountRepository(testDb)
const userRepository = new DrizzleUserRepository(testDb)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("AuthAccountRepository", () => {
  describe("正常系", () => {
    it("create した認証アカウントを、紐付くユーザーごと findByProvider で取得できる", async () => {
      const user = await userRepository.create({ email: "test@example.com", name: "Test User" })
      const created = await authAccountRepository.create({
        provider: "google",
        providerAccountId: "google-123",
        userId: user.id,
      })

      const found = await authAccountRepository.findByProvider("google", "google-123")

      expect(found).toEqual({ ...created, user })
    })

    it("findByUserId はユーザーのログイン方法を紐付けた順に返し、他のユーザーのものは含めない", async () => {
      const user = await userRepository.create({ email: "test@example.com" })
      const other = await userRepository.create({ email: "other@example.com" })
      await testDb.insert(authAccounts).values([
        { createdAt: new Date("2026-10-02T00:00:00.000Z"), provider: "google", providerAccountId: "google-1", userId: user.id },
        { createdAt: new Date("2026-10-01T00:00:00.000Z"), provider: "dev", providerAccountId: "dev-1", userId: user.id },
        { provider: "google", providerAccountId: "google-2", userId: other.id },
      ])

      const found = await authAccountRepository.findByUserId(user.id)

      expect(found.map((account) => account.provider)).toEqual(["dev", "google"])
      expect(found.every((account) => account.userId === user.id)).toBe(true)
    })

    it("findByUserId はログイン方法が無ければ空配列を返す", async () => {
      const user = await userRepository.create({ email: "test@example.com" })

      expect(await authAccountRepository.findByUserId(user.id)).toEqual([])
    })
  })

  describe("異常系", () => {
    it("存在しない provider / providerAccountId では null を返す", async () => {
      expect(await authAccountRepository.findByProvider("google", "missing")).toBeNull()
    })

    it("同じ provider / providerAccountId を重複して作ると throw する", async () => {
      const user = await userRepository.create({ email: "test@example.com" })
      const input = { provider: "google" as const, providerAccountId: "google-123", userId: user.id }
      await authAccountRepository.create(input)

      await expect(authAccountRepository.create(input)).rejects.toThrow()
    })

    it("AUTH_PROVIDERS に無い provider は CHECK 制約で insert できない", async () => {
      const [user] = await testDb.insert(users).values({ email: "test@example.com" }).returning()

      await expect(
        testDb.insert(authAccounts).values({ provider: "github" as never, providerAccountId: "github-1", userId: user.id }),
      ).rejects.toThrow()
    })
  })
})
