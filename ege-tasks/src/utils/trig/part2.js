/**
 * Уравнения части 2 профиля ЕГЭ (бывшее №12): а) решите уравнение,
 * б) найдите корни на отрезке.
 *
 * Модель: уравнение сводится к многочлену P(t) = 0 от t = sin x, cos x или
 * tg x, а корни P выбираются ЗАРАНЕЕ (табличные значения, «посторонние» вроде
 * sin x = 2, иногда нетабличные tg x = 3 → arctg 3). Печатается одна из
 * школьных «масок»: через основное тождество (cos²x = 1 − sin²x), двойной
 * угол, формулы приведения, однородное уравнение, tg x + k·ctg x, разложение
 * на множители, в том числе с tg — и тогда корни, где tg не существует,
 * отсеиваются (та самая ловушка ОДЗ).
 *
 * Перед выдачей: каждая точка каждой серии — корень НАПЕЧАТАННОГО уравнения
 * (по численной модели маски), корни на отрезке пересчитываются из серий.
 * Независимая проверка по тексту — сторож `trigGenerators.test.js`.
 */

import { rat, R0, R1, mulR, toNum, isZero } from '../linearExpr';
import { sr, sNum, sTex, sInt, sRad, sIsRat, sNeg, sMul } from '../surd';
import {
  ang, angNum, angTex, familyPoints, familiesTex, basicFamilies, valuesFor, plainValue,
  famLin, reduceRat, piTex,
} from './angles';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

// ─── Слагаемые и запись ──────────────────────────────────────────────────────
/** Слагаемое: коэффициент (число Q(√m)), тело в LaTeX и численная модель */
const term = (c, body, f) => ({ c: typeof c === 'number' ? sInt(c) : c, body, f });

function coefPart(c, body) {
  const v = sNum(c);
  if (!body) return sTex(c);
  if (Math.abs(v - 1) < 1e-12) return body;
  if (Math.abs(v + 1) < 1e-12) return `-${body}`;
  const t = sTex(c);
  return /\\sqrt/.test(t) ? `${t}\\,${body}` : `${t}${body}`;
}

/** Сумма слагаемых: «2\sin^2 x - 3\sin x + 1» (нулевые пропускаются) */
export function sumTex(terms) {
  const parts = terms.filter(t => Math.abs(sNum(t.c)) > 1e-12).map(t => coefPart(t.c, t.body));
  if (!parts.length) return '0';
  return parts.reduce((acc, p) => (!acc ? p : p.startsWith('-') ? `${acc} - ${p.slice(1)}` : `${acc} + ${p}`), '');
}

const sumNum = (terms) => (x) => terms.reduce((s, t) => s + sNum(t.c) * t.f(x), 0);

// Тела слагаемых
const X = 'x';
const B = {
  sin: [`\\sin ${X}`, Math.sin],
  cos: [`\\cos ${X}`, Math.cos],
  tan: [`\\operatorname{tg} ${X}`, Math.tan],
  cot: [`\\operatorname{ctg} ${X}`, (x) => 1 / Math.tan(x)],
  sin2: [`\\sin^2 ${X}`, (x) => Math.sin(x) ** 2],
  cos2: [`\\cos^2 ${X}`, (x) => Math.cos(x) ** 2],
  tan2: [`\\operatorname{tg}^2 ${X}`, (x) => Math.tan(x) ** 2],
  sinDouble: [`\\sin 2${X}`, (x) => Math.sin(2 * x)],
  cosDouble: [`\\cos 2${X}`, (x) => Math.cos(2 * x)],
  sincos: [`\\sin ${X}\\cos ${X}`, (x) => Math.sin(x) * Math.cos(x)],
  one: ['', () => 1],
};
const T = (c, key) => term(c, B[key][0], B[key][1]);

// ─── Корни многочлена ────────────────────────────────────────────────────────
// Значение t: { r: rat } рациональное или { s: surd } (±√2/2 …) — и запись
const RATIONAL_SINCOS = [rat(1, 2), rat(-1, 2), rat(1), rat(-1), rat(0)];
const EXTRANEOUS = [rat(2), rat(-2), rat(3, 2), rat(-3, 2), rat(3), rat(-3), rat(5, 2), rat(4, 3), rat(-5, 3)];
const RATIONAL_TAN = [rat(1), rat(-1), rat(0), rat(2), rat(3), rat(-2), rat(-3), rat(1, 2), rat(-1, 3), rat(4)];

/**
 * Пара корней и многочлен A t² + B t + C с целыми коэффициентами.
 * kind: 'sincos' | 'tan'. Возвращает { A, B, C, roots: [surd…] }.
 */
function rootPair(kind, { allowExtraneous = true, allowZero = true } = {}) {
  // сопряжённая пара ±√2/2, ±√3/2, ±√3, ±√3/3 → t² = q
  if (chance(0.18)) {
    const opts = kind === 'tan'
      ? [[rat(3), sRad(R1, 3)], [rat(1, 3), sRad(rat(1, 3), 3)]]
      : [[rat(1, 2), sRad(rat(1, 2), 2)], [rat(3, 4), sRad(rat(1, 2), 3)]];
    const [q, root] = rand(opts);
    // t² − q = 0 → d·t² − n = 0
    return { A: q.d, B: 0, C: -q.n, roots: [root, sNeg(root)] };
  }
  const pool = kind === 'tan' ? RATIONAL_TAN : RATIONAL_SINCOS;
  const r1 = rand(pool.filter(r => allowZero || !isZero(r)));
  let r2;
  if (kind !== 'tan' && allowExtraneous && chance(0.45)) r2 = rand(EXTRANEOUS);
  else r2 = rand(pool.filter(r => (allowZero || !isZero(r)) && toNum(r) !== toNum(r1)));
  if (!r2) return null;
  // (q1 t − p1)(q2 t − p2)
  const A = r1.d * r2.d;
  const Bc = -(r1.d * r2.n + r2.d * r1.n);
  const C = r1.n * r2.n;
  return { A, B: Bc, C, roots: [sr(r1), sr(r2)] };
}

// ─── Серии по корням ─────────────────────────────────────────────────────────
function valueFor(fn, s) {
  const v = sNum(s);
  const table = valuesFor(fn).find(x => Math.abs(x.val - v) < 1e-12);
  if (table) return table;
  if (sIsRat(s)) return plainValue(s.p);
  return null;
}

/** Серии уравнения fn(x) = t для каждого корня t; посторонние корни дают [] */
function familiesFor(fn, roots) {
  const out = [];
  for (const s of roots) {
    const v = valueFor(fn, s);
    if (!v) return null;
    if ((fn === 'sin' || fn === 'cos') && Math.abs(v.val) > 1 + 1e-12) continue;
    if (fn === 'cot' && Math.abs(v.val) < 1e-12) { out.push(famLin(ang(rat(1, 2)), R1)); continue; }
    // нетабличные — только у tg (arctg 3): sin x = 1/3 в части 2 не даём
    if (v.asin === undefined && v.atan === undefined && fn !== 'tan') return null;
    out.push(...basicFamilies(fn, v, 'split'));
  }
  return out;
}

/** Убрать серии, целиком лежащие в других, и склеить пары «c и c + T/2» */
export function unionFamilies(fams) {
  const pts = (f) => {
    const out = [];
    for (let n = -6; n <= 6; n++) for (const p of familyPoints(f, n)) out.push(angNum(p));
    return out;
  };
  let list = fams.filter(Boolean).map(f => (f.kind === 'lin' && !f.c.arc ? famLin(ang(reduceRat(f.c.pi, f.T)), f.T) : f));
  // склейка: две lin-серии с одним периодом и сдвигом ровно T/2
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        if (a.kind !== 'lin' || b.kind !== 'lin' || a.c.arc || b.c.arc) continue;
        if (toNum(a.T) !== toNum(b.T)) continue;
        const diff = Math.abs(toNum(a.c.pi) - toNum(b.c.pi));
        if (Math.abs(diff - toNum(a.T) / 2) < 1e-12) {
          const half = mulR(a.T, rat(1, 2));
          const c = toNum(a.c.pi) < toNum(b.c.pi) ? a.c : b.c;
          list = list.filter((_, k) => k !== i && k !== j);
          list.push(famLin(ang(reduceRat(c.pi, half)), half));
          merged = true;
          break outer;
        }
      }
    }
  }
  // вложенные серии: оставляем серию, если хоть одна её точка не покрыта
  // уже оставленными (сначала — самые «густые», с меньшим периодом)
  list.sort((a, b) => toNum(a.T) - toNum(b.T));
  const keep = [];
  const covered = [];
  for (const f of list) {
    const own = pts(f);
    if (own.every(x => covered.some(y => Math.abs(y - x) < 1e-9))) continue;
    keep.push(f);
    for (let n = -30; n <= 30; n++) for (const p of familyPoints(f, n)) covered.push(angNum(p));
  }
  // порядок: по сдвигу
  return keep.sort((a, b) => angNum(a.c || a.s) - angNum(b.c || b.s));
}

/** Отсеять точки, где tg (ctg) не существует — ОДЗ */
function dropUndefined(fams, guard) {
  if (!guard) return fams;
  return fams.filter(f => {
    const xs = [];
    for (let n = -3; n <= 3; n++) for (const p of familyPoints(f, n)) xs.push(angNum(p));
    return xs.every(x => Number.isFinite(guard(x)) && Math.abs(guard(x)) < 1e6);
  });
}

// ─── Маски ───────────────────────────────────────────────────────────────────
/** A t² + B t + C, t = fn(x): «2\sin^2 x - 3\sin x + 1 = 0» */
function plainQuad(fn, p) {
  const sq = { sin: 'sin2', cos: 'cos2', tan: 'tan2' }[fn];
  return { lhs: [T(p.A, sq), T(p.B, fn), T(p.C, 'one')], rhs: [] };
}

const MASKS = {
  // A s² + B s + C → −A c² + B s + (A + C) = 0 (и наоборот)
  pythag: (fn, p) => {
    const other = fn === 'sin' ? 'cos2' : 'sin2';
    return { lhs: [T(-p.A, other), T(p.B, fn), T(p.A + p.C, 'one')], rhs: [] };
  },
  // A s² = −(A/2)(cos 2x − 1); A c² = (A/2)(cos 2x + 1)
  doubleAngle: (fn, p) => {
    if (p.A % 2 !== 0) p = { ...p, A: 2 * p.A, B: 2 * p.B, C: 2 * p.C };
    const h = p.A / 2;
    return fn === 'sin'
      ? { lhs: [T(-h, 'cosDouble'), T(p.B, fn), T(h + p.C, 'one')], rhs: [] }
      : { lhs: [T(h, 'cosDouble'), T(p.B, fn), T(h + p.C, 'one')], rhs: [] };
  },
};

// sin x и cos x через приведение: g(shift ± x) = знак · f(x)
const REDUCE = {
  sin: [
    ['\\cos\\left(\\dfrac{\\pi}{2} - x\\right)', 1, (x) => Math.cos(Math.PI / 2 - x)],
    ['\\cos\\left(\\dfrac{\\pi}{2} + x\\right)', -1, (x) => Math.cos(Math.PI / 2 + x)],
    ['\\sin\\left(\\pi - x\\right)', 1, (x) => Math.sin(Math.PI - x)],
    ['\\sin\\left(\\pi + x\\right)', -1, (x) => Math.sin(Math.PI + x)],
    ['\\cos\\left(\\dfrac{3\\pi}{2} + x\\right)', 1, (x) => Math.cos(1.5 * Math.PI + x)],
    ['\\cos\\left(\\dfrac{3\\pi}{2} - x\\right)', -1, (x) => Math.cos(1.5 * Math.PI - x)],
  ],
  cos: [
    ['\\sin\\left(\\dfrac{\\pi}{2} - x\\right)', 1, (x) => Math.sin(Math.PI / 2 - x)],
    ['\\sin\\left(\\dfrac{\\pi}{2} + x\\right)', 1, (x) => Math.sin(Math.PI / 2 + x)],
    ['\\cos\\left(\\pi - x\\right)', -1, (x) => Math.cos(Math.PI - x)],
    ['\\cos\\left(\\pi + x\\right)', -1, (x) => Math.cos(Math.PI + x)],
    ['\\sin\\left(\\dfrac{3\\pi}{2} - x\\right)', -1, (x) => Math.sin(1.5 * Math.PI - x)],
    ['\\sin\\left(\\dfrac{3\\pi}{2} + x\\right)', -1, (x) => Math.sin(1.5 * Math.PI + x)],
  ],
};
function reducedTerm(fn, coef) {
  const [tex, sign, f] = rand(REDUCE[fn]);
  return term(coef * sign, tex, f);
}

// ─── Категории ───────────────────────────────────────────────────────────────
function quadFamilies(fn, p) {
  if (!p) return null;
  const fams = familiesFor(fn, p.roots);
  if (!fams || !fams.length) return null;
  return unionFamilies(fams);
}

function buildQuad(fn, mask) {
  const p = rootPair('sincos');
  if (!p) return null;
  const fams = quadFamilies(fn, p);
  if (!fams) return null;
  const eq = mask ? MASKS[mask](fn, p) : plainQuad(fn, p);
  return { eq, fams };
}

export const PART2_GENERATORS = {
  quad_sin: () => buildQuad('sin'),
  quad_cos: () => buildQuad('cos'),
  pythag: () => buildQuad(rand(['sin', 'cos']), 'pythag'),
  double_angle: () => buildQuad(rand(['sin', 'cos']), 'doubleAngle'),
  // 2sin²x − 3cos(π/2 − x) + 1 = 0: линейное слагаемое через приведение
  reduction: () => {
    const fn = rand(['sin', 'cos']);
    const p = rootPair('sincos');
    if (!p || p.B === 0) return null;
    const fams = quadFamilies(fn, p);
    if (!fams) return null;
    const base = chance(0.5) ? plainQuad(fn, p) : MASKS.pythag(fn, p);
    const lhs = base.lhs.map(t => (t.body === B[fn][0] ? reducedTerm(fn, sNum(t.c)) : t));
    return { eq: { lhs, rhs: [] }, fams };
  },
  // sin 2x = √3 cos x → cos x (2sin x − √3) = 0
  sin2x: () => {
    const g = rand(['sin', 'cos']);                 // множитель, который выносится
    const other = g === 'cos' ? 'sin' : 'cos';      // 2·other − p = 0
    const p = rand([sInt(1), sInt(-1), sRad(R1, 2), sRad(rat(-1), 2), sRad(R1, 3), sRad(rat(-1), 3), sInt(2), sInt(-2), sInt(3)]);
    const half = sMul(p, sr(rat(1, 2)));
    const fams = familiesFor(g, [sInt(0)]);
    const fams2 = familiesFor(other, [half]);
    if (!fams || !fams2) return null;
    const all = unionFamilies([...fams, ...fams2]);
    // sin 2x = p·g(x)  или  sin 2x − p·g(x) = 0
    const eq = chance(0.6)
      ? { lhs: [T(1, 'sinDouble')], rhs: [T(p, g)] }
      : { lhs: [T(1, 'sinDouble'), T(sNeg(p), g)], rhs: [] };
    return { eq, fams: all };
  },
  // a sin x + b cos x = 0 → tg x = −b/a
  homog1: () => {
    const v = rand(valuesFor('tan').filter(x => x.key !== '0'));
    // tg x = v ⇔ sin x = v·cos x; запись с целыми/радикальными коэффициентами
    const forms = {
      '1': [[1, 1]], '-1': [[1, -1]],
      s3: [[1, sRad(R1, 3)], [sRad(R1, 3), 3]],
      '-s3': [[1, sRad(rat(-1), 3)], [sRad(R1, 3), -3]],
      's3/3': [[sRad(R1, 3), 1], [3, sRad(R1, 3)]],
      '-s3/3': [[sRad(R1, 3), -1], [3, sRad(rat(-1), 3)]],
    }[v.key];
    const [a, b] = rand(forms);                     // a sin x = b cos x
    const fams = familiesFor('tan', [valueSurd(v)]);
    if (!fams) return null;
    const eq = chance(0.5)
      ? { lhs: [T(a, 'sin')], rhs: [T(b, 'cos')] }
      : { lhs: [T(a, 'sin'), T(typeof b === 'number' ? -b : sNeg(b), 'cos')], rhs: [] };
    return { eq, fams: unionFamilies(fams) };
  },
  // A sin²x + B sin x cos x + C cos²x = D
  homog2: () => {
    const p = rootPair('tan', { allowZero: true });
    if (!p) return null;
    const fams = quadFamilies('tan', p);
    if (!fams) return null;
    // (A − D) = p.A, B = p.B, (C − D) = p.C
    const D = chance(0.45) ? rand([1, 2, 3]) : 0;
    const A = p.A + D; const C = p.C + D;
    if (A === 0 && D === 0) return null;
    return {
      eq: { lhs: [T(A, 'sin2'), T(p.B, 'sincos'), T(C, 'cos2')], rhs: D ? [T(D, 'one')] : [] },
      fams,
    };
  },
  // tg x + k·ctg x = m → tg²x − m tg x + k = 0
  tg_ctg: () => {
    const p = rootPair('tan', { allowZero: false });
    if (!p || p.A !== 1 || p.B === 0) return null;   // приведённый: t² + Bt + C
    const fams = quadFamilies('tan', p);
    if (!fams) return null;
    return {
      eq: { lhs: [T(1, 'tan'), T(p.C, 'cot')], rhs: [T(-p.B, 'one')] },
      fams,
      guard: (x) => Math.tan(x) * (1 / Math.tan(x)),
    };
  },
  // (2sin x − 1)(tg x + 1) = 0 — с отсевом там, где tg не существует
  factor: () => {
    const f1 = rand(['sin', 'cos']);
    const v1 = rand(valuesFor(f1).filter(x => x.key !== '0'));
    const f2 = rand(['tan', 'cos', 'sin']);
    const v2 = rand(valuesFor(f2));
    if (f2 === f1) return null;
    const fa = familiesFor(f1, [valueSurd(v1)]);
    const fb = familiesFor(f2, [valueSurd(v2)]);
    if (!fa || !fb) return null;
    const guard = f2 === 'tan' ? (x) => Math.tan(x) : null;
    const fams = unionFamilies(dropUndefined([...fa, ...fb], guard));
    if (!fams.length) return null;
    const lin = (fn, v) => {
      // k·f(x) − c = 0 с «красивыми» коэффициентами: 2sin x − 1, tg x + √3, √2 cos x − 1
      const s = valueSurd(v);
      const k = /s2/.test(v.key) ? sRad(R1, 2) : /\/2/.test(v.key) ? sInt(2) : /s3\/3/.test(v.key) ? sInt(3) : sInt(1);
      const c = sMul(k, s);
      const single = Math.abs(sNum(c)) < 1e-12;
      const tex = sumTex([term(k, B[fn][0], B[fn][1]), term(sNeg(c), '', () => 1)]);
      return { tex, single, f: (x) => sNum(k) * B[fn][1](x) - sNum(c) };
    };
    const a = lin(f1, v1); const b = lin(f2, v2);
    // одиночный множитель «tg x» пишем первым и без скобок: tg x·(2sin x − 1) = 0
    const [p1, p2] = b.single ? [b, a] : [a, b];
    const wrap = (m) => (m.single ? m.tex : `\\left(${m.tex}\\right)`);
    return {
      eqTex: `${wrap(p1)}${p1.single ? ' \\cdot ' : ''}${wrap(p2)} = 0`,
      g: (x) => a.f(x) * b.f(x),
      fams,
      guard,
    };
  },
};

function valueSurd(v) {
  const map = {
    '0': sInt(0), '1': sInt(1), '-1': sInt(-1), '1/2': sr(rat(1, 2)), '-1/2': sr(rat(-1, 2)),
    's2/2': sRad(rat(1, 2), 2), '-s2/2': sRad(rat(-1, 2), 2), 's3/2': sRad(rat(1, 2), 3), '-s3/2': sRad(rat(-1, 2), 3),
    's3/3': sRad(rat(1, 3), 3), '-s3/3': sRad(rat(-1, 3), 3), s3: sRad(R1, 3), '-s3': sRad(rat(-1), 3),
  };
  return map[v.key];
}

// ─── Отрезок для пункта б) ───────────────────────────────────────────────────
const SEGMENTS = [
  [rat(-2), rat(-1, 2)], [rat(3, 2), rat(3)], [rat(-7, 2), rat(-2)], [rat(1), rat(5, 2)],
  [rat(2), rat(7, 2)], [rat(-5, 2), rat(-1)], [rat(-3), rat(-3, 2)], [rat(5, 2), rat(4)],
  [rat(-1), rat(1, 2)], [rat(-3, 2), rat(0)], [rat(4), rat(11, 2)], [rat(-9, 2), rat(-3)],
];

function rootsOnSegment(fams, seg) {
  const lo = toNum(seg[0]) * Math.PI - 1e-9;
  const hi = toNum(seg[1]) * Math.PI + 1e-9;
  const out = [];
  for (const f of fams) {
    for (let n = -40; n <= 40; n++) {
      for (const p of familyPoints(f, n)) {
        const x = angNum(p);
        if (x >= lo && x <= hi && !out.some(o => Math.abs(o.x - x) < 1e-9)) out.push({ x, p });
      }
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

// ─── Сборка задания ──────────────────────────────────────────────────────────
export function buildPart2(cat, { withSegment = true } = {}) {
  const built = PART2_GENERATORS[cat]?.();
  if (!built || !built.fams?.length) return null;
  const { fams } = built;
  let eqTex; let g;
  if (built.eqTex) { eqTex = built.eqTex; g = built.g; }
  else {
    // «−2cos²x − sin x + 2 = 0» → умножаем на −1
    const first = built.eq.lhs.find(t => Math.abs(sNum(t.c)) > 1e-12);
    if (!built.eq.rhs.length && first && sNum(first.c) < 0) {
      built.eq.lhs = built.eq.lhs.map(t => ({ ...t, c: sNeg(t.c) }));
    }
    const L = sumNum(built.eq.lhs); const R = sumNum(built.eq.rhs);
    eqTex = `${sumTex(built.eq.lhs)} = ${built.eq.rhs.length ? sumTex(built.eq.rhs) : '0'}`;
    g = (x) => L(x) - R(x);
  }
  // проверка: каждая точка каждой серии — корень напечатанного уравнения
  for (const f of fams) {
    for (let n = -3; n <= 3; n++) {
      for (const p of familyPoints(f, n)) {
        const x = angNum(p);
        const r = g(x);
        if (!Number.isFinite(r) || Math.abs(r) > 1e-7) return null;
        if (built.guard && !Number.isFinite(built.guard(x))) return null;
      }
    }
  }
  const famTex = familiesTex(fams);
  if (!withSegment) {
    return { exprLatex: eqTex, resultLatex: famTex, varLatex: 'x', hideKeyPrompt: true, cat };
  }
  const seg = rand(SEGMENTS);
  const roots = rootsOnSegment(fams, seg);
  if (!roots.length || roots.length > 5) return null;
  const segTex = `\\left[${piTex(seg[0])};\\, ${piTex(seg[1])}\\right]`;
  const rootsTex = roots.map(r => angTex(r.p)).join(';\\; ');
  return {
    exprLatex: `${eqTex};\\quad ${segTex}`,
    resultLatex: `\\text{а) } ${famTex};\\quad \\text{б) } ${rootsTex}`,
    varLatex: 'x',
    hideKeyPrompt: true,
    segment: [toNum(seg[0]), toNum(seg[1])],
    cat,
  };
}

export const PART2_LABELS = {
  quad_sin: '2sin²x − 3sin x + 1 = 0',
  quad_cos: '2cos²x + cos x − 1 = 0',
  pythag: '2cos²x + 3sin x − 3 = 0 (через тождество)',
  double_angle: 'cos 2x + sin x = 0 (двойной угол)',
  reduction: '2sin²x − 3cos(π/2 − x) + 1 = 0 (приведение)',
  sin2x: 'sin 2x = √3·cos x (вынести множитель)',
  homog1: 'sin x = √3·cos x (однородное 1-й степени)',
  homog2: 'sin²x − 4sin x cos x + 3cos²x = 0',
  tg_ctg: 'tg x + 3ctg x = 4',
  factor: '(2sin x − 1)(tg x + 1) = 0 (с ОДЗ)',
};

export const PART2_GROUPS = [
  { label: 'Квадратные относительно sin x, cos x', keys: ['quad_sin', 'quad_cos', 'pythag', 'double_angle', 'reduction'] },
  { label: 'Разложение на множители', keys: ['sin2x', 'factor'] },
  { label: 'Однородные и через tg', keys: ['homog1', 'homog2', 'tg_ctg'] },
];

