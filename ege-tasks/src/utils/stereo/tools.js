// Инструменты редактора: клик по чертежу → операция журнала.
//
// Чистая логика без DOM: компонент находит под курсором точку/линию/грань
// (pickPoint/pickLine/pickFace из render.js) и передаёт сюда «попадание»,
// а назад получает новое «набранное» (pending) и, когда хватает кликов,
// готовую операцию.

import { newOpId, lineColorKey, segmentAt, pointInPlane } from './scene';
import { nextFreeName, nextFootName } from './naming';
import { prettyName } from './bodies';
import { paramOnLine, add, mul, sub } from './vec3';
import {
  intersectLinePlane, planeFromPoints, affineCoords, pointInConvexPolygon,
} from './geometry';

export const TOOLS = [
  { key: 'rotate', label: 'Вращать', glyph: '⟳', hot: 'V' },
  { key: 'point', label: 'Точка', glyph: '•', hot: 'P' },
  { key: 'mid', label: 'Середина', glyph: '½', hot: 'M' },
  { key: 'segment', label: 'Отрезок', glyph: '—', hot: 'S' },
  { key: 'line', label: 'Прямая', glyph: '↔', hot: 'L' },
  { key: 'intersect', label: 'Пересечь', glyph: '∩', hot: 'I' },
  { key: 'trace', label: 'След', glyph: '↧', hot: 'T' },
  { key: 'parallel', label: 'Параллельная', glyph: '∥', hot: 'A' },
  { key: 'perp', label: 'Перпендикуляр', glyph: '⊥', hot: 'H' },
  { key: 'section', label: 'Сечение', glyph: '▱', hot: 'C' },
  { key: 'plane', label: 'Плоскость', glyph: '◧', hot: 'G' },
  { key: 'fill', label: 'Закрасить', glyph: '◆', hot: 'F' },
  { key: 'color', label: 'Цвет', glyph: '◉', hot: 'O' },
  { key: 'rename', label: 'Имя', glyph: 'Aa', hot: 'R' },
  { key: 'attention', label: 'Внимание', glyph: '!', hot: 'W' },
];

const SNAPS = [
  { t: 0.5, ratio: [1, 1] },
  { t: 1 / 3, ratio: [1, 2] },
  { t: 2 / 3, ratio: [2, 1] },
  { t: 0.25, ratio: [1, 3] },
  { t: 0.75, ratio: [3, 1] },
  { t: -0.5 }, { t: 1.5 }, { t: 2 }, { t: -1 },
];
const SNAP_PX = 7;
const SNAP_MAX_T = 0.06;

/**
 * Доля вдоль прямой с «прилипанием» к ½, ⅓, ⅔, ¼, ¾.
 * @param t — доля от первой точки прямой
 * @param pxPerUnit — сколько пикселей экрана в единице доли (длина AB на экране)
 */
export function snapPosition(t, pxPerUnit) {
  // Ближайшая «красивая» доля — и не дальше 7 px и 0,06 от курсора: на
  // коротком ребре иначе всё тянуло бы к середине.
  let best = null;
  for (const s of SNAPS) {
    const d = Math.abs(t - s.t);
    if (d * pxPerUnit <= SNAP_PX && d <= SNAP_MAX_T && (!best || d < best.d)) best = { d, s };
  }
  if (best) return best.s.ratio ? { t: best.s.t, ratio: best.s.ratio } : { t: best.s.t };
  return { t: Math.round(t * 100) / 100 };
}

/** Доля попадания по прямой-ссылке линии + пикселей на единицу доли. */
export function lineHitParam(hit, project) {
  const { line, pos } = hit;
  const t = paramOnLine(pos, line.p, line.u);
  const a = project(line.p);
  const b = project(add(line.p, mul(line.u, 1)));
  return { t, pxPerUnit: Math.hypot(b.x - a.x, b.y - a.y) };
}

/** Подсказка над чертежом: что сделать дальше. */
export function toolHint(tool, pending = []) {
  const names = pending.filter((p) => p.kind === 'point').map((p) => prettyName(p.name));
  switch (tool) {
    case 'point': return 'Кликните по ребру, прямой или внутри грани — там появится точка';
    case 'mid':
      return names.length
        ? `Середина ${names[0]}… — выберите вторую точку`
        : 'Кликните по отрезку — появится его середина (или выберите две точки)';
    case 'segment':
    case 'line':
      return names.length
        ? `${tool === 'line' ? 'Прямая' : 'Отрезок'} ${names[0]}… — выберите вторую точку`
        : `Выберите две точки${tool === 'line' ? ' (или кликните по ребру — продолжить его)' : ''}`;
    case 'intersect':
      return pending.length ? 'Выберите вторую прямую' : 'Выберите две прямые — найдём их общую точку';
    case 'trace':
      return pending.length ? 'Теперь грань, на плоскости которой ищем след (Shift — задняя грань)' : 'Выберите прямую, затем грань';
    case 'parallel':
      return pending.length ? 'Выберите вторую часть: точку или прямую' : 'Выберите точку и прямую, которой параллельна новая';
    case 'perp':
      return names.length
        ? `Перпендикуляр из ${names[0]}… — кликните по прямой или по грани / сечению (Shift — задняя грань)`
        : 'Выберите точку, из которой проводим перпендикуляр, затем прямую или плоскость';
    case 'section':
      return names.length ? `Сечение ${names.join('')}… — ещё ${3 - names.length}` : 'Выберите три точки секущей плоскости';
    case 'plane':
      return names.length ? `Плоскость ${names.join('')}… — ещё ${3 - names.length}` : 'Кликните по грани или выберите три точки';
    case 'fill':
      return names.length >= 3
        ? `${names.join('')} — кликните по первой точке или Enter, чтобы закрасить`
        : 'Выберите вершины многоугольника по порядку';
    case 'attention': return 'Кликните по точке или прямой — она замигает у всех учеников';
    case 'view': return 'Кликните по грани или сечению — чертёж повернётся перпендикулярно этой плоскости (Esc — отмена)';
    case 'color': return 'Клик по точке или отрезку — окрасится выбранным цветом, Shift+клик по линии — прямая целиком (повторный клик снимает)';
    case 'rename': return 'Кликните по точке, чтобы дать ей другое имя (вершины тоже). Или двойной клик по точке';
    default: return 'Тяните мышью — чертёж поворачивается. Точку на ребре можно перетащить. Колёсико — масштаб';
  }
}

/** Какие попадания инструмент принимает сейчас (для подсветки под курсором). */
export function acceptedKinds(tool, pending = []) {
  switch (tool) {
    case 'point': return ['line', 'face'];
    case 'segment': return ['point'];
    case 'mid': return pending.length ? ['point'] : ['point', 'line'];
    case 'line': return pending.length ? ['point'] : ['point', 'line'];
    case 'intersect': return ['line'];
    case 'trace': return pending.length ? ['face'] : ['line'];
    case 'parallel': {
      const hasP = pending.some((p) => p.kind === 'point');
      const hasL = pending.some((p) => p.kind === 'line');
      if (hasP) return ['line'];
      if (hasL) return ['point'];
      return ['point', 'line'];
    }
    case 'perp': return pending.length ? ['line', 'poly', 'face'] : ['point'];
    case 'section': return ['point'];
    case 'plane': return pending.length ? ['point'] : ['face', 'point'];
    case 'fill': return ['point'];
    case 'attention': return ['point', 'line'];
    case 'color': return ['point', 'line'];
    case 'view': return ['poly', 'face'];
    case 'rename': return ['point'];
    default: return [];
  }
}

/**
 * Выбрать из попадания то, что инструмент принимает (точка важнее линии,
 * линия важнее грани — как видит глаз).
 */
export function chooseHit(tool, pending, hit) {
  const ok = acceptedKinds(tool, pending);
  if (hit.point && ok.includes('point')) return { kind: 'point', name: hit.point };
  if (hit.line && ok.includes('line')) return { kind: 'line', ...hit.line };
  if (hit.poly && ok.includes('poly')) return { kind: 'poly', id: hit.poly.id };
  if (hit.face && ok.includes('face')) return { kind: 'face', id: hit.face.id, verts: hit.face.verts, pos: hit.face.pos };
  return null;
}

/**
 * Клик инструмента.
 * @param hit — { point?: name, line?: { id, ref, t, ratio?, pos?, p?, u? }, face?: { id, verts }, poly?: { id }, shift? }
 * @returns {{ pending, op?, error?, attention?, paint?, rename?, view? }}
 */
export function toolClick(tool, pending, hit, model) {
  const target = chooseHit(tool, pending, hit);
  if (!target) {
    if (tool === 'point' && hit.point) return { pending, error: `Здесь уже есть точка ${prettyName(hit.point)}` };
    return { pending };
  }
  const name = () => nextFreeName(model);
  const pts = [...pending, target].filter((p) => p.kind === 'point').map((p) => p.name);
  const same = (a, b) => a.kind === b.kind && (a.kind === 'point' ? a.name === b.name : a.id === b.id);
  if (pending.some((p) => same(p, target)) && !(tool === 'fill' && target.kind === 'point' && pending[0]?.name === target.name)) {
    return { pending };
  }

  switch (tool) {
    case 'point': {
      if (target.kind === 'face') {
        const [A, B, C] = target.verts.slice(0, 3).map((v) => model.points[v]?.pos);
        const st = target.pos && A && B && C ? affineCoords(A, B, C, target.pos) : null;
        if (!st) return { pending: [] };
        return {
          pending: [],
          op: {
            id: newOpId(), type: 'pointOnFace', name: name(), face: target.verts,
            s: Math.round(st.s * 1000) / 1000, t: Math.round(st.t * 1000) / 1000,
          },
        };
      }
      const op = { id: newOpId(), type: 'pointOnLine', name: name(), ref: target.ref, t: target.t };
      if (target.ratio) op.ratio = target.ratio;
      return { pending: [], op };
    }
    case 'mid': {
      // Середина куска прямой под курсором (между соседними точками) или
      // двух выбранных точек. Шаг — обычная «точка на прямой, 1:1».
      const mid = (ref) => ({ pending: [], op: { id: newOpId(), type: 'pointOnLine', name: name(), ref, t: 0.5, ratio: [1, 1] } });
      if (target.kind === 'line') {
        const seg = segmentAt(model, target, target.pos);
        return seg ? mid(seg) : { pending: [], error: 'Кликните между двумя точками на прямой — или выберите две точки' };
      }
      if (!pending.length) return { pending: [target] };
      return mid([pending[0].name, target.name]);
    }
    case 'segment':
    case 'line': {
      if (tool === 'line' && target.kind === 'line') {
        if (!Array.isArray(target.ref)) return { pending: [], error: 'Это уже прямая' };
        return { pending: [], op: { id: newOpId(), type: 'line', ref: target.ref } };
      }
      if (pts.length < 2) return { pending: [target] };
      return { pending: [], op: { id: newOpId(), type: tool, ref: [pts[0], pts[1]] } };
    }
    case 'intersect': {
      if (!pending.length) return { pending: [target] };
      return { pending: [], op: { id: newOpId(), type: 'intersect', name: name(), l1: pending[0].ref, l2: target.ref } };
    }
    case 'trace': {
      if (!pending.length) return { pending: [target] };
      return { pending: [], op: { id: newOpId(), type: 'trace', name: name(), ref: pending[0].ref, plane: target.verts } };
    }
    case 'parallel': {
      const all = [...pending, target];
      const p = all.find((x) => x.kind === 'point');
      const l = all.find((x) => x.kind === 'line');
      if (!p || !l) return { pending: all };
      return { pending: [], op: { id: newOpId(), type: 'parallel', through: p.name, ref: l.ref } };
    }
    case 'perp': {
      // Точка, затем прямая или плоскость (грань, сечение, закраска).
      if (!pending.length) return { pending: [target] };
      const from = pending[0].name;
      if (target.kind === 'line') {
        return { pending: [], op: { id: newOpId(), type: 'perp', name: nextFootName(model), from, ref: target.ref } };
      }
      const plane = target.kind === 'face' ? target.verts : model.opsById[target.id]?.pts;
      if (!plane) return { pending };
      // Из точки самой плоскости перпендикуляр восставляется — прямая без основания.
      const op = { id: newOpId(), type: 'perp', from, plane };
      if (pointInPlane(model, from, plane) !== true) op.name = nextFootName(model);
      return { pending: [], op };
    }
    case 'section':
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'section', pts: pts.slice(0, 3) } };
    case 'plane':
      if (target.kind === 'face') return { pending: [], op: { id: newOpId(), type: 'plane', pts: target.verts } };
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'plane', pts: pts.slice(0, 3) } };
    case 'rename':
      return { pending: [], rename: { name: target.name } };
    case 'color':
      // Цвет — оформление, не шаг журнала: решает редактор. Клик по линии —
      // кусок между соседними точками, Shift — прямая целиком (и когда с
      // одной стороны точек нет).
      if (target.kind === 'point') return { pending: [], paint: { name: target.name } };
      if (!hit.shift) {
        const seg = segmentAt(model, target, target.pos);
        if (seg) return { pending: [], paint: { segment: lineColorKey(seg) } };
      }
      return { pending: [], paint: { line: lineColorKey(target.ref) } };
    case 'view': {
      // Не операция журнала: повернуть чертёж перпендикулярно плоскости.
      const normal = target.kind === 'poly' ? polyNormal(model, target.id) : model.body.faces.find((f) => f.id === target.id)?.n;
      return normal ? { pending: [], view: { normal } } : { pending: [] };
    }
    case 'attention':
      // Не операция журнала: «смотрите сюда» уходит в эфир отдельно.
      return target.kind === 'point'
        ? { pending: [], attention: { points: [target.name], lines: [] } }
        : { pending: [], attention: { points: [], lines: [target.id] } };
    case 'fill': {
      if (pending.length >= 3 && pending[0].name === target.name) {
        return { pending: [], op: { id: newOpId(), type: 'fill', pts: pending.map((p) => p.name) } };
      }
      return { pending: [...pending, target] };
    }
    default:
      return { pending: [] };
  }
}

/** Enter у «Закрасить»: замкнуть многоугольник. */
export function finishPending(tool, pending) {
  if (tool === 'fill' && pending.length >= 3) {
    return { pending: [], op: { id: newOpId(), type: 'fill', pts: pending.map((p) => p.name) } };
  }
  return { pending };
}


// --- перемещение поставленных точек --------------------------------------------
//
// Двигать можно только точку, поставленную на прямую (pointOnLine): у неё
// один свободный параметр — доля t. Точки пересечения и следы производные —
// они едут сами, когда двигаются точки, через которые они построены. Это и
// нужно на уроке: неудачно поставил M — след X улетел за куб — сдвинул M.

/** Операция, поставившая точку name, если точку можно двигать. */
export function draggableOp(scene, name) {
  return (scene?.ops || []).find(
    (o) => (o.type === 'pointOnLine' || o.type === 'pointOnFace') && o.name === name,
  ) || null;
}

/** Точка грани под курсором: луч взгляда ∩ плоскость грани. */
export function facePointAt(model, frame, faceId, x, y) {
  const bf = model.body.faces.find((f) => f.id === faceId);
  if (!bf || !frame.unproject) return null;
  const r = intersectLinePlane(frame.unproject(x, y), { n: bf.n, d: bf.d }, model.body.size);
  return r.kind === 'point' ? r.point : null;
}

/**
 * Цель перетаскивания для точки грани: плоскость по трём первым точкам и,
 * если это грань тела, её многоугольник — за край точка не уедет.
 */
export function faceDragTarget(model, op) {
  const [A, B, C] = op.face.slice(0, 3).map((v) => model.points[v]?.pos);
  if (!A || !B || !C) return null;
  const plane = planeFromPoints(A, B, C, model.body.size);
  if (!plane) return null;
  const isFace = op.face.every((v) => model.body.vertices[v]);
  const poly = isFace ? op.face.map((v) => model.body.vertices[v]) : null;
  return { kind: 'face', A, B, C, plane, poly };
}

/** Новые (s, t) точки грани по курсору; null — курсор вне грани. */
export function dragFacePosition(target, frame, x, y, size = 1) {
  const r = intersectLinePlane(frame.unproject(x, y), target.plane, size);
  if (r.kind !== 'point') return null;
  if (target.poly && !pointInConvexPolygon(target.poly, r.point, target.plane.n, 1e-9 * size)) return null;
  const st = affineCoords(target.A, target.B, target.C, r.point);
  return st ? { s: Math.round(st.s * 1000) / 1000, t: Math.round(st.t * 1000) / 1000 } : null;
}

/** Прямая, по которой ездит точка операции: { p, u } в пространстве. */
export function lineOfOp(model, op) {
  if (Array.isArray(op.ref)) {
    const A = model.points[op.ref[0]]?.pos;
    const B = model.points[op.ref[1]]?.pos;
    return A && B ? { p: A, u: sub(B, A) } : null;
  }
  const l = model.lines.find((x) => x.id === op.ref);
  return l ? { p: l.p, u: l.u } : null;
}

/**
 * Доля t по положению курсора: проекция на экранный образ прямой. Точка,
 * стоявшая на ребре (0 ≤ t ≤ 1), с ребра не съезжает; точка на продолжении
 * ездит свободно (в разумных пределах).
 */
export function dragPosition(line, project, x, y, { onSegment = true } = {}) {
  const a = project(line.p);
  const b = project(add(line.p, line.u));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 < 1e-6) return null;
  let t = ((x - a.x) * dx + (y - a.y) * dy) / L2;
  t = onSegment ? Math.min(1, Math.max(0, t)) : Math.min(4, Math.max(-3, t));
  const snapped = snapPosition(t, Math.sqrt(L2));
  // Концы отрезка — это уже существующие точки; стоять ровно на них незачем.
  if (onSegment && (snapped.t <= 0.005 || snapped.t >= 0.995)) {
    return { t: Math.min(0.99, Math.max(0.01, snapped.t)) };
  }
  return snapped;
}

/** Сцена с новым положением точки (ratio уходит, если его нет в pos). */
export function setOpPosition(scene, opId, pos) {
  return {
    ...scene,
    ops: (scene.ops || []).map((o) => {
      if (o.id !== opId) return o;
      if (o.type === 'pointOnFace') return { ...o, s: pos.s, t: pos.t };
      const next = { ...o, t: pos.t };
      if (pos.ratio) next.ratio = pos.ratio; else delete next.ratio;
      return next;
    }),
  };
}

/** Нормаль многоугольника модели (сечение, плоскость, закраска); null — вырожден. */
export function polyNormal(model, id) {
  const pg = model.polys.find((p) => p.id === id);
  if (!pg || pg.pts.length < 3) return null;
  // Нормаль Ньюэлла — устойчива и для почти вырожденных углов.
  const n = { x: 0, y: 0, z: 0 };
  pg.pts.forEach((a, i) => {
    const b = pg.pts[(i + 1) % pg.pts.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  });
  return Math.hypot(n.x, n.y, n.z) > 1e-12 ? n : null;
}
