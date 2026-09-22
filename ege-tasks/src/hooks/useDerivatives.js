import { useState, useCallback } from 'react';

/**
 * Тренажёр «Вычисление производных» (раздел «Функции»).
 *
 * Категория строит только ФУНКЦИЮ — деревом узлов из `utils/derivativeCalc`.
 * Производную считает ядро по правилам дифференцирования (сумма, постоянный
 * множитель, произведение, частное, сложная функция), оно же упрощает и
 * печатает ответ. Руками ответ не пишется нигде.
 *
 * Перед выдачей каждое задание проверяется численно: производная из ответа
 * обязана совпасть с разностной производной НАПЕЧАТАННОЙ функции. У категорий,
 * где функцию сначала преобразуют («раскрыть скобки», «почленное деление»),
 * печатается одно выражение, а дифференцируется другое — сверка всё равно идёт
 * по напечатанному, поэтому ошибка преобразования до листа не доедет.
 *
 * Типичные ошибки (u′v′ вместо правила произведения, забытая производная
 * внутренней функции, минус в числителе частного) ядро тоже умеет считать —
 * из них собираются неверные ответы для теста A/B/C/D (`q.mistakes`).
 */

import { rat, rand, randInt, chance, fmtNum } from '../utils/linearExpr';
import {
  N, X, PI, add, mul, pow, fn, logA, apow, sqrt, exp, ln, sin, cos, tg, ctg,
  mono, poly, lin, neg, polyOf, derivative, diff, simplify, tex, texAsIs, evalAt,
  verifyDerivative, sameFunction, toNiceRational,
} from '../utils/derivativeCalc';
import { generateByCategories } from '../utils/questionPlan';
import { useApplySheet } from './useApplySheet';

// Размах чисел внутри одного и того же приёма: коэффициенты и показатели
// растут, правило дифференцирования остаётся прежним
const LEVELS = {
  1: {
    coefs: [2, 3, 4, 5], pows: [2, 3, 4, 5], shifts: [1, 2, 3, 4, 5],
    linA: [1, 2, 3], roots: [3], deg: [2, 3], chainPows: [2, 3, 4],
  },
  2: {
    coefs: [2, 3, 4, 5, 6, 7, 8, 9], pows: [2, 3, 4, 5, 6, 7, 8],
    shifts: [1, 2, 3, 4, 5, 6, 7, 8, 9], linA: [1, 2, 3, 4, 5], roots: [3, 4],
    deg: [3, 4], chainPows: [2, 3, 4, 5, 6],
  },
  3: {
    coefs: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20],
    pows: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    shifts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], linA: [2, 3, 4, 5, 6, 7],
    roots: [3, 4, 5], deg: [4, 5], chainPows: [3, 4, 5, 6, 7, 8, 10],
  },
};

const pools = (level) => LEVELS[level] || LEVELS[2];

// ─── Случайные заготовки ─────────────────────────────────────────────────────
const sg = (v) => (chance(0.5) ? -v : v);
const sCoef = (P) => sg(rand(P.coefs));
/** c·u, при c = 1 — просто u */
const term = (c, u) => (c === 1 ? u : mul(N(c), u));
/** Иногда с коэффициентом, иногда без */
const maybeCoef = (P, u, p = 0.5) => term(chance(p) ? sCoef(P) : 1, u);
const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5);

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/**
 * ax + b, b ≠ 0, без общего множителя (не «4x + 6»). Если x идёт с минусом,
 * свободный член положительный: «(3 − x)», а не «(−x − 3)».
 */
function rLin(P, a = rand(P.linA)) {
  let b = rand(P.shifts);
  for (let i = 0; i < 10 && gcd(a, b) > 1; i++) b = rand(P.shifts);
  if (gcd(a, b) > 1) b = 1;
  return chance(0.2) ? lin(-a, b) : lin(a, sg(b));
}

/** x² + bx + c или x² + c */
function rQuad(P, { full = chance(0.6) } = {}) {
  const c = sg(randInt(1, P.shifts.length + 2));
  return full ? poly([c, sg(randInt(1, 6)), 1]) : poly([c, 0, 1]);
}

/** Многочлен степени deg с ненулевым старшим коэффициентом */
function rPoly(P, deg) {
  const coefs = [];
  for (let k = 0; k < deg; k++) coefs.push(chance(0.75) ? sg(rand([1, ...P.coefs])) : 0);
  coefs.push(chance(0.3) ? 1 : sCoef(P));
  if (coefs.slice(1, deg).every(c => c === 0)) coefs[1] = sg(rand(P.coefs));
  return poly(coefs);
}

/** Взаимно простые с q числители */
const coprimeTo = (q, max) => {
  const out = [];
  const g = (a, b) => (b ? g(b, a % b) : a);
  for (let p = 1; p <= max; p++) if (p % q && g(p, q) === 1) out.push(p);
  return out;
};

const TRIG = ['sin', 'cos'];
const TRIG4 = ['sin', 'cos', 'tg', 'ctg'];
const BASES = [2, 3, 5, 7, 10];
const kx = (k) => (k === 1 ? X : mul(N(k), X));

// ─── Блок 1. Табличные: степень и корень ────────────────────────────────────

// y = 7, y = 3x − 5, y = x
function genTConst(P) {
  if (chance(0.3)) return { f: N(sg(randInt(2, 25))) };
  if (chance(0.15)) return { f: X };
  return { f: lin(sCoef(P), sg(rand(P.shifts))) };
}

// y = x⁷, y = 4x⁵
function genTPower(P) {
  const n = rand(P.pows);
  return { f: chance(0.5) ? pow(X, n) : mono(sCoef(P), n) };
}

// y = 1/x³, y = 2x⁻⁴
function genTNegPower(P) {
  const n = randInt(1, P.pows.length > 5 ? 6 : 4);
  const view = chance(0.35) ? 'power' : undefined;
  return { f: maybeCoef(P, pow(X, -n, view)) };
}

// y = √x, y = 6√x, y = 1/√x
function genTSqrt(P) {
  const e = chance(0.25) ? rat(-1, 2) : rat(1, 2);
  return { f: maybeCoef(P, pow(X, e)) };
}

// y = ∛x, y = ∜x³, y = x∛x
function genTRoot(P) {
  const q = rand(P.roots);
  const p = rand(coprimeTo(q, 2 * q));
  return { f: maybeCoef(P, pow(X, rat(p, q)), 0.3) };
}

// y = x^{3/2}, y = x^{−2/3}
function genTFracPower(P) {
  const q = rand([2, 3, 4, 5].slice(0, P.roots.length + 1));
  const p = sg(rand(coprimeTo(q, 3 * q)));
  return { f: maybeCoef(P, pow(X, rat(p, q), 'power'), 0.3) };
}

// ─── Блок 2. Табличные: тригонометрия, показательная, логарифм ─────────────

// y = 3 cos x, y = tg x
function genTTrig(P) {
  return { f: maybeCoef(P, fn(rand(TRIG4), X)) };
}

// y = eˣ, y = 5eˣ
function genTExp(P) {
  return { f: maybeCoef(P, exp(X), 0.6) };
}

// y = 3ˣ, y = 2·5ˣ
function genTAexp(P) {
  return { f: maybeCoef(P, apow(rand(BASES), X), 0.35) };
}

// y = ln x, y = 4 ln x
function genTLn(P) {
  return { f: maybeCoef(P, ln(X), 0.6) };
}

// y = log₂ x
function genTLog(P) {
  return { f: maybeCoef(P, logA(rand(BASES), X), 0.3) };
}

// y = arcsin x, y = 2 arctg x
function genTArc(P) {
  return { f: maybeCoef(P, fn(rand(['arcsin', 'arccos', 'arctg', 'arcctg']), X), 0.35) };
}

// ─── Блок 3. Сумма и постоянный множитель ───────────────────────────────────

// y = 2x³ − 5x² + 7x − 1
function genSPoly(P) {
  return { f: rPoly(P, rand(P.deg) + (chance(0.3) ? 1 : 0)) };
}

// y = x³/3 − x²/2 + 4x — производная с целыми коэффициентами
function genSPolyFrac(P) {
  const deg = rand(P.deg.map(d => Math.max(d, 3)));
  const coefs = [chance(0.5) ? sg(randInt(1, 9)) : 0, sg(randInt(1, 9))];
  let fracs = 0;
  for (let k = 2; k <= deg; k++) {
    if (k < deg && chance(0.25)) { coefs.push(0); continue; }
    let m = sg(randInt(1, k === deg ? 3 : 7));
    if (m % k === 0) m += m > 0 ? 1 : -1;
    coefs.push(rat(m, k));
    fracs += 1;
  }
  if (fracs < 2) return null;
  return { f: poly(coefs) };
}

// y = x⁴ − 2/x + 3√x
function genSPowers(P) {
  const parts = [
    mono(sg(rand([1, ...P.coefs])), rand(P.pows)),
    term(sCoef(P), pow(X, -randInt(1, 3))),
    term(sg(rand([1, ...P.coefs])), pow(X, rat(1, rand([2, 2, ...P.roots])))),
  ];
  return { f: add(...shuffled(parts).slice(0, chance(0.3) ? 2 : 3)) };
}

// y = 3 sin x − x² + 2 cos x
function genSTrig(P) {
  const parts = [
    term(sg(rand([1, ...P.coefs])), sin(X)),
    term(sg(rand([1, ...P.coefs])), cos(X)),
    mono(sg(rand([1, ...P.coefs])), rand(P.pows)),
  ];
  if (chance(0.35)) parts.push(term(sg(rand([1, ...P.coefs])), fn(rand(['tg', 'ctg']), X)));
  return { f: add(...shuffled(parts).slice(0, 3)) };
}

// y = 2eˣ − 5 ln x + x³
function genSExpLog(P) {
  const parts = shuffled([
    term(sg(rand([1, ...P.coefs])), exp(X)),
    term(sg(rand([1, ...P.coefs])), ln(X)),
    term(sg(rand([1, 2, 3])), apow(rand(BASES), X)),
    term(sg(rand([1, 2, 3])), logA(rand(BASES), X)),
    mono(sg(rand([1, ...P.coefs])), rand(P.pows)),
    mono(sg(rand([1, ...P.coefs])), rat(1, 2)),
  ]).slice(0, 3);
  return { f: add(...parts) };
}

// y = (x³ − 2x + 1)/x → x² − 2 + 1/x
function genSSplit(P) {
  const d = chance(0.7) ? 1 : 2;
  const deg = d + randInt(1, 2);
  const coefs = Array.from({ length: deg + 1 }, (_, k) => {
    if (k === deg) return chance(0.5) ? 1 : sCoef(P);
    if (k === d) return 0;                              // иначе слагаемое сократится в число
    return chance(0.7) ? sg(rand([1, ...P.coefs])) : 0;
  });
  if (!coefs.slice(0, d).some(Boolean)) coefs[0] = sg(rand(P.coefs));
  const f = mul(poly(coefs), pow(X, -d));
  const solve = add(...coefs.map((c, k) => (c ? mono(c, k - d) : null)).filter(Boolean).reverse());
  return { f, solve };
}

// y = (x − 2)(x + 3), y = x²(x − 3), y = (2x + 1)² — раскрыть скобки
function genSExpand(P) {
  const kind = randInt(0, 3);
  let f;
  if (kind === 0) f = mul(rLin(P, 1), rLin(P, 1));
  else if (kind === 1) f = mul(pow(X, rand([1, 2, 2, 3])), rLin(P));
  else if (kind === 2) f = pow(rLin(P), 2);
  else f = mul(rLin(P), rLin(P));
  const p = polyOf(f, 3);
  return p ? { f, solve: poly(p) } : null;
}

// ─── Блок 4. Производная произведения ───────────────────────────────────────

// (x² + 1)(x − 3)
function genPPolyPoly(P) {
  const r = Math.random();
  if (r < 0.4) return { f: mul(rLin(P), rLin(P)) };
  if (r < 0.8) return { f: mul(rQuad(P), rLin(P, 1)) };
  const a = rQuad(P);
  const b = rQuad(P, { full: false });
  return tex(a) === tex(b) ? null : { f: mul(a, b) };
}

// x³ sin x, 2x² cos x
function genPPowTrig(P) {
  const name = rand(P.coefs.length > 8 ? TRIG4 : TRIG);
  return { f: mul(mono(chance(0.7) ? 1 : sCoef(P), randInt(1, 4)), fn(name, X)) };
}

// x²eˣ, (x − 2)eˣ
function genPPowExp(P) {
  const left = chance(0.3) ? rLin(P, 1) : mono(chance(0.75) ? 1 : sCoef(P), randInt(1, 4));
  return { f: mul(left, exp(X)) };
}

// x³ ln x, x ln x
function genPPowLn(P) {
  const k = chance(0.2) ? rat(1, 2) : randInt(1, 5);
  return { f: mul(mono(chance(0.75) ? 1 : sCoef(P), k), ln(X)) };
}

// √x·(x − 4), √x·ln x
function genPSqrt(P) {
  if (chance(0.3)) return { f: mul(sqrt(X), ln(X)) };
  return { f: mul(sqrt(X), rLin(P)) };
}

// eˣ sin x, eˣ cos x
function genPExpTrig(P) {
  return { f: maybeCoef(P, mul(exp(X), fn(rand(TRIG), X)), 0.2) };
}

// sin x cos x, x tg x, x² ctg x
function genPTrigTrig(P) {
  const r = Math.random();
  if (r < 0.3) return { f: mul(sin(X), cos(X)) };
  if (r < 0.55) return { f: mul(mono(1, randInt(1, 2)), fn(rand(['tg', 'ctg']), X)) };
  if (r < 0.8) return { f: mul(fn(rand(TRIG), X), ln(X)) };
  return { f: mul(exp(X), fn(rand(['tg', 'ctg']), X)) };
}

// x eˣ sin x — три множителя
function genPThree(P) {
  const r = Math.random();
  if (r < 0.4) return { f: mul(mono(1, randInt(1, 2)), exp(X), fn(rand(TRIG), X)) };
  if (r < 0.7) return { f: mul(X, sin(X), cos(X)) };
  return { f: mul(mono(1, randInt(1, 2)), exp(X), ln(X)) };
}

// ─── Блок 5. Производная частного ───────────────────────────────────────────

const frac = (u, v) => mul(u, pow(v, -1));
const nonReducible = (numer, den) => {
  const pn = polyOf(numer, 3);
  const pd = polyOf(den, 3);
  if (!pn || !pd || pd.length !== 2) return true;
  const root = -pd[0].n * pd[1].d / (pd[0].d * pd[1].n);
  return Math.abs(evalAt(numer, root)) > 1e-9;
};

// (2x + 1)/(x − 3)
function genQLinLin(P) {
  const u = rLin(P);
  const v = rLin(P);
  if (!nonReducible(u, v)) return null;
  const pu = polyOf(u); const pv = polyOf(v);
  const det = pu[1].n * pv[0].n - pu[0].n * pv[1].n;
  if (det === 0) return null;
  return { f: frac(u, v) };
}

// x²/(x + 1), (x² − 3)/(x − 2)
function genQPolyLin(P) {
  const numer = chance(0.35) ? mono(1, 2) : rQuad(P);
  const den = rLin(P, chance(0.7) ? 1 : 2);
  return nonReducible(numer, den) ? { f: frac(numer, den) } : null;
}

// 3/(x² + 1), 5/(2x − 1)
function genQConst(P) {
  const den = chance(0.5) ? poly([rand(P.shifts), 0, 1]) : rLin(P);
  return { f: term(sCoef(P), pow(den, -1)) };
}

// (x² + 1)/(x² − 1)
function genQQuadQuad(P) {
  const a = sg(rand(P.shifts));
  let b = sg(rand(P.shifts));
  if (a === b) b = -b;
  return { f: frac(poly([a, 0, 1]), poly([b, 0, 1])) };
}

// sin x/x, x/cos x, cos x/x²
function genQTrig(P) {
  const t = fn(rand(TRIG), X);
  const r = Math.random();
  if (r < 0.45) return { f: frac(t, mono(1, randInt(1, 2))) };
  if (r < 0.85) return { f: frac(mono(1, randInt(1, 2)), t) };
  return { f: frac(t, fn(rand(['sin', 'cos'].filter(n => n !== t.name)), X)) };
}

// eˣ/x, x/eˣ, eˣ/(x + 1)
function genQExp(P) {
  const r = Math.random();
  if (r < 0.35) return { f: frac(exp(X), mono(1, randInt(1, 2))) };
  if (r < 0.7) return { f: frac(mono(1, randInt(1, 2)), exp(X)) };
  return { f: frac(exp(X), rLin(P, 1)) };
}

// ln x/x, x/ln x, ln x/x²
function genQLn(P) {
  const r = Math.random();
  if (r < 0.45) return { f: frac(ln(X), mono(1, randInt(1, 3))) };
  if (r < 0.8) return { f: frac(mono(1, randInt(1, 2)), ln(X)) };
  return { f: frac(ln(X), rLin(P, 1)) };
}

// ─── Блок 6. Сложная функция ────────────────────────────────────────────────

// (3x − 2)⁵
function genCLinPow(P) {
  return { f: maybeCoef(P, pow(rLin(P, rand(P.linA.filter(a => a > 1).concat([2]))), rand(P.chainPows)), 0.2) };
}

// (x² − 3x + 1)⁴
function genCPolyPow(P) {
  const inner = chance(0.8) ? rQuad(P) : rPoly(P, 3);
  return { f: pow(inner, rand(P.chainPows)) };
}

// √(2x + 3), √(x² + 1)
function genCSqrt(P) {
  const inner = chance(0.5) ? rLin(P, rand(P.linA.concat([2]).filter(a => a > 1))) : rQuad(P);
  const e = chance(0.25) && P.roots.length > 1 ? rat(1, 3) : rat(1, 2);
  return { f: maybeCoef(P, pow(inner, e), 0.25) };
}

// 1/(2x − 1)³
function genCNegPow(P) {
  const inner = chance(0.75) ? rLin(P, rand([2, 3, ...P.linA])) : rQuad(P, { full: false });
  return { f: maybeCoef(P, pow(inner, -randInt(1, 4)), 0.35) };
}

/** Аргумент тригонометрической функции: 3x, 2x + 1, 2x − π/3 */
function trigArg(P) {
  const k = rand([2, 3, 4, 5, ...P.linA]) * (chance(0.15) ? -1 : 1);
  const r = Math.random();
  if (r < 0.35) return kx(Math.abs(k));
  if (r < 0.7) return lin(k, sg(rand(P.shifts)));
  const d = rand([2, 3, 4, 6]);
  return add(kx(Math.abs(k)), mul(N(sg(1), d), PI));
}

// sin(3x + 1), cos(2x − π/3)
function genCTrigLin(P) {
  return { f: maybeCoef(P, fn(rand(TRIG), trigArg(P)), 0.3) };
}

// tg 2x, ctg(3x + 1)
function genCTgLin(P) {
  return { f: maybeCoef(P, fn(rand(['tg', 'ctg']), trigArg(P)), 0.25) };
}

// e^{3x − 1}, e^{x²}, e^{−x}
function genCExp(P) {
  const r = Math.random();
  let arg;
  if (r < 0.45) arg = rLin(P, rand([2, 3, 4, 5, ...P.linA]));
  else if (r < 0.65) arg = mul(N(-rand([1, 2, 3])), X);
  else if (r < 0.85) arg = mono(sg(rand([1, 2, 3])), 2);
  else arg = rQuad(P);
  return { f: maybeCoef(P, exp(arg), 0.25) };
}

// 2^{3x}, 5^{1 − x}
function genCAexp(P) {
  const arg = chance(0.5) ? kx(rand([2, 3, 4, 5])) : lin(sg(rand([1, 2, 3])), sg(rand(P.shifts)));
  return { f: apow(rand(BASES), arg) };
}

// ln(2x + 5), ln(x² + 1), log₃(2x − 1)
function genCLn(P) {
  const r = Math.random();
  if (r < 0.4) return { f: maybeCoef(P, ln(rLin(P, rand([2, 3, 4, 5, ...P.linA]))), 0.2) };
  if (r < 0.75) return { f: ln(rQuad(P)) };
  return { f: logA(rand(BASES), rLin(P, rand([2, 3, 4, 5]))) };
}

// sin²x, cos³x, tg²x
function genCTrigPow(P) {
  const name = rand(P.coefs.length > 8 ? TRIG4 : TRIG);
  return { f: maybeCoef(P, pow(fn(name, X), rand([2, 2, 3, 4, ...P.chainPows.slice(0, 2)])), 0.2) };
}

// sin²3x, e^{sin x}, ln cos x, cos(x²), √(ln x)
function genCNested(P) {
  const k = rand([2, 3, 4, 5]);
  const opts = [
    () => pow(fn(rand(TRIG), kx(k)), rand([2, 3])),
    () => exp(fn(rand(TRIG), X)),
    () => ln(fn(rand(TRIG), X)),
    () => fn(rand(TRIG), mono(1, 2)),
    () => fn(rand(TRIG), sqrt(X)),
    () => sqrt(ln(X)),
    () => ln(ln(X)),
    () => exp(sqrt(X)),
    () => pow(ln(X), rand([2, 3])),
    () => sqrt(fn('sin', X)),
  ];
  return { f: rand(opts)() };
}

// ─── Блок 7. Правила вместе ─────────────────────────────────────────────────

// x²e^{3x}, x sin 2x, x√(2x + 1)
function genMProdChain(P) {
  const k = rand([2, 3, 4, 5]);
  const opts = [
    () => mul(mono(1, randInt(1, 3)), exp(mul(N(sg(k)), X))),
    () => mul(X, fn(rand(TRIG), kx(k))),
    () => mul(X, sqrt(rLin(P, rand([2, 3, 4])))),
    () => mul(mono(1, randInt(1, 2)), ln(kx(k))),
    () => mul(X, pow(rLin(P, 1), rand([2, 3, 4]))),
  ];
  return { f: rand(opts)() };
}

// e^{2x}/x, sin 2x/x, x/(2x + 1)²
function genMQuotChain(P) {
  const k = rand([2, 3, 4, 5]);
  const opts = [
    () => frac(exp(kx(k)), X),
    () => frac(fn(rand(TRIG), kx(k)), X),
    () => frac(X, pow(rLin(P, rand([1, 2, 3])), 2)),
    () => frac(X, sqrt(rQuad(P, { full: false }))),
    () => frac(ln(kx(k)), X),
  ];
  const f = rand(opts)();
  return { f };
}

// (x + 1)²(x − 2)³, e^{2x} sin 3x
function genMChainProd(P) {
  if (chance(0.5)) {
    const a = rLin(P, 1);
    let b = rLin(P, 1);
    if (tex(a) === tex(b)) b = lin(1, -polyOf(a)[0].n || 1);
    return { f: mul(pow(a, randInt(2, 3)), pow(b, randInt(2, 3))) };
  }
  const k = rand([1, 2, 3]);
  return { f: mul(exp(kx(k)), fn(rand(TRIG), kx(rand([2, 3, 4])))) };
}

// sin 2x + e^{3x} − ln(4x + 1)
function genMSumChain(P) {
  const k = () => rand([2, 3, 4, 5]);
  const pool = [
    () => term(sg(rand([1, 2, 3])), fn(rand(TRIG), kx(k()))),
    () => term(sg(rand([1, 2, 3])), exp(kx(k()))),
    () => term(sg(rand([1, 2])), ln(rLin(P, k()))),
    () => term(sg(1), pow(rLin(P, k()), rand([2, 3, 4]))),
    () => term(sg(rand([1, 2])), sqrt(rLin(P, k()))),
    () => term(sg(rand([1, 2])), fn(rand(['tg', 'ctg']), kx(k()))),
  ];
  return { f: add(...shuffled(pool).slice(0, randInt(2, 3)).map(g => g())) };
}

// ─── Блок 8. Значение производной и приложения ─────────────────────────────

const pt = (v, t) => ({ v, tex: t ?? String(v) });

/** Функция и целая точка, где производная «круглая» (правила, не многочлен) */
function rulesAtPoint(P) {
  const x0 = randInt(-3, 4);
  const opts = [
    () => pow(rLin(P, rand([2, 3])), rand([3, 4, 5])),
    () => sqrt(rLin(P, rand([1, 2, 3, 4]))),
    () => frac(rLin(P), rLin(P, 1)),
    () => mul(rLin(P, 1), pow(rLin(P, 1), 2)),
    () => frac(rQuad(P, { full: false }), rLin(P, 1)),
    () => pow(rQuad(P), 2),
  ];
  return { f: rand(opts)(), x0: pt(x0) };
}

/** Трансцендентная функция и точка, где значения известны: 0, 1, π/2 … */
function transAtPoint(P) {
  const k = rand([2, 3, 4]);
  const opts = [
    () => ({ f: mul(mono(1, randInt(1, 2)), exp(X)), x0: pt(0) }),
    () => ({ f: add(exp(kx(k)), mono(sCoef(P), 1)), x0: pt(0) }),
    () => ({ f: exp(lin(k, -k)), x0: pt(1) }),
    () => ({ f: mul(mono(1, randInt(1, 3)), ln(X)), x0: pt(1) }),
    () => ({ f: add(term(sCoef(P), ln(X)), mono(1, randInt(2, 3))), x0: pt(1) }),
    () => ({ f: ln(lin(k, 1 - k)), x0: pt(1) }),
    () => ({ f: term(sCoef(P), sin(kx(k))), x0: pt(0) }),
    () => ({ f: term(sCoef(P), fn('cos', X)), x0: pt(Math.PI / 2, '\\frac{\\pi}{2}') }),
    () => ({ f: mul(X, sin(X)), x0: pt(Math.PI / 2, '\\frac{\\pi}{2}') }),
    () => ({ f: mul(X, cos(X)), x0: pt(0) }),
    () => ({ f: term(sCoef(P), tg(X)), x0: pt(Math.PI / 4, '\\frac{\\pi}{4}') }),
    () => ({ f: add(term(rand([2, 4, 6]), sin(X)), mono(sCoef(P), 1)), x0: pt(Math.PI / 3, '\\frac{\\pi}{3}') }),
    () => ({ f: mul(exp(X), sin(X)), x0: pt(0) }),
    () => ({ f: frac(ln(X), X), x0: pt(1) }),
  ];
  return rand(opts)();
}

function genVPoly(P) {
  return { f: rPoly(P, rand(P.deg)), ask: 'value', x0: pt(sg(randInt(1, P.shifts.length > 9 ? 4 : 3))) };
}

function genVRules(P) {
  return { ...rulesAtPoint(P), ask: 'value' };
}

function genVTrans(P) {
  return { ...transAtPoint(P), ask: 'value' };
}

function genVSlope(P) {
  const base = chance(0.5) ? { f: rPoly(P, rand([2, 3])), x0: pt(sg(randInt(1, 3))) }
    : chance(0.5) ? rulesAtPoint(P) : transAtPoint(P);
  return { ...base, ask: 'slope' };
}

function genVTangent(P) {
  const r = Math.random();
  let base;
  if (r < 0.55) base = { f: rPoly(P, rand([2, 2, 3])), x0: pt(sg(randInt(0, 2))) };
  else if (r < 0.8) base = rulesAtPoint(P);
  else base = transAtPoint(P);
  return { ...base, ask: 'tangent' };
}

// f′(x) = 0 в целых точках: f = x³ − 3(r₁ + r₂)/2·x² + 3r₁r₂x + c
function genVStationary(P) {
  const c = sg(randInt(0, 9));
  if (chance(0.25)) {
    const r = randInt(-6, 6);
    const a = sg(rand([1, 2, 3]));
    return { f: poly([c, -2 * a * r, a]), ask: 'stationary', roots: [r] };
  }
  if (chance(0.2)) {
    // x + a²/x → x = ±a
    const a = randInt(1, 6);
    return { f: add(X, term(a * a, pow(X, -1))), ask: 'stationary', roots: [-a, a] };
  }
  let r1 = randInt(-5, 5);
  let r2 = randInt(-5, 5);
  if (r1 === r2) return null;
  if (r1 > r2) [r1, r2] = [r2, r1];
  const s = sg(1);
  const f = (r1 + r2) % 2 === 0
    ? poly([c, 3 * r1 * r2 * s, -3 * ((r1 + r2) / 2) * s, s])
    : poly([c, 6 * r1 * r2 * s, -3 * (r1 + r2) * s, 2 * s]);
  return { f, ask: 'stationary', roots: [r1, r2] };
}

// y″
function genVSecond(P) {
  const k = rand([2, 3, 4]);
  const opts = [
    () => rPoly(P, rand([3, 4, 5])),
    () => term(sCoef(P), fn(rand(TRIG), kx(k))),
    () => term(sCoef(P), exp(kx(k))),
    () => mul(X, exp(X)),
    () => mul(X, ln(X)),
    () => ln(X),
    () => pow(X, -1),
    () => pow(rLin(P, rand([2, 3])), rand([3, 4, 5])),
    () => add(mono(sCoef(P), 3), term(sCoef(P), sin(X))),
  ];
  return { f: rand(opts)(), ask: 'second' };
}

/** Закон движения x(t) — многочлен от t */
function motionPoly(P, deg) {
  const coefs = [randInt(0, 12), sg(randInt(1, 9)), sg(randInt(1, 6))];
  if (deg === 3) coefs.push(rand([1, 1, 2, rat(1, 3)]));
  return poly(coefs);
}

function genVVelocity(P) {
  return { f: motionPoly(P, chance(0.7) ? 3 : 2), ask: 'velocity', x0: pt(randInt(1, 6)) };
}

function genVAccel(P) {
  return { f: motionPoly(P, 3), ask: 'accel', x0: pt(randInt(1, 6)) };
}

// x(t) = at² + bt + c; в какой момент v = V?
function genVWhenSpeed(P) {
  const t = randInt(1, 8);
  const a = rand([1, 2, 3, rat(1, 2)]);
  const ar = typeof a === 'number' ? rat(a) : a;
  const b = sg(randInt(1, 9));
  const V = 2 * ar.n * t / ar.d + b;
  if (!Number.isInteger(V) || V <= 0) return null;
  return { f: poly([randInt(0, 12), b, a]), ask: 'whenSpeed', V, t };
}

// ─── Реестр категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  tConst: genTConst, tPower: genTPower, tNegPower: genTNegPower,
  tSqrt: genTSqrt, tRoot: genTRoot, tFracPower: genTFracPower,

  tTrig: genTTrig, tExp: genTExp, tAexp: genTAexp,
  tLn: genTLn, tLog: genTLog, tArc: genTArc,

  sPoly: genSPoly, sPolyFrac: genSPolyFrac, sPowers: genSPowers,
  sTrig: genSTrig, sExpLog: genSExpLog, sSplit: genSSplit, sExpand: genSExpand,

  pPolyPoly: genPPolyPoly, pPowTrig: genPPowTrig, pPowExp: genPPowExp,
  pPowLn: genPPowLn, pSqrt: genPSqrt, pExpTrig: genPExpTrig,
  pTrigTrig: genPTrigTrig, pThree: genPThree,

  qLinLin: genQLinLin, qPolyLin: genQPolyLin, qConst: genQConst,
  qQuadQuad: genQQuadQuad, qTrig: genQTrig, qExp: genQExp, qLn: genQLn,

  cLinPow: genCLinPow, cPolyPow: genCPolyPow, cSqrt: genCSqrt,
  cNegPow: genCNegPow, cTrigLin: genCTrigLin, cTgLin: genCTgLin,
  cExp: genCExp, cAexp: genCAexp, cLn: genCLn, cTrigPow: genCTrigPow,
  cNested: genCNested,

  mProdChain: genMProdChain, mQuotChain: genMQuotChain,
  mChainProd: genMChainProd, mSumChain: genMSumChain,

  vPoly: genVPoly, vRules: genVRules, vTrans: genVTrans, vSlope: genVSlope,
  vTangent: genVTangent, vStationary: genVStationary, vSecond: genVSecond,
  vVelocity: genVVelocity, vAccel: genVAccel, vWhenSpeed: genVWhenSpeed,
};

export const CATEGORY_LABELS_DERIV = {
  tConst:     'Константа и линейная: y = 7, y = 3x − 5',
  tPower:     'Степень: y = x⁷, y = 4x⁵',
  tNegPower:  'Отрицательная степень: y = 1/x³, y = x⁻²',
  tSqrt:      'Квадратный корень: y = √x, y = 1/√x',
  tRoot:      'Корень n-й степени: y = ∛x, y = ∜x³',
  tFracPower: 'Дробный показатель: y = x^{3/2}',

  tTrig:  'Тригонометрия: sin, cos, tg, ctg',
  tExp:   'Экспонента: y = eˣ, y = 5eˣ',
  tAexp:  'Показательная: y = 3ˣ',
  tLn:    'Натуральный логарифм: y = ln x',
  tLog:   'Логарифм по основанию: y = log₂ x',
  tArc:   'Обратные тригонометрические: arcsin x, arctg x',

  sPoly:     'Многочлен: y = 2x³ − 5x² + 7x − 1',
  sPolyFrac: 'Дробные коэффициенты: y = x³/3 − x²/2 + 4x',
  sPowers:   'Степени и корни: y = x⁴ − 2/x + 3√x',
  sTrig:     'С тригонометрией: y = 3 sin x − x² + 2 cos x',
  sExpLog:   'С eˣ и логарифмом: y = 2eˣ − 5 ln x + x³',
  sSplit:    'Почленное деление: y = (x³ − 2x + 1)/x',
  sExpand:   'Раскрыть скобки: y = (x − 2)(x + 3)',

  pPolyPoly: 'Два многочлена: y = (x² + 1)(x − 3)',
  pPowTrig:  'Степень на тригонометрию: y = x³ sin x',
  pPowExp:   'Степень на экспоненту: y = x²eˣ',
  pPowLn:    'Степень на логарифм: y = x³ ln x',
  pSqrt:     'С корнем: y = √x·(x − 4)',
  pExpTrig:  'Экспонента на тригонометрию: y = eˣ sin x',
  pTrigTrig: 'Тригонометрия: y = sin x cos x, y = x tg x',
  pThree:    'Три множителя: y = x eˣ sin x',

  qLinLin:   'Дробно-линейная: y = (2x + 1)/(x − 3)',
  qPolyLin:  'Многочлен на двучлен: y = x²/(x + 1)',
  qConst:    'Число в числителе: y = 3/(x² + 1)',
  qQuadQuad: 'Квадраты сверху и снизу: y = (x² + 1)/(x² − 1)',
  qTrig:     'С тригонометрией: y = sin x/x, y = x/cos x',
  qExp:      'С экспонентой: y = eˣ/x, y = x/eˣ',
  qLn:       'С логарифмом: y = ln x/x, y = x/ln x',

  cLinPow:   'Степень двучлена: y = (3x − 2)⁵',
  cPolyPow:  'Степень многочлена: y = (x² − 3x + 1)⁴',
  cSqrt:     'Корень из выражения: y = √(2x + 3)',
  cNegPow:   'Двучлен в знаменателе: y = 1/(2x − 1)³',
  cTrigLin:  'sin и cos от kx + b: y = sin(3x + 1)',
  cTgLin:    'tg и ctg от kx + b: y = tg 2x',
  cExp:      'Экспонента: y = e^{3x − 1}, y = e^{x²}',
  cAexp:     'Показательная: y = 2^{3x}, y = 5^{1 − x}',
  cLn:       'Логарифм: y = ln(2x + 5), y = ln(x² + 1)',
  cTrigPow:  'Степень функции: y = sin²x, y = cos³x',
  cNested:   'Двойное вложение: y = sin²3x, y = e^{sin x}, y = ln cos x',

  mProdChain: 'Произведение + сложная: y = x²e^{3x}, y = x sin 2x',
  mQuotChain: 'Частное + сложная: y = e^{2x}/x',
  mChainProd: 'Произведение степеней: y = (x + 1)²(x − 2)³',
  mSumChain:  'Сумма сложных: y = sin 2x + e^{3x} − ln(4x + 1)',

  vPoly:       'f′(x₀) многочлена',
  vRules:      'f′(x₀) произведения, частного, сложной',
  vTrans:      'f′(x₀) с eˣ, ln x, sin x',
  vSlope:      'Угловой коэффициент касательной',
  vTangent:    'Уравнение касательной',
  vStationary: 'Точки, где f′(x) = 0',
  vSecond:     'Вторая производная',
  vVelocity:   'Скорость точки в момент t₀',
  vAccel:      'Ускорение точки в момент t₀',
  vWhenSpeed:  'Когда скорость равна v',
};

// Блоки по нарастанию сложности — они же порядок чекбоксов в панели
export const CATEGORY_GROUPS_DERIV = [
  {
    label: 'Блок 1. Табличные: степень и корень',
    keys: ['tConst', 'tPower', 'tNegPower', 'tSqrt', 'tRoot', 'tFracPower'],
  },
  {
    label: 'Блок 2. Табличные: тригонометрия, eˣ, логарифм',
    keys: ['tTrig', 'tExp', 'tAexp', 'tLn', 'tLog', 'tArc'],
  },
  {
    label: 'Блок 3. Сумма и постоянный множитель',
    keys: ['sPoly', 'sPolyFrac', 'sPowers', 'sTrig', 'sExpLog', 'sSplit', 'sExpand'],
  },
  {
    label: 'Блок 4. Производная произведения',
    keys: ['pPolyPoly', 'pPowTrig', 'pPowExp', 'pPowLn', 'pSqrt',
           'pExpTrig', 'pTrigTrig', 'pThree'],
  },
  {
    label: 'Блок 5. Производная частного',
    keys: ['qLinLin', 'qPolyLin', 'qConst', 'qQuadQuad', 'qTrig', 'qExp', 'qLn'],
  },
  {
    label: 'Блок 6. Производная сложной функции',
    keys: ['cLinPow', 'cPolyPow', 'cSqrt', 'cNegPow', 'cTrigLin', 'cTgLin',
           'cExp', 'cAexp', 'cLn', 'cTrigPow', 'cNested'],
  },
  {
    label: 'Блок 7. Правила вместе',
    keys: ['mProdChain', 'mQuotChain', 'mChainProd', 'mSumChain'],
  },
  {
    label: 'Блок 8. Значение производной и приложения',
    keys: ['vPoly', 'vRules', 'vTrans', 'vSlope', 'vTangent', 'vStationary',
           'vSecond', 'vVelocity', 'vAccel', 'vWhenSpeed'],
  },
];

const ASK_CATS = new Set(CATEGORY_GROUPS_DERIV[7].keys);

/** Строка над списком заданий: зависит от того, что попало на лист */
export function derivInstruction(categories = {}) {
  const on = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);
  return on.some(k => ASK_CATS.has(k))
    ? 'Выполните задания:'
    : 'Найдите производную функции:';
}

// ─── Настройки ───────────────────────────────────────────────────────────────
const ALL_CATS = Object.keys(CATEGORY_LABELS_DERIV);
const DEFAULT_ON = new Set([
  'tPower', 'tSqrt', 'tTrig', 'sPoly',
  'pPowTrig', 'pPowExp', 'qLinLin', 'qTrig',
  'cLinPow', 'cTrigLin', 'cExp', 'cLn',
]);

export const DEFAULT_SETTINGS_DERIV = {
  variantsCount:  4,
  questionsCount: 12,
  twoPerPage:     false,
  sideBySide:     false,
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   1,             // ответ — формула, в пол-листа строка для записи тесна
  fontSize:       's',
  lineSpacing:    1.5,           // производную пишут длиннее, чем «x = 5»
  level:          2,             // 1 | 2 | 3 — размах чисел внутри одного приёма
  notation:       'y',           // y | f — «y = …, y′ =» или «f(x) = …, f′(x) =»
  categories: Object.fromEntries(ALL_CATS.map(k => [k, DEFAULT_ON.has(k)])),
};

// ─── Сборка задания ──────────────────────────────────────────────────────────
// Типичные ошибки — неверные ответы для теста A/B/C/D. Порядок = приоритет:
// ошибка в правиле самой категории правдоподобнее всего.
const MISTAKE_MODES = [
  { naiveProduct: true },
  { quotSwap: true },
  { noChain: true },
  { quotPlus: true },
  { quotNoSquare: true },
  { powKeep: true },
  { cosSign: true },
  { expPow: true },
];

const MAX_TEX = 220;

function mistakesFor(g, df) {
  const out = [];
  const push = (node) => {
    if (!node) return;
    if (node.t === 'num' && df.t !== 'num') return;       // «0» среди формул — не ответ
    const t = tex(node);
    if (t.length > MAX_TEX || t.includes('?')) return;
    if (sameFunction(node, df)) return;
    if (out.some(o => sameFunction(o.node, node))) return;
    out.push({ node, t });
  };
  for (const mode of MISTAKE_MODES) {
    try { push(simplify(diff(g, mode))); } catch { /* ошибка не собралась — не беда */ }
    if (out.length >= 4) break;
  }
  // Запасные: сама функция вместо производной ((sin x)′ = sin x), знак, множитель
  if (out.length < 3) push(simplify(g));
  if (out.length < 3) push(simplify(neg(df)));
  if (out.length < 3) push(simplify(mul(N(2), df)));
  return out.map(o => o.t);
}

/** Число ответа — как в бланке: целое или конечная десятичная дробь */
function blankNumber(v) {
  const r = toNiceRational(v, 100);
  if (!r || Math.abs(v) > 1000) return null;
  const t = fmtNum(r, 'dec');
  // В бланк ЕГЭ — не больше двух знаков после запятой
  if (t.includes('frac') || /\{,\}\d{3}/.test(t)) return null;
  return { r, tex: t };
}

const lhsOf = (notation) => (notation === 'f'
  ? { lhs: 'f(x)', d1: "f'(x)", d2: "f''(x)" }
  : { lhs: 'y', d1: "y'", d2: "y''" });

/**
 * Одно задание. null — случайные числа не подошли (вызывающий пробует ещё раз).
 */
function buildQuestion(cat, opts) {
  const gen = GENERATORS[cat];
  if (!gen) return null;
  const built = gen(opts.P);
  if (!built || !built.f) return null;

  const { f, ask } = built;
  const g = built.solve || f;
  const df = derivative(g);
  // Главная страховка: ответ сверяется с НАПЕЧАТАННОЙ функцией
  if (!verifyDerivative(f, df)) return null;

  const fTex = texAsIs(f);
  const dfTex = tex(df);
  if (fTex.length > MAX_TEX || dfTex.length > MAX_TEX) return null;
  const { lhs, d1, d2 } = lhsOf(opts.notation);

  if (!ask) {
    if (df.t === 'num' && !['tConst'].includes(cat)) return null;   // выродилось в число
    return {
      exprLatex: `${lhs} = ${fTex}`,
      resultLatex: dfTex,
      varLatex: d1,
      mistakes: mistakesFor(g, df),
      cat,
    };
  }

  const fx = `f(x) = ${fTex}`;

  if (ask === 'value' || ask === 'slope') {
    const v = blankNumber(evalAt(df, built.x0.v));
    if (!v) return null;
    if (ask === 'value') {
      return {
        exprLatex: fx,
        resultLatex: v.tex,
        varLatex: `f'\\left(${built.x0.tex}\\right)`,
        cat,
      };
    }
    return {
      exprLatex: `${fx},\\; x_0 = ${built.x0.tex}\\;\\text{— угловой коэффициент касательной}`,
      resultLatex: v.tex,
      varLatex: 'k',
      cat,
    };
  }

  if (ask === 'tangent') {
    const x0 = built.x0.v;
    if (!Number.isInteger(x0)) return null;               // b = f(x₀) − k·x₀ с π не круглое
    const k = toNiceRational(evalAt(df, x0), 12);
    const y0 = toNiceRational(evalAt(f, x0), 12);
    if (!k || !y0) return null;
    const b = rat(y0.n * k.d - k.n * x0 * y0.d, y0.d * k.d);
    // Касательная к (3x + 7)⁴ в x₀ = 2 — «y = 26364x − 24167»: считать можно,
    // но это уже не про производную
    if (Math.abs(k.n / k.d) > 100 || Math.abs(b.n / b.d) > 300) return null;
    const line = poly([b, k]);
    return {
      exprLatex: `${fx},\\; x_0 = ${built.x0.tex}\\;\\text{— уравнение касательной}`,
      resultLatex: tex(line),
      varLatex: 'y',
      cat,
    };
  }

  if (ask === 'stationary') {
    const { roots } = built;
    if (!roots.every(r => Math.abs(evalAt(df, r)) < 1e-9)) return null;
    return {
      exprLatex: `${fx}\\;\\text{— решите } f'(x) = 0`,
      resultLatex: roots.join(';\\ '),
      varLatex: 'x',
      cat,
    };
  }

  if (ask === 'second') {
    const d2f = derivative(df);
    if (!verifyDerivative(df, d2f)) return null;
    if (d2f.t === 'num' && d2f.r.n === 0) return null;
    const t2 = tex(d2f);
    if (t2.length > MAX_TEX) return null;
    return {
      exprLatex: `${lhs} = ${fTex}`,
      resultLatex: t2,
      varLatex: d2,
      cat,
    };
  }

  const xt = `x(t) = ${fTex.replace(/x/g, 't')}`;
  if (ask === 'velocity' || ask === 'accel') {
    const node = ask === 'velocity' ? df : derivative(df);
    const v = blankNumber(evalAt(node, built.x0.v));
    if (!v) return null;
    return {
      exprLatex: ask === 'velocity'
        ? `${xt}\\;\\text{— скорость (м/с) при } t = ${built.x0.tex}`
        : `${xt}\\;\\text{— ускорение (м/с}^2\\text{) при } t = ${built.x0.tex}`,
      resultLatex: v.tex,
      varLatex: ask === 'velocity' ? 'v' : 'a',
      cat,
    };
  }

  if (ask === 'whenSpeed') {
    if (Math.abs(evalAt(df, built.t) - built.V) > 1e-9) return null;
    return {
      exprLatex: `${xt}\\;\\text{— когда скорость равна } ${built.V}\\text{ м/с?}`,
      resultLatex: String(built.t),
      varLatex: 't',
      cat,
    };
  }

  return null;
}

/**
 * Задание «с вопросом» (f′(2), касательная, y″): вопрос стоит в `varLatex`, на
 * листе он печатается после формулы. В тесте и в выгрузке .md условие
 * собирается с вопросом (`statementLatexOf`), а общая инструкция «Найдите
 * производную» к нему не подходит — у задания своя.
 */
function buildAsk(cat, opts) {
  const q = buildQuestion(cat, opts);
  if (q && ASK_CATS.has(cat)) {
    q.askInStatement = true;
    q.instruction = 'Выполните задание:';
  }
  return q;
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateDerivativeVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_DERIV, ...settings };
  const opts = { P: pools(s.level), notation: s.notation };

  // Повторы отклоняем, но не бесконечно: у узких категорий (y = eˣ) их не
  // избежать, а лист не должен оказаться короче заказанного
  const seen = new Set();
  let repeats = 0;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 120,
    make: (cat) => {
      let q;
      try { q = buildAsk(cat, opts); } catch { q = null; }
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

// Для тестов: генераторы категорий и сборка одного задания
export const __test = { GENERATORS, buildQuestion: buildAsk, pools };

// ─── Хук ─────────────────────────────────────────────────────────────────────
export function useDerivatives() {
  const [title, setTitle] = useState('Вычисление производных');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_DERIV });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_DERIV,
  });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateDerivativeVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Вычисление производных');
    setSettings({ ...DEFAULT_SETTINGS_DERIV });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
