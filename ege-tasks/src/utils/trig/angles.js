/**
 * Углы и серии корней тригонометрических уравнений — точной арифметикой.
 *
 * Угол хранится в долях π рациональным числом (`rat(1, 6)` = π/6), поэтому
 * сдвиг, деление на коэффициент при x и приведение по периоду не теряют
 * точности. Нетабличный угол (arcsin 1/3, arctg 2) — символ `arc` с
 * коэффициентом: угол = coef·arc + pi·π.
 *
 * Серия корней (`family`) — одна из трёх школьных записей:
 *   lin — x = c + T·n
 *   alt — x = s + (−1)^n·α + T·n  (синус)
 *   pm  — x = s ± α + T·n         (косинус)
 * где T > 0 — период серии в долях π (для заданий «π(x − 1)/3» — просто число).
 *
 * Модуль чистый: на нём держатся генераторы уравнений, неравенств и отбора
 * корней, их сторож — `__tests__/trigGenerators.test.js`.
 */

import {
  rat, R0, R1, addR, subR, mulR, divR, negR, absR, isZero, toNum, fmtNum,
} from '../linearExpr';

// ─── Углы ────────────────────────────────────────────────────────────────────

/** Угол: { pi: rat, arc?: { coef: rat, tex, val } } */
export const ang = (pi, arc = null) => ({ pi, arc: arc && !isZero(arc.coef) ? arc : null });
export const angPi = (n, d = 1) => ang(rat(n, d));

export const angNum = (a, unit = Math.PI) =>
  toNum(a.pi) * unit + (a.arc ? toNum(a.arc.coef) * a.arc.val : 0);

export const angAdd = (a, b) => {
  if (a.arc && b.arc && a.arc.tex !== b.arc.tex) return null;
  const arc = a.arc || b.arc
    ? { ...(a.arc || b.arc), coef: addR(a.arc?.coef || R0, b.arc?.coef || R0) }
    : null;
  return ang(addR(a.pi, b.pi), arc);
};
export const angNeg = (a) => ang(negR(a.pi), a.arc ? { ...a.arc, coef: negR(a.arc.coef) } : null);
export const angSub = (a, b) => angAdd(a, angNeg(b));
export const angScale = (a, k) =>
  ang(mulR(a.pi, k), a.arc ? { ...a.arc, coef: mulR(a.arc.coef, k) } : null);
export const angIsZero = (a) => isZero(a.pi) && !a.arc;
export const angSign = (a) => {
  const v = angNum(a);
  return Math.abs(v) < 1e-12 ? 0 : (v < 0 ? -1 : 1);
};

/** Остаток по модулю: приводит π-часть в (−T/2; T/2] */
export function reduceRat(r, T) {
  const t = toNum(T);
  const k = Math.round(toNum(r) / t);
  let x = subR(r, mulR(rat(k), T));
  if (toNum(x) <= -t / 2 + 1e-12) x = addR(x, T);
  if (toNum(x) > t / 2 + 1e-12) x = subR(x, T);
  return x;
}

// Рациональный коэффициент при «π» или при «π n»: π, 2π, \dfrac{π}{6}, \dfrac{5π}{6}
function piCoefTex(r, sym) {
  const n = Math.abs(r.n);
  const head = r.n < 0 ? '-' : '';
  if (r.d === 1) return `${head}${n === 1 ? '' : n}${sym}`;
  return `${head}\\dfrac{${n === 1 ? '' : n}${sym}}{${r.d}}`;
}

/** π-доля без числа: «\dfrac{5\pi}{6}», «-\pi», «0» */
export function piTex(r) {
  if (isZero(r)) return '0';
  return piCoefTex(r, '\\pi');
}

/** Число (задания «π(x − 1)/3»: ответы — просто числа) */
export const numTex = (r) => fmtNum(r, 'dec');

/** Коэффициент перед arc: «\dfrac{1}{2}\arcsin\dfrac{1}{3}», «-\arcsin…» */
function arcTex(arc) {
  const c = arc.coef;
  if (c.n === 1 && c.d === 1) return arc.tex;
  if (c.n === -1 && c.d === 1) return `-${arc.tex}`;
  const head = c.n < 0 ? '-' : '';
  const n = Math.abs(c.n);
  if (c.d === 1) return `${head}${n}${arc.tex}`;
  return `${head}\\dfrac{${n === 1 ? '' : n}}{${c.d}}${arc.tex}`;
}

/**
 * Угол целиком. `unit: 'pi'` — в долях π, `'num'` — числом (аргумент π·x).
 * Нетабличная часть идёт первой: «\arcsin\dfrac{1}{3} + \pi».
 */
export function angTex(a, unit = 'pi') {
  const parts = [];
  if (a.arc) parts.push(arcTex(a.arc));
  if (!isZero(a.pi) || !parts.length) parts.push(unit === 'pi' ? piTex(a.pi) : numTex(a.pi));
  return joinSigned(parts);
}

/** «a», «-b» → «a - b» */
export function joinSigned(parts) {
  return parts.reduce((acc, p) => {
    if (!acc) return p;
    if (p.startsWith('-')) return `${acc} - ${p.slice(1)}`;
    return `${acc} + ${p}`;
  }, '');
}

/** Слагаемое периода: «2\pi n», «\dfrac{\pi n}{2}»; числом — «6n», «\dfrac{3n}{2}» */
export function periodTex(T, unit = 'pi', n = 'n') {
  if (unit === 'pi') return piCoefTex(T, `\\pi ${n}`);
  if (T.d === 1) return `${T.n === 1 ? '' : T.n}${n}`;
  return `\\dfrac{${T.n === 1 ? '' : T.n}${n}}{${T.d}}`;
}

// ─── Серии корней ────────────────────────────────────────────────────────────

export const famLin = (c, T) => ({ kind: 'lin', c, T });
export const famAlt = (s, a, T) => ({ kind: 'alt', s, a, T });
export const famPm  = (s, a, T) => ({ kind: 'pm', s, a, T });

/** Точки серии при данном n (pm и alt дают обе ветви — массив) */
export function familyPoints(f, n) {
  const T = mulR(f.T, rat(n));
  const shift = ang(T);
  if (f.kind === 'lin') return [angAdd(f.c, shift)];
  if (f.kind === 'alt') {
    const sign = n % 2 === 0 ? f.a : angNeg(f.a);
    return [angAdd(angAdd(f.s, sign), shift)];
  }
  return [angAdd(angAdd(f.s, f.a), shift), angAdd(angSub(f.s, f.a), shift)];
}

/** Запись серии: «x = \dfrac{\pi}{6} + 2\pi n» */
export function familyTex(f, { v = 'x', unit = 'pi', n = 'n' } = {}) {
  const per = periodTex(f.T, unit, n);
  if (f.kind === 'lin') {
    if (angIsZero(f.c)) return `${v} = ${per}`;
    return `${v} = ${joinSigned([angTex(f.c, unit), per])}`;
  }
  const head = angIsZero(f.s) ? [] : [angTex(f.s, unit)];
  if (f.kind === 'pm') {
    const a = angSign(f.a) < 0 ? angNeg(f.a) : f.a;
    const body = `\\pm ${angTex(a, unit)}`;
    const parts = head.length ? `${head[0]} ${body}` : body;
    return `${v} = ${parts} + ${per}`;
  }
  // alt: (−1)^n·α, отрицательный α → (−1)^{n+1}·|α|
  const neg = angSign(f.a) < 0;
  const a = neg ? angNeg(f.a) : f.a;
  const pow = neg ? `(-1)^{${n}+1}` : `(-1)^{${n}}`;
  const aTex = angTex(a, unit);
  const term = a.arc && !isZero(a.pi) ? `${pow}\\left(${aTex}\\right)` : `${pow}${aTex}`;
  return `${v} = ${joinSigned([...head, term, per])}`;
}

/** Ответ целиком: серии через «или» + «n ∈ ℤ» */
export function familiesTex(families, opts = {}) {
  if (!families.length) return '\\text{корней нет}';
  const n = opts.n || 'n';
  return `${families.map(f => familyTex(f, opts)).join('\\;\\text{ или }\\;')},\\; ${n} \\in \\mathbb{Z}`;
}

// ─── Табличные значения ──────────────────────────────────────────────────────
// Значение a: { key, tex, val, asin?, atan? } — asin/atan в долях π
const S2 = Math.SQRT2;
const S3 = Math.sqrt(3);

export const SINCOS_VALUES = [
  { key: '0',     tex: '0',                         val: 0,       asin: rat(0) },
  { key: '1/2',   tex: '\\dfrac{1}{2}',             val: 0.5,     asin: rat(1, 6) },
  { key: 's2/2',  tex: '\\dfrac{\\sqrt{2}}{2}',     val: S2 / 2,  asin: rat(1, 4) },
  { key: 's3/2',  tex: '\\dfrac{\\sqrt{3}}{2}',     val: S3 / 2,  asin: rat(1, 3) },
  { key: '1',     tex: '1',                         val: 1,       asin: rat(1, 2) },
  { key: '-1/2',  tex: '-\\dfrac{1}{2}',            val: -0.5,    asin: rat(-1, 6) },
  { key: '-s2/2', tex: '-\\dfrac{\\sqrt{2}}{2}',    val: -S2 / 2, asin: rat(-1, 4) },
  { key: '-s3/2', tex: '-\\dfrac{\\sqrt{3}}{2}',    val: -S3 / 2, asin: rat(-1, 3) },
  { key: '-1',    tex: '-1',                        val: -1,      asin: rat(-1, 2) },
];

export const TAN_VALUES = [
  { key: '0',     tex: '0',                         val: 0,       atan: rat(0) },
  { key: 's3/3',  tex: '\\dfrac{\\sqrt{3}}{3}',     val: S3 / 3,  atan: rat(1, 6) },
  { key: '1',     tex: '1',                         val: 1,       atan: rat(1, 4) },
  { key: 's3',    tex: '\\sqrt{3}',                 val: S3,      atan: rat(1, 3) },
  { key: '-s3/3', tex: '-\\dfrac{\\sqrt{3}}{3}',    val: -S3 / 3, atan: rat(-1, 6) },
  { key: '-1',    tex: '-1',                        val: -1,      atan: rat(-1, 4) },
  { key: '-s3',   tex: '-\\sqrt{3}',                val: -S3,     atan: rat(-1, 3) },
];

export const valuesFor = (fn) => (fn === 'sin' || fn === 'cos' ? SINCOS_VALUES : TAN_VALUES);

/** arcsin/arccos/arctg/arcctg табличного значения — в долях π */
export function principal(fn, v) {
  if (fn === 'sin') return v.asin;
  if (fn === 'cos') return subR(rat(1, 2), v.asin);          // arccos a = π/2 − arcsin a
  if (fn === 'tan') return v.atan;
  return subR(rat(1, 2), v.atan);                             // arcctg a = π/2 − arctg a
}

export const FN_TEX = {
  sin: '\\sin', cos: '\\cos', tan: '\\operatorname{tg}', cot: '\\operatorname{ctg}',
};
export const ARC_TEX = {
  sin: '\\arcsin', cos: '\\arccos', tan: '\\operatorname{arctg}', cot: '\\operatorname{arcctg}',
};

export function fnNum(fn, x) {
  if (fn === 'sin') return Math.sin(x);
  if (fn === 'cos') return Math.cos(x);
  if (fn === 'tan') return Math.tan(x);
  return 1 / Math.tan(x);
}

/** Значение-число для нетабличных уравнений: 1/3, 2/5, 3 … */
export function plainValue(r) {
  return { key: `${r.n}/${r.d}`, tex: fmtNum(r), val: toNum(r), r };
}

// ─── Серии простейшего уравнения f(u) = a ────────────────────────────────────
/**
 * Серии для u. `style: 'combined'` — одна запись ((−1)^n у синуса, ± у
 * косинуса), `'split'` — двумя сериями с периодом 2π (так удобнее, когда
 * потом прибавляется сдвиг и делится на коэффициент).
 * Нетабличное значение — `v.r` (рациональное число): угол становится символом.
 */
export function basicFamilies(fn, v, style = 'combined') {
  if (Math.abs(v.val) > 1 + 1e-12 && (fn === 'sin' || fn === 'cos')) return [];
  const table = v.asin !== undefined || v.atan !== undefined;
  let a;
  if (table) a = ang(principal(fn, v));
  else {
    // arcsin(−a) = −arcsin a, arctg(−a) = −arctg a; для cos/ctg — только a > 0
    const neg = v.val < 0;
    const absTex = fmtNum(absR(v.r));
    const val = fn === 'sin' ? Math.asin(Math.abs(v.val))
      : fn === 'cos' ? Math.acos(v.val)
      : fn === 'tan' ? Math.atan(Math.abs(v.val))
      : Math.PI / 2 - Math.atan(v.val);
    const tex = `${ARC_TEX[fn]}${absTex.startsWith('\\') ? '' : ' '}${absTex}`;
    a = ang(R0, { coef: (neg && (fn === 'sin' || fn === 'tan')) ? rat(-1) : R1, tex, val });
  }

  if (fn === 'tan' || fn === 'cot') return [famLin(a, R1)];

  const two = rat(2);
  if (fn === 'sin') {
    if (table && isZero(v.asin)) return [famLin(ang(R0), R1)];
    if (table && Math.abs(v.val) === 1) return [famLin(a, two)];
    if (style === 'split') return [famLin(a, two), famLin(angSub(ang(R1), a), two)];
    return [famAlt(ang(R0), a, R1)];
  }
  // cos
  if (table && v.key === '0') return [famLin(a, R1)];
  if (table && (v.key === '1' || v.key === '-1')) return [famLin(a, two)];
  if (style === 'split') return [famLin(a, two), famLin(angNeg(a), two)];
  return [famPm(ang(R0), a, two)];
}

/**
 * Переход от u к x: u = k·x + b ⇒ x = (u − b)/k.
 * k — рациональное (у «π(x − 1)/3» — коэффициент при π, тогда и ответы числа).
 * Период делается положительным, π-часть сдвига приводится в (−T/2; T/2].
 */
export function transformFamily(f, k, b) {
  const kInv = divR(R1, k);
  const T = absR(mulR(f.T, kInv));
  // Без сдвига оставляем главное значение, делённое на k (ctg 2x = −1 →
  // 3π/8 + πn/2, как в учебнике); со сдвигом — приводим в (−T/2; T/2]
  const noShift = angIsZero(b);
  const norm = (a) => (a.arc || noShift ? a : ang(reduceRat(a.pi, T)));
  if (f.kind === 'lin') return famLin(norm(angScale(angSub(f.c, b), kInv)), T);
  const s = angScale(angSub(f.s, b), kInv);
  const a = angScale(f.a, kInv);
  // при k < 0 замена n → −n: (−1)^n не меняется, ± — тоже.
  // 🚨 У (−1)^n сдвиг на один период меняет чётность n — приводим по 2T
  if (f.kind === 'alt') {
    const s2 = s.arc || noShift ? s : ang(reduceRat(s.pi, mulR(T, rat(2))));
    return famAlt(s2, a, T);
  }
  return famPm(norm(s), a, T);
}

/** Различные корни серий на одном периоде P (для проверки полноты) */
export function residues(families, P, unit = Math.PI, nRange = 6) {
  const p = toNum(P) * unit;
  const seen = [];
  for (const f of families) {
    for (let n = -nRange; n <= nRange; n++) {
      for (const pt of familyPoints(f, n)) {
        const x = angNum(pt, unit);
        let r = ((x % p) + p) % p;
        if (p - r < 1e-9) r = 0;
        if (!seen.some(s => Math.abs(s - r) < 1e-7)) seen.push(r);
      }
    }
  }
  return seen.length;
}

/** Одно ли множество корней у двух ответов (сравнение точек на окне) */
export function sameRoots(fa, fb, unit = Math.PI, lo = -12, hi = 12) {
  const pts = (fams) => {
    const raw = [];
    for (const f of fams) {
      const t = toNum(f.T) * unit;
      const span = Math.ceil((hi - lo) / t) + 4;
      for (let n = -span; n <= span; n++) {
        for (const p of familyPoints(f, n)) {
          const x = angNum(p, unit);
          if (x > lo && x < hi) raw.push(x);
        }
      }
    }
    raw.sort((p, q) => p - q);
    return raw.filter((x, i) => i === 0 || x - raw[i - 1] > 1e-7);
  };
  const a = pts(fa); const b = pts(fb);
  return a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-7);
}

export const two = rat(2);
export { rat, R0, R1, addR, subR, mulR, divR, negR, absR, isZero, toNum, fmtNum };
