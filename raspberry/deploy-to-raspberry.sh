#!/bin/bash

# ============================================================================
# deploy-to-raspberry.sh
# Скрипт деплоя EGE Tasks Manager на Raspberry Pi
# ============================================================================

set -e  # Остановка при ошибке

# Конфигурация
RASPBERRY_IP="192.168.1.68"
RASPBERRY_USER="faust"
RASPBERRY_APP_DIR="/home/faust/ege-app"
LOCAL_PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  EGE Tasks Manager - Deploy to RPi"
echo "========================================"
echo ""

# Проверка SSH доступа
echo "📡 Проверка SSH-соединения с Raspberry Pi ($RASPBERRY_IP)..."
if ! ssh -o ConnectTimeout=5 "$RASPBERRY_USER@$RASPBERRY_IP" "echo 'SSH OK'" &>/dev/null; then
    echo "❌ Не удалось подключиться к Raspberry Pi"
    echo "   Проверьте:"
    echo "   - IP-адрес ($RASPBERRY_IP)"
    echo "   - SSH доступ (логин: $RASPBERRY_USER)"
    echo "   - Сеть"
    exit 1
fi
echo "✅ SSH-соединение установлено"
echo ""

# ============================================================================
# ШАГ 1: Бэкап локальной базы данных на Mac
# ============================================================================
echo "📦 [1/7] Создание бэкапа локальной БД на Mac..."
cd "$LOCAL_PROJECT_DIR"
if [ -d "pocketbase/pb_data" ]; then
    ./backup.sh
    echo "✅ Локальный бэкап создан"
else
    echo "⚠️  Директория pocketbase/pb_data не найдена, пропускаем бэкап"
fi
echo ""

# ============================================================================
# ШАГ 2: Бэкап базы данных на Raspberry Pi
# ============================================================================
echo "📦 [2/7] Создание бэкапа БД на Raspberry Pi..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    if [ -d "/home/faust/ege-app/pocketbase/pb_data" ]; then
        cd /home/faust/ege-app
        mkdir -p backups
        BACKUP_FILE="backups/backup_$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
        tar -czf "$BACKUP_FILE" pocketbase/pb_data/
        echo "✅ Бэкап на малине создан: $BACKUP_FILE"
        # Оставляем только последние 10 бэкапов
        ls -t backups/backup_*.tar.gz | tail -n +11 | xargs -r rm
    else
        echo "⚠️  БД на малине еще не существует, пропускаем бэкап"
    fi
ENDSSH
echo ""

# ============================================================================
# ШАГ 3: Сборка фронтенда
# ============================================================================
echo "🔨 [3/7] Сборка фронтенда..."
cd "$LOCAL_PROJECT_DIR/ege-tasks"
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей фронтенда..."
    npm install
fi
npm run build
echo "✅ Фронтенд собран"
echo ""

# ============================================================================
# ШАГ 4: Остановка сервисов на Raspberry Pi
# ============================================================================
echo "🛑 [4/7] Остановка сервисов на Raspberry Pi..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    # Остановка systemd сервисов (если существуют)
    sudo systemctl stop pocketbase.service 2>/dev/null || true
    sudo systemctl stop pdf-service.service 2>/dev/null || true

    # На всякий случай убиваем процессы (если запущены вручную)
    pkill -f "pocketbase serve" || true
    pkill -f "pdf-service.js" || true

    echo "✅ Сервисы остановлены"
ENDSSH
echo ""

# ============================================================================
# ШАГ 5: Синхронизация файлов
# ============================================================================
echo "🔄 [5/7] Синхронизация файлов с Raspberry Pi..."

# Создаем структуру директорий на малине
ssh "$RASPBERRY_USER@$RASPBERRY_IP" "mkdir -p $RASPBERRY_APP_DIR/{pocketbase,frontend,backups,raspberry}"

echo "  → Синхронизация PocketBase (бинарник, hooks, migrations)..."
rsync -avz --delete \
    --exclude 'pb_data' \
    --exclude 'node_modules' \
    "$LOCAL_PROJECT_DIR/pocketbase/" \
    "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/pocketbase/"

echo "  → Синхронизация базы данных (pb_data)..."
rsync -avz --delete \
    "$LOCAL_PROJECT_DIR/pocketbase/pb_data/" \
    "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/pocketbase/pb_data/"

echo "  → Синхронизация собранного фронтенда..."
rsync -avz --delete \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/" \
    "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/frontend/"

echo "  → Синхронизация Telegram-бота..."
rsync -avz \
    "$LOCAL_PROJECT_DIR/raspberry/telegram-bot.js" \
    "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/raspberry/"

echo "✅ Файлы синхронизированы"
echo ""

# ============================================================================
# ШАГ 6: Установка зависимостей на Raspberry Pi
# ============================================================================
echo "📦 [6/7] Установка зависимостей на Raspberry Pi..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    cd /home/faust/ege-app/pocketbase

    # Проверка наличия Node.js
    if ! command -v node &> /dev/null; then
        echo "⚠️  Node.js не установлен на Raspberry Pi!"
        echo "   Установите Node.js 18+ и повторите деплой"
        exit 1
    fi

    # Проверка архитектуры исполняемого файла PocketBase
    if ! ./pocketbase --version &>/dev/null; then
        echo "  → Скачивание PocketBase для Linux ARM64..."
        curl -L https://github.com/pocketbase/pocketbase/releases/download/v0.23.8/pocketbase_0.23.8_linux_arm64.zip -o pocketbase_linux.zip
        unzip -o pocketbase_linux.zip
        rm pocketbase_linux.zip
        chmod +x pocketbase
        echo "  ✅ PocketBase установлен"
    fi

    echo "  → Установка зависимостей для PDF-сервиса..."
    npm install --production

    echo "  → Исправление прав доступа для Nginx..."
    chmod +rx /home/faust
    chmod -R +r /home/faust/ege-app/frontend
    chmod +x /home/faust/ege-app /home/faust/ege-app/frontend /home/faust/ege-app/frontend/assets /home/faust/ege-app/frontend/achievements

    echo "✅ Зависимости установлены"
ENDSSH
echo ""

# ============================================================================
# ШАГ 7: Запуск сервисов
# ============================================================================
echo "🚀 [7/7] Запуск сервисов..."
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    # Запуск через systemd (если настроен)
    if systemctl list-unit-files | grep -q "pocketbase.service"; then
        sudo systemctl start pocketbase.service
        sudo systemctl start pdf-service.service
        echo "✅ Сервисы запущены через systemd"
    else
        echo "⚠️  Systemd сервисы не настроены"
        echo "   Запустите setup-raspberry.sh для первичной настройки"
    fi
ENDSSH
echo ""

# ============================================================================
# Финальная информация
# ============================================================================
echo "========================================"
echo "✅ Деплой завершен успешно!"
echo "========================================"
echo ""
echo "🌐 Приложение доступно по адресу:"
echo "   http://$RASPBERRY_IP"
echo ""
echo "🔧 Полезные команды на Raspberry Pi:"
echo "   ssh $RASPBERRY_USER@$RASPBERRY_IP"
echo "   sudo systemctl status pocketbase"
echo "   sudo systemctl status pdf-service"
echo "   sudo systemctl status nginx"
echo "   sudo journalctl -u pocketbase -f"
echo ""
echo "📊 Статус сервисов:"
ssh "$RASPBERRY_USER@$RASPBERRY_IP" bash << 'ENDSSH'
    if command -v systemctl &> /dev/null; then
        systemctl is-active pocketbase.service 2>/dev/null && echo "  ✅ PocketBase: running" || echo "  ❌ PocketBase: stopped"
        systemctl is-active pdf-service.service 2>/dev/null && echo "  ✅ PDF Service: running" || echo "  ❌ PDF Service: stopped"
        systemctl is-active nginx 2>/dev/null && echo "  ✅ Nginx: running" || echo "  ❌ Nginx: stopped"
    fi
ENDSSH
echo ""
