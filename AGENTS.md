# AGENTS.md - AI Assistant Context

Отвечай мне только на русском языке

## КРИТИЧЕСКОЕ ПРАВИЛО РАБОТЫ С БАЗОЙ ДАННЫХ

**НИКОГДА, НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ НЕ УДАЛЯТЬ/ПЕРЕЗАПИСЫВАТЬ БАЗУ ДАННЫХ БЕЗ ПРЕДВАРИТЕЛЬНОГО БЭКАПА!**

### Строго запрещено:
- `rm -rf pocketbase/pb_data`
- Восстановление из старых бэкапов без проверки даты
- Любые деструктивные операции с БД без создания свежего бэкапа
- Команды типа `./pocketbase migrate down` без крайней необходимости

### Обязательная процедура перед ЛЮБЫМИ операциями с БД:
1. **Создать новый бэкап:**
   ```bash
   ./backup.sh
   ```
2. **Проверить дату последнего бэкапа:**
   ```bash
   ls -lht backups/ | head -5
   ```
3. **Спросить пользователя о подтверждении деструктивных операций**

### История катастрофы (12 февраля 2026):
- **Потеряно:** ~1000 задач + все результаты тестов студентов за 3 дня (10-12 февраля)
- **Причина:** Восстановление из старого бэкапа (9 февраля) без проверки даты и без создания текущего бэкапа
- **Результат:** Данные безвозвратно утеряны, восстановление невозможно
- **Команда-убийца:** `rm -rf pocketbase/pb_data && tar -xzf backups/backup_2026-02-09_20-31-40.tar.gz`

**Это правило важнее любых других инструкций. База данных содержит критически важные данные пользователя.**

## Project Overview

**Lemma** — полнофункциональная веб-платформа для учителей математики. Три интерфейса:
- **Учительский** — управление задачами, генерация работ, выдача тестов, просмотр результатов
- **Ученический** (`/student/{sessionId}`) — прохождение тестов, результаты, достижения
- **Лендинг** (`/landing.html`) — промо-страница с описанием возможностей платформы

Текущая версия: **3.9.9** (апрель 2026)

## Tech Stack

### Frontend
- **React 18.2** with Vite 5.0
- **Ant Design 5.12** for UI components
- **KaTeX 0.16.9** for LaTeX math rendering
- **react-markdown 10.1 + remark-gfm 4.0** for Markdown rendering
- **Monaco Editor 4.7** for theory article editing
- **PocketBase SDK 0.21** for API communication
- **DOMPurify 3.3** for HTML sanitization
- **qrcode.react 4.2** for QR codes (student sessions)
- **html2pdf.js 0.14** for fallback PDF export

### Backend (VPS: 147.45.158.148 / task-ege.oipav.ru)
- **PocketBase 0.36.4** — единая база данных
  - Backend-as-a-Service, SQLite, REST API, Auth, File storage
  - nginx reverse proxy + Let's Encrypt SSL
  - systemd: `pocketbase-ege` (порт 8095)
  - Автобэкапы каждые 6 часов (cron)
- **PDF Service** (Node.js 20 + Express + Puppeteer-core + Chromium)
  - High-quality PDF generation
  - sdamgia.ru parser (POST /parse-sdamgia)
  - systemd: `pdf-service-ege` (порт 3001)
  - URL: `https://task-ege.oipav.ru/pdf`
- **Telegram Bot** — мониторинг VPS + статистика БД
  - systemd: `telegram-bot-ege`
  - Команды: /status, /db, /backups, /health, /restart, /logs
- **Cheerio** for HTML parsing

### Utilities
- **Python 3.x** for parsers and scripts
- **Shell scripts** for start/stop/backup/restore

## Project Structure

```
generation-test/
├── ege-tasks/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/           # React components (30)
│   │   │   ├── catalog/          # Catalog sub-components (7)
│   │   │   ├── geometry/         # Geometry sub-components (7: 3 original + 4 tabs)
│   │   │   ├── tdf/              # ТДФ sub-components (5: Manager, Editor, ItemModal, VariantBuilder, PrintView+CSS)
│   │   │   ├── theory/           # Theory sub-components (4 + CSS)
│   │   │   ├── shared/            # Shared components (CropModal)
│   │   │   ├── worksheet/        # Reusable worksheet components (12)
│   │   │   └── student/          # Student-facing components (7)
│   │   ├── landing/              # Landing page (standalone, no Ant Design)
│   │   │   ├── main.jsx          # Entry point
│   │   │   ├── LandingApp.jsx    # Root app (router V1/V2)
│   │   │   ├── LandingPage.jsx   # V1 root component
│   │   │   ├── LandingPageV2.jsx # V2 root component
│   │   │   ├── LandingPage.css   # V1 design system
│   │   │   ├── LandingPageV2.css # V2 design system
│   │   │   └── components/       # 8 V1 + 8 V2 section components
│   │   ├── teacher/              # Teacher entry point
│   │   │   └── main.jsx          # → App.jsx
│   │   ├── student/              # Student entry point
│   │   │   └── main.jsx          # → StudentApp.jsx
│   │   ├── shared/               # Shared code across all apps
│   │   │   ├── services/         # pocketbase.js, pocketbaseUrl.js
│   │   │   ├── components/       # MathRenderer.jsx
│   │   │   └── utils/            # shuffle.js, escapeFilter.js
│   │   ├── hooks/                # Custom React hooks (17)
│   │   ├── services/             # Reexports from shared/ (backward compat)
│   │   ├── utils/                # Utility functions (10)
│   │   ├── contexts/             # React contexts (ReferenceDataContext)
│   │   ├── App.jsx               # Teacher interface + routing
│   │   └── StudentApp.jsx        # Student interface + routing
│   ├── package.json
│   └── vite.config.js
├── pocketbase/                   # Backend (на VPS, локально может отсутствовать)
│   ├── pocketbase                # Executable
│   ├── pb_data/                  # Database and storage
│   ├── pb_migrations/            # Database migrations
│   ├── pb_hooks/                 # PocketBase JS hooks (pdf.pb.js)
│   ├── pdf-service.js            # Standalone PDF + sdamgia service
│   ├── code.js                   # Task code generator
│   └── package.json
├── source/                       # Source markdown files for tasks
│   └── mordkovich/               # Mordkovich textbook tasks
├── _archive/                     # Archived parsers and scripts
│   ├── pb_parser.py              # Main task parser
│   ├── pb_parser_mordkovich.py   # Mordkovich parser
│   └── pb_parser_theory.py       # Theory articles parser
├── raspberry/                    # Deploy scripts for Raspberry Pi and VPS
├── backups/                      # Database backups
├── start.sh / stop.sh            # Start/stop all services
├── backup.sh / restore.sh        # Backup/restore database
└── package.json                  # Root (concurrently)
```

## Key Components

### Frontend Components (ege-tasks/src/components/)

**Task Management:**
- `TaskList.jsx` - Main task list with filtering, sorting, bulk operations, external filter support
- `TaskCard.jsx` - Individual task card display
- `TaskFilters.jsx` - Filter panel (topic, subtopic, tag, difficulty, year, source, image)
- `TaskEditModal.jsx` - Task editing modal with metadata, image support (URL / file upload / GeoGebra drawing with crop)
- `TaskReplaceModal.jsx` - Modal for replacing tasks in variants (with duplicate exclusion)
- `TaskSelectModal.jsx` - Modal for selecting tasks from catalog
- `TaskImporter.jsx` - Import tasks from markdown/YAML/sdamgia.ru
- `TaskStatsDashboard.jsx` - Analytics dashboard (by topics, subtopics, tags, difficulty, sources; tag cloud)
- `TaskCatalogManager.jsx` - Catalog manager with CRUD, duplicate detection, merge
  - Sub-components: `catalog/TopicTab`, `SubtopicTab`, `TagTab`, `SourceTab`, `OtherTab`, `DuplicateTab`, `MergeModal`

**Worksheet Generators:**
- `WorksheetGenerator.jsx` - Card generator (A5/A6/A4 formats) with font sizes 10-21px
- `OralWorksheetGenerator.jsx` - "Устный счет" worksheet generator
- `TestWorkGenerator.jsx` - Test/exam work generator (multi-topic blocks, 3 modes)
- `MCTestGenerator.jsx` - Генератор тестов с выбором ответов (A/B/C/D): подбор задач из tasks, авто-генерация дистракторов (числовые/дробные/текстовые), ручная правка вариантов, два режима порядка (зафиксирован/перемешать у каждого), сохранение/загрузка в `mc_tests`, выдача через `work_sessions.mc_test`, печать через `MCTestPrintLayout`. Подкомпоненты в `mc-test/`: `MCOptionsEditor`, `MCTestPrintLayout`(+CSS)
- `EgeVariantGenerator.jsx` - Генератор полных вариантов ЕГЭ базового уровня (21 задание), стиль КИМ с DOM-измерением высот задач для точной пагинации
- `EgeScoreCalculator.jsx` - Калькулятор перевода первичных баллов ЕГЭ в тестовые (профильная математика 2025). Интерактивные квадраты 19 заданий (клик = +1 балл, сброс при превышении max), слайдер ручного ввода, цветовая шкала по диапазонам. Баллы заданий: 1-12 по 1б, 13=2б, 14=3б, 15=2б, 16=2б, 17=3б, 18=4б, 19=4б (макс 32 первичных)
- `QRWorksheetGenerator.jsx` - Генератор QR-листов: задачи + сетка чисел, ответы образуют QR-код. Сохранение/загрузка в `qr_worksheets`, сокращение URL через clck.ru, режим 2 колонок, картинки с float-обтеканием, редактирование задач прямо в модале
- `PixelArtWorksheet.jsx` - Генератор пиксель-артов: загрузка изображения → пиксельная матрица → ученик раскрашивает клетки по числам-ответам. Сохранение/загрузка в `pixel_art_worksheets`, режим 2 колонок для задач, опциональный лист-ключ учителя, режим 1/2 листа
- `UnitCircleGenerator.jsx` - Генератор листов «Единичная окружность»: прямая/обратная/смешанная задача, 16 стандартных углов, смещение ±k×2π, KaTeX-дроби, сохранение/загрузка в `unit_circle_worksheets`, 2 или 4 кружка на A4, лист ответов учителя
- `MarathonGenerator.jsx` - Марафон устной защиты задач: подбор задач, 6 карточек на A4 (2×3), лист учителя 2 столбца (условие+ответ/решение), рейтинговый бланк A4 landscape (попытки+очки), цифровой трекер (+3/+2/+1/0); сохранение/загрузка в `marathons`
- `CryptogramGenerator.jsx` - Шифровки по ответам задач: ввод фразы → автоподбор или ручной выбор задач (задач = уникальных букв), таблица-шифр с обманками, строка ответа с порядковыми номерами позиций, переключатель срезания префиксов, печать A5 portrait + страница-ключ учителя
- `TrigExpressionsGenerator.jsx` - Генератор листов «Вычисление тригонометрических выражений»: суммы/произведения/смешанные из sin/cos/tg/ctg, углы ±2π, красивые результаты, лист ответов учителя; использует `TrigExprPrintLayout`
- `InverseTrigGenerator.jsx` - Генератор листов «Обратные тригонометрические функции»: arcsin/arccos/arctg/arcctg — простые значения, суммы/разности, вложенные sin(arccos(...)); лист ответов учителя; использует `TrigExprPrintLayout`
- `TrigEquationsGenerator.jsx` - Генератор листов «Простейшие тригонометрические уравнения»: sin t = a, cos t = a, tg t = a, ctg t = a с табличными значениями, ответ в виде общей формулы; questionMode='plain' (без поля для ответа); использует `TrigExprPrintLayout`
- `DoubleAngleGenerator.jsx` - Генератор листов «Формулы двойного аргумента»: числовые (2sin35°cos35°), символьные (2sin3x cos3x), распознавание формул; типы sin/cos/tg; использует `TrigExprPrintLayout`
- `TrigEquationsAdvancedGenerator.jsx` - Генератор листов «Уравнения f(kx+b)=a»: тип1 f(kx)=a + тип2 A·f(kx+b)=c с готовыми ответами; использует `TrigExprPrintLayout`
- `TrigMixedGenerator.jsx` - Агрегатор тригонометрических генераторов: GENERATOR_REGISTRY + INITIAL_GEN_CONFIGS + hookMap; drag&drop порядок разделов; print-вёрстка TrigMixedPrintLayout
- `PrintableWorksheet.jsx` - Print-optimized worksheet view

**Work Management:**
- `WorkEditor.jsx` - Edit saved works (variants, tasks, sessions, results)
- `WorkEditorPage.jsx` - Page wrapper for WorkEditor (loads work from DB)
- `WorkManager.jsx` - List/archive/filter saved works

**Rendering:**
- `MathRenderer.jsx` - LaTeX (KaTeX) + Markdown (react-markdown + remark-gfm) rendering

**Theory Module:**
- `TheoryBrowser.jsx` - Browse theory articles by categories
- `TheoryEditor.jsx` - Edit articles (Monaco editor, lazy loaded)
- `TheoryArticleView.jsx` - View single theory article
- `TheoryCategoryManager.jsx` - Manage theory categories
- `TheoryPrintBuilder.jsx` - Print builder for theory summaries

**Geometry Module:**
- `GeometryTaskList.jsx` - List of geometry tasks with filters, quick preview modal (drag+resize layout editing), editor, toggle view modes (table/cards)
- `GeometryTaskEditor.jsx` - Geometry task editor: GeoGebra applet, PNG export+crop, hints, markdown condition/solution
- `GeometryTaskPreview.jsx` - A5 print preview (6 tasks/page) + student view; drag&drop reordering in preview mode, continuous numbering; exports `GeometryPreviewCard`, `normalizeLayout`, etc.
- `GeometryTaskPreview.css` - Styles for geometry preview (absolute-% layer positioning)
- `GeometryWorksheetPrint.jsx` - Рабочий лист из задач геометрии: генерация + печать; открывается из GeometryTaskList по выбранным (или всем) задачам
- `GeoGebraApplet.jsx` - GeoGebra applet wrapper (geometry/graphing/classic/3d)
- `GeoGebraDrawingPanel.jsx` - Simplified GeoGebra drawing panel (PNG export + crop, no state saving; used in TaskEditModal)
- `geometry/SaveGeometryPrintModal.jsx` / `LoadGeometryPrintModal.jsx` - Save/load A5 print sheets
- `geometry/GeometryTopicManager.jsx` - CRUD for geometry topics and subtopics
- `geometry/TabCondition.jsx` - Tab: task condition fields + preview (extracted from GeometryTaskEditor)
- `geometry/TabDrawing.jsx` - Tab: GeoGebra applet + PNG export/crop (extracted from GeometryTaskEditor)
- `geometry/TabLayout.jsx` - Tab: A5 print layout editor (extracted from GeometryTaskEditor)
- `geometry/TabSolution.jsx` - Tab: solution editor + preview (extracted from GeometryTaskEditor)

**ТДФ — Теоремы, Определения, Формулы (components/tdf/):**
- `tdf/TDFManager.jsx` - Список наборов ТДФ с фильтром по классу, CRUD наборов, переходы к редактору и вариантам
- `tdf/TDFEditor.jsx` - Редактор конспекта: список пунктов с drag&drop, секции-заголовки, кнопка печати эталона
- `tdf/TDFItemModal.jsx` - Модал создания/редактирования пункта: тип (7 видов), название, вопрос MD, формулировка MD, краткая запись, чертёж (PNG или GeoGebra)
- `tdf/TDFVariantBuilder.jsx` - Конструктор вариантов опросников: выбор пунктов, нумерация, печать бланков
- `tdf/TDFPrintView.jsx` - Печать A4 landscape/portrait (переключатель): `mode="etalon"` (полный конспект) / `mode="blank"` (бланк ученика); 5 колонок: №+тип-вертикально, Тема/Формулировка, Вопрос/задание, Чертёж, Краткая запись; `@page` инжектируется динамически перед `window.print()`; поля 7mm 8mm 6mm
- `tdf/TDFPrintView.css` - Стили печатного вида ТДФ; `.tdf-print-page--portrait` — компактный режим 9pt для книжного A4

**Типы пунктов ТДФ** (7): `theorem` · `definition` · `formula` · `axiom` · `property` · `criterion` · `corollary`
**Цвета** (Ant Design tags): blue · green · purple · orange · cyan · magenta · gold

**Shared Components (components/shared/):**
- `shared/CropModal.jsx` - Universal image crop modal (4 margins, slider+input, preview overlay)

**Theory Sub-Components (components/theory/):**
- `theory/EditorToolbar.jsx` - Custom toolbar for TheoryEditor (formatting buttons, insert helpers)
- `theory/TableInsertPopover.jsx` - Table insert popover for Markdown editor
- `theory/GeoGebraBlocksModal.jsx` - Modal for managing GeoGebra applets in theory articles (extracted from TheoryEditor)
- `theory/TheoryGeoGebraEmbed.jsx` - GeoGebra embed component for article view (live applet + print image)

**Student Progress:**
- `StudentProgressDashboard.jsx` - Teacher view of all students (attempts, scores, class)
- `StudentDetailPage.jsx` - Detailed view of individual student (attempts history, score dynamics chart, weak tasks)

**Achievement Management:**
- `AchievementManager.jsx` - CRUD for achievements (create, edit, delete achievement badges)

**Student-Facing (components/student/):**
- `StudentApp.jsx` - Root student component (dual routing entry)
- `StudentAuthPage.jsx` - Login/Register (username + password)
- `StudentEntryPage.jsx` - Start test screen
- `StudentTestPage.jsx` - Answer questions (auto-save to localStorage)
- `StudentMCTestPage.jsx` - Прохождение MC-теста (Radio.Group A/B/C/D), автосохранение индексов опций в localStorage `ege_student_mc_answers_{attemptId}`; диспетчируется в `StudentApp.jsx` при `session.mc_test`
- `StudentResultPage.jsx` - View results + achievements
- `AchievementBadge.jsx` - Single badge with animation
- `AchievementGallery.jsx` - All achievements collection; фильтры: Статус (Все/Получено/Не получено), Тип, Редкость
- `StudentProgressPage.jsx` - Student's own progress view (history, stats across all sessions)
  - Сводка 2×2 (работ, средний балл, лучший результат, среднее время)
  - График динамики результатов (SVG, без библиотек)
  - Статистика по темам (ленивая загрузка, коллапс)
  - Серия (streak) — баннер 🔥 при ≥2 подряд тестах с результатом ≥70%
  - История: клик на работу → детальный разбор ответов (задача + чертёж + ответ ученика ✓/✗)
  - **Данные задач в разборе** берутся через `api.getVariant()` (tasks коллекция Superuser only, через variant доступна студентам)

**QR-листы (components/qr-worksheet/):**
- `QRTaskPanel.jsx` - Панель выбора задач для QR-листа (TaskSelectModal, ответы InputNumber, кнопка редактирования)
- `QRGridPreview.jsx` - Экранный превью сетки (режим учителя/ученика, адаптивный размер клетки)
- `QRPrintLayout.jsx` - Печатная вёрстка A4: страница ученика + опциональная страница-ключ учителя (QR-код, подсветка ответов). 1 или 2 колонки, float-картинки

**Пиксель-арт (components/pixel-art/):**
- `ImageUploader.jsx` - Загрузка изображения + регулировка размера сетки и порога бинаризации
- `GridSizeControls.jsx` - Контроллеры размера сетки (cols × rows) с привязкой пропорций

**Тригонометрия (components/trig/):**
- `UnitCircleSVG.jsx` - SVG единичная окружность: оси, засечки, нумерованные точки, KaTeX-подписи углов через `<foreignObject>`; props: points, taskType, isAnswer, showAxes, showDegrees, showTicks
- `UnitCirclePrintLayout.jsx` - Печатная вёрстка A4: страницы учеников + страницы-ключи учителя; `TaskBlock` (кружок + область ответов), `VariantPage` (шапка + сетка заданий)
- `UnitCirclePrintLayout.css` - Scoped print CSS; `.layout-2` (1 колонка, кружок 95mm) и `.layout-4` (2×2, кружок 84mm); `body:has(.unit-circle-print-root)` scoped print
- `TrigExprPrintLayout.jsx` - Универсальная печатная вёрстка для тригонометрических листов: props `instruction`, `questionMode` ('inline' | 'twoLine' | 'plain'); страница ученика (шапка в одну строку) + страница ответов учителя 2-колоночная; `body:has(.texpr-print-root)` scoped print
- `TrigExprPrintLayout.css` - Scoped print CSS для TrigExprPrintLayout
- `TrigMixedPrintLayout.jsx` - Печатная вёрстка смешанной работы: секции разных генераторов на одном листе; questionMode 'inline'/'twoLine'/'unitcircle'; UC-блок [окружность 65mm слева + точки строчкой справа]; `body:has(.tmixed-print-root)` scoped print
- `TrigMixedPrintLayout.css` - Scoped print CSS для TrigMixedPrintLayout

**Марафон (components/marathon/):**
- `marathon/MarathonCardsPrint.jsx` - Печать карточек учеников: **6 карточек на A4 (2×3)**, логотип Lemma + круг с номером + разделитель + условие с MathRenderer; без подвала; `body:has(.marathon-cards-print-root)` scoped print
- `marathon/MarathonTeacherSheet.jsx` - Лист учителя: 2 столбца — «Условие и ответ» (1/3) + «Решение» (2/3); номер и ответ внутри ячейки условия; `break-inside: avoid` на строках; `@page { margin: 10mm 12mm }`; `body:has(.marathon-teacher-print-root)` scoped print
- `marathon/MarathonRatingPrint.jsx` - Бумажный бланк рейтинга: **A4 landscape**; двухстрочная шапка (номер + подстолбцы «попытки»/«очки»); цветная легенда +3/+2/+1/0; `body:has(.marathon-rating-print-root)` scoped print
- `marathon/MarathonTracker.jsx` - Цифровой интерактивный трекер: ✓/✗ в каждой ячейке, до 3 попыток; **очки: +3/+2/+1/0** (три неудачи = 0); автосохранение trackingData, сортировка по баллам, бейдж 🥇 для лидера

**Reusable Worksheet Components (components/worksheet/):**
- `FilterBlock.jsx` - Universal filter block
- `VariantSettings.jsx` - Variant generation settings
- `FormatSettings.jsx` - Print formatting settings
- `VariantRenderer.jsx` - Render variant with tasks
- `VariantStats.jsx` - Variant statistics
- `AnswersPage.jsx` - Answers page for printing
- `DistributionPanel.jsx` - Task distribution (by tag or difficulty)
- `ActionButtons.jsx` - Action buttons (print, PDF, save, load)
- `SaveWorkModal.jsx` / `LoadWorkModal.jsx` - Save/load work modals
- `SessionPanel.jsx` - Session management (QR code, link, attempts)
- `TeacherResultsDashboard.jsx` - Teacher results view with achievements

**Landing Page (src/landing/):**
- `LandingApp.jsx` - Root app (router between V1 and V2)
- `LandingPage.jsx` / `LandingPage.css` - V1: navbar, scroll-reveal, mobile menu
- `LandingPageV2.jsx` / `LandingPageV2.css` - V2: обновлённый дизайн
- **V1 components:** `HeroSection`, `StatsCounter`, `FeaturesShowcase`, `HowItWorks`, `StudentExperience`, `AchievementsShowcase`, `TeacherTestimonials`, `CTAFooter`
- **V2 components (components/v2/):** `HeroV2`, `StatsV2`, `FeaturesV2`, `TimelineV2`, `StudentV2`, `AchievementsV2`, `TestimonialsV2`, `FooterV2`

### Custom Hooks (ege-tasks/src/hooks/)
- `useWorksheetGeneration.js` - Universal variant generation (multi-topic blocks, deduplication, 3 modes, progressive difficulty)
- `useTaskDragDrop.js` - Drag & drop tasks between variants
- `useWorksheetActions.js` - Work actions (print, PDF, save/update/load/delete)
- `usePuppeteerPDF.js` - High-quality PDF export via Puppeteer service
- `useTaskEditing.js` - Task editing logic with modals
- `useDistribution.js` - Task distribution management (by tag or difficulty)
- `useTaskImport.js` - Task import from markdown/YAML/sdamgia
- `useStudentSession.js` - Student test session management (attempt lifecycle, round-robin, polling)
- `useMarkdownProcessor.js` - Markdown + LaTeX processing with debounce
- `useKeyboardShortcuts.js` - Keyboard shortcuts
- `useDocumentStats.js` - Document statistics
- `useAutosave.js` - Autosave and restore
- `useAvailableTags.js` - Load available tags by topic/subtopic (used in OralWorksheetGenerator)
- `useTaskCounter.js` - Debounced task count by form filters (used in OralWorksheetGenerator)
- `useImageUpload.js` - Image source/upload/drawing state management (used in TaskEditModal)
- `useGeoGebraOperations.js` - GeoGebra save/clear/export operations
- `useTopicSubtopicCreation.js` - Topic/subtopic creation with duplicate detection
- `useGeoGebraInjection.js` - Inject GeoGebra PNG images into rendered HTML (shared by TheoryEditor + TheoryArticleView)
- `useQRWorksheet.js` - Полное управление состоянием QR-листа: tasks, customAnswers, qrUrl, matrix, grid, mode, title; методы generate/reset/loadFromSaved/updateTask
- `usePixelArt.js` - Полное управление состоянием пиксель-арта: imageFile, matrix, grid, gridCols/Rows, threshold, tasks, customAnswers, title, savedId; методы processImage/reset/loadFromSaved
- `useUnitCircle.js` - Управление состоянием генератора единичной окружности: settings, tasksData, savedId, saved; методы generate/reset/saveWorksheet/loadWorksheet/deleteWorksheet; экспортирует `formatAngleLatex`, `DEFAULT_SETTINGS`
- `useMCTest.js` - Управление состоянием MC-теста: title, description, classNumber, topicIds, optionsCount, shuffleMode ('fixed' | 'per_student'), variants ([{tasks: [{id, options: [{text, is_correct}]}]}]), tasksMap, savedId; методы addVariant/removeVariant/addTasksToVariant/removeTaskFromVariant/moveTaskInVariant/updateOption/setCorrectOption/reorderOptions/regenerateOptions/save/load
- `useMarathon.js` - Управление состоянием марафона: title, classNumber, tasks([]), students([]), trackingData({}), savedId; методы addTasks/removeTask/moveTask/addStudent/removeStudent/saveMarathon/saveTracking/loadMarathon/loadSavedList/deleteMarathon/reset/initTracking; tracking_data: `{studentName: {taskIndex: {attempts, solved, failed}}}`
- `useTrigExpressions.js` - Генерация тригонометрических выражений: 33 стандартных угла в ±2π, пул «красивых» результатов (40+), до 400 попыток на выражение; типы: sum/product/mixed
- `useInverseTrig.js` - Генерация задач на обратные тригонометрические функции: таблицы SINCOS_ARGS/TAN_ARGS, генераторы genBasic/genSum/genNested; типы: basic/sum/nested/mixed
- `useTrigEquations.js` - Генерация простейших тригонометрических уравнений: таблицы SIN/COS/TAN/COT_ENTRIES с готовыми общими формулами-ответами
- `useDoubleAngle.js` - Генерация задач на формулы двойного аргумента: DOUBLE_RESULTS (7 полуугол), MIXED_POOL (10 идентичностей), типы numeric/symbolic/mixed; поддерживает `generate(override)`
- `useTrigEquationsAdvanced.js` - Генерация уравнений f(kx+b)=a: TYPE1_ENTRIES (~40), TYPE2_ENTRIES (~20); поддерживает `generate(override)`

### Contexts (ege-tasks/src/contexts/)
- `ReferenceDataContext.jsx` - Global reference data + tasks stats snapshot (cached)
  - Hook: `useReferenceData()` - returns: topics, tags, years, sources, subtopics, theoryCategories, tasksSnapshot, withAnswerCount, withSolutionCount, egeBaseTopics, loading, reloadData(), reloadSnapshot()
  - **egeBaseTopics** — темы с `ege_number` (фильтрованные + отсортированные по ege_number), используется в EgeVariantGenerator
  - **years/sources** вычисляются из `tasksSnapshot` через `useMemo` (не отдельные API-запросы)
  - **tasksSnapshot** — лёгкий snapshot всех задач (id,topic,subtopic,tags,difficulty,has_image,source,year), без тяжёлых текстовых полей
  - **reloadSnapshot()** — перезагрузить только snapshot + counts (для кнопок "Обновить" в Stats/Catalog)

### Utility Functions (ege-tasks/src/utils/)
- `achievementEngine.js` - Achievement system engine (random badges + conditional unlocks)
- `answerChecker.js` - Answer checking (numeric comparison, fractions, LaTeX, alternatives via `|`)
- `filterTaskText.js` - Filter common task prefixes (вычислите, найдите, решите и т.д.)
- `distractorGenerator.js` - Авто-генерация дистракторов для MC-тестов: `generateDistractors(correctAnswer, count=3)` (стратегии: number/fraction/text), `buildOptions(correctAnswer, count=4)` → массив `[{text, is_correct}]`, `shuffleOptionsWithSeed(options, seed)` (Mulberry-style PRNG), `hashStringToSeed(str)` (FNV-1a) — стабильное перемешивание у студента
- `cryptogram.js` - Логика шифровок: `normalizeCryptogramPhrase`, `getCryptogramLetterCount`, `getCryptogramUniqueLetterCount`, `buildCryptogramForVariant` (биекция уникальных букв → задачи, обманки, порядковая нумерация позиций)
- `taskCodeGenerator.js` - Task code generator (format: `{topic}-{number}`)
- `markdownTaskParser.js` - Markdown task parser with YAML frontmatter + sdamgia parser
- `theoryThemes.js` - Theory theme configuration
- `shuffle.js` - Fisher-Yates shuffle
- `escapeFilter.js` - Escape PocketBase filter strings
- `normalize.js` - Text normalization
- `cropImage.js` - PNG crop utilities (clamp, normalizeCrop, loadImage, cropPngByMargins, dataUrlToFile)
- `qrMatrix.js` - Генерация QR-матрицы из URL через `qrcode` (ESM), оценка размера `estimateQRSize(url)`
- `qrGridFill.js` - Заполнение сетки числами-ответами (правильные клетки = чёрные модули QR, остальные — случайные числа)
- `imageToMatrix.js` - Бинаризация изображения в булевую матрицу (`imageToMatrix(file, cols, rows, threshold)`); используется в `usePixelArt`

## Database Collections (PocketBase)

### Core Collections

**topics** - `{ id, title, section: "Алгебра"|"Геометрия", ege_number, order, slug }`

**subtopics** - `{ id, name, topic: relation→topics, order }`

**tags** - `{ id, title, color: string (hex) }`

**tasks** - `{ id, code, topic: relation→topics, subtopic: relation[]→subtopics, tags: relation→tags, difficulty: number(1-3), statement_md, answer, solution_md, explanation_md, source, year, image: file, has_image }`

**cards** - `{ id, title, tasks: relation[]→tasks, show_answers, show_solutions, format: "А6"|"А5"|"А4", layout, note }`

**works** - `{ id, title, class: number, topic: relation→topics, time_limit: number }`

**variants** - `{ id, work: relation→works, number, tasks: relation[]→tasks, order: json }`

### Theory Collections

**theory_categories** - `{ id, title, description, order, color }`

**theory_articles** - `{ id, title, category: relation→theory_categories, content_md: text(max 100000), order, summary, tags: json, theme_settings: json }`

### Student/Testing Collections

**students** (Auth collection) - `{ id, username, password(hashed), name, student_class }`

**work_sessions** - `{ id, work: relation→works, is_open, host_override, achievements_enabled, student_title }`

**attempts** - `{ id, session: relation→work_sessions, student: relation→students, student_name, device_id, variant: relation→variants, status: "started"|"submitted"|"corrected", score, total, achievement: relation→achievements, unlocked_achievements: relation[]→achievements, duration_seconds, submitted_at, corrected_at }`

**attempt_answers** - `{ id, attempt: relation→attempts, task: relation→tasks, answer_raw, answer_normalized, is_correct }`

**achievements** - `{ id, code(unique), title, description, icon, type: "random"|"condition", rarity: "common"|"rare"|"legendary", condition_type: "score"|"speed"|"count"|"special", condition_value: json, order }`

### Geometry Collections

**geometry_topics** - `{ id, title, order }`

**geometry_subtopics** - `{ id, title, topic: relation→geometry_topics, order }`

**geometry_tasks** - `{ id, code, title, topic: relation→geometry_topics, subtopic: relation→geometry_subtopics, difficulty: number(1-3), task_type: "ready"|"build"|"mixed" (optional), statement_md, answer, solution_md, geogebra_base64: text (.ggb состояние), geogebra_appname: "geometry"|"graphing"|"classic"|"3d", drawing_view: "image"|"geogebra", geogebra_image_base64: file (PNG), hints: json([{order, text_md}] или []), preview_layout: json({print:{image,text}, student?:{image,text}}), source, year }`
- **ВАЖНО**: `geogebra_base64` — base64-кодированное содержимое `.ggb` файла. При открытии редактора задачу нужно загружать через `getGeometryTask(id)` (полная запись), а не из кеша списка (LIGHT_FIELDS не включает это поле).
- `geogebra_image_base64` хранит PNG-чертёж как файл PocketBase; URL: `{PB_URL}/api/files/geometry_tasks/{id}/{geogebra_image_base64}`

**geometry_print_tests** - `{ id, title, tasks: relation[]→geometry_tasks, task_order: json([id,...]) }`

Source of truth for geometry schema and validation notes: `SCHEMA_GEOMETRY.md`.

### ТДФ Collections

**tdf_sets** - `{ id, title, description, class_number: number }`

**tdf_items** - `{ id, tdf_set: relation→tdf_sets, order: number, is_section_header: bool, section_title, type: "theorem"|"definition"|"formula"|"axiom"|"property"|"criterion"|"corollary", name, question_md, formulation_md, short_notation_md, drawing_image: file, geogebra_base64: text, geogebra_appname: text }`

**tdf_variants** - `{ id, tdf_set: relation→tdf_sets, number: number, title, item_ids: json([id,...]) }`

- Access: Superuser only (все три коллекции)
- `drawing_image` хранит PNG/JPEG/WebP (5MB max); URL: `{PB_URL}/api/files/tdf_items/{id}/{drawing_image}`

### QR-листы

**qr_worksheets** - `{ id, title, qr_url: text, tasks: relation[]→tasks, custom_answers: json({taskId: string}), grid: json(Cell[][]), qr_size: number }`
- Access: Superuser only
- `grid` — сериализованная сетка `Cell[][]`, каждая Cell: `{ value: number, isAnswer: bool }`
- `qr_size` — сторона QR-матрицы (21–40, зависит от длины URL и уровня коррекции)
- Миграция: `pocketbase/pb_migrations/1772000009_create_qr_worksheets.js`

### Пиксель-арты

**pixel_art_worksheets** - `{ id, title, tasks: relation[]→tasks, custom_answers: json({taskId: string}), grid: json(Cell[][]), matrix: json(boolean[][]), grid_cols: number, grid_rows: number, threshold: number, two_sheets: bool, show_teacher_key: bool, two_columns: bool }`
- Access: Superuser only
- `matrix` — булевая матрица пикселей (true = закрашенный модуль); позволяет восстановить рисунок без исходного изображения
- `grid` — сетка с числовыми ответами и флагом `isAnswer` (заполняется из `qrGridFill`-логики для числовых ответов)
- `threshold` — порог бинаризации изображения (0–255, по умолчанию 128)
- Миграция: `pocketbase/pb_migrations/1772000010_create_pixel_art_worksheets.js`

### Единичная окружность

**unit_circle_worksheets** - `{ id, title, task_type: text, variants_count: number, settings: json, tasks_data: json }`
- Access: Superuser only
- `settings` — объект настроек (circlesPerPage, pointsPerCircle, maxK, showAxes, showDegrees, showTicks, showTeacherKey и др.)
- `tasks_data` — массив вариантов: `Variant[][]`, каждый `Variant` = массив `Task` с полями `{type, points: [{id, num, den, k, display}]}`
- `display` — LaTeX-строка угла: `\dfrac{13\pi}{6}`, `-\pi`, `0` и т.д.
- Миграция: `pocketbase/pb_migrations/1772000012_create_unit_circle_worksheets.js`

### Марафон

**marathons** - `{ id, title, class_number: number, tasks: relation[]→tasks, task_order: json([id,...]), students: json([{name}]), tracking_data: json }`
- Access: Superuser only
- `task_order` — массив task id в порядке сложности, управляет отображением
- `students` — список участников марафона
- `tracking_data` — прогресс: `{ "Иванов": { "0": { attempts: 2, solved: false, failed: false }, "1": { attempts: 1, solved: true, failed: false } } }`; ключи — имена учеников, внутри — индексы задач (0-based)
- Миграция: `pocketbase/pb_migrations/1772000014_create_marathons.js`

### Тесты с выбором (MC)

**mc_tests** - `{ id, title, description, class_number: number, topics: relation[]→topics, options_count: number(2-8), shuffle_mode: "fixed"|"per_student", variants: json([{tasks: [{id, options: [{text, is_correct}]}]}]) }`
- Access: Superuser only
- `variants[i].tasks[j].options` — массив вариантов ответов, ровно один с `is_correct: true`
- `shuffle_mode: "per_student"` — порядок опций детерминированно перемешивается у каждого студента (seed = hash(attemptId+taskId))
- Миграция: `pocketbase/pb_migrations/1772000017_create_mc_tests.js`

**Изменения в `work_sessions`**:
- Добавлено поле `mc_test: relation→mc_tests` (optional)
- Поле `work` сделано опциональным (миграция `1772000018_make_work_optional_in_sessions.js`) — для MC-сессий хранится только `mc_test`
- `attempt.variant` для MC — текстовое значение "1"/"2" (номер варианта внутри `mc_tests.variants`), не relation
- `attempt_answers.answer_raw` для MC — индекс выбранной опции "0"/"1"/"2"/"3"

### Access Control
- tasks, topics, tags, subtopics, works, variants, cards, qr_worksheets, pixel_art_worksheets, unit_circle_worksheets, marathons: Superuser only
- achievements: Public read, Superuser write
- students: Self-read + unauth all; self-update + unauth update
- attempts: Own + unauth all (read); Public (write)
- work_sessions, attempt_answers: Public

## App Navigation (App.jsx views)

| View Key | Label | Component |
|----------|-------|-----------|
| `tasks` | Все задачи | TaskList |
| `stats` | Аналитика | TaskStatsDashboard |
| `catalog` | Каталог | TaskCatalogManager |
| `generator` | Устный счёт | OralWorksheetGenerator |
| `test-generator` | Контрольные работы | TestWorkGenerator |
| `mc-test` | Тесты с выбором | MCTestGenerator |
| `work-manager` | Работы | WorkManager |
| `work-editor` | Редактор работ | WorkEditorPage |
| `students` | Прогресс учеников | StudentProgressDashboard |
| `student-detail` | Детали ученика | StudentDetailPage |
| `achievements` | Достижения | AchievementManager |
| `import` | Импорт задач | TaskImporter |
| `geometry-tasks` | Геометрия — задачи | GeometryTaskList |
| `geometry-topics` | Геометрия — темы | GeometryTopicManager |
| `ege-generator` | Варианты ЕГЭ | EgeVariantGenerator |
| `ege-score-calc` | Калькулятор баллов | EgeScoreCalculator |
| `qr-worksheet` | QR-листы | QRWorksheetGenerator |
| `pixel-art` | Пиксель-арт | PixelArtWorksheet |
| `unit-circle` | Единичная окружность | UnitCircleGenerator |
| `tdf` | ТДФ | TDFManager |
| `tdf-editor` | ТДФ — Редактор конспекта | TDFEditor |
| `tdf-variants` | ТДФ — Варианты | TDFVariantBuilder |
| `theory-browser` | Библиотека | TheoryBrowser |
| `theory-editor` | Редактор | TheoryEditor |
| `theory-view` | Просмотр | TheoryArticleView |
| `theory-print` | Конспекты | TheoryPrintBuilder |
| `theory-categories` | Категории | TheoryCategoryManager |
| `marathon` | Марафон | MarathonGenerator |
| `cryptogram` | Шифровки | CryptogramGenerator |
| `trig-expressions` | Вычисление выражений | TrigExpressionsGenerator |
| `inverse-trig` | Обратные функции | InverseTrigGenerator |
| `trig-equations` | Уравнения | TrigEquationsGenerator |
| `trig-double` | Двойной аргумент | DoubleAngleGenerator |
| `trig-advanced` | Уравнения f(kx+b)=a | TrigEquationsAdvancedGenerator |
| `trig-mixed` | Смешанная работа | TrigMixedGenerator |

**Landing Page** (`/landing.html`) — отдельный entry point, 2 версии дизайна (V1 + V2). Полностью автономный (без Ant Design, PocketBase).

## Student Flow

**Главная страница без sessionId** (`/student/`):
- `StudentHomeLanding` — поле ввода кода сессии + личный кабинет
- Не авторизован: кнопки «Войти» / «Зарегистрироваться» (открывают `StudentAuthPage` с `initialTab`)
- Авторизован: приветствие с именем, кнопки «Мой прогресс» / «Мои достижения», «Выйти»
- `homeView` state в `StudentApp.jsx`: `null | 'login' | 'register' | 'progress' | 'gallery'`

**Тест** URL: `/student/{sessionId}`

```
1. Load session by sessionId
2. Check auth (localStorage) → StudentAuthPage if needed
3. No attempt → StudentEntryPage → startAttempt() (round-robin variant)
4. attempt.status='started' → StudentTestPage (auto-save answers)
5. Submit → checkAnswer() for each task → calculate score
6. If achievements_enabled: getRandomAchievement() + checkUnlockedAchievements()
7. Save attempt_answers, update attempt status='submitted'
8. → StudentResultPage (results + achievements)
9. Polling every 10s for teacher-issued achievements
```

## Achievement System

- 72 predefined achievements (common/rare/legendary + condition-based)
- Random badges: one per attempt based on score (90%+→legendary, 70-89%→rare, 40-69%→common)
- Conditional: score≥100%, score≥90%, speed≤5min, count≥1/10/50, night_owl, early_bird
- Engine: `utils/achievementEngine.js`
- Teacher can manually award achievements
- **ВАЖНО (2026-02-21):** Дедупликация — глобальная по всем сессиям. При выдаче ачивок используются `getAttemptsByStudentAll` / `getAttemptsByDeviceAll` (не по session.id), чтобы не повторять уже полученные ачивки из других работ.
- `AchievementGallery` шапка: левая карточка — значок последней ачивки (`attempt.expand.achievement`), правая — общий прогресс.

## Answer Checking (answerChecker.js)

- Numeric comparison with epsilon (1e-6)
- Supports: decimals, fractions (1/3), LaTeX fractions (\frac{1}{3}), mixed fractions
- Alternatives via `|` separator (e.g., "3|3.0")
- Fallback: text comparison for non-numeric

## Important Conventions

### LaTeX Formatting
- Inline math: `$x^2 + y^2$`
- Block math: `$$\frac{a}{b}$$`
- KaTeX (not MathJax), wrapped in try-catch

### Difficulty Levels
- `1` - Basic (green, #52c41a)
- `2` - Medium (orange, #faad14)
- `3` - Advanced (red, #ff4d4f)

### Task Codes
- Format: `{topic_number}-{sequence}` (e.g., "14-001")
- Mordkovich: `M{paragraph}-{sequence}` (e.g., "M17-001")

## Common Tasks

### Running the Application (Dev)
```bash
./start.sh              # Только фронтенд (backend на VPS)
./start.sh --local-pdf  # Фронтенд + локальный PDF-сервис
./start.sh --full       # Фронтенд + локальный PB + PDF (полностью офлайн)
```

### Services
- PocketBase (VPS): https://task-ege.oipav.ru (Admin: https://task-ege.oipav.ru/_/)
- PDF Service (VPS): https://task-ege.oipav.ru/pdf
- **Student App (VPS):** https://student.oipav.ru/student/{sessionId}
- **Landing Page (VPS):** https://lemma.oipav.ru
- Teacher App (dev): http://localhost:5173
- Student App (dev): http://localhost:5173/student/{sessionId} (via student.html)
- Landing Page (dev): http://localhost:5173/landing.html

### VPS Deployment (147.45.158.148)
```
nginx (443) → task-ege.oipav.ru
  /api/, /_/    → PocketBase (:8095)   systemd: pocketbase-ege
  /pdf/         → PDF Service (:3001)  systemd: pdf-service-ege
  Telegram Bot                         systemd: telegram-bot-ege

nginx (443) → student.oipav.ru
  /            → /var/www/student-ege/student.html  (SPA)

nginx (443) → lemma.oipav.ru
  /            → /var/www/landings/lemma/index.html  (лендинг, SPA)
```
- Backups: `/opt/pocketbase/backups/` (cron every 6h, max 20 backups)
- Logs: `journalctl -u {pocketbase-ege|pdf-service-ege|telegram-bot-ege}`
- Manage: `systemctl {start|stop|restart|status} {pocketbase-ege|pdf-service-ege|telegram-bot-ege}`
- Deploy student: `./raspberry/deploy-student-to-vps.sh`
- Deploy landing: GitHub Actions (`.github/workflows/deploy-landing.yml`) — автоматически при push в `main`

### Raspberry Pi (192.168.1.68)
- Статический фронтенд через Nginx: `index.html` (учитель) + `student.html` (студент)
- `/student/` → `student.html`, `/` → `index.html`
- PocketBase, PDF, Telegram-бот — ОТКЛЮЧЕНЫ (всё на VPS)
- Deploy: `./raspberry/deploy-to-raspberry.sh`

### Database Backup
```bash
./backup.sh             # Create backup (sqlite3 .backup, safe while running)
./restore.sh            # Restore from backup (with safety checks)
```

### Build
```bash
cd ege-tasks && npm run build
```

## API Service (ege-tasks/src/shared/services/pocketbase.js)

~104 API методов. Реэкспорт через `src/services/pocketbase.js` для обратной совместимости.

Key function groups:
- **Topics:** getTopics, getTopic, createTopic, updateTopic
- **Subtopics:** getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic
- **Tags:** getTags, createTag, updateTag, deleteTag, findTagByTitle
- **Tasks:** getTasks, getTask, getTasksPage, createTask, updateTask, deleteTask, getRandomTasks, getRandomTasksWithoutRepetition, getTasksWithProgressiveDifficulty, getTaskStatementsAndCodes
- **Cards:** getCards, getCard, createCard, updateCard, deleteCard
- **Works:** getWorks, getWork, createWork, updateWork, deleteWork, archiveWork, unarchiveWork
- **Variants:** getVariantsByWork, getVariant, createVariant, updateVariant, deleteVariant
- **Sessions:** createSession, getSession, getSessionByWork, getSessionsByWork, getSessionsByWorks, updateSession
- **Attempts:** createAttempt, getAttemptByDevice, getAttemptsByDevice, getAttemptsByDeviceAll, getAttemptsByDeviceAllWithWorks, getAttemptsBySession, getAttemptsBySessions, getAttemptsByStudent, getAttemptsByStudentAll, getAttemptsByStudentAllWithWorks, updateAttempt, deleteAttempt, getAttemptsCountByWork, getAttemptsWithAchievements
- **Answers:** createAttemptAnswer, getAttemptAnswers, getAttemptAnswersByAttempts, getAttemptAnswersByAttemptsDetailed, updateAttemptAnswer, batchCreateAttemptAnswers, batchUpdateAttemptAnswers
- **Achievements:** getAchievements, getAchievement, getAchievementsByIds, createAchievement, updateAchievement, deleteAchievement
- **Students:** registerStudent, loginStudent, logoutStudent, isStudentAuthenticated, getAuthStudent, getStudents, updateStudent, getAttemptsByStudent, getAttemptsForRegisteredStudents, **mergeStudents(fromId, toId)** — перенос попыток + удаление аккаунта через серверный hook `POST /api/students/merge`
- **Theory:** getTheoryCategories, createTheoryCategory, updateTheoryCategory, deleteTheoryCategory, getTheoryArticles, getTheoryArticle, createTheoryArticle, updateTheoryArticle, deleteTheoryArticle, getTheoryArticleCountByCategory
- **Stats:** getUniqueYears (legacy), getUniqueSources (legacy), **getTasksStatsSnapshot** (лёгкий, без answer/solution_md, batch:500), **getWithAnswerCount**, **getWithSolutionCount**, **getTasksForDuplicateCheck** (lazy, только для вкладки дубликатов)
- **Geometry:** getGeometryTopics, createGeometryTopic, updateGeometryTopic, deleteGeometryTopic, getGeometrySubtopics, createGeometrySubtopic, updateGeometrySubtopic, deleteGeometrySubtopic, **getGeometryTasks** (LIGHT_FIELDS — без geogebra_base64/solution_md, но с geogebra_image_base64/preview_layout), **getGeometryTask** (полная запись — для редактора), createGeometryTask, updateGeometryTask, deleteGeometryTask, **getGeometryImageUrl(task)** (URL файла `geogebra_image_base64`, fallback на legacy поля), getGeometryPrintTests, createGeometryPrintTest, updateGeometryPrintTest, deleteGeometryPrintTest
- **TDF:** getTdfSets, getTdfSet, createTdfSet, updateTdfSet, deleteTdfSet, getTdfItems, createTdfItem, updateTdfItem, deleteTdfItem, **getTdfItemDrawingUrl(item)** (`{PB_URL}/api/files/tdf_items/{id}/{drawing_image}`), getTdfVariants, getTdfVariant, createTdfVariant, updateTdfVariant, deleteTdfVariant
- **QR-листы:** getQrWorksheets (sort: -created, expand: tasks), createQrWorksheet, updateQrWorksheet, deleteQrWorksheet
- **Пиксель-арты:** getPixelArtWorksheets (sort: -created, expand: tasks), createPixelArtWorksheet, updatePixelArtWorksheet, deletePixelArtWorksheet
- **Единичная окружность:** getUnitCircleWorksheets (sort: -created), createUnitCircleWorksheet, updateUnitCircleWorksheet, deleteUnitCircleWorksheet
- **Марафон:** getMarathons (sort: -created, expand: tasks), getMarathon(id) (getOne — надёжный expand), createMarathon, updateMarathon, deleteMarathon
- **MC-тесты:** getMCTests (sort: -created), getMCTest (getOne, expand: topics), createMCTest, updateMCTest, deleteMCTest, getTasksByIds (батч), createMCTestSession (mcTestId, extra={}) — создаёт `work_sessions` с заполненным только `mc_test`, getSessionsByMCTest

## PDF Export System

- **Primary:** Puppeteer (port 3001) - perfect KaTeX, vector text, 2-3x smaller
- **Fallback:** html2pdf.js (automatic if service unavailable)
- **Hook:** `usePuppeteerPDF` → `exportToPDF(printRef, filename, options)`
- **API:** `POST /generate` (html, filename, options) → PDF
- **Sdamgia parser:** `POST /parse-sdamgia` (url) → [{id, condition, answer, images}]

## Key Files to Modify

- Frontend components: `ege-tasks/src/components/*.jsx`
- Student components: `ege-tasks/src/components/student/*.jsx`
- Catalog components: `ege-tasks/src/components/catalog/*.jsx`
- Worksheet components: `ege-tasks/src/components/worksheet/*.jsx`
- Custom hooks: `ege-tasks/src/hooks/*.js`
- API service: `ege-tasks/src/services/pocketbase.js`
- Context: `ege-tasks/src/contexts/ReferenceDataContext.jsx`
- Utils: `ege-tasks/src/utils/*.js`
- Main apps: `ege-tasks/src/App.jsx`, `ege-tasks/src/StudentApp.jsx`
- Entrypoints: `ege-tasks/src/teacher/main.jsx`, `ege-tasks/src/student/main.jsx`, `ege-tasks/src/landing/main.jsx`
- Landing page: `ege-tasks/src/landing/` (standalone, no Ant Design/PocketBase)
- Shared code: `ege-tasks/src/shared/` (services, components, utils)
- Styles: `ege-tasks/src/App.css`
- Backend hooks: `pocketbase/pb_hooks/*.js`
- PDF service: `pocketbase/pdf-service.js`
- Migrations: `pocketbase/pb_migrations/*.js`
- Geometry components: `ege-tasks/src/components/geometry/*.jsx`
- Theory components: `ege-tasks/src/components/theory/*.jsx`
- Config: `ege-tasks/.env` (VITE_PB_URL, VITE_PDF_SERVICE_URL, VITE_STUDENT_URL), `ege-tasks/vite.config.js`

## Development Notes

### When Adding New Features
1. Frontend changes: `ege-tasks/src/`
2. DB schema changes: new migration in `pocketbase/pb_migrations/`
3. API changes: update `ege-tasks/src/services/pocketbase.js`
4. Use `useReferenceData()` context for global data (topics, tags, etc.)
5. Reuse existing hooks (useWorksheetGeneration, useTaskDragDrop, useWorksheetActions)
6. Reuse worksheet components from `worksheet/` directory
7. Student and teacher interfaces are isolated — be careful with auth
8. Always test LaTeX rendering after text changes
9. Build check: `cd ege-tasks && npm run build`

### Security Notes
- Teacher loads App.jsx → auto-logout from student account (prevents data leaks)
- Student auth is PocketBase Auth (students collection)
- Unauth users = teachers/admins (special rules in PocketBase)
- Never expose admin credentials in frontend code

### Known Patterns
- Image URLs: `{PB_URL}/api/files/{collection}/{record}/{filename}`
- Task replacement: exclude duplicates within variant, filter by topic/subtopic
- Distribution sorting: tag distribution preserves grouping, difficulty preserves order
- Variant order: stored as JSON `[{taskId, position}]`
- **Geometry LIGHT_FIELDS pattern**: `getGeometryTasks()` использует `fields` param — исключает тяжёлые поля (geogebra_base64 ~30-100KB, solution_md), но включает `geogebra_image_base64` и `preview_layout` для списка/быстрого предпросмотра. Для редактирования **всегда** вызывать `getGeometryTask(id)`.
- **GeoGebra .ggb формат**: `geogebra_base64` хранит base64-кодированный XML (это и есть `.ggb` файл). `ggbApi.getBase64(cb)` → сохранить; `initialBase64` prop в `GeoGebraApplet` → восстановить.
- **Stats snapshot pattern**: `getTasksStatsSnapshot()` возвращает лёгкие поля (без `answer`, `solution_md`, `statement_md`). Счётчики `withAnswer`/`withSolution` получаются отдельными count-запросами. `statement_md` загружается лениво через `getTasksForDuplicateCheck()` только при открытии вкладки "Дубли" в Каталоге. Snapshot кешируется в `ReferenceDataContext` и расшаривается между Stats и Catalog.
- **Theory GeoGebra — только картинки**: В статьях теории GeoGebra используется только для рисования чертежей (в GeoGebraBlocksModal), результат сохраняется как PNG (`previewImage`). В просмотре/печати — только `<img>`, никаких живых аплетов. `TheoryArticleView` вставляет картинки через простую DOM-манипуляцию (без createRoot).
- **Canvas tainted pattern**: при canvas-операциях (crop, export) нельзя использовать remote PocketBase URL напрямую — `toDataURL()` бросит «tainted canvas». Конвертировать: `fetch(url) → r.blob() → new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(blob) })`. Актуально везде где remote URL передаётся в CropModal/cropPngByMargins.
- **@page multi-page margins**: `padding` на корневом элементе применяется только один раз — вторая и последующие страницы отступа не получают. Отступы задавать через `@page { margin }`. Инжектировать динамически перед `window.print()` через `document.createElement('style')` и удалять через `setTimeout(..., 1500)` — не писать статично в CSS, чтобы не конфликтовать между разделами.
- **Scoped print CSS**: не использовать `body { visibility: hidden }` глобально в `@media print` — ломает печать из других разделов. Использовать `body:has(.root-class) { visibility: hidden }` — паттерн применён в GeometryWorksheetPrint.css, GeometryTaskPreview.css, QRWorksheetGenerator.css.
- **Print isolation — scoped body:has()**: единственный надёжный паттерн. Print-блок рендерится **inline** (не Portal), `@media print { body:has(.root) { visibility: hidden } .root { visibility: visible; position: absolute; top:0; left:0; width:100% } .root * { visibility: visible } }`. Применён во всех печатных разделах включая MarathonGenerator. **React Portal для печати — ненадёжен**: даёт пустые страницы, т.к. Portal-элемент занимает место в потоке даже при `display: none`.
- **PocketBase expand одного relation**: при одном связанном record PocketBase возвращает object (не array). Нормализация обязательна: `const raw = item.expand?.field; const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];`
- **PocketBase getOne vs getFullList expand**: `getFullList` с `expand` ненадёжен для relation с большим числом записей. При загрузке конкретной записи всегда использовать `getOne(id, {expand: '...'})` — expand гарантированно полный.
- **Student dark theme**: `isDark` в `localStorage` (`student-theme`). Ant Design: `theme.darkAlgorithm` / `theme.defaultAlgorithm` в `ConfigProvider`. CSS через `.student-theme-dark` на корневом div. Кнопки топбара — нативные `<button class="student-theme-toggle">` (не Ant Design), чтобы все выглядели одинаково.
- **override-паттерн для generate()**: когда агрегатор вызывает несколько хуков сразу, React не успевает применить setState до вызова `generate()`. Решение — добавить параметр: `generate(override)` → `const s = override ? { ...settings, ...override } : settings`. Применён во всех тригонометрических хуках (useTrigExpressions, useInverseTrig, useReductionFormulas, useAdditionFormulas, useTrigEquations, useUnitCircle, useDoubleAngle, useTrigEquationsAdvanced).
- **GENERATOR_REGISTRY паттерн**: для расширяемых агрегаторов — массив `GENERATOR_REGISTRY` (id, label, instruction, questionMode) + объект `INITIAL_GEN_CONFIGS` + `hookMap` (id→хук). Добавление нового генератора = одна запись в массиве + хук + запись в configs. Применён в `TrigMixedGenerator`.
- **КИМ — A5-страницы (EgeVariantGenerator)**: Для печати в формате КИМ используется **двухфазный рендер**: (1) все задачи рендерятся в скрытый div внутри React-дерева (CSS применяется корректно — таблицы, KaTeX); `useLayoutEffect` синхронно снимает `offsetHeight`; (2) `paginateKimByHeight()` жадным алгоритмом раскладывает задачи по A5-страницам. Ширина измерительного контейнера: 132.5mm (A5 148.5mm − 2×8mm padding). Высота для задач: 180mm (обычная), 159mm (первая — с рамкой-примечанием). Gap: 3mm. Формат печати: `@page { size: A5 portrait; margin: 0; }` на верхнем уровне CSS + инжекция через `handleKimPrint`. Для A4-буклета: «2 страницы на листе» в диалоге печати.

## Related Documentation

- `README.MD` - Полное руководство пользователя
- `ARCHITECTURE.md` - Архитектура проекта
- `CHANGELOG.md` - История изменений (v1.0 → v3.9.0)
- `DATABASE_SAFETY.md` - Правила безопасности БД
- `BACKUP_GUIDE.md` - Руководство по бэкапам
- `PDF_EXPORT_UPGRADE.md` - PDF экспорт через Puppeteer
- `QUICK_START.md` - Быстрый старт
- `START_GUIDE.md` - Руководство по запуску
- `TEST_AND_COMMIT.md` - Тестирование и коммиты
- `SDAMGIA_TABLE_PARSING.md` - Парсинг таблиц sdamgia.ru
