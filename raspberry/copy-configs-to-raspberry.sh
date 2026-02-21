#!/bin/bash

# ============================================================================
# copy-configs-to-raspberry.sh
# Копирует конфигурационные файлы на Raspberry Pi перед первичной настройкой
# ============================================================================

set -e

RASPBERRY_IP="192.168.1.68"
RASPBERRY_USER="faust"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  Копирование конфигов на Raspberry Pi"
echo "========================================"
echo ""

# Проверка SSH
echo "📡 Проверка SSH-соединения..."
if ! ssh -o ConnectTimeout=5 "$RASPBERRY_USER@$RASPBERRY_IP" "echo 'SSH OK'" &>/dev/null; then
    echo "❌ Не удалось подключиться к Raspberry Pi"
    exit 1
fi
echo "✅ SSH-соединение установлено"
echo ""

# Создаем временную директорию на малине
echo "📁 Создание временной директории..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" "mkdir -p /home/faust/ege-app-setup"
echo ""

# Копируем конфиги
echo "🔄 Копирование конфигурационных файлов..."
scp "$LOCAL_DIR/nginx.conf" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/pocketbase.service" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/pdf-service.service" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/telegram-bot.service" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/pi-online-notify.service" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/pi-online-notify.sh" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/pi-notify.env.example" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
scp "$LOCAL_DIR/setup-raspberry.sh" "$RASPBERRY_USER@$RASPBERRY_IP:/home/faust/ege-app-setup/"
echo "✅ Файлы скопированы"
echo ""

echo "========================================"
echo "✅ Готово!"
echo "========================================"
echo ""
echo "📋 Следующий шаг:"
echo "   Подключитесь к Raspberry Pi и запустите setup:"
echo ""
echo "   ssh $RASPBERRY_USER@$RASPBERRY_IP"
echo "   cd /home/faust/ege-app-setup"
echo "   chmod +x setup-raspberry.sh"
echo "   ./setup-raspberry.sh"
echo ""
