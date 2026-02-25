#!/bin/bash

# ============================================================================
# deploy-student-to-vps.sh
# Деплой студенческого приложения на VPS (student.oipav.ru)
#
# Что делает:
#   - Собирает фронтенд
#   - Копирует на VPS: student.html + assets + achievements + vite.svg
#   - Перезагружает Nginx на VPS
#
# Предварительно: убедитесь что ~/.ssh/config содержит Host для VPS
# ============================================================================

set -e

VPS_HOST="root@147.45.158.148"
VPS_FRONTEND_DIR="/var/www/student-ege"
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
echo "🔨 [1/3] Сборка фронтенда..."
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

# Копируем иконки достижений для student gallery
rsync -avz --delete \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/achievements/" \
    "$VPS_HOST:$VPS_FRONTEND_DIR/achievements/"

# Копируем favicon, чтобы не было 404 в student.html
rsync -avz \
    "$LOCAL_PROJECT_DIR/ege-tasks/dist/vite.svg" \
    "$VPS_HOST:$VPS_FRONTEND_DIR/"

# Права
ssh "$VPS_HOST" "chmod -R 755 $VPS_FRONTEND_DIR"

echo "✅ Файлы скопированы"
echo ""

echo "========================================"
echo "✅ Деплой студенческого приложения завершен!"
echo "========================================"
echo ""
echo "🌐 URL для студентов: https://student.oipav.ru/student/{sessionId}"
echo ""
