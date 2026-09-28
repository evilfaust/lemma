// Тела для стереочертежей: куб, прямоугольный параллелепипед, правильная
// призма, правильная пирамида, правильный тетраэдр.
//
// Все тела выпуклые — на этом держатся сечение (плоскость ∩ рёбра) и
// видимость (луч к зрителю ∩ полупространства граней).
//
// Мир: z — вверх, тело центрировано в начале координат (удобно вращать).
// Ракурс «спереди» — со стороны −y, поэтому у оснований ребро AB — переднее.
// Имена вершин верхнего основания — с цифрой: A1 (подпись A₁).

import { v3, sub, cross, dot, len, mul, centroid, dist } from './vec3';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const BODY_KINDS = {
  cube: { label: 'Куб' },
  box: { label: 'Прямоугольный параллелепипед' },
  prism: { label: 'Правильная призма' },
  pyramid: { label: 'Правильная пирамида' },
  tetra: { label: 'Правильный тетраэдр' },
};

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

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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
  if (spec?.cw) out.cw = true;
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
    case 'box':
      return { kind, a, b: num(spec.b, a * 0.75), c: num(spec.c, a * 0.9) };
    case 'prism': {
      const n = [3, 4, 6].includes(Number(spec.n)) ? Number(spec.n) : 3;
      return { kind, n, a, h: num(spec.h, a * 1.2) };
    }
    case 'pyramid': {
      const n = [3, 4, 6].includes(Number(spec.n)) ? Number(spec.n) : 4;
      const apex = /^[A-Z]$/.test(spec.apex || '') ? spec.apex : 'S';
      return { kind, n, a, h: num(spec.h, a * 1.1), apex };
    }
    case 'tetra': {
      const apex = /^[A-Z]$/.test(spec.apex || '') ? spec.apex : 'D';
      return { kind, a, apex };
    }
    default:
      return { kind: 'cube', a };
  }
}

/** Человеческое имя тела: «Куб ABCDA₁B₁C₁D₁». */
export function bodyTitle(spec) {
  const s = normalizeBodySpec(spec);
  const body = buildBody(s);
  const names = body.order.map(prettyName).join('');
  switch (s.kind) {
    case 'cube': return `Куб ${names}`;
    case 'box': return `Параллелепипед ${names}`;
    case 'prism': return `Призма ${names}`;
    case 'pyramid': {
      const apex = body.order[body.order.length - 1];
      return `Пирамида ${prettyName(apex)}${body.order.slice(0, -1).map(prettyName).join('')}`;
    }
    case 'tetra': return `Тетраэдр ${names}`;
    default: return names;
  }
}

/** «A1» → «A₁» (для текста, не для SVG). */
export function prettyName(name) {
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  return String(name).replace(/\d/g, (d) => SUB[Number(d)]);
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

  if (spec.kind === 'cube' || spec.kind === 'box') {
    const a = spec.a;
    const b = spec.kind === 'cube' ? a : spec.b;
    const c = spec.kind === 'cube' ? a : spec.c;
    // По часовой AB идёт вглубь — стороны меняются местами, чтобы AB = a,
    // AD = b оставались верными.
    base = spec.cw ? rectangle(b, a, -c / 2) : rectangle(a, b, -c / 2);
    top = spec.cw ? rectangle(b, a, c / 2) : rectangle(a, b, c / 2);
    baseNames = LETTERS.slice(0, 4);
  } else if (spec.kind === 'prism') {
    base = regularPolygon(spec.n, spec.a, -spec.h / 2);
    top = regularPolygon(spec.n, spec.a, spec.h / 2);
    baseNames = LETTERS.slice(0, spec.n);
  } else {
    const n = spec.kind === 'tetra' ? 3 : spec.n;
    const h = spec.kind === 'tetra' ? spec.a * Math.sqrt(2 / 3) : spec.h;
    base = regularPolygon(n, spec.a, -h / 2);
    apex = v3(0, 0, h / 2);
    // У тетраэдра ABCD и пирамиды DABC вершина основания не может совпасть с именем вершины.
    baseNames = LETTERS.filter((l) => l !== spec.apex).slice(0, n);
    apexName = spec.apex;
  }
  if (top) topNames = baseNames.map((n) => `${n}1`);
  if (spec.cw) {
    // Тот же многоугольник, обход в другую сторону: A на месте, остальные — зеркально.
    const clockwise = (pts) => [pts[0], ...pts.slice(1).reverse()];
    base = clockwise(base);
    if (top) top = clockwise(top);
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
