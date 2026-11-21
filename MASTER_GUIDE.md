# คู่มือเตรียมตัวและแข่งขัน DevOps ฉบับสมบูรณ์ (All-in-One Master Guide)
เอกสารรวมขั้นตอนการเตรียมตัว ตั้งค่าระบบ เขียนโค้ด และ Deploy บน VMware Ubuntu ครบทุกเกณฑ์การแข่งขัน (คะแนนเต็ม 100) ไฟล์เดียวจบ ไม่ต้องเปิดหาหลายไฟล์

---

## สารบัญขั้นตอนการทำงาน
- [เฟสที่ 0: การเตรียม Flash Drive จากบ้าน (Offline 100%)](#เฟสที่-0-การเตรียม-flash-drive-จากบ้าน-offline-100)
- [เฟสที่ 1: การตั้งค่าระบบบน Ubuntu Server ใน VMware (วันแข่งจริง)](#เฟสที่-1-การตั้งค่าระบบบน-ubuntu-server-ใน-vmware-วันแข่งจริง)
- [เฟสที่ 2: การเปิดใช้งาน GitLab & Runner (แบบไม่ต้องต่อเน็ต)](#เฟสที่-2-การเปิดใช้งาน-gitlab--runner-แบบไม่ต้องต่อเน็ต)
- [เฟสที่ 3: การเขียนโค้ดและส่งงานบนเครื่อง Windows (VS Code)](#เฟสที่-3-การเขียนโค้ดและส่งงานบนเครื่อง-windows-vs-code)
- [เฟสที่ 4: การรันระบบจริงด้วย Docker Compose บน Ubuntu](#เฟสที่-4-การรันระบบจริงด้วย-docker-compose-บน-ubuntu)
- [เฟสที่ 5: การสาธิตให้กรรมการตรวจคะแนน (Checklist หน้างาน)](#เฟสที่-5-การสาธิตให้กรรมการตรวจคะแนน-checklist-หน้างาน)

---

## เฟสที่ 0: การเตรียม Flash Drive จากบ้าน (Offline 100%)
*(ทำล่วงหน้าก่อนวันแข่ง เพื่อแก้ปัญหาเน็ตสนามแข่งโหลด GitLab Image 3GB ไม่ทัน)*

1. เปิด Terminal ในเครื่องที่มีเน็ต แล้วสั่งโหลด Image ทั้งหมด:
   ```bash
   docker pull gitlab/gitlab-ce:latest
   docker pull gitlab/gitlab-runner:latest
   docker pull mysql:8.0
   docker pull registry:2
   docker pull node:20-alpine
   docker pull caddy:alpine
   docker pull ubuntu/bind9:latest
   ```
2. สั่ง Export รวมเป็นไฟล์ `.tar` ก้อนเดียว:
   ```bash
   docker save -o gitlab-all-images.tar \
     gitlab/gitlab-ce:latest \
     gitlab/gitlab-runner:latest \
     mysql:8.0 \
     registry:2 \
     node:20-alpine \
     caddy:alpine \
     ubuntu/bind9:latest
   ```
3. ก๊อปปี้ไฟล์ `gitlab-all-images.tar` เก็บใส่ **Flash Drive** พกไปวันแข่งจริง

---

## เฟสที่ 1: การตั้งค่าระบบบน Ubuntu Server ใน VMware (วันแข่งจริง)
*(เกณฑ์ส่วนที่ 2: ตั้งค่าเครือข่ายตามผังระบบเครือข่าย 24 คะแนน)*

### 1.1 ติดตั้งระบบอัตโนมัติ (SSH + 2 Users + Sudo Nopasswd + UFW + Docker + DNS + Registry)
เปิด Terminal ใน Ubuntu (`Ctrl + Alt + T`) แล้วรันคำสั่ง:
```bash
git clone https://github.com/barron-local/barron-test.git /opt/barron-test
cd /opt/barron-test
sudo bash setup.sh
```
*สิ่งที่คำสั่งนี้ทำให้โดยอัตโนมัติ:*
- ตั้งชื่อเครื่อง Hostname `server-devops`
- เปิดบริการ SSH และสร้าง 2 User (`devops1`, `devops2` รหัสผ่าน: `1234`)
- ตั้งค่า `sudo -i` ได้โดยไม่ต้องกรอกรหัสผ่าน (NOPASSWD)
- เปิด Firewall (UFW) พอร์ต 22, 80, 443, 53, 3000, 5000, 5050, 8080
- ติดตั้ง Docker & Docker Compose Plugin
- รัน DNS Server (BIND9 บนพอร์ต 53 พร้อมกำหนด ACL IP)
- รัน Private Docker Registry (พอร์ต 5050)

### 1.2 โหลด Docker Image เข้าเครื่อง (เลือกวิธีใดวิธีหนึ่ง):
- **แบบที่ 1 (ใช้ Flash Drive - แนะนำ เร็วสุด 30 วินาที):**
  เสียบ Flash Drive เข้าเครื่อง เลือกเชื่อมต่อกับ Ubuntu แล้วรัน:
  ```bash
  # ตรวจสอบชื่ออุปกรณ์ Flash Drive (เช่น /dev/sdb1)
  lsblk
  sudo mkdir -p /mnt/usb
  sudo mount /dev/sdb1 /mnt/usb
  sudo docker load -i /mnt/usb/gitlab-all-images.tar
  sudo umount /mnt/usb
  ```
- **แบบที่ 2 (ไม่ใช้ Flash Drive - โหลดผ่านเน็ตสนาม):**
  ```bash
  sudo docker pull gitlab/gitlab-ce:latest
  sudo docker pull gitlab/gitlab-runner:latest
  ```

---

## เฟสที่ 2: การเปิดใช้งาน GitLab & Runner (แบบไม่ต้องต่อเน็ต)
*(เกณฑ์ข้อ 2.4, 2.6, 2.7: ติดตั้ง GitLab, Runner, และ CI/CD Pipeline)*

### 2.1 สั่งรัน GitLab Container (กำหนดรหัสผ่าน root เป็น `admin1234` ทันที)
```bash
SERVER_IP=$(hostname -I | awk '{print $1}')

sudo docker run -d \
  --name gitlab \
  --restart always \
  --hostname gitlab.mydomain.lab \
  -p 8080:80 \
  -p 2222:22 \
  -e GITLAB_ROOT_PASSWORD="admin1234" \
  -v /srv/gitlab/config:/etc/gitlab \
  -v /srv/gitlab/logs:/var/log/gitlab \
  -v /srv/gitlab/data:/var/opt/gitlab \
  --shm-size 256m \
  gitlab/gitlab-ce:latest
```

### 2.2 สั่งรันและลงทะเบียน GitLab Runner
```bash
# 1. รัน GitLab Runner Container
sudo docker run -d \
  --name gitlab-runner \
  --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
```

### 2.3 สร้างโปรเจกต์และเชื่อมต่อ Runner บนเว็บ GitLab:
1. เปิด Browser บนเครื่อง Windows เข้าไปที่: `http://<IP_UBUNTU>:8080`
2. ล็อกอินด้วย:
   - **Username:** `root`
   - **Password:** `admin1234`
3. กดปุ่ม **New Project** -> **Create blank project** -> ตั้งชื่อโปรเจกต์ว่า `barron-test`
4. ไปที่เมนูโปรเจกต์: **Settings -> CI/CD -> Runners** -> ก๊อปปี้ Registration Token มาวางในคำสั่งด้านล่าง:
   ```bash
   sudo docker exec -it gitlab-runner gitlab-runner register \
     --non-interactive \
     --url "http://${SERVER_IP}:8080/" \
     --registration-token "ใส่_TOKEN_ที่ก๊อปปี้มา" \
     --executor "docker" \
     --docker-image "docker:latest" \
     --description "docker-runner" \
     --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"
   ```

---

## เฟสที่ 3: การเขียนโค้ดและส่งงานบนเครื่อง Windows (VS Code)
*(เกณฑ์ส่วนที่ 4: ซอฟต์แวร์และการประยุกต์ 53 คะแนน)*

### 3.1 สร้างโค้ดเต็ม 100% ด้วย Extension
1. ใน VS Code เปิดโฟลเดอร์งานว่าง ๆ
2. กดคีย์ลัด **`Ctrl + Alt + F`** (หรือกด `Ctrl + Shift + P` พิมพ์ `setup project full`)
   *(ระบบจะสร้างไฟล์ Backend, Frontend Next.js, MySQL, Dockerfile, Compose, Caddy, CI/CD, Test ครบทั้ง 18 ขั้นตอนทันที)*
3. *(กรณีต้องการซ่อนแถบสถานะด้านซ้ายล่าง ให้กด `Ctrl + Alt + H`)*

### 3.2 ส่งโค้ดขึ้น GitLab บน VM (Trigger CI/CD Pipeline อัตโนมัติ)
เปิด Terminal ใน VS Code บน Windows แล้วสั่ง:
```bash
git init
git remote add origin http://<IP_UBUNTU>:8080/root/barron-test.git
git add .
git commit -m "feat: complete application with backend, frontend and devops"
git branch -M main
git push -u origin main
```
*(เมื่อ Push เสร็จ ให้เปิดดูแท็บ **Build -> Pipelines** บนเว็บ GitLab จะเห็น Pipeline วิ่งผ่านครบทั้ง 4 Stages: `build` -> `test` -> `push` -> `deploy` อัตโนมัติ)*

---

## เฟสที่ 4: การรันระบบจริงด้วย Docker Compose บน Ubuntu
*(เกณฑ์ข้อ 2.5: รัน Backend + Frontend + Database + Caddy HTTPS)*

ใน Terminal ของ Ubuntu ให้สั่งรันโปรเจกต์:
```bash
cd /opt/barron-test
sudo docker compose up -d --build
```
ตรวจสอบความพร้อม:
```bash
sudo docker compose ps
```
*(ต้องขึ้นสถานะ Up ครบทั้ง 4 ตัว: `app_mysql`, `app_backend`, `app_frontend`, `app_caddy`)*

---

## เฟสที่ 5: การสาธิตให้กรรมการตรวจคะแนน (Checklist หน้างาน)

### 5.1 เข้าใช้งานหน้าเว็บจริงผ่าน HTTPS
เปิด Browser เข้าไปที่: **`https://<IP_UBUNTU>`** (หรือ `https://app.mydomain.lab`)

### 5.2 สาธิตฟังก์ชันตามใบประเมินคะแนน:
1. **ระบบ Login ด้วย JWT Token (แยกสิทธิ์ 3 ระดับ):**
   - ล็อกอินด้วย `admin` / `admin` -> สิทธิ์ **admin** (จัดการได้ทุกอย่าง)
   - ล็อกอินด้วย `editor` / `editor` -> สิทธิ์ **editonly** (แก้ไขได้อย่างเดียว)
   - ล็อกอินด้วย `user` / `user` -> สิทธิ์ **readonly** (ดูได้อย่างเดียว)
2. **การเพิ่มผู้ใช้ + แนบไฟล์:**
   - กรอกข้อมูลผู้ใช้ และเลือกไฟล์แนบ (รูปภาพ/เอกสาร) -> กดบันทึก
3. **การแก้ไขข้อมูล + แก้ไขไฟล์แนบ:**
   - กดปุ่มแก้ไข เปลี่ยนชื่อหรือเปลี่ยนไฟล์แนบใหม่ทับไฟล์เดิม
4. **กล่องยืนยันก่อนลบ (Confirm Dialog):**
   - กดปุ่มลบ -> มี Popup แจ้งเตือนยืนยันก่อนลบจริง
5. **ระบบค้นหาและกรอง (Search & Filter):**
   - ทดสอบค้นหาชื่อผู้ใช้ และกรองตาม Role / Status (Online/Offline)
6. **การแปลงข้อความ Error ให้เข้าใจง่าย:**
   - กรอกรหัสผ่านผิด -> แสดงข้อความภาษาไทยสุภาพชัดเจน ไม่ใช่ Error ดิบ
7. **ผลการทดสอบระบบอัตโนมัติ (Automated Testing):**
   - เปิดผลการรันใน GitLab CI หรือรัน `npm test` ให้ดูว่าผ่านครบ:
     - `Unit Testing: JWT Token Signing & Verify` (ผ่าน)
     - `Integration Testing: Routes & Middleware` (ผ่าน)
     - `E2E-001: ผู้ใช้เข้าสู่ระบบสำเร็จ` (ผ่าน)
     - `E2E-002: ผู้ใช้ส่งข้อมูลสำเร็จ` (ผ่าน)

---

## สรุปพอร์ตและบัญชีเข้าใช้งานทั้งหมด
| บริการ | URL / Port | บัญชีผู้ใช้งานเริ่มต้น |
| :--- | :--- | :--- |
| **Web Frontend (HTTPS)** | `https://<IP_UBUNTU>` | `admin` / `admin`, `editor` / `editor`, `user` / `user` |
| **GitLab Web UI** | `http://<IP_UBUNTU>:8080` | `root` / `admin1234` |
| **SSH Server** | พอร์ต `22` | `devops1` / `1234`, `devops2` / `1234` (sudo -i ได้ไม่ต้องใส่รหัส) |
| **Backend Express API** | พอร์ต `5000` | RESTful API |
| **Docker Registry** | `http://<IP_UBUNTU>:5050` | Private Image Registry |
| **DNS Server (BIND9)** | พอร์ต `53` | จัดการ Domain และ ACL |
