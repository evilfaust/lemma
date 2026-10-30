/** Геометрия печатной нонограммы: поле с местами для чисел и отдельные примеры. */
import { texWidthEm, isTallTex } from './clueTasks';

export const PAGE_MM = {
  portrait: { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
};
export const MARGIN_MM = 10;
export const HEAD_MM = { full: 21, compact: 10 };
export const INSTR_MM = 16;
export const FOOT_MM = 7;
export const CUT_MM = 8;
export const CONTENT_TOP_MM = 2;
export const CONTENT_GAP_MM = 6;
export const MAX_CELL_MM = 13;
export const MIN_CELL_MM = 5;
export const LABEL_MM = 4;
export const SLOT_MM = { w: 3.5, h: 4, gap: 0.8 };
export const TASK_HEAD_MM = 6;
export const TASK_LABEL_MM = 6.5;
export const TASK_GAP_MM = 1.2;
export const TASK_PAD_MM = 2;
export const MIN_TASK_FONT_PT = 8;

// KaTeX рисует формулу в 1.21 раза крупнее окружающего текста.
export const emMm = pt => pt * 0.3528 * 1.21;
export const columnLabel = index => String.fromCharCode(65 + index);

export function resolveOrientation(orientation, cols) {
  if (orientation === 'portrait' || orientation === 'landscape') return orientation;
  return cols >= 13 ? 'landscape' : 'portrait';
}

/** Свободное место одного экземпляра, с учётом линии отреза и отступа контента. */
export function blockSizeMm({ orientation = 'portrait', perPage = 1, instruction = true, checksum = true } = {}) {
  const page = PAGE_MM[orientation] || PAGE_MM.portrait;
  const n = perPage === 2 ? 2 : 1;
  const head = n === 2 ? HEAD_MM.compact : HEAD_MM.full;
  // 296/209 мм: запас от лишней страницы из-за округления браузером.
  const slot = (page.h - 1 - 2 * MARGIN_MM - (n - 1) * CUT_MM) / n;
  return {
    w: page.w - 2 * MARGIN_MM,
    h: slot - head - (instruction ? INSTR_MM : 0) - (checksum ? FOOT_MM : 0) - CONTENT_TOP_MM,
    slot,
    head,
  };
}

/** Размер поля зависит только от количества подсказок, а не от записи примеров. */
export function layoutGrid(rows, cols, block, { minCell = MIN_CELL_MM, maxCell = MAX_CELL_MM } = {}) {
  const rowCount = Math.max(1, ...rows.map(l => l.length));
  const colCount = Math.max(1, ...cols.map(l => l.length));
  const rowZoneMm = LABEL_MM + rowCount * SLOT_MM.w + (rowCount - 1) * SLOT_MM.gap + 1.6;
  const colZoneMm = LABEL_MM + colCount * SLOT_MM.h + (colCount - 1) * SLOT_MM.gap + 1.6;
  const cellMm = Math.max(1, Math.floor(Math.min(
    (block.w - rowZoneMm) / cols.length,
    (block.h - colZoneMm) / rows.length,
    maxCell,
  ) * 10) / 10);
  const widthMm = rowZoneMm + cellMm * cols.length;
  const heightMm = colZoneMm + cellMm * rows.length;
  return {
    fontPt: 10, cellMm, rowZoneMm, colZoneMm, widthMm, heightMm,
    overflow: cellMm < minCell || widthMm > block.w + 0.01 || heightMm > block.h + 0.01,
  };
}

/** Оценка flex-переносов целых выражений; запас сверяется реальной вёрсткой. */
export function taskLineHeight(line, widthMm, fontPt) {
  const e = emMm(fontPt);
  const available = Math.max(1, widthMm - TASK_LABEL_MM);
  let width = 0;
  let height = 0;
  let total = 0;
  let overflow = false;
  for (const [i, q] of line.entries()) {
    const tex = typeof q === 'number' ? String(q) : q.exprLatex;
    // Точка с запятой остаётся при предыдущем выражении при переносе.
    const w = (texWidthEm(tex) * 1.08 + (i < line.length - 1 ? 0.65 : 0)) * e;
    const h = (isTallTex(tex) ? 2.6 : 1.5) * e;
    if (w > available) overflow = true;
    if (width && width + TASK_GAP_MM + w > available) {
      total += height + TASK_GAP_MM;
      width = 0;
      height = 0;
    }
    width += (width ? TASK_GAP_MM : 0) + w;
    height = Math.max(height, h);
  }
  return { height: total + Math.max(height, 3.5) + TASK_PAD_MM, overflow };
}

function taskGroupSize(lines, width, fontPt) {
  const sizes = lines.map(line => taskLineHeight(line, width, fontPt));
  return {
    height: TASK_HEAD_MM + sizes.reduce((s, l) => s + l.height, 0),
    overflow: sizes.some(l => l.overflow),
  };
}

/** Поле сверху на книжном листе; слева на альбомном. */
export function layoutPuzzle(rows, cols, block, orientation) {
  const placement = orientation === 'landscape' ? 'aside' : 'below';
  let last;
  for (const fontPt of [10, 9.5, 9, 8.5, MIN_TASK_FONT_PT]) {
    for (const share of placement === 'aside' ? [0.5, 0.46, 0.42] : [1]) {
      const grid = placement === 'aside'
        ? layoutGrid(rows, cols, { w: block.w * share, h: block.h })
        : null;
      const tasksWidthMm = placement === 'aside' ? block.w - grid.widthMm - CONTENT_GAP_MM : block.w;
      const groupWidth = (tasksWidthMm - CONTENT_GAP_MM) / 2;
      const rowSize = taskGroupSize(rows, groupWidth, fontPt);
      const colSize = taskGroupSize(cols, groupWidth, fontPt);
      const tasksHeightMm = Math.max(rowSize.height, colSize.height);
      const field = grid || layoutGrid(rows, cols, { w: block.w, h: block.h - tasksHeightMm - CONTENT_GAP_MM });
      last = {
        grid: field, placement, fontPt, tasksWidthMm, tasksHeightMm,
        overflow: field.overflow || rowSize.overflow || colSize.overflow
          || (placement === 'aside' && tasksHeightMm > block.h),
      };
      if (!last.overflow) return last;
    }
  }
  // Сложный лист не ужимаем до нечитаемого шрифта: списки получают свои страницы.
  return {
    ...last, separate: true,
    grid: layoutGrid(rows, cols, { w: block.w, h: block.h - CONTENT_GAP_MM }),
    fontPt: 10,
  };
}

/** Разбивка отдельных страниц примеров; исходные обозначения сохраняются. */
export function paginateTasks(rows, cols, block) {
  const width = (block.w - CONTENT_GAP_MM) / 2;
  const available = block.h - TASK_HEAD_MM;
  const split = (lines, fontPt) => {
    const pages = [[]];
    let used = 0;
    lines.forEach((line, index) => {
      const { height } = taskLineHeight(line, width, fontPt);
      if (used && used + height > available) { pages.push([]); used = 0; }
      pages[pages.length - 1].push({ line, index });
      used += height;
    });
    return pages;
  };
  let best;
  for (const fontPt of [10, 9.5, 9, 8.5, MIN_TASK_FONT_PT]) {
    if (fontPt > MIN_TASK_FONT_PT
      && [...rows, ...cols].some(line => taskLineHeight(line, width, fontPt).overflow)) continue;
    const rowPages = split(rows, fontPt);
    const colPages = split(cols, fontPt);
    const pages = Array.from({ length: Math.max(rowPages.length, colPages.length) }, (_, i) => ({
      rows: rowPages[i] || [], cols: colPages[i] || [], fontPt,
    }));
    if (!best || pages.length < best.length) best = pages;
    if (best.length === 1) break;
  }
  return best;
}

/** Предел отдельного выражения по ширине списка, одинаковый для обеих осей. */
export function clueLimits(_clues, block) {
  const width = (block.w - CONTENT_GAP_MM) / 2 - TASK_LABEL_MM;
  const limit = { em: Math.min(12, Math.floor((width / emMm(10) - 0.65) / 1.08)), noTall: false };
  return { row: { ...limit }, col: { ...limit } };
}

export const isMajorLine = (i, n) => i === 0 || i === n || i % 5 === 0;
