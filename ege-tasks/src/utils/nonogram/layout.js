/**
 * Раскладка листа японского кроссворда: размер клетки и кегль подсказок.
 *
 * Лист = шапка + (инструкция) + сетка с зонами подсказок + строка проверки.
 * Подсказки строк стоят слева в ряд, подсказки столбцов — сверху стопкой.
 * Кегль подбирается сверху вниз: самый крупный, при котором пример столбца
 * влезает в ширину клетки, пример строки — в её высоту, а клетка не меньше
 * `minCell`. Всё в миллиметрах; вёрстка получает числа inline (как у
 * отрезного листа марафона), CSS их не пересчитывает.
 */
import { texWidthEm, isTallTex } from './clueTasks';

export const PAGE_MM = {
  portrait:  { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
};
export const MARGIN_MM = 10;
export const HEAD_MM = { full: 21, compact: 10 };
export const INSTR_MM = 11;
export const FOOT_MM = 7;
export const CUT_MM = 8;        // полоса отреза между двумя кроссвордами на листе
export const MAX_CELL_MM = 13;
export const MIN_CELL_MM = 5;

// em формулы в мм при кегле pt: KaTeX рисует в 1.21 раза крупнее текста
export const emMm = (pt) => pt * 0.3528 * 1.21;

// Отступы вокруг примера, em и мм. Пример строки — в рамке (соседи стоят в
// ряд), пример столбца — без рамки: он и так на своей строке, а клетка узкая.
const PAD_X_EM = 0.55;
const PAD_Y_EM = 0.35;
const COL_PAD_X_EM = 0.2;
const COL_PAD_Y_EM = 0.35;
const LINE_EM = 1.4;
const TALL_EM = 2.45;
const ROW_GAP_MM = 0.8;
const COL_GAP_MM = 0.5;
const ZONE_PAD_MM = 1.4;
// Запас на ошибку оценки ширины (сверка с KaTeX: в среднем ±1 %, редкие до 10 %)
const WIDTH_SAFETY = 1.06;

const FONT_STEPS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5];

/** Ориентация листа: «авто» — широкие сетки альбомом. */
export function resolveOrientation(orientation, cols) {
  if (orientation === 'portrait' || orientation === 'landscape') return orientation;
  return cols >= 13 ? 'landscape' : 'portrait';
}

/** Место под один кроссворд (сетка с подсказками), мм. */
export function blockSizeMm({ orientation = 'portrait', perPage = 1, instruction = true, checksum = true } = {}) {
  const page = PAGE_MM[orientation] || PAGE_MM.portrait;
  const n = perPage === 2 ? 2 : 1;
  const head = n === 2 ? HEAD_MM.compact : HEAD_MM.full;
  // Лист печатается высотой 296/209 мм, а не 297/210 (см. CSS) — на миллиметр меньше
  const slot = (page.h - 1 - 2 * MARGIN_MM - (n - 1) * CUT_MM) / n;
  return {
    w: page.w - 2 * MARGIN_MM,
    h: slot - head - (instruction ? INSTR_MM : 0) - (checksum ? FOOT_MM : 0),
    slot,
    head,
  };
}

// Число ключа набрано текстом (жирные цифры, `.nng-q--num`), а не KaTeX
const NUM_DIGIT_EM = 0.75;

/** Размеры примера в em: ширина, высота строки. Число — тоже пример. */
export function itemEm(q, side = 'row') {
  const num = typeof q === 'number';
  const tex = num ? String(q) : q.exprLatex;
  const tall = !num && isTallTex(tex);
  const col = side === 'col';
  return {
    w: (num ? tex.length * NUM_DIGIT_EM : texWidthEm(tex)) + (col ? COL_PAD_X_EM : PAD_X_EM),
    h: (tall ? TALL_EM : LINE_EM) + (col ? COL_PAD_Y_EM : PAD_Y_EM),
  };
}

function zones(rows, cols, e) {
  let rowZone = 0;
  let rowItemH = 0;
  for (const line of rows) {
    const ems = line.map(itemEm);
    const w = ems.reduce((s, m) => s + m.w * e, 0) * WIDTH_SAFETY + Math.max(0, ems.length - 1) * ROW_GAP_MM;
    rowZone = Math.max(rowZone, w);
    for (const m of ems) rowItemH = Math.max(rowItemH, m.h * e);
  }
  let colZone = 0;
  let colItemW = 0;
  for (const line of cols) {
    const ems = line.map(q => itemEm(q, 'col'));
    const h = ems.reduce((s, m) => s + m.h * e, 0) + Math.max(0, ems.length - 1) * COL_GAP_MM;
    colZone = Math.max(colZone, h);
    for (const m of ems) colItemW = Math.max(colItemW, m.w * e * WIDTH_SAFETY);
  }
  // Пустая линия печатает «0»
  const zero = itemEm(0);
  const zeroCol = itemEm(0, 'col');
  return {
    rowZone: Math.max(rowZone, zero.w * e) + ZONE_PAD_MM,
    colZone: Math.max(colZone, zeroCol.h * e) + ZONE_PAD_MM,
    rowItemH: Math.max(rowItemH, zero.h * e),
    colItemW: Math.max(colItemW, zeroCol.w * e),
  };
}

/**
 * Раскладка сетки. `rows`/`cols` — подсказки: массивы примеров
 * `{exprLatex}` или чисел (ключ учителя). Возвращает
 * `{ fontPt, cellMm, rowZoneMm, colZoneMm, widthMm, heightMm, overflow }`;
 * `overflow` — даже на самом мелком кегле что-то не влезло.
 */
export function layoutGrid(rows, cols, block, { minCell = MIN_CELL_MM, maxCell = MAX_CELL_MM } = {}) {
  const R = rows.length;
  const C = cols.length;
  let last = null;
  for (const pt of FONT_STEPS) {
    const e = emMm(pt);
    const z = zones(rows, cols, e);
    const cell = Math.min((block.w - z.rowZone) / C, (block.h - z.colZone) / R, maxCell);
    last = {
      fontPt: pt,
      cellMm: Math.floor(cell * 10) / 10,
      rowZoneMm: Math.ceil(z.rowZone * 10) / 10,
      colZoneMm: Math.ceil(z.colZone * 10) / 10,
      overflow: true,
    };
    const ok = cell >= minCell && z.colItemW <= cell - 0.6 && z.rowItemH <= cell - 0.4;
    if (ok) { last.overflow = false; break; }
  }
  last.widthMm = Math.round((last.rowZoneMm + last.cellMm * C) * 10) / 10;
  last.heightMm = Math.round((last.colZoneMm + last.cellMm * R) * 10) / 10;
  return last;
}

/**
 * Пределы ширины примеров ДО генерации — по картинке, без самих примеров.
 * Строка: на ряд подсказок — не больше ~45 % ширины листа; столбец — ширина
 * клетки при кегле 6,5 pt. Высокие (дробные) примеры в столбцах не ставим:
 * стопка дробей съедает высоту сетки.
 */
export function clueLimits(clues, block) {
  const R = clues.rows.length;
  const C = clues.cols.length;
  const maxRowLen = Math.max(1, ...clues.rows.map(l => l.length));
  const maxColLen = Math.max(1, ...clues.cols.map(l => l.length));
  const e = emMm(7);
  const ec = emMm(6.5);
  // Подсказкам строк — не больше 40 % ширины: остальное — сетке
  const rowShare = block.w * 0.4;
  const rowEm = Math.min(7, Math.max(2.2,
    ((rowShare - (maxRowLen - 1) * ROW_GAP_MM) / maxRowLen) / e - PAD_X_EM));
  const colZone = maxColLen * (LINE_EM + COL_PAD_Y_EM) * ec + ZONE_PAD_MM;
  const cell = Math.min((block.w - rowShare) / C, (block.h - colZone) / R, MAX_CELL_MM);
  const colEm = Math.max(0.5, (cell - 0.6) / ec - COL_PAD_X_EM);
  return {
    row: { em: Math.round(rowEm * 10) / 10, noTall: (TALL_EM + PAD_Y_EM) * e > cell - 0.4 },
    col: { em: Math.round(colEm * 10) / 10, noTall: true },
    cellMm: cell,
  };
}

/** Жирная линия сетки — каждые 5 клеток, как в печатных нонограммах. */
export const isMajorLine = (i, n) => i === 0 || i === n || i % 5 === 0;
