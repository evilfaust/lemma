/**
 * ТДФ — ведомость устного опроса: бумажный бланк «ученик × пункт», который
 * учитель заполняет прямо на уроке (спросил — поставил отметку).
 *
 * Чистый модуль (без React и DOM): страницы, ширины колонок и высоты строк
 * считаются здесь и покрыты тестами. Оформление — язык движка `print-sheet`
 * (монохром, миллиметры, волосяные линейки), как у бланка рейтинга марафона.
 */

export const ROSTER_PAGE = {
  landscape: { w: 297, h: 209 },
  portrait:  { w: 210, h: 296 },
};

export const ROSTER_PAD = { x: 8, top: 7, bottom: 6 };

/** Высота блока заголовка листа и блока расшифровки номеров. */
export const TITLE_MM = 12;
export const LEGEND_ROW_MM = 4.2;
/** Расшифровка печатается в две колонки: в одну она на 20 пунктах съедала
 *  пол-листа, и бланк рвался на лишние страницы. */
export const LEGEND_COLS = 2;

/** Сколько строк займёт расшифровка номеров для n пунктов. */
export function legendRowCount(n) {
  return Math.ceil(Math.max(0, n) / LEGEND_COLS);
}

/** Колонка пункта уже этого не станет — в неё не поставить отметку. */
export const MIN_COL_MM = 7;
/** Строка ниже этого не станет — в ней не написать фамилию. */
export const MIN_ROW_MM = 7;
/** Выше этого строку не растягиваем: пустой бланк не должен выглядеть таблицей для великанов. */
export const MAX_ROW_MM = 14;

export const ROSTER_DEFAULTS = {
  orientation: 'landscape',
  nameColMm: 46,        // ширина колонки «Ученик»
  extraRows: 4,         // пустые строки — вписать тех, кого нет в списке
  showTotal: true,      // колонка «Итого»
  showMark: true,       // колонка «Оценка»
  showLegend: true,     // расшифровка номеров под таблицей
  showIndex: true,      // колонка «№» перед фамилией
  zebra: true,          // подсветка каждой второй строки
};

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function normalizeRosterSettings(raw = {}) {
  const d = ROSTER_DEFAULTS;
  return {
    orientation: raw.orientation === 'portrait' ? 'portrait' : 'landscape',
    nameColMm: clamp(raw.nameColMm, 28, 80, d.nameColMm),
    extraRows: clamp(raw.extraRows, 0, 12, d.extraRows),
    showTotal: bool(raw.showTotal, d.showTotal),
    showMark: bool(raw.showMark, d.showMark),
    showLegend: bool(raw.showLegend, d.showLegend),
    showIndex: bool(raw.showIndex, d.showIndex),
    zebra: bool(raw.zebra, d.zebra),
  };
}

const LS_KEY = 'tdf.rosterSettings';

export function readRosterSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeRosterSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...ROSTER_DEFAULTS };
  }
}

export function writeRosterSettings(settings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch { /* приватное окно */ }
}

export const INDEX_COL_MM = 7;
export const TOTAL_COL_MM = 12;
export const MARK_COL_MM = 12;

/** Ширина, которая остаётся колонкам пунктов. */
export function tasksAreaMm(settings) {
  const { w } = ROSTER_PAGE[settings.orientation];
  let area = w - 2 * ROSTER_PAD.x - settings.nameColMm;
  if (settings.showIndex) area -= INDEX_COL_MM;
  if (settings.showTotal) area -= TOTAL_COL_MM;
  if (settings.showMark) area -= MARK_COL_MM;
  return area;
}

/** Сколько пунктов помещается по ширине одного листа. */
export function colsPerPage(settings) {
  return Math.max(1, Math.floor(tasksAreaMm(settings) / MIN_COL_MM));
}

/**
 * Высота, доступная строкам: лист минус поля, заголовок, шапка таблицы и
 * расшифровка номеров (её высота зависит от числа пунктов на листе).
 */
export function rowsAreaMm(settings, legendRows = 0) {
  const { h } = ROSTER_PAGE[settings.orientation];
  const legendMm = settings.showLegend ? legendRows * LEGEND_ROW_MM + 3 : 0;
  return h - ROSTER_PAD.top - ROSTER_PAD.bottom - TITLE_MM - HEAD_ROW_MM - legendMm;
}

/** Высота шапки таблицы (номера пунктов вертикально не пишем — только цифры). */
export const HEAD_ROW_MM = 9;

/**
 * План бланка: страницы «блок учеников × блок пунктов».
 *
 * Строки растягиваются на высоту листа, но не выше MAX_ROW_MM — иначе бланк
 * на шесть фамилий превращается в таблицу с полями в сантиметр.
 */
export function planRoster(rowCount, itemCount, settings) {
  const s = normalizeRosterSettings(settings);
  const cols = colsPerPage(s);
  const colBlocks = [];
  for (let from = 0; from < Math.max(itemCount, 1); from += cols) {
    colBlocks.push({ from, to: Math.min(from + cols, itemCount) });
  }
  if (!colBlocks.length) colBlocks.push({ from: 0, to: 0 });

  const totalRows = Math.max(1, rowCount + s.extraRows);

  const pages = [];
  for (const block of colBlocks) {
    const legendRows = s.showLegend ? legendRowCount(block.to - block.from) : 0;
    const area = rowsAreaMm(s, legendRows);
    const perPage = Math.max(1, Math.floor(area / MIN_ROW_MM));
    for (let from = 0; from < totalRows; from += perPage) {
      const to = Math.min(from + perPage, totalRows);
      const rows = to - from;
      pages.push({
        rowFrom: from,
        rowTo: to,
        colFrom: block.from,
        colTo: block.to,
        rowMm: Math.min(MAX_ROW_MM, area / rows),
        colMm: (block.to - block.from) > 0
          ? tasksAreaMm(s) / (block.to - block.from)
          : tasksAreaMm(s),
        // «Итого» имеет смысл только там, где закончились все пункты.
        showTotal: s.showTotal && block.to === itemCount,
        showMark: s.showMark && block.to === itemCount,
        legendRows,
      });
    }
  }
  return pages;
}

/** Короткая подпись пункта для расшифровки под таблицей. */
export function legendLabel(item, maxLen = 60) {
  const name = (item?.name || '').trim() || '—';
  return name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name;
}
