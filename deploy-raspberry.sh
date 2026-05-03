#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/ege-tasks/dist"
REMOTE="faust@88.201.208.15"
REMOTE_PATH="/opt/docker/nginx/html/"
SSH_PORT=22222

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Деплой Lemma → Raspberry Pi         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"

# Флаг --build: собрать перед деплоем
if [ "$1" = "--build" ]; then
  echo -e "${BLUE}→ Сборка...${NC}"
  cd "$SCRIPT_DIR/ege-tasks" && npm run build
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Сборка завершилась с ошибкой${NC}"
    exit 1
  fi
  echo ""
fi

# Проверяем наличие dist
if [ ! -d "$DIST" ]; then
  echo -e "${RED}✗ Папка dist не найдена. Запусти: cd ege-tasks && npm run build${NC}"
  exit 1
fi

# Версия
VERSION=$(python3 -c "import json; d=json.load(open('$DIST/version.json')); print(d.get('releaseId','?'))" 2>/dev/null || echo "?")
echo -e "${YELLOW}Версия:${NC} $VERSION"
echo -e "${YELLOW}Цель:${NC}   $REMOTE:$REMOTE_PATH"
echo ""

echo -e "${BLUE}→ Синхронизация...${NC}"
rsync -az --delete --exclude='.DS_Store' \
  -e "ssh -p $SSH_PORT" \
  "$DIST/" "$REMOTE:$REMOTE_PATH"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Готово — nginx раздаёт новую версию${NC}"
else
  echo -e "${RED}✗ Ошибка rsync${NC}"
  exit 1
fi
