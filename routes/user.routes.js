const router = require("express").Router()
const path = require("path")
const fs = require("fs")
const multer = require("multer")
const db = require("../config/db")
const { auth, adminOnly, canEdit } = require("../middlewares/auth.middleware")

// บันทึกไฟล์ลงโฟลเดอร์ uploads โดยใช้ชื่อไฟล์เดิม
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

// ดึงรายชื่อผู้ใช้ทั้งหมด (รองรับ ค้นหา และ Filter ตามระดับสิทธิ์)
router.get('/', auth, async (req, res) => {
  const { search = '', role = '', state = '' } = req.query
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

  // 1. ค้นหาตามชื่อผู้ใช้ (ใช้ได้ทุกสิทธิ์)
  if (search.trim()) {
    query += ` AND users.username LIKE ?`
    params.push(`%${search.trim()}%`)
  }

  // 3. กรองตาม Role (เฉพาะ admin เท่านั้นที่กรองตาม role ได้)
  if (role && currentUser.role === 'admin') {
    query += ` AND users.role = ?`
    params.push(role)
  }

  // 4. กรองตาม State (active/inactive/on/off - เฉพาะ admin และ editonly)
  if (state && currentUser.role !== 'readonly') {
    query += ` AND COALESCE(status.state, 'off') = ?`
    params.push(state)
  }

  const [rows] = await db.query(query, params)
  res.json(rows)
})

// ดึงข้อมูลผู้ใช้รายคน
router.get('/:id', auth, async (req, res) => {
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
  `, [req.params.id])

  if (rows.length === 0) {
    return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้" })
  }
  res.json(rows[0])
})

// เพิ่มผู้ใช้ใหม่ (เฉพาะ Admin)
router.post('/', [auth, adminOnly], async (req, res) => {
  const { username, password, role } = req.body
  if (!username || !password) {
    return res.status(400).json({ message: "กรุณากรอก username และ password" })
  }

  try {
    const [result] = await db.query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, password, role || 'readonly']
    )
    res.status(201).json({ id: result.insertId, message: "บันทึกข้อมูลสำเร็จ" })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "มีชื่อผู้ใช้นี้ในระบบแล้ว" })
    }
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" })
  }
})

// แก้ไขข้อมูลผู้ใช้ (Admin หรือ Editonly)
router.patch('/:id', [auth, canEdit], async (req, res) => {
  const { username, password, role } = req.body
  try {
    let result
    if (req.user.role === 'admin' && role) {
      [result] = await db.query(
        "UPDATE users SET username = COALESCE(?, username), password = COALESCE(?, password), role = ? WHERE id = ?",
        [username || null, password || null, role, req.params.id]
      )
    } else {
      [result] = await db.query(
        "UPDATE users SET username = COALESCE(?, username), password = COALESCE(?, password) WHERE id = ?",
        [username || null, password || null, req.params.id]
      )
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้ที่จะแก้ไข" })
    }
    res.json({ message: "แก้ไขข้อมูลสำเร็จ" })
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล" })
  }
})

// ลบผู้ใช้ (เฉพาะ Admin)
router.delete('/:id', [auth, adminOnly], async (req, res) => {
  try {
    const [userFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [req.params.id])
    for (const f of userFiles) {
      const fPath = path.join(__dirname, "../uploads", f.filename)
      if (fs.existsSync(fPath)) {
        try { fs.unlinkSync(fPath) } catch (e) {}
      }
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [req.params.id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลผู้ใช้ที่จะลบ" })
    }
    res.json({ message: "ลบสำเร็จ" })
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบข้อมูล" })
  }
})

// แนบไฟล์ให้ผู้ใช้
router.post('/:id/upload', [auth, upload.single('file')], async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "กรุณาแนบไฟล์" })

  try {
    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [req.params.id])
    if (users.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" })

    const filename = req.file.filename

    const [oldFiles] = await db.query("SELECT filename FROM files WHERE user_id = ?", [req.params.id])
    for (const f of oldFiles) {
      if (f.filename !== filename) {
        const oldPath = path.join(__dirname, "../uploads", f.filename)
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath) } catch (e) {}
        }
      }
    }
    await db.query("DELETE FROM files WHERE user_id = ?", [req.params.id])

    await db.query(
      "INSERT INTO files (user_id, filename) VALUES (?, ?)",
      [req.params.id, filename]
    )

    res.json({ message: "แนบไฟล์สำเร็จ", filename })
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปโหลดไฟล์" })
  }
})

module.exports = router
