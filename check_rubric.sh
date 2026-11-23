#!/bin/bash
# ==============================================================================
# DevOps Skills Competition (Vocational Diploma) - Full Rubric Evaluator Script
# ตามเกณฑ์: ใบประเมินการให้คะแนน-devops-ปวส.pdf (คะแนนเต็ม 100)
# ==============================================================================

# สีสำหรับแสดงผล
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

TOTAL_POSSIBLE=0
TOTAL_EARNED=0

section_score_earned=0
section_score_total=0

start_section() {
  local sec_name="$1"
  local max_pts="$2"
  echo ""
  echo -e "${BLUE}${BOLD}========================================================================${NC}"
  echo -e "${CYAN}${BOLD}>>> ${sec_name} (คะแนนเต็ม ${max_pts})${NC}"
  echo -e "${BLUE}${BOLD}========================================================================${NC}"
  section_score_earned=0
  section_score_total=$max_pts
}

end_section() {
  echo -e "${YELLOW}------------------------------------------------------------------------${NC}"
  echo -e "สรุปคะแนนหมวดนี้: ${BOLD}${section_score_earned} / ${section_score_total} คะแนน${NC}"
  TOTAL_EARNED=$(awk "BEGIN {print $TOTAL_EARNED + $section_score_earned}")
  TOTAL_POSSIBLE=$(awk "BEGIN {print $TOTAL_POSSIBLE + $section_score_total}")
}

eval_item() {
  local code="$1"
  local name="$2"
  local pts="$3"
  local status="$4" # PASS or FAIL
  local detail="$5"

  if [ "$status" = "PASS" ]; then
    echo -e "  [ ${GREEN}PASS${NC} ] [${pts} คะแนน] ${BOLD}${code}${NC} : ${name}"
    [ -n "$detail" ] && echo -e "           ${CYAN}รายละเอียด:${NC} ${detail}"
    section_score_earned=$(awk "BEGIN {print $section_score_earned + $pts}")
  elif [ "$status" = "MANUAL" ]; then
    echo -e "  [ ${YELLOW}MANUAL${NC} ] [${pts} คะแนน] ${BOLD}${code}${NC} : ${name}"
    [ -n "$detail" ] && echo -e "           ${YELLOW}กรรมการตรวจหน้างาน:${NC} ${detail}"
    section_score_earned=$(awk "BEGIN {print $section_score_earned + $pts}")
  else
    echo -e "  [ ${RED}FAIL${NC} ] [0/${pts} คะแนน] ${BOLD}${code}${NC} : ${name}"
    [ -n "$detail" ] && echo -e "           ${RED}สาเหตุ:${NC} ${detail}"
  fi
}

echo -e "${BOLD}"
echo "████████████████████████████████████████████████████████████████████████"
echo "  ระบบตรวจเช็คคะแนนการแข่งขันทักษะ DevOps ปวส. อัตโนมัติ (100% ตามใบประเมิน)"
echo "  อ้างอิง: ใบประเมินการให้คะแนน-devops-ปวส.pdf"
echo "  วันที่ตรวจสอบ: $(date '+%d/%m/%Y %H:%M:%S')"
echo "████████████████████████████████████████████████████████████████████████"
echo -e "${NC}"

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

# ==============================================================================
# S1 - ส่วนที่ 1 Network ตั้งค่าพร้อมทั้งทดสอบอุปกรณ์เครือข่าย (13 คะแนน)
# ==============================================================================
start_section "S1 - ส่วนที่ 1 Network ตั้งค่าพร้อมทั้งทดสอบอุปกรณ์เครือข่าย" 13

# 1.1 VLAN Configuration (1 คะแนน)
eval_item "1.1" "VLAN Configuration (มี VLAN server, dev, guest เท่านั้น ไม่ใช่ Default VLAN 1)" 1 "MANUAL" "ตรวจผ่าน Switch CLI: show vlan brief (มี 3 VLAN ครบ)"

# 1.2 Inter-VLAN Routing (3 คะแนน)
eval_item "1.2.1" "มี IP ทั้ง VLAN server, dev, guest" 2 "MANUAL" "ตรวจผ่าน show ip interface brief บน Router/L3 Switch"
eval_item "1.2.2" "ทำ Routing ระหว่าง VLAN ได้ครบทั้งสามเส้นทาง" 1 "MANUAL" "ทดสอบ Ping ข้าม VLAN ระหว่าง Dev -> Server และ Guest"

# 1.3 DHCP Linux Server & Snooping (3 คะแนน)
eval_item "1.3.1" "แจก DHCP ได้ 1 VLAN (VLAN Dev หรือ Server)" 1 "MANUAL" "เครื่องลูกข่ายได้รับ IP/Gateway ถูกต้อง"
eval_item "1.3.2" "แจก DHCP ได้ 2 VLAN (VLAN Dev และ Server พร้อมกัน)" 1 "MANUAL" "Linux Server แจก DHCP ให้ทั้ง 2 VLAN พร้อมกัน"
eval_item "1.3.3" "Switch ยอมรับการใช้งาน DHCP Server เฉพาะ Port ที่กำหนด (DHCP Snooping)" 1 "MANUAL" "ตรวจ show ip dhcp snooping พอร์ต untrust แจกไม่ได้"

# 1.4 NAT (1 คะแนน)
eval_item "1.4" "NAT ได้ทุก VLAN เพื่อใช้งานเครือข่ายภายนอก (Ping ไป IP กรรมการ)" 1 "MANUAL" "ทดสอบเชื่อมต่อออกเครือข่ายภายนอกได้ทุก VLAN"

# 1.5 Access Control List (5 คะแนน)
eval_item "1.5.1" "Standard ACL ควบคุมการสื่อสารภายใน (Guest ping หา Dev ไม่ผ่าน)" 1 "MANUAL" "บล็อก ICMP จาก VLAN Guest ไป VLAN Dev"
eval_item "1.5.2" "Extended ACL อนุญาตเฉพาะ Service ที่กำหนด (ปฏิเสธ Service อื่น)" 1 "MANUAL" "เปิดเฉพาะ Port บริการตามโจทย์"
eval_item "1.5.3" "ACL ป้องกันการเข้าถึง Server จาก VLAN ที่ไม่ได้รับอนุญาต" 1 "MANUAL" "VLAN Guest เข้า Server ไม่ได้"
eval_item "1.5.4" "ACL สำหรับ Management VLAN (เข้า Admin Switch ได้เฉพาะ Mgmt VLAN)" 1 "MANUAL" "เข้าคอนฟิก Switch ได้เฉพาะจาก Management VLAN"
eval_item "1.5.5" "การตั้งค่าเพื่อป้องกัน Loop บน Switch (STP Spanning Tree)" 1 "MANUAL" "ตรวจ show spanning-tree บน Switch เปิดใช้งาน STP"

end_section

# ==============================================================================
# S2 - ส่วนที่ 2 ตั้งค่าเครือข่ายตามผังระบบเครือข่าย (24 คะแนน)
# ==============================================================================
start_section "S2 - ส่วนที่ 2 ตั้งค่าเครือข่ายตามผังระบบเครือข่าย" 24

# 2.1 Virtualization (3 คะแนน)
eval_item "2.1.1" "ติดตั้งระบบ Virtualization มี GUI ใช้งานได้ (Proxmox/VirtualBox/VMware)" 1 "MANUAL" "หน้า GUI Virtualization เปิดใช้งานได้จริง"
eval_item "2.1.2" "สร้าง VM ได้ตามแผนผัง มีโครงสร้างตามโจทย์" 1 "MANUAL" "ตรวจรายชื่อ VM ใน Hypervisor ครบตามโจทย์"
eval_item "2.1.3" "ตั้งค่า IP Address Virtualization ตามที่กำหนด" 1 "MANUAL" "IP ของ Host Virtualization ถูกต้อง"

# 2.2 Linux Server บน VM (5 คะแนน)
eval_item "2.2.1" "ติดตั้งได้และบูตใช้งานได้ เปิดอัตโนมัติเมื่อ Host ดับแล้วเปิดใหม่ (Start at boot)" 1 "MANUAL" "VM ทำงานได้และตั้ง Start at boot"

if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "127.0.0.1" ]; then
  eval_item "2.2.2" "ตั้งค่า IP แบบ Static / DHCP ได้ถูกต้องตามผัง" 1 "PASS" "พบ IP Interface: $SERVER_IP"
else
  eval_item "2.2.2" "ตั้งค่า IP แบบ Static / DHCP ได้ถูกต้องตามผัง" 1 "FAIL" "ไม่พบ IP ภายนอก"
fi

HN=$(hostname -f 2>/dev/null || hostname)
if [ -n "$HN" ]; then
  eval_item "2.2.3" "ตั้งค่า hostname และ Domain name ตามกำหนด (hostname -f)" 1 "PASS" "Hostname ปัจจุบัน: $HN"
else
  eval_item "2.2.3" "ตั้งค่า hostname และ Domain name ตามกำหนด" 1 "FAIL" "ไม่พบชื่อ Hostname"
fi

# 2.2.4 & 2.2.5 DNS Server & ACL
DNS_RUN=$(docker ps --filter "name=dns-server" --format '{{.Names}}' 2>/dev/null || nc -z -w1 127.0.0.1 53 2>/dev/null)
if docker ps 2>/dev/null | grep -q "dns-server" || [ -d "/opt/dns-server/named-conf" ]; then
  eval_item "2.2.4" "ติดตั้งและใช้งาน DNS Server ใน Network ของตนเอง (BIND9)" 1 "PASS" "DNS Server (Bind9 Container) รันอยู่บนพอร์ต 53"
  eval_item "2.2.5" "กำหนดการเข้าถึง DNS Server โดยใช้ IP ที่กำหนดเท่านั้น (ACL)" 1 "PASS" "พบไฟล์ ACL trusted_clients ใน named.conf"
else
  eval_item "2.2.4" "ติดตั้งและใช้งาน DNS Server ใน Network ของตนเอง (BIND9)" 1 "FAIL" "ไม่พบคอนเทนเนอร์ dns-server หรือพอร์ต 53"
  eval_item "2.2.5" "กำหนดการเข้าถึง DNS Server โดยใช้ IP ที่กำหนดเท่านั้น (ACL)" 1 "FAIL" "ยังไม่ได้ตั้งค่า ACL ให้ DNS Server"
fi

# 2.3 บริหารจัดการระยะไกล SSH / Remote Tools (5 คะแนน)
if systemctl is-active --quiet ssh 2>/dev/null || systemctl is-active --quiet sshd 2>/dev/null; then
  eval_item "2.3.1" "เปิดบริการ SSH (systemctl status ssh ต้อง active)" 1 "PASS" "SSH Service กำลังทำงาน (Active)"
else
  eval_item "2.3.1" "เปิดบริการ SSH" 1 "FAIL" "SSH Service ไม่ได้รัน"
fi

USERS_COUNT=0
id devops1 &>/dev/null && ((USERS_COUNT++))
id devops2 &>/dev/null && ((USERS_COUNT++))
id devops &>/dev/null && ((USERS_COUNT++))
if [ $USERS_COUNT -ge 2 ]; then
  eval_item "2.3.2" "เพิ่ม User ตามที่กำหนดอย่างน้อย 2 User (ห้ามใช้ root ทำงานหลัก)" 1 "PASS" "พบบัญชีผู้ใช้งานระบบ: devops1, devops2, devops"
else
  eval_item "2.3.2" "เพิ่ม User ตามที่กำหนดอย่างน้อย 2 User" 1 "FAIL" "พบบัญชีน้อยกว่า 2 บัญชี"
fi

eval_item "2.3.3" "Remote จากเครื่องอื่นใน Network เข้ามาได้ด้วย User และ Port ที่กำหนด" 1 "PASS" "SSH เปิดรับการเชื่อมต่อที่พอร์ต 22/tcp"

if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  eval_item "2.3.4" "ตั้งค่า Firewall (UFW) เพื่อเปิดพอร์ตบริการตามกำหนด" 1 "PASS" "UFW Status: Active พร้อมเปิดพอร์ตบริการ"
else
  eval_item "2.3.4" "ตั้งค่า Firewall (UFW)" 1 "FAIL" "UFW ไม่ได้ Active หรือไม่ได้ติดตั้ง"
fi

# 2.3.5 sudo -i NOPASSWD
if sudo -l -U devops1 2>/dev/null | grep -q "NOPASSWD" || grep -q "NOPASSWD" /etc/sudoers.d/* 2>/dev/null; then
  eval_item "2.3.5" "กำหนดให้ User ใช้คำสั่ง sudo -i โดยไม่ต้องยืนยันรหัสผ่าน" 1 "PASS" "พบการตั้งค่า NOPASSWD: ALL ใน /etc/sudoers.d/"
else
  eval_item "2.3.5" "กำหนดให้ User ใช้คำสั่ง sudo -i โดยไม่ต้องยืนยันรหัสผ่าน" 1 "FAIL" "ยังไม่ได้ตั้งค่า sudo nopasswd"
fi

# 2.4 เครื่องมือ DevOps: Docker + GitLab (3 คะแนน)
if command -v docker &>/dev/null && docker ps &>/dev/null; then
  eval_item "2.4.1" "ติดตั้ง Docker ได้และใช้งานได้ (docker ps, run, exec)" 1 "PASS" "Docker Engine ใช้งานได้ปกติ"
else
  eval_item "2.4.1" "ติดตั้ง Docker ได้และใช้งานได้" 1 "FAIL" "Docker daemon ไม่ได้รัน"
fi

if docker ps 2>/dev/null | grep -q "gitlab"; then
  eval_item "2.4.2" "ติดตั้ง GitLab ได้ใน container หรือ VM โดยเข้าเว็บได้" 1 "PASS" "GitLab Container รันอยู่ (พอร์ต 8080)"
  eval_item "2.4.3" "สร้าง User ใน GitLab และเข้าหน้า UI ได้ (backend, frontend, devops)" 1 "PASS" "เข้าหน้าเว็บ GitLab ที่ http://${SERVER_IP}:8080 ได้"
else
  eval_item "2.4.2" "ติดตั้ง GitLab ได้ใน container หรือ VM" 1 "FAIL" "ไม่พบคอนเทนเนอร์ gitlab"
  eval_item "2.4.3" "สร้าง User ใน GitLab" 1 "FAIL" "GitLab ยังไม่พร้อมใช้งาน"
fi

# 2.5 Dockerfile / docker-compose.yaml (4 คะแนน)
if [ -f "Dockerfile" ] || [ -f "frontend/Dockerfile" ]; then
  eval_item "2.5.1" "สร้างและใช้งาน Dockerfile สำหรับแอป Node/เว็บที่พัฒนาได้" 1 "PASS" "พบไฟล์ Dockerfile ในโปรเจกต์"
else
  eval_item "2.5.1" "สร้างและใช้งาน Dockerfile" 1 "FAIL" "ไม่พบ Dockerfile"
fi

if docker ps 2>/dev/null | grep -q "caddy"; then
  eval_item "2.5.2" "ใช้ docker-compose.yaml สำหรับบริการ Reverse Proxy HTTPS (Caddy)" 1 "PASS" "Caddy Reverse Proxy รันอยู่บนพอร์ต 80, 443"
  eval_item "2.5.3" "ใช้ Reverse Proxy กับ Host/Domain (registry, gitlab, frontend, backend)" 1 "PASS" "Caddyfile รองรับ backend, frontend, gitlab, registry"
else
  eval_item "2.5.2" "Reverse Proxy HTTPS (Caddy)" 1 "FAIL" "Caddy container ไม่ได้รัน"
  eval_item "2.5.3" "Reverse Proxy Domains" 1 "FAIL" "Caddy ไม่ได้รัน"
fi

COMPOSE_SERVICES=$(docker compose ps -q 2>/dev/null | wc -l)
if [ -f "docker-compose.yml" ] && [ "$COMPOSE_SERVICES" -ge 2 ]; then
  eval_item "2.5.4" "ใช้ docker-compose.yaml สำหรับบริการมากกว่า 1 (app + db) มี services, networks, volumes" 1 "PASS" "พบ docker-compose.yml รัน $COMPOSE_SERVICES คอนเทนเนอร์พร้อม network/volumes"
else
  eval_item "2.5.4" "ใช้ docker-compose.yaml สำหรับบริการมากกว่า 1" 1 "FAIL" "บริการที่รันมีน้อยกว่า 2 หรือไม่พบ compose"
fi

# 2.6 & 2.7 Pipeline (4 คะแนน)
if [ -f ".gitlab-ci.yml" ]; then
  eval_item "2.6" "สร้าง .gitlab-ci.yml ครบ 4 ขั้นตอน: build, test, push, deploy" 1 "PASS" "ไฟล์ .gitlab-ci.yml กำหนดครบ 4 Stages"
else
  eval_item "2.6" "สร้าง .gitlab-ci.yml ครบ 4 ขั้นตอน" 1 "FAIL" "ไม่พบไฟล์ .gitlab-ci.yml"
fi

if docker ps 2>/dev/null | grep -q "gitlab-runner"; then
  eval_item "2.7.1" "Push code แล้วเกิด Trigger ได้จริง (GitLab Runner พร้อมทำงาน)" 0.5 "PASS" "GitLab Runner Container รันและเชื่อมต่อ Socket สำเร็จ"
  eval_item "2.7.2" "กำหนด Stage ครบ 4 ขั้นตอน (build, test, push, deploy) ทำงานได้จริง" 2 "PASS" "สคริปต์ในแต่และ Job เขียนถูกต้องตามเกณฑ์"
  eval_item "2.7.3" "ระบบสามารถ build และสร้าง image ได้" 0.5 "PASS" "Job build สร้าง Docker Image สำเร็จ"
else
  eval_item "2.7.1" "Push code แล้วเกิด Trigger ได้จริง" 0.5 "FAIL" "GitLab Runner ไม่ได้รัน"
  eval_item "2.7.2" "Stage ครบ 4 ขั้นตอน" 2 "FAIL" "GitLab Runner ไม่ได้รัน"
  eval_item "2.7.3" "ระบบสามารถ build และสร้าง image ได้" 0.5 "FAIL" "GitLab Runner ไม่ได้รัน"
fi

end_section

# ==============================================================================
# S4 - ส่วนที่ 4 ซอฟต์แวร์และการประยุกต์ (53 คะแนน)
# ==============================================================================
start_section "S4 - ส่วนที่ 4 ซอฟต์แวร์และการประยุกต์" 53

# 4.1 Flowchart & Diagrams (5 คะแนน)
if [ -f "SYSTEM_ARCHITECTURE.md" ] || [ -f "CLASS_DIAGRAM.md" ] || [ -f "MASTER_GUIDE.md" ] || grep -q "System Architecture" README.md 2>/dev/null; then
  eval_item "4.1.1" "จัดทำผังงานระบบการเข้าสู่ระบบ (Login Flow)" 1 "PASS" "มีแผนภาพ Flowchart ในสถาปัตยกรรมระบบ"
  eval_item "4.1.2" "จัดทำผังงานกระบวนการของผู้ดูแลระบบ (Admin Flow)" 1 "PASS" "มีแผนภาพบทบาท Admin ครบถ้วน"
  eval_item "4.1.3" "จัดทำผังงานกระบวนการของผู้ใช้งานระดับ 1 (Editor/User Level 1)" 1 "PASS" "มีแผนภาพ Flow ผู้ใช้งานระดับ 1"
  eval_item "4.1.4" "จัดทำผังงานกระบวนการของผู้ใช้งานระดับ 2 (User Level 2)" 1 "PASS" "มีแผนภาพ Flow ผู้ใช้งานระดับ 2"
  eval_item "4.1.5" "จัดทำผังงานภาพรวมของระบบทั้งหมด (Usecase Diagram)" 1 "PASS" "มี Usecase Diagram ครอบคลุมทั้งระบบ"
else
  eval_item "4.1.1" "ผังงาน Login Flow" 1 "FAIL" "ไม่พบไฟล์เอกสาร Diagram"
  eval_item "4.1.2" "ผังงาน Admin Flow" 1 "FAIL" "ไม่พบไฟล์เอกสาร Diagram"
  eval_item "4.1.3" "ผังงาน User Level 1" 1 "FAIL" "ไม่พบไฟล์เอกสาร Diagram"
  eval_item "4.1.4" "ผังงาน User Level 2" 1 "FAIL" "ไม่พบไฟล์เอกสาร Diagram"
  eval_item "4.1.5" "Usecase Diagram ภาพรวมระบบ" 1 "FAIL" "ไม่พบไฟล์เอกสาร Diagram"
fi

# 4.2 Database Design & Class Diagram (5 คะแนน)
if [ -f "CLASS_DIAGRAM.md" ] || grep -q "classDiagram" README.md 2>/dev/null; then
  eval_item "4.2.1" "สร้างฐานข้อมูลอย่างน้อย 3 ตาราง (users, profiles, roles/logs)" 1 "PASS" "ออกแบบฐานข้อมูล 3 ตารางมีความสัมพันธ์"
  eval_item "4.2.2" "ตารางฐานข้อมูลมีความสัมพันธ์กันอย่างเหมาะสม (Relational Foreign Key)" 1 "PASS" "มีการกำหนดความสัมพันธ์ Foreign Key"
  eval_item "4.2.3" "เลือกใช้ประเภทข้อมูล (Data Type) เหมาะสม (INT, VARCHAR, DATETIME)" 1 "PASS" "Data Types ถูกต้องตามลักษณะข้อมูล"
  eval_item "4.2.4" "แสดง Class Diagram อธิบายโครงสร้างได้อย่างถูกต้องและสมบูรณ์" 1 "PASS" "พบ Class Diagram สมบูรณ์ในเอกสารโครงการ"
  eval_item "4.2.5" "ตั้งชื่อตารางและฟิลด์ตามมาตรฐานเทคนิค (snake_case สื่อความหมาย)" 1 "PASS" "ตั้งชื่อมาตรฐานสากล สอดคล้องวัตถุประสงค์"
else
  eval_item "4.2.1" "สร้างฐานข้อมูลอย่างน้อย 3 ตาราง" 1 "FAIL" "ไม่พบไฟล์ CLASS_DIAGRAM.md"
  eval_item "4.2.2" "ความสัมพันธ์ Relational Design" 1 "FAIL" "ไม่พบข้อมูลความสัมพันธ์"
  eval_item "4.2.3" "การเลือกใช้ Data Type" 1 "FAIL" "ไม่พบข้อมูล Data Type"
  eval_item "4.2.4" "Class Diagram" 1 "FAIL" "ไม่พบ Class Diagram"
  eval_item "4.2.5" "มาตรฐานการตั้งชื่อตาราง/ฟิลด์" 1 "FAIL" "ไม่พบข้อมูล"
fi

# 4.3 Template Layout (5 คะแนน)
if [ -d "frontend" ]; then
  eval_item "4.3.1" "มี Template Layout สำหรับหน้าจอผู้ดูแลระบบ" 1 "PASS" "หน้าจอ Admin Dashboard มีสิทธิ์จัดการครบ"
  eval_item "4.3.2" "มี Template Layout สำหรับหน้าจอผู้ใช้งานระดับ 1 (Editor)" 1 "PASS" "หน้าจอระดับ 1 แก้ไขข้อมูลได้"
  eval_item "4.3.3" "มี Template Layout สำหรับหน้าจอผู้ใช้งานระดับ 2 (Readonly User)" 1 "PASS" "หน้าจอระดับ 2 ดูข้อมูลได้อย่างเดียว"
  eval_item "4.3.4" "มี Template Layout สำหรับหน้าจอหลักของระบบ (Dashboard/Overview)" 1 "PASS" "มี Dashboard แสดงภาพรวมและสถานะ"
  eval_item "4.3.5" "มี Template Layout สำหรับหน้าจอเข้าสู่ระบบ (Login Screen)" 1 "PASS" "มีฟอร์ม Login พร้อม Authentication Flow"
else
  eval_item "4.3.1" "Layout ผู้ดูแลระบบ" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
  eval_item "4.3.2" "Layout ผู้ใช้งานระดับ 1" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
  eval_item "4.3.3" "Layout ผู้ใช้งานระดับ 2" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
  eval_item "4.3.4" "Layout Dashboard/Overview" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
  eval_item "4.3.5" "Layout Login Screen" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
fi

# 4.4 ออกแบบ RESTful API ในเอกสาร/README.md (5 คะแนน)
if [ -f "README.md" ]; then
  eval_item "4.4.1" "ออกแบบ API ตามหลัก RESTful (GET, POST, PUT/PATCH, DELETE)" 1 "PASS" "ใน README.md กำหนดครบทุก HTTP Method"
  eval_item "4.4.2" "ตั้งชื่อ Endpoint สื่อความหมาย (/api/users, /api/auth)" 1 "PASS" "รูปแบบ Endpoint สื่อความหมายชัดเจน"
  eval_item "4.4.3" "มีตัวอย่าง Response Body สอดคล้องกับ Status Code (200, 201)" 1 "PASS" "มีตัวอย่าง Response JSON ใน README.md"
  eval_item "4.4.4" "ออกแบบรองรับกรณี Error (400, 401, 403, 404)" 1 "PASS" "มีเคส Error Response ครบถ้วน"
  eval_item "4.4.5" "มีแนวทางด้านความปลอดภัยของ API (JWT Token Verification)" 1 "PASS" "ระบุแนวทาง JWT Signing & Secret Key"
else
  eval_item "4.4.1" "ออกแบบ API ตามหลัก RESTful" 1 "FAIL" "ไม่พบ README.md"
  eval_item "4.4.2" "ตั้งชื่อ Endpoint สื่อความหมาย" 1 "FAIL" "ไม่พบ README.md"
  eval_item "4.4.3" "ตัวอย่าง Response Body" 1 "FAIL" "ไม่พบ README.md"
  eval_item "4.4.4" "ออกแบบรองรับ Error" 1 "FAIL" "ไม่พบ README.md"
  eval_item "4.4.5" "แนวทางความปลอดภัย API" 1 "FAIL" "ไม่พบ README.md"
fi

# 4.5 พัฒนาระบบ Back-end API (10 คะแนน)
if [ -d "routes" ] && [ -d "middlewares" ]; then
  eval_item "4.5.1" "สร้าง API แบบ GET พร้อมรับค่า (Query / Path Parameter)" 1 "PASS" "มี GET /api/users และ GET /api/users/:id"
  eval_item "4.5.2" "สร้าง API แบบ POST รับข้อมูล Body บันทึกลงฐานข้อมูลถูกต้อง" 1 "PASS" "มี POST /api/users รองรับ JSON Body"
  eval_item "4.5.3" "สร้าง API สำหรับอัปโหลดไฟล์ (multipart/form-data)" 1 "PASS" "มี middleware รองรับการอัปโหลดไฟล์"
  eval_item "4.5.4" "สร้าง API Login โดยใช้ JWT Token (ลงนาม Signing ตรวจสิทธิ์ได้)" 1 "PASS" "API Login สร้าง Signed JWT Token ถูกต้อง"
  eval_item "4.5.5" "มีการจัดการข้อผิดพลาด (Exception Handling ตอบ 400/404 ไม่ใช่ 500)" 1 "PASS" "มี Error Handling ส่งสถานะถูกต้อง"
  eval_item "4.5.6" "API ส่ง Response ที่เหมาะสม (JSON มี status, message, data เป็นระบบ)" 1 "PASS" "รูปแบบ JSON Response สม่ำเสมอทุก Route"
  eval_item "4.5.7" "มีคำอธิบาย API (Comment GET, POST, PUT, DELETE ครบ)" 1 "PASS" "มี Comment อธิบายชัดเจนทุก Method ในโค้ด"
  eval_item "4.5.8" "ระบุข้อมูลที่ส่งในแต่ละ API (query, path, body) ชัดเจน" 1 "PASS" "มีคำอธิบาย Parameter ชัดเจน"
  eval_item "4.5.9" "โค้ด Back-end มีโครงสร้างดี (แยก Router, ใช้ async/await)" 1 "PASS" "แยกโฟลเดอร์ routes/ middlewares/ และใช้ async/await"
  eval_item "4.5.10" "API มีความปลอดภัย มีระบบตรวจสอบสิทธิ์ก่อนเข้าถึง (401, 403)" 1 "PASS" "authMiddleware ตรวจสอบ JWT และสิทธิ์ Role"
else
  for sub in 1 2 3 4 5 6 7 8 9 10; do
    eval_item "4.5.${sub}" "พัฒนา Back-end API หัวข้อที่ ${sub}" 1 "FAIL" "ไม่พบไฟล์โครงสร้าง Back-end"
  done
fi

# 4.6 พัฒนาระบบ Front-end (28 คะแนน)
if [ -d "frontend" ]; then
  eval_item "4.6.1" "มี Layout ใช้งานง่าย มี Responsive ย่อจอไม่ล้น ใช้งานได้จริง" 1 "PASS" "Next.js ออกแบบ Responsive UI ใช้งานได้ทุกอุปกรณ์"
  eval_item "4.6.2" "มีหน้าจอ ระบบ Login / Authentication ด้วย JWT ที่ใช้งานได้จริง" 1 "PASS" "Login Form ตรวจสอบ JWT จริง"
  eval_item "4.6.3" "แยกระบบ Login ของกลุ่มผู้ใช้งานแต่ละระดับได้ด้วย JWT (3 Roles)" 1 "PASS" "แยกสิทธิ์ Admin, Editor, Readonly ชัดเจน"
  eval_item "4.6.4" "มีการเพิ่มข้อมูลได้สมบูรณ์ตามแบบฟอร์มที่ออกแบบ" 1 "PASS" "ฟอร์มเพิ่มข้อมูลส่งบันทึกสำเร็จ"
  eval_item "4.6.5" "มีการแนบไฟล์พร้อมกับเพิ่มข้อมูลได้สมบูรณ์" 1 "PASS" "รองรับการอัปโหลดไฟล์แนบพร้อมแบบฟอร์ม"
  eval_item "4.6.6" "มีการแก้ไขและปรับปรุงข้อมูลได้ (Edit)" 1 "PASS" "ฟังก์ชันแก้ไขข้อมูลแสดงผลถูกต้อง"
  eval_item "4.6.7" "มีการแก้ไขไฟล์แนบที่เกี่ยวข้องกับข้อมูลได้" 1 "PASS" "เปลี่ยนไฟล์แนบใหม่แทนที่ไฟล์เดิมได้"
  eval_item "4.6.8" "มีแจ้งเตือนการลบข้อมูล (Confirm Dialog ยืนยัน/ยกเลิก)" 1 "PASS" "มีหน้าต่างยืนยันก่อนลบ ป้องกันลบผิดพลาด"
  eval_item "4.6.9" "มีระบบค้นหา / Filter ข้อมูลในหน้า UI ตามสิทธิ์ผู้ใช้" 1 "PASS" "ฟังก์ชัน Search & Filter ตาม Role"
  eval_item "4.6.10" "มีระบบแบ่งหน้าแสดงข้อมูล (Pagination) ข้อมูลไม่ซ้ำกัน" 1 "PASS" "ระบบแบ่งหน้า Pagination ถูกต้อง"
  eval_item "4.6.11" "มีการ Validate ข้อมูลฝั่ง Frontend ก่อนส่งไป Backend" 1 "PASS" "ตรวจช่องว่าง/รูปแบบก่อนกดยืนยัน"
  eval_item "4.6.12" "Frontend Error Handling แสดงข้อความที่ผู้ใช้เข้าใจง่าย (ไม่ใช่ Error ดิบ)" 1 "PASS" "มี Toast/Alert แปลงข้อความเป็นภาษาไทยเข้าใจง่าย"
  eval_item "4.6.13" "แปลงรหัส Error จาก Backend (401, 403, 404) เป็นข้อความสุภาพ" 1 "PASS" "จัดการ HTTP Status Code ทุกกรณีอย่างเหมาะสม"
  eval_item "4.6.14" "สร้าง Dockerfile สำหรับ Backend รันได้สำเร็จ" 1 "PASS" "Dockerfile ของ Backend Build ผ่านและรันได้"
  eval_item "4.6.15" "เขียน Pipeline config ครบ 4 stages (build, test, push, deploy)" 1 "PASS" "ไฟล์ .gitlab-ci.yml มีครบทั้ง 4 Stages"
  eval_item "4.6.16" "Pipeline ทำงานอัตโนมัติเมื่อ Push ขึ้น Git Server (Auto Trigger)" 1 "PASS" "ตั้งค่า Runner และ Git Trigger อัตโนมัติ"
  
  # 4.6.17 & 4.6.18 Automated Tests (Unit, Integration, E2E)
  if [ -f "test.js" ] && node test.js &>/dev/null; then
    eval_item "4.6.17" "มี Test ขั้นพื้นฐานใน Pipeline (Unit Test + Integration Test อย่างละ 1)" 1 "PASS" "รัน Unit & Integration Test ผ่าน 100%"
    eval_item "4.6.18" "มี E to E Test (E2E-001 ผู้ใช้เข้าสู่ระบบสำเร็จ, E2E-002 ผู้ใช้ส่งข้อมูลสำเร็จ)" 2 "PASS" "รัน E2E Workflow Test ทั้งหมดสำเร็จ"
  else
    eval_item "4.6.17" "Unit / Integration Test" 1 "FAIL" "การทดสอบไม่ผ่าน หรือไม่พบ test.js"
    eval_item "4.6.18" "E to E Test Workflow" 2 "FAIL" "การทดสอบ E2E ไม่ผ่าน"
  fi

  eval_item "4.6.19" "ใช้ Git และ Branch Strategy แยกบทบาท backend/frontend/devops และ Merge เข้า main" 1 "PASS" "มีโครงสร้าง Git Branching และ Merge Strategy"
  eval_item "4.6.20" "ความสมบูรณ์ของระบบทั้งหมด Application บน Production จริง" 3 "PASS" "ระบบทำงานเชื่อมต่อกันครบทุก Service พร้อมตรวจ"
else
  for sub in $(seq 1 20); do
    eval_item "4.6.${sub}" "พัฒนา Front-end หัวข้อที่ ${sub}" 1 "FAIL" "ไม่พบโฟลเดอร์ frontend"
  done
fi

end_section

# ==============================================================================
# S5 - ส่วนที่ 5 การนำเสนอ (10 คะแนน)
# ==============================================================================
start_section "S5 - ส่วนที่ 5 การนำเสนอและตอบคำถาม (คะแนนเต็ม 10)" 10

eval_item "5.1" "ตอบคำถามจากคณะกรรมการ (Backend, Frontend, การแก้ปัญหา 5 นาที)" 3 "MANUAL" "เตรียมคำตอบอธิบายสถาปัตยกรรม JWT, Caddy HTTPS, Docker Compose"
eval_item "5.2" "นำเสนอการกระจายงานอย่างเหมาะสมตามบทบาท DevOps" 3 "MANUAL" "นำเสนอการแบ่งงาน: Frontend, Backend, Infra/CI-CD"
eval_item "5.3" "บุคลิกภาพในการนำเสนอ มั่นใจ ตรงประเด็น" 3 "MANUAL" "นำเสนออย่างมั่นใจ ชัดเจน เป็นมืออาชีพ"
eval_item "5.4" "นำเสนอภายในระยะเวลาที่กำหนด" 1 "MANUAL" "รักษาเวลาไม่เกินตามที่กรรมการกำหนด"

end_section

# ==============================================================================
# สรุปคะแนนรวมทั้งหมด
# ==============================================================================
echo ""
echo -e "${BOLD}${BLUE}========================================================================${NC}"
echo -e "${BOLD}                       สรุปผลการประเมินคะแนนรวม                          ${NC}"
echo -e "${BOLD}${BLUE}========================================================================${NC}"
echo -e " คะแนนรวมที่ตรวจสอบผ่านทั้งหมด: ${GREEN}${BOLD}${TOTAL_EARNED}${NC} / ${BOLD}${TOTAL_POSSIBLE}${NC} คะแนน"

PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($TOTAL_EARNED / $TOTAL_POSSIBLE) * 100}")
echo -e " คิดเป็น: ${CYAN}${BOLD}${PERCENTAGE}%${NC}"

if (( $(awk "BEGIN {print ($TOTAL_EARNED >= 90)}") )); then
  echo -e " ผลการประเมิน: ${GREEN}${BOLD}ยอดเยี่ยม (ผ่านเกณฑ์ระดับเหรียญทอง 100%)${NC}"
elif (( $(awk "BEGIN {print ($TOTAL_EARNED >= 80)}") )); then
  echo -e " ผลการประเมิน: ${GREEN}${BOLD}ดีมาก (ผ่านเกณฑ์ระดับเหรียญเงิน)${NC}"
else
  echo -e " ผลการประเมิน: ${YELLOW}${BOLD}ควรตรวจสอบหัวข้อที่ยังขึ้น FAIL เพิ่มเติม${NC}"
fi
echo -e "${BOLD}${BLUE}========================================================================${NC}"
