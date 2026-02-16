# Telegram Bot для мониторинга Raspberry Pi

## 📱 Описание

Telegram-бот автоматически отправляет уведомление о подключении Raspberry Pi к сети и позволяет управлять сервисами через команды.

## 🎯 Возможности

### Автоматические уведомления

При загрузке Raspberry Pi бот отправит сообщение с:
- 🌐 IP-адресом
- 📡 Именем Wi-Fi сети
- ✅ Статусом сервисов (PocketBase, PDF, Nginx)
- 🔗 Прямой ссылкой на приложение

### Команды бота

| Команда | Описание |
|---------|----------|
| `/status` | Статус сервисов и системы |
| `/ip` | Текущий IP-адрес и сеть |
| `/stats` | Использование ресурсов (RAM, CPU, диск) |
| `/restart` | Перезапустить все сервисы |
| `/notify` | Отправить полное уведомление о статусе |
| `/help` | Список всех команд |

## ⚙️ Конфигурация

### Telegram Bot Token и Chat ID

Настроены в файле `telegram-bot.js`:
```javascript
const BOT_TOKEN = '8094410045:AAGD7DID-odRPOdwEpk85GhhTtsqQgRPZO4';
const CHAT_ID = '328497552';
```

### Как изменить Bot Token или Chat ID

1. **Отредактировать на Mac:**
   ```bash
   nano raspberry/telegram-bot.js
   # Изменить BOT_TOKEN и CHAT_ID в начале файла
   ```

2. **Задеплоить на Raspberry Pi:**
   ```bash
   ./raspberry/deploy-to-raspberry.sh
   ```

3. **Перезапустить бота:**
   ```bash
   ssh faust@192.168.1.68
   sudo systemctl restart telegram-bot
   ```

## 🚀 Установка

### Первичная установка (уже выполнена)

Бот устанавливается автоматически при первичной настройке:
```bash
./raspberry/copy-configs-to-raspberry.sh
ssh faust@192.168.1.68
cd /home/faust/ege-app-setup
./setup-raspberry.sh
```

### Обновление бота

При любом деплое бот автоматически обновляется:
```bash
./raspberry/deploy-to-raspberry.sh
```

## 🔧 Управление сервисом

### Проверка статуса
```bash
ssh faust@192.168.1.68
sudo systemctl status telegram-bot
```

### Просмотр логов
```bash
# Последние 50 строк
sudo journalctl -u telegram-bot -n 50

# Режим реального времени
sudo journalctl -u telegram-bot -f
```

### Перезапуск
```bash
sudo systemctl restart telegram-bot
```

### Остановка/запуск
```bash
sudo systemctl stop telegram-bot
sudo systemctl start telegram-bot
```

### Отключение автозапуска
```bash
sudo systemctl disable telegram-bot
```

### Включение автозапуска
```bash
sudo systemctl enable telegram-bot
```

## 📋 Как это работает

### 1. При загрузке Raspberry Pi

```
1. Systemd запускает telegram-bot.service
2. Ждет 10 секунд (пока подключится к Wi-Fi)
3. Отправляет уведомление в Telegram (режим startup)
4. Запускает демона для прослушивания команд (режим daemon)
```

### 2. При получении команды от пользователя

```
1. Бот получает сообщение через Telegram API (long polling)
2. Проверяет Chat ID (безопасность)
3. Выполняет соответствующую команду
4. Отправляет результат в Telegram
```

### 3. Режимы работы

**Startup режим** (выполняется один раз при загрузке):
```bash
node telegram-bot.js startup
```

**Daemon режим** (постоянно работает и слушает команды):
```bash
node telegram-bot.js daemon
```

## 🛡️ Безопасность

### Проверка Chat ID
Бот отвечает только на команды от пользователя с Chat ID: `328497552`

### Ограничения ресурсов
Systemd ограничивает использование ресурсов:
- Максимум 100 MB RAM
- Максимум 10% CPU

### Автоперезапуск
При сбое бот автоматически перезапускается через 10 секунд.

## 🧪 Тестирование

### Тест отправки уведомления
```bash
ssh faust@192.168.1.68
cd /home/faust/ege-app/raspberry
node telegram-bot.js startup
```

### Тест команд
```bash
# Запустить бота в режиме daemon
node telegram-bot.js daemon

# В Telegram написать боту команду, например: /status
```

## 🔍 Устранение проблем

### Бот не отправляет уведомления

1. **Проверить статус сервиса:**
   ```bash
   sudo systemctl status telegram-bot
   ```

2. **Посмотреть логи:**
   ```bash
   sudo journalctl -u telegram-bot -n 100
   ```

3. **Проверить сетевое подключение:**
   ```bash
   ping -c 3 api.telegram.org
   ```

4. **Проверить Bot Token:**
   ```bash
   curl https://api.telegram.org/bot8094410045:AAGD7DID-odRPOdwEpk85GhhTtsqQgRPZO4/getMe
   ```

### Бот не отвечает на команды

1. **Проверить режим работы:**
   ```bash
   ps aux | grep telegram-bot
   # Должны быть 2 процесса: startup и daemon
   ```

2. **Перезапустить сервис:**
   ```bash
   sudo systemctl restart telegram-bot
   ```

3. **Проверить Chat ID:**
   - Напишите боту любое сообщение
   - Проверьте логи: `sudo journalctl -u telegram-bot -f`
   - Если Chat ID не совпадает, бот проигнорирует команду

### Ошибка "Permission denied"

Проверить права на файл:
```bash
ls -la /home/faust/ege-app/raspberry/telegram-bot.js
chmod +x /home/faust/ege-app/raspberry/telegram-bot.js
```

## 📊 Примеры уведомлений

### При загрузке (автоматическое)
```
🟢 Raspberry Pi подключен!

📡 Сеть: VZMAKH_5G
🌐 IP: 192.168.0.105

Статус сервисов:
✅ PocketBase: running
✅ PDF Service: running
✅ Nginx: running

🔗 Приложение: http://192.168.0.105
⚙️ Admin: http://192.168.0.105/_/

💡 Доступные команды: /status, /ip, /stats, /restart
```

### /status
```
📊 Статус Raspberry Pi

Сервисы:
✅ PocketBase: running
✅ PDF Service: running
✅ Nginx: running

Система:
💾 RAM: 247Mi/906Mi
🌡 Температура: 45.2°C
💿 Диск: 3.2G/14G (24%)
⏱ Uptime: up 2 hours, 34 minutes
```

### /ip
```
🌐 Сетевая информация

📡 Wi-Fi: VZMAKH_5G
🌐 IP: 192.168.0.105

🔗 http://192.168.0.105
```

### /stats
```
📈 Использование ресурсов

💾 Память: 247Mi/906Mi
🌡 Температура CPU: 45.2°C
💿 Диск: 3.2G/14G (24%)
⏱ Время работы: up 2 hours, 34 minutes
```

### /restart
```
🔄 Сервисы перезапущены

✅ PocketBase
✅ PDF Service
✅ Nginx
```

## 🎓 Сценарии использования

### Дома → Школа

1. Выключить Raspberry Pi дома
2. Принести в школу
3. Включить питание
4. Через 10-20 секунд получить сообщение в Telegram с IP-адресом в школьной сети
5. Открыть приложение по полученному IP

### Школа → Дом

1. Выключить Raspberry Pi в школе
2. Принести домой
3. Включить питание
4. Получить сообщение с домашним IP (192.168.1.68)

### Проверка статуса из любой точки

В любой момент можно написать боту команду `/status` или `/ip` и получить актуальную информацию.

## 🔄 Обновление версии

При изменении логики бота:

1. **Отредактировать `telegram-bot.js`** на Mac
2. **Задеплоить:**
   ```bash
   ./raspberry/deploy-to-raspberry.sh
   ```
3. **Перезапустить бота на Raspberry Pi:**
   ```bash
   ssh faust@192.168.1.68 "sudo systemctl restart telegram-bot"
   ```

## 📖 Дополнительная информация

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)

## 🎯 Roadmap (возможные улучшения)

- [ ] Webhook вместо long polling (быстрее, меньше ресурсов)
- [ ] Уведомление при изменении IP-адреса (мониторинг в фоне)
- [ ] Команда `/logs` для просмотра логов сервисов
- [ ] Команда `/backup` для создания резервной копии БД
- [ ] Графики использования ресурсов (через Chart.js + Canvas)
- [ ] Уведомления о критических ошибках (автоматический мониторинг)
