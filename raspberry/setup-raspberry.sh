#!/bin/bash

# ============================================================================
# setup-raspberry.sh
# Скрипт первичной настройки Raspberry Pi для EGE Tasks Manager
# Запускается ОДИН РАЗ на малине для установки всех зависимостей и сервисов
# ============================================================================

set -e  # Остановка при ошибке

echo "========================================"
echo "  EGE Tasks Manager - Raspberry Pi Setup"
echo "========================================"
echo ""
echo "⚠️  Этот скрипт установит и настроит:"
echo "   - Node.js 18.x (если не установлен)"
echo "   - Nginx"
echo "   - Зависимости для Puppeteer (Chromium)"
echo "   - Systemd сервисы (PocketBase, PDF Service)"
echo ""
read -p "Продолжить? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Установка отменена"
    exit 0
fi

# ============================================================================
# Обновление системы
# ============================================================================
echo ""
echo "📦 [1/6] Обновление системы..."
sudo apt-get update
sudo apt-get upgrade -y
echo "✅ Система обновлена"

# ============================================================================
# Установка Node.js 18.x
# ============================================================================
echo ""
echo "📦 [2/6] Установка Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js уже установлен: $NODE_VERSION"
else
    echo "  → Установка Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✅ Node.js установлен: $(node -v)"
fi

# ============================================================================
# Установка Nginx
# ============================================================================
echo ""
echo "📦 [3/6] Установка Nginx..."
if command -v nginx &> /dev/null; then
    echo "✅ Nginx уже установлен"
else
    sudo apt-get install -y nginx
    echo "✅ Nginx установлен"
fi

# ============================================================================
# Установка зависимостей для Puppeteer
# ============================================================================
echo ""
echo "📦 [4/6] Установка зависимостей для Puppeteer..."
sudo apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils

echo "✅ Зависимости Puppeteer установлены"

# ============================================================================
# Настройка Nginx
# ============================================================================
echo ""
echo "🔧 [5/6] Настройка Nginx..."

# Копируем конфиг из локальной директории (если есть)
if [ -f "/home/faust/ege-app-setup/nginx.conf" ]; then
    sudo cp /home/faust/ege-app-setup/nginx.conf /etc/nginx/sites-available/ege-app
else
    echo "⚠️  Конфиг nginx.conf не найден в /home/faust/ege-app-setup/"
    echo "   Создайте его вручную или скопируйте из проекта"
    echo "   Пропускаем настройку Nginx..."
fi

# Создаем симлинк и проверяем конфигурацию
if [ -f "/etc/nginx/sites-available/ege-app" ]; then
    sudo ln -sf /etc/nginx/sites-available/ege-app /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default  # Удаляем дефолтный конфиг
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx настроен"
else
    echo "⚠️  Конфигурация Nginx не создана"
fi

# ============================================================================
# Настройка systemd сервисов
# ============================================================================
echo ""
echo "🔧 [6/6] Настройка systemd сервисов..."

# Копируем сервисы из локальной директории (если есть)
if [ -f "/home/faust/ege-app-setup/pocketbase.service" ]; then
    sudo cp /home/faust/ege-app-setup/pocketbase.service /etc/systemd/system/
    echo "  → pocketbase.service создан"
else
    echo "⚠️  Файл pocketbase.service не найден"
fi

if [ -f "/home/faust/ege-app-setup/pdf-service.service" ]; then
    sudo cp /home/faust/ege-app-setup/pdf-service.service /etc/systemd/system/
    echo "  → pdf-service.service создан"
else
    echo "⚠️  Файл pdf-service.service не найден"
fi

if [ -f "/home/faust/ege-app-setup/telegram-bot.service" ]; then
    sudo cp /home/faust/ege-app-setup/telegram-bot.service /etc/systemd/system/
    echo "  → telegram-bot.service создан"
else
    echo "⚠️  Файл telegram-bot.service не найден"
fi

# Перезагружаем systemd и включаем автозапуск
sudo systemctl daemon-reload

if [ -f "/etc/systemd/system/pocketbase.service" ]; then
    sudo systemctl enable pocketbase.service
    echo "  → pocketbase.service включен в автозапуск"
fi

if [ -f "/etc/systemd/system/pdf-service.service" ]; then
    sudo systemctl enable pdf-service.service
    echo "  → pdf-service.service включен в автозапуск"
fi

if [ -f "/etc/systemd/system/telegram-bot.service" ]; then
    sudo systemctl enable telegram-bot.service
    echo "  → telegram-bot.service включен в автозапуск"
fi

echo "✅ Systemd сервисы настроены"

# ============================================================================
# Финальная информация
# ============================================================================
echo ""
echo "========================================"
echo "✅ Первичная настройка завершена!"
echo "========================================"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Запустите deploy-to-raspberry.sh на вашем Mac:"
echo "   ./raspberry/deploy-to-raspberry.sh"
echo ""
echo "2. После деплоя сервисы запустятся автоматически"
echo ""
echo "3. Проверьте статус сервисов:"
echo "   sudo systemctl status pocketbase"
echo "   sudo systemctl status pdf-service"
echo "   sudo systemctl status nginx"
echo ""
echo "4. Приложение будет доступно по адресу:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo "🔧 Полезные команды:"
echo "   sudo journalctl -u pocketbase -f    # Логи PocketBase"
echo "   sudo journalctl -u pdf-service -f   # Логи PDF Service"
echo "   sudo systemctl restart pocketbase   # Перезапуск PocketBase"
echo ""
