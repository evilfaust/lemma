// Точная арифметика генератора задач по стереометрии.
//
// Рациональные числа — на BigInt. Точка тела хранится «решёткой»: тремя
// рациональными коэффициентами q, а настоящая координата — q·√g, где g —
// свой для каждой оси множитель без квадратов (у правильной треугольной
// призмы ось y — в единицах √3, у тетраэдра ось z — в единицах √6, у
// пирамиды — в единицах √(h²)). Тогда скалярное произведение Σ g·u·v
// рационально, и длины, расстояния, площади, объёмы и cos² углов выходят
// точно — в виде √(рационального) = k√m / q.
//
// Почему так можно: для M = diag(√g) верно (Mu)×(Mv) = det M · M⁻ᵀ(u×v),
// поэтому нормаль плоскости в той же решётке — это G⁻¹(u×v) (G = diag(g)).

// ─── рациональные числа ──────────────────────────────────────────────────

export const bgcd = (a, b) => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
};

/** Дробь n/d (сокращённая, знаменатель положителен). */
export const Q = (n, d = 1n) => {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error('Деление на ноль');
  if (dd < 0n) { nn = -nn; dd = -dd; }
  const g = bgcd(nn, dd);
  return { n: nn / g, d: dd / g };
};

export const ZERO = Q(0);
export const ONE = Q(1);
export const qadd = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qsub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qmul = (a, b) => Q(a.n * b.n, a.d * b.d);
export const qdiv = (a, b) => Q(a.n * b.d, a.d * b.n);
export const qneg = (a) => Q(-a.n, a.d);
export const qabs = (a) => Q(a.n < 0n ? -a.n : a.n, a.d);
export const qsign = (a) => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);
export const qzero = (a) => a.n === 0n;
export const qeq = (a, b) => a.n === b.n && a.d === b.d;
export const qnum = (a) => Number(a.n) / Number(a.d);
/** Рациональное из целого или пары [p, q]. */
export const qOf = (x) => (Array.isArray(x) ? Q(x[0], x[1]) : Q(x));

/** Рациональное в LaTeX: «-\frac{3}{2}», «4». */
export function qLatex(a, { frac = 'frac' } = {}) {
  if (a.d === 1n) return `${a.n}`;
  const sign = a.n < 0n ? '-' : '';
  const n = a.n < 0n ? -a.n : a.n;
  return `${sign}\\${frac}{${n}}{${a.d}}`;
}

// ─── корни ───────────────────────────────────────────────────────────────

const SQRT_LIMIT = 10n ** 12n;

/** √N = k·√m (m без квадратов); null — число слишком велико (ответ «некрасивый»). */
export function sqrtParts(N) {
  if (N < 0n) return null;
  if (N > SQRT_LIMIT) return null;
  let k = 1n;
  let m = N;
  for (let p = 2n; p * p <= m; p += 1n) {
    while (m % (p * p) === 0n) { m /= p * p; k *= p; }
  }
  return { k, m };
}

/** Часть без квадратов у целого (для единиц оси решётки). */
export function squarefree(N) {
  return sqrtParts(BigInt(N))?.m ?? null;
}

/**
 * √(r) для рационального r ≥ 0: { k, m, q } — значение k√m / q.
 * null — r < 0 или числа слишком велики.
 */
export function sqrtQ(r) {
  if (r.n < 0n) return null;
  if (r.n === 0n) return { k: 0n, m: 1n, q: 1n };
  const parts = sqrtParts(r.n * r.d);
  if (!parts) return null;
  const g = bgcd(parts.k, r.d);
  return { k: parts.k / g, m: parts.m, q: r.d / g };
}

/** Число k√m/q в LaTeX; sign — знак перед ним. */
export function surdLatex(s, { sign = 1, frac = 'dfrac' } = {}) {
  if (!s) return '?';
  if (s.k === 0n) return '0';
  const minus = sign < 0 ? '-' : '';
  const root = s.m === 1n ? '' : `\\sqrt{${s.m}}`;
  const num = s.m === 1n ? `${s.k}` : `${s.k === 1n ? '' : s.k}${root}`;
  if (s.q === 1n) return `${minus}${num}`;
  return `${minus}\\${frac}{${num}}{${s.q}}`;
}

export const surdValue = (s) => (Number(s.k) * Math.sqrt(Number(s.m))) / Number(s.q);

/** «Сложность» записи k√m/q — сумма длин чисел (1 не пишется). */
export function surdComplexity(s) {
  if (!s) return Infinity;
  const w = (x) => (x === 1n ? 0 : String(x).length);
  return w(s.k) + w(s.m) * 1.5 + w(s.q);
}

// ─── векторы решётки ─────────────────────────────────────────────────────

export const vadd = (u, v) => u.map((x, i) => qadd(x, v[i]));
export const vsub = (u, v) => u.map((x, i) => qsub(x, v[i]));
export const vscale = (u, k) => u.map((x) => qmul(x, k));
export const vzero = (u) => u.every(qzero);
export const veq = (u, v) => u.every((x, i) => qeq(x, v[i]));

/** Скалярное произведение в метрике решётки: Σ g·u·v. */
export const ldot = (g, u, v) => u.reduce((acc, x, i) => qadd(acc, qmul(qmul(x, v[i]), Q(g[i]))), ZERO);
export const lnorm2 = (g, u) => ldot(g, u, u);

/** Векторное произведение коэффициентов (не настоящих координат). */
export const ccross = (u, v) => [
  qsub(qmul(u[1], v[2]), qmul(u[2], v[1])),
  qsub(qmul(u[2], v[0]), qmul(u[0], v[2])),
  qsub(qmul(u[0], v[1]), qmul(u[1], v[0])),
];

/** Определитель тройки коэффициентов (ноль ⇔ векторы компланарны). */
export const cdet = (u, v, w) => ldot([1, 1, 1], ccross(u, v), w);

/** Нормаль плоскости векторов u, v — в той же решётке: G⁻¹(u×v). */
export const lnormal = (g, u, v) => ccross(u, v).map((c, i) => qdiv(c, Q(g[i])));

/** u ∥ v (или один из них нулевой). */
export const vparallel = (u, v) => vzero(ccross(u, v));

/** Настоящие координаты (для упорядочивания, сверки с моделью). */
export const vreal = (g, u) => u.map((x, i) => qnum(x) * Math.sqrt(Number(g[i])));

/** Коэффициенты, умноженные на рациональное так, чтобы стать взаимно простыми целыми. */
export function vprimitive(u, { positive = false } = {}) {
  let l = 1n;
  for (const x of u) l = (l / bgcd(l, x.d)) * x.d;
  let ints = u.map((x) => (x.n * l) / x.d);
  let g = 0n;
  for (const x of ints) g = g === 0n ? (x < 0n ? -x : x) : bgcd(g, x);
  if (g > 1n) ints = ints.map((x) => x / g);
  if (positive) {
    const lead = ints.find((x) => x !== 0n);
    if (lead < 0n) ints = ints.map((x) => -x);
  }
  return ints.map((x) => Q(x));
}

/** Площадь² многоугольника решётки (вершины по порядку обхода). */
export function polygonArea2(g, pts) {
  let N = [ZERO, ZERO, ZERO];
  for (let i = 0; i < pts.length; i += 1) N = vadd(N, ccross(pts[i], pts[(i + 1) % pts.length]));
  const detG = Q(BigInt(g[0]) * BigInt(g[1]) * BigInt(g[2]));
  const s = N.reduce((acc, c, i) => qadd(acc, qdiv(qmul(c, c), Q(g[i]))), ZERO);
  return qdiv(qmul(detG, s), Q(4));
}

/** Объём² тетраэдра решётки: (det² · det G) / 36. */
export function tetraVolume2(g, A, B, C, D) {
  const det = cdet(vsub(B, A), vsub(C, A), vsub(D, A));
  const detG = Q(BigInt(g[0]) * BigInt(g[1]) * BigInt(g[2]));
  return qdiv(qmul(qmul(det, det), detG), Q(36));
}

// ─── запись в LaTeX ──────────────────────────────────────────────────────

/** Координата q·√g: «2\sqrt{3}», «-\frac{\sqrt{3}}{2}», «\frac{5}{2}». */
export function coordLatex(q, g) {
  const gg = BigInt(g);
  if (qzero(q)) return '0';
  if (gg === 1n) return qLatex(q);
  const sign = q.n < 0n ? '-' : '';
  const n = q.n < 0n ? -q.n : q.n;
  const num = `${n === 1n ? '' : n}\\sqrt{${gg}}`;
  return q.d === 1n ? `${sign}${num}` : `${sign}\\frac{${num}}{${q.d}}`;
}

/** Вектор/точка «(1;\,0;\,-2)» в настоящих координатах. */
export function vecLatex(u, g) {
  return `\\left(${u.map((x, i) => coordLatex(x, g[i])).join(';\\,')}\\right)`;
}

/** Длина √(r) в LaTeX (для промежуточных выкладок). */
export function lengthLatex(r, opts) {
  return surdLatex(sqrtQ(r), opts);
}
