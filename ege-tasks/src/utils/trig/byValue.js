/**
 * «По значению и четверти» — тригонометрия первой части профиля ЕГЭ
 * («Вычисления и преобразования»): найти k·cos α по sin α и четверти,
 * 24cos 2α по sin α, 26cos(3π/2 + α) по cos α, однородную дробь по tg α,
 * tg²α из «5sin²α + 13cos²α = 6», числовые выражения вида
 * 12sin 11°cos 11°/sin 22°.
 *
 * Задание строится ОТ ОТВЕТА: сначала точные sin α и cos α (числа Q(√m) —
 * пифагоровы тройки или «1 − t²» под корнем), затем вопрос. Ответ —
 * рациональное число (вписывается в бланк), и он сверяется численно с
 * настоящим углом α из указанной четверти.
 *
 * Задание несёт `check` — напечатанные части условия (что найти, условия,
 * промежуток) — по ним сторож пересчитывает ответ независимо.
 */

import {
  rat, R0, R1, addR, subR, mulR, divR, negR, absR, isZero, toNum, fmtNum,
} from '../linearExpr';
import {
  sr, sNum, sTex, sMul, sDiv, sAdd, sSub, sSqrt, sIsRat, sIsZero, sNeg, sInt, sRad,
} from '../surd';
import { FN_TEX, fnNum } from './angles';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ─── Четверти ────────────────────────────────────────────────────────────────
// sin/cos — знаки; lo/hi — границы в долях π
export const QUARTERS = [
  { lo: rat(0), hi: rat(1, 2), sin: 1, cos: 1, tex: '\\left(0;\\, \\dfrac{\\pi}{2}\\right)' },
  { lo: rat(1, 2), hi: rat(1), sin: 1, cos: -1, tex: '\\left(\\dfrac{\\pi}{2};\\, \\pi\\right)' },
  { lo: rat(1), hi: rat(3, 2), sin: -1, cos: -1, tex: '\\left(\\pi;\\, \\dfrac{3\\pi}{2}\\right)' },
  { lo: rat(3, 2), hi: rat(2), sin: -1, cos: 1, tex: '\\left(\\dfrac{3\\pi}{2};\\, 2\\pi\\right)' },
  { lo: rat(-1, 2), hi: rat(0), sin: -1, cos: 1, tex: '\\left(-\\dfrac{\\pi}{2};\\, 0\\right)' },
  { lo: rat(-1), hi: rat(-1, 2), sin: -1, cos: -1, tex: '\\left(-\\pi;\\, -\\dfrac{\\pi}{2}\\right)' },
];

// ─── Точные пары (sin α, cos α) по модулю ────────────────────────────────────
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];
// t рационально, второе значение √(1 − t²) иррационально: 0,2 → 2√6/5
const IRR_T = [rat(1, 5), rat(2, 5), rat(1, 3), rat(2, 3), rat(1, 4), rat(3, 4), rat(1, 10), rat(3, 10), rat(1, 7)];

/** |sin|, |cos| — оба числа Q(√m); `rational`: какое из них рационально */
function absPair() {
  if (chance(0.55)) {
    const [a, b, c] = rand(TRIPLES);
    const p = [sr(rat(a, c)), sr(rat(b, c))];
    return chance(0.5) ? { s: p[0], c: p[1] } : { s: p[1], c: p[0] };
  }
  const t = rand(IRR_T);
  const other = sSqrt(sr(subR(R1, mulR(t, t))));
  return chance(0.5) ? { s: sr(t), c: other } : { s: other, c: sr(t) };
}

/** Точный угол: значения четырёх функций в четверти q */
function exactAngle(q, pair = absPair()) {
  const s = q.sin < 0 ? sNeg(pair.s) : pair.s;
  const c = q.cos < 0 ? sNeg(pair.c) : pair.c;
  return { s, c, t: sDiv(s, c), ct: sDiv(c, s), q };
}

/** Настоящий угол α в четверти — для численной сверки */
function alphaOf(v) {
  let a = Math.atan2(sNum(v.s), sNum(v.c));
  const lo = toNum(v.q.lo) * Math.PI;
  while (a < lo) a += 2 * Math.PI;
  while (a > lo + 2 * Math.PI) a -= 2 * Math.PI;
  return a;
}

const valOf = (v, fn) => ({ sin: v.s, cos: v.c, tan: v.t, cot: v.ct }[fn]);

// ─── Запись ──────────────────────────────────────────────────────────────────
const A = '\\alpha';

/** Значение в условии: 0,6 или 3/5 (рациональное), 2√6/5 или 5/√26 */
function givenTex(s, style) {
  if (sIsRat(s)) return sTex(s, style === 'dec' ? 'dec' : 'frac');
  // «−5/√26» — так часто пишут в ЕГЭ: числитель целый, корень в знаменателе
  if (style === 'inv' && isZero(s.p)) {
    // q√m = n/√k ⇔ q²m = n²/k; берём n = q.n·m / ?, проще: q√m = (q·m)/√m
    const num = mulR(s.q, rat(s.m));
    if (num.d === 1) {
      const n = num.n;
      const sign = n < 0 ? '-' : '';
      return `${sign}\\dfrac{${Math.abs(n)}}{\\sqrt{${s.m}}}`;
    }
  }
  return sTex(s);
}

/** Коэффициент K и ответ K·v — рациональный, по возможности целый */
function scaleToRational(v) {
  if (sIsRat(v)) {
    const r = v.p;
    if (isZero(r)) return null;
    // целый ответ: K = знаменатель (иногда ×2, ×3); конечная дробь — иногда K = 1
    const opts = [rat(r.d), rat(r.d * 2), rat(r.d * 3)];
    if (r.d === 1 || [2, 4, 5, 10, 20, 25].includes(r.d)) opts.push(R1, rat(r.d > 1 ? 10 : 2));
    const K = rand(opts);
    return { K: sr(K), ans: mulR(K, r) };
  }
  // q√m: K = d√m → ответ q.n·m
  if (!isZero(v.p)) return null;
  const K = sr(R0, rat(v.q.d), v.m);
  const ans = sMul(K, v);
  return sIsRat(ans) ? { K, ans: ans.p } : null;
}

function coefTex(K) {
  if (sIsRat(K) && K.p.n === 1 && K.p.d === 1) return '';
  const t = sTex(K, 'dec');
  return /\\sqrt/.test(t) ? `${t}\\,` : t;
}

const fnA = (fn) => `${FN_TEX[fn]}\\,${A}`;

// ─── Задание ─────────────────────────────────────────────────────────────────
/**
 * ask — что найти (LaTeX), conds — условия «lhs = rhs», range — четверть.
 * expect — ответ числом для сверки по модели (если задан — обязан совпасть).
 */
function makeTask({ ask, conds = [], quarter = null, answer, cat, alpha = null, askNum = null }) {
  if (!answer) return null;
  const ansNum = toNum(answer);
  if (askNum !== null && Math.abs(askNum - ansNum) > 1e-9 * Math.max(1, Math.abs(ansNum))) return null;
  // ответ в бланк: целое или конечная десятичная дробь
  const ansTex = fmtNum(answer, 'dec');
  if (/dfrac/.test(ansTex)) return null;
  if (Math.abs(ansNum) > 1000) return null;
  const parts = [...conds];
  if (quarter) parts.push(`${A} \\in ${quarter.tex}`);
  const cond = parts.length
    ? `,\\; \\text{если}\\; ${parts.join('\\; \\text{и}\\; ')}`
    : '';
  return {
    exprLatex: `${ask}${cond}`,
    resultLatex: ansTex,
    answerValue: ansNum,
    cat,
    check: { ask, conds, range: quarter ? [toNum(quarter.lo), toNum(quarter.hi)] : null, alpha },
  };
}

// ─── Категории ───────────────────────────────────────────────────────────────
export const BY_VALUE_GENERATORS = {
  // sin ↔ cos через основное тождество
  identity_sc: () => {
    const q = rand(QUARTERS);
    const v = exactAngle(q);
    const given = chance(0.5) ? 'sin' : 'cos';
    const askFn = given === 'sin' ? 'cos' : 'sin';
    const sc = scaleToRational(valOf(v, askFn));
    if (!sc) return null;
    const gv = valOf(v, given);
    return makeTask({
      ask: `${coefTex(sc.K)}${fnA(askFn)}`,
      conds: [`${fnA(given)} = ${givenTex(gv, rand(['dec', 'frac', 'inv']))}`],
      quarter: q, answer: sc.ans, cat: 'identity_sc',
      askNum: sNum(sc.K) * fnNum(askFn, alphaOf(v)),
    });
  },

  // tg/ctg по sin или cos
  identity_tg: () => {
    const q = rand(QUARTERS);
    const v = exactAngle(q);
    const given = chance(0.5) ? 'sin' : 'cos';
    const askFn = chance(0.7) ? 'tan' : 'cot';
    const sc = scaleToRational(valOf(v, askFn));
    if (!sc) return null;
    return makeTask({
      ask: `${coefTex(sc.K)}${fnA(askFn)}`,
      conds: [`${fnA(given)} = ${givenTex(valOf(v, given), rand(['dec', 'frac', 'inv']))}`],
      quarter: q, answer: sc.ans, cat: 'identity_tg',
      askNum: sNum(sc.K) * fnNum(askFn, alphaOf(v)),
    });
  },

  // sin/cos по tg: tg α = 2√2, α ∈ (π; 3π/2) → 3cos α = −1
  identity_from_tg: () => {
    const q = rand(QUARTERS.slice(0, 4));
    // |tg| такой, что 1 + tg² — квадрат рационального
    const tg = rand([
      sr(rat(3, 4)), sr(rat(4, 3)), sr(rat(5, 12)), sr(rat(12, 5)), sr(rat(8, 15)), sr(rat(15, 8)),
      sRad(rat(2), 2), sRad(R1, 3), sRad(R1, 15), sRad(rat(2), 6), sRad(rat(1, 2), 3),
    ]);
    // 1 + tg² для tg = q√m — рационально: q²m
    const sq = sIsRat(tg) ? addR(R1, mulR(tg.p, tg.p)) : addR(R1, mulR(mulR(tg.q, tg.q), rat(tg.m)));
    const root = sSqrt(sr(sq));
    if (!root || !sIsRat(root)) return null;
    const c = sDiv(sInt(1), root);
    const s = sMul(tg, c);
    if (!c || !s) return null;
    const v = exactAngle(q, { s, c });
    const askFn = chance(0.5) ? 'cos' : 'sin';
    const sc = scaleToRational(valOf(v, askFn));
    if (!sc) return null;
    return makeTask({
      ask: `${coefTex(sc.K)}${fnA(askFn)}`,
      conds: [`${fnA('tan')} = ${sTex(v.t, 'dec')}`],
      quarter: q, answer: sc.ans, cat: 'identity_from_tg',
      askNum: sNum(sc.K) * fnNum(askFn, alphaOf(v)),
    });
  },

  // K·cos 2α по sin α или cos α — четверть не нужна
  double_cos: () => {
    const given = chance(0.6) ? 'sin' : 'cos';
    // значение — конечная десятичная дробь или рациональное: 0,2; 3/5; √3/3 …
    const g = rand([
      sr(rat(1, 5)), sr(rat(2, 5)), sr(rat(-1, 5)), sr(rat(3, 5)), sr(rat(-4, 5)), sr(rat(1, 10)),
      sr(rat(-3, 10)), sr(rat(1, 4)), sr(rat(3, 4)), sr(rat(-1, 4)), sr(rat(1, 3)), sr(rat(2, 3)),
      sRad(rat(1, 3), 3), sRad(rat(-1, 3), 6), sRad(rat(1, 5), 5), sRad(rat(2, 5), 5),
    ]);
    const g2 = sMul(g, g);
    // cos 2α = 1 − 2sin²α = 2cos²α − 1
    const c2 = given === 'sin' ? sSub(sInt(1), sMul(sInt(2), g2)) : sSub(sMul(sInt(2), g2), sInt(1));
    if (!c2 || !sIsRat(c2) || isZero(c2.p)) return null;
    const r = c2.p;
    const K = rand([rat(r.d), rat(r.d * 2), rat(r.d * 5), ...([1, 2, 4, 5, 10, 20, 25, 50].includes(r.d) ? [rat(rand([2, 3, 4, 5, 6, 8, 10, 24, 25]))] : [])]);
    const ans = mulR(K, r);
    const angle = given === 'sin' ? Math.asin(sNum(g)) : Math.acos(sNum(g));
    return makeTask({
      ask: `${coefTex(sr(K))}\\cos 2${A}`,
      conds: [`${fnA(given)} = ${givenTex(g, rand(['dec', 'frac']))}`],
      answer: ans, cat: 'double_cos',
      askNum: toNum(K) * Math.cos(2 * angle),
    });
  },

  // K·sin 2α по sin α (или cos α) и четверти
  double_sin: () => {
    const q = rand(QUARTERS);
    const v = exactAngle(q);
    const s2 = sMul(sInt(2), sMul(v.s, v.c));
    const sc = scaleToRational(s2);
    if (!sc) return null;
    const given = chance(0.5) ? 'sin' : 'cos';
    return makeTask({
      ask: `${coefTex(sc.K)}\\sin 2${A}`,
      conds: [`${fnA(given)} = ${givenTex(valOf(v, given), rand(['dec', 'frac', 'inv']))}`],
      quarter: q, answer: sc.ans, cat: 'double_sin',
      askNum: sNum(sc.K) * Math.sin(2 * alphaOf(v)),
    });
  },

  // 26cos(3π/2 + α), если cos α = 12/13 и α ∈ (3π/2; 2π) → 26 sin α
  reduction: () => {
    const q = rand(QUARTERS);
    const v = exactAngle(q);
    const row = rand(REDUCTION);
    const fn = rand(['sin', 'cos', 'tan', 'cot']);
    const [sign, g] = row.map[fn];
    const val = valOf(v, g);
    if (!val) return null;
    const signed = sign < 0 ? sNeg(val) : val;
    const sc = scaleToRational(signed);
    if (!sc) return null;
    // дано — значение функции, по которой считается ответ: другой (через тождество)
    const pool = g === 'sin' || g === 'cos' ? ['sin', 'cos'] : ['tan', 'sin', 'cos'];
    const given = rand(pool.filter(f => f !== g)) || g;
    const needsQuarter = !((g === 'tan' && given === 'cot') || (g === 'cot' && given === 'tan'));
    const argTex = row.plus ? `${row.tex} + ${A}` : `${row.tex} - ${A}`;
    const shift = toNum(row.k) * Math.PI;
    return makeTask({
      ask: `${coefTex(sc.K)}${FN_TEX[fn]}\\left(${argTex}\\right)`,
      conds: [`${fnA(given)} = ${givenTex(valOf(v, given), rand(['dec', 'frac', 'inv']))}`],
      quarter: needsQuarter ? q : null, answer: sc.ans, cat: 'reduction',
      askNum: sNum(sc.K) * fnNum(fn, shift + (row.plus ? 1 : -1) * alphaOf(v)),
    });
  },

  // (3cos α − 4sin α)/(2sin α − 5cos α), если tg α = 3
  homog: () => {
    const t = rand([rat(2), rat(3), rat(-2), rat(4), rat(5), rat(1, 2), rat(-3), rat(3, 2), rat(-1, 2), rat(7)]);
    const coef = () => (chance(0.15) ? 0 : randInt(-9, 9) || 1);
    let [a, b, c, d] = [coef(), coef(), coef(), coef()];
    // «−2sin α − 6cos α» в знаменателе — переворачиваем знаки всей дроби
    if (c < 0 && d < 0) { [a, b, c, d] = [-a, -b, -c, -d]; }
    // числитель a sin + b cos, знаменатель c sin + d cos; делим на cos: (a t + b)/(c t + d)
    const num = addR(mulR(rat(a), t), rat(b));
    const den = addR(mulR(rat(c), t), rat(d));
    if (isZero(den) || isZero(num)) return null;
    if ((a === 0 && b === 0) || (c === 0 || d === 0)) return null;
    if (a * d === b * c) return null;                       // дробь сокращается — ответ не зависит от tg
    const ans = divR(num, den);
    const lin = (p, q2) => {
      const terms = [];
      if (p) terms.push(`${p === 1 ? '' : p === -1 ? '-' : p}${fnA('sin')}`);
      if (q2) terms.push(`${q2 === 1 ? '' : q2 === -1 ? '-' : q2}${fnA('cos')}`);
      if (chance(0.5)) terms.reverse();
      return terms.reduce((acc, x) => (!acc ? x : x.startsWith('-') ? `${acc} - ${x.slice(1)}` : `${acc} + ${x}`), '');
    };
    const alpha = Math.atan(toNum(t));
    return makeTask({
      ask: `\\dfrac{${lin(a, b)}}{${lin(c, d)}}`,
      conds: [`${fnA('tan')} = ${fmtNum(t, 'dec')}`],
      answer: ans, cat: 'homog', alpha,
      askNum: (a * Math.sin(alpha) + b * Math.cos(alpha)) / (c * Math.sin(alpha) + d * Math.cos(alpha)),
    });
  },

  // tg²α, если 5sin²α + 13cos²α = 6 → (c − b)/(a − c)
  homog_sq: () => {
    const T = rand([2, 3, 4, 5, 6, 7, 8, 9, 1, 0.25, 0.5]);
    const tt = typeof T === 'number' && T < 1 ? rat(Math.round(T * 4), 4) : rat(T);
    const a = randInt(1, 12); const b = randInt(1, 15);
    if (a === b) return null;
    // a t² + b = c (t² + 1) → c = (a t² + b)/(t² + 1)
    const c = divR(addR(mulR(rat(a), tt), rat(b)), addR(tt, R1));
    if (c.d !== 1) return null;
    const alpha = Math.atan(Math.sqrt(toNum(tt)));
    return makeTask({
      ask: `${FN_TEX.tan}^2 ${A}`,
      conds: [`${a}\\sin^2 ${A} + ${b}\\cos^2 ${A} = ${c.n}`],
      answer: tt, cat: 'homog_sq', alpha,
      askNum: Math.tan(alpha) ** 2,
    });
  },

  // Числовые выражения в градусах
  numeric: () => rand(NUMERIC)(),
};

// f(k·π/2 ± α) = знак · g(α)
const REDUCTION = [
  { k: rat(1, 2), plus: false, tex: '\\dfrac{\\pi}{2}', map: { sin: [1, 'cos'], cos: [1, 'sin'], tan: [1, 'cot'], cot: [1, 'tan'] } },
  { k: rat(1, 2), plus: true, tex: '\\dfrac{\\pi}{2}', map: { sin: [1, 'cos'], cos: [-1, 'sin'], tan: [-1, 'cot'], cot: [-1, 'tan'] } },
  { k: rat(1), plus: false, tex: '\\pi', map: { sin: [1, 'sin'], cos: [-1, 'cos'], tan: [-1, 'tan'], cot: [-1, 'cot'] } },
  { k: rat(1), plus: true, tex: '\\pi', map: { sin: [-1, 'sin'], cos: [-1, 'cos'], tan: [1, 'tan'], cot: [1, 'cot'] } },
  { k: rat(3, 2), plus: false, tex: '\\dfrac{3\\pi}{2}', map: { sin: [-1, 'cos'], cos: [-1, 'sin'], tan: [1, 'cot'], cot: [1, 'tan'] } },
  { k: rat(3, 2), plus: true, tex: '\\dfrac{3\\pi}{2}', map: { sin: [-1, 'cos'], cos: [1, 'sin'], tan: [-1, 'cot'], cot: [-1, 'tan'] } },
  { k: rat(5, 2), plus: true, tex: '\\dfrac{5\\pi}{2}', map: { sin: [1, 'cos'], cos: [-1, 'sin'], tan: [-1, 'cot'], cot: [-1, 'tan'] } },
  { k: rat(2), plus: false, tex: '2\\pi', map: { sin: [-1, 'sin'], cos: [1, 'cos'], tan: [-1, 'tan'], cot: [-1, 'cot'] } },
];

// ─── Числовые выражения ──────────────────────────────────────────────────────
const NONSTD = [7, 11, 13, 14, 16, 17, 19, 21, 22, 23, 26, 28, 29, 31, 32, 34, 37, 38, 41, 43];
const deg = (d) => `${d}^{\\circ}`;

function numericTask(ask, answer) {
  return makeTask({ ask, answer, cat: 'numeric' });
}

const NUMERIC = [
  // K sin θ cos θ / sin 2θ = K/2
  () => {
    const th = rand(NONSTD); const K = 2 * randInt(2, 15);
    return numericTask(`\\dfrac{${K}\\sin ${deg(th)}\\cos ${deg(th)}}{\\sin ${deg(2 * th)}}`, rat(K / 2));
  },
  // K cos θ / sin(90° − θ) = K; K sin θ / cos(90° − θ)
  () => {
    const th = rand(NONSTD); const K = randInt(2, 30) * (chance(0.3) ? -1 : 1);
    return chance(0.5)
      ? numericTask(`\\dfrac{${K}\\cos ${deg(th)}}{\\sin ${deg(90 - th)}}`, rat(K))
      : numericTask(`\\dfrac{${K}\\sin ${deg(th)}}{\\cos ${deg(90 - th)}}`, rat(K));
  },
  // K sin(180° + θ) / sin θ = −K; K cos(180° − θ)/cos θ = −K; K sin(360° − θ)/sin θ = −K
  () => {
    const th = rand(NONSTD); const K = randInt(2, 30);
    const f = rand([
      [`\\sin ${deg(180 + th)}`, 'sin', -1], [`\\cos ${deg(180 - th)}`, 'cos', -1],
      [`\\sin ${deg(360 - th)}`, 'sin', -1], [`\\cos ${deg(360 - th)}`, 'cos', 1],
      [`\\sin ${deg(180 - th)}`, 'sin', 1],
    ]);
    return numericTask(`\\dfrac{${K}${f[0]}}{\\${f[1]} ${deg(th)}}`, rat(K * f[2]));
  },
  // K(sin²θ − cos²θ)/cos 2θ = −K
  () => {
    const th = rand(NONSTD); const K = randInt(2, 25);
    return numericTask(`\\dfrac{${K}\\left(\\sin^2 ${deg(th)} - \\cos^2 ${deg(th)}\\right)}{\\cos ${deg(2 * th)}}`, rat(-K));
  },
  // K/(sin²θ + sin²(90° − θ)) = K
  () => {
    const th = rand(NONSTD); const K = randInt(3, 40);
    return numericTask(`\\dfrac{${K}}{\\sin^2 ${deg(th)} + \\sin^2 ${deg(90 + th)}}`, rat(K));
  },
  // K tg θ · tg(90° − θ) = K; K tg θ · ctg(180° + θ) = K
  () => {
    const th = rand(NONSTD); const K = randInt(2, 30) * (chance(0.3) ? -1 : 1);
    return chance(0.5)
      ? numericTask(`${K}\\,\\operatorname{tg} ${deg(th)}\\cdot\\operatorname{tg} ${deg(90 - th)}`, rat(K))
      : numericTask(`${K}\\,\\operatorname{tg} ${deg(th)}\\cdot\\operatorname{ctg} ${deg(180 + th)}`, rat(K));
  },
  // табличные: 4√2 cos(−135°) = −4, 6√3 tg(−300°) = 18…
  () => {
    const expr = rand([
      '\\sqrt{2}\\,\\cos\\left(-135^{\\circ}\\right)',
      '\\sqrt{2}\\,\\sin 405^{\\circ}',
      '\\sqrt{3}\\,\\operatorname{tg}\\left(-300^{\\circ}\\right)',
      '\\sqrt{3}\\,\\cos 750^{\\circ}',
      '\\sin\\left(-\\dfrac{19\\pi}{6}\\right)',
      '\\sqrt{3}\\,\\operatorname{ctg}\\left(-\\dfrac{7\\pi}{6}\\right)',
      '\\sqrt{2}\\,\\sin\\dfrac{7\\pi}{4}',
      '\\cos\\dfrac{8\\pi}{3}',
    ]);
    const K = 2 * randInt(1, 9);
    const num = K * evaluateSimple(expr);
    if (Math.abs(num - Math.round(num)) > 1e-9) return null;
    return numericTask(`${K}${expr}`, rat(Math.round(num)));
  },
];

// Значение «√2 cos(−135°)», «sin(−19π/6)» — для табличных числовых
function evaluateSimple(tex) {
  const k = tex.includes('\\sqrt{2}') ? Math.SQRT2 : tex.includes('\\sqrt{3}') ? Math.sqrt(3) : 1;
  const fn = tex.includes('operatorname{tg}') ? 'tan' : tex.includes('operatorname{ctg}') ? 'cot'
    : tex.includes('\\cos') ? 'cos' : 'sin';
  let x;
  const degM = /(-?\d+)\^\{\\circ\}/.exec(tex);
  if (degM) x = (Number(degM[1]) * Math.PI) / 180;
  else {
    const m = /(-?)\\dfrac\{(\d+)\\pi\}\{(\d+)\}/.exec(tex);
    x = (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3])) * Math.PI;
  }
  return k * fnNum(fn, x);
}

export const BY_VALUE_LABELS = {
  identity_sc: 'cos α по sin α и четверти (и наоборот)',
  identity_tg: 'tg α, ctg α по sin α или cos α',
  identity_from_tg: 'sin α, cos α по tg α и четверти',
  double_cos: 'k·cos 2α по sin α или cos α',
  double_sin: 'k·sin 2α по sin α и четверти',
  reduction: 'Приведение: 26cos(3π/2 + α), если cos α = …',
  homog: 'Дробь по tg α: (3cos α − 4sin α)/(2sin α − 5cos α)',
  homog_sq: 'tg²α, если 5sin²α + 13cos²α = 6',
  numeric: 'Числовые: 12sin 11°cos 11° / sin 22°',
};

export const BY_VALUE_GROUPS = [
  { label: 'Основное тождество', keys: ['identity_sc', 'identity_tg', 'identity_from_tg'] },
  { label: 'Двойной угол', keys: ['double_cos', 'double_sin'] },
  { label: 'Формулы приведения', keys: ['reduction'] },
  { label: 'Однородные выражения', keys: ['homog', 'homog_sq'] },
  { label: 'Числовые выражения', keys: ['numeric'] },
];

/** Метки экзамена: всё это — профиль ЕГЭ, первая часть («Вычисления и преобразования») */
export const BY_VALUE_EXAM = Object.fromEntries(Object.keys(BY_VALUE_LABELS).map(k => [k, 'П']));
