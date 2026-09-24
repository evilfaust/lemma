// Карточки «Генератора» — несколько одинаковых работ на одном листе A4.
//
// Философия режима — экономия бумаги: короткую самостоятельную (5–10 задач) нет
// смысла печатать на целом листе, поэтому A4 режется на равные карточки, и на
// каждой — вся работа целиком: шапка, задачи, поле ответа. Лист по умолчанию
// ДОБИВАЕТСЯ копиями (один вариант × 4 карточки, а не одна карточка и три
// пустых места), а на класс печатается ровно столько экземпляров, сколько нужно.
//
// Оформление — язык движка `print-sheet`: только чёрная краска, миллиметры,
// номер задачи квадратом, иерархия на кегле и толщине линеек. Раскладка своя:
// print-sheet пагинирует ОДНУ работу по страницам, здесь — наоборот, много
// работ на одной странице.
//
// Модуль без React и DOM — на нём висят юнит-тесты. Размеры приходят в вёрстку
// inline отсюда же: карточка обязана знать свою высоту заранее, иначе длинная
// работа растянет ячейку и сетка листа поедет.

/** Лист A4. Высота 296, а не 297: округления печати выдавливают пустую страницу. */
export const SHEET_W_MM = 210;
export const SHEET_H_MM = 296;

/** Поле по краю бумаги — туда принтер всё равно не печатает. */
export const SHEET_PAD_MM = 5;

/**
 * Отступ внутри карточки. Карточки стоят вплотную, линия реза идёт по их
 * границе — между текстами соседних карточек получается 2 × CARD_PAD_MM.
 */
export const CARD_PAD_MM = 4;

/** Квадрат номера задачи — верхний предел (CSS: clamp(3.6mm, 1.45em, 4.6mm)).
 *  Меньше стандартных 6.5 мм print-sheet: строка задачи на карточке — 4–5 мм,
 *  квадрат 6.5 мм раздувал бы её вдвое. А совсем жёсткий размер держал высоту
 *  строки, и подгонка кегля на плотной раскладке ничего не выигрывала. */
export const CARD_NUM_MM = 4.6;

export const MM_PX = 96 / 25.4;
export const PT_MM = 25.4 / 72;
export const fontMmOf = (pt) => (Number(pt) || 10) * PT_MM;

/**
 * Раскладки листа: сколько карточек и как они стоят.
 * Ключи строковые — у «2» две формы (поперёк и вдоль листа).
 */
export const CARD_LAYOUTS = {
  1: { cols: 1, rows: 1, count: 1, format: 'A4', hint: 'Одна работа на лист' },
  2: { cols: 1, rows: 2, count: 2, format: 'A5', hint: 'Половина листа, режется поперёк' },
  '2v': { cols: 2, rows: 1, count: 2, format: '½ вдоль', hint: 'Две высокие колонки, режется вдоль — для длинных списков коротких задач' },
  3: { cols: 1, rows: 3, count: 3, format: '⅓ полосой', hint: 'Три полосы во всю ширину' },
  4: { cols: 2, rows: 2, count: 4, format: 'A6', hint: 'Четвертинка листа' },
  6: { cols: 2, rows: 3, count: 6, format: '2 × 3', hint: 'Шесть карточек — для 4–6 коротких задач' },
  8: { cols: 2, rows: 4, count: 8, format: 'A7', hint: 'Восемь карточек — для 3–5 устных задач' },
};

/** Порядок в переключателе — по возрастанию плотности. */
export const CARD_LAYOUT_KEYS = ['1', '2', '2v', '3', '4', '6', '8'];

export const DEFAULT_LAYOUT = '4';

/** Прежние значения `cardFormat` старого режима «Карточки». */
const LEGACY_LAYOUT = { 'А6': '4', 'А5': '2', 'А4': '1', 'А4-2V': '2v', 'А4-3V': '2v' };

export const normalizeLayout = (key) => {
  const k = String(key ?? '');
  if (CARD_LAYOUTS[k]) return k;
  return LEGACY_LAYOUT[k] || DEFAULT_LAYOUT;
};

export const cardLayout = (key) => CARD_LAYOUTS[normalizeLayout(key)];

/** Размер одной карточки, мм. */
export function cardSizeMm(key) {
  const { cols, rows } = cardLayout(key);
  return {
    wMm: (SHEET_W_MM - 2 * SHEET_PAD_MM) / cols,
    hMm: (SHEET_H_MM - 2 * SHEET_PAD_MM) / rows,
  };
}

/** Полоса набора внутри карточки. */
export function cardInnerMm(key) {
  const { wMm, hMm } = cardSizeMm(key);
  return { wMm: wMm - 2 * CARD_PAD_MM, hMm: hMm - 2 * CARD_PAD_MM };
}

/** Подпись раскладки: «A6 · 100 × 143 мм». */
export function layoutLabel(key) {
  const { format } = cardLayout(key);
  const { wMm, hMm } = cardSizeMm(key);
  return `${format} · ${Math.round(wMm)} × ${Math.round(hMm)} мм`;
}

/**
 * Линии реза: по границам карточек, от края до края бумаги — так лист режется
 * резаком за один проход. Координаты в мм от левого верхнего угла листа.
 */
export function cutLines(key) {
  const { cols, rows } = cardLayout(key);
  const { wMm, hMm } = cardSizeMm(key);
  return {
    vertical: Array.from({ length: cols - 1 }, (_, i) => SHEET_PAD_MM + (i + 1) * wMm),
    horizontal: Array.from({ length: rows - 1 }, (_, i) => SHEET_PAD_MM + (i + 1) * hMm),
  };
}

/** Две колонки задач внутри карточки — только на широкой карточке. */
export const INNER_COLUMNS_MIN_W_MM = 140;
export const canSplitColumns = (key) => cardInnerMm(key).wMm >= INNER_COLUMNS_MIN_W_MM;

/** Ширина поля ответа справа от задачи: доля строки, в разумных пределах. */
export function answerWidthMm(key, innerColumns = 1) {
  const cols = innerColumns > 1 && canSplitColumns(key) ? 2 : 1;
  const colW = cardInnerMm(key).wMm / cols;
  return Math.round(Math.min(30, Math.max(14, colW * 0.2)) * 10) / 10;
}

// ── Кегль ──────────────────────────────────────────────────────────────────

export const FONT_PT_OPTIONS = [7, 8, 9, 10, 11, 12, 14];

/** Кегль по умолчанию для раскладки: на восьми карточках 12 pt не живёт. */
export const CARD_FONT_PRESET = { 1: 12, 2: 11, '2v': 10, 3: 10, 4: 10, 6: 9, 8: 8 };

/** Ниже этого подгонка кегль не опускает: дальше читать невозможно, и честнее
 *  сказать учителю, что работа на такую плотность не помещается. */
export const minFitPt = (basePt) => Math.max(6.5, Math.round((Number(basePt) || 10) * 0.65 * 2) / 2);

/**
 * Следующий кегль при подгонке работы под карточку.
 *
 * `overRatio` — во сколько раз содержимое больше карточки (высота содержимого /
 * высота зоны). Высота текста при уменьшении кегля падает примерно квадратично
 * (мельче и строки, и их число), отсюда √. Шаг — полпункта, и хотя бы полпункта
 * вниз за проход, иначе подгонка могла бы топтаться на месте.
 */
export function nextFitPt(currentPt, overRatio, minPt = 6.5) {
  const cur = Number(currentPt) || 10;
  if (!(overRatio > 1)) return cur;
  let next = Math.floor((cur / Math.sqrt(overRatio)) * 2) / 2;
  if (next >= cur) next = cur - 0.5;
  return Math.max(minPt, next);
}

// ── Экземпляры ─────────────────────────────────────────────────────────────

/**
 * Сколько карточек печатать:
 *   none  — по одной на вариант (последний лист может остаться неполным);
 *   sheet — добить до целого листа копиями (бумага всё равно уходит целиком);
 *   count — N экземпляров на класс, округление вверх до целого листа.
 */
export const FILL_MODES = ['none', 'sheet', 'count'];

/** Потолок, чтобы опечатка «300» вместо «30» не повесила вкладку. */
export const MAX_SHEETS = 60;

export function cardsTotal({ variantsCount, perSheet, fill = 'sheet', copies = 1 }) {
  const v = Math.max(0, Math.floor(variantsCount || 0));
  const per = Math.max(1, Math.floor(perSheet || 1));
  if (!v) return 0;
  let total = v;
  if (fill === 'sheet') total = Math.ceil(v / per) * per;
  if (fill === 'count') total = Math.ceil(Math.max(v, Math.floor(copies) || 1) / per) * per;
  return Math.min(total, MAX_SHEETS * per);
}

/**
 * Карточки по порядку: индекс варианта у каждой. Варианты чередуются по кругу —
 * соседние карточки листа достаются разным вариантам (за партой рядом сидят
 * разные варианты). `first` — первая карточка варианта: по ней меряется
 * подгонка кегля, копии свёрстаны одинаково.
 */
export function cardSlots({ variantsCount, perSheet, fill = 'sheet', copies = 1 }) {
  const total = cardsTotal({ variantsCount, perSheet, fill, copies });
  return Array.from({ length: total }, (_, i) => ({
    key: `c${i}`,
    variantIndex: i % variantsCount,
    copy: Math.floor(i / variantsCount) + 1,
    first: i < variantsCount,
  }));
}

/** Разбить карточки по листам. */
export function paginateCards(slots, perSheet) {
  const per = Math.max(1, perSheet || 1);
  const sheets = [];
  for (let i = 0; i < slots.length; i += per) sheets.push(slots.slice(i, i + per));
  return sheets;
}

/** Сводка для панели: «2 варианта × 14 = 28 карточек, 7 листов». */
export function cardsSummary({ variantsCount, layout, fill = 'sheet', copies = 1 }) {
  const per = cardLayout(layout).count;
  const cards = cardsTotal({ variantsCount, perSheet: per, fill, copies });
  const sheets = Math.ceil(cards / per);
  const v = Math.max(1, variantsCount || 1);
  return {
    perSheet: per,
    cards,
    sheets,
    emptySlots: sheets * per - cards,
    // На вариант: сколько экземпляров (у первых вариантов может быть на один больше).
    perVariantMax: Math.ceil(cards / v),
    perVariantMin: Math.floor(cards / v),
    spare: fill === 'count' ? Math.max(0, cards - Math.max(v, Math.floor(copies) || 1)) : 0,
  };
}

export const sheetsWord = (n) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'лист';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'листа';
  return 'листов';
};

// ── Настройки ──────────────────────────────────────────────────────────────

export const ANSWER_STYLES = ['none', 'line', 'box', 'strip'];

export const DEFAULT_CARD_SETTINGS = {
  layout: DEFAULT_LAYOUT,
  fill: 'sheet',
  copies: 30,
  fontPt: CARD_FONT_PRESET[DEFAULT_LAYOUT],
  fontFamily: 'sans',
  autoFit: true,          // подгонять кегль, если работа не влезает в карточку
  innerColumns: 1,        // задачи в две колонки (только широкая карточка)
  answerStyle: 'line',    // none | line — строка справа | box — рамка справа | strip — таблица внизу
  dividers: true,         // волосяная линия между задачами
  title: '',              // пусто → название работы
  showTitle: true,
  showStudentInfo: true,
  showClassField: false,
  showVariant: null,      // null = авто (надпись есть, когда вариантов больше одного)
  note: '',               // строка-инструкция под шапкой
  showFigures: true,
  figureSize: 's',
  hidePrefixes: false,
  showCode: false,
  answersOnCards: false,  // экземпляр учителя: ответы прямо в полях
  showKey: true,          // лист ответов последней страницей
  keySolutions: false,    // решения в листе ответов
};

/** Ключ localStorage: настройки карточек переживают перезагрузку. */
export const CARD_SETTINGS_KEY = 'generator.cardSettings';

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

export function normalizeCardSettings(settings = {}) {
  const d = DEFAULT_CARD_SETTINGS;
  const next = { ...d, ...(settings || {}) };

  next.layout = normalizeLayout(next.layout);
  next.fill = oneOf(next.fill, FILL_MODES, d.fill);

  const copies = Math.floor(Number(next.copies));
  next.copies = copies >= 1 && copies <= 500 ? copies : d.copies;

  // Кегль вне шкалы притягиваем к ближайшему, а не сбрасываем: настройка
  // учителя не должна молча слетать.
  const pt = Number(next.fontPt);
  next.fontPt = Number.isFinite(pt) && pt > 0
    ? FONT_PT_OPTIONS.reduce((best, v) => (Math.abs(v - pt) < Math.abs(best - pt) ? v : best), FONT_PT_OPTIONS[0])
    : d.fontPt;

  next.fontFamily = oneOf(next.fontFamily, ['sans', 'serif'], d.fontFamily);
  next.answerStyle = oneOf(next.answerStyle, ANSWER_STYLES, d.answerStyle);
  next.figureSize = oneOf(next.figureSize, ['s', 'm', 'l', 'xl'], d.figureSize);
  next.innerColumns = Number(next.innerColumns) === 2 && canSplitColumns(next.layout) ? 2 : 1;
  next.showVariant = next.showVariant == null ? null : !!next.showVariant;
  next.title = typeof next.title === 'string' ? next.title : '';
  next.note = typeof next.note === 'string' ? next.note : '';

  ['autoFit', 'dividers', 'showTitle', 'showStudentInfo', 'showClassField', 'showFigures',
    'hidePrefixes', 'showCode', 'answersOnCards', 'showKey', 'keySolutions']
    .forEach((k) => { next[k] = !!next[k]; });

  return next;
}

/**
 * Смена раскладки тянет кегль пресета (на восьми карточках 12 pt — это
 * обрезанные работы) и снимает две колонки там, где карточка для них узка.
 * Явный обработчик, чтобы настройка не менялась втихую.
 */
export function applyLayout(settings, layout) {
  const key = normalizeLayout(layout);
  return normalizeCardSettings({
    ...settings,
    layout: key,
    fontPt: CARD_FONT_PRESET[key] ?? DEFAULT_CARD_SETTINGS.fontPt,
  });
}

export function readCardSettings() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CARD_SETTINGS_KEY);
    return raw ? normalizeCardSettings(JSON.parse(raw)) : { ...DEFAULT_CARD_SETTINGS };
  } catch {
    return { ...DEFAULT_CARD_SETTINGS };
  }
}

export function writeCardSettings(settings) {
  try {
    localStorage.setItem(CARD_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* приватный режим */ }
}

/** Надпись «Вариант N» на карточке: решение учителя или авто-правило. */
export const variantVisible = (settings, variantsCount) => (
  settings.showVariant != null ? settings.showVariant : variantsCount > 1
);

/** Подпись режима для панели действий генератора. */
export function cardsModeLabel(settings, variantsCount) {
  const s = cardsSummary({
    variantsCount, layout: settings.layout, fill: settings.fill, copies: settings.copies,
  });
  return `${layoutLabel(settings.layout).split(' · ')[0]} · ${s.perSheet} на лист · ${s.cards} шт. · ${s.sheets} ${sheetsWord(s.sheets)}`;
}
