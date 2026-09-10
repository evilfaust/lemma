/**
 * Добор уравнений в лист-классификатор из генератора квадратных уравнений.
 *
 * Смысл в том, что генератор уже знает тип каждого задания: он собирает
 * уравнение под конкретную категорию и возвращает её в поле `cat`. Значит
 * карман проставляется автоматически — учителю остаётся только просмотреть,
 * а не размечать полсотни уравнений руками.
 *
 * Категории блока «Виета без решения» (найти x₁ + x₂, составить уравнение по
 * корням) сюда не берутся: это не «решите уравнение», классифицировать их
 * нечем.
 */

import {
  generateQuadraticVariants,
  CATEGORY_LABELS_QUAD,
  CATEGORY_GROUPS_QUAD,
} from '../hooks/useQuadraticEquations';

// cat → карман пресета. `also` — типы, которые тоже засчитываются верными:
// уравнение с нулевым дискриминантом честно решается и как свёрнутый квадрат,
// и через формулу корней, и спорить с учеником об этом не нужно.
const CAT_MAP = {
  pureSquare:        { key: 'noB' },
  scaledSquare:      { key: 'noB' },
  pureSquareFrac:    { key: 'noB' },
  pureSquareDecimal: { key: 'noB' },
  squareRatio:       { key: 'noB' },
  shiftedSquare:     { key: 'noB' },
  negSquare:         { key: 'noB', also: ['productZero'] },
  pureSquareIrr:     { key: 'noB' },
  noBx:              { key: 'noB' },

  zeroRoot:          { key: 'noBC' },
  noC:               { key: 'noC', also: ['productZero'] },
  productZero:       { key: 'productZero' },

  pureNegative:      { key: 'noRoots' },
  sumPositive:       { key: 'noRoots' },

  binomSquare:       { key: 'binomSquare' },
  binomSquareZero:   { key: 'binomSquare', also: ['perfectSquare'] },
  perfectSquare:     { key: 'perfectSquare', also: ['full'] },

  vietaPositive:     { key: 'vieta', also: ['full'] },
  vietaNegative:     { key: 'vieta', also: ['full'] },
  vietaMixed:        { key: 'vieta', also: ['full'] },
  vietaLarge:        { key: 'vieta', also: ['full'] },

  reducedNoRoots:    { key: 'full' },
  reducedIrrational: { key: 'full' },
  fullFracRoot:      { key: 'full' },
  fullTwoFrac:       { key: 'full' },
  fullEvenB:         { key: 'full' },
  fullNegLead:       { key: 'full' },
  fullDouble:        { key: 'perfectSquare', also: ['full'] },
  fullNoRoots:       { key: 'full' },
  fullIrrational:    { key: 'full' },
  fullDecimal:       { key: 'full' },
  fullFracCoef:      { key: 'full' },
  conjugateRoots:    { key: 'full' },
  irrCoefB:          { key: 'full' },
  irrCoefA:          { key: 'full' },
  irrMixedRoots:     { key: 'full' },

  bracketsProduct:   { key: 'reduce' },
  expandSquare:      { key: 'reduce' },
  bothSides:         { key: 'reduce' },
  biquadratic:       { key: 'reduce' },
  fracVarDenom:      { key: 'reduce' },
};

/** Блоки категорий для окна добора — без блока «Виета без решения». */
export const QUAD_IMPORT_GROUPS = CATEGORY_GROUPS_QUAD
  .map(group => ({
    label: group.label,
    keys: group.keys.filter(k => CAT_MAP[k]),
  }))
  .filter(group => group.keys.length);

export const QUAD_IMPORT_LABELS = CATEGORY_LABELS_QUAD;

/** В какой карман листа отправится задание этой категории (или null). */
export function bucketForCategory(cat, buckets = []) {
  const map = CAT_MAP[cat];
  if (!map) return { bucketId: null, alsoFits: [] };
  const byKey = new Map(buckets.filter(b => b.presetKey).map(b => [b.presetKey, b.id]));
  return {
    bucketId: byKey.get(map.key) ?? null,
    alsoFits: (map.also || []).map(k => byKey.get(k)).filter(Boolean),
  };
}

/** Какие типы пресета нужны для выбранных категорий — чтобы предложить их добавить. */
export function presetKeysForCategories(counts = {}) {
  const keys = new Set();
  Object.entries(counts).forEach(([cat, n]) => {
    if (n > 0 && CAT_MAP[cat]) keys.add(CAT_MAP[cat].key);
  });
  return [...keys];
}

/**
 * Сгенерировать уравнения по счётчику категорий `{ cat: сколько }`.
 * Возвращает заготовки для банка: текст, ответ и уже проставленный карман.
 */
export function generateItemsForClassify(counts = {}, buckets = [], settings = {}) {
  const out = [];

  Object.entries(counts).forEach(([cat, count]) => {
    const n = Number(count) || 0;
    if (n <= 0 || !CAT_MAP[cat]) return;

    const variants = generateQuadraticVariants({
      ...settings,
      categories: { [cat]: true },
      categoryCounts: undefined,
      variantsCount: 1,
      questionsCount: n,
    });

    (variants?.[0] || []).forEach((q) => {
      const { bucketId, alsoFits } = bucketForCategory(q.cat || cat, buckets);
      out.push({
        latex: q.exprLatex,
        answerLatex: q.resultLatex,
        bucketId,
        alsoFits,
        sourceCat: q.cat || cat,
      });
    });
  });

  return out;
}
