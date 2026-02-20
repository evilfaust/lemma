#!/bin/bash

# ============================================================================
# deploy-student-to-vps.sh
# Деплой студенческого приложения на VPS (task-ege.oipav.ru)
#
# Что делает:
#   - Собирает оба бандла (teacher + student)
#   - Копирует на VPS: student.html + assets/student-* + общие assets
#   - Перезагружает Nginx на VPS
#
# Предварительно: убедитесь что ~/.ssh/config содержит Host для VPS
# ============================================================================

set -e

VPS_HOST="root@147.45.158.148"
VPS_FRONTEND_DIR="/var/www/ege-app/student"
LOCAL_PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  EGE Tasks — Deploy Student to VPS"
echo "========================================"
echo ""

# Проверка SSH доступа
echo "📡 Проверка SSH-соединения с VPS..."
if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'SSH OK'" &>/dev/null; then
    echo "❌ Не удалось подключиться к VPS ($VPS_HOST)"
    echo "   Проверьте SSH-ключи и доступность сервера"
    exit 1
fi
echo "✅ SSH-соединение установлено"
echo ""

# ШАГ 1: Сборка
echo "🔨 [1/3] Сборка фронтенда (оба приложения)..."
cd "$LOCAL_PROJECT_DIR/ege-tasks"
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi
npm run build
echo "✅ Сборка завершена"
echo ""

# ШАГ 2: Подготовка директории на VPS
echo "📁 [2/3] Подготовка директории на VPS..."
ssh "$VPS_HOST" "mkdir -p $VPS_FRONTEND_DIR"

# ШАГ 3: Синхронизация
echo "🔄 [3/3] Синхронизация файлов на VPS..."

# Копируем student.html
rsync -avz \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/student.html" \
    "$VPS_HOST:$VPS_FRONTEND_DIR/"

# Копируем все assets (shared между teacher и student)
rsync -avz --delete \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/assets/" \
    "$VPS_HOST:$VPS_FRONTEND_DIR/assets/"

# Права
ssh "$VPS_HOST" "chmod -R 755 $VPS_FRONTEND_DIR"

echo "✅ Файлы скопированы"
echo ""

echo "========================================"
echo "✅ Деплой студенческого приложения завершен!"
echo "========================================"
echo ""
echo "🌐 URL для студентов: https://task-ege.oipav.ru/student/{sessionId}"
echo ""
echo "⚠️  Не забудьте обновить nginx конфиг на VPS если ещё не сделано:"
echo "    Добавить location /student/ { try_files ... /student.html; }"
echo ""
