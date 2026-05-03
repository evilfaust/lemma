---
name: Features History
description: Детали реализованных фич по версиям — что где лежит, важные нюансы
type: project
originSessionId: 5c0dcb24-e2eb-4e23-a8ea-b1b672de9d7a
---

## Улучшение пикселизации (v3.9.19, 2026-05-03)

**Новые утилиты:**
- `utils/imageProcessing.js` — `processImageToMatrix(file, cols, rows, {threshold, mode})`, `autoCropFile(file)`, `computeOtsuFromFile(file)`, `computeOtsu(gray)`
- `utils/matrixOps.js` — `removeNoise`, `closeHoles`, `thicken`, `smooth`, `invertMatrix`

**Новый компонент:** `pixel-art-team/TeamImageUploader.jsx`
- 4 режима: original / silhouette (Otsu) / contour (Собель) / contrast (S-кривая)
- Автообрезка по bounding box (порог 230, отступ 7%)
- 4 мини-превью режимов (рендерятся на уменьшенной сетке ≤22, debounce 600мс)
- 5 кнопок очистки матрицы
- Авто-пересчёт через useEffect([activeFile, gridCols, gridRows, threshold, mode])
- `activeFile = autoCroppedFile || imageFile` — сброс при смене imageFile

**Подключён в обоих компонентах:**
- `TeamPixelArtWorksheet` — вместо `ImageUploader`; дефолт сетки 48→60, макс ×40→×50; подсказка размера клетки в мм через `calcCellSize`
- `PixelArtWorksheet` — вместо `ImageUploader`; `handleImageChange` упрощён (убран `processImage`); `handleApply` стал no-op

**Архитектурный принцип:** `onMatrixChange={pa.setMatrix}` — компонент владеет обработкой, хук хранит матрицу.
## Markdown Export (v3.7.8, 2026-03-19)

- Кнопка «Экспорт MD»: OralWorksheetGenerator, TestWorkGenerator, WorkEditor
- Появляется при `variants.length > 0` (или `work` загружен в WorkEditor)
- Формат: `# Название`, `## Вариант N`, `**N.** \`code\``, условие, `> **Ответ:** X`, `---`
- В WorkEditor кнопка всегда видна при открытой работе (не зависит от ActionButtons)

## Объединение аккаунтов (v3.7.8, 2026-03-19)

- StudentProgressDashboard: кнопка «Объединить» — перенос попыток + удаление исходного аккаунта
- API: `mergeStudents(fromId, toId)` → POST `/api/students/merge` (серверный PocketBase hook)

## sdamgia импорт (v3.7.8, 2026-03-19)

- `SDAMGIA_SOURCE_LABELS` в `utils/markdownTaskParser.js`: ege_base / ege_prof / oge / vpr5-8
- TaskImporter: выпадающий список «Тип работы» → поле `source` задачи

## ТДФ — Теоремы, Определения, Формулы (v3.7.9, 2026-03-25)

- 5 компонентов в `components/tdf/`: TDFManager, TDFEditor, TDFItemModal, TDFVariantBuilder, TDFPrintView (+CSS)
- 3 коллекции БД: `tdf_sets`, `tdf_items`, `tdf_variants`; Access: Superuser only
- 7 типов: theorem(blue) · definition(green) · formula(purple) · axiom(orange) · property(cyan) · criterion(magenta) · corollary(gold)
- Печатный вид: A4 landscape, 5 колонок: №+тип-вертикально, Тема+Формулировка, Вопрос, Чертёж, Краткая запись
- mode="etalon" (полный конспект) / mode="blank" (бланк ученика)

## Генератор вариантов ЕГЭ — КИМ (v3.7.9, обновлён 2026-03-27)

- EgeVariantGenerator.jsx — базовый ЕГЭ (21 задание), стиль КИМ
- Двухфазный рендер: (1) скрытый div → CSS → `useLayoutEffect` снимает offsetHeight; (2) `paginateKimByHeight()`
- @page A5 portrait: инжектировать `handleKimPrint` перед window.print(); `@page` на верхнем уровне CSS
- Ширина измерения: 132.5mm (A5 148.5mm − 2×8mm). Высоты: 180mm обычная / 159mm первая страница
- EgeScoreCalculator: 19 заданий профильного ЕГЭ 2025, max 32 первичных балла

## QR-листы (v3.8.0, 2026-03-28)

- QRWorksheetGenerator + 3 sub-компонента (qr-worksheet/) + useQRWorksheet + qrMatrix.js/qrGridFill.js
- Коллекция `qr_worksheets`: title, qr_url, tasks, custom_answers, grid, qr_size
- Сокращение URL: `https://clck.ru/--?url=...` — CORS открыт, без прокси
- Миграция: `1772000009_create_qr_worksheets.js`

## Пиксель-арты (v3.8.3, 2026-04-01)

- PixelArtWorksheet + 2 sub-компонента (pixel-art/) + usePixelArt + imageToMatrix.js
- Коллекция `pixel_art_worksheets`: title, tasks, custom_answers, grid, matrix(bool[][]), grid_cols/rows/threshold, two_sheets/show_teacher_key/two_columns
- `two_columns` сохраняется в БД и восстанавливается при загрузке
- Миграция: `1772000010_create_pixel_art_worksheets.js`

## StudentHomeLanding (v3.8.3, 2026-04-01)

- Главная `/student/` без sessionId — личный кабинет + поле ввода сессии
- `homeView` в StudentApp.jsx: `null | 'login' | 'register' | 'progress' | 'gallery'`
- StudentAuthPage принимает `initialTab = 'login'` prop
- Логотип: `/lemma-logo-new.png` (height 26px, opacity 0.6)
- Deploy копирует `lemma-logo-new.png` и `icon-new.png` на VPS

## Ученический интерфейс — темы (v3.8.2, 2026-04-01)

- isDark в localStorage ('student-theme'), по умолчанию светлая
- Ant Design: `theme.darkAlgorithm` / `theme.defaultAlgorithm` в ConfigProvider
- CSS dark mode: `.student-theme-dark` на корневом div → переопределения через `StudentApp.css`
- Кнопки топбара: нативные `<button class="student-theme-toggle">` (не Ant Design Button)
- Inter шрифт: подключён в student.html через Google Fonts

## ТДФ — кадрирование (v3.8.2, 2026-04-01)

- Canvas tainted fix: remote URL конвертируется `fetch → blob → FileReader.readAsDataURL`
- TDFPrintView книжная ориентация: переключатель portrait + @page инжектируется динамически

## Тригонометрия — Единичная окружность (v3.8.4, 2026-04-05)

- UnitCircleGenerator + 3 sub (trig/) + useUnitCircle
- Коллекция `unit_circle_worksheets`; миграция: `1772000012_create_unit_circle_worksheets.js`
- formatAngleLatex() → `\dfrac{13\pi}{6}`. В SVG через `<foreignObject>`
- 16 стандартных углов + смещение ±k×2π (k до ±4)
- Печать: 2 кружка (95mm) или 4 кружка (84mm) на A4

## Марафон (v3.9.0, 2026-04-06)

- MarathonGenerator.jsx — 4 вкладки: Настройка / Карточки / Лист учителя / Рейтинг
- 5 компонентов: MarathonGenerator + marathon/{CardsPrint, TeacherSheet, RatingPrint, Tracker}
- useMarathon.js — state: title, classNumber, tasks, students, trackingData, savedId
- Коллекция `marathons`; миграция: `1772000014_create_marathons.js`
- Трекер: ✓/✗, до 3 попыток; очки +3/+2/+1/0; сортировка по баллам, 🥇 лидер

## Тригонометрия — генераторы листов (v3.9.3, 2026-04-13)

- TrigExpressionsGenerator + useTrigExpressions — вычисление выражений sin/cos/tg/ctg
- InverseTrigGenerator + useInverseTrig — arcsin/arccos/arctg/arcctg: basic/sum/nested/mixed
- TrigEquationsGenerator + useTrigEquations — sin/cos/tg/ctg t=a, общие формулы
- TrigExprPrintLayout — универсальный print; questionMode='plain' = только уравнение
- DoubleAngleGenerator + useDoubleAngle — двойной аргумент: numeric/symbolic/mixed
- TrigEquationsAdvancedGenerator + useTrigEquationsAdvanced — f(kx+b)=a
- TrigMixedGenerator — агрегатор: GENERATOR_REGISTRY + hookMap + drag&drop

## Тригонометрические MC-тесты (v3.9.12, 2026-04-25)

- Поддерживаемые генераторы: trig_expressions, reduction_formulas, addition_formulas, double_angle, inverse_trig, trig_equations, trig_equations_advanced
- Задачи сохраняются в `tasks` (source='trig_generator', topic = trig-тема)
- Выдача через `work_sessions.trig_mc_test` (миграция 1772000021)
- StudentMCTestPage обрабатывает оба типа (mc_test и trig_mc_test)
- TrigMCTestEditor — Modal с табами «Редактор» / «Выдача»
- Удаление каскадное: при удалении trig_mc_test удаляются связанные tasks (source='trig_generator')

## GeoGebra в теории (refactored 2026-03-08)

- Только картинки — никаких живых аплетов в статьях. Нарисовал → сохранил PNG → `<img>`
- GeoGebraBlocksModal — Drawer (580px). Кнопки: «Сохранить» / «Сохранить и вставить»
- useGeoGebraInjection (`hooks/`) — внедрение PNG в HTML (TheoryEditor + TheoryArticleView)
- Markdown синтаксис: `:::geogebra ggb-id:::` (one-line), данные из `theme_settings.geogebra_applets`
- TheoryArticleView — DOM-вставка `<img>` через useEffect (без createRoot)
- GeoGebra высота в Drawer: `offsetHeight` в `afterOpenChange` (requestAnimationFrame) → key GeoGebraApplet
- VPS DB: `theory_articles.theme_settings` — JSON без лимита (maxSize: 0)

## Image Support в задачах (2026-02-24)

- TaskEditModal — 3 режима: URL / файл / GeoGebra drawing (panel + crop)
- GeoGebraDrawingPanel — без сохранения состояния, только PNG export + crop
- Коллекция `tasks`: поля `image` (file) + `image_url` (text) + `has_image` (bool)
- PocketBase SDK создаёт FormData автоматически при наличии File в payload

## Achievement System (updated 2026-03-01)

- 72 ачивки (было 30 → 48 → 72), иконки icon049-icon073
- Дедупликация глобальная: `getAttemptsByStudentAll` / `getAttemptsByDeviceAll` (без session.id)
- Random: score 90%+→legendary, 70-89%→rare, 40-69%→common
- Conditional: score≥100%/90%, speed≤5min, count≥1/10/50, night_owl, early_bird
- AchievementGallery шапка: левая — значок последней ачивки (attempt.expand.achievement), правая — общий прогресс

## Performance Optimization (2026-03-01)

- getTasksStatsSnapshot — лёгкий: id,topic,subtopic,tags,difficulty,has_image,source,year (без answer/solution_md), batch:500
- getWithAnswerCount/getWithSolutionCount — count-запросы (getList(1,1,{filter}))
- getTasksForDuplicateCheck — ленивый, только для вкладки Дубли в Каталоге
- getUniqueYears/getUniqueSources — legacy, не используются (years/sources из snapshot)
- Snapshot кешируется в ReferenceDataContext, расшаривается между Stats и Catalog

## Ollama / AI Define Service

- AI-определения в шифровках (CryptogramGenerator)
- Используется Timeweb AI Gateway (deepseek/deepseek-v4-flash, ~3-4 сек)
- Wrapper systemd на порту 11435; nginx /define → 172.18.0.1:11435
- Ollama удалена с Pi, сервис полностью на VPS
