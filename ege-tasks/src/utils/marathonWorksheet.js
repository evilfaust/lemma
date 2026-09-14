// Геометрия и настройки отрезного листа марафона.
//
// Лист A4 делится на N равных слотов, между слотами — линия разреза: каждый
// блок вырезается и достаётся ученику. Раскладка своя (движок print-sheet так
// не умеет), оформление — общее с ним: монохром, миллиметры, четыре толщины
// линеек.
//
// 🚨 Высоты считаются ЗДЕСЬ и приходят в вёрстку inline. Клетку нельзя рисовать
// «с запасом, лишнее клипуется»: overflow прячет показ, но Chrome включает
// абсолютные линии в расчёт печатной области и ужимает лист до ~65%
// (memory print_grid_overshoot). Поэтому область условия фиксированной высоты,
// а не max-height: тогда высота клетки известна заранее и линии считаются точно.

export const PAGE_MM = { w: 210, h: 297, pad: 4 };

/** Полоса разреза между слотами. */
export const CUT_MM = 5;
/** Шапка блока: поле ФИ и клетки попыток. */
export const HEAD_MM = 9.5;
/** Отступы внутри блока (условие) + рамки. */
export const BLOCK_PAD_MM = 1.5;

export const MIN_COND_MM = 10;
export const MAX_COND_MM = 48;
/** Доля высоты блока под условие в режиме с местом для решения. */
export const COND_SHARE = 0.28;

/** Пикселей в миллиметре (96 dpi). Продублировано из print-sheet/geometry.js:
 *  utils не должен зависеть от компонентов. */
export const MM_PX = 96 / 25.4;

/** Кегль условия — в пунктах, как на прочих печатных листах. */
export const FONT_PT_OPTIONS = [7, 8, 9, 10, 11, 12, 14, 16];

/** Миллиметров в пункте. */
export const PT_MM = 25.4 / 72;

/** Старые значения кегля (S/M/L) — на ближайший пункт новой шкалы. */
const LEGACY_FONT_PT = { s: 9, m: 10, l: 12 };

export const fontMmOf = (pt) => (Number(pt) || 9) * PT_MM;

/** Зазор от номера до условия и боковые отступы блока (см. CSS). */
export const NUM_GAP_MM = 3.5;
export const SIDE_PAD_MM = 2.5;

/**
 * Квадрат номера задачи — стандартный, как на прочих печатных листах
 * (`print-sheet`: 6.5 мм). От кегля условия не зависит: номер — часть
 * оформления листа, а не текста задачи, и должен читаться одинаково на всех
 * листах проекта.
 */
export const NUM_COL_MM = 6.5;


/** Сколько блоков на лист: с местом для решения и «просто карточки». */
export const WORK_COUNTS = [2, 3, 4, 5, 6];
export const CARD_COUNTS = [3, 4, 5, 6, 8, 10, 12];

export const MARATHON_WORKSHEET_MODES = ['work', 'card'];

/** Ширина полосы набора (лист минус поля). */
export const contentWidthMm = () => PAGE_MM.w - 2 * PAGE_MM.pad;

/** Ширина текста условия: полоса минус номер и боковые отступы блока.
 *  По ней меряется реальная высота условия — зона измерения обязана быть
 *  ровно такой ширины, иначе высота занижена и клетка съезжает. */
export const statementWidthMm = () =>
  contentWidthMm() - 2 * SIDE_PAD_MM - NUM_COL_MM - NUM_GAP_MM;

/** Высота одного блока: лист минус поля и полосы разреза, поделить на N. */
export function blockHeightMm(count) {
  const n = Math.max(1, Math.floor(count) || 1);
  const usable = PAGE_MM.h - 2 * PAGE_MM.pad - CUT_MM * (n - 1);
  return usable / n;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Раскладка блока по высоте.
 *
 * В режиме `card` места для решения нет — условие занимает блок целиком; в
 * `work` условию отдаётся фиксированная доля, остальное уходит под клетку.
 */
export function layoutBlock({ count, mode = 'work', showHeader = true } = {}) {
  const blockMm = blockHeightMm(count);
  const headMm = showHeader ? HEAD_MM : 0;
  const inner = blockMm - headMm - 2 * BLOCK_PAD_MM;

  if (mode === 'card') {
    return {
      blockMm,
      headMm,
      condMm: Math.max(0, inner),
      solutionMm: 0,
    };
  }

  const condMm = clamp(blockMm * COND_SHARE, MIN_COND_MM, MAX_COND_MM);
  const solutionMm = Math.max(0, inner - condMm);
  return { blockMm, headMm, condMm, solutionMm };
}

/**
 * Раскладка блока по ИЗМЕРЕННОЙ высоте условия.
 *
 * `layoutBlock` даёт долю «на глаз» — ею лист рисуется до первого замера. Как
 * только условия измерены, каждому блоку отдаётся ровно столько, сколько занял
 * его текст: короткому условию — меньше, а остаток уходит под решение. Поэтому
 * высота зоны решения у блоков на одном листе разная, и линии считаются для
 * каждого блока отдельно.
 *
 * @param {number} condContentMm — высота текста условия (без отступов блока);
 *   null/0 — замера ещё не было, берём долю по умолчанию.
 */
export function fitBlock({ count, mode = 'work', showHeader = true, condContentMm = null } = {}) {
  const base = layoutBlock({ count, mode, showHeader });
  if (mode === 'card' || !condContentMm) return base;

  const blockMm = base.blockMm;
  const inner = blockMm - base.headMm - 2 * BLOCK_PAD_MM;
  // Условию — его текст плюс отступы, но не больше половины блока: иначе
  // длинная задача съест всё место для решения.
  const wanted = condContentMm + 2 * BLOCK_PAD_MM;
  const condMm = clamp(wanted, MIN_COND_MM, Math.min(inner, blockMm * 0.5));
  return { blockMm, headMm: base.headMm, condMm, solutionMm: Math.max(0, inner - condMm) };
}

/**
 * Линии разлиновки — ТОЧНО под блок (та же арифметика, что в
 * print-sheet/SolutionFill): клетка 5 мм, линейка 8 мм.
 */
export function gridLines({ heightMm, widthMm, fill = 'grid' }) {
  if (fill === 'blank') return { h: 0, v: 0, step: 0 };
  if (fill === 'lines') {
    const step = 8;
    return { h: Math.max(0, Math.ceil(heightMm / step) - 1), v: 0, step };
  }
  return {
    h: Math.max(0, Math.ceil(heightMm / 5) - 1),
    v: Math.max(0, Math.ceil(widthMm / 5) - 1),
    step: 5,
  };
}

/* ── Лист ответов учителя ─────────────────────────────────────────────────── */

/**
 * Колонок в сетке листа ответов.
 *
 * Без чертежей карточка — это номер и ответ, и в ряд их помещается больше. Но
 * не сколько угодно: ответ неравенства («x ∈ (−∞; 2) ∪ (7; +∞)») в узкой
 * колонке ломается переносами, поэтому потолок — 4 колонки.
 */
export function answerSheetColumns(taskCount, withFigures = true) {
  const n = Math.max(1, Math.floor(taskCount) || 1);
  if (withFigures) return n <= 6 ? 2 : n <= 12 ? 3 : n <= 20 ? 4 : 5;
  return n <= 8 ? 2 : n <= 24 ? 3 : 4;
}

/** Есть ли у задач марафона чертежи (по ним лист ответов решает, показывать ли
 *  колонку с картинкой: на неравенствах она пустая).
 *  🚨 Условие то же, что в `api.getTaskImageUrl`, иначе детектор разойдётся с
 *  тем, что реально рисуется. */
export const hasAnyFigure = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : []).some(t => !!(t?.image_url || t?.image));

/* ── Заполнение листа: «целые» листы вместо пустого хвоста ────────────────── */

// Марафон печатается пачкой на весь класс, и лист, наполовину пустой, — это
// выброшенная бумага. Два способа добить (включаются отдельно):
//   'repeat' — повторять весь набор задач подряд, пока пачка не закончится
//              ровно на краю листа (17 задач по 8 на лист → 17 листов, по 8
//              копий каждой задачи: поровну и без пустых мест);
//   'copies' — учитель говорит, сколько копий каждой задачи нужно (по числу
//              участников), а хвост добивается повтором до целого листа.
export const FILL_MODES = ['none', 'repeat', 'copies'];

/** Потолок пачки: 120 листов. Дальше это не печать, а заклинивший принтер. */
export const MAX_SHEETS = 120;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const lcm = (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0);

/**
 * Сколько карточек печатать, чтобы листы вышли целыми.
 * Возвращает число позиций (не задач) — с учётом потолка MAX_SHEETS.
 */
export function fillSlots({ taskCount, count, fill = 'none', copies = 1 }) {
  const n = Math.max(1, Math.floor(count) || 1);
  const len = Math.max(0, Math.floor(taskCount) || 0);
  if (!len) return 0;

  const cap = MAX_SHEETS * n;
  if (fill === 'repeat') return Math.min(lcm(len, n), cap);
  if (fill === 'copies') {
    const k = Math.max(1, Math.floor(copies) || 1);
    return Math.min(Math.ceil((len * k) / n) * n, cap);
  }
  return Math.min(len, cap);
}

/**
 * Позиции листа: задача + её НОМЕР В ИСХОДНОМ СПИСКЕ.
 *
 * 🚨 Номер печатается тот же, что у задачи в марафоне (трекер, карточки, лист
 * учителя), а не порядковый номер позиции: иначе на 17 листах номера дошли бы
 * до 136 и перестали совпадать с тем, что видит учитель в трекере.
 */
export function expandTasks(tasks = [], { fill = 'none', copies = 1, count = 1 } = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const slots = fillSlots({ taskCount: list.length, count, fill, copies });
  return Array.from({ length: slots }, (_, i) => ({
    task: list[i % list.length],
    no: (i % list.length) + 1,
    key: `${list[i % list.length]?.id || i}-${Math.floor(i / list.length)}`,
  }));
}

/** Сводка для панели настроек: сколько карточек, листов и копий выйдет. */
export function fillSummary({ taskCount, count, fill = 'none', copies = 1 }) {
  const n = Math.max(1, Math.floor(count) || 1);
  const slots = fillSlots({ taskCount, count: n, fill, copies });
  const sheets = Math.ceil(slots / n);
  const full = taskCount > 0 && slots % taskCount === 0;
  return {
    slots,
    sheets,
    // Сколько раз пройден весь набор (целое — только когда набор уложился ровно)
    copiesEach: taskCount > 0 ? slots / taskCount : 0,
    even: full,
    empty: Math.max(0, sheets * n - slots),
    capped: slots >= MAX_SHEETS * n,
  };
}

/** Разбивка задач по листам: по `count` блоков на лист, порядок сохраняется. */
export function paginateBlocks(tasks = [], count = 3) {
  const n = Math.max(1, Math.floor(count) || 1);
  const pages = [];
  for (let i = 0; i < tasks.length; i += n) {
    pages.push({ tasks: tasks.slice(i, i + n), startIndex: i });
  }
  return pages;
}

// ── Настройки листа ────────────────────────────────────────────────────────

export const DEFAULT_MARATHON_WORKSHEET_SETTINGS = {
  // 'work' — с местом для решения (клетка), 'card' — только условие
  mode: 'work',
  count: 3,
  attempts: 2,        // клетки попыток, 0–6
  fill: 'none',       // добивка листа: none | repeat | copies
  copies: 20,         // для fill='copies' — копий каждой задачи
  showName: true,     // поле ФИ в шапке блока
  textSize: 9,   // пункты
  drawingSize: 'm',
  solutionFill: 'grid',
  fontFamily: 'serif',
  showTaskCode: false,
};

// Смена режима тянет пресет: у «карточки» другая плотность, и место для
// решения ей не нужно — иначе настройка прошлого режима печаталась бы втихую.
export const MARATHON_WORKSHEET_PRESETS = {
  work: { count: 3, attempts: 2, showName: true },
  card: { count: 5, attempts: 0, showName: false },
};

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

export function countsFor(mode) {
  return mode === 'card' ? CARD_COUNTS : WORK_COUNTS;
}

export function normalizeMarathonWorksheetSettings(settings = {}) {
  const d = DEFAULT_MARATHON_WORKSHEET_SETTINGS;
  const next = { ...d, ...(settings || {}) };

  next.mode = oneOf(next.mode, MARATHON_WORKSHEET_MODES, d.mode);
  // Кегль: старые 's'/'m'/'l' переводим в пункты, чужое число — в ближайшее
  // значение шкалы (настройка учителя не должна молча слетать в дефолт).
  const legacy = LEGACY_FONT_PT[next.textSize];
  const pt = legacy ?? Number(next.textSize);
  next.textSize = Number.isFinite(pt) && pt > 0
    ? FONT_PT_OPTIONS.reduce((best, v) => (Math.abs(v - pt) < Math.abs(best - pt) ? v : best), FONT_PT_OPTIONS[0])
    : d.textSize;
  next.drawingSize = oneOf(next.drawingSize, ['s', 'm', 'l', 'xl'], d.drawingSize);
  next.solutionFill = oneOf(next.solutionFill, ['blank', 'lines', 'grid'], d.solutionFill);
  next.fontFamily = oneOf(next.fontFamily, ['sans', 'serif'], d.fontFamily);

  const counts = countsFor(next.mode);
  const count = Math.round(Number(next.count));
  next.count = counts.includes(count) ? count : MARATHON_WORKSHEET_PRESETS[next.mode].count;

  const attempts = Math.floor(Number(next.attempts));
  next.attempts = attempts >= 0 && attempts <= 6 ? attempts : 0;

  next.fill = oneOf(next.fill, FILL_MODES, d.fill);
  const copies = Math.floor(Number(next.copies));
  next.copies = copies >= 1 && copies <= 200 ? copies : d.copies;

  next.showName = !!next.showName;
  next.showTaskCode = !!next.showTaskCode;

  return next;
}

export function applyMarathonWorksheetMode(settings, mode) {
  const next = oneOf(mode, MARATHON_WORKSHEET_MODES, 'work');
  return normalizeMarathonWorksheetSettings({
    ...settings,
    ...MARATHON_WORKSHEET_PRESETS[next],
    mode: next,
  });
}
