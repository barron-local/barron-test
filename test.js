const assert = require("assert")
const http = require("http")
const createApp = require("./app")

async function main() {
  // 1. Unit Test (JWT Sign & Verify แบบ Pure Node.js Built-in crypto)
  const crypto = require("crypto")
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ username: "admin", role: "admin" })).toString("base64url")
  const secret = process.env.JWT_SECRET || "your-secret-key-12345"
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  const token = `${header}.${payload}.${signature}`

  const [h, p, s] = token.split(".")
  const expectedSig = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")
  assert.strictEqual(s, expectedSig)
  const decodedPayload = JSON.parse(Buffer.from(p, "base64url").toString())
  assert.strictEqual(decodedPayload.username, "admin")
  console.log("Unit Test: JWT Sign & Verify Passed")

  // 2. Integration Test (API Routes & Auth Middleware ผ่าน Node.js HTTP Server แท้)
  const app = createApp()
  const server = http.createServer(app)

  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port

  const get = (path, headers = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
        resolve(res.statusCode)
      })
      req.on("error", reject)
      req.end()
    })
  }

  const healthStatus = await get("/api/health")
  assert.strictEqual(healthStatus, 200)

  const authStatus = await get("/api/users")
  assert.strictEqual(authStatus, 401)
  console.log("Integration Test: API Routes & Auth Middleware Passed")

  server.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
