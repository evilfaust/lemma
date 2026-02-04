# CLAUDE.MD - AI Assistant Context

Отвечай мне только на русском языке

## Project Overview

This is **EGE Tasks Manager**, a full-stack web application for managing educational tasks for EGE (Russian standardized exam) preparation. The system stores, filters, edits tasks, and generates printable worksheets with LaTeX math support.

## Tech Stack

### Frontend
- **React 18.2** with Vite 5.0
- **Ant Design 5.29** for UI components
- **KaTeX** for LaTeX math rendering
- **PocketBase SDK** for API communication

### Backend
- **PocketBase** (Backend-as-a-Service)
- SQLite database
- Built-in RESTful API
- File storage for images
- **PDF Service** (Node.js + Express + Puppeteer)
  - High-quality PDF generation
  - Standalone microservice on port 3001
  - Perfect KaTeX rendering

### Utilities
- **Python 3.x** for parsers and scripts
- Node.js scripts for migrations and utilities
- **Puppeteer** for PDF generation

## Project Structure

```
generation-test/
├── ege-tasks/              # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── worksheet/  # Reusable worksheet components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services (pocketbase.js)
│   │   ├── utils/          # Utility functions
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── package.json
│   └── vite.config.js
├── pocketbase/             # Backend
│   ├── pocketbase          # Executable
│   ├── pb_data/           # Database and storage
│   ├── pb_migrations/     # Database migrations
│   ├── pb_hooks/          # PocketBase JS hooks
│   ├── pdf-service.js     # PDF generation service (Node.js)
│   ├── package.json       # Node.js dependencies
│   ├── start-all.sh       # Startup script
│   └── code.js            # Legacy hooks
├── source/                # Source markdown files for tasks
├── pb_parser.py          # Main parser for markdown tasks
└── pb_parser_mordkovich.py  # Specialized parser
```

## Key Components

### Frontend Components (ege-tasks/src/components/)

**Main Components:**
- `TaskList.jsx` - Main task list with filtering
- `TaskCard.jsx` - Individual task card display
- `TaskEditModal.jsx` - Task editing modal
- `WorksheetGenerator.jsx` - Worksheet/card generator (A5/A6 cards) with font sizes 10-21px
- `PrintableWorksheet.jsx` - Print-optimized worksheet view
- `OralWorksheetGenerator.jsx` - "Устный счет" (Oral exam) worksheet generator with:
  - Tag-based task distribution
  - Compact mode for maximum tasks per page
  - Drag & drop task reordering within and between variants
  - Font sizes: 10pt, 12pt, 14pt, 16pt, 20pt
  - Grid layout (1-3 columns) for multiple variants per page
  - PDF export with html2pdf.js
  - Filter to hide common task prefixes ("Вычислите:", "Найдите значение выражения" etc.)
- `TestWorkGenerator.jsx` - **NEW** - Генератор контрольных работ:
  - Конструктор структуры работы с блоками задач из разных тем
  - Гибкие фильтры для каждого блока (тема, подтемы, сложность, теги)
  - 3 режима генерации: разные задачи / перемешанные / одинаковые
  - Drag & drop задач между вариантами
  - Сохранение/загрузка работ в БД
  - Экспорт в PDF
  - Все возможности форматирования (компактный режим, шрифты, колонки)
- `MathRenderer.jsx` - LaTeX (KaTeX) and Markdown (react-markdown + remark-gfm) rendering (supports tables, lists, formulas)

**Reusable Worksheet Components (ege-tasks/src/components/worksheet/):**
- `FilterBlock.jsx` - Переиспользуемый блок фильтров для подбора задач
- `VariantSettings.jsx` - Настройки генерации вариантов
- `FormatSettings.jsx` - Настройки форматирования для печати

### Custom Hooks (ege-tasks/src/hooks/)
- `useWorksheetGeneration.js` - Универсальная логика генерации вариантов с задачами
- `useTaskDragDrop.js` - Drag & drop задач между вариантами
- `useWorksheetActions.js` - Действия с работами (печать, PDF, сохранение, загрузка)
- `usePuppeteerPDF.js` - **NEW** - Высококачественный PDF экспорт через Puppeteer
- `useMarkdownProcessor.js` - Обработка markdown
- `useKeyboardShortcuts.js` - Keyboard shortcuts
- `useDocumentStats.js` - Статистика документов
- `useAutosave.js` - Автосохранение

### Database Collections (PocketBase)

**topics** - Exam topics
```javascript
{
  id: string,
  title: string,        // Topic name
  ege_number: number,   // EGE task number (1-27)
  description: string,
  order: number
}
```

**subtopics** - Subtopics for finer categorization
```javascript
{
  id: string,
  title: string,
  topic: relation,      // Link to topics
  order: number
}
```

**tags** - Task tags
```javascript
{
  id: string,
  title: string,
  color: string         // Hex color
}
```

**tasks** - Main task collection
```javascript
{
  id: string,
  code: string,         // Unique code (e.g., "14-001")
  topic: relation,      // Link to topics
  subtopic: relation[], // Links to subtopics (Multiple)
  tags: relation[],     // Links to tags
  difficulty: string,   // "1", "2", "3"
  statement_md: text,   // Task statement (Markdown + LaTeX)
  answer: string,
  solution_md: text,    // Solution (Markdown + LaTeX)
  explanation_md: text,
  source: string,
  year: number,
  image: file,          // Optional image
  has_image: boolean
}
```

**cards** - Saved worksheets
```javascript
{
  id: string,
  title: string,
  topic: relation,
  tasks: relation[],    // Array of task IDs
  format: string,       // "a6", "a5", "a4"
  show_answers: bool,
  cards_data: json      // Card layout data
}
```

**variants** - Test variants
```javascript
{
  id: string,
  title: string,
  tasks: relation[],    // Array of task IDs
  created: datetime
}
```

**works** - Student works/submissions
```javascript
{
  id: string,
  variant: relation,
  student_name: string,
  answers: json,        // Student answers
  score: number,
  created: datetime
}
```

## Important Conventions

### LaTeX Formatting
- Inline math: `$x^2 + y^2$`
- Block math: `$$\frac{a}{b}$$`
- Common patterns:
  - Powers: `x^2`, `a^{10}`
  - Fractions: `\frac{a}{b}`
  - Roots: `\sqrt{x}`, `\sqrt[3]{x}`
  - Greek letters: `\alpha`, `\beta`, `\gamma`

### Difficulty Levels
- `"1"` - Basic (green, #52c41a)
- `"2"` - Medium (orange, #faad14)
- `"3"` - Advanced (red, #ff4d4f)

### Task Codes
Format: `{topic_number}-{sequence}` (e.g., "14-001", "16-023")
Generated automatically by `generate_task_code.py`

### Worksheet Formats
- `a6` - 4 cards per A4 sheet
- `a5` - 2 cards per A4 sheet
- `a4` - 1 card per A4 sheet

## Common Tasks

### Running the Application
```bash
# Start Backend (PocketBase + PDF Service)
cd pocketbase
npm install         # First time only
npm run dev         # Runs both services
# PocketBase: http://127.0.0.1:8090
# PDF Service: http://localhost:3001

# Or manually:
# Terminal 1: ./pocketbase serve
# Terminal 2: node pdf-service.js

# Start React frontend
cd ege-tasks
npm install
npm run dev  # Runs on http://localhost:5173
```

### Parsing Tasks from Markdown
```bash
# Standard parser
python pb_parser.py

# Mordkovich textbook parser
python pb_parser_mordkovich.py
```

### Working with Database
- Admin panel: http://127.0.0.1:8090/_/
- API base: http://127.0.0.1:8090/api/
- Collections endpoint: `/api/collections/{collection}/records`

### Node.js Utility Scripts (in ege-tasks/)
- `check-images-11.js` - Check images for topic 11
- `check-tasks-16.js` - Check tasks for topic 16
- `check-tasks.js` - General task verification
- `delete-tasks-by-topic.js` - Bulk delete by topic
- `fix-latex-braces.js` - Fix LaTeX brace formatting
- `link-tasks-to-subtopics.js` - Link tasks to subtopics
- `migrate-images.js` - Migrate image files
- `update-empty-subtopics.js` - Update tasks with empty subtopics

## API Service (ege-tasks/src/services/pocketbase.js)

Key functions:
- `getTopics()` - Fetch all topics
- `getSubtopics(topicId)` - Fetch subtopics for a topic
- `getTasks(filters)` - Fetch tasks with filters
- `getRandomTasks(count, filters)` - Get random tasks
- `createCard(data)` - Create worksheet card
- `updateTask(id, data)` - Update task
- `deleteTask(id)` - Delete task

## Recent Changes (from git log)

Latest commits:
1. **Feat: Добавлен генератор контрольных работ (TestWorkGenerator)**
   - Создан новый компонент для составления контрольных работ с задачами из разных тем
   - Выделены переиспользуемые хуки: useWorksheetGeneration, useTaskDragDrop, useWorksheetActions
   - Созданы переиспользуемые UI компоненты: FilterBlock, VariantSettings, FormatSettings
   - Добавлена возможность создавать блоки задач с индивидуальными фильтрами для каждой темы
   - Интегрирован в главное меню приложения
2. Fix: Added Button import to PrintableWorksheet
3. Feat: Improved printable worksheet form
4. Fix: Excluded duplicate tasks within variants when replacing
5. Feat: Added filters to task replacement modal
6. Fix: Fixed subtopic filtering for Multiple relation

## Known Issues & Patterns

### Image Handling
- Images stored in PocketBase file storage
- URLs: `{PB_URL}/api/files/{collection}/{record}/{filename}`
- Need to check image existence before display

### LaTeX Rendering
- Must import `katex/dist/katex.min.css`
- Wrapped in try-catch to handle malformed LaTeX
- Use `MathRenderer` component for consistent rendering

### Task Replacement in Variants
- Should exclude duplicates within same variant
- Filter by topic/subtopic for relevant replacements
- Maintain difficulty level when replacing

## File Locations Reference

### Key Files to Modify
- Frontend components: `ege-tasks/src/components/*.jsx`
- Reusable components: `ege-tasks/src/components/worksheet/*.jsx`
- Custom hooks: `ege-tasks/src/hooks/*.js`
- API service: `ege-tasks/src/services/pocketbase.js`
- Main app: `ege-tasks/src/App.jsx`
- Styles: `ege-tasks/src/App.css`
- Backend hooks: `pocketbase/code.js`
- Migrations: `pocketbase/pb_migrations/*.js`

### Configuration Files
- Frontend env: `ege-tasks/.env` (VITE_PB_URL)
- Vite config: `ege-tasks/vite.config.js`
- Package deps: `ege-tasks/package.json`

## Python Scripts

### pb_parser.py
Main parser for loading tasks from markdown files
- Reads YAML frontmatter for metadata
- Parses task statements and answers
- Handles images
- Checks for duplicates
- Authenticates with PocketBase admin

### fix-markdown-latex.py
Fixes LaTeX formatting issues in markdown files

## Development Notes

### When Adding New Features
1. Frontend changes go in `ege-tasks/src/`
2. Database schema changes need migrations in `pocketbase/pb_migrations/`
3. API changes should update `ege-tasks/src/services/pocketbase.js`
4. Always test LaTeX rendering after text changes
5. Check print preview for worksheet modifications

### Testing Checklist
- Task filtering works correctly
- LaTeX renders properly
- Images load correctly
- Print layout maintains formatting
- Random task selection avoids duplicates
- Task editing saves all fields

### Code Style
- React components use JSX
- Ant Design components for UI
- Async/await for API calls
- Error handling with try-catch
- Loading states for async operations

## Environment Setup

Required environment variables (ege-tasks/.env):
```env
VITE_PB_URL=http://127.0.0.1:8090
```

## Quick Reference Commands

```bash
# Frontend
cd ege-tasks
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build

# Backend
cd pocketbase
./pocketbase serve   # Start server
./pocketbase migrate # Run migrations

# Utilities
python pb_parser.py                # Parse markdown tasks
python pb_parser_mordkovich.py     # Parse Mordkovich tasks
node ege-tasks/check-tasks.js      # Verify tasks
node ege-tasks/link-tasks-to-subtopics.js  # Link subtopics
```

## PDF Export System

### High-Quality PDF Generation (NEW)
- **Method:** Puppeteer (headless Chrome)
- **Service:** Standalone Node.js on port 3001
- **Quality:** Perfect KaTeX rendering, vector text
- **Performance:** 2-3x smaller files, 1.5-2x faster
- **Fallback:** Automatic switch to html2pdf.js if service unavailable

### PDF Service API
```javascript
// Health check
GET http://localhost:3001/health

// Generate PDF
POST http://localhost:3001/generate
Body: { html, filename, options: { format, margins } }
```

### Using in Components
```javascript
import { usePuppeteerPDF } from '../hooks';

const puppeteerPDF = usePuppeteerPDF();
await puppeteerPDF.exportToPDF(printRef, 'filename', options);
```

## Tips for AI Assistance

1. **Always check file existence** before reading/editing
2. **React components** are in `ege-tasks/src/components/`
3. **Database schema** is defined in PocketBase migrations
4. **LaTeX math** uses KaTeX library, not MathJax
5. **Print layouts** are in `PrintableWorksheet.jsx`
6. **API calls** go through `pocketbase.js` service
7. **Task codes** follow pattern `{topic}-{number}`
8. **Difficulty colors** are hardcoded in components
9. **Images** need proper PocketBase URL construction
10. **Markdown files** in `source/` are named by topic number
11. **PDF Service** must be running for high-quality PDF export
12. **Puppeteer PDF** - use `usePuppeteerPDF` hook for PDF generation

## Related Documentation

- `README.MD` - Полное руководство пользователя
- `ARCHITECTURE.md` - Архитектура проекта
- `CHANGELOG.md` - История изменений
- `PDF_EXPORT_UPGRADE.md` - Подробно о PDF экспорте через Puppeteer
- `QUICK_START.md` - Быстрый старт для разработчиков
- `TEST_AND_COMMIT.md` - Инструкции по тестированию и коммитам
