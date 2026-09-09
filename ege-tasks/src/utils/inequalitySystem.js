/**
 * Системы и совокупности неравенств: решение, проверка и запись.
 *
 * Решение одного неравенства — множество промежутков (`pieces` из
 * `quadraticInequality`), поэтому система сводится к пересечению множеств, а
 * совокупность — к объединению. Одинаково работает и для линейных частей, и
 * для квадратных: часть приводится к многочлену, а дальше решает общая
 * таблица знаков. Значит, «x² > 4 и x < 5» не требует особого разбора — это
 * то же пересечение, что «x > 2 и x < 5», просто у первой части два куска.
 *
 * Часть системы — `{ left, right, op, tree }`, где `tree` говорит, каким
 * деревом узлов она построена: 'lin' — узлы `linearExpr` (у них есть скобки и
 * дроби), 'quad' — узлы `quadraticExpr` (степени). Печать и решение выбирают
 * адаптер по этому полю, поэтому в одной системе линейная и квадратная части
 * живут рядом.
 */

import { OPS } from './inequalityCore';
import { isZero, subR, linearOfSide, renderSide } from './linearExpr';
import { sRat, sNum, sEq, sNeg, sDiv, S0 } from './surd';
import {
  polyOfEquation, polyPowers, evalPolyNum, renderQSide, solveRationalQuadratic,
} from './quadraticExpr';
import {
  piece, EMPTY_SET, ALL_REAL, solutionFromRoots, contains, boundaries,
} from './quadraticInequality';

// Значение многочлена в точке считается с погрешностью: на самой границе оно
// обязано читаться как ноль, иначе нестрогое «⩽ 0» на ней ложно не выполнится.
const EPS = 1e-9;
const snap = (v) => (Math.abs(v) < EPS ? 0 : v);

// ─── Сравнение границ ────────────────────────────────────────────────────────
// null у нижней границы — это −∞, у верхней — +∞, поэтому сравнивать их
// приходится с оглядкой на то, какой конец промежутка перед нами.
const cmp = (a, b) => (sEq(a, b) ? 0 : sNum(a) - sNum(b));

/** Какая нижняя граница правее (для пересечения нужна максимальная) */
function maxLo(p, q) {
  if (p.lo === null) return { lo: q.lo, loOpen: q.lo === null ? true : q.loOpen };
  if (q.lo === null) return { lo: p.lo, loOpen: p.loOpen };
  const c = cmp(p.lo, q.lo);
  if (c > 0) return { lo: p.lo, loOpen: p.loOpen };
  if (c < 0) return { lo: q.lo, loOpen: q.loOpen };
  return { lo: p.lo, loOpen: p.loOpen || q.loOpen };   // строгая сильнее
}

/** Какая верхняя граница левее (для пересечения нужна минимальная) */
function minHi(p, q) {
  if (p.hi === null) return { hi: q.hi, hiOpen: q.hi === null ? true : q.hiOpen };
  if (q.hi === null) return { hi: p.hi, hiOpen: p.hiOpen };
  const c = cmp(p.hi, q.hi);
  if (c < 0) return { hi: p.hi, hiOpen: p.hiOpen };
  if (c > 0) return { hi: q.hi, hiOpen: q.hiOpen };
  return { hi: p.hi, hiOpen: p.hiOpen || q.hiOpen };
}

function intersectPiece(p, q) {
  const { lo, loOpen } = maxLo(p, q);
  const { hi, hiOpen } = minHi(p, q);
  if (lo !== null && hi !== null) {
    const c = cmp(lo, hi);
    if (c > 0) return null;
    // Совпавшие границы дают точку — но только если обе нестрогие
    if (c === 0 && (loOpen || hiOpen)) return null;
  }
  return piece(lo, hi, loOpen, hiOpen);
}

// ─── Операции над множествами ────────────────────────────────────────────────
/** Пересечение — система: «и то, и другое» */
export function intersectSets(a, b) {
  const pieces = [];
  for (const p of a.pieces) {
    for (const q of b.pieces) {
      const r = intersectPiece(p, q);
      if (r) pieces.push(r);
    }
  }
  return { pieces: sortPieces(pieces) };
}

const sortPieces = (pieces) => [...pieces].sort((p, q) => {
  if (p.lo === null) return q.lo === null ? 0 : -1;
  if (q.lo === null) return 1;
  const c = cmp(p.lo, q.lo);
  if (c !== 0) return c;
  return (p.loOpen ? 1 : 0) - (q.loOpen ? 1 : 0);      // закрытая начинается раньше
});

/**
 * Смыкаются ли промежутки: пересекаются или касаются закрытым концом.
 * (−∞; 2) и (2; +∞) НЕ смыкаются — между ними выколотая точка, и объединение
 * обязано остаться двумя кусками.
 */
function joinable(a, b) {
  if (a.hi === null || b.lo === null) return true;
  const c = cmp(b.lo, a.hi);
  if (c < 0) return true;
  return c === 0 && (!a.hiOpen || !b.loOpen);
}

/** Объединение — совокупность: «или то, или другое» */
export function unionSets(a, b) {
  const all = sortPieces([...a.pieces, ...b.pieces]);
  const out = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (!last || !joinable(last, p)) { out.push({ ...p }); continue; }
    const { hi, hiOpen } = maxHi(last, p);
    last.hi = hi;
    last.hiOpen = hiOpen;
  }
  return { pieces: out };
}

function maxHi(p, q) {
  if (p.hi === null || q.hi === null) return { hi: null, hiOpen: true };
  const c = cmp(p.hi, q.hi);
  if (c > 0) return { hi: p.hi, hiOpen: p.hiOpen };
  if (c < 0) return { hi: q.hi, hiOpen: q.hiOpen };
  return { hi: p.hi, hiOpen: p.hiOpen && q.hiOpen };   // нестрогая сильнее
}

export const intersectAll = (sets) => sets.reduce(intersectSets, ALL_REAL);
export const unionAll     = (sets) => sets.reduce(unionSets, EMPTY_SET);

/** Целые решения — честным перебором; ими живут вопросы «сколько целых» */
export function integerPoints(sol, limit = 100) {
  const out = [];
  for (let x = -limit; x <= limit; x++) if (contains(sol, x)) out.push(x);
  return out;
}

// ─── Одна часть системы ──────────────────────────────────────────────────────
/** Многочлен части: «левая минус правая», степень → коэффициент Q(√m) */
export function polyOfPart(part) {
  if (part.tree === 'lin') {
    const L = linearOfSide(part.left);
    const R = linearOfSide(part.right);
    const a = subR(L.a, R.a);
    const b = subR(L.b, R.b);
    const poly = {};
    if (!isZero(a)) poly[1] = sRat(a);
    if (!isZero(b)) poly[0] = sRat(b);
    return poly;
  }
  return polyOfEquation(part);
}

/**
 * Решение неравенства `poly OP 0` как множества промежутков.
 * Степень 0 — вырожденный случай («любое число» / «нет решений»),
 * 1 — луч (знак разворачивается при отрицательном коэффициенте),
 * 2 — школьная таблица знаков параболы.
 */
export function solveFromPoly(poly, op) {
  const powers = polyPowers(poly);
  if (powers.some(p => p < 0)) return null;             // переменная в знаменателе
  const degree = powers.length ? Math.max(...powers) : 0;

  if (degree === 0) {
    const c = poly[0] ? sNum(poly[0]) : 0;
    return OPS[op].test(c, 0) ? ALL_REAL : EMPTY_SET;
  }

  if (degree === 1) {
    const k = poly[1];
    const value = sDiv(sNeg(poly[0] || S0), k);
    if (!value) return null;
    // деление на отрицательное разворачивает знак — ровно здесь, один раз
    const dir = sNum(k) < 0 ? OPS[op].flip : op;
    const strict = OPS[dir].strict;
    return dir === 'gt' || dir === 'ge'
      ? { pieces: [piece(value, null, strict, true)] }
      : { pieces: [piece(null, value, true, strict)] };
  }

  if (degree === 2) {
    const sol = solveRationalQuadratic(poly[2], poly[1] || S0, poly[0] || S0);
    if (!sol) return null;
    return solutionFromRoots(sol.roots, sNum(poly[2]), op);
  }

  return null;                                          // биквадратные сюда не пускаем
}

export function solvePart(part) {
  const poly = polyOfPart(part);
  return poly ? solveFromPoly(poly, part.op) : null;
}

/** Численный предикат части — им проверяют ответ, не заглядывая в решатель */
export function partPredicate(part) {
  const poly = polyOfPart(part);
  if (!poly) return null;
  return (x) => OPS[part.op].test(snap(evalPolyNum(poly, x)), 0);
}

// ─── Решение системы ─────────────────────────────────────────────────────────
/** mode: 'and' — система (пересечение), 'or' — совокупность (объединение) */
export function solveSystem(parts, mode = 'and') {
  const sets = [];
  for (const part of parts) {
    const s = solvePart(part);
    if (!s) return null;
    sets.push(s);
  }
  return mode === 'or' ? unionAll(sets) : intersectAll(sets);
}

/**
 * Сверяет ответ с самой системой численно: в пробных точках «принадлежит
 * ответу» обязано совпасть с «все неравенства выполняются» (для совокупности —
 * «хотя бы одно»). Точки берутся вокруг границ каждой части и вокруг границ
 * ответа — там и ошибаются знаком и строгостью.
 */
export function verifySystem(parts, sol, mode = 'and') {
  const preds = parts.map(partPredicate);
  if (preds.some(p => !p)) return false;
  const holds = (x) => (mode === 'or' ? preds.some(f => f(x)) : preds.every(f => f(x)));

  const marks = [
    ...boundaries(sol),
    ...parts.flatMap((part) => {
      const s = solvePart(part);
      return s ? boundaries(s) : [];
    }),
  ].sort((a, b) => a - b);

  const probes = [-1000, -37.5, -0.5, 0, 0.5, 37.5, 1000];
  for (let i = 0; i < marks.length; i++) {
    const b = marks[i];
    probes.push(b, b - 1, b - 0.001, b + 0.001, b + 1);
    if (i + 1 < marks.length) probes.push((b + marks[i + 1]) / 2);
  }

  for (const x of probes) {
    if (!Number.isFinite(x)) continue;
    if (holds(x) !== contains(sol, x)) return false;
  }
  return true;
}

// ─── Запись условия ──────────────────────────────────────────────────────────
export function partTex(part, varTex) {
  const render = part.tree === 'lin' ? renderSide : renderQSide;
  return `${render(part.left, varTex)} ${OPS[part.op].tex} ${render(part.right, varTex)}`;
}

/**
 * Условие целиком: система — фигурной скобкой, совокупность — квадратной.
 * Обе записи школьные, и по скобке ученик и различает «и» от «или».
 */
export function systemTex(parts, varTex, mode = 'and') {
  const rows = parts.map(p => partTex(p, varTex)).join(' \\\\ ');
  return mode === 'or'
    ? `\\left[\\begin{array}{l} ${rows} \\end{array}\\right.`
    : `\\begin{cases} ${rows} \\end{cases}`;
}
