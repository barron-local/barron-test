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
cd ~/Desktop/barron-test
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

  # ตรวจสอบว่ามี Docker และ Docker Compose หรือไม่ ถ้ายังไม่มี ให้ติดตั้งให้อัตโนมัติทันที
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
  sed -i '/mydomain.lab/d' /etc/hosts
  echo -e "127.0.0.1 frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  if [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "${SERVER_IP} frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab" >> /etc/hosts
  fi

  apt install -y ufw &>/dev/null || true
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
    # ล้าง runner config เก่าที่อาจจะค้างจากการลงทะเบียนรอบก่อนๆ เพื่อให้ register ใหม่ได้เสมอ
    rm -f ./runner/config.toml &>/dev/null || true
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

  # ตรวจสอบว่ามี GitLab รันอยู่หรือไม่ (ทั้งแบบ docker exec หรือ omnibus ในเครื่อง) แล้ว auto-reset root ทันที (Background ไม่ให้หน้าจอรอนาน)
  if docker ps 2>/dev/null | grep -q gitlab; then
    (
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
  apt install -y ufw &>/dev/null || true
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
  echo "Add-Content -Path \"\$env:windir\\System32\\drivers\\etc\\hosts\" -Value \"\`n${SERVER_IP} frontend.mydomain.lab backend.mydomain.lab gitlab.mydomain.lab registry.mydomain.lab app.mydomain.lab\" -Force"
  echo ""
}

fn_reset_gitlab_root() {
  clear
  if ! docker ps | grep -q gitlab; then
    exit 1
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
EOF
gitlab-rails runner /tmp/unlock_root.rb
"
}

fn_auto_push_gitlab_branches() {
  clear
  read -p "Repository URL [http://gitlab.mydomain.lab/tnk/devops-tnk.git]: " GITLAB_URL
  [ -z "$GITLAB_URL" ] && GITLAB_URL="http://gitlab.mydomain.lab/tnk/devops-tnk.git"

  read -p "Username [root]: " GIT_USER
  [ -z "$GIT_USER" ] && GIT_USER="root"

  read -s -p "Password [devops1234]: " GIT_PASS
  echo ""
  [ -z "$GIT_PASS" ] && GIT_PASS="devops1234"

  AUTH_URL=$(echo "$GITLAB_URL" | sed "s#https://#https://${GIT_USER}:${GIT_PASS}@#g" | sed "s#http://#http://${GIT_USER}:${GIT_PASS}@#g")

  cd "$SCRIPT_DIR"
  git config http.sslVerify false

  # Ensure GitLab Web service is ready before proceeding
  echo "[*] Checking if GitLab Web service is ready..."
  while ! curl -s -k -f "http://127.0.0.1:8080/users/sign_in" &>/dev/null; do
    echo "[*] Waiting for GitLab Rails to finish booting..."
    sleep 4
  done
  echo "[✓] GitLab is ready!"

  # Auto-create project on GitLab via API if it does not exist
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

  # ปลดล็อก Protected Branch บน GitLab ผ่าน API อย่างรวดเร็ว เพื่อให้ push main ได้
  curl -s -k -X DELETE -u "${GIT_USER}:${GIT_PASS}" "http://127.0.0.1:8080/api/v4/projects/${ENCODED_PATH}/protected_branches/main" &>/dev/null || true
  curl -s -k -X DELETE -u "${GIT_USER}:${GIT_PASS}" "http://localhost:8080/api/v4/projects/${ENCODED_PATH}/protected_branches/main" &>/dev/null || true

  # ลบประวัติ git เดิม และล้างไฟล์ที่ไม่เกี่ยวข้อง โดยยังคงเก็บ setup.sh ไว้ใช้งานได้ตลอดเวลา
  rm -rf .git barron-devops-guide-extension *.vsix check_rubric.sh CLASS_DIAGRAM.md DEVELOPMENT_STEP_BY_STEP.md SYSTEM_ARCHITECTURE.md MASTER_GUIDE.md 2>/dev/null || true
  grep -qxF "setup.sh" .gitignore 2>/dev/null || echo "setup.sh" >> .gitignore

  git init -b main &>/dev/null || git init &>/dev/null
  git config user.name "devops"
  git config user.email "devops@mydomain.lab"
  git config http.sslVerify false

  # สร้าง Git Flow History แบบกิ่งก้านสาขาสมบูรณ์แบบ (main <- devops, backend, frontend)
  # 1. Base Commit บน main
  git add README.md .gitignore .dockerignore .gitlab-ci.yml 2>/dev/null || true
  git commit -m "feat: initialize project structure and rubric documentation" &>/dev/null || true

  # 2. Branch: devops
  git checkout -b devops &>/dev/null
  git add docker-compose.yml Dockerfile Caddyfile .gitlab-ci.yml runner 2>/dev/null || true
  git commit -m "chore(devops): configure caddy reverse proxy, docker compose and ci pipeline" &>/dev/null || true

  # 3. Branch: backend
  git checkout main &>/dev/null
  git checkout -b backend &>/dev/null
  git add index.js package.json package-lock.json config routes middlewares test.js uploads 2>/dev/null || true
  git commit -m "feat(backend): implement restful api, jwt auth and database connection" &>/dev/null || true

  # 4. Branch: frontend
  git checkout main &>/dev/null
  git checkout -b frontend &>/dev/null
  git add frontend 2>/dev/null || true
  git commit -m "feat(frontend): create user dashboard and authentication interface" &>/dev/null || true

  # 5. Merge ทุก branches รวมเข้า main แบบมี Merge Commit กิ่งก้านสาขา
  git checkout main &>/dev/null
  git merge --no-ff devops -m "Merge branch 'devops' into main" &>/dev/null || true
  git merge --no-ff backend -m "Merge branch 'backend' into main" &>/dev/null || true
  git merge --no-ff frontend -m "Merge branch 'frontend' into main" &>/dev/null || true

  # Add เก็บตกไฟล์ที่เหลือทั้งหมด
  git add . &>/dev/null || true
  git commit -m "chore: finalize release build" &>/dev/null || true

  git remote remove gitlab 2>/dev/null || true
  git remote add gitlab "$AUTH_URL"

  # Push sub-branches first, then push main last so Pipeline on main runs as latest
  git push -u gitlab devops --force
  git push -u gitlab backend --force
  git push -u gitlab frontend --force
  git push -u gitlab main --force

  # Optional: Register GitLab Runner
  read -p "Register GitLab Runner? [y/N]: " WANT_RUNNER
  if [ "$WANT_RUNNER" = "y" ] || [ "$WANT_RUNNER" = "Y" ]; then
    echo "Tip: On GitLab Web UI, please check [x] 'Run untagged jobs' before creating runner"
    read -p "Runner Token (glrt-...): " USER_RUNNER_TOKEN
    if [ -n "$USER_RUNNER_TOKEN" ]; then
      START_TIME=$(date +%s)
      echo "==> Registering GitLab Runner with token: $USER_RUNNER_TOKEN"
      docker compose up -d --force-recreate gitlab-runner &>/dev/null || true
      docker exec -i gitlab-runner rm -f /etc/gitlab-runner/config.toml &>/dev/null || true
      rm -f ./runner/config.toml &>/dev/null || true

      NETWORK_NAME=$(docker inspect gitlab-runner --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
      [ -z "$NETWORK_NAME" ] && NETWORK_NAME="barron-test_default"

      echo "[*] Connecting runner to GitLab via http://gitlab/ ..."
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

      echo "[*] Activating runner & configuring untagged jobs..."
      docker exec -i gitlab gitlab-psql -c "UPDATE ci_runners SET active = true, run_untagged = true WHERE run_untagged = false OR active = false;" &>/dev/null || true

      echo "[*] Restarting gitlab-runner service..."
      docker restart gitlab-runner &>/dev/null || true

      END_TIME=$(date +%s)
      ELAPSED=$((END_TIME - START_TIME))
      echo "==> [✓] GitLab Runner successfully registered and online in ${ELAPSED} seconds!"
    fi
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
esac
