const assert = require("assert")
const jwt = require("jsonwebtoken")
const request = require("supertest")
const createApp = require("./app")
const { JWT_SECRET } = require("./middlewares/auth.middleware")

async function runTests() {
  console.log("==========================================")
  console.log("  Running CI Automated Test Suite")
  console.log("==========================================\n")

  // ----------------------------------------------------
  // 1. UNIT TESTING (ทดสอบ Logic ของฟังก์ชันเดี่ยว)
  // ----------------------------------------------------
  console.log("--- [1] Unit Testing ---")

  // Case 1.1: ทดสอบการเซ็นและถอดรหัส JWT Token
  const payload = { id: 1, username: "admin", role: "admin" }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" })
  const decoded = jwt.verify(token, JWT_SECRET)
  assert.strictEqual(decoded.username, "admin", "Unit 1.1: Username ต้องตรงกับ Payload")
  assert.strictEqual(decoded.role, "admin", "Unit 1.1: Role ต้องเป็น admin")
  console.log("ok - Unit 1: JWT token generation and verification passed")

  // Case 1.2: ทดสอบการปฏิเสธ Token ที่ไม่ถูกต้อง (Invalid Secret)
  assert.throws(() => {
    jwt.verify(token, "WRONG_SECRET")
  }, /invalid signature/, "Unit 1.2: ต้องปฏิเสธ Secret ที่ไม่ถูกต้อง")
  console.log("ok - Unit 2: Invalid JWT signature rejection passed\n")

  // ----------------------------------------------------
  // 2. INTEGRATION TESTING (ทดสอบการทำงานเชื่อมโยง API Endpoints จริง)
  // ----------------------------------------------------
  console.log("--- [2] Integration Testing ---")
  const app = createApp()

  // Case 2.1: ทดสอบ Health Check Endpoint
  const healthRes = await request(app).get("/api/health")
  assert.strictEqual(healthRes.statusCode, 200, "Integration 2.1: /api/health ต้องตอบ 200")
  assert.strictEqual(healthRes.text, "ready", "Integration 2.1: Body ต้องตอบ ready")
  console.log("ok - Integration 1: Health check endpoint (GET /api/health) passed")

  // Case 2.2: ทดสอบระบบความปลอดภัย เมื่อไม่ส่ง Token เข้ามา (ต้องตอบ 401 Unauthorized)
  const unauthRes = await request(app).get("/api/users")
  assert.strictEqual(unauthRes.statusCode, 401, "Integration 2.2: ต้องตอบ 401 เมื่อไม่มี Token")
  console.log("ok - Integration 2: Security guard unauthorized access (GET /api/users) passed")

  // Case 2.3: ทดสอบระบบตรวจจับ Token ปลอม (ต้องตอบ 403 Forbidden)
  const forbiddenRes = await request(app)
    .get("/api/users")
    .set("Authorization", "Bearer fake_token_12345")
  assert.strictEqual(forbiddenRes.statusCode, 403, "Integration 2.3: ต้องตอบ 403 เมื่อ Token ไม่ถูกต้อง")
  console.log("ok - Integration 3: Security guard invalid token (GET /api/users) passed")

  console.log("\n==========================================")
  console.log("  All Unit & Integration Tests Passed! 100%")
  console.log("==========================================")
  process.exit(0)
}

runTests().catch(err => {
  console.error("Test Failed:", err)
  process.exit(1)
})
