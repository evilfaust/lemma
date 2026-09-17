// Кривая по опорным точкам — график «как в ЕГЭ», его производная и первообразная.
//
// Графики из задач на производную — не формулы: учитель мыслит точками
// («максимум в (−3; 2), минимум в (1; −1)»). Подбирать под это многочлен
// неудобно, поэтому кривая строится сплайном через заданные точки.
//
// Два требования, из-за которых сплайн свой, а не кубический из учебника:
//   1. Никаких лишних горбов. Между соседними точками кривая МОНОТОННА, значит
//      экстремумы стоят ровно в тех точках, где их поставил учитель, и ответы к
//      задаче («сколько точек максимума», «где f′ > 0») вычисляются точно.
//      Обычный кубический сплайн проскакивает и рисует экстремумы, которых нет.
//   2. Гладкая производная. У монотонного КУБИЧЕСКОГО сплайна (PCHIP) f″ рвётся
//      в узлах — на графике f′ это видно как излом. Поэтому кусок — многочлен
//      5-й степени с общими в узле f, f′ и f″: f′ получается гладкой (C¹).
//
// Как строится кусок [xᵢ; xᵢ₊₁] (t ∈ [0; 1], h — длина, Δ — приращение):
//   G(t) = h·f′ — многочлен 4-й степени = кубический эрмитов (значения h·mᵢ,
//   производные h²·aᵢ на концах) + c·t²(1−t)², где c подобрано так, чтобы
//   ∫₀¹G = Δ (кривая приходит в следующую точку). Монотонность = G не меняет
//   знак внутри куска; это проверяется численно, при нарушении наклоны и
//   кривизны в концах куска ужимаются (в пределе G = 30Δ·t²(1−t)² — заведомо
//   монотонный кусок).
//
// API:
//   buildSpline(nodes)         → сплайн { ok, error, nodes, domain, f, df, d2f, integral }
//   antiderivative(s, x0, y0)  → { fn, dfn } первообразная F: F(x0) = y0, F′ = f
//   splineZeros(s)             → нули f с типом смены знака (для первообразной)
//   splineAnalysis(s)          → экстремумы, промежутки монотонности, нули
//
// Узел: { x, y, flat?, slope? } — flat: f′ = 0 без смены знака (стационарная
// точка — «перегиб с горизонтальной касательной»); slope: заданный наклон
// касательной (задачи «найдите f′(x₀) по касательной»).

const EPS = 1e-9;
const SAMPLES = 96;
const MAX_REPAIR = 80;

const sgn = (v) => (v > EPS ? 1 : v < -EPS ? -1 : 0);

// ───────────────────────────── многочлены ─────────────────────────────

const polyAt = (c, t) => {
  let v = 0;
  for (let k = c.length - 1; k >= 0; k -= 1) v = v * t + c[k];
  return v;
};

const polyDer = (c) => c.slice(1).map((v, k) => v * (k + 1));

// Коэффициенты G(t) в степенном базисе.
function pieceCoeffs(h, delta, m0, a0, m1, a1) {
  const p0 = m0 * h; const q0 = a0 * h * h;
  const p1 = m1 * h; const q1 = a1 * h * h;
  // ∫₀¹ эрмитова кубика: p0/2 + q0/12 + p1/2 − q1/12; ∫₀¹ t²(1−t)² = 1/30
  const c = 30 * (delta - (p0 / 2 + q0 / 12 + p1 / 2 - q1 / 12));
  return [
    p0,
    q0,
    -3 * p0 - 2 * q0 + 3 * p1 - q1 + c,
    2 * p0 + q0 - 2 * p1 + q1 - 2 * c,
    c,
  ];
}

// Кусок годится: G строго сохраняет знак Δ внутри и у f′ не больше одного
// локального экстремума (без «волны» на графике производной).
function pieceOk(g, delta) {
  const s = sgn(delta);
  if (s === 0) return g.every((v) => Math.abs(v) < EPS);
  const tol = 1e-7 * Math.abs(delta);
  let prev = polyAt(g, 0);
  let prevDir = 0;
  let turns = 0;
  for (let k = 1; k < SAMPLES; k += 1) {
    const v = polyAt(g, k / SAMPLES);
    if (v * s <= tol) return false;
    const dir = sgn(v - prev);
    if (dir && prevDir && dir !== prevDir) turns += 1;
    if (dir) prevDir = dir;
    prev = v;
  }
  return turns <= 1;
}

// ───────────────────────────── построение ─────────────────────────────

function normalizeNodes(nodes) {
  const list = (Array.isArray(nodes) ? nodes : [])
    .map((n) => ({
      x: Number(n?.x),
      y: Number(n?.y),
      flat: !!n?.flat,
      slope: Number.isFinite(n?.slope) ? Number(n.slope) : null,
    }))
    .filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y))
    .sort((a, b) => a.x - b.x);
  if (list.length < 2) return { error: 'Нужны хотя бы две точки' };
  for (let i = 1; i < list.length; i += 1) {
    if (list[i].x - list[i - 1].x < EPS) {
      return { error: `Две точки с одинаковым x = ${list[i].x}` };
    }
  }
  return { list };
}

/**
 * Наклоны C²-кубического сплайна: в каждой незакреплённой внутренней точке
 * f″ слева = f″ справа, на краях — f″ постоянна на крайнем куске (кривая
 * «продолжается» за рамку, а не выпрямляется). Закреплённые берутся из `m`.
 * Трёхдиагональная система, метод прогонки.
 */
function smoothSlopes(h, d, pinned, m) {
  const n = h.length + 1;
  const sub = new Array(n).fill(0);
  const diag = new Array(n).fill(1);
  const sup = new Array(n).fill(0);
  const rhs = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    if (pinned[i]) { rhs[i] = m[i]; continue; }
    if (i === 0) { sup[i] = 1; rhs[i] = 2 * d[0]; continue; }
    if (i === n - 1) { sub[i] = 1; rhs[i] = 2 * d[n - 2]; continue; }
    sub[i] = h[i];
    diag[i] = 2 * (h[i - 1] + h[i]);
    sup[i] = h[i - 1];
    rhs[i] = 3 * (h[i] * d[i - 1] + h[i - 1] * d[i]);
  }
  for (let i = 1; i < n; i += 1) {
    const k = sub[i] / diag[i - 1];
    diag[i] -= k * sup[i - 1];
    rhs[i] -= k * rhs[i - 1];
  }
  const out = new Array(n).fill(0);
  out[n - 1] = rhs[n - 1] / diag[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) out[i] = (rhs[i] - sup[i] * out[i + 1]) / diag[i];
  return out;
}

// Допустимый наклон незакреплённой точки: знак соседних секущих и потолок
// 2·min. `soft` — на случай, когда гладкий сплайн дал неверный знак.
function monotoneLimit(i, n, d) {
  const near = i === 0 ? [d[0]] : i === n - 1 ? [d[n - 2]] : [d[i - 1], d[i]];
  const least = Math.min(...near.map(Math.abs));
  return { sign: sgn(near[near.length - 1]), max: 2 * least, soft: 0.5 * least };
}

const failure = (error) => ({
  ok: false, error, warning: null, nodes: [], domain: null,
  f: () => NaN, df: () => NaN, d2f: () => NaN, integral: () => NaN,
});

/**
 * Построить сплайн через опорные точки.
 * @param {Array<{x:number,y:number,flat?:boolean,slope?:number}>} nodes
 */
export function buildSpline(nodes) {
  const { list, error } = normalizeNodes(nodes);
  if (error) return failure(error);

  const n = list.length;
  const xs = list.map((p) => p.x);
  const ys = list.map((p) => p.y);
  const h = []; const dl = []; const d = [];
  for (let i = 0; i < n - 1; i += 1) {
    h.push(xs[i + 1] - xs[i]);
    dl.push(ys[i + 1] - ys[i]);
    d.push(dl[i] / h[i]);
  }

  // Тип узла: экстремум (смена знака приращения), стационарная точка (flat),
  // точка на полке (соседний кусок горизонтален), проходная, крайняя.
  const kind = list.map((p, i) => {
    if (i === 0 || i === n - 1) return 'end';
    const s = sgn(dl[i - 1]) * sgn(dl[i]);
    if (s < 0) return dl[i - 1] > 0 ? 'max' : 'min';
    if (s === 0) return 'plateau';
    return p.flat ? 'flat' : 'pass';
  });

  // 1) Наклоны. Экстремум, полка, flat — ноль; заданный slope — как задан.
  //    Остальные — из гладкого C²-сплайна через те же точки (иначе кривая
  //    «ступенчатая»: осторожные наклоны PCHIP дают полочки у каждой точки и
  //    волну на f′), затем фильтр монотонности: наклон того же знака, что
  //    соседние секущие, и не круче 2·min — при 3·min (фильтр Хаймана)
  //    соседний экстремум получает f″ = 0 и f′ лишь касается оси.
  const m = new Array(n).fill(0);
  const fixedM = new Array(n).fill(false);
  for (let i = 0; i < n; i += 1) {
    if (n === 2) { m[i] = d[0]; fixedM[i] = true; continue; }
    if (kind[i] === 'max' || kind[i] === 'min' || kind[i] === 'plateau' || kind[i] === 'flat') fixedM[i] = true;
    if (list[i].slope !== null && kind[i] !== 'max' && kind[i] !== 'min') {
      m[i] = list[i].slope;
      fixedM[i] = true;
    }
  }
  // Край, примыкающий к полке, тоже горизонтален.
  if (n > 2) {
    if (sgn(dl[0]) === 0) { m[0] = 0; fixedM[0] = true; }
    if (sgn(dl[n - 2]) === 0) { m[n - 1] = 0; fixedM[n - 1] = true; }
  }
  if (n > 2) {
    const pinned = fixedM.slice();
    for (let iter = 0; iter <= n; iter += 1) {
      const sol = smoothSlopes(h, d, pinned, m);
      let clamped = false;
      for (let i = 0; i < n; i += 1) {
        if (pinned[i]) continue;
        const lim = monotoneLimit(i, n, d);
        const v = sol[i];
        if (sgn(v) !== lim.sign) {
          m[i] = lim.sign * lim.soft; pinned[i] = true; clamped = true;
        } else if (Math.abs(v) > lim.max) {
          m[i] = lim.sign * lim.max; pinned[i] = true; clamped = true;
        } else {
          m[i] = v;
        }
      }
      if (!clamped) break;
    }
  }

  // 2) Кривизны f″ в узлах. Отправная точка — f″ кубических эрмитовых кусков
  //    по обе стороны узла: L — в левом конце куска, R — в правом.
  const cubicL = (i) => (6 * d[i] - 4 * m[i] - 2 * m[i + 1]) / h[i];
  const cubicR = (i) => (-6 * d[i] + 2 * m[i] + 4 * m[i + 1]) / h[i];
  const a = new Array(n).fill(0);
  const fixedA = new Array(n).fill(false);
  for (let i = 0; i < n; i += 1) {
    if (n === 2) { fixedA[i] = true; continue; }
    const k = kind[i];
    if (k === 'plateau' || k === 'flat') { fixedA[i] = true; continue; }
    if (i === 0) { a[i] = sgn(dl[0]) ? cubicL(0) : 0; continue; }
    if (i === n - 1) { a[i] = sgn(dl[n - 2]) ? cubicR(n - 2) : 0; continue; }
    const left = cubicR(i - 1);
    const right = cubicL(i);
    if (k === 'max' || k === 'min') {
      // Меньшая из двух кривизн: каждому куску достаётся не больше, чем его
      // собственной кубике, — тогда f′ на куске одногорбая, без «волны».
      const sign = k === 'max' ? -1 : 1;
      a[i] = sign * Math.min(Math.abs(left), Math.abs(right));
    } else {
      a[i] = (left + right) / 2;
    }
  }

  // 3) Сборка кусков с починкой: ужимаем наклоны/кривизны на концах негодных.
  const build = () => h.map((hi, i) => pieceCoeffs(hi, dl[i], m[i], a[i], m[i + 1], a[i + 1]));
  let g = build();
  let bad = g.map((c, i) => (pieceOk(c, dl[i]) ? -1 : i)).filter((i) => i >= 0);
  for (let iter = 0; bad.length && iter < MAX_REPAIR; iter += 1) {
    for (const i of bad) {
      for (const j of [i, i + 1]) {
        if (!fixedA[j]) a[j] *= 0.8;
        if (!fixedM[j]) m[j] *= 0.92;
      }
    }
    g = build();
    bad = g.map((c, i) => (pieceOk(c, dl[i]) ? -1 : i)).filter((i) => i >= 0);
  }
  let warning = null;
  for (let iter = 0; bad.length && iter < n; iter += 1) {
    // Крайняя мера: горизонтальные касательные на концах негодного куска.
    for (const i of bad) {
      for (const j of [i, i + 1]) {
        if (!fixedA[j]) a[j] = 0;
        if (!fixedM[j]) m[j] = 0;
      }
    }
    g = build();
    bad = g.map((c, i) => (pieceOk(c, dl[i]) ? -1 : i)).filter((i) => i >= 0);
    warning = 'Точки стоят слишком круто — часть наклонов сглажена';
  }
  if (bad.length) {
    warning = 'Заданный наклон не даёт провести монотонную кривую между точками';
  }

  // 4) Интеграл f от левого края до каждого узла — для первообразной.
  const F = g.map((c) => [0, ...c.map((v, k) => v / (k + 1))]); // F(t), F(0) = 0
  const P = F.map((c, i) => [0, ys[i], ...c.slice(1).map((v, k) => v / (k + 2))]); // ∫₀ᵗ f dt / h
  const acc = [0];
  for (let i = 0; i < n - 1; i += 1) acc.push(acc[i] + h[i] * polyAt(P[i], 1));

  const x0 = xs[0]; const x1 = xs[n - 1];
  const locate = (x) => {
    if (!(x >= x0 - EPS && x <= x1 + EPS)) return -1;
    let lo = 0; let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= x) lo = mid; else hi = mid - 1;
    }
    return lo;
  };
  const tOf = (i, x) => Math.min(Math.max((x - xs[i]) / h[i], 0), 1);

  const dg = g.map(polyDer);

  return {
    ok: true,
    error: null,
    warning,
    nodes: list.map((p, i) => ({ x: p.x, y: p.y, slope: m[i], curv: a[i], kind: kind[i] })),
    domain: [x0, x1],
    f(x) {
      const i = locate(x);
      return i < 0 ? NaN : ys[i] + polyAt(F[i], tOf(i, x));
    },
    df(x) {
      const i = locate(x);
      return i < 0 ? NaN : polyAt(g[i], tOf(i, x)) / h[i];
    },
    d2f(x) {
      const i = locate(x);
      return i < 0 ? NaN : polyAt(dg[i], tOf(i, x)) / (h[i] * h[i]);
    },
    /** ∫ от левого края до x */
    integral(x) {
      const i = locate(x);
      return i < 0 ? NaN : acc[i] + h[i] * polyAt(P[i], tOf(i, x));
    },
  };
}

/**
 * Первообразная F сплайна: F′ = f, F(x0) = y0 (по умолчанию F(левый край) = 0).
 */
export function antiderivative(spline, x0, y0 = 0) {
  if (!spline?.ok) return { fn: () => NaN, dfn: () => NaN };
  const base = Number.isFinite(x0) ? spline.integral(x0) : 0;
  const shift = (Number.isFinite(y0) ? y0 : 0) - (Number.isFinite(base) ? base : 0);
  return {
    fn: (x) => spline.integral(x) + shift,
    dfn: (x) => spline.f(x),
  };
}

// ───────────────────────────── разбор графика ─────────────────────────────

const round = (v) => Math.round(v * 1e9) / 1e9;

/**
 * Нули f на области. На каждом куске f монотонна → не больше одного корня.
 * type: 'up' (− → +), 'down' (+ → −), 'touch' (касание без смены знака).
 */
export function splineZeros(spline) {
  if (!spline?.ok) return [];
  const { nodes } = spline;
  const out = [];
  // Знак соседа берём в середине куска: кусок монотонный, второго нуля на нём
  // нет, а вплотную к стационарной точке f ≈ 0 до шума округления.
  const signOn = (i, j) => sgn(spline.f((nodes[i].x + nodes[j].x) / 2));
  for (let i = 0; i < nodes.length; i += 1) {
    const p = nodes[i];
    if (Math.abs(p.y) < EPS) {
      const l = i > 0 ? signOn(i - 1, i) : 0;
      const r = i < nodes.length - 1 ? signOn(i, i + 1) : 0;
      const type = l < 0 && r > 0 ? 'up' : l > 0 && r < 0 ? 'down' : 'touch';
      out.push({ x: p.x, type, atEdge: i === 0 || i === nodes.length - 1 });
    }
    if (i < nodes.length - 1) {
      const q = nodes[i + 1];
      if (sgn(p.y) * sgn(q.y) < 0) {
        let lo = p.x; let hi = q.x;
        for (let k = 0; k < 80; k += 1) {
          const mid = (lo + hi) / 2;
          if (sgn(spline.f(mid)) === sgn(p.y)) lo = mid; else hi = mid;
        }
        out.push({ x: round((lo + hi) / 2), type: p.y < 0 ? 'up' : 'down', atEdge: false });
      }
    }
  }
  return out;
}

/**
 * Что можно прочитать по графику f: точки экстремума, стационарные точки,
 * промежутки возрастания/убывания (концы включены, как пишут в ответах ЕГЭ),
 * нули f.
 */
export function splineAnalysis(spline) {
  if (!spline?.ok) {
    return { maxima: [], minima: [], stationary: [], increasing: [], decreasing: [], zeros: [] };
  }
  const { nodes } = spline;
  const pick = (k) => nodes.filter((p) => p.kind === k).map(({ x, y }) => ({ x, y }));
  const increasing = [];
  const decreasing = [];
  let runStart = null;
  let runDir = 0;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const dir = sgn(nodes[i + 1].y - nodes[i].y);
    if (dir !== runDir) {
      if (runDir > 0) increasing.push([runStart, nodes[i].x]);
      if (runDir < 0) decreasing.push([runStart, nodes[i].x]);
      runStart = nodes[i].x;
      runDir = dir;
    }
  }
  const last = nodes[nodes.length - 1].x;
  if (runDir > 0) increasing.push([runStart, last]);
  if (runDir < 0) decreasing.push([runStart, last]);

  return {
    maxima: pick('max'),
    minima: pick('min'),
    stationary: pick('flat'),
    increasing,
    decreasing,
    zeros: splineZeros(spline),
  };
}
