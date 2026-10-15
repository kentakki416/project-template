import { admins } from "@repo/db"

import { DrizzleAdminRepository } from "../../src/repository/drizzle/admin-repository"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testDb } from "../controller/setup"

const adminRepository = new DrizzleAdminRepository(testDb)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("AdminRepository", () => {
  describe("正常系", () => {
    it("登録した admin を findByEmail / findById で取得できる", async () => {
      const [row] = await testDb.insert(admins).values({ email: "admin@example.com", name: "Admin" }).returning()

      const expected = {
        id: row.id,
        avatarUrl: null,
        email: "admin@example.com",
        lastSignedInAt: null,
        name: "Admin",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }
      expect(await adminRepository.findByEmail("admin@example.com")).toEqual(expected)
      expect(await adminRepository.findById(row.id)).toEqual(expected)
    })

    it("recordSignIn に profile を渡すと、名前・アイコン・最終サインイン日時・更新日時が変わる", async () => {
      const [row] = await testDb
        .insert(admins)
        .values({ email: "admin@example.com", updatedAt: new Date("2026-01-01T00:00:00.000Z") })
        .returning()
      const signedInAt = new Date("2026-10-15T01:02:03.456Z")

      const updated = await adminRepository.recordSignIn(row.id, {
        profile: { avatarUrl: "https://example.com/a.png", name: "From Google" },
        signedInAt,
      })

      expect(updated).toMatchObject({
        avatarUrl: "https://example.com/a.png",
        lastSignedInAt: signedInAt,
        name: "From Google",
      })
      expect(updated.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime())
      expect(await adminRepository.findById(row.id)).toMatchObject({ lastSignedInAt: signedInAt, name: "From Google" })
    })

    it("recordSignIn に profile を渡さないと、最終サインイン日時だけが変わる", async () => {
      const [row] = await testDb
        .insert(admins)
        .values({ avatarUrl: "https://example.com/old.png", email: "admin@example.com", name: "Old" })
        .returning()
      const signedInAt = new Date("2026-10-15T01:02:03.456Z")

      const updated = await adminRepository.recordSignIn(row.id, { signedInAt })

      expect(updated).toMatchObject({ avatarUrl: "https://example.com/old.png", lastSignedInAt: signedInAt, name: "Old" })
    })
  })

  describe("異常系", () => {
    it("存在しない email / id では null を返す", async () => {
      expect(await adminRepository.findByEmail("missing@example.com")).toBeNull()
      expect(await adminRepository.findById(999999)).toBeNull()
    })

    it("recordSignIn で存在しない id を渡すと throw する", async () => {
      await expect(adminRepository.recordSignIn(999999, { signedInAt: new Date() })).rejects.toThrow()
    })

    it("同じ email は 2 回登録できない（一意制約）", async () => {
      await testDb.insert(admins).values({ email: "admin@example.com" })

      await expect(testDb.insert(admins).values({ email: "admin@example.com" })).rejects.toThrow()
    })
  })
})
