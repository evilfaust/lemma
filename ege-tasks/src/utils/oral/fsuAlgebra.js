/**
 * Маленькая алгебра многочленов для заданий на формулы сокращённого
 * умножения с буквами: (2a − 3b)², x² − 49, (√(x + 1) − 2)².
 *
 * Многочлен — массив членов `{ c, vars, rad }`: рациональный коэффициент
 * (`linearExpr.rat`), степени букв `{ x: 2 }` и не больше одного корня
 * `rad` — подкоренной многочлен (сам корень в первой степени). Умножение
 * сразу упрощает: √L·√L = L, √L·√M = √(L·M), из числового корня выносится
 * квадрат (√18 = 3√2). Так и ответ, и неверные «ответы-ошибки» для теста
 * A/B/C/D считаются одними и теми же операциями из одних и тех же частей —
 * условие и ответ разойтись не могут.
 *
 * Корни считаются с неотрицательными подкоренными (область определения
 * иррационального уравнения) — √(L·M) = √L·√M без оговорок.
 */
import { rat, addR, mulR, negR, gcd } from '../linearExpr';

// ─── Числа ───────────────────────────────────────────────────────────────────

const R = (n, d = 1) => rat(n, d);
const isZeroR = (r) => r.n === 0;

// ─── Члены и многочлены ──────────────────────────────────────────────────────

function cleanVars(vars) {
  const out = {};
  for (const [k, e] of Object.entries(vars || {})) if (e) out[k] = e;
  return out;
}

const varsKey = (vars) => Object.keys(vars).sort().map(k => `${k}${vars[k]}`).join('');
const termKey = (t) => `${varsKey(t.vars)}|${t.rad ? tex(t.rad) : ''}`;

/** Сложить подобные и убрать нули. */
function collect(terms) {
  const map = new Map();
  for (const t of terms) {
    const k = termKey(t);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, c: addR(prev.c, t.c) } : t);
  }
  return [...map.values()].filter(t => !isZeroR(t.c));
}

/** Число как многочлен. */
export const num = (n, d = 1) => (n === 0 ? [] : [{ c: R(n, d), vars: {}, rad: null }]);

/** Одночлен: `mono(3, { x: 2 })` = 3x², `mono(1, 'a')` = a. */
export function mono(c, vars = {}) {
  const cr = typeof c === 'number' ? R(c) : c;
  const v = typeof vars === 'string' ? { [vars]: 1 } : vars;
  return isZeroR(cr) ? [] : [{ c: cr, vars: cleanVars(v), rad: null }];
}

export const add = (...ps) => collect(ps.flat());
export const neg = (p) => p.map(t => ({ ...t, c: negR(t.c) }));
export const sub = (p, q) => add(p, neg(q));
export const scale = (p, k) => mul(p, typeof k === 'number' ? num(k) : [{ c: k, vars: {}, rad: null }]);

/** Квадрат числа без квадратов: 18 → [3, 2]. */
function squareOut(n) {
  let s = 1;
  let f = n;
  for (let q = 2; q * q <= f; q++) {
    while (f % (q * q) === 0) { f /= q * q; s *= q; }
  }
  return [s, f];
}

/** Числовое значение многочлена-константы или null. */
export function constOf(p) {
  if (p.length === 0) return R(0);
  if (p.length === 1 && !p[0].rad && !Object.keys(p[0].vars).length) return p[0].c;
  return null;
}

/**
 * Квадратный корень из многочлена. Число — с вынесением квадрата
 * (√12 = 2√3, √4 = 2, √(1/2) = √2/2), многочлен — с вынесением общего
 * квадратного множителя коэффициентов (√(4x) = 2√x).
 */
export function sqrt(p) {
  const k = constOf(p);
  if (k) {
    if (k.n < 0) return null;
    if (k.n === 0) return [];
    // √(n/d) = √(n·d)/d
    const [s, f] = squareOut(k.n * k.d);
    const c = R(s, k.d);
    return f === 1 ? [{ c, vars: {}, rad: null }] : [{ c, vars: {}, rad: num(f) }];
  }
  if (p.some(t => t.rad)) return null;
  let g = 0;
  for (const t of p) {
    if (t.c.d !== 1) return [{ c: R(1), vars: {}, rad: p }];
    g = gcd(g, Math.abs(t.c.n));
  }
  const [s] = squareOut(g || 1);
  const inner = s === 1 ? p : p.map(t => ({ ...t, c: R(t.c.n / (s * s)) }));
  return [{ c: R(s), vars: {}, rad: inner }];
}

/** Произведение двух членов — многочлен (корни упрощаются). */
function mulTerm(a, b) {
  const vars = { ...a.vars };
  for (const [k, e] of Object.entries(b.vars)) vars[k] = (vars[k] || 0) + e;
  const base = { c: mulR(a.c, b.c), vars: cleanVars(vars), rad: null };
  if (!a.rad && !b.rad) return [base];
  if (!a.rad || !b.rad) return [{ ...base, rad: a.rad || b.rad }];
  // √L·√L = L, √L·√M = √(L·M)
  const same = tex(a.rad) === tex(b.rad);
  const inner = same ? a.rad : sqrt(mul(a.rad, b.rad));
  return mul([base], inner);
}

export function mul(...ps) {
  return ps.reduce((acc, p) => collect(acc.flatMap(a => p.flatMap(b => mulTerm(a, b)))), num(1));
}

export function pow(p, k) {
  let out = num(1);
  for (let i = 0; i < k; i++) out = mul(out, p);
  return out;
}

/** √L как многочлен (одночлен с корнем). */
export const root = (p) => sqrt(p);

export const equal = (p, q) => sub(p, q).length === 0;

// ─── Печать ──────────────────────────────────────────────────────────────────

const degOf = (t) =>
  Object.values(t.vars).reduce((s, e) => s + e, 0) + (t.rad ? polyDeg(t.rad) / 2 : 0);

function polyDeg(p) {
  return p.reduce((m, t) => Math.max(m, degOf(t)), 0);
}

/**
 * Порядок членов как в учебнике: по убыванию степени, при равной — по
 * алфавиту букв (a² + 2ab + b²), член без корня раньше члена с корнем
 * (4 + 2√3, x + 6√x + 9).
 */
function compareTerms(a, b) {
  const d = degOf(b) - degOf(a);
  if (d) return d;
  const letters = [...new Set([...Object.keys(a.vars), ...Object.keys(b.vars)])].sort();
  for (const v of letters) {
    const e = (b.vars[v] || 0) - (a.vars[v] || 0);
    if (e) return e;
  }
  return (a.rad ? 1 : 0) - (b.rad ? 1 : 0);
}

export const sorted = (p) => [...p].sort(compareTerms);

function coefTex(c) {
  return c.d === 1 ? String(c.n) : `\\frac{${c.n}}{${c.d}}`;
}

function varsTex(vars) {
  return Object.keys(vars).sort().map((v) => {
    const e = vars[v];
    if (e === 1) return v;
    return e >= 10 ? `${v}^{${e}}` : `${v}^${e}`;
  }).join('');
}

/** Член без знака: 3x^2, \frac{1}{4}x^2, 2\sqrt{x + 1}, 7. */
function absTermTex(t) {
  const c = t.c.n < 0 ? negR(t.c) : t.c;
  const body = varsTex(t.vars) + (t.rad ? `\\sqrt{${tex(t.rad)}}` : '');
  if (!body) return coefTex(c);
  if (c.n === 1 && c.d === 1) return body;
  return coefTex(c) + body;
}

/**
 * LaTeX многочлена. `order: 'asc'` — от младших членов к старшим
 * (9 − 6x + x²): так задание реже узнаётся «по картинке».
 */
export function tex(p, { order = 'desc' } = {}) {
  if (!p || p.length === 0) return '0';
  let terms = sorted(p);
  if (order === 'asc') terms = terms.reverse();
  return terms.map((t, i) => {
    const s = absTermTex(t);
    if (i === 0) return t.c.n < 0 ? `-${s}` : s;
    return t.c.n < 0 ? ` - ${s}` : ` + ${s}`;
  }).join('');
}

/** Один член без знака «−» впереди? */
export const isMonomial = (p) => p.length === 1;
export const isNegativeLead = (p) => sorted(p)[0]?.c.n < 0;

/** Скобка многочлена: (x + 3); одночлен без скобок не нуждается. */
export function paren(p, opts) {
  const t = tex(p, opts);
  return isMonomial(p) && !isNegativeLead(p) ? t : `\\left(${t}\\right)`;
}

/** Скобка всегда — под степенью: (2x)^2, (x + 3)^2. */
export function parenPow(p, k, opts) {
  const t = tex(p, opts);
  const simple = isMonomial(p) && !isNegativeLead(p)
    && Object.keys(p[0].vars).length === 1 && p[0].c.n === 1 && p[0].c.d === 1
    && Object.values(p[0].vars)[0] === 1 && !p[0].rad;
  return simple ? `${t}^${k}` : `\\left(${t}\\right)^${k}`;
}

/**
 * Произведение множителей: `factorsTex(2, [[p, 1], [q, 2]])` = 2(x − 3)(x + 3)².
 * Множитель-одночлен без коэффициента печатается без скобок.
 */
export function factorsTex(k, factors) {
  const kr = typeof k === 'number' ? R(k) : k;
  const body = factors.map(([p, e = 1]) => {
    if (e === 1) return isMonomial(p) && !isNegativeLead(p) && !p[0].rad ? tex(p) : `\\left(${tex(p)}\\right)`;
    return parenPow(p, e);
  }).join('');
  if (kr.n === 1 && kr.d === 1) return body;
  if (kr.n === -1 && kr.d === 1) return `-${body}`;
  return coefTex(kr) + body;
}

/** Значение произведения множителей — многочлен. */
export function factorsValue(k, factors) {
  const kr = typeof k === 'number' ? R(k) : k;
  return mul([{ c: kr, vars: {}, rad: null }], ...factors.map(([p, e = 1]) => pow(p, e)));
}
