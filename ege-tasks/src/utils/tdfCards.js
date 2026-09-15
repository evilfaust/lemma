/**
 * ТДФ — лист карточек: A4 режется на равные карточки, карточка достаётся
 * ученику (опрос в парах, жеребьёвка у доски, работа по станциям).
 *
 * Чистый модуль: сетка, размеры и подгонка кегля считаются здесь и покрыты
 * тестами. Оформление — язык `print-sheet` (монохром, миллиметры, номер
 * квадратом 6.5 мм), как у карточек марафона.
 */

export const CARD_PAGE = { w: 210, h: 296 };   // 296, а не 297: округления печати
export const CARD_PAD = 8;                      // поля листа
export const CARD_GAP = 4;                      // зазор между карточками (полоса реза)
export const CARD_HEAD_MM = 7;                  // шапка карточки (номер + тип)
export const CARD_PADDING_MM = 4;               // внутренние поля карточки

/** Сколько карточек на листе → сетка. */
export const CARD_GRIDS = {
  1: { cols: 1, rows: 1 },
  2: { cols: 1, rows: 2 },
  4: { cols: 2, rows: 2 },
  6: { cols: 2, rows: 3 },
  8: { cols: 2, rows: 4 },
  9: { cols: 3, rows: 3 },
};

export const CARD_COUNTS = Object.keys(CARD_GRIDS).map(Number);

/** Кегль по умолчанию для плотности листа: на 9 карточках 14 pt — это обрезки. */
export const CARD_TEXT_PRESET = { 1: 18, 2: 16, 4: 13, 6: 11, 8: 10, 9: 9 };

export const CARD_MODES = ['question', 'both'];

export const TDF_CARDS_DEFAULTS = {
  count: 6,
  textSize: 11,
  mode: 'question',     // question — только вопрос; both — вопрос и ответ мелким
  font: 'sans',
  showFigure: true,
  showTitle: true,      // название набора мелким в шапке карточки
  showType: true,
};

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizeCardSettings(raw = {}) {
  const d = TDF_CARDS_DEFAULTS;
  const count = CARD_COUNTS.includes(Number(raw.count)) ? Number(raw.count) : d.count;
  const textSize = Number(raw.textSize);
  return {
    count,
    textSize: Number.isFinite(textSize) && textSize >= 7 && textSize <= 22
      ? textSize
      : (CARD_TEXT_PRESET[count] ?? d.textSize),
    mode: oneOf(raw.mode, CARD_MODES, d.mode),
    font: oneOf(raw.font, ['sans', 'serif'], d.font),
    showFigure: bool(raw.showFigure, d.showFigure),
    showTitle: bool(raw.showTitle, d.showTitle),
    showType: bool(raw.showType, d.showType),
  };
}

/** Смена плотности тянет за собой кегль пресета — иначе условия не влезают. */
export function applyCardCount(settings, count) {
  return normalizeCardSettings({ ...settings, count, textSize: CARD_TEXT_PRESET[count] });
}

const LS_KEY = 'tdf.cardSettings';

export function readCardSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeCardSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...TDF_CARDS_DEFAULTS };
  }
}

export function writeCardSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch { /* приватное окно */ }
}

/** Размер одной карточки в миллиметрах. */
export function cardSizeMm(count) {
  const grid = CARD_GRIDS[count] || CARD_GRIDS[6];
  const usableW = CARD_PAGE.w - 2 * CARD_PAD - CARD_GAP * (grid.cols - 1);
  const usableH = CARD_PAGE.h - 2 * CARD_PAD - CARD_GAP * (grid.rows - 1);
  return {
    wMm: usableW / grid.cols,
    hMm: usableH / grid.rows,
    cols: grid.cols,
    rows: grid.rows,
  };
}

/** Зона содержимого карточки (без шапки и внутренних полей). */
export function cardContentMm(count) {
  const { wMm, hMm } = cardSizeMm(count);
  return {
    wMm: wMm - 2 * CARD_PADDING_MM,
    hMm: hMm - CARD_HEAD_MM - 2 * CARD_PADDING_MM,
  };
}

/** Человеческая подпись формата: «A6 99 × 140 мм». */
export function cardFormatLabel(count) {
  const { wMm, hMm } = cardSizeMm(count);
  return `${Math.round(wMm)} × ${Math.round(hMm)} мм`;
}

/** Разбивает карточки по листам в порядке набора. */
export function paginateCards(items, count) {
  if (!items.length) return [];
  const pages = [];
  for (let i = 0; i < items.length; i += count) pages.push(items.slice(i, i + count));
  return pages;
}

/**
 * Дополняет последний лист пустыми местами, чтобы сетка не разъезжалась:
 * возвращает массив длиной ровно `count` (пустые места — null).
 */
export function fillPage(pageItems, count) {
  const out = [...pageItems];
  while (out.length < count) out.push(null);
  return out;
}
