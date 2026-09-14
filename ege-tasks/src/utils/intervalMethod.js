/**
 * Метод интервалов: выражение-произведение, его знак и решение неравенства.
 *
 * Задание метода интервалов — это не многочлен, а РАЗЛОЖЕННОЕ выражение:
 * произведение множителей в числителе и в знаменателе. Поэтому здесь своя
 * модель (`utils/quadraticExpr` умеет только суммы одночленов): множитель
 * знает свой корень, свою кратность и свой знак на бесконечности, а решение
 * собирается ровно тем же способом, каким его собирают на доске — знак на
 * крайнем правом промежутке и чередование через каждую точку.
 *
 * Кратность решает, меняется ли знак при переходе: чётная — не меняется
 * («точка-петля»). Корень знаменателя всегда выколот, корень числителя входит
 * в ответ ровно при нестрогом знаке. Это единственное место, где такие правила
 * записаны, — категории генератора о них не знают.
 *
 * Ответ — множество промежутков (`pieces`) из `utils/quadraticInequality`,
 * поэтому запись ответа, проверка принадлежности и вырожденные случаи
 * («точка», «всё, кроме точки», ∅) переиспользуются как есть.
 */

import { rat, toNum, fmtNum } from './linearExpr';
import { sRat, sInt, sNum, sEq, sCompare } from './surd';
import { OPS } from './inequalityCore';
import { piece, contains } from './quadraticInequality';
import { solveRationalQuadratic } from './quadraticExpr';

// ─── Множители ───────────────────────────────────────────────────────────────
/** (a·x + b)^mult — корень −b/a */
export const fLin = (a, b, mult = 1) => ({ kind: 'lin', a, b, mult });
/** (A·x² + B·x + C)^mult — корни ищет решатель, их может не быть вовсе */
export const fQuad = (A, B, C, mult = 1) => ({ kind: 'quad', A, B, C, mult });
/** Числовой множитель: знак важен, корней не даёт */
export const fConst = (k) => ({ kind: 'const', k, mult: 1 });
/**
 * Многочлен в развёрнутом виде: печатается как «x³ − 3x² − 4x», а корни
 * известны из построения — ученик их ещё только будет искать.
 * `coeffs` — по возрастанию степени, `roots` — [{ x, mult }].
 */
export const fPoly = (coeffs, roots) => ({ kind: 'poly', coeffs, roots, mult: 1 });

/** Корни множителя с кратностями: [{ x: surd, mult }] */
export function factorRoots(f) {
  if (f.kind === 'lin') {
    return f.a === 0 ? [] : [{ x: sRat(rat(-f.b, f.a)), mult: f.mult }];
  }
  if (f.kind === 'quad') {
    const sol = solveRationalQuadratic(sInt(f.A), sInt(f.B), sInt(f.C));
    if (!sol || sol.kind === 'none') return [];
    if (sol.kind === 'double') return [{ x: sol.roots[0], mult: 2 * f.mult }];
    return sol.roots.map(x => ({ x, mult: f.mult }));
  }
  if (f.kind === 'poly') return f.roots || [];
  return [];
}

/** Знак множителя при x → +∞ */
export function factorLeadSign(f) {
  if (f.kind === 'const') return f.k < 0 ? -1 : 1;
  if (f.kind === 'poly') {
    const lead = f.coeffs[f.coeffs.length - 1];
    return lead < 0 ? -1 : 1;
  }
  const lead = f.kind === 'lin' ? f.a : f.A;
  const sign = lead < 0 ? -1 : 1;
  return f.mult % 2 === 0 ? 1 : sign;
}

/** Значение множителя в точке — этим проверяется всё остальное */
export function factorEval(f, x) {
  if (f.kind === 'const') return f.k;
  if (f.kind === 'lin')  return (f.a * x + f.b) ** f.mult;
  if (f.kind === 'quad') return (f.A * x * x + f.B * x + f.C) ** f.mult;
  let acc = 0;                                        // схема Горнера
  for (let p = f.coeffs.length - 1; p >= 0; p--) acc = acc * x + f.coeffs[p];
  return acc;
}

// ─── Печать ──────────────────────────────────────────────────────────────────
function termTex(c, power, varTex) {
  const abs = Math.abs(c);
  const coef = abs === 1 && power > 0 ? '' : String(abs);
  const body = power === 0 ? '' : power === 1 ? varTex : `${varTex}^{${power}}`;
  return `${coef}${body}`;
}

/** Многочлен по коэффициентам (по возрастанию степени): «x^{3} - 3x^{2} - 4x» */
export function renderPolyTex(coeffs, varTex) {
  let out = '';
  for (let p = coeffs.length - 1; p >= 0; p--) {
    const c = coeffs[p];
    if (!c) continue;
    out += out
      ? `${c < 0 ? ' - ' : ' + '}${termTex(c, p, varTex)}`
      : `${c < 0 ? '-' : ''}${termTex(c, p, varTex)}`;
  }
  return out || '0';
}

function linCore(a, b, varTex) {
  if (b === 0) return a === 1 ? varTex : a === -1 ? `-${varTex}` : `${a}${varTex}`;
  // «3 − x» читается привычнее, чем «−x + 3»
  if (a < 0 && b > 0) return `${b} - ${a === -1 ? '' : -a}${varTex}`;
  return renderPolyTex([b, a], varTex);
}

function factorCore(f, varTex) {
  if (f.kind === 'lin')  return linCore(f.a, f.b, varTex);
  if (f.kind === 'quad') return renderPolyTex([f.C, f.B, f.A], varTex);
  if (f.kind === 'poly') return renderPolyTex(f.coeffs, varTex);
  return String(f.k);
}

/** Одночлен «x» скобок не просит даже в степени: x², x³ */
const isAtom = (f) => f.kind === 'lin' && f.b === 0 && f.a === 1;

export function factorTex(f, varTex, { bare = false } = {}) {
  const core = factorCore(f, varTex);
  const power = f.mult > 1 ? `^{${f.mult}}` : '';
  if (isAtom(f)) return `${core}${power}`;
  if (bare && f.mult === 1) return core;
  return `\\left(${core}\\right)${power}`;
}

/**
 * Произведение множителей. Числовые множители сливаются в один коэффициент
 * впереди: «−2(x − 1)(x + 4)».
 */
export function renderProduct(factors, varTex, { solo = false } = {}) {
  const k = factors.reduce((acc, f) => (f.kind === 'const' ? acc * f.k : acc), 1);
  const rest = factors.filter(f => f.kind !== 'const');
  const bare = solo && rest.length === 1 && k === 1;
  if (!rest.length) return String(k);
  const body = rest.map(f => factorTex(f, varTex, { bare })).join('');
  if (k === 1)  return body;
  if (k === -1) return `-${body}`;
  return `${k}${body}`;
}

/** Выражение целиком: произведение или дробь */
export function renderExprTex(expr, varTex) {
  const { numer = [], denom = [] } = expr;
  const top = renderProduct(numer, varTex, { solo: true });
  if (!denom.length) return top;
  return `\\dfrac{${top}}{${renderProduct(denom, varTex, { solo: true })}}`;
}

/**
 * Слагаемые левой части. Обычное задание — одно слагаемое; «1/x + 1/(x − 2)»
 * печатается суммой, а решается приведённой к общему знаменателю дробью.
 */
export const termsOf = (display) =>
  display.terms || [{ numer: display.numer || [], denom: display.denom || [], sign: 1 }];

/** Левая часть неравенства целиком */
export function renderTermsTex(display, varTex) {
  return termsOf(display).map((t, i) => {
    const tex = renderExprTex(t, varTex);
    const minus = (t.sign ?? 1) < 0;
    if (i === 0) return minus ? `-${tex}` : tex;
    return `${minus ? ' - ' : ' + '}${tex}`;
  }).join('');
}

// ─── Критические точки и знак ────────────────────────────────────────────────
/**
 * Точки, разбивающие прямую: корни числителя (входят в ответ при нестрогом
 * знаке) и корни знаменателя (выколоты всегда). Одна и та же точка может быть
 * и там и там — кратности складываются, а выколотость побеждает.
 */
export function criticalPoints({ numer = [], denom = [] }) {
  const points = [];
  const put = (x, mult, where) => {
    const hit = points.find(p => sEq(p.x, x));
    const target = hit || { x, numerMult: 0, denomMult: 0 };
    target[where] += mult;
    if (!hit) points.push(target);
  };
  for (const f of numer) for (const r of factorRoots(f)) put(r.x, r.mult, 'numerMult');
  for (const f of denom) for (const r of factorRoots(f)) put(r.x, r.mult, 'denomMult');
  return points.sort((p, q) => sCompare(p.x, q.x));
}

/** Знак всего выражения при x → +∞ */
export function leadSignOf({ numer = [], denom = [] }) {
  const mul = (acc, f) => acc * factorLeadSign(f);
  return numer.reduce(mul, 1) * denom.reduce(mul, 1);   // знак частного = знак произведения
}

/**
 * Решение неравенства «выражение OP 0» методом интервалов.
 *
 * Знак на крайнем правом промежутке равен знаку старших коэффициентов, дальше
 * меняется через точку с нечётной суммарной кратностью. Промежутки, где знак
 * подходит, склеиваются в куски ответа; точка между двумя неподходящими
 * промежутками может войти в ответ отдельной точкой (корень чётной кратности
 * при нестрогом знаке).
 */
export function solveIntervalMethod(expr, op) {
  const pts = criticalPoints(expr);
  const strict = OPS[op].strict;
  const want = op === 'gt' || op === 'ge' ? 1 : -1;
  const n = pts.length;

  const signs = new Array(n + 1);
  signs[n] = leadSignOf(expr);
  for (let i = n - 1; i >= 0; i--) {
    const odd = (pts[i].numerMult + pts[i].denomMult) % 2 === 1;
    signs[i] = odd ? -signs[i + 1] : signs[i + 1];
  }

  // Лента «промежуток, точка, промежуток, …» — по ней ответ собирается одним проходом
  const cells = [];
  for (let i = 0; i <= n; i++) {
    cells.push({ type: 'gap', idx: i, on: signs[i] === want });
    if (i < n) {
      const p = pts[i];
      cells.push({
        type: 'point', idx: i,
        on: !strict && p.numerMult > 0 && p.denomMult === 0,
      });
    }
  }

  const pieces = [];
  let start = null;
  const flush = (end) => {
    if (start === null) return;
    const a = cells[start];
    const b = cells[end];
    const lo = a.type === 'gap' ? (a.idx === 0 ? null : pts[a.idx - 1].x) : pts[a.idx].x;
    const hi = b.type === 'gap' ? (b.idx === n ? null : pts[b.idx].x)     : pts[b.idx].x;
    pieces.push(piece(lo, hi, a.type === 'gap', b.type === 'gap'));
    start = null;
  };
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].on) { if (start === null) start = i; }
    else flush(i - 1);
  }
  flush(cells.length - 1);

  return { pieces };
}

// ─── Численная проверка ──────────────────────────────────────────────────────
export function evalFactorsNum(factors, x) {
  return factors.reduce((acc, f) => acc * factorEval(f, x), 1);
}

/** Значение выражения; NaN — полюс (знаменатель обратился в ноль) */
export function evalExprNum({ numer = [], denom = [] }, x) {
  const top = evalFactorsNum(numer, x);
  if (!denom.length) return top;
  const bottom = evalFactorsNum(denom, x);
  return bottom === 0 ? NaN : top / bottom;
}

/**
 * «Левая минус правая» напечатанного неравенства. Проверять надо именно
 * напечатанное: у заданий с приведением («(x+1)/(x−2) ⩾ 1») решение считается
 * по другому выражению, и ошибка приведения ловится только здесь.
 */
export function evalDisplayNum(display, x) {
  let lhs = 0;
  for (const t of termsOf(display)) {
    const v = evalExprNum(t, x);
    if (Number.isNaN(v)) return NaN;
    lhs += (t.sign ?? 1) * v;
  }
  const rhs = display.rhsExpr
    ? evalExprNum(display.rhsExpr, x)
    : toNum(display.rhsConst || rat(0));
  return Number.isNaN(rhs) ? NaN : lhs - rhs;
}

/** Все точки, вокруг которых проверяется напечатанное неравенство */
export function displayCriticalPoints(display) {
  const parts = [...termsOf(display), ...(display.rhsExpr ? [display.rhsExpr] : [])];
  const merged = [];
  for (const part of parts) {
    for (const p of criticalPoints(part)) {
      const hit = merged.find(q => sEq(q.x, p.x));
      if (hit) {
        hit.numerMult += p.numerMult;
        hit.denomMult += p.denomMult;
      } else merged.push({ ...p });
    }
  }
  return merged.sort((a, b) => sCompare(a.x, b.x));
}

const finiteBounds = (sol) =>
  sol.pieces.flatMap(p => [p.lo, p.hi]).filter(Boolean).map(sNum);

/**
 * Сверяет ответ с самим неравенством численно: во всех пробных точках
 * «принадлежит ответу» обязано совпадать с «неравенство верно». Пробы берутся
 * вокруг границ ответа и вокруг полюсов — именно там ошибаются кратностью и
 * выколотой точкой.
 */
export function verifyIntervalSolution(display, op, sol, { span = 50 } = {}) {
  const marks = [
    ...finiteBounds(sol),
    ...displayCriticalPoints(display).map(p => sNum(p.x)),
  ].sort((a, b) => a - b);

  const probes = [-span, span, 0.5, -0.5];
  for (let i = 0; i < marks.length; i++) {
    probes.push(marks[i] - 1, marks[i] - 0.01, marks[i] + 0.01, marks[i] + 1);
    if (i + 1 < marks.length) probes.push((marks[i] + marks[i + 1]) / 2);
  }

  for (const x of probes) {
    if (!Number.isFinite(x)) return false;
    const v = evalDisplayNum(display, x);
    if (Number.isNaN(v)) continue;                    // полюс — проверяется ниже
    if (Math.abs(v) < 1e-9) continue;                 // у самого корня знак тонет в погрешности
    if (OPS[op].test(v, 0) !== contains(sol, x)) return false;
  }

  // Граница входит в ответ ровно при нестрогом знаке; полюс годится только
  // как открытый край промежутка — «(x − 3)/(x + 2) ⩾ 0» кончается на −2, но
  // саму точку −2 в ответ не берёт
  for (const b of finiteBounds(sol)) {
    const v = evalDisplayNum(display, b);
    if (Number.isNaN(v)) {
      if (contains(sol, b, 0)) return false;
      continue;
    }
    if (Math.abs(v) > 1e-7) return false;             // не корень — не граница
    if (contains(sol, b, 0) !== !OPS[op].strict) return false;
  }
  // Точка, в которой напечатанное выражение не определено, в ответ не входит
  for (const p of displayCriticalPoints(display)) {
    if (p.denomMult > 0 && contains(sol, sNum(p.x), 0)) return false;
  }
  return true;
}

// ─── Целые решения (для вопросов «сколько целых», «наименьшее целое») ────────
export function integerSolutions(sol, limit = 300) {
  const out = [];
  for (let x = -limit; x <= limit; x++) if (contains(sol, x)) out.push(x);
  return out;
}

/** Ограничено ли решение: у всех кусков конечные границы */
export const isBounded = (sol) =>
  sol.pieces.length > 0 && sol.pieces.every(p => p.lo !== null && p.hi !== null);

/**
 * Многочлен по целым корням с кратностями: `[{ r, mult }]` → коэффициенты по
 * возрастанию степени. Развёрнутый вид нужен категориям «разложите сами»:
 * печатается сумма, а корни уже известны.
 */
export function polyFromRoots(roots, lead = 1) {
  let coeffs = [lead];
  for (const { r, mult = 1 } of roots) {
    for (let i = 0; i < mult; i++) {
      const next = new Array(coeffs.length + 1).fill(0);
      for (let k = 0; k < coeffs.length; k++) {
        next[k + 1] += coeffs[k];                     // умножение на x
        next[k]     -= r * coeffs[k];                 // и на −r
      }
      coeffs = next;
    }
  }
  return coeffs;
}

/** Множитель-многочлен по целым корням: печать развёрнутая, корни известны */
export function polyFactor(roots, lead = 1) {
  const coeffs = polyFromRoots(roots, lead);
  return fPoly(coeffs, roots.map(({ r, mult = 1 }) => ({ x: sInt(r), mult })));
}

/** Правая часть неравенства строкой */
export function rhsTex(display, varTex) {
  if (display.rhsExpr) return renderExprTex(display.rhsExpr, varTex);
  return fmtNum(display.rhsConst || rat(0));
}
