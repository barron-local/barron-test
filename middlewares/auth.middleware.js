const jwt = require("jsonwebtoken")
const JWT_SECRET = "TNK"

// ตรวจสอบว่าเข้าสู่ระบบหรือยัง (ตรวจ Token)
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ" })

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token ไม่ถูกต้อง" })
    req.user = user
    next()
  })
}

// อนุญาตเฉพาะแอดมิน
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: "เฉพาะ Admin เท่านั้น" })
  next()
}

// อนุญาตให้แก้ไขได้ (แอดมินหรือคนมีสิทธิ์แก้)
const canEdit = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'editonly') {
    return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขข้อมูล" })
  }
  next()
}

module.exports = { JWT_SECRET, auth, adminOnly, canEdit }
