/**
 * Тригонометрические неравенства A·f(kx + b) + B ⋚ C.
 *
 * Решение для u = kx + b — дуга единичной окружности (промежуток длиной
 * меньше периода) плюс период; переход к x — та же подстановка, что у
 * уравнений (`angles.js`), при k < 0 концы меняются местами, при A < 0
 * знак неравенства разворачивается. Особые случаи a = ±1 и |a| > 1 дают
 * точки, «всё, кроме точек», ∅ или ℝ.
 *
 * Перед выдачей ответ сверяется с НАПЕЧАТАННЫМ неравенством в сотнях
 * пробных точек (вдали от границ): «x в ответе» ⇔ «неравенство верно».
 */

import { sr, sNum, sTex, sMul, sNeg, sInt, sRad, S0 } from '../surd';
import {
  ang, angNum, angTex, angSub, angScale, angAdd, angIsZero,
  valuesFor, principal, fnNum, periodTex, reduceRat,
  rat, R0, R1, mulR, divR, absR, toNum, negR, addR, subR,
} from './angles';
import { argTex, applyTex, coefPrefix, surdOfValue } from './equations';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

export const OPS = {
  lt: { tex: '<', flip: 'gt', strict: true, test: (a, b) => a < b },
  gt: { tex: '>', flip: 'lt', strict: true, test: (a, b) => a > b },
  le: { tex: '\\leqslant', flip: 'ge', strict: false, test: (a, b) => a <= b },
  ge: { tex: '\\geqslant', flip: 'le', strict: false, test: (a, b) => a >= b },
};
const ALL = ['lt', 'gt', 'le', 'ge'];
const isGreater = (op) => op === 'gt' || op === 'ge';

// ─── Решение для u ───────────────────────────────────────────────────────────
/**
 * f(u) op a → { kind: 'arc', lo, hi, loIn, hiIn, T } (углы в долях π)
 *   | { kind: 'points', c, T } | { kind: 'except', c, T } | { kind: 'empty' } | { kind: 'all' }
 */
export function solveBasic(fn, value, op) {
  const v = value.val;
  const strict = OPS[op].strict;
  const gt = isGreater(op);
  if (fn === 'sin' || fn === 'cos') {
    const top = fn === 'sin' ? rat(1, 2) : R0;     // где f = 1
    const bot = fn === 'sin' ? rat(-1, 2) : R1;    // где f = −1
    if (v > 1 || (v === 1 && gt && strict)) return gt ? { kind: 'empty' } : { kind: 'all' };
    if (v < -1 || (v === -1 && !gt && strict)) return gt ? { kind: 'all' } : { kind: 'empty' };
    if (v === 1) {
      if (gt) return { kind: 'points', c: ang(top), T: rat(2) };          // f ≥ 1
      if (strict) return { kind: 'except', c: ang(top), T: rat(2) };      // f < 1
      return { kind: 'all' };                                              // f ≤ 1
    }
    if (v === -1) {
      if (!gt) return { kind: 'points', c: ang(bot), T: rat(2) };          // f ≤ −1
      if (strict) return { kind: 'except', c: ang(bot), T: rat(2) };      // f > −1
      return { kind: 'all' };
    }
    const p = principal(fn, value);
    if (fn === 'sin') {
      return gt
        ? { kind: 'arc', lo: ang(p), hi: ang(subR(R1, p)), T: rat(2) }          // (α; π − α)
        : { kind: 'arc', lo: ang(subR(rat(-1), p)), hi: ang(p), T: rat(2) };    // (−π − α; α)
    }
    return gt
      ? { kind: 'arc', lo: ang(negR(p)), hi: ang(p), T: rat(2) }                // (−β; β)
      : { kind: 'arc', lo: ang(p), hi: ang(subR(rat(2), p)), T: rat(2) };       // (β; 2π − β)
  }
  const p = principal(fn, value);
  if (fn === 'tan') {
    return gt
      ? { kind: 'arc', lo: ang(p), hi: ang(rat(1, 2)), T: R1, openHi: true }
      : { kind: 'arc', lo: ang(rat(-1, 2)), hi: ang(p), T: R1, openLo: true };
  }
  // ctg убывает: ctg u > a ⇔ u ∈ (πn; β + πn)
  return gt
    ? { kind: 'arc', lo: ang(R0), hi: ang(p), T: R1, openLo: true }
    : { kind: 'arc', lo: ang(p), hi: ang(R1), T: R1, openHi: true };
}

/** Концы, которые входят в ответ (нестрогий знак, но не полюс tg/ctg) */
function withEnds(sol, op) {
  if (sol.kind !== 'arc') return sol;
  const closed = !OPS[op].strict;
  return { ...sol, loIn: closed && !sol.openLo, hiIn: closed && !sol.openHi };
}

/** u = kx + b → x; при k < 0 концы меняются местами */
export function transformSolution(sol, k, b) {
  const kInv = divR(R1, k);
  const T = sol.T ? absR(mulR(sol.T, kInv)) : null;
  const map = (a) => angScale(angSub(a, ang(b)), kInv);
  if (sol.kind === 'empty' || sol.kind === 'all') return sol;
  if (sol.kind === 'points' || sol.kind === 'except') {
    const c = map(sol.c);
    return { ...sol, c: ang(reduceRat(c.pi, T)), T };
  }
  let lo = map(sol.lo); let hi = map(sol.hi);
  let { loIn, hiIn } = sol;
  if (k.n < 0) { [lo, hi] = [hi, lo]; [loIn, hiIn] = [hiIn, loIn]; }
  // сдвиг на период: середина дуги — в (−T/2; T/2]
  const mid = mulR(addR(lo.pi, hi.pi), rat(1, 2));
  const shift = subR(reduceRat(mid, T), mid);
  return { kind: 'arc', lo: angAdd(lo, ang(shift)), hi: angAdd(hi, ang(shift)), loIn, hiIn, T };
}

/** Принадлежит ли x ответу (численно) */
export function contains(sol, x, unit = Math.PI) {
  if (sol.kind === 'empty') return false;
  if (sol.kind === 'all') return true;
  const T = toNum(sol.T) * unit;
  if (sol.kind === 'points' || sol.kind === 'except') {
    const c = angNum(sol.c, unit);
    const r = ((x - c) % T + T) % T;
    const on = r < 1e-9 || T - r < 1e-9;
    return sol.kind === 'points' ? on : !on;
  }
  const lo = angNum(sol.lo, unit); const hi = angNum(sol.hi, unit);
  const n = Math.floor((x - lo) / T);
  const y = x - n * T;                       // y ∈ [lo; lo + T)
  if (Math.abs(y - lo) < 1e-9) return sol.loIn;
  if (Math.abs(y - hi) < 1e-9) return sol.hiIn;
  return y > lo && y < hi;
}

// ─── Запись ответа ───────────────────────────────────────────────────────────
function shiftTex(a, T) {
  const head = angIsZero(a) ? [] : [angTex(a)];
  const per = periodTex(T);
  if (!head.length) return per;
  return per.startsWith('-') ? `${head[0]} - ${per.slice(1)}` : `${head[0]} + ${per}`;
}

/** form: 'inequality' — «π/6 + 2πn < x < 5π/6 + 2πn», 'interval' — «x ∈ (…; …)» */
export function solutionTex(sol, form = 'inequality', v = 'x') {
  const nz = ',\\; n \\in \\mathbb{Z}';
  if (sol.kind === 'empty') return '\\varnothing';
  if (sol.kind === 'all') return `${v} \\in \\mathbb{R}`;
  if (sol.kind === 'points') return `${v} = ${shiftTex(sol.c, sol.T)}${nz}`;
  if (sol.kind === 'except') return `${v} \\ne ${shiftTex(sol.c, sol.T)}${nz}`;
  const L = shiftTex(sol.lo, sol.T); const R = shiftTex(sol.hi, sol.T);
  if (form === 'interval') {
    const l = sol.loIn ? '\\left[' : '\\left(';
    const r = sol.hiIn ? '\\right]' : '\\right)';
    return `${v} \\in ${l}${L};\\, ${R}${r}${nz}`;
  }
  return `${L} ${sol.loIn ? '\\leqslant' : '<'} ${v} ${sol.hiIn ? '\\leqslant' : '<'} ${R}${nz}`;
}

// ─── Модель задания ──────────────────────────────────────────────────────────
/** A·f(kx + b) + B op C; value = (C − B)/A */
function buildTask(m, cat, form) {
  const arg = argTex(m.k, m.b, { order: m.order });
  let lhs = `${coefPrefix(m.A)}${applyTex(m.fn, arg)}`;
  if (m.B && sNum(m.B) !== 0) {
    const t = sTex(m.B);
    lhs += t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`;
  }
  const exprLatex = `${lhs} ${OPS[m.op].tex} ${m.Ctex ?? sTex(m.C)}`;
  // A < 0: делим — знак разворачивается
  const op = sNum(m.A) < 0 ? OPS[m.op].flip : m.op;
  const sol = transformSolution(withEnds(solveBasic(m.fn, m.value, op), op), m.k, m.b);
  // проверка по напечатанному неравенству
  const A = sNum(m.A); const B = m.B ? sNum(m.B) : 0; const C = sNum(m.C);
  const lhsNum = (x) => A * fnNum(m.fn, toNum(m.k) * x + toNum(m.b) * Math.PI) + B;
  for (let i = 0; i < 400; i++) {
    const x = -12 + (24 * i) / 400 + 0.0137;
    const l = lhsNum(x);
    if (!Number.isFinite(l) || Math.abs(l) > 1e6) continue;
    if (Math.abs(l - C) < 1e-6) continue;             // на границе — не судим
    if (OPS[m.op].test(l, C) !== contains(sol, x)) return null;
  }
  return {
    exprLatex,
    resultLatex: solutionTex(sol, form),
    varLatex: 'x',
    hideKeyPrompt: true,
    cat,
  };
}

const nonTrivial = (fn) => valuesFor(fn).filter(v => !['0', '1', '-1'].includes(v.key) || fn === 'tan' || fn === 'cot');
const K_ARG = [rat(2), rat(3), rat(4), rat(1, 2), rat(1, 3), rat(-2), rat(-1, 2)];
const B_SHIFT = [rat(1, 6), rat(1, 4), rat(1, 3), rat(-1, 6), rat(-1, 4), rat(-1, 3), rat(1, 2), rat(-1, 2)];

function model(fn, value, extra = {}) {
  return {
    fn, value, op: rand(ALL), k: R1, b: R0, order: 'kb',
    A: sInt(1), B: null, C: surdOfValue(value), ...extra,
  };
}

const tanOrCot = () => (chance(0.65) ? 'tan' : 'cot');

export const INEQ_GENERATORS = {
  sin_basic: (form) => buildTask(model('sin', rand(nonTrivial('sin'))), 'sin_basic', form),
  cos_basic: (form) => buildTask(model('cos', rand(nonTrivial('cos'))), 'cos_basic', form),
  tan_basic: (form) => {
    const fn = tanOrCot();
    return buildTask(model(fn, rand(valuesFor(fn))), 'tan_basic', form);
  },
  // 2sin x > 1, 2cos x − √3 ⩽ 0, −2sin x > 1 (знак разворачивается)
  coef: (form) => {
    const fn = rand(['sin', 'cos', 'tan']);
    const value = rand(nonTrivial(fn).filter(v => v.key !== '0'));
    const key = value.key.replace('-', '');
    const A = fn === 'tan'
      ? (key === 's3' || key === 's3/3' ? sRad(R1, 3) : sInt(1))
      : (key === 's2/2' ? rand([sInt(2), sRad(R1, 2)]) : sInt(2));
    if (sNum(A) === 1) return null;
    const neg = chance(0.3);
    const AA = neg ? sNeg(A) : A;
    const c = sMul(AA, surdOfValue(value));
    const moved = chance(0.5);
    const m = model(fn, value, { A: AA, B: moved ? sNeg(c) : null, C: moved ? S0 : c });
    return buildTask(m, 'coef', form);
  },
  // sin 2x ⩾ 1/2, cos(x/2) < √2/2
  arg_k: (form) => {
    const fn = rand(['sin', 'cos', 'tan']);
    return buildTask(model(fn, rand(nonTrivial(fn).filter(v => v.key !== '0')), { k: rand(K_ARG) }), 'arg_k', form);
  },
  // sin(x + π/6) > 1/2, cos(2x − π/3) ⩽ −1/2
  arg_shift: (form) => {
    const fn = rand(['sin', 'cos', 'tan']);
    const k = rand([R1, R1, rat(2), rat(1, 2), rat(3)]);
    return buildTask(model(fn, rand(nonTrivial(fn).filter(v => v.key !== '0')), { k, b: rand(B_SHIFT) }), 'arg_shift', form);
  },
  // a = ±1, |a| > 1: точки, «кроме точек», ∅, ℝ
  special: (form) => {
    const fn = rand(['sin', 'cos']);
    if (chance(0.55)) {
      const value = rand(valuesFor(fn).filter(v => v.key === '1' || v.key === '-1'));
      return buildTask(model(fn, value), 'special', form);
    }
    const r = rand([rat(3, 2), rat(-3, 2), rat(2), rat(-2), rat(5, 4)]);
    const value = { key: 'big', val: toNum(r) };
    return buildTask({ ...model(fn, value), C: sr(r) }, 'special', form);
  },
};

export const INEQ_LABELS = {
  sin_basic: 'sin x > a, sin x ⩽ a',
  cos_basic: 'cos x < a, cos x ⩾ a',
  tan_basic: 'tg x > a, ctg x ⩽ a',
  coef: '2sin x > 1, 2cos x − √3 ⩽ 0, −2sin x > 1',
  arg_k: 'sin 2x ⩾ 1/2, cos(x/2) < √2/2',
  arg_shift: 'sin(x + π/6) > 1/2',
  special: 'Особые: sin x ⩾ 1, cos x < 1, sin x > 3/2',
};

export const INEQ_GROUPS = [
  { label: 'Простейшие', keys: ['sin_basic', 'cos_basic', 'tan_basic'] },
  { label: 'С коэффициентом', keys: ['coef'] },
  { label: 'Сложный аргумент', keys: ['arg_k', 'arg_shift'] },
  { label: 'Особые случаи', keys: ['special'] },
];

