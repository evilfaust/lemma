/**
 * Ядро тренажёра «Вычисление производных»: дерево выражения от x, производная
 * по правилам дифференцирования, упрощение и печать в LaTeX.
 *
 * Условие и ответ строятся из ОДНОГО дерева: условие печатается как есть,
 * ответ — `simplify(diff(f))`. Поэтому ответ нигде не пишется руками, а его
 * правильность проверяется численно (`verifyDerivative`): упрощённая
 * производная обязана совпасть с разностной производной самой функции в
 * нескольких точках. Упрощение, давшее ошибку, до листа не доедет.
 *
 * Узлы:
 *   { t: 'num', r }               — рациональное число (r из linearExpr)
 *   { t: 'x' }                    — переменная
 *   { t: 'pi' }                   — число π (в аргументах: sin(2x − π/3))
 *   { t: 'add', terms }           — сумма; знак слагаемого — в его коэффициенте
 *   { t: 'mul', factors }         — произведение; деление = множитель в степени −1
 *   { t: 'pow', b, e, view }      — b^e, e рациональное; view: 'power' — печатать
 *                                   показатель как есть (x^{−2}), иначе
 *                                   отрицательная степень уходит в знаменатель,
 *                                   дробная — под корень
 *   { t: 'fn', name, arg }        — sin cos tg ctg ln exp arcsin arccos arctg arcctg
 *   { t: 'log', a, arg }          — логарифм по основанию a
 *   { t: 'apow', a, arg }         — показательная a^arg
 *
 * Деления в дереве нет: `div(u, v)` сразу даёт `u · v^{−1}`. Так сокращение
 * «x/x²» и слияние «eˣ · e^{−2x}» — одно и то же правило сложения показателей,
 * а печать сама решает, что уходит в знаменатель.
 */

import {
  rat, addR, mulR, negR, isZero, isOne, toNum, R0, R1,
} from './linearExpr';

// ─── Конструкторы ────────────────────────────────────────────────────────────
const toRat = (v) => (typeof v === 'number' ? rat(v) : v);

export const N = (n, d = 1) => ({ t: 'num', r: rat(n, d) });
export const numR = (r) => ({ t: 'num', r });
export const X = { t: 'x' };
export const PI = { t: 'pi' };
export const add = (...terms) => ({ t: 'add', terms });
export const mul = (...factors) => ({ t: 'mul', factors });
export const pow = (b, e, view) => ({ t: 'pow', b, e: toRat(e), ...(view ? { view } : {}) });
export const div = (u, v) => mul(u, pow(v, -1));
export const fn = (name, arg) => ({ t: 'fn', name, arg });
export const logA = (a, arg) => ({ t: 'log', a, arg });
export const apow = (a, arg) => ({ t: 'apow', a, arg });
export const neg = (u) => mul(N(-1), u);
export const sub = (u, v) => add(u, neg(v));

export const sin = (u) => fn('sin', u);
export const cos = (u) => fn('cos', u);
export const tg = (u) => fn('tg', u);
export const ctg = (u) => fn('ctg', u);
export const ln = (u) => fn('ln', u);
export const exp = (u) => fn('exp', u);
export const sqrt = (u) => pow(u, rat(1, 2));

/** c·x^k; c — число или rat */
export function mono(c, k = 1) {
  const r = toRat(c);
  if (isZero(r)) return N(0);
  const xk = k === 0 ? null : (k === 1 ? X : pow(X, k));
  if (!xk) return numR(r);
  return isOne(r) ? xk : mul(numR(r), xk);
}

/** Многочлен по коэффициентам от младшего: poly([−1, 7, −5, 2]) = 2x³ − 5x² + 7x − 1 */
export function poly(coefs) {
  const terms = [];
  for (let k = coefs.length - 1; k >= 0; k--) {
    const r = toRat(coefs[k]);
    if (!isZero(r)) terms.push(mono(r, k));
  }
  if (!terms.length) return N(0);
  return terms.length === 1 ? terms[0] : add(...terms);
}

/** kx + b */
export const lin = (k, b) => poly([b, k]);

// ─── Ключ, зависимость от x, значение ───────────────────────────────────────
/** Структурный ключ узла: равные ключи — одинаковые выражения (вид печати не учитывается) */
export function keyOf(n) {
  switch (n.t) {
    case 'num': return `${n.r.n}/${n.r.d}`;
    case 'x': return 'x';
    case 'pi': return 'π';
    case 'add': return `(+ ${n.terms.map(keyOf).join(' ')})`;
    case 'mul': return `(* ${n.factors.map(keyOf).join(' ')})`;
    case 'pow': return `(^ ${keyOf(n.b)} ${n.e.n}/${n.e.d})`;
    case 'fn': return `(${n.name} ${keyOf(n.arg)})`;
    case 'log': return `(log${n.a} ${keyOf(n.arg)})`;
    case 'apow': return `(a${n.a} ${keyOf(n.arg)})`;
    default: return '?';
  }
}

export function hasX(n) {
  switch (n.t) {
    case 'x': return true;
    case 'num': case 'pi': return false;
    case 'add': return n.terms.some(hasX);
    case 'mul': return n.factors.some(hasX);
    case 'pow': return hasX(n.b);
    default: return hasX(n.arg);
  }
}

const FN_EVAL = {
  sin: Math.sin,
  cos: Math.cos,
  tg: Math.tan,
  ctg: (v) => 1 / Math.tan(v),
  ln: (v) => (v > 0 ? Math.log(v) : NaN),
  exp: Math.exp,
  arcsin: (v) => (Math.abs(v) < 1 ? Math.asin(v) : NaN),
  arccos: (v) => (Math.abs(v) < 1 ? Math.acos(v) : NaN),
  arctg: Math.atan,
  arcctg: (v) => Math.PI / 2 - Math.atan(v),
};

/** Значение в точке; NaN — вне области определения */
export function evalAt(n, x) {
  switch (n.t) {
    case 'num': return toNum(n.r);
    case 'x': return x;
    case 'pi': return Math.PI;
    case 'add': return n.terms.reduce((s, t) => s + evalAt(t, x), 0);
    case 'mul': return n.factors.reduce((s, f) => s * evalAt(f, x), 1);
    case 'pow': {
      const b = evalAt(n.b, x);
      const e = toNum(n.e);
      if (n.e.d === 1) {
        if (b === 0 && n.e.n < 0) return NaN;
        return b ** n.e.n;
      }
      // Корень чётной степени из отрицательного — вне области; из нуля при
      // отрицательном показателе — тоже. Корень нечётной степени — со знаком.
      if (b < 0) return n.e.d % 2 === 0 ? NaN : (n.e.n % 2 ? -1 : 1) * Math.abs(b) ** e;
      if (b === 0 && e < 0) return NaN;
      return b ** e;
    }
    case 'fn': return FN_EVAL[n.name](evalAt(n.arg, x));
    case 'log': {
      const v = evalAt(n.arg, x);
      return v > 0 ? Math.log(v) / Math.log(n.a) : NaN;
    }
    case 'apow': return n.a ** evalAt(n.arg, x);
    default: return NaN;
  }
}

// ─── Производная по правилам ─────────────────────────────────────────────────
/**
 * Производная без упрощения. `mode` включает типичные ошибки — из них
 * получаются правдоподобные неверные ответы для тестов A/B/C/D:
 *   naiveProduct — (uv)′ = u′v′
 *   quotSwap     — (u/v)′ = (uv′ − u′v)/v²
 *   quotPlus     — (u/v)′ = (u′v + uv′)/v²
 *   quotNoSquare — (u/v)′ = (u′v − uv′)/v
 *   noChain      — забыт множитель «производная внутренней функции»
 *   powKeep      — (xⁿ)′ = n·xⁿ (показатель не уменьшен)
 *   cosSign      — (cos u)′ = sin u
 *   expPow       — (eᵘ)′ = u·e^{u−1}, (aᵘ)′ = u·a^{u−1} (как у степени)
 */
export function diff(n, mode = {}) {
  const d = (u) => diff(u, mode);
  const chain = (outer, u) => (u.t === 'x' || mode.noChain ? outer : mul(outer, d(u)));

  switch (n.t) {
    case 'num': case 'pi': return N(0);
    case 'x': return N(1);
    case 'add': return add(...n.terms.map(d));

    case 'mul': {
      // Постоянный множитель выносится; дробь «u · v^{−1}» — по правилу частного
      const consts = n.factors.filter(f => !hasX(f));
      const rest = n.factors.filter(hasX);
      if (!rest.length) return N(0);
      const denom = rest.filter(f => f.t === 'pow' && f.e.n < 0 && f.view !== 'power');
      const numer = rest.filter(f => !denom.includes(f));
      if (denom.length && numer.length) {
        const u = numer.length === 1 ? numer[0] : mul(...numer);
        const v = denom.map(f => pow(f.b, negR(f.e), f.view));
        const vv = v.length === 1 ? v[0] : mul(...v);
        return mul(...consts, quotient(u, vv, mode));
      }
      if (rest.length === 1) return mul(...consts, d(rest[0]));
      if (mode.naiveProduct) return mul(...consts, ...rest.map(d));
      return mul(...consts, add(...rest.map((_, i) =>
        mul(...rest.map((g, j) => (i === j ? d(g) : g))))));
    }

    case 'pow': {
      if (!hasX(n.b)) return N(0);
      const e = mode.powKeep ? n.e : addR(n.e, negR(R1));
      return chain(mul(numR(n.e), pow(n.b, e, n.view)), n.b);
    }

    case 'fn': {
      const u = n.arg;
      if (!hasX(u)) return N(0);
      switch (n.name) {
        case 'sin': return chain(cos(u), u);
        case 'cos': return chain(mode.cosSign ? sin(u) : neg(sin(u)), u);
        case 'tg':  return chain(pow(cos(u), -2), u);
        case 'ctg': return chain(neg(pow(sin(u), -2)), u);
        case 'ln':  return chain(pow(u, -1), u);
        case 'exp': return mode.expPow
          ? chain(mul(u, exp(add(u, N(-1)))), u)
          : chain(exp(u), u);
        case 'arcsin': return chain(pow(add(N(1), neg(pow(u, 2))), rat(-1, 2)), u);
        case 'arccos': return chain(neg(pow(add(N(1), neg(pow(u, 2))), rat(-1, 2))), u);
        case 'arctg':  return chain(pow(add(N(1), pow(u, 2)), -1), u);
        case 'arcctg': return chain(neg(pow(add(N(1), pow(u, 2)), -1)), u);
        default: return N(0);
      }
    }

    case 'log': {
      if (!hasX(n.arg)) return N(0);
      return chain(pow(mul(n.arg, ln(N(n.a))), -1), n.arg);
    }

    case 'apow': {
      if (!hasX(n.arg)) return N(0);
      if (mode.expPow) return chain(mul(n.arg, apow(n.a, add(n.arg, N(-1)))), n.arg);
      return chain(mul(apow(n.a, n.arg), ln(N(n.a))), n.arg);
    }

    default: return N(0);
  }
}

/** Правило частного (u/v)′ = (u′v − uv′)/v² и его «ошибочные» варианты */
function quotient(u, v, mode) {
  const du = diff(u, mode);
  const dv = diff(v, mode);
  if (!hasX(u)) {
    // (c/v)′ = −c·v′/v²
    return mul(N(-1), u, dv, pow(v, mode.quotNoSquare ? -1 : -2));
  }
  let top;
  if (mode.quotSwap) top = add(mul(u, dv), neg(mul(du, v)));
  else if (mode.quotPlus) top = add(mul(du, v), mul(u, dv));
  else top = add(mul(du, v), neg(mul(u, dv)));
  return mul(top, pow(v, mode.quotNoSquare ? -1 : -2));
}

// ─── Многочлены ──────────────────────────────────────────────────────────────
const polyAdd = (a, b) => {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    out.push(addR(a[i] || R0, b[i] || R0));
  }
  return out;
};

const polyMul = (a, b) => {
  const out = Array.from({ length: a.length + b.length - 1 }, () => R0);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = addR(out[i + j], mulR(x, y)); }));
  return out;
};

/**
 * Коэффициенты многочлена (от младшего) или null. Степень суммы раскрывается
 * только до квадрата: (2x + 1)⁴ в ответе должен остаться скобкой, а не
 * превратиться в пять слагаемых.
 */
export function polyOf(n, maxPow = 2) {
  switch (n.t) {
    case 'num': return [n.r];
    case 'x': return [R0, R1];
    case 'add': {
      let acc = [R0];
      for (const t of n.terms) {
        const p = polyOf(t, maxPow);
        if (!p) return null;
        acc = polyAdd(acc, p);
      }
      return acc;
    }
    case 'mul': {
      let acc = [R1];
      for (const f of n.factors) {
        const p = polyOf(f, maxPow);
        if (!p) return null;
        acc = polyMul(acc, p);
      }
      return acc;
    }
    case 'pow': {
      if (n.e.d !== 1 || n.e.n < 0) return null;
      if (n.b.t !== 'x' && n.e.n > maxPow) return null;
      const p = polyOf(n.b, maxPow);
      if (!p) return null;
      let acc = [R1];
      for (let i = 0; i < n.e.n; i++) acc = polyMul(acc, p);
      return acc;
    }
    default: return null;
  }
}

const polyDegree = (p) => {
  for (let i = p.length - 1; i >= 0; i--) if (!isZero(p[i])) return i;
  return -1;
};

// ─── Упрощение ───────────────────────────────────────────────────────────────
/** Коэффициент и остальные множители произведения */
function splitCoef(n) {
  if (n.t === 'num') return { c: n.r, rest: [] };
  if (n.t !== 'mul') return { c: R1, rest: [n] };
  let c = R1;
  const rest = [];
  for (const f of n.factors) {
    if (f.t === 'num') c = mulR(c, f.r);
    else rest.push(f);
  }
  return { c, rest };
}

function build(c, rest) {
  if (isZero(c)) return N(0);
  if (!rest.length) return numR(c);
  if (isOne(c) && rest.length === 1) return rest[0];
  return isOne(c) ? mul(...rest) : mul(numR(c), ...rest);
}

const baseOf = (f) => (f.t === 'pow' ? { b: f.b, e: f.e, view: f.view } : { b: f, e: R1 });

/** Показательные множители (eᵘ, aᵘ) — их выносят за скобку: eˣ(x² + 2x) */
const isExpLike = (f) => (f.t === 'fn' && f.name === 'exp') || f.t === 'apow';

export function simplify(n) {
  switch (n.t) {
    case 'num': case 'x': case 'pi': return n;
    case 'fn': return fn(n.name, simplify(n.arg));
    case 'log': return logA(n.a, simplify(n.arg));
    case 'apow': return apow(n.a, simplify(n.arg));
    case 'pow': return simplifyPow(n);
    case 'mul': return simplifyMul(n);
    case 'add': return simplifyAdd(n);
    default: return n;
  }
}

function simplifyPow(n) {
  const b = simplify(n.b);
  const { e } = n;
  if (isZero(e)) return N(1);
  if (isOne(e)) return b;
  if (b.t === 'num') {
    if (e.d === 1) {
      const k = Math.abs(e.n);
      const r = rat(b.r.n ** k, b.r.d ** k);
      return numR(e.n < 0 ? rat(r.d, r.n) : r);
    }
    return pow(b, e, n.view);
  }
  // (u^a)^k = u^{ak} при целом k; наоборот нельзя: (x²)^{1/2} ≠ x
  if (b.t === 'pow' && e.d === 1) {
    return simplifyPow(pow(b.b, mulR(b.e, e), n.view || b.view));
  }
  // (u·v)^k = u^k·v^k при целом k
  if (b.t === 'mul' && e.d === 1) {
    return simplifyMul(mul(...b.factors.map(f => pow(f, e, n.view))));
  }
  // eᵘ в степени k = e^{ku}: знаменатель (eˣ)² сокращается с eˣ числителя.
  // Пометка den: экспонента пришла из знаменателя и печататься будет там же
  if (b.t === 'fn' && b.name === 'exp' && e.d === 1) {
    const out = exp(simplify(mul(numR(e), b.arg)));
    return e.n < 0 ? { ...out, den: true } : out;
  }
  return pow(b, e, n.view);
}

function simplifyMul(n) {
  // Сплющиваем вложенные произведения, числа перемножаем
  let c = R1;
  const flat = [];
  const push = (f) => {
    if (f.t === 'num') c = mulR(c, f.r);
    else if (f.t === 'mul') f.factors.forEach(push);
    else flat.push(f);
  };
  n.factors.map(simplify).forEach(push);
  if (isZero(c)) return N(0);

  // Одинаковые основания: складываем показатели (x·x² = x³, cos·cos = cos²,
  // x·x^{−2} = x^{−1}). Показательные функции — складываем аргументы.
  const groups = [];
  const byKey = new Map();
  let expArg = null;
  let expDen = false;
  const apowArgs = new Map();
  for (const f of flat) {
    if (f.t === 'fn' && f.name === 'exp') {
      expArg = expArg ? add(expArg, f.arg) : f.arg;
      if (f.den) expDen = true;
      if (!byKey.has('exp')) { byKey.set('exp', true); groups.push({ kind: 'exp' }); }
      continue;
    }
    if (f.t === 'apow') {
      apowArgs.set(f.a, apowArgs.has(f.a) ? add(apowArgs.get(f.a), f.arg) : f.arg);
      const k = `apow${f.a}`;
      if (!byKey.has(k)) { byKey.set(k, true); groups.push({ kind: 'apow', a: f.a }); }
      continue;
    }
    const { b, e, view } = baseOf(f);
    const k = keyOf(b);
    if (byKey.has(k)) {
      const g = byKey.get(k);
      g.e = addR(g.e, e);
      if (!g.view && view) g.view = view;
    } else {
      const g = { kind: 'pow', b, e, view };
      byKey.set(k, g);
      groups.push(g);
    }
  }

  let out = [];
  for (const g of groups) {
    if (g.kind === 'exp') {
      const a = simplify(expArg);
      if (a.t === 'num' && isZero(a.r)) continue;
      out.push(expDen ? { ...exp(a), den: true } : exp(a));
    } else if (g.kind === 'apow') {
      const a = simplify(apowArgs.get(g.a));
      if (a.t === 'num' && isZero(a.r)) continue;
      out.push(apow(g.a, a));
    } else if (!isZero(g.e)) {
      const f = isOne(g.e) ? g.b : simplifyPow(pow(g.b, g.e, g.view));
      if (f.t === 'num') c = mulR(c, f.r);
      else if (f.t === 'mul') {
        const s = splitCoef(f);
        c = mulR(c, s.c);
        out.push(...s.rest);
      } else out.push(f);
    }
  }

  out = mergeTrigRatios(out);
  ({ c, out } = cancelInFraction(c, out));
  // Отрицательная степень показательной функции могла стать одной eᵘ — ещё раз
  // сплющивать не нужно, но пустой список — это просто число
  return build(c, out);
}

/** Наименьший показатель x среди слагаемых суммы (слагаемое без x — 0) */
function minXExp(sum) {
  return sum.terms.map(t => {
    const x = splitCoef(t).rest.find(g => baseOf(g).b.t === 'x');
    return x ? baseOf(x).e : R0;
  }).reduce((a, e) => (ratLess(e, a) ? e : a));
}

/**
 * Числитель-скобка в произведении:
 *  · общий числовой множитель выносится к коэффициенту: ½·(2x − 4) = x − 2;
 *  · при xᵏ в знаменателе общий множитель xᵐ скобки сокращается:
 *    (x²cos x − 2x sin x)/x⁴ = (x cos x − 2 sin x)/x³.
 */
function cancelInFraction(c, factors) {
  let coef = c;
  let extraX = null;
  const inFraction = factors.some(f => f.t !== 'add' && baseOf(f).e.n < 0);
  let out = factors.map(f => {
    if (f.t !== 'add') return f;
    // Дробь в числителе дроби — к общему знаменателю:
    // ((x + 9)/x − ln x)/(x + 9)² = (x + 9 − x ln x)/(x(x + 9)²)
    if (inFraction) {
      const m = minXExp(f);
      if (m.n < 0) {
        f = simplifyAdd(add(...f.terms.map(t => mul(t, pow(X, negR(m))))));
        extraX = extraX ? addR(extraX, m) : m;
      }
    }
    if (f.t !== 'add') return f;
    // Числитель из одних минусов: −(x sin x + cos x)/x²
    if (inFraction && f.terms.every(t => signed(t).neg)) {
      coef = negR(coef);
      f = add(...f.terms.map(t => simplifyMul(mul(N(-1), t))));
    }
    if (c.d === 1) return f;
    const { c: k, node } = extractContent(f);
    coef = mulR(coef, k);
    return node;
  });
  if (extraX) {
    out.push(pow(X, extraX));
    const merged = simplifyMul(mul(numR(coef), ...out));
    const s2 = splitCoef(merged);
    return { c: s2.c, out: s2.rest };
  }
  const xi = out.findIndex(f => baseOf(f).b.t === 'x' && baseOf(f).e.n < 0);
  if (xi < 0) return { c: coef, out };
  let xe = baseOf(out[xi]).e;
  out = out.map(f => {
    if (f.t !== 'add') return f;
    const m = minXExp(f);
    if (!(m.n > 0)) return f;
    xe = addR(xe, m);
    return simplifyAdd(add(...f.terms.map(t => mul(t, pow(X, negR(m))))));
  });
  if (isZero(xe)) out.splice(xi, 1);
  else out[xi] = isOne(xe) ? X : pow(X, xe, baseOf(out[xi]).view);
  return { c: coef, out };
}

/** sin u · (cos u)^{−1} = tg u, cos u · (sin u)^{−1} = ctg u */
function mergeTrigRatios(factors) {
  const out = [...factors];
  const find = (name, eNum) => out.findIndex(f => {
    const { b, e } = baseOf(f);
    return b.t === 'fn' && b.name === name && e.d === 1 && e.n === eNum;
  });
  for (const [top, bottom, res] of [['sin', 'cos', 'tg'], ['cos', 'sin', 'ctg']]) {
    for (;;) {
      const i = find(top, 1);
      if (i < 0) break;
      const arg = keyOf(baseOf(out[i]).b.arg);
      const j = out.findIndex(f => {
        const { b, e } = baseOf(f);
        return b.t === 'fn' && b.name === bottom && e.d === 1 && e.n === -1 && keyOf(b.arg) === arg;
      });
      if (j < 0) break;
      const u = baseOf(out[i]).b.arg;
      const [lo, hi] = i < j ? [i, j] : [j, i];
      out.splice(hi, 1);
      out.splice(lo, 1, fn(res, u));
    }
  }
  return out;
}

function simplifyAdd(n) {
  const flat = [];
  const push = (t) => {
    if (t.t === 'add') t.terms.forEach(push);
    else if (!(t.t === 'num' && isZero(t.r))) flat.push(t);
  };
  n.terms.map(simplify).forEach(push);
  if (!flat.length) return N(0);

  // Вся сумма — многочлен: приводим к стандартному виду
  const p = polyOf(add(...flat));
  if (p) return simplifyPolyNode(p);

  // Подобные слагаемые: одинаковая «буквенная» часть — складываем коэффициенты.
  // Многочленные слагаемые собираем в один многочлен на месте первого из них.
  const groups = [];
  const byKey = new Map();
  let polyAcc = null;
  let polyPos = -1;
  for (const t of flat) {
    // Одночлены сливаем в многочлен; слагаемое со скобками оставляем как есть —
    // иначе у (x+1)²(x−2)³ одно слагаемое раскрылось бы, а другое нет
    const tp = splitCoef(t).rest.every(f => baseOf(f).b.t === 'x') ? polyOf(t) : null;
    if (tp) {
      polyAcc = polyAcc ? polyAdd(polyAcc, tp) : tp;
      if (polyPos < 0) { polyPos = groups.length; groups.push({ kind: 'poly' }); }
      continue;
    }
    const { c, rest } = splitCoef(t);
    const k = rest.map(keyOf).join(' ');
    if (byKey.has(k)) byKey.get(k).c = addR(byKey.get(k).c, c);
    else {
      const g = { kind: 'term', c, rest };
      byKey.set(k, g);
      groups.push(g);
    }
  }

  mergePythagoras(groups);
  let terms = [];
  for (const g of groups) {
    if (g.kind === 'poly') {
      const pn = simplifyPolyNode(polyAcc);
      if (pn.t === 'add') terms.push(...pn.terms);
      else if (!(pn.t === 'num' && isZero(pn.r))) terms.push(pn);
    } else if (!isZero(g.c)) {
      terms.push(build(g.c, g.rest));
    }
  }
  if (!terms.length) return N(0);
  if (terms.length === 1) return terms[0];

  terms = factorCommon(terms);
  return terms.length === 1 ? terms[0] : add(...terms);
}

const ratLess = (a, b) => a.n * b.d < b.n * a.d;

/** c·sin²u + c·cos²u = c (основное тригонометрическое тождество) */
function mergePythagoras(groups) {
  const sq = (g, name) => g.kind === 'term' && g.rest.length === 1 && g.rest[0].t === 'pow'
    && g.rest[0].e.n === 2 && g.rest[0].e.d === 1
    && g.rest[0].b.t === 'fn' && g.rest[0].b.name === name;
  for (const gs of groups) {
    if (!sq(gs, 'sin') || isZero(gs.c)) continue;
    const arg = keyOf(gs.rest[0].b.arg);
    const gc = groups.find(g => sq(g, 'cos') && keyOf(g.rest[0].b.arg) === arg
      && g.c.n === gs.c.n && g.c.d === gs.c.d);
    if (!gc) continue;
    gc.c = R0;
    gs.rest = [];
  }
}

/**
 * Вынос общего множителя за скобки:
 *   eˣx² + 2xeˣ                 = eˣ(x² + 2x)
 *   2(x+1)(x−2)³ + 3(x+1)²(x−2)² = (x+1)(x−2)²(5x − 1)
 *   √(2x+1) + x/√(2x+1)         = (3x + 1)/√(2x+1)
 * Выносятся показательные множители и скобки-суммы (с наименьшим показателем,
 * в том числе отрицательным и дробным — так дроби приводятся к общему
 * знаменателю). Степень x выносится только в паре «√x и 1/√x» — иначе
 * «6x + 2/x²» и «1/(3∛x²) + 28x³» превратились бы в громоздкую дробь.
 */
function factorCommon(terms) {
  let lists = terms.map(t => splitCoef(t));
  const commons = [];
  const findIn = (l, kind, key) => l.rest.findIndex(f => (kind === 'exp'
    ? keyOf(f) === key
    : !isExpLike(f) && keyOf(baseOf(f).b) === key));

  // Кандидаты — множители первого слагаемого; выносим все общие сразу, иначе
  // остаток после первой скобки раскрылся бы в многочлен
  for (const cand of [...lists[0].rest]) {
    const { b } = baseOf(cand);
    let kind;
    if (isExpLike(cand)) kind = 'exp';
    else if (b.t === 'add') kind = 'add';
    else if (b.t === 'x' && terms.length === 2) kind = 'x';
    else continue;
    const key = kind === 'exp' ? keyOf(cand) : keyOf(b);
    const idx = lists.map(l => findIn(l, kind, key));
    if (idx.some(i => i < 0)) continue;
    const exps = lists.map((l, j) => (kind === 'exp' ? R1 : baseOf(l.rest[idx[j]]).e));
    // x — только пара «x^{a−1} и x^{a}» с дробным a (след правила произведения
    // с корнем); у суммы ∛x + 7x⁴ слагаемые остаются слагаемыми
    if (kind === 'x') {
      const gap = addR(exps[0], negR(exps[1]));
      if (!exps.some(e => e.d > 1) || gap.d !== 1 || Math.abs(gap.n) !== 1) continue;
    }
    const min = exps.reduce((m, e) => (ratLess(e, m) ? e : m));
    const view = baseOf(lists[0].rest[idx[0]]).view;

    lists = lists.map((l, j) => {
      const rest = l.rest.filter((_, k) => k !== idx[j]);
      const left = addR(exps[j], negR(min));
      if (kind !== 'exp' && !isZero(left)) rest.push(isOne(left) ? b : pow(b, left, view));
      return { c: l.c, rest };
    });
    commons.push(kind === 'exp' ? cand : pow(b, min, view));
  }
  if (!commons.length) return terms;

  const inner = lists.map(l => build(l.c, l.rest));
  const { c, node } = extractContent(simplifyAdd(add(...inner)));
  return [simplifyMul(mul(numR(c), ...commons, node))];
}

/** Числовой множитель суммы за скобку: 3x/2 − 2 = ½(3x − 4), ½ln x + 1 = ½(ln x + 2) */
function extractContent(node) {
  if (node.t !== 'add') return { c: R1, node };
  const parts = node.terms.map(splitCoef);
  const lcm = parts.reduce((m, { c }) => (m * c.d) / gcdInt(m, c.d), 1);
  const g = parts.reduce((acc, { c }) => gcdInt(acc, Math.abs((c.n * lcm) / c.d)), 0);
  if (!g) return { c: R1, node };
  let k = rat(g, lcm);
  if (parts.every(({ c }) => c.n < 0)) k = negR(k);
  if (isOne(k)) return { c: R1, node };
  const inv = rat(k.d, k.n);
  return { c: k, node: add(...parts.map(({ c, rest }) => build(mulR(c, inv), rest))) };
}

function gcdInt(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function simplifyPolyNode(p) {
  const deg = polyDegree(p);
  if (deg < 0) return N(0);
  return poly(p.slice(0, deg + 1));
}

/** Производная, приведённая к печатному виду */
export const derivative = (f, mode) => simplify(diff(f, mode));

// ─── Печать ──────────────────────────────────────────────────────────────────
const FN_TEX = {
  sin: '\\sin', cos: '\\cos', tg: '\\operatorname{tg}', ctg: '\\operatorname{ctg}',
  ln: '\\ln', arcsin: '\\arcsin', arccos: '\\arccos',
  arctg: '\\operatorname{arctg}', arcctg: '\\operatorname{arcctg}',
};

function ratTex(r) {
  const a = Math.abs(r.n);
  return r.d === 1 ? String(a) : `\\frac{${a}}{${r.d}}`;
}

/** Аргумент функции: sin x, sin 3x, sin(3x + 1) */
function argTex(u) {
  if (u.t === 'x' || u.t === 'num') return ` ${tex(u)}`;
  if (u.t === 'mul' && u.factors.length === 2 && u.factors[0].t === 'num'
      && u.factors[0].r.d === 1 && u.factors[0].r.n > 0 && u.factors[1].t === 'x') {
    return ` ${tex(u)}`;
  }
  return `\\left(${tex(u)}\\right)`;
}

const needsArgParens = (u) => argTex(u).startsWith('\\left');

/** Порядок множителей при печати: 2x²eˣ(x + 1)·sin x */
function factorRank(f) {
  const { b } = baseOf(f);
  if (f.t === 'pi') return 1;
  if (b.t === 'x') return 1;
  if (isExpLike(f)) return 2;
  if (b.t === 'add' || b.t === 'mul') return 3;
  if (b.t === 'fn' && b.arg.t === 'num') return 5;      // ln 3 — в самый конец
  return 4;
}

let sortOn = true;

function sortFactors(list) {
  if (!sortOn) return list;
  return list
    .map((f, i) => ({ f, i, r: factorRank(f) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(o => o.f);
}

/** Степень с натуральным показателем */
function powIntTex(b, k) {
  if (k === 1) return baseTex(b);
  if (b.t === 'fn' && b.name !== 'exp') return `${FN_TEX[b.name]}^{${k}}${argTex(b.arg)}`;
  return `${baseTex(b)}^{${k}}`;
}

function baseTex(b) {
  if (b.t === 'x' || b.t === 'pi') return tex(b);
  if (b.t === 'num' && b.r.d === 1 && b.r.n >= 0) return tex(b);
  return `\\left(${tex(b)}\\right)`;
}

/** Положительная степень: целая — показателем, дробная — корнем (x√x, ∛x²) */
function posPowTex(b, e, view) {
  if (e.d === 1) return powIntTex(b, e.n);
  if (view === 'power') return `${baseTex(b)}^{\\frac{${e.n}}{${e.d}}}`;
  const whole = Math.floor(e.n / e.d);
  const rem = e.n % e.d;
  const inner = rem === 1 ? tex(b) : powIntTex(b, rem);
  const root = e.d === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${e.d}]{${inner}}`;
  return whole > 0 ? `${powIntTex(b, whole)}${root}` : root;
}

/** Множитель внутри произведения (без знака) */
function factorTex(f) {
  if (f.t === 'add') return `\\left(${tex(f)}\\right)`;
  if (f.t === 'pow') {
    if (f.e.n < 0) return `${baseTex(f.b)}^{-${f.e.d === 1 ? -f.e.n : `\\frac{${-f.e.n}}{${f.e.d}}`}}`;
    return posPowTex(f.b, f.e, f.view);
  }
  return tex(f);
}

const startsWithDigit = (s) => /^[0-9]/.test(s);
const isSimpleFn = (f) => f.t === 'fn' && f.name !== 'exp' && !needsArgParens(f.arg);

function joinFactors(list, { soloAddBare = false } = {}) {
  if (soloAddBare && list.length === 1 && list[0].t === 'add') return tex(list[0]);
  let out = '';
  list.forEach((f, i) => {
    const s = factorTex(f);
    if (i > 0) {
      const prev = list[i - 1];
      // «sin x · (2x + 1)», «3·2ˣ» — без точки читается иначе
      const prevOpenArg = isSimpleFn(prev) || (prev.t === 'pow' && isSimpleFn(prev.b));
      const nextIsFn = f.t === 'fn' || (f.t === 'pow' && f.b.t === 'fn');
      if (startsWithDigit(s) || (prevOpenArg && !nextIsFn)) out += ' \\cdot ';
      else out += ' ';
    }
    out += s;
  });
  return out;
}

/** «Алгебраические» множители можно поднимать в числитель дроби: ³⁄₄x² → 3x²/4 */
const isAlgebraic = (f) => {
  if (f.t === 'pow' && f.view === 'power' && f.e.d > 1) return false;
  const { b } = baseOf(f);
  return b.t === 'x' || b.t === 'add' || f.t === 'pi';
};

/** Произведение без знака: { neg, body } */
function mulSigned(factors) {
  let c = R1;
  const numer = [];
  const denom = [];
  for (const f of factors) {
    if (f.t === 'num') { c = mulR(c, f.r); continue; }
    // e^{−x}, пришедшая из знаменателя, там и печатается: (1 − x)/eˣ
    if (f.t === 'fn' && f.name === 'exp' && f.den && signed(f.arg).neg) {
      denom.push(exp(simplify(neg(f.arg))));
      continue;
    }
    if (f.t === 'pow' && f.e.n < 0 && f.view !== 'power') {
      const e = negR(f.e);
      denom.push(isOne(e) ? f.b : pow(f.b, e, f.view));
    } else numer.push(f);
  }
  const negSign = c.n < 0;
  const a = Math.abs(c.n);
  const top = sortFactors(numer);
  const bot = sortFactors(denom);

  const asFraction = bot.length > 0
    || (c.d > 1 && top.length > 0 && top.every(isAlgebraic));

  if (asFraction) {
    const topJoined = top.length ? joinFactors(top, { soloAddBare: a === 1 }) : '';
    let topTex = a !== 1 || !top.length ? String(a) : '';
    if (topJoined) topTex += (topTex && startsWithDigit(topJoined) ? ' \\cdot ' : '') + topJoined;
    const botJoined = bot.length ? joinFactors(bot, { soloAddBare: c.d === 1 }) : '';
    let botTex = c.d > 1 ? String(c.d) : '';
    if (botJoined) botTex += (botTex && startsWithDigit(botJoined) ? ' \\cdot ' : '') + botJoined;
    return { neg: negSign, body: `\\frac{${topTex}}{${botTex}}` };
  }

  const coefTex = c.d === 1 ? (a === 1 && top.length ? '' : String(a)) : `\\frac{${a}}{${c.d}}`;
  const rest = joinFactors(top);
  const sep = coefTex && startsWithDigit(rest) ? ' \\cdot ' : '';
  return { neg: negSign, body: `${coefTex}${sep}${rest}` };
}

function signed(n) {
  switch (n.t) {
    case 'num': return { neg: n.r.n < 0, body: ratTex(n.r) };
    case 'mul': return mulSigned(n.factors);
    case 'pow':
      if (n.e.n < 0 && n.view !== 'power') return mulSigned([n]);
      return { neg: false, body: factorTex(n) };
    default: return { neg: false, body: tex(n) };
  }
}

/** LaTeX выражения */
export function tex(n) {
  switch (n.t) {
    case 'num': return n.r.n < 0 ? `-${ratTex(n.r)}` : ratTex(n.r);
    case 'x': return 'x';
    case 'pi': return '\\pi';
    case 'add': {
      // «−x + 1» печатаем как «1 − x»: с плюса начинать привычнее. Только у
      // двучлена — у длинного многочлена порядок степеней важнее
      const parts = n.terms.map(signed);
      if (parts.length === 2 && parts[0].neg && !parts[1].neg) parts.reverse();
      let out = '';
      parts.forEach(({ neg: ng, body }, i) => {
        if (i === 0) out += (ng ? '-' : '') + body;
        else out += (ng ? ' - ' : ' + ') + body;
      });
      return out;
    }
    case 'mul': case 'pow': {
      const { neg: ng, body } = signed(n);
      return (ng ? '-' : '') + body;
    }
    case 'fn':
      if (n.name === 'exp') return `e^{${tex(n.arg)}}`;
      return `${FN_TEX[n.name]}${argTex(n.arg)}`;
    case 'log': return `\\log_{${n.a}}${argTex(n.arg)}`;
    case 'apow': return `${n.a}^{${tex(n.arg)}}`;
    default: return '?';
  }
}

/**
 * Печать условия: множители в том порядке, в каком их задала категория,
 * — «(x + 7)eˣ», а не «eˣ(x + 7)», как печатается ответ.
 */
export function texAsIs(n) {
  sortOn = false;
  try { return tex(n); } finally { sortOn = true; }
}

/** Печать с заменой буквы: x(t) = t³ − … */
export const texVar = (n, v = 'x') => (v === 'x' ? tex(n) : tex(n).replace(/x/g, v));

// ─── Проверка ────────────────────────────────────────────────────────────────
const SAMPLE_XS = [
  0.13, -0.21, 0.29, -0.34, 0.37, -0.43, 0.81, -0.92, 1.23, -1.37, 1.66, -1.84,
  2.14, -2.6, 2.71, 3.3, -3.4, 4.2, -4.6, 5.3, -5.8, 6.1, -7.1, 7.4, 9.3, 11.6,
];

/**
 * Упрощённая производная `df` совпадает с разностной производной `f` —
 * в достаточном числе точек, где обе определены и не слишком круты.
 */
export function verifyDerivative(f, df, { minPoints = 3 } = {}) {
  // Пятиточечная схема с двумя шагами: если они расходятся, точка стоит
  // слишком близко к полюсу (tg, 1/x) и для сверки не годится
  const numeric = (x, h) => {
    const vals = [x + 2 * h, x + h, x - h, x - 2 * h].map(t => evalAt(f, t));
    if (!vals.every(Number.isFinite)) return NaN;
    const [f2, f1, f0, fm] = vals;
    return (-f2 + 8 * f1 - 8 * f0 + fm) / (12 * h);
  };
  let ok = 0;
  for (const x of SAMPLE_XS) {
    const v = evalAt(df, x);
    if (!Number.isFinite(v) || Math.abs(v) > 1e6) continue;
    const h = 1e-3 * Math.max(1, Math.abs(x));
    const a = numeric(x, h);
    const b = numeric(x, h / 2);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const scale = Math.max(1, Math.abs(b));
    if (Math.abs(a - b) > 1e-6 * scale) continue;
    if (Math.abs(b - v) > 1e-5 * scale) return false;
    ok += 1;
  }
  return ok >= minPoints;
}

/** Совпадают ли два выражения численно (для отбраковки «ошибочных» ответов) */
export function sameFunction(a, b) {
  let checked = 0;
  for (const x of SAMPLE_XS) {
    const va = evalAt(a, x);
    const vb = evalAt(b, x);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) {
      if (Number.isFinite(va) !== Number.isFinite(vb)) return false;
      continue;
    }
    if (Math.abs(va - vb) > 1e-7 * Math.max(1, Math.abs(va))) return false;
    checked += 1;
  }
  return checked >= 3;
}

/**
 * Число → рациональное с небольшим знаменателем (значение производной в
 * точке). null — если число не «круглое» (√3/2, e², ln 3 и т.п.).
 */
export function toNiceRational(v, maxDen = 40) {
  if (!Number.isFinite(v)) return null;
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9 * Math.max(1, Math.abs(v))) return rat(n, d);
  }
  return null;
}
