/**
 * Лист формул — геометрия и раскладка печатного листа.
 *
 * Лист A4 делится на 1 · 2 · 4 одинаковых копии (копию получает ученик), внутри
 * копии формулы идут одной или двумя колонками. Оформление — язык движка
 * `components/print-sheet`: только чёрная краска, миллиметры, четыре толщины
 * линеек; экранное превью и печать рисует ОДИН компонент.
 *
 * Чистый модуль: без React, DOM и сети — на нём висят юнит-тесты.
 * 🚨 Размеры продублированы переменными в `FormulaSheetPrint.css`.
 * Меняешь здесь — меняй там же, иначе раскладка разъедется с вёрсткой.
 */

/** Печатная высота на миллиметр меньше номинала: округления печати иначе
 *  выдавливают пустую страницу (та же поправка, что у листов марафона и ТДФ). */
export const FS_PAGE = { w: 210, h: 296 };
export const FS_PAD = { x: 8, top: 7, bottom: 6 };

/** Полоса между копиями — по ней режут лист. */
export const COPY_GAP_MM = 6;

/** Внутренние поля копии и колонка номера формулы. */
export const COPY_PAD_MM = 3;
export const NUM_COL_MM = 6;
export const COL_GAP_MM = 5;

export const COPY_GRIDS = {
  1: { cols: 1, rows: 1 },
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
};

export const COPY_COUNTS = Object.keys(COPY_GRIDS).map(Number);

export const MM_PX = 96 / 25.4;

/** Кегль по умолчанию для плотности листа: на четырёх копиях 11 pt не влезает. */
export const TEXT_PRESET = { 1: 11, 2: 10, 4: 8.5 };

export const PRINT_MODES = ['etalon', 'blank', 'both'];

export const FS_DEFAULTS = {
  copies: 2,             // копий на листе A4
  columns: 1,            // колонок формул внутри копии (1 или 2)
  textSize: 10,          // кегль формул, pt
  font: 'serif',         // sans | serif — начертание текста (формулы всегда KaTeX)
  printMode: 'both',     // etalon | blank | both
  showFields: true,      // поля «Фамилия / класс / дата» в бланке
  showNumbers: true,     // нумерация формул
  showCutLine: true,     // линия отреза между копиями
  boxedAnswer: true,     // ответ эталона в рамке
  stretch: true,         // растянуть строки до низа копии
};

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizeFormulaSheetSettings(raw = {}) {
  const d = FS_DEFAULTS;
  const copies = COPY_COUNTS.includes(Number(raw.copies)) ? Number(raw.copies) : d.copies;
  const textSize = Number(raw.textSize);
  return {
    copies,
    columns: Number(raw.columns) === 2 ? 2 : 1,
    textSize: Number.isFinite(textSize) && textSize >= 7 && textSize <= 16
      ? textSize
      : (TEXT_PRESET[copies] ?? d.textSize),
    font: oneOf(raw.font, ['sans', 'serif'], d.font),
    printMode: oneOf(raw.printMode, PRINT_MODES, d.printMode),
    showFields: bool(raw.showFields, d.showFields),
    showNumbers: bool(raw.showNumbers, d.showNumbers),
    showCutLine: bool(raw.showCutLine, d.showCutLine),
    boxedAnswer: bool(raw.boxedAnswer, d.boxedAnswer),
    stretch: bool(raw.stretch, d.stretch),
  };
}

/** Смена плотности тянет кегль пресета — иначе формулы не влезают в копию. */
export function applyCopies(settings, copies) {
  return normalizeFormulaSheetSettings({ ...settings, copies, textSize: TEXT_PRESET[copies] });
}

const LS_KEY = 'formulaSheet.settings';

export function readFormulaSheetSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeFormulaSheetSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...FS_DEFAULTS };
  }
}

export function writeFormulaSheetSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch { /* приватное окно */ }
}

/** Размер одной копии в миллиметрах. */
export function copySizeMm(copies) {
  const grid = COPY_GRIDS[copies] || COPY_GRIDS[2];
  const usableW = FS_PAGE.w - 2 * FS_PAD.x - COPY_GAP_MM * (grid.cols - 1);
  const usableH = FS_PAGE.h - FS_PAD.top - FS_PAD.bottom - COPY_GAP_MM * (grid.rows - 1);
  return { wMm: usableW / grid.cols, hMm: usableH / grid.rows, cols: grid.cols, rows: grid.rows };
}

/** Ширина колонки формул внутри копии (без колонки номера). */
export function columnWidthMm(settings) {
  const { wMm } = copySizeMm(settings.copies);
  const inner = wMm - 2 * COPY_PAD_MM;
  const cols = settings.columns;
  const perColumn = (inner - COL_GAP_MM * (cols - 1)) / cols;
  return perColumn - (settings.showNumbers ? NUM_COL_MM : 0);
}

/** Человеческая подпись формата копии: «95 × 141 мм». */
export function copyFormatLabel(copies) {
  const { wMm, hMm } = copySizeMm(copies);
  return `${Math.round(wMm)} × ${Math.round(hMm)} мм`;
}

/**
 * Секции с формулами → плоский поток элементов со сквозной нумерацией.
 * Заголовок секции — такой же элемент потока: его высоту тоже меряют, иначе
 * колонка переполняется ровно на заголовок.
 */
export function flattenSections(sections = []) {
  const items = [];
  let num = 0;
  for (const section of sections) {
    const formulas = (section.formulas || []).filter(f => (f.left || '').trim() || (f.right || '').trim());
    if (!formulas.length && !(section.title || '').trim()) continue;
    if ((section.title || '').trim()) {
      items.push({ kind: 'section', id: `s-${section.id || items.length}`, title: section.title });
    }
    for (const f of formulas) {
      num += 1;
      items.push({
        kind: 'formula',
        id: `f-${f.id || `${num}`}`,
        num,
        left: f.left || '',
        right: f.right || '',
      });
    }
  }
  return items;
}

/**
 * Раскладка потока по колонкам ОДНОЙ копии.
 *
 * Копия — фиксированная область листа, а не бесконечная лента: что не влезло,
 * возвращается в `overflow`, и панель честно говорит «не помещается N формул»
 * (раньше хвост молча срезался `overflow: hidden`).
 *
 * 🚨 Заголовок секции не остаётся последним в колонке — уезжает к своим
 * формулам.
 */
export function layoutCopy(items, heights, colCount, capPx) {
  const cols = Math.max(1, colCount);
  const columns = [];
  const overflow = [];
  let current = [];
  let used = 0;

  /** Закрывает колонку; висячий заголовок уезжает к своим формулам. */
  const closeColumn = () => {
    if (current.length && current[current.length - 1].kind === 'section') {
      const orphan = current.pop();
      columns.push(current);
      current = [orphan];
      used = heights[orphan.id] ?? 0;
      return;
    }
    columns.push(current);
    current = [];
    used = 0;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const h = heights[item.id] ?? 0;

    if (current.length > 0 && used + h > capPx) {
      const isLastColumn = columns.length + 1 >= cols;
      closeColumn();
      if (isLastColumn) {
        // Колонки кончились: остаток в копию не помещается. Молча резать его
        // нельзя — панель обязана сказать, сколько формул не влезло.
        overflow.push(...current, ...items.slice(i));
        current = [];
        used = 0;
        break;
      }
    }

    current.push(item);
    used += h;
  }

  if (current.length) columns.push(current);
  while (columns.length < cols) columns.push([]);

  return { columns: columns.slice(0, cols), overflow };
}

/** Потолок прироста строки при растягивании (мм). */
export const MAX_STRETCH_MM = 6;

/**
 * Прирост высоты строки при растягивании: свободное место копии делится между
 * формулами поровну, чтобы место для записи занимало весь лист.
 *
 * 🚨 Прирост ограничен `MAX_STRETCH_MM`: на листе из пяти формул остаток в
 * полтора сантиметра на строку превращает бланк в разреженную лесенку.
 * 🚨 Из ёмкости вычитается ~2 мм: при печати строки чуть выше, чем на экране.
 */
export function stretchExtraPx(columns, heights, capPx, pxPerMm = MM_PX, maxExtraMm = MAX_STRETCH_MM) {
  const safety = Math.ceil(2 * pxPerMm);
  const maxExtra = maxExtraMm * pxPerMm;
  return columns.map(column => {
    const formulas = column.filter(i => i.kind === 'formula');
    if (!formulas.length) return 0;
    const used = column.reduce((sum, i) => sum + (heights[i.id] ?? 0), 0);
    const free = capPx - safety - used;
    if (free <= 0) return 0;
    return Math.min(maxExtra, free / formulas.length);
  });
}

/** Сколько формул в потоке (заголовки секций не в счёт). */
export function countFormulas(items) {
  return items.filter(i => i.kind === 'formula').length;
}

/** Какие страницы печатаются при выбранном режиме. */
export function pagesForMode(printMode) {
  if (printMode === 'etalon') return ['etalon'];
  if (printMode === 'blank') return ['blank'];
  return ['etalon', 'blank'];
}
