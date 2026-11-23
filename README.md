# ระบบบริหารจัดการข้อมูลผู้ใช้งานและไฟล์แนบ (User Management & File Attachment System)

เอกสารการออกแบบสถาปัตยกรรมระบบ, การออกแบบฐานข้อมูล และข้อกำหนดทางเทคนิคของ RESTful API ตามมาตรฐานการแข่งขันทักษะวิชาชีพ สาขาวิชาเทคโนโลยีสารสนเทศ

---

## 1. การออกแบบและแนวคิดสถาปัตยกรรมระบบ (System Architecture)
ระบบถูกพัฒนาตามรูปแบบ **Multi-tier Client-Server Architecture** และเชื่อมต่อผ่านเครือข่าย Container ด้วย Docker Compose:
- **Client (Frontend):** Next.js (React) พัฒนาแบบ Single Page Application (SPA) บริการผ่านพอร์ต 3000
- **Reverse Proxy & TLS:** Caddy Server ทำหน้าที่เป็น SSL/TLS Termination และ Reverse Proxy (พอร์ต 80, 443)
- **Application Server (Backend):** Node.js / Express.js RESTful API บริการผ่านพอร์ต 5000
- **Database Server:** MySQL 8.0 ให้บริการฐานข้อมูลแบบ Relational Database (พอร์ต 3306)

---

## 2. การออกแบบฐานข้อมูล (Database Schema & Relational Design)
ฐานข้อมูลชื่อ `my_app` ประกอบด้วย 4 ตารางที่มีความสัมพันธ์กันตามหลัก Relational Integrity (Foreign Key CASCADE):

```
+-------------------+       1:N       +-------------------+
|       users       | <-------------- |        log        |
+-------------------+                 +-------------------+
| PK  id (INT)      |                 | PK  id (INT)      |
|     username      |                 | FK  user_id (INT) |
|     password      |                 |     logged_at     |
|     role          |                 +-------------------+
+-------------------+
  |               |
  | 1:1           | 1:N
  v               v
+-------------------+   +-------------------+
|      status       |   |       files       |
+-------------------+   +-------------------+
| PK  id (INT)      |   | PK  id (INT)      |
| FK  user_id (INT) |   | FK  user_id (INT) |
|     state (on/off)|   |     filename      |
+-------------------+   |     uploaded_at   |
                        +-------------------+
```

### รายละเอียดตาราง:
1. **`users`** : ตารางข้อมูลผู้ใช้งานหลัก
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `username`: VARCHAR(50) NOT NULL UNIQUE
   - `password`: VARCHAR(255) NOT NULL
   - `role`: ENUM('admin', 'editonly', 'readonly') DEFAULT 'readonly'
2. **`log`** : ตารางบันทึกประวัติการเข้าสู่ระบบ
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `user_id`: INT NOT NULL (FK -> users.id ON DELETE CASCADE)
   - `logged_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
3. **`status`** : ตารางสถานะการใช้งาน (Online/Offline)
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `user_id`: INT NOT NULL UNIQUE (FK -> users.id ON DELETE CASCADE)
   - `state`: ENUM('on', 'off') DEFAULT 'off'
4. **`files`** : ตารางบันทึกข้อมูลไฟล์แนบ
   - `id`: INT AUTO_INCREMENT PRIMARY KEY
   - `user_id`: INT NOT NULL (FK -> users.id ON DELETE CASCADE)
   - `filename`: VARCHAR(255) NOT NULL
   - `uploaded_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

---

## 3. ข้อกำหนดและการรักษาความปลอดภัยของ RESTful API (Security & Authentication)
- **การยืนยันตัวตน (Authentication):** ใช้ JSON Web Token (JWT) มาตรฐาน HMAC SHA-256
- **การส่ง Token:** แนบผ่าน HTTP Header: `Authorization: Bearer <TOKEN>`
- **การควบคุมสิทธิ์ตามบทบาท (Role-Based Access Control - RBAC):**
  - `admin` : จัดการได้ทุกฟังก์ชัน (สร้าง, ดู, แก้ไข, ลบ ผู้ใช้และไฟล์แนบ)
  - `editonly` : แก้ไขข้อมูลและไฟล์แนบได้ ไม่สามารถลบหรือสร้างผู้ใช้ใหม่
  - `readonly` : ดูรายการและค้นหาข้อมูลได้อย่างเดียว

---

## 4. รายละเอียดข้อกำหนด RESTful API Endpoints (API Specification)

### 4.1 ตรวจสอบสถานะระบบ (Health Check)
- **Method:** `GET`
- **Endpoint:** `/api/health`
- **Parameter:** ไม่มี
- **Response Code:** `200 OK`
```json
{
  "status": "success",
  "message": "ระบบพร้อมให้บริการ",
  "data": { "uptime": "ok" }
}
```

---

### 4.2 การเข้าสู่ระบบ (User Login)
- **Method:** `POST`
- **Endpoint:** `/api/login`
- **Data Transport:** Request Body (JSON)
- **Request Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "เข้าสู่ระบบสำเร็จ",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```
- **Response Code 400 (Bad Request - กรอกข้อมูลไม่ครบ):**
```json
{
  "status": "error",
  "message": "กรุณากรอก username และ password ให้ครบถ้วน",
  "data": null
}
```
- **Response Code 401 (Unauthorized - รหัสผ่านไม่ถูกต้อง):**
```json
{
  "status": "error",
  "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  "data": null
}
```

---

### 4.3 การออกจากระบบ (User Logout)
- **Method:** `POST`
- **Endpoint:** `/api/logout`
- **Data Transport:** Header (`Authorization: Bearer <TOKEN>`)
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "ออกจากระบบสำเร็จ ปรับสถานะเป็น offline เรียบร้อย"
}
```

---

### 4.4 ดึงรายชื่อผู้ใช้ทั้งหมด (List Users with Filter & Pagination)
- **Method:** `GET`
- **Endpoint:** `/api/users`
- **Data Transport:** Query Parameters
  - `search` (string, optional) : ค้นหาตามชื่อผู้ใช้
  - `role` (string, optional) : กรองตามสิทธิ์ (`admin`, `editonly`, `readonly`)
  - `state` (string, optional) : กรองตามสถานะ (`on`, `off`)
  - `page` (int, default: 1) : หน้าที่ต้องการดึง
  - `limit` (int, default: 10) : จำนวนรายการต่อหน้า
- **Header:** `Authorization: Bearer <TOKEN>`
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "ดึงรายการข้อมูลผู้ใช้สำเร็จ",
  "data": [
    {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "state": "on",
      "logged_at": "2026-11-22T08:30:00.000Z",
      "filename": "document.pdf"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```
- **Response Code 401 (Unauthorized - ไม่มี Token หรือ Token ไม่ถูกต้อง):**
```json
{
  "status": "error",
  "message": "ไม่พบสิทธิ์การเข้าถึง (Token ไม่ถูกต้องหรือหมดอายุ)",
  "data": null
}
```

---

### 4.5 ดึงข้อมูลผู้ใช้รายบุคคล (Get User by ID)
- **Method:** `GET`
- **Endpoint:** `/api/users/:id`
- **Data Transport:** Path Parameter (`id`: รหัสผู้ใช้)
- **Header:** `Authorization: Bearer <TOKEN>`
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "ค้นพบข้อมูลผู้ใช้",
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "state": "on",
    "filename": "profile.png"
  }
}
```
- **Response Code 404 (Not Found):**
```json
{
  "status": "error",
  "message": "ไม่พบข้อมูลผู้ใช้ที่ระบุ",
  "data": null
}
```

---

### 4.6 เพิ่มข้อมูลผู้ใช้ใหม่พร้อมแนบไฟล์ (Create User with Attachment)
- **Method:** `POST`
- **Endpoint:** `/api/users`
- **Permission:** `admin` เท่านั้น
- **Data Transport:** Request Body (`multipart/form-data`)
  - `username` (text, required)
  - `password` (text, required)
  - `role` (text, optional: `admin`, `editonly`, `readonly`)
  - `file` (binary/file, optional)
- **Response Code 201 (Created):**
```json
{
  "status": "success",
  "message": "บันทึกข้อมูลผู้ใช้ใหม่สำเร็จ",
  "data": {
    "id": 4,
    "username": "johndoe",
    "role": "readonly",
    "filename": "resume.pdf"
  }
}
```
- **Response Code 403 (Forbidden - สิทธิ์ไม่ถึง):**
```json
{
  "status": "error",
  "message": "ปฏิเสธการเข้าถึง: เฉพาะผู้ดูแลระบบ (admin) เท่านั้น",
  "data": null
}
```

---

### 4.7 แก้ไขข้อมูลผู้ใช้และไฟล์แนบ (Update User & Attachment)
- **Method:** `PUT` / `PATCH` (รองรับทั้งสองวิธี)
- **Endpoint:** `/api/users/:id`
- **Permission:** `admin` หรือ `editonly`
- **Data Transport:** Path Parameter (`:id`) + Request Body (`multipart/form-data` หรือ `application/json`)
  - `username` (text - ข้อมูลชื่อผู้ใช้ใหม่)
  - `password` (text - รหัสผ่านใหม่)
  - `role` (text - สิทธิ์ใหม่ แก้ไขได้เฉพาะ admin)
  - `file` (binary/file - อัปโหลดไฟล์ใหม่แทนที่ไฟล์เดิม)
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "แก้ไขข้อมูลสำเร็จ",
  "data": {
    "id": "4",
    "filename": "new_resume.pdf"
  }
}
```

---

### 4.8 ลบข้อมูลผู้ใช้ (Delete User)
- **Method:** `DELETE`
- **Endpoint:** `/api/users/:id`
- **Permission:** `admin` เท่านั้น
- **Data Transport:** Path Parameter (`:id`)
- **Response Code 200 (Success):**
```json
{
  "status": "success",
  "message": "ลบข้อมูลผู้ใช้งานและไฟล์แนบเรียบร้อยแล้ว",
  "data": { "deletedId": "4" }
}
```
- **Response Code 400 (Bad Request - ห้ามลบบัญชีตัวเอง):**
```json
{
  "status": "error",
  "message": "ไม่สามารถลบบัญชีผู้ใช้ที่กำลังเข้าสู่ระบบอยู่ได้",
  "data": null
}
```
