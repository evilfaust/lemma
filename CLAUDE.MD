# CLAUDE.MD - AI Assistant Context

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

**EGE Tasks Manager** — полнофункциональная веб-платформа для учителей математики. Три интерфейса:
- **Учительский** — управление задачами, генерация работ, выдача тестов, просмотр результатов
- **Ученический** (`/student/{sessionId}`) — прохождение тестов, результаты, достижения
- **Лендинг** (`/landing.html`) — промо-страница с описанием возможностей платформы

Текущая версия: **3.7.8** (март 2026)

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

### Contexts (ege-tasks/src/contexts/)
- `ReferenceDataContext.jsx` - Global reference data + tasks stats snapshot (cached)
  - Hook: `useReferenceData()` - returns: topics, tags, years, sources, subtopics, theoryCategories, tasksSnapshot, withAnswerCount, withSolutionCount, loading, reloadData(), reloadSnapshot()
  - **years/sources** вычисляются из `tasksSnapshot` через `useMemo` (не отдельные API-запросы)
  - **tasksSnapshot** — лёгкий snapshot всех задач (id,topic,subtopic,tags,difficulty,has_image,source,year), без тяжёлых текстовых полей
  - **reloadSnapshot()** — перезагрузить только snapshot + counts (для кнопок "Обновить" в Stats/Catalog)

### Utility Functions (ege-tasks/src/utils/)
- `achievementEngine.js` - Achievement system engine (random badges + conditional unlocks)
- `answerChecker.js` - Answer checking (numeric comparison, fractions, LaTeX, alternatives via `|`)
- `filterTaskText.js` - Filter common task prefixes
- `taskCodeGenerator.js` - Task code generator (format: `{topic}-{number}`)
- `markdownTaskParser.js` - Markdown task parser with YAML frontmatter + sdamgia parser
- `theoryThemes.js` - Theory theme configuration
- `shuffle.js` - Fisher-Yates shuffle
- `escapeFilter.js` - Escape PocketBase filter strings
- `normalize.js` - Text normalization
- `cropImage.js` - PNG crop utilities (clamp, normalizeCrop, loadImage, cropPngByMargins, dataUrlToFile)

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

### Access Control
- tasks, topics, tags, subtopics, works, variants, cards: Superuser only
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
| `work-manager` | Работы | WorkManager |
| `work-editor` | Редактор работ | WorkEditorPage |
| `students` | Прогресс учеников | StudentProgressDashboard |
| `student-detail` | Детали ученика | StudentDetailPage |
| `achievements` | Достижения | AchievementManager |
| `import` | Импорт задач | TaskImporter |
| `geometry-tasks` | Геометрия — задачи | GeometryTaskList |
| `geometry-topics` | Геометрия — темы | GeometryTopicManager |
| `theory-browser` | Библиотека | TheoryBrowser |
| `theory-editor` | Редактор | TheoryEditor |
| `theory-view` | Просмотр | TheoryArticleView |
| `theory-print` | Конспекты | TheoryPrintBuilder |
| `theory-categories` | Категории | TheoryCategoryManager |

**Landing Page** (`/landing.html`) — отдельный entry point, 2 версии дизайна (V1 + V2). Полностью автономный (без Ant Design, PocketBase).

## Student Flow

URL: `/student/{sessionId}`

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
```
- Backups: `/opt/pocketbase/backups/` (cron every 6h, max 20 backups)
- Logs: `journalctl -u {pocketbase-ege|pdf-service-ege|telegram-bot-ege}`
- Manage: `systemctl {start|stop|restart|status} {pocketbase-ege|pdf-service-ege|telegram-bot-ege}`
- Deploy student: `./raspberry/deploy-student-to-vps.sh`

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

## Related Documentation

- `README.MD` - Полное руководство пользователя
- `ARCHITECTURE.md` - Архитектура проекта
- `CHANGELOG.md` - История изменений (v1.0 → v3.7.3)
- `DATABASE_SAFETY.md` - Правила безопасности БД
- `BACKUP_GUIDE.md` - Руководство по бэкапам
- `PDF_EXPORT_UPGRADE.md` - PDF экспорт через Puppeteer
- `QUICK_START.md` - Быстрый старт
- `START_GUIDE.md` - Руководство по запуску
- `TEST_AND_COMMIT.md` - Тестирование и коммиты
- `SDAMGIA_TABLE_PARSING.md` - Парсинг таблиц sdamgia.ru
