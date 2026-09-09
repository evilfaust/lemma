import { useState, useCallback } from 'react';

/**
 * Генератор систем квадратных неравенств (раздел «Уравнения»).
 *
 * Части системы строятся от корней: квадратная — через `quadFromRoots`
 * (`utils/quadraticForms`), линейная — от своей границы, поэтому ответ известен
 * до того, как задание напечатано. Пересечение множеств и проверка — общие с
 * системами линейных неравенств (`utils/inequalitySystem`): и «x² ⩽ 9 и x > 0»,
 * и «x > 2 и x < 7» решаются одним и тем же пересечением, просто у квадратной
 * части кусков бывает два.
 *
 * Сложность растягивается блоками (простейшие устно → приведённые → два
 * квадратных → особые случаи → полные и дробные границы → совокупности →
 * вопросы о целых решениях) и уровнем `level` — размахом чисел внутри приёма.
 *
 * Каждая категория объявляет ожидаемую форму ответа (`shape`): если случайные
 * числа дали не её, задание отбраковывается. Поэтому «полоса» не выродится в
 * пустоту, а «нет решений» не окажется полосой.
 */

import { rat, rand, randInt, chance } from '../utils/linearExpr';
import { sRat, sInt, S0, S1, sNum } from '../utils/surd';
import { lin, qn, qx, qx2, qsq } from '../utils/quadraticExpr';
import { quadPools, signed, twoRoots, fromRatRoots } from '../utils/quadraticForms';
import { OPS, ALL_OPS, STRICT_OPS } from '../utils/inequalityCore';
import {
  inequalityAnswerTex, isEmptySet, isAllReal, singlePoint,
} from '../utils/quadraticInequality';
import {
  solveSystem, verifySystem, systemTex, integerPoints,
} from '../utils/inequalitySystem';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

const LOOSE_OPS = ['le', 'ge'];

const quadPart = (left, right, op) => ({ tree: 'quad', left, right, op });

/** Знак неравенства с оглядкой на настройку листа; `want` — нужное направление */
function pickOp(opts, want) {
  const pool = (want === 'less' ? ['lt', 'le'] : want === 'greater' ? ['gt', 'ge'] : ALL_OPS)
    .filter(o => opts.ops.includes(o));
  return pool.length ? rand(pool) : null;
}

// ─── Формы квадратной части ──────────────────────────────────────────────────

/**
 * x² OP a² — «внутрь» при «меньше», «наружу» при «больше»; иногда с множителем.
 * Множитель берём только там, где после деления числа остаются устными:
 * «3x² < 243» ученик уже не читает с листа, а делит в столбик.
 */
function pureQ(a, op, P) {
  const k = chance(0.25) && a <= 6 ? rand([2, 3]) : 1;
  if (k * a * a > 150) return null;
  // половину заданий печатаем как «x² − 9 ⩽ 0», половину как «x² ⩽ 9»
  return chance(0.5)
    ? quadPart([qx2(sInt(k))], [qn(sInt(k * a * a))], op)
    : quadPart([qx2(sInt(k)), qn(sInt(-k * a * a))], [qn(S0)], op);
}

/** x² − (r₁+r₂)x + r₁r₂ OP 0 — приведённое, корни подбираются по Виете */
function vietaQ(r1, r2, op) {
  return quadPart(
    [qx2(S1), qx(sInt(-(r1 + r2))), qn(sInt(r1 * r2))],
    [qn(S0)],
    op,
  );
}

/** x² − 4x ⩾ 0 — неполное, второй корень нулевой */
function noConstQ(r, op) {
  return quadPart([qx2(S1), qx(sInt(-r))], [qn(S0)], op);
}

/** a·x² + b·x + c OP 0 при a ≠ 1 (в том числе отрицательном) */
function fullQ(r1, r2, scale, op) {
  const built = fromRatRoots(rat(r1), rat(r2), rat(scale), { limit: 300 });
  return built ? quadPart(built.left, built.right, op) : null;
}

/** (x − 2)² OP 0 — D = 0: либо точка, либо «всё, кроме точки» */
function squareQ(r, op) {
  return quadPart([qsq(S1, lin(S1, sInt(-r)))], [qn(S0)], op);
}

/** x² + 5 > 0 — верно при любом x; со знаком «меньше» — неверно никогда */
function constantQ(op, P) {
  const c = randInt(1, Math.max(3, P.konst / 4));
  const k = chance(0.3) ? rand([2, 3]) : 1;
  return quadPart([qx2(sInt(k)), qn(sInt(c))], [qn(S0)], op);
}

// ─── Формы линейной части (в том же дереве узлов) ────────────────────────────
const LIN_FORMS = {
  // x > 2
  plain: (v, op) => quadPart([qx(S1)], [qn(sRat(rat(v)))], op),
  // 2x ⩽ 10
  scaled: (v, op, P) => {
    const k = rand(P.lead);
    return quadPart([qx(sInt(k))], [qn(sRat(rat(k * v)))], op);
  },
  // −x < 2 — знак разворачивается
  negated: (v, op) => quadPart([qx(sInt(-1))], [qn(sRat(rat(-v)))], OPS[op].flip),
  // x + 3 > 5
  shifted: (v, op, P) => {
    const b = signed(randInt(1, Math.max(2, P.spread)));
    return quadPart([qx(S1), qn(sInt(b))], [qn(sRat(rat(v + b)))], op);
  },
  // 2x − 1 ⩾ 5
  twoStep: (v, op, P) => {
    const k = rand(P.lead);
    const b = signed(randInt(1, Math.max(2, P.spread)));
    return quadPart([qx(sInt(k)), qn(sInt(b))], [qn(sRat(rat(k * v + b)))], op);
  },
};

const linQ = (v, op, P, forms = ['plain']) => {
  const build = LIN_FORMS[rand(forms)];
  return build ? build(v, op, P) : null;
};

const SIMPLE_LIN = ['plain', 'plain', 'scaled', 'shifted'];
const STEP_LIN   = ['scaled', 'shifted', 'twoStep', 'negated'];

// ─── Выбор корней ────────────────────────────────────────────────────────────
/** Пара различных корней по возрастанию */
function rootsPair(P, { minGap = 2 } = {}) {
  for (let i = 0; i < 40; i++) {
    const pair = twoRoots(P, { sign: 'any' });
    if (!pair) return null;
    const [a, b] = pair.slice().sort((x, y) => x - y);
    if (b - a >= minGap) return [a, b];
  }
  return null;
}

/** Целое строго внутри (a; b) — им линейная часть и отрезает половину ответа */
const inside = (a, b) => (b - a < 2 ? null : randInt(a + 1, b - 1));

// ─── Блок 1. Простейшие (устно) ──────────────────────────────────────────────

// Устный блок держим в пределах таблицы квадратов: x² ⩽ 100, не x² ⩽ 400
const oralRoots = (P, min = 2) => P.roots.filter(v => v >= min && v <= 10);

// x² ⩽ 9, x > 0 → (0; 3]
function genPureAndSign(P, opts) {
  const a = rand(oralRoots(P));
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!a || !opQ || !opL) return null;
  const quad = pureQ(a, opQ, P);
  const lin0 = LIN_FORMS.plain(0, opL);
  return quad ? { parts: chance(0.5) ? [quad, lin0] : [lin0, quad], shape: 'segment' } : null;
}

// x² < 16, x ⩾ −2 → [−2; 4)
function genPureAndRay(P, opts) {
  const a = rand(oralRoots(P, 3));
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!a || !opQ || !opL) return null;
  const cut = inside(-a, a);
  if (cut === null) return null;
  const quad = pureQ(a, opQ, P);
  const line = linQ(cut, opL, P, SIMPLE_LIN);
  return quad && line ? { parts: [quad, line], shape: 'segment' } : null;
}

// x² > 4, x < 5 → (−∞; −2) ∪ (2; 5)
function genPureOutAndBand(P, opts) {
  const a = rand(oralRoots(P));
  const opQ = pickOp(opts, 'greater');
  const opL = pickOp(opts, chance(0.5) ? 'less' : 'greater');
  if (!a || !opQ || !opL) return null;
  const far = a + randInt(1, 6);                 // граница за корнем — куска два
  const quad = pureQ(a, opQ, P);
  const line = linQ(OPS[opL].test(0, 1) ? far : -far, opL, P, SIMPLE_LIN);
  return quad && line ? { parts: [quad, line], shape: 'two' } : null;
}

// x² ⩾ 1, x² ⩽ 25 → [−5; −1] ∪ [1; 5]
function genTwoPure(P, opts) {
  const small = rand(P.roots.filter(v => v >= 1 && v <= 4));
  const big = rand(oralRoots(P).filter(v => v > small + 1));
  const opIn = pickOp(opts, 'greater');
  const opOut = pickOp(opts, 'less');
  if (!small || !big || !opIn || !opOut) return null;
  const p1 = pureQ(small, opIn, P);
  const p2 = pureQ(big, opOut, P);
  return p1 && p2 ? { parts: [p1, p2], shape: 'two' } : null;
}

// ─── Блок 2. Приведённое квадратное и линейное ───────────────────────────────

// x² − 5x + 6 ⩽ 0, x ⩾ 0 → [2; 3]
function genVietaAndRay(P, opts) {
  const r = rootsPair(P);
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!r || !opQ || !opL) return null;
  const far = r[0] - randInt(1, 6);              // линейная часть отсекает лишнее
  const line = linQ(far, opL, P, SIMPLE_LIN);
  const quad = vietaQ(r[0], r[1], opQ);
  return line ? { parts: [quad, line], shape: 'segment' } : null;
}

// x² − x − 6 < 0, x > 0 → (0; 3): линейная часть срезает половину промежутка
function genVietaCut(P, opts) {
  const r = rootsPair(P, { minGap: 3 });
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts, chance(0.5) ? 'greater' : 'less');
  if (!r || !opQ || !opL) return null;
  const cut = inside(r[0], r[1]);
  if (cut === null) return null;
  const line = linQ(cut, opL, P, SIMPLE_LIN);
  const quad = vietaQ(r[0], r[1], opQ);
  return line ? { parts: [quad, line], shape: 'segment' } : null;
}

// x² − 4x + 3 > 0, x < 5 → (−∞; 1) ∪ (3; 5)
function genVietaOutAndBand(P, opts) {
  const r = rootsPair(P);
  const opQ = pickOp(opts, 'greater');
  const opL = pickOp(opts, 'less');
  if (!r || !opQ || !opL) return null;
  const far = r[1] + randInt(1, 6);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  const quad = vietaQ(r[0], r[1], opQ);
  return line ? { parts: [quad, line], shape: 'two' } : null;
}

// x² + x − 6 ⩽ 0, 2x + 1 > 0 — линейная часть уже в два шага
function genVietaAndStep(P, opts) {
  const r = rootsPair(P, { minGap: 3 });
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts, 'greater');
  if (!r || !opQ || !opL) return null;
  const cut = inside(r[0], r[1]);
  if (cut === null) return null;
  const line = linQ(cut, opL, P, STEP_LIN);
  const quad = vietaQ(r[0], r[1], opQ);
  return line ? { parts: [quad, line], shape: 'segment' } : null;
}

// x² − 4x ⩾ 0, x < 6 — неполное квадратное с нулевым корнем
function genNoConstAndLin(P, opts) {
  const r = signed(rand(P.roots.filter(v => v >= 2)));
  const opQ = pickOp(opts, 'greater');
  const opL = pickOp(opts, r > 0 ? 'less' : 'greater');
  if (!r || !opQ || !opL) return null;
  const far = r > 0 ? r + randInt(1, 5) : r - randInt(1, 5);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  return line ? { parts: [noConstQ(r, opQ), line], shape: 'two' } : null;
}

// ─── Блок 3. Два квадратных ──────────────────────────────────────────────────

// x² − 5x + 4 ⩽ 0, x² − 9 ⩾ 0 → [3; 4]
function genTwoVieta(P, opts) {
  const r = rootsPair(P, { minGap: 3 });
  const opIn = pickOp(opts, 'less');
  const opOut = pickOp(opts, 'greater');
  if (!r || !opIn || !opOut) return null;
  const cut = inside(r[0], r[1]);
  if (cut === null || Math.abs(cut) > 12) return null;
  // второе неравенство «наружу» с корнями ±cut срезает левую половину отрезка
  const p1 = vietaQ(r[0], r[1], opIn);
  const p2 = pureQ(Math.abs(cut) || 1, opOut, P);
  return p2 ? { parts: [p1, p2], shape: 'segment' } : null;
}

// x² − 4 < 0, x² − x − 2 > 0 → (−2; −1)
function genBandAndOut(P, opts) {
  const a = rand(P.roots.filter(v => v >= 3));
  const opIn = pickOp(opts, 'less');
  const opOut = pickOp(opts, 'greater');
  if (!a || !opIn || !opOut) return null;
  const r = rootsPair(P, { minGap: 2 });
  if (!r || r[1] >= a || r[0] <= -a) return null;     // корни внутри полосы
  return { parts: [pureQ(a, opIn, P), vietaQ(r[0], r[1], opOut)], shape: 'two' };
}

// x² − 6x + 5 ⩽ 0, x² − 4x ⩾ 0 → [4; 5]
function genNestedBands(P, opts) {
  const r = rootsPair(P, { minGap: 3 });
  const opIn = pickOp(opts, 'less');
  const opOut = pickOp(opts, 'greater');
  if (!r || !opIn || !opOut) return null;
  const cut = inside(r[0], r[1]);
  if (cut === null) return null;
  const outer = rootsPair(P, { minGap: 2 });
  if (!outer) return null;
  // «наружное» неравенство с корнями (cut; r₁+…): оставляем правый хвост
  const p2 = vietaQ(cut, cut + randInt(1, 4) + (r[1] - cut), opOut);
  return { parts: [vietaQ(r[0], r[1], opIn), p2], shape: 'segment' };
}

// x² ⩾ 4, x² ⩽ 16 → [−4; −2] ∪ [2; 4] — кольцо из двух отрезков
function genRingPair(P, opts) {
  const small = rand(P.roots.filter(v => v >= 1 && v <= 5));
  const big = rand(P.roots.filter(v => v > small + 1));
  const opOut = pickOp(opts, 'greater');
  const opIn = pickOp(opts, 'less');
  if (!small || !big || !opOut || !opIn) return null;
  const p1 = vietaQ(-small, small, opOut);
  const p2 = pureQ(big, opIn, P);
  return p2 ? { parts: [p1, p2], shape: 'two' } : null;
}

// ─── Блок 4. Особые случаи ───────────────────────────────────────────────────

// x² ⩽ 4, x > 5 → решений нет
function genEmptyPair(P, opts) {
  const a = rand(P.roots.filter(v => v >= 2));
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts, 'greater');
  if (!a || !opQ || !opL) return null;
  const far = a + randInt(1, 6);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  const quad = pureQ(a, opQ, P);
  return quad && line ? { parts: [quad, line], shape: 'empty' } : null;
}

// x² + 5 > 0, x² − 4 ⩽ 0 → [−2; 2]: первая часть верна всегда
function genAlwaysPart(P, opts) {
  const opAlways = pickOp(opts, 'greater');
  const opQ = pickOp(opts, 'less');
  const a = rand(P.roots.filter(v => v >= 2));
  if (!opAlways || !opQ || !a) return null;
  const quad = pureQ(a, opQ, P);
  const always = constantQ(opAlways, P);
  return quad ? { parts: chance(0.5) ? [always, quad] : [quad, always], shape: 'segment' } : null;
}

// x² + 3 < 0, x > 1 → решений нет: первая часть неверна никогда
function genNeverPart(P, opts) {
  const opNever = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!opNever || !opL) return null;
  const line = linQ(signed(rand(P.roots)), opL, P, SIMPLE_LIN);
  const never = constantQ(opNever, P);
  return line ? { parts: chance(0.5) ? [never, line] : [line, never], shape: 'empty' } : null;
}

// (x − 2)² ⩽ 0, x < 5 → x = 2
function genSquarePoint(P, opts) {
  if (!opts.ops.includes('le')) return null;
  const r = signed(rand(P.roots));
  const opL = pickOp(opts);
  if (!opL) return null;
  const far = OPS[opL].test(0, 1) ? r + randInt(1, 6) : r - randInt(1, 6);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  return line ? { parts: [squareQ(r, 'le'), line], shape: 'point' } : null;
}

// x² ⩾ 9, x² ⩽ 9 → x = ±3: две точки
function genTwoPoints(P, opts) {
  if (!opts.ops.includes('le') || !opts.ops.includes('ge')) return null;
  const a = rand(P.roots.filter(v => v >= 2));
  if (!a) return null;
  const p1 = pureQ(a, 'ge', P);
  const p2 = pureQ(a, 'le', P);
  return p1 && p2 ? { parts: [p1, p2], shape: 'two' } : null;
}

// ─── Блок 5. Полные и дробные границы ────────────────────────────────────────

// 2x² − 7x + 3 < 0, x ⩾ 1 → [1; 3)
function genFullAndLinear(P, opts) {
  const r = rootsPair(P, { minGap: 2 });
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!r || !opQ || !opL) return null;
  const scale = rand(P.lead);
  const quad = fullQ(r[0], r[1], scale, opQ);
  const far = OPS[opL].test(0, 1) ? r[1] + randInt(1, 5) : r[0] - randInt(1, 5);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  return quad && line ? { parts: [quad, line], shape: 'segment' } : null;
}

// −x² + 4x − 3 ⩾ 0, x > 2 → (2; 3]: старший коэффициент отрицательный
function genNegLeadAndLinear(P, opts) {
  const r = rootsPair(P, { minGap: 3 });
  const opQ = pickOp(opts, 'greater');
  const opL = pickOp(opts, 'greater');
  if (!r || !opQ || !opL) return null;
  const cut = inside(r[0], r[1]);
  if (cut === null) return null;
  const quad = fullQ(r[0], r[1], -1, opQ);
  const line = linQ(cut, opL, P, SIMPLE_LIN);
  return quad && line ? { parts: [quad, line], shape: 'segment' } : null;
}

// 4x² − 1 ⩽ 0, x > 0 → (0; ½]: границы дробные
function genFracBounds(P, opts) {
  const d = rand([2, 2, 3, 4]);
  const n = rand([1, 1, 3, 5].filter(v => v < d * 4));
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts);
  if (!opQ || !opL) return null;
  // корни ±n/d: (dx − n)(dx + n) = d²x² − n²
  const quad = quadPart([qx2(sInt(d * d)), qn(sInt(-n * n))], [qn(S0)], opQ);
  const line = LIN_FORMS.plain(0, opL);
  return { parts: [quad, line], shape: 'segment' };
}

// ─── Блок 6. Совокупность («или») ────────────────────────────────────────────

// x² ⩽ 4 или x > 5 → [−2; 2] ∪ (5; +∞)
function genUnionQuadLin(P, opts) {
  const a = rand(P.roots.filter(v => v >= 2));
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts, 'greater');
  if (!a || !opQ || !opL) return null;
  const far = a + randInt(2, 8);
  const quad = pureQ(a, opQ, P);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  return quad && line ? { parts: [quad, line], mode: 'or', shape: 'two' } : null;
}

// x² ⩽ 1 или x² ⩾ 9 → [−1; 1] ∪ (−∞; −3] ∪ [3; +∞)
function genUnionTwoQuad(P, opts) {
  const small = rand(P.roots.filter(v => v >= 1 && v <= 4));
  const big = rand(P.roots.filter(v => v > small + 1));
  const opIn = pickOp(opts, 'less');
  const opOut = pickOp(opts, 'greater');
  if (!small || !big || !opIn || !opOut) return null;
  const p1 = pureQ(small, opIn, P);
  const p2 = pureQ(big, opOut, P);
  return p1 && p2 ? { parts: [p1, p2], mode: 'or', shape: 'two' } : null;
}

// x² − 5x + 6 ⩽ 0 или x < 0 → (−∞; 0) ∪ [2; 3]
function genUnionVietaLin(P, opts) {
  const r = rootsPair(P, { minGap: 2 });
  const opQ = pickOp(opts, 'less');
  const opL = pickOp(opts, 'less');
  if (!r || !opQ || !opL) return null;
  const far = r[0] - randInt(1, 6);
  const line = linQ(far, opL, P, SIMPLE_LIN);
  return line ? { parts: [vietaQ(r[0], r[1], opQ), line], mode: 'or', shape: 'two' } : null;
}

// ─── Блок 7. Другие постановки ───────────────────────────────────────────────
const askOf = (kind) => (P, opts) => {
  const base = rand([genPureAndSign, genPureAndRay, genVietaCut, genVietaAndStep])(P, opts);
  if (!base) return null;
  return { ...base, ask: { kind } };
};

const genCountIntegers   = askOf('count');
const genLeastInteger    = askOf('least');
const genGreatestInteger = askOf('greatest');

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  pureAndSign:     genPureAndSign,
  pureAndRay:      genPureAndRay,
  pureOutAndBand:  genPureOutAndBand,
  twoPure:         genTwoPure,

  vietaAndRay:     genVietaAndRay,
  vietaCut:        genVietaCut,
  vietaOutAndBand: genVietaOutAndBand,
  vietaAndStep:    genVietaAndStep,
  noConstAndLin:   genNoConstAndLin,

  twoVieta:        genTwoVieta,
  bandAndOut:      genBandAndOut,
  nestedBands:     genNestedBands,
  ringPair:        genRingPair,

  emptyPair:       genEmptyPair,
  alwaysPart:      genAlwaysPart,
  neverPart:       genNeverPart,
  squarePoint:     genSquarePoint,
  twoPoints:       genTwoPoints,

  fullAndLinear:   genFullAndLinear,
  negLeadAndLinear: genNegLeadAndLinear,
  fracBounds:      genFracBounds,

  unionQuadLin:    genUnionQuadLin,
  unionTwoQuad:    genUnionTwoQuad,
  unionVietaLin:   genUnionVietaLin,

  countIntegers:   genCountIntegers,
  leastInteger:    genLeastInteger,
  greatestInteger: genGreatestInteger,
};

export const CATEGORY_LABELS_QSYS = {
  pureAndSign:     'Квадрат и знак: x² ⩽ 9, x > 0',
  pureAndRay:      'Квадрат и луч: x² < 16, x ⩾ −2',
  pureOutAndBand:  'Наружу и полоса: x² > 4, x < 5',
  twoPure:         'Два чистых квадрата: x² ⩾ 1, x² ⩽ 25',

  vietaAndRay:     'Виета и луч: x² − 5x + 6 ⩽ 0, x ⩾ 0',
  vietaCut:        'Луч режет промежуток: x² − x − 6 < 0, x > 0',
  vietaOutAndBand: 'Наружу и ограничение: x² − 4x + 3 > 0, x < 5',
  vietaAndStep:    'Линейная часть в два шага: x² + x − 6 ⩽ 0, 2x + 1 > 0',
  noConstAndLin:   'Неполное: x² − 4x ⩾ 0, x < 6',

  twoVieta:        'Два квадратных: x² − 5x + 4 ⩽ 0, x² − 9 ⩾ 0',
  bandAndOut:      'Полоса и наружу: x² − 4 < 0, x² − x − 2 > 0',
  nestedBands:     'Вложенные промежутки: x² − 6x + 5 ⩽ 0, x² − 4x ⩾ 0',
  ringPair:        'Кольцо: x² ⩾ 4, x² ⩽ 16',

  emptyPair:       'Нет решений: x² ⩽ 4, x > 5',
  alwaysPart:      'Часть верна всегда: x² + 5 > 0, x² − 4 ⩽ 0',
  neverPart:       'Часть неверна никогда: x² + 3 < 0, x > 1',
  squarePoint:     'Одна точка: (x − 2)² ⩽ 0, x < 5',
  twoPoints:       'Две точки: x² ⩾ 9, x² ⩽ 9',

  fullAndLinear:   'Полное (a ≠ 1): 2x² − 7x + 3 < 0, x ⩾ 1',
  negLeadAndLinear: 'Отрицательный старший: −x² + 4x − 3 ⩾ 0, x > 2',
  fracBounds:      'Дробные границы: 4x² − 1 ⩽ 0, x > 0',

  unionQuadLin:    'Совокупность: x² ⩽ 4 или x > 5',
  unionTwoQuad:    'Совокупность двух квадратных: x² ⩽ 1 или x² ⩾ 9',
  unionVietaLin:   'Совокупность с Виетой: x² − 5x + 6 ⩽ 0 или x < 0',

  countIntegers:   'Сколько целых решений',
  leastInteger:    'Наименьшее целое решение',
  greatestInteger: 'Наибольшее целое решение',
};

export const CATEGORY_GROUPS_QSYS = [
  {
    label: 'Блок 1. Простейшие (устно)',
    keys: ['pureAndSign', 'pureAndRay', 'pureOutAndBand', 'twoPure'],
  },
  {
    label: 'Блок 2. Приведённое и линейное',
    keys: ['vietaAndRay', 'vietaCut', 'vietaOutAndBand', 'vietaAndStep', 'noConstAndLin'],
  },
  {
    label: 'Блок 3. Два квадратных',
    keys: ['twoVieta', 'bandAndOut', 'nestedBands', 'ringPair'],
  },
  {
    label: 'Блок 4. Особые случаи',
    keys: ['emptyPair', 'alwaysPart', 'neverPart', 'squarePoint', 'twoPoints'],
  },
  {
    label: 'Блок 5. Полные и дробные границы',
    keys: ['fullAndLinear', 'negLeadAndLinear', 'fracBounds'],
  },
  {
    label: 'Блок 6. Совокупность («или»)',
    keys: ['unionQuadLin', 'unionTwoQuad', 'unionVietaLin'],
  },
  {
    label: 'Блок 7. Другие постановки',
    keys: ['countIntegers', 'leastInteger', 'greatestInteger'],
  },
];

const ASK_CATS = new Set(CATEGORY_GROUPS_QSYS[6].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function qsysInstruction(categories = {}) {
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

const ALL_CATS = Object.keys(CATEGORY_LABELS_QSYS);
const DEFAULT_ON = new Set([
  ...CATEGORY_GROUPS_QSYS[0].keys,
  ...CATEGORY_GROUPS_QSYS[1].keys,
]);

export const DEFAULT_SETTINGS_QSYS = {
  variantsCount:  4,
  questionsCount: 8,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   1,             // система занимает две строки — в две колонки тесно
  fontSize:       's',
  level:          2,             // 1 | 2 | 3 — размах чисел внутри приёма
  opsMode:        'any',         // any | strict | loose
  answerForm:     'interval',    // interval «[−2; 3)» | inequality «−2 ⩽ x < 3»
  boundKind:      'any',         // any | integer — какие границы допускаем
  varsMode:       'x',
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Проверка задания ────────────────────────────────────────────────────────
export function shapeOf(sol) {
  if (isEmptySet(sol)) return 'empty';
  if (isAllReal(sol)) return 'all';
  if (singlePoint(sol)) return 'point';
  if (sol.pieces.length > 1) return 'two';
  const p = sol.pieces[0];
  return p.lo === null || p.hi === null ? 'ray' : 'segment';
}

function boundOk(b, boundKind) {
  const v = sNum(b);
  if (!Number.isFinite(v) || Math.abs(v) > 200) return false;
  if (boundKind === 'integer') return b.p && b.p.d === 1 && b.q && b.q.n === 0;
  return b.p && b.p.d <= 12 && (!b.q || b.q.d <= 6);
}

const boundsOk = (sol, boundKind) =>
  sol.pieces.every(p => [p.lo, p.hi].every(b => !b || boundOk(b, boundKind)));

const ASK_TAIL = {
  count:    '\\;\\text{— сколько целых решений?}',
  least:    '\\;\\text{— наименьшее целое решение}',
  greatest: '\\;\\text{— наибольшее целое решение}',
};

/**
 * Одно задание: собирает систему, решает пересечением множеств и проверяет
 * ответ численно. null — если случайные числа дали не ту форму ответа, что
 * задумала категория.
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
export function generateQuadraticSystemVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_QSYS, ...settings };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.x;
  const opts = {
    P: quadPools(s.level),
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
export function useQuadraticSystems() {
  const [title, setTitle] = useState('Системы квадратных неравенств');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_QSYS });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_QSYS,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateQuadraticSystemVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Системы квадратных неравенств');
    setSettings({ ...DEFAULT_SETTINGS_QSYS });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
