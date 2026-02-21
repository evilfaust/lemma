# Быстрая шпаргалка

## Архитектура

```
VPS (147.45.158.148 / task-ege.oipav.ru):
  nginx (443) → HTTPS
    /api/, /_/  → PocketBase (:8095)   systemd: pocketbase-ege
    /pdf/       → PDF Service (:3001)  systemd: pdf-service-ege
  Telegram Bot                         systemd: telegram-bot-ege
  Бэкапы: cron каждые 6 часов

Raspberry Pi (192.168.1.68):
  nginx (80) → статический фронтенд
  (PocketBase, PDF, Telegram-бот — ОТКЛЮЧЕНЫ)

Mac (dev):
  Vite (:5173) → https://task-ege.oipav.ru
```

## Деплой на Raspberry Pi

```bash
# На Mac — один скрипт делает всё:
# сборка фронтенда → rsync → nginx reload
./raspberry/deploy-to-raspberry.sh
```

## Разработка (на Mac)

```bash
./start.sh              # Только фронтенд (backend на VPS)
./start.sh --local-pdf  # + локальный PDF-сервис
./start.sh --full       # Полностью локально (PB + PDF + Frontend)
```

## VPS — управление сервисами

```bash
ssh root@147.45.158.148

# Статус всех сервисов
systemctl status pocketbase-ege pdf-service-ege telegram-bot-ege nginx

# Перезапуск
systemctl restart pocketbase-ege
systemctl restart pdf-service-ege
systemctl restart telegram-bot-ege
systemctl reload nginx

# Логи
journalctl -u pocketbase-ege -n 50
journalctl -u pdf-service-ege -n 50
journalctl -u telegram-bot-ege -n 50
```

## VPS — бэкапы

```bash
ssh root@147.45.158.148

# Список бэкапов
ls -lht /opt/pocketbase/backups/

# Ручной бэкап
/opt/pocketbase/backup.sh

# Cron (автоматически каждые 6 часов)
crontab -l | grep backup
```

## Доступ к приложению

- **Фронтенд (Pi):** http://192.168.1.68
- **Фронтенд (dev):** http://localhost:5173
- **Backend (VPS):** https://task-ege.oipav.ru
- **PB Admin:** https://task-ege.oipav.ru/_/
- **PDF Health:** https://task-ege.oipav.ru/pdf/health

## Telegram-бот

Команды: `/status`, `/db`, `/backups`, `/health`, `/restart`, `/logs`, `/help`

## Уведомления от Raspberry Pi

```bash
ssh faust@192.168.1.68
sudo nano /etc/ege-app/pi-notify.env   # BOT_TOKEN, CHAT_ID
sudo systemctl enable pi-online-notify.service
sudo systemctl start pi-online-notify.service
sudo systemctl status pi-online-notify.service
```

## Raspberry Pi — проверка

```bash
ssh faust@192.168.1.68

# Nginx
systemctl status nginx
ls -la /home/faust/ege-app/frontend/

# Логи
cat /var/log/nginx/ege-app-error.log
```

## Полезные пути

### VPS
- PocketBase: `/opt/pocketbase/`
- БД: `/opt/pocketbase/pb_data/data.db`
- PDF-сервис: `/opt/pocketbase/pdf-service/`
- Telegram-бот: `/opt/pocketbase/telegram-bot/`
- Бэкапы: `/opt/pocketbase/backups/`
- nginx: `/etc/nginx/sites-available/task-ege.oipav.ru`

### Raspberry Pi
- Фронтенд: `/home/faust/ege-app/frontend/`
- nginx: `/etc/nginx/sites-available/ege-app`
- Логи: `/var/log/nginx/ege-app-*.log`

### Mac (dev)
- Проект: `~/Documents/APP/generation-test/`
- Фронтенд: `ege-tasks/`
- PDF-сервис: `pocketbase/pdf-service.js`
- Telegram-бот: `raspberry/telegram-bot.js`
- Env: `ege-tasks/.env`
