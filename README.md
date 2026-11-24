# ระบบจัดการผู้ใช้และไฟล์แนบ (User Management)

โปรเจกต์ระบบจัดการผู้ใช้และอัปโหลดไฟล์ พัฒนาด้วย Next.js, Node.js Express, MySQL และ Caddy บน Docker Compose สวัสดี

---

## 1. สถาปัตยกรรมระบบ (Architecture)
- **Frontend:** Next.js (พอร์ต 3000)
- **Backend:** Node.js Express REST API (พอร์ต 5000)
- **Database:** MySQL 8.0 (พอร์ต 3306)
- **Reverse Proxy:** Caddy จัดการโดเมนและ SSL (พอร์ต 80, 443)

---

## 2. โครงสร้างฐานข้อมูล (Database Schema)

### ความสัมพันธ์ระหว่างตาราง
| ตารางหลัก | ตารางที่เชื่อม | ความสัมพันธ์ | Foreign Key |
| :--- | :--- | :--- | :--- |
| `users` | `status` | 1:1 | `status.user_id` -> `users.id` |
| `users` | `log` | 1:N | `log.user_id` -> `users.id` |
| `users` | `files` | 1:N | `files.user_id` -> `users.id` |

### ฟิลด์ในแต่ละตาราง
- **`users`**: `id` (PK), `username` (UNIQUE), `password`, `role` (admin, editonly, readonly)
- **`status`**: `id` (PK), `user_id` (FK), `state` (on, off)
- **`log`**: `id` (PK), `user_id` (FK), `logged_at`
- **`files`**: `id` (PK), `user_id` (FK), `filename`, `uploaded_at`

---

## 3. สิทธิ์การใช้งาน (Permissions & Roles)
- ใช้ **JWT Token** ยืนยันตัวตน แนบผ่าน Header: `Authorization: Bearer <TOKEN>`
- แบ่งสิทธิ์เป็น 3 ระดับ:
  - **`admin`**: ทำได้ทุกอย่าง (ดู, เพิ่ม, แก้ไข, ลบ)
  - **`editonly`**: ดูและแก้ไขข้อมูล/ไฟล์แนบได้ (ห้ามลบและห้ามเพิ่มคนใหม่)
  - **`readonly`**: ดูและค้นหาข้อมูลได้อย่างเดียว

---

## 4. Endpoint และ HTTP Method

| Method | Endpoint | การทำงาน | เหตุผลที่เลือกใช้ Method นี้ |
| :--- | :--- | :--- | :--- |
| **`POST`** | `/api/login` | ล็อกอินเข้าสู่ระบบ | ส่ง username/password แบบปลอดภัยใน body ไม่ผ่าน URL |
| **`POST`** | `/api/logout` | ออกจากระบบ | มีการอัปเดตสถานะเป็น offline ที่หลังบ้าน |
| **`GET`** | `/api/health` | เช็คสถานะเซิร์ฟเวอร์ | ดึงสถานะอย่างเดียว ไม่แก้ไขข้อมูล |
| **`GET`** | `/api/me` | ดูโปรไฟล์ตัวเอง | ดึงข้อมูลตาม Token ของคนที่ล็อกอิน |
| **`GET`** | `/api/users` | ดึงรายชื่อผู้ใช้ทั้งหมด | อ่านข้อมูลอย่างเดียว ค้นหาและแบ่งหน้าได้ |
| **`GET`** | `/api/users/:id` | ดูข้อมูลผู้ใช้รายคน | ค้นหาด้วย id เจาะจง |
| **`POST`** | `/api/users` | เพิ่มผู้ใช้ใหม่ | สร้างข้อมูลใหม่ลงฐานข้อมูล |
| **`POST`** | `/api/users/:id/upload` | อัปโหลดไฟล์แนบ | ส่งไฟล์แบบ multipart/form-data |
| **`PUT`** | `/api/users/:id` | แก้ไขข้อมูลแบบแทนที่ทั้งหมด | เขียนทับข้อมูลเดิมทั้งหมด |
| **`PATCH`** | `/api/users/:id` | แก้ไขเฉพาะบางฟิลด์ | ส่งแก้เฉพาะช่องที่ต้องการ ช่องอื่นคงเดิม |
| **`DELETE`** | `/api/users/:id` | ลบผู้ใช้ออกจากระบบ | ลบข้อมูลออกจากฐานข้อมูลถาวร |

---

## 5. การจัดการ Error และ Status Code

| Status Code | ความหมาย | กรณีที่เกิด |
| :--- | :--- | :--- |
| **`200 OK`** | สำเร็จ | ดึงข้อมูล, อัปเดตข้อมูล หรือลบข้อมูลสำเร็จ |
| **`201 Created`** | สร้างสำเร็จ | เพิ่มผู้ใช้ใหม่สำเร็จ |
| **`400 Bad Request`** | ข้อมูลไม่ถูกต้อง | กรอกข้อมูลไม่ครบ หรือพยายามลบบัญชีตัวเองที่กำลังล็อกอินอยู่ |
| **`401 Unauthorized`** | ยังไม่ได้ยืนยันตัวตน | ไม่ได้ส่ง Token มา หรือกรอก username/password ผิด |
| **`403 Forbidden`** | ไม่มีสิทธิ์ทำรายการ | สิทธิ์ไม่พอ (เช่น readonly พยายามไปลบคน) หรือ Token ปลอม |
| **`404 Not Found`** | ไม่พบข้อมูล | หา id ผู้ใช้ที่ระบุไม่เจอในระบบ |
| **`409 Conflict`** | ข้อมูลซ้ำ | เพิ่มชื่อ username ที่มีอยู่แล้วในระบบ |
