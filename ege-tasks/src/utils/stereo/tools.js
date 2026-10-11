// Инструменты редактора: клик по чертежу → операция журнала.
//
// Чистая логика без DOM: компонент находит под курсором точку/линию/грань
// (pickPoint/pickLine/pickFace из render.js) и передаёт сюда «попадание»,
// а назад получает новое «набранное» (pending) и, когда хватает кликов,
// готовую операцию.

import {
  newOpId, lineColorKey, segmentAt, pointInPlane, pointOnLineRef, makeAngleOp,
} from './scene';
import { nextFreeName, nextFootName } from './naming';
import { makeMeasure } from './measure';
import { prettyName } from './bodies';
import { paramOnLine, add, mul, sub } from './vec3';
import {
  intersectLinePlane, planeFromPoints, affineCoords, pointInConvexPolygon,
} from './geometry';
import { bodySurfaceParams } from './revolution';
import { pickFace } from './render';

/** Чертёж без тела: точки ставятся в пустоту, плоскости — листами. */
export const isEmptySpace = (model) => !model.body.faces.length && !model.body.parts;

const SHEET_LABELS = ['α', 'β', 'γ', 'δ', 'ε', 'φ', 'ψ', 'ω'];
/** Следующая свободная буква листа. */
export function nextSheetLabel(model) {
  const used = new Set(Object.values(model.opsById || {}).filter((o) => o.type === 'sheet').map((o) => o.label));
  return SHEET_LABELS.find((l) => !used.has(l)) || null;
}

/** Имя точки без тела: как в учебнике — A, B, C…, а не M, N (те — для построений на теле). */
function spaceName(model) {
  const used = new Set(Object.keys(model.points || {}));
  const n = 'ABCDEFGHKLMNPQRSTUVWXYZ'.split('').find((l) => !used.has(l));
  return n || nextFreeName(model);
}

/** Координата с прилипанием к 0,5. */
const snapCoord = (x) => {
  const h = Math.round(x * 2) / 2;
  return Math.abs(h - x) <= 0.08 ? h : Math.round(x * 100) / 100;
};

/** Луч взгляда ∩ плоскость «пола» z = 0 (взгляд вдоль пола — вертикальная плоскость через начало). */
function groundPoint(ray, size) {
  let r = intersectLinePlane(ray, { n: { x: 0, y: 0, z: 1 }, d: 0 }, size);
  if (r.kind !== 'point' || Math.abs(r.t) > 50 * size) {
    const h = Math.hypot(ray.u.x, ray.u.y) || 1;
    r = intersectLinePlane(ray, { n: { x: ray.u.x / h, y: ray.u.y / h, z: 0 }, d: 0 }, size);
  }
  return r.kind === 'point' ? r.point : null;
}

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
  { key: 'perpPlane', label: 'Плоскость ⊥', glyph: '◧⊥', hot: 'N' },
  { key: 'angle', label: 'Угол', glyph: '∠', hot: 'E' },
  { key: 'length', label: 'Длина', glyph: '↦', hot: 'Y' },
  { key: 'section', label: 'Сечение', glyph: '▱', hot: 'C' },
  { key: 'plane', label: 'Плоскость', glyph: '◧', hot: 'G' },
  { key: 'fill', label: 'Закрасить', glyph: '◆', hot: 'F' },
  { key: 'level', label: 'Жидкость', glyph: '≋', hot: 'Q' },
  { key: 'color', label: 'Цвет', glyph: '◉', hot: 'O' },
  { key: 'measure', label: 'Измерить', glyph: '⟷', hot: 'U' },
  { key: 'rename', label: 'Имя', glyph: 'Aa', hot: 'R' },
  { key: 'hide', label: 'Скрыть', glyph: '◌', hot: 'K' },
  { key: 'erase', label: 'Удалить', glyph: '⌫', hot: 'D' },
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
    case 'point': return 'Кликните по ребру, прямой, внутри грани или сечения; у цилиндра, конуса, шара — по поверхности или основанию; на чертеже без тела — в любое место (точка встанет на «пол» z = 0) или на лист. Точку можно тянуть, с Shift — по высоте';
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
      if (pending.some((p) => p.kind === 'line')) {
        return `${names[0]} лежит на прямой — выберите плоскость (грань или сечение), в которой провести перпендикуляр`;
      }
      return names.length
        ? `Перпендикуляр из ${names[0]}… — кликните по прямой или по грани / сечению (Shift — задняя грань)`
        : 'Выберите точку, из которой проводим перпендикуляр, затем прямую или плоскость';
    case 'angle':
      if (names.length) {
        return names.length === 1
          ? `∠${names[0]}… — теперь вершину угла, затем точку второй стороны`
          : `∠${names.join('')}… — точку второй стороны`;
      }
      return pending.length
        ? 'Теперь вторую прямую (отметим угол между ними) или плоскость — грань / сечение (построим проекцию; Shift — задняя грань)'
        : 'Три точки — ∠ABC (вершина вторая); две прямые — угол между ними; прямая и грань — угол с плоскостью';
    case 'length':
      return names.length
        ? `Подпись ${names[0]}… — выберите вторую точку`
        : 'Кликните по ребру или отрезку (между двумя точками) или выберите две точки — у отрезка встанет подпись из поля ниже';
    case 'perpPlane': {
      const line = pending.find((p) => p.kind === 'line');
      if (line) return 'Плоскость пройдёт через эту прямую — выберите плоскость (грань или сечение), которой она перпендикулярна';
      if (names.length) return `Сечение через ${names[0]}… — выберите прямую, которой оно перпендикулярно`;
      return 'Точка, затем прямая — сечение через точку ⊥ прямой; или прямая, затем грань — плоскость через прямую ⊥ грани';
    }
    case 'section':
      return names.length ? `Сечение ${names.join('')}… — ещё ${3 - names.length}` : 'Выберите три точки секущей плоскости';
    case 'plane':
      return names.length
        ? `Плоскость ${names.join('')}… — ещё ${3 - names.length} (без тела: повторный клик по точке или Enter — горизонтальная плоскость через неё)`
        : 'Кликните по грани или выберите три точки. Без тела — плоскость-лист: три точки, одна точка (дважды) — горизонтально через неё, клик в пустоту — «пол» z = 0';
    case 'fill':
      return names.length >= 3
        ? `${names.join('')} — кликните по первой точке или Enter, чтобы закрасить`
        : 'Выберите вершины многоугольника по порядку';
    case 'level': return 'Кликните по боковому ребру на нужной высоте (или по точке) — сосуд наполнится до этого уровня';
    case 'attention': return 'Кликните по точке или прямой — она замигает у всех учеников';
    case 'measure': {
      const first = pending[0];
      if (first) {
        const what = first.kind === 'point' ? `точка ${prettyName(first.name)}` : first.kind === 'line' ? 'прямая' : 'плоскость';
        return `Выбрана ${what} — теперь второй объект: точка, прямая, грань или сечение (Shift — задняя грань)`;
      }
      return 'Две точки — длина; точка и прямая / плоскость — расстояние; две прямые, прямая и плоскость, две плоскости — угол (∠ABC — командой «измерить ABC»). Видно только вам';
    }
    case 'view': return 'Кликните по грани или сечению — чертёж повернётся перпендикулярно этой плоскости (Esc — отмена)';
    case 'color': return 'Клик по точке, отрезку или внутри сечения — окрасится выбранным цветом, Shift+клик по линии — прямая целиком (повторный клик снимает)';
    case 'rename': return 'Кликните по точке, чтобы дать ей другое имя (вершины тоже). Или двойной клик по точке';
    case 'hide': return 'Кликните по точке — она пропадёт с чертежа (у учеников и в печати), построения через неё останутся. Здесь она видна бледной; повторный клик вернёт';
    case 'erase': return 'Кликните по точке, прямой или сечению — уберётся шаг, который их построил (вместе с зависящими от него). Ctrl+Z вернёт';
    default: return 'Тяните мышью — чертёж поворачивается. Точку на ребре можно перетащить. Колёсико — масштаб';
  }
}

/** Какие попадания инструмент принимает сейчас (для подсветки под курсором). */
export function acceptedKinds(tool, pending = []) {
  switch (tool) {
    case 'point': return ['line', 'poly', 'face', 'empty'];
    case 'segment': return ['point'];
    case 'mid': return pending.length ? ['point'] : ['point', 'line'];
    case 'length': return pending.length ? ['point'] : ['point', 'line'];
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
    case 'perp':
      if (pending.length > 1) return ['poly', 'face']; // точка на прямой — нужна плоскость
      return pending.length ? ['line', 'poly', 'face'] : ['point'];
    case 'angle':
      if (!pending.length) return ['point', 'line'];
      return pending[0].kind === 'point' ? ['point'] : ['line', 'poly', 'face'];
    case 'perpPlane':
      if (!pending.length) return ['point', 'line'];
      return pending[0].kind === 'point' ? ['line'] : ['poly', 'face'];
    case 'section': return ['point'];
    case 'plane': return pending.length ? ['point'] : ['face', 'point', 'empty'];
    case 'fill': return ['point'];
    case 'level': return ['point', 'line'];
    case 'attention': return ['point', 'line'];
    case 'measure': return ['point', 'line', 'poly', 'face'];
    case 'color': return ['point', 'line', 'poly', 'face'];
    case 'view': return ['poly', 'face'];
    case 'rename': return ['point'];
    case 'hide': return ['point'];
    case 'erase': return ['point', 'line', 'poly'];
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
  if (hit.face && ok.includes('face')) {
    return {
      kind: 'face', id: hit.face.id, verts: hit.face.verts, pos: hit.face.pos, surface: hit.face.surface, center: hit.face.center,
    };
  }
  if (hit.ray && ok.includes('empty')) return { kind: 'empty', ray: hit.ray };
  return null;
}

/**
 * Клик инструмента.
 * @param hit — { point?: name, line?: { id, ref, t, ratio?, pos?, p?, u? }, face?: { id, verts }, poly?: { id }, shift? }
 * @returns {{ pending, op?, error?, attention?, paint?, rename?, hide?, view?, erase?, measure? }}
 */
export function toolClick(tool, pending, hit, model) {
  const target = chooseHit(tool, pending, hit);
  if (!target) {
    if (tool === 'point' && hit.point) return { pending, error: `Здесь уже есть точка ${prettyName(hit.point)}` };
    return { pending };
  }
  // Часть грани ступенчатого тела, у которой не все углы — вершины с
  // именами: плоскость по ней не назвать.
  if (target.kind === 'face' && !target.verts && !(tool === 'point' && target.surface)
    && ['point', 'trace', 'perp', 'angle', 'perpPlane', 'plane'].includes(tool)) {
    return {
      pending,
      error: target.surface
        ? 'Поверхность тела вращения — не плоскость: задайте плоскость тремя точками'
        : 'У этой части грани нет вершин с именами — задайте плоскость тремя точками (или дайте вершинам имена)',
    };
  }
  const name = () => nextFreeName(model);
  const pts = [...pending, target].filter((p) => p.kind === 'point').map((p) => p.name);
  const same = (a, b) => a.kind === b.kind && (a.kind === 'point' ? a.name === b.name : a.id === b.id);
  // Без тела: повторный клик по единственной точке «Плоскостью» — горизонтальный лист через неё
  if (tool === 'plane' && isEmptySpace(model) && pending.length === 1 && target.kind === 'point' && pending[0].name === target.name) {
    return { pending: [], op: { id: newOpId(), type: 'sheet', through: target.name, label: nextSheetLabel(model) } };
  }
  if (pending.some((p) => same(p, target)) && !(tool === 'fill' && target.kind === 'point' && pending[0]?.name === target.name)) {
    return { pending };
  }

  switch (tool) {
    case 'point': {
      if (target.kind === 'empty') {
        // Без тела — точка на «пол» z = 0; у тела клик мимо ничего не ставит
        if (!isEmptySpace(model)) return { pending: [] };
        const P = groundPoint(target.ray, model.body.size);
        if (!P) return { pending: [] };
        return { pending: [], op: { id: newOpId(), type: 'freePoint', name: spaceName(model), at: [P.x, P.y, P.z].map(snapCoord) } };
      }
      if (target.kind === 'poly') {
        // Внутри листа, сечения, плоскости — точка в её плоскости
        const pg = model.polys.find((p) => p.id === target.id);
        const opId = pg?.base || target.id;
        const pop = model.opsById[opId];
        const plane = model.planes?.[opId] || (Array.isArray(pop?.pts) ? planeOfPts(model, pop.pts) : null);
        if (!plane || !hit.ray) return { pending: [] };
        const r = intersectLinePlane(hit.ray, plane, model.body.size);
        if (r.kind !== 'point') return { pending: [] };
        if (Array.isArray(pop?.pts) && pop.pts.length >= 3 && pop.type !== 'sheet') {
          const [A, B, C] = pop.pts.slice(0, 3).map((v) => model.points[v]?.pos);
          const st = A && B && C ? affineCoords(A, B, C, r.point) : null;
          if (st) {
            return {
              pending: [],
              op: {
                id: newOpId(), type: 'pointOnFace', name: name(), face: pop.pts.slice(0, 3),
                s: Math.round(st.s * 1000) / 1000, t: Math.round(st.t * 1000) / 1000,
              },
            };
          }
        }
        return { pending: [], op: { id: newOpId(), type: 'freePoint', name: isEmptySpace(model) ? spaceName(model) : name(), at: [r.point.x, r.point.y, r.point.z].map((x) => Math.round(x * 100) / 100) } };
      }
      if (target.kind === 'face' && target.surface) {
        // Поверхность тела вращения: боковая, круг основания, сфера
        const circle = model.body.circles?.[target.center];
        if (!circle || !target.pos) return { pending: [] };
        return {
          pending: [],
          op: {
            id: newOpId(), type: 'pointOnBody', name: name(), surface: target.surface, center: target.center,
            ...bodySurfaceParams(circle, target.surface, target.pos),
          },
        };
      }
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
    case 'length': {
      // Подпись длины: кусок прямой под курсором или две точки. Текст и вид
      // (у отрезка / стрелкой) ставит редактор — из поля под панелью.
      const mark = (ref) => ({ pending: [], op: { id: newOpId(), type: 'lengthMark', ref, text: '' } });
      if (target.kind === 'line') {
        const seg = segmentAt(model, target, target.pos);
        return seg ? mark(seg) : { pending: [], error: 'Кликните между двумя точками на прямой — или выберите две точки' };
      }
      if (!pending.length) return { pending: [target] };
      return mark([pending[0].name, target.name]);
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
        // Точка на самой прямой — перпендикуляр строится в плоскости: ждём
        // третий клик.
        if (pointOnLineRef(model, from, target.ref)) return { pending: [...pending, target] };
        return { pending: [], op: { id: newOpId(), type: 'perp', name: nextFootName(model), from, ref: target.ref } };
      }
      const plane = planeOfTarget(model, target);
      if (!plane) return { pending };
      const onLine = pending.find((p) => p.kind === 'line');
      if (onLine) {
        return { pending: [], op: { id: newOpId(), type: 'perp', from, ref: onLine.ref, within: plane } };
      }
      // Из точки самой плоскости перпендикуляр восставляется — прямая без основания.
      const op = { id: newOpId(), type: 'perp', from, plane };
      if (pointInPlane(model, from, plane) !== true) op.name = nextFootName(model);
      return { pending: [], op };
    }
    case 'angle': {
      // Три точки — ∠ABC; прямая и прямая — угол между ними; прямая и
      // плоскость — угол с проекцией.
      if (!pending.length) return { pending: [target] };
      if (pending[0].kind === 'point') {
        if (pts.length < 3) return { pending: [...pending, target] };
        return { pending: [], op: { id: newOpId(), type: 'angleMark', pts: pts.slice(0, 3) } };
      }
      if (target.kind === 'line') {
        return { pending: [], op: { id: newOpId(), type: 'angleMark', l1: pending[0].ref, l2: target.ref } };
      }
      const plane = planeOfTarget(model, target);
      if (!plane) return { pending };
      return { pending: [], op: makeAngleOp(model, pending[0].ref, plane, newOpId()) };
    }
    case 'perpPlane': {
      // Точка → прямая: сечение через точку ⊥ прямой. Прямая → плоскость:
      // плоскость через прямую ⊥ плоскости (рисуется тоже сечением тела).
      if (!pending.length) {
        if (target.kind === 'line' && !Array.isArray(target.ref)) {
          return { pending: [], error: 'Плоскость проводится через прямую из двух точек — выберите ребро или отрезок' };
        }
        return { pending: [target] };
      }
      const first = pending[0];
      if (first.kind === 'point') {
        return { pending: [], op: { id: newOpId(), type: 'perpPlane', from: first.name, ref: target.ref, style: 'section' } };
      }
      const plane = planeOfTarget(model, target);
      if (!plane) return { pending };
      return { pending: [], op: { id: newOpId(), type: 'perpPlane', line: first.ref, plane, style: 'section' } };
    }
    case 'section':
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'section', pts: pts.slice(0, 3) } };
    case 'plane':
      if (isEmptySpace(model)) {
        // Без тела плоскость — лист: три точки, «пол» (клик в пустоту)
        if (target.kind === 'empty') return pending.length ? { pending } : { pending: [], op: { id: newOpId(), type: 'sheet', z: 0, label: nextSheetLabel(model) } };
        if (pts.length < 3) return { pending: [...pending, target] };
        return { pending: [], op: { id: newOpId(), type: 'sheet', pts: pts.slice(0, 3), label: nextSheetLabel(model) } };
      }
      if (target.kind === 'empty') return { pending };
      if (target.kind === 'face') {
        if (!target.verts) return { pending: [], error: 'У этой части грани нет вершин с именами — выберите три точки' };
        return { pending: [], op: { id: newOpId(), type: 'plane', pts: target.verts } };
      }
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'plane', pts: pts.slice(0, 3) } };
    case 'level': {
      // Жидкость до высоты точки (через неё) или места клика на ребре.
      if (target.kind === 'point') return { pending: [], op: { id: newOpId(), type: 'level', through: target.name } };
      let pos = target.pos;
      if (Array.isArray(target.ref) && Number.isFinite(target.t)) {
        const A = model.points[target.ref[0]]?.pos;
        const B = model.points[target.ref[1]]?.pos;
        if (A && B) pos = add(A, mul(sub(B, A), target.t));
      }
      if (!pos) return { pending: [] };
      const zmin = Math.min(...model.body.order.map((v) => model.body.vertices[v].z));
      return { pending: [], op: { id: newOpId(), type: 'level', h: Math.round((pos.z - zmin) * 100) / 100 } };
    }
    case 'rename':
      return { pending: [], rename: { name: target.name } };
    case 'hide':
      // Не операция журнала: скрытие — оформление, решает редактор.
      return { pending: [], hide: { name: target.name } };
    case 'measure': {
      // Не операция журнала: измерение видит только учитель.
      if (!pending.length) return { pending: [target] };
      const a = measureObject(model, pending[0]);
      const b = measureObject(model, target);
      if (!a || !b) return { pending: [] };
      return { pending: [], measure: makeMeasure(a, b) };
    }
    case 'erase': {
      // Не операция журнала: редактор удаляет шаг, построивший объект.
      const opId = stepOfTarget(model, target);
      if (opId) return { pending: [], erase: { opId } };
      const what = target.kind === 'point' ? 'Вершина' : 'Ребро';
      return { pending: [], error: `${what} — часть самого тела, её не удалить (тело меняется кнопкой «Новый чертёж»)` };
    }
    case 'color':
      // Цвет — оформление, не шаг журнала: решает редактор. Клик по линии —
      // кусок между соседними точками, Shift — прямая целиком (и когда с
      // одной стороны точек нет).
      if (target.kind === 'point') return { pending: [], paint: { name: target.name } };
      if (target.kind === 'poly') return { pending: [], paint: { poly: target.id } };
      if (target.kind === 'face') {
        // Грань красится, если по ней построена плоскость (инструмент «Плоскость»).
        const pg = model.polys.find((p) => p.faceId === target.id);
        if (pg) return { pending: [], paint: { poly: pg.id } };
        return { pending: [], error: 'Чтобы закрасить грань, сначала постройте по ней плоскость (инструмент «Плоскость», клик по грани)' };
      }
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

/** Id шага, который построил точку / линию / многоугольник; null — это тело. */
export function stepOfTarget(model, target) {
  let step = -1;
  if (target.kind === 'point') step = model.points[target.name]?.step ?? -1;
  else if (target.kind === 'line') step = model.lines.find((l) => l.id === target.id)?.step ?? -1;
  else if (target.kind === 'poly') step = model.polys.find((pg) => pg.id === target.id)?.step ?? -1;
  return step >= 0 ? model.steps[step]?.op.id || null : null;
}

/**
 * Плоскость под кликом как ссылка: грань — имена вершин, сечение/плоскость/
 * закраска — имена их точек, перпендикулярная плоскость — id шага.
 */
function planeOfTarget(model, target) {
  if (target.kind === 'face') return target.verts || null;
  const op = model.opsById[target.id];
  if (op?.type === 'perpPlane' || op?.type === 'sheet') return op.id;
  return op?.pts || null;
}

/** Попадание инструмента → объект измерения (measure.js). */
function measureObject(model, target) {
  if (target.kind === 'point') return { kind: 'point', name: target.name };
  if (target.kind === 'line') return { kind: 'line', ref: target.ref };
  const ref = planeOfTarget(model, target);
  return ref ? { kind: 'plane', ref } : null;
}

/** Enter у «Закрасить»: замкнуть многоугольник. */
export function finishPending(tool, pending, model = null) {
  if (tool === 'fill' && pending.length >= 3) {
    return { pending: [], op: { id: newOpId(), type: 'fill', pts: pending.map((p) => p.name) } };
  }
  // Без тела: Enter после одной точки — горизонтальный лист через неё
  if (tool === 'plane' && model && isEmptySpace(model) && pending.length === 1 && pending[0].kind === 'point') {
    return { pending: [], op: { id: newOpId(), type: 'sheet', through: pending[0].name, label: nextSheetLabel(model) } };
  }
  return { pending };
}

/** Плоскость по именам точек модели; null — их нет или на одной прямой. */
function planeOfPts(model, names) {
  const [A, B, C] = names.slice(0, 3).map((n) => model.points[n]?.pos);
  return A && B && C ? planeFromPoints(A, B, C, model.body.size) : null;
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
    (o) => ['pointOnLine', 'pointOnFace', 'freePoint', 'pointOnBody', 'pointOnCircle'].includes(o.type) && o.name === name,
  ) || null;
}

/**
 * Перетаскивание точки без тела (по горизонтали, с Shift — по высоте), точки
 * на поверхности тела вращения и на его окружности.
 * @returns {object|null} поля шага, которые меняются
 */
export function dragOpPatch(model, op, frame, x, y, { shiftKey = false } = {}) {
  const ray = frame.unproject(x, y);
  const size = model.body.size;
  if (op.type === 'freePoint') {
    const P = { x: op.at[0], y: op.at[1], z: op.at[2] };
    let plane;
    if (shiftKey) {
      const h = Math.hypot(ray.u.x, ray.u.y) || 1;
      const n = { x: ray.u.x / h, y: ray.u.y / h, z: 0 };
      plane = { n, d: n.x * P.x + n.y * P.y };
    } else plane = { n: { x: 0, y: 0, z: 1 }, d: P.z };
    const r = intersectLinePlane(ray, plane, size);
    if (r.kind !== 'point') return null;
    const Q = shiftKey ? { x: P.x, y: P.y, z: r.point.z } : r.point;
    return { at: [Q.x, Q.y, Q.z].map(snapCoord) };
  }
  if (op.type === 'pointOnCircle') {
    const c = model.body.circles?.[op.center];
    if (!c?.axis) return null;
    const r = intersectLinePlane(ray, { n: c.axis, d: c.axis.x * c.c.x + c.axis.y * c.c.y + c.axis.z * c.c.z }, size);
    if (r.kind !== 'point') return null;
    return { angle: bodySurfaceParams(c, 'disk', r.point).angle };
  }
  if (op.type === 'pointOnBody') {
    const f = pickFace(frame, x, y);
    if (!f) return null;
    const bf = model.body.faces.find((q) => q.id === f.id);
    if (!bf || bf.surface !== op.surface || bf.center !== op.center) return null;
    const r = intersectLinePlane(ray, { n: bf.n, d: bf.d }, size);
    if (r.kind !== 'point') return null;
    return bodySurfaceParams(model.body.circles[op.center], op.surface, r.point);
  }
  return null;
}

/** Сцена с новыми полями шага. */
export function setOpFields(scene, opId, patch) {
  return { ...scene, ops: (scene.ops || []).map((o) => (o.id === opId ? { ...o, ...patch } : o)) };
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
