const router = require("express").Router()
const path = require("path")
const fs = require("fs")
const multer = require("multer")
const db = require("../config/db")
const { auth, adminOnly, canEdit } = require("../middlewares/auth.middleware")

// ตั้งค่า Multer Storage สำหรับอัปโหลดไฟล์ลงโฟลเดอร์ uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads")
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage })

// 1. ดึงรายชื่อผู้ใช้ทั้งหมด รองรับ Search, กรองตามสิทธิ์ (role, state) และการแบ่งหน้า (Pagination)
router.get('/', auth, async (req, res) => {
  try {
    const { search = '', role = '', state = '', page = 1, limit = 10 } = req.query
    const currentUser = req.user

    let query = `
      SELECT 
        users.id, 
        users.username, 
        users.role, 
        status.state,
        (SELECT logged_at FROM log WHERE log.user_id = users.id ORDER BY id DESC LIMIT 1) AS logged_at,
        files.filename
      FROM users
      LEFT JOIN status ON users.id = status.user_id
      LEFT JOIN files ON users.id = files.user_id
      WHERE 1=1
    `
    const params = []

    if (search.trim()) {
      query += ` AND users.username LIKE ?`
      params.push(`%${search.trim()}%`)
    }

    if (role && currentUser.role === 'admin') {
      query += ` AND users.role = ?`
      params.push(role)
    }

    if (state && currentUser.role !== 'readonly') {
      query += ` AND COALESCE(status.state, 'off') = ?`
      params.push(state)
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, parseInt(limit) || 10)
    const offset = (pageNum - 1) * limitNum

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as totalTable`
    const [countRows] = await db.query(countQuery, params)
    const total = countRows[0]?.total || 0

    query += ` ORDER BY users.id DESC LIMIT ? OFFSET ?`
    params.push(limitNum, offset)

    const [rows] = await db.query(query, params)

    return res.status(200).json({
      status: "success",
      message: "ดึงรายการข้อมูลผู้ใช้สำเร็จ",
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    })
  } catch (error) {
    console.error("GET /api/users Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้",
      data: null
    })
  }
})

// 2. ดึงข้อมูลผู้ใช้รายบุคคลตาม id ที่ระบุใน Path Parameter
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params

    const [rows] = await db.query(`
      SELECT 
        users.id, 
        users.username, 
        users.role, 
        status.state,
        files.filename
      FROM users
      LEFT JOIN status ON users.id = status.user_id
      LEFT JOIN files ON users.id = files.user_id
      WHERE users.id = ?
    `, [id])

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ในระบบ",
        data: null
      })
    }

    return res.status(200).json({
      status: "success",
      message: "ดึงข้อมูลผู้ใช้สำเร็จ",
      data: rows[0]
    })
  } catch (error) {
    console.error("GET /api/users/:id Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้",
      data: null
    })
  }
})

// 3. เพิ่มผู้ใช้ใหม่เข้าสู่ระบบ พร้อมตรวจสอบความถูกต้องของข้อมูล (เฉพาะ Admin)
router.post('/', [auth, adminOnly], async (req, res) => {
  try {
    const { username, password, role } = req.body

    if (!username || !password) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูล username และ password ให้ครบถ้วน",
        data: null
      })
    }

    const [result] = await db.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username.trim(), password.trim(), role || 'readonly']
    )

    return res.status(201).json({
      status: "success",
      message: "บันทึกข้อมูลสำเร็จ",
      id: result.insertId,
      data: {
        id: result.insertId,
        username: username.trim(),
        role: role || 'readonly'
      }
    })
  } catch (error) {
    console.error("POST /api/users Error:", error)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        status: "error",
        message: "มีชื่อผู้ใช้นี้ในระบบแล้ว กรุณาใช้ชื่ออื่น",
        data: null
      })
    }
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้",
      data: null
    })
  }
})

// 4. อัปโหลดและแนบไฟล์ข้อมูลให้กับผู้ใช้งาน พร้อมลบไฟล์เก่าออกจากระบบ
router.post('/:id/upload', [auth, upload.single('file')], async (req, res) => {
  try {
    const { id } = req.params

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์ที่ต้องการอัปโหลด",
        data: null
      })
    }

    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [id])
    if (users.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแนบไฟล์",
        data: null
      })
    }

    const filename = req.file.filename

    const [oldFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [id])
    for (const f of oldFiles) {
      if (f.filename !== filename) {
        const oldPath = path.join(__dirname, "../uploads", f.filename)
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath) } catch (e) { }
        }
      }
    }
    await db.query("DELETE FROM files WHERE user_id = ?", [id])

    await db.query(
      "INSERT INTO files (user_id, filename) VALUES (?, ?)",
      [id, filename]
    )

    return res.status(200).json({
      status: "success",
      message: "แนบไฟล์สำเร็จ",
      filename,
      data: {
        userId: id,
        filename
      }
    })
  } catch (error) {
    console.error("POST /api/users/:id/upload Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์",
      data: null
    })
  }
})

// 5. แก้ไขข้อมูลผู้ใช้และไฟล์แนบเดิม (Admin หรือ Editonly)
router.patch('/:id', [auth, canEdit, upload.single('file')], async (req, res) => {
  try {
    const { id } = req.params
    const { username, password, role } = req.body

    const [existing] = await db.query("SELECT id, username, role FROM users WHERE id = ?", [id])
    if (existing.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ที่จะแก้ไข",
        data: null
      })
    }

    if (req.user.role === 'admin' && role) {
      await db.query(
        "UPDATE users SET username = COALESCE(?, username), password = COALESCE(?, password), role = ? WHERE id = ?",
        [username || null, password || null, role, id]
      )
    } else {
      await db.query(
        "UPDATE users SET username = COALESCE(?, username), password = COALESCE(?, password) WHERE id = ?",
        [username || null, password || null, id]
      )
    }

    let updatedFilename = null
    if (req.file) {
      updatedFilename = req.file.filename
      const [oldFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [id])
      for (const f of oldFiles) {
        if (f.filename !== updatedFilename) {
          const oldPath = path.join(__dirname, "../uploads", f.filename)
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath) } catch (e) { }
          }
        }
      }
      await db.query("DELETE FROM files WHERE user_id = ?", [id])
      await db.query("INSERT INTO files (user_id, filename) VALUES (?, ?)", [id, updatedFilename])
    }

    return res.status(200).json({
      status: "success",
      message: "แก้ไขข้อมูลสำเร็จ",
      data: {
        id,
        filename: updatedFilename
      }
    })
  } catch (error) {
    console.error("PATCH /api/users/:id Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล",
      data: null
    })
  }
})

// 6. ลบข้อมูลผู้ใช้และไฟล์แนบที่เกี่ยวข้องออกจากระบบ (เฉพาะ Admin)
router.delete('/:id', [auth, adminOnly], async (req, res) => {
  try {
    const { id } = req.params

    const [userFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [id])
    for (const f of userFiles) {
      const fPath = path.join(__dirname, "../uploads", f.filename)
      if (fs.existsSync(fPath)) {
        try { fs.unlinkSync(fPath) } catch (e) { }
      }
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ที่จะลบ",
        data: null
      })
    }

    return res.status(200).json({
      status: "success",
      message: "ลบสำเร็จ",
      data: { id }
    })
  } catch (error) {
    console.error("DELETE /api/users/:id Error:", error)
    return res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการลบข้อมูล",
      data: null
    })
  }
})

module.exports = router
