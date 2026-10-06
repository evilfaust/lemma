// Карточки геометрии (A5/A4): лист режется на карточки, на карточке — номер,
// условие и чертёж. Модуль чистый (без React и DOM): размеры листа и ячейки,
// выбор раскладки «текст ↔ чертёж», чтение сохранённого выбора учителя.
//
// Раскладку не рисуют руками: высоту текста карточка меряет в DOM при каждой
// ширине-кандидате, размер чертежа даёт fitDrawing, а chooseCardPlacement
// выбирает вариант, где чертёж крупнее и текст влезает целиком. До v3.9.304
// макет был двумя свободными прямоугольниками, и текст по умолчанию лежал
// поверх чертежа — 152 из 277 своих задач правились вручную.

/** Формат листа, мм. */
export const PAGE_MM = {
  A5: { w: 148, h: 210 },
  A4: { w: 210, h: 297 },
};

/** Поля листа, мм — принтер не печатает у самого края. */
export const SHEET_PAD_MM = 5;
/** Шапка листа (тема · подтема · вариант), мм. */
export const HEADER_MM = 9;
/** Поля внутри карточки, мм. */
export const CELL_PAD_MM = 2.5;
/** Строка кода задачи внизу карточки, мм. */
export const CODE_ROW_MM = 2.8;
/** Зазор между текстом и чертежом, мм. */
export const GAP_MM = 3;
/** Меньше этого чертёж не ставится — лучше уменьшить кегль. */
export const MIN_DRAWING_MM = 14;

/**
 * Раскладки листа. textMm — кегль условия: чем крупнее карточка, тем крупнее
 * текст (решение — один размер на лист, учитель поправляет S/M/L).
 */
export const CARD_LAYOUTS = [
  { id: 'a5-6', label: 'A5 · 6 (2×3)', page: 'A5', cols: 2, rows: 3, textMm: 3.1 },
  { id: 'a5-4', label: 'A5 · 4 (2×2)', page: 'A5', cols: 2, rows: 2, textMm: 3.4 },
  { id: 'a5-2', label: 'A5 · 2 (1×2)', page: 'A5', cols: 1, rows: 2, textMm: 3.8 },
  { id: 'a4-9', label: 'A4 · 9 (3×3)', page: 'A4', cols: 3, rows: 3, textMm: 3.1 },
  { id: 'a4-8', label: 'A4 · 8 (2×4)', page: 'A4', cols: 2, rows: 4, textMm: 3.4 },
  { id: 'a4-6', label: 'A4 · 6 (2×3)', page: 'A4', cols: 2, rows: 3, textMm: 3.7 },
  { id: 'a4-4', label: 'A4 · 4 (2×2)', page: 'A4', cols: 2, rows: 2, textMm: 4 },
];
export const DEFAULT_CARD_LAYOUT = 'a5-6';

export const TEXT_SIZES = [
  { value: 's', label: 'S', k: 0.88 },
  { value: 'm', label: 'M', k: 1 },
  { value: 'l', label: 'L', k: 1.14 },
];

/** Формулы KaTeX в карточке — 1.04em от текста (как в листе задач). */
export const KATEX_EM = 1.04;

export const cardLayoutById = (id) => CARD_LAYOUTS.find((l) => l.id === id) || CARD_LAYOUTS[0];

/** Кегль условия, мм. */
export function cardTextMm(layout, textSize = 'm') {
  const k = TEXT_SIZES.find((s) => s.value === textSize)?.k || 1;
  return Math.round(layout.textMm * k * 100) / 100;
}

/**
 * Размеры карточки, мм: cell — вся ячейка, content — место под текст и
 * чертёж (без полей карточки и строки кода).
 */
export function cardSizeMm(layout, { header = true, code = true } = {}) {
  const page = PAGE_MM[layout.page] || PAGE_MM.A5;
  const cellW = (page.w - 2 * SHEET_PAD_MM) / layout.cols;
  const cellH = (page.h - 2 * SHEET_PAD_MM - (header ? HEADER_MM : 0)) / layout.rows;
  return {
    page,
    cell: { w: cellW, h: cellH },
    content: {
      w: cellW - 2 * CELL_PAD_MM,
      h: cellH - 2 * CELL_PAD_MM - (code ? CODE_ROW_MM : 0),
    },
  };
}

/** Клетка 5 мм под ячейку — линий ровно столько, сколько помещается. */
export function cardGridLines(cell, step = 5) {
  return { v: Math.max(0, Math.floor(cell.w / step - 1e-9)), h: Math.max(0, Math.floor(cell.h / step - 1e-9)) };
}

// --- где текст, где чертёж -----------------------------------------------------

/** auto — выбирает карточка; top — текст сверху; left/right — текст колонкой. */
export const CARD_PLACES = ['auto', 'top', 'left', 'right'];

/** Доли ширины под колонку текста, которые пробуются в раскладке «сбоку». */
export const SIDE_SHARES = [0.4, 0.48, 0.56, 0.64];
/** Колонка текста уже этого не читается: слова рвутся, строки по слову. */
export const MIN_TEXT_COL_MM = 28;

const isPlace = (p) => CARD_PLACES.includes(p);

/**
 * Выбор учителя для карточки: макет работы главнее макета задачи. Старые
 * свободные макеты ({ image, text } до v3.9.304) выбора не содержат → «авто».
 *
 * @param {object} [workLayout] — structure.layouts[taskId] работы
 * @param {object|string} [taskLayout] — geometry_tasks.preview_layout
 */
export function resolveCardPlace(workLayout, taskLayout) {
  if (isPlace(workLayout?.place)) return workLayout.place;
  let t = taskLayout;
  if (typeof t === 'string') {
    try { t = JSON.parse(t); } catch { t = null; }
  }
  if (isPlace(t?.card?.place)) return t.card.place;
  return 'auto';
}

/** Чертёж вписывается в прямоугольник с сохранением пропорций (w / h). */
export const fitByAspect = (aspect) => (w, h) => {
  if (!(aspect > 0) || !(w > 0) || !(h > 0)) return null;
  return w / h > aspect ? { w: h * aspect, h } : { w, h: w / aspect };
};

/** Пропорции SVG по viewBox (или width/height); null — не разобрать. */
export function svgAspect(svg) {
  const tag = /<svg\b[^>]*>/i.exec(String(svg || ''))?.[0];
  if (!tag) return null;
  const vb = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  if (vb) {
    const [, , w, h] = vb.trim().split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) return w / h;
  }
  const w = parseFloat(/\swidth\s*=\s*["']([\d.]+)(px)?["']/i.exec(tag)?.[1]);
  const h = parseFloat(/\sheight\s*=\s*["']([\d.]+)(px)?["']/i.exec(tag)?.[1]);
  return w > 0 && h > 0 ? w / h : null;
}

const areaOf = (fit) => (fit ? fit.w * fit.h : 0);
// «Сверху» читается лучше колонки: сбоку чертёж должен выйти крупнее хотя бы
// на 15 % по площади.
const TOP_BONUS = 1 / 0.85;

/**
 * Раскладка карточки.
 *
 * @param {object} p
 * @param {number} p.W, p.H — место под текст и чертёж, мм
 * @param {(widthMm:number) => number} p.textHeight — высота условия при ширине, мм
 * @param {null | ((w:number, h:number) => {w:number,h:number}|null)} p.fitDrawing —
 *   размер чертежа в прямоугольнике w×h (null — чертежа нет)
 * @param {string} [p.place] — auto | top | left | right
 * @returns {{ place, textW, textH, box: {w,h} | null, fit, overflow: boolean, fontK: number }}
 *   box — место чертежа, fit — его размер; overflow — текст не влез ни в один
 *   вариант, fontK — во сколько раз уменьшить кегль, чтобы влез.
 */
export function chooseCardPlacement({ W, H, textHeight, fitDrawing, place = 'auto' }) {
  const hasDrawing = typeof fitDrawing === 'function';
  const fullH = textHeight(W);

  if (!hasDrawing) {
    const overflow = fullH > H + 0.3;
    return {
      place: 'top', textW: W, textH: fullH, box: null, fit: null, overflow,
      fontK: overflow ? shrinkK(fullH, H) : 1,
    };
  }

  const candidates = [];
  if (place === 'auto' || place === 'top') {
    const room = H - fullH - GAP_MM;
    if (room >= MIN_DRAWING_MM) {
      const box = { w: W, h: room };
      candidates.push({ place: 'top', textW: W, textH: fullH, box, fit: fitDrawing(box.w, box.h) });
    }
  }
  const sides = place === 'auto' ? ['left'] : place === 'left' || place === 'right' ? [place] : [];
  for (const side of sides) {
    for (const share of SIDE_SHARES) {
      const tw = W * share;
      const th = textHeight(tw);
      const dw = W - tw - GAP_MM;
      if (tw < MIN_TEXT_COL_MM || th > H + 0.3 || dw < MIN_DRAWING_MM) continue;
      const box = { w: dw, h: H };
      candidates.push({ place: side, textW: tw, textH: th, box, fit: fitDrawing(box.w, box.h) });
    }
  }

  if (candidates.length) {
    // Чертёж крупнее — лучше; «сверху» при близкой площади — привычнее
    // (текст читается первым, строки длиннее).
    const score = (c) => areaOf(c.fit) * (c.place === 'top' ? TOP_BONUS : 1);
    const best = candidates.reduce((a, c) => (score(c) > score(a) ? c : a));
    return { ...best, overflow: false, fontK: 1 };
  }

  // Ничего не влезло: текст сверху во всю ширину, чертёж — сколько останется,
  // и подсказка, во сколько раз уменьшить кегль, чтобы чертежу досталось
  // хотя бы 40 % высоты.
  const need = H * 0.6;
  const room = Math.max(0, H - fullH - GAP_MM);
  const box = room > 0 ? { w: W, h: room } : null;
  return {
    place: place === 'left' || place === 'right' ? place : 'top',
    textW: W,
    textH: fullH,
    box,
    fit: box ? fitDrawing(box.w, box.h) : null,
    overflow: true,
    fontK: shrinkK(fullH, need),
  };
}

/** Высота перенесённого текста растёт примерно как квадрат кегля. */
function shrinkK(have, want) {
  if (!(have > 0) || have <= want) return 1;
  return Math.max(0.7, Math.min(1, Math.sqrt(want / have) * 0.97));
}
