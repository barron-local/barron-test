const jwt = require("jsonwebtoken")
const JWT_SECRET = "TNK"

// 1. ด่านตรวจคนเข้าเมือง: ตรวจบัตรผ่าน (Token) ก่อนว่าล็อกอินมาจริงไหม
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

// 2. ด่านตรวจเฉพาะแอดมิน: คนธรรมดาห้ามผ่านเข้ามาเด็ดขาด
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

// 3. ด่านตรวจคนมีสิทธิ์แก้ไข: ต้องเป็นแอดมินหรือคนที่ได้รับอนุญาตให้แก้เท่านั้น
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
