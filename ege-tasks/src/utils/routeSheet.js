/**
 * Маршрутный лист: чистая логика без React и без сети.
 *
 * Механика листа: задачи связаны в цепочку — ответ задачи подставляется
 * параметром в условие следующей. Место подстановки помечено в тексте
 * плейсхолдером `[①]`, где кружковая цифра — номер задачи-источника. Поэтому
 * номер здесь не украшение: по нему ученик находит, какой свой ответ
 * подставить, а ключ учителя — чем плейсхолдер заменить.
 *
 * Разбор цепочки живёт здесь, а не в вёрстке: ссылка на задачу без ответа или
 * на задачу ниже по листу ломает лист молча — учитель увидит это только у
 * доски, если не предупредить заранее.
 *
 * Геометрия страницы — та же, что у печатного движка `components/print-sheet/`
 * и листа-классификатора: монохром, миллиметры, клетка 5 мм.
 */

// ─── Номера задач ────────────────────────────────────────────────────────────
// Кружковые цифры U+2460…U+2473 — ими записаны плейсхолдеры в условиях, и
// формат этот уже лежит в базе, поэтому он неприкосновенен.
export const CIRCLE_NUMBERS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
];

export function circleNum(index) {
  return CIRCLE_NUMBERS[index] ?? `(${index + 1})`;
}

/** Номер задачи (0-based) по кружковой цифре; -1 — символ не наш. */
export function circleIndex(glyph) {
  return CIRCLE_NUMBERS.indexOf(glyph);
}

// Плейсхолдер целиком: `[①]`. Класс символов перечислен явно — так регулярка
// не цепляет случайные скобки с цифрой внутри.
export const CIRCLE_CLASS = '[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]';
export const PLACEHOLDER_RE = new RegExp(`\\[${CIRCLE_CLASS}\\]`, 'g');

/** Номера задач (0-based), на которые ссылается условие. Без повторов. */
export function referencedIndexes(statement) {
  const found = new Set();
  String(statement || '').replace(PLACEHOLDER_RE, (m) => {
    const idx = circleIndex(m[1]);
    if (idx >= 0) found.add(idx);
    return m;
  });
  return [...found].sort((a, b) => a - b);
}

/**
 * Подставить в условие ответы предыдущих задач — так условие выглядит для
 * учителя в ключе. Плейсхолдер без ответа остаётся собой: показать пустое
 * место честнее, чем сделать вид, что задача решается.
 */
export function resolveStatement(statement, tasks = [], upToIndex = tasks.length) {
  return String(statement || '').replace(PLACEHOLDER_RE, (m) => {
    const idx = circleIndex(m[1]);
    if (idx < 0 || idx >= upToIndex) return m;
    const answer = tasks[idx]?.answer;
    return answer ? String(answer) : m;
  });
}

/**
 * Разрывы цепочки. Возвращает короткие человеческие строки — их показывает
 * панель настроек, печать ими не управляется.
 */
export function chainIssues(tasks = []) {
  const issues = [];
  const used = new Set();

  tasks.forEach((task, index) => {
    const refs = referencedIndexes(task.statement_md);
    refs.forEach(ref => {
      used.add(ref);
      if (ref >= tasks.length) {
        issues.push(`Задача ${index + 1} ссылается на ${circleNum(ref)}, а такой задачи в листе нет.`);
      } else if (ref === index) {
        issues.push(`Задача ${index + 1} ссылается сама на себя (${circleNum(ref)}).`);
      } else if (ref > index) {
        issues.push(`Задача ${index + 1} ссылается на ${circleNum(ref)} — задачу ниже по листу.`);
      } else if (!tasks[ref]?.answer) {
        issues.push(`У задачи ${ref + 1} нет ответа, а задача ${index + 1} его подставляет.`);
      }
    });

    if (!task.answer) {
      issues.push(`У задачи ${index + 1} не задан ответ — в ключе будет прочерк.`);
    }
  });

  // Задача, ответ которой никому не нужен, обрывает маршрут: дальше по листу
  // цепочки уже нет, хотя лист выглядит целым.
  tasks.forEach((_, index) => {
    if (index < tasks.length - 1 && !used.has(index)) {
      issues.push(`Ответ задачи ${index + 1} нигде не используется — цепочка рвётся.`);
    }
  });

  return issues;
}

// ─── Геометрия страницы ──────────────────────────────────────────────────────
// Поля — канон «узких» полей входной контрольной (`print-sheet/geometry.js`,
// пресет narrow: 8 по бокам, 8 сверху, 6 снизу). Обычные поля (14/12/8) на
// маршрутном листе не нужны: справа и слева от клетки всё равно пусто, а
// каждый лишний миллиметр поля — это минус миллиметр места для решения.
//
// 🚨 Поля рисует САМ лист (padding страницы), а @page уходит в `margin: 0`.
// Обратный порядок (поля в @page, страница без padding) выглядит проще, но
// диалог печати Chrome позволяет выбрать «Поля: Нет» — и тогда он перебивает
// @page, а лист печатается впритык к краю бумаги.
export const PAGE_MM = {
  width: 210,
  height: 297,
  top: 8,
  right: 8,
  bottom: 6,
  left: 8,
};

export const CELL_MM = 5;

// Колонка номера: квадрат 6,5 мм + зазор 3,5 мм (канон print-sheet).
export const NUM_COL_MM = 10;

// Зазор между задачами: 4 мм margin + 4 мм padding у `.rs-task + .rs-task`.
export const TASK_GAP_MM = 8;

// Отступ места для решения от условия (`.rs-solve { margin-top }`).
export const SOLVE_GAP_MM = 2.6;

// Колонтитул страниц 2+ («название · стр. N»): 5 мм + 4 мм отступа.
export const RUNHEAD_MM = 9;

// Запас на округления печати.
const SAFETY_MM = 3;

export function contentWidthMm() {
  return PAGE_MM.width - PAGE_MM.left - PAGE_MM.right;
}

/** Сколько миллиметров высоты достаётся задачам на первой странице (без шапки). */
export function bodyFirstMm() {
  return PAGE_MM.height - PAGE_MM.top - PAGE_MM.bottom - SAFETY_MM;
}

/** То же на страницах 2+: там вместо шапки колонтитул. */
export function bodyRestMm() {
  return bodyFirstMm() - RUNHEAD_MM;
}

/**
 * Ширина клеточного поля под задачей. Нужна точно: по ней считается число
 * вертикальных линий, а лишние ломают масштаб печати в Chrome.
 */
export function solveWidthMm() {
  return contentWidthMm() - NUM_COL_MM - 1;
}

/** Ширина рамки для ответа. Ответ числовой — широкое поле только жрёт строку. */
export const ANSWER_BOX_MM = 30;

/** Высота места для решения; 0 клеток — места нет вовсе. */
export function solveHeightMm(settings = {}) {
  const cells = Math.max(0, settings.solveCells ?? DEFAULT_ROUTE_SETTINGS.solveCells);
  return cells * CELL_MM;
}

export function pagePaddingCss() {
  return `${PAGE_MM.top}mm ${PAGE_MM.right}mm ${PAGE_MM.bottom}mm ${PAGE_MM.left}mm`;
}

// ─── Настройки листа ─────────────────────────────────────────────────────────
export const DEFAULT_INSTRUCTION = 'Задачи связаны в цепочку: ответ задачи '
  + 'подставляется в условие следующей. Кружковый номер в условии — место для '
  + 'ответа задачи с этим номером; впишите туда своё число и решайте дальше.';

export const DEFAULT_ROUTE_SETTINGS = {
  fill: 'grid',          // разлиновка места решения: клетка / линейка / пусто
  solveCells: 6,         // высота места решения в клетках по 5 мм (0 — без места)
  fontSize: 's',
  showKey: true,         // страница ключа учителя
  showClassField: true,  // поле «Класс» в шапке
  showInstruction: true,
  instruction: '',       // пусто = текст по умолчанию
};

/**
 * Настройки с подставленными дефолтами. Листы, сохранённые до появления
 * настроек, приходят без поля `settings` вовсе — нормализация и есть то место,
 * где они получают печатный вид, а не падают.
 */
export function normalizeRouteSettings(settings = {}) {
  const next = { ...DEFAULT_ROUTE_SETTINGS, ...(settings || {}) };
  if (!['grid', 'lines', 'blank'].includes(next.fill)) next.fill = 'grid';
  if (!['s', 'm', 'l'].includes(next.fontSize)) next.fontSize = 's';
  next.solveCells = Math.min(24, Math.max(0, Number(next.solveCells) || 0));
  return next;
}

/** Текст инструкции для листа: свой, если учитель его написал. */
export function instructionText(settings = {}) {
  const own = String(settings.instruction || '').trim();
  return own || DEFAULT_INSTRUCTION;
}
