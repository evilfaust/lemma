// Тела для стереочертежей — многогранники школьного курса (Атанасян, гл. III):
// куб, параллелепипед (прямоугольный, прямой, наклонный), призма (прямая и
// наклонная, основание правильное или произвольное), пирамида (вершина над
// центром, над вершиной или серединой ребра основания, смещённая), усечённая
// пирамида, тетраэдр (правильный и произвольный).
//
// Все тела выпуклые — на этом держатся сечение (плоскость ∩ рёбра) и
// видимость (луч к зрителю ∩ полупространства граней). Призма = выпуклый
// многоугольник + сдвиг, пирамида = конус над выпуклым многоугольником —
// выпуклость сохраняется при любом наклоне.
//
// Мир: z — вверх, тело центрировано в начале координат (удобно вращать).
// Ракурс «спереди» — со стороны −y, поэтому у оснований ребро AB — переднее.
// Имена вершин верхнего основания — с цифрой: A1 (подпись A₁).

import { v3, sub, cross, dot, len, mul, centroid, dist } from './vec3';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L'];

export const BODY_KINDS = {
  cube: { label: 'Куб' },
  box: { label: 'Параллелепипед' },
  prism: { label: 'Призма' },
  pyramid: { label: 'Пирамида' },
  frustum: { label: 'Усечённая пирамида' },
  tetra: { label: 'Тетраэдр' },
};

/**
 * Основания призм и пирамид. n — число сторон (null — любое из ns).
 * word — слово в блоке ```stereo, label — в форме редактора.
 */
export const BASE_SHAPES = {
  regular: { label: 'правильный многоугольник', ns: [3, 4, 5, 6, 7, 8] },
  free: { label: 'произвольный', word: 'произвольное', ns: [3, 4, 5, 6] },
  right: { label: 'прямоугольный треугольник (∠C = 90°)', word: 'прямоугольный', ns: [3] },
  isosceles: { label: 'равнобедренный треугольник (AC = BC)', word: 'равнобедренный', ns: [3] },
  rect: { label: 'прямоугольник', word: 'прямоугольник', ns: [4] },
  parallelogram: { label: 'параллелограмм', word: 'параллелограмм', ns: [4] },
  rhombus: { label: 'ромб', word: 'ромб', ns: [4] },
  trapezoid: { label: 'трапеция (AD ∥ BC)', word: 'трапеция', ns: [4] },
};

/** Основания параллелепипеда (у него всегда параллелограмм). */
export const BOX_BASES = ['rect', 'parallelogram', 'rhombus'];

/** Направления наклона: азимут сдвига верхнего основания, 0° — вправо. */
export const TILT_DIRS = { вправо: 0, назад: 90, влево: 180, вперёд: 270 };
export const DEFAULT_TILT_DIR = 30;

export const DEFAULT_BODY = { kind: 'cube', a: 4 };

/** Правильный n-угольник со стороной a в плоскости z, ребро 0–1 — переднее. */
function regularPolygon(n, a, z) {
  const R = a / (2 * Math.sin(Math.PI / n));
  const out = [];
  for (let k = 0; k < n; k++) {
    const phi = -Math.PI / 2 - Math.PI / n + (2 * Math.PI * k) / n;
    out.push(v3(R * Math.cos(phi), R * Math.sin(phi), z));
  }
  return out;
}

function rectangle(a, b, z) {
  return [v3(-a / 2, -b / 2, z), v3(a / 2, -b / 2, z), v3(a / 2, b / 2, z), v3(-a / 2, b / 2, z)];
}

// Произвольные основания «как в учебнике»: выпуклые, без симметрий, обход
// против часовой, AB = 1 (масштаб — по ребру a).
const FREE_SHAPES = {
  3: [[0, 0.5], [0.7, 0], [1.4, 0.7]],
  4: [[0, 0.35], [1, 0], [1.3, 0.9], [0.2, 0.8]],
  5: [[0, 0], [1, 0], [1.4, 0.55], [0.8, 1.05], [-0.35, 0.75]],
  6: [[0, 0], [1, 0], [1.5, 0.5], [1.2, 1.1], [0.2, 1.15], [-0.4, 0.6]],
};

/** Плоские вершины основания (против часовой, AB = a где это определено). */
function shapePoints(base, n, a, b) {
  const COS60 = 0.5;
  const SIN60 = Math.sqrt(3) / 2;
  switch (base) {
    case 'right': return [[0, 0], [a, 0], [0.36 * a, 0.48 * a]];
    case 'isosceles': return [[0, 0], [a, 0], [0.5 * a, 0.6 * a]];
    case 'rect': return [[0, 0], [a, 0], [a, b], [0, b]];
    case 'parallelogram':
    case 'rhombus': {
      const s = base === 'rhombus' ? a : b;
      return [[0, 0], [a, 0], [a + s * COS60, s * SIN60], [s * COS60, s * SIN60]];
    }
    // Основания трапеции — AD (= a) и BC (= a/2), как принято в задачах.
    case 'trapezoid': return [[0, 0], [0.6 * a, 0.15 * a], [0.6 * a, 0.65 * a], [0, a]];
    case 'free': {
      const raw = FREE_SHAPES[n] || FREE_SHAPES[4];
      const k = a / Math.hypot(raw[1][0] - raw[0][0], raw[1][1] - raw[0][1]);
      return raw.map(([x, y]) => [x * k, y * k]);
    }
    default: return null;
  }
}

/** Ориентированная площадь (>0 — против часовой) и строгая выпуклость. */
function polyArea(pts) {
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; });
  return s / 2;
}
function isConvex(pts) {
  const n = pts.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % n];
    const [cx, cy] = pts[(i + 2) % n];
    const c = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(c) < 1e-9) return false;
    if (!sign) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return Math.abs(polyArea(pts)) > 1e-9;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Своё основание: [[x, y], …] — выпуклый многоугольник из 3–8 вершин, иначе null. */
function normalizePoly(poly) {
  if (!Array.isArray(poly) || poly.length < 3 || poly.length > 8) return null;
  const pts = poly.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p?.x), Number(p?.y)]));
  if (!pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return null;
  return isConvex(pts) ? pts : null;
}

/** Наклон бокового ребра к основанию, ° (90 — прямая призма). */
function normalizeTilt(spec, out) {
  const t = Number(spec?.tilt);
  if (Number.isFinite(t) && t >= 15 && t < 89.5) {
    out.tilt = Math.round(t * 10) / 10;
    const d = Number(spec?.dir);
    out.dir = Number.isFinite(d) ? ((Math.round(d) % 360) + 360) % 360 : DEFAULT_TILT_DIR;
  }
}

/** Куда проектируется вершина пирамиды: over — вершина [i] или середина ребра [i, i+1]; shift — сдвиг. */
function normalizeApexPos(spec, out, n) {
  const over = Array.isArray(spec?.over) ? spec.over.map(Number) : null;
  if (over && over.length >= 1 && over.length <= 2 && over.every((i) => Number.isInteger(i) && i >= 0 && i < n)) {
    if (over.length === 1 || (over[1] === (over[0] + 1) % n || over[0] === (over[1] + 1) % n)) {
      out.over = over.length === 2 && over[0] === (over[1] + 1) % n ? [over[1], over[0]] : over;
    }
  }
  const sh = spec?.shift;
  if (Array.isArray(sh) && sh.length === 2 && sh.every((x) => Number.isFinite(Number(x)))
    && (Number(sh[0]) || Number(sh[1]))) {
    out.shift = [Number(sh[0]), Number(sh[1])];
  }
}

/** Основание призмы/пирамиды: base (не regular) + n; своё — poly. */
function normalizeBase(spec, out, defaultN) {
  const poly = normalizePoly(spec?.poly);
  if (poly) {
    out.base = 'poly';
    out.poly = poly;
    out.n = poly.length;
    return;
  }
  const base = BASE_SHAPES[spec?.base] && spec.base !== 'regular' ? spec.base : 'regular';
  const ns = BASE_SHAPES[base].ns;
  const n = ns.includes(Number(spec?.n)) ? Number(spec.n) : (ns.includes(defaultN) ? defaultN : ns[0]);
  out.n = n;
  if (base !== 'regular') out.base = base;
  if (base === 'rect' || base === 'parallelogram') out.b = num(spec?.b, Math.round(out.a * 7) / 10);
}

/** Нормализованное описание тела: подставляет значения по умолчанию. */
export const POINT_NAME_RE = /^[A-Z][0-9]*$/;

/**
 * Нормализованное описание тела: подставляет значения по умолчанию.
 * names — свои имена вершин (по порядку buildBody: основание, верх/вершина),
 * например куб KLMNK1L1M1N1; проверяются в buildBody по числу вершин.
 */
export function normalizeBodySpec(spec = DEFAULT_BODY) {
  const out = normalizeBodyShape(spec);
  // Буквы основания по часовой стрелке (если смотреть сверху): A — спереди
  // слева, B — сзади слева… Так в части учебников (Атанасян). Без флага — против.
  // У своего основания (poly) порядок задают сами координаты.
  if (spec?.cw && out.base !== 'poly') out.cw = true;
  const names = spec?.names;
  if (Array.isArray(names) && names.length && names.every((n) => POINT_NAME_RE.test(n))
    && new Set(names).size === names.length) {
    out.names = [...names];
  }
  return out;
}

function normalizeBodyShape(spec) {
  const kind = BODY_KINDS[spec?.kind] ? spec.kind : 'cube';
  const a = num(spec?.a, 4);
  switch (kind) {
    case 'cube':
      return { kind, a };
    case 'box': {
      const out = { kind, a, b: num(spec.b, a * 0.75), c: num(spec.c, a * 0.9) };
      if (BOX_BASES.includes(spec.base) && spec.base !== 'rect') out.base = spec.base;
      normalizeTilt(spec, out);
      return out;
    }
    case 'prism': {
      const out = { kind, a };
      normalizeBase(spec, out, 3);
      out.h = num(spec.h, a * 1.2);
      normalizeTilt(spec, out);
      return reorder(out, ['kind', 'n', 'a', 'h']);
    }
    case 'pyramid': {
      const out = { kind, a };
      normalizeBase(spec, out, 4);
      out.h = num(spec.h, a * 1.1);
      out.apex = /^[A-Z]$/.test(spec.apex || '') ? spec.apex : 'S';
      normalizeApexPos(spec, out, out.n);
      return reorder(out, ['kind', 'n', 'a', 'h', 'apex']);
    }
    case 'frustum': {
      const out = { kind, a };
      normalizeBase(spec, out, 4);
      out.h = num(spec.h, a * 0.6);
      const k = Number(spec.k);
      out.k = Number.isFinite(k) && k >= 0.1 && k <= 0.9 ? Math.round(k * 100) / 100 : 0.5;
      normalizeApexPos(spec, out, out.n);
      return reorder(out, ['kind', 'n', 'a', 'h', 'k']);
    }
    case 'tetra': {
      const apex = /^[A-Z]$/.test(spec.apex || '') ? spec.apex : 'D';
      const out = { kind, a, apex };
      // Произвольный тетраэдр: основание — произвольный треугольник и/или
      // вершина не над центром. Высота тогда своя.
      if (spec.base === 'free' || spec.base === 'right' || spec.base === 'isosceles') out.base = spec.base;
      normalizeApexPos(spec, out, 3);
      if (out.base || out.over || out.shift) out.h = num(spec.h, a * 0.9);
      return out;
    }
    default:
      return { kind: 'cube', a };
  }
}

function reorder(obj, first) {
  const out = {};
  for (const k of first) if (k in obj) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/** Человеческое имя тела: «Куб ABCDA₁B₁C₁D₁». */
export function bodyTitle(spec) {
  const s = normalizeBodySpec(spec);
  const body = buildBody(s);
  const names = body.order.map(prettyName).join('');
  switch (s.kind) {
    case 'cube': return `Куб ${names}`;
    case 'box': return `${s.tilt ? 'Наклонный параллелепипед' : 'Параллелепипед'} ${names}`;
    case 'prism': return `${s.tilt ? 'Наклонная призма' : 'Призма'} ${names}`;
    case 'pyramid': {
      const apex = body.order[body.order.length - 1];
      return `Пирамида ${prettyName(apex)}${body.order.slice(0, -1).map(prettyName).join('')}`;
    }
    case 'frustum': return `Усечённая пирамида ${names}`;
    case 'tetra': {
      if (!s.h) return `Тетраэдр ${names}`;
      const apex = body.order[body.order.length - 1];
      return `Тетраэдр ${prettyName(apex)}${body.order.slice(0, -1).map(prettyName).join('')}`;
    }
    default: return names;
  }
}

/** «A1» → «A₁» (для текста, не для SVG). */
export function prettyName(name) {
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  return String(name).replace(/\d/g, (d) => SUB[Number(d)]);
}

/** Буквы основания: без имени вершины пирамиды. */
export function baseLetters(n, apexName = null) {
  return LETTERS.filter((l) => l !== apexName).slice(0, n);
}

/**
 * Плоское основание (z не задан): точки против часовой (или по часовой при cw),
 * центр масс вершин — в начале координат.
 */
function basePlane(spec, n) {
  let pts;
  if (spec.base === 'poly') pts = spec.poly.map(([x, y]) => [x, y]);
  else if (spec.base && spec.base !== 'regular') pts = shapePoints(spec.base, n, spec.a, spec.b);
  if (!pts) {
    // Правильный: обход по часовой — тот же многоугольник, A на месте.
    let reg = regularPolygon(n, spec.a, 0).map((p) => [p.x, p.y]);
    if (spec.cw) reg = [reg[0], ...reg.slice(1).reverse()];
    return reg;
  }
  // По часовой: у произвольного основания — тот же многоугольник, буквы в
  // другую сторону (A на месте); у особых (трапеция, параллелограмм…) — зеркало
  // через диагональ, чтобы стороны AB, AD, BC оставались собой, а A — спереди слева.
  if (spec.cw) {
    pts = spec.base === 'free'
      ? [pts[0], ...pts.slice(1).reverse()]
      : pts.map(([x, y]) => [y, x]);
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [x - cx, y - cy]);
}

/** Проекция вершины пирамиды на плоскость основания. */
function apexFoot(spec, base) {
  let p = [0, 0];
  if (spec.over?.length === 1) p = base[spec.over[0]];
  else if (spec.over?.length === 2) {
    const [i, j] = spec.over;
    p = [(base[i][0] + base[j][0]) / 2, (base[i][1] + base[j][1]) / 2];
  }
  if (spec.shift) p = [p[0] + spec.shift[0], p[1] + spec.shift[1]];
  return p;
}

/** Сдвиг верхнего основания наклонной призмы. */
function tiltShift(spec, h) {
  if (!spec.tilt) return [0, 0];
  const d = h / Math.tan((spec.tilt * Math.PI) / 180);
  const phi = (spec.dir * Math.PI) / 180;
  return [d * Math.cos(phi), d * Math.sin(phi)];
}

/**
 * Строит тело: вершины, рёбра, грани с внешними нормалями.
 * @returns {{ spec, vertices: Record<string,{x,y,z}>, order: string[],
 *   edges: [string,string][], faces: {id:string, verts:string[], n:{x,y,z}, d:number}[],
 *   center: {x,y,z}, size: number }}
 */
export function buildBody(specIn) {
  const spec = normalizeBodySpec(specIn);
  let base;
  let top = null;
  let apex = null;
  let baseNames;
  let topNames = null;
  let apexName = null;
  const at = (pts, z, [dx, dy] = [0, 0]) => pts.map(([x, y]) => v3(x + dx, y + dy, z));

  if (spec.kind === 'cube' || (spec.kind === 'box' && !spec.base)) {
    const a = spec.a;
    const b = spec.kind === 'cube' ? a : spec.b;
    const c = spec.kind === 'cube' ? a : spec.c;
    // По часовой AB идёт вглубь — стороны меняются местами, чтобы AB = a,
    // AD = b оставались верными.
    base = spec.cw ? rectangle(b, a, -c / 2) : rectangle(a, b, -c / 2);
    top = spec.cw ? rectangle(b, a, c / 2) : rectangle(a, b, c / 2);
    if (spec.cw) {
      const clockwise = (pts) => [pts[0], ...pts.slice(1).reverse()];
      base = clockwise(base);
      top = clockwise(top);
    }
    if (spec.tilt) top = top.map((p) => { const [dx, dy] = tiltShift(spec, c); return v3(p.x + dx, p.y + dy, p.z); });
    baseNames = LETTERS.slice(0, 4);
  } else if (spec.kind === 'box' || spec.kind === 'prism') {
    const n = spec.kind === 'box' ? 4 : spec.n;
    const h = spec.kind === 'box' ? spec.c : spec.h;
    const plane = basePlane(spec.kind === 'box' ? { ...spec, b: spec.b } : spec, n);
    base = at(plane, -h / 2);
    top = at(plane, h / 2, tiltShift(spec, h));
    baseNames = LETTERS.slice(0, n);
  } else if (spec.kind === 'frustum') {
    const plane = basePlane(spec, spec.n);
    const [fx, fy] = apexFoot(spec, plane);
    base = at(plane, -spec.h / 2);
    top = plane.map(([x, y]) => v3(fx + (x - fx) * spec.k, fy + (y - fy) * spec.k, spec.h / 2));
    baseNames = LETTERS.slice(0, spec.n);
  } else {
    const n = spec.kind === 'tetra' ? 3 : spec.n;
    const h = spec.kind === 'tetra' ? spec.h || spec.a * Math.sqrt(2 / 3) : spec.h;
    const plane = basePlane(spec, n);
    base = at(plane, -h / 2);
    const [fx, fy] = apexFoot(spec, plane);
    apex = v3(fx, fy, h / 2);
    // У тетраэдра ABCD и пирамиды DABC вершина основания не может совпасть с именем вершины.
    baseNames = baseLetters(n, spec.apex);
    apexName = spec.apex;
  }
  if (top) topNames = baseNames.map((n) => `${n}1`);

  // Наклон и смещённая вершина уводят тело вбок — центрируем по вершинам,
  // чтобы оно вращалось вокруг себя.
  const all = [...base, ...(top || []), ...(apex ? [apex] : [])];
  const mx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const my = all.reduce((s, p) => s + p.y, 0) / all.length;
  if (Math.hypot(mx, my) > 1e-9) {
    const shift = (p) => v3(p.x - mx, p.y - my, p.z);
    base = base.map(shift);
    if (top) top = top.map(shift);
    if (apex) apex = shift(apex);
  }

  const vertices = {};
  const order = [];
  baseNames.forEach((name, i) => { vertices[name] = base[i]; order.push(name); });
  if (top) topNames.forEach((name, i) => { vertices[name] = top[i]; order.push(name); });
  if (apex) { vertices[apexName] = apex; order.push(apexName); }

  const n = baseNames.length;
  const edges = [];
  const faceLists = [];
  for (let i = 0; i < n; i++) edges.push([baseNames[i], baseNames[(i + 1) % n]]);
  faceLists.push([...baseNames]);
  if (top) {
    for (let i = 0; i < n; i++) edges.push([topNames[i], topNames[(i + 1) % n]]);
    for (let i = 0; i < n; i++) edges.push([baseNames[i], topNames[i]]);
    faceLists.push([...topNames]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faceLists.push([baseNames[i], baseNames[j], topNames[j], topNames[i]]);
    }
  } else {
    for (let i = 0; i < n; i++) edges.push([baseNames[i], apexName]);
    for (let i = 0; i < n; i++) {
      faceLists.push([baseNames[i], baseNames[(i + 1) % n], apexName]);
    }
  }

  const center = centroid(order.map((k) => vertices[k]));
  const faces = faceLists.map((names) => {
    const pts = names.map((k) => vertices[k]);
    let nrm = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    let verts = names;
    if (dot(nrm, sub(centroid(pts), center)) < 0) {
      nrm = mul(nrm, -1);
      verts = [...names].reverse();
    }
    const u = mul(nrm, 1 / len(nrm));
    return { id: names.join(''), verts, n: u, d: dot(u, pts[0]) };
  });

  let size = 0;
  for (const p of order) for (const q of order) size = Math.max(size, dist(vertices[p], vertices[q]));

  const built = { spec, vertices, order, edges, faces, center, size };
  return spec.names && spec.names.length === order.length ? renameBody(built, spec.names) : built;
}

/** Тело со своими именами вершин: те же точки, рёбра и грани под новыми именами. */
function renameBody(body, names) {
  const map = Object.fromEntries(body.order.map((n, i) => [n, names[i]]));
  const r = (n) => map[n] || n;
  const vertices = {};
  for (const n of body.order) vertices[r(n)] = body.vertices[n];
  return {
    ...body,
    vertices,
    order: body.order.map(r),
    edges: body.edges.map(([a, b]) => [r(a), r(b)]),
    faces: body.faces.map((f) => ({ ...f, id: f.verts.map(r).join(''), verts: f.verts.map(r) })),
  };
}

/**
 * Грань по именам вершин в любом порядке: «ABCD», «AA1D1D», «ADD1A1».
 * Можно назвать и тремя вершинами грани («ABC» у куба = основание ABCD).
 */
export function findFace(body, names) {
  if (!names || names.length < 3) return null;
  const set = new Set(names);
  const exact = body.faces.find((f) => f.verts.length === set.size && f.verts.every((v) => set.has(v)));
  if (exact) return exact;
  const containing = body.faces.filter((f) => names.every((nm) => f.verts.includes(nm)));
  return containing.length === 1 ? containing[0] : null;
}

// --- форма «Новый чертёж» ⇄ описание тела ------------------------------------
// Основание в форме — одно поле `shape`: «regular:5», «free:4», «trapezoid»…
// Положение вершины пирамиды — `apexPos`: center · v:<i> · e:<i> · shift.

/** Описание тела → значения формы редактора. */
export function bodyFormValues(specIn) {
  const s = normalizeBodySpec(specIn);
  const v = { ...s };
  delete v.names;
  if (s.kind === 'box') v.shape = s.base || 'rect';
  else if (s.kind === 'tetra') v.shape = s.base || 'regular';
  else if (s.kind === 'prism' || s.kind === 'pyramid' || s.kind === 'frustum') {
    v.shape = !s.base || s.base === 'free' ? `${s.base || 'regular'}:${s.n}` : s.base;
  }
  v.oblique = Boolean(s.tilt);
  v.tilt = s.tilt || 60;
  v.dir = s.tilt ? s.dir : DEFAULT_TILT_DIR;
  if (s.shift) { v.apexPos = 'shift'; [v.sx, v.sy] = s.shift; }
  else if (s.over?.length === 1) v.apexPos = `v:${s.over[0]}`;
  else if (s.over?.length === 2) v.apexPos = `e:${s.over[0]}`;
  else v.apexPos = 'center';
  if (v.sx == null) { v.sx = Math.round(s.a * 3) / 10; v.sy = Math.round(s.a * 2) / 10; }
  return v;
}

/** Значения формы → описание тела (нормализованное). */
export function bodySpecFromForm(values = {}) {
  const { shape, oblique, apexPos, sx, sy, ...rest } = values;
  const spec = { ...rest };
  delete spec.base; delete spec.over; delete spec.shift; delete spec.poly;
  if (!oblique) { delete spec.tilt; delete spec.dir; }
  const kind = spec.kind;
  if (kind === 'box' && shape && shape !== 'rect') spec.base = shape;
  if (kind === 'tetra' && shape && shape !== 'regular') spec.base = shape;
  if (kind === 'prism' || kind === 'pyramid' || kind === 'frustum') {
    const [base, n] = String(shape || 'regular:3').split(':');
    if (base !== 'regular') spec.base = base;
    if (n) spec.n = Number(n);
  }
  if (kind === 'pyramid' || kind === 'frustum' || kind === 'tetra') {
    const m = /^([ve]):(\d+)$/.exec(apexPos || '');
    if (m) {
      const n = kind === 'tetra' ? 3 : normalizeBodySpec(spec).n;
      const i = Number(m[2]);
      spec.over = m[1] === 'v' ? [i] : [i, (i + 1) % n];
    } else if (apexPos === 'shift') spec.shift = [Number(sx) || 0, Number(sy) || 0];
  }
  return normalizeBodySpec(spec);
}

/** Варианты основания для формы: [{ value, label }]. */
export function baseShapeOptions(kind) {
  if (kind === 'box') {
    return BOX_BASES.map((b) => ({ value: b, label: BASE_SHAPES[b].label }));
  }
  if (kind === 'tetra') {
    return [
      { value: 'regular', label: 'правильный тетраэдр' },
      { value: 'free', label: 'произвольный треугольник' },
      { value: 'right', label: BASE_SHAPES.right.label },
      { value: 'isosceles', label: BASE_SHAPES.isosceles.label },
    ];
  }
  const NAMES = { 3: 'треугольник', 4: 'четырёхугольник', 5: 'пятиугольник', 6: 'шестиугольник', 7: 'семиугольник', 8: 'восьмиугольник' };
  const regular = BASE_SHAPES.regular.ns.map((n) => ({
    value: `regular:${n}`, label: `правильный ${n === 4 ? 'четырёхугольник (квадрат)' : NAMES[n]}`,
  }));
  const free = BASE_SHAPES.free.ns.map((n) => ({ value: `free:${n}`, label: `произвольный ${NAMES[n]}` }));
  const special = ['right', 'isosceles', 'rect', 'parallelogram', 'rhombus', 'trapezoid']
    .map((b) => ({ value: b, label: BASE_SHAPES[b].label }));
  return [
    { label: 'Правильное', options: regular },
    { label: 'Произвольное', options: free },
    { label: 'Особое', options: special },
  ];
}

/** Куда может проектироваться вершина: [{ value, label }] по буквам основания. */
export function apexPosOptions(specIn) {
  const s = normalizeBodySpec(specIn);
  const n = s.kind === 'tetra' ? 3 : s.n;
  const letters = baseLetters(n, s.apex || null);
  const out = [{ value: 'center', label: s.base ? 'в центр основания (точку пересечения медиан)' : 'в центр основания' }];
  letters.forEach((l, i) => out.push({ value: `v:${i}`, label: `в вершину ${l} (ребро ⊥ основанию)` }));
  letters.forEach((l, i) => out.push({ value: `e:${i}`, label: `в середину ${l}${letters[(i + 1) % n]} (грань ⊥ основанию)` }));
  out.push({ value: 'shift', label: 'смещена (наклонная пирамида)' });
  return out;
}
