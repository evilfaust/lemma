/**
 * «Основы тригонометрии» — то, с чего начинается тема в 10 классе и что
 * потом спрашивают в устной части: перевод градусов в радианы и обратно,
 * знак функции и четверть угла (в том числе «sin 3» — радианы без π),
 * наименьший положительный период, область значений, наибольшее и
 * наименьшее значение y = A·f(x) + B.
 *
 * Всё считается точно (углы — доли π), ответ сверяется численно с самой
 * функцией. Независимая проверка по тексту — сторож `trigEgeGenerators.test.js`.
 */

import { rat, R1, mulR, addR, absR, toNum, isZero, negR, fmtNum } from '../linearExpr';
import { piTex, fnNum, FN_TEX } from './angles';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// Углы в градусах: кратные 15° и 18° (π/12, π/10) — для перевода
const DEGS = [];
for (let d = -720; d <= 720; d += 15) DEGS.push(d);
for (let d = -360; d <= 360; d += 18) if (d % 15) DEGS.push(d);

const degTex = (d) => `${d}^{\\circ}`;

// ─── Категории ───────────────────────────────────────────────────────────────
export const BASICS_GENERATORS = {
  deg_to_rad: () => {
    const d = rand(DEGS.filter(x => x !== 0));
    return {
      exprLatex: `${degTex(d)}\\;\\text{— в радианах}`,
      resultLatex: piTex(rat(d, 180)),
      check: { kind: 'equal', a: degTex(d), b: piTex(rat(d, 180)) },
      cat: 'deg_to_rad',
    };
  },
  rad_to_deg: () => {
    const d = rand(DEGS.filter(x => x !== 0));
    return {
      exprLatex: `${piTex(rat(d, 180))}\\;\\text{— в градусах}`,
      resultLatex: degTex(d),
      check: { kind: 'equal', a: piTex(rat(d, 180)), b: degTex(d) },
      cat: 'rad_to_deg',
    };
  },

  // Знак: sin 200°, cos 4, tg(−7π/6), sin 100°·cos 250°
  sign: () => {
    const fn = rand(['sin', 'cos', 'tan']);
    let argTex; let x;
    const mode = rand(['deg', 'rad', 'num']);
    if (mode === 'deg') {
      const d = rand(DEGS.filter(v => v % 90 !== 0));
      argTex = d < 0 ? `\\left(${degTex(d)}\\right)` : degTex(d);
      x = (d * Math.PI) / 180;
    } else if (mode === 'rad') {
      const r = rat(randInt(-23, 23), rand([6, 4, 3, 5, 12]));
      if (isZero(r) || (r.d <= 2)) return null;
      argTex = r.n < 0 ? `\\left(${piTex(r)}\\right)` : piTex(r);
      x = toNum(r) * Math.PI;
    } else {
      const n = rand([1, 2, 3, 4, 5, 6, -1, -2, -3, 7, 10]);
      argTex = n < 0 ? `(${n})` : String(n);
      x = n;
    }
    const v = fnNum(fn, x);
    if (!Number.isFinite(v) || Math.abs(v) < 1e-6 || Math.abs(v) > 1e6) return null;
    const sign = v > 0 ? '+' : '-';
    const expr = `${FN_TEX[fn]}${argTex.startsWith('\\left') || argTex.startsWith('(') ? '' : ' '}${argTex}`;
    return {
      exprLatex: `${expr}\\;\\text{— знак}`,
      resultLatex: v > 0 ? '+' : '-',
      mistakes: [v > 0 ? '-' : '+'],
      check: { kind: 'sign', expr, sign },
      cat: 'sign',
    };
  },

  // Четверть угла: 7π/5, 500°, 4 (радиан)
  quarter: () => {
    const mode = rand(['deg', 'rad', 'num']);
    let tex; let x;
    if (mode === 'deg') {
      const d = randInt(-700, 700);
      if (d % 90 === 0) return null;
      tex = degTex(d); x = (d * Math.PI) / 180;
    } else if (mode === 'rad') {
      const r = rat(randInt(-30, 30), rand([5, 7, 8, 9, 10, 12]));
      if (isZero(r) || (r.d <= 2)) return null;
      tex = piTex(r); x = toNum(r) * Math.PI;
    } else {
      const n = rand([1, 2, 3, 4, 5, 6, 7, 10, -1, -2, -4]);
      tex = String(n); x = n;
    }
    const t = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const q = Math.floor(t / (Math.PI / 2));
    if (Math.abs(t - (q * Math.PI) / 2) < 1e-9) return null;
    const ROMAN = ['I', 'II', 'III', 'IV'];
    return {
      exprLatex: `${tex}\\;\\text{— четверть}`,
      resultLatex: `\\text{${ROMAN[q]}}`,
      mistakes: ROMAN.filter((_, i) => i !== q).map(r => `\\text{${r}}`),
      check: { kind: 'quarter', angle: tex, q: q + 1 },
      cat: 'quarter',
    };
  },

  // Период y = A f(kx + c) + B: 2π/|k| (tg, ctg — π/|k|); sin²x, |sin x| — π
  period: () => {
    if (chance(0.2)) {
      const f = rand([
        ['\\sin^2 x', rat(1)], ['\\cos^2 x', rat(1)], ['\\left|\\sin x\\right|', rat(1)],
        ['\\sin x\\cos x', rat(1)], ['\\sin^2 3x', rat(1, 3)], ['\\cos^2 \\dfrac{x}{2}', rat(2)],
      ]);
      return periodTask(`y = ${f[0]}`, f[1]);
    }
    const fn = rand(['sin', 'cos', 'tan', 'cot']);
    const k = rand([rat(2), rat(3), rat(4), rat(1, 2), rat(1, 3), rat(2, 3), rat(3, 2), rat(-2), rat(5), rat(1, 4)]);
    const A = rand([1, 2, 3, -1, -2, 5]);
    const B = rand([0, 0, 1, -1, 2, 4]);
    const c = rand([0, 0, 1, -3, 5]);
    const kx = k.d === 1 ? `${k.n === 1 ? '' : k.n === -1 ? '-' : k.n}x` : `\\dfrac{${Math.abs(k.n) === 1 ? '' : Math.abs(k.n)}x}{${k.d}}`;
    const kxs = k.n < 0 && k.d !== 1 ? `-${kx}` : kx;
    const arg = c ? `\\left(${kxs} ${c > 0 ? '+' : '-'} ${Math.abs(c)}\\right)` : (kxs.startsWith('-') ? `\\left(${kxs}\\right)` : ` ${kxs}`);
    const head = A === 1 ? '' : A === -1 ? '-' : String(A);
    const tail = B ? (B > 0 ? ` + ${B}` : ` - ${-B}`) : '';
    const base = fn === 'tan' || fn === 'cot' ? R1 : rat(2);
    const T = absR(mulR(base, rat(k.d, k.n)));
    return periodTask(`y = ${head}${FN_TEX[fn]}${arg}${tail}`, T);
  },

  // Область значений y = A·f(x) + B (f — sin, cos; A·sin²x + B)
  range: () => {
    const [lo, hi, f] = rangeModel();
    if (lo === null) return null;
    return {
      exprLatex: `E(y),\\; ${f}`,
      resultLatex: `\\left[${fmtNum(lo, 'dec')};\\, ${fmtNum(hi, 'dec')}\\right]`,
      check: { kind: 'range', f, lo: toNum(lo), hi: toNum(hi) },
      cat: 'range',
    };
  },

  // Наибольшее / наименьшее значение — числом для бланка
  extremum: () => {
    const [lo, hi, f] = rangeModel();
    if (lo === null) return null;
    const max = chance(0.5);
    const val = max ? hi : lo;
    return {
      exprLatex: `${f}\\;\\text{— ${max ? 'наибольшее' : 'наименьшее'} значение}`,
      resultLatex: fmtNum(val, 'dec'),
      answerValue: toNum(val),
      check: { kind: max ? 'max' : 'min', f, value: toNum(val) },
      cat: 'extremum',
    };
  },
};

function periodTask(fTex, T) {
  return {
    exprLatex: `${fTex}\\;\\text{— наименьший положительный период}`,
    resultLatex: piTex(T),
    check: { kind: 'period', f: fTex, T: toNum(T) * Math.PI },
    cat: 'period',
  };
}

/** y = A f(x) + B: [B − |A|; B + |A|]; y = A sin²x + B: [min(B, A + B); max] */
function rangeModel() {
  const A = rand([1, 2, 3, 4, 5, -1, -2, -3, -4, 0.5]);
  const B = rand([0, 1, 2, 3, -1, -2, 5, 7]);
  const Ar = A === 0.5 ? rat(1, 2) : rat(A);
  const Br = rat(B);
  if (chance(0.25)) {
    const fn = rand(['sin', 'cos']);
    const head = A === 1 ? '' : A === -1 ? '-' : fmtNum(Ar, 'dec');
    const f = `y = ${head}${FN_TEX[fn]}^2 x${B ? (B > 0 ? ` + ${B}` : ` - ${-B}`) : ''}`;
    const a = Br; const b = addR(Ar, Br);
    return toNum(a) <= toNum(b) ? [a, b, f] : [b, a, f];
  }
  const fn = rand(['sin', 'cos']);
  const lo = addR(Br, negR(absR(Ar)));
  const hi = addR(Br, absR(Ar));
  // «3 − 2sin x» — как пишут в задачнике: сначала число
  const coef = Math.abs(A) === 1 ? '' : fmtNum(absR(Ar), 'dec');
  const term = `${coef}${FN_TEX[fn]} x`;
  const f = B && chance(0.6)
    ? `y = ${B} ${A < 0 ? '-' : '+'} ${term}`
    : `y = ${A < 0 ? '-' : ''}${term}${B ? (B > 0 ? ` + ${B}` : ` - ${-B}`) : ''}`;
  return [lo, hi, f];
}

export const BASICS_LABELS = {
  deg_to_rad: 'Градусы → радианы: 150° = 5π/6',
  rad_to_deg: 'Радианы → градусы: 7π/12 = 105°',
  sign: 'Знак: sin 200°, cos 4, tg(−7π/6)',
  quarter: 'Четверть угла: 7π/5, 500°, 4',
  period: 'Наименьший период: y = 3sin(2x + 1)',
  range: 'Область значений: y = 3 − 2sin x',
  extremum: 'Наибольшее/наименьшее значение',
};

export const BASICS_GROUPS = [
  { label: 'Радианная мера', keys: ['deg_to_rad', 'rad_to_deg'] },
  { label: 'Единичная окружность', keys: ['sign', 'quarter'] },
  { label: 'Свойства функций', keys: ['period', 'range', 'extremum'] },
];

