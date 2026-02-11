#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                           ║${NC}"
echo -e "${BLUE}║     EGE TASKS MANAGER - FULL STACK        ║${NC}"
echo -e "${BLUE}║                                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js: $(node -v)"
echo ""

# Проверка зависимостей
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Установка корневых зависимостей...${NC}"
    npm install
fi

if [ ! -d "pocketbase/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка backend зависимостей...${NC}"
    cd pocketbase && npm install && cd ..
fi

if [ ! -d "ege-tasks/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка frontend зависимостей...${NC}"
    cd ege-tasks && npm install && cd ..
fi

echo ""

# Режим запуска
NO_PDF=false
if [[ "$1" == "--no-pdf" || "$1" == "-n" ]]; then
    NO_PDF=true
fi

echo -e "${GREEN}🚀 Запуск сервисов...${NC}"
echo ""
echo -e "${BLUE}┌─────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│ PocketBase:    http://127.0.0.1:8090    │${NC}"
if [ "$NO_PDF" = false ]; then
    echo -e "${BLUE}│ PDF Service:   http://localhost:3001    │${NC}"
fi
echo -e "${BLUE}│ Frontend:      http://localhost:5173    │${NC}"
echo -e "${BLUE}└─────────────────────────────────────────┘${NC}"
echo ""

# Показать адреса локальной сети
LAN_IPS=()
if command -v ipconfig &> /dev/null; then
    for IFACE in en0 en1; do
        IP=$(ipconfig getifaddr "$IFACE" 2>/dev/null)
        if [ -n "$IP" ]; then
            LAN_IPS+=("$IP")
        fi
    done
elif command -v hostname &> /dev/null; then
    IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)
    while IFS= read -r IP; do
        [ -n "$IP" ] && LAN_IPS+=("$IP")
    done <<< "$IPS"
fi

if [ ${#LAN_IPS[@]} -gt 0 ]; then
    echo -e "${GREEN}Доступ в локальной сети:${NC}"
    for IP in "${LAN_IPS[@]}"; do
        echo -e "  ${BLUE}Frontend:${NC} http://${IP}:5173"
        echo -e "  ${BLUE}PocketBase:${NC} http://${IP}:8090"
    done
    echo ""
fi

if [ -n "${VITE_PB_URL:-}" ]; then
    echo -e "${YELLOW}Используется пользовательский VITE_PB_URL:${NC} ${VITE_PB_URL}"
    echo ""
fi

echo -e "${YELLOW}Нажмите Ctrl+C для остановки всех сервисов${NC}"
echo -e "${YELLOW}Запуск без PDF: ./start.sh --no-pdf${NC}"
echo ""

# Запуск через npm
if [ "$NO_PDF" = true ]; then
    npx concurrently -n "BACKEND,FRONTEND" -c "bgBlue.bold,bgGreen.bold" \
        "npm run dev:backend" \
        "npm run dev:frontend"
else
    npm run dev
fi
