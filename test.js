const assert = require("assert")
const jwt = require("jsonwebtoken")
const request = require("supertest")
const createApp = require("./app")
const { JWT_SECRET } = require("./middlewares/auth.middleware")

async function main() {
  // Unit Test: JWT Token
  const token = jwt.sign({ username: "admin", role: "admin" }, JWT_SECRET)
  const decoded = jwt.verify(token, JWT_SECRET)
  assert.strictEqual(decoded.username, "admin")
  console.log("Unit Test: JWT Sign & Verify Passed")

  // Integration Test: API Endpoint & Auth Middleware
  const app = createApp()
  const res = await request(app).get("/api/health")
  assert.strictEqual(res.statusCode, 200)

  const authCheck = await request(app).get("/api/users")
  assert.strictEqual(authCheck.statusCode, 401)
  console.log("Integration Test: API Routes & Auth Middleware Passed")

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
