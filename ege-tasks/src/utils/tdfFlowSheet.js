/**
 * ТДФ — «Лист»: пункты набора потоком на A4 книжном (как листок «Корень n-й
 * степени»: номер, название, под ним формулы, свойства, графики).
 *
 * Три вида одного листа:
 *   • etalon  — конспект целиком (вклеить в тетрадь, раздать после урока);
 *   • gaps    — с пропусками: помеченное учителем убрано (`utils/tdfMarkup.js`);
 *   • headers — только заголовки пунктов и место для записи, высота которого
 *               считается по эталону (ученику места столько же, сколько
 *               занимает сам ответ, × запас на почерк).
 *
 * Чистый модуль (без React и DOM) — под тестами `__tests__/tdfFlowSheet.test.js`.
 * 🚨 Поля и ширина листа продублированы в `TDFSheetFlow.css` (`--tdfs-*`).
 */

import { PAD, PAGE } from './tdfSheet';
import { tdfItemHasGaps } from './tdfMarkup';

export const FLOW_MODES = ['etalon', 'gaps', 'headers'];

export const FLOW_DEFAULTS = {
  mode: 'gaps',
  plainItems: 'full',     // пункт без пропусков в бланке: full — целиком, header — место для записи
  fill: 'grid',           // grid | lines | blank — разлиновка места для записи
  spaceFactor: 1.5,       // место для записи = высота эталона × множитель
  font: 'sans',           // sans | serif
  textPt: 12,
  drawingSize: 'm',       // ширина чертежа пункта (доля полосы набора)
  showFio: true,
  showFooter: true,
  showType: false,        // «Определение.», «Свойство.» перед названием
};

export const TEXT_PT_OPTIONS = [10, 11, 12, 13, 14];
export const SPACE_FACTORS = [1, 1.5, 2, 3];
export const FLOW_DRAWING_SHARE = { s: 0.25, m: 0.35, l: 0.45 };

/** Нижний и верхний потолок места для записи, мм. Шаг — клетка. */
export const SPACE_MIN_MM = 10;
export const SPACE_MAX_MM = 160;
export const CELL_MM = 5;

/** Колонтитул внизу листа, мм. */
export const FLOW_FOOT_MM = 7;

const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

export function normalizeFlowSettings(raw = {}) {
  const d = FLOW_DEFAULTS;
  return {
    mode: oneOf(raw.mode, FLOW_MODES, d.mode),
    plainItems: oneOf(raw.plainItems, ['full', 'header'], d.plainItems),
    fill: oneOf(raw.fill, ['grid', 'lines', 'blank'], d.fill),
    spaceFactor: oneOf(raw.spaceFactor, SPACE_FACTORS, d.spaceFactor),
    font: oneOf(raw.font, ['sans', 'serif'], d.font),
    textPt: oneOf(raw.textPt, TEXT_PT_OPTIONS, d.textPt),
    drawingSize: oneOf(raw.drawingSize, Object.keys(FLOW_DRAWING_SHARE), d.drawingSize),
    showFio: bool(raw.showFio, d.showFio),
    showFooter: bool(raw.showFooter, d.showFooter),
    showType: bool(raw.showType, d.showType),
  };
}

const LS_KEY = 'tdf.flowSettings';

export function readFlowSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return normalizeFlowSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...FLOW_DEFAULTS };
  }
}

export function writeFlowSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* приватное окно */ }
}

/** Лист всегда книжный — так устроены листки-конспекты. */
export const FLOW_PAGE = PAGE.portrait;

export function flowContentWidthMm() {
  return FLOW_PAGE.wMm - 2 * PAD.x;
}

export function flowContentHeightMm(settings) {
  const foot = settings?.showFooter ? FLOW_FOOT_MM : 0;
  return FLOW_PAGE.hMm - PAD.top - PAD.bottom - foot;
}

/**
 * Как печатается пункт в выбранном виде листа:
 *   'etalon' — целиком; 'gaps' — с пропусками; 'header' — заголовок + место.
 */
export function itemView(item, settings) {
  const { mode, plainItems } = settings;
  if (mode === 'etalon') return 'etalon';
  if (mode === 'headers') return 'header';
  if (tdfItemHasGaps(item)) return 'gaps';
  return plainItems === 'header' ? 'header' : 'etalon';
}

/**
 * Место для записи под заголовком: высота эталонного ответа × запас,
 * округлённая вверх до целой клетки (обрезанный ряд клетки читается как брак
 * печати) и зажатая в разумные пределы.
 */
export function answerSpaceMm(etalonMm, factor = 1.5) {
  const raw = Math.max(0, Number(etalonMm) || 0) * (Number(factor) || 1);
  const cells = Math.ceil(raw / CELL_MM - 1e-9) * CELL_MM;
  return Math.min(SPACE_MAX_MM, Math.max(SPACE_MIN_MM, cells));
}

/**
 * Номер пункта: если учитель уже написал его в названии («1. Определение…»),
 * второй номер не нужен.
 */
export function hasOwnNumber(name) {
  return /^\s*\d+(\.\d+)*\s*[.)]\s*/.test(String(name || ''));
}

/** Сводка для панели: сколько пунктов в каком виде печатается. */
export function flowSummary(items, settings) {
  const out = { etalon: 0, gaps: 0, header: 0 };
  for (const item of items) {
    if (item.is_section_header) continue;
    out[itemView(item, settings)] += 1;
  }
  return out;
}
