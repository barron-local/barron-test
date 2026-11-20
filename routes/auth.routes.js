const express = require("express")
const jwt = require("jsonwebtoken")
const db = require("../config/db")
const { JWT_SECRET, auth } = require("../middlewares/auth.middleware")
const router = express.Router()

// เข้าสู่ระบบ
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  const [users] = await db.query(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password]
  )
  if (users.length === 0) {
    return res.status(401).json({ message: "ชื่อหรือรหัสผ่านผิด" })
  }

  const user = users[0]

  // บันทึกเวลาเข้าใช้งาน
  await db.query("INSERT INTO log (user_id, logged_at) VALUES (?, NOW())", [user.id])

  // ปรับสถานะเป็นออนไลน์
  await db.query(`
    INSERT INTO status (user_id, state) VALUES (?, 'on')
    ON DUPLICATE KEY UPDATE state = 'on'
  `, [user.id])

  // สร้าง token ส่งกลับไป
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  )

  res.json({
    message: "เข้าสู่ระบบสำเร็จ",
    token,
    id: user.id,
    user_id: user.id,
    username: user.username,
    role: user.role
  })
})

// ออกจากระบบ
router.post('/logout', auth, async (req, res) => {
  await db.query("UPDATE status SET state = 'off' WHERE user_id = ?", [req.user.id])
  res.json({ message: "ออกจากระบบสำเร็จ" })
})

// ดูข้อมูลตนเอง
router.get('/me', auth, async (req, res) => {
  const [statusRows] = await db.query("SELECT state FROM status WHERE user_id = ?", [req.user.id])
  const [logRows] = await db.query("SELECT logged_at FROM log WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id])

  res.json({
    id: req.user.id,
    username: req.user.username,
    state: statusRows[0]?.state || 'off',
    logged_at: logRows[0]?.logged_at || null
  })
})

module.exports = router
