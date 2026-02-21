#!/bin/bash
# Скрипт для запуска PocketBase и PDF сервиса

echo "🚀 Запуск EGE Tasks Backend..."

# Проверка установки зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Запуск через npm (используется concurrently)
echo "▶️ Запуск PocketBase и PDF сервиса..."
npm run dev
