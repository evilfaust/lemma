import { useState, useCallback } from 'react';
import {
  isFiniteDecimalAnswer, isIntegerAnswer, hasNegativeNumber, toImproperFraction,
} from '../utils/oralAnswerFilter';
import { generateByCategories } from '../utils/questionPlan';
import {
  fsuGenerators, FSU_LABELS, FSU_KEYS, fsuDefaults,
} from '../utils/shortMultiplication';
import { useApplySheet } from './useApplySheet';

// ─── Вспомогательные функции ──────────────────────────────────────────────────
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function reduceFrac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d);
  return [n / g, d / g];
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// Форматирование дроби в выражении: 2/5 → \dfrac{2}{5}, -2/5 → -\dfrac{2}{5}
function fmtFrac(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  if (rd === 1) return String(rn);
  if (rn < 0) return `-\\dfrac{${-rn}}{${rd}}`;
  return `\\dfrac{${rn}}{${rd}}`;
}

// Форматирование ответа: поддерживает смешанные числа
// -9/5 → -1\dfrac{4}{5},  9/2 → 4\dfrac{1}{2},  6/1 → 6
function fmtAnswer(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  if (rd === 1) return String(rn);
  const isNeg = rn < 0;
  const absN = Math.abs(rn);
  const whole = Math.floor(absN / rd);
  const rem = absN % rd;
  if (rem === 0) return String(isNeg ? -whole : whole);
  if (whole === 0) return isNeg ? `-\\dfrac{${absN}}{${rd}}` : `\\dfrac{${rn}}{${rd}}`;
  return isNeg ? `-${whole}\\dfrac{${rem}}{${rd}}` : `${whole}\\dfrac{${rem}}{${rd}}`;
}

// Проверка "красивости" ответа: знаменатель ≤ 12, значение < 200
function isNice(n, d) {
  const [rn, rd] = reduceFrac(n, d);
  return rd <= 12 && Math.abs(rn / rd) < 200;
}

// ─── Пулы чисел ───────────────────────────────────────────────────────────────
const DENOMS     = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const SMALL_DENS = [2, 3, 4, 5, 6, 7];
const INTS       = [2, 3, 4, 5, 6, 7, 8, 9, 10];

function coprimeNumerators(d) {
  const res = [];
  for (let a = 1; a < d; a++) if (gcd(a, d) === 1) res.push(a);
  return res.length ? res : [1];
}

// ─── Генераторы задач по категориям ──────────────────────────────────────────

// Категория 1: дробь × целое (и целое × дробь)
function genFracTimesInt() {
  const b = rand(DENOMS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand(INTS);
  const sign = Math.random() < 0.35 ? -1 : 1;
  const signedN = sign * n;

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const nTex = signedN < 0 ? `(${signedN})` : String(signedN);
  const exprLatex = Math.random() < 0.5
    ? `${fracTex} \\cdot ${nTex}`
    : `${nTex} \\cdot ${fracTex}`;

  const [rn, rd] = reduceFrac(a * signedN, b);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 2: целое ÷ дробь  (n : a/b = n*b/a)
function genIntDivFrac() {
  const b = rand(SMALL_DENS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand(INTS);
  const sign = Math.random() < 0.4 ? -1 : 1;
  const signedN = sign * n;

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const nTex = signedN < 0 ? `(${signedN})` : String(signedN);
  const exprLatex = `${nTex} : ${fracTex}`;

  const [rn, rd] = reduceFrac(signedN * b, a);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 3: дробь ÷ целое  (a/b : n = a/(b*n))
function genFracDivInt() {
  const b = rand(SMALL_DENS);
  const coprime = coprimeNumerators(b);
  const a = rand(coprime);
  const n = rand([2, 3, 4, 5, 6]);

  const fracTex = `\\dfrac{${a}}{${b}}`;
  const exprLatex = `${fracTex} : ${n}`;

  const [rn, rd] = reduceFrac(a, b * n);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 4: дробь ÷ дробь
function genFracDivFrac() {
  // Вариант А: одинаковый знаменатель → a/b ÷ c/b = a/c (целое или дробь)
  // Вариант Б: разные знаменатели, но красивый результат
  const mode = Math.random() < 0.6 ? 'sameDen' : 'diffDen';

  if (mode === 'sameDen') {
    const b = rand(SMALL_DENS);
    const nums = [];
    for (let x = 1; x < b * 3; x++) nums.push(x);
    const a = rand(nums.filter(x => x <= b * 2));
    const c = rand(nums.filter(x => x < a && x > 0));
    if (!c) return null;

    const frac1 = fmtFrac(a, b);
    const frac2 = fmtFrac(c, b);
    const exprLatex = `${frac1} : ${frac2}`;
    const [rn, rd] = reduceFrac(a, c);
    if (!isNice(rn, rd)) return null;
    return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
  } else {
    // разные знаменатели
    const b1 = rand(SMALL_DENS);
    const b2 = rand(SMALL_DENS.filter(x => x !== b1));
    const a1 = rand(coprimeNumerators(b1));
    const a2 = rand(coprimeNumerators(b2));
    const exprLatex = `\\dfrac{${a1}}{${b1}} : \\dfrac{${a2}}{${b2}}`;
    const [rn, rd] = reduceFrac(a1 * b2, b1 * a2);
    if (!isNice(rn, rd) || rd > 10) return null;
    return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
  }
}

// Категория 5: целое × (1/n) или (1/n) × целое
function genTimesReciprocal() {
  const n = rand([2, 3, 4, 5, 6, 7, 8, 9]);
  const k = randInt(1, n * 3);
  const sign = Math.random() < 0.4 ? -1 : 1;
  const signedK = sign * k;
  const fracTex = `\\dfrac{1}{${n}}`;
  const kTex = signedK < 0 ? `(${signedK})` : String(signedK);
  const exprLatex = Math.random() < 0.5
    ? `${fracTex} \\cdot ${kTex}`
    : `${kTex} \\cdot ${fracTex}`;
  const [rn, rd] = reduceFrac(signedK, n);
  if (!isNice(rn, rd)) return null;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 6: целое ± смешанное число
function genMixedArith() {
  const b = rand(SMALL_DENS);
  const a = rand(coprimeNumerators(b));
  const whole2 = randInt(1, 8);  // целая часть смешанного
  const whole1 = randInt(1, 10); // целое число

  // вычитание: whole1 - (whole2 + a/b)
  const op = Math.random() < 0.4 ? 'add' : 'sub';

  // результат: op=sub → whole1 - whole2 - a/b
  const [rn, rd] = op === 'sub'
    ? reduceFrac(whole1 * b - whole2 * b - a, b)
    : reduceFrac(whole1 * b + whole2 * b + a, b);

  if (!isNice(rn, rd)) return null;

  const mixedTex = `${whole2}\\dfrac{${a}}{${b}}`;
  const sign = op === 'sub' ? '-' : '+';
  const exprLatex = `${whole1} ${sign} ${mixedTex}`;
  return { exprLatex, resultLatex: fmtAnswer(rn, rd) };
}

// Категория 7: степень десятичной дроби
// Пулы: основание 0.1–0.5, степень 2 или 3
const DECIMAL_BASES = [
  { val: 0.1, tex: '0{,}1' },
  { val: 0.2, tex: '0{,}2' },
  { val: 0.3, tex: '0{,}3' },
  { val: 0.4, tex: '0{,}4' },
  { val: 0.5, tex: '0{,}5' },
];

function fmtDecimal(v) {
  // Убираем хвостовые нули, показываем красиво
  if (v === 0) return '0';
  const s = v.toFixed(10).replace(/\.?0+$/, '');
  return s.replace('.', '{,}');
}

function genDecimalPower() {
  const base = rand(DECIMAL_BASES);
  const pow = rand([2, 3]);
  const withNeg = Math.random() < 0.6; // отрицательное основание

  const result = Math.pow(base.val, pow) * (withNeg && pow % 2 === 1 ? -1 : 1);
  const baseTex = withNeg ? `(-${base.tex})` : base.tex;
  const exprLatex = `${baseTex}^${pow}`;
  const resultLatex = fmtDecimal(result);
  return { exprLatex, resultLatex };
}

// Категория 8: умножение/деление на степень 10
const POW10_BASES = [
  '1{,}2', '2{,}4', '3{,}5', '4{,}8', '7{,}3', '5{,}6',
  '0{,}7', '0{,}36', '1{,}25', '2{,}7', '6{,}4', '3{,}2',
];
const POW10_BASES_NEG = ['-2{,}4', '-1{,}5', '-3{,}6', '-0{,}8'];

function genMulPow10() {
  const isPow10 = Math.random() < 0.5; // умножение или деление
  const useNeg  = Math.random() < 0.3;
  const bases   = useNeg ? POW10_BASES_NEG : POW10_BASES;
  const baseTex = rand(bases);
  // Степень: 10, 100, 1000, 10000 или 0.1, 0.01
  const pows = isPow10
    ? [{ tex: '10',   val: 10 }, { tex: '100',  val: 100 }, { tex: '1000', val: 1000 }]
    : [{ tex: '0{,}1', val: 0.1 }, { tex: '0{,}01', val: 0.01 }];
  const pow = rand(pows);

  // Получаем числовое значение из строки-шаблона
  const numVal = parseFloat(baseTex.replace('{,}', '.').replace('−', '-'));
  const result = isPow10 ? numVal * pow.val : numVal / pow.val;

  const exprLatex = isPow10
    ? `${baseTex} \\cdot ${pow.tex}`
    : `${baseTex} : ${pow.tex}`;
  const resultLatex = fmtDecimal(result);
  return { exprLatex, resultLatex };
}

// Категория 9: деление десятичных дробей
// Пул готовых комбинаций (dividend, divisor) с красивыми результатами
const DECIMAL_DIV_POOL = [
  ['0{,}28', '0{,}4',  0.7],
  ['3{,}5',  '0{,}5',  7],
  ['0{,}24', '6',      0.04],
  ['0{,}36', '0{,}1',  3.6],
  ['7{,}2',  '9',      0.8],
  ['3{,}2',  '0{,}4',  8],
  ['7{,}7',  '7',      1.1],
  ['1{,}6',  '0{,}4',  4],
  ['2{,}4',  '0{,}3',  8],
  ['4{,}5',  '0{,}9',  5],
  ['0{,}48', '0{,}6',  0.8],
  ['1{,}8',  '0{,}6',  3],
  ['0{,}6',  '0{,}15', 4],
  ['2{,}7',  '0{,}9',  3],
  ['0{,}56', '0{,}7',  0.8],
  ['1{,}44', '1{,}2',  1.2],
  ['6{,}3',  '0{,}7',  9],
  ['0{,}35', '0{,}7',  0.5],
  ['4{,}8',  '0{,}8',  6],
  ['0{,}12', '0{,}3',  0.4],
];

function genDecimalDiv() {
  const [a, b, res] = rand(DECIMAL_DIV_POOL);
  const sign = Math.random() < 0.3 ? -1 : 1;
  const aTex = sign < 0 ? `(${sign < 0 ? '-' : ''}${a})` : a;
  const exprLatex = `${aTex} : ${b}`;
  const resultLatex = fmtDecimal(sign * res);
  return { exprLatex, resultLatex };
}

// Категория 10: десятичное ± целое
const DECIMAL_SIMPLE_POOL = [
  ['-10', '+', '2{,}8',  -7.2],
  ['4{,}2', '-', '8',   -3.8],
  ['-5{,}3', '+', '8',   2.7],
  ['3{,}7', '+', '(-6)', -2.3],
  ['12', '-', '4{,}6',   7.4],
  ['-7', '+', '3{,}5',  -3.5],
  ['8{,}4', '-', '12',  -3.6],
  ['-1{,}6', '+', '5',   3.4],
  ['6', '-', '8{,}3',   -2.3],
  ['-4{,}5', '+', '9',   4.5],
  ['15', '-', '6{,}4',   8.6],
  ['-3{,}2', '+', '7',   3.8],
  ['0{,}5', '-', '4',   -3.5],
  ['11', '-', '2{,}7',   8.3],
  ['-8{,}1', '+', '10',  1.9],
];

function genDecimalSimple() {
  const [a, op, b, res] = rand(DECIMAL_SIMPLE_POOL);
  const exprLatex = `${a} ${op} ${b}`;
  const resultLatex = fmtDecimal(res);
  return { exprLatex, resultLatex };
}

// Категория 11: минусы и скобки
// Цепочки знаков: вычитание отрицательного, произведение/частное двух
// отрицательных дробей, внешний унарный минус перед всей скобкой.
// В каждом задании минимум два минуса, обычно три-четыре:
//   -7/8 : (-14/8),   -3/4 - (-2,25),   -(-7/8 : (-14/8))

// Рациональные числа — пара [числитель, знаменатель > 0]
function ratNeg([n, d])         { return [-n, d]; }
function ratAdd([a, b], [c, d]) { return reduceFrac(a * d + c * b, b * d); }
function ratSub(x, y)           { return ratAdd(x, ratNeg(y)); }
function ratMul([a, b], [c, d]) { return reduceFrac(a * c, b * d); }
function ratDiv([a, b], [c, d]) { return c === 0 ? null : reduceFrac(a * d, b * c); }

// Конечная десятичная запись? (знаменатель раскладывается только на 2 и 5)
function isTerminating(d) {
  let x = Math.abs(d);
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
}

// Десятичные с «круглым» знаменателем — чтобы и ответ был десятичным
const NEG_DECIMALS = [
  { tex: '0{,}5',  n: 1, d: 2 },
  { tex: '1{,}5',  n: 3, d: 2 },
  { tex: '2{,}5',  n: 5, d: 2 },
  { tex: '3{,}5',  n: 7, d: 2 },
  { tex: '0{,}25', n: 1, d: 4 },
  { tex: '0{,}75', n: 3, d: 4 },
  { tex: '1{,}25', n: 5, d: 4 },
  { tex: '2{,}25', n: 9, d: 4 },
  { tex: '0{,}2',  n: 1, d: 5 },
  { tex: '0{,}4',  n: 2, d: 5 },
  { tex: '1{,}2',  n: 6, d: 5 },
  { tex: '1{,}8',  n: 9, d: 5 },
];

const NEG_FRAC_DENS = [2, 3, 4, 5, 6, 8];
const DEC_FRAC_DENS = [2, 4, 5, 10];    // дроби с конечной десятичной записью
const SUB_FRAC_DENS = [2, 3, 4, 6];     // НОК любых двух ≤ 12 → ответ «красивый»

// Отрицательный терм в скобках: (-6) / \left(-\dfrac{3}{4}\right)
function negParen(tex, isFrac) {
  return isFrac ? `\\left(-${tex}\\right)` : `(-${tex})`;
}

// -a/b : (-ak/b) → 1/k  (общий знаменатель, вторая дробь несокращённая)
function negDivFracs() {
  const b = rand(NEG_FRAC_DENS);
  const a = rand(coprimeNumerators(b));
  const k = rand([2, 3, 4]);
  if ((a * k) % b === 0) return null;   // иначе вторая дробь — целое (2/2, 6/3)
  const flip = Math.random() < 0.5;
  const f1 = flip ? [a * k, b] : [a, b];
  const f2 = flip ? [a, b] : [a * k, b];
  const tex = `-\\dfrac{${f1[0]}}{${f1[1]}} : ${negParen(`\\dfrac{${f2[0]}}{${f2[1]}}`, true)}`;
  return { tex, val: ratDiv(ratNeg(f1), ratNeg(f2)), decimal: false };
}

// -a/b · (-b/c) → a/c
function negMulFracs() {
  const b = rand(NEG_FRAC_DENS);
  const c = rand(NEG_FRAC_DENS.filter(x => x !== b));
  const a = randInt(1, 9);
  // отбрасываем дроби, равные целому: -6/2 · (-2/5)
  if (a % b === 0 || b % c === 0) return null;
  const tex = `-\\dfrac{${a}}{${b}} \\cdot ${negParen(`\\dfrac{${b}}{${c}}`, true)}`;
  return { tex, val: ratMul(ratNeg([a, b]), ratNeg([b, c])), decimal: false };
}

// Десятичные: -3/4 - (-2,25) / -1,5 + (-0,25) / -7 - (-2,5)
function negSubDecimal() {
  const y = rand(NEG_DECIMALS);
  const yVal = [y.n, y.d];
  const yTex = negParen(y.tex, false);
  const op = Math.random() < 0.65 ? '-' : '+';
  const apply = (x) => (op === '-' ? ratSub(x, ratNeg(yVal)) : ratAdd(x, ratNeg(yVal)));
  const kind = rand(['frac', 'dec', 'int']);

  if (kind === 'frac') {
    const b = rand(DEC_FRAC_DENS);
    const a = rand(coprimeNumerators(b));
    const tex = `-\\dfrac{${a}}{${b}} ${op} ${yTex}`;
    return { tex, val: apply(ratNeg([a, b])), decimal: true };
  }
  if (kind === 'dec') {
    const x = rand(NEG_DECIMALS);
    const tex = `-${x.tex} ${op} ${yTex}`;
    return { tex, val: apply(ratNeg([x.n, x.d])), decimal: true };
  }
  const n = randInt(2, 12);
  const tex = `-${n} ${op} ${yTex}`;
  return { tex, val: apply([-n, 1]), decimal: true };
}

// -a/b - (-c/d) → обыкновенная дробь
function negSubFracs() {
  const b = rand(SUB_FRAC_DENS);
  const d = Math.random() < 0.5 ? b : rand(SUB_FRAC_DENS);
  const a = rand(coprimeNumerators(b));
  const c = rand(coprimeNumerators(d));
  const op = Math.random() < 0.6 ? '-' : '+';
  const x = ratNeg([a, b]);
  const y = ratNeg([c, d]);
  const val = op === '-' ? ratSub(x, y) : ratAdd(x, y);
  const tex = `-\\dfrac{${a}}{${b}} ${op} ${negParen(`\\dfrac{${c}}{${d}}`, true)}`;
  return { tex, val, decimal: false };
}

// Цепочки минусов на целых и десятичных
function negIntChain() {
  const kind = rand(['triple', 'mul', 'sub', 'decMix']);
  if (kind === 'triple') {
    const a = randInt(2, 15);
    return { tex: `-\\left(-(-${a})\\right)`, val: [-a, 1], decimal: true };
  }
  if (kind === 'mul') {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    return { tex: `-(-${a}) \\cdot (-${b})`, val: [-a * b, 1], decimal: true };
  }
  if (kind === 'sub') {
    const a = randInt(2, 15);
    const b = randInt(2, 15);
    return { tex: `-(-${a}) - (-${b})`, val: [a + b, 1], decimal: true };
  }
  const x = rand(NEG_DECIMALS);
  const n = randInt(2, 9);
  return { tex: `-(-${x.tex}) - ${n}`, val: ratSub([x.n, x.d], [n, 1]), decimal: true };
}

const NEG_BUILDERS = [
  negDivFracs, negMulFracs, negSubDecimal, negSubDecimal, negSubFracs, negIntChain,
];

function genNegSigns() {
  const inner = rand(NEG_BUILDERS)();
  if (!inner || !inner.val) return null;

  let { tex, val } = inner;
  // Внешний унарный минус перед всей скобкой: -( ... )
  if (Math.random() < 0.4) {
    tex = tex.includes('\\dfrac')
      ? `-\\left(${tex}\\right)`
      : `-(${tex})`;
    val = ratNeg(val);
  }

  const [rn, rd] = reduceFrac(val[0], val[1]);
  if (!isNice(rn, rd)) return null;
  const resultLatex = inner.decimal && isTerminating(rd)
    ? fmtDecimal(rn / rd)
    : fmtAnswer(rn, rd);
  return { exprLatex: tex, resultLatex };
}


// ─── Блок «Целые числа» ──────────────────────────────────────────────────────

// Категория 12: порядок действий — 7 + 3 · 4, (13 - 8) · 6, 48 : 6 - 5
function genIntOrder() {
  const b = randInt(2, 9);
  const c = randInt(2, 9);
  const kind = rand(['mulAdd', 'mulSub', 'divAdd', 'divSub', 'bracketMul', 'mulBracket']);

  if (kind === 'mulAdd') {
    const a = randInt(2, 40);
    return { exprLatex: `${a} + ${b} \\cdot ${c}`, resultLatex: String(a + b * c) };
  }
  if (kind === 'mulSub') {
    const a = b * c + randInt(1, 40);
    return { exprLatex: `${a} - ${b} \\cdot ${c}`, resultLatex: String(a - b * c) };
  }
  if (kind === 'divAdd') {
    const a = randInt(2, 40);
    return { exprLatex: `${a} + ${b * c} : ${c}`, resultLatex: String(a + b) };
  }
  if (kind === 'divSub') {
    const a = b + randInt(1, 40);
    return { exprLatex: `${a} - ${b * c} : ${c}`, resultLatex: String(a - b) };
  }
  if (kind === 'bracketMul') {
    const a = randInt(2, 20);
    return { exprLatex: `(${a} + ${b}) \\cdot ${c}`, resultLatex: String((a + b) * c) };
  }
  const a = b + randInt(1, 20);
  return { exprLatex: `${c} \\cdot (${a} - ${b})`, resultLatex: String(c * (a - b)) };
}

// Категория 13: умножение приёмом — 18 · 5, 24 · 25, 17 · 11, 19 · 99
const HANDY_FACTORS = [4, 5, 9, 11, 15, 20, 25, 50, 99, 101];

function genMulRound() {
  const k = rand(HANDY_FACTORS);
  const n = randInt(11, k >= 99 ? 19 : 49);
  if (n * k > 3000) return null;
  const exprLatex = Math.random() < 0.5
    ? `${n} \\cdot ${k}`
    : `${k} \\cdot ${n}`;
  return { exprLatex, resultLatex: String(n * k) };
}

// Категория 14: степени целых — 13², 7³, 2⁸, (-4)³
function genIntPowers() {
  const kind = rand(['square', 'square', 'cube', 'pow2', 'pow3', 'pow5', 'negSquare', 'negCube']);

  if (kind === 'square') {
    const n = randInt(11, 25);
    return { exprLatex: `${n}^2`, resultLatex: String(n * n) };
  }
  if (kind === 'cube') {
    const n = randInt(2, 10);
    return { exprLatex: `${n}^3`, resultLatex: String(n ** 3) };
  }
  if (kind === 'pow2') {
    const k = randInt(4, 10);
    return { exprLatex: `2^{${k}}`, resultLatex: String(2 ** k) };
  }
  if (kind === 'pow3') {
    const k = randInt(3, 5);
    return { exprLatex: `3^{${k}}`, resultLatex: String(3 ** k) };
  }
  if (kind === 'pow5') {
    const k = randInt(2, 4);
    return { exprLatex: `5^{${k}}`, resultLatex: String(5 ** k) };
  }
  if (kind === 'negSquare') {
    const n = randInt(2, 12);
    return { exprLatex: `(-${n})^2`, resultLatex: String(n * n) };
  }
  const n = randInt(2, 6);
  return { exprLatex: `(-${n})^3`, resultLatex: String(-(n ** 3)) };
}

// ─── Блок «Знаки и скобки» ───────────────────────────────────────────────────

// Категория 15: модуль — |-7| + |3 - 10|
function genAbsValue() {
  const abs = (tex) => `\\left|${tex}\\right|`;
  const kind = rand(['sum', 'diff', 'product', 'outerMinus']);

  if (kind === 'sum') {
    const a = randInt(2, 15);
    const b = randInt(2, 15);
    const c = randInt(2, 15);
    return {
      exprLatex: `${abs(`-${a}`)} + ${abs(`${b} - ${c}`)}`,
      resultLatex: String(a + Math.abs(b - c)),
    };
  }
  if (kind === 'diff') {
    const a = randInt(2, 15);
    const b = randInt(2, 15);
    const c = randInt(2, 12);
    return {
      exprLatex: `${abs(`${a} - ${b}`)} - ${abs(`-${c}`)}`,
      resultLatex: String(Math.abs(a - b) - c),
    };
  }
  if (kind === 'product') {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    const c = randInt(2, 9);
    return {
      exprLatex: `${abs(`${a} - ${b}`)} \\cdot ${abs(`-${c}`)}`,
      resultLatex: String(Math.abs(a - b) * c),
    };
  }
  const a = randInt(2, 15);
  const b = randInt(2, 15);
  if (a === b) return null;                 // -|0| — задание ни о чём
  return {
    exprLatex: `-${abs(`${a} - ${b}`)}`,
    resultLatex: String(-Math.abs(a - b)),
  };
}

// Категория 16: знак произведения — (-2) · (-3) · (-5)
function genSignProduct() {
  const count = rand([2, 3, 3, 4]);
  const nums = Array.from({ length: count }, () => randInt(2, 6));
  // Минусов от одного до всех: ученик считает их чётность, а не только модуль
  const negCount = randInt(1, count);
  const signs = nums.map((_, i) => (i < negCount ? -1 : 1));
  // Перемешиваем, чтобы минусы не шли подряд с начала
  for (let i = signs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [signs[i], signs[j]] = [signs[j], signs[i]];
  }

  const product = nums.reduce((acc, n, i) => acc * n * signs[i], 1);
  if (Math.abs(product) > 400) return null;

  const parts = nums.map((n, i) => (signs[i] < 0 ? `(-${n})` : String(n)));
  return { exprLatex: parts.join(' \\cdot '), resultLatex: String(product) };
}

// ─── Блок «Проценты и доли» ──────────────────────────────────────────────────
const PERCENTS = [1, 5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 80, 90, 110, 120, 150, 200];
const PERCENT_BASES = [20, 30, 40, 50, 60, 80, 90, 120, 140, 150, 200, 240, 300, 400, 500, 600, 800];

// Категория 17: процент от числа — 20% от 45
function genPercentOf() {
  const p = rand(PERCENTS);
  const n = rand(PERCENT_BASES);
  const [rn, rd] = reduceFrac(p * n, 100);
  if (rd !== 1 && rd !== 2 && rd !== 4 && rd !== 5 && rd !== 10) return null;
  if (Math.abs(rn / rd) > 900) return null;
  return {
    exprLatex: `${p}\\% \\text{ от } ${n}`,
    resultLatex: rd === 1 ? String(rn) : fmtDecimal(rn / rd),
  };
}

// Категория 18: процент от десятичной дроби — 40% от 2,5
function genPercentOfDec() {
  const p = rand([5, 10, 20, 25, 30, 40, 50, 60, 75, 80]);
  const tenths = randInt(5, 99);            // 0,5 … 9,9
  const value = (p * tenths) / 1000;
  // Ответ должен быть не длиннее двух знаков после запятой
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) return null;
  return {
    exprLatex: `${p}\\% \\text{ от } ${fmtDecimal(tenths / 10)}`,
    resultLatex: fmtDecimal(value),
  };
}

// Категория 19: доля от числа — 3/8 от 40
function genPartOfNumber() {
  const d = rand([2, 3, 4, 5, 6, 8, 10]);
  const n = rand(coprimeNumerators(d));
  const mult = randInt(2, 12);
  return {
    exprLatex: `\\dfrac{${n}}{${d}} \\text{ от } ${d * mult}`,
    resultLatex: String(n * mult),
  };
}

// ─── Блок «Формулы сокращённого умножения» ──────────────────────────────────
// Общий модуль `utils/shortMultiplication`: арифметика говорит и целыми, и
// десятичными, поэтому домен выбирается на каждое задание (целые — чаще).
const FSU_GENERATORS = fsuGenerators({ domains: ['int', 'int', 'dec'], style: 'auto' });

// ─── Маппинг категорий ────────────────────────────────────────────────────────
const GENERATORS = {
  fracTimesInt:     genFracTimesInt,
  intDivFrac:       genIntDivFrac,
  fracDivInt:       genFracDivInt,
  fracDivFrac:      genFracDivFrac,
  timesReciprocal:  genTimesReciprocal,
  mixedArith:       genMixedArith,
  decimalPower:     genDecimalPower,
  mulPow10:         genMulPow10,
  decimalDiv:       genDecimalDiv,
  decimalSimple:    genDecimalSimple,
  negSigns:         genNegSigns,
  intOrder:         genIntOrder,
  mulRound:         genMulRound,
  intPowers:        genIntPowers,
  absValue:         genAbsValue,
  signProduct:      genSignProduct,
  percentOf:        genPercentOf,
  percentOfDec:     genPercentOfDec,
  partOfNumber:     genPartOfNumber,
  ...FSU_GENERATORS,
};

export const CATEGORY_LABELS = {
  fracTimesInt:    'Дробь × целое',
  intDivFrac:      'Целое ÷ дробь',
  fracDivInt:      'Дробь ÷ целое',
  fracDivFrac:     'Дробь ÷ дробь',
  timesReciprocal: 'Целое × (1/n)',
  mixedArith:      'Целое ± смешанное',
  decimalPower:    'Степень десятичной',
  mulPow10:        '× / ÷ степень 10',
  decimalDiv:      'Деление десятичных',
  decimalSimple:   'Десятичные ± целое',
  negSigns:        'Минусы и скобки',
  intOrder:        'Порядок действий: 7 + 3 · 4',
  mulRound:        'Умножение приёмом: 24 · 25',
  intPowers:       'Степени целых: 13², 2⁸',
  absValue:        'Модуль: |−7| + |3 − 10|',
  signProduct:     'Знак произведения: (−2)·(−3)·(−5)',
  percentOf:       'Процент от числа: 20% от 45',
  percentOfDec:    'Процент от десятичной: 40% от 2,5',
  partOfNumber:    'Доля от числа: ⅜ от 40',
  ...FSU_LABELS,
};

// Блоки по темам — они же порядок чекбоксов в UI. Три последних блока
// выключены по умолчанию: лист «как было» состоит из дробей, десятичных и
// знаков, а целые, проценты и ФСУ учитель включает под конкретный урок.
export const CATEGORY_GROUPS_ORAL = [
  {
    label: 'Блок 1. Целые числа',
    keys: ['intOrder', 'mulRound', 'intPowers'],
  },
  {
    label: 'Блок 2. Обыкновенные дроби',
    keys: ['fracTimesInt', 'intDivFrac', 'fracDivInt', 'fracDivFrac', 'timesReciprocal', 'mixedArith'],
  },
  {
    label: 'Блок 3. Десятичные дроби',
    keys: ['decimalSimple', 'decimalDiv', 'mulPow10', 'decimalPower'],
  },
  {
    label: 'Блок 4. Знаки и скобки',
    keys: ['negSigns', 'absValue', 'signProduct'],
  },
  {
    label: 'Блок 5. Проценты и доли',
    keys: ['percentOf', 'percentOfDec', 'partOfNumber'],
  },
  {
    label: 'Блок 6. Формулы сокращённого умножения',
    keys: FSU_KEYS,
  },
];

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,  // 2 варианта на листе A4 (верх/низ)
  sideBySide:     true,   // 2 варианта рядом (лево/право)
  showTeacherKey: true,
  showWorkSpace:  false,
  columnsCount:   2,      // 2 колонки заданий на листе
  fontSize:       's',    // размер шрифта: s | m | l
  decimalOnly:    false,  // только целые / конечные десятичные ответы
  integerOnly:    false,  // только целые ответы
  allowNegative:  true,   // отрицательные числа в условии и в ответе
  answerForm:     'mixed', // дробный ответ: смешанное число или неправильная дробь
  categories: {
    fracTimesInt:    true,
    intDivFrac:      true,
    fracDivInt:      true,
    fracDivFrac:     true,
    timesReciprocal: true,
    mixedArith:      true,
    decimalPower:    true,
    mulPow10:        true,
    decimalDiv:      true,
    decimalSimple:   true,
    negSigns:        true,
    absValue:        false,
    signProduct:     false,
    intOrder:        false,
    mulRound:        false,
    intPowers:       false,
    percentOf:       false,
    percentOfDec:    false,
    partOfNumber:    false,
    ...fsuDefaults(FSU_KEYS),
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateOralCountingVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const { decimalOnly, integerOnly } = s;
  const allowNegative = s.allowNegative !== false;
  const improper = s.answerForm === 'improper';
  // Узкие ограничения отсеивают большую часть случайных чисел — даём генератору
  // больше попыток, иначе позиция уйдёт в другую категорию по fallback.
  const narrow = decimalOnly || integerOnly || !allowNegative;

  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: narrow ? 300 : 80,
    make: (cat) => {
      const q = GENERATORS[cat]();
      if (!q) return null;
      if (integerOnly && !isIntegerAnswer(q.resultLatex)) return null;
      if (decimalOnly && !isFiniteDecimalAnswer(q.resultLatex)) return null;
      if (!allowNegative && hasNegativeNumber(q.exprLatex, q.resultLatex)) return null;
      const resultLatex = improper ? toImproperFraction(q.resultLatex) : q.resultLatex;
      return { ...q, resultLatex, cat };
    },
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralCounting() {
  const [title, setTitle]       = useState('Устный счёт');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateOralCountingVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
