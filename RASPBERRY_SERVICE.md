# Развертывание EGE Tasks Manager на Raspberry Pi

## Обзор

Данная инструкция описывает развертывание production-версии приложения на Raspberry Pi с возможностью доступа извне через проброс портов.

### Архитектура

**Основной режим работы (не меняется):**
- Вы запускаете `./start.sh` на MacBook в школьной локальной сети
- Ученики подключаются к `http://192.168.X.X:5173` (ваш локальный IP)
- Работа в dev-режиме с мгновенными обновлениями

**Дополнительный режим (Raspberry Pi):**
- Production-версия на Raspberry Pi в домашней сети
- Доступно локально по `http://192.168.1.68`
- Доступно извне через проброс портов (при наличии белого IP)
- База данных синхронизируется с основной (Mac) по требованию
- Обновляется вручную скриптом `deploy-to-raspberry.sh`

### Структура на Raspberry Pi

```
/home/faust/ege-app/
├── pocketbase/           # Backend
│   ├── pocketbase        # Исполняемый файл PocketBase
│   ├── pb_data/          # База данных (синхронизируется с Mac)
│   ├── pb_hooks/         # PocketBase hooks
│   ├── pb_migrations/    # Миграции БД
│   ├── pdf-service.js    # PDF-сервис (Puppeteer)
│   ├── code.js           # Генератор кодов задач
│   ├── package.json      # Зависимости Node.js
│   └── node_modules/     # Установленные пакеты
├── frontend/             # Собранный фронтенд (React production build)
└── backups/              # Локальные бэкапы БД на малине
```

### Сервисы

1. **PocketBase** (`pocketbase.service`)
   - Порт: `127.0.0.1:8090` (доступен только через nginx)
   - API: `/api/*`
   - Admin: `/_/*`

2. **PDF Service** (`pdf-service.service`)
   - Порт: `127.0.0.1:3001` (доступен только через nginx)
   - Endpoint: `/pdf/*`

3. **Nginx**
   - Порт: `80` (публичный доступ)
   - Раздает статический фронтенд
   - Проксирует запросы к PocketBase и PDF Service

---

## Первоначальная настройка (выполняется один раз)

### Шаг 1: Подготовка Raspberry Pi

1. **Установите Raspberry Pi OS Lite** (рекомендуется 64-bit)
2. **Настройте SSH:**
   - Включите SSH через `raspi-config`
   - Убедитесь, что можете подключиться: `ssh faust@192.168.1.68`

3. **Проверьте наличие пароля:**
   - Логин: `faust`
   - Пароль: `Zxasqw12#` (или настройте SSH-ключи для безопасности)

### Шаг 2: Копирование конфигов на Raspberry Pi

На вашем **Mac**, из директории проекта:

```bash
cd /Users/evilfaust/Documents/APP/generation-test
./raspberry/copy-configs-to-raspberry.sh
```

Этот скрипт:
- Проверит SSH-соединение
- Скопирует конфигурационные файлы на малину в `/home/faust/ege-app-setup/`

### Шаг 3: Первичная настройка на Raspberry Pi

Подключитесь к Raspberry Pi:

```bash
ssh faust@192.168.1.68
```

Запустите скрипт первичной настройки:

```bash
cd /home/faust/ege-app-setup
chmod +x setup-raspberry.sh
./setup-raspberry.sh
```

Скрипт установит:
- ✅ Node.js 18.x
- ✅ Nginx
- ✅ Зависимости для Puppeteer (Chromium + библиотеки)
- ✅ Systemd сервисы (автозапуск PocketBase и PDF Service)

После установки можете выйти из SSH:

```bash
exit
```

---

## Деплой приложения (выполняется при каждом обновлении)

### Когда делать деплой

- После внесения значительных изменений в код
- Когда хотите "заморозить" стабильную версию на малине
- Когда база данных обновилась (новые задачи, темы, и т.д.)

### Запуск деплоя

На вашем **Mac**, из директории проекта:

```bash
cd /Users/evilfaust/Documents/APP/generation-test
./raspberry/deploy-to-raspberry.sh
```

### Что делает скрипт деплоя

1. ✅ **Бэкап локальной БД** (на Mac) — `./backup.sh`
2. ✅ **Бэкап БД на малине** (через SSH, в `/home/faust/ege-app/backups/`)
3. ✅ **Сборка фронтенда** — `cd ege-tasks && npm run build`
4. ✅ **Остановка сервисов** на малине
5. ✅ **Синхронизация файлов** (rsync):
   - PocketBase (бинарник, hooks, migrations, pdf-service)
   - База данных (`pb_data/`)
   - Собранный фронтенд (`dist/` → `frontend/`)
6. ✅ **Установка зависимостей** на малине (`npm install`)
7. ✅ **Запуск сервисов**

### Ожидаемый вывод

```
========================================
  EGE Tasks Manager - Deploy to RPi
========================================

📡 Проверка SSH-соединения...
✅ SSH-соединение установлено

📦 [1/7] Создание бэкапа локальной БД на Mac...
✅ Локальный бэкап создан

📦 [2/7] Создание бэкапа БД на Raspberry Pi...
✅ Бэкап на малине создан

🔨 [3/7] Сборка фронтенда...
✅ Фронтенд собран

🛑 [4/7] Остановка сервисов на Raspberry Pi...
✅ Сервисы остановлены

🔄 [5/7] Синхронизация файлов...
✅ Файлы синхронизированы

📦 [6/7] Установка зависимостей...
✅ Зависимости установлены

🚀 [7/7] Запуск сервисов...
✅ Сервисы запущены

========================================
✅ Деплой завершен успешно!
========================================

🌐 Приложение доступно по адресу:
   http://192.168.1.68
```

---

## Проброс портов для доступа извне

### Вариант 1: Настройка на роутере (рекомендуется)

1. **Зайдите в админ-панель роутера** (обычно `192.168.1.1` или `192.168.0.1`)

2. **Найдите раздел Port Forwarding / NAT / Virtual Servers**

3. **Создайте правило:**
   - **Название:** EGE Tasks Manager
   - **Внешний порт:** 80 (или любой другой, например 8080)
   - **Внутренний IP:** 192.168.1.68
   - **Внутренний порт:** 80
   - **Протокол:** TCP

4. **Сохраните и перезагрузите роутер**

5. **Узнайте ваш внешний IP:**
   ```bash
   curl ifconfig.me
   ```

6. **Проверьте доступ извне:**
   - Откройте браузер на устройстве вне домашней сети (например, с мобильного интернета)
   - Перейдите на `http://ВАШ_ВНЕШНИЙ_IP` (или `http://ВАШ_ВНЕШНИЙ_IP:8080`, если прокинули на 8080)

### Вариант 2: HTTPS и доменное имя (опционально, для продвинутых)

Если хотите использовать домен и HTTPS:

1. **Зарегистрируйте бесплатный домен** на DuckDNS, No-IP или другом сервисе динамического DNS
2. **Настройте автоматическое обновление IP** на Raspberry Pi (скрипт cron)
3. **Установите Certbot** для получения SSL-сертификата:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d ваш-домен.duckdns.org
   ```
4. **Обновите конфиг nginx** для работы на 443 порту

---

## Управление сервисами на Raspberry Pi

### Проверка статуса

```bash
ssh faust@192.168.1.68

# Проверка всех сервисов
sudo systemctl status pocketbase
sudo systemctl status pdf-service
sudo systemctl status nginx
```

### Перезапуск сервисов

```bash
# Перезапуск PocketBase
sudo systemctl restart pocketbase

# Перезапуск PDF Service
sudo systemctl restart pdf-service

# Перезапуск Nginx
sudo systemctl restart nginx
```

### Просмотр логов

```bash
# Логи PocketBase (real-time)
sudo journalctl -u pocketbase -f

# Логи PDF Service
sudo journalctl -u pdf-service -f

# Логи Nginx (ошибки)
sudo tail -f /var/log/nginx/ege-app-error.log

# Логи Nginx (доступ)
sudo tail -f /var/log/nginx/ege-app-access.log
```

### Остановка/Запуск сервисов

```bash
# Остановка
sudo systemctl stop pocketbase
sudo systemctl stop pdf-service

# Запуск
sudo systemctl start pocketbase
sudo systemctl start pdf-service
```

---

## Восстановление из бэкапа

### На Raspberry Pi

Если нужно восстановить БД на малине из бэкапа:

```bash
ssh faust@192.168.1.68
cd /home/faust/ege-app

# Остановить PocketBase
sudo systemctl stop pocketbase

# Посмотреть список бэкапов
ls -lht backups/

# Восстановить из бэкапа (замените дату)
tar -xzf backups/backup_2026-02-16_15-30-00.tar.gz

# Запустить PocketBase
sudo systemctl start pocketbase
```

### На Mac

Бэкапы с Mac остаются в `generation-test/backups/`, восстановление через `./restore.sh` (как обычно).

---

## Безопасность

### Рекомендации

1. **Настройте SSH-ключи** вместо пароля:
   ```bash
   ssh-copy-id faust@192.168.1.68
   ```

2. **Отключите вход по паролю** в `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   ```

3. **Включите fail2ban** для защиты от брутфорса:
   ```bash
   sudo apt-get install fail2ban
   ```

4. **Если пробрасываете порты наружу:**
   - Используйте нестандартный порт (не 80, например 8888)
   - Настройте HTTPS (Certbot + Let's Encrypt)
   - Ограничьте доступ к админ-панели PocketBase (`/_/`) только для локальной сети

5. **Регулярно обновляйте систему:**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

---

## Мониторинг производительности

### Проверка ресурсов

```bash
# CPU/RAM/Temperature
htop

# Температура CPU (для Raspberry Pi)
vcgencmd measure_temp

# Место на диске
df -h
```

### Оптимизация для Raspberry Pi

Если приложение работает медленно:

1. **Уменьшите лимиты памяти** в systemd-сервисах (по умолчанию 512MB для PocketBase, 768MB для PDF)
2. **Используйте swap** (если RAM < 2GB):
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile  # CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

3. **Отключите PDF-сервис**, если не используется:
   ```bash
   sudo systemctl disable pdf-service
   sudo systemctl stop pdf-service
   ```
   В этом случае будет использоваться fallback на `html2pdf.js` в браузере.

---

## Отладка проблем

### Приложение не открывается

1. **Проверьте статус nginx:**
   ```bash
   sudo systemctl status nginx
   sudo nginx -t  # Проверка конфигурации
   ```

2. **Проверьте доступность фронтенда:**
   ```bash
   ls -la /home/faust/ege-app/frontend/
   # Должны быть index.html, assets/, и т.д.
   ```

### API не работает (ошибки загрузки данных)

1. **Проверьте PocketBase:**
   ```bash
   sudo systemctl status pocketbase
   sudo journalctl -u pocketbase -n 50
   ```

2. **Проверьте доступность API:**
   ```bash
   curl http://127.0.0.1:8090/api/health
   ```

### PDF не генерируется

1. **Проверьте PDF Service:**
   ```bash
   sudo systemctl status pdf-service
   sudo journalctl -u pdf-service -n 50
   ```

2. **Проверьте зависимости Puppeteer:**
   ```bash
   chromium-browser --version
   ```

3. **Тест PDF-сервиса:**
   ```bash
   curl -X POST http://127.0.0.1:3001/health
   ```

### Не хватает памяти

Если в логах ошибки `Out of Memory`:

1. Увеличьте swap (см. раздел "Оптимизация")
2. Уменьшите лимиты в systemd-сервисах
3. Используйте Raspberry Pi с бОльшим объемом RAM (рекомендуется 2GB+)

---

## Структура файлов проекта

```
generation-test/
├── raspberry/                          # Конфигурации для Raspberry Pi
│   ├── deploy-to-raspberry.sh          # Основной скрипт деплоя (Mac → RPi)
│   ├── copy-configs-to-raspberry.sh    # Копирование конфигов перед setup
│   ├── setup-raspberry.sh              # Первичная настройка на RPi (один раз)
│   ├── nginx.conf                      # Конфиг Nginx
│   ├── pocketbase.service              # Systemd сервис PocketBase
│   └── pdf-service.service             # Systemd сервис PDF
└── RASPBERRY_SERVICE.md                # Эта документация
```

---

## FAQ

### Можно ли одновременно работать с Mac и Raspberry Pi?

**Да**, но база данных будет разной:
- На **Mac** — текущая рабочая БД (live, постоянно обновляется)
- На **Raspberry Pi** — "заморозка" на момент последнего деплоя

При следующем деплое БД на малине будет **перезаписана** актуальной с Mac.

### Что происходит с данными на малине при деплое?

1. Создается бэкап БД малины в `/home/faust/ege-app/backups/`
2. БД полностью заменяется на актуальную с Mac
3. Старые бэкапы автоматически удаляются (хранятся последние 10)

**Важно:** Если ученики проходят тесты на малине, их результаты будут потеряны при следующем деплое! Для решения этой проблемы в будущем можно настроить двустороннюю синхронизацию.

### Можно ли настроить автоматический деплой?

Да, можно настроить cron на Mac для автоматического деплоя, например, каждую ночь:

```bash
crontab -e
# Добавить строку (деплой каждый день в 3:00):
0 3 * * * cd /Users/evilfaust/Documents/APP/generation-test && ./raspberry/deploy-to-raspberry.sh >> /tmp/rpi-deploy.log 2>&1
```

### Можно ли использовать несколько Raspberry Pi?

Да, нужно:
1. Изменить IP в `deploy-to-raspberry.sh`
2. Запустить деплой для каждой малины отдельно
3. Или создать несколько скриптов `deploy-to-raspberry-1.sh`, `deploy-to-raspberry-2.sh` с разными IP

### Как обновить код приложения без перезаливки БД?

Можно модифицировать `deploy-to-raspberry.sh`, закомментировав синхронизацию `pb_data/`:

```bash
# echo "  → Синхронизация базы данных (pb_data)..."
# rsync -avz --delete \
#     "$LOCAL_PROJECT_DIR/pocketbase/pb_data/" \
#     "$RASPBERRY_USER@$RASPBERRY_IP:$RASPBERRY_APP_DIR/pocketbase/pb_data/"
```

Но **рекомендуется** всегда синхронизировать БД, чтобы избежать несоответствия версий.

---

## Контрольный чеклист

### Первоначальная настройка (один раз):
- [ ] Raspberry Pi настроена (SSH, пароль/ключи)
- [ ] Запущен `copy-configs-to-raspberry.sh` с Mac
- [ ] На RPi выполнен `setup-raspberry.sh`
- [ ] Сервисы запущены и работают (`systemctl status`)

### Деплой (каждый раз):
- [ ] Убедиться, что на Mac актуальная версия кода и БД
- [ ] Запустить `./raspberry/deploy-to-raspberry.sh`
- [ ] Проверить доступность приложения: `http://192.168.1.68`
- [ ] Проверить работу API и PDF-генерации

### Проброс портов (опционально):
- [ ] Настроен Port Forwarding на роутере
- [ ] Проверен доступ извне по внешнему IP
- [ ] (Опционально) Настроен HTTPS + домен

---

## Поддержка

Если возникли проблемы:

1. Проверьте логи сервисов (см. раздел "Управление сервисами")
2. Убедитесь, что все зависимости установлены (`node -v`, `nginx -v`, `chromium-browser --version`)
3. Проверьте доступность портов (`sudo netstat -tlnp`)
4. Попробуйте перезапустить сервисы

**Удачи с развертыванием!** 🚀
