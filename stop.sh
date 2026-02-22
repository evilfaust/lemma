#!/bin/bash

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Остановка локальных сервисов EGE Tasks Manager...${NC}"
echo ""

echo "Остановка Frontend (Vite)..."
pkill -f "vite" 2>/dev/null

sleep 1

echo ""
echo -e "${GREEN}✓ Все локальные сервисы остановлены${NC}"
echo -e "Примечание: Backend (VPS) продолжает работать на https://task-ege.oipav.ru"
