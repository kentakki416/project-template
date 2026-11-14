import { isPathUnderPrefix } from "../../src/lib/is-path-under-prefix"

describe("isPathUnderPrefix", () => {
  describe("正常系", () => {
    it("完全一致なら true", () => {
      expect(isPathUnderPrefix("/api/admin", "/api/admin")).toBe(true)
    })

    it("segment 境界で prefix の下なら true", () => {
      expect(isPathUnderPrefix("/api/admin/users/1", "/api/admin")).toBe(true)
    })

    it("大文字小文字が違っても true（Express の mount と同じ扱い）", () => {
      expect(isPathUnderPrefix("/API/Admin/users", "/api/admin")).toBe(true)
      expect(isPathUnderPrefix("/api/admin", "/API/ADMIN")).toBe(true)
    })
  })

  describe("異常系", () => {
    it("segment 境界でない前方一致は false", () => {
      expect(isPathUnderPrefix("/api/admin-foo", "/api/admin")).toBe(false)
    })

    it("別のパスは false", () => {
      expect(isPathUnderPrefix("/api/user", "/api/admin")).toBe(false)
    })
  })
})
