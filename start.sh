#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                           ║${NC}"
echo -e "${BLUE}║     EGE TASKS MANAGER - DEV MODE          ║${NC}"
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

# Режим запуска
MODE="frontend"
if [[ "$1" == "--local-pdf" || "$1" == "-p" ]]; then
    MODE="local-pdf"
elif [[ "$1" == "--full" || "$1" == "-f" ]]; then
    MODE="full"
fi

# Установка зависимостей
if [ ! -d "ege-tasks/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка frontend зависимостей...${NC}"
    cd ege-tasks && npm install && cd ..
fi

if [[ "$MODE" == "local-pdf" || "$MODE" == "full" ]]; then
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Установка корневых зависимостей...${NC}"
        npm install
    fi
    if [ ! -d "pocketbase/node_modules" ]; then
        echo -e "${YELLOW}📦 Установка backend зависимостей...${NC}"
        cd pocketbase && npm install && cd ..
    fi
fi

echo ""
echo -e "${GREEN}🚀 Запуск сервисов...${NC}"
echo ""

case $MODE in
    "frontend")
        echo -e "${BLUE}┌─────────────────────────────────────────────────┐${NC}"
        echo -e "${BLUE}│ Backend:     https://task-ege.oipav.ru (VPS)    │${NC}"
        echo -e "${BLUE}│ PDF:         https://task-ege.oipav.ru/pdf (VPS)│${NC}"
        echo -e "${BLUE}│ Frontend:    http://localhost:5173 (local)       │${NC}"
        echo -e "${BLUE}└─────────────────────────────────────────────────┘${NC}"
        echo ""
        echo -e "${YELLOW}Нажмите Ctrl+C для остановки${NC}"
        echo -e "${YELLOW}Другие режимы: --local-pdf | --full${NC}"
        echo ""
        cd ege-tasks && npm run dev
        ;;

    "local-pdf")
        echo -e "${BLUE}┌──────────────────────────────────────────────────┐${NC}"
        echo -e "${BLUE}│ Backend:     https://task-ege.oipav.ru (VPS)     │${NC}"
        echo -e "${BLUE}│ PDF Service: http://localhost:3001 (local)        │${NC}"
        echo -e "${BLUE}│ Frontend:    http://localhost:5173 (local)        │${NC}"
        echo -e "${BLUE}└──────────────────────────────────────────────────┘${NC}"
        echo ""
        npx concurrently -n "PDF,FRONTEND" -c "bgMagenta.bold,bgGreen.bold" \
            "npm run dev:pdf" \
            "npm run dev:frontend"
        ;;

    "full")
        echo -e "${BLUE}┌──────────────────────────────────────────────────┐${NC}"
        echo -e "${BLUE}│ PocketBase:  http://127.0.0.1:8090 (local)       │${NC}"
        echo -e "${BLUE}│ PDF Service: http://localhost:3001 (local)        │${NC}"
        echo -e "${BLUE}│ Frontend:    http://localhost:5173 (local)        │${NC}"
        echo -e "${BLUE}└──────────────────────────────────────────────────┘${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Полностью локальный режим. Убедитесь, что VITE_PB_URL=http://127.0.0.1:8090${NC}"
        echo ""
        npx concurrently -n "BACKEND,PDF,FRONTEND" -c "bgBlue.bold,bgMagenta.bold,bgGreen.bold" \
            "npm run dev:backend" \
            "npm run dev:pdf" \
            "npm run dev:frontend"
        ;;
esac
