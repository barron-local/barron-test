const express = require("express")
const cors = require("cors")
const path = require("path")
const fs = require("fs")
const app = express()

const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))
app.use('/docs', express.static(path.join(__dirname, 'docs')))
app.get('/api/docs', (req, res) => res.redirect('/docs'))

app.use('/api', require('./routes/auth.routes'))
app.use('/api/users', require('./routes/user.routes'))

app.listen(5000, () => console.log("Server Running on Port 5000"))