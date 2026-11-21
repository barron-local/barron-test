# แผนรับมือการติดตั้งระบบบนเครื่องสนามแข่งขัน (ฉบับสมบูรณ์ 100%)
เอกสารนี้รวบรวมขั้นตอนทีละสเต็ปทั้ง **แบบใช้ Flash Drive (เร็วที่สุด 30 วินาที)** และ **แบบไม่ใช้ Flash Drive (ใช้เน็ตสนามแข่ง/Local Mirror)** เพื่อแก้ปัญหาดาวน์โหลด GitLab Image (3 GB) ไม่ทันในวันแข่งจริง

---

# 🚀 รูปแบบที่ 1: แบบใช้ Flash Drive (แนะนำที่สุด - รวดเร็ว 100% ไม่ต้องง้อเน็ต)
*(ตามเกณฑ์ข้อสอบ gghh.pdf หมวด 2: อนุญาตให้นำ Docker Image ใส่ Flash Drive มาโหลดแบบ Offline ได้)*

### [เตรียมตัวจากบ้าน] ขั้นตอนเซฟ Image ใส่ Flash Drive:
ทำบนเครื่องคอมพิวเตอร์ของคุณที่มีเน็ตแรง ๆ ก่อนวันแข่ง:
1. เปิด Terminal / PowerShell แล้วรันคำสั่งดึง Image:
   ```bash
   docker pull gitlab/gitlab-ce:latest
   docker pull gitlab/gitlab-runner:latest
   docker pull mysql:8.0
   docker pull registry:2
   docker pull node:20-alpine
   docker pull caddy:alpine
   docker pull ubuntu/bind9:latest
   ```
2. สั่ง Export รวมเป็นไฟล์ `.tar` ก้อนเดียว (หรือแยกไฟล์):
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
3. ก๊อปปี้ไฟล์ `gitlab-all-images.tar` ลงใน **Flash Drive**

---

### [วันแข่งจริงที่สนาม] ขั้นตอนการนำเข้าใน Ubuntu VM:
1. เสียบ Flash Drive เข้าเครื่องแข่ง แล้วเลือก Connect to VM (ให้ Ubuntu มองเห็น Flash Drive)
2. เมานต์ Flash Drive และโหลด Image เข้า Docker ทันที:
   ```bash
   # หาชื่อไดรฟ์ของ Flash Drive (เช่น /dev/sdb1)
   lsblk

   # สร้างโฟลเดอร์และเมานต์ Flash Drive
   mkdir -p /mnt/usb
   mount /dev/sdb1 /mnt/usb

   # โหลด Image ทั้งหมดเข้า Docker ทันที (ใช้เวลาประมาณ 30-60 วินาที)
   docker load -i /mnt/usb/gitlab-all-images.tar

   # ตรวจสอบว่า Image มาครบแล้ว
   docker images
   ```
3. ถอด Flash Drive ออก:
   ```bash
   umount /mnt/usb
   ```
4. รันคำสั่งเปิด GitLab และ Runner ได้ทันที โดยไม่ต้องโหลดเน็ต:
   ```bash
   # รัน GitLab
   docker run -d --name gitlab --restart always -p 8080:80 -p 2222:22 -v /srv/gitlab/config:/etc/gitlab -v /srv/gitlab/logs:/var/log/gitlab -v /srv/gitlab/data:/var/opt/gitlab --shm-size 256m gitlab/gitlab-ce:latest

   # รัน GitLab Runner
   docker run -d --name gitlab-runner --restart always -v /srv/gitlab-runner/config:/etc/gitlab-runner -v /var/run/docker.sock:/var/run/docker.sock gitlab/gitlab-runner:latest
   ```

---

# 🌐 รูปแบบที่ 2: แบบไม่ใช้ Flash Drive (วิธีปกติผ่านเน็ตสนามแข่ง / Local Mirror)
*(กรณีที่กรรมการไม่อนุญาตให้เสียบ Flash Drive หรือลืมนำมา)*

### ขั้นตอนการรับมือ:

#### 1. ตรวจสอบ Local Mirror ของสนามแข่งก่อนเสมอ (จุดสำคัญที่สุด!)
ในการแข่งขันระดับชาติ/ระดับภาค ทางผู้จัด (ตามคู่มือ BNCC) จะตั้ง **Local Docker Registry / Mirror ภายในวง LAN** ไว้ให้ เพราะเขารู้ว่าเน็ตออกนอกจะล่ม ให้ถามกรรมการหรือดูบอร์ดโจทย์ว่ามี Local Registry หรือไม่:
- ถ้ามี ให้ pull ผ่าน IP วง LAN ของสนามแข่ง จะเร็วระดับ 1 Gbps (ไม่ถึง 1 นาทีเสร็จ):
  ```bash
  # ตัวอย่างถ้าสนามแข่งตั้ง Registry ไว้ที่ 192.168.1.200:5000
  docker pull 192.168.1.200:5000/gitlab-ce:latest
  docker tag 192.168.1.200:5000/gitlab-ce:latest gitlab/gitlab-ce:latest
  ```

#### 2. ถ้าไม่มี Local Mirror (ต้องโหลดผ่านเน็ตออกข้างนอกตรง ๆ):
**กลยุทธ์:** ต้องสั่งโหลด `gitlab-ce` เป็นสิ่งแรกสุดในวินาทีแรกที่เริ่มการแข่งขันทันที!
1. เมื่อเริ่มการแข่งขัน ให้รันสคริปต์ [setup.sh](file:///c:/Users/Woradech/Desktop/barron-test/setup.sh) เพื่อให้ระบบติดตั้ง Docker เสร็จภายใน 1 นาที
2. จากนั้นสั่ง `docker pull` ของ GitLab ค้างไว้เบื้องหลัง (Background):
   ```bash
   # สั่งดึง Image GitLab ทิ้งไว้ทันที
   docker pull gitlab/gitlab-ce:latest &
   ```
3. **ระหว่างที่รอ GitLab โหลด (อย่าปล่อยเวลาให้เสียเปล่า):**
   - ไปเปิด VS Code บนเครื่อง Host Windows
   - เรียก Extension `barron-test`
   - พิมพ์คำสั่ง `setup project` หรือ `setup project full`
   - เขียนโค้ด Backend, Database, Frontend, Dockerfile, และเตรียมไฟล์ `test.js` รอไว้ล่วงหน้า
4. พอเขียนโค้ดและเตรียมโปรเจกต์เสร็จ หันกลับมาดูที่ VM ตรวจสอบว่า GitLab โหลดเสร็จหรือยัง:
   ```bash
   docker images | grep gitlab
   ```
5. เมื่อ Image มาแล้ว ให้สั่งรัน Container:
   ```bash
   docker run -d \
     --name gitlab \
     --restart always \
     -p 8080:80 \
     -p 2222:22 \
     -v /srv/gitlab/config:/etc/gitlab \
     -v /srv/gitlab/logs:/var/log/gitlab \
     -v /srv/gitlab/data:/var/opt/gitlab \
     --shm-size 256m \
     gitlab/gitlab-ce:latest
   ```
6. รอประมาณ 2-3 นาที แล้วอ่านรหัสผ่านเริ่มต้นของ root:
   ```bash
   cat /srv/gitlab/config/initial_root_password
   ```

---

# 📋 ตารางสรุปเปรียบเทียบ 2 รูปแบบ

| คุณสมบัติ | รูปแบบที่ 1: ใช้ Flash Drive | รูปแบบที่ 2: วิธีปกติ (เน็ตสนาม) |
| :--- | :--- | :--- |
| **ความเร็วในการติดตั้ง** | **30 - 60 วินาที** | 20 นาที - 1 ชั่วโมง (ขึ้นกับเน็ตสนาม) |
| **ความเสี่ยงเน็ตล่ม/ค้าง** | **0% (ไม่ต้องต่อเน็ต)** | สูงมาก (ถ้าทุกทีมแย่งกันโหลด) |
| **ความพร้อมใช้งาน** | ติดตั้งเสร็จพร้อมรัน CI/CD ได้ทันที | ต้องรอโหลดจนครบก่อนเริ่มรัน |
| **การตรวจของกรรมการ** | ถูกต้องตามเกณฑ์ข้อสอบข้อ 2 อนุญาต | ถูกต้องตามเกณฑ์ปกติ |
