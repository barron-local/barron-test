const mysql = require("mysql2/promise")

// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล MySQL Connection Pool
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "",
  database: process.env.DB_NAME || "my_app"
}

const db = mysql.createPool(dbConfig)

// 2. ฟังก์ชันสร้างฐานข้อมูล ตาราง และข้อมูลผู้ใช้เริ่มต้น (พร้อมระบบ Retry อัตโนมัติเวลารอ DB บูต)
const initDB = async (retries = 10, delayMs = 2000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const rootConn = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password
      })
      await rootConn.query("CREATE DATABASE IF NOT EXISTS `my_app`")
      await rootConn.end()

      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('admin', 'editonly', 'readonly') NOT NULL DEFAULT 'readonly'
        )
      `)

      await db.query(`
        INSERT IGNORE INTO users (id, username, password, role) VALUES 
          (1, 'admin', 'admin', 'admin'), 
          (2, 'editor', 'editor', 'editonly'), 
          (3, 'user', 'user', 'readonly')
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS status (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          state ENUM('on', 'off') NOT NULL DEFAULT 'off',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS files (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      console.log("Database & Tables Initialized Successfully")
      return
    } catch (e) {
      if (i === retries) {
        console.error("DB Init Error after retries:", e.message)
      } else {
        await new Promise(res => setTimeout(res, delayMs))
      }
    }
  }
}

initDB()

module.exports = db
