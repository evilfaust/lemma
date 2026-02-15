#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REMOTE_HOST="${REMOTE_HOST:-88.201.208.15}"
REMOTE_PORT="${REMOTE_PORT:-22222}"
REMOTE_USER="${REMOTE_USER:-faust}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/faust/apps/ege-deploy}"
PUBLIC_HOST="${PUBLIC_HOST:-oipav.ru}"

SKIP_BUILD=0
SYNC_PB_DATA=0
INSTALL_BACKEND_DEPS=0

usage() {
  cat <<EOF
Usage: ./deploy.sh [options]

Options:
  --host <host>                 Remote host (default: ${REMOTE_HOST})
  --port <port>                 Remote SSH port (default: ${REMOTE_PORT})
  --user <user>                 Remote user (default: ${REMOTE_USER})
  --key <path>                  SSH private key (default: ${SSH_KEY})
  --remote-app-dir <path>       Remote app dir (default: ${REMOTE_APP_DIR})
  --public-host <host>          Public host for HTTP health-check (default: ${PUBLIC_HOST})
  --skip-build                  Do not run local frontend build
  --sync-pb-data                Sync pocketbase/pb_data (careful with DB)
  --install-backend-deps        Run npm install --omit=dev on remote backend
  -h, --help                    Show this help
EOF
}

while (($#)); do
  case "$1" in
    --host)
      REMOTE_HOST="$2"
      shift 2
      ;;
    --port)
      REMOTE_PORT="$2"
      shift 2
      ;;
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --key)
      SSH_KEY="$2"
      shift 2
      ;;
    --remote-app-dir)
      REMOTE_APP_DIR="$2"
      shift 2
      ;;
    --public-host)
      PUBLIC_HOST="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --sync-pb-data)
      SYNC_PB_DATA=1
      shift
      ;;
    --install-backend-deps)
      INSTALL_BACKEND_DEPS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd ssh
require_cmd rsync
require_cmd npm

if [[ ! -f "${SSH_KEY}" ]]; then
  echo "SSH key not found: ${SSH_KEY}" >&2
  exit 1
fi

SSH_OPTS=(
  -p "${REMOTE_PORT}"
  -i "${SSH_KEY}"
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile="${HOME}/.ssh/known_hosts"
)

REMOTE="${REMOTE_USER}@${REMOTE_HOST}"

echo "[1/5] Checking SSH access to ${REMOTE}:${REMOTE_PORT}"
ssh "${SSH_OPTS[@]}" "${REMOTE}" "echo connected: \$(hostname)"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  echo "[2/5] Building frontend locally"
  npm --prefix "${SCRIPT_DIR}/ege-tasks" run build
else
  echo "[2/5] Skipping local build (--skip-build)"
fi

echo "[3/5] Syncing frontend dist"
rsync -az --delete \
  -e "ssh -p ${REMOTE_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${HOME}/.ssh/known_hosts" \
  "${SCRIPT_DIR}/ege-tasks/dist/" \
  "${REMOTE}:${REMOTE_APP_DIR}/ege-tasks/dist/"

echo "[3/5] Syncing backend code"
rsync -az --delete \
  -e "ssh -p ${REMOTE_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${HOME}/.ssh/known_hosts" \
  "${SCRIPT_DIR}/pocketbase/pb_hooks/" \
  "${REMOTE}:${REMOTE_APP_DIR}/pocketbase/pb_hooks/"

rsync -az --delete \
  -e "ssh -p ${REMOTE_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${HOME}/.ssh/known_hosts" \
  "${SCRIPT_DIR}/pocketbase/pb_migrations/" \
  "${REMOTE}:${REMOTE_APP_DIR}/pocketbase/pb_migrations/"

rsync -az \
  -e "ssh -p ${REMOTE_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${HOME}/.ssh/known_hosts" \
  "${SCRIPT_DIR}/pocketbase/package.json" \
  "${SCRIPT_DIR}/pocketbase/package-lock.json" \
  "${SCRIPT_DIR}/pocketbase/pdf-service.js" \
  "${SCRIPT_DIR}/pocketbase/code.js" \
  "${REMOTE}:${REMOTE_APP_DIR}/pocketbase/"

if [[ "${SYNC_PB_DATA}" -eq 1 ]]; then
  echo "[3/5] Syncing pocketbase data (--sync-pb-data)"
  rsync -az --delete \
    -e "ssh -p ${REMOTE_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=${HOME}/.ssh/known_hosts" \
    "${SCRIPT_DIR}/pocketbase/pb_data/" \
    "${REMOTE}:${REMOTE_APP_DIR}/pocketbase/pb_data/"
fi

echo "[4/5] Applying on remote and restarting services"
REMOTE_INSTALL_DEPS="${INSTALL_BACKEND_DEPS}"
ssh "${SSH_OPTS[@]}" "${REMOTE}" "set -e
  mkdir -p '${REMOTE_APP_DIR}/ege-tasks/dist' '${REMOTE_APP_DIR}/pocketbase'
  if [[ '${REMOTE_INSTALL_DEPS}' -eq 1 ]]; then
    cd '${REMOTE_APP_DIR}/pocketbase'
    npm install --omit=dev
  fi
  sudo mkdir -p /var/www/ege-tasks
  sudo rsync -a --delete '${REMOTE_APP_DIR}/ege-tasks/dist/' /var/www/ege-tasks/
  sudo chown -R www-data:www-data /var/www/ege-tasks
  sudo systemctl restart ege-pocketbase
  sudo systemctl restart nginx
"

echo "[5/5] Health checks"
ssh "${SSH_OPTS[@]}" "${REMOTE}" "set -e
  curl -fsS https://${PUBLIC_HOST}/api/health >/dev/null
  site_code=\$(curl -sS -o /dev/null -w '%{http_code}' https://${PUBLIC_HOST}/ || true)
  case \"\${site_code}\" in
    200|301|302|307|308) ;;
    *)
      echo \"unexpected site code: \${site_code}\" >&2
      exit 1
      ;;
  esac
  systemctl is-active ege-pocketbase >/dev/null
  systemctl is-active nginx >/dev/null
  echo 'health: ok'
"

echo "Deploy complete: http://${REMOTE_HOST}/"
