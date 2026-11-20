const jwt = require("jsonwebtoken")
const JWT_SECRET = "TNK"

// ====================================================================================
// การพัฒนาระบบฝั่งเซิร์ฟเวอร์ (Back-end Development)
// หัวข้อ: พัฒนาระบบตรวจสอบสิทธิ์ (Authorization Middleware) ตรวจสอบความถูกต้องของ Token ก่อนเข้าถึง Endpoint ที่ต้องใช้สิทธิ์
// ====================================================================================

/**
 * 1. auth: ตรวจสอบความถูกต้องของ Token (JWT Authentication)
 * ตรวจสอบ Token ที่ส่งมาทาง Authorization Header: Bearer <token>
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "ไม่ได้เข้าสู่ระบบ หรือไม่พบ Access Token",
        data: null
      })
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        return res.status(403).json({
          status: "error",
          message: "Token ไม่ถูกต้องหรือหมดอายุการใช้งาน",
          data: null
        })
      }
      req.user = decodedUser
      next()
    })
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์การเข้าถึง",
      data: null
    })
  }
}

/**
 * 2. adminOnly: ตรวจสอบสิทธิ์เฉพาะผู้ดูแลระบบ (Admin Authorization)
 */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      status: "error",
      message: "สิทธิ์การเข้าถึงไม่เพียงพอ (เฉพาะ Admin เท่านั้น)",
      data: null
    })
  }
  next()
}

/**
 * 3. canEdit: ตรวจสอบสิทธิ์สำหรับผู้ที่สามารถแก้ไขข้อมูลได้ (Admin หรือ Editonly)
 */
const canEdit = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'editonly')) {
    return res.status(403).json({
      status: "error",
      message: "สิทธิ์การเข้าถึงไม่เพียงพอ (ไม่มีสิทธิ์แก้ไขข้อมูล)",
      data: null
    })
  }
  next()
}

module.exports = { JWT_SECRET, auth, adminOnly, canEdit }
