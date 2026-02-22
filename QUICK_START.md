# 🚀 Быстрый старт EGE Tasks

## Запуск приложения (одной командой!)

### Самый простой способ:

```bash
./start.sh
```
С локальным PDF сервисом:
```bash
./start.sh --local-pdf
```

Или через NPM:

```bash
npm run dev          # только frontend (backend на VPS)
npm run dev:local-pdf
```

**Запускается:**
- Backend (PocketBase): https://task-ege.oipav.ru (VPS)
- Frontend: http://localhost:5173
- PDF Service: http://localhost:3001 (опционально, в режиме `--local-pdf`)

### Первый запуск (с установкой зависимостей):

```bash
npm run install:all  # Установить все зависимости
npm run dev          # Запустить всё
```
### Остановка:

```bash
Ctrl+C              # в терминале
# или
./stop.sh           # скрипт остановки
```

---

## Новая фича: Экспорт PDF через Puppeteer

После запуска PDF сервиса в генераторах появится переключатель:

- **🚀 Новый** - Puppeteer (высокое качество, идеальный KaTeX)
- **Обычный** - html2pdf.js (старый метод, работает оффлайн)

### Преимущества нового метода:

✅ Идеальное качество формул
✅ Векторный текст (копируемый)
✅ В 2-3 раза меньше размер файла
✅ В 1.5-2 раза быстрее генерация

---

## Структура проекта

```
generation-test/
├── pocketbase/           # Backend
│   ├── pocketbase        # Исполняемый файл
│   ├── pdf-service.js    # PDF генерация (Node.js)
│   ├── pb_hooks/         # PocketBase hooks
│   └── start-all.sh      # Скрипт запуска
├── ege-tasks/            # Frontend (React)
│   ├── src/
│   │   ├── components/   # React компоненты
│   │   ├── hooks/        # Кастомные хуки
│   │   └── services/     # API сервисы
│   └── package.json
└── source/               # Исходные задачи (Markdown)
```

---

## Полезные команды

### Корень проекта
```bash
npm run dev           # Frontend (VPS backend)
npm run dev:local-pdf # Frontend + локальный PDF сервис
```

### Backend
```bash
npm run pdf       # Только PDF сервис
```

### Frontend
```bash
npm run dev       # Development
npm run build     # Production build
```

### Парсеры
```bash
python pb_parser.py              # Загрузить задачи
python pb_parser_theory.py       # Загрузить теорию
```

---

## Документация

- **Архитектура:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Изменения:** [CHANGELOG.md](CHANGELOG.md)
- **Каталог/дубли:** [README.MD](README.MD#основные-возможности)
- **Запуск без PDF:** [README.MD](README.MD#быстрый-запуск-из-корня-проекта)
- **PDF Экспорт:** [PDF_EXPORT_UPGRADE.md](PDF_EXPORT_UPGRADE.md)
- **Подробно:** [README.MD](README.MD)
- **AI Контекст:** [CLAUDE.MD](CLAUDE.MD)

---

**Быстрая помощь:** Если что-то не работает, проверьте доступность VPS backend `https://task-ege.oipav.ru/api/health` и локального PDF сервиса `http://localhost:3001/health` (если используете локальный PDF).
