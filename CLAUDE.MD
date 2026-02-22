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

**EGE Tasks Manager** — полнофункциональная веб-платформа для учителей математики. Два интерфейса:
- **Учительский** — управление задачами, генерация работ, выдача тестов, просмотр результатов
- **Ученический** (`/student/{sessionId}`) — прохождение тестов, результаты, достижения

Текущая версия: **3.6.2** (февраль 2026)

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
│   │   ├── components/           # React components (25+)
│   │   │   ├── catalog/          # Catalog sub-components (7)
│   │   │   ├── worksheet/        # Reusable worksheet components (12)
│   │   │   └── student/          # Student-facing components (7)
│   │   ├── hooks/                # Custom React hooks (12)
│   │   ├── services/             # API services (pocketbase.js)
│   │   ├── utils/                # Utility functions (9)
│   │   ├── contexts/             # React contexts (ReferenceDataContext)
│   │   ├── App.jsx               # Teacher interface + routing
│   │   └── main.jsx              # Entry point (dual routing)
│   ├── package.json
│   └── vite.config.js
├── pocketbase/                   # Backend
│   ├── pocketbase                # Executable
│   ├── pb_data/                  # Database and storage
│   ├── pb_migrations/            # Database migrations (48 files)
│   ├── pb_hooks/                 # PocketBase JS hooks (pdf.pb.js)
│   ├── pdf-service.js            # Standalone PDF + sdamgia service
│   ├── code.js                   # Task code generator
│   └── package.json
├── source/                       # Source markdown files for tasks
│   └── mordkovich/               # Mordkovich textbook tasks
├── backups/                      # Database backups
├── start.sh / stop.sh            # Start/stop all services
├── backup.sh / restore.sh        # Backup/restore database
├── pb_parser.py                  # Main task parser
├── pb_parser_mordkovich.py       # Mordkovich parser
├── pb_parser_theory.py           # Theory articles parser
└── package.json                  # Root (concurrently)
```

## Key Components

### Frontend Components (ege-tasks/src/components/)

**Task Management:**
- `TaskList.jsx` - Main task list with filtering, sorting, bulk operations, external filter support
- `TaskCard.jsx` - Individual task card display
- `TaskFilters.jsx` - Filter panel (topic, subtopic, tag, difficulty, year, source, image)
- `TaskEditModal.jsx` - Task editing modal with metadata
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
- `GeometryTaskList.jsx` - List of geometry tasks with filters, quick preview modal (drag+resize layout editing), editor
- `GeometryTaskEditor.jsx` - Geometry task editor: GeoGebra applet, PNG export+crop, hints, markdown condition/solution
- `GeometryTaskPreview.jsx` - A5 print preview (6 tasks/page) + student view; exports `GeometryPreviewCard`, `normalizeLayout`, etc.
- `GeometryTaskPreview.css` - Styles for geometry preview (absolute-% layer positioning)
- `GeoGebraApplet.jsx` - GeoGebra applet wrapper (geometry/graphing/classic/3d)
- `geometry/SaveGeometryPrintModal.jsx` / `LoadGeometryPrintModal.jsx` - Save/load A5 print sheets

**Student Progress:**
- `StudentProgressDashboard.jsx` - Teacher view of all students (attempts, scores, class)

**Student-Facing (components/student/):**
- `StudentApp.jsx` - Root student component (dual routing entry)
- `StudentAuthPage.jsx` - Login/Register (username + password)
- `StudentEntryPage.jsx` - Start test screen
- `StudentTestPage.jsx` - Answer questions (auto-save to localStorage)
- `StudentResultPage.jsx` - View results + achievements
- `AchievementBadge.jsx` - Single badge with animation
- `AchievementGallery.jsx` - All achievements collection

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

### Contexts (ege-tasks/src/contexts/)
- `ReferenceDataContext.jsx` - Global reference data (topics, tags, subtopics, years, sources, theoryCategories)
  - Hook: `useReferenceData()` - returns all reference data + `reloadData()`

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

**geometry_tasks** - `{ id, code, title, topic: relation→geometry_topics, subtopic: relation→geometry_subtopics, difficulty: number(1-3), statement_md, answer, solution_md, geogebra_base64: text (XML/.ggb состояние), geogebra_appname: "geometry"|"graphing"|"classic"|"3d", drawing_view: "image"|"geogebra", drawing_image: file (PNG, max 10MB), hints: json([{order, text_md}]), preview_layout: json({print:{image,text}, student:{image,text}}), source, year }`
- **ВАЖНО**: `geogebra_base64` — base64-кодированное содержимое `.ggb` файла. При открытии редактора задачу нужно загружать через `getGeometryTask(id)` (полная запись), а не из кеша списка (LIGHT_FIELDS не включает это поле).
- `drawing_image` хранит PNG-чертёж как файл PocketBase; URL: `{PB_URL}/api/files/geometry_tasks/{id}/{drawing_image}`

**geometry_print_tests** - `{ id, title, tasks: relation[]→geometry_tasks, task_order: json([id,...]) }`

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
| `catalog` | Каталог (переход из аналитики) | TaskCatalogManager |
| `generator` | Устный счёт | OralWorksheetGenerator |
| `test-generator` | Контрольные работы | TestWorkGenerator |
| `work-manager` | Работы | WorkManager |
| `work-editor` | Редактор работ | WorkEditorPage |
| `students` | Прогресс учеников | StudentProgressDashboard |
| `import` | Импорт задач | TaskImporter |
| `theory-browser` | Библиотека | TheoryBrowser |
| `theory-editor` | Редактор | TheoryEditor |
| `theory-view` | Просмотр | TheoryArticleView |
| `theory-print` | Конспекты | TheoryPrintBuilder |
| `theory-categories` | Категории | TheoryCategoryManager |
| `geometry` | Геометрия | GeometryTaskList |

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

- 30 predefined achievements (common/rare/legendary + condition-based)
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

## API Service (ege-tasks/src/services/pocketbase.js)

Key function groups:
- **Topics:** getTopics, getTopic, createTopic, updateTopic
- **Subtopics:** getSubtopics, createSubtopic, updateSubtopic, deleteSubtopic
- **Tags:** getTags, createTag, updateTag, deleteTag, findTagByTitle
- **Tasks:** getTasks, getTask, createTask, updateTask, deleteTask, getRandomTasks, getRandomTasksWithoutRepetition, getTasksWithProgressiveDifficulty, getTaskStatementsAndCodes
- **Cards:** getCards, getCard, createCard, updateCard, deleteCard
- **Works:** getWorks, getWork, createWork, updateWork, deleteWork, archiveWork, unarchiveWork
- **Variants:** getVariantsByWork, getVariant, createVariant, updateVariant, deleteVariant
- **Sessions:** createSession, getSession, getSessionByWork, getSessionsByWork, getSessionsByWorks, updateSession
- **Attempts:** createAttempt, getAttemptByDevice, getAttemptsByDevice, getAttemptsBySession, getAttemptsByStudent, updateAttempt, deleteAttempt, getAttemptsBySessions, getAttemptsCountByWork
- **Answers:** createAttemptAnswer, getAttemptAnswers, updateAttemptAnswer, batchCreateAttemptAnswers, batchUpdateAttemptAnswers
- **Achievements:** getAchievements, getAchievement, getAchievementsByIds, createAchievement, updateAchievement, deleteAchievement
- **Students:** registerStudent, loginStudent, logoutStudent, isStudentAuthenticated, getAuthStudent, getStudents, updateStudent, getAttemptsByStudent, getAttemptsForRegisteredStudents
- **Theory:** getTheoryCategories, createTheoryCategory, updateTheoryCategory, deleteTheoryCategory, getTheoryArticles, getTheoryArticle, createTheoryArticle, updateTheoryArticle, deleteTheoryArticle, getTheoryArticleCountByCategory
- **Stats:** getUniqueYears, getUniqueSources, getTasksStatsSnapshot
- **Geometry:** getGeometryTopics, createGeometryTopic, updateGeometryTopic, deleteGeometryTopic, getGeometrySubtopics, createGeometrySubtopic, updateGeometrySubtopic, deleteGeometrySubtopic, **getGeometryTasks** (LIGHT_FIELDS — без geogebra_base64/solution_md), **getGeometryTask** (полная запись — для редактора), createGeometryTask, updateGeometryTask, deleteGeometryTask, **getGeometryImageUrl(task)** (URL файла drawing_image или legacy base64), getGeometryPrintTests, createGeometryPrintTest, updateGeometryPrintTest, deleteGeometryPrintTest

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
- Entrypoints: `ege-tasks/src/teacher/main.jsx`, `ege-tasks/src/student/main.jsx`
- Shared code: `ege-tasks/src/shared/` (services, components, utils)
- Styles: `ege-tasks/src/App.css`
- Backend hooks: `pocketbase/pb_hooks/*.js`
- PDF service: `pocketbase/pdf-service.js`
- Migrations: `pocketbase/pb_migrations/*.js`
- Config: `ege-tasks/.env` (VITE_PB_URL), `ege-tasks/vite.config.js`

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
- **Geometry LIGHT_FIELDS pattern**: `getGeometryTasks()` использует `fields` param — исключает тяжёлые поля (geogebra_base64 ~30-100KB, solution_md). Для редактирования **всегда** вызывать `getGeometryTask(id)`, а не брать объект из списка — иначе редактор получит пустые поля и затрёт данные при сохранении.
- **GeoGebra .ggb формат**: `geogebra_base64` хранит base64-кодированный XML (это и есть `.ggb` файл). `ggbApi.getBase64(cb)` → сохранить; `initialBase64` prop в `GeoGebraApplet` → восстановить.

## Related Documentation

- `README.MD` - Полное руководство пользователя
- `ARCHITECTURE.md` - Архитектура проекта
- `CHANGELOG.md` - История изменений (v1.0 → v3.6.2)
- `DATABASE_SAFETY.md` - Правила безопасности БД
- `BACKUP_GUIDE.md` - Руководство по бэкапам
- `PDF_EXPORT_UPGRADE.md` - PDF экспорт через Puppeteer
- `QUICK_START.md` - Быстрый старт
- `START_GUIDE.md` - Руководство по запуску
- `TEST_AND_COMMIT.md` - Тестирование и коммиты
- `SDAMGIA_TABLE_PARSING.md` - Парсинг таблиц sdamgia.ru
