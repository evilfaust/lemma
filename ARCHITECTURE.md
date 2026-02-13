# Архитектура приложения EGE Tasks Manager

## Оглавление
- [Общая архитектура](#общая-архитектура)
- [Dual Routing](#dual-routing)
- [State Management](#state-management)
- [Переиспользуемые хуки](#переиспользуемые-хуки)
- [Переиспользуемые компоненты](#переиспользуемые-компоненты)
- [Генераторы](#генераторы)
- [Студенческий интерфейс](#студенческий-интерфейс)
- [Система достижений](#система-достижений)
- [PDF экспорт](#pdf-экспорт)
- [Проверка ответов](#проверка-ответов)
- [Backend архитектура](#backend-архитектура)
- [Примеры использования](#примеры-использования)

---

## Общая архитектура

### Принципы

1. **Разделение ответственности** (Separation of Concerns)
   - Логика генерации → хуки (`hooks/`)
   - UI компоненты → компоненты (`components/`)
   - API вызовы → сервисы (`services/`)
   - Утилиты → utils (`utils/`)

2. **Переиспользование кода** (DRY)
   - Общая логика вынесена в хуки
   - UI компоненты переиспользуются между генераторами
   - Глобальные справочники через Context API

3. **Композиция над наследованием**
   - Генераторы собираются из маленьких компонентов
   - Хуки комбинируются для нужной функциональности

4. **Единообразие API**
   - Все хуки имеют похожий интерфейс
   - Компоненты используют единый стиль props

5. **Безопасность данных**
   - Студенческий и учительский интерфейсы полностью изолированы
   - Автоматический выход из студенческого аккаунта при загрузке учительского интерфейса

---

## Dual Routing

Приложение использует dual routing через `main.jsx`:

```
main.jsx
├── /student/* → StudentApp.jsx (Lazy)
│   ├── auth → StudentAuthPage
│   ├── entry → StudentEntryPage
│   ├── test → StudentTestPage
│   ├── result → StudentResultPage
│   └── gallery → AchievementGallery
│
└── /* → App.jsx
    ├── tasks → TaskList
    ├── stats → TaskStatsDashboard
    ├── catalog → TaskCatalogManager
    ├── generator → OralWorksheetGenerator
    ├── test-generator → TestWorkGenerator
    ├── work-manager → WorkManager
    ├── work-editor → WorkEditorPage
    ├── students → StudentProgressDashboard
    ├── import → TaskImporter
    ├── theory-browser → TheoryBrowser
    ├── theory-editor → TheoryEditor
    ├── theory-view → TheoryArticleView
    ├── theory-print → TheoryPrintBuilder
    └── theory-categories → TheoryCategoryManager
```

### Логика маршрутизации студента

```
URL: /student/{sessionId}

1. Загрузка сессии по sessionId
2. Проверка авторизации (localStorage)
3. Определение view:
   - Нет авторизации → auth (StudentAuthPage)
   - Нет попытки → entry (StudentEntryPage)
   - attempt.status='started' → test (StudentTestPage)
   - attempt.status='submitted'|'corrected' → result (StudentResultPage)
```

---

## State Management

### ReferenceDataContext

Глобальный контекст для справочных данных (topics, tags, subtopics, years, sources, theoryCategories).

```javascript
// contexts/ReferenceDataContext.jsx
const { topics, tags, years, sources, subtopics, theoryCategories, loading, reloadData } = useReferenceData();
```

Оборачивает весь учительский интерфейс в `App.jsx`:

```jsx
<ReferenceDataProvider>
  <App />
</ReferenceDataProvider>
```

### Локальное состояние

Компоненты используют React hooks для локального состояния. Redux/Zustand не используются — это осознанное решение для простоты.

---

## Переиспользуемые хуки

### `useWorksheetGeneration`

Универсальная логика генерации вариантов работ.

```javascript
const {
  variants,                // Сгенерированные варианты
  setVariants,             // Ручное изменение
  allTasks,                // Все задачи (flat)
  loading,
  setLoading,
  generateFromStructure,   // Генерация из структуры блоков
  generateFromFilters,     // Генерация из фильтров + распределение
  reset,
} = useWorksheetGeneration();
```

**Два режима генерации:**

1. `generateFromStructure(blocks, options)` — для TestWorkGenerator
   - Мульти-блочная структура (задачи из разных тем)
   - Три режима: `different` / `shuffled` / `same`
   - Прогрессивная сложность
   - Дедупликация

2. `generateFromFilters(filters, options)` — для OralWorksheetGenerator
   - Один набор фильтров
   - Распределение по тегам или сложности

---

### `useTaskDragDrop`

Drag & Drop задач между вариантами.

```javascript
const {
  draggedTask, dragOverTask,
  handleDragStart, handleDragOver, handleDragLeave,
  handleDrop, handleDragEnd,
  isDragging, isDragOver,
} = useTaskDragDrop(variants, setVariants);
```

---

### `useWorksheetActions`

Действия с работами: печать, PDF, сохранение/загрузка.

```javascript
const {
  saving, exporting,
  handlePrint, handleExportPDF,
  handleSaveWork, handleUpdateWork,
  handleLoadWorks, handleLoadWork, handleDeleteWork,
  pdfMethod, setPdfMethod, puppeteerAvailable,
} = useWorksheetActions();
```

PDF: приоритетно Puppeteer (порт 3001), fallback на html2pdf.js.

---

### `usePuppeteerPDF`

Высококачественный PDF экспорт через Puppeteer.

```javascript
const { exporting, serverAvailable, exportToPDF, checkServer } = usePuppeteerPDF();
```

Процесс: собирает все стили документа → формирует полный HTML с KaTeX CSS → отправляет на сервер → получает PDF.

---

### `useStudentSession`

Центральный хук для управления сессией ученика.

```javascript
const {
  session, attempt, setAttempt,
  variant, tasks,
  loading, error,
  startAttempt,
} = useStudentSession(sessionId, deviceId, student);
```

Особенности:
- Round-robin распределение вариантов
- Привязка гостевых попыток к аккаунту
- Polling каждые 10 секунд (для достижений от учителя)

---

### `useDistribution`

Управление распределением задач по тегам или сложности.

```javascript
const {
  items, setItems,
  addItem, removeItem, updateItem,
  getTotal, validate, reset,
} = useDistribution();
```

---

### `useTaskEditing`

Модальные окна замены/редактирования задач.

```javascript
const {
  replaceModalVisible, taskToReplace,
  handleReplaceTask, handleConfirmReplace, handleCancelReplace,
  editModalVisible, taskToEdit,
  handleEditTask, handleSaveEdit, handleDeleteEdit, handleCancelEdit,
} = useTaskEditing();
```

---

### `useTaskImport`

Импорт задач из Markdown/sdamgia.ru.

```javascript
const {
  handleParse, handleParseSdamgia,
  toggleTask, selectAll, deselectAll,
  handleImport,
  // + состояние парсинга, выбора, импорта
} = useTaskImport();
```

---

### `useMarkdownProcessor`

Обработка Markdown + LaTeX с debounce (150ms).

```javascript
const htmlContent = useMarkdownProcessor(markdownText);
```

Использует unified + remark + rehype + KaTeX. Поддерживает `:::` (разрыв колонки), `~` (отступ).

---

### `useAutosave`, `useKeyboardShortcuts`, `useDocumentStats`

Вспомогательные хуки для автосохранения, горячих клавиш и статистики документа.

---

## Переиспользуемые компоненты

### worksheet/

| Компонент | Назначение | Используется в |
|-----------|-----------|---------------|
| `FilterBlock` | Блок фильтров (тема, подтемы, сложность, теги, источник, год) | TestWorkGenerator, OralWorksheetGenerator |
| `VariantSettings` | Настройки генерации (количество, режим, сортировка) | TestWorkGenerator, OralWorksheetGenerator |
| `FormatSettings` | Настройки печати (колонки, шрифт, компактность) | TestWorkGenerator, OralWorksheetGenerator |
| `VariantRenderer` | Рендер варианта с задачами и нумерацией | Все генераторы |
| `VariantStats` | Статистика варианта (количество, средняя сложность) | Все генераторы |
| `AnswersPage` | Страница ответов для печати | Все генераторы |
| `DistributionPanel` | Распределение задач (по тегу/сложности) | OralWorksheetGenerator |
| `ActionButtons` | Кнопки: печать, PDF, сохранение, загрузка | Все генераторы |
| `SaveWorkModal` | Модальное окно сохранения работы | Все генераторы |
| `LoadWorkModal` | Модальное окно загрузки работы | Все генераторы |
| `SessionPanel` | Панель сессии (выдача, QR, ссылка, попытки) | WorkEditor |
| `TeacherResultsDashboard` | Результаты учеников (таблица, достижения) | WorkEditor |

### catalog/

| Компонент | Назначение |
|-----------|-----------|
| `TopicTab` | CRUD тем (с ege_number) |
| `SubtopicTab` | CRUD подтем (по теме) |
| `TagTab` | CRUD тегов (с цветом) |
| `SourceTab` | Просмотр/управление источниками |
| `OtherTab` | Прочие метаданные |
| `DuplicateTab` | Поиск/управление дубликатами |
| `MergeModal` | Объединение тем/тегов/источников |

---

## Генераторы

### TestWorkGenerator
Генератор контрольных работ с задачами из разных тем.

Использует: `useWorksheetGeneration`, `useTaskDragDrop`, `useWorksheetActions`, `FilterBlock`, `VariantSettings`, `FormatSettings`

Особенности:
- Мульти-блочная структура (каждый блок — своя тема)
- Три режима: different / shuffled / same
- Прогрессивная сложность
- Перемещение задач между вариантами

### OralWorksheetGenerator
Генератор «Устный счёт» с распределением по тегам/сложности.

Использует: `useWorksheetGeneration`, `useTaskDragDrop`, `useWorksheetActions`, `useDistribution`, `FilterBlock`, `VariantSettings`, `FormatSettings`, `DistributionPanel`, `VariantRenderer`, `AnswersPage`, `ActionButtons`, `SaveWorkModal`, `LoadWorkModal`

Особенности:
- Распределение задач по тегам или сложности
- Горизонтальная раскладка
- Grid layout (1-3 колонки)
- Компактный режим

### WorksheetGenerator
Генератор карточек (A5/A6/A4).

Использует: `useWorksheetActions`, `ActionButtons`

Особенности: другая модель данных (карточки, а не варианты), ограниченное переиспользование хуков.

### WorkEditor
Редактор сохранённых работ.

Особенности:
- Полное управление вариантами и задачами
- SessionPanel для выдачи тестов
- TeacherResultsDashboard для просмотра результатов
- Drag & Drop, замена, редактирование задач
- Перемещение задач между вариантами

---

## Студенческий интерфейс

### Архитектура компонентов

```
StudentApp.jsx
├── StudentAuthPage.jsx      # Вход / Регистрация
├── StudentEntryPage.jsx     # Стартовый экран
├── StudentTestPage.jsx      # Прохождение теста
├── StudentResultPage.jsx    # Результаты + достижения
├── AchievementGallery.jsx   # Галерея всех достижений
└── AchievementBadge.jsx     # Одиночный бейдж
```

### Жизненный цикл попытки

```
1. guest → создаётся device_id (localStorage)
2. Опционально: авторизация → привязка attempt к student
3. startAttempt() → выбор варианта (round-robin)
4. Ответы → автосохранение в localStorage
5. Отправка → checkAnswer() для каждой задачи
6. Подсчёт score, total
7. Если achievements_enabled:
   - getRandomAchievement() → случайный бейдж
   - checkUnlockedAchievements() → условные достижения
8. Сохранение в БД (attempt, attempt_answers)
9. status = 'submitted'
10. Показ результатов
11. Polling каждые 10с → учитель может добавить достижения
```

### Авторизация

- PocketBase Auth (коллекция `students`)
- username + password (мин. 4 символа)
- При входе: проверяются гостевые попытки по device_id → привязка к student
- Учительский интерфейс автоматически выходит из студенческого аккаунта при загрузке

---

## Система достижений

### Движок (achievementEngine.js)

**Случайные бейджи:**
```javascript
getRandomAchievement(achievements, percentage, excludedIds)
// 90%+ → legendary
// 70-89% → rare
// 40-69% → common
// <40% → null
// Предотвращает дубликаты через excludedIds
```

**Условные достижения:**
```javascript
checkUnlockedAchievements(achievements, attemptData, allAttempts, previouslyUnlocked)
// condition_type:
//   score → percentage >= condition_value.min_score
//   speed → duration <= condition_value.max_time
//   count → attempts.length >= condition_value.min_count
//   special → кастомная логика
```

### 30 предустановленных достижений

- **Common (10):** start, novice, student, explorer, thinker, solver, calculator, persistent, brave, diligent
- **Rare (8):** smart, erudite, mathematician, genius_algebra, formula_master, logic_lord, quick_mind, problem_crusher
- **Legendary (4):** legend, master, champion, absolute
- **Condition (8):** perfect (100%), first_win, marathoner (10), veteran (50), speedster (5мин), night_owl, early_bird, excellent (90%+)

---

## PDF экспорт

### Двухуровневая архитектура

```
Приложение
├── usePuppeteerPDF (приоритет)
│   ├── Собирает стили документа
│   ├── Формирует полный HTML + KaTeX CSS
│   └── POST → localhost:3001/generate
│       └── Puppeteer → PDF (headless Chrome)
│
└── html2pdf.js (fallback)
    └── Клиентская генерация через canvas
```

### PDF-сервис (pdf-service.js)

- Express.js на порту 3001
- Chromium с переиспользованием browser instance
- Viewport: 1200x1600, device scale 2x
- Ожидание загрузки шрифтов и рендеринга KaTeX
- Поддержка кириллических имён файлов
- Лимит: 50MB на запрос

---

## Проверка ответов

### answerChecker.js

```javascript
normalizeAnswer(raw)
// Обработка:
// - Десятичные: "3,14" → 3.14
// - Дроби: "1/3" → 0.333...
// - LaTeX: "\frac{1}{3}" → 0.333...
// - Смешанные: "2 1/3" → 2.333...
// - Альтернативы: "3|3.0" → [3, 3.0]

checkAnswer(studentRaw, correctRaw, epsilon = 1e-6)
// Числовое сравнение с epsilon
// Поддержка альтернатив через "|"
// Fallback: текстовое сравнение
```

---

## Backend архитектура

### PocketBase

- Все коллекции определены через миграции (`pb_migrations/`)
- 48 миграций: создание коллекций, обновление схем, seed данных, правила доступа
- Хуки в `pb_hooks/`: PDF-генерация через PocketBase API
- Auth-коллекция `students`: password-based авторизация

### Правила доступа (RLS)

| Коллекция | Чтение | Запись |
|-----------|--------|--------|
| tasks, topics, tags, subtopics | Superuser | Superuser |
| achievements | Public | Superuser |
| students | Свой профиль / unauth все | Свой / unauth |
| attempts | Свои / unauth все | Public |
| work_sessions, attempt_answers | Public | Public |

### PDF-сервис

Standalone Express.js (port 3001):
- `POST /generate` — PDF из HTML
- `POST /parse-sdamgia` — парсинг задач с sdamgia.ru
- `GET /health` — проверка состояния

---

## Примеры использования

### Создание нового генератора

```javascript
import { useState } from 'react';
import { useWorksheetGeneration, useTaskDragDrop, useWorksheetActions } from '../hooks';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import FilterBlock from './worksheet/FilterBlock';
import VariantSettings from './worksheet/VariantSettings';

const MyGenerator = () => {
  const { topics, tags, subtopics } = useReferenceData();
  const [blocks, setBlocks] = useState([]);
  const [variantsCount, setVariantsCount] = useState(2);

  const { variants, setVariants, loading, generateFromStructure } = useWorksheetGeneration();
  const dragDrop = useTaskDragDrop(variants, setVariants);
  const { handlePrint, handleExportPDF } = useWorksheetActions();

  const handleGenerate = async () => {
    await generateFromStructure(blocks, {
      variantsMode: 'different',
      variantsCount,
    });
  };

  return (
    <div>
      {blocks.map((block, idx) => (
        <FilterBlock
          key={block.id}
          block={block}
          index={idx}
          topics={topics}
          subtopics={subtopics}
          tags={tags}
          onChange={(i, field, value) => {
            const newBlocks = [...blocks];
            newBlocks[i][field] = value;
            setBlocks(newBlocks);
          }}
          onRemove={(i) => setBlocks(blocks.filter((_, j) => j !== i))}
        />
      ))}
      <Button onClick={handleGenerate} loading={loading}>Сгенерировать</Button>
    </div>
  );
};
```

### Использование проверки ответов

```javascript
import { checkAnswer, normalizeAnswer } from '../utils/answerChecker';

// Простое числовое сравнение
checkAnswer('42', '42'); // true

// Дроби
checkAnswer('1/3', '0.333333'); // true

// LaTeX
checkAnswer('\\frac{1}{3}', '1/3'); // true

// Альтернативные ответы
checkAnswer('3', '3|3.0|3.00'); // true
```

### Использование системы достижений

```javascript
import { getRandomAchievement, checkUnlockedAchievements } from '../utils/achievementEngine';

// Случайный бейдж (85% — rare tier)
const badge = getRandomAchievement(allAchievements, 85, previousBadgeIds);

// Условные достижения
const unlocked = checkUnlockedAchievements(
  allAchievements,
  { score: 9, total: 10, duration: 180 },
  previousAttempts,
  previouslyUnlockedIds
);
```

---

## Контрибьюторам

При добавлении новой функциональности:

1. Используйте существующие хуки, где возможно
2. Выделяйте общую логику в новые хуки
3. Создавайте переиспользуемые UI компоненты в `worksheet/`
4. Получайте справочные данные через `useReferenceData()`
5. Документируйте API хуков с JSDoc
6. Обновляйте этот файл при изменении архитектуры
7. Не забывайте про безопасность: студенческий и учительский интерфейсы изолированы
