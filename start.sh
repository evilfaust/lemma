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

# Установка зависимостей
if [ ! -d "ege-tasks/node_modules" ]; then
    echo -e "${YELLOW}📦 Установка frontend зависимостей...${NC}"
    cd ege-tasks && npm install && cd ..
fi

echo ""
echo -e "${GREEN}🚀 Запуск сервисов...${NC}"
echo ""
echo -e "${BLUE}┌─────────────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│ Backend:     https://task-ege.oipav.ru (VPS)    │${NC}"
echo -e "${BLUE}│ PDF:         https://task-ege.oipav.ru/pdf (VPS)│${NC}"
echo -e "${BLUE}│ Frontend:    http://localhost:5173 (local)      │${NC}"
echo -e "${BLUE}└─────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "${YELLOW}Нажмите Ctrl+C для остановки${NC}"
echo ""
cd ege-tasks && npm run dev
