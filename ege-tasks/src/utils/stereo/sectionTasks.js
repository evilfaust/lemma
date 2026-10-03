// Генератор задач на сечения (GEOMETRY_TASKS_PLAN.md § 5).
//
// Как «Функции → задания по графику»: чертёж, ответ и решение даёт ОДНА
// модель — стереодвижок. Случайные M, N, K на рёбрах (на уровне 3 — одна в
// грани) с «хорошими» долями; сечение считает движок; построение методом
// следов собирается журналом шагов движка (тот же журнал, что у учителя в
// редакторе), поэтому решение показывается по шагам и уходит в эфир.
// Задание, которое модель не подтвердила (построение не сошлось с сечением),
// отбраковывается.
//
// Площадь сечения считается точно для любого тела каталога (genBodies.js):
// при рациональных долях точек вершины сечения лежат в «решётке» тела, а
// площадь = √(рациональное) → «k√m / q» (exact.js).

import { buildBody } from './bodies';
import { evaluateScene } from './scene';
import { planeFromPoints, sectionPolygon, intersectLinePlane, affineCoords } from './geometry';
import { sub, mul, add, dot, dist, distToLine, paramOnLine } from './vec3';
import { describeOp } from './commands';
import { stereoDrawingSvg, stereoBlockMarkdown } from './dsl';
import { DEFAULT_CAMERA } from './camera';
import {
  Q, qsub, qmul, qdiv, qsign, qzero, vadd, vsub, vscale, ccross, ldot, vreal, polygonArea2,
  sqrtQ, surdLatex, surdValue,
} from './exact';
import {
  GEN_BODIES, texName, texNames, scaleDims, maxDim, bodyIntro,
} from './genBodies';

export { texName };

/** Тела генератора сечений: чертёж для «Постройте сечение» — draw каталога. */
export const SECTION_BODIES = Object.fromEntries(Object.entries(GEN_BODIES).map(([key, b]) => [
  key, { label: b.label, short: b.short, spec: b.draw },
]));

export const SECTION_TYPES = {
  build: { label: 'Построить сечение' },
  area: { label: 'Площадь сечения' },
};

export const SECTION_LEVELS = {
  1: 'Простое — стороны соединяют данные точки',
  2: 'Среднее — нужен след или параллельная',
  3: 'Сложное — 5–6 вершин или точка в грани',
};

const RATIOS = [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1]];
const GIVEN_NAMES = ['M', 'N', 'K'];
const VERTEX_NAMES = ['L', 'P', 'Q', 'R', 'E', 'F', 'G'];
const TRACE_NAMES = ['X', 'Y', 'Z', 'T', 'U', 'V', 'W'];
const POLY_WORDS = {
  3: 'треугольник', 4: 'четырёхугольник', 5: 'пятиугольник', 6: 'шестиугольник', 7: 'семиугольник', 8: 'восьмиугольник',
};

/** Детерминированный ГПСЧ (mulberry32) — задание воспроизводится по seed. */
export function rng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

// ─── построение методом следов ────────────────────────────────────────────

/**
 * Журнал построения сечения по данным точкам.
 * @returns {{ ops, traces, parallels, names } | null} — null, если не сошлось
 */
export function constructSection(body, given, poly) {
  const size = body.size;
  const eps = 1e-6 * size;
  const inPlane = (f, p) => Math.abs(dot(f.n, p) - f.d) <= eps * 50;
  const used = new Set([...body.order, ...given.map((g) => g.name)]);
  const fresh = (list) => {
    const n = list.find((x) => !used.has(x));
    if (!n) return null;
    used.add(n);
    return n;
  };
  const known = given.map((g) => ({ name: g.name, pos: g.pos }));
  const nameAt = (p) => known.find((k) => dist(k.pos, p) <= eps * 100)?.name || null;
  const edgeOf = (p) => body.edges.find(([u, v]) => {
    const U = body.vertices[u];
    const D = sub(body.vertices[v], U);
    const t = paramOnLine(p, U, D);
    return t > 1e-6 && t < 1 - 1e-6 && distToLine(p, U, D) <= eps * 100;
  }) || null;

  // Стороны сечения и их грани
  const todo = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const face = body.faces.find((f) => inPlane(f, a) && inPlane(f, b));
    if (!face) return null;
    todo.push({ face, a, b });
  }

  const ops = [];
  const done = [];
  let seq = 0;
  const op = (o) => { seq += 1; const x = { id: `c${seq}`, ...o }; ops.push(x); return x; };
  let traces = 0;
  let parallels = 0;

  // Недостающие концы стороны — пересечением прямой (l1) с рёбрами грани
  const closeSide = (side, l1) => {
    for (const E of [side.a, side.b]) {
      if (nameAt(E)) continue;
      const edge = edgeOf(E);
      if (!edge) return false;
      const name = fresh(VERTEX_NAMES);
      if (!name) return false;
      op({ type: 'intersect', name, l1, l2: orientEdge(body, edge, [1, 1]).edge });
      known.push({ name, pos: E });
    }
    op({ type: 'segment', ref: [nameAt(side.a), nameAt(side.b)] });
    side.na = nameAt(side.a);
    side.nb = nameAt(side.b);
    done.push(side);
    todo.splice(todo.indexOf(side), 1);
    return true;
  };

  for (let iter = 0; todo.length && iter < 40; iter += 1) {
    // A. В грани две известные точки — сторона проводится сразу
    const ready = todo.find((s) => known.filter((k) => inPlane(s.face, k.pos)).length >= 2);
    if (ready) {
      const pts = known.filter((k) => inPlane(ready.face, k.pos));
      let best = [pts[0], pts[1]];
      for (const p of pts) for (const q of pts) if (dist(p.pos, q.pos) > dist(best[0].pos, best[1].pos)) best = [p, q];
      if (!closeSide(ready, [best[0].name, best[1].name])) return null;
      continue;
    }
    // B. Противоположная грань уже рассечена — сторона ей параллельна
    let advanced = false;
    for (const s of todo) {
      const Z = known.find((k) => inPlane(s.face, k.pos));
      const par = Z && done.find((d) => dot(d.face.n, s.face.n) < -0.999999);
      if (!par) continue;
      const p = op({ type: 'parallel', through: Z.name, ref: [par.na, par.nb] });
      parallels += 1;
      if (!closeSide(s, p.id)) return null;
      advanced = true;
      break;
    }
    if (advanced) continue;
    // C. След: продолжить готовую сторону до плоскости грани с одной точкой
    const cands = [];
    for (const s of todo) {
      const Z = known.find((k) => inPlane(s.face, k.pos));
      if (!Z) continue;
      for (const d of done) {
        if (Math.abs(dot(d.face.n, s.face.n)) > 0.999999) continue;
        const r = intersectLinePlane({ p: d.a, u: sub(d.b, d.a) }, { n: s.face.n, d: s.face.d }, size);
        if (r.kind !== 'point' || dist(r.point, Z.pos) < 0.05 * size || nameAt(r.point)) continue;
        cands.push({ s, d, T: r.point, far: dist(r.point, body.center) });
      }
    }
    if (!cands.length) return null;
    cands.sort((x, y) => x.far - y.far);
    const c = cands[0];
    if (c.far > 2.6 * size) return null; // след слишком далеко — чертёж не поместится
    const name = fresh(TRACE_NAMES);
    if (!name) return null;
    op({ type: 'trace', name, ref: [c.d.na, c.d.nb], plane: faceNames(body, c.s.face.verts) });
    known.push({ name, pos: c.T });
    traces += 1;
  }
  if (todo.length) return null;
  op({ type: 'section', pts: given.map((g) => g.name) });
  let names = poly.map((p) => nameAt(p));
  if (names.some((n) => !n)) return null;
  // Многоугольник — с первой данной точки (M…), обход тот же
  const m = names.indexOf(given[0].name);
  if (m > 0) names = [...names.slice(m), ...names.slice(0, m)];
  return { ops, traces, parallels, names };
}

// ─── точная площадь ──────────────────────────────────────────────────────

/** Точка на ребре в решётке: U + (W − U)·p/(p+q). */
export function latticeEdgePoint(lat, edge, ratio) {
  const U = lat.vertices[edge[0]];
  const W = lat.vertices[edge[1]];
  return vadd(U, vscale(vsub(W, U), Q(ratio[0], ratio[0] + ratio[1])));
}

/**
 * Квадрат площади сечения тела плоскостью трёх точек на рёбрах (точно).
 * Вершины сечения — пересечения плоскости с рёбрами (и вершины тела в ней);
 * обход — по углу вокруг центра, площадь — exact.polygonArea2.
 * @returns {{ area2, count }} | null
 */
export function exactSectionArea2(lat, edges, given) {
  const pts = given.map(({ edge, ratio }) => latticeEdgePoint(lat, edge, ratio));
  const c = ccross(vsub(pts[1], pts[0]), vsub(pts[2], pts[0]));
  if (c.every(qzero)) return null;
  const one = [1, 1, 1];
  const d = ldot(one, c, pts[0]);
  const sec = [];
  const push = (P) => { if (!sec.some((X) => X.every((x, i) => x.n === P[i].n && x.d === P[i].d))) sec.push(P); };
  for (const [u, w] of edges) {
    const U = lat.vertices[u];
    const W = lat.vertices[w];
    const du = qsub(ldot(one, c, U), d);
    const dw = qsub(ldot(one, c, W), d);
    if (qzero(du)) push(U);
    if (qzero(dw)) push(W);
    if (qsign(du) * qsign(dw) < 0) push(vadd(U, vscale(vsub(W, U), qdiv(du, qsub(du, dw)))));
  }
  if (sec.length < 3) return null;
  // Обход по углу в плоскости сечения (в настоящих координатах)
  const real = sec.map((P) => vreal(lat.g, P));
  const cx = real.reduce((acc, p) => acc.map((x, i) => x + p[i] / real.length), [0, 0, 0]);
  const e1 = real[0].map((x, i) => x - cx[i]);
  const e2raw = real[1].map((x, i) => x - cx[i]);
  const n = [e1[1] * e2raw[2] - e1[2] * e2raw[1], e1[2] * e2raw[0] - e1[0] * e2raw[2], e1[0] * e2raw[1] - e1[1] * e2raw[0]];
  const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const ang = real.map((p) => {
    const v = p.map((x, i) => x - cx[i]);
    return Math.atan2(v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2], v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]);
  });
  const order = sec.map((_, i) => i).sort((i, j) => ang[i] - ang[j]);
  return { area2: polygonArea2(lat.g, order.map((i) => sec[i])), count: sec.length };
}

/** √(площадь²) → { latex, value }; null — числа слишком велики. */
export function areaFromSquare(area2) {
  const s = sqrtQ(area2);
  return s ? { latex: surdLatex(s), value: surdValue(s), surd: s } : null;
}

/**
 * Площадь сечения куба с ребром a: { latex, value } (для совместимости;
 * общий случай — exactSectionArea2).
 * @param {Array<{edge:[string,string], ratio:[number,number]}>} given — точки на рёбрах
 */
export function exactCubeSectionArea(body, a, given) {
  const lat = GEN_BODIES.cube.lattice({ a });
  const r = exactSectionArea2(lat, body.edges, given);
  return r ? areaFromSquare(r.area2) : null;
}

// ─── генерация задания ────────────────────────────────────────────────────

// Ребро по-учебному: вершина пирамиды первой («SA»), иначе по алфавиту и
// индексу («A₁D₁», а не «D₁A₁»). Доля переворачивается вместе с ребром.
export function orientEdge(body, edge, ratio) {
  const apex = body.spec.kind === 'pyramid' || body.spec.kind === 'tetra' ? body.order[body.order.length - 1] : null;
  const key = (n) => [n.charCodeAt(0), Number(n.slice(1) || 0)];
  const [u, v] = edge;
  const flip = apex && (u === apex || v === apex)
    ? v === apex
    : key(u)[0] > key(v)[0] || (key(u)[0] === key(v)[0] && key(u)[1] > key(v)[1]);
  return flip ? { edge: [v, u], ratio: [ratio[1], ratio[0]] } : { edge: [u, v], ratio: [...ratio] };
}

// Грань по-учебному: вершина пирамиды первой («SAB»), иначе с наименьшей
// вершины основания, обход сохраняется («AA₁D₁D», а не «DAA₁D₁»). Движку
// порядок имён грани не важен (findFace ищет по набору).
export function faceNames(body, verts) {
  const apex = body.spec.kind === 'pyramid' || body.spec.kind === 'tetra' ? body.order[body.order.length - 1] : null;
  const rank = (n) => (n === apex ? -1 : body.order.indexOf(n));
  let start = 0;
  verts.forEach((n, i) => { if (rank(n) < rank(verts[start])) start = i; });
  const rot = [...verts.slice(start), ...verts.slice(0, start)];
  // из двух направлений обхода — то, где следующая вершина «меньше»
  const rev = [rot[0], ...rot.slice(1).reverse()];
  return rank(rev[1]) < rank(rot[1]) ? rev : rot;
}

// Ответ «по-школьному»: знаменатель до 4, под корнем до 150
const niceArea = (s) => s && s.q <= 4n && s.m <= 150n && s.k <= 999n;

export function describeGiven(g) {
  if (g.face) return `точка $${g.name}$ лежит в грани $${texNames(g.face)}$`;
  const [u, v] = g.edge;
  const [p, q] = g.ratio;
  if (p === q) return `точка $${g.name}$ — середина ребра $${texNames([u, v])}$`;
  return `точка $${g.name}$ лежит на ребре $${texNames([u, v])}$, причём $${texName(u)}${g.name}:${g.name}${texName(v)} = ${p}:${q}$`;
}

function classify(c, poly, hasFacePoint) {
  if (c.traces + c.parallels === 0 && !hasFacePoint) return 1;
  if (poly.length >= 5 || c.traces >= 2 || hasFacePoint) return 3;
  return 2;
}

// Масштаб тела для площади: размеры до 12, ответ — «школьный». Площадь²
// растёт как k⁴, поэтому достаточно пересчитать квадрат.
function pickAreaScale(rand, shape, area2) {
  const options = [];
  for (let k = 1; maxDim(shape) * k <= 12; k += 1) {
    const s = sqrtQ(qmul(area2, Q(k ** 4)));
    if (niceArea(s) && maxDim(shape) * k >= 2) options.push(k);
  }
  return options.length ? pick(rand, options) : null;
}

/**
 * Сгенерировать задание на сечение.
 * @param {{ body: string, type: 'build'|'area', level: 1|2|3, seed: number }} opts —
 *   body — ключ каталога GEN_BODIES
 * @returns {object|null} — null, если за отведённые попытки подходящее не нашлось
 */
export function generateSectionTask({ body: bodyKey = 'cube', type = 'build', level = 2, seed = 1, attempts = 3000 } = {}) {
  const bodyK = bodyKey in GEN_BODIES ? bodyKey : 'cube';
  const def = GEN_BODIES[bodyK];
  const kind = type === 'area' ? 'area' : 'build';
  // У треугольных пирамид сечение — не больше четырёхугольника, а точку в
  // грани для площади не взять (её место задано только рисунком): самое
  // сложное, что есть, — уровень 2.
  const want = kind === 'area' && def.n === 3 && !def.prism ? Math.min(level, 2) : level;
  const rand = rng(seed);
  // Площадь — с числами: форма тела из каталога, масштаб — под ответ
  let shape = null;
  let body = buildBody(def.draw);
  let size = body.size;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Площадь: форма тела из каталога; не выходит «школьный» ответ — другая форма
    if (kind === 'area' && attempt % 300 === 0) {
      shape = def.shape(rand);
      body = buildBody(def.spec(shape));
      size = body.size;
    }
    const useFace = kind === 'build' && want === 3 && rand() < 0.4;
    const edges = [...body.edges].sort(() => rand() - 0.5).slice(0, useFace ? 2 : 3);
    const given = edges.map((rawEdge, i) => {
      const { edge, ratio } = orientEdge(body, rawEdge, pick(rand, RATIOS));
      const t = ratio[0] / (ratio[0] + ratio[1]);
      const U = body.vertices[edge[0]];
      const W = body.vertices[edge[1]];
      return {
        name: GIVEN_NAMES[i], edge, ratio, t, pos: add(U, mul(sub(W, U), t)),
        op: { id: `g${i}`, type: 'pointOnLine', name: GIVEN_NAMES[i], ref: [...edge], t, ratio: [...ratio] },
      };
    });
    if (useFace) {
      const face = pick(rand, body.faces);
      const w = face.verts.map(() => 1 + Math.floor(rand() * 3));
      const sw = w.reduce((x, y) => x + y, 0);
      const pos = face.verts.reduce((acc, v, i) => add(acc, mul(body.vertices[v], w[i] / sw)), { x: 0, y: 0, z: 0 });
      const [A, B, C] = face.verts.slice(0, 3).map((v) => body.vertices[v]);
      const st = affineCoords(A, B, C, pos);
      if (!st) continue;
      given.push({
        name: 'K', face: faceNames(body, face.verts), pos,
        op: { id: 'g2', type: 'pointOnFace', name: 'K', face: [...face.verts], s: st.s, t: st.t },
      });
    }
    // Две точки на одной грани с третьей «на ней же» дают сечение-грань
    const plane = planeFromPoints(given[0].pos, given[1].pos, given[2].pos, size);
    if (!plane) continue;
    if (body.faces.some((f) => Math.abs(dot(f.n, plane.n)) > 0.999999 && Math.abs(f.d - dot(f.n, given[0].pos)) < 1e-6 * size)) continue;
    const poly = sectionPolygon(body, plane);
    if (poly.length < 3) continue;
    // Без вершин тела в сечении и без «слипшихся» точек — чертёж читается
    if (poly.some((p) => body.order.some((v) => dist(p, body.vertices[v]) < 0.06 * size))) continue;
    let tight = false;
    for (let i = 0; i < poly.length; i += 1) if (dist(poly[i], poly[(i + 1) % poly.length]) < 0.12 * size) tight = true;
    if (tight) continue;
    if (given.some((g) => !poly.some((p) => dist(p, g.pos) < 1e-6 * size) && g.face === undefined)) continue;

    const c = constructSection(body, given, poly);
    if (!c) continue;
    const lv = classify(c, poly, useFace);
    if (lv !== want) continue;

    // Площадь — точно; масштаб тела подбирается под «школьный» ответ
    let dims = null;
    let area = null;
    if (kind === 'area') {
      const exact = exactSectionArea2(def.lattice(shape), body.edges, given);
      if (!exact || exact.count !== poly.length) continue;
      const k = pickAreaScale(rand, shape, exact.area2);
      if (!k) continue;
      dims = scaleDims(shape, k);
      area = areaFromSquare(qmul(exact.area2, Q(k ** 4)));
    }
    const spec = dims ? def.spec(dims) : def.draw;

    const givenOps = given.map((g) => g.op);
    const scene = { body: spec, ops: givenOps };
    const solutionScene = { body: spec, ops: [...givenOps, ...c.ops] };
    // Модель подтверждает: все шаги без ошибок, сечение то же
    const model = evaluateScene(solutionScene);
    if (model.steps.some((s) => !s.ok)) continue;
    if (area) {
      const sec = model.polys.find((p) => p.kind === 'section');
      if (!sec || Math.abs(polyAreaFloat(sec.pts) - area.value) > 1e-6 * Math.max(1, area.value)) continue;
    }

    const polyName = c.names.join('');
    const word = POLY_WORDS[poly.length] || `${poly.length}-угольник`;

    const points = given.map(describeGiven);
    const intro = bodyIntro(bodyK, model.body.order, dims, kind === 'area');
    const planeTex = `${given.map((g) => g.name).join('')}`;
    const pointsText = `${points.join(', ')}${useFace ? ' (см. рисунок)' : ''}.`;
    const statement = kind === 'area'
      ? `${intro} ${pointsText[0].toUpperCase()}${pointsText.slice(1)} Найдите площадь сечения ${def.gen} плоскостью $${planeTex}$.`
      : `${intro} ${pointsText[0].toUpperCase()}${pointsText.slice(1)} Постройте сечение ${def.gen} плоскостью $${planeTex}$.`;

    return {
      family: 'section',
      seed, body: bodyK, type: kind, level: want, dims, a: dims?.a ?? null,
      scene, solutionScene, model,
      given: given.map(({ name, edge, ratio, face }) => ({ name, edge, ratio, face })),
      polygon: { count: poly.length, word, names: c.names },
      traces: c.traces, parallels: c.parallels,
      statement,
      answer: kind === 'area' ? `$${area.latex}$` : `${word[0].toUpperCase()}${word.slice(1)} $${c.names.map(texName).join('')}$`,
      area,
      polyName,
      tag: word,
      facets: [def.facet, 'Сечение многогранника', ...(kind === 'area' ? ['Площадь сечения'] : [])],
    };
  }
  return null;
}

/** Площадь плоского многоугольника модели (числами, для сверки). */
function polyAreaFloat(pts) {
  let s = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pts.length; i += 1) {
    const P = pts[i];
    const R = pts[(i + 1) % pts.length];
    s = add(s, { x: P.y * R.z - P.z * R.y, y: P.z * R.x - P.x * R.z, z: P.x * R.y - P.y * R.x });
  }
  return Math.hypot(s.x, s.y, s.z) / 2;
}

/** Шаги построения (без данных точек) — для текста решения. */
export function constructionSteps(task) {
  return task.solutionScene.ops.slice(task.scene.ops.length);
}

/** Признак «задание сошлось» для тестов: точки построения = вершины сечения. */
export function verifySectionTask(task) {
  const model = evaluateScene(task.solutionScene);
  if (model.steps.some((s) => !s.ok)) return false;
  const poly = model.polys.find((p) => p.kind === 'section');
  if (!poly || poly.pts.length !== task.polygon.count) return false;
  return task.polygon.names.every((n) => {
    const pt = model.points[n];
    return pt && poly.pts.some((p) => dist(p, pt.pos) < 1e-4 * model.body.size);
  });
}

// ─── задание → запись банка (geometry_tasks, origin = 'gen') ──────────────

const LEVEL_DIFFICULTY = { 1: 2, 2: 3, 3: 4 };

/**
 * Запись геометрической задачи из сгенерированного задания. Чертёж условия —
 * SVG с исходником (в карточке задачи он крутится), решение — шаги построения
 * текстом + блок ```stereo со всем построением (цветной: сечение выделено).
 */
export function sectionTaskToRecord(task, { code } = {}) {
  const ops = task.solutionScene.ops;
  const opsById = Object.fromEntries(ops.map((o) => [o.id, o]));
  const steps = constructionSteps(task);
  const lines = steps.map((op, i) => `${i + 1}. ${describeOp(op, opsById)}`);
  const tricky = steps.find((op) => op.type === 'trace' || op.type === 'parallel');
  const body = SECTION_BODIES[task.body];
  const hasFace = task.given.some((g) => g.face);
  const solution = [
    '**Построение**',
    '',
    ...lines,
    '',
    stereoBlockMarkdown(task.solutionScene, DEFAULT_CAMERA, { color: true }).trim(),
    '',
    `**Ответ:** ${task.answer}`,
    ...(task.area ? ['', `$S \\approx ${task.area.value.toFixed(2).replace('.', '{,}')}$`] : []),
  ].join('\n');
  return {
    code: code || `SEC-${task.seed}`,
    title: `${task.type === 'area' ? 'Площадь сечения' : 'Сечение'}: ${body.short}, ${task.polygon.word}`,
    statement_md: task.statement,
    answer: task.answer,
    solution_md: solution,
    hints: tricky
      ? [{ order: 1, text_md: tricky.type === 'trace'
        ? `Найдите след: ${describeOp(tricky, opsById)}.`
        : `Воспользуйтесь параллельностью граней: ${describeOp(tricky, opsById)}.` }]
      : [],
    drawing_view: 'svg',
    drawing_svg: stereoDrawingSvg(task.scene, DEFAULT_CAMERA),
    section: 'stereo',
    origin: 'gen',
    source: 'Генератор сечений',
    difficulty: LEVEL_DIFFICULTY[task.level] || 3,
    task_type: hasFace ? 'ready' : '',
  };
}
