const router = require("express").Router()
const path = require("path")
const fs = require("fs")
const multer = require("multer")
const db = require("../config/db")
const { auth, adminOnly, canEdit } = require("../middlewares/auth.middleware")

// ====================================================================================
// การพัฒนาระบบฝั่งเซิร์ฟเวอร์ (Back-end Development)
// หัวข้อ: โครงสร้างโค้ด Back-end มีโครงสร้างดี แบ่งโมดูลและเราต์ (Router) ชัดเจน และใช้ async/await อย่างเหมาะสม
// ====================================================================================

// ตั้งค่า Multer Storage สำหรับอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads")
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // บันทึกไฟล์ด้วยชื่อเดิม หรือ Timestamp ป้องกันชื่อซ้ำ
    cb(null, file.originalname)
  }
})
const upload = multer({ storage })

// ------------------------------------------------------------------------------------
// 1. สร้าง API แบบ GET ที่รองรับการรับค่าผ่าน Query Parameters
// Method: GET
// Endpoint: /api/users
// Parameters (Query): search, role, state, page, limit
// คำอธิบาย: ดึงรายชื่อผู้ใช้ทั้งหมด รองรับ Search, Filter และ Pagination (แบ่งหน้า)
// ------------------------------------------------------------------------------------
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

    // 1.1 ค้นหาผ่าน Query Parameter (search)
    if (search.trim()) {
      query += ` AND users.username LIKE ?`
      params.push(`%${search.trim()}%`)
    }

    // 1.2 กรองข้อมูลผ่าน Query Parameter (role) - เฉพาะ admin มีสิทธิ์กรองตามบทบาท
    if (role && currentUser.role === 'admin') {
      query += ` AND users.role = ?`
      params.push(role)
    }

    // 1.3 กรองข้อมูลผ่าน Query Parameter (state) - admin และ editonly มีสิทธิ์กรอง
    if (state && currentUser.role !== 'readonly') {
      query += ` AND COALESCE(status.state, 'off') = ?`
      params.push(state)
    }

    // คำนวณ Pagination
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, parseInt(limit) || 10)
    const offset = (pageNum - 1) * limitNum

    // ดึงจำนวนรายการทั้งหมดเพื่อทำ Pagination metadata
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as totalTable`
    const [countRows] = await db.query(countQuery, params)
    const total = countRows[0]?.total || 0

    query += ` ORDER BY users.id DESC LIMIT ? OFFSET ?`
    params.push(limitNum, offset)

    const [rows] = await db.query(query, params)

    // ส่ง Response โครงสร้างชัดเจนมาตรฐาน JSON (status, message, data, pagination)
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

// ------------------------------------------------------------------------------------
// 2. สร้าง API แบบ GET ที่รองรับการรับค่าผ่าน Path Parameters
// Method: GET
// Endpoint: /api/users/:id
// Parameters (Path): id (รหัสผู้ใช้)
// คำอธิบาย: ค้นหาและดึงข้อมูลผู้ใช้รายบุคคลตาม id ที่ระบุใน Path Parameter
// ------------------------------------------------------------------------------------
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

    // มีการจัดการข้อยกเว้น กรณีไม่พบข้อมูลในระบบ (Exception Handling / Not Found)
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

// ------------------------------------------------------------------------------------
// 3. สร้าง API แบบ POST ที่รับและประมวลผลข้อมูลจาก Request Body ได้อย่างถูกต้อง
// Method: POST
// Endpoint: /api/users
// Parameters (Body): { username: string, password: string, role: string }
// คำอธิบาย: เพิ่มผู้ใช้ใหม่เข้าสู่ระบบ พร้อมตรวจสอบข้อมูลความถูกต้อง (เฉพาะ Admin)
// ------------------------------------------------------------------------------------
router.post('/', [auth, adminOnly], async (req, res) => {
  try {
    const { username, password, role } = req.body

    // ตรวจสอบความครบถ้วนของข้อมูลใน Body (Exception Handling)
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
    // ตรวจสอบข้อผิดพลาดกรณีข้อมูลซ้ำ (Duplicate Entry)
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

// ------------------------------------------------------------------------------------
// 4. สร้าง API สำหรับรองรับการอัปโหลดไฟล์ (File Upload)
// Method: POST
// Endpoint: /api/users/:id/upload
// Parameters: Path parameter :id, Multipart/Form-data (file)
// คำอธิบาย: อัปโหลดและแนบไฟล์ข้อมูลให้กับผู้ใช้งานที่ระบุ พร้อมลบไฟล์เก่า (ถ้ามี)
// ------------------------------------------------------------------------------------
router.post('/:id/upload', [auth, upload.single('file')], async (req, res) => {
  try {
    const { id } = req.params

    // ตรวจสอบว่ามีการแนบไฟล์มาหรือไม่
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาแนบไฟล์ที่ต้องการอัปโหลด",
        data: null
      })
    }

    // ตรวจสอบว่ามีผู้ใช้นี้อยู่จริงหรือไม่
    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [id])
    if (users.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ที่ต้องการแนบไฟล์",
        data: null
      })
    }

    const filename = req.file.filename

    // ลบประวัติและไฟล์เก่าออกจากระบบหากมีอยู่
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

    // บันทึกชื่อไฟล์ใหม่ลงตาราง files
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

// ------------------------------------------------------------------------------------
// 5. สร้าง API แบบ PUT / PATCH สำหรับแก้ไขและปรับปรุงข้อมูล
// Method: PATCH หรือ PUT
// Endpoint: /api/users/:id
// Parameters: Path parameter :id, Body / Form-data { username, password, role, file }
// คำอธิบาย: แก้ไขข้อมูลผู้ใช้และไฟล์แนบ (สิทธิ์ Admin หรือ Editonly)
// ------------------------------------------------------------------------------------
router.patch('/:id', [auth, canEdit, upload.single('file')], async (req, res) => {
  try {
    const { id } = req.params
    const { username, password, role } = req.body

    // ตรวจสอบว่ามีผู้ใช้นี้อยู่หรือไม่
    const [existing] = await db.query("SELECT id, username, role FROM users WHERE id = ?", [id])
    if (existing.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูลผู้ใช้ที่จะแก้ไข",
        data: null
      })
    }

    // อัปเดตข้อมูลผู้ใช้
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

    // หากมีการแนบไฟล์ใหม่มาพร้อมกับการแก้ไขข้อมูล
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

// ------------------------------------------------------------------------------------
// 6. สร้าง API แบบ DELETE สำหรับลบข้อมูล
// Method: DELETE
// Endpoint: /api/users/:id
// Parameters: Path parameter :id
// คำอธิบาย: ลบข้อมูลผู้ใช้และไฟล์แนบที่เกี่ยวข้องออกจากระบบ (เฉพาะ Admin)
// ------------------------------------------------------------------------------------
router.delete('/:id', [auth, adminOnly], async (req, res) => {
  try {
    const { id } = req.params

    // ลบไฟล์ในโฟลเดอร์ uploads ของผู้ใช้นี้
    const [userFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [id])
    for (const f of userFiles) {
      const fPath = path.join(__dirname, "../uploads", f.filename)
      if (fs.existsSync(fPath)) {
        try { fs.unlinkSync(fPath) } catch (e) { }
      }
    }

    // ลบข้อมูลผู้ใช้จากฐานข้อมูล
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
