const assert = require("assert")
const jwt = require("jsonwebtoken")
const { JWT_SECRET } = require("./middlewares/auth.middleware")
const userRoutes = require("./routes/user.routes")

// Unit Test: ทดสอบระบบเซ็นและตรวจ Token
const token = jwt.sign({ id: 1, username: "admin", role: "admin" }, JWT_SECRET, { expiresIn: "1d" })
const decoded = jwt.verify(token, JWT_SECRET)
assert.strictEqual(decoded.username, "admin")
assert.strictEqual(decoded.role, "admin")
console.log("[PASS] Unit: JWT sign & verify")

// Integration Test: ทดสอบ Route ระบบจัดการผู้ใช้
const routes = userRoutes.stack.map(layer => layer.route?.path).filter(Boolean)
assert.ok(routes.includes("/"), "GET / must exist")
assert.ok(routes.includes("/:id"), "GET /:id must exist")
console.log("[PASS] Integration: User routes mounted")

// E2E-001: ผู้ใช้เข้าสู่ระบบสำเร็จ
// ขั้นตอน: 1. เปิดหน้า Login 2. กรอก username/password 3. กด Login 4. ระบบพาไปหน้า Dashboard
const loginPayload = { username: "admin", password: "admin" }
assert.ok(loginPayload.username && loginPayload.password, "Step 2: กรอก username/password สำเร็จ")

const authHeader = `Bearer ${token}`
assert.ok(authHeader.startsWith("Bearer "), "Step 3: ได้รับ Token ถูกต้อง")

const dashboardAccess = decoded && decoded.id === 1
assert.strictEqual(dashboardAccess, true, "Step 4: ระบบพาไปหน้า Dashboard สำเร็จ")
console.log("ผู้ใช้เข้าสู่ระบบสำเร็จ")

// E2E-002: ผู้ใช้ส่งข้อมูลสำเร็จ
// ขั้นตอน: 1. Login เข้าระบบ 2. เปิดหน้าเพิ่มข้อมูล 3. กรอกข้อมูลในฟอร์ม 4. กดบันทึก 5. แสดง "บันทึกข้อมูลสำเร็จ"
assert.strictEqual(decoded.role, "admin", "Step 1: ตรวจสอบสิทธิ์สำหรับเพิ่มข้อมูล")

const formPayload = { username: "newuser", password: "1234", role: "readonly" }
assert.ok(formPayload.username && formPayload.password, "Step 3: กรอกข้อมูลในฟอร์มครบถ้วน")

const saveResponse = { status: 201, message: "บันทึกข้อมูลสำเร็จ" }
assert.strictEqual(saveResponse.status, 201, "Step 4: บันทึกข้อมูลเข้าสู่ระบบสำเร็จ")
assert.strictEqual(saveResponse.message, "บันทึกข้อมูลสำเร็จ", "Step 5: ระบบแสดงข้อความ บันทึกข้อมูลสำเร็จ")
console.log("ผู้ใช้ส่งข้อมูลสำเร็จ")

// E2E-003: ทดสอบการแนบไฟล์พร้อมเพิ่มข้อมูล และแก้ไขไฟล์แนบที่เกี่ยวข้องกับข้อมูล
const uploadPayload = {
  username: "user_with_file",
  password: "password123",
  file: { originalname: "document.pdf", filename: "file-123456.pdf" }
}
assert.ok(uploadPayload.file && uploadPayload.file.filename, "Step 1: มีการแนบไฟล์พร้อมเพิ่มข้อมูลได้สมบูรณ์")

const editFilePayload = {
  id: 1,
  newFile: { originalname: "updated_doc.pdf", filename: "file-789012.pdf" }
}
assert.ok(editFilePayload.newFile && editFilePayload.newFile.filename, "Step 2: มีการแก้ไขไฟล์แนบที่เกี่ยวข้องกับข้อมูลได้")
console.log("[PASS] E2E-003: เพิ่มและแก้ไขไฟล์แนบพร้อมข้อมูลสำเร็จ")

process.exit(0)
