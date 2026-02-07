# CLAUDE.MD - AI Assistant Context

Отвечай мне только на русском языке

## Project Overview

This is **EGE Tasks Manager**, a full-stack web application for managing educational tasks for EGE (Russian standardized exam) preparation. The system stores, filters, edits tasks, generates printable worksheets with LaTeX math support, and includes a theory module.

## Tech Stack

### Frontend
- **React 18.2** with Vite 5.0
- **Ant Design 5.12** for UI components
- **KaTeX** for LaTeX math rendering
- **Monaco Editor** for theory article editing
- **PocketBase SDK 0.21** for API communication

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
│   │   ├── components/     # React components (18 main)
│   │   │   └── worksheet/  # Reusable worksheet components (10)
│   │   ├── hooks/          # Custom React hooks (11)
│   │   ├── services/       # API services (pocketbase.js)
│   │   ├── utils/          # Utility functions (4)
│   │   ├── App.jsx         # Main app component with routing
│   │   └── main.jsx        # Entry point
│   ├── *.js                # Node.js utility scripts
│   ├── package.json
│   └── vite.config.js
├── pocketbase/             # Backend
│   ├── pocketbase          # Executable
│   ├── pb_data/            # Database and storage
│   ├── pb_migrations/      # Database migrations (33 files)
│   ├── pb_hooks/           # PocketBase JS hooks
│   ├── pdf-service.js      # PDF generation service (Node.js)
│   ├── package.json        # Node.js dependencies
│   └── start-all.sh        # Startup script
├── source/                 # Source markdown files for tasks
├── backups/                # Database backups
├── start.sh                # Start all services
├── stop.sh                 # Stop all services
├── backup.sh               # Backup database
├── package.json            # Root package.json (concurrently)
├── pb_parser.py            # Main parser for markdown tasks
├── pb_parser_mordkovich.py # Specialized parser for Mordkovich
└── pb_parser_theory.py     # Parser for theory articles
```

## Key Components

### Frontend Components (ege-tasks/src/components/)

**Task Management:**
- `TaskList.jsx` - Main task list with filtering, sorting, bulk operations, external filter support
- `TaskCard.jsx` - Individual task card display
- `TaskFilters.jsx` - Filter panel (topic, subtopic, tag, difficulty, year, source, image)
- `TaskEditModal.jsx` - Task editing modal with metadata
- `TaskReplaceModal.jsx` - Modal for replacing tasks in variants (with duplicate exclusion)
- `TaskImporter.jsx` - Import tasks from markdown/YAML files
- `TaskStatsDashboard.jsx` - Analytics dashboard (by topics, subtopics, tags, difficulty, sources; tag cloud)
- `TaskCatalogManager.jsx` - Catalog manager with CRUD for topics/subtopics/tags/sources, duplicate detection, merge

**Worksheet Generators:**
- `WorksheetGenerator.jsx` - Card generator (A5/A6/A4 formats) with font sizes 10-21px
- `OralWorksheetGenerator.jsx` - "Устный счет" (Oral exam) worksheet generator with:
  - Tag/difficulty-based task distribution
  - Compact mode for maximum tasks per page
  - Drag & drop task reordering within and between variants
  - Font sizes: 10pt, 12pt, 14pt, 16pt, 20pt
  - Grid layout (1-3 columns) for multiple variants per page
  - PDF export (Puppeteer + html2pdf.js fallback)
  - Filter to hide common task prefixes
- `TestWorkGenerator.jsx` - Test/exam work generator:
  - Multi-topic work structure with task blocks
  - Independent filters per block (topic, subtopics, difficulty, tags)
  - 3 generation modes: different / shuffled / same
  - Progressive difficulty option
  - Drag & drop tasks between variants
  - Save/load works to DB
  - PDF export with all formatting options
- `PrintableWorksheet.jsx` - Print-optimized worksheet view

**Rendering:**
- `MathRenderer.jsx` - LaTeX (KaTeX) and Markdown (react-markdown + remark-gfm) rendering (tables, lists, formulas)

**Theory Module:**
- `TheoryBrowser.jsx` - Browse theory articles by categories
- `TheoryEditor.jsx` - Edit theory articles (Monaco editor)
- `TheoryArticleView.jsx` - View single theory article
- `TheoryCategoryManager.jsx` - Manage theory categories
- `TheoryPrintBuilder.jsx` - Print builder for theory summaries

**Reusable Worksheet Components (ege-tasks/src/components/worksheet/):**
- `FilterBlock.jsx` - Universal filter block for task selection (topic, subtopic, difficulty, tags, source, year)
- `VariantSettings.jsx` - Variant generation settings (count, mode, sort type, progressive difficulty)
- `FormatSettings.jsx` - Print formatting settings (columns, font size, compact mode, prefixes, answers)
- `VariantRenderer.jsx` - Render variant with tasks and numbering
- `VariantStats.jsx` - Variant statistics (task count, average difficulty)
- `AnswersPage.jsx` - Answers page for printing
- `DistributionPanel.jsx` - Task distribution panel (by tag or difficulty)
- `ActionButtons.jsx` - Action buttons (print, PDF, save, load)
- `SaveWorkModal.jsx` - Modal for saving work to DB
- `LoadWorkModal.jsx` - Modal for loading saved work

### Custom Hooks (ege-tasks/src/hooks/)
- `useWorksheetGeneration.js` - Universal variant generation logic (multi-topic blocks, deduplication, 3 modes, progressive difficulty)
- `useTaskDragDrop.js` - Drag & drop tasks between variants
- `useWorksheetActions.js` - Work actions (print, PDF, save/update/load/delete works)
- `usePuppeteerPDF.js` - High-quality PDF export via Puppeteer service
- `useTaskEditing.js` - Task editing logic with validation
- `useDistribution.js` - Task distribution management (by tag or difficulty field)
- `useTaskImport.js` - Task import logic from markdown/YAML
- `useMarkdownProcessor.js` - Markdown processing
- `useKeyboardShortcuts.js` - Keyboard shortcuts
- `useDocumentStats.js` - Document statistics
- `useAutosave.js` - Autosave and restore

### Utility Functions (ege-tasks/src/utils/)
- `theoryThemes.js` - Theory theme configuration and page sizes for printing
- `filterTaskText.js` - Filter common task prefixes ("Вычислите:", "Найдите значение выражения" etc.)
- `taskCodeGenerator.js` - Task code generator (format: `{topic}-{number}`)
- `markdownTaskParser.js` - Markdown task parser with YAML frontmatter support

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

**works** - Saved test works
```javascript
{
  id: string,
  title: string,
  topic: relation,
  created: datetime
}
```

**variants** - Test variants (linked to works)
```javascript
{
  id: string,
  work: relation,       // Link to works
  title: string,
  tasks: relation[],    // Array of task IDs
  created: datetime
}
```

**theory_categories** - Theory article categories
```javascript
{
  id: string,
  title: string,
  order: number
}
```

**theory_articles** - Theory articles
```javascript
{
  id: string,
  title: string,
  category: relation,   // Link to theory_categories
  content: text,        // Article content (Markdown + LaTeX)
  tags: relation[],     // Links to tags
  order: number
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
Generated automatically by `taskCodeGenerator.js` or `generate_task_code.py`

### Worksheet Formats
- `a6` - 4 cards per A4 sheet
- `a5` - 2 cards per A4 sheet
- `a4` - 1 card per A4 sheet

## Common Tasks

### Running the Application
```bash
# Start everything (from project root)
./start.sh              # Or: npm run dev
./start.sh --no-pdf     # Without PDF service

# Start Backend only (PocketBase + PDF Service)
cd pocketbase
npm run dev

# Start React frontend only
cd ege-tasks
npm run dev  # Runs on http://localhost:5173
```

### Parsing Tasks from Markdown
```bash
python pb_parser.py              # Standard parser
python pb_parser_mordkovich.py   # Mordkovich textbook parser
python pb_parser_theory.py       # Theory articles parser
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
- `migrate-subtopics.js` - Migrate subtopics
- `update-empty-subtopics.js` - Update tasks with empty subtopics
- `update-subtopics-array.js` - Update subtopics arrays

### Python Utility Scripts (in project root)
- `pb_parser.py` - Main parser for markdown tasks
- `pb_parser_mordkovich.py` - Mordkovich textbook parser
- `pb_parser_theory.py` - Theory articles parser
- `generate_task_code.py` - Task code generator
- `fix-markdown-latex.py` - Fix LaTeX formatting
- `fix-parsed-fractions.py` - Fix fraction formatting
- `fix-m17-topic.py` - Fix topic M17
- `fix-tag-6kl-to-7kl.py` - Migrate tags 6kl to 7kl
- `fix_tags.py` - Fix tags
- `fix_task2_tables.py` - Fix task2 tables
- `add_tag_colors.py` - Add colors to tags
- `recolor_tags.py` - Recolor tags
- `delete-duplicate-codes.py` - Delete duplicate codes
- `renumber_ustno.py` - Renumber oral tasks
- `sync_tags.py` - Synchronize tags

## API Service (ege-tasks/src/services/pocketbase.js)

Key functions:
- **Topics:** `getTopics()`, `getTopic(id)`, `createTopic(data)`, `updateTopic(id, data)`
- **Subtopics:** `getSubtopics(topicId)`, `createSubtopic(data)`, `updateSubtopic(id, data)`, `deleteSubtopic(id)`
- **Tags:** `getTags()`, `createTag(data)`, `updateTag(id, data)`, `deleteTag(id)`, `findTagByTitle(title)`
- **Tasks:** `getTasks(filters)`, `getTask(id)`, `createTask(data)`, `updateTask(id, data)`, `deleteTask(id)`, `getRandomTasks(count, filters)`, `getRandomTasksWithoutRepetition(count, filters, excludeIds)`, `getTasksWithProgressiveDifficulty(count, filters, excludeIds)`, `getTaskStatementsAndCodes(topicId)`
- **Cards:** `getCards()`, `getCard(id)`, `createCard(data)`, `updateCard(id, data)`, `deleteCard(id)`
- **Works:** `getWorks()`, `getWork(id)`, `createWork(data)`, `updateWork(id, data)`, `deleteWork(id)`
- **Variants:** `getVariantsByWork(workId)`, `getVariant(id)`, `createVariant(data)`, `updateVariant(id, data)`, `deleteVariant(id)`
- **Theory:** `getTheoryCategories()`, `createTheoryCategory(data)`, `updateTheoryCategory(id, data)`, `deleteTheoryCategory(id)`, `getTheoryArticles(filters)`, `getTheoryArticle(id)`, `createTheoryArticle(data)`, `updateTheoryArticle(id, data)`, `deleteTheoryArticle(id)`, `getTheoryArticleCountByCategory()`
- **Stats:** `getUniqueYears()`, `getUniqueSources()`, `getTasksStatsSnapshot()`

## App Navigation (App.jsx views)

| View Key | Label | Component | Description |
|----------|-------|-----------|-------------|
| `tasks` | Все задачи | TaskList | Browse, filter, edit, bulk operations |
| `stats` | Статистика | TaskStatsDashboard | Analytics by topics, tags, difficulty |
| `catalog` | Каталог | TaskCatalogManager | CRUD topics/subtopics/tags, duplicates |
| `generator` | Генератор | OralWorksheetGenerator | Oral exam worksheets |
| `test-generator` | Контрольные работы | TestWorkGenerator | Test/exam work generator |
| `import` | Импорт задач | TaskImporter | Import from markdown |
| `theory-browser` | Библиотека | TheoryBrowser | Browse theory articles |
| `theory-editor` | Редактор | TheoryEditor | Edit articles (Monaco) |
| `theory-view` | Просмотр | TheoryArticleView | View article |
| `theory-print` | Конспекты | TheoryPrintBuilder | Print theory summaries |
| `theory-categories` | Категории | TheoryCategoryManager | Manage categories |

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

### Distribution Sorting
- Tag distribution preserves tag grouping (sort only on random)
- Difficulty distribution preserves ascending order (never shuffle)

## File Locations Reference

### Key Files to Modify
- Frontend components: `ege-tasks/src/components/*.jsx`
- Reusable components: `ege-tasks/src/components/worksheet/*.jsx`
- Custom hooks: `ege-tasks/src/hooks/*.js`
- API service: `ege-tasks/src/services/pocketbase.js`
- Main app: `ege-tasks/src/App.jsx`
- Styles: `ege-tasks/src/App.css`
- Backend hooks: `pocketbase/pb_hooks/*.js`
- Migrations: `pocketbase/pb_migrations/*.js`

### Configuration Files
- Frontend env: `ege-tasks/.env` (VITE_PB_URL)
- Vite config: `ege-tasks/vite.config.js`
- Package deps: `ege-tasks/package.json`
- Root package: `package.json` (concurrently scripts)

## Development Notes

### When Adding New Features
1. Frontend changes go in `ege-tasks/src/`
2. Database schema changes need migrations in `pocketbase/pb_migrations/`
3. API changes should update `ege-tasks/src/services/pocketbase.js`
4. Always test LaTeX rendering after text changes
5. Check print preview for worksheet modifications
6. Use existing reusable hooks and worksheet components

### Testing Checklist
- Task filtering works correctly
- LaTeX renders properly
- Images load correctly
- Print layout maintains formatting
- Random task selection avoids duplicates
- Task editing saves all fields
- Build succeeds: `cd ege-tasks && npm run build`

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
# All services (from root)
npm run dev              # Start everything
npm run dev:no-pdf       # Without PDF service
npm run install:all      # Install all dependencies

# Frontend
cd ege-tasks
npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview production build

# Backend
cd pocketbase
npm run dev              # PocketBase + PDF service
npm run start            # PocketBase only
npm run pdf              # PDF service only

# Utilities
python pb_parser.py                # Parse markdown tasks
python pb_parser_mordkovich.py     # Parse Mordkovich tasks
python pb_parser_theory.py         # Parse theory articles
```

## PDF Export System

### High-Quality PDF Generation
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
13. **Theory module** has its own components, categories, and articles
14. **Reuse hooks** when building new generators (useWorksheetGeneration, useTaskDragDrop, useWorksheetActions)
15. **Reuse worksheet components** from `worksheet/` directory

## Related Documentation

- `README.MD` - Полное руководство пользователя
- `ARCHITECTURE.md` - Архитектура проекта
- `CHANGELOG.md` - История изменений
- `PDF_EXPORT_UPGRADE.md` - Подробно о PDF экспорте через Puppeteer
- `QUICK_START.md` - Быстрый старт для разработчиков
- `START_GUIDE.md` - Руководство по запуску
- `TEST_AND_COMMIT.md` - Инструкции по тестированию и коммитам
