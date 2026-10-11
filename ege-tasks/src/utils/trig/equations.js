/**
 * Тригонометрические уравнения A·f(kx + b) + B = C — от модели к ответу.
 *
 * Задание строится из модели: функция, коэффициенты, аргумент. Серии корней
 * считает ядро `angles.js` (простейшее уравнение f(u) = a → подстановка
 * u = kx + b), а перед выдачей каждое задание проверяется подстановкой:
 * каждая точка каждой серии обращает НАПЕЧАТАННОЕ уравнение в верное
 * равенство, а различных корней на периоде ровно столько, сколько их у
 * f(u) = a. До v3.9.347 ответы этих листов были набраны руками, и 16 из них
 * оказались неверными — поэтому никаких таблиц ответов здесь нет.
 */

import { sr, sNum, sTex, sMul, sIsZero, sNeg, sInt, sRad, S0 } from '../surd';
import {
  ang, angPi, angNum, angSub, angScale, angTex, familyPoints, familiesTex, residues,
  basicFamilies, transformFamily, valuesFor, plainValue, principal,
  FN_TEX, fnNum, famLin, famAlt, famPm, R0, R1, rat, mulR, divR, absR, toNum,
  isZero, negR, addR, subR, fmtNum, piTex, joinSigned, sameRoots,
} from './angles';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

// ─── Значения как числа Q(√m) (для коэффициентов A·a = c) ────────────────────
const SURD_OF = {
  '0': S0, '1': sInt(1), '-1': sInt(-1),
  '1/2': sr(rat(1, 2)), '-1/2': sr(rat(-1, 2)),
  's2/2': sRad(rat(1, 2), 2), '-s2/2': sRad(rat(-1, 2), 2),
  's3/2': sRad(rat(1, 2), 3), '-s3/2': sRad(rat(-1, 2), 3),
  's3/3': sRad(rat(1, 3), 3), '-s3/3': sRad(rat(-1, 3), 3),
  's3': sRad(R1, 3), '-s3': sRad(rat(-1), 3),
};
export const surdOfValue = (v) => SURD_OF[v.key] || (v.r ? sr(v.r) : null);

/** Коэффициенты A, при которых A·a — короткое число (2·√3/2 = √3, √3·√3/3 = 1) */
function coefChoices(fn, v) {
  const out = [sInt(1)];
  const k = v.key.replace('-', '');
  if (fn === 'sin' || fn === 'cos') {
    if (k !== '0' && k !== '1') out.push(sInt(2));
    if (k === 's2/2') out.push(sRad(R1, 2));
  } else {
    if (k === 's3' || k === 's3/3') out.push(sRad(R1, 3));
    if (k === 's3/3') out.push(sInt(3));
  }
  return out;
}

// ─── Запись аргумента ────────────────────────────────────────────────────────
/** k·x: x, -x, 2x, \dfrac{x}{2}, -\dfrac{x}{3}, \dfrac{2x}{3} */
export function kxTex(k, v = 'x') {
  const n = Math.abs(k.n);
  const head = k.n < 0 ? '-' : '';
  if (k.d === 1) return `${head}${n === 1 ? '' : n}${v}`;
  return `${head}\\dfrac{${n === 1 ? '' : n}${v}}{${k.d}}`;
}

/**
 * Аргумент функции. `order: 'kb'` — «2x + π/6», `'bk'` — «π/6 − 2x».
 * unit 'num' — аргумент π·(kx + b): «\dfrac{\pi(x - 1)}{3}».
 */
export function argTex(k, b, { v = 'x', unit = 'pi', order = 'kb' } = {}) {
  if (unit === 'num') {
    const d = (k.d * b.d) / gcdInt(k.d, b.d);
    const p = k.n * (d / k.d);
    const q = b.n * (d / b.d);
    const lin = q === 0
      ? `${p === 1 ? '' : p === -1 ? '-' : p}${v}`
      : `${p === 1 ? '' : p === -1 ? '-' : p}${v} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
    const body = q === 0 ? `\\pi ${lin}` : `\\pi(${lin})`;
    return { tex: d === 1 ? body : `\\dfrac{${body}}{${d}}`, simple: true };
  }
  if (isZero(b)) {
    const t = kxTex(k, v);
    return { tex: t, simple: k.n > 0 };
  }
  const bT = piTex(absR(b));
  if (order === 'bk' && k.n < 0) {
    // π/6 − 2x
    const head = b.n < 0 ? `-${bT}` : bT;
    return { tex: `${head} - ${kxTex(absR(k), v)}`, simple: false };
  }
  return { tex: `${kxTex(k, v)} ${b.n < 0 ? '-' : '+'} ${bT}`, simple: false };
}

function gcdInt(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }

/** f(аргумент): «\sin 2x», «\cos\dfrac{x}{3}», «\operatorname{tg}\left(x - \dfrac{\pi}{6}\right)» */
export function applyTex(fn, arg) {
  const f = FN_TEX[fn];
  if (arg.simple) return arg.tex.startsWith('\\') ? `${f}${arg.tex}` : `${f} ${arg.tex}`;
  return `${f}\\left(${arg.tex}\\right)`;
}

/** Коэффициент перед функцией: «2», «\sqrt{3}», «-» */
function coefPrefix(A) {
  if (sNum(A) === 1) return '';
  if (sNum(A) === -1) return '-';
  const t = sTex(A);
  return t.startsWith('\\sqrt') || /^-?\d+\\sqrt/.test(t) ? `${t}\\,` : t;
}

// ─── Модель уравнения ────────────────────────────────────────────────────────
/**
 * model = { fn, A, B, C, k, b, unit, v, order, value }
 *   A·f(k·x + b) + B = C, unit 'pi' — b в долях π, 'num' — аргумент π·(kx + b)
 *   value — значение a = (C − B)/A (запись из таблицы или plainValue)
 */
export function equationTex(m) {
  const arg = argTex(m.k, m.b, { v: m.v, unit: m.unit, order: m.order });
  let lhs = `${coefPrefix(m.A)}${applyTex(m.fn, arg)}`;
  if (m.B && !sIsZero(m.B)) {
    const bt = sTex(m.B);
    lhs += bt.startsWith('-') ? ` - ${bt.slice(1)}` : ` + ${bt}`;
  }
  return `${lhs} = ${m.Ctex ?? sTex(m.C)}`;
}

/** g(x) — левая часть минус правая (численно, по модели) */
export function equationResidual(m) {
  const A = sNum(m.A); const B = m.B ? sNum(m.B) : 0; const C = m.Cnum ?? sNum(m.C);
  return (x) => {
    const u = m.unit === 'num'
      ? Math.PI * (toNum(m.k) * x + toNum(m.b))
      : toNum(m.k) * x + toNum(m.b) * Math.PI;
    return A * fnNum(m.fn, u) + B - C;
  };
}

/** Серии корней модели */
export function solveModel(m, style) {
  const fams = basicFamilies(m.fn, m.value, style || (isZero(m.b) ? 'combined' : 'split'));
  return fams.map(f => transformFamily(f, m.k, ang(m.b)));
}

/** Сколько различных корней на периоде у f(u) = a */
function expectedPerPeriod(fn, v) {
  if (fn === 'tan' || fn === 'cot') return 1;
  if (Math.abs(v.val) > 1 + 1e-12) return 0;
  if (Math.abs(Math.abs(v.val) - 1) < 1e-12) return 1;
  return 2;
}

/**
 * Проверка: каждая точка серий — корень напечатанного уравнения, и корней на
 * периоде столько, сколько должно быть. Ошибка в сдвиге, делении на k или
 * знаке (−1)^n не пройдёт.
 */
export function verifyEquation(m, families) {
  const g = equationResidual(m);
  const unit = m.unit === 'num' ? 1 : Math.PI;
  const scale = Math.max(1, Math.abs(sNum(m.A)));
  for (const f of families) {
    for (let n = -3; n <= 3; n++) {
      for (const pt of familyPoints(f, n)) {
        const r = g(angNum(pt, unit));
        if (!Number.isFinite(r) || Math.abs(r) > 1e-7 * scale) return false;
      }
    }
  }
  const expected = expectedPerPeriod(m.fn, m.value);
  if (expected === 0) return families.length === 0;
  const P = absR(divR(m.fn === 'tan' || m.fn === 'cot' ? R1 : rat(2), m.k));
  return residues(families, P, unit) === expected;
}

// ─── Готовое задание ─────────────────────────────────────────────────────────
function makeTask(m, cat, extra = {}) {
  const families = solveModel(m, extra.style);
  if (!verifyEquation(m, families)) return null;
  const opts = { v: m.v, unit: m.unit };
  const resultLatex = familiesTex(families, opts);
  const mistakes = equationMistakes(m, families, opts).filter(t => t !== resultLatex);
  return {
    exprLatex: equationTex(m),
    resultLatex,
    varLatex: m.v,
    hideKeyPrompt: true,
    mistakes,
    cat,
    ...extra.task,
  };
}

/**
 * Типичные ошибки — дистракторы для теста A/B/C/D: период не поделили на k,
 * потеряли вторую серию (± или (−1)^n), перепутали знак сдвига.
 */
function equationMistakes(m, families, opts) {
  const out = [];
  const unit = m.unit === 'num' ? 1 : Math.PI;
  const add = (fams) => {
    if (!fams?.length) return;
    if (sameRoots(fams, families, unit)) return;     // равносильно верному — не ошибка
    const t = familiesTex(fams, opts);
    if (!out.includes(t)) out.push(t);
  };
  // период как у u
  add(families.map(f => ({ ...f, T: mulR(f.T, absR(m.k)) })));
  // знак сдвига
  if (!isZero(m.b)) add(solveModel({ ...m, b: negR(m.b) }));
  // потеряна вторая серия
  if (families.length === 2) add([families[0]]);
  if (families.length === 1 && families[0].kind !== 'lin') add([famLin(angSub(families[0].s, angScale(families[0].a, rat(-1))), families[0].T)]);
  // перепутан arcsin/arccos (у табличных)
  if (m.value.asin !== undefined && (m.fn === 'sin' || m.fn === 'cos')) {
    const other = m.fn === 'sin' ? 'cos' : 'sin';
    const fams = basicFamilies(other, m.value, isZero(m.b) ? 'combined' : 'split')
      .map(f => transformFamily(f, m.k, ang(m.b)));
    // запись — как у своей функции: серии другой функции, но тот же вид ответа
    add(fams);
  }
  return out.slice(0, 4);
}

// ─── Наборы чисел ────────────────────────────────────────────────────────────
const K_SIMPLE = [rat(2), rat(3), rat(4), rat(1, 2), rat(1, 3), rat(1, 4)];
const K_SHIFT  = [R1, R1, rat(2), rat(3), rat(1, 2), rat(1, 3), rat(1, 4)];
const B_SHIFT  = [rat(1, 6), rat(1, 4), rat(1, 3), rat(1, 2), rat(2, 3), rat(3, 4), rat(5, 6)];

const nonTrivial = (fn) => valuesFor(fn).filter(v => !['0', '1', '-1'].includes(v.key) || fn === 'tan' || fn === 'cot')
  .filter(v => v.key !== '0');

function baseModel(fn, value, k, b, extra = {}) {
  const s = surdOfValue(value);
  return {
    fn, value, k, b, unit: 'pi', v: 'x', order: 'kb',
    A: sInt(1), B: null, C: s,
    ...extra,
  };
}

const tanOrCot = () => (chance(0.6) ? 'tan' : 'cot');

// ─── Категории «Уравнения f(kx + b) = a» ─────────────────────────────────────
export const ADV_GENERATORS = {
  // f(kx) = a
  sin_k: () => {
    const k = rand(K_SIMPLE);
    return makeTask(baseModel('sin', rand(nonTrivial('sin')), chance(0.2) ? negR(k) : k, R0), 'sin_k');
  },
  cos_k: () => {
    const k = rand(K_SIMPLE);
    return makeTask(baseModel('cos', rand(nonTrivial('cos')), chance(0.2) ? negR(k) : k, R0), 'cos_k');
  },
  tan_k: () => {
    const fn = tanOrCot();
    const k = rand(K_SIMPLE);
    return makeTask(baseModel(fn, rand(nonTrivial(fn)), chance(0.25) ? negR(k) : k, R0), 'tan_k');
  },

  // f(kx + b) = a
  sin_shift: () => shiftTask('sin', 'sin_shift'),
  cos_shift: () => shiftTask('cos', 'cos_shift'),
  tan_shift: () => shiftTask(tanOrCot(), 'tan_shift'),

  // A·f(kx + b) + B = C
  coef_sin: () => coefTask('sin', 'coef_sin'),
  coef_cos: () => coefTask('cos', 'coef_cos'),
  coef_tan: () => coefTask(rand(['tan', 'tan', 'cot']), 'coef_tan'),

  // a = 0, ±1
  special: () => {
    const fn = rand(['sin', 'cos']);
    const value = rand(valuesFor(fn).filter(v => ['0', '1', '-1'].includes(v.key)));
    const shifted = chance(0.5);
    const k = shifted ? rand(K_SHIFT) : rand(K_SIMPLE);
    const b = shifted ? signedB() : R0;
    return makeTask(baseModel(fn, value, k, b, { order: chance(0.3) ? 'bk' : 'kb' }), 'special');
  },
  // |a| > 1
  noroots: () => {
    const fn = rand(['sin', 'cos']);
    const shifted = chance(0.5);
    const k = shifted ? rand(K_SHIFT) : rand(K_SIMPLE);
    const b = shifted ? signedB() : R0;
    const pick = rand([
      { A: sInt(2), C: sRad(R1, 5) },          // 2 sin = √5
      { A: sInt(1), C: sRad(R1, 2) },          // sin = √2
      { A: sInt(2), C: sInt(3) },              // 2 sin = 3
      { A: sInt(3), C: sInt(-4) },
      { A: sInt(1), C: sr(rat(3, 2)) },
      { A: sInt(2), C: sr(rat(5, 2)) },
    ]);
    const val = sNum(pick.C) / sNum(pick.A);
    const value = { key: 'none', tex: '', val };
    const m = { ...baseModel(fn, value, k, b), A: pick.A, C: pick.C };
    return makeTask(m, 'noroots');
  },

  // Первая часть ЕГЭ: cos(π(x − 1)/3) = 1/2 — наибольший отрицательный корень
  part1_neg: () => part1Task('neg'),
  part1_pos: () => part1Task('pos'),
};

function signedB() {
  const b = rand(B_SHIFT);
  return chance(0.5) ? negR(b) : b;
}

function shiftTask(fn, cat) {
  const value = rand(nonTrivial(fn));
  let k = rand(K_SHIFT);
  let b = signedB();
  let order = 'kb';
  if (chance(0.3)) { k = negR(k); b = absR(b); order = 'bk'; }   // π/3 − 2x
  return makeTask(baseModel(fn, value, k, b, { order }), cat);
}

function coefTask(fn, cat) {
  const value = rand(nonTrivial(fn));
  const choices = coefChoices(fn, value).filter(A => sNum(A) !== 1);
  if (!choices.length) return null;
  const A = rand(choices);
  const c = sMul(A, surdOfValue(value));
  const shifted = chance(0.7);
  let k = shifted ? rand(K_SHIFT) : rand(K_SIMPLE);
  let b = shifted ? signedB() : R0;
  let order = 'kb';
  if (shifted && chance(0.25)) { k = negR(k); b = absR(b); order = 'bk'; }
  // A·f = c или A·f − c = 0
  const moved = chance(0.45);
  const m = {
    ...baseModel(fn, value, k, b, { order }),
    A,
    B: moved ? sNeg(c) : null,
    C: moved ? S0 : c,
  };
  return makeTask(m, cat);
}

// Аргумент π(px + q)/d: x = числа; спрашиваем один корень
function part1Task(which) {
  const fn = rand(['sin', 'cos', 'cos', 'tan']);
  const value = rand(nonTrivial(fn).filter(v => fn !== 'tan' || ['1', '-1', 's3', '-s3', 's3/3', '-s3/3'].includes(v.key)));
  const d = rand([2, 3, 4, 6, 8]);
  const p = rand([1, 1, 1, 2]);
  const q = rand([-3, -2, -1, 1, 2, 3, 5, 7]);
  const k = rat(p, d);
  const b = rat(q, d);
  const m = { ...baseModel(fn, value, k, b), unit: 'num' };
  const families = solveModel(m, 'split');
  if (!verifyEquation(m, families)) return null;
  // все корни на [−60; 60]
  const roots = [];
  for (const f of families) {
    for (let n = -120; n <= 120; n++) {
      for (const pt of familyPoints(f, n)) {
        if (pt.arc) return null;
        const x = pt.pi;
        if (Math.abs(toNum(x)) <= 60) roots.push(x);
      }
    }
  }
  const cand = which === 'neg'
    ? roots.filter(r => toNum(r) < 0).sort((a, b2) => toNum(b2) - toNum(a))[0]
    : roots.filter(r => toNum(r) > 0).sort((a, b2) => toNum(a) - toNum(b2))[0];
  if (!cand) return null;
  // ответ ЕГЭ — конечная десятичная дробь
  if (!/^[0-9-]+(\{,\}\d+)?$/.test(fmtNum(cand, 'dec'))) return null;
  const tail = which === 'neg'
    ? '\\;\\text{— наибольший отрицательный корень}'
    : '\\;\\text{— наименьший положительный корень}';
  return {
    exprLatex: `${equationTex(m)}${tail}`,
    resultLatex: fmtNum(cand, 'dec'),
    varLatex: 'x',
    hideKeyPrompt: true,
    answerValue: toNum(cand),
    cat: which === 'neg' ? 'part1_neg' : 'part1_pos',
  };
}

export const ADV_LABELS = {
  sin_k: 'sin kx = a',
  cos_k: 'cos kx = a',
  tan_k: 'tg kx = a, ctg kx = a',
  sin_shift: 'sin(kx + b) = a',
  cos_shift: 'cos(kx + b) = a',
  tan_shift: 'tg(kx + b), ctg(kx + b)',
  coef_sin: '2sin(…) = √3, 2sin(…) − 1 = 0',
  coef_cos: '2cos(…) = √2, 2cos(…) + 1 = 0',
  coef_tan: '√3·tg(…) = 1, 3tg(…) = √3',
  special: 'Частные случаи: a = 0, ±1',
  noroots: 'Нет корней: |a| > 1',
  part1_neg: 'Наибольший отрицательный корень',
  part1_pos: 'Наименьший положительный корень',
};

export const ADV_GROUPS = [
  { label: 'f(kx) = a', keys: ['sin_k', 'cos_k', 'tan_k'] },
  { label: 'Аргумент со сдвигом f(kx + b) = a', keys: ['sin_shift', 'cos_shift', 'tan_shift'] },
  { label: 'С коэффициентом A·f(kx + b) = c', keys: ['coef_sin', 'coef_cos', 'coef_tan'] },
  { label: 'Особые случаи', keys: ['special', 'noroots'] },
  { label: 'Первая часть ЕГЭ: один корень', keys: ['part1_neg', 'part1_pos'] },
];

// ─── Простейшие уравнения f(t) = a ───────────────────────────────────────────
const NONTABLE = {
  sin: [rat(1, 3), rat(2, 3), rat(1, 4), rat(3, 4), rat(2, 5), rat(-1, 3), rat(-2, 3), rat(-1, 4), rat(-3, 4)],
  cos: [rat(1, 3), rat(2, 3), rat(1, 4), rat(3, 4), rat(2, 5), rat(3, 5)],
  tan: [rat(2), rat(3), rat(5), rat(1, 2), rat(1, 3), rat(-2), rat(-3), rat(-1, 2)],
  cot: [rat(2), rat(3), rat(4), rat(1, 2), rat(1, 4)],
};
const NOROOTS_VALUES = [rat(3, 2), rat(-3, 2), rat(2), rat(-2), rat(4, 3), rat(-5, 4), rat(3), rat(-3)];

/**
 * Простейшее уравнение f(t) = a. `kind`: 'table' | 'nontable' | 'noroots'.
 * Табличные значения — запись как в учебнике: (−1)^n у синуса, ± у косинуса.
 */
export function simpleEquation(fn, kind = 'table', value = null) {
  let v = value;
  if (!v) {
    if (kind === 'table') v = rand(valuesFor(fn));
    else if (kind === 'nontable') v = plainValue(rand(NONTABLE[fn]));
    else v = plainValue(rand(NOROOTS_VALUES));
  }
  if (kind === 'noroots' && (fn === 'tan' || fn === 'cot')) return null;
  const m = {
    fn, value: v, k: R1, b: R0, unit: 'pi', v: 't', order: 'kb',
    A: sInt(1), B: null, C: v.r ? sr(v.r) : surdOfValue(v),
    Ctex: v.tex,
  };
  return makeTask(m, `${fn}_${kind}`, { style: 'combined' });
}

export { principal };
