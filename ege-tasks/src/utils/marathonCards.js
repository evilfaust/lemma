// Геометрия и настройки листа карточек марафона.
//
// Лист A4 режется на равные карточки (2×3, 3×3, A6 и т.д.) — карточка достаётся
// ученику, он решает её в тетради и приносит на защиту. От отрезного рабочего
// листа (`marathonWorksheet.js`) отличается раскладкой: там блоки во всю ширину
// листа с местом для решения, здесь — плитка карточек одинакового размера.
//
// Оформление общее с движком `print-sheet`: монохром, миллиметры, номер задачи
// квадратом. Размеры считаются ЗДЕСЬ и приходят в вёрстку inline — карточка
// обязана знать свою высоту заранее, иначе длинное условие растянет ячейку и
// сетка листа поедет.

import { PAGE_MM, FONT_PT_OPTIONS, PT_MM, FILL_MODES, fontMmOf } from './marathonWorksheet';

/** Высота листа — 296, а не 297: округления печати выдавливают пустую страницу
 *  (та же константа, что у отрезного листа). */
export const CARD_SHEET_H_MM = 296;

/** Сколько карточек на листе A4 и как они стоят: [колонок, строк]. */
export const CARD_GRIDS = {
  1: [1, 1],
  2: [1, 2],
  3: [1, 3],
  4: [2, 2],
  6: [2, 3],
  8: [2, 4],
  9: [3, 3],
  12: [3, 4],
};

export const CARD_COUNTS = Object.keys(CARD_GRIDS).map(Number).sort((a, b) => a - b);

/** Ходовой формат для плотностей, у которых он есть. Остальным — «N × M». */
const CARD_FORMAT = { 1: 'A4', 2: 'A5', 4: 'A6', 8: 'A7' };

/** Зазор между карточками: по нему лист режется. */
export const CARD_GAP_MM = 4;
/** Отступы внутри карточки. */
export const CARD_PAD_MM = 3;
/** Шапка карточки (номер + название) и подвал (ответ / код). */
export const CARD_HEAD_MM = 8;
export const CARD_ANSWER_MM = 7;
export const CARD_CODE_MM = 4;

export { FONT_PT_OPTIONS, PT_MM, fontMmOf };

/** Раскладка листа под заданное число карточек. */
export function cardGrid(count) {
  const n = CARD_GRIDS[count] ? count : 6;
  const [cols, rows] = CARD_GRIDS[n];
  return { count: n, cols, rows };
}

/** Размер одной карточки в миллиметрах. */
export function cardSizeMm(count) {
  const { cols, rows } = cardGrid(count);
  const wMm = (PAGE_MM.w - 2 * PAGE_MM.pad - CARD_GAP_MM * (cols - 1)) / cols;
  const hMm = (CARD_SHEET_H_MM - 2 * PAGE_MM.pad - CARD_GAP_MM * (rows - 1)) / rows;
  return { wMm, hMm };
}

/** Подпись плотности для панели настроек: «A6 · 99 × 140 мм». */
export function cardFormatLabel(count) {
  const { cols, rows } = cardGrid(count);
  const { wMm, hMm } = cardSizeMm(count);
  const size = `${Math.round(wMm)} × ${Math.round(hMm)} мм`;
  return CARD_FORMAT[count] ? `${CARD_FORMAT[count]} · ${size}` : `${cols} × ${rows} · ${size}`;
}

/**
 * Зона условия внутри карточки — то, во что должен уложиться текст с чертежом.
 * Шапка, подвал и отступы вычитаются, потому что условие рисуется между ними.
 */
export function cardContentMm(count, { showHead = true, showAnswer = false, showCode = false } = {}) {
  const { wMm, hMm } = cardSizeMm(count);
  const head = showHead ? CARD_HEAD_MM : 0;
  // Ответ и код стоят в ОДНОЙ строке подвала, поэтому высоты не складываются:
  // иначе условию доставалось бы на 4 мм меньше, чем есть на самом деле.
  const foot = showAnswer ? CARD_ANSWER_MM : (showCode ? CARD_CODE_MM : 0);
  return {
    wMm: Math.max(10, wMm - 2 * CARD_PAD_MM),
    hMm: Math.max(6, hMm - head - foot - 2 * CARD_PAD_MM),
  };
}

/** Кегль по умолчанию для каждой плотности: на 12 карточках 12 pt не живёт. */
export const CARD_TEXT_PRESET = { 1: 14, 2: 12, 3: 12, 4: 11, 6: 10, 8: 9, 9: 9, 12: 8 };

/**
 * Подгонка кегля под карточку.
 *
 * Условия у задач разной длины, а карточка фиксированной высоты: без подгонки
 * длинное условие просто обрезалось бы рамкой. Уменьшаем кегль ровно настолько,
 * чтобы текст влез, но не мельче `minRatio` — дальше читать невозможно, и лучше
 * показать учителю, что задача на такую плотность не помещается.
 *
 * Высота текста при уменьшении кегля падает примерно квадратично (мельче и
 * строки, и их число), отсюда √ в коэффициенте.
 */
export function fitFontPt(basePt, { measuredMm, availMm, minRatio = 0.68 } = {}) {
  const pt = Number(basePt) || 10;
  if (!measuredMm || !availMm || measuredMm <= availMm) return pt;
  const ratio = Math.max(minRatio, Math.sqrt(availMm / measuredMm));
  return Math.round(pt * ratio * 10) / 10;
}

/** Влезает ли условие в карточку даже после подгонки кегля. */
export function cardOverflows({ measuredMm, availMm, basePt, minRatio = 0.68 }) {
  if (!measuredMm || !availMm) return false;
  const fitted = fitFontPt(basePt, { measuredMm, availMm, minRatio });
  const scale = fitted / (Number(basePt) || 10);
  return measuredMm * scale * scale > availMm * 1.02;
}

// ── Настройки ──────────────────────────────────────────────────────────────

/** Ключ localStorage: настройки листа переживают переход между вкладками. */
export const CARD_SETTINGS_KEY = 'marathon.cardSettings';

export const DEFAULT_MARATHON_CARD_SETTINGS = {
  count: 6,
  textSize: 10,        // пункты
  fontFamily: 'serif',
  drawingSize: 'm',
  showTitle: true,     // название марафона в шапке карточки
  showLogo: true,      // марка LEMMA в углу
  showCode: false,     // код задачи мелким в подвале
  showDifficulty: false,
  showAnswer: false,   // поле «Ответ» с линией внизу карточки
  autoFit: true,       // подгонять кегль под длинное условие
  fill: 'none',        // добивка листа: none | repeat | copies
  copies: 20,
};

const oneOf = (value, list, fallback) => (list.includes(value) ? value : fallback);

export function normalizeMarathonCardSettings(settings = {}) {
  const d = DEFAULT_MARATHON_CARD_SETTINGS;
  const next = { ...d, ...(settings || {}) };

  const count = Math.round(Number(next.count));
  next.count = CARD_COUNTS.includes(count) ? count : d.count;

  // Кегль вне шкалы притягиваем к ближайшему, а не сбрасываем в дефолт:
  // настройка учителя не должна молча слетать.
  const pt = Number(next.textSize);
  next.textSize = Number.isFinite(pt) && pt > 0
    ? FONT_PT_OPTIONS.reduce((best, v) => (Math.abs(v - pt) < Math.abs(best - pt) ? v : best), FONT_PT_OPTIONS[0])
    : d.textSize;

  next.fontFamily = oneOf(next.fontFamily, ['sans', 'serif'], d.fontFamily);
  next.drawingSize = oneOf(next.drawingSize, ['s', 'm', 'l', 'xl'], d.drawingSize);
  next.fill = oneOf(next.fill, FILL_MODES, d.fill);

  const copies = Math.floor(Number(next.copies));
  next.copies = copies >= 1 && copies <= 200 ? copies : d.copies;

  ['showTitle', 'showLogo', 'showCode', 'showDifficulty', 'showAnswer', 'autoFit']
    .forEach((k) => { next[k] = !!next[k]; });

  return next;
}

/**
 * Смена плотности тянет кегль пресета: на 12 карточках лист с 14 pt — это
 * обрезанные условия, а не лист. Явный обработчик, как у режимов отрезного
 * листа, чтобы настройка не менялась втихую.
 */
export function applyCardCount(settings, count) {
  const n = CARD_COUNTS.includes(Number(count)) ? Number(count) : DEFAULT_MARATHON_CARD_SETTINGS.count;
  return normalizeMarathonCardSettings({
    ...settings,
    count: n,
    textSize: CARD_TEXT_PRESET[n] ?? DEFAULT_MARATHON_CARD_SETTINGS.textSize,
  });
}

/** Настройки листа карточек из localStorage (общий читатель для листа и вкладки). */
export function readCardSettings() {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CARD_SETTINGS_KEY);
    return raw
      ? normalizeMarathonCardSettings(JSON.parse(raw))
      : { ...DEFAULT_MARATHON_CARD_SETTINGS };
  } catch {
    return { ...DEFAULT_MARATHON_CARD_SETTINGS };
  }
}

/** Сохранить настройки листа карточек. */
export function writeCardSettings(settings) {
  try {
    localStorage.setItem(CARD_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* приватный режим */ }
}
