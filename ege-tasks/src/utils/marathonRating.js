// Геометрия и настройки бумажного бланка рейтинга марафона.
//
// Бланк — форма, которую учитель заполняет руками во время урока: строки
// ученики, столбцы задачи, в клетке — квадратики попыток (те же, что в шапке
// блока отрезного листа). Поэтому всё считается от листа: колонки растягиваются
// на всю полосу набора, строки — на всю высоту, а что не влезло, уезжает на
// следующую страницу вместе с повторённой шапкой.
//
// 🚨 Размеры приходят в вёрстку inline. Таблица на глазок («width: 100%,
// разберётся сама») ломается уже на 17 задачах: Chrome ужимает колонки до
// нечитаемых 4 мм или выдавливает лист за край.

/** Лист: альбомный (по умолчанию) и книжный — для марафонов на 8-10 задач. */
export const RATING_PAGE = {
  landscape: { w: 297, h: 209 },   // не 210: округления печати выдавливают пустую страницу
  portrait: { w: 210, h: 296 },
};

export const RATING_PAD = { x: 8, top: 8, bottom: 6 };

/** Колонки бланка. */
export const INDEX_COL_MM = 7;
export const NAME_COL_MM = 42;
export const NAME_COL_MIN_MM = 30;
export const TOTAL_COL_MM = 16;
export const SCORE_COL_MM = 7;

/** Строки и шапка таблицы. */
export const HEAD_ROW_MM = 9;
export const MIN_ROW_MM = 7;
export const MAX_ROW_MM = 12;

/** Шапка листа: заголовок с метаданными и полоса легенды. */
export const TITLE_MM = 11;
export const LEGEND_MM = 9;

/**
 * Квадратик попытки. Размер не фиксирован: сначала на лист укладываются ВСЕ
 * задачи, а потом квадратики ужимаются под получившуюся колонку. Фиксированные
 * 3.4 мм гнали марафон на 17 задач на второй лист ради двух миллиметров.
 */
export const MARK_MAX_MM = 3.4;
export const MARK_MIN_MM = 2.4;
export const MARK_GAP_MM = 0.9;
export const CELL_PAD_MM = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : d);

/** Полоса набора листа. */
export function ratingContentMm(orientation = 'landscape') {
  const page = RATING_PAGE[orientation] || RATING_PAGE.landscape;
  return {
    wMm: page.w - 2 * RATING_PAD.x,
    hMm: page.h - RATING_PAD.top - RATING_PAD.bottom,
  };
}

/** Минимальная ширина колонки задачи: квадратики в самом мелком размере. */
export function minTaskColMm(attempts = 3, showScore = false) {
  const n = Math.max(1, int(attempts, 3));
  const marks = n * MARK_MIN_MM + (n - 1) * MARK_GAP_MM + 2 * CELL_PAD_MM;
  return marks + (showScore ? SCORE_COL_MM : 0);
}

/** Размер квадратика под получившуюся колонку. */
export function markSizeMm(taskColMm, attempts = 3, showScore = false) {
  const n = Math.max(1, int(attempts, 3));
  const avail = taskColMm - 2 * CELL_PAD_MM - (showScore ? SCORE_COL_MM : 0) - (n - 1) * MARK_GAP_MM;
  return clamp(avail / n, MARK_MIN_MM, MARK_MAX_MM);
}

/** Баллы за успех с i-й попытки: с первой — максимум, дальше по убыванию. */
export const scoreForAttempt = (attempt, attempts = 3) => Math.max(0, attempts + 1 - attempt);

/** Максимум за бланк. */
export const ratingMaxScore = (taskCount, attempts = 3) =>
  Math.max(0, int(taskCount)) * Math.max(1, int(attempts, 3));

/**
 * Сколько задач влезает в одну страницу по ширине.
 * `withTotal` — на странице есть колонка «Итого» (она стоит только на последней).
 */
export function tasksPerPage({
  orientation = 'landscape', attempts = 3, showScore = false, showIndex = true,
  nameMm = NAME_COL_MM, withTotal = true,
} = {}) {
  const { wMm } = ratingContentMm(orientation);
  const fixed = (showIndex ? INDEX_COL_MM : 0) + nameMm + (withTotal ? TOTAL_COL_MM : 0);
  return Math.max(1, Math.floor((wMm - fixed) / minTaskColMm(attempts, showScore)));
}

/** Сколько строк-учеников влезает по высоте. */
export function rowsPerPage({ orientation = 'landscape', showLegend = true } = {}) {
  const { hMm } = ratingContentMm(orientation);
  const body = hMm - TITLE_MM - (showLegend ? LEGEND_MM : 0) - HEAD_ROW_MM;
  return Math.max(1, Math.floor(body / MIN_ROW_MM));
}

/**
 * Раскладка бланка: страницы «блок учеников × блок задач».
 *
 * Внешний цикл — ученики (лист на класс читается сверху вниз), внутренний —
 * задачи. Колонка «Итого» живёт только на последней странице блока задач:
 * промежуточная сумма по половине задач бессмысленна и только ест ширину.
 */
export function planRating({ studentCount = 0, taskCount = 0, settings = {} } = {}) {
  const s = normalizeRatingSettings(settings);
  const rows = Math.max(0, int(studentCount)) + s.extraRows;
  const tasks = Math.max(0, int(taskCount));
  if (!rows || !tasks) return { pages: [], rowsPerSheet: 0, tasksPerSheet: 0 };

  const { wMm, hMm } = ratingContentMm(s.orientation);
  const rowsCap = rowsPerPage({ orientation: s.orientation, showLegend: s.showLegend });
  const tasksCap = tasksPerPage({
    orientation: s.orientation,
    attempts: s.attempts,
    showScore: s.showScore,
    showIndex: s.showIndex,
    nameMm: s.nameMm,
    withTotal: true,
  });

  const rowBlocks = [];
  for (let i = 0; i < rows; i += rowsCap) rowBlocks.push([i, Math.min(rows, i + rowsCap)]);

  const taskBlocks = [];
  for (let i = 0; i < tasks; i += tasksCap) taskBlocks.push([i, Math.min(tasks, i + tasksCap)]);

  const bodyMm = hMm - TITLE_MM - (s.showLegend ? LEGEND_MM : 0) - HEAD_ROW_MM;

  const pages = [];
  rowBlocks.forEach(([rowFrom, rowTo]) => {
    taskBlocks.forEach(([taskFrom, taskTo], blockIdx) => {
      const withTotal = blockIdx === taskBlocks.length - 1;
      const onPage = taskTo - taskFrom;
      const fixed = (s.showIndex ? INDEX_COL_MM : 0) + s.nameMm + (withTotal ? TOTAL_COL_MM : 0);
      const rowsOnPage = rowTo - rowFrom;
      const taskColMm = (wMm - fixed) / onPage;
      pages.push({
        rowFrom,
        rowTo,
        taskFrom,
        taskTo,
        withTotal,
        indexMm: s.showIndex ? INDEX_COL_MM : 0,
        nameMm: s.nameMm,
        totalMm: withTotal ? TOTAL_COL_MM : 0,
        // Колонки растягиваются на всю полосу набора: полупустой бланк
        // выглядит браком печати, а не «осталось место».
        taskColMm,
        markMm: markSizeMm(taskColMm, s.attempts, s.showScore),
        scoreMm: s.showScore ? SCORE_COL_MM : 0,
        rowMm: clamp(bodyMm / rowsOnPage, MIN_ROW_MM, MAX_ROW_MM),
        // Тянуть ли строки до низа листа: на неполной последней странице
        // строка высотой в треть листа читается как ошибка.
        bodyMm,
      });
    });
  });

  return { pages, rowsPerSheet: rowsCap, tasksPerSheet: tasksCap };
}

// ── Настройки ──────────────────────────────────────────────────────────────

export const RATING_SETTINGS_KEY = 'marathon.ratingSettings';

export const DEFAULT_MARATHON_RATING_SETTINGS = {
  orientation: 'landscape',
  attempts: 3,        // квадратиков попыток в клетке
  showScore: false,   // отдельная клетка под баллы за задачу
  showIndex: true,    // колонка № строки
  showLegend: true,
  zebra: true,        // подсветка каждой второй строки
  extraRows: 2,       // пустые строки — дописать пришедших
  nameMm: NAME_COL_MM,
};

const oneOf = (v, list, d) => (list.includes(v) ? v : d);

export function normalizeRatingSettings(settings = {}) {
  const d = DEFAULT_MARATHON_RATING_SETTINGS;
  const next = { ...d, ...(settings || {}) };

  next.orientation = oneOf(next.orientation, ['landscape', 'portrait'], d.orientation);

  const attempts = int(next.attempts, d.attempts);
  next.attempts = clamp(attempts, 2, 5);

  const extra = int(next.extraRows, d.extraRows);
  next.extraRows = clamp(extra, 0, 20);

  const name = Number(next.nameMm);
  next.nameMm = Number.isFinite(name) ? clamp(name, NAME_COL_MIN_MM, 70) : d.nameMm;

  ['showScore', 'showIndex', 'showLegend', 'zebra'].forEach((k) => { next[k] = !!next[k]; });

  return next;
}

export function readRatingSettings() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(RATING_SETTINGS_KEY);
    return raw
      ? normalizeRatingSettings(JSON.parse(raw))
      : { ...DEFAULT_MARATHON_RATING_SETTINGS };
  } catch {
    return { ...DEFAULT_MARATHON_RATING_SETTINGS };
  }
}

export function writeRatingSettings(settings) {
  try {
    localStorage.setItem(RATING_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* приватный режим */ }
}
