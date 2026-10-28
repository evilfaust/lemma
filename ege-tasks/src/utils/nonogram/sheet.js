/**
 * Лист японского кроссворда: настройки, сборка снимка, ключ свежести.
 *
 * Снимок листа (`generator_sheets.tasks_data`, kind `nonogram`):
 * `{ matrix, givens, variants: [{ rows, cols }], stats }` — картинка,
 * готовые клетки и подсказки-примеры по вариантам. Восстановить его
 * перегенерацией нельзя (примеры случайны), поэтому хранится целиком.
 */
import { cluesOf, solveNonogram, startGrid, checksum, difficultyOf } from './solver';
import { buildClueVariants, DEFAULT_CLUE_CATEGORIES } from './clueTasks';
import { blockSizeMm, clueLimits, resolveOrientation } from './layout';

export const SIZE_PRESETS = [5, 10, 15];
export const MIN_SIZE = 5;
export const MAX_SIZE = 20;

export const NONOGRAM_DEFAULTS = {
  cols: 10,
  rows: 10,
  threshold: 128,
  level: 1,
  variantsCount: 2,
  categories: DEFAULT_CLUE_CATEGORIES,
  orientation: 'auto',   // auto | portrait | landscape
  perPage: 1,            // 1 | 2 — два одинаковых кроссворда на листе (5×5)
  showInstruction: true,
  showChecksum: true,
  showKey: true,
};

const clampSize = (v, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, n)) : d;
};

/** Настройки сохранённого листа с умолчаниями: старый лист не знает новых ключей. */
export function normalizeNonogramSettings(s = {}) {
  const out = { ...NONOGRAM_DEFAULTS, ...s };
  out.cols = clampSize(out.cols, NONOGRAM_DEFAULTS.cols);
  out.rows = clampSize(out.rows, NONOGRAM_DEFAULTS.rows);
  out.level = [1, 2, 3].includes(out.level) ? out.level : 1;
  out.variantsCount = Math.min(6, Math.max(1, Math.round(Number(out.variantsCount) || 1)));
  out.perPage = out.perPage === 2 ? 2 : 1;
  if (!['auto', 'portrait', 'landscape'].includes(out.orientation)) out.orientation = 'auto';
  if (!out.categories || typeof out.categories !== 'object') out.categories = DEFAULT_CLUE_CATEGORIES;
  return out;
}

/** Место под кроссворд на листе с этими настройками. */
export function sheetBlock(settings, cols) {
  return blockSizeMm({
    orientation: resolveOrientation(settings.orientation, cols),
    perPage: settings.perPage,
    instruction: settings.showInstruction,
    checksum: settings.showChecksum,
  });
}

/** Состояние решателя для картинки с готовыми клетками. */
export function analyze(matrix, givens = []) {
  if (!matrix?.length) return null;
  const clues = cluesOf(matrix);
  const R = matrix.length;
  const C = matrix[0].length;
  const result = solveNonogram(clues, startGrid(R, C, givens));
  return {
    clues,
    result,
    difficulty: difficultyOf(result, Math.max(R, C)),
    filled: checksum(clues).rows,
    clueCount: clues.rows.reduce((s, l) => s + l.length, 0) + clues.cols.reduce((s, l) => s + l.length, 0),
  };
}

/**
 * Ключ свежести подсказок: картинка (её подсказки) + всё, от чего зависят
 * примеры. Изменилось — подсказки листа устарели.
 */
export function nonogramKey(matrix, settings) {
  if (!matrix?.length) return '';
  const { rows, cols } = cluesOf(matrix);
  const s = normalizeNonogramSettings(settings);
  return JSON.stringify([
    rows, cols, s.level, s.variantsCount, s.categories,
    resolveOrientation(s.orientation, cols.length), s.perPage, s.showInstruction, s.showChecksum,
  ]);
}

/** Подсказки-примеры для картинки. */
export function generateNonogramVariants(matrix, settings) {
  const s = normalizeNonogramSettings(settings);
  const clues = cluesOf(matrix);
  const limits = clueLimits(clues, sheetBlock(s, clues.cols.length));
  const { variants, stats } = buildClueVariants(clues, {
    categories: s.categories,
    level: s.level,
    variantsCount: s.variantsCount,
    limits,
  });
  return { variants, stats, key: nonogramKey(matrix, s) };
}

/** Снимок для `generator_sheets.tasks_data`. */
export function nonogramTasksData({ matrix, givens, variants, stats, key }) {
  if (!matrix?.length) return null;
  return { matrix, givens: givens || [], variants: variants || [], stats: stats || null, key: key || '' };
}
