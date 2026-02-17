#!/bin/bash

# ============================================================================
# deploy-to-raspberry.sh
# Деплой фронтенда EGE Tasks Manager на Raspberry Pi
# Backend (PocketBase + PDF) работает на VPS (task-ege.oipav.ru)
# Pi раздаёт только статический фронтенд через Nginx
# ============================================================================

set -e

# Конфигурация
RASPBERRY_IP="192.168.1.68"
RASPBERRY_USER="faust"
RASPBERRY_APP_DIR="/home/faust/ege-app"
LOCAL_PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  EGE Tasks Manager - Deploy to RPi"
echo "  (только фронтенд, backend на VPS)"
echo "========================================"
echo ""

# Проверка SSH доступа
echo "📡 Проверка SSH-соединения с Raspberry Pi ($RASPBERRY_IP)..."
if ! ssh -o ConnectTimeout=5 "$RASPBERRY_USER@$RASPBERRY_IP" "echo 'SSH OK'" &>/dev/null; then
    echo "❌ Не удалось подключиться к Raspberry Pi"
    echo "   Проверьте IP ($RASPBERRY_IP), SSH и сеть"
    exit 1
fi
echo "✅ SSH-соединение установлено"
echo ""

# ============================================================================
# ШАГ 1: Сборка фронтенда
# ============================================================================
echo "🔨 [1/4] Сборка фронтенда..."
cd "$LOCAL_PROJECT_DIR/ege-tasks"
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей фронтенда..."
    npm install
fi
npm run build
echo "✅ Фронтенд собран (VITE_PB_URL → VPS)"
echo ""

# ============================================================================
# ШАГ 2: Остановка nginx на Raspberry Pi
# ============================================================================
echo "🛑 [2/4] Подготовка Raspberry Pi..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    mkdir -p /home/faust/ege-app/frontend

    # Остановка неиспользуемых сервисов (если ещё запущены)
    sudo systemctl stop pocketbase.service 2>/dev/null || true
    sudo systemctl stop pdf-service.service 2>/dev/null || true
    sudo systemctl stop telegram-bot.service 2>/dev/null || true
    sudo systemctl disable pocketbase.service 2>/dev/null || true
    sudo systemctl disable pdf-service.service 2>/dev/null || true
    sudo systemctl disable telegram-bot.service 2>/dev/null || true

    echo "✅ Готово (PB/PDF/Bot отключены — всё на VPS)"
ENDSSH
echo ""

# ============================================================================
# ШАГ 3: Синхронизация фронтенда
# ============================================================================
echo "🔄 [3/4] Синхронизация фронтенда..."

rsync -avz --delete \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/" \
    "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/frontend/"

# Права для Nginx
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    chmod +rx /home/faust
    chmod -R +r /home/faust/ege-app/frontend
    find /home/faust/ege-app/frontend -type d -exec chmod +x {} \;
    echo "✅ Файлы синхронизированы"
ENDSSH
echo ""

# ============================================================================
# ШАГ 4: Перезагрузка Nginx
# ============================================================================
echo "🚀 [4/4] Перезагрузка Nginx..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" "sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx"
echo "✅ Nginx перезагружен"
echo ""

# ============================================================================
# Финал
# ============================================================================
echo "========================================"
echo "✅ Деплой завершен!"
echo "========================================"
echo ""
echo "🌐 Фронтенд: http://$RASPBERRY_IP"
echo "🔗 Backend:   https://task-ege.oipav.ru (VPS)"
echo ""
echo "📊 Статус:"
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    systemctl is-active nginx 2>/dev/null && echo "  ✅ Nginx: running" || echo "  ❌ Nginx: stopped"
    echo "  ℹ️  PocketBase: на VPS (task-ege.oipav.ru)"
    echo "  ℹ️  PDF Service: на VPS (task-ege.oipav.ru/pdf)"
ENDSSH
echo ""
