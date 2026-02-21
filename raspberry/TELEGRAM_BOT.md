# Telegram Bot для мониторинга VPS

## Описание

Telegram-бот работает на VPS и мониторит все сервисы EGE Tasks Manager. Отправляет уведомление при запуске и принимает команды через long polling.

## Расположение

- **Исходник:** `raspberry/telegram-bot.js` (в репозитории)
- **На VPS:** `/opt/pocketbase/telegram-bot/telegram-bot.js`
- **Systemd:** `telegram-bot-ege`

## Команды бота

| Команда | Описание |
|---------|----------|
| `/status` | Статус сервисов VPS + система (RAM, диск, uptime, load) |
| `/db` | Статистика БД: задачи, темы, студенты, попытки, работы, сессии, статьи |
| `/backups` | Последние 5 бэкапов + размер + следующий по расписанию |
| `/health` | HTTP health-check PocketBase и PDF Service (локально + через домен) |
| `/restart [service]` | Перезапуск: all / pocketbase / pdf / nginx / bot |
| `/logs [service]` | Последние 20 строк логов (pocketbase / pdf / nginx / bot) |
| `/help` | Список всех команд |

## Конфигурация

### Telegram Bot Token и Chat ID

Настроены в файле `telegram-bot.js`:
```javascript
const BOT_TOKEN = '8094410045:AAGD7DID-odRPOdwEpk85GhhTtsqQgRPZO4';
const CHAT_ID = '328497552';
```

### Пути на VPS
```javascript
const PB_DATA_DIR = '/opt/pocketbase/pb_data';
const BACKUP_DIR = '/opt/pocketbase/backups';
const DB_PATH = '/opt/pocketbase/pb_data/data.db';
```

## Управление

### Проверка статуса
```bash
ssh root@147.45.158.148
systemctl status telegram-bot-ege
```

### Просмотр логов
```bash
journalctl -u telegram-bot-ege -n 50
journalctl -u telegram-bot-ege -f  # реальное время
```

### Перезапуск
```bash
systemctl restart telegram-bot-ege
```

### Остановка/запуск
```bash
systemctl stop telegram-bot-ege
systemctl start telegram-bot-ege
```

## Как это работает

### Режимы работы

**Startup** (выполняется один раз при запуске):
```bash
node telegram-bot.js startup
```
Отправляет уведомление со статусом сервисов и системы.

**Daemon** (постоянно работает):
```bash
node telegram-bot.js daemon
```
Слушает команды через Telegram API (long polling).

### Systemd сервис

```ini
[Service]
ExecStartPre=/usr/bin/node telegram-bot.js startup
ExecStart=/usr/bin/node telegram-bot.js daemon
Restart=always
RestartSec=10
MemoryMax=100M
CPUQuota=10%
```

### Статистика БД

Бот получает статистику через `sqlite3` CLI (быстрее HTTP API, не нужен auth):
```sql
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM topics;
-- и т.д.
```

### Health Check

Проверяет доступность эндпоинтов:
- `http://localhost:8095/api/health` — PocketBase (локально)
- `http://localhost:3001/health` — PDF Service (локально)
- `https://task-ege.oipav.ru/api/health` — PocketBase (через домен)

## Безопасность

- Бот отвечает только на команды от Chat ID: `328497552`
- Ресурсы ограничены: 100 MB RAM, 10% CPU
- Автоперезапуск при сбое через 10 секунд

## Обновление бота

1. Отредактировать `raspberry/telegram-bot.js` на Mac
2. Скопировать на VPS:
   ```bash
   scp raspberry/telegram-bot.js root@147.45.158.148:/opt/pocketbase/telegram-bot/
   ```
3. Перезапустить:
   ```bash
   ssh root@147.45.158.148 "systemctl restart telegram-bot-ege"
   ```

## Примеры уведомлений

### При запуске (автоматическое)
```
EGE Tasks VPS запущен!

Сервисы:
  pocketbase-ege: running
  pdf-service-ege: running
  nginx: running
  telegram-bot-ege: running

Система:
  RAM: 512Mi / 2048Mi
  Диск: 8.2G / 30G
  Uptime: up 5 days
  Load: 0.15 0.10 0.05

Доступные команды:
/status /db /backups /health /restart /logs
```

### /db
```
Статистика БД

  Задачи:      7079
  Темы:        25
  Студенты:    10
  Попытки:     43
  Работы:      15
  Сессии:      8
  Статьи:      12

БД: /opt/pocketbase/pb_data/data.db
Размер: 45.2 MB
```

## Важно

- **Один BOT_TOKEN = один long-polling listener.** Нельзя запускать бота одновременно на VPS и Pi.
- Бот на Pi отключён (`sudo systemctl disable telegram-bot`).
- Бот не использует npm-зависимости — только встроённые модули Node.js (https, child_process).

---

## Уведомление о появлении Raspberry Pi в сети

Чтобы снова получать IP малины при старте, используйте отдельный oneshot-сервис без polling:

- Скрипт: `pi-online-notify.sh`
- Сервис: `pi-online-notify.service`
- Конфиг: `/etc/ege-app/pi-notify.env`

### Почему это работает вместе с VPS-ботом

`pi-online-notify` только отправляет `sendMessage` и не вызывает `getUpdates`, поэтому не конфликтует с long-polling демоном на VPS.

### Быстрая настройка на Raspberry Pi

```bash
sudo nano /etc/ege-app/pi-notify.env
# заполнить BOT_TOKEN и CHAT_ID

sudo systemctl daemon-reload
sudo systemctl enable pi-online-notify.service
sudo systemctl start pi-online-notify.service
sudo systemctl status pi-online-notify.service
```
