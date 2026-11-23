#!/bin/bash
# ==============================================================================
# ตัวช่วยผูก GitLab Runner แบบรวดเร็ว (ไม่เกิน 10 วินาทีเสร็จ)
# วิธีใช้: sudo ./register_runner.sh [ใส่_TOKEN_ตรงนี้]
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "ข้อผิดพลาด: กรุณารันด้วยสิทธิ์ root (เช่น sudo ./register_runner.sh [TOKEN])"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "คำแนะนำ: บนหน้าเว็บ GitLab (Settings -> CI/CD -> Runners) กด New project runner และอย่าลืมติ๊กถูก [x] 'Run untagged jobs'"
  read -p "ใส่ Runner Token (glrt-...): " TOKEN
fi

if [ -z "$TOKEN" ]; then
  echo "ข้อผิดพลาด: ต้องระบุ Runner Token ก่อน!"
  exit 1
fi

START_TIME=$(date +%s)
echo "==> กำลังผูกตัวรันงาน (GitLab Runner) ด้วย Token: $TOKEN"

# 1. ปลุกให้ตัวรันงาน (gitlab-runner) ตื่นขึ้นมาพร้อมทำงานก่อน
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d gitlab-runner &>/dev/null || true

# 2. ลบของเก่าที่พังทิ้งไปก่อน ป้องกันของเก่ามาตีกับของใหม่
docker exec -i gitlab-runner rm -f /etc/gitlab-runner/config.toml &>/dev/null || true
rm -f "$SCRIPT_DIR/runner/config.toml" &>/dev/null || true

# 3. เช็คชื่อวงเน็ตเวิร์กที่เชื่อมต่อกันอยู่
NETWORK_NAME=$(docker inspect gitlab-runner --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
[ -z "$NETWORK_NAME" ] && NETWORK_NAME="$(basename "$SCRIPT_DIR")_default"
[ -z "$NETWORK_NAME" ] && NETWORK_NAME="devops-tnk_default"

# 4. สั่งต่อตรงเข้าหา GitLab ข้างในเครื่องเลย (ห้ามใส่ 127.0.0.1 หรือ 8080 เพราะมันจะหากันไม่เจอ)
echo "[*] เชื่อมต่อ Runner หา GitLab ผ่าน http://gitlab/ บนเน็ตเวิร์ก: $NETWORK_NAME ..."
docker exec -i gitlab-runner gitlab-runner register \
  --non-interactive \
  --url "http://gitlab/" \
  --token "$TOKEN" \
  --executor "docker" \
  --docker-image "docker:latest" \
  --docker-privileged \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock" \
  --docker-volumes "/cache" \
  --docker-network-mode "$NETWORK_NAME" \
  --docker-pull-policy "if-not-present" \
  --clone-url "http://gitlab/" \
  --description "docker-runner"

if [ $? -ne 0 ]; then
  echo "ข้อผิดพลาด: เชื่อมต่อ Runner กับ GitLab ไม่สำเร็จ กรุณาเช็คว่า Token ถูกต้องและคอนเทนเนอร์ GitLab เปิดอยู่ครบถ้วน"
  exit 1
fi

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
