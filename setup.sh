#!/bin/bash
# ==============================================================================
# Interactive Setup Script for Ubuntu Server (DevOps Competition)
# รองรับการเลือกทำเฉพาะหัวข้อ เช่นพิมพ์ 1,2 หรือ 3 หรือ all
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "กรุณารันสคริปต์ด้วย sudo: sudo bash $0"
  exit 1
fi

fn_1_hostname_ssh_users() {
  echo ""
  echo ">>> [1] ตั้งค่า Hostname, SSH, 2 Users (devops1, devops2) & Sudo NOPASSWD..."
  hostnamectl set-hostname server-devops
  apt update && apt install -y ca-certificates curl gnupg lsb-release openssh-server
  systemctl enable --now ssh

  id -u devops1 &>/dev/null || (adduser devops1 --gecos "" --disabled-password && echo "devops1:1234" | chpasswd && usermod -aG sudo devops1)
  id -u devops2 &>/dev/null || (adduser devops2 --gecos "" --disabled-password && echo "devops2:1234" | chpasswd && usermod -aG sudo devops2)

  echo -e "devops1 ALL=(ALL) NOPASSWD:ALL\ndevops2 ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/devops-nopasswd
  chmod 0440 /etc/sudoers.d/devops-nopasswd
  echo "--- เสร็จสิ้นขั้นตอนที่ 1 ---"
}

fn_2_firewall() {
  echo ""
  echo ">>> [2] กำหนดค่า Firewall (UFW) พอร์ต 22, 80, 443, 53, 3000, 5000, 5050, 8080..."
  apt install -y ufw
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 3000/tcp
  ufw allow 5000/tcp
  ufw allow 5050/tcp
  ufw allow 8080/tcp
  ufw allow 53
  ufw --force enable
  echo "--- เสร็จสิ้นขั้นตอนที่ 2 ---"
}

fn_3_docker_install() {
  echo ""
  echo ">>> [3] ติดตั้ง Docker & Docker Compose Plugin แท้..."
  # ป้องกันปัญหา Podman แทรกแซง
  apt remove -y podman podman-docker containernetworking-plugins 2>/dev/null || true

  apt install -y docker.io docker-compose-v2
  systemctl enable --now docker

  # เพิ่มสิทธิ์ให้ user
  [ -n "$SUDO_USER" ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true
  usermod -aG docker devops1 2>/dev/null || true
  usermod -aG docker devops2 2>/dev/null || true
  usermod -aG docker devops 2>/dev/null || true
  echo "--- เสร็จสิ้นขั้นตอนที่ 3 (Docker ติดตั้งและเริ่มทำงานแล้ว) ---"
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
    echo "ไม่พบไฟล์ที่ Mount อัตโนมัติ กรุณาระบุ Path หรือจะค้นหาอุปกรณ์ Flash Drive:"
    lsblk
    echo "ตัวอย่างคำสั่งโหลดเอง: sudo docker load -i /mnt/usb/gitlab-all-images.tar"
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
  docker run -d --name dns-server --restart always -p 53:53/udp -p 53:53/tcp -v /opt/dns-server/named-conf:/etc/bind ubuntu/bind9:latest
  echo "--- เสร็จสิ้นขั้นตอนที่ 5 ---"
}

fn_6_local_registry() {
  echo ""
  echo ">>> [6] รัน Private Docker Registry (พอร์ต 5050)..."
  docker rm -f local-registry 2>/dev/null || true
  docker run -d --name local-registry --restart always -p 5050:5000 registry:2
  echo "--- เสร็จสิ้นขั้นตอนที่ 6 ---"
}

fn_7_run_gitlab() {
  echo ""
  echo ">>> [7] รัน GitLab & GitLab Runner Container..."
  SERVER_IP=$(hostname -I | awk '{print $1}')
  echo "Server IP: $SERVER_IP (เข้าเว็บ: http://${SERVER_IP}:8080)"

  docker rm -f gitlab 2>/dev/null || true
  docker run -d \
    --name gitlab \
    --restart always \
    --hostname "${SERVER_IP}" \
    -p 8080:80 \
    -p 2222:22 \
    -e GITLAB_OMNIBUS_CONFIG="
      external_url 'http://${SERVER_IP}:8080';
      nginx['listen_port'] = 80;
      nginx['listen_https'] = false;
      gitlab_rails['initial_root_password'] = 'devops';
    " \
    -v /srv/gitlab/config:/etc/gitlab \
    -v /srv/gitlab/logs:/var/log/gitlab \
    -v /srv/gitlab/data:/var/opt/gitlab \
    --shm-size 256m \
    gitlab/gitlab-ce:latest

  docker rm -f gitlab-runner 2>/dev/null || true
  docker run -d \
    --name gitlab-runner \
    --restart always \
    -v /srv/gitlab-runner/config:/etc/gitlab-runner \
    -v /var/run/docker.sock:/var/run/docker.sock \
    gitlab/gitlab-runner:latest
  echo "--- สั่งรัน GitLab และ Runner สำเร็จ (รอประมาณ 2-3 นาทีเพื่อบูตระบบ) ---"
}

# ==============================================================================
# Interactive Menu
# ==============================================================================
echo "=========================================================="
echo "   DevOps Ubuntu Server - Interactive Setup Script"
echo "=========================================================="
echo " 1) Hostname + SSH Server + 2 Users (devops1, devops2) + Sudo NOPASSWD"
echo " 2) Firewall UFW (เปิดพอร์ต 22, 80, 443, 53, 3000, 5000, 5050, 8080)"
echo " 3) ติดตั้ง Docker & Docker Compose Plugin แท้ (ลบ podman ออก)"
echo " 4) โหลด Docker Images จาก Flash Drive (.tar)"
echo " 5) รัน DNS Server (Bind9 พร้อม ACL พอร์ต 53)"
echo " 6) รัน Private Docker Registry (พอร์ต 5050)"
echo " 7) รัน GitLab Server + GitLab Runner"
echo "----------------------------------------------------------"
echo " ตัวอย่างการระบุตัวเลือก:"
echo "   - พิมพ์ '1,2'   -> เพื่อทำเฉพาะข้อ 1 และ 2"
echo "   - พิมพ์ '3'     -> เพื่อติดตั้ง Docker แก้ไขปัญหา Podman"
echo "   - พิมพ์ 'all'   -> เพื่อทำทุกข้อตามลำดับ"
echo "=========================================================="
read -p "กรุณาเลือกข้อที่ต้องการทำ (เช่น 1,2 หรือ 3 หรือ all): " USER_CHOICE

if [ -z "$USER_CHOICE" ]; then
  echo "ยกเลิกการทำงาน"
  exit 0
fi

# แปลงเป็น array คั่นด้วยจุลภาคหรือเว้นวรรค
CHOICES=$(echo "$USER_CHOICE" | tr ',' ' ')

if [ "$USER_CHOICE" = "all" ]; then
  CHOICES="1 2 3 4 5 6 7"
fi

for c in $CHOICES; do
  case $c in
    1) fn_1_hostname_ssh_users ;;
    2) fn_2_firewall ;;
    3) fn_3_docker_install ;;
    4) fn_4_load_images ;;
    5) fn_5_dns_server ;;
    6) fn_6_local_registry ;;
    7) fn_7_run_gitlab ;;
    *) echo "ไม่พบตัวเลือก: $c" ;;
  esac
done

echo ""
echo "=========================================================="
echo " ดำเนินการตามตัวเลือกที่ระบุ ($USER_CHOICE) เสร็จสมบูรณ์แล้ว!"
echo "=========================================================="
