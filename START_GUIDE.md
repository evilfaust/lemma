# 🚀 Руководство по запуску EGE Tasks Manager

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

Одна команда запускает **3 сервиса одновременно**:

| Сервис | URL | Описание |
|--------|-----|----------|
| **PocketBase** | http://127.0.0.1:8090 | Backend + Database |
| **PDF Service** | http://localhost:3001 | PDF генерация (Puppeteer) |
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
npm run dev              # Запустить все сервисы
npm run install:all      # Установить зависимости везде
npm start                # Alias для npm run dev
```

### Запуск отдельных сервисов:
```bash
npm run dev:backend      # Только PocketBase
npm run dev:pdf          # Только PDF Service
npm run dev:frontend     # Только Frontend
```

---

## Доступные эндпоинты

### PocketBase (Backend)
- **API**: http://127.0.0.1:8090/api/
- **Admin**: http://127.0.0.1:8090/_/

### PDF Service
- **Health**: http://localhost:3001/health
- **Generate**: POST http://localhost:3001/generate

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
lsof -i :8090           # Проверить кто занял порт
lsof -i :3001
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
curl http://localhost:3001/health
```

**Должен вернуть**:
```json
{
  "status": "ok",
  "service": "puppeteer-pdf",
  "puppeteer": "installed"
}
```

---

## Разработка

### Логи в реальном времени

Concurrently показывает логи всех сервисов с цветовой маркировкой:
- 🔵 **Синий** - Backend (PocketBase)
- 🟣 **Фиолетовый** - PDF Service
- 🟢 **Зелёный** - Frontend

### Hot Reload

- **Frontend** - автоматическая перезагрузка при изменении файлов
- **Backend** - требует перезапуска (Ctrl+C, затем `npm run dev`)
- **PDF Service** - требует перезапуска

---

## Дополнительная информация

- [README.MD](README.MD) - Полная документация
- [QUICK_START.md](QUICK_START.md) - Быстрый старт
- [PDF_EXPORT_UPGRADE.md](PDF_EXPORT_UPGRADE.md) - PDF экспорт
- [CLAUDE.MD](CLAUDE.MD) - Контекст для AI

---

**Готово!** Теперь запуск всего проекта занимает одну команду 🎉
