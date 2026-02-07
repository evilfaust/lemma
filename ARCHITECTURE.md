# Архитектура приложения EGE Tasks Manager

## 📋 Оглавление
- [Общая архитектура](#общая-архитектура)
- [Переиспользуемые хуки](#переиспользуемые-хуки)
- [Переиспользуемые компоненты](#переиспользуемые-компоненты)
- [Генераторы](#генераторы)
- [Примеры использования](#примеры-использования)

---

## Общая архитектура

### Принципы

1. **Разделение ответственности** (Separation of Concerns)
   - Логика генерации → хуки
   - UI компоненты → компоненты
   - API вызовы → services

2. **Переиспользование кода** (DRY - Don't Repeat Yourself)
   - Общая логика вынесена в хуки
   - UI компоненты переиспользуются между генераторами

3. **Композиция над наследованием** (Composition over Inheritance)
   - Генераторы собираются из маленьких компонентов
   - Хуки комбинируются для нужной функциональности

4. **Единообразие API**
   - Все хуки имеют похожий интерфейс
   - Компоненты используют единый стиль props

---

## Переиспользуемые хуки

### `useWorksheetGeneration`

**Назначение:** Универсальная логика генерации вариантов работ

**Расположение:** `src/hooks/useWorksheetGeneration.js`

**API:**
```javascript
const {
  variants,        // Массив сгенерированных вариантов
  setVariants,     // Сеттер для ручного изменения
  allTasks,        // Все задачи (flat array)
  loading,         // Флаг загрузки
  generateFromStructure, // Функция генерации
  reset,           // Сброс состояния
} = useWorksheetGeneration();
```

**Функция генерации:**
```javascript
await generateFromStructure(
  structure,  // Массив блоков с фильтрами
  {
    variantsMode: 'different',  // 'different' | 'shuffled' | 'same'
    variantsCount: 2,           // Количество вариантов
    sortType: 'random',         // 'random' | 'code' | 'difficulty'
    progressiveDifficulty: false, // Автоматическая прогрессия сложности
  }
);
```

**Структура блока:**
```javascript
{
  id: 'uuid',
  topic: 'topic_id',           // Обязательный
  subtopics: ['subtopic_id'],  // Опционально
  difficulty: ['1', '2'],      // Опционально
  tags: ['tag_id'],            // Опционально
  source: 'Решу ЕГЭ',         // Опционально
  year: 2024,                  // Опционально
  count: 3,                    // Количество задач
}
```

**Примеры использования:**

1. Генерация одной темы:
```javascript
const structure = [
  { topic: 'topic_id', count: 10 }
];
await generateFromStructure(structure, { variantsCount: 4 });
```

2. Генерация разных тем:
```javascript
const structure = [
  { topic: 'topic_1', subtopics: ['sub1'], count: 5, difficulty: ['1', '2'] },
  { topic: 'topic_2', count: 3, difficulty: ['3'] },
];
await generateFromStructure(structure, {
  variantsMode: 'different',
  variantsCount: 2
});
```

---

### `useTaskDragDrop`

**Назначение:** Drag & Drop задач между вариантами

**Расположение:** `src/hooks/useTaskDragDrop.js`

**API:**
```javascript
const {
  draggedTask,          // Текущая перетаскиваемая задача
  dragOverTask,         // Задача, над которой курсор
  handleDragStart,      // Начало перетаскивания
  handleDragOver,       // Перемещение над задачей
  handleDragLeave,      // Выход из зоны задачи
  handleDrop,           // Отпускание задачи
  handleDragEnd,        // Завершение перетаскивания
  isDragging,           // Функция проверки (variantIdx, taskIdx)
  isDragOver,           // Функция проверки (variantIdx, taskIdx)
} = useTaskDragDrop(variants, setVariants);
```

**Пример использования:**
```jsx
<div
  draggable
  onDragStart={(e) => handleDragStart(e, variantIndex, taskIndex)}
  onDragOver={(e) => handleDragOver(e, variantIndex, taskIndex)}
  onDragLeave={handleDragLeave}
  onDrop={(e) => handleDrop(e, variantIndex, taskIndex)}
  onDragEnd={handleDragEnd}
  className={`
    ${isDragging(variantIndex, taskIndex) ? 'dragging' : ''}
    ${isDragOver(variantIndex, taskIndex) ? 'drag-over' : ''}
  `}
>
  {/* Контент задачи */}
</div>
```

---

### `useWorksheetActions`

**Назначение:** Действия с работами (печать, PDF, сохранение)

**Расположение:** `src/hooks/useWorksheetActions.js`

**API:**
```javascript
const {
  saving,               // Флаг сохранения
  exporting,            // Флаг экспорта PDF
  handlePrint,          // Функция печати
  handleExportPDF,      // Экспорт в PDF
  handleSaveWork,       // Сохранение в БД
  handleUpdateWork,     // Обновление сохранённой работы
  handleLoadWorks,      // Загрузка списка работ
  handleLoadWork,       // Загрузка конкретной работы
  handleDeleteWork,     // Удаление работы
} = useWorksheetActions();
```

**Примеры использования:**

1. Печать:
```javascript
<Button onClick={handlePrint} icon={<PrinterOutlined />}>
  Печать
</Button>
```

2. Экспорт в PDF:
```javascript
const printRef = useRef();

<Button
  onClick={() => handleExportPDF(printRef, 'Контрольная работа')}
  loading={exporting}
>
  Сохранить PDF
</Button>

<div ref={printRef}>
  {/* Контент для PDF */}
</div>
```

3. Сохранение работы:
```javascript
await handleSaveWork(
  {
    title: 'Контрольная работа №1',
    topic: 'topic_id',        // Опционально
    timeLimit: 45,            // Минуты, опционально
  },
  variants  // Массив вариантов
);
```

4. Загрузка работы:
```javascript
const { work, variants } = await handleLoadWork('work_id');
setVariants(variants);
```

---

## Переиспользуемые компоненты

### `FilterBlock`

**Назначение:** Блок фильтров для подбора задач

**Расположение:** `src/components/worksheet/FilterBlock.jsx`

**Props:**
```javascript
<FilterBlock
  block={block}              // Объект блока с фильтрами
  index={0}                  // Индекс блока
  topics={topics}            // Массив тем
  subtopics={subtopics}      // Массив подтем
  tags={tags}                // Массив тегов
  sources={sources}          // Массив источников
  years={years}              // Массив годов
  onChange={(idx, field, value) => {}}  // Обработчик изменений
  onRemove={(idx) => {}}     // Удаление блока
  showRemoveButton={true}    // Показать кнопку удаления
  draggable={false}          // Drag & Drop (будущая функция)
/>
```

---

### `VariantSettings`

**Назначение:** Настройки генерации вариантов

**Расположение:** `src/components/worksheet/VariantSettings.jsx`

**Props:**
```javascript
<VariantSettings
  variantsCount={1}
  setVariantsCount={setVariantsCount}
  variantsMode="different"
  setVariantsMode={setVariantsMode}
  sortType="random"
  setSortType={setSortType}
  showTasksCount={true}
  tasksPerVariant={20}
/>
```

---

### `FormatSettings`

**Назначение:** Настройки форматирования печати

**Расположение:** `src/components/worksheet/FormatSettings.jsx`

**Props:**
```javascript
<FormatSettings
  columns={1}
  setColumns={setColumns}
  fontSize={12}
  setFontSize={setFontSize}
  solutionSpace="medium"
  setSolutionSpace={setSolutionSpace}
  compactMode={false}
  setCompactMode={setCompactMode}
  hideTaskPrefixes={false}
  setHideTaskPrefixes={setHideTaskPrefixes}
  showStudentInfo={true}
  setShowStudentInfo={setShowStudentInfo}
  showAnswersInline={false}
  setShowAnswersInline={setShowAnswersInline}
  showAnswersPage={true}
  setShowAnswersPage={setShowAnswersPage}
  variantLabel="Вариант"
  setVariantLabel={setVariantLabel}
/>
```

---

### `TaskStatsDashboard`

**Назначение:** Дашборд аналитики по задачам

**Расположение:** `src/components/TaskStatsDashboard.jsx`

**Функции:**
- Подсчёт задач по темам, подтемам, тегам, сложности и источникам
- Облако тегов с переходом к задачам по клику
- Выявление «белых пятен» по темам и подтемам

---

### `TaskCatalogManager`

**Назначение:** Единый каталог справочников и проверка дублей

**Расположение:** `src/components/TaskCatalogManager.jsx`

**Функции:**
- CRUD для тем, подтем, тегов, источников
- Объединение дублей с переносом задач
- Быстрый переход к задачам по выбранному фильтру
- Вкладка «Дубли» (по нормализованным названиям + дубли задач)

## Генераторы

### `TestWorkGenerator` (Новый)

**Назначение:** Генератор контрольных работ с задачами из разных тем

**Использует:**
- ✅ `useWorksheetGeneration` - генерация вариантов
- ✅ `useTaskDragDrop` - drag & drop
- ✅ `useWorksheetActions` - сохранение/печать
- ✅ `FilterBlock` - блоки фильтров
- ✅ `VariantSettings` - настройки вариантов
- ✅ `FormatSettings` - настройки формата

**Структура данных:**
```javascript
const [workBlocks, setWorkBlocks] = useState([
  {
    id: uuid(),
    topic: 'topic_id',
    subtopics: ['subtopic_id'],
    difficulty: ['1', '2'],
    tags: ['tag_id'],
    source: 'Решу ЕГЭ',
    year: 2024,
    count: 5,
  }
]);
```

---

### `OralWorksheetGenerator` (Рефакторинг выполнен)

**Назначение:** Генератор "Устный счёт" с распределением по тегам/сложности

**Использует:**
- ✅ `useWorksheetGeneration` - генерация вариантов
- ✅ `useTaskDragDrop` - drag & drop
- ✅ `useWorksheetActions` - сохранение/печать/PDF
- ✅ `useDistribution` - распределение задач по тегам/сложности
- ✅ `FilterBlock`, `VariantSettings`, `FormatSettings`
- ✅ `VariantRenderer`, `AnswersPage`, `DistributionPanel`, `ActionButtons`
- ✅ `SaveWorkModal`, `LoadWorkModal`

---

### `WorksheetGenerator` (Частично рефакторинг)

**Назначение:** Генератор карточек (A5/A6/A4)

**Использует:**
- ✅ `useWorksheetActions` - сохранение/печать
- ✅ `ActionButtons` - кнопки действий

**Особенности архитектуры:**
- Отличается от остальных генераторов — работает с **карточками**, а не с вариантами
- Ограниченное переиспользование хуков из-за другой модели данных

---

## Примеры использования

### Создание нового генератора

```javascript
import { useState } from 'react';
import {
  useWorksheetGeneration,
  useTaskDragDrop,
  useWorksheetActions
} from '../hooks';
import FilterBlock from './worksheet/FilterBlock';
import VariantSettings from './worksheet/VariantSettings';

const MyCustomGenerator = ({ topics, tags, subtopics }) => {
  const [blocks, setBlocks] = useState([]);
  const [variantsCount, setVariantsCount] = useState(2);

  const {
    variants,
    setVariants,
    loading,
    generateFromStructure
  } = useWorksheetGeneration();

  const dragDropHandlers = useTaskDragDrop(variants, setVariants);

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

      <Button onClick={handleGenerate}>Сгенерировать</Button>

      {variants.map((variant, vIdx) => (
        <div key={variant.number}>
          {variant.tasks.map((task, tIdx) => (
            <div
              key={task.id}
              draggable
              onDragStart={e => dragDropHandlers.handleDragStart(e, vIdx, tIdx)}
              onDrop={e => dragDropHandlers.handleDrop(e, vIdx, tIdx)}
            >
              {task.statement_md}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
```

---

### Новые компоненты (v2.1)

#### `TaskStatsDashboard`

**Назначение:** Аналитический дашборд по задачам

**Функции:**
- Статистика по темам, подтемам, тегам, сложности, источникам
- Облако тегов с переходом к отфильтрованным задачам
- Выявление «белых пятен» (темы/подтемы с малым количеством задач)

---

#### `TaskCatalogManager`

**Назначение:** Единый каталог справочников

**Функции:**
- CRUD для тем, подтем, тегов, источников
- Обнаружение и объединение дублей (по нормализованным названиям)
- Быстрый переход к задачам по выбранному элементу
- Вкладка «Дубли» — дубли справочников и задач

---

#### `TaskImporter`

**Назначение:** Импорт задач из markdown/YAML файлов

**Использует:**
- `useTaskImport` — логика парсинга и импорта
- `markdownTaskParser` — парсер markdown с YAML frontmatter

---

#### `useDistribution`

**Назначение:** Управление распределением задач по ключевому полю (тег или сложность)

**Используется в:** `OralWorksheetGenerator` (через `DistributionPanel`)

---

#### `useTaskEditing`

**Назначение:** Логика редактирования задач с валидацией

**Используется в:** `TaskEditModal`, `TaskList`

---

## Roadmap

### Ближайшие улучшения

1. **Расширение FilterBlock**
   - Drag & Drop для изменения порядка блоков
   - Клонирование блоков
   - Сворачивание/разворачивание блоков

2. **Шаблоны контрольных работ**
   - Сохранение структуры блоков отдельно
   - Библиотека готовых шаблонов
   - Импорт/экспорт шаблонов

3. **Улучшение useWorksheetGeneration**
   - Поддержка weighted random (взвешенная случайность)
   - Кеширование запросов к API
   - Оптимизация для больших объёмов данных

4. **Унификация WorksheetGenerator**
   - Возможное объединение с OralWorksheetGenerator (разные режимы в одном компоненте)

---

## Вопросы и ответы

**Q: Зачем выделять логику в хуки?**
A: Чтобы переиспользовать код между компонентами, упростить тестирование и улучшить читаемость.

**Q: Можно ли использовать хуки в старых генераторах?**
A: Да, можно постепенно мигрировать, заменяя части кода на хуки.

**Q: Как добавить новый фильтр в FilterBlock?**
A: Добавьте новое поле в структуру блока и новый UI элемент в FilterBlock.jsx

**Q: Как создать свой генератор?**
A: Используйте существующие хуки и компоненты, см. раздел "Примеры использования".

---

## Контрибьюторам

При добавлении новой функциональности:

1. ✅ Используйте существующие хуки, где возможно
2. ✅ Выделяйте общую логику в новые хуки
3. ✅ Создавайте переиспользуемые UI компоненты
4. ✅ Документируйте API хуков с JSDoc
5. ✅ Обновляйте этот файл при изменении архитектуры
