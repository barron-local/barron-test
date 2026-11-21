# คู่มือคำสั่งติดตั้งและตั้งค่าบน Ubuntu Server (VMware)
คู่มือนี้รวบรวมคำสั่งทีละขั้นตอน (Step-by-Step) ตามเกณฑ์การแข่งขันจริงในเอกสาร **gghh.pdf ส่วนที่ 2 (ตั้งค่าเครือข่ายตามผังระบบเครือข่าย & DevOps)** ถูกต้อง 100% สามารถ Copy ไปวางรันได้ทันที

---

## ขั้นตอนที่ 1: อัปเดตระบบ และตั้งค่า Hostname / IP Static

```bash
# 1.1 เข้าสู่สิทธิ์ root
sudo -i

# 1.2 อัปเดตแพ็กเกจระบบ
apt update && apt upgrade -y

# 1.3 ตั้งค่า Hostname (สมมติชื่อ server-devops หรือตามที่กรรมการกำหนด)
hostnamectl set-hostname server-devops
```

---

## ขั้นตอนที่ 2: ติดตั้งและตั้งค่า SSH พร้อมสร้าง 2 User + Sudo Nopasswd

*(เกณฑ์ 2.3: เปิดบริการ SSH, เพิ่ม 2 User, กำหนด sudo ไม่ต้องใส่รหัส)*

```bash
# 2.1 ติดตั้งและเปิด SSH Service
apt install -y openssh-server
systemctl enable --now ssh

# 2.2 สร้าง User ที่ 1 (เช่น devops1 รหัสผ่าน 1234)
adduser devops1 --gecos "" --disabled-password
echo "devops1:1234" | chpasswd
usermod -aG sudo devops1

# 2.3 สร้าง User ที่ 2 (เช่น devops2 รหัสผ่าน 1234)
adduser devops2 --gecos "" --disabled-password
echo "devops2:1234" | chpasswd
usermod -aG sudo devops2

# 2.4 ตั้งค่าให้ User สามารถ sudo ได้โดยไม่ต้องใส่รหัสผ่าน (sudo -i nopasswd)
cat << 'EOF' > /etc/sudoers.d/devops-nopasswd
devops1 ALL=(ALL) NOPASSWD:ALL
devops2 ALL=(ALL) NOPASSWD:ALL
EOF
chmod 0440 /etc/sudoers.d/devops-nopasswd
```

---

## ขั้นตอนที่ 3: ตั้งค่า Firewall (UFW)

*(เกณฑ์ 2.3: ตั้งค่า firewall เพื่อเปิดพอร์ตบริการ)*

```bash
# 3.1 เปิดพอร์ตบริการที่จำเป็น (SSH, HTTP, HTTPS, Git, Registry)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 5000/tcp
ufw allow 5050/tcp
ufw allow 8080/tcp

# 3.2 เปิดใช้งาน UFW Firewall
ufw --force enable
ufw status verbose
```

---

## ขั้นตอนที่ 4: ติดตั้ง Docker และ Docker Compose Plugin

*(เกณฑ์ 2.4: ติดตั้ง Docker ได้และใช้งานได้ เช่น docker ps, run, exec)*

```bash
# 4.1 ติดตั้งโปรแกรมพื้นฐาน
apt install -y ca-certificates curl gnupg lsb-release

# 4.2 เพิ่ม Docker GPG Key และ Repository ทางการ
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4.3 ติดตั้ง Docker Engine, CLI และ Docker Compose
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4.4 ให้ User devops1 และ devops2 รัน Docker ได้โดยไม่ต้องพิมพ์ sudo
usermod -aG docker devops1
usermod -aG docker devops2

# 4.5 ทดสอบการทำงานของ Docker
docker --version
docker compose version
```

---

## ขั้นตอนที่ 5: ติดตั้ง DNS Server (Bind9 บน Docker) พร้อมทำ ACL

*(เกณฑ์ 2.2: มีการติดตั้ง DNS Server ใน Network ตนเองบน Docker พร้อมกำหนด ACL IP)*

```bash
# 5.1 สร้างโฟลเดอร์สำหรับ DNS Server
mkdir -p /opt/dns-server/named-conf

# 5.2 สร้างไฟล์ตั้งค่า DNS พร้อมกำหนดสิทธิ์เข้าถึง (ACL)
cat << 'EOF' > /opt/dns-server/named-conf/named.conf
acl "trusted_clients" {
    192.168.0.0/16;
    172.16.0.0/12;
    10.0.0.0/8;
    localhost;
};

options {
    directory "/var/cache/bind";
    allow-query { trusted_clients; };
    recursion yes;
    forwarders {
        8.8.8.8;
        1.1.1.1;
    };
    listen-on { any; };
    listen-on-v6 { any; };
};
EOF

# 5.3 รัน BIND9 DNS Server ผ่าน Docker
docker run -d \
  --name dns-server \
  --restart always \
  -p 53:53/udp \
  -p 53:53/tcp \
  -v /opt/dns-server/named-conf:/etc/bind \
  ubuntu/bind9:latest

# 5.4 ทดสอบการทำงานของ DNS
docker ps | grep dns-server
```

---

## ขั้นตอนที่ 6: ติดตั้ง Docker Registry (Private Registry)

*(เกณฑ์ 2.5: ใช้สำหรับเก็บและแจกจ่าย Docker Image ในการ Deploy CI/CD)*

```bash
# 6.1 รัน Docker Registry V2 บนพอร์ต 5050
docker run -d \
  --name local-registry \
  --restart always \
  -p 5050:5000 \
  registry:2

# 6.2 ตรวจสอบสถานะ Registry
curl http://localhost:5050/v2/
```

---

## ขั้นตอนที่ 7: ติดตั้ง GitLab Community Edition (บน Docker)

*(เกณฑ์ 2.4: ติดตั้ง GitLab ใน Container เข้าเว็บได้ และสร้าง User ได้)*

```bash
# 7.1 สร้างโฟลเดอร์เก็บข้อมูล GitLab
mkdir -p /srv/gitlab/config /srv/gitlab/logs /srv/gitlab/data

# 7.2 สั่งรัน GitLab Container (เข้าใช้งานที่พอร์ต 8080)
# หมายเหตุ: แทนที่ 192.168.x.x ด้วย IP ของเครื่อง Ubuntu บน VMware
SERVER_IP=$(hostname -I | awk '{print $1}')

docker run -d \
  --name gitlab \
  --restart always \
  --hostname gitlab.mydomain.lab \
  -p 8080:80 \
  -p 2222:22 \
  -v /srv/gitlab/config:/etc/gitlab \
  -v /srv/gitlab/logs:/var/log/gitlab \
  -v /srv/gitlab/data:/var/opt/gitlab \
  --shm-size 256m \
  gitlab/gitlab-ce:latest

# 7.3 คำสั่งดูรหัสผ่านเริ่มต้นของ root ใน GitLab (รอให้คอนเทนเนอร์เริ่มประมาณ 2-3 นาที)
# รหัสผ่านจะอยู่ในไฟล์นี้:
cat /srv/gitlab/config/initial_root_password
```

---

## ขั้นตอนที่ 8: ติดตั้งและลงทะเบียน GitLab Runner

*(เกณฑ์ 2.6 & 2.7: สำหรับรัน CI/CD Pipeline อัตโนมัติ 4 Stages)*

```bash
# 8.1 สั่งรัน GitLab Runner Container
docker run -d \
  --name gitlab-runner \
  --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest

# 8.2 คำสั่ง Register Runner เชื่อมต่อกับโปรเจกต์ GitLab
# (นำ Registration Token ที่ได้จากหน้าเว็บ GitLab: Project -> Settings -> CI/CD -> Runners มาใส่แทน YOUR_TOKEN)
docker exec -it gitlab-runner gitlab-runner register \
  --non-interactive \
  --url "http://${SERVER_IP}:8080/" \
  --registration-token "YOUR_TOKEN" \
  --executor "docker" \
  --docker-image "docker:latest" \
  --description "docker-runner" \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock"
```

---

## ขั้นตอนที่ 9: นำโปรเจกต์ (barron-test) ขึ้นมารันจริง

*(เกณฑ์ 2.5: สร้างและใช้งาน Dockerfile, docker-compose.yaml รัน Backend + Frontend + MySQL + Caddy HTTPS)*

```bash
# 9.1 Clone โปรเจกต์ หรือย้ายไฟล์เข้ามาในโฟลเดอร์งาน
cd /opt
git clone https://github.com/barron-local/barron-test.git app
cd app

# 9.2 สั่ง Build และรันทุก Service ด้วย Docker Compose
docker compose up -d --build

# 9.3 ตรวจสอบสถานะว่าคอนเทนเนอร์ทุกตัวทำงานครบสมบูรณ์
docker compose ps
```

---

## สรุปพอร์ตและบริการทั้งหมดในระบบ:
| บริการ | Container Name | URL / Port | หมายเหตุ |
| :--- | :--- | :--- | :--- |
| **GitLab Web UI** | `gitlab` | `http://<IP_UBUNTU>:8080` | สำหรับส่งโค้ดและดู Pipeline CI/CD |
| **Docker Registry** | `local-registry` | `http://<IP_UBUNTU>:5050` | เก็บ Docker Image ที่ผ่านการ Test |
| **DNS Server (BIND9)** | `dns-server` | พอร์ต `53` | จัดการ Domain และทำ ACL |
| **Web Frontend (HTTPS)** | `app_caddy` | `https://<IP_UBUNTU>` หรือ `https://app.mydomain.lab` | หน้าบ้าน Next.js ต่อกับ Backend |
| **Express Backend API** | `app_backend` | พอร์ต `5000` | RESTful API + MySQL |
| **MySQL Database** | `app_mysql` | พอร์ต `3306` | จัดการ 4 ตาราง users, log, status, files |
