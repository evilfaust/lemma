/**
 * ТДФ — геометрия и настройки печатного листа (конспект и бланк опроса).
 *
 * Чистый модуль: без React, DOM и сети — на нём висят юнит-тесты. Оформление
 * листа общее с движком `components/print-sheet` (монохром, миллиметры, четыре
 * толщины линеек), но раскладка своя: ТДФ печатается таблицей
 * «№ | название и формулировка | чертёж | краткая запись», а не потоком задач.
 *
 * 🚨 Размеры продублированы в `TDFPrintView.css` переменными `--tdf-*`.
 * Меняешь здесь — меняй там же, иначе пагинация разъедется с вёрсткой.
 */

/** Печатная высота листа на 1 мм меньше номинала: округления печати иначе
 *  выдавливают пустую страницу (та же поправка, что у листов марафона). */
export const PAGE = {
  landscape: { wMm: 297, hMm: 209 },
  portrait:  { wMm: 210, hMm: 296 },
};

/** Поля листа — канон «узких» полей печатного движка. */
export const PAD = { x: 8, top: 7, bottom: 6 };

/** Колонка номера — тот же квадрат 6.5 мм, что во всех печатных листах. */
export const NUM_COL_MM = 6.5;

/** Ширина колонки номера вместе с зазором до содержимого. */
export const NUM_COL_TOTAL_MM = 10;

export const MM_PX = 96 / 25.4;

export const DRAWING_SIZES = ['s', 'm', 'l', 'xl'];

/** Вес колонки чертежа и потолок высоты картинки (мм) по ориентации. */
const DRAWING_CFG = {
  s:  { weight: 0.8, hMm: { landscape: 18, portrait: 15 } },
  m:  { weight: 1.2, hMm: { landscape: 26, portrait: 21 } },
  l:  { weight: 1.7, hMm: { landscape: 40, portrait: 32 } },
  xl: { weight: 2.3, hMm: { landscape: 55, portrait: 44 } },
};

const COL_WEIGHTS = { formulation: 1.5, notation: 1.0 };

export const TDF_SHEET_DEFAULTS = {
  orientation: 'landscape',
  drawingSize: 'm',
  font: 'sans',            // sans | serif — начертание формулировок
  showType: true,          // подпись типа пункта у номера
  showFormulation: true,   // колонка «Формулировка» (в бланке — поле для записи)
  showDrawing: true,
  showNotation: true,
  fill: 'grid',            // grid | lines | blank — чем разлинованы поля бланка
  pages: 1,                // бланк: растянуть состав на 1 или 2 листа
  showFio: true,           // строка ФИО/дата (бланк)
  showScore: true,         // «Оценка: ____» в подвале (бланк)
  showFooter: true,        // колонтитул с названием набора и номером листа
  geoStrips: 2,            // гео-формат: полосок-вариантов на листе A4
};

const ORIENTATIONS = ['landscape', 'portrait'];
const FILLS = ['grid', 'lines', 'blank'];

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** Приводит настройки (в том числе сохранённые прошлой версией) к канону. */
export function normalizeTdfSheetSettings(raw = {}) {
  const d = TDF_SHEET_DEFAULTS;
  const s = {
    ...d,
    ...raw,
    orientation: oneOf(raw.orientation, ORIENTATIONS, d.orientation),
    drawingSize: oneOf(raw.drawingSize, DRAWING_SIZES, d.drawingSize),
    font: oneOf(raw.font, ['sans', 'serif'], d.font),
    fill: oneOf(raw.fill, FILLS, d.fill),
    pages: raw.pages === 2 ? 2 : 1,
    showType: bool(raw.showType, d.showType),
    showFormulation: bool(raw.showFormulation, d.showFormulation),
    showDrawing: bool(raw.showDrawing, d.showDrawing),
    showNotation: bool(raw.showNotation, d.showNotation),
    showFio: bool(raw.showFio, d.showFio),
    showScore: bool(raw.showScore, d.showScore),
    showFooter: bool(raw.showFooter, d.showFooter),
    geoStrips: raw.geoStrips === 1 ? 1 : 2,
  };
  // Пустой лист без единой колонки — не лист. Формулировка возвращается.
  if (!s.showFormulation && !s.showDrawing && !s.showNotation) s.showFormulation = true;
  return s;
}

const LS_KEY = 'tdf.sheetSettings';

export function readTdfSheetSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeTdfSheetSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...TDF_SHEET_DEFAULTS };
  }
}

export function writeTdfSheetSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch { /* приватное окно — настройки живут только в сессии */ }
}

/** Ширина полосы набора (лист минус боковые поля). */
export function contentWidthMm(settings) {
  const { wMm } = PAGE[settings.orientation];
  return wMm - 2 * PAD.x;
}

/** Высота полосы набора (лист минус верхнее и нижнее поля). */
export function contentHeightMm(settings) {
  const { hMm } = PAGE[settings.orientation];
  return hMm - PAD.top - PAD.bottom;
}

/**
 * Доли ширины для колонок содержимого (без колонки номера).
 * Веса нормализуются только по включённым колонкам, поэтому лист без чертежей
 * не оставляет пустого столбца, а отдаёт место формулировке.
 *
 * @returns {{formulation: number, drawing: number, notation: number}} — проценты
 */
export function columnPercents(settings) {
  const weights = {
    formulation: settings.showFormulation ? COL_WEIGHTS.formulation : 0,
    drawing: settings.showDrawing ? DRAWING_CFG[settings.drawingSize].weight : 0,
    notation: settings.showNotation ? COL_WEIGHTS.notation : 0,
  };
  const total = weights.formulation + weights.drawing + weights.notation;
  if (!total) return { formulation: 100, drawing: 0, notation: 0 };
  return {
    formulation: (weights.formulation / total) * 100,
    drawing: (weights.drawing / total) * 100,
    notation: (weights.notation / total) * 100,
  };
}

/** Ширина колонки в миллиметрах — по ней считается число вертикалей клетки. */
export function columnWidthMm(settings, column) {
  const usable = contentWidthMm(settings) - NUM_COL_TOTAL_MM;
  return (columnPercents(settings)[column] / 100) * usable;
}

/** Потолок высоты чертежа в миллиметрах. */
export function drawingHeightMm(settings) {
  return DRAWING_CFG[settings.drawingSize].hMm[settings.orientation];
}

/**
 * Жадная разбивка строк по страницам. Первая страница ниже на высоту шапки.
 *
 * @param {Array} items      — пункты в порядке конспекта
 * @param {Object} heights   — id → измеренная высота строки, px
 * @param {number} firstCapPx
 * @param {number} restCapPx
 */
export function paginateRows(items, heights, firstCapPx, restCapPx) {
  if (!items.length) return [[]];
  const pages = [];
  let current = [];
  let used = 0;

  for (const item of items) {
    const h = heights[item.id] ?? 50;
    const cap = pages.length === 0 ? firstCapPx : restCapPx;
    if (current.length > 0 && used + h > cap) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += h;
  }
  if (current.length) pages.push(current);
  return pages;
}

/** Бланк: ровно N страниц, состав делится поровну. */
export function splitIntoPages(items, pageCount) {
  if (!items.length) return [[]];
  const n = Math.max(1, pageCount);
  if (n === 1) return [items];
  const per = Math.ceil(items.length / n);
  const pages = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  return pages.length ? pages : [[]];
}

/**
 * Высота строки бланка на каждой странице: свободное место делится поровну,
 * чтобы поля для записи заполнили лист.
 *
 * 🚨 Из ёмкости вычитается запас ~2 мм: при печати строки чуть выше, чем на
 * экране, и без запаса последняя строка обрезается.
 */
export function stretchRowHeights(pages, firstCapPx, restCapPx, pxPerMm = MM_PX) {
  const safety = Math.ceil(2 * pxPerMm);
  return pages.map((pageItems, idx) => {
    const n = Math.max(pageItems.length, 1);
    const avail = (idx === 0 ? firstCapPx : restCapPx) - safety;
    return Math.floor(avail / n);
  });
}

/**
 * Разбор краткой записи на отдельные формулы: каждая непустая строка — своя
 * формула, из неё берётся левая часть до первого «=» (в бланке ученик
 * дописывает правую).
 */
export function parseFormulas(md) {
  const fallback = [{ full: '', lhs: '$S =$' }];
  if (!md || !md.trim()) return fallback;
  const lines = md.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return fallback;
  return lines.map(line => {
    const stripped = line.replace(/^\$+|\$+$/g, '').trim();
    const m = /^(.+?)=/.exec(stripped);
    return { full: line, lhs: m ? `$${m[1].trim()} =$` : '$S =$' };
  });
}

/** Русская форма множественного числа: pluralRu(3, ['формула','формулы','формул']). */
export function pluralRu(n, forms) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}
