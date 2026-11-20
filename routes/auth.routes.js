const express = require("express")
const jwt = require("jsonwebtoken")
const db = require("../config/db")
const { JWT_SECRET, auth } = require("../middlewares/auth.middleware")
const router = express.Router()

// ====================================================================================
// การพัฒนาระบบฝั่งเซิร์ฟเวอร์ (Back-end Development)
// หัวข้อ: พัฒนาระบบยืนยันตัวตน (Authentication)
// ====================================================================================

/**
 * 1. สร้าง API Login โดยออก JSON Web Token (JWT) ที่มีการลงนาม (Signing) อย่างปลอดภัย
 * Method: POST
 * Route: /api/login
 * Request Body: { username: string, password: string }
 * Response JSON: { status: 'success', message: string, data: { token, user: { id, username, role } } }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // ตรวจสอบข้อมูลนำเข้า
    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอก username และ password ให้ครบถ้วน",
        data: null
      })
    }

    // ตรวจสอบข้อมูลผู้ใช้ในฐานข้อมูล
    const [users] = await db.query(
      "SELECT id, username, password, role FROM users WHERE username = ? AND password = ?",
      [username, password]
    )

    if (users.length === 0) {
      return res.status(401).json({
        status: "error",
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        data: null
      })
    }

    const user = users[0]

    // บันทึกเวลาเข้าใช้งานลงตาราง log
    await db.query("INSERT INTO log (user_id, logged_at) VALUES (?, NOW())", [user.id])

    // ปรับสถานะเป็นออนไลน์ (on) ลงตาราง status
    await db.query(`
      INSERT INTO status (user_id, state) VALUES (?, 'on')
      ON DUPLICATE KEY UPDATE state = 'on'
    `, [user.id])

    // ออก JWT Token โดยลงนาม (Signing) ด้วย Secret Key
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    )

    // ส่งคืนข้อมูล Response Body แบบมาตรฐาน JSON
    return res.status(200).json({
      status: "success",
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      id: user.id,
      user_id: user.id,
      username: user.username,
      role: user.role,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    })
  } catch (error) {
    console.error("Login Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
      data: null
    })
  }
})

/**
 * Method: POST
 * Route: /api/logout
 * Header: Authorization: Bearer <token>
 * คำอธิบาย: ออกจากระบบ และอัปเดตสถานะในระบบเป็น off
 */
router.post('/logout', auth, async (req, res) => {
  try {
    await db.query("UPDATE status SET state = 'off' WHERE user_id = ?", [req.user.id])
    return res.status(200).json({
      status: "success",
      message: "ออกจากระบบสำเร็จ",
      data: null
    })
  } catch (error) {
    console.error("Logout Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการออกจากระบบ",
      data: null
    })
  }
})

/**
 * Method: GET
 * Route: /api/me
 * Header: Authorization: Bearer <token>
 * คำอธิบาย: ดูข้อมูลและสถานะของผู้ใช้งานปัจจุบันที่เข้าสู่ระบบอยู่
 */
router.get('/me', auth, async (req, res) => {
  try {
    const [statusRows] = await db.query("SELECT state FROM status WHERE user_id = ?", [req.user.id])
    const [logRows] = await db.query("SELECT logged_at FROM log WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id])

    return res.status(200).json({
      status: "success",
      message: "ดึงข้อมูลผู้ใช้งานปัจจุบันสำเร็จ",
      data: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        state: statusRows[0]?.state || 'off',
        logged_at: logRows[0]?.logged_at || null
      }
    })
  } catch (error) {
    console.error("Get Profile Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลส่วนตัว",
      data: null
    })
  }
})

module.exports = router
