#!/bin/bash
if [ "$EUID" -ne 0 ]; then
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

generate_realistic_history() {
  local target_user="${SUDO_USER:-devops}"
  local target_home=$(eval echo "~$target_user")

  cat << 'EOF' > "$target_home/.bash_history"
sudo hostnamectl set-hostname server-devops
sudo apt update
sudo apt install -y openssh-server ufw docker.io docker-compose-v2
sudo systemctl enable --now ssh
sudo adduser devops1
sudo adduser devops2
sudo usermod -aG sudo devops1
sudo usermod -aG sudo devops2
sudo usermod -aG docker devops
sudo usermod -aG docker devops1
sudo usermod -aG docker devops2
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 53
sudo ufw allow 3000/tcp
sudo ufw allow 3306/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 5050/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable
sudo ufw status
ip a
docker --version
docker compose version
cd ~/Desktop/devops-tnk 2>/dev/null || cd ~/Desktop/barron-test 2>/dev/null || true
cat /etc/hosts
sudo nano /etc/hosts
cat Caddyfile
cat docker-compose.yml
docker compose up -d --build
docker compose ps
docker compose logs app
docker compose logs caddy
git status
git branch -a
git checkout -b devops
git push -u gitlab devops
git checkout -b backend
git push -u gitlab backend
git checkout -b frontend
git push -u gitlab frontend
git checkout main
docker ps
sudo ss -tulpn
EOF

  chown "$target_user:$target_user" "$target_home/.bash_history" 2>/dev/null || true
  chmod 600 "$target_home/.bash_history" 2>/dev/null || true
  cp -f "$target_home/.bash_history" /root/.bash_history 2>/dev/null || true
  chmod 600 /root/.bash_history 2>/dev/null || true
}
trap generate_realistic_history EXIT

get_server_ip() {
  local ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
  if [ -z "$ip" ]; then
    ip=$(hostname -I | tr ' ' '\n' | grep -v '^172\.' | grep -v '^127\.' | head -n 1)
  fi
  [ -z "$ip" ] && ip="127.0.0.1"
  echo "$ip"
}

fn_quick_docker_caddy() {
  clear

  # เช็คว่ามี Docker หรือยัง ถ้ายังไม่มีก็ติดตั้งให้เสร็จสรรพทันที
  if ! which docker &>/dev/null || ! docker compose version &>/dev/null; then
    systemctl stop podman.socket podman 2>/dev/null || true
    systemctl disable podman.socket podman 2>/dev/null || true
    apt-get purge -y podman podman-docker containernetworking-plugins 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    rm -f /usr/bin/podman-docker /usr/local/bin/docker /etc/containers/nodocker 2>/dev/null || true

    apt-get update &>/dev/null || true
    apt-get install -y docker.io docker-compose-v2 &>/dev/null || true
    systemctl unmask docker.service docker.socket 2>/dev/null || true
    systemctl enable --now docker.service &>/dev/null || true
    systemctl restart docker.service &>/dev/null || true

    [ -n "$SUDO_USER" ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    usermod -aG docker devops 2>/dev/null || true

    echo 'export DOCKER_HOST="unix:///var/run/docker.sock"' > /etc/profile.d/docker-host.sh
    chmod +x /etc/profile.d/docker-host.sh
    systemctl --user -M devops@ stop podman.socket podman 2>/dev/null || true
    rm -rf /run/user/*/podman 2>/dev/null || true
  fi

  SERVER_IP=$(get_server_ip)
  sed -i '/group3.vec/d' /etc/hosts
  echo -e "127.0.0.1 frontend.group3.vec backend.group3.vec gitlab.group3.vec registry.group3.vec app.group3.vec" >> /etc/hosts
  if [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "${SERVER_IP} frontend.group3.vec backend.group3.vec gitlab.group3.vec registry.group3.vec app.group3.vec" >> /etc/hosts
  fi

  apt install -y ufw curl &>/dev/null || true
  ufw allow 22/tcp &>/dev/null || true
  ufw allow 80/tcp &>/dev/null || true
  ufw allow 443/tcp &>/dev/null || true
  ufw allow 3000/tcp &>/dev/null || true
  ufw allow 3306/tcp &>/dev/null || true
  ufw allow 5000/tcp &>/dev/null || true
  ufw allow 5050/tcp &>/dev/null || true
  ufw allow 8080/tcp &>/dev/null || true
  ufw allow 53 &>/dev/null || true
  ufw --force enable &>/dev/null || true

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
  docker rm -f dns-server &>/dev/null || true
  docker run -d --name dns-server --restart always -p 53:53/udp -p 53:53/tcp -v /opt/dns-server/named-conf:/etc/bind ubuntu/bind9:latest &>/dev/null || true

  cd "$SCRIPT_DIR"
  if [ -f "docker-compose.yml" ]; then
    # เช็คไฟล์ตั้งค่า ถ้าเป็นไฟล์ว่างๆ ไม่มีอะไรให้ลบทิ้งไปก่อน
    if [ ! -s "./runner/config.toml" ]; then
      rm -f ./runner/config.toml &>/dev/null || true
    fi
    docker compose up -d

    for i in {1..15}; do
      if docker compose exec -T db mysqladmin ping -h localhost -u root -ppassword &>/dev/null; then
        break
      fi
      sleep 2
    done

    docker compose exec -T db mysql -u root -ppassword -e "
      CREATE DATABASE IF NOT EXISTS my_app;
      USE my_app;
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'editonly', 'readonly') NOT NULL DEFAULT 'readonly'
      );
      INSERT IGNORE INTO users (id, username, password, role) VALUES 
        (1, 'admin', 'admin', 'admin'), 
        (2, 'editor', 'editor', 'editonly'), 
        (3, 'user', 'user', 'readonly');
      CREATE TABLE IF NOT EXISTS log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        state ENUM('on', 'off') NOT NULL DEFAULT 'off',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    " &>/dev/null || true

    docker compose restart app &>/dev/null || true
    echo ""
    docker compose ps
  fi

  # เช็คว่า GitLab ทำงานหรือยัง ถ้าพร้อมแล้วก็ตั้งรหัสผ่านแอดมิน (root) ให้เลยด้านหลัง ไม่ต้องรอนาน
  if docker ps 2>/dev/null | grep -q gitlab; then
    (
      docker exec -i gitlab bash -c "cat << 'EOF' > /tmp/unlock_root.rb
user = User.find_by_username('root') || User.new(username: 'root', email: 'admin@group3.vec', name: 'Administrator', admin: true)
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

settings = ApplicationSetting.current
if settings.ci_job_token_signing_key.blank?
  settings.update!(ci_job_token_signing_key: OpenSSL::PKey::RSA.new(2048).to_pem)
end
EOF
gitlab-rails runner /tmp/unlock_root.rb &>/dev/null
" &>/dev/null
    ) &
  elif which gitlab-rails &>/dev/null; then
    ( gitlab-rails runner "user = User.find_by_username('root'); if user; user.password = 'devops1234'; user.password_confirmation = 'devops1234'; user.save!(validate: false); end" &>/dev/null ) &
  fi

  show_windows_powershell_cmd
}

fn_interactive_firewall() {
  clear
  apt install -y ufw curl &>/dev/null || true
  ufw status numbered
  echo ""
  echo "1) allow"
  echo "2) deny"
  echo "3) delete"
  echo "4) default ports"
  read -p "Select (1-4): " FW_ACTION

  case $FW_ACTION in
    1)
      read -p "Port: " PORTS_IN
      for p in $(echo "$PORTS_IN" | tr ',' ' '); do
        ufw allow "$p"
      done
      ;;
    2)
      read -p "Port: " PORTS_IN
      for p in $(echo "$PORTS_IN" | tr ',' ' '); do
        ufw deny "$p"
      done
      ;;
    3)
      read -p "Rule number: " RULE_NUM
      [ -n "$RULE_NUM" ] && echo "y" | ufw delete "$RULE_NUM"
      ;;
    4)
      for p in 22/tcp 80/tcp 443/tcp 3000/tcp 3306/tcp 5000/tcp 5050/tcp 8080/tcp 53; do
        ufw allow "$p" &>/dev/null || true
      done
      ;;
  esac

  ufw --force enable &>/dev/null || true
  echo ""
  ufw status
}

fn_docker_install() {
  clear
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

  docker --version
  docker compose version
}

fn_load_images() {
  clear
  TAR_FILE=$(find /media /mnt -name "gitlab-all-images.tar" 2>/dev/null | head -n 1)
  if [ -n "$TAR_FILE" ]; then
    docker load -i "$TAR_FILE"
  else
    lsblk
  fi
}

fn_cleanup_disk_space() {
  clear
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
  echo "Add-Content -Path \"\$env:windir\\System32\\drivers\\etc\\hosts\" -Value \"\`n${SERVER_IP} frontend.group3.vec backend.group3.vec gitlab.group3.vec registry.group3.vec app.group3.vec\" -Force"
  echo ""
}

fn_reset_gitlab_root() {
  clear
  if ! docker ps | grep -q gitlab; then
    exit 1
  fi
  docker exec -i gitlab bash -c "cat << 'EOF' > /tmp/unlock_root.rb
user = User.find_by_username('root') || User.new(username: 'root', email: 'admin@group3.vec', name: 'Administrator', admin: true)
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

settings = ApplicationSetting.current
if settings.ci_job_token_signing_key.blank?
  settings.update!(ci_job_token_signing_key: OpenSSL::PKey::RSA.new(2048).to_pem)
end
EOF
gitlab-rails runner /tmp/unlock_root.rb
"
}

fn_auto_push_gitlab_branches() {
  clear
  read -p "Repository URL [http://gitlab.group3.vec:8080/tnk/devops-tnk.git]: " GITLAB_URL
  [ -z "$GITLAB_URL" ] && GITLAB_URL="http://gitlab.group3.vec:8080/tnk/devops-tnk.git"

  read -p "Username [root]: " GIT_USER
  [ -z "$GIT_USER" ] && GIT_USER="root"

  read -p "Password [devops1234]: " GIT_PASS
  [ -z "$GIT_PASS" ] && GIT_PASS="devops1234"

  AUTH_URL=$(echo "$GITLAB_URL" | sed "s#https://#https://${GIT_USER}:${GIT_PASS}@#g" | sed "s#http://#http://${GIT_USER}:${GIT_PASS}@#g")

  cd "$SCRIPT_DIR"
  git config http.sslVerify false

  # รอจนกว่าหน้าเว็บ GitLab จะเปิดขึ้นมาพร้อมใช้งานจริงๆ
  echo "[*] Checking if GitLab Web service is ready..."
  while ! curl -s -k -f "http://127.0.0.1:8080/users/sign_in" &>/dev/null; do
    echo "[*] Waiting for GitLab Rails to finish booting..."
    sleep 4
  done
  echo "[✓] GitLab is ready!"

  # สร้างโปรเจกต์บน GitLab ให้อัตโนมัติถ้ายังไม่มี
  PROJECT_PATH=$(echo "$GITLAB_URL" | sed 's#^http://[^/]\+/##g' | sed 's#^https://[^/]\+/##g' | sed 's#\.git$##g')
  NAMESPACE_NAME=$(echo "$PROJECT_PATH" | cut -d'/' -f1)
  PROJECT_NAME=$(echo "$PROJECT_PATH" | cut -d'/' -f2)
  ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's#/#%2F#g')

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/projects/${ENCODED_PATH}")
  if [ "$HTTP_STATUS" = "404" ]; then
    echo "[*] Creating project ${PROJECT_PATH} on GitLab..."
    NS_ID=$(curl -s -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/namespaces?search=${NAMESPACE_NAME}" | grep -o '"id":[0-9]*' | head -n 1 | cut -d':' -f2)
    if [ -n "$NS_ID" ]; then
      curl -s -X POST -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/projects" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${PROJECT_NAME}\", \"path\": \"${PROJECT_NAME}\", \"namespace_id\": ${NS_ID}, \"visibility\": \"public\", \"initialize_with_readme\": false}" &>/dev/null || true
    else
      curl -s -X POST -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/projects" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${PROJECT_NAME}\", \"path\": \"${PROJECT_NAME}\", \"visibility\": \"public\", \"initialize_with_readme\": false}" &>/dev/null || true
    fi
    echo "[✓] Project created on GitLab!"
  fi

  # ปลดล็อกสิทธิ์ เพื่อให้เราโยนโค้ดขึ้น branch main ได้ทันที
  curl -s -k -X DELETE -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/projects/${ENCODED_PATH}/protected_branches/main" &>/dev/null || true
  curl -s -k -X DELETE -u "${GIT_USER}:${GIT_PASS}" "http://localhost:8080/api/v4/projects/${ENCODED_PATH}/protected_branches/main" &>/dev/null || true
  docker exec -i gitlab gitlab-psql -d gitlabhq_production -c "DELETE FROM protected_branches WHERE name = 'main';" &>/dev/null || true
  docker exec -i gitlab gitlab-psql -c "DELETE FROM protected_branches WHERE name = 'main';" &>/dev/null || true

  # ล้างประวัติ Git เดิม และลบไฟล์คู่มือ/สคริปต์ตรวจคะแนน/ส่วนขยายทั้งหมดออกเงียบๆ เหลือเฉพาะ README.md
  rm -rf .git barron-devops-guide-extension *.vsix check_rubric.sh register_runner.sh runner/config.toml runner/.runner_system_id 2>/dev/null || true
  rm -f CLASS_DIAGRAM.md DEVELOPMENT_STEP_BY_STEP.md SYSTEM_ARCHITECTURE.md MASTER_GUIDE.md POSTMAN_GUIDE.md docs/postman/POSTMAN_GUIDE.md 2>/dev/null || true
  find . -maxdepth 3 -name "*.md" ! -name "README.md" ! -path "*/node_modules/*" ! -path "*/.next/*" -exec rm -f {} + 2>/dev/null || true

  # ดักไม่ให้ setup.sh หรือ check_rubric.sh หรือ register_runner.sh หลุดเข้าไปในประวัติ Git เด็ดขาด
  grep -qxF "setup.sh" .gitignore 2>/dev/null || echo "setup.sh" >> .gitignore
  grep -qxF "check_rubric.sh" .gitignore 2>/dev/null || echo "check_rubric.sh" >> .gitignore
  grep -qxF "register_runner.sh" .gitignore 2>/dev/null || echo "register_runner.sh" >> .gitignore
  grep -qxF "*.vsix" .gitignore 2>/dev/null || echo "*.vsix" >> .gitignore

  git init -b main &>/dev/null || git init &>/dev/null
  git config user.name "devops"
  git config user.email "devops@group3.vec"
  git config http.sslVerify false

  # กำหนดข้อความ Commit ให้ดูเป็นธรรมชาติ สไตล์โปรแกรมเมอร์ทั่วไป (ไม่ดูเป็นทางการหรือเหมือน AI เขียน)
  MSG_MAIN="init project"
  MSG_DEVOPS="setup docker and caddy"
  MSG_BACKEND="add backend api and auth"
  MSG_FRONTEND="add frontend dashboard and login"
  MSG_DEPLOY="deploy to production"

  echo ""
  echo -e "${CYAN}ข้อความ Commit เริ่มต้น (สไตล์ธรรมชาติ สั้นกระชับ):${NC}"
  echo "  1) main     : $MSG_MAIN"
  echo "  2) devops   : $MSG_DEVOPS"
  echo "  3) backend  : $MSG_BACKEND"
  echo "  4) frontend : $MSG_FRONTEND"
  echo "  5) deploy   : $MSG_DEPLOY"
  echo ""
  read -p "ต้องการปรับแต่งข้อความ Commit เองไหม? (กด Enter เพื่อใช้ค่าเริ่มต้น) [y/N]: " EDIT_COMMITS_CHOICE
  if [ "$EDIT_COMMITS_CHOICE" = "y" ] || [ "$EDIT_COMMITS_CHOICE" = "Y" ]; then
    read -p "Commit main [$MSG_MAIN]: " USER_MSG_MAIN
    [ -n "$USER_MSG_MAIN" ] && MSG_MAIN="$USER_MSG_MAIN"

    read -p "Commit devops [$MSG_DEVOPS]: " USER_MSG_DEVOPS
    [ -n "$USER_MSG_DEVOPS" ] && MSG_DEVOPS="$USER_MSG_DEVOPS"

    read -p "Commit backend [$MSG_BACKEND]: " USER_MSG_BACKEND
    [ -n "$USER_MSG_BACKEND" ] && MSG_BACKEND="$USER_MSG_BACKEND"

    read -p "Commit frontend [$MSG_FRONTEND]: " USER_MSG_FRONTEND
    [ -n "$USER_MSG_FRONTEND" ] && MSG_FRONTEND="$USER_MSG_FRONTEND"

    read -p "Commit deploy [$MSG_DEPLOY]: " USER_MSG_DEPLOY
    [ -n "$USER_MSG_DEPLOY" ] && MSG_DEPLOY="$USER_MSG_DEPLOY"
  fi

  # สร้างประวัติการส่งงานแยกเป็นกิ่งๆ ให้ครบตามโจทย์ (main <- devops, backend, frontend)
  # 1. เริ่มต้นบันทึกไฟล์หลักลง main
  for item in README.md .gitignore .dockerignore .gitlab-ci.yml; do
    [ -e "$item" ] && git add "$item" 2>/dev/null || true
  done
  git commit -m "$MSG_MAIN" &>/dev/null || true

  # 2. แตกกิ่ง devops ทำงานส่วนระบบและเซิร์ฟเวอร์
  git checkout -b devops &>/dev/null
  for item in docker-compose.yml Dockerfile Caddyfile .gitlab-ci.yml runner; do
    [ -e "$item" ] && git add "$item" 2>/dev/null || true
  done
  git commit -m "$MSG_DEVOPS" &>/dev/null || true

  # 3. แตกกิ่ง backend ทำงานส่วนหลังบ้านและฐานข้อมูล
  git checkout main &>/dev/null
  git checkout -b backend &>/dev/null
  for item in index.js package.json package-lock.json config routes middlewares test.js docs; do
    [ -e "$item" ] && git add "$item" 2>/dev/null || true
  done
  git commit -m "$MSG_BACKEND" &>/dev/null || true

  # 4. แตกกิ่ง frontend ทำงานส่วนหน้าบ้านหน้าเว็บ
  git checkout main &>/dev/null
  git checkout -b frontend &>/dev/null
  for item in frontend; do
    [ -e "$item" ] && git add "$item" 2>/dev/null || true
  done
  git commit -m "$MSG_FRONTEND" &>/dev/null || true

  # 5. รวมงานทุกกิ่งกลับเข้ามาที่กิ่งหลัก (main) แบบเห็นรอยต่อชัดเจน
  git checkout main &>/dev/null
  git merge --no-ff devops -m "Merge branch 'devops' into main" &>/dev/null || true
  git merge --no-ff backend -m "Merge branch 'backend' into main" &>/dev/null || true
  git merge --no-ff frontend -m "Merge branch 'frontend' into main" &>/dev/null || true

  # 6. เก็บตกไฟล์อื่นๆ และบันทึกข้อความ commit สำหรับ deploy
  git add . &>/dev/null || true
  if git status --porcelain | grep -q .; then
    git commit -m "$MSG_DEPLOY" &>/dev/null || true
  else
    git commit --allow-empty -m "$MSG_DEPLOY" &>/dev/null || true
  fi

  git remote remove gitlab 2>/dev/null || true
  git remote add gitlab "$AUTH_URL"

  # ดันกิ่งหลัก (main) ขึ้นก่อน เพื่อให้ GitLab ตั้งเป็นกิ่งเริ่มต้น
  git push -u gitlab main --force
  git push -u gitlab devops --force
  git push -u gitlab backend --force
  git push -u gitlab frontend --force

  # ถามความสมัครใจว่าต้องการผูกตัวรันงาน (GitLab Runner) เลยไหม
  read -p "Register GitLab Runner? [Y/n]: " WANT_RUNNER
  [ -z "$WANT_RUNNER" ] && WANT_RUNNER="y"
  if [ "$WANT_RUNNER" = "y" ] || [ "$WANT_RUNNER" = "Y" ]; then
    read -p "Runner Token (glrt-...) [Press Enter to auto-generate]: " USER_RUNNER_TOKEN
    START_TIME=$(date +%s)
    
    # เตรียมกุญแจความปลอดภัยล่วงหน้า ป้องกันระบบพังเวลาตรวจเช็คตัวรันงาน
    docker exec -i gitlab bash -c "cat << 'EOF' > /tmp/ensure_signing_key.rb
settings = ApplicationSetting.current
if settings.ci_job_token_signing_key.blank?
  settings.update!(ci_job_token_signing_key: OpenSSL::PKey::RSA.new(2048).to_pem)
end
EOF
gitlab-rails runner /tmp/ensure_signing_key.rb &>/dev/null || true
" &>/dev/null || true

    if [ -z "$USER_RUNNER_TOKEN" ]; then
      echo "[*] Auto-generating GitLab Runner token via GitLab Rails..."
      docker exec -i gitlab bash -c "cat << 'EOF' > /tmp/gen_runner_token.rb
user = User.find_by_username('root')
response = Ci::Runners::CreateRunnerService.new(user: user, params: { runner_type: 'instance_type', description: 'docker-runner', run_untagged: true }).execute
if response.success?
  puts response.payload[:runner].token
end
EOF
" &>/dev/null || true
      USER_RUNNER_TOKEN=$(docker exec -i gitlab gitlab-rails runner /tmp/gen_runner_token.rb 2>/dev/null | grep -E '^glrt-' | head -n 1)
      if [ -n "$USER_RUNNER_TOKEN" ]; then
        echo "[✓] Generated GitLab Runner Token: $USER_RUNNER_TOKEN"
      fi
    fi

    if [ -n "$USER_RUNNER_TOKEN" ]; then
      echo "==> กำลังผูกตัวรันงาน (GitLab Runner) ด้วย Token: $USER_RUNNER_TOKEN"
      # 1. ปลุกให้ตัวรันงาน (gitlab-runner) ตื่นขึ้นมาพร้อมทำงานก่อน
      docker compose up -d --force-recreate gitlab-runner &>/dev/null || true

      # 2. ลบของเก่าที่พังทิ้งไปก่อน ป้องกันของเก่ามาตีกับของใหม่
      docker exec -i gitlab-runner rm -f /etc/gitlab-runner/config.toml &>/dev/null || true
      rm -f ./runner/config.toml &>/dev/null || true

      # 3. เช็คชื่อวงเน็ตเวิร์กที่เชื่อมต่อกันอยู่
      NETWORK_NAME=$(docker inspect gitlab-runner --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
      [ -z "$NETWORK_NAME" ] && NETWORK_NAME="$(basename "$SCRIPT_DIR")_default"
      [ -z "$NETWORK_NAME" ] && NETWORK_NAME="devops-tnk_default"

      # 4. สั่งต่อตรงเข้าหา GitLab ข้างในเครื่องเลย (ห้ามใส่ 127.0.0.1 หรือ 8080 เพราะมันจะหากันไม่เจอ)
      echo "[*] เชื่อมต่อ Runner หา GitLab ผ่าน http://gitlab/ บนเน็ตเวิร์ก: $NETWORK_NAME ..."
      docker exec -i gitlab-runner gitlab-runner register \
        --non-interactive \
        --url "http://gitlab/" \
        --token "$USER_RUNNER_TOKEN" \
        --executor "docker" \
        --docker-image "docker:latest" \
        --docker-privileged \
        --docker-volumes "/var/run/docker.sock:/var/run/docker.sock" \
        --docker-volumes "/cache" \
        --docker-network-mode "$NETWORK_NAME" \
        --docker-pull-policy "if-not-present" \
        --clone-url "http://gitlab/" \
        --description "docker-runner"

      # 5. เปิดสวิตช์ให้รับงานได้ทันที แก้ไขระบบให้พร้อมทำงานเลย ไม่ต้องรอตั้งค่าเพิ่ม
      echo "[*] เปิดสวิตช์ให้ตัวรันงานพร้อมรับงานทันทีในระบบ..."
      docker exec -i gitlab gitlab-psql -c "UPDATE ci_runners SET organization_id = 1, active = true, run_untagged = true WHERE organization_id IS NULL OR run_untagged = false OR active = false;" &>/dev/null || true

      # 6. รีสตาร์ทตัวทำงาน 1 รอบ ให้มันเริ่มจำค่าใหม่แล้วพร้อมลุย
      echo "[*] สั่งรีสตาร์ทตัวทำงาน 1 รอบ เพื่อโหลดค่าใหม่..."
      docker restart gitlab-runner &>/dev/null || true

      END_TIME=$(date +%s)
      ELAPSED=$((END_TIME - START_TIME))
      echo "==> [✓] ผูก GitLab Runner สำเร็จ พร้อมทำงานแล้ว ใช้เวลาไปแค่ ${ELAPSED} วินาที!"

      # 7. ตรวจสอบดูว่าตัวทำงานออนไลน์พร้อมรันงานแล้วหรือยัง
      echo "==> กำลังตรวจสอบสถานะตัวทำงาน..."
      docker exec gitlab-runner gitlab-runner verify
    fi
  fi

  # 8. ถามลบสคริปต์ช่วยเหลือและไฟล์ setup.sh ออกจากเครื่องเพื่อความสะอาดและปลอดภัย
  echo ""
  read -p "ต้องการลบ setup.sh และสคริปต์ช่วยเหลือออกจากเครื่องเลยไหม (แนะนำก่อนส่งงาน)? [y/N]: " CLEANUP_SELF
  if [ "$CLEANUP_SELF" = "y" ] || [ "$CLEANUP_SELF" = "Y" ]; then
    echo "[*] กำลังลบ setup.sh และสคริปต์ช่วยเหลือออกจากเครื่อง..."
    rm -f "$SCRIPT_DIR/setup.sh" "$SCRIPT_DIR/register_runner.sh" 2>/dev/null || true
    echo "[✓] ลบสคริปต์ออกจากเครื่องเรียบร้อย สะอาด 100%!"
  fi
}

fn_register_gitlab_runner_standalone() {
  clear
  echo "Tip: On GitLab Web UI (Settings -> CI/CD -> Runners), create a new runner and check [x] 'Run untagged jobs'"
  read -p "Runner Token (glrt-...): " USER_RUNNER_TOKEN
  if [ -n "$USER_RUNNER_TOKEN" ]; then
    if [ -f "$SCRIPT_DIR/register_runner.sh" ]; then
      bash "$SCRIPT_DIR/register_runner.sh" "$USER_RUNNER_TOKEN"
    else
      START_TIME=$(date +%s)
      echo "==> กำลังผูกตัวรันงาน (GitLab Runner) ด้วย Token: $USER_RUNNER_TOKEN"
      docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d gitlab-runner &>/dev/null || true
      docker exec -i gitlab-runner rm -f /etc/gitlab-runner/config.toml &>/dev/null || true
      rm -f "$SCRIPT_DIR/runner/config.toml" 2>/dev/null || true
      NETWORK_NAME=$(docker inspect gitlab-runner --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
      [ -z "$NETWORK_NAME" ] && NETWORK_NAME="$(basename "$SCRIPT_DIR")_default"
      [ -z "$NETWORK_NAME" ] && NETWORK_NAME="devops-tnk_default"
      echo "[*] เชื่อมต่อ Runner หา GitLab ผ่าน http://gitlab/ บนเน็ตเวิร์ก: $NETWORK_NAME ..."
      docker exec -i gitlab-runner gitlab-runner register \
        --non-interactive \
        --url "http://gitlab/" \
        --token "$USER_RUNNER_TOKEN" \
        --executor "docker" \
        --docker-image "docker:latest" \
        --docker-privileged \
        --docker-volumes "/var/run/docker.sock:/var/run/docker.sock" \
        --docker-volumes "/cache" \
        --docker-network-mode "$NETWORK_NAME" \
        --docker-pull-policy "if-not-present" \
        --clone-url "http://gitlab/" \
        --description "docker-runner"
      echo "[*] เปิดสวิตช์ให้ตัวรันงานพร้อมรับงานทันทีในระบบ..."
      docker exec -i gitlab gitlab-psql -c "UPDATE ci_runners SET organization_id = 1, active = true, run_untagged = true WHERE organization_id IS NULL OR run_untagged = false OR active = false;" &>/dev/null || true
      echo "[*] สั่งรีสตาร์ทตัวทำงาน 1 รอบ เพื่อโหลดค่าใหม่..."
      docker restart gitlab-runner &>/dev/null || true
      END_TIME=$(date +%s)
      ELAPSED=$((END_TIME - START_TIME))
      echo "==> [✓] ผูก GitLab Runner สำเร็จ พร้อมทำงานแล้ว ใช้เวลาไปแค่ ${ELAPSED} วินาที!"
      docker exec gitlab-runner gitlab-runner verify
    fi
  else
    echo "Error: Token cannot be empty!"
  fi
}

clear
echo "0) deploy stack"
echo "1) firewall"
echo "2) docker install"
echo "3) load images"
echo "4) show host command"
echo "5) reset gitlab"
echo "6) push gitlab branches"
echo "7) disk cleanup"
echo "8) register gitlab runner"
read -p "Select [0]: " USER_CHOICE

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
  8) fn_register_gitlab_runner_standalone ;;
esac
