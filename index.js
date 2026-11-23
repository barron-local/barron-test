const express = require("express")
const cors = require("cors")
const path = require("path")
const fs = require("fs")
const app = express()

const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.set('trust proxy', 1)
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))
app.use('/docs', express.static(path.join(__dirname, 'docs')))
app.get(['/docs', '/api/docs'], (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'))
})

// หน้าแรก root (/) คืนค่าข้อความ 'ready' ตามที่ผู้ใช้ต้องการ
app.get('/', (req, res) => {
  res.send('ready')
})

// ตรวจสอบความพร้อมของระบบ (Health Check)
app.get('/api/health', (req, res) => {
  res.send('ready')
})

app.use('/api', require('./routes/auth.routes'))
app.use('/api/users', require('./routes/user.routes'))

app.listen(5000, () => console.log("Server Running on Port 5000"))
