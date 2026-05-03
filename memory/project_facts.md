---
name: Project Facts & Architecture
description: Ключевые факты о проекте, количество компонентов, архитектурные точки, завершённые рефакторинги
type: project
originSessionId: 5c0dcb24-e2eb-4e23-a8ea-b1b672de9d7a
---
## Project Facts

- Frontend: React 18 + Vite + Ant Design 5.12, at `ege-tasks/`
- Backend: PocketBase, at `pocketbase/` (на VPS, локально может отсутствовать)
- All responses must be in Russian (CLAUDE.md)
- Build check: `cd ege-tasks && npm run build` (собирает ВСЕ ТРИ: index.html + student.html + landing.html)
- Три Vite-приложения: teacher (index.html → src/teacher/main.jsx) + student (student.html → src/student/main.jsx) + landing (landing.html → src/landing/main.jsx)
- tldraw удалён: требует коммерческую лицензию для production
- Landing page — автономный (без Ant Design, PocketBase, Monaco), 16.2 KB JS gzip
- Shared код: `src/shared/` — pocketbase.js, pocketbaseUrl.js, MathRenderer.jsx, shuffle.js, escapeFilter.js
- Старые пути (`services/pocketbase`, etc.) — реэкспорты из shared, ~50 файлов не менялись
- Student URL: https://student.oipav.ru/student/{sessionId} (VPS: /var/www/student-ege/)
- VITE_STUDENT_URL = https://student.oipav.ru/student (в .env)
- Deploy student → VPS: `./raspberry/deploy-student-to-vps.sh`
- SSH на VPS: sshpass работает (`sshpass -p '...' ssh root@147.45.158.148`), ключи не авторизованы

## Component Count (as of 2026-05-01)

- 37+ main components in `components/`
- Подпапки: `catalog/` (7), `geometry/` (7), `tdf/` (5), `theory/` (4), `qr-worksheet/` (3), `pixel-art/` (2), `trig/` (6+), `marathon/` (4), `route-sheet/` (4), `mc-test/` (2), `shared/` (1), `worksheet/` (12), `student/` (9)
- 23+ hooks in `hooks/`
- 13 utils in `utils/`
- 1 context in `contexts/` (ReferenceDataContext)
- 1 service (`pocketbase.js`) с ~133 API методами
- Landing: 8 V1 + 8 V2 секционных компонентов

## Key Architectural Points

- **ReferenceDataContext** предоставляет topics, tags, subtopics, years, sources, theoryCategories, tasksSnapshot, withAnswerCount, withSolutionCount, egeBaseTopics, egeProfileTopics, trigTopics. Years/sources вычисляются из snapshot через useMemo (не отдельные API-запросы). `reloadSnapshot()` для лёгкого обновления.
- TestWorkGenerator — эталонная реализация (cleanest decomposition)
- OralWorksheetGenerator полностью рефакторен (все reusable хуки/компоненты)
- WorksheetGenerator — другая архитектура (карточки, не варианты) — ограниченное переиспользование
- Theory module: 5 компонентов (Browser, Editor, ArticleView, CategoryManager, PrintBuilder)
- TaskCatalogManager декомпозирован на 6 tab-компонентов + MergeModal
- TheoryEditor lazy-loaded через React.lazy (Monaco ~500KB в отдельном chunk)

## Refactoring Patterns (completed)

- Reusable hooks: useTaskEditing, useDistribution, useWorksheetGeneration, useTaskDragDrop, useWorksheetActions, useTaskImport, useAvailableTags, useTaskCounter, useImageUpload, useGeoGebraOperations, useTopicSubtopicCreation
- Reusable компоненты в `worksheet/`: SaveWorkModal, LoadWorkModal, VariantRenderer, AnswersPage, VariantStats, ActionButtons, DistributionPanel, FilterBlock, VariantSettings, FormatSettings
- CropModal (shared/CropModal.jsx) — единый модал обрезки PNG, заменил 3 дубля
- GeometryTaskEditor decomposition — 4 вкладки → geometry/Tab*.jsx (985→414 строк)
- Fisher-Yates shuffle в `utils/shuffle.js`
- `escapeFilter()` в `utils/escapeFilter.js`
- `normalize.js` — normalizeLabel, normalizeStatementStrict, normalizeStatementLoose

## Raspberry Pi Deploy

- URL: `https://l.oipav.ru/` → nginx в Docker (порт 80/443), TLS Let's Encrypt, Basic Auth (evilfaust)
- SSH: только через внешний адрес `ssh -p 22222 faust@88.201.208.15`
- Deploy: `rsync -az --delete --exclude='.DS_Store' -e 'ssh -p 22222' ege-tasks/dist/ faust@88.201.208.15:/opt/docker/nginx/html/`
