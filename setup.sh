#!/bin/bash
# ==============================================================================
# Interactive Setup Script for Ubuntu Server (DevOps Competition)
# รองรับการกดรันแบบ One-Click (Auto All-in-One) หรือเลือกเฉพาะหัวข้อ
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "กรุณารันสคริปต์ด้วย sudo: sudo bash $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

get_server_ip() {
  local ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
  if [ -z "$ip" ]; then
    ip=$(hostname -I | tr ' ' '\n' | grep -v '^172\.' | grep -v '^127\.' | head -n 1)
  fi
  [ -z "$ip" ] && ip="127.0.0.1"
  echo "$ip"
}

fn_1_hostname_ssh_users() {
  echo ""
  echo ">>> [1] ตั้งค่า Hostname, SSH, 2 Users (devops1, devops2) & Sudo NOPASSWD..."
  hostnamectl set-hostname server-devops
  apt update && apt install -y ca-certificates curl gnupg lsb-release openssh-server
  systemctl enable --now ssh

  id -u devops1 &>/dev/null || adduser devops1 --gecos "" --disabled-password
  echo "devops1:1234" | chpasswd --crypt-method SHA512
  usermod -aG sudo devops1

  id -u devops2 &>/dev/null || adduser devops2 --gecos "" --disabled-password
  echo "devops2:1234" | chpasswd --crypt-method SHA512
  usermod -aG sudo devops2

  echo -e "devops1 ALL=(ALL) NOPASSWD:ALL\ndevops2 ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/devops-nopasswd
  chmod 0440 /etc/sudoers.d/devops-nopasswd
  echo "--- เสร็จสิ้นขั้นตอนที่ 1 ---"
}

fn_2_firewall() {
  echo ""
  echo ">>> [2] กำหนดค่า Firewall (UFW) พอร์ต 22, 80, 443, 53, 3000, 3306, 5000, 5050, 8080..."
  apt install -y ufw
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 3000/tcp
  ufw allow 3306/tcp   # รองรับ DBeaver เชื่อมต่อฐานข้อมูลจากภายนอก
  ufw allow 5000/tcp
  ufw allow 5050/tcp
  ufw allow 8080/tcp
  ufw allow 53
  ufw --force enable
  echo "--- เสร็จสิ้นขั้นตอนที่ 2 ---"
}

fn_3_docker_install() {
  echo ""
  echo ">>> [3] ตรวจสอบและแก้ไขปัญหา Podman แทรกแซง + ติดตั้ง Docker แท้ 100%..."

  # 1. ปิด service และ socket ของ podman ทันที
  systemctl stop podman.socket podman 2>/dev/null || true
  systemctl disable podman.socket podman 2>/dev/null || true

  # 2. ถอน Podman และตัว alias ทั้งหมดทิ้งอย่างหมดจด
  apt-get purge -y podman podman-docker containernetworking-plugins 2>/dev/null || true
  apt-get autoremove -y 2>/dev/null || true

  # 3. ลบ alias หรือ wrapper ของ docker ที่ชี้ไปหา podman ใน PATH
  rm -f /usr/bin/podman-docker /usr/local/bin/docker /etc/containers/nodocker 2>/dev/null || true

  # 4. ติดตั้ง Docker Engine และ Docker Compose v2 แท้
  echo "กำลังติดตั้ง Docker Engine และ Docker Compose v2..."
  apt-get update
  apt-get install -y docker.io docker-compose-v2

  # 5. เปิด Service ของ Docker Daemon จริง
  systemctl unmask docker.service 2>/dev/null || true
  systemctl unmask docker.socket 2>/dev/null || true
  systemctl enable --now docker.service
  systemctl restart docker.service

  # 6. เพิ่มสิทธิ์กลุ่ม docker ให้ user ทั้งหมด
  [ -n "$SUDO_USER" ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true
  usermod -aG docker devops 2>/dev/null || true
  usermod -aG docker devops1 2>/dev/null || true
  usermod -aG docker devops2 2>/dev/null || true

  # 7. ฝังตัวแปร DOCKER_HOST=/var/run/docker.sock ลงใน Profile ทุก User และลบ podman socket ทิ้งถาวร
  echo 'export DOCKER_HOST="unix:///var/run/docker.sock"' > /etc/profile.d/docker-host.sh
  chmod +x /etc/profile.d/docker-host.sh
  systemctl --user -M devops@ stop podman.socket podman 2>/dev/null || true
  rm -rf /run/user/*/podman 2>/dev/null || true

  echo "ตรวจสอบสถานะ Docker:"
  docker --version
  docker compose version
  echo "--- เสร็จสิ้นขั้นตอนที่ 3 (ลบ Podman เรียบร้อย สลับมาใช้ Docker แท้ 100%) ---"
}

fn_4_load_images() {
  echo ""
  echo ">>> [4] โหลด Docker Image ทั้งหมดจาก Flash Drive..."
  echo "กำลังค้นหาไฟล์ gitlab-all-images.tar ใน /mnt หรือ /media..."
  TAR_FILE=$(find /media /mnt -name "gitlab-all-images.tar" 2>/dev/null | head -n 1)

  if [ -n "$TAR_FILE" ]; then
    echo "พบไฟล์: $TAR_FILE"
    docker load -i "$TAR_FILE"
    echo "--- โหลด Image เรียบร้อย ---"
  else
    echo "ไม่พบไฟล์ที่ Mount อัตโนมัติใน /mnt หรือ /media"
    echo "รายการบล็อกอุปกรณ์ดิสก์:"
    lsblk
    echo "หากมีไฟล์ .tar ให้สั่งโหลดด้วยคำสั่ง: sudo docker load -i <path-to-file.tar>"
  fi
}

fn_5_dns_server() {
  echo ""
  echo ">>> [5] รัน DNS Server (Bind9 พร้อม ACL) บนพอร์ต 53..."
  mkdir -p /opt/dns-server/named-conf
  cat << 'EOF' > /opt/dns-server/named-conf/named.conf
acl "trusted_clients" { 192.168.0.0/16; 172.16.0.0/12; 10.0.0.0/8; localhost; };
options {
    directory "/var/cache/bind";
    allow-query { trusted_clients; };
    recursion yes;
    forwarders { 8.8.8.8; 1.1.1.1; };
    listen-on { any; };
    listen-on-v6 { any; };
};
EOF
  docker rm -f dns-server 2>/dev/null || true
  docker run -d --name dns-server --restart always -p 53:53/udp -p 53:53/tcp -v /opt/dns-server/named-conf:/etc/bind ubuntu/bind9:latest 2>/dev/null || true
  echo "--- เสร็จสิ้นขั้นตอนที่ 5 ---"
}

fn_8_setup_hosts() {
  echo ""
  echo ">>> [8] ตั้งค่า Local Domain Name Resolution (/etc/hosts)..."
  SERVER_IP=$(get_server_ip)

  # ลบของเก่าที่เคยมีออกก่อน เพื่อไม่ให้ซ้ำซ้อน
  sed -i '/mydomain.lab/d' /etc/hosts

  # เพิ่ม IP และโดเมนทั้งหมดลงใน /etc/hosts ของเครื่อง Ubuntu
  echo -e "127.0.0.1 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  if [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "${SERVER_IP} frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  fi

  echo "เพิ่ม mapping ลงใน /etc/hosts ของ Ubuntu เรียบร้อยแล้ว:"
  grep "mydomain.lab" /etc/hosts
  echo "--- เสร็จสิ้นขั้นตอนที่ 8 ---"
}

fn_run_compose_all() {
  echo ""
  echo ">>> กำลัง Build และ Start ทุก Services ผ่าน Docker Compose (Caddy, Frontend, App, DB, GitLab)..."
  cd "$SCRIPT_DIR"

  # ตรวจสอบว่า docker-compose.yml มีอยู่หรือไม่
  if [ -f "docker-compose.yml" ]; then
    docker compose up -d --build
    echo ""
    echo "สถานะ Containers ล่าสุด:"
    docker compose ps
  else
    echo "ไม่พบไฟล์ docker-compose.yml ใน $SCRIPT_DIR"
  fi
}

show_windows_powershell_cmd() {
  SERVER_IP=$(get_server_ip)
  echo ""
  echo "================================================================================"
  echo "  คำสั่งตั้งค่าบนเครื่อง WINDOWS CLIENT (เพื่อเข้าเว็บผ่าน Custom Domain)"
  echo "================================================================================"
  echo "เปิด PowerShell บนเครื่อง Windows ด้วยสิทธิ์ 'Run as Administrator' แล้วก๊อปปี้ไปวาง:"
  echo ""
  echo -e "\e[1;32mAdd-Content -Path \"\$env:windir\\System32\\drivers\\etc\\hosts\" -Value \"\`n${SERVER_IP} frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab\" -Force\e[0m"
  echo ""
  echo "--------------------------------------------------------------------------------"
  echo "หลังจากรันคำสั่งบน Windows แล้ว สามารถเปิด Browser เข้าใช้งานได้ทันที:"
  echo "  - Web Frontend (HTTPS):  https://frontend.mydomain.lab"
  echo "  - Backend API (HTTPS):   https://backend.mydomain.lab/api/users"
  echo "  - GitLab Server:         http://${SERVER_IP}:8080 (หรือ https://gitlab.mydomain.lab)"
  echo "  - Database (DBeaver):    Host: ${SERVER_IP}  Port: 3306  User: root  Pass: password"
  echo "================================================================================"
  echo ""
}

fn_auto_all_in_one() {
  echo ""
  echo "================================================================================"
  echo "   เริ่มการติดตั้งแบบครบวงจรในปุ่มเดียว (Auto All-in-One Full Setup)"
  echo "================================================================================"
  fn_1_hostname_ssh_users
  fn_2_firewall
  fn_3_docker_install
  fn_4_load_images
  fn_5_dns_server
  fn_8_setup_hosts
  fn_run_compose_all
  show_windows_powershell_cmd
}

fn_cleanup_disk_space() {
  echo ""
  echo ">>> ล้างขยะและเคลียร์พื้นที่ดิสก์ (แก้ปัญหา no space left on device)..."
  apt-get clean
  docker builder prune -af 2>/dev/null || true
  docker image prune -f 2>/dev/null || true
  rm -rf /tmp/* /tmp/.* 2>/dev/null || true
  rm -rf ~/.cache/* 2>/dev/null || true
  echo "สถานะพื้นที่ดิสก์ล่าสุด:"
  df -h /
  echo "--- ล้างพื้นที่ดิสก์เรียบร้อย ---"
}

# ==============================================================================
# Interactive Menu
# ==============================================================================
echo "================================================================================"
echo "      DevOps Ubuntu Server - All-in-One Automated Setup Script"
echo "================================================================================"
echo " 0) [AUTO] One-Click Full Setup (ทำครบทุกอย่าง + Start Docker + Caddy + ออกคำสั่ง Windows)"
echo " 1) Hostname + SSH Server + 2 Users (devops1, devops2) + Sudo NOPASSWD"
echo " 2) Firewall UFW (เปิดพอร์ต 22, 80, 443, 53, 3000, 3306, 5000, 5050, 8080)"
echo " 3) ติดตั้ง Docker & Docker Compose Plugin แท้ (ลบ podman ออก)"
echo " 4) โหลด Docker Images จาก Flash Drive (.tar)"
echo " 5) รัน DNS Server (Bind9 พร้อม ACL พอร์ต 53)"
echo " 6) Build & Start Docker Compose (Caddy Reverse Proxy, App, Frontend, DB, GitLab)"
echo " 7) ตั้งค่า Domain /etc/hosts (พร้อมแสดงคำสั่ง PowerShell สำหรับ Windows)"
echo " 8) แสดงคำสั่ง PowerShell สำหรับเครื่อง Windows อีกครั้ง"
echo " 9) เคลียร์ขยะและเพิ่มพื้นที่ว่างบนดิสก์ (แก้ปัญหา no space left on device)"
echo "--------------------------------------------------------------------------------"
echo " แนะนำ: เลือก '0' สำหรับรันทีเดียวพร้อมใช้งานทันที (One-Click)"
echo " หรือพิมพ์ตัวเลขเจาะจง เช่น '6,7' หรือ '8'"
echo "================================================================================"
read -p "กรุณาเลือกตัวเลือก (กด 0 หรือ Enter เพื่อทำ Full Auto): " USER_CHOICE

if [ -z "$USER_CHOICE" ] || [ "$USER_CHOICE" = "0" ] || [ "$USER_CHOICE" = "all" ]; then
  fn_auto_all_in_one
  exit 0
fi

# แปลงเป็น array คั่นด้วยจุลภาคหรือเว้นวรรค
CHOICES=$(echo "$USER_CHOICE" | tr ',' ' ')

for c in $CHOICES; do
  case $c in
    1) fn_1_hostname_ssh_users ;;
    2) fn_2_firewall ;;
    3) fn_3_docker_install ;;
    4) fn_4_load_images ;;
    5) fn_5_dns_server ;;
    6) fn_run_compose_all ;;
    7) fn_8_setup_hosts; show_windows_powershell_cmd ;;
    8) show_windows_powershell_cmd ;;
    9) fn_cleanup_disk_space ;;
    *) echo "ไม่พบตัวเลือก: $c" ;;
  esac
done

echo ""
echo "================================================================================"
echo " ดำเนินการตามตัวเลือก ($USER_CHOICE) เสร็จสมบูรณ์แล้ว!"
echo "================================================================================"
