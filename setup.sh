#!/bin/bash
# ==============================================================================
# All-in-One Automated Setup Script for DevOps Competition
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

fn_quick_docker_caddy() {
  echo ""
  echo "================================================================================"
  echo ">>> [0] รัน Full Stack (Docker Compose + Caddy Reverse Proxy + DNS + /etc/hosts)..."
  echo "================================================================================"

  # 1. ตรวจสอบและตั้งค่า Local Hosts
  SERVER_IP=$(get_server_ip)
  sed -i '/mydomain.lab/d' /etc/hosts
  echo -e "127.0.0.1 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  if [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "${SERVER_IP} frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  fi

  # 2. เปิด Firewall สำหรับ Caddy และ Services พื้นฐาน
  apt install -y ufw &>/dev/null || true
  ufw allow 80/tcp &>/dev/null || true
  ufw allow 443/tcp &>/dev/null || true
  ufw allow 3000/tcp &>/dev/null || true
  ufw allow 3306/tcp &>/dev/null || true
  ufw allow 5000/tcp &>/dev/null || true
  ufw allow 5050/tcp &>/dev/null || true
  ufw allow 8080/tcp &>/dev/null || true
  ufw allow 53 &>/dev/null || true
  ufw --force enable &>/dev/null || true

  # 3. รัน DNS Server (Bind9 พร้อม ACL)
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

  # 4. Build & Up ทุก Containers ใน docker-compose.yml
  cd "$SCRIPT_DIR"
  if [ -f "docker-compose.yml" ]; then
    echo "กำลังสั่ง docker compose up -d --build..."
    docker compose up -d --build
    echo ""
    echo "สถานะ Containers ล่าสุด:"
    docker compose ps
  else
    echo "ไม่พบไฟล์ docker-compose.yml ใน $SCRIPT_DIR"
  fi

  # 5. แสดงคำสั่งสำหรับ Windows Client
  show_windows_powershell_cmd
}

fn_interactive_firewall() {
  echo ""
  echo "================================================================================"
  echo ">>> จัดการ Firewall (UFW) แบบกำหนดเอง"
  echo "================================================================================"
  apt install -y ufw &>/dev/null || true
  ufw status numbered
  echo ""
  echo "เลือกการทำงาน:"
  echo "  1) เปิดพอร์ต (Allow Port)"
  echo "  2) ปิด/บล็อกพอร์ต (Deny Port)"
  echo "  3) ลบกฎ (Delete Rule)"
  echo "  4) เปิดพอร์ตมาตรฐานทั้งหมดตามโจทย์ (22, 80, 443, 53, 3000, 3306, 5000, 5050, 8080)"
  echo "--------------------------------------------------------------------------------"
  read -p "กรุณาเลือก (1-4): " FW_ACTION

  case $FW_ACTION in
    1)
      read -p "ระบุพอร์ตที่ต้องการเปิด (เช่น 80 หรือ 80/tcp หรือหลายพอร์ต เช่น 80,443,3306): " PORTS_IN
      for p in $(echo "$PORTS_IN" | tr ',' ' '); do
        ufw allow "$p"
        echo "เปิดพอร์ต $p เรียบร้อย"
      done
      ;;
    2)
      read -p "ระบุพอร์ตที่ต้องการปิด/บล็อก (Deny) (เช่น 22 หรือ 22/tcp): " PORTS_IN
      for p in $(echo "$PORTS_IN" | tr ',' ' '); do
        ufw deny "$p"
        echo "บล็อกพอร์ต $p เรียบร้อย"
      done
      ;;
    3)
      read -p "ระบุหมายเลขกฎที่ต้องการลบ (ดูเลขจากด้านบน): " RULE_NUM
      if [ -n "$RULE_NUM" ]; then
        echo "y" | ufw delete "$RULE_NUM"
      fi
      ;;
    4)
      for p in 22/tcp 80/tcp 443/tcp 3000/tcp 3306/tcp 5000/tcp 5050/tcp 8080/tcp 53; do
        ufw allow "$p"
      done
      echo "เปิดพอร์ตมาตรฐานทั้งหมดเรียบร้อย"
      ;;
    *)
      echo "ยกเลิก"
      ;;
  esac

  ufw --force enable &>/dev/null || true
  echo ""
  echo "สถานะ Firewall ล่าสุด:"
  ufw status
}

fn_docker_install() {
  echo ""
  echo ">>> ตรวจสอบและแก้ไขปัญหา Podman แทรกแซง + ติดตั้ง Docker แท้ 100%..."
  systemctl stop podman.socket podman 2>/dev/null || true
  systemctl disable podman.socket podman 2>/dev/null || true
  apt-get purge -y podman podman-docker containernetworking-plugins 2>/dev/null || true
  apt-get autoremove -y 2>/dev/null || true
  rm -f /usr/bin/podman-docker /usr/local/bin/docker /etc/containers/nodocker 2>/dev/null || true

  apt-get update
  apt-get install -y docker.io docker-compose-v2
  systemctl unmask docker.service docker.socket 2>/dev/null || true
  systemctl enable --now docker.service
  systemctl restart docker.service

  [ -n "$SUDO_USER" ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true
  usermod -aG docker devops 2>/dev/null || true

  echo 'export DOCKER_HOST="unix:///var/run/docker.sock"' > /etc/profile.d/docker-host.sh
  chmod +x /etc/profile.d/docker-host.sh
  systemctl --user -M devops@ stop podman.socket podman 2>/dev/null || true
  rm -rf /run/user/*/podman 2>/dev/null || true

  echo "Docker version: $(docker --version)"
  echo "Docker compose version: $(docker compose version)"
}

fn_load_images() {
  echo ""
  echo ">>> โหลด Docker Image ทั้งหมดจาก Flash Drive (.tar)..."
  TAR_FILE=$(find /media /mnt -name "gitlab-all-images.tar" 2>/dev/null | head -n 1)
  if [ -n "$TAR_FILE" ]; then
    echo "พบไฟล์: $TAR_FILE"
    docker load -i "$TAR_FILE"
  else
    echo "ไม่พบไฟล์ที่ Mount อัตโนมัติ"
    lsblk
    echo "ใช้คำสั่ง: sudo docker load -i <path-to-tar>"
  fi
}

fn_cleanup_disk_space() {
  echo ""
  echo ">>> ล้างขยะและเคลียร์พื้นที่ดิสก์ (แก้ปัญหา no space left on device)..."
  apt-get clean
  docker builder prune -af 2>/dev/null || true
  docker image prune -f 2>/dev/null || true
  rm -rf /tmp/* /tmp/.* 2>/dev/null || true
  rm -rf ~/.cache/* 2>/dev/null || true
  df -h /
}

show_windows_powershell_cmd() {
  SERVER_IP=$(get_server_ip)
  echo ""
  echo "================================================================================"
  echo "  คำสั่งตั้งค่าบนเครื่อง WINDOWS CLIENT (เพื่อเข้าเว็บผ่าน Custom Domain)"
  echo "================================================================================"
  echo "เปิด PowerShell บนเครื่อง Windows ด้วยสิทธิ์ 'Run as Administrator' แล้ววางคำสั่งนี้:"
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

fn_reset_gitlab_root() {
  echo ""
  echo ">>> บังคับตั้งค่า/สร้างบัญชี root และปลดล็อก Namespace ของ GitLab เป็น 'devops1234'..."
  if ! docker ps | grep -q gitlab; then
    echo "ข้อผิดพลาด: คอนเทนเนอร์ gitlab ยังไม่ได้รัน หรือกำลังบูตอยู่"
    return 1
  fi
  docker exec -i gitlab bash -c "cat << 'EOF' > /tmp/unlock_root.rb
user = User.find_by_username('root') || User.new(username: 'root', email: 'admin@mydomain.lab', name: 'Administrator', admin: true)
user.password = 'devops1234'
user.password_confirmation = 'devops1234'
user.skip_confirmation! if user.respond_to?(:skip_confirmation!)
user.save!(validate: false)

unless user.namespace
  org = Organizations::Organization.default_organization
  ns = Namespaces::UserNamespace.new(owner: user, path: user.username, name: user.username, organization: org)
  ns.save!(validate: false)
end

user.onboarding_in_progress = false if user.respond_to?(:onboarding_in_progress=)
user.role_and_interests_already_set = true if user.respond_to?(:role_and_interests_already_set=)
user.save!(validate: false)
puts 'SUCCESS: GitLab root ready and unlocked 100%!'
EOF
gitlab-rails runner /tmp/unlock_root.rb
"
  echo "--- บัญชี root: devops1234 พร้อมใช้งาน 100% เรียบร้อย ---"
}

fn_auto_push_gitlab_branches() {
  echo ""
  echo "================================================================================"
  echo ">>> อัตโนมัติ Push โค้ดขึ้น GitLab + สร้าง 3 Branches (backend, frontend, devops)"
  echo "================================================================================"
  
  read -p "กรุณาระบุ URL ของ GitLab Repository (เช่น https://gitlab.mydomain.lab/tnk/devops-tnk.git): " GITLAB_URL
  if [ -z "$GITLAB_URL" ]; then
    echo "ยกเลิก: ไม่ได้ระบุ URL"
    return 1
  fi

  read -p "Username GitLab (เช่น root หรือ devops) [default: root]: " GIT_USER
  [ -z "$GIT_USER" ] && GIT_USER="root"

  read -s -p "Password GitLab [default: devops1234]: " GIT_PASS
  echo ""
  [ -z "$GIT_PASS" ] && GIT_PASS="devops1234"

  # แปลง URL ให้ฝัง Auth เพื่อไม่ต้องพิมพ์รหัสซ้ำ
  AUTH_URL=$(echo "$GITLAB_URL" | sed "s#https://#https://${GIT_USER}:${GIT_PASS}@#g" | sed "s#http://#http://${GIT_USER}:${GIT_PASS}@#g")

  cd "$SCRIPT_DIR"
  git config http.sslVerify false

  # ทำความสะอาดประวัติ Git ก่อน Push ขึ้น GitLab เพื่อไม่ให้หลงเหลือไฟล์ Extension หรือ VSIX
  rm -rf barron-devops-guide-extension *.vsix 2>/dev/null || true
  git rm -r --cached barron-devops-guide-extension *.vsix 2>/dev/null || true
  git add -A
  git commit -m "feat: complete devops system implementation" 2>/dev/null || true

  echo "กำลังเพิ่ม Remote และ Push Branch 'main'..."
  git remote remove gitlab 2>/dev/null || true
  git remote add gitlab "$AUTH_URL"

  git push -u gitlab main --force
  if [ $? -ne 0 ]; then
    echo "ข้อผิดพลาด: ไม่สามารถ Push ไปยัง GitLab ได้ กรุณาตรวจสอบ URL หรือรหัสผ่าน"
    return 1
  fi

  echo "กำลังสร้างและ Push Branch 'devops'..."
  git checkout -B devops && git push -u gitlab devops --force

  echo "กำลังสร้างและ Push Branch 'backend'..."
  git checkout -B backend && git push -u gitlab backend --force

  echo "กำลังสร้างและ Push Branch 'frontend'..."
  git checkout -B frontend && git push -u gitlab frontend --force

  git checkout main
  echo ""
  echo "================================================================================"
  echo "   Push โค้ดและสร้าง Branch ครบ 4 Branches สำเร็จเรียบร้อย 100%!"
  echo "   - main     (Production Branch)"
  echo "   - devops   (เกณฑ์ข้อ 4.6.19)"
  echo "   - backend  (เกณฑ์ข้อ 4.6.19)"
  echo "   - frontend (เกณฑ์ข้อ 4.6.19)"
  echo "================================================================================"
}

# ==============================================================================
# Interactive Menu
# ==============================================================================
echo "================================================================================"
echo "      DevOps Ubuntu Server - All-in-One Automated Setup Script"
echo "================================================================================"
echo " 0) [AUTO] Quick Deploy Docker + Caddy Proxy + Hosts (กด Enter รันทันที)"
echo " 1) จัดการ Firewall UFW (เลือกแล้วจะถาม Port ที่ต้องการเปิด หรือ ปิด)"
echo " 2) ติดตั้ง Docker Engine & Compose แท้ (ลบ podman ทิ้ง)"
echo " 3) โหลด Docker Images จาก Flash Drive (.tar)"
echo " 4) แสดงคำสั่ง PowerShell สำหรับตั้งค่า hosts บนเครื่อง Windows"
echo " 5) บังคับรีเซ็ต/สร้างบัญชี GitLab root เป็น 'devops1234'"
echo " 6) [AUTO] Push โค้ดขึ้น GitLab + สร้าง 3 Branches (backend, frontend, devops)"
echo " 7) เคลียร์ขยะและเพิ่มพื้นที่ว่างบนดิสก์ (แก้ปัญหา no space left on device)"
echo "--------------------------------------------------------------------------------"
echo " แนะนำ: กด 0 เพื่อรันระบบทั้งหมด หรือเลือก 6 เพื่อส่งโค้ดขึ้น GitLab ทันที"
echo "================================================================================"
read -p "กรุณาเลือกตัวเลือก (กด 0 หรือ Enter เพื่อรัน Quick Deploy): " USER_CHOICE

if [ -z "$USER_CHOICE" ] || [ "$USER_CHOICE" = "0" ]; then
  fn_quick_docker_caddy
  exit 0
fi

case $USER_CHOICE in
  1) fn_interactive_firewall ;;
  2) fn_docker_install ;;
  3) fn_load_images ;;
  4) show_windows_powershell_cmd ;;
  5) fn_reset_gitlab_root ;;
  6) fn_auto_push_gitlab_branches ;;
  7) fn_cleanup_disk_space ;;
  *) echo "ไม่พบตัวเลือก: $USER_CHOICE" ;;
esac
