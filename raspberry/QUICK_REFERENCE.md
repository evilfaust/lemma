# Raspberry Pi — Быстрая шпаргалка

## 🎯 Первый деплой (выполняется один раз)

```bash
# 1. Копируем конфиги на малину
./raspberry/copy-configs-to-raspberry.sh

# 2. Подключаемся к малине и запускаем setup
ssh faust@192.168.1.68
cd /home/faust/ege-app-setup && chmod +x setup-raspberry.sh && ./setup-raspberry.sh

# 3. Возвращаемся на Mac и делаем первый деплой
./raspberry/deploy-to-raspberry.sh
```

## 🔄 Обычный деплой (при обновлениях)

```bash
# На Mac — просто запускаем скрипт
./raspberry/deploy-to-raspberry.sh
```

## 🔍 Проверка статуса (на Raspberry Pi)

```bash
# Подключиться к малине
ssh faust@192.168.1.68

# Проверить статус всех сервисов
sudo systemctl status pocketbase pdf-service nginx

# Просмотр логов в реальном времени
sudo journalctl -u pocketbase -f     # PocketBase
sudo journalctl -u pdf-service -f    # PDF Service
```

## 🛠️ Управление сервисами (на Raspberry Pi)

```bash
# Перезапуск
sudo systemctl restart pocketbase
sudo systemctl restart pdf-service
sudo systemctl restart nginx

# Остановка
sudo systemctl stop pocketbase pdf-service

# Запуск
sudo systemctl start pocketbase pdf-service

# Перезагрузка конфигов nginx
sudo nginx -t                        # Проверка конфига
sudo systemctl reload nginx          # Применение без перезапуска
```

## 🌐 Доступ к приложению

- **Локально:** http://192.168.1.68
- **Извне:** http://ВАШ_ВНЕШНИЙ_IP (после настройки проброса портов)
- **PocketBase Admin:** http://192.168.1.68/_/

## 🔐 Узнать внешний IP

```bash
# На Raspberry Pi или Mac
curl ifconfig.me
```

## 🔄 URL конфигурация

Приложение автоматически определяет окружение:
- **Mac (dev):** API на http://127.0.0.1:8090
- **Raspberry Pi (prod):** API на http://192.168.1.68/api (через Nginx)

Файл конфигурации: `ege-tasks/src/services/pocketbaseUrl.js`

## 📦 Восстановление из бэкапа (на Raspberry Pi)

```bash
ssh faust@192.168.1.68
cd /home/faust/ege-app

# Посмотреть список бэкапов
ls -lht backups/

# Остановить PocketBase
sudo systemctl stop pocketbase

# Восстановить (замените дату на актуальную)
tar -xzf backups/backup_2026-02-16_15-30-00.tar.gz

# Запустить PocketBase
sudo systemctl start pocketbase
```

## ⚙️ Проброс портов на роутере

1. Зайти в админку роутера (обычно 192.168.1.1)
2. Найти Port Forwarding / NAT / Virtual Servers
3. Создать правило:
   - Внешний порт: **80** (или 8080)
   - Внутренний IP: **192.168.1.68**
   - Внутренний порт: **80**
   - Протокол: **TCP**
4. Сохранить и перезагрузить роутер

## 🚨 Частые проблемы

### Приложение не открывается

```bash
# Проверить nginx
sudo systemctl status nginx
sudo nginx -t

# Проверить фронтенд
ls -la /home/faust/ege-app/frontend/
```

### API не работает

```bash
# Проверить PocketBase
sudo systemctl status pocketbase
sudo journalctl -u pocketbase -n 50

# Тест API
curl http://127.0.0.1:8090/api/health
```

### PDF не генерируется

```bash
# Проверить PDF Service
sudo systemctl status pdf-service
sudo journalctl -u pdf-service -n 50

# Тест PDF
curl http://127.0.0.1:3001/health
```

## 📊 Мониторинг ресурсов

```bash
# CPU/RAM
htop

# Температура (Raspberry Pi)
vcgencmd measure_temp

# Место на диске
df -h

# Использование памяти
free -h
```

## 📝 Полезные пути

- **Приложение:** `/home/faust/ege-app/`
- **База данных:** `/home/faust/ege-app/pocketbase/pb_data/`
- **Фронтенд:** `/home/faust/ege-app/frontend/`
- **Бэкапы:** `/home/faust/ege-app/backups/`
- **Логи Nginx:** `/var/log/nginx/ege-app-*.log`
- **Systemd сервисы:** `/etc/systemd/system/{pocketbase,pdf-service}.service`
- **Nginx конфиг:** `/etc/nginx/sites-available/ege-app`
