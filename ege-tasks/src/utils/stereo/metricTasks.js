// Генератор метрических задач по стереометрии: углы (между прямыми, прямой
// и плоскостью, плоскостями), расстояния (от точки до прямой, до плоскости,
// между скрещивающимися прямыми), объём пирамиды.
//
// Как у сечений: условие, чертёж, ответ и решение — из одной модели.
// Ответ считается ТОЧНО в решётке тела (exact.js: √(рационального),
// cos² угла — рациональное); чертёж решения (перпендикуляр, проекция,
// перенос, общий перпендикуляр) строит стереодвижок, и ответ сверяется с
// его геометрией — расхождение = задание отбраковывается.
//
// Сложность — по данным точкам: 1 — только вершины тела; 2 — середины рёбер
// и центры оснований; 3 — точки, делящие ребро 1:2 / 1:3, и центры граней.
// Решение — методом координат (для угла между прямыми, если удобный перенос
// находится среди вершин и середин рёбер, — через треугольник и теорему
// косинусов).

import { buildBody } from './bodies';
import { evaluateScene, makeAngleOp, lineColorKey } from './scene';
import { affineCoords } from './geometry';
import { sub, dot, cross, len, dist, centroid } from './vec3';
import { nextFootName, nextFreeName } from './naming';
import { stereoDrawingSvg, stereoBlockMarkdown } from './dsl';
import { DEFAULT_CAMERA } from './camera';
import {
  Q, ONE, qadd, qsub, qmul, qdiv, qneg, qabs, qsign, qzero, qeq, qnum, qLatex,
  vsub, vadd, vscale, vzero, vparallel, ldot, lnorm2, lnormal, cdet, vprimitive, tetraVolume2,
  sqrtQ, surdLatex, surdValue, surdComplexity, coordLatex, vecLatex, bgcd,
} from './exact';
import {
  GEN_BODIES, texName, scaleDims, maxDim, bodyIntro, latticeCenter,
} from './genBodies';
import { rng, orientEdge, faceNames, describeGiven, latticeEdgePoint } from './sectionTasks';

const COORD_FACET = 'Метод координат в пространстве';

/** Типы задач: slots — группы точек (прямая — 2, плоскость — 3, точка — 1). */
export const METRIC_TYPES = {
  angleLines: {
    label: 'Угол между прямыми', tag: '∠ прямые', kind: 'angle', prefer: 'cos', prefix: 'ANG',
    groups: ['line', 'line'],
    facets: ['Угол между скрещивающимися прямыми', 'Скрещивающиеся прямые'],
    hint: 'Перенесите одну из прямых параллельно так, чтобы она пересекла другую, — или найдите угол между направляющими векторами: $\\cos\\varphi = \\dfrac{|\\vec a\\cdot\\vec b|}{|\\vec a|\\,|\\vec b|}$.',
  },
  angleLinePlane: {
    label: 'Угол между прямой и плоскостью', tag: '∠ прямая, плоскость', kind: 'angle', prefer: 'sin', prefix: 'ANG',
    groups: ['line', 'plane'],
    facets: ['Угол прямой с плоскостью'],
    hint: 'Угол между прямой и плоскостью — угол между прямой и её проекцией на плоскость; в координатах $\\sin\\varphi = \\dfrac{|\\vec a\\cdot\\vec n|}{|\\vec a|\\,|\\vec n|}$, $\\vec n$ — нормаль плоскости.',
  },
  anglePlanes: {
    label: 'Угол между плоскостями', tag: '∠ плоскости', kind: 'angle', prefer: 'cos', prefix: 'ANG',
    groups: ['plane', 'plane'],
    facets: ['Двугранный угол'],
    hint: 'Угол между плоскостями равен углу между их нормалями: $\\cos\\varphi = \\dfrac{|\\vec n_1\\cdot\\vec n_2|}{|\\vec n_1|\\,|\\vec n_2|}$.',
  },
  distPointLine: {
    label: 'Расстояние от точки до прямой', tag: 'ρ точка — прямая', kind: 'dist', prefix: 'DST',
    groups: ['point', 'line'],
    facets: ['Расстояние от точки до прямой'],
    hint: 'Опустите перпендикуляр из точки на прямую: его основание $H$ делит направляющий вектор в отношении $t = \\dfrac{\\overrightarrow{AP}\\cdot\\overrightarrow{AB}}{|\\overrightarrow{AB}|^2}$.',
  },
  distPointPlane: {
    label: 'Расстояние от точки до плоскости', tag: 'ρ точка — плоскость', kind: 'dist', prefix: 'DST',
    groups: ['point', 'plane'],
    facets: ['Расстояние от точки до плоскости'],
    hint: 'Составьте уравнение плоскости $ax + by + cz + d = 0$; расстояние $\\rho = \\dfrac{|ax_0 + by_0 + cz_0 + d|}{\\sqrt{a^2 + b^2 + c^2}}$.',
  },
  distSkew: {
    label: 'Расстояние между скрещивающимися прямыми', tag: 'ρ скрещивающиеся', kind: 'dist', prefix: 'DST',
    groups: ['line', 'line'],
    facets: ['Расстояние между скрещивающимися прямыми', 'Общий перпендикуляр скрещивающихся прямых'],
    hint: 'Расстояние между скрещивающимися прямыми равно расстоянию от точки одной прямой до плоскости, проходящей через другую параллельно первой: $\\rho = \\dfrac{|\\overrightarrow{AC}\\cdot\\vec n|}{|\\vec n|}$, $\\vec n \\perp \\vec a,\\ \\vec n \\perp \\vec b$.',
  },
  volume: {
    label: 'Объём пирамиды', tag: 'объём', kind: 'vol', prefix: 'VOL',
    groups: ['tetra'],
    facets: ['Объём пирамиды'],
    hint: '$V = \\dfrac13 S h$ или $V = \\dfrac16\\left|\\left(\\vec a, \\vec b, \\vec c\\right)\\right|$ — через смешанное произведение рёбер из одной вершины.',
  },
};

export const METRIC_LEVELS = {
  1: 'Простое — только вершины тела',
  2: 'Среднее — середины рёбер, центры оснований',
  3: 'Сложное — точки, делящие ребро 1:2 и 1:3, центры граней',
};

const GROUP_SIZE = { point: 1, line: 2, plane: 3, tetra: 4 };
const POINT_NAMES = ['M', 'N', 'K', 'L', 'P', 'Q', 'R', 'T'];
const RATIO_PAIRS = [[1, 2], [2, 1], [1, 3], [3, 1]];
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ─── пул точек ──────────────────────────────────────────────────────────

/**
 * Точки, из которых собирается задание. Вершины — сами по себе; середины и
 * точки рёбер — { kind: 'e', edge, ratio }; центры — { kind: 'c', face }.
 */
function buildPool(key, topo) {
  const def = GEN_BODIES[key];
  const vertices = topo.order.map((name) => ({ kind: 'v', name, key: name }));
  const edgePt = (e, r) => {
    const o = orientEdge(topo, e, r);
    return { kind: 'e', edge: o.edge, ratio: o.ratio, key: `${o.edge.join('')}:${o.ratio.join(':')}` };
  };
  const mids = topo.edges.map((e) => edgePt(e, [1, 1]));
  const ratios = topo.edges.flatMap((e) => RATIO_PAIRS.map((r) => edgePt(e, r)));
  const face = (f, role) => ({ kind: 'c', face: faceNames(topo, f.verts), role, key: `c:${[...f.verts].sort().join('')}` });
  // faces[0] — нижнее основание, у призм faces[1] — верхнее (bodies.js)
  const bases = def.prism ? [face(topo.faces[0], 'base'), face(topo.faces[1], 'top')] : [face(topo.faces[0], 'base')];
  const others = topo.faces.slice(def.prism ? 2 : 1)
    .filter((f) => f.verts.length >= 4 || key === 'tetra')
    .map((f) => face(f, 'face'));
  return { vertices, level2: [...mids, ...bases], level3: [...ratios, ...others] };
}

// Особые точки по сложности: сколько и каких
function chooseSpecials(rand, level, pool) {
  if (level <= 1) return [];
  const out = [];
  const add = (list) => {
    for (let k = 0; k < 20; k += 1) {
      const p = pick(rand, list);
      if (!out.some((q) => q.key === p.key)) { out.push({ ...p }); return; }
    }
  };
  if (level === 2) {
    add(pool.level2);
    if (rand() < 0.45) add(pool.level2);
  } else {
    add(pool.level3);
    if (rand() < 0.4) add([...pool.level2, ...pool.level3]);
  }
  return out;
}

// Имена особым точкам: на рёбрах и в гранях — M, N, K…; центр основания — O, верхнего — O₁
function nameSpecials(specials, used) {
  const taken = new Set(used);
  for (const sp of specials) {
    if (sp.kind === 'c' && sp.role === 'base' && !taken.has('O')) sp.name = 'O';
    else if (sp.kind === 'c' && sp.role === 'top' && !taken.has('O1')) sp.name = 'O1';
    else sp.name = POINT_NAMES.find((n) => !taken.has(n));
    taken.add(sp.name);
  }
}

function describeSpecial(sp) {
  if (sp.kind === 'e') return describeGiven(sp);
  const fn = sp.face.map(texName).join('');
  if (sp.role !== 'face' && !['cube', 'box'].includes(sp.bodyKey)) return `точка $${texName(sp.name)}$ — центр основания $${fn}$`;
  return `точка $${texName(sp.name)}$ — центр грани $${fn}$`;
}

// Имена в тексте: вершина пирамиды первой, дальше по букве и индексу («A₁BD», «SBC»)
function sortNames(names, apex) {
  const key = (n) => (n === apex ? [-1, 0] : [n.charCodeAt(0), Number(n.slice(1) || 0)]);
  return [...names].sort((a, b) => { const x = key(a); const y = key(b); return x[0] - y[0] || x[1] - y[1]; });
}

// ─── ответ ────────────────────────────────────────────────────────────────

const SPECIAL_ANGLES = [[Q(0), 90], [Q(1, 4), 60], [Q(1, 2), 45], [Q(3, 4), 30]];
const ANGLE_FN = { cos: '\\arccos', sin: '\\arcsin', tg: '\\arctg' };

/**
 * Угол по cos² — «по-школьному»: 30°/45°/60°/90° или arccos / arcsin / arctg
 * (что короче; при равенстве — prefer).
 * @returns {{ latex, deg, special, fn, surd }}
 */
export function formatAngle(cos2, prefer = 'cos') {
  const deg = (Math.acos(Math.min(1, Math.sqrt(qnum(cos2)))) * 180) / Math.PI;
  for (const [c, d] of SPECIAL_ANGLES) if (qeq(cos2, c)) return { latex: `${d}^\\circ`, deg: d, special: true };
  const sin2 = qsub(ONE, cos2);
  const cands = [
    { fn: 'cos', surd: sqrtQ(cos2) },
    { fn: 'sin', surd: sqrtQ(sin2) },
    { fn: 'tg', surd: qzero(cos2) ? null : sqrtQ(qdiv(sin2, cos2)) },
  ].filter((c) => c.surd);
  if (!cands.length) return null;
  cands.forEach((c) => { c.score = surdComplexity(c.surd) + (c.fn === prefer ? 0 : 0.6); });
  cands.sort((a, b) => a.score - b.score);
  const best = cands[0];
  return { latex: `${ANGLE_FN[best.fn]} ${surdLatex(best.surd)}`, deg, special: false, fn: best.fn, surd: best.surd };
}

const niceSurd = (s, { q = 6, m = 99, k = 999 } = {}) => !!s && s.q <= BigInt(q) && s.m <= BigInt(m) && s.k <= BigInt(k);

function niceAngle(a) {
  if (!a) return false;
  if (a.special) return true;
  return niceSurd(a.surd, { q: 30, m: 99, k: 99 }) && surdComplexity(a.surd) <= 6;
}

const degText = (deg) => `${(Math.round(deg * 100) / 100).toFixed(2).replace(/\.?0+$/, '').replace('.', '{,}')}^\\circ`;

// ─── геометрия решётки ───────────────────────────────────────────────────

function latticeOf(key, dims) {
  const lat = GEN_BODIES[key].lattice(dims);
  return lat;
}

function posOf(lat, pt) {
  if (pt.kind === 'v') return lat.vertices[pt.name];
  if (pt.kind === 'e') return latticeEdgePoint(lat, pt.edge, pt.ratio);
  return latticeCenter(lat, pt.face);
}

// Плоскость — грань тела? (все вершины какой-то грани в ней)
function planeIsFace(lat, topo, n, P0) {
  return topo.faces.some((f) => f.verts.every((v) => qzero(ldot(lat.g, n, vsub(lat.vertices[v], P0)))));
}

const parallelToEdge = (lat, topo, w) => topo.edges.some(([u, v]) => vparallel(w, vsub(lat.vertices[v], lat.vertices[u])));

// Обе точки на одном ребре тела → прямая — это ребро
function sameEdge(topo, a, b) {
  const edgesOf = (p) => (p.kind === 'v'
    ? topo.edges.filter((e) => e.includes(p.name)).map((e) => [...e].sort().join('-'))
    : p.kind === 'e' ? [[...p.edge].sort().join('-')] : []);
  const ea = edgesOf(a);
  return edgesOf(b).some((e) => ea.includes(e));
}

/**
 * Посчитать задание в решётке. pts — точки по группам.
 * @returns {object|null} null — вырожденное или «пустое» задание
 */
function compute(type, lat, topo, groups, rand) {
  const g = lat.g;
  const P = (pt) => posOf(lat, pt);
  const prismy = GEN_BODIES[topo.key].prism;
  switch (type) {
    case 'angleLines': {
      const [[a0, a1], [b0, b1]] = groups;
      const u = vsub(P(a1), P(a0));
      const v = vsub(P(b1), P(b0));
      if (vzero(u) || vzero(v)) return null;
      if (qzero(cdet(u, v, vsub(P(b0), P(a0))))) return null; // не скрещиваются
      // два ребра призмы — табличный угол (у тетраэдра пара противоположных рёбер — классика)
      if (prismy && sameEdge(topo, a0, a1) && sameEdge(topo, b0, b1)) return null;
      const d = ldot(g, u, v);
      const cos2 = qdiv(qmul(d, d), qmul(lnorm2(g, u), lnorm2(g, v)));
      if (qzero(cos2) && rand() < 0.6) return null; // 90° — реже
      return { cos2, u, v };
    }
    case 'angleLinePlane': {
      const [[a0, a1], [q0, q1, q2]] = groups;
      const u = vsub(P(a1), P(a0));
      const n = lnormal(g, vsub(P(q1), P(q0)), vsub(P(q2), P(q0)));
      if (vzero(u) || vzero(n)) return null;
      const dn = ldot(g, n, u);
      if (qzero(dn)) return null; // параллельна или лежит в плоскости
      const sin2 = qdiv(qmul(dn, dn), qmul(lnorm2(g, n), lnorm2(g, u)));
      const cos2 = qsub(ONE, sin2);
      if (qzero(cos2) && rand() < 0.75) return null;
      if (prismy && planeIsFace(lat, topo, n, P(q0)) && sameEdge(topo, a0, a1)) return null;
      return { cos2, sin2, u, n };
    }
    case 'anglePlanes': {
      const [[p0, p1, p2], [q0, q1, q2]] = groups;
      const n1 = lnormal(g, vsub(P(p1), P(p0)), vsub(P(p2), P(p0)));
      const n2 = lnormal(g, vsub(P(q1), P(q0)), vsub(P(q2), P(q0)));
      if (vzero(n1) || vzero(n2) || vparallel(n1, n2)) return null;
      const f1 = planeIsFace(lat, topo, n1, P(p0));
      const f2 = planeIsFace(lat, topo, n2, P(q0));
      if (f1 && f2 && prismy) return null; // две грани призмы — табличный угол
      const d = ldot(g, n1, n2);
      const cos2 = qdiv(qmul(d, d), qmul(lnorm2(g, n1), lnorm2(g, n2)));
      if (qzero(cos2) && rand() < 0.75) return null;
      return { cos2, n1, n2 };
    }
    case 'distPointLine': {
      const [[p], [a0, a1]] = groups;
      const A = P(a0);
      const u = vsub(P(a1), A);
      const w = vsub(P(p), A);
      if (vzero(u) || vparallel(w, u)) return null;
      const t = qdiv(ldot(g, w, u), lnorm2(g, u));
      const H = vadd(A, vscale(u, t));
      const ph = vsub(P(p), H);
      if (sameEdge(topo, a0, a1) && parallelToEdge(lat, topo, ph)) return null;
      return { value2: lnorm2(g, ph), t, H, u, w };
    }
    case 'distPointPlane': {
      const [[p], [q0, q1, q2]] = groups;
      const n = lnormal(g, vsub(P(q1), P(q0)), vsub(P(q2), P(q0)));
      if (vzero(n)) return null;
      const h = ldot(g, n, vsub(P(p), P(q0)));
      if (qzero(h)) return null;
      const n2 = lnorm2(g, n);
      const H = vsub(P(p), vscale(n, qdiv(h, n2)));
      if (planeIsFace(lat, topo, n, P(q0)) && parallelToEdge(lat, topo, vsub(P(p), H))) return null;
      return { value2: qdiv(qmul(h, h), n2), n, H };
    }
    case 'distSkew': {
      const [[a0, a1], [b0, b1]] = groups;
      const A = P(a0);
      const C = P(b0);
      const u = vsub(P(a1), A);
      const v = vsub(P(b1), C);
      if (vzero(u) || vzero(v)) return null;
      const w = vsub(C, A);
      if (qzero(cdet(u, v, w))) return null;
      if (prismy && sameEdge(topo, a0, a1) && sameEdge(topo, b0, b1)) return null;
      const n = lnormal(g, u, v);
      const nw = ldot(g, n, w);
      // общий перпендикуляр: A + s·u, C + t·v
      const uu = lnorm2(g, u);
      const vv = lnorm2(g, v);
      const uv = ldot(g, u, v);
      const wu = ldot(g, w, u);
      const wv = ldot(g, w, v);
      const det = qsub(qmul(uv, uv), qmul(uu, vv));
      const s = qdiv(qsub(qmul(uv, wv), qmul(wu, vv)), det);
      const t = qdiv(qsub(qmul(uu, wv), qmul(wu, uv)), det);
      if (qnum(s) < -0.5 || qnum(s) > 1.5 || qnum(t) < -0.5 || qnum(t) > 1.5) return null;
      return { value2: qdiv(qmul(nw, nw), lnorm2(g, n)), n, u, v, w, s, t, nw };
    }
    case 'volume': {
      const [[p0, p1, p2, p3]] = groups;
      const v2 = tetraVolume2(g, P(p0), P(p1), P(p2), P(p3));
      if (qzero(v2)) return null;
      return { value2: v2 };
    }
    default:
      return null;
  }
}

// ─── масштаб ──────────────────────────────────────────────────────────────

// Знаменатели коэффициентов точек → масштаб, при котором координаты целые
function integerScale(lat, pts) {
  let l = 1n;
  for (const P of pts) for (const x of P) l = (l / bgcd(l, x.d)) * x.d;
  return Number(l);
}

/** Масштаб тела: ответ «школьный», размеры до 12. null — такого нет. */
function pickScale(rand, typeDef, shape, res, level, needDims, lat, pts) {
  const ks = [];
  for (let k = 1; maxDim(shape) * k <= 12; k += 1) ks.push(k);
  if (typeDef.kind === 'angle') {
    if (!needDims) {
      const L = integerScale(lat, pts);
      return L <= 12 ? L : 1;
    }
    const small = ks.filter((k) => maxDim(shape) * k <= 10);
    return pick(rand, small.length ? small : [1]);
  }
  const power = typeDef.kind === 'vol' ? 6 : 2;
  const lim = typeDef.kind === 'vol' ? { q: 12, m: 30 } : { q: level < 3 ? 6 : 12, m: 70 };
  const ok = ks.filter((k) => maxDim(shape) * k >= 2 && niceSurd(sqrtQ(qmul(res.value2, Q(k ** power))), lim));
  return ok.length ? pick(rand, ok) : null;
}

// ─── текст решения ──────────────────────────────────────────────────────────

const L = (r) => surdLatex(sqrtQ(r), { frac: 'frac' });
/** «a = b = c» без повторов подряд («\dfrac{54}{5} = \dfrac{54}{5}»). */
const chain = (...parts) => parts.filter((x, i) => i === 0 || x !== parts[i - 1]).join(' = ');
const ptTex = (name, P, g) => `${texName(name)}${vecLatex(P, g)}`;
const vecName = (a, b) => `\\overrightarrow{${texName(a)}${texName(b)}}`;
const lineTex = (pair) => pair.map(texName).join('');

/** Уравнение плоскости в настоящих координатах: «x + \sqrt{3}y - 2z + 4 = 0». */
function planeEquation(n, D, g) {
  const vars = ['x', 'y', 'z'];
  let out = '';
  n.forEach((c, i) => {
    if (qzero(c)) return;
    const abs = coordLatex(qabs(c), g[i]);
    const coef = abs === '1' ? '' : abs;
    const sign = qsign(c) < 0 ? '-' : '+';
    out += out ? ` ${sign} ${coef}${vars[i]}` : `${sign === '-' ? '-' : ''}${coef}${vars[i]}`;
  });
  if (!qzero(D)) out += ` ${qsign(D) < 0 ? '-' : '+'} ${qLatex(qabs(D))}`;
  return `${out} = 0`;
}

// Высота пирамиды (если дано боковое ребро) и тетраэдра — для координат вершины
function heightNote(key, dims, lat) {
  const def = GEN_BODIES[key];
  if (def.prism) return '';
  const apex = lat.order.at(-1);
  const R2 = qmul(Q(dims.a * dims.a), def.n === 3 ? Q(1, 3) : def.n === 4 ? Q(1, 2) : ONE);
  const l = key === 'tetra' ? dims.a : dims.l;
  if (l == null) return '';
  const h = L(qsub(Q(l * l), R2));
  const a = texName(apex);
  return ` Высота ${key === 'tetra' ? 'тетраэдра' : 'пирамиды'} $${a}O = \\sqrt{${a}A^2 - OA^2} = \\sqrt{${l * l} - ${qLatex(R2)}} = ${h}$, где $O$ — центр основания, $OA = ${L(R2)}$ — радиус описанной около основания окружности.`;
}

function coordIntro(key, dims, lat, names, pos, lead = '') {
  const def = GEN_BODIES[key];
  const list = names.map((n) => `$${ptTex(n, pos[n], lat.g)}$`).join(', ');
  return `${lead ? `${lead} ` : ''}Введём систему координат: ${def.axes}.${heightNote(key, dims, lat)} Тогда ${list}.`;
}

// ─── генерация ────────────────────────────────────────────────────────────

/**
 * Сгенерировать метрическую задачу.
 * @param {{ body: string, type: keyof METRIC_TYPES, level: 1|2|3, seed: number }} opts
 * @returns {object|null}
 */
export function generateMetricTask({ body: bodyKey = 'cube', type = 'angleLines', level = 2, seed = 1, attempts = 2500 } = {}) {
  const key = bodyKey in GEN_BODIES ? bodyKey : 'cube';
  const def = GEN_BODIES[key];
  const typeDef = METRIC_TYPES[type];
  if (!typeDef) return null;
  const rand = rng(seed);
  const topo = { ...buildBody(def.draw), key };
  const apex = key.startsWith('pyramid') ? topo.order.at(-1) : null; // у тетраэдра «вершины» нет — ABD, а не DAB
  const pool = buildPool(key, topo);
  const sizes = typeDef.groups.map((gname) => GROUP_SIZE[gname]);
  const total = sizes.reduce((a, b) => a + b, 0);
  const needDims = typeDef.kind !== 'angle' || def.angleNeedsDims;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shape = def.shape(rand);
    const specials = chooseSpecials(rand, level, pool);
    if (specials.length < (level > 1 ? 1 : 0)) continue;
    // Слоты: особые точки — в случайные места, остальное — вершины
    const slots = Array(total).fill(null);
    const free = [...slots.keys()].sort(() => rand() - 0.5);
    specials.forEach((sp, i) => { slots[free[i]] = sp; });
    // Плоскость без особых точек — часто грань тела
    let offset = 0;
    typeDef.groups.forEach((gname, gi) => {
      const size = sizes[gi];
      const idx = Array.from({ length: size }, (_, k) => offset + k);
      if (gname === 'plane' && idx.every((k) => !slots[k]) && rand() < 0.4) {
        const f = pick(rand, topo.faces);
        const verts = [...f.verts].sort(() => rand() - 0.5).slice(0, 3);
        idx.forEach((k, j) => { slots[k] = pool.vertices.find((v) => v.name === verts[j]); });
      }
      offset += size;
    });
    for (let k = 0; k < total; k += 1) if (!slots[k]) slots[k] = pick(rand, pool.vertices);
    // Группы без повторов
    const groups = [];
    offset = 0;
    let bad = false;
    for (const size of sizes) {
      const gp = slots.slice(offset, offset + size);
      if (new Set(gp.map((p) => p.key)).size !== size) bad = true;
      groups.push(gp);
      offset += size;
    }
    if (bad) continue;

    const shapeLat = latticeOf(key, shape);
    const res0 = compute(type, shapeLat, topo, groups, rand);
    if (!res0) continue;
    if (typeDef.kind === 'angle' && !niceAngle(formatAngle(res0.cos2, typeDef.prefer))) continue;
    const usedPts = [...new Set(slots)].map((p) => posOf(shapeLat, p));
    const k = pickScale(rand, typeDef, shape, res0, level, needDims, shapeLat, usedPts);
    if (!k) continue;
    const dims = scaleDims(shape, k);
    const lat = latticeOf(key, dims);
    const res = compute(type, lat, topo, groups, () => 1);
    if (!res) continue;

    nameSpecials(specials, topo.order);
    specials.forEach((sp) => { sp.bodyKey = key; });
    const built = buildTask({
      key, def, type, typeDef, level, seed, dims, lat, topo, apex, groups, specials, res, needDims,
    });
    if (built) return built;
  }
  return null;
}

// Чертежи, текст, сверка с моделью
function buildTask(ctx) {
  const {
    key, def, type, typeDef, level, seed, dims, lat, topo, apex, groups, specials, res, needDims,
  } = ctx;
  const g = lat.g;
  const spec = def.spec(dims);
  const body = buildBody(spec);
  const nameOf = (p) => (p.kind === 'v' ? p.name : p.name);
  const pos = {};
  for (const n of body.order) pos[n] = lat.vertices[n];
  for (const sp of specials) pos[sp.name] = posOf(lat, sp);

  // Данные точки — шаги движка
  const givenOps = specials.map((sp, i) => {
    if (sp.kind === 'e') {
      return { id: `g${i}`, type: 'pointOnLine', name: sp.name, ref: [...sp.edge], t: sp.ratio[0] / (sp.ratio[0] + sp.ratio[1]), ratio: [...sp.ratio] };
    }
    const [A, B, C] = sp.face.slice(0, 3).map((v) => body.vertices[v]);
    const st = affineCoords(A, B, C, centroid(sp.face.map((v) => body.vertices[v])));
    return { id: `g${i}`, type: 'pointOnFace', name: sp.name, face: [...sp.face], s: st.s, t: st.t };
  });

  // Объекты задания именами (в тексте и в шагах — одинаково)
  const named = groups.map((gp) => sortNames(gp.map(nameOf), apex));
  const used = new Set([...body.order, ...specials.map((s) => s.name)]);
  const segOps = [];
  const segColors = {};
  let seq = 0;
  const segment = (pair, color) => {
    const [a, b] = pair;
    const pa = groups.flat().find((p) => nameOf(p) === a) || { kind: 'v', name: a };
    const pb = groups.flat().find((p) => nameOf(p) === b) || { kind: 'v', name: b };
    if (!sameEdge(topo, pa, pb)) {
      seq += 1;
      segOps.push({ id: `s${seq}`, type: 'segment', ref: [a, b] });
    }
    if (color) segColors[lineColorKey([a, b])] = color;
  };
  const planeTex = (names) => {
    const n = lnormal(g, vsub(pos[names[1]], pos[names[0]]), vsub(pos[names[2]], pos[names[0]]));
    const face = topo.faces.find((f) => f.verts.every((v) => qzero(ldot(g, n, vsub(lat.vertices[v], pos[names[0]])))));
    return face ? faceNames(topo, face.verts).map(texName).join('') : names.map(texName).join('');
  };

  // Условие
  let question;
  switch (type) {
    case 'angleLines':
      segment(named[0], 'red'); segment(named[1], 'blue');
      question = `Найдите угол между прямыми $${lineTex(named[0])}$ и $${lineTex(named[1])}$.`;
      break;
    case 'angleLinePlane':
      segment(named[0], 'red');
      question = `Найдите угол между прямой $${lineTex(named[0])}$ и плоскостью $${planeTex(named[1])}$.`;
      break;
    case 'anglePlanes':
      question = `Найдите угол между плоскостями $${planeTex(named[0])}$ и $${planeTex(named[1])}$.`;
      break;
    case 'distPointLine':
      segment(named[1], 'blue');
      question = `Найдите расстояние от точки $${texName(named[0][0])}$ до прямой $${lineTex(named[1])}$.`;
      break;
    case 'distPointPlane':
      question = `Найдите расстояние от точки $${texName(named[0][0])}$ до плоскости $${planeTex(named[1])}$.`;
      break;
    case 'distSkew':
      segment(named[0], 'red'); segment(named[1], 'blue');
      question = `Найдите расстояние между прямыми $${lineTex(named[0])}$ и $${lineTex(named[1])}$.`;
      break;
    case 'volume': {
      const v = named[0];
      for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) segment([v[i], v[j]]);
      question = `Найдите объём пирамиды $${v.map(texName).join('')}$.`;
      break;
    }
    default: return null;
  }
  const scene = { body: spec, ops: [...givenOps, ...segOps], segmentColors: { ...segColors } };

  // Решение: шаги чертежа + текст
  const sol = solve({
    key, def, type, typeDef, lat, dims, pos, named, used, scene, res, topo, groups, specials, apex, needDims, planeTex,
  });
  if (!sol) return null;
  const solutionScene = {
    body: spec,
    ops: [...scene.ops, ...sol.ops],
    segmentColors: { ...segColors, ...(sol.segmentColors || {}) },
    ...(sol.lineColors ? { lineColors: sol.lineColors } : {}),
  };
  const model = evaluateScene(solutionScene);
  if (model.steps.some((s) => !s.ok)) return null;
  // Чертёж помещается: ничего не улетает далеко от тела
  const far = model.pointOrder.some((n) => dist(model.points[n].pos, model.body.center) > 1.9 * model.body.size);
  if (far) return null;
  if (!sol.verify(model)) return null;

  const points = specials.map(describeSpecial).join(', ');
  const intro = bodyIntro(key, body.order, dims, needDims);
  const pointsText = points ? ` ${points[0].toUpperCase()}${points.slice(1)}.` : '';
  const statement = `${intro}${pointsText} ${question}`;

  return {
    family: 'metric',
    seed, body: key, type, level, dims,
    scene, solutionScene, model,
    statement,
    answer: `$${sol.answerLatex}$`,
    answerValue: sol.answerValue,
    solutionText: sol.text,
    hint: typeDef.hint,
    tag: typeDef.tag,
    facets: [def.facet, ...typeDef.facets, ...(sol.coord ? [COORD_FACET] : [])],
    given: specials.map(({ name, kind, edge, ratio, face }) => ({ name, kind, edge, ratio, face })),
    objects: named,
  };
}

// ─── решения по типам ─────────────────────────────────────────────────────

function angleAnswer(cos2, prefer, via, value) {
  const a = formatAngle(cos2, prefer);
  const viaTex = `\\${via === 'sin' ? 'arcsin' : 'arccos'} ${value}`;
  if (a.special) return { a, line: `$\\varphi = ${a.latex}$.` };
  const tail = a.latex === viaTex ? '' : ` = ${a.latex}`;
  return { a, line: `$\\varphi = ${viaTex}${tail} \\approx ${degText(a.deg)}$.` };
}

function solve(ctx) {
  const {
    key, def, type, lat, dims, pos, named, used, res, needDims, planeTex,
  } = ctx;
  const g = lat.g;
  const ops = [];
  const lines = [];
  const scaleNote = needDims ? '' : `Угол не зависит от размеров ${def.gen} — примем ребро равным $${dims.a}$.`;
  const coordNames = (list) => [...new Set(list)];
  const fresh = (pref = 'H') => {
    const n = pref === 'H' ? nextFootName(used) : nextFreeName(used);
    used.add(n);
    return n;
  };
  const P = (n) => pos[n];
  const vtex = (u) => vecLatex(u, g);
  const nv = (u) => vprimitive(u, { positive: true });

  switch (type) {
    case 'angleLines': {
      const [l1, l2] = named;
      const cos2 = res.cos2;
      const value = surdLatex(sqrtQ(cos2));
      const tri = findTranslation(ctx);
      let coord = false;
      let segmentColors = {};
      let lineColors = null;
      if (tri) {
        const { B, O, Y, newPoint, base, other } = tri;
        if (newPoint) ops.push(newPoint.op);
        ops.push({ id: 'c1', type: 'segment', ref: [B, Y], note: `${B}${Y} ∥ ${other.join('')}` });
        if (!tri.oyEdge) ops.push({ id: 'c2', type: 'segment', ref: [O, Y] });
        segmentColors = { [lineColorKey([B, Y])]: 'blue' };
        const bo = lnorm2(g, vsub(P(O), P(B)));
        const by = lnorm2(g, vsub(P(Y), P(B)));
        const oy = lnorm2(g, vsub(P(Y), P(O)));
        const dotv = ldot(g, vsub(P(O), P(B)), vsub(P(Y), P(B)));
        const cosSigned = surdLatex(sqrtQ(qdiv(qmul(dotv, dotv), qmul(bo, by))), { sign: qsign(dotv) });
        const [b, o, y] = [B, O, Y].map(texName);
        if (scaleNote) lines.push(scaleNote);
        if (newPoint) lines.push(`Пусть $${y}$ — ${newPoint.text}.`);
        lines.push(`Так как $${b}${y} \\parallel ${lineTex(other)}$, угол между прямыми $${lineTex(base)}$ и $${lineTex(other)}$ равен углу между прямыми $${b}${o}$ и $${b}${y}$.`);
        lines.push(`В треугольнике $${o}${b}${y}$: $${b}${o} = ${L(bo)}$, $${b}${y} = ${L(by)}$, $${o}${y} = ${L(oy)}$.`);
        lines.push(`По теореме косинусов $$\\cos\\angle ${o}${b}${y} = \\dfrac{${b}${o}^2 + ${b}${y}^2 - ${o}${y}^2}{2\\cdot ${b}${o}\\cdot ${b}${y}} = \\dfrac{${qLatex(bo)} + ${qLatex(by)} - ${qLatex(oy)}}{2\\cdot ${L(bo)}\\cdot ${L(by)}} = ${cosSigned}.$$`);
        if (qsign(dotv) < 0) lines.push(`Угол $${o}${b}${y}$ тупой, поэтому угол между прямыми — смежный с ним: $\\cos\\varphi = ${value}$.`);
        else if (!qzero(dotv)) lines.push(`Значит, $\\cos\\varphi = ${value}$.`);
      } else {
        coord = true;
        const id = 'c1';
        ops.push({ id, type: 'parallel', through: l1[0], ref: [...l2], note: `перенос ${l2.join('')}` });
        lineColors = { [lineColorKey(id)]: 'blue' };
        const a = nv(vsub(P(l1[1]), P(l1[0])));
        const b = nv(vsub(P(l2[1]), P(l2[0])));
        const d = ldot(g, a, b);
        lines.push(coordIntro(key, dims, lat, coordNames([...l1, ...l2]), pos, scaleNote));
        lines.push(`Направляющие векторы: $\\vec a = ${vtex(a)} \\parallel ${vecName(...l1)}$, $\\vec b = ${vtex(b)} \\parallel ${vecName(...l2)}$.`);
        lines.push(`$$${chain('\\cos\\varphi', '\\dfrac{|\\vec a\\cdot\\vec b|}{|\\vec a|\\cdot|\\vec b|}', `\\dfrac{${qLatex(qabs(d))}}{${L(lnorm2(g, a))}\\cdot ${L(lnorm2(g, b))}}`, value)}.$$`);
      }
      const { a, line } = angleAnswer(cos2, 'cos', 'cos', value);
      if (!qzero(cos2)) lines.push(`Тогда ${line}`);
      else lines.push('Прямые перпендикулярны: $\\varphi = 90^\\circ$.');
      return {
        ops, segmentColors, lineColors, coord,
        text: lines.join('\n\n'),
        answerLatex: a.latex, answerValue: a.deg,
        verify: (model) => {
          const m = (n) => model.points[n].pos;
          const u = sub(m(l1[1]), m(l1[0]));
          const v = sub(m(l2[1]), m(l2[0]));
          return Math.abs(Math.abs(dot(u, v)) / (len(u) * len(v)) - Math.sqrt(qnum(cos2))) < 1e-7;
        },
      };
    }

    case 'angleLinePlane': {
      const [l, pl] = named;
      ops.push({ id: 'c1', type: 'plane', pts: [...pl] });
      const model0 = evaluateScene({ ...ctx.scene, ops: [...ctx.scene.ops, ...ops] });
      const op = makeAngleOp(model0, [...l], [...pl], 'c2');
      if (op.foot) used.add(op.foot);
      if (op.at) used.add(op.at);
      op.note = 'проекция прямой на плоскость';
      ops.push(op);
      const a = nv(vsub(P(l[1]), P(l[0])));
      const n = nv(lnormal(g, vsub(P(pl[1]), P(pl[0])), vsub(P(pl[2]), P(pl[0]))));
      const sinV = surdLatex(sqrtQ(res.sin2));
      lines.push('Угол между прямой и плоскостью — угол между прямой и её проекцией на плоскость (на чертеже — дуга).');
      lines.push(coordIntro(key, dims, lat, coordNames([...l, ...pl]), pos, scaleNote));
      lines.push(`Направляющий вектор прямой: $\\vec a = ${vtex(a)} \\parallel ${vecName(...l)}$.`);
      lines.push(`Нормаль к плоскости $(${planeTex(pl)})$: $\\vec n = ${vtex(n)}$ — проверка: $\\vec n\\cdot${vecName(pl[0], pl[1])} = 0$, $\\vec n\\cdot${vecName(pl[0], pl[2])} = 0$, где $${vecName(pl[0], pl[1])} = ${vtex(vsub(P(pl[1]), P(pl[0])))}$, $${vecName(pl[0], pl[2])} = ${vtex(vsub(P(pl[2]), P(pl[0])))}$.`);
      lines.push(`$$\\sin\\varphi = \\dfrac{|\\vec a\\cdot\\vec n|}{|\\vec a|\\cdot|\\vec n|} = \\dfrac{${qLatex(qabs(ldot(g, a, n)))}}{${L(lnorm2(g, a))}\\cdot ${L(lnorm2(g, n))}} = ${sinV}.$$`);
      const { a: ang, line } = angleAnswer(res.cos2, 'sin', 'sin', sinV);
      lines.push(`Тогда ${line}`);
      return {
        ops, coord: true, segmentColors: {},
        text: lines.join('\n\n'),
        answerLatex: ang.latex, answerValue: ang.deg,
        verify: (model) => {
          const st = model.steps.find((s) => s.op.id === 'c2');
          const tri = st?.created?.angle;
          if (!tri) return false;
          const [s, x, h] = tri.map((nm) => model.points[nm].pos);
          const u = sub(s, x);
          const v = sub(h, x);
          return Math.abs(dot(u, v) / (len(u) * len(v)) - Math.sqrt(qnum(res.cos2))) < 1e-7;
        },
      };
    }

    case 'anglePlanes': {
      const [p1, p2] = named;
      ops.push({ id: 'c1', type: 'plane', pts: [...p1] });
      ops.push({ id: 'c2', type: 'section', pts: [...p2] });
      const n1 = nv(lnormal(g, vsub(P(p1[1]), P(p1[0])), vsub(P(p1[2]), P(p1[0]))));
      const n2 = nv(lnormal(g, vsub(P(p2[1]), P(p2[0])), vsub(P(p2[2]), P(p2[0]))));
      const value = surdLatex(sqrtQ(res.cos2));
      const pn = planeTex;
      lines.push('Угол между плоскостями равен углу между их нормалями (если он острый) или дополняет его до $180^\\circ$.');
      lines.push(coordIntro(key, dims, lat, coordNames([...p1, ...p2]), pos, scaleNote));
      lines.push(`Нормаль к плоскости $(${pn(p1)})$: $\\vec n_1 = ${vtex(n1)}$ ($\\vec n_1\\cdot${vecName(p1[0], p1[1])} = \\vec n_1\\cdot${vecName(p1[0], p1[2])} = 0$).`);
      lines.push(`Нормаль к плоскости $(${pn(p2)})$: $\\vec n_2 = ${vtex(n2)}$ ($\\vec n_2\\cdot${vecName(p2[0], p2[1])} = \\vec n_2\\cdot${vecName(p2[0], p2[2])} = 0$).`);
      lines.push(`$$\\cos\\varphi = \\dfrac{|\\vec n_1\\cdot\\vec n_2|}{|\\vec n_1|\\cdot|\\vec n_2|} = \\dfrac{${qLatex(qabs(ldot(g, n1, n2)))}}{${L(lnorm2(g, n1))}\\cdot ${L(lnorm2(g, n2))}} = ${value}.$$`);
      const { a, line } = angleAnswer(res.cos2, 'cos', 'cos', value);
      if (!qzero(res.cos2)) lines.push(`Тогда ${line}`);
      else lines.push('Плоскости перпендикулярны: $\\varphi = 90^\\circ$.');
      return {
        ops, coord: true,
        text: lines.join('\n\n'),
        answerLatex: a.latex, answerValue: a.deg,
        verify: (model) => {
          const m = (nm) => model.points[nm].pos;
          const nn = (p) => cross(sub(m(p[1]), m(p[0])), sub(m(p[2]), m(p[0])));
          const a1 = nn(p1);
          const a2 = nn(p2);
          return Math.abs(Math.abs(dot(a1, a2)) / (len(a1) * len(a2)) - Math.sqrt(qnum(res.cos2))) < 1e-7;
        },
      };
    }

    case 'distPointLine': {
      const [[p], l] = named;
      const h = fresh('H');
      ops.push({ id: 'c1', type: 'perp', from: p, ref: [...l], name: h, note: 'перпендикуляр к прямой' });
      const A = l[0];
      const u = vsub(P(l[1]), P(A));
      const w = vsub(P(p), P(A));
      const d = surdLatex(sqrtQ(res.value2));
      const [pt, at, ht] = [p, A, h].map(texName);
      lines.push(coordIntro(key, dims, lat, coordNames([p, ...l]), pos));
      lines.push(`$${vecName(A, l[1])} = ${vtex(u)}$, $${vecName(A, p)} = ${vtex(w)}$.`);
      lines.push(`Основание перпендикуляра $${ht}$ из точки $${pt}$ на прямую $${lineTex(l)}$: $${vecName(A, h)} = t\\cdot${vecName(A, l[1])}$, где $$t = \\dfrac{${vecName(A, p)}\\cdot${vecName(A, l[1])}}{|${vecName(A, l[1])}|^2} = \\dfrac{${qLatex(ldot(g, w, u))}}{${qLatex(lnorm2(g, u))}} = ${qLatex(res.t)},$$ откуда $${ptTex(h, res.H, g)}$.`);
      lines.push(`$$${chain(`\\rho = ${pt}${ht}`, `|${vecName(p, h)}|`, `\\sqrt{${qLatex(res.value2)}}`, d)}.$$`);
      return {
        ops, coord: true,
        text: lines.join('\n\n'),
        answerLatex: d, answerValue: surdValue(sqrtQ(res.value2)),
        verify: (model) => Math.abs(dist(model.points[p].pos, model.points[h].pos) - Math.sqrt(qnum(res.value2))) < 1e-7 * model.body.size,
      };
    }

    case 'distPointPlane': {
      const [[p], pl] = named;
      const h = fresh('H');
      ops.push({ id: 'c1', type: 'plane', pts: [...pl] });
      ops.push({ id: 'c2', type: 'perp', from: p, plane: [...pl], name: h, note: 'перпендикуляр к плоскости' });
      const n = nv(lnormal(g, vsub(P(pl[1]), P(pl[0])), vsub(P(pl[2]), P(pl[0]))));
      const D = qneg(ldot(g, n, P(pl[0])));
      const num = qabs(qadd(ldot(g, n, P(p)), D));
      const d = surdLatex(sqrtQ(res.value2));
      lines.push(coordIntro(key, dims, lat, coordNames([p, ...pl]), pos));
      lines.push(`Нормаль к плоскости $(${planeTex(pl)})$: $\\vec n = ${vtex(n)}$ ($\\vec n\\cdot${vecName(pl[0], pl[1])} = \\vec n\\cdot${vecName(pl[0], pl[2])} = 0$). Уравнение плоскости (через точку $${texName(pl[0])}$): $$${planeEquation(n, D, g)}.$$`);
      lines.push(`$$${chain('\\rho', '\\dfrac{|ax_0 + by_0 + cz_0 + d|}{\\sqrt{a^2 + b^2 + c^2}}', `\\dfrac{${qLatex(num)}}{${L(lnorm2(g, n))}}`, d)}.$$`);
      return {
        ops, coord: true,
        text: lines.join('\n\n'),
        answerLatex: d, answerValue: surdValue(sqrtQ(res.value2)),
        verify: (model) => Math.abs(dist(model.points[p].pos, model.points[h].pos) - Math.sqrt(qnum(res.value2))) < 1e-7 * model.body.size,
      };
    }

    case 'distSkew': {
      const [l1, l2] = named;
      // Точка K — основание общего перпендикуляра на первой прямой
      const kn = fresh('K');
      const h = fresh('H');
      const s = res.s;
      const ratioOk = qsign(s) > 0 && qnum(s) < 1;
      const kOp = { id: 'c1', type: 'pointOnLine', name: kn, ref: [...l1], t: qnum(s), note: 'основание общего перпендикуляра' };
      if (ratioOk) kOp.ratio = [Number(s.n), Number(s.d - s.n)];
      ops.push(kOp);
      ops.push({ id: 'c2', type: 'perp', from: kn, ref: [...l2], name: h, note: 'общий перпендикуляр' });
      const a = nv(res.u);
      const b = nv(res.v);
      const n = nv(lnormal(g, a, b));
      const w = vsub(P(l2[0]), P(l1[0]));
      const d = surdLatex(sqrtQ(res.value2));
      lines.push(coordIntro(key, dims, lat, coordNames([...l1, ...l2]), pos));
      lines.push(`Направляющие векторы: $\\vec a = ${vtex(a)} \\parallel ${vecName(...l1)}$, $\\vec b = ${vtex(b)} \\parallel ${vecName(...l2)}$. Вектор $\\vec n = ${vtex(n)}$ перпендикулярен обеим прямым: $\\vec n\\cdot\\vec a = \\vec n\\cdot\\vec b = 0$.`);
      lines.push(`Расстояние — проекция вектора $${vecName(l1[0], l2[0])} = ${vtex(w)}$ на $\\vec n$: $$${chain('\\rho', `\\dfrac{|${vecName(l1[0], l2[0])}\\cdot\\vec n|}{|\\vec n|}`, `\\dfrac{${qLatex(qabs(ldot(g, w, n)))}}{${L(lnorm2(g, n))}}`, d)}.$$`);
      lines.push(`На чертеже — общий перпендикуляр $${texName(kn)}${texName(h)}$.`);
      return {
        ops, coord: true,
        text: lines.join('\n\n'),
        answerLatex: d, answerValue: surdValue(sqrtQ(res.value2)),
        verify: (model) => {
          const K = model.points[kn].pos;
          const H = model.points[h].pos;
          const m = (nm) => model.points[nm].pos;
          const kh = sub(H, K);
          const u = sub(m(l1[1]), m(l1[0]));
          return Math.abs(len(kh) - Math.sqrt(qnum(res.value2))) < 1e-7 * model.body.size
            && Math.abs(dot(kh, u)) < 1e-7 * model.body.size * len(u);
        },
      };
    }

    case 'volume': {
      const [v] = named;
      const [A, B, C, Dn] = v;
      const e = [B, C, Dn].map((nm) => vsub(P(nm), P(A)));
      const det = cdet(e[0], e[1], e[2]);
      const detG = Q(BigInt(g[0]) * BigInt(g[1]) * BigInt(g[2]));
      const mixed = surdLatex(sqrtQ(qmul(qmul(det, det), detG)), { frac: 'frac' });
      const vol = surdLatex(sqrtQ(res.value2));
      lines.push(coordIntro(key, dims, lat, coordNames(v), pos));
      lines.push(`Рёбра пирамиды из вершины $${texName(A)}$: ${[B, C, Dn].map((nm, i) => `$${vecName(A, nm)} = ${vtex(e[i])}$`).join(', ')}.`);
      lines.push(`Объём пирамиды — шестая часть модуля смешанного произведения: $$V = \\dfrac16\\left|\\left(${vecName(A, B)}, ${vecName(A, C)}, ${vecName(A, Dn)}\\right)\\right| = \\dfrac16\\cdot ${mixed} = ${vol}.$$`);
      return {
        ops, coord: true,
        text: lines.join('\n\n'),
        answerLatex: vol, answerValue: surdValue(sqrtQ(res.value2)),
        verify: (model) => {
          const m = (nm) => model.points[nm].pos;
          const [x, y, z] = [B, C, Dn].map((nm) => sub(m(nm), m(A)));
          return Math.abs(Math.abs(dot(cross(x, y), z)) / 6 - Math.sqrt(qnum(res.value2))) < 1e-6 * Math.max(1, model.body.size ** 3);
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Угол между скрещивающимися прямыми переносом: ищем точку Y (вершину,
 * данную точку или середину ребра), для которой BY ∥ второй прямой, где B —
 * точка первой прямой. Тогда угол — в треугольнике OBY.
 */
function findTranslation(ctx) {
  const {
    lat, pos, named, topo, used, specials,
  } = ctx;
  const g = lat.g;
  const cands = [];
  for (const n of topo.order) cands.push({ name: n, pos: lat.vertices[n], score: 0 });
  for (const sp of specials) cands.push({ name: sp.name, pos: pos[sp.name], score: 1 });
  for (const e of topo.edges) {
    const o = orientEdge(topo, e, [1, 1]);
    const P = latticeEdgePoint(lat, o.edge, [1, 1]);
    if (cands.some((c) => c.pos.every((x, i) => qeq(x, P[i])))) continue;
    cands.push({ name: null, edge: o.edge, pos: P, score: 2 });
  }
  let best = null;
  for (const [bi, base] of named.entries()) {
    const other = named[1 - bi];
    const dir = vsub(pos[other[1]], pos[other[0]]);
    for (const [k, B] of base.entries()) {
      const O = base[1 - k];
      for (const c of cands) {
        if (c.name === B) continue;
        const w = vsub(c.pos, pos[B]);
        if (vzero(w) || !vparallel(w, dir)) continue;
        const lens = [lnorm2(g, vsub(pos[O], pos[B])), lnorm2(g, w), lnorm2(g, vsub(c.pos, pos[O]))];
        const score = c.score * 10 + lens.reduce((acc, r) => acc + surdComplexity(sqrtQ(r)), 0);
        if (!best || score < best.score) best = { score, B, O, c, base, other };
      }
    }
  }
  if (!best) return null;
  let Y = best.c.name;
  let newPoint = null;
  if (!Y) {
    Y = POINT_NAMES.find((n) => !used.has(n));
    if (!Y) return null;
    used.add(Y);
    pos[Y] = best.c.pos;
    newPoint = {
      op: { id: 'c0', type: 'pointOnLine', name: Y, ref: [...best.c.edge], t: 0.5, ratio: [1, 1] },
      text: `середина ребра $${best.c.edge.map(texName).join('')}$`,
    };
  }
  // OY — ребро тела? Тогда отрезок уже нарисован
  const isV = (n) => topo.order.includes(n);
  const oyEdge = isV(best.O) && isV(Y) && topo.edges.some((e) => e.includes(best.O) && e.includes(Y));
  return {
    B: best.B, O: best.O, Y, newPoint, base: best.base, other: best.other, oyEdge,
  };
}

// ─── запись банка ───────────────────────────────────────────────────────────

const LEVEL_DIFFICULTY = { 1: 2, 2: 3, 3: 4 };

/** Задание → geometry_tasks (origin = 'gen'). */
export function metricTaskToRecord(task, { code } = {}) {
  const typeDef = METRIC_TYPES[task.type];
  const def = GEN_BODIES[task.body];
  const solution = [
    task.solutionText,
    '',
    stereoBlockMarkdown(task.solutionScene, DEFAULT_CAMERA, { color: true }).trim(),
    '',
    `**Ответ:** ${task.answer}`,
  ].join('\n');
  return {
    code: code || `${typeDef.prefix}-${task.seed}`,
    title: `${typeDef.label}: ${def.short}`,
    statement_md: task.statement,
    answer: task.answer,
    solution_md: solution,
    hints: [{ order: 1, text_md: typeDef.hint }],
    drawing_view: 'svg',
    drawing_svg: stereoDrawingSvg(task.scene, DEFAULT_CAMERA),
    section: 'stereo',
    origin: 'gen',
    source: 'Генератор задач по стереометрии',
    difficulty: LEVEL_DIFFICULTY[task.level] || 3,
    task_type: '',
  };
}
