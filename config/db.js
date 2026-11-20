const mysql = require("mysql2/promise")

// ข้อมูลเชื่อมต่อ MySQL
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "my_app"
}

const db = mysql.createPool(dbConfig)

// สร้างฐานข้อมูลและตารางเริ่มต้น
const initDB = async () => {
  try {
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    })
    await rootConn.query("CREATE DATABASE IF NOT EXISTS `my_app`")
    await rootConn.end()

    // ตาราง users
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'editonly', 'readonly') NOT NULL DEFAULT 'readonly'
      )
    `)

    // ข้อมูลผู้ใช้เริ่มต้น
    await db.query(`
      INSERT IGNORE INTO users (id, username, password, role) VALUES 
        (1, 'admin', 'admin', 'admin'), 
        (2, 'editor', 'editor', 'editonly'), 
        (3, 'user', 'user', 'readonly')
    `)

    // ตาราง log บันทึกเวลาล็อกอิน
    await db.query(`
      CREATE TABLE IF NOT EXISTS log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // ตาราง status เก็บสถานะ on/off
    await db.query(`
      CREATE TABLE IF NOT EXISTS status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        state ENUM('on', 'off') NOT NULL DEFAULT 'off',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // ตาราง files เก็บชื่อไฟล์แนบ
    await db.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

  } catch (e) {
    console.error("DB Init Error:", e.message)
  }
}

initDB()

module.exports = db
