import request from "supertest"

import { HealthLivenessController } from "../../../src/controller/health/liveness"
import { HealthReadinessController } from "../../../src/controller/health/readiness"
import { healthRouter } from "../../../src/routes/health-router"
import { createTestApp } from "../helper"

const app = createTestApp()

// Readiness側はダミー（livenessテストでは使わない）
const dummyReadinessController = new HealthReadinessController(
  { ping: jest.fn() },
  { ping: jest.fn() },
)

const livenessController = new HealthLivenessController()

app.use("/api/health", healthRouter(livenessController, dummyReadinessController))

describe("GET /api/health", () => {
  it("200 と status: ok を返す", async () => {
    const res = await request(app).get("/api/health")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})
