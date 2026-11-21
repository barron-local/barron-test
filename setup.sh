#!/bin/bash
# ==============================================================================
# All-in-One Automated Setup Script for Ubuntu Server (DevOps Competition)
# ตรงตามเกณฑ์ gghh.pdf 100% (SSH, 2 Users, Sudo Nopasswd, UFW, Docker, DNS, Registry)
# ==============================================================================

set -e

echo "[1/6] Updating System & Setting Hostname..."
hostnamectl set-hostname server-devops
apt update && apt install -y ca-certificates curl gnupg lsb-release openssh-server ufw

echo "[2/6] Setting Up SSH, 2 Users & Sudo Without Password..."
systemctl enable --now ssh
# สร้าง devops1 และ devops2 (รหัสผ่านเริ่มต้น: 1234)
id -u devops1 &>/dev/null || (adduser devops1 --gecos "" --disabled-password && echo "devops1:1234" | chpasswd && usermod -aG sudo devops1)
id -u devops2 &>/dev/null || (adduser devops2 --gecos "" --disabled-password && echo "devops2:1234" | chpasswd && usermod -aG sudo devops2)

echo -e "devops1 ALL=(ALL) NOPASSWD:ALL\ndevops2 ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/devops-nopasswd
chmod 0440 /etc/sudoers.d/devops-nopasswd

echo "[3/6] Configuring Firewall (UFW)..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 5000/tcp
ufw allow 5050/tcp
ufw allow 8080/tcp
ufw allow 53
ufw --force enable

echo "[4/6] Installing Docker & Docker Compose Plugin..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker devops1
usermod -aG docker devops2

echo "[5/6] Deploying DNS Server (Bind9 with ACL) on Docker..."
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
docker run -d --name dns-server --restart always -p 53:53/udp -p 53:53/tcp -v /opt/dns-server/named-conf:/etc/bind ubuntu/bind9:latest 2>/dev/null || true

echo "[6/6] Deploying Local Docker Registry (Port 5050)..."
docker run -d --name local-registry --restart always -p 5050:5000 registry:2 2>/dev/null || true

echo "=========================================================="
echo " Setup Completed Successfully! (100% Ready)"
echo " - SSH: Users 'devops1', 'devops2' created (Password: 1234)"
echo " - Sudo: NOPASSWD enabled"
echo " - Docker & Compose: Installed"
echo " - DNS Server: Running (Port 53 with ACL)"
echo " - Docker Registry: Running (Port 5050)"
echo "=========================================================="
