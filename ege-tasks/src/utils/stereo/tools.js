// Инструменты редактора: клик по чертежу → операция журнала.
//
// Чистая логика без DOM: компонент находит под курсором точку/линию/грань
// (pickPoint/pickLine/pickFace из render.js) и передаёт сюда «попадание»,
// а назад получает новое «набранное» (pending) и, когда хватает кликов,
// готовую операцию.

import { newOpId } from './scene';
import { nextFreeName } from './naming';
import { prettyName } from './bodies';
import { paramOnLine, add, mul } from './vec3';

export const TOOLS = [
  { key: 'rotate', label: 'Вращать', glyph: '⟳', hot: 'V' },
  { key: 'point', label: 'Точка', glyph: '•', hot: 'P' },
  { key: 'segment', label: 'Отрезок', glyph: '—', hot: 'S' },
  { key: 'line', label: 'Прямая', glyph: '↔', hot: 'L' },
  { key: 'intersect', label: 'Пересечь', glyph: '∩', hot: 'I' },
  { key: 'trace', label: 'След', glyph: '⊥', hot: 'T' },
  { key: 'parallel', label: 'Параллельная', glyph: '∥', hot: 'A' },
  { key: 'section', label: 'Сечение', glyph: '▱', hot: 'C' },
  { key: 'plane', label: 'Плоскость', glyph: '◧', hot: 'G' },
  { key: 'fill', label: 'Закрасить', glyph: '◆', hot: 'F' },
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

/**
 * Доля вдоль прямой с «прилипанием» к ½, ⅓, ⅔, ¼, ¾.
 * @param t — доля от первой точки прямой
 * @param pxPerUnit — сколько пикселей экрана в единице доли (длина AB на экране)
 */
export function snapPosition(t, pxPerUnit) {
  for (const s of SNAPS) {
    if (Math.abs(t - s.t) * pxPerUnit <= SNAP_PX) return s.ratio ? { t: s.t, ratio: s.ratio } : { t: s.t };
  }
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
    case 'point': return 'Кликните по ребру или прямой — там появится точка';
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
    case 'section':
      return names.length ? `Сечение ${names.join('')}… — ещё ${3 - names.length}` : 'Выберите три точки секущей плоскости';
    case 'plane':
      return names.length ? `Плоскость ${names.join('')}… — ещё ${3 - names.length}` : 'Кликните по грани или выберите три точки';
    case 'fill':
      return names.length >= 3
        ? `${names.join('')} — кликните по первой точке или Enter, чтобы закрасить`
        : 'Выберите вершины многоугольника по порядку';
    case 'attention': return 'Кликните по точке или прямой — она замигает у всех учеников';
    default: return 'Тяните мышью — чертёж поворачивается. Колёсико — масштаб';
  }
}

/** Какие попадания инструмент принимает сейчас (для подсветки под курсором). */
export function acceptedKinds(tool, pending = []) {
  switch (tool) {
    case 'point': return ['line'];
    case 'segment': return ['point'];
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
    case 'section': return ['point'];
    case 'plane': return pending.length ? ['point'] : ['face', 'point'];
    case 'fill': return ['point'];
    case 'attention': return ['point', 'line'];
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
  if (hit.face && ok.includes('face')) return { kind: 'face', id: hit.face.id, verts: hit.face.verts };
  return null;
}

/**
 * Клик инструмента.
 * @param hit — { point?: name, line?: { id, ref, t, ratio? }, face?: { id, verts } }
 * @returns {{ pending, op?, error?, attention? }}
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
      const op = { id: newOpId(), type: 'pointOnLine', name: name(), ref: target.ref, t: target.t };
      if (target.ratio) op.ratio = target.ratio;
      return { pending: [], op };
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
    case 'section':
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'section', pts: pts.slice(0, 3) } };
    case 'plane':
      if (target.kind === 'face') return { pending: [], op: { id: newOpId(), type: 'plane', pts: target.verts } };
      if (pts.length < 3) return { pending: [...pending, target] };
      return { pending: [], op: { id: newOpId(), type: 'plane', pts: pts.slice(0, 3) } };
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

