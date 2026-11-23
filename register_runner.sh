#!/bin/bash
# ==============================================================================
# Script: register_runner.sh
# Purpose: Fast & Reliable GitLab Runner Registration (< 10 seconds)
# Usage: sudo ./register_runner.sh [glrt-TOKEN]
# ==============================================================================

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo ./register_runner.sh [TOKEN])"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Tip: On GitLab Web UI (Settings -> CI/CD -> Runners), create a new runner and check [x] 'Run untagged jobs'"
  read -p "Runner Token (glrt-...): " TOKEN
fi

if [ -z "$TOKEN" ]; then
  echo "Error: Runner Token is required!"
  exit 1
fi

START_TIME=$(date +%s)
echo "==> Registering GitLab Runner with token: $TOKEN"

# 1. Ensure gitlab-runner container is running
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d gitlab-runner &>/dev/null || true

# 2. Clean old runner config to prevent duplicate / dead runners
docker exec -i gitlab-runner rm -f /etc/gitlab-runner/config.toml &>/dev/null || true
rm -f "$SCRIPT_DIR/runner/config.toml" &>/dev/null || true

# 3. Detect docker network name
NETWORK_NAME=$(docker inspect gitlab-runner --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
[ -z "$NETWORK_NAME" ] && NETWORK_NAME="$(basename "$SCRIPT_DIR")_default"
[ -z "$NETWORK_NAME" ] && NETWORK_NAME="devops-tnk_default"

echo "[*] Connecting runner to GitLab via http://gitlab/ on network: $NETWORK_NAME ..."
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
  echo "Error: Failed to register runner with GitLab. Please check if token is valid and GitLab container is healthy."
  exit 1
fi

echo "[*] Activating runner & configuring organization and untagged jobs in database..."
docker exec -i gitlab gitlab-psql -c "UPDATE ci_runners SET organization_id = 1, active = true, run_untagged = true WHERE organization_id IS NULL OR run_untagged = false OR active = false;" &>/dev/null || true

echo "[*] Restarting gitlab-runner service..."
docker restart gitlab-runner &>/dev/null || true

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "==> [✓] GitLab Runner successfully registered and online in ${ELAPSED} seconds!"

echo "==> Verifying runner status..."
docker exec gitlab-runner gitlab-runner verify
