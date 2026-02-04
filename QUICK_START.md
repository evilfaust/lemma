# 🚀 Быстрый старт EGE Tasks

## Запуск приложения

### 1. Backend (PocketBase + PDF Service)

```bash
cd pocketbase
npm install        # Первый раз
npm run dev        # Запуск обоих сервисов
```

Или вручную:
```bash
cd pocketbase
./start-all.sh
```

**Проверка:**
- PocketBase: http://127.0.0.1:8090
- PDF Service: http://localhost:3001/health

### 2. Frontend (React)

```bash
cd ege-tasks
npm install        # Первый раз
npm run dev        # Запуск
```

**Откроется:** http://localhost:5173

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
│   ├── pb_data/          # База данных
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

### Backend
```bash
npm run start     # Только PocketBase
npm run pdf       # Только PDF сервис
npm run dev       # Оба сервиса
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
- **PDF Экспорт:** [PDF_EXPORT_UPGRADE.md](PDF_EXPORT_UPGRADE.md)
- **Подробно:** [README.MD](README.MD)
- **AI Контекст:** [CLAUDE.MD](CLAUDE.MD)

---

**Быстрая помощь:** Если что-то не работает, проверьте что оба сервиса запущены (PocketBase на :8090 и PDF на :3001)
