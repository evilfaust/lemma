// Сцена стереочертежа = тело + журнал операций построения.
//
// Каждая операция ссылается только на то, что уже есть (точки — по имени,
// прямые — парой имён или id операции «параллельная»), поэтому модель
// целиком пересчитывается из журнала: отмена = убрать последнюю операцию,
// пошаговый просмотр = первые k операций, эфир = передать журнал.
//
// Операция с ошибкой ничего не создаёт; её текст показывается учителю
// («MN и AD скрещиваются — общей точки нет»).

import { add, sub, mul, dot, len, dist, paramOnLine, distToLine } from './vec3';
import {
  buildBody, findFace, prettyName, normalizeBodySpec, POINT_NAME_RE,
} from './bodies';
import {
  intersectLines, intersectLinePlane, planeFromPoints, sectionPolygon, orderPolygon,
  affinePoint,
} from './geometry';

export const OP_TYPES = [
  'pointOnLine', 'pointOnFace', 'segment', 'line', 'intersect', 'trace', 'parallel', 'section', 'plane', 'fill',
];

/** Прямая-ссылка: пара имён точек или id операции «параллельная». */
export function isPairRef(ref) {
  return Array.isArray(ref) && ref.length === 2;
}

let idSeq = 0;
/** Уникальный id операции. */
export function newOpId() {
  idSeq += 1;
  return `o${Date.now().toString(36)}${idSeq.toString(36)}`;
}

/** Имя прямой для текста: «MN», «A₁C». */
export function refName(ref, opsById = {}) {
  if (isPairRef(ref)) return ref.map(prettyName).join('');
  const op = opsById[ref];
  if (op?.type === 'parallel') return `через ${prettyName(op.through)} ∥ ${refName(op.ref, opsById)}`;
  return '?';
}

function sameLine(p1, u1, p2, u2, eps) {
  const c = len({
    x: u1.y * u2.z - u1.z * u2.y,
    y: u1.z * u2.x - u1.x * u2.z,
    z: u1.x * u2.y - u1.y * u2.x,
  });
  if (c > 1e-9 * len(u1) * len(u2)) return false;
  return distToLine(p2, p1, u1) <= eps;
}

/**
 * Вычисляет модель сцены.
 * @param {{ body: object, ops: object[] }} scene
 * @param {{ upTo?: number }} [opts] — учесть только первые upTo операций
 */
export function evaluateScene(scene, opts = {}) {
  const body = buildBody(scene?.body);
  const allOps = Array.isArray(scene?.ops) ? scene.ops : [];
  // upTo — пошаговый просмотр: из опций или из самой сцены (так учитель
  // «отматывает» эфир — ученик получает сцену с upTo).
  const upTo = Number.isFinite(opts.upTo) ? opts.upTo : Number.isFinite(scene?.upTo) ? scene.upTo : null;
  const ops = upTo != null ? allOps.slice(0, Math.max(0, upTo)) : allOps;
  const eps = 1e-6 * body.size;

  const points = {};
  const pointOrder = [];
  const lines = [];
  const polys = [];
  const steps = [];
  const lineDefs = {};
  const opsById = {};
  ops.forEach((op, i) => { opsById[op.id || `s${i}`] = op; });

  for (const name of body.order) {
    points[name] = { name, pos: body.vertices[name], kind: 'vertex', step: -1 };
    pointOrder.push(name);
  }
  for (const [a, b] of body.edges) {
    const A = body.vertices[a];
    const B = body.vertices[b];
    lines.push({ id: `edge:${a}-${b}`, kind: 'edge', ref: [a, b], a: A, b: B, p: A, u: sub(B, A), step: -1 });
  }

  // --- вспомогательные --------------------------------------------------

  const fail = (msg) => { throw new StepError(msg); };

  const pointPos = (name) => {
    const pt = points[name];
    if (!pt) fail(`Нет точки ${prettyName(name)}`);
    return pt.pos;
  };

  const resolveLine = (ref) => {
    if (isPairRef(ref)) {
      const A = pointPos(ref[0]);
      const B = pointPos(ref[1]);
      if (dist(A, B) <= eps) fail(`Точки ${prettyName(ref[0])} и ${prettyName(ref[1])} совпадают`);
      return { p: A, u: sub(B, A), pair: true };
    }
    const def = lineDefs[ref];
    if (!def) fail('Нет такой прямой');
    return { ...def, pair: false };
  };

  const resolvePlane = (names) => {
    if (!Array.isArray(names) || names.length < 3) fail('Плоскость задаётся тремя точками');
    const pts = names.map(pointPos);
    const face = names.every((n) => body.vertices[n]) ? findFace(body, names) : null;
    if (face) return { plane: { n: face.n, d: face.d }, face };
    let plane = null;
    for (let i = 2; i < pts.length && !plane; i++) plane = planeFromPoints(pts[0], pts[1], pts[i], body.size);
    if (!plane) fail(`Точки ${names.map(prettyName).join(', ')} лежат на одной прямой`);
    if (pts.some((p) => Math.abs(dot(plane.n, p) - plane.d) > 1e-5 * body.size)) {
      fail(`Точки ${names.map(prettyName).join(', ')} не лежат в одной плоскости`);
    }
    return { plane, face: null };
  };

  const addPoint = (name, pos, stepIdx, created) => {
    if (!name || !/^[A-Z][0-9]*$/.test(name)) fail('Имя точки — латинская буква (и цифры)');
    if (points[name]) fail(`Имя ${prettyName(name)} уже занято`);
    const same = pointOrder.find((n) => !points[n].alias && dist(points[n].pos, pos) <= eps * 10);
    if (same) {
      // Точка совпала с уже построенной — это она и есть: имя становится
      // синонимом, а на чертеже ничего нового не появляется.
      points[name] = { name, pos: points[same].pos, kind: 'point', step: stepIdx, alias: same };
      pointOrder.push(name);
      created.note = `Это точка ${prettyName(same)}`;
      return;
    }
    points[name] = { name, pos, kind: 'point', step: stepIdx };
    pointOrder.push(name);
    created.points.push(name);
  };

  // Прямая, на которой построена точка, должна быть видна на чертеже до
  // этой точки: если её нет — дорисовываем, если есть, но точка на
  // продолжении — дорисовываем продолжение.
  const ensureCoverage = (L, ref, t, stepIdx, created, color) => {
    if (!L.pair) return; // «параллельная» рисуется прямой, охватывает всё сама
    const onLine = lines.filter((o) => sameLine(o.p, o.u, L.p, L.u, eps * 10));
    if (onLine.some((o) => o.kind === 'line')) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const o of onLine) {
      const ta = paramOnLine(o.a, L.p, L.u);
      const tb = paramOnLine(o.b, L.p, L.u);
      lo = Math.min(lo, ta, tb);
      hi = Math.max(hi, ta, tb);
    }
    const tol = 1e-6;
    const segs = [];
    if (!onLine.length) {
      segs.push([Math.min(0, t), Math.max(1, t)]);
    } else if (t < lo - tol) {
      segs.push([t, lo]);
    } else if (t > hi + tol) {
      segs.push([hi, t]);
    }
    segs.forEach(([t0, t1], k) => {
      const id = `${created.opId}:ext${k}`;
      lines.push({
        id, kind: 'ext', ref, a: add(L.p, mul(L.u, t0)), b: add(L.p, mul(L.u, t1)),
        p: L.p, u: L.u, step: stepIdx, color,
      });
      created.lines.push(id);
    });
  };

  // --- журнал -------------------------------------------------------------

  ops.forEach((op, stepIdx) => {
    const opId = op.id || `s${stepIdx}`;
    const created = { opId, points: [], lines: [], polys: [], note: null };
    const step = { index: stepIdx, op, ok: true, error: null, created };
    try {
      switch (op.type) {
        case 'pointOnLine': {
          const L = resolveLine(op.ref);
          const t = Number(op.t);
          if (!Number.isFinite(t)) fail('Не задано положение точки');
          ensureCoverage(L, op.ref, t, stepIdx, created, op.color);
          addPoint(op.name, add(L.p, mul(L.u, t)), stepIdx, created);
          break;
        }
        case 'pointOnFace': {
          // Точка внутри грани (плоскости): аффинные координаты по трём первым
          // точкам — при повороте и сдвиге вершин точка остаётся в плоскости.
          if (!Array.isArray(op.face) || op.face.length < 3) fail('Грань задаётся тремя точками');
          resolvePlane(op.face);
          const [A, B, C] = op.face.slice(0, 3).map(pointPos);
          const s = Number(op.s);
          const t = Number(op.t);
          if (!Number.isFinite(s) || !Number.isFinite(t)) fail('Не задано положение точки');
          addPoint(op.name, affinePoint(A, B, C, s, t), stepIdx, created);
          break;
        }
        case 'segment':
        case 'line': {
          const L = resolveLine(op.ref);
          if (!isPairRef(op.ref)) fail('Прямая задаётся двумя точками');
          lines.push({
            id: opId, kind: op.type, ref: op.ref, a: L.p, b: add(L.p, L.u),
            p: L.p, u: L.u, step: stepIdx, color: op.color,
          });
          created.lines.push(opId);
          break;
        }
        case 'parallel': {
          const src = resolveLine(op.ref);
          const P = pointPos(op.through);
          if (distToLine(P, src.p, src.u) <= eps * 10) {
            fail(`Точка ${prettyName(op.through)} лежит на прямой ${refName(op.ref, opsById)}`);
          }
          lineDefs[opId] = { p: P, u: src.u };
          lines.push({
            id: opId, kind: 'line', ref: opId, a: P, b: add(P, src.u),
            p: P, u: src.u, step: stepIdx, color: op.color,
          });
          created.lines.push(opId);
          break;
        }
        case 'intersect': {
          const L1 = resolveLine(op.l1);
          const L2 = resolveLine(op.l2);
          const r = intersectLines(L1, L2, body.size);
          const n1 = refName(op.l1, opsById);
          const n2 = refName(op.l2, opsById);
          if (r.kind === 'skew') fail(`Прямые ${n1} и ${n2} скрещиваются — общей точки нет`);
          if (r.kind === 'parallel') fail(`Прямые ${n1} и ${n2} параллельны — общей точки нет`);
          if (r.kind === 'same') fail(`Прямые ${n1} и ${n2} совпадают`);
          ensureCoverage(L1, op.l1, r.t1, stepIdx, created, op.color);
          ensureCoverage(L2, op.l2, r.t2, stepIdx, created, op.color);
          addPoint(op.name, r.point, stepIdx, created);
          break;
        }
        case 'trace': {
          const L = resolveLine(op.ref);
          const { plane } = resolvePlane(op.plane);
          const r = intersectLinePlane(L, plane, body.size);
          const pn = `(${op.plane.map(prettyName).join('')})`;
          const ln = refName(op.ref, opsById);
          if (r.kind === 'parallel') fail(`Прямая ${ln} параллельна плоскости ${pn}`);
          if (r.kind === 'inside') fail(`Прямая ${ln} лежит в плоскости ${pn}`);
          ensureCoverage(L, op.ref, r.t, stepIdx, created, op.color);
          addPoint(op.name, r.point, stepIdx, created);
          break;
        }
        case 'section':
        case 'plane': {
          const { plane, face } = resolvePlane(op.pts);
          const poly = face ? face.verts.map((v) => body.vertices[v]) : sectionPolygon(body, plane);
          if (poly.length < 3) fail('Плоскость не пересекает тело');
          polys.push({ id: opId, kind: op.type, pts: poly, step: stepIdx, color: op.color, faceId: face?.id || null });
          created.polys.push(opId);
          break;
        }
        case 'fill': {
          const { plane } = resolvePlane(op.pts);
          const pts = orderPolygon(op.pts.map(pointPos), plane.n);
          polys.push({ id: opId, kind: 'fill', pts, step: stepIdx, color: op.color });
          created.polys.push(opId);
          break;
        }
        default:
          fail(`Неизвестная операция: ${op.type}`);
      }
    } catch (e) {
      if (!(e instanceof StepError)) throw e;
      step.ok = false;
      step.error = e.message;
      // Частично созданное (дорисованное продолжение) откатываем.
      for (const id of created.lines) {
        const k = lines.findIndex((o) => o.id === id);
        if (k >= 0) lines.splice(k, 1);
      }
      created.lines = [];
      created.points = [];
      created.polys = [];
    }
    steps.push(step);
  });

  // --- протяжённость прямых ----------------------------------------------
  // Прямая рисуется через все свои точки и чуть дальше крайних.
  const margin = 0.18 * body.size;
  for (const o of lines) {
    if (o.kind !== 'line') continue;
    const ul = len(o.u);
    const ts = isPairRef(o.ref) ? [0, 1] : [0];
    for (const n of pointOrder) {
      const pt = points[n];
      if (pt.alias) continue;
      if (distToLine(pt.pos, o.p, o.u) <= eps * 10) ts.push(paramOnLine(pt.pos, o.p, o.u));
    }
    let lo = Math.min(...ts) - margin / ul;
    let hi = Math.max(...ts) + margin / ul;
    const minLen = (0.9 * body.size) / ul;
    if (hi - lo < minLen) {
      const mid = (lo + hi) / 2;
      lo = mid - minLen / 2;
      hi = mid + minLen / 2;
    }
    o.a = add(o.p, mul(o.u, lo));
    o.b = add(o.p, mul(o.u, hi));
  }

  // Описанная сфера всего чертежа (центр — середина габаритного ящика):
  // от неё масштаб камеры. Сфера не зависит от поворота — при вращении
  // чертёж не «дышит»; а след, ушедший далеко от тела, сдвигает центр к себе,
  // и тело не сжимается в точку.
  const all = [];
  for (const n of pointOrder) all.push(points[n].pos);
  for (const o of lines) all.push(o.a, o.b);
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const P of all) {
    lo.x = Math.min(lo.x, P.x); lo.y = Math.min(lo.y, P.y); lo.z = Math.min(lo.z, P.z);
    hi.x = Math.max(hi.x, P.x); hi.y = Math.max(hi.y, P.y); hi.z = Math.max(hi.z, P.z);
  }
  const viewCenter = mul(add(lo, hi), 0.5);
  let radius = 0;
  for (const P of all) radius = Math.max(radius, dist(P, viewCenter));

  // Цвета точек — оформление, не шаг: scene.colors = { M: 'red' }.
  const colors = scene?.colors && typeof scene.colors === 'object' ? scene.colors : {};
  for (const [name, color] of Object.entries(colors)) {
    if (points[name] && color) points[name].color = color;
  }

  return {
    body, points, pointOrder, lines, polys, steps, opsById,
    radius, viewCenter, center: body.center,
  };
}

class StepError extends Error {}

/** Ошибка последней операции (для проверки перед добавлением в журнал). */
export function tryAppendOp(scene, op) {
  const next = { ...scene, ops: [...(scene?.ops || []), op] };
  const model = evaluateScene(next);
  const last = model.steps[model.steps.length - 1];
  return { ok: last.ok, error: last.error, note: last.created.note, scene: next, model };
}

/** Все имена точек, использованные в операции. */
export function opPointNames(op) {
  const out = [];
  const fromRef = (r) => { if (isPairRef(r)) out.push(...r); };
  switch (op.type) {
    case 'pointOnLine': fromRef(op.ref); break;
    case 'pointOnFace': out.push(...(op.face || [])); break;
    case 'segment': case 'line': fromRef(op.ref); break;
    case 'parallel': fromRef(op.ref); out.push(op.through); break;
    case 'intersect': fromRef(op.l1); fromRef(op.l2); break;
    case 'trace': fromRef(op.ref); out.push(...(op.plane || [])); break;
    case 'section': case 'plane': case 'fill': out.push(...(op.pts || [])); break;
    default: break;
  }
  return out;
}

/**
 * Удалить операцию вместе со всем, что от неё зависит.
 * @returns {{ scene, removed: string[] }} removed — id удалённых операций
 */
export function removeOpCascade(scene, opId) {
  const ops = scene?.ops || [];
  const idx = ops.findIndex((o) => o.id === opId);
  if (idx < 0) return { scene, removed: [] };
  const deadNames = new Set();
  const deadIds = new Set([opId]);
  const mark = (op) => {
    if (op.name) deadNames.add(op.name);
    deadIds.add(op.id);
  };
  mark(ops[idx]);
  for (let i = idx + 1; i < ops.length; i++) {
    const op = ops[i];
    const usesName = opPointNames(op).some((n) => deadNames.has(n));
    const usesLine = [op.ref, op.l1, op.l2].some((r) => typeof r === 'string' && deadIds.has(r));
    if (usesName || usesLine) mark(op);
  }
  const next = { ...scene, ops: ops.filter((o) => !deadIds.has(o.id)) };
  if (scene?.colors) next.colors = withoutKeys(scene.colors, deadNames);
  return {
    scene: next,
    removed: ops.filter((o) => deadIds.has(o.id)).map((o) => o.id),
  };
}

/** Переименовать точку во всём журнале. Вершины тела не переименовываются. */
export function renamePointInScene(scene, from, to) {
  const swap = (n) => (n === from ? to : n);
  const swapRef = (r) => (isPairRef(r) ? r.map(swap) : r);
  const ops = (scene?.ops || []).map((op) => {
    const o = { ...op };
    if (o.name) o.name = swap(o.name);
    if (o.through) o.through = swap(o.through);
    if (o.ref) o.ref = swapRef(o.ref);
    if (o.l1) o.l1 = swapRef(o.l1);
    if (o.l2) o.l2 = swapRef(o.l2);
    if (o.plane) o.plane = o.plane.map(swap);
    if (o.face) o.face = o.face.map(swap);
    if (o.pts) o.pts = o.pts.map(swap);
    return o;
  });
  const next = { ...scene, ops };
  if (scene?.colors) {
    next.colors = Object.fromEntries(Object.entries(scene.colors).map(([k, v]) => [swap(k), v]));
  }
  return next;
}

/**
 * Переименовать любую точку — построенную или вершину тела. Вершина меняет
 * имя в самом теле (scene.body.names), построения и цвета переписываются.
 * @returns {{ scene } | { error }}
 */
export function renamePoint(scene, from, to) {
  if (!POINT_NAME_RE.test(to || '')) return { error: 'Имя — латинская буква, можно с цифрами: K, M1' };
  const model = evaluateScene(scene);
  const pt = model.points[from];
  if (!pt) return { error: `Нет точки ${prettyName(from)}` };
  if (from === to) return { scene };
  if (model.points[to]) return { error: `Имя ${prettyName(to)} уже занято` };
  const next = renamePointInScene(scene, from, to);
  if (pt.kind === 'vertex') {
    const names = model.body.order.map((n) => (n === from ? to : n));
    next.body = { ...normalizeBodySpec(scene.body), names };
  }
  return { scene: next };
}

function withoutKeys(obj, keys) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.has(k)));
}

/**
 * Покрасить точки (или снять цвет: color = '' / null). Цвет — оформление,
 * в журнал шагов не попадает. Пустой объект colors из сцены убирается.
 */
export function setPointColors(scene, names, color) {
  const colors = { ...(scene?.colors || {}) };
  for (const n of names) {
    if (color) colors[n] = color; else delete colors[n];
  }
  const next = { ...scene, colors };
  if (!Object.keys(colors).length) delete next.colors;
  return next;
}
