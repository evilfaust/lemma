import { useState, useCallback } from 'react';

/**
 * Генератор заданий на метод интервалов (раздел «Уравнения»).
 *
 * Устроен как генератор квадратных неравенств: категория строит РАЗЛОЖЕННОЕ
 * выражение (`utils/intervalMethod`: множители числителя и знаменателя), а
 * знак, кратности, выколотые точки и запись ответа считает общее ядро.
 * Категория не знает ни про чередование знака, ни про то, входит ли граница, —
 * иначе эти правила разъехались бы по сорока функциям.
 *
 * Перед выдачей каждое задание проверяется численно: во всех пробных точках
 * «принадлежит ответу» обязано совпадать с «неравенство верно», причём
 * проверяется именно НАПЕЧАТАННОЕ неравенство. Поэтому и ошибка в кратности,
 * и ошибка приведения «(x+1)/(x−2) ⩾ 1» к дроби до листа не доедут.
 */

import { rat, rand, randInt, chance, coprimeNumerators } from '../utils/linearExpr';
import { sNum, sIsRat } from '../utils/surd';
import { signed } from '../utils/quadraticForms';
import { OPS, ALL_OPS, STRICT_OPS } from '../utils/inequalityCore';
import { inequalityAnswerTex, contains } from '../utils/quadraticInequality';
import {
  fLin, fQuad, fConst, polyFactor,
  renderTermsTex, rhsTex, renderExprTex,
  solveIntervalMethod, verifyIntervalSolution, criticalPoints,
  integerSolutions, isBounded,
} from '../utils/intervalMethod';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

const LOOSE_OPS = ['le', 'ge'];

// Размах чисел внутри одного и того же приёма: корни и коэффициенты растут,
// сам метод интервалов остаётся прежним
const LEVELS = {
  1: { roots: [1, 2, 3, 4, 5, 6],                       dens: [2],             consts: [2, 3],          small: [1, 2, 3], quadC: 6 },
  2: { roots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],      dens: [2, 3],          consts: [2, 3, 4, 5],    small: [1, 2, 3, 4, 5], quadC: 12 },
  3: { roots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20],
       dens: [2, 3, 4, 5],    consts: [2, 3, 4, 5, 6, 7, 8],  small: [1, 2, 3, 4, 5, 6], quadC: 20 },
};

const pools = (level) => LEVELS[level] || LEVELS[2];

/**
 * Знак неравенства для задания. `allowed` — что имеет смысл в этой категории
 * («сколько целых решений» требует ограниченного ответа, значит знак «меньше»),
 * настройка листа сужает дальше. null — категория и настройка несовместимы.
 */
function chooseOp(opts, allowed = ALL_OPS) {
  const pool = allowed.filter(o => opts.ops.includes(o));
  return pool.length ? rand(pool) : null;
}

const withOp = (built, op) => (built && op ? { ...built, op } : null);

/** Обычное задание: печатается и решается одно и то же выражение */
const task = (numer, denom = []) => ({
  display: { numer, denom },
  solve:   { numer, denom },
});

// ─── Заготовки множителей ────────────────────────────────────────────────────
/** n различных целых корней */
function pickRoots(P, n, { allowZero = false, minGap = 0 } = {}) {
  const out = [];
  for (let i = 0; i < 200 && out.length < n; i++) {
    const v = allowZero && chance(0.25) ? 0 : signed(rand(P.roots));
    if (out.includes(v)) continue;
    if (minGap && out.some(r => Math.abs(r - v) < minGap)) continue;
    out.push(v);
  }
  return out.length === n ? out : null;
}

/** Скобки (x − r) по целым корням */
const linsOf = (roots) => roots.map(r => fLin(1, -r));

/** Скобка с дробным корнем: (3x − 2), корень ⅔ */
function fracLin(P) {
  const a = rand(P.dens);
  const b = signed(rand(coprimeNumerators(a)) + a * randInt(0, 2));
  return fLin(a, -b);
}

/** Квадратный множитель без корней: x² + 4, −x² − 3 */
function noRootQuad(P, negative = false) {
  const b = chance(0.5) ? 0 : signed(randInt(1, 4));
  const base = Math.floor((b * b) / 4) + 1;
  const c = base + randInt(0, P.quadC);
  return negative ? fQuad(-1, -b, -c) : fQuad(1, b, c);
}

/** Трёхчлен с целыми корнями: x² − 5x + 6 */
const trinomOf = (r1, r2) => fQuad(1, -(r1 + r2), r1 * r2);

// ─── Блок 1. Произведение скобок ─────────────────────────────────────────────

// (x − 2)(x + 5) < 0
function genProdTwo(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2);
  return r && withOp(task(linsOf(r)), op);
}

// (x − 1)(x − 3)(x + 2) ⩾ 0
function genProdThree(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  return r && withOp(task(linsOf(r)), op);
}

// (x − 1)(x − 2)(x + 3)(x + 4) > 0
function genProdFour(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 4);
  return r && withOp(task(linsOf(r)), op);
}

// x(x − 5)(x + 3) ⩽ 0 — множитель без свободного члена
function genProdZero(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.5) ? 1 : 2);
  if (!r || r.includes(0)) return null;
  const factors = [fLin(1, 0), ...linsOf(r)];
  return withOp(task(factors), op);
}

// (3 − x)(x + 4) > 0 — скобка, в которой x вычитается
function genProdNegLead(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.5) ? 2 : 3);
  if (!r) return null;
  const [first, ...rest] = r;
  if (first === 0) return null;
  const flipped = fLin(-1, Math.abs(first));       // (c − x), c > 0
  return withOp(task([flipped, ...linsOf(rest)]), op);
}

// (2x − 3)(x + 1) ⩽ 0 — дробный корень
function genProdCoefLin(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.35) ? 2 : 1);
  if (!r) return null;
  const factors = chance(0.25)
    ? [fracLin(P), fracLin(P), ...linsOf(r).slice(0, 1)]
    : [fracLin(P), ...linsOf(r)];
  return withOp(task(factors), op);
}

// −2(x − 1)(x + 4) > 0 — числовой множитель впереди
function genProdConst(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.4) ? 3 : 2);
  if (!r) return null;
  const k = rand(P.consts) * (chance(0.6) ? -1 : 1);
  return withOp(task([fConst(k), ...linsOf(r)]), op);
}

// ─── Блок 2. Кратные корни ───────────────────────────────────────────────────

// (x − 2)²(x + 1) > 0 — знак через кратный корень не меняется
function genSquareFactor(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.35) ? 3 : 2);
  if (!r) return null;
  const [a, ...rest] = r;
  return withOp(task([fLin(1, -a, 2), ...linsOf(rest)]), op);
}

// (x − 2)³(x + 1) ⩽ 0 — нечётная кратность знак меняет
function genCubeFactor(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.3) ? 3 : 2);
  if (!r) return null;
  const [a, ...rest] = r;
  return withOp(task([fLin(1, -a, 3), ...linsOf(rest)]), op);
}

// (x − 1)²(x + 3)² ⩾ 0 — выражение знака не меняет вовсе
function genTwoSquares(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2);
  if (!r) return null;
  return withOp(task([fLin(1, -r[0], 2), fLin(1, -r[1], 2)]), op);
}

// (x − 2)⁴(x + 5) < 0
function genHighPower(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2);
  if (!r) return null;
  return withOp(task([fLin(1, -r[0], rand([4, 5])), fLin(1, -r[1])]), op);
}

// (x − 1)²(x − 4)³(x + 2) ⩾ 0 — кратности вперемешку
function genMixedMult(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  if (!r) return null;
  const mults = [rand([2, 2, 4]), rand([3, 3, 5]), 1];
  return withOp(task(r.map((v, i) => fLin(1, -v, mults[i]))), op);
}

// ─── Блок 3. Дробно-рациональные ─────────────────────────────────────────────

// (x − 3)/(x + 2) ⩾ 0
function genFracSimple(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2, { allowZero: true });
  return r && withOp(task([fLin(1, -r[0])], [fLin(1, -r[1])]), op);
}

// (x − 1)(x + 4)/(x − 2) < 0
function genFracNumTwo(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  return r && withOp(task(linsOf(r.slice(0, 2)), [fLin(1, -r[2])]), op);
}

// (x − 1)/((x − 2)(x + 3)) ⩾ 0
function genFracDenTwo(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  return r && withOp(task([fLin(1, -r[0])], linsOf(r.slice(1))), op);
}

// (x − 1)(x + 2)/((x − 3)(x + 4)) ⩽ 0
function genFracBoth(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 4);
  return r && withOp(task(linsOf(r.slice(0, 2)), linsOf(r.slice(2))), op);
}

// (x − 1)/(x + 2)² > 0 — знаменатель знака не меняет
function genFracSqDen(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.4) ? 3 : 2);
  if (!r) return null;
  const [a, b, c] = r;
  const numer = c === undefined ? [fLin(1, -a)] : [fLin(1, -a), fLin(1, -c)];
  return withOp(task(numer, [fLin(1, -b, 2)]), op);
}

// (x − 1)²(x + 5)/(x − 3) ⩽ 0 — кратный корень в числителе дроби
function genFracSqNum(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  if (!r) return null;
  return withOp(task([fLin(1, -r[0], rand([2, 3])), fLin(1, -r[1])], [fLin(1, -r[2])]), op);
}

// (2x − 1)/(3x + 6) ⩾ 0 — дробные корни
function genFracCoefLin(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 1);
  if (!r) return null;
  return chance(0.5)
    ? withOp(task([fracLin(P)], [fLin(1, -r[0])]), op)
    : withOp(task([fLin(1, -r[0])], [fracLin(P)]), op);
}

// ─── Блок 4. Сначала разложить на множители ──────────────────────────────────

// (x² − 5x + 6)(x + 1) ⩾ 0
function genTrinomFactor(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  if (!r) return null;
  return withOp(task([trinomOf(r[0], r[1]), fLin(1, -r[2])]), op);
}

// (x² − 4)/(x − 3) < 0
function genTrinomFrac(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  if (!r) return null;
  const numer = chance(0.4)
    ? [fQuad(1, 0, -r[0] * r[0])]                    // разность квадратов: x² − 9
    : [trinomOf(r[0], r[1])];
  return withOp(task(numer, [fLin(1, -r[2])]), op);
}

// (x + 1)/(x² − 5x + 6) ⩽ 0
function genTrinomDen(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 3);
  if (!r) return null;
  return withOp(task([fLin(1, -r[2])], [trinomOf(r[0], r[1])]), op);
}

// (x² − 9)(x² − 1) > 0 — две разности квадратов
function genDiffSquares(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.small.filter(v => v > 0));
  const b = rand(P.small.filter(v => v !== a && v > 0));
  if (!a || !b) return null;
  return withOp(task([fQuad(1, 0, -a * a), fQuad(1, 0, -b * b)]), op);
}

// x³ − 4x ⩾ 0 — вынести общий множитель
function genPolyCommon(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2);
  if (!r || r.includes(0)) return null;
  const roots = [{ r: 0 }, { r: r[0] }, { r: r[1] }];
  const f = polyFactor(roots);
  if (f.coeffs.some(c => Math.abs(c) > 200)) return null;
  return withOp(task([f]), op);
}

// x³ + 2x² − 9x − 18 > 0 — группировка
function genPolyGrouping(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.small.filter(v => v > 1));
  const c = signed(rand(P.roots));
  if (!a || c === 0 || Math.abs(c) === a) return null;
  const f = polyFactor([{ r: a }, { r: -a }, { r: c }]);
  if (f.coeffs.some(v => Math.abs(v) > 200)) return null;
  return withOp(task([f]), op);
}

// x⁴ − 5x² + 4 < 0 — биквадратное
function genPolyBiquad(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.small.filter(v => v > 0));
  const b = rand(P.small.filter(v => v !== a && v > 0));
  if (!a || !b) return null;
  const f = polyFactor([{ r: a }, { r: -a }, { r: b }, { r: -b }]);
  if (f.coeffs.some(v => Math.abs(v) > 400)) return null;
  return withOp(task([f]), op);
}

// ─── Блок 5. Знакопостоянные множители ───────────────────────────────────────

// (x² + 4)(x − 3) < 0 — множитель без корней только мешает
function genPosQuadFactor(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.4) ? 2 : 1);
  if (!r) return null;
  return withOp(task([noRootQuad(P), ...linsOf(r)]), op);
}

// (−x² − 3)(x − 1) > 0 — множитель отрицателен при любом x
function genNegQuadFactor(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.35) ? 2 : 1);
  if (!r) return null;
  return withOp(task([noRootQuad(P, true), ...linsOf(r)]), op);
}

// (x − 2)/(x² + x + 1) ⩾ 0 — знаменатель в ноль не обращается
function genPosQuadDen(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, chance(0.35) ? 2 : 1);
  if (!r) return null;
  return withOp(task(linsOf(r), [noRootQuad(P)]), op);
}

// (x² + 4)/(x² − 9) ⩽ 0
function genQuadPairFrac(P, opts) {
  const op = chooseOp(opts);
  const a = rand(P.small.filter(v => v > 0));
  if (!a) return null;
  return withOp(task([noRootQuad(P)], [fQuad(1, 0, -a * a)]), op);
}

// ─── Блок 6. Привести к виду «выражение ⋛ 0» ─────────────────────────────────

// (x + 1)/(x − 2) ⩾ 1 — перенести и привести к общему знаменателю
function genFracVsConst(P, opts) {
  const op = chooseOp(opts);
  const a = chance(0.65) ? 1 : rand(P.dens);
  const b = signed(randInt(1, 12));
  const r = signed(rand(P.roots));
  const k = signed(rand(P.small));
  const A = a - k;
  const B = b + k * r;
  if (!k || A === 0) return null;
  const den = [fLin(1, -r)];
  return withOp({
    display: { numer: [fLin(a, b)], denom: den, rhsConst: rat(k) },
    solve:   { numer: [fLin(A, B)], denom: den },
  }, op);
}

// 1/(x − 3) > 2 — единица в числителе
function genFracVsUnit(P, opts) {
  const op = chooseOp(opts);
  const r = signed(rand(P.roots));
  const k = signed(rand(P.small));
  if (!k) return null;
  const den = [fLin(1, -r)];
  return withOp({
    display: { numer: [fConst(1)], denom: den, rhsConst: rat(k) },
    solve:   { numer: [fLin(-k, 1 + k * r)], denom: den },
  }, op);
}

// 1/(x − 1) ⩽ 1/(x + 2) — дробь против дроби
function genFracVsFrac(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2, { allowZero: true });
  if (!r) return null;
  const [a, b] = r;
  return withOp({
    display: {
      numer: [fConst(1)], denom: [fLin(1, -a)],
      rhsExpr: { numer: [fConst(1)], denom: [fLin(1, -b)] },
    },
    // 1/(x − a) − 1/(x − b) = (a − b) / ((x − a)(x − b))
    solve: { numer: [fConst(a - b)], denom: [fLin(1, -a), fLin(1, -b)] },
  }, op);
}

// 1/x + 1/(x − 2) ⩾ 0 — сумма дробей
function genFracSumTwo(P, opts) {
  const op = chooseOp(opts);
  const r = pickRoots(P, 2, { allowZero: true });
  if (!r) return null;
  const [a, b] = r;
  const minus = chance(0.35);
  return withOp({
    display: {
      terms: [
        { numer: [fConst(1)], denom: [fLin(1, -a)], sign: 1 },
        { numer: [fConst(1)], denom: [fLin(1, -b)], sign: minus ? -1 : 1 },
      ],
    },
    // сумма: (2x − a − b)/((x−a)(x−b)); разность: (a − b)/((x−a)(x−b))
    solve: {
      numer: minus ? [fConst(a - b)] : [fLin(2, -(a + b))],
      denom: [fLin(1, -a), fLin(1, -b)],
    },
  }, op);
}

// ─── Блок 7. Другие постановки ───────────────────────────────────────────────
/** Ограниченное решение: знак «меньше» на произведении двух скобок или на дроби */
function boundedExpr(P, opts) {
  const op = chooseOp(opts, ['lt', 'le']);
  if (!op) return null;
  const r = pickRoots(P, 2, { minGap: 3 });
  if (!r) return null;
  return chance(0.35)
    ? withOp(task([fLin(1, -r[0])], [fLin(1, -r[1])]), op)
    : withOp(task(linsOf(r)), op);
}

const genCountIntegers = (P, opts) => {
  const b = boundedExpr(P, opts);
  return b && { ...b, ask: { kind: 'count' } };
};

/** Три скобки: ответ упирается в крайний корень с одной стороны и уходит в ∞ с другой */
function halfBoundedExpr(P, opts, allowed) {
  const op = chooseOp(opts, allowed);
  if (!op) return null;
  const r = pickRoots(P, 3, { minGap: 2 });
  return r && withOp(task(linsOf(r)), op);
}

const genLeastInteger = (P, opts) => {
  const b = halfBoundedExpr(P, opts, ['gt', 'ge']);
  return b && { ...b, ask: { kind: 'least' } };
};

const genGreatestInteger = (P, opts) => {
  const b = halfBoundedExpr(P, opts, ['lt', 'le']);
  return b && { ...b, ask: { kind: 'greatest' } };
};

/**
 * Область определения. Знак здесь настройкой листа не выбирается: под корнем
 * выражение неотрицательно, под логарифмом строго положительно — это часть
 * постановки задачи, а не оформление неравенства.
 */
function genDomainSqrt(P, opts) {
  const r = pickRoots(P, chance(0.5) ? 3 : 2);
  if (!r) return null;
  const built = chance(0.5)
    ? task([fLin(1, -r[0])], [fLin(1, -r[1])])
    : task(linsOf(r));
  return { ...built, op: 'ge', ask: { kind: 'domain' } };
}

function genDomainLog(P, opts) {
  const r = pickRoots(P, chance(0.45) ? 3 : 2);
  if (!r) return null;
  const built = chance(0.4)
    ? task([fLin(1, -r[0])], [fLin(1, -r[1])])
    : task(linsOf(r));
  return { ...built, op: 'gt', ask: { kind: 'domainLog', base: rand([2, 3, 5, 10]) } };
}

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  // Блок 1
  prodTwo:        genProdTwo,
  prodThree:      genProdThree,
  prodFour:       genProdFour,
  prodZero:       genProdZero,
  prodNegLead:    genProdNegLead,
  prodCoefLin:    genProdCoefLin,
  prodConst:      genProdConst,
  // Блок 2
  squareFactor:   genSquareFactor,
  cubeFactor:     genCubeFactor,
  twoSquares:     genTwoSquares,
  highPower:      genHighPower,
  mixedMult:      genMixedMult,
  // Блок 3
  fracSimple:     genFracSimple,
  fracNumTwo:     genFracNumTwo,
  fracDenTwo:     genFracDenTwo,
  fracBoth:       genFracBoth,
  fracSqDen:      genFracSqDen,
  fracSqNum:      genFracSqNum,
  fracCoefLin:    genFracCoefLin,
  // Блок 4
  trinomFactor:   genTrinomFactor,
  trinomFrac:     genTrinomFrac,
  trinomDen:      genTrinomDen,
  diffSquares:    genDiffSquares,
  polyCommon:     genPolyCommon,
  polyGrouping:   genPolyGrouping,
  polyBiquad:     genPolyBiquad,
  // Блок 5
  posQuadFactor:  genPosQuadFactor,
  negQuadFactor:  genNegQuadFactor,
  posQuadDen:     genPosQuadDen,
  quadPairFrac:   genQuadPairFrac,
  // Блок 6
  fracVsConst:    genFracVsConst,
  fracVsUnit:     genFracVsUnit,
  fracVsFrac:     genFracVsFrac,
  fracSumTwo:     genFracSumTwo,
  // Блок 7
  countIntegers:  genCountIntegers,
  leastInteger:   genLeastInteger,
  greatestInteger: genGreatestInteger,
  domainSqrt:     genDomainSqrt,
  domainLog:      genDomainLog,
};

export const CATEGORY_LABELS_INTERVAL = {
  prodTwo:      'Две скобки: (x − 2)(x + 5) < 0',
  prodThree:    'Три скобки: (x − 1)(x − 3)(x + 2) ⩾ 0',
  prodFour:     'Четыре скобки: (x−1)(x−2)(x+3)(x+4) > 0',
  prodZero:     'Множитель x: x(x − 5)(x + 3) ⩽ 0',
  prodNegLead:  'Скобка с минусом: (3 − x)(x + 4) > 0',
  prodCoefLin:  'Дробные корни: (2x − 3)(x + 1) ⩽ 0',
  prodConst:    'Числовой множитель: −2(x − 1)(x + 4) > 0',

  squareFactor: 'Квадрат скобки: (x − 2)²(x + 1) > 0',
  cubeFactor:   'Куб скобки: (x − 2)³(x + 1) ⩽ 0',
  twoSquares:   'Два квадрата: (x − 1)²(x + 3)² ⩾ 0',
  highPower:    'Высокая степень: (x − 2)⁴(x + 5) < 0',
  mixedMult:    'Разные кратности: (x−1)²(x−4)³(x+2) ⩾ 0',

  fracSimple:   'Простейшая дробь: (x − 3)/(x + 2) ⩾ 0',
  fracNumTwo:   'Две скобки сверху: (x−1)(x+4)/(x−2) < 0',
  fracDenTwo:   'Две скобки снизу: (x−1)/((x−2)(x+3)) ⩾ 0',
  fracBoth:     'Сверху и снизу: (x−1)(x+2)/((x−3)(x+4)) ⩽ 0',
  fracSqDen:    'Квадрат в знаменателе: (x−1)/(x+2)² > 0',
  fracSqNum:    'Кратный корень сверху: (x−1)²(x+5)/(x−3) ⩽ 0',
  fracCoefLin:  'Дробные корни в дроби: (2x−1)/(3x+6) ⩾ 0',

  trinomFactor: 'Трёхчлен множителем: (x² − 5x + 6)(x + 1) ⩾ 0',
  trinomFrac:   'Трёхчлен сверху: (x² − 4)/(x − 3) < 0',
  trinomDen:    'Трёхчлен снизу: (x + 1)/(x² − 5x + 6) ⩽ 0',
  diffSquares:  'Разности квадратов: (x² − 9)(x² − 1) > 0',
  polyCommon:   'Вынести множитель: x³ − 4x ⩾ 0',
  polyGrouping: 'Группировка: x³ + 2x² − 9x − 18 > 0',
  polyBiquad:   'Биквадратное: x⁴ − 5x² + 4 < 0',

  posQuadFactor: 'Множитель без корней: (x² + 4)(x − 3) < 0',
  negQuadFactor: 'Отрицательный множитель: (−x² − 3)(x − 1) > 0',
  posQuadDen:    'Знаменатель без корней: (x − 2)/(x² + x + 1) ⩾ 0',
  quadPairFrac:  'Квадраты сверху и снизу: (x² + 4)/(x² − 9) ⩽ 0',

  fracVsConst:  'Дробь против числа: (x + 1)/(x − 2) ⩾ 1',
  fracVsUnit:   'Единица сверху: 1/(x − 3) > 2',
  fracVsFrac:   'Дробь против дроби: 1/(x − 1) ⩽ 1/(x + 2)',
  fracSumTwo:   'Сумма дробей: 1/x + 1/(x − 2) ⩾ 0',

  countIntegers:   'Сколько целых решений',
  leastInteger:    'Наименьшее целое решение',
  greatestInteger: 'Наибольшее целое решение',
  domainSqrt:      'Область определения корня',
  domainLog:       'Область определения логарифма',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в панели
export const CATEGORY_GROUPS_INTERVAL = [
  {
    label: 'Блок 1. Произведение скобок',
    keys: ['prodTwo', 'prodThree', 'prodFour', 'prodZero', 'prodNegLead',
           'prodCoefLin', 'prodConst'],
  },
  {
    label: 'Блок 2. Кратные корни',
    keys: ['squareFactor', 'cubeFactor', 'twoSquares', 'highPower', 'mixedMult'],
  },
  {
    label: 'Блок 3. Дробно-рациональные',
    keys: ['fracSimple', 'fracNumTwo', 'fracDenTwo', 'fracBoth', 'fracSqDen',
           'fracSqNum', 'fracCoefLin'],
  },
  {
    label: 'Блок 4. Сначала разложить',
    keys: ['trinomFactor', 'trinomFrac', 'trinomDen', 'diffSquares',
           'polyCommon', 'polyGrouping', 'polyBiquad'],
  },
  {
    label: 'Блок 5. Знакопостоянные множители',
    keys: ['posQuadFactor', 'negQuadFactor', 'posQuadDen', 'quadPairFrac'],
  },
  {
    label: 'Блок 6. Привести к «⋛ 0»',
    keys: ['fracVsConst', 'fracVsUnit', 'fracVsFrac', 'fracSumTwo'],
  },
  {
    label: 'Блок 7. Другие постановки',
    keys: ['countIntegers', 'leastInteger', 'greatestInteger',
           'domainSqrt', 'domainLog'],
  },
];

const ASK_CATS = new Set(CATEGORY_GROUPS_INTERVAL[6].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function intervalInstruction(categories = {}) {
  const on = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
  return on.some(k => ASK_CATS.has(k))
    ? 'Выполните задания:'
    : 'Решите неравенство методом интервалов:';
}

// ─── Переменные и настройки ──────────────────────────────────────────────────
const VAR_POOLS = {
  x:     ['x'],
  xy:    ['x', 'y'],
  mixed: ['x', 'y', 'a', 'b', 'z', 't', 'm', 'n'],
};

const OPS_MODES = {
  any:    ALL_OPS,
  strict: STRICT_OPS,
  loose:  LOOSE_OPS,
};

const ALL_CATS = Object.keys(CATEGORY_LABELS_INTERVAL);
const DEFAULT_ON = new Set([
  ...CATEGORY_GROUPS_INTERVAL[0].keys,
  'squareFactor', 'cubeFactor',
  'fracSimple', 'fracNumTwo', 'fracDenTwo',
]);

export const DEFAULT_SETTINGS_INTERVAL = {
  variantsCount:  4,
  questionsCount: 12,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,
  fontSize:       's',
  level:          2,             // 1 | 2 | 3 — размах чисел внутри одного приёма
  opsMode:        'any',         // any | strict | loose — какие знаки неравенства
  answerForm:     'interval',    // interval «(−∞; 2) ∪ (5; +∞)» | inequality
  rootKind:       'any',         // any | integer — какие корни допускаются
  varsMode:       'x',
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Проверка задания ────────────────────────────────────────────────────────
function boundAllowed(b, rootKind) {
  if (!sIsRat(b)) return false;                      // иррациональных границ здесь не бывает
  const v = sNum(b);
  if (!Number.isFinite(v) || Math.abs(v) > 60) return false;
  return rootKind === 'integer' ? b.p.d === 1 : b.p.d <= 12;
}

const boundsAllowed = (sol, rootKind) =>
  sol.pieces.every(p => [p.lo, p.hi].every(b => !b || boundAllowed(b, rootKind)));

/** Сокращающаяся дробь — не задание: (x − 2)(x + 1)/(x − 2) переписывают без дроби */
const reducible = (expr) =>
  criticalPoints(expr).some(p => p.numerMult > 0 && p.denomMult > 0);

const leastIntegerOf = (sol) => {
  const lo = sol.pieces[0]?.lo;
  if (!lo) return null;
  const start = Math.floor(sNum(lo)) - 1;
  for (let x = start; x <= start + 400; x++) if (contains(sol, x)) return x;
  return null;
};

const greatestIntegerOf = (sol) => {
  const hi = sol.pieces[sol.pieces.length - 1]?.hi;
  if (!hi) return null;
  const start = Math.ceil(sNum(hi)) + 1;
  for (let x = start; x >= start - 400; x--) if (contains(sol, x)) return x;
  return null;
};

const ASK_TAIL = {
  count:    '\\;\\text{— сколько целых решений?}',
  least:    '\\;\\text{— наименьшее целое решение}',
  greatest: '\\;\\text{— наибольшее целое решение}',
};

/**
 * Одно задание: строит выражение категории, решает его методом интервалов и
 * проверяет ответ численно по напечатанному неравенству. null — если случайные
 * числа не подошли (вызывающий просто пробует ещё раз).
 */
function buildQuestion(cat, varTex, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts.P, opts);
  if (!built || !built.op) return null;

  const { display, solve, op, ask } = built;
  if (reducible(solve)) return null;

  const solution = solveIntervalMethod(solve, op);
  // Главная страховка: ответ обязан совпасть с самим неравенством в пробных точках
  if (!verifyIntervalSolution(display, op, solution)) return null;
  if (!boundsAllowed(solution, opts.rootKind)) return null;

  const exprTex = `${renderTermsTex(display, varTex)} ${OPS[op].tex} ${rhsTex(display, varTex)}`;
  const answerTex = inequalityAnswerTex(solution, varTex, { form: opts.answerForm });

  if (ask) {
    if (ask.kind === 'domain' || ask.kind === 'domainLog') {
      if (!solution.pieces.length) return null;       // пустая область определения — не задание
      const inner = renderTermsTex(display, varTex);
      const body = ask.kind === 'domain'
        ? `\\sqrt{${inner}}`
        : `\\log_{${ask.base}}\\left(${inner}\\right)`;
      return {
        exprLatex: `D\\left(${body}\\right) = {?}`,
        resultLatex: answerTex,
        varLatex: varTex,
        solution,
        cat,
      };
    }

    if (ask.kind === 'count' && !isBounded(solution)) return null;
    const ints = integerSolutions(solution, 120);
    if (!ints.length) return null;
    if (ask.kind === 'count' && ints.length > 30) return null;
    const value = ask.kind === 'count' ? ints.length
      : ask.kind === 'least' ? leastIntegerOf(solution)
      : greatestIntegerOf(solution);
    if (value === null || value === undefined) return null;
    return {
      exprLatex: `${exprTex} ${ASK_TAIL[ask.kind]}`,
      resultLatex: String(value),
      varLatex: varTex,
      solution: { ...solution, value },
      cat,
    };
  }

  return {
    exprLatex: exprTex,
    resultLatex: answerTex,
    varLatex: varTex,
    solution,
    cat,
  };
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateIntervalMethodVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_INTERVAL, ...settings };
  const vars = VAR_POOLS[s.varsMode] || VAR_POOLS.x;
  const opts = {
    P: pools(s.level),
    ops: OPS_MODES[s.opsMode] || ALL_OPS,
    answerForm: s.answerForm,
    rootKind: s.rootKind,
  };

  // Повторы отклоняем, но не бесконечно: у узких категорий их не избежать,
  // а лист не должен оказаться короче заказанного
  const seen = new Set();
  let repeats = 0;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: s.rootKind === 'integer' ? 200 : 120,
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
export function useIntervalMethod() {
  const [title, setTitle] = useState('Метод интервалов');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_INTERVAL });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_INTERVAL,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateIntervalMethodVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Метод интервалов');
    setSettings({ ...DEFAULT_SETTINGS_INTERVAL });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
