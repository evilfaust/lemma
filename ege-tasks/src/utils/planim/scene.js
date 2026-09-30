// Сцена планиметрического чертежа = журнал операций построения.
//
// Как и в стереочертежах (utils/stereo/scene.js), каждая операция ссылается
// только на уже существующее — точки по имени, прямые и окружности
// выражениями (refs.js), — поэтому модель целиком пересчитывается из журнала:
// отмена = убрать шаг, показ по шагам = первые k операций, перетаскивание
// точки = поменять её координаты и пересчитать.
//
// Тела нет: чертёж начинается со свободных точек (type: 'point'), их можно
// двигать. Операция с ошибкой ничего не создаёт; её текст показывается
// учителю («Прямые AB и CD параллельны — общей точки нет»).

import {
  add, sub, mul, cross, len, dist, unit, rot90, paramOnLine, distToLine,
} from './vec2';
import {
  isPairRef, refNames, mapRefNames, lineRefPretty, circleRefPretty, circleRefKey,
  prettyName, NAME_RE,
} from './refs';
import {
  intersectLines, lineCircle, circleCircle, circumcircle, incircle, tangentPoints, angleDeg,
} from './geometry';

export const OP_TYPES = [
  'point', 'pointOnLine', 'pointOnCircle', 'intersect', 'lineCircle', 'circleCircle',
  'foot', 'center', 'tangent',
  'segment', 'line', 'ray', 'parallel', 'perp', 'bisector', 'polygon',
  'circle', 'fill', 'angle', 'tick', 'measure', 'text',
];

let idSeq = 0;
/** Уникальный id операции. */
export function newOpId() {
  idSeq += 1;
  return `p${Date.now().toString(36)}${idSeq.toString(36)}`;
}

class StepError extends Error {}

function sameLine(p1, u1, p2, u2, tol) {
  if (Math.abs(cross(u1, u2)) > 1e-9 * len(u1) * len(u2)) return false;
  return distToLine(p2, p1, u1) <= tol;
}

/** Размер чертежа по свободным точкам — от него считаются допуски. */
function baseSize(ops) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const op of ops) {
    if (op?.type !== 'point') continue;
    const x = Number(op.x);
    const y = Number(op.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const d = Number.isFinite(x0) ? Math.hypot(x1 - x0, y1 - y0) : 0;
  return d > 0 ? d : 4;
}

/** Ключ отрезка между двумя точками — без учёта порядка: «A-B». */
export const segKey = (a, b) => [a, b].sort().join('-');

/**
 * Вычисляет модель сцены.
 * @param {{ ops: object[], colors?, segStyles?, hidden?, labelAngles? }} scene
 * @param {{ upTo?: number }} [opts] — учесть только первые upTo операций
 */
export function evaluateScene(scene, opts = {}) {
  const allOps = Array.isArray(scene?.ops) ? scene.ops : [];
  const upTo = Number.isFinite(opts.upTo) ? opts.upTo : Number.isFinite(scene?.upTo) ? scene.upTo : null;
  const ops = upTo != null ? allOps.slice(0, Math.max(0, upTo)) : allOps;
  const size0 = baseSize(allOps);
  const tol = 1e-6 * size0;

  const points = {};
  const pointOrder = [];
  const lines = [];
  const circles = [];
  const polys = [];
  const angles = [];
  const ticks = [];
  const measures = [];
  const texts = [];
  const steps = [];
  const centers = {}; // ключ окружности → имя её центра (шаг «центр»)

  // --- вспомогательные --------------------------------------------------

  const fail = (msg) => { throw new StepError(msg); };
  const P = prettyName;

  const pointPos = (name) => {
    const pt = points[name];
    if (!pt) fail(`Нет точки ${P(name)}`);
    return pt.pos;
  };

  const lineOf = (ref) => {
    if (isPairRef(ref)) {
      const A = pointPos(ref[0]);
      const B = pointPos(ref[1]);
      if (dist(A, B) <= tol) fail(`Точки ${P(ref[0])} и ${P(ref[1])} совпадают`);
      return { p: A, u: sub(B, A) };
    }
    switch (ref?.k) {
      case 'par': return { p: pointPos(ref.p), u: lineOf(ref.ref).u };
      case 'perp': return { p: pointPos(ref.p), u: rot90(lineOf(ref.ref).u) };
      case 'bis': {
        if (!Array.isArray(ref.pts) || ref.pts.length !== 3) fail('Угол задаётся тремя точками');
        const [A, V, B] = ref.pts.map(pointPos);
        if (dist(A, V) <= tol || dist(B, V) <= tol) fail(`Угол ${ref.pts.map(P).join('')} вырожден`);
        const a = unit(sub(A, V));
        let d = add(a, unit(sub(B, V)));
        if (len(d) < 1e-9) d = rot90(a); // развёрнутый угол — биссектриса перпендикулярна
        return { p: V, u: mul(unit(d), Math.min(dist(A, V), dist(B, V))) };
      }
      default: return fail('Нет такой прямой');
    }
  };

  const circleOf = (ref) => {
    switch (ref?.k) {
      case 'cp': {
        const O = pointPos(ref.o);
        const r = dist(O, pointPos(ref.a));
        if (r <= tol) fail(`Точки ${P(ref.o)} и ${P(ref.a)} совпадают — радиус нулевой`);
        return { c: O, r };
      }
      case 'cr': {
        const r = Number(ref.r);
        if (!(r > 0)) fail('Радиус должен быть положительным');
        return { c: pointPos(ref.o), r };
      }
      case 'circum':
      case 'in': {
        if (!Array.isArray(ref.pts) || ref.pts.length !== 3) fail('Окружность треугольника — по трём вершинам');
        const [A, B, C] = ref.pts.map(pointPos);
        const res = ref.k === 'circum' ? circumcircle(A, B, C, tol) : incircle(A, B, C, tol);
        if (!res) fail(`Точки ${ref.pts.map(P).join(', ')} лежат на одной прямой — треугольника нет`);
        return res;
      }
      default: return fail('Нет такой окружности');
    }
  };

  const addPoint = (name, pos, stepIdx, created, kind = 'point') => {
    if (!name || !NAME_RE.test(name)) fail('Имя точки — латинская буква (и цифры)');
    if (points[name]) fail(`Имя ${P(name)} уже занято`);
    const same = pointOrder.find((n) => !points[n].alias && dist(points[n].pos, pos) <= tol * 10);
    if (same) {
      // Точка совпала с уже построенной — это она и есть: имя становится
      // синонимом, а на чертеже ничего нового не появляется.
      points[name] = { name, pos: points[same].pos, kind, step: stepIdx, alias: same };
      pointOrder.push(name);
      created.points.push(name);
      created.note = `Это точка ${P(same)}`;
      return;
    }
    points[name] = { name, pos, kind, step: stepIdx };
    pointOrder.push(name);
    created.points.push(name);
  };

  // Точка построена на продолжении уже нарисованного отрезка (основание
  // высоты тупоугольного треугольника) — отрезок дорисовывается до неё.
  // Если на этой прямой ничего не нарисовано, ничего и не появляется.
  const ensureCoverage = (L, ref, t, stepIdx, created) => {
    const onLine = lines.filter((o) => sameLine(o.p, o.u, L.p, L.u, tol * 10));
    if (!onLine.length || onLine.some((o) => o.kind === 'line')) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const o of onLine) {
      const ta = paramOnLine(o.a, L.p, L.u);
      const tb = paramOnLine(o.b, L.p, L.u);
      if (o.kind === 'ray') {
        if (tb > ta) { lo = Math.min(lo, ta); hi = Infinity; } else { hi = Math.max(hi, ta); lo = -Infinity; }
      } else {
        lo = Math.min(lo, ta, tb);
        hi = Math.max(hi, ta, tb);
      }
    }
    const e = 1e-9;
    let seg = null;
    if (t < lo - e) seg = [t, lo];
    else if (t > hi + e) seg = [hi, t];
    if (!seg) return;
    const id = `${created.opId}:ext${created.lines.length}`;
    lines.push({
      id, kind: 'ext', ref, a: add(L.p, mul(L.u, seg[0])), b: add(L.p, mul(L.u, seg[1])),
      p: L.p, u: L.u, step: stepIdx,
    });
    created.lines.push(id);
  };

  const needPair = (ref, what) => { if (!isPairRef(ref)) fail(what); };
  const pushLine = (id, kind, ref, L, stepIdx, created) => {
    lines.push({ id, kind, ref, a: L.p, b: add(L.p, L.u), p: L.p, u: L.u, step: stepIdx });
    created.lines.push(id);
  };

  // --- журнал -------------------------------------------------------------

  ops.forEach((op, stepIdx) => {
    const opId = op.id || `s${stepIdx}`;
    const created = { opId, points: [], lines: [], circles: [], polys: [], marks: [], note: null };
    const step = { index: stepIdx, op, ok: true, error: null, created };
    const mark = {
      lines: lines.length, circles: circles.length, polys: polys.length,
      angles: angles.length, ticks: ticks.length, measures: measures.length, texts: texts.length,
      order: pointOrder.length,
    };
    try {
      switch (op.type) {
        case 'point': {
          const x = Number(op.x);
          const y = Number(op.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) fail('Не заданы координаты точки');
          addPoint(op.name, { x, y }, stepIdx, created, 'free');
          break;
        }
        case 'pointOnLine': {
          const L = lineOf(op.ref);
          const t = Number(op.t);
          if (!Number.isFinite(t)) fail('Не задано положение точки');
          ensureCoverage(L, op.ref, t, stepIdx, created);
          addPoint(op.name, add(L.p, mul(L.u, t)), stepIdx, created);
          break;
        }
        case 'pointOnCircle': {
          const C = circleOf(op.circle);
          const a = (Number(op.angle) * Math.PI) / 180;
          if (!Number.isFinite(a)) fail('Не задан угол точки на окружности');
          addPoint(op.name, { x: C.c.x + C.r * Math.cos(a), y: C.c.y + C.r * Math.sin(a) }, stepIdx, created);
          break;
        }
        case 'intersect': {
          const L1 = lineOf(op.l1);
          const L2 = lineOf(op.l2);
          const r = intersectLines(L1, L2, tol);
          const n1 = lineRefPretty(op.l1);
          const n2 = lineRefPretty(op.l2);
          if (r.kind === 'parallel') fail(`Прямые ${n1} и ${n2} параллельны — общей точки нет`);
          if (r.kind === 'same') fail(`Прямые ${n1} и ${n2} совпадают`);
          ensureCoverage(L1, op.l1, r.t1, stepIdx, created);
          ensureCoverage(L2, op.l2, r.t2, stepIdx, created);
          addPoint(op.name, r.point, stepIdx, created);
          break;
        }
        case 'lineCircle': {
          const L = lineOf(op.ref);
          const C = circleOf(op.circle);
          const hits = lineCircle(L, C, tol);
          if (!hits.length) fail(`Прямая ${lineRefPretty(op.ref)} не пересекает окружность`);
          const hit = hits[Math.min(op.k ? 1 : 0, hits.length - 1)];
          ensureCoverage(L, op.ref, hit.t, stepIdx, created);
          addPoint(op.name, hit.point, stepIdx, created);
          break;
        }
        case 'circleCircle': {
          const r = circleCircle(circleOf(op.c1), circleOf(op.c2), tol);
          if (r.kind === 'same') fail('Окружности совпадают');
          if (r.kind === 'none') fail('Окружности не пересекаются');
          addPoint(op.name, r.points[Math.min(op.k ? 1 : 0, r.points.length - 1)], stepIdx, created);
          break;
        }
        case 'foot': {
          const A = pointPos(op.from);
          const L = lineOf(op.ref);
          if (distToLine(A, L.p, L.u) <= tol * 10) {
            fail(`Точка ${P(op.from)} лежит на прямой ${lineRefPretty(op.ref)} — перпендикуляр не опустить`);
          }
          const t = paramOnLine(A, L.p, L.u);
          ensureCoverage(L, op.ref, t, stepIdx, created);
          addPoint(op.name, add(L.p, mul(L.u, t)), stepIdx, created);
          break;
        }
        case 'center': {
          const C = circleOf(op.circle);
          addPoint(op.name, C.c, stepIdx, created);
          const key = circleRefKey(op.circle);
          centers[key] = centers[key] || op.name;
          for (const c of circles) if (c.key === key && !c.centerName) c.centerName = op.name;
          break;
        }
        case 'tangent': {
          const A = pointPos(op.from);
          const C = circleOf(op.circle);
          const r = tangentPoints(A, C, tol * 10);
          if (r.kind === 'inside') fail(`Точка ${P(op.from)} внутри окружности — касательной нет`);
          if (r.kind === 'on') {
            fail(`Точка ${P(op.from)} лежит на окружности: касательная в ней — перпендикуляр к радиусу`);
          }
          addPoint(op.name, r.points[op.k ? 1 : 0], stepIdx, created);
          break;
        }
        case 'segment':
        case 'line':
        case 'ray': {
          needPair(op.ref, 'Задаётся двумя точками');
          pushLine(opId, op.type, op.ref, lineOf(op.ref), stepIdx, created);
          break;
        }
        case 'parallel': {
          const base = lineOf(op.ref);
          if (distToLine(pointPos(op.through), base.p, base.u) <= tol * 10) {
            fail(`Точка ${P(op.through)} лежит на прямой ${lineRefPretty(op.ref)}`);
          }
          const ref = { k: 'par', p: op.through, ref: op.ref };
          pushLine(opId, 'line', ref, lineOf(ref), stepIdx, created);
          break;
        }
        case 'perp': {
          const ref = { k: 'perp', p: op.through, ref: op.ref };
          pushLine(opId, 'line', ref, lineOf(ref), stepIdx, created);
          break;
        }
        case 'bisector': {
          const ref = { k: 'bis', pts: op.pts };
          pushLine(opId, 'ray', ref, lineOf(ref), stepIdx, created);
          break;
        }
        case 'polygon': {
          if (!Array.isArray(op.pts) || op.pts.length < 3) fail('Многоугольник — не меньше трёх точек');
          if (new Set(op.pts).size !== op.pts.length) fail('Вершины многоугольника не должны повторяться');
          op.pts.forEach((a, i) => {
            const ref = [a, op.pts[(i + 1) % op.pts.length]];
            pushLine(`${opId}:s${i}`, 'side', ref, lineOf(ref), stepIdx, created);
          });
          break;
        }
        case 'circle': {
          const C = circleOf(op.circle);
          const key = circleRefKey(op.circle);
          circles.push({
            id: opId, ref: op.circle, key, c: C.c, r: C.r, step: stepIdx,
            color: op.color || null, dash: !!op.dash,
            centerName: op.circle.o || centers[key] || null,
          });
          created.circles.push(opId);
          break;
        }
        case 'fill': {
          if (!Array.isArray(op.pts) || op.pts.length < 3) fail('Многоугольник — не меньше трёх точек');
          polys.push({ id: opId, names: op.pts, pts: op.pts.map(pointPos), step: stepIdx, color: op.color || null });
          created.polys.push(opId);
          break;
        }
        case 'angle': {
          if (!Array.isArray(op.pts) || op.pts.length !== 3) fail('Угол задаётся тремя точками: «угол ABC» (вершина — средняя)');
          const [A, V, B] = op.pts.map(pointPos);
          if (dist(A, V) <= tol || dist(B, V) <= tol) fail(`Угол ${op.pts.map(P).join('')} вырожден`);
          const deg = angleDeg(A, V, B);
          angles.push({
            id: opId, names: op.pts, A, V, B, deg,
            arcs: Math.min(3, Math.max(1, Math.round(Number(op.arcs) || 1))),
            label: op.label ? String(op.label) : '',
            right: !!op.right || Math.abs(deg - 90) < 0.01,
            step: stepIdx,
          });
          created.marks.push(opId);
          break;
        }
        case 'tick': {
          if (!Array.isArray(op.segs) || !op.segs.length) fail('Какие отрезки отметить: «равны AB CD»');
          op.segs.forEach((seg, i) => {
            needPair(seg, 'Отрезок — две точки');
            const L = lineOf(seg);
            ticks.push({
              id: `${opId}:${i}`, opId, names: seg, a: L.p, b: add(L.p, L.u),
              n: Math.min(3, Math.max(1, Math.round(Number(op.n) || 1))), step: stepIdx,
            });
          });
          created.marks.push(opId);
          break;
        }
        case 'measure': {
          needPair(op.ref, 'Отрезок — две точки: «длина AB 5»');
          const L = lineOf(op.ref);
          const text = String(op.text ?? '').trim();
          if (!text) fail('Нет подписи отрезка');
          measures.push({ id: opId, names: op.ref, a: L.p, b: add(L.p, L.u), text, step: stepIdx });
          created.marks.push(opId);
          break;
        }
        case 'text': {
          const x = Number(op.x);
          const y = Number(op.y);
          const text = String(op.text ?? '').trim();
          if (!Number.isFinite(x) || !Number.isFinite(y)) fail('Не заданы координаты надписи');
          if (!text) fail('Пустая надпись');
          texts.push({ id: opId, pos: { x, y }, text, step: stepIdx });
          created.marks.push(opId);
          break;
        }
        default:
          fail(`Неизвестная операция: ${op.type}`);
      }
    } catch (e) {
      if (!(e instanceof StepError)) throw e;
      step.ok = false;
      step.error = e.message;
      // Частично созданное откатываем.
      lines.length = mark.lines;
      circles.length = mark.circles;
      polys.length = mark.polys;
      angles.length = mark.angles;
      ticks.length = mark.ticks;
      measures.length = mark.measures;
      texts.length = mark.texts;
      for (const n of pointOrder.splice(mark.order)) delete points[n];
      Object.assign(created, { points: [], lines: [], circles: [], polys: [], marks: [], note: null });
    }
    steps.push(step);
  });

  // --- размер чертежа ------------------------------------------------------
  const real = pointOrder.filter((n) => !points[n].alias);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (b, x, y) => {
    b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y);
    b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
  };
  for (const n of real) grow(box, points[n].pos.x, points[n].pos.y);
  for (const c of circles) { grow(box, c.c.x - c.r, c.c.y - c.r); grow(box, c.c.x + c.r, c.c.y + c.r); }
  const diag = Number.isFinite(box.x0) ? Math.hypot(box.x1 - box.x0, box.y1 - box.y0) : 0;
  const size = diag > 0 ? diag : 4;

  // --- протяжённость прямых и лучей ------------------------------------------
  // Прямая рисуется через все свои точки и чуть дальше крайних; луч — от
  // начала через все свои точки и чуть дальше.
  const margin = 0.16 * size;
  for (const o of lines) {
    if (o.kind !== 'line' && o.kind !== 'ray') continue;
    const ul = len(o.u);
    const ts = isPairRef(o.ref) ? [0, 1] : [0, o.kind === 'ray' ? 1 : 0];
    for (const n of real) {
      const pt = points[n];
      if (distToLine(pt.pos, o.p, o.u) <= tol * 10) ts.push(paramOnLine(pt.pos, o.p, o.u));
    }
    let lo = Math.min(...ts) - margin / ul;
    let hi = Math.max(...ts) + margin / ul;
    if (o.kind === 'ray') lo = 0;
    const minLen = ((o.kind === 'ray' ? 0.45 : 0.7) * size) / ul;
    if (hi - lo < minLen) {
      if (o.kind === 'ray') hi = lo + minLen;
      else {
        const mid = (lo + hi) / 2;
        lo = mid - minLen / 2;
        hi = mid + minLen / 2;
      }
    }
    o.a = add(o.p, mul(o.u, lo));
    o.b = add(o.p, mul(o.u, hi));
  }

  // --- оформление -------------------------------------------------------------
  const colors = scene?.colors && typeof scene.colors === 'object' ? scene.colors : {};
  for (const [name, color] of Object.entries(colors)) {
    if (points[name] && color) points[name].color = color;
  }
  const hidden = Array.isArray(scene?.hidden) ? scene.hidden : [];
  for (const name of hidden) if (points[name]) points[name].hidden = true;
  const labelAngles = scene?.labelAngles && typeof scene.labelAngles === 'object' ? scene.labelAngles : {};
  for (const [name, a] of Object.entries(labelAngles)) {
    if (points[name] && Number.isFinite(Number(a))) points[name].labelAngle = Number(a);
  }
  // Стиль отрезка — кусок прямой между двумя точками: цвет и/или пунктир.
  // Ложится на любую нарисованную линию, на которой лежит кусок.
  const segStyles = scene?.segStyles && typeof scene.segStyles === 'object' ? scene.segStyles : {};
  for (const [key, st] of Object.entries(segStyles)) {
    const [a, b] = String(key).split('-');
    const A = points[a]?.pos;
    const B = points[b]?.pos;
    if (!st || !A || !B || dist(A, B) <= tol) continue;
    const u = sub(B, A);
    for (const o of lines) {
      if (!sameLine(o.p, o.u, A, u, tol * 10)) continue;
      const d = sub(o.b, o.a);
      let t0 = paramOnLine(A, o.a, d);
      let t1 = paramOnLine(B, o.a, d);
      if (t0 > t1) [t0, t1] = [t1, t0];
      t0 = Math.max(0, t0);
      t1 = Math.min(1, t1);
      if (t1 - t0 <= 1e-9) continue;
      (o.ranges = o.ranges || []).push({ t0, t1, color: st.color || null, dash: !!st.dash });
    }
  }

  // «Угловая» точка — вершина, в которой сходятся отрезки: на печатном чертеже
  // её не рисуют жирной точкой (только буква). Точка внутри отрезка и центр
  // окружности — рисуются.
  for (const n of real) {
    const pt = points[n];
    let inner = false;
    const dirs = [];
    for (const o of lines) {
      const d = sub(o.b, o.a);
      const dl = len(d);
      if (dl <= tol || distToLine(pt.pos, o.a, d) > tol * 10) continue;
      const t = paramOnLine(pt.pos, o.a, d);
      const e = (tol * 10) / dl;
      if (t > e && t < 1 - e) inner = true;
      else if (Math.abs(t) <= e || Math.abs(t - 1) <= e) {
        if (!dirs.some((q) => Math.abs(cross(q, d)) <= 1e-9 * len(q) * dl)) dirs.push(d);
      }
    }
    const isCenter = circles.some((c) => dist(c.c, pt.pos) <= tol * 10);
    pt.corner = !inner && !isCenter && dirs.length >= 2;
  }

  // Габариты всего нарисованного (без скрытых точек) — для вписывания в кадр.
  const bbox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const n of real) if (!points[n].hidden) grow(bbox, points[n].pos.x, points[n].pos.y);
  for (const o of lines) { grow(bbox, o.a.x, o.a.y); grow(bbox, o.b.x, o.b.y); }
  for (const c of circles) { grow(bbox, c.c.x - c.r, c.c.y - c.r); grow(bbox, c.c.x + c.r, c.c.y + c.r); }
  for (const t of texts) grow(bbox, t.pos.x, t.pos.y);
  for (const pg of polys) for (const q of pg.pts) grow(bbox, q.x, q.y);

  let cx = 0;
  let cy = 0;
  for (const n of real) { cx += points[n].pos.x; cy += points[n].pos.y; }
  const center = real.length ? { x: cx / real.length, y: cy / real.length } : { x: 0, y: 0 };

  const safe = (fn) => (ref) => {
    try { return fn(ref); } catch (e) { if (e instanceof StepError) return null; throw e; }
  };

  return {
    points, pointOrder, lines, circles, polys, angles, ticks, measures, texts, steps,
    size, tol, center, bbox: Number.isFinite(bbox.x0) ? bbox : null,
    lineOf: safe(lineOf), circleOf: safe(circleOf),
  };
}

/** Добавить операции в журнал; все должны построиться. */
export function tryAppendOps(scene, opsIn) {
  const add1 = Array.isArray(opsIn) ? opsIn : [opsIn];
  const base = scene?.ops || [];
  const next = { ...scene, ops: [...base, ...add1] };
  const model = evaluateScene(next);
  const fresh = model.steps.slice(base.length);
  const bad = fresh.find((st) => !st.ok);
  const note = fresh.map((st) => st.created.note).find(Boolean) || null;
  return { ok: !bad, error: bad ? bad.error : null, note, scene: next, model };
}

export const tryAppendOp = tryAppendOps;

/** Имена точек, на которые операция опирается (не те, что создаёт). */
export function opPointNames(op) {
  switch (op?.type) {
    case 'pointOnLine': return refNames(op.ref);
    case 'pointOnCircle': return refNames(op.circle);
    case 'intersect': return [...refNames(op.l1), ...refNames(op.l2)];
    case 'lineCircle': return [...refNames(op.ref), ...refNames(op.circle)];
    case 'circleCircle': return [...refNames(op.c1), ...refNames(op.c2)];
    case 'foot': return [op.from, ...refNames(op.ref)];
    case 'center': return refNames(op.circle);
    case 'tangent': return [op.from, ...refNames(op.circle)];
    case 'segment': case 'line': case 'ray': case 'measure': return refNames(op.ref);
    case 'parallel': case 'perp': return [op.through, ...refNames(op.ref)];
    case 'bisector': case 'polygon': case 'fill': case 'angle': return [...(op.pts || [])];
    case 'circle': return refNames(op.circle);
    case 'tick': return (op.segs || []).flat();
    default: return [];
  }
}

const cleanDecor = (scene, next, dead) => {
  const out = next;
  if (scene?.colors) {
    out.colors = Object.fromEntries(Object.entries(scene.colors).filter(([k]) => !dead.has(k)));
    if (!Object.keys(out.colors).length) delete out.colors;
  }
  if (scene?.labelAngles) {
    out.labelAngles = Object.fromEntries(Object.entries(scene.labelAngles).filter(([k]) => !dead.has(k)));
    if (!Object.keys(out.labelAngles).length) delete out.labelAngles;
  }
  if (scene?.hidden) {
    out.hidden = scene.hidden.filter((n) => !dead.has(n));
    if (!out.hidden.length) delete out.hidden;
  }
  if (scene?.segStyles) {
    out.segStyles = Object.fromEntries(
      Object.entries(scene.segStyles).filter(([k]) => !k.split('-').some((n) => dead.has(n))),
    );
    if (!Object.keys(out.segStyles).length) delete out.segStyles;
  }
  return out;
};

/**
 * Удалить операцию вместе со всем, что от неё зависит.
 * @returns {{ scene, removed: string[] }} removed — id удалённых операций
 */
export function removeOpCascade(scene, opId) {
  const ops = scene?.ops || [];
  const idx = ops.findIndex((o) => o.id === opId);
  if (idx < 0) return { scene, removed: [] };
  const deadNames = new Set();
  const deadIds = new Set();
  const markDead = (op) => {
    if (op.name) deadNames.add(op.name);
    deadIds.add(op.id);
  };
  markDead(ops[idx]);
  for (let i = idx + 1; i < ops.length; i++) {
    if (opPointNames(ops[i]).some((n) => deadNames.has(n))) markDead(ops[i]);
  }
  const next = cleanDecor(scene, { ...scene, ops: ops.filter((o) => !deadIds.has(o.id)) }, deadNames);
  return { scene: next, removed: ops.filter((o) => deadIds.has(o.id)).map((o) => o.id) };
}

/** Переименовать точку во всём журнале и в оформлении. */
export function renamePoint(scene, from, to) {
  if (!NAME_RE.test(to || '')) return { error: 'Имя — латинская буква, можно с цифрами: K, M1' };
  const model = evaluateScene(scene);
  if (!model.points[from]) return { error: `Нет точки ${prettyName(from)}` };
  if (from === to) return { scene };
  if (model.points[to]) return { error: `Имя ${prettyName(to)} уже занято` };
  const swap = (n) => (n === from ? to : n);
  const ops = (scene?.ops || []).map((op) => {
    const o = { ...op };
    for (const f of ['name', 'from', 'through']) if (o[f]) o[f] = swap(o[f]);
    for (const f of ['ref', 'l1', 'l2', 'circle', 'c1', 'c2']) if (o[f]) o[f] = mapRefNames(o[f], swap);
    if (o.pts) o.pts = o.pts.map(swap);
    if (o.segs) o.segs = o.segs.map((s) => s.map(swap));
    return o;
  });
  const next = { ...scene, ops };
  if (scene?.colors) next.colors = Object.fromEntries(Object.entries(scene.colors).map(([k, v]) => [swap(k), v]));
  if (scene?.labelAngles) {
    next.labelAngles = Object.fromEntries(Object.entries(scene.labelAngles).map(([k, v]) => [swap(k), v]));
  }
  if (scene?.hidden) next.hidden = scene.hidden.map(swap);
  if (scene?.segStyles) {
    next.segStyles = Object.fromEntries(
      Object.entries(scene.segStyles).map(([k, v]) => [segKey(...k.split('-').map(swap)), v]),
    );
  }
  return { scene: next };
}

// --- оформление: цвет, пунктир, скрытые точки, место подписи -----------------------

/** Покрасить точки (color = '' / null — снять). В журнал шагов не попадает. */
export function setPointColors(scene, names, color) {
  const colors = { ...(scene?.colors || {}) };
  for (const n of names) {
    if (color) colors[n] = color; else delete colors[n];
  }
  const next = { ...scene, colors };
  if (!Object.keys(colors).length) delete next.colors;
  return next;
}

/**
 * Стиль отрезков (кусков прямых между двумя точками) по ключам «A-B».
 * patch: { color?: 'red' | '', dash?: boolean } — заданное меняется, остальное остаётся.
 */
export function setSegStyles(scene, keys, patch) {
  const segStyles = { ...(scene?.segStyles || {}) };
  for (const k of keys) {
    const st = { ...(segStyles[k] || {}) };
    if ('color' in patch) { if (patch.color) st.color = patch.color; else delete st.color; }
    if ('dash' in patch) { if (patch.dash) st.dash = true; else delete st.dash; }
    if (Object.keys(st).length) segStyles[k] = st; else delete segStyles[k];
  }
  const next = { ...scene, segStyles };
  if (!Object.keys(segStyles).length) delete next.segStyles;
  return next;
}

/** Стиль самой операции (окружность, заливка): цвет и пунктир живут в шаге. */
export function setOpStyle(scene, opIds, patch) {
  const ids = new Set(opIds);
  return {
    ...scene,
    ops: (scene?.ops || []).map((o) => {
      if (!ids.has(o.id)) return o;
      const next = { ...o };
      if ('color' in patch) { if (patch.color) next.color = patch.color; else delete next.color; }
      if ('dash' in patch) { if (patch.dash) next.dash = true; else delete next.dash; }
      return next;
    }),
  };
}

/** Скрыть / показать точки (скрытая не рисуется, но на неё можно ссылаться). */
export function setHidden(scene, names, hide) {
  const set = new Set(scene?.hidden || []);
  for (const n of names) { if (hide) set.add(n); else set.delete(n); }
  const next = { ...scene, hidden: [...set] };
  if (!set.size) delete next.hidden;
  return next;
}

/** Куда поставить букву точки: угол в градусах (0 — справа, 90 — сверху); null — авто. */
export function setLabelAngle(scene, name, angle) {
  const labelAngles = { ...(scene?.labelAngles || {}) };
  if (angle == null || !Number.isFinite(Number(angle))) delete labelAngles[name];
  else labelAngles[name] = ((Math.round(Number(angle)) % 360) + 360) % 360;
  const next = { ...scene, labelAngles };
  if (!Object.keys(labelAngles).length) delete next.labelAngles;
  return next;
}

/** Точки модели, лежащие на прямой p + t·u, по возрастанию t. */
function pointsOnLine(model, p, u) {
  const out = [];
  for (const name of model.pointOrder) {
    const pt = model.points[name];
    if (pt.alias || distToLine(pt.pos, p, u) > model.tol * 10) continue;
    out.push({ name, t: paramOnLine(pt.pos, p, u) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Кусок прямой под кликом: две соседние точки на ней вокруг pos.
 * @returns {[string, string] | null} null — с одной стороны точек нет
 */
export function segmentAt(model, line, pos) {
  if (!line?.p || !line?.u || !pos) return null;
  const tc = paramOnLine(pos, line.p, line.u);
  let left = null;
  let right = null;
  for (const q of pointsOnLine(model, line.p, line.u)) {
    if (q.t <= tc) left = q;
    else if (!right) right = q;
  }
  if (!left || !right || Math.abs(right.t - left.t) < 1e-9) return null;
  return [left.name, right.name];
}

/** Можно ли оформить отрезок AB: обе точки есть и лежат на нарисованной линии. */
export function segStyleError(model, a, b) {
  const A = model.points[a]?.pos;
  const B = model.points[b]?.pos;
  if (!A || !B) return `Нет точки ${prettyName(A ? b : a)}`;
  if (dist(A, B) <= model.tol) return `Точки ${prettyName(a)} и ${prettyName(b)} совпадают`;
  const u = sub(B, A);
  const drawn = model.lines.some((o) => sameLine(o.p, o.u, A, u, model.tol * 10));
  return drawn ? null : `Отрезок ${prettyName(a)}${prettyName(b)} не нарисован`;
}

/**
 * Команда-оформление (не шаг журнала) → новая сцена. Общая для строки команд
 * и блока ```planim.
 * r: { action: 'style', names?, segments?, circles?, patch }
 *  | { action: 'hide', names, hide }
 *  | { action: 'label', name, angle }
 *  | { action: 'rename', from, to }
 * @returns {{ scene } | { error }}
 */
export function applyAction(scene, r) {
  const model = evaluateScene(scene);
  const missing = (names) => names.filter((n) => !model.points[n]);
  if (r.action === 'rename') return renamePoint(scene, r.from, r.to);
  if (r.action === 'hide') {
    const bad = missing(r.names);
    if (bad.length) return { error: `Нет точки ${bad.map(prettyName).join(', ')}` };
    return { scene: setHidden(scene, r.names, r.hide) };
  }
  if (r.action === 'label') {
    if (!model.points[r.name]) return { error: `Нет точки ${prettyName(r.name)}` };
    return { scene: setLabelAngle(scene, r.name, r.angle) };
  }
  if (r.action === 'style') {
    const segs = r.segments || [];
    const bad = missing([...(r.names || []), ...segs.flat()]);
    if (bad.length) return { error: `Нет точки ${bad.map(prettyName).join(', ')}` };
    const turnsOn = !!r.patch.color || !!r.patch.dash;
    if (turnsOn) {
      for (const [a, b] of segs) {
        const err = segStyleError(model, a, b);
        if (err) return { error: err };
      }
    }
    let next = scene;
    if (r.names?.length && 'color' in r.patch) next = setPointColors(next, r.names, r.patch.color);
    if (segs.length) next = setSegStyles(next, segs.map(([a, b]) => segKey(a, b)), r.patch);
    for (const cref of r.circles || []) {
      const key = circleRefKey(cref);
      const ids = model.circles.filter((c) => c.key === key).map((c) => c.id);
      if (!ids.length) return { error: `Не нарисована: ${circleRefPretty(cref)}` };
      next = setOpStyle(next, ids, r.patch);
    }
    return { scene: next };
  }
  return { error: 'Неизвестная команда' };
}
