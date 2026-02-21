#!/bin/bash

# Sends a one-time Telegram message when Raspberry Pi comes online.
# Does NOT use getUpdates/long-polling, so it can coexist with VPS bot daemon.

set -euo pipefail

BOT_TOKEN="${BOT_TOKEN:-}"
CHAT_ID="${CHAT_ID:-}"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-90}"
VPS_URL="${VPS_URL:-https://task-ege.oipav.ru}"

if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
  echo "BOT_TOKEN or CHAT_ID is not set. Skip notification."
  exit 0
fi

get_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

wait_for_ip() {
  local elapsed=0
  local ip=""

  while [[ $elapsed -lt $MAX_WAIT_SECONDS ]]; do
    ip="$(get_ip)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

LAN_IP="$(wait_for_ip || true)"
HOSTNAME="$(hostname)"
SSID="$(iwgetid -r 2>/dev/null || true)"
UPTIME="$(uptime -p 2>/dev/null || true)"
TAILSCALE_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"

if [[ -z "$LAN_IP" ]]; then
  LAN_IP="unknown"
fi

if [[ -z "$SSID" ]]; then
  SSID="unknown"
fi

if [[ -z "$UPTIME" ]]; then
  UPTIME="unknown"
fi

FRONTEND_LAN_URL="http://$LAN_IP"
COCKPIT_LAN_URL="https://$LAN_IP:9090"
KUMA_LAN_URL="http://$LAN_IP:3001"
HOMEPAGE_LAN_URL="http://$LAN_IP:3100"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

TEXT="🟢 Raspberry Pi online

Host: $HOSTNAME
LAN IP: $LAN_IP
Wi-Fi: $SSID
Uptime: $UPTIME
Time: $TIMESTAMP

Сервисы (LAN):
Frontend: $FRONTEND_LAN_URL
Cockpit: $COCKPIT_LAN_URL
Uptime Kuma: $KUMA_LAN_URL
Homepage: $HOMEPAGE_LAN_URL

VPS:
Backend: $VPS_URL
PDF Health: $VPS_URL/pdf/health"

if [[ -n "$TAILSCALE_IP" ]]; then
  TEXT="$TEXT

Сервисы (Tailscale):
Cockpit: https://$TAILSCALE_IP:9090
Uptime Kuma: http://$TAILSCALE_IP:3001
Homepage: http://$TAILSCALE_IP:3100"
fi

curl -sS --fail --max-time 15 \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${TEXT}" >/dev/null

echo "Pi online notification sent."
