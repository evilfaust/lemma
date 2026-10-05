/**
 * Простейшие показательные и логарифмические уравнения: ЕГЭ профиль №7 и
 * база №17.
 *
 * Уравнение строится от корня: выбирается x, затем показатель/аргумент
 * подгоняется так, чтобы обе части были степенями одного числа t. Корень
 * проверяется подстановкой в тестах (`__tests__/oralAnswers.test.js`), а у
 * логарифмов — ещё и область определения: аргумент и основание в корне
 * положительны, основание не равно 1.
 */
import {
  rat, addR, subR, mulR, divR, decTex, rand, randInt, chance, task, ipow,
  rpow, answerTex,
} from './kit';
import { powerForms } from './logarithms';

const pw = (b, e) => `${b}^{${e}}`;

/** Линейное выражение p·x + q для показателя или аргумента: «2x − 3», «−x + 1». */
export function linTex(p, q) {
  const ax = Math.abs(p) === 1 ? 'x' : `${Math.abs(p)}x`;
  if (q === 0) return p < 0 ? `-${ax}` : ax;
  // «5 − x», а не «−x + 5»
  if (p < 0 && q > 0) return `${q} - ${ax}`;
  return `${p < 0 ? '-' : ''}${ax} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
}

/** Аргумент логарифма: голый x без скобок, остальное — в скобках. */
const argT = (p, q) => (p === 1 && q === 0 ? 'x' : `\\left(${linTex(p, q)}\\right)`);

/** Основание, записанное через t: t^β (4, 8, 0,25, 1/3, √2). */
function baseTex(t, beta) {
  const forms = powerForms(t, beta).filter(f => f !== '1');
  if (!forms.length) return null;
  const f = rand(forms);
  return /frac|\{,\}|sqrt/.test(f) ? `\\left(${f}\\right)` : f;
}

/** Правая часть t^ν одной из записей (27, 1/27, 0,04, √3). */
function rhsTex(t, nu) {
  const forms = powerForms(t, nu);
  return forms.length ? rand(forms) : null;
}

/** Ответ годится для бланка: целое или короткая десятичная. */
const nice = (r, level) => {
  if (!r) return false;
  if (r.d === 1) return Math.abs(r.n) <= 60;
  const tex = answerTex(r);
  return !tex.includes('frac') && (level === 3 || tex.length <= 7);
};

function ans(expr, x, level) {
  return nice(x, level) ? task(expr, x) : null;
}

// ─── Показательные ──────────────────────────────────────────────────────────

/**
 * (t^β)^{p·x + q} = t^ν  ⇔  β(p·x + q) = ν  ⇔  x = (ν/β − q)/p.
 */
function expEquation(t, beta, p, q, nu, level) {
  const x = divR(subR(divR(nu, beta), rat(q)), rat(p));
  const b = baseTex(t, beta);
  const r = rhsTex(t, nu);
  if (!b || !r) return null;
  const e = p === 1 && q === 0 ? 'x' : linTex(p, q);
  return ans(`${pw(b, e)} = ${r}`, x, level);
}

// 1. aˣ = N
function basicExp(level) {
  const t = rand([2, 3, 5, 7, 10]);
  if (level === 1) return expEquation(t, rat(1), 1, 0, rat(randInt(0, t === 2 ? 6 : 3)), 1);
  if (level === 2) return expEquation(t, rat(rand([1, 1, 2])), 1, 0, rat(randInt(-4, 4)), 2);
  // уровень 3: основание — дробь или корень, правая часть — корень
  const beta = rand([rat(-1), rat(-2), rat(1, 2), rat(2), rat(3)]);
  const nu = rand([rat(1, 2), rat(-1, 2), rat(3), rat(-3), rat(3, 2), rat(-1)]);
  return expEquation(t, beta, 1, 0, nu, 3);
}

// 2. (p/q)ˣ = (r/s)ˣ → x = 0
function fracBaseEqual() {
  const a = rand([2, 3, 4, 5, 7]);
  const b = rand([3, 5, 7, 8, 9].filter(x => x !== a));
  const f1 = `\\dfrac{1}{${a}}`;
  const whole = chance(0.5);
  const f2 = whole ? `${b}^{x}` : `\\left(\\dfrac{${Math.min(a, b) === a ? 1 : 2}}{${b}}\\right)^{x}`;
  return task(`\\left(${f1}\\right)^{x} = ${f2}`, rat(0));
}

// 3. a^{x ± k} = N, 7^{−6−x} = 343, 16^{x−9} = 1/2
function shiftedExp(level) {
  const t = rand([2, 3, 5, 7]);
  if (level === 1) {
    const q = rand([-3, -2, -1, 1, 2, 3]);
    return expEquation(t, rat(1), 1, q, rat(randInt(1, t === 2 ? 5 : 3)), 1);
  }
  if (level === 2) {
    const p = rand([1, 1, -1, 2, 3, -2]);
    const q = randInt(-9, 9);
    return expEquation(t, rat(1), p, q, rat(randInt(-3, 3)), 2);
  }
  // уровень 3: основание и правая часть — степени одного числа: 16^{x−9} = 1/2
  const beta = rat(rand([2, 3, 4, -1, -2, -3]));
  const p = rand([1, -1, 2]);
  const q = randInt(-9, 9);
  const nu = rat(rand([-4, -3, -2, -1, 1, 2, 3, 5, 6]));
  return expEquation(t, beta, p, q, nu, 3);
}

// 4. a^{−kx} = N
function negCoeffExp(level) {
  const t = rand([2, 3, 5]);
  const k = rand(level === 1 ? [1, 2] : [2, 3, 4]);
  const beta = level === 3 ? rat(rand([2, -1])) : rat(1);
  return expEquation(t, beta, -k, 0, rat(rand([-4, -2, 2, 3, 4, 6])), level);
}

// 5. aˣ · bˣ = c, a^{px+q} : a^{rx+s} = N
function productExp(level) {
  if (level < 3) {
    const [a, b] = rand([[2, 3], [2, 5], [3, 5], [2, 7], [4, 5], [2, 4]]);
    const x = level === 1 ? randInt(1, 3) : randInt(-3, 3);
    const v = rpow(rat(a * b), x);
    const r = decTex(v) && decTex(v).length <= 9 ? decTex(v) : (v.d === 1 ? String(v.n) : `\\dfrac{${v.n}}{${v.d}}`);
    if (Math.abs(v.n) > 10000) return null;
    return ans(`${a}^{x} \\cdot ${b}^{x} = ${r}`, rat(x), level);
  }
  // 13^{2x+3} : 13^{−4x−11} = 169 → 6x + 14 = 2
  const a = rand([2, 3, 5, 7, 11, 13]);
  const p1 = randInt(1, 4); const q1 = randInt(-9, 9);
  const p2 = -randInt(1, 4); const q2 = randInt(-12, 9);
  const k = randInt(-2, 3);
  const x = divR(rat(k - q1 + q2), rat(p1 - p2));
  const rhs = k >= 0 ? String(ipow(a, k)) : `\\dfrac{1}{${ipow(a, -k)}}`;
  return ans(`${pw(a, linTex(p1, q1))} : ${pw(a, linTex(p2, q2))} = ${rhs}`, x, 3);
}

// ─── Логарифмические ────────────────────────────────────────────────────────

const lg = (b) => (b === '10' ? '\\lg' : `\\log_{${b}}`);

// 6. log_a x = n
function simpleLog(level) {
  const t = rand([2, 3, 5, 7]);
  if (level === 1) {
    const n = randInt(1, t === 2 ? 5 : 3);
    return ans(`\\log_{${t}} x = ${n}`, rat(ipow(t, n)), 1);
  }
  if (level === 2) {
    const b = rand([2, 3, 4, 5, 6, 8, 9, 10, 0]);
    const base = b || t;
    const n = rand([-3, -2, -1, 2, 3, 4]);
    return ans(`${lg(String(base))} x = ${n}`, rpow(rat(base), n), 2);
  }
  // уровень 3: основание — дробь: log_{1/2} x = −3, log_{0,2} x = 2
  const b = rand([rat(1, 2), rat(1, 3), rat(1, 5), rat(1, 4)]);
  const n = rand([-3, -2, 2, 3]);
  const bt = chance(0.5) && decTex(b) ? decTex(b) : `\\frac{${b.n}}{${b.d}}`;
  return ans(`\\log_{${bt}} x = ${n}`, rpow(b, n), 3);
}

// 7. log_x N = n и log_{x − k} N = n
function logAsBase(level) {
  const base = randInt(2, level === 1 ? 7 : 12);
  const n = rand(level === 1 ? [2, 3] : [2, 3, 4, -1, -2]);
  const N = rpow(rat(base), n);
  if (N.n > 5000 || N.d > 5000) return null;
  const Nt = N.d === 1 ? String(N.n) : `\\dfrac{1}{${N.d}}`;
  if (level < 3) return ans(`\\log_{x} ${Nt} = ${n}`, rat(base), level);
  // log_{x − k} 64 = 2 → x = k + 8 (основание > 0 и ≠ 1 — по построению)
  const k = randInt(-6, 9);
  if (k === 0) return null;
  return ans(`\\log_{${linTex(1, -k)}} ${Nt} = ${n}`, rat(base + k), 3);
}

/** Аргумент логарифма p·x + q при найденном x должен быть положительным. */
const positive = (p, q, x) => addR(mulR(rat(p), x), rat(q)).n > 0;

// 8. log_a(kx + b) = n
function logLinear(level) {
  const a = rand([2, 3, 5, 7]);
  const n = level === 1 ? randInt(1, 3) : randInt(-1, 4);
  const v = rpow(rat(a), n);          // значение аргумента
  if (v.n > 400) return null;
  const p = level === 1 ? rand([1, 2, 3, 4]) : rand([1, -1, 2, 3, 4, 5, -2]);
  const q = level === 1 ? 0 : randInt(-15, 15);
  const x = divR(subR(v, rat(q)), rat(p));
  return ans(`${lg(String(a))} ${argT(p, q)} = ${n}`, x, level);
}

// 9. log_a(x + p) + log_a b = log_a c  /  = n
function logSumConst(level) {
  const a = rand([2, 3, 4, 5, 7]);
  const b = rand([2, 3, 4, 5, 6, 8].filter(v => v !== a));
  const p = level === 1 ? 0 : randInt(-9, 9);
  const k = level === 1 ? 1 : rand([1, 1, 2, 5]);
  if (level === 1 || chance(0.5)) {
    // log_a(k·x + p) + log_a b = n:  b(kx + p) = a^n
    const n = randInt(1, 4);
    const v = divR(rat(ipow(a, n)), rat(b));
    const x = divR(subR(v, rat(p)), rat(k));
    if (ipow(a, n) > 1000) return null;
    return ans(`\\log_{${a}} ${argT(k, p)} + \\log_{${a}} ${b} = ${n}`, x, level);
  }
  // log_5(x + 3) + log_5 4 = log_5 16
  const c = b * randInt(2, 9);
  const x = divR(subR(rat(c / b), rat(p)), rat(k));
  return ans(`\\log_{${a}} ${argT(k, p)} + \\log_{${a}} ${b} = \\log_{${a}} ${c}`, x, level);
}

// 10. log_a(kx + p) − log_a b = log_a c  /  = n
function logDiffConst(level) {
  const a = rand([2, 3, 4, 5, 7]);
  const b = rand([2, 3, 4, 5, 6]);
  const k = level === 1 ? 1 : rand([1, 2, 5]);
  const p = level === 1 ? 0 : randInt(-10, 10);
  if (level === 1 || chance(0.5)) {
    const n = randInt(1, 3);
    const v = rat(b * ipow(a, n));
    if (v.n > 1000) return null;
    const x = divR(subR(v, rat(p)), rat(k));
    return ans(`\\log_{${a}} ${argT(k, p)} - \\log_{${a}} ${b} = ${n}`, x, level);
  }
  // log_2(5x − 7) − log_2 5 = log_2 21 → 5x − 7 = 105
  const c = randInt(2, 30);
  const x = divR(subR(rat(b * c), rat(p)), rat(k));
  return ans(`\\log_{${a}} ${argT(k, p)} - \\log_{${a}} ${b} = \\log_{${a}} ${c}`, x, level);
}

// 11. k + log_a x = n
function constPlusLog(level) {
  const a = rand([2, 3, 5]);
  const k = randInt(1, 6);
  const m = level === 1 ? randInt(1, 3) : randInt(-2, 4);   // log_a x = m
  const x = rpow(rat(a), m);
  const lhs = level === 3 ? `${k} - \\log_{${a}} x` : `${k} + \\log_{${a}} x`;
  const n = level === 3 ? k - m : k + m;
  return ans(`${lhs} = ${n}`, x, level);
}

// 12. log_a (x / k) = n
function logFraction(level) {
  const a = rand([2, 3, 5]);
  const n = level === 1 ? randInt(1, 3) : randInt(-2, 3);
  const k = randInt(2, 9);
  const x = mulR(rat(k), rpow(rat(a), n));
  return ans(`\\log_{${a}} \\dfrac{x}{${k}} = ${n}`, x, level);
}

// 13. log_a x = log_a b + log_a c
function logRhsSum(level) {
  const a = rand([2, 3, 5, 6, 7]);
  const b = randInt(2, 9);
  const c = randInt(2, 9);
  if (level === 1) return ans(`\\log_{${a}} x = \\log_{${a}} ${b} + \\log_{${a}} ${c}`, rat(b * c), 1);
  if (level === 2) {
    return chance(0.5)
      ? ans(`\\log_{${a}} x = \\log_{${a}} ${b * c} - \\log_{${a}} ${c}`, rat(b), 2)
      : ans(`\\log_{${a}} x = 2\\log_{${a}} ${b} + \\log_{${a}} ${c}`, rat(b * b * c), 2);
  }
  return ans(`\\log_{${a}} x = \\log_{${a}} ${b} - \\log_{${a}} ${c} + 1`, rat(b * a, c), 3);
}

// 14. log_a(px + q) = log_a(rx + s) — профиль №7
function logEqualArgs(level) {
  const a = rand([2, 3, 5, 7, 11, 13]);
  if (level === 1) {
    // log_5(5 − x) = log_5 3
    const q = randInt(2, 15);
    const c = randInt(1, 20);
    const p = rand([1, -1]);
    const x = divR(rat(c - q), rat(p));
    if (!positive(p, q, x)) return null;
    return ans(`\\log_{${a}} ${argT(p, q)} = \\log_{${a}} ${c}`, x, 1);
  }
  // log_7(x + 9) = log_7(2x − 11): обе части положительны в корне
  const x = rat(randInt(-5, 25));
  const p1 = rand([1, 2, 3, -1]); const p2 = rand([1, 2, 3, 4, -2].filter(v => v !== p1));
  const v = randInt(1, 30);                        // общее значение аргументов
  const q1 = v - p1 * x.n; const q2 = v - p2 * x.n;
  if (level === 3) {
    // log_3(6 + 5x) = log_3(4 − 5x) + 2: (6 + 5x) = a²·(4 − 5x)
    const aa = rand([2, 3]);
    const w = randInt(1, 6);                        // значение правого аргумента
    const P = rand([1, 2, 3, 5]);
    const X = rat(randInt(-4, 4), rand([1, 5, 10]));
    const R = -P;
    const S = subR(rat(w), mulR(rat(R), X));        // R·X + S = w
    const Q = subR(rat(aa * aa * w), mulR(rat(P), X));
    if (S.d !== 1 || Q.d !== 1) return null;
    return ans(`\\log_{${aa}} \\left(${linTex(P, Q.n)}\\right) = \\log_{${aa}} \\left(${linTex(R, S.n)}\\right) + 2`, X, 3);
  }
  return ans(`\\log_{${a}} \\left(${linTex(p1, q1)}\\right) = \\log_{${a}} \\left(${linTex(p2, q2)}\\right)`, x, 2);
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export const LOGEXP_GENERATORS = {
  basicExp, fracBaseEqual, shiftedExp, negCoeffExp, productExp,
  simpleLog, logAsBase, logLinear, logSumConst, logDiffConst,
  constPlusLog, logFraction, logRhsSum, logEqualArgs,
};

export const LOGEXP_LABELS = {
  basicExp:      'aˣ = N: 5ˣ = 0,04',
  fracBaseEqual: 'Дробные основания: (p/q)ˣ = (r/s)ˣ',
  shiftedExp:    'a^(px+q) = N: 3^{x−2} = 27, 16^{x−9} = 1/2',
  negCoeffExp:   'a^(−kx) = N',
  productExp:    'aˣ·bˣ = c, частное степеней',
  simpleLog:     'logₐ x = n',
  logAsBase:     'Основание: log_x a = n',
  logLinear:     'logₐ(kx + b) = n',
  logSumConst:   'logₐ(x + p) + logₐ b = …',
  logDiffConst:  'logₐ(kx + p) − logₐ b = …',
  constPlusLog:  'k ± logₐ x = n',
  logFraction:   'logₐ(x/k) = n',
  logRhsSum:     'logₐ x = logₐ b ± logₐ c',
  logEqualArgs:  'logₐ(px + q) = logₐ(rx + s)',
};

const PB = ['П7', 'Б17'];
export const LOGEXP_EXAM = {
  basicExp: PB, shiftedExp: PB, negCoeffExp: PB, productExp: PB,
  simpleLog: PB, logAsBase: ['П7'], logLinear: PB, logSumConst: PB,
  logDiffConst: PB, constPlusLog: PB, logFraction: PB, logRhsSum: PB, logEqualArgs: PB,
};

export const LOGEXP_GROUPS = [
  { label: 'Показательные уравнения', keys: ['basicExp', 'fracBaseEqual', 'shiftedExp', 'negCoeffExp', 'productExp'] },
  { label: 'Логарифмические уравнения', keys: ['simpleLog', 'logAsBase', 'logLinear', 'logSumConst', 'logDiffConst', 'constPlusLog', 'logFraction', 'logRhsSum', 'logEqualArgs'] },
];
