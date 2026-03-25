# 🚀 Руководство по запуску Lemma

## Быстрый старт (одной командой)

### Вариант 1: Bash скрипт (рекомендуется)
```bash
./start.sh
```

### Вариант 2: NPM команда
```bash
npm run dev
```

### Вариант 3: С установкой зависимостей
```bash
npm run install:all  # Установить все зависимости
npm run dev          # Запустить все сервисы
```

---

## Что запускается

В стандартном режиме запускается frontend, backend используется на VPS:

| Сервис | URL | Описание |
|--------|-----|----------|
| **PocketBase (VPS)** | https://task-ege.oipav.ru | Backend + Database |
| **PDF Service (VPS)** | https://task-ege.oipav.ru/pdf | PDF генерация (Puppeteer) |
| **Frontend** | http://localhost:5173 | React приложение |

---

## Остановка всех сервисов

### Вариант 1: В терминале
```bash
Ctrl+C
```

### Вариант 2: Bash скрипт
```bash
./stop.sh
```

---

## Первый запуск

1. **Установите зависимости** (только первый раз):
```bash
npm run install:all
```

2. **Запустите приложение**:
```bash
npm run dev
```

3. **Откройте в браузере**:
```
http://localhost:5173
```

---

## Структура команд

### Корневые команды (из корня проекта):
```bash
npm run dev              # Frontend (VPS backend/PDF)
npm run install:all      # Установить зависимости везде
npm start                # Alias для npm run dev
```

---

## Доступные эндпоинты

### PocketBase (Backend)
- **API**: https://task-ege.oipav.ru/api/
- **Admin**: https://task-ege.oipav.ru/_/

### PDF Service
- **Health**: https://task-ege.oipav.ru/pdf/health
- **Generate**: POST https://task-ege.oipav.ru/pdf/generate

### Frontend
- **App**: http://localhost:5173

---

## Требования

- **Node.js**: >= 18.0.0
- **NPM**: >= 8.0.0
- **Браузер**: Chrome, Firefox, Safari (последние версии)

Проверить версии:
```bash
node -v   # должно быть >= v18.0.0
npm -v    # должно быть >= 8.0.0
```

---

## Решение проблем

### Порты заняты

**Ошибка**: "Port already in use"

**Решение**:
```bash
./stop.sh               # Остановить все процессы
lsof -i :5173
```

### Зависимости не установлены

**Ошибка**: "Cannot find module..."

**Решение**:
```bash
npm run install:all
```

### PDF Service не работает

**Проверить**:
```bash
curl https://task-ege.oipav.ru/pdf/health
```

---

## Разработка

### Логи в реальном времени

Concurrently показывает логи всех сервисов с цветовой маркировкой:
- 🟣 **Фиолетовый** - PDF Service
- 🟢 **Зелёный** - Frontend

### Hot Reload

- **Frontend** - автоматическая перезагрузка при изменении файлов
- **PDF Service** - требует перезапуска

---

## Дополнительная информация

- [README.MD](README.MD) - Полная документация
- [README.MD](README.MD#быстрый-запуск-из-корня-проекта) - Запуск с/без PDF
- [QUICK_START.md](QUICK_START.md) - Быстрый старт
- [PDF_EXPORT_UPGRADE.md](PDF_EXPORT_UPGRADE.md) - PDF экспорт
- [CLAUDE.MD](CLAUDE.MD) - Контекст для AI
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура компонентов (Каталог/Дубли)

---

**Готово!** Теперь запуск всего проекта занимает одну команду 🎉
