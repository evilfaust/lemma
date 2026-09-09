import { useState, useCallback } from 'react';

/**
 * Генератор систем линейных неравенств (раздел «Уравнения»).
 *
 * Задание собирается «от ответа»: сначала выбираются границы будущего
 * промежутка, потом каждая часть системы одевается в форму — «3x > 6»,
 * «x + 4 ⩾ 6», «2(x − 1) < 4», «(x + 1)/3 ⩽ 2». Форма меняет вид записи, но не
 * границу, поэтому условие и ответ разойтись не могут, а одна и та же схема
 * ответа («полоса», «пусто», «точка») существует в десятке разных обличий.
 *
 * Сложность растягивается двумя независимыми регуляторами: блок = приём
 * (готовые границы → один шаг → скобки → дроби → особые случаи), `level` =
 * размах чисел внутри приёма. Тот же приём, что в квадратных уравнениях.
 *
 * Решение и проверка — общие для обоих генераторов систем
 * (`utils/inequalitySystem`): система = пересечение множеств, совокупность =
 * объединение, а ответ перед выдачей сверяется с самими неравенствами
 * численно.
 */

import {
  rat, R1, negR, addR, subR, mulR, divR, toNum, isZero,
  rand, randInt, chance, niceDecimal,
  num, vr, mul, dvd,
  INT_COEFS, DEC_COEFS, FRAC_DENS, coprimeNumerators,
} from '../utils/linearExpr';
import { OPS, ALL_OPS, STRICT_OPS } from '../utils/inequalityCore';
import { inequalityAnswerTex, isEmptySet, isAllReal, singlePoint } from '../utils/quadraticInequality';
import {
  solveSystem, verifySystem, systemTex, integerPoints,
} from '../utils/inequalitySystem';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

const LOOSE_OPS = ['le', 'ge'];

// ─── Уровни: размах чисел внутри одного и того же приёма ─────────────────────
export const SYS_LEVELS = {
  1: { bounds: [1, 2, 3, 4, 5, 6],                  coefs: [2, 3],             shift: 6,  dens: [2] },
  2: { bounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], coefs: [2, 3, 4, 5, 6],    shift: 12, dens: [2, 3, 4] },
  3: { bounds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 20],
       coefs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12],     shift: 20, dens: [2, 3, 4, 5, 6] },
};

export const sysPools = (level) => SYS_LEVELS[level] || SYS_LEVELS[2];

const signed = (v) => (chance(0.5) ? -v : v);

/** Знак неравенства с оглядкой на настройку листа; `want` — нужное направление */
function pickOp(opts, want) {
  const pool = (want === 'less' ? ['lt', 'le'] : want === 'greater' ? ['gt', 'ge'] : ALL_OPS)
    .filter(o => opts.ops.includes(o));
  return pool.length ? rand(pool) : null;
}

// ─── Формы одной части ───────────────────────────────────────────────────────
// Каждая форма печатает неравенство, равносильное «x OP v»: границу не трогает,
// меняет только вид записи. Возвращает null, если случайные числа не подошли —
// вызывающий тогда пробует другую форму.
const linPart = (left, right, op) => ({ tree: 'lin', left, right, op });

const FORMS = {
  // x > 2
  plain: (v, op) => linPart([vr(R1)], [num(v)], op),

  // 3x > 6
  scaled: (v, op, P) => {
    const k = rat(rand(P.coefs));
    return linPart([vr(k)], [num(mulR(k, v))], op);
  },

  // −3x < −6: знак разворачивается при делении на отрицательное
  negated: (v, op, P) => {
    const k = negR(rat(rand(P.coefs)));
    return linPart([vr(k)], [num(mulR(k, v))], OPS[op].flip);
  },

  // x + 4 ⩾ 6
  shifted: (v, op, P) => {
    const b = rat(signed(randInt(1, P.shift)));
    return linPart([vr(R1), num(b)], [num(addR(v, b))], op);
  },

  // 3x − 1 > 5
  twoStep: (v, op, P) => {
    const k = rat(rand(P.coefs) * (chance(0.25) ? -1 : 1));
    const b = rat(signed(randInt(1, P.shift)));
    const right = addR(mulR(k, v), b);
    return linPart([vr(k), num(b)], [num(right)], k.n < 0 ? OPS[op].flip : op);
  },

  // 2(x − 1) < 4
  bracket: (v, op, P) => {
    const k = rat(rand(P.coefs));
    const b = rat(signed(randInt(1, P.shift)));
    return linPart([mul(k, [vr(R1), num(b)])], [num(mulR(k, addR(v, b)))], op);
  },

  // (x + 1)/3 ⩽ 2 — граница остаётся целой, если её подобрать под знаменатель
  fracDen: (v, op, P) => {
    const d = rat(rand(P.dens));
    const b = rat(signed(randInt(1, P.shift)));
    const right = divR(addR(v, b), d);
    if (right.d > 12) return null;
    return linPart([dvd([vr(R1), num(b)], d)], [num(right)], op);
  },

  // 5x − 3 > 2x + 3 — переменная в обеих частях
  bothSides: (v, op, P) => {
    const k1 = rat(rand(P.coefs) + 1);
    const k2 = rat(rand(P.coefs.filter(c => c < toNum(k1))) || 1);
    const b2 = rat(signed(randInt(1, P.shift)));
    // k1·x + b1 OP k2·x + b2 равносильно (k1 − k2)·x OP (b2 − b1)
    const diff = subR(k1, k2);
    if (isZero(diff)) return null;
    const b1 = subR(b2, mulR(diff, v));
    return linPart([vr(k1), num(b1)], [vr(k2), num(b2)], op);
  },

  // 0,5x < 2,5
  decimal: (v, op) => {
    const k = rand(DEC_COEFS);
    const right = mulR(k, v);
    if (!niceDecimal(right, 2) || !niceDecimal(v, 2)) return null;
    return linPart([vr(k, 'dec')], [num(right, 'dec')], op);
  },

  // (2/3)x ⩾ 4
  fracCoef: (v, op, P) => {
    const d = rand(P.dens);
    const n = chance(0.5) ? 1 : rand(coprimeNumerators(d));
    const k = rat(n, d);
    const right = mulR(k, v);
    if (right.d > 12) return null;
    return linPart([vr(k)], [num(right)], op);
  },
};

/** Часть «x OP v» в одной из перечисленных форм */
function dress(v, op, P, forms) {
  const build = FORMS[rand(forms)];
  return build ? build(v, op, P) : null;
}

// ─── Схемы: какие границы берём ──────────────────────────────────────────────
/** Две границы по возрастанию: lo < hi, расстояние не меньше `gap` */
function twoBounds(P, gap = 1) {
  for (let i = 0; i < 30; i++) {
    const a = signed(rand(P.bounds));
    const b = signed(rand(P.bounds));
    const [lo, hi] = a < b ? [a, b] : [b, a];
    if (hi - lo >= gap) return [rat(lo), rat(hi)];
  }
  return null;
}

/**
 * Категория собирает систему из готовых кусков: `parts` — сами неравенства,
 * `mode` — система или совокупность, `shape` — какой ответ считается удачным
 * (см. `shapeOf`). Если пересечение вышло не той формы, задание отбраковывается
 * и генератор пробует другие числа: так «полоса» не выродится в пустоту.
 */

// ─── Блок 1. Готовые границы (устно) ─────────────────────────────────────────

// x > 2, x < 7 → (2; 7)
function genBand(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  return {
    parts: [FORMS.plain(b[0], opLo), FORMS.plain(b[1], opHi)],
    shape: 'segment',
  };
}

// x ⩾ 1, x ⩾ 4 → x ⩾ 4: побеждает сильнейшее условие
function genSameSide(P, opts) {
  const b = twoBounds(P, 1);
  const want = chance(0.5) ? 'greater' : 'less';
  const op1 = pickOp(opts, want);
  const op2 = pickOp(opts, want);
  if (!b || !op1 || !op2) return null;
  return {
    parts: [FORMS.plain(b[0], op1), FORMS.plain(b[1], op2)],
    shape: 'ray',
  };
}

// x > 5, x < 1 → решений нет
function genEmptyBand(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  return {
    parts: [FORMS.plain(b[1], opLo), FORMS.plain(b[0], opHi)],   // границы наоборот
    shape: 'empty',
  };
}

// x ⩾ 3, x ⩽ 3 → x = 3: единственная точка
function genPoint(P, opts) {
  if (!opts.ops.includes('ge') || !opts.ops.includes('le')) return null;
  const v = rat(signed(rand(P.bounds)));
  return {
    parts: [FORMS.plain(v, 'ge'), FORMS.plain(v, 'le')],
    shape: 'point',
  };
}

// ─── Блок 2. Один шаг ────────────────────────────────────────────────────────
const ONE_STEP = ['scaled', 'shifted'];

// 2x ⩽ 10, x + 1 > −2
function genStepBand(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = dress(b[0], opLo, P, ONE_STEP);
  const hi = dress(b[1], opHi, P, ONE_STEP);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// −2x < 6, x ⩽ 8 — в одной части знак разворачивается
function genNegStep(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = FORMS.negated(b[0], opLo, P);
  const hi = dress(b[1], opHi, P, ['plain', ...ONE_STEP]);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// 3x > 12, x + 2 ⩾ 5 — обе части «в одну сторону», побеждает сильнейшая
function genStepSameSide(P, opts) {
  const b = twoBounds(P, 1);
  const want = chance(0.5) ? 'greater' : 'less';
  const op1 = pickOp(opts, want);
  const op2 = pickOp(opts, want);
  if (!b || !op1 || !op2) return null;
  const p1 = dress(b[0], op1, P, ONE_STEP);
  const p2 = dress(b[1], op2, P, ['plain', ...ONE_STEP]);
  return p1 && p2 ? { parts: [p1, p2], shape: 'ray' } : null;
}

// ─── Блок 3. Два шага и скобки ───────────────────────────────────────────────
const TWO_STEP = ['twoStep', 'bracket', 'bothSides'];

function genTwoStepBand(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = dress(b[0], opLo, P, TWO_STEP);
  const hi = dress(b[1], opHi, P, ['plain', ...ONE_STEP, ...TWO_STEP]);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// 2(x − 1) > 4, 3(x + 2) ⩽ 21 — скобки в обеих частях
function genBracketsBoth(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = FORMS.bracket(b[0], opLo, P);
  const hi = FORMS.bracket(b[1], opHi, P);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// 5x − 3 > 2x + 3, x < 9 — переменная в обеих частях одного неравенства
function genBothSidesBand(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = FORMS.bothSides(b[0], opLo, P);
  const hi = dress(b[1], opHi, P, ['plain', 'scaled', 'shifted']);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// ─── Блок 4. Дроби и десятичные ──────────────────────────────────────────────

// (x + 1)/3 ⩽ 2, x > −4
function genFracDenom(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = dress(b[0], opLo, P, ['plain', 'scaled', 'shifted']);
  const hi = FORMS.fracDen(b[1], opHi, P);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// (2/3)x ⩾ 4, 0,5x < 6
function genFracCoefs(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!b || !opLo || !opHi) return null;
  const lo = FORMS.fracCoef(b[0], opLo, P);
  const hi = chance(0.5) ? FORMS.decimal(b[1], opHi, P) : FORMS.fracCoef(b[1], opHi, P);
  return lo && hi ? { parts: [lo, hi], shape: 'segment' } : null;
}

// 4x ⩾ 6, 6x < 21 → [1,5; 3,5): дробные границы у самого ответа
function genFracBounds(P, opts) {
  const d = rand([2, 2, 4]);
  const lo = rat(signed(randInt(1, 4 * P.bounds.length)) , d);
  const hi = addR(lo, rat(randInt(2, 8), d));
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  if (!opLo || !opHi || lo.d === 1) return null;
  const p1 = FORMS.scaled(lo, opLo, P);
  const p2 = FORMS.scaled(hi, opHi, P);
  return p1 && p2 ? { parts: [p1, p2], shape: 'segment' } : null;
}

// ─── Блок 5. Особые случаи ───────────────────────────────────────────────────

// 2(x + 1) > 2x + 1 — часть верна всегда, ответ даёт вторая
function genAlwaysPart(P, opts) {
  const op = pickOp(opts, chance(0.5) ? 'greater' : 'less');
  const other = pickOp(opts);
  if (!op || !other) return null;
  const k = rat(rand(P.coefs));
  const b = rat(randInt(1, P.shift));
  // k·x + b  >  k·x − c: переменная сокращается, остаётся верное числовое
  const c = rat(randInt(1, P.shift));
  const isGreater = op === 'gt' || op === 'ge';
  const always = linPart(
    [vr(k), num(isGreater ? b : negR(b))],
    [vr(k), num(isGreater ? negR(c) : c)],
    op,
  );
  const v = rat(signed(rand(P.bounds)));
  const real = dress(v, other, P, ['plain', 'scaled', 'shifted']);
  if (!real) return null;
  return { parts: chance(0.5) ? [always, real] : [real, always], shape: 'ray' };
}

// 3(x − 2) ⩽ 3x − 7 — часть неверна ни при каком x, вся система пуста
function genNeverPart(P, opts) {
  const op = pickOp(opts, chance(0.5) ? 'greater' : 'less');
  const other = pickOp(opts);
  if (!op || !other) return null;
  const k = rat(rand(P.coefs));
  const b = rat(randInt(1, P.shift));
  const c = rat(randInt(1, P.shift));
  const isGreater = op === 'gt' || op === 'ge';
  const never = linPart(
    [vr(k), num(isGreater ? negR(b) : b)],
    [vr(k), num(isGreater ? c : negR(c))],
    op,
  );
  const v = rat(signed(rand(P.bounds)));
  const real = dress(v, other, P, ['plain', 'scaled', 'shifted']);
  if (!real) return null;
  return { parts: chance(0.5) ? [never, real] : [real, never], shape: 'empty' };
}

// x > −2, 2x ⩽ 10, x + 1 ⩾ 0 — три условия сразу
function genThreeParts(P, opts) {
  const b = twoBounds(P, 4);
  const opLo = pickOp(opts, 'greater');
  const opHi = pickOp(opts, 'less');
  const opMid = pickOp(opts, 'greater');
  if (!b || !opLo || !opHi || !opMid) return null;
  // третья граница лежит между первыми двумя — она и станет ответом слева
  const inner = addR(b[0], rat(randInt(1, Math.max(1, toNum(subR(b[1], b[0])) - 1))));
  const p1 = dress(b[0], opLo, P, ['plain', 'scaled']);
  const p2 = dress(b[1], opHi, P, ['plain', 'shifted']);
  const p3 = dress(inner, opMid, P, ['plain', 'scaled', 'shifted']);
  return p1 && p2 && p3 ? { parts: [p1, p2, p3], shape: 'segment' } : null;
}

// 2x ⩾ 6, x ⩽ 3 → x = 3: границы сошлись в точку после преобразований
function genStepPoint(P, opts) {
  if (!opts.ops.includes('ge') || !opts.ops.includes('le')) return null;
  const v = rat(signed(rand(P.bounds)));
  const p1 = dress(v, 'ge', P, ONE_STEP);
  const p2 = dress(v, 'le', P, ['plain', ...ONE_STEP]);
  return p1 && p2 ? { parts: [p1, p2], shape: 'point' } : null;
}

// ─── Блок 6. Совокупность (объединение) ──────────────────────────────────────

// x < 1 или x > 4 → два луча
function genUnionRays(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'less');
  const opHi = pickOp(opts, 'greater');
  if (!b || !opLo || !opHi) return null;
  return {
    parts: [FORMS.plain(b[0], opLo), FORMS.plain(b[1], opHi)],
    mode: 'or',
    shape: 'two',
  };
}

// 2x ⩽ 4 или x − 1 > 5 — то же самое, но с преобразованиями
function genUnionSteps(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'less');
  const opHi = pickOp(opts, 'greater');
  if (!b || !opLo || !opHi) return null;
  const lo = dress(b[0], opLo, P, ONE_STEP);
  const hi = dress(b[1], opHi, P, ['plain', ...ONE_STEP, 'bracket']);
  return lo && hi ? { parts: [lo, hi], mode: 'or', shape: 'two' } : null;
}

// x < 5 или x ⩾ 2 → любое число: лучи перекрываются
function genUnionAll(P, opts) {
  const b = twoBounds(P, 2);
  const opLo = pickOp(opts, 'less');
  const opHi = pickOp(opts, 'greater');
  if (!b || !opLo || !opHi) return null;
  return {
    parts: [FORMS.plain(b[1], opLo), FORMS.plain(b[0], opHi)],   // границы наоборот
    mode: 'or',
    shape: 'all',
  };
}

// ─── Блок 7. Другие постановки ───────────────────────────────────────────────
const askOf = (kind) => (P, opts) => {
  const base = rand([genBand, genStepBand, genTwoStepBand])(P, opts);
  if (!base) return null;
  return { ...base, shape: 'segment', ask: { kind } };
};

const genCountIntegers   = askOf('count');
const genLeastInteger    = askOf('least');
const genGreatestInteger = askOf('greatest');

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  band:           genBand,
  sameSide:       genSameSide,
  emptyBand:      genEmptyBand,
  point:          genPoint,

  stepBand:       genStepBand,
  negStep:        genNegStep,
  stepSameSide:   genStepSameSide,

  twoStepBand:    genTwoStepBand,
  bracketsBoth:   genBracketsBoth,
  bothSidesBand:  genBothSidesBand,

  fracDenom:      genFracDenom,
  fracCoefs:      genFracCoefs,
  fracBounds:     genFracBounds,

  alwaysPart:     genAlwaysPart,
  neverPart:      genNeverPart,
  threeParts:     genThreeParts,
  stepPoint:      genStepPoint,

  unionRays:      genUnionRays,
  unionSteps:     genUnionSteps,
  unionAll:       genUnionAll,

  countIntegers:   genCountIntegers,
  leastInteger:    genLeastInteger,
  greatestInteger: genGreatestInteger,
};

export const CATEGORY_LABELS_LINSYS = {
  band:           'Полоса: x > 2, x < 7',
  sameSide:       'В одну сторону: x ⩾ 1, x ⩾ 4',
  emptyBand:      'Нет решений: x > 5, x < 1',
  point:          'Одна точка: x ⩾ 3, x ⩽ 3',

  stepBand:       'Один шаг: 2x ⩽ 10, x + 1 > −2',
  negStep:        'Знак разворачивается: −2x < 6, x ⩽ 8',
  stepSameSide:   'Шаг в одну сторону: 3x > 12, x + 2 ⩾ 5',

  twoStepBand:    'Два шага: 3x − 1 ⩾ 5, 2x + 3 < 15',
  bracketsBoth:   'Скобки в обеих частях: 2(x − 1) > 4, 3(x + 2) ⩽ 21',
  bothSidesBand:  'Переменная слева и справа: 5x − 3 > 2x + 3, x < 9',

  fracDenom:      'Дробь с переменной: (x + 1)/3 ⩽ 2, x > −4',
  fracCoefs:      'Дробные коэффициенты: ⅔x ⩾ 4, 0,5x < 6',
  fracBounds:     'Дробные границы: 4x ⩾ 6, 6x < 21',

  alwaysPart:     'Часть верна всегда: 2(x + 1) > 2x − 1, x ⩽ 5',
  neverPart:      'Часть неверна никогда: 3(x − 2) ⩽ 3x − 7, x > 0',
  threeParts:     'Три неравенства: x > −2, 2x ⩽ 10, x + 1 ⩾ 0',
  stepPoint:      'Границы сошлись: 2x ⩾ 6, x ⩽ 3',

  unionRays:      'Совокупность: x < 1 или x > 4',
  unionSteps:     'Совокупность с шагом: 2x ⩽ 4 или x − 1 > 5',
  unionAll:       'Совокупность даёт всё: x < 5 или x ⩾ 2',

  countIntegers:   'Сколько целых решений',
  leastInteger:    'Наименьшее целое решение',
  greatestInteger: 'Наибольшее целое решение',
};

export const CATEGORY_GROUPS_LINSYS = [
  {
    label: 'Блок 1. Готовые границы (устно)',
    keys: ['band', 'sameSide', 'emptyBand', 'point'],
  },
  {
    label: 'Блок 2. Один шаг',
    keys: ['stepBand', 'negStep', 'stepSameSide'],
  },
  {
    label: 'Блок 3. Два шага и скобки',
    keys: ['twoStepBand', 'bracketsBoth', 'bothSidesBand'],
  },
  {
    label: 'Блок 4. Дроби',
    keys: ['fracDenom', 'fracCoefs', 'fracBounds'],
  },
  {
    label: 'Блок 5. Особые случаи',
    keys: ['alwaysPart', 'neverPart', 'threeParts', 'stepPoint'],
  },
  {
    label: 'Блок 6. Совокупность («или»)',
    keys: ['unionRays', 'unionSteps', 'unionAll'],
  },
  {
    label: 'Блок 7. Другие постановки',
    keys: ['countIntegers', 'leastInteger', 'greatestInteger'],
  },
];

const ASK_CATS = new Set(CATEGORY_GROUPS_LINSYS[6].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function linsysInstruction(categories = {}) {
  const on = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
  return on.some(k => ASK_CATS.has(k)) ? 'Выполните задания:' : 'Решите систему:';
}

// ─── Настройки ───────────────────────────────────────────────────────────────
const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

const OPS_MODES = { any: ALL_OPS, strict: STRICT_OPS, loose: LOOSE_OPS };

const ALL_CATS = Object.keys(CATEGORY_LABELS_LINSYS);
const DEFAULT_ON = new Set([
  ...CATEGORY_GROUPS_LINSYS[0].keys,
  ...CATEGORY_GROUPS_LINSYS[1].keys,
  'twoStepBand', 'bracketsBoth',
]);

export const DEFAULT_SETTINGS_LINSYS = {
  variantsCount:  4,
  questionsCount: 10,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   1,             // система занимает две строки — в две колонки тесно
  fontSize:       's',
  level:          2,             // 1 | 2 | 3 — размах чисел внутри приёма
  opsMode:        'any',         // any | strict | loose
  answerForm:     'interval',    // interval «(2; 7]» | inequality «2 < x ⩽ 7»
  boundKind:      'any',         // any | integer — какие границы допускаем
  varsMode:       'x',
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Проверка задания ────────────────────────────────────────────────────────
/** Во что сложился ответ — по нему категория и решает, годится ли задание */
export function shapeOf(sol) {
  if (isEmptySet(sol)) return 'empty';
  if (isAllReal(sol)) return 'all';
  if (singlePoint(sol)) return 'point';
  if (sol.pieces.length > 1) return 'two';
  const p = sol.pieces[0];
  return p.lo === null || p.hi === null ? 'ray' : 'segment';
}

const boundOk = (b, boundKind) => {
  const v = b.p;                       // границы систем всегда рациональные
  if (!v || Math.abs(toNum(v)) > 200) return false;
  if (boundKind === 'integer') return v.d === 1;
  return v.d <= 12;
};

const boundsOk = (sol, boundKind) =>
  sol.pieces.every(p => [p.lo, p.hi].every(b => !b || boundOk(b, boundKind)));

const ASK_TAIL = {
  count:    '\\;\\text{— сколько целых решений?}',
  least:    '\\;\\text{— наименьшее целое решение}',
  greatest: '\\;\\text{— наибольшее целое решение}',
};

/**
 * Одно задание: собирает систему, решает её пересечением множеств и проверяет
 * ответ численно. Возвращает null, если случайные числа дали не ту форму
 * ответа, что задумала категория, — тогда пробуют ещё раз.
 */
export function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts.P, opts);
  if (!built || !built.parts || built.parts.some(p => !p)) return null;

  const mode = built.mode || 'and';
  const sol = solveSystem(built.parts, mode);
  if (!sol) return null;
  if (built.shape && shapeOf(sol) !== built.shape) return null;
  if (!boundsOk(sol, opts.boundKind)) return null;
  // Главная страховка: ответ обязан совпасть с самой системой в пробных точках
  if (!verifySystem(built.parts, sol, mode)) return null;

  const exprTex = systemTex(built.parts, varTex, mode);

  if (built.ask) {
    const ints = integerPoints(sol);
    if (!ints.length || ints.length > 20) return null;
    const value = built.ask.kind === 'count' ? ints.length
      : built.ask.kind === 'least' ? ints[0]
      : ints[ints.length - 1];
    return {
      exprLatex: `${exprTex} ${ASK_TAIL[built.ask.kind]}`,
      resultLatex: String(value),
      varLatex: varTex,
      solution: { ...sol, value },
      cat,
    };
  }

  return {
    exprLatex: exprTex,
    resultLatex: inequalityAnswerTex(sol, varTex, { form: opts.answerForm }),
    varLatex: varTex,
    solution: sol,
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateLinearSystemVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_LINSYS, ...settings };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.x;
  const opts = {
    P: sysPools(s.level),
    ops: OPS_MODES[s.opsMode] || ALL_OPS,
    answerForm: s.answerForm,
    boundKind: s.boundKind,
  };

  const seen = new Set();
  let repeats = 0;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: s.boundKind === 'integer' ? 250 : 150,
    make: (cat) => {
      const q = buildQuestion(cat, rand(vars), opts);
      if (!q) return null;
      if (seen.has(q.exprLatex)) {
        repeats += 1;
        if (repeats < 25) return null;
      }
      repeats = 0;
      seen.add(q.exprLatex);
      return q;
    },
  });
}

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useLinearSystems() {
  const [title, setTitle] = useState('Системы линейных неравенств');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_LINSYS });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_LINSYS,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLinearSystemVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Системы линейных неравенств');
    setSettings({ ...DEFAULT_SETTINGS_LINSYS });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
