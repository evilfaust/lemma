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
echo -e "${GREEN}🚀 Запуск всех сервисов...${NC}"
echo ""
echo -e "${BLUE}┌─────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│ PocketBase:    http://127.0.0.1:8090    │${NC}"
echo -e "${BLUE}│ PDF Service:   http://localhost:3001    │${NC}"
echo -e "${BLUE}│ Frontend:      http://localhost:5173    │${NC}"
echo -e "${BLUE}└─────────────────────────────────────────┘${NC}"
echo ""
echo -e "${YELLOW}Нажмите Ctrl+C для остановки всех сервисов${NC}"
echo ""

# Запуск через npm
npm run dev
