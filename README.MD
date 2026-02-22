# EGE Tasks Manager — Платформа для подготовки к ЕГЭ

## Описание проекта

**EGE Tasks Manager** — полнофункциональная веб-платформа для учителей математики, позволяющая управлять базой задач ЕГЭ, генерировать варианты контрольных и самостоятельных работ, проводить тесты для учеников онлайн, отслеживать результаты и мотивировать учеников через систему достижений.

Приложение состоит из **двух интерфейсов**:
- **Учительский** — управление задачами, генерация работ, выдача тестов, просмотр результатов
- **Ученический** — прохождение тестов, просмотр результатов, коллекция достижений

## Основные возможности

### Управление задачами
- Просмотр и фильтрация задач по темам, подтемам, тегам, сложности, источникам, годам, наличию изображений
- Поддержка LaTeX (KaTeX) и Markdown (GFM) для математических формул и форматирования
- Редактирование задач в интерфейсе (условие, ответ, решение, пояснение, метаданные)
- Система тегов с цветовой маркировкой
- Массовые операции: добавление/замена тегов, изменение сложности, источника, темы, подтем, удаление
- Импорт задач из Markdown-файлов и sdamgia.ru
- Создание задач через UI
- Уникальные коды задач (формат: `14-001`, `M17-003`)

### Генератор карточек
- Случайная выборка задач по критериям
- Три формата печати: A6 (4 на лист), A5 (2 на лист), A4 (1 на лист)
- Автоматическая генерация листа с ответами
- Сохранение карточек в БД
- Настраиваемые размеры шрифта: 10–21px

### Генератор «Устный счёт»
- Распределение задач по тегам или сложности с точным контролем количества
- Компактный режим для максимального количества задач на листе
- Grid layout: 1–3 варианта на одной странице A4
- Drag & Drop: перетаскивание задач внутри и между вариантами
- Фильтр префиксов: скрытие типовых фраз («Вычислите:», «Найдите значение выражения» и т.д.)
- Горизонтальная раскладка задач
- Автоматическая прогрессия сложности
- PDF экспорт (Puppeteer + html2pdf.js fallback)
- Размеры шрифта: 10pt, 12pt, 14pt, 16pt, 20pt

### Генератор контрольных работ
- Конструктор структуры с блоками задач из разных тем
- Независимые фильтры для каждого блока (тема, подтемы, сложность, теги, источник, год)
- Три режима генерации: разные задачи / одинаковые с перемешиванием / одинаковые
- Прогрессия сложности (опционально)
- Drag & Drop задач между вариантами
- Перемещение задач из одного варианта в другой
- Замена и редактирование задач прямо в варианте
- Сохранение/загрузка работ из БД
- Экспорт в PDF
- Настройки: колонки (1–3), шрифт (10–20pt), компактный режим, место для решения, поля для ФИО, лист ответов

### Редактор работ (WorkEditor)
- Список сохранённых работ с поиском и фильтрами (тема, статус: активные/архив)
- Метрики: количество сессий, попыток, средний результат
- Редактирование вариантов: добавление/удаление/перетаскивание задач
- Замена и редактирование отдельных задач
- Перемещение задач между вариантами
- Управление параметрами работы (название, тема, лимит времени)
- Архивирование работ (без удаления)
- Панель выдачи: создание сессии, QR-код, ссылка для учеников
- Просмотр результатов учеников с возможностью выдачи достижений
- Защита: при наличии попыток — только «Сохранить как новую»

### Система тестирования учеников
- Учитель создаёт сессию из работы и получает ссылку `/student/{sessionId}`
- Ученик открывает ссылку, регистрируется или входит (логин/пароль)
- Ученик получает вариант (round-robin распределение)
- Ответы автосохраняются в localStorage
- Автоматическая проверка ответов:
  - Числовое сравнение с epsilon (1e-6)
  - Поддержка дробей (`1/3`), LaTeX-дробей (`\frac{1}{3}`)
  - Альтернативные ответы через `|`
- Результат показывается сразу после отправки
- Повторная попытка — только через учителя

### Система достижений
- 30 предустановленных достижений с иконками
- **Случайные бейджи** (один за попытку):
  - Legendary (90%+ правильных)
  - Rare (70–89%)
  - Common (40–69%)
- **Условные достижения** (автоматическая разблокировка):
  - По результату: 100%, 90%+
  - По скорости: за 5 минут
  - По количеству: 1-я, 10-я, 50-я попытка
  - Специальные: ночная сова (после 22:00), ранняя пташка (до 08:00)
- Галерея достижений для ученика
- Учитель может выдать достижения вручную
- Включение/выключение достижений на уровне сессии
- Polling каждые 10 секунд для обновления выданных учителем наград

### Авторизация учеников
- Регистрация: имя + логин + пароль
- Авторизация через PocketBase Auth
- Привязка гостевых попыток к аккаунту при авторизации
- Панель прогресса: учитель видит всех зарегистрированных учеников, их попытки, средний балл, класс

### Статистика и аналитика
- Дашборд: распределение задач по темам, подтемам, тегам, сложности, источникам
- Облако тегов с переходом к задачам
- Поиск «белых пятен» в базе
- Каталог справочников с CRUD, обнаружением и объединением дублей

### Модуль теории
- Просмотр теоретических статей по категориям
- Редактирование статей (Monaco Editor) с поддержкой Markdown + LaTeX
- Связь теория → задачи по тегам
- Категории с CRUD
- Конструктор конспектов для печати с выбором статей и категорий

### PDF экспорт
- **Основной метод**: Puppeteer (headless Chrome) — микросервис на порту 3001
- **Запасной метод**: html2pdf.js (автоматическое переключение)
- Высокое качество рендеринга KaTeX, векторный текст
- 2–3x меньший размер файлов по сравнению с html2pdf.js

### Импорт задач из sdamgia.ru
- Парсинг задач с сайта sdamgia.ru через PDF-сервис
- Автоматическая конвертация HTML-таблиц в Markdown
- Очистка LaTeX-формул из русскоязычных alt-текстов изображений

## Технологический стек

### Frontend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| React | 18.2 | UI библиотека |
| Vite | 5.0 | Сборщик и dev-сервер |
| Ant Design | 5.12 | UI компоненты |
| KaTeX | 0.16.9 | Рендеринг LaTeX формул |
| react-markdown + remark-gfm | 10.1 / 4.0 | Рендеринг Markdown |
| Monaco Editor | 4.7 | Редактор кода для теории |
| PocketBase SDK | 0.21 | Клиент API |
| DOMPurify | 3.3 | Санитизация HTML |
| html2pdf.js | 0.14 | Fallback PDF экспорт |
| qrcode.react | 4.2 | QR-коды для сессий |

### Backend
| Технология | Назначение |
|-----------|-----------|
| PocketBase | Backend-as-a-Service (SQLite, REST API, Auth, Files) |
| Express.js | PDF-сервис |
| Puppeteer | Генерация PDF |
| Cheerio | Парсинг HTML (sdamgia.ru) |

### Утилиты
| Технология | Назначение |
|-----------|-----------|
| Python 3.x | Парсеры задач (Markdown → PocketBase) |
| Node.js скрипты | Миграции, обслуживание БД |
| Shell скрипты | Запуск, остановка, бэкап, восстановление |

## Структура проекта

```
generation-test/
├── ege-tasks/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/           # React компоненты
│   │   │   ├── TaskList.jsx              # Список задач с фильтрацией
│   │   │   ├── TaskCard.jsx              # Карточка задачи
│   │   │   ├── TaskFilters.jsx           # Панель фильтров
│   │   │   ├── TaskEditModal.jsx         # Редактирование задачи
│   │   │   ├── TaskReplaceModal.jsx      # Замена задачи в варианте
│   │   │   ├── TaskSelectModal.jsx       # Выбор задачи из каталога
│   │   │   ├── TaskStatsDashboard.jsx    # Дашборд статистики
│   │   │   ├── TaskCatalogManager.jsx    # Каталог справочников
│   │   │   ├── TaskImporter.jsx          # Импорт задач
│   │   │   ├── MathRenderer.jsx          # Рендерер LaTeX + Markdown
│   │   │   ├── WorksheetGenerator.jsx    # Генератор карточек (A5/A6/A4)
│   │   │   ├── OralWorksheetGenerator.jsx # Генератор «Устный счёт»
│   │   │   ├── TestWorkGenerator.jsx     # Генератор контрольных работ
│   │   │   ├── WorkEditor.jsx            # Редактор сохранённых работ
│   │   │   ├── WorkEditorPage.jsx        # Страница редактора работ
│   │   │   ├── WorkManager.jsx           # Менеджер сохранённых работ
│   │   │   ├── PrintableWorksheet.jsx    # Печатная форма
│   │   │   ├── StudentProgressDashboard.jsx # Прогресс учеников (учитель)
│   │   │   ├── TheoryBrowser.jsx         # Просмотр теории
│   │   │   ├── TheoryEditor.jsx          # Редактор теории (Monaco)
│   │   │   ├── TheoryArticleView.jsx     # Просмотр статьи
│   │   │   ├── TheoryCategoryManager.jsx # Категории теории
│   │   │   ├── TheoryPrintBuilder.jsx    # Конструктор конспектов
│   │   │   ├── catalog/                  # Подкомпоненты каталога
│   │   │   │   ├── TopicTab.jsx
│   │   │   │   ├── SubtopicTab.jsx
│   │   │   │   ├── TagTab.jsx
│   │   │   │   ├── SourceTab.jsx
│   │   │   │   ├── OtherTab.jsx
│   │   │   │   ├── DuplicateTab.jsx
│   │   │   │   └── MergeModal.jsx
│   │   │   ├── worksheet/                # Переиспользуемые компоненты
│   │   │   │   ├── FilterBlock.jsx       # Блок фильтров
│   │   │   │   ├── VariantSettings.jsx   # Настройки вариантов
│   │   │   │   ├── FormatSettings.jsx    # Настройки форматирования
│   │   │   │   ├── VariantRenderer.jsx   # Рендер варианта
│   │   │   │   ├── VariantStats.jsx      # Статистика варианта
│   │   │   │   ├── AnswersPage.jsx       # Страница ответов
│   │   │   │   ├── DistributionPanel.jsx # Распределение задач
│   │   │   │   ├── ActionButtons.jsx     # Кнопки действий
│   │   │   │   ├── SaveWorkModal.jsx     # Сохранение работы
│   │   │   │   ├── LoadWorkModal.jsx     # Загрузка работы
│   │   │   │   ├── SessionPanel.jsx      # Панель сессии
│   │   │   │   └── TeacherResultsDashboard.jsx # Результаты учеников
│   │   │   └── student/                  # Компоненты ученика
│   │   │       ├── StudentAuthPage.jsx   # Авторизация
│   │   │       ├── StudentEntryPage.jsx  # Стартовая страница теста
│   │   │       ├── StudentTestPage.jsx   # Прохождение теста
│   │   │       ├── StudentResultPage.jsx # Результаты
│   │   │       ├── AchievementBadge.jsx  # Бейдж достижения
│   │   │       ├── AchievementGallery.jsx # Галерея достижений
│   │   │       └── StudentApp.jsx        # Корневой компонент ученика
│   │   ├── hooks/                # Custom React hooks (12)
│   │   │   ├── useWorksheetGeneration.js # Генерация вариантов
│   │   │   ├── useTaskDragDrop.js        # Drag & Drop
│   │   │   ├── useWorksheetActions.js    # Печать, PDF, сохранение
│   │   │   ├── usePuppeteerPDF.js        # PDF через Puppeteer
│   │   │   ├── useTaskEditing.js         # Редактирование задач
│   │   │   ├── useDistribution.js        # Распределение задач
│   │   │   ├── useTaskImport.js          # Импорт задач
│   │   │   ├── useStudentSession.js      # Сессия ученика
│   │   │   ├── useMarkdownProcessor.js   # Обработка Markdown
│   │   │   ├── useAutosave.js            # Автосохранение
│   │   │   ├── useKeyboardShortcuts.js   # Горячие клавиши
│   │   │   └── useDocumentStats.js       # Статистика документа
│   │   ├── services/
│   │   │   ├── pocketbase.js             # API клиент (все запросы)
│   │   │   └── pocketbaseUrl.js          # Базовый URL
│   │   ├── utils/
│   │   │   ├── achievementEngine.js      # Движок достижений
│   │   │   ├── answerChecker.js          # Проверка ответов
│   │   │   ├── filterTaskText.js         # Фильтр префиксов задач
│   │   │   ├── taskCodeGenerator.js      # Генератор кодов задач
│   │   │   ├── markdownTaskParser.js     # Парсер Markdown
│   │   │   ├── theoryThemes.js           # Темы теории
│   │   │   ├── shuffle.js                # Fisher-Yates shuffle
│   │   │   ├── escapeFilter.js           # Экранирование фильтров PB
│   │   │   └── normalize.js              # Нормализация текста
│   │   ├── contexts/
│   │   │   └── ReferenceDataContext.jsx   # Глобальные справочники
│   │   ├── App.jsx               # Учительский интерфейс + роутинг
│   │   ├── App.css               # Стили
│   │   └── main.jsx              # Точка входа (dual routing)
│   ├── package.json
│   └── vite.config.js
│
├── pocketbase/                   # Backend
│   ├── pocketbase                # Исполняемый файл PocketBase
│   ├── pb_migrations/            # Миграции схемы/коллекций
│   ├── pb_hooks/
│   │   └── pdf.pb.js             # PDF-хук для PocketBase
│   ├── pdf-service.js            # Standalone PDF-сервис (Puppeteer)
│   ├── code.js                   # Генерация кодов задач
│   ├── package.json
│   └── start-all.sh
│
├── source/                       # Исходные Markdown-файлы задач
│   ├── *.md                      # Задачи из Решу ЕГЭ
│   └── mordkovich/               # Задачи из учебника Мордковича
│
├── backups/                      # Бэкапы базы данных
│
├── pb_parser.py                  # Парсер задач из Решу ЕГЭ
├── pb_parser_mordkovich.py       # Парсер задач Мордковича
├── pb_parser_theory.py           # Парсер статей теории
├── generate_task_code.py         # Генератор кодов задач
├── 12+ утилит Python             # fix-*, recolor_*, sync_*, и т.д.
│
├── start.sh                      # Запуск всех сервисов
├── stop.sh                       # Остановка всех сервисов
├── backup.sh                     # Создание бэкапа БД
├── restore.sh                    # Восстановление из бэкапа
└── package.json                  # Корневой (concurrently)
```

## Структура базы данных

### Основные коллекции

#### topics — Темы ЕГЭ
```javascript
{
  id, title, section: "Алгебра" | "Геометрия",
  ege_number: number,  // Номер задания ЕГЭ (1-27)
  order, slug
}
```

#### subtopics — Подтемы
```javascript
{
  id, name, topic: relation → topics, order
}
```

#### tags — Теги
```javascript
{
  id, title, color: string  // hex
}
```

#### tasks — Задачи
```javascript
{
  id, code: string,          // "14-001", "M17-003"
  topic: relation → topics,
  subtopic: relation[] → subtopics,  // множественная
  tags: relation → tags,
  difficulty: number,        // 1 (базовый), 2 (средний), 3 (продвинутый)
  statement_md: text,        // Условие (Markdown + LaTeX)
  answer: string,
  solution_md: text,         // Решение
  explanation_md: text,      // Пояснение
  source: string, year: number,
  image: file, has_image: boolean
}
```

#### cards — Сохранённые карточки
```javascript
{
  id, title, tasks: relation[] → tasks,
  show_answers, show_solutions, format: "А6"|"А5"|"А4",
  layout: "one-column"|"two-column", note
}
```

#### works — Контрольные/самостоятельные работы
```javascript
{
  id, title, class: number,
  topic: relation → topics,
  time_limit: number  // минуты
}
```

#### variants — Варианты работ
```javascript
{
  id, work: relation → works,
  number: number, tasks: relation[] → tasks,
  order: json  // [{taskId, position}]
}
```

### Коллекции теории

#### theory_categories
```javascript
{ id, title, description, order, color }
```

#### theory_articles
```javascript
{
  id, title, category: relation → theory_categories,
  content_md: text,  // до 100000 символов
  order, summary, tags: json, theme_settings: json
}
```

### Коллекции тестирования

#### students — Учеников (Auth-коллекция)
```javascript
{
  id, username, password (hashed),
  name: string,           // Имя (обязательное)
  student_class: string   // Класс (опционально, до 20 символов)
}
```

#### work_sessions — Сессии тестирования
```javascript
{
  id, work: relation → works,
  is_open: boolean,
  host_override: string,
  achievements_enabled: boolean,
  student_title: string  // Заголовок для стартового экрана
}
```

#### attempts — Попытки учеников
```javascript
{
  id, session: relation → work_sessions,
  student: relation → students,  // опционально
  student_name, device_id,
  variant: relation → variants,
  status: "started"|"submitted"|"corrected",
  score: number, total: number,
  achievement: relation → achievements,         // случайный бейдж
  unlocked_achievements: relation[] → achievements, // условные
  duration_seconds: number,
  submitted_at, corrected_at
}
```

#### attempt_answers — Ответы по задачам
```javascript
{
  id, attempt: relation → attempts,
  task: relation → tasks,
  answer_raw, answer_normalized: number,
  is_correct: boolean
}
```

#### achievements — Достижения
```javascript
{
  id, code: string,      // уникальный, a-z0-9_
  title, description, icon: string,
  type: "random"|"condition",
  rarity: "common"|"rare"|"legendary",
  condition_type: "score"|"speed"|"count"|"special",
  condition_value: json, order
}
```

### Схема связей

```
topics ←── subtopics.topic
       ←── tasks.topic
       ←── works.topic

tags   ←── tasks.tags

tasks  ←── cards.tasks
       ←── variants.tasks
       ←── attempt_answers.task

works  ←── variants.work
       ←── work_sessions.work

variants ←── attempts.variant

work_sessions ←── attempts.session

students ←── attempts.student

achievements ←── attempts.achievement
             ←── attempts.unlocked_achievements

theory_categories ←── theory_articles.category
```

## Установка и запуск

### Требования
- Node.js >= 18.0.0
- Python 3.8+ (для парсеров)
- npm

### Быстрый старт

```bash
# 1. Установить зависимости
npm run install:all

# 2. Создать .env файл
echo "VITE_PB_URL=https://task-ege.oipav.ru" > ege-tasks/.env

# 3. Запустить все сервисы
./start.sh
```

Или через npm:
```bash
npm run dev          # Frontend (VPS backend)
npm run dev:local-pdf # Frontend + локальный PDF-сервис
npm run migrate:task-images # Перенос внешних image_url в files tasks.image (требует PB_SUPERUSER_EMAIL/PASSWORD)
```

### Сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| PocketBase | https://task-ege.oipav.ru | Backend API |
| PocketBase Admin | https://task-ege.oipav.ru/_/ | Админ-панель |
| PDF Service | http://localhost:3001 | Генерация PDF |
| Frontend | http://localhost:5173 | Учительский интерфейс |
| Student | http://localhost:5173/student/{id} | Ученический интерфейс |

### Остановка
```bash
./stop.sh
```

## Навигация учительского интерфейса

| Раздел | Компонент | Описание |
|--------|-----------|----------|
| Все задачи | TaskList | Просмотр, фильтрация, массовые операции |
| Статистика | TaskStatsDashboard | Аналитика по темам, тегам, сложности |
| Каталог | TaskCatalogManager | CRUD тем/подтем/тегов, дубликаты |
| Устный счёт | OralWorksheetGenerator | Генератор листов устного счёта |
| Контрольные | TestWorkGenerator | Генератор контрольных работ |
| Редактор работ | WorkEditor | Редактирование сохранённых работ |
| Прогресс учеников | StudentProgressDashboard | Обзор результатов учеников |
| Импорт | TaskImporter | Импорт из Markdown и sdamgia.ru |
| Библиотека | TheoryBrowser | Просмотр статей теории |
| Редактор теории | TheoryEditor | Создание/редактирование статей |
| Конспекты | TheoryPrintBuilder | Конструктор конспектов для печати |
| Категории | TheoryCategoryManager | Управление категориями теории |

## Поток тестирования учеников

```
Учитель                           Ученик
────────                          ──────
1. Создаёт работу
   (TestWorkGenerator/WorkEditor)
2. Создаёт сессию
   (кнопка «Выдать»)
3. Копирует ссылку/QR-код ──────→ 4. Открывает /student/{sessionId}
                                  5. Регистрируется или входит
                                  6. Нажимает «Начать тест»
                                  7. Получает вариант (round-robin)
                                  8. Отвечает на задачи
                                     (автосохранение ответов)
                                  9. Нажимает «Отправить»
                                  10. Видит результат + достижения
11. Видит результаты в таблице
12. Может выдать достижения
    вручную
13. Может разрешить
    повторную попытку
```

## Парсеры задач

### pb_parser.py — Задачи из Решу ЕГЭ
- Папка: `source/`
- Формат файлов: `14-1.md`, `ustno-6.md`
- Коды задач: `14-001`, `16-023`
- Строка ответа: `ответ:` (с маленькой буквы)
- Запуск: `python pb_parser.py 14.md`

### pb_parser_mordkovich.py — Задачи Мордковича
- Папка: `source/mordkovich/`
- Формат файлов: `M17.md`, `M43.md`
- Коды задач: `M17-001`, `M43-023`
- Строка ответа: `Ответ:` (с большой буквы)
- Единый топик «Мордкович» (slug: `mordkovich`)
- Запуск: `python pb_parser_mordkovich.py M17`

### pb_parser_theory.py — Статьи теории
- Папка: `source/theory/`
- Коллекция: `theory_articles`
- Автоматическое создание категорий с цветами
- Запуск: `python pb_parser_theory.py`

### Формат Markdown задач

```markdown
---
topic: Название темы
subtopic: Название подтемы
difficulty: 2
source: Решу ЕГЭ
year: 2026
tags: [Тег1, Тег2]
---

**1** [1]
Условие задачи с $\LaTeX$ формулами: $\frac{a}{b} + \sqrt{x}$
ответ: 42
tags: [Тег1, Тег2, Тег3]

**2** [2]
Вторая задача $$\int_0^1 x^2 dx$$
ответ: $\frac{1}{3}$
```

## Резервное копирование

### Создание бэкапа
```bash
./backup.sh
```

Бэкап использует `sqlite3 .backup` (безопасно при работающем PocketBase), сжимается в `.tar.gz`, хранит 10 последних копий.

### Восстановление
```bash
./restore.sh
```

Безопасная процедура с двойным подтверждением и аварийным бэкапом перед восстановлением.

### Автоматическое резервное копирование (macOS)
LaunchAgent запускает бэкап каждый день в 02:00:
```bash
# Активировать
launchctl load ~/Library/LaunchAgents/com.egetasks.backup.plist

# Проверить
launchctl list | grep egetasks
```

## PDF Export API

### Health Check
```
GET http://localhost:3001/health
→ { status: "ok", puppeteer: true }
```

### Генерация PDF
```
POST http://localhost:3001/generate
Content-Type: application/json

{
  "html": "<html>...</html>",
  "filename": "document.pdf",
  "options": {
    "format": "A4",
    "marginTop": "7mm",
    "marginBottom": "7mm",
    "marginLeft": "7mm",
    "marginRight": "7mm"
  }
}
→ application/pdf
```

### Парсинг sdamgia.ru
```
POST http://localhost:3001/parse-sdamgia
Content-Type: application/json

{ "url": "https://math-ege.sdamgia.ru/..." }
→ [{ id, condition, answer, images }]
```

### Прокси загрузки изображений
```
POST http://localhost:3001/fetch-image
Content-Type: application/json

{ "url": "https://..." }
→ binary image/*
```
Используется импортом задач для сохранения картинок локально в PocketBase (`tasks.image`).

## API сервис (pocketbase.js)

Основные группы функций:

| Группа | Функции |
|--------|---------|
| Topics | `getTopics`, `getTopic`, `createTopic`, `updateTopic` |
| Subtopics | `getSubtopics`, `createSubtopic`, `updateSubtopic`, `deleteSubtopic` |
| Tags | `getTags`, `createTag`, `updateTag`, `deleteTag`, `findTagByTitle` |
| Tasks | `getTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `getRandomTasks`, `getRandomTasksWithoutRepetition`, `getTasksWithProgressiveDifficulty`, `getTaskImageUrl` |
| Cards | `getCards`, `getCard`, `createCard`, `updateCard`, `deleteCard` |
| Works | `getWorks`, `getWork`, `createWork`, `updateWork`, `deleteWork`, `archiveWork`, `unarchiveWork` |
| Variants | `getVariantsByWork`, `getVariant`, `createVariant`, `updateVariant`, `deleteVariant` |
| Sessions | `createSession`, `getSession`, `getSessionByWork`, `getSessionsByWork`, `updateSession` |
| Attempts | `createAttempt`, `getAttemptByDevice`, `getAttemptsBySession`, `updateAttempt`, `deleteAttempt` |
| Answers | `createAttemptAnswer`, `getAttemptAnswers`, `batchCreateAttemptAnswers`, `batchUpdateAttemptAnswers` |
| Achievements | `getAchievements`, `getAchievement`, `createAchievement`, `updateAchievement`, `deleteAchievement` |
| Students | `registerStudent`, `loginStudent`, `logoutStudent`, `getStudents`, `updateStudent` |
| Theory | `getTheoryCategories`, `getTheoryArticles`, `getTheoryArticle`, `createTheoryArticle`, `updateTheoryArticle`, `deleteTheoryArticle` |
| Stats | `getUniqueYears`, `getUniqueSources`, `getTasksStatsSnapshot` |

## LaTeX справка

```
Inline: $x^2 + y^2 = z^2$
Block:  $$\frac{a}{b}$$

Степени:     x^2, a^{10}
Дроби:       \frac{a}{b}, \dfrac{a}{b}
Корни:       \sqrt{x}, \sqrt[3]{x}
Греческие:   \alpha, \beta, \gamma, \pi
Тригонометрия: \sin, \cos, \tan, \cot
Логарифмы:   \log, \ln, \log_a
Интегралы:   \int_0^1, \sum_{i=1}^n
Пределы:     \lim_{x \to 0}
```

### Уровни сложности
- `1` — Базовый (зелёный, #52c41a)
- `2` — Средний (оранжевый, #faad14)
- `3` — Продвинутый (красный, #ff4d4f)

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| CORS ошибки | Проверить, что VPS PocketBase доступен и URL в `.env` верный |
| LaTeX не рендерится | Проверить `import 'katex/dist/katex.min.css'`; формулы в `$...$` или `$$...$$` |
| PDF сервис недоступен | `cd pocketbase && npm run pdf`; проверить порт 3001 |
| Карточки некорректно печатаются | Chrome/Firefox, масштаб 100%, A4, без колонтитулов |
| Дубликаты при импорте | Парсер проверяет по `statement_md`; дубли пропускаются |
| Ученик не видит тест | Проверить, что сессия открыта (`is_open: true`) |

## Документация

| Файл | Описание |
|------|----------|
| [README.MD](README.MD) | Основная документация (этот файл) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Архитектура компонентов и хуков |
| [CHANGELOG.md](CHANGELOG.md) | История изменений |
| [DATABASE_SAFETY.md](DATABASE_SAFETY.md) | Правила безопасности БД |
| [BACKUP_GUIDE.md](BACKUP_GUIDE.md) | Руководство по бэкапам |
| [PDF_EXPORT_UPGRADE.md](PDF_EXPORT_UPGRADE.md) | PDF экспорт через Puppeteer |
| [QUICK_START.md](QUICK_START.md) | Быстрый старт |
| [START_GUIDE.md](START_GUIDE.md) | Подробный запуск |
| [TEST_AND_COMMIT.md](TEST_AND_COMMIT.md) | Тестирование и коммиты |
| [SDAMGIA_TABLE_PARSING.md](SDAMGIA_TABLE_PARSING.md) | Парсинг таблиц sdamgia.ru |

## Лицензия

Проект распространяется под лицензией MIT.
