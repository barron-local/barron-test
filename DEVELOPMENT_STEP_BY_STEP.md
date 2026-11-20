# คู่มือสรุปขั้นตอนการพัฒนาโปรเจกต์ DevOps & Web Application

---

## 1. ลำดับขั้นตอนทำบนเครื่อง Ubuntu (VM)

### 1.1 ตรวจสอบ IP และเปิดสิทธิ์ Firewall
```bash
# ดู IP ของเครื่อง Ubuntu
hostname -I

# ตั้งค่าให้ใช้ sudo ได้โดยไม่ต้องพิมพ์รหัสผ่าน (เข้า nano ไปพิมพ์เอง)
sudo nano /etc/sudoers.d/nopasswd
# ด้านในพิมพ์: <ชื่อ_USER> ALL=(ALL) NOPASSWD: ALL  (เช่น: ubuntu ALL=(ALL) NOPASSWD: ALL)
# (กด Ctrl+O -> Enter -> Ctrl+X เพื่อบันทึก)

# ปิด Firewall เพื่อให้เครื่องคอมอื่นเปิดเข้าเว็บได้
sudo ufw disable
```

### 1.2 ติดตั้ง Docker & Git (กรณีเครื่องยังไม่มี)
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

### 1.3 นำไฟล์งานขึ้นเครื่อง Ubuntu (เลือกวิธีใดวิธีหนึ่ง)

#### วิธีที่ 1: ผ่าน Git (ถ้ามีเน็ต หรือดึงจาก GitLab)
```bash
git clone <URL_REPOSITORY> api
cd api
```

#### วิธีที่ 2: โยนไฟล์ตรงจากเครื่อง Dev ผ่าน SSH/SCP (เร็วสุด ไม่ต้องพึ่ง Git/เน็ต)
เปิด PowerShell บนเครื่อง Dev (Windows) ของคุณ แล้วสั่งก๊อปปี้ทั้งโฟลเดอร์ขึ้น Ubuntu:
```powershell
# รูปแบบ: scp -r <โฟลเดอร์งานในเครื่อง> <user>@<IP_Ubuntu>:~/api
scp -r C:\Users\Woradech\Desktop\api ubuntu@192.168.1.150:~/api
```
จากนั้น SSH เข้าไปที่เครื่อง Ubuntu:
```powershell
ssh ubuntu@192.168.1.150
cd ~/api
```

### 1.4 ตั้งค่าโดเมนจำลองในไฟล์ Hosts (สำหรับ Caddy HTTPS)
```bash
sudo nano /etc/hosts
```
เพิ่มบรรทัดนี้ลงไป:
```text
127.0.0.1 backend.mydomain.lab frontend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab
```
*(กด `Ctrl+O` -> `Enter` -> `Ctrl+X` เพื่อบันทึก)*

### 1.5 สั่งเปิดระบบทั้งหมดด้วย Docker บน Ubuntu
```bash
docker compose up -d --build
```

> 💡 **ถึงขั้นตอนนี้ถือว่าระบบ Container หลักทำงานแล้ว!**
> - ✅ Frontend, Backend API, Database, Caddy SSL ติดตั้งและเริ่มทำงานทันที (ลองเข้า `http://<IP_Ubuntu>:3001` ได้)
> - ⚠️ **ยังไม่เสร็จ 100% ถ้าต้องการทดสอบ CI/CD หรือเข้าผ่านชื่อโดเมน:**
>
>   **1. คำสั่ง PowerShell บน Windows (เปิดด้วย Run as Administrator):**
>   *(ใส่ IP ของ Ubuntu แทนที่ `192.168.1.150` แล้วกด Enter บันทึกลง hosts ทันที)*
>   ```powershell
>   Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "`n192.168.1.150 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab"
>   ```
>   *(ตรวจสอบว่าเข้าไฟล์แล้วด้วยคำสั่ง: `Get-Content $env:windir\System32\drivers\etc\hosts -Tail 3`)*
>
>   **2. ผูก Runner Token (ดูข้อ 2.2 ด้านล่าง):**
>   นำ Runner Token จาก GitLab มาใส่ในไฟล์ `runner/config.toml` แล้วสั่ง:
>   ```bash
>   docker compose restart gitlab-runner
>   ```

---

## 2. วิธีการนำโค้ดขึ้น GitLab และตรวจผล Pipeline

### 2.1 สั่ง Push โค้ด
- **ถ้ามีเน็ต (GitLab.com):**
  ```bash
  git init
  git branch -M main
  git remote add origin https://gitlab.com/barron-local/test-api.git
  git add .
  git commit -m "initial commit"
  git push -u origin main
  ```
- **ถ้าไม่มีเน็ต (Local GitLab บนเครื่อง):**
  - เข้า `https://gitlab.mydomain.lab` ด้วย User: `root` / Password: `password`
  - สร้าง New Project ชื่อ `api` (เอาติ๊กถูก README ออก)
  - สั่ง Push:
    ```bash
    git remote set-url origin http://127.0.0.1/root/api.git
    git add .
    git commit -m "initial commit"
    git push -u origin main
    ```

> ⚠️ **การแก้ปัญหา Error ยอดฮิตเวลา Push:**
> 1. **ถ้าเจอ `Permission denied (publickey)`:** ให้เปลี่ยนกลับเป็น HTTPS:
>    ```bash
>    git remote set-url origin https://gitlab.com/barron-local/test-api.git
>    ```
> 2. **ถ้าเจอ `src refspec main does not match any`:** แปลว่ายังไม่ได้ commit ให้รัน:
>    ```bash
>    git commit -m "initial commit"
>    git push -u origin main
>    ```
> 3. **ถ้าเจอ `[rejected] fetch first`:** ให้ไปปลดล็อก Protected branch ใน Settings -> Repository -> Protected branches แล้วสั่ง:
>    ```bash
>    git push -uf origin main
>    ```

### 2.2 การผูก GitLab Runner
> **วิธีหา Runner Token ในหน้าเว็บ GitLab:**
> ไปที่เมนูโปรเจกต์ **Settings -> CI/CD -> Runners (กด Expand)** แล้วคัดลอก Token (ขึ้นต้นด้วย `glrt-...`)

**วิธีที่ 1 (แนะนำ - เร็วและง่ายที่สุด):**
เปิดไฟล์ `runner/config.toml` แล้วแก้ไขค่า:
```toml
url = "https://gitlab.com"   # (หรือ "http://gitlab" ถ้าเป็น local ออฟไลน์)
token = "ใส่_TOKEN_ใหม่ที่นี่"
```
แล้วสั่งรีสตาร์ต Runner สั้นๆ ใน Terminal:
```bash
docker compose restart gitlab-runner
```

**วิธีที่ 2 (ใช้คำสั่ง register):**
```bash
docker exec -it gitlab-runner gitlab-runner register \
  --non-interactive \
  --url "https://gitlab.com" \
  --token "<YOUR_RUNNER_TOKEN>" \
  --executor "docker" \
  --docker-image "docker:latest" \
  --docker-privileged="true" \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"
```
*(กรณีไม่มีเน็ต ให้เปลี่ยน `--url` เป็น `"http://gitlab"`)*

### 2.3 วิธีตรวจผลการรันทั้ง 4 Stages (เปิดให้กรรมการดู)
1. เปิดหน้าเว็บ GitLab เข้าไปที่เมนูด้านซ้าย: **Build -> Pipelines** (หรือ **CI/CD -> Pipelines**)
2. จะเห็นรายการสถานะวงกลมสีเขียว (`passed`) ครบทั้ง 4 Stages:
   - **`build`**: ผ่านการ Build Docker Image
   - **`test`**: ผ่านชุดทดสอบ `npm test` ทั้ง Unit, Integration, E2E
   - **`push`**: ผ่านการส่ง Image ขึ้น Container Registry
   - **`deploy`**: ผ่านการดึง Image ล่าสุดมาติดตั้ง
3. กดคลิกดูรายละเอียดของ stage **`test`** จะเห็นผลการตรวจ E2E-001 และ E2E-002 ชัดเจน

---

## 3. วิธีเข้าใช้งานและตรวจงานจากเครื่องคอมพิวเตอร์ของคุณ

### ช่องทางที่ 1: เข้าตรงผ่าน IP ของเครื่อง Ubuntu
*(ต้องเป็น IP ของเครื่อง Ubuntu VM ดูได้จากคำสั่ง `hostname -I` บน Ubuntu)*
- **หน้าเว็บ Frontend (Next.js):** `http://<IP_Ubuntu>:3001`
- **Backend API:** `http://<IP_Ubuntu>:5000/api/users`

### ช่องทางที่ 2: เข้าผ่านโดเมนจำลอง HTTPS (Caddy Reverse Proxy)
1. เปิดไฟล์ `C:\Windows\System32\drivers\etc\hosts` บนเครื่องคอมของคุณด้วยสิทธิ์ Admin
2. เพิ่มบรรทัดนี้ลงไป (แทนที่ `<IP_Ubuntu>` ด้วยเลข IP จริง เช่น `192.168.1.150`):
   ```text
   <IP_Ubuntu>  frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab
   ```
3. เปิดเบราว์เซอร์เข้าใช้งานผ่าน HTTPS ได้ทันที:
   - Frontend: `https://frontend.mydomain.lab`
   - Backend API: `https://backend.mydomain.lab`
   - GitLab Server: `https://gitlab.mydomain.lab`
   - Container Registry: `https://registry.mydomain.lab`

---

## 4. ข้อมูลระบบและสิทธิ์ผู้ใช้งาน

### ฐานข้อมูล (MySQL: `my_app`)
- **`users`**: `id`, `username`, `password`, `role` (`admin`, `editonly`, `readonly`)
  - ค่าเริ่มต้น: `admin` / `admin`, `editor` / `editor`, `user` / `user`
- **`log`**: `id`, `user_id`, `logged_at` (เก็บประวัติการล็อกอินทุกครั้ง)
- **`status`**: `id`, `user_id` (UNIQUE), `state` (`on`, `off`)

### สิทธิ์ผู้ใช้งาน (Role Permission)
- **`admin`**: เข้าดูข้อมูลได้ทั้งหมด, เพิ่มผู้ใช้ใหม่, แก้ไขข้อมูล, ลบข้อมูล
- **`editonly`**: เข้าดูข้อมูลได้, แก้ไขข้อมูลได้อย่างเดียว (ไม่สามารถเพิ่มหรือลบได้)
- **`readonly`**: เข้าดูข้อมูลได้อย่างเดียว (ไม่มีปุ่มจัดการใดๆ)

---

## 5. บัญชีเข้าสู่ระบบทั้งหมด (Credentials)

| ระบบ | URL | Username | Password |
| :--- | :--- | :--- | :--- |
| **GitLab (Server)** | `https://gitlab.mydomain.lab` | `root` | `password` |
| **Web UI (Admin)** | `http://<IP_Ubuntu>:3001` | `admin` | `admin` |
| **Web UI (Editonly)** | `http://<IP_Ubuntu>:3001` | `editor` | `editor` |
| **Web UI (Readonly)** | `http://<IP_Ubuntu>:3001` | `user` | `user` |
| **MySQL Database** | พอร์ต `3306` | `root` | `password` |

---

## 6. Backend API Endpoints

| Method | Endpoint | สิทธิ์ | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | ทุกคน | ล็อกอินรับ JWT Token, บันทึก `log` (`logged_at`), ปรับ `status` (`state='on'`) |
| `POST` | `/api/logout` | Token | ออกจากระบบ ปรับ `status` (`state='off'`) |
| `GET` | `/api/me` | Token | ดูข้อมูลของตนเองพร้อมสถานะ |
| `GET` | `/api/users` | Token | แสดงรายชื่อผู้ใช้ทั้งหมด พร้อมสถานะและเวลาล็อกอินล่าสุด |
| `POST` | `/api/users` | Admin | เพิ่มผู้ใช้ใหม่ (Validate รหัสผ่าน $\ge$ 4 ตัวอักษร) |
| `PATCH` | `/api/users/:id` | Admin, Editonly | แก้ไขข้อมูลผู้ใช้ |
| `DELETE` | `/api/users/:id` | Admin | ลบผู้ใช้ |

---

## 7. การทดสอบระบบ (Automated & E2E Test)

รันคำสั่งทดสอบในโฟลเดอร์โปรเจกต์:
```bash
npm test
```
**ผลการทดสอบที่แสดง (ตรงตามเกณฑ์กรรมการ):**
- `[PASS] Unit: JWT sign & verify`
- `[PASS] Integration: User routes mounted`
- `[PASS] E2E-001: ผู้ใช้เข้าสู่ระบบสำเร็จ (Login workflow)`
- `[PASS] E2E-002: ผู้ใช้ส่งข้อมูลสำเร็จ (Data submission workflow)`

---

## 8. คำสั่ง Docker ที่ใช้บ่อยบน Ubuntu

```bash
docker compose ps               # ดูสถานะคอนเทนเนอร์ทั้งหมด
docker compose up -d --build    # บิวด์และรันใหม่หลังแก้โค้ด
docker compose restart <ชื่อ>   # รีสตาร์ตเฉพาะตัว เช่น app, frontend, gitlab-runner
docker compose logs -f <ชื่อ>    # ดู log ตรวจสอบข้อผิดพลาด
```
