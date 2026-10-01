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
// Площадь сечения куба считается точно — в рациональных числах (BigInt):
// при целом ребре и рациональных долях координаты вершин сечения
// рациональны, а площадь = √(рациональное) → «k√m / q».

import { buildBody } from './bodies';
import { evaluateScene } from './scene';
import { planeFromPoints, sectionPolygon, intersectLinePlane, affineCoords } from './geometry';
import { sub, mul, add, dot, dist, distToLine, paramOnLine } from './vec3';
import { describeOp } from './commands';
import { stereoDrawingSvg, stereoBlockMarkdown } from './dsl';
import { DEFAULT_CAMERA } from './camera';

export const SECTION_BODIES = {
  cube: { label: 'Куб', short: 'куб', spec: { kind: 'cube', a: 4 } },
  prism3: { label: 'Правильная треугольная призма', short: 'призма', spec: { kind: 'prism', n: 3, a: 4, h: 4.8 } },
  pyramid4: { label: 'Правильная четырёхугольная пирамида', short: 'пирамида', spec: { kind: 'pyramid', n: 4, a: 4, h: 4.4, apex: 'S' } },
  tetra: { label: 'Тетраэдр', short: 'тетраэдр', spec: { kind: 'tetra', a: 4, apex: 'D' } },
};

export const SECTION_TYPES = {
  build: { label: 'Построить сечение' },
  area: { label: 'Площадь сечения (куб)' },
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
const POLY_WORDS = { 3: 'треугольник', 4: 'четырёхугольник', 5: 'пятиугольник', 6: 'шестиугольник' };

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

/** «A1» → «A_1» для LaTeX. */
export const texName = (name) => String(name).replace(/(\d+)/, '_{$1}').replace(/_\{(\d)\}/, '_$1');
const texNames = (arr) => arr.map(texName).join('');

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
      op({ type: 'intersect', name, l1, l2: [...edge] });
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
    op({ type: 'trace', name, ref: [c.d.na, c.d.nb], plane: [...c.s.face.verts] });
    known.push({ name, pos: c.T });
    traces += 1;
  }
  if (todo.length) return null;
  op({ type: 'section', pts: given.map((g) => g.name) });
  const names = poly.map((p) => nameAt(p));
  if (names.some((n) => !n)) return null;
  return { ops, traces, parallels, names };
}

// ─── точная площадь (куб) ─────────────────────────────────────────────────

const bgcd = (a, b) => { let x = a < 0n ? -a : a; let y = b < 0n ? -b : b; while (y) [x, y] = [y, x % y]; return x || 1n; };
const F = (n, d = 1n) => {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd < 0n) { nn = -nn; dd = -dd; }
  const g = bgcd(nn, dd);
  return { n: nn / g, d: dd / g };
};
const fa = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fs = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fm = (a, b) => F(a.n * b.n, a.d * b.d);
const fdiv = (a, b) => F(a.n * b.d, a.d * b.n);
const fsign = (a) => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);
const V = (x, y, z) => ({ x, y, z });
const vs = (a, b) => V(fs(a.x, b.x), fs(a.y, b.y), fs(a.z, b.z));
const va = (a, b) => V(fa(a.x, b.x), fa(a.y, b.y), fa(a.z, b.z));
const vm = (a, k) => V(fm(a.x, k), fm(a.y, k), fm(a.z, k));
const vdot = (a, b) => fa(fa(fm(a.x, b.x), fm(a.y, b.y)), fm(a.z, b.z));
const vcross = (a, b) => V(
  fs(fm(a.y, b.z), fm(a.z, b.y)),
  fs(fm(a.z, b.x), fm(a.x, b.z)),
  fs(fm(a.x, b.y), fm(a.y, b.x)),
);

/** √N = k·√m (m без квадратов). */
function sqrtParts(N) {
  let k = 1n;
  let m = N;
  for (let p = 2n; p * p <= m; p += 1n) {
    while (m % (p * p) === 0n) { m /= p * p; k *= p; }
  }
  return { k, m };
}

/**
 * Площадь сечения куба с ребром a: { latex, value }.
 * @param {Array<{edge:[string,string], ratio:[number,number]}>} given — точки на рёбрах
 * @param {Array<{x,y,z}>} polyOrder — вершины сечения движка (задают обход)
 */
export function exactCubeSectionArea(body, a, given, polyOrder) {
  // Вершины куба в рамке [0, a]³ (движок центрирует тело в нуле)
  const vx = {};
  for (const name of body.order) {
    const p = body.vertices[name];
    vx[name] = V(F(p.x > 0 ? a : 0), F(p.y > 0 ? a : 0), F(p.z > 0 ? a : 0));
  }
  const pts = given.map(({ edge, ratio }) => va(vx[edge[0]], vm(vs(vx[edge[1]], vx[edge[0]]), F(ratio[0], ratio[0] + ratio[1]))));
  const n = vcross(vs(pts[1], pts[0]), vs(pts[2], pts[0]));
  const d = vdot(n, pts[0]);
  const sec = [];
  for (const [u, w] of body.edges) {
    const du = fs(vdot(n, vx[u]), d);
    const dw = fs(vdot(n, vx[w]), d);
    if (fsign(du) * fsign(dw) < 0) {
      const t = fdiv(du, fs(du, dw));
      sec.push(va(vx[u], vm(vs(vx[w], vx[u]), t)));
    }
  }
  // Порядок обхода — как у сечения движка (сопоставление по ближайшей точке)
  const scale = a / body.spec.a;
  const toWorld = (p) => ({
    x: (Number(p.x.n) / Number(p.x.d)) / scale - body.spec.a / 2,
    y: (Number(p.y.n) / Number(p.y.d)) / scale - body.spec.a / 2,
    z: (Number(p.z.n) / Number(p.z.d)) / scale - body.spec.a / 2,
  });
  const ordered = polyOrder.map((P) => sec.reduce((best, q) => (dist(toWorld(q), P) < dist(toWorld(best), P) ? q : best), sec[0]));
  let S = V(F(0), F(0), F(0));
  for (let i = 0; i < ordered.length; i += 1) S = va(S, vcross(ordered[i], ordered[(i + 1) % ordered.length]));
  // |S|/2: площадь² = (Sx² + Sy² + Sz²) / 4
  const q2 = fdiv(vdot(S, S), F(4));
  const { k: k0, m } = sqrtParts(q2.n * q2.d);
  const g = bgcd(k0, q2.d);
  const k = k0 / g;
  const q = q2.d / g;
  const num = m === 1n ? `${k}` : `${k === 1n ? '' : k}\\sqrt{${m}}`;
  const latex = q === 1n ? num : `\\dfrac{${num}}{${q}}`;
  const value = (Number(k) * Math.sqrt(Number(m))) / Number(q);
  return { latex, value };
}

// ─── генерация задания ────────────────────────────────────────────────────

const lcm = (a, b) => { const g = Number(bgcd(BigInt(a), BigInt(b))); return (a / g) * b; };

// Ребро по-учебному: вершина пирамиды первой («SA»), иначе по алфавиту и
// индексу («A₁D₁», а не «D₁A₁»). Доля переворачивается вместе с ребром.
function orientEdge(body, edge, ratio) {
  const apex = body.spec.kind === 'pyramid' || body.spec.kind === 'tetra' ? body.order[body.order.length - 1] : null;
  const key = (n) => [n.charCodeAt(0), Number(n.slice(1) || 0)];
  const [u, v] = edge;
  const flip = apex
    ? v === apex
    : key(u)[0] > key(v)[0] || (key(u)[0] === key(v)[0] && key(u)[1] > key(v)[1]);
  return flip ? { edge: [v, u], ratio: [ratio[1], ratio[0]] } : { edge: [u, v], ratio: [...ratio] };
}

// Ответ «по-школьному»: знаменатель до 4, под корнем до 150
const niceArea = (latex) => {
  const den = latex.startsWith('\\dfrac') ? /\{(\d+)\}$/.exec(latex) : null;
  const root = /\\sqrt\{(\d+)\}/.exec(latex);
  return (!den || Number(den[1]) <= 4) && (!root || Number(root[1]) <= 150);
};

function describeGiven(g) {
  if (g.face) return `точка $${g.name}$ лежит в грани $${texNames(g.face)}$`;
  const [u, v] = g.edge;
  const [p, q] = g.ratio;
  if (p === q) return `точка $${g.name}$ — середина ребра $${texNames([u, v])}$`;
  return `точка $${g.name}$ лежит на ребре $${texNames([u, v])}$, причём $${texName(u)}${g.name}:${g.name}${texName(v)} = ${p}:${q}$`;
}

function bodyIntro(key, body, a) {
  const names = texNames(body.order);
  if (key === 'cube') return a ? `Ребро куба $${names}$ равно $${a}$.` : `Дан куб $${names}$.`;
  if (key === 'prism3') return `Дана правильная треугольная призма $${names}$.`;
  if (key === 'pyramid4') {
    const apex = body.order[body.order.length - 1];
    return `Дана правильная четырёхугольная пирамида $${texName(apex)}${texNames(body.order.slice(0, -1))}$.`;
  }
  return `Дан тетраэдр $${texName(body.order[body.order.length - 1])}${texNames(body.order.slice(0, -1))}$.`;
}

function classify(c, poly, hasFacePoint) {
  if (c.traces + c.parallels === 0 && !hasFacePoint) return 1;
  if (poly.length >= 5 || c.traces >= 2 || hasFacePoint) return 3;
  return 2;
}

/**
 * Сгенерировать задание на сечение.
 * @param {{ body: 'cube'|'prism3'|'pyramid4'|'tetra', type: 'build'|'area', level: 1|2|3, seed: number }} opts
 * @returns {object|null} — null, если за отведённые попытки подходящее не нашлось
 */
export function generateSectionTask({ body: bodyKey = 'cube', type = 'build', level = 2, seed = 1, attempts = 3000 } = {}) {
  const def = SECTION_BODIES[bodyKey] || SECTION_BODIES.cube;
  const kind = type === 'area' ? 'area' : 'build';
  const bodyK = kind === 'area' ? 'cube' : bodyKey in SECTION_BODIES ? bodyKey : 'cube';
  const spec = (SECTION_BODIES[bodyK] || def).spec;
  const body = buildBody(spec);
  const rand = rng(seed);
  const size = body.size;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const useFace = kind === 'build' && level === 3 && rand() < 0.4;
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
        name: 'K', face: [...face.verts], pos,
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
    if (lv !== level) continue;

    const givenOps = given.map((g) => g.op);
    const scene = { body: spec, ops: givenOps };
    const solutionScene = { body: spec, ops: [...givenOps, ...c.ops] };
    // Модель подтверждает: все шаги без ошибок, сечение то же
    const model = evaluateScene(solutionScene);
    if (model.steps.some((s) => !s.ok)) continue;

    const polyName = c.names.join('');
    const word = POLY_WORDS[poly.length] || `${poly.length}-угольник`;
    let a = null;
    let area = null;
    if (kind === 'area') {
      const L = given.reduce((acc, g) => lcm(acc, g.ratio[0] + g.ratio[1]), 1);
      const options = [];
      for (let m = L; m <= 12; m += L) if (m >= 3) options.push(m);
      if (!options.length) options.push(L);
      a = pick(rand, options);
      area = exactCubeSectionArea(body, a, given, poly);
      if (!niceArea(area.latex)) continue;
    }

    const points = given.map(describeGiven);
    const intro = bodyIntro(bodyK, body, a);
    const what = bodyK === 'cube' ? 'куба' : bodyK === 'prism3' ? 'призмы' : bodyK === 'pyramid4' ? 'пирамиды' : 'тетраэдра';
    const planeTex = `${given.map((g) => g.name).join('')}`;
    const pointsText = `${points.join(', ')}${useFace ? ' (см. рисунок)' : ''}.`;
    const statement = kind === 'area'
      ? `${intro} ${pointsText[0].toUpperCase()}${pointsText.slice(1)} Найдите площадь сечения куба плоскостью $${planeTex}$.`
      : `${intro} ${pointsText[0].toUpperCase()}${pointsText.slice(1)} Постройте сечение ${what} плоскостью $${planeTex}$.`;

    return {
      seed, body: bodyK, type: kind, level, a,
      scene, solutionScene, model,
      given: given.map(({ name, edge, ratio, face }) => ({ name, edge, ratio, face })),
      polygon: { count: poly.length, word, names: c.names },
      traces: c.traces, parallels: c.parallels,
      statement,
      answer: kind === 'area' ? `$${area.latex}$` : `${word[0].toUpperCase()}${word.slice(1)} $${c.names.map(texName).join('')}$`,
      area,
      polyName,
    };
  }
  return null;
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
