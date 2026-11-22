# คู่มือเตรียมตัวและแข่งขัน DevOps ฉบับสมบูรณ์ (All-in-One Master Guide)
เอกสารรวมขั้นตอนการเตรียมตัว ตั้งค่าระบบ เขียนโค้ด และ Deploy บน VMware Ubuntu ครบทุกเกณฑ์การแข่งขัน (คะแนนเต็ม 100) ไฟล์เดียวจบ ไม่ต้องเปิดหาหลายไฟล์

---

## สารบัญขั้นตอนการทำงาน
- [เฟสที่ 0: การเตรียม Flash Drive จากบ้าน (Offline 100%)](#เฟสที่-0-การเตรียม-flash-drive-จากบ้าน-offline-100)
- [เฟสที่ 1: การตั้งค่าระบบบน Ubuntu Server (เลือกใช้ Script หรือคำสั่งเดี่ยว)](#เฟสที่-1-การตั้งค่าระบบบน-ubuntu-server-เลือกใช้-script-หรือคำสั่งเดี่ยว)
- [เฟสพิเศษ: การสร้างทางลัด SSH และย้ายไฟล์ผ่าน Windows Desktop](#เฟสพิเศษ-การสร้างทางลัด-ssh-และย้ายไฟล์ผ่าน-windows-desktop)
- [เฟสที่ 2: การเปิดใช้งาน GitLab & Runner (แบบไม่ต้องต่อเน็ต)](#เฟสที่-2-การเปิดใช้งาน-gitlab--runner-แบบไม่ต้องต่อเน็ต)
- [เฟสที่ 3: การเขียนโค้ดและส่งงานบนเครื่อง Windows (VS Code)](#เฟสที่-3-การเขียนโค้ดและส่งงานบนเครื่อง-windows-vs-code)
- [เฟสที่ 4: การรันระบบจริงด้วย Docker Compose บน Ubuntu](#เฟสที่-4-การรันระบบจริงด้วย-docker-compose-บน-ubuntu)
- [เฟสที่ 5: การสาธิตให้กรรมการตรวจคะแนน (Checklist หน้างาน)](#เฟสที่-5-การสาธิตให้กรรมการตรวจคะแนน-checklist-หน้างาน)

---

## เฟสที่ 0: การเตรียม Flash Drive จากบ้าน (Offline 100% - เตรียมไฟล์เรียบร้อยแล้ว)
*(ทำล่วงหน้าก่อนวันแข่ง เพื่อแก้ปัญหาเน็ตสนามแข่งโหลด GitLab Image 3GB ไม่ทัน)*

- **สถานะ:** ดาวน์โหลดและคัดลอกไฟล์ **`gitlab-all-images.tar` (1.83 GB)** ใส่ลงใน Flash Drive เรียบร้อยแล้ว (มี Image ครบทั้ง 7 ตัว: `gitlab-ce`, `gitlab-runner`, `mysql:8.0`, `registry:2`, `node:20-alpine`, `caddy:alpine`, `ubuntu/bind9:latest`)
- **วันแข่งจริง:** เพียงพก Flash Drive นี้ไปเสียบเข้าเครื่องแล้วทำตาม [เฟสที่ 1](#เฟสที่-1-การตั้งค่าระบบบน-ubuntu-server-เลือกใช้-script-หรือคำสั่งเดี่ยว) ได้ทันที

---

## เฟสที่ 1: การตั้งค่าระบบบน Ubuntu Server (เลือกใช้ Script หรือคำสั่งเดี่ยว)
*(เกณฑ์ส่วนที่ 2: ตั้งค่าเครือข่ายตามผังระบบเครือข่าย 24 คะแนน)*

คุณสามารถเลือกวิธีตั้งค่าได้ **2 วิธี**:

---

### วิธีที่ A: ใช้สคริปต์โต้ตอบ `setup.sh` (เลือกพิมพ์เลขข้อตามต้องการ)
ในโฟลเดอร์โปรเจกต์บน Ubuntu ให้สั่ง:
```bash
sudo bash setup.sh
```
ระบบจะแสดงเมนูตัวเลือกขึ้นมา:
```text
==========================================================
   DevOps Ubuntu Server - Interactive Setup Script
==========================================================
 1) Hostname + SSH Server + 2 Users (devops1, devops2) + Sudo NOPASSWD
 2) Firewall UFW (เปิดพอร์ต 22, 80, 443, 53, 3000, 5000, 5050, 8080)
 3) ติดตั้ง Docker & Docker Compose Plugin แท้ (ลบ podman ออก)
 4) โหลด Docker Images จาก Flash Drive (.tar)
 5) รัน DNS Server (Bind9 พร้อม ACL พอร์ต 53)
 6) รัน Private Docker Registry (พอร์ต 5050)
 7) รัน GitLab Server + GitLab Runner
----------------------------------------------------------
 ตัวอย่างการระบุตัวเลือก:
   - พิมพ์ '3'     -> เพื่อติดตั้ง Docker แก้ไขปัญหา Podman
   - พิมพ์ '1,2'   -> เพื่อทำเฉพาะข้อ 1 และ 2
   - พิมพ์ 'all'   -> เพื่อทำทุกข้อตามลำดับ
==========================================================
```
- **ข้อดี:** ไม่ต้องพิมพ์คำสั่งยาวๆ พิมพ์แค่เลขข้อ เช่น `3` หรือ `1,2` หรือ `all` ระบบจะตั้งค่าให้ทันทีและไม่ทำซ้ำในข้อที่ไม่ได้เลือก

---

### วิธีที่ B: รันคำสั่งเดี่ยวทีละบรรทัด (Standalone Commands)
*(กรณีที่ต้องการพิมพ์คำสั่งเองทีละบรรทัดเพื่อให้เห็นใน Terminal History)*

#### 1.1 ตั้งชื่อเครื่อง (Hostname)
```bash
sudo hostnamectl set-hostname server-devops
```

#### 1.2 ติดตั้งและเปิดใช้งาน SSH Server
```bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
```

#### 1.3 สร้าง 2 User ตามเกณฑ์ (`devops1`, `devops2` รหัสผ่าน: `1234`)
```bash
sudo useradd -m -s /bin/bash devops1
echo "devops1:1234" | sudo chpasswd
sudo usermod -aG sudo devops1

sudo useradd -m -s /bin/bash devops2
echo "devops2:1234" | sudo chpasswd
sudo usermod -aG sudo devops2
```

#### 1.4 ตั้งค่า Sudo NOPASSWD (เข้า `sudo -i` โดยไม่ต้องกรอกรหัสผ่าน)
```bash
echo "%sudo ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/sudo-nopasswd
sudo chmod 0440 /etc/sudoers.d/sudo-nopasswd
```

#### 1.5 เปิด Firewall (UFW) พอร์ตที่ใช้งานตามเกณฑ์
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 53
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 5050/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable
```

#### 1.6 ติดตั้ง Docker & Docker Compose แท้ (ลบ Podman ออก)
```bash
sudo apt remove -y podman podman-docker containernetworking-plugins 2>/dev/null || true
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
sudo usermod -aG docker devops1
sudo usermod -aG docker devops2
```

#### 1.7 โหลด Docker Image จาก Flash Drive
```bash
# ตรวจสอบชื่ออุปกรณ์ Flash Drive (เช่น sdb1)
lsblk
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
sudo docker load -i /mnt/usb/gitlab-all-images.tar
sudo umount /mnt/usb
```

#### 1.8 รัน Private Docker Registry (พอร์ต 5050)
```bash
sudo docker run -d --name registry --restart always -p 5050:5000 registry:2
```

#### 1.9 ตั้งค่า Local Domain Name Resolution (/etc/hosts)
*(สำคัญมาก: แก้ปัญหาเข้า `https://frontend.mydomain.lab/` หรือ `gitlab.mydomain.lab` ไม่ได้ เพราะเครื่องไม่รู้จักโดเมน `.lab`)*

**1. บนเครื่อง Ubuntu:**
```bash
sudo bash -c 'echo "127.0.0.1 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts'
```

**2. บนเครื่อง Windows Client (เครื่องที่เปิด Web Browser):**
- **วิธีที่ 1 (สั่งผ่าน PowerShell ง่ายและเร็วที่สุด):**
  เปิด PowerShell ด้วยสิทธิ์ *Run as Administrator* แล้วรันคำสั่งบรรทัดเดียว:
  ```powershell
  Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "`n192.168.114.128 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab"
  ```
- **วิธีที่ 2 (เปิดแก้ด้วย Notepad):**
  - เปิด **Notepad** ด้วยสิทธิ์ **"Run as Administrator"**
  - ไปที่เมนู File -> Open -> เลือกไฟล์: `C:\Windows\System32\drivers\etc\hosts` *(เลือก All Files *.*)*
  - เพิ่มบรรทัดด้านล่างนี้ลงไปท้ายไฟล์ (แทนที่ IP ด้วย IP จริงของ Ubuntu):
  ```text
  192.168.114.128 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab
  ```
- กด Save บันทึกไฟล์ -> จากนั้นเปิด Browser เข้า `https://frontend.mydomain.lab` หรือ `http://gitlab.mydomain.lab:8080` ได้ทันที!
*(เนื่องจาก Caddy ใช้ Local Self-signed Cert เมื่อ Browser แจ้งเตือน ให้กด "Advanced" -> "Accept the Risk and Continue")*

---

## เฟสพิเศษ: การสร้างทางลัด SSH และย้ายไฟล์ผ่าน Windows Desktop

### 1. สร้างทางลัดคลิกเปิด SSH บน Desktop ของ Windows
1. คลิกขวาที่หน้าจอ **Desktop** -> เลือก **New (สร้างใหม่)** -> **Shortcut (ทางลัด)**
2. ในช่องพิมพ์ตำแหน่ง ให้กรอกคำสั่ง:
   ```text
   cmd.exe /k ssh devops1@192.168.114.128
   ```
   *(เปลี่ยน `192.168.114.128` เป็น IP ของ Ubuntu ที่ได้จากคำสั่ง `hostname -I`)*
3. ตั้งชื่อไอคอนว่า `Ubuntu SSH` แล้วกด **Finish**
   *(หลังจากนี้ดับเบิ้ลคลิกไอคอนนี้จะเด้งหน้าต่าง Terminal ควบคุม Ubuntu จากเครื่อง Windows ได้ทันที)*

### 2. ส่งโฟลเดอร์โปรเจกต์จาก Windows ข้ามไป Ubuntu ด้วย SCP คำสั่งเดียว
เปิด PowerShell หรือ Command Prompt บน Windows แล้วรัน:
```powershell
scp -r C:\Users\Woradech\Desktop\devops-tnk devops1@192.168.114.128:~/
```
*(หรือจะเชื่อมต่อผ่านโปรแกรม FileZilla ด้วย Protocol: `SFTP`, Port: `22` เพื่อลากวางไฟล์ก็ได้เช่นกัน)*

---

## เฟสที่ 2: การเปิดใช้งาน GitLab & Runner (แบบไม่ต้องต่อเน็ต)
*(เกณฑ์ข้อ 2.4, 2.6, 2.7: ติดตั้ง GitLab, Runner, และ CI/CD Pipeline)*

### 2.1 สั่งรัน GitLab Container (กำหนดรหัสผ่าน root เป็น `devops1234` ทันที)
```bash
SERVER_IP=$(hostname -I | awk '{print $1}')

sudo docker run -d \
  --name gitlab \
  --restart always \
  --hostname gitlab.mydomain.lab \
  -p 8080:80 \
  -p 2222:22 \
  -e GITLAB_OMNIBUS_CONFIG="
    external_url 'http://gitlab.mydomain.lab:8080';
    nginx['listen_port'] = 80;
    nginx['listen_https'] = false;
    registry_external_url 'http://registry.mydomain.lab:5050';
    registry_nginx['listen_port'] = 5050;
    registry_nginx['listen_https'] = false;
    gitlab_rails['initial_root_password'] = 'devops1234';
  " \
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
1. เปิด Browser บนเครื่อง Windows เข้าไปที่: `http://<IP_UBUNTU>:8080` (หรือ `http://gitlab.mydomain.lab:8080`)
2. ล็อกอินด้วย:
   - **Username:** `root`
   - **Password:** `devops1234` *(GitLab บังคับรหัสผ่านอย่างน้อย 8 ตัวอักษร)*
   > [!TIP]
   > **กรณีเข้าสู่ระบบไม่ได้ (Invalid login or password / หา root ไม่เจอ):**
   > รันคำสั่งกู้คืนหรือสร้างบัญชี root ทันทีใน 15 วินาที:
   > ```bash
   > docker exec -i gitlab gitlab-rails runner "user = User.find_by_username('root') || User.new(username: 'root', email: 'admin@mydomain.lab', name: 'Administrator', admin: true); user.password = 'devops1234'; user.password_confirmation = 'devops1234'; user.skip_confirmation! if user.respond_to?(:skip_confirmation!); user.save!(validate: false); puts 'Root user ready!'"
   > ```
3. *(แนะนำตามเกณฑ์ 2.4.3)* กดไปที่ Admin Area -> สร้าง User ชื่อ `devops` (รหัสผ่าน: `devops1234`)
4. กดปุ่ม **New Project** -> **Create blank project** -> ตั้งชื่อโปรเจกต์ว่า `devops-tnk`
5. ไปที่เมนูโปรเจกต์: **Settings -> CI/CD -> Runners** -> ก๊อปปี้ Registration Token มาวางในคำสั่งด้านล่าง:
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
git remote add origin http://<IP_UBUNTU>:8080/root/devops-tnk.git
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
cd /opt/devops-tnk 2>/dev/null || cd /opt/barron-test
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
| **GitLab Web UI** | `http://<IP_UBUNTU>:8080` | `root` / `devops` (หรือ user `devops` / `devops`) |
| **SSH Server** | พอร์ต `22` | `devops1` / `1234`, `devops2` / `1234` (sudo -i ได้ไม่ต้องใส่รหัส) |
| **Backend Express API** | พอร์ต `5000` | RESTful API |
| **Docker Registry** | `http://<IP_UBUNTU>:5050` | Private Image Registry |
| **DNS Server (BIND9)** | พอร์ต `53` | จัดการ Domain และ ACL |
| **Database (MySQL)** | พอร์ต `3306` | `root` / `password` (Database: `my_app`) |

---

## ภาคผนวก: การเชื่อมต่อ Database ด้วย DBeaver จาก Windows Client

### 1. วิธีดู IP ของเครื่อง Ubuntu สำหรับเชื่อมต่อ
หากใช้คำสั่ง `hostname -I` แล้วเจอ IP หลายตัว ให้ใช้คำสั่งระบุ IP หลัก:
```bash
ip route get 1.1.1.1 | awk '{print $7}'
```
*(หรือดูที่การ์ดแลนหลัก เช่น `ens33` จะได้ IP ที่ตรงกับวงเครือข่ายของ Windows เช่น `192.168.114.128` โดยไม่ต้องนำ IP ของ Docker เช่น `172.17.x.x` หรือ `172.18.x.x` ไปใช้)*

### 2. ข้อมูลการตั้งค่า Connection ใน DBeaver
- **Database Driver:** MySQL
- **Host / Server:** `<IP_UBUNTU>` (เช่น `192.168.114.128`)
- **Port:** `3306`
- **Database:** `my_app`
- **Username:** `root`
- **Password:** `password`

> [!TIP]
> **การแก้ปัญหา Public Key Retrieval Error ใน DBeaver:**
> ในหน้าตั้งค่า Connection หากกด **Test Connection** แล้วติดปัญหาเกี่ยวกับ Public Key Retrieval หรือ SSL:
> 1. ไปที่แท็บ **Driver properties**
> 2. ค้นหาค่า `allowPublicKeyRetrieval` เปลี่ยนเป็น **`TRUE`**
> 3. ค้นหาค่า `useSSL` เปลี่ยนเป็น **`FALSE`**
> 4. กด **Test Connection** อีกครั้ง จะเชื่อมต่อสำเร็จ 100% ทันที
