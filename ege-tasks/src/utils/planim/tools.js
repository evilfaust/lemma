// Инструменты редактора: клик по чертежу → операции журнала.
//
// Чистая логика без DOM: компонент находит под курсором точку / линию /
// окружность (pick* из render.js) и передаёт сюда «попадание», а назад
// получает новое «набранное» (pending) и, когда хватает кликов, готовые
// операции. Инструменты, которым нужна точка, сами ставят её там, куда
// кликнули: на пустом месте — свободную, на линии — точку на линии.

import {
  newOpId, segKey, segmentAt, segStyleError,
} from './scene';
import { nextFreeName } from './naming';
import { prettyName } from './refs';
import { altitudeOps, bisectorOps, circleCrossOps } from './commands';
import { lineCircle, tangentPoints } from './geometry';
import { dist, paramOnLine } from './vec2';

export const TOOLS = [
  { key: 'move', label: 'Двигать', glyph: '✥', hot: 'V', group: 'Точки' },
  { key: 'point', label: 'Точка', glyph: '•', hot: 'P', group: 'Точки' },
  { key: 'mid', label: 'Середина', glyph: '½', hot: 'M', group: 'Точки' },
  { key: 'intersect', label: 'Пересечь', glyph: '∩', hot: 'I', group: 'Точки' },
  { key: 'segment', label: 'Отрезок', glyph: '—', hot: 'S', group: 'Линии' },
  { key: 'line', label: 'Прямая', glyph: '↔', hot: 'L', group: 'Линии' },
  { key: 'ray', label: 'Луч', glyph: '→', hot: 'R', group: 'Линии' },
  { key: 'polygon', label: 'Многоугольник', glyph: '△', hot: 'G', group: 'Линии' },
  { key: 'parallel', label: 'Параллельная', glyph: '∥', hot: 'A', group: 'Построения' },
  { key: 'perp', label: 'Перпендикуляр', glyph: '⊥', hot: 'T', group: 'Построения' },
  { key: 'altitude', label: 'Высота', glyph: '⊾', hot: 'H', group: 'Построения' },
  { key: 'median', label: 'Медиана', glyph: '⟋', hot: 'Q', group: 'Построения' },
  { key: 'bisector', label: 'Биссектриса', glyph: '∡', hot: 'B', group: 'Построения' },
  { key: 'circle', label: 'Окружность', glyph: '○', hot: 'C', group: 'Окружности' },
  { key: 'circum', label: 'Описанная', glyph: '⊚', hot: 'O', group: 'Окружности' },
  { key: 'incircle', label: 'Вписанная', glyph: '◎', hot: 'W', group: 'Окружности' },
  { key: 'tangent', label: 'Касательные', glyph: '⌒', hot: 'J', group: 'Окружности' },
  { key: 'angle', label: 'Угол', glyph: '∠', hot: 'U', group: 'Пометки' },
  { key: 'tick', label: 'Равные', glyph: '≡', hot: 'E', group: 'Пометки' },
  { key: 'measure', label: 'Длина', glyph: '5', hot: 'D', group: 'Пометки' },
  { key: 'text', label: 'Надпись', glyph: 'Т', hot: 'Y', group: 'Пометки' },
  { key: 'fill', label: 'Закрасить', glyph: '◆', hot: 'F', group: 'Оформление' },
  { key: 'color', label: 'Цвет', glyph: '◉', hot: 'K', group: 'Оформление' },
  { key: 'dash', label: 'Пунктир', glyph: '┄', hot: 'X', group: 'Оформление' },
  { key: 'rename', label: 'Имя', glyph: 'Aa', hot: 'N', group: 'Оформление' },
];

export const TOOL_GROUPS = [...new Set(TOOLS.map((t) => t.group))];

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
 * @param pxPerUnit — сколько пикселей экрана в единице доли
 */
export function snapPosition(t, pxPerUnit) {
  let best = null;
  for (const s of SNAPS) {
    const d = Math.abs(t - s.t);
    if (d * pxPerUnit <= SNAP_PX && d <= SNAP_MAX_T && (!best || d < best.d)) best = { d, s };
  }
  if (best) return best.s.ratio ? { t: best.s.t, ratio: best.s.ratio } : { t: best.s.t };
  return { t: Math.round(t * 100) / 100 };
}

/** Угол на окружности: до градуса, с прилипанием к кратным 15°. */
export function snapAngle(deg) {
  const a = ((deg % 360) + 360) % 360;
  const near = Math.round(a / 15) * 15;
  return (Math.abs(a - near) <= 2.5 ? near : Math.round(a)) % 360;
}

/** Координаты свободной точки: к узлам сетки с шагом step (0 — без прилипания). */
export function snapWorld(pos, step) {
  const r = (v) => (step > 0 ? Math.round(v / step) * step : v);
  // «+ 0» убирает отрицательный ноль: в тексте чертежа он вышел бы «-0».
  return { x: Math.round(r(pos.x) * 1000) / 1000 + 0, y: Math.round(r(pos.y) * 1000) / 1000 + 0 };
}

/** Подсказка над чертежом: что сделать дальше. */
export function toolHint(tool, pending = []) {
  const names = pending.filter((p) => p.kind === 'point').map((p) => prettyName(p.name));
  const has = pending.length > 0;
  switch (tool) {
    case 'point': return 'Клик по пустому месту — свободная точка; по линии или окружности — точка на ней; в перекрестье двух линий — их пересечение';
    case 'mid': return names.length ? `Середина ${names[0]}… — выберите вторую точку` : 'Кликните по отрезку — появится его середина (или выберите две точки)';
    case 'intersect': return has ? 'Выберите вторую линию или окружность' : 'Выберите две линии (или линию и окружность) — отметим их общие точки';
    case 'segment':
    case 'line':
    case 'ray': {
      const what = tool === 'line' ? 'Прямая' : tool === 'ray' ? 'Луч' : 'Отрезок';
      return names.length ? `${what} ${names[0]}… — вторая точка` : `${what}: две точки (клик по пустому месту ставит новую)`;
    }
    case 'polygon':
      return names.length >= 3
        ? `${names.join('')} — кликните по первой точке или Enter, чтобы замкнуть`
        : 'Вершины по порядку (клик по пустому месту ставит новую точку)';
    case 'parallel': return has ? 'Теперь вторая часть: точка или прямая' : 'Выберите точку и прямую, которой параллельна новая';
    case 'perp': return has ? 'Теперь вторая часть: точка или прямая' : 'Выберите точку и прямую — проведём через точку перпендикулярную прямую';
    case 'altitude': return has ? 'Теперь вторая часть: вершина или сторона' : 'Высота: выберите вершину и сторону (прямую) — получите основание, отрезок и прямой угол';
    case 'median': return has ? 'Теперь вторая часть: вершина или сторона' : 'Медиана: выберите вершину и сторону';
    case 'bisector':
      return names.length ? `Угол ${names.join('')}… — ещё ${3 - names.length}` : 'Биссектриса: три точки угла, вершина — вторая';
    case 'circle': return names.length ? `Центр ${names[0]} — теперь точка на окружности` : 'Окружность: центр, затем точка на ней';
    case 'circum': return names.length ? `Описанная около ${names.join('')}… — ещё ${3 - names.length}` : 'Описанная окружность: три вершины треугольника';
    case 'incircle': return names.length ? `Вписанная в ${names.join('')}… — ещё ${3 - names.length}` : 'Вписанная окружность: три вершины треугольника';
    case 'tangent': return has ? 'Теперь вторая часть: точка или окружность' : 'Касательные: выберите точку вне окружности и окружность';
    case 'angle': return names.length ? `Угол ${names.join('')}… — ещё ${3 - names.length}` : 'Пометка угла: три точки, вершина — вторая (число дуг и подпись — под инструментами)';
    case 'tick': return names.length ? `Отрезок ${names[0]}… — вторая точка` : 'Штрихи равных отрезков: кликайте по отрезкам (число штрихов — под инструментами)';
    case 'measure': return names.length ? `Отрезок ${names[0]}… — вторая точка` : 'Подпись отрезка: клик по отрезку (текст — под инструментами; пусто — его длина)';
    case 'text': return 'Клик по чертежу — надпись в этом месте (6, 60°, x, α, a ∥ b); клик по подписи — исправить её. Подписи тянутся мышью';
    case 'fill':
      return names.length >= 3
        ? `${names.join('')} — кликните по первой точке или Enter, чтобы закрасить`
        : 'Выберите вершины многоугольника по порядку';
    case 'color': return 'Клик по точке, отрезку, окружности или заливке — окрасится выбранным цветом (повторный клик снимает)';
    case 'dash': return 'Клик по отрезку или окружности — пунктир (повторный клик — снова сплошная)';
    case 'rename': return 'Кликните по точке: имя, «скрыть точку». Или двойной клик по точке в любом инструменте';
    default: return 'Тяните точки, буквы и подписи; двойной клик по подписи — исправить; пустое место — сдвиг чертежа, колёсико — масштаб';
  }
}

/** Инструменты, которые сами ставят точку там, куда кликнули. */
const POINT_MAKERS = new Set(['segment', 'line', 'ray', 'polygon', 'circle']);

/** Какие попадания инструмент принимает сейчас (для подсветки под курсором). */
export function acceptedKinds(tool, pending = []) {
  const hasP = pending.some((p) => p.kind === 'point');
  const hasL = pending.some((p) => p.kind === 'line');
  const hasC = pending.some((p) => p.kind === 'circle');
  const pointAndLine = () => (hasP ? ['line'] : hasL ? ['point'] : ['point', 'line']);
  switch (tool) {
    case 'point': return ['line', 'circle', 'empty'];
    case 'mid': return pending.length ? ['point'] : ['point', 'line'];
    case 'intersect': return ['line', 'circle'];
    case 'segment': case 'line': case 'ray': case 'polygon': case 'circle':
      return ['point', 'line', 'circle', 'empty'];
    case 'parallel': case 'perp': case 'altitude': case 'median': return pointAndLine();
    case 'bisector': case 'circum': case 'incircle': case 'angle': case 'fill': return ['point'];
    case 'tangent': return hasP ? ['circle'] : hasC ? ['point'] : ['point', 'circle'];
    case 'tick': case 'measure': return pending.length ? ['point'] : ['point', 'line'];
    case 'color': return ['point', 'line', 'circle', 'poly'];
    case 'dash': return ['line', 'circle'];
    case 'rename': return ['point'];
    case 'text': return ['empty'];
    default: return [];
  }
}

/**
 * Выбрать из попадания то, что инструмент принимает (точка важнее линии,
 * линия — окружности, заливка — пустого места).
 */
export function chooseHit(tool, pending, hit) {
  const ok = acceptedKinds(tool, pending);
  if (hit.point && ok.includes('point')) return { kind: 'point', name: hit.point };
  if (hit.line && ok.includes('line')) return { kind: 'line', ...hit.line };
  if (hit.circle && ok.includes('circle')) return { kind: 'circle', ...hit.circle };
  if (hit.poly && ok.includes('poly')) return { kind: 'poly', id: hit.poly.id };
  if (!hit.point && hit.pos && ok.includes('empty')) return { kind: 'empty', pos: hit.pos };
  return null;
}

/** Отрезок под кликом: кусок между соседними точками, иначе сама пара прямой. */
function pieceOf(model, target) {
  const seg = segmentAt(model, target, target.pos);
  if (seg) return seg;
  return Array.isArray(target.ref) ? target.ref : null;
}

/**
 * Клик инструмента.
 * @param hit  — { point?, line?: { id, ref, t, ratio?, pos, p, u }, line2?, circle?: { id, ref, angle },
 *                 poly?: { id }, pos: { x, y } (мир, с прилипанием), raw: { x, y }, shift? }
 * @param opts — { arcs, angleLabel, ticks, measureText } — настройки пометок
 * @returns {{ pending, ops?, error?, paint?, dash?, rename?, textAt? }}
 *   textAt — «Надпись»: где её поставить (мир, без прилипания); текст
 *   спрашивает редактор
 */
export function toolClick(tool, pending, hit, model, opts = {}) {
  if (tool === 'text') {
    const at = hit.raw || hit.pos;
    if (!at) return { pending: [] };
    return { pending: [], textAt: { x: Math.round(at.x * 100) / 100 + 0, y: Math.round(at.y * 100) / 100 + 0 } };
  }

  const used = new Set(Object.keys(model.points));
  const fresh = (kind) => {
    const n = nextFreeName(used, kind);
    used.add(n);
    return n;
  };

  // «Точка»: свои правила — перекрестье линий, линия, окружность, пусто.
  if (tool === 'point') {
    if (hit.point) return { pending, error: `Здесь уже есть точка ${prettyName(hit.point)}` };
    if (hit.line && hit.line2) {
      return { pending: [], ops: [{ id: newOpId(), type: 'intersect', name: fresh('cross'), l1: hit.line.ref, l2: hit.line2.ref }] };
    }
    if (hit.line && hit.circle) {
      const L = model.lineOf(hit.line.ref);
      const C = model.circleOf(hit.circle.ref);
      const hits = L && C ? lineCircle(L, C, model.tol) : [];
      const at = hit.raw || hit.pos;
      let k = 0;
      if (hits.length === 2 && at && dist(hits[1].point, at) < dist(hits[0].point, at)) k = 1;
      return { pending: [], ops: [{ id: newOpId(), type: 'lineCircle', name: fresh('cross'), ref: hit.line.ref, circle: hit.circle.ref, k }] };
    }
  }

  const target = chooseHit(tool, pending, hit);
  if (!target) return { pending };
  const same = (a, b) => a.kind === b.kind && (a.kind === 'point' ? a.name === b.name : a.id === b.id);
  const closing = (tool === 'fill' || tool === 'polygon') && target.kind === 'point' && pending[0]?.name === target.name;
  if (target.kind !== 'empty' && pending.some((p) => same(p, target)) && !closing) return { pending };

  // Превратить попадание в точку: существующую или новую (шаг журнала).
  const asPoint = (t) => {
    if (t.kind === 'point') return { name: t.name, ops: [] };
    if (t.kind === 'line') {
      const op = { id: newOpId(), type: 'pointOnLine', name: fresh('point'), ref: t.ref, t: t.t };
      if (t.ratio && Array.isArray(t.ref)) op.ratio = t.ratio;
      return { name: op.name, ops: [op] };
    }
    if (t.kind === 'circle') {
      const op = { id: newOpId(), type: 'pointOnCircle', name: fresh('point'), circle: t.ref, angle: snapAngle(t.angle) };
      return { name: op.name, ops: [op] };
    }
    const op = { id: newOpId(), type: 'point', name: fresh('free'), x: t.pos.x, y: t.pos.y };
    return { name: op.name, ops: [op] };
  };

  const pointNames = pending.filter((p) => p.kind === 'point').map((p) => p.name);

  switch (tool) {
    case 'point': {
      const { ops } = asPoint(target);
      return { pending: [], ops };
    }
    case 'mid': {
      const mid = (ref) => ({ pending: [], ops: [{ id: newOpId(), type: 'pointOnLine', name: fresh('mid'), ref, t: 0.5, ratio: [1, 1] }] });
      if (target.kind === 'line') {
        const seg = pieceOf(model, target);
        return seg ? mid(seg) : { pending: [], error: 'Кликните между двумя точками на линии — или выберите две точки' };
      }
      if (!pending.length) return { pending: [target] };
      return mid([pending[0].name, target.name]);
    }
    case 'intersect': {
      if (!pending.length) return { pending: [target] };
      const a = pending[0];
      const b = target;
      if (a.kind === 'line' && b.kind === 'line') {
        return { pending: [], ops: [{ id: newOpId(), type: 'intersect', name: fresh('cross'), l1: a.ref, l2: b.ref }] };
      }
      try {
        const ops = circleCrossOps(
          a.kind === 'circle' ? { circle: a.ref } : { line: a.ref },
          b.kind === 'circle' ? { circle: b.ref } : { line: b.ref },
          model,
          () => fresh('cross'),
        );
        return { pending: [], ops };
      } catch (e) {
        return { pending: [], error: e.message };
      }
    }
    case 'segment':
    case 'line':
    case 'ray': {
      const pt = asPoint(target);
      if (!pointNames.length) return { pending: [{ kind: 'point', name: pt.name }], ops: pt.ops };
      if (pointNames[0] === pt.name) return { pending };
      return { pending: [], ops: [...pt.ops, { id: newOpId(), type: tool, ref: [pointNames[0], pt.name] }] };
    }
    case 'polygon': {
      if (closing) {
        if (pointNames.length < 3) return { pending };
        return { pending: [], ops: [{ id: newOpId(), type: 'polygon', pts: pointNames }] };
      }
      const pt = asPoint(target);
      if (pointNames.includes(pt.name)) return { pending };
      return { pending: [...pending, { kind: 'point', name: pt.name }], ops: pt.ops };
    }
    case 'circle': {
      const pt = asPoint(target);
      if (!pointNames.length) return { pending: [{ kind: 'point', name: pt.name }], ops: pt.ops };
      if (pointNames[0] === pt.name) return { pending };
      return { pending: [], ops: [...pt.ops, { id: newOpId(), type: 'circle', circle: { k: 'cp', o: pointNames[0], a: pt.name } }] };
    }
    case 'parallel':
    case 'perp':
    case 'altitude':
    case 'median': {
      const all = [...pending, target];
      const p = all.find((x) => x.kind === 'point');
      const l = all.find((x) => x.kind === 'line');
      if (!p || !l) return { pending: all };
      if (tool === 'parallel' || tool === 'perp') {
        return { pending: [], ops: [{ id: newOpId(), type: tool, through: p.name, ref: l.ref }] };
      }
      if (tool === 'altitude') return { pending: [], ops: altitudeOps(fresh('foot'), p.name, l.ref, model) };
      const seg = pieceOf(model, l);
      if (!seg) return { pending: [], error: 'Медиана — к отрезку: кликните по стороне между двумя точками' };
      if (seg.includes(p.name)) return { pending: [], error: 'Вершина медианы лежит на этой стороне — выберите противоположную сторону' };
      const name = fresh('mid');
      return {
        pending: [],
        ops: [
          { id: newOpId(), type: 'pointOnLine', name, ref: seg, t: 0.5, ratio: [1, 1] },
          { id: newOpId(), type: 'segment', ref: [p.name, name] },
        ],
      };
    }
    case 'bisector': {
      const pts = [...pointNames, target.name];
      if (pts.length < 3) return { pending: [...pending, target] };
      // Сторона напротив нарисована — биссектриса треугольника (точка на стороне
      // и отрезок); иначе — луч биссектрисы угла.
      const opposite = !segStyleError(model, pts[0], pts[2]);
      return {
        pending: [],
        ops: opposite ? bisectorOps(fresh('bis'), pts) : [{ id: newOpId(), type: 'bisector', pts }],
      };
    }
    case 'circum':
    case 'incircle': {
      const pts = [...pointNames, target.name];
      if (pts.length < 3) return { pending: [...pending, target] };
      const circle = { k: tool === 'circum' ? 'circum' : 'in', pts };
      return {
        pending: [],
        ops: [
          { id: newOpId(), type: 'circle', circle },
          { id: newOpId(), type: 'center', name: fresh('center'), circle },
        ],
      };
    }
    case 'tangent': {
      const all = [...pending, target];
      const p = all.find((x) => x.kind === 'point');
      const c = all.find((x) => x.kind === 'circle');
      if (!p || !c) return { pending: all };
      const C = model.circleOf(c.ref);
      const P = model.points[p.name]?.pos;
      const r = C && P ? tangentPoints(P, C, model.tol * 10) : null;
      const ks = r?.kind === 'points' ? [0, 1] : [0]; // ошибку объяснит построение
      const ops = [];
      for (const k of ks) {
        const name = fresh('tangent');
        ops.push({ id: newOpId(), type: 'tangent', name, from: p.name, circle: c.ref, k });
        ops.push({ id: newOpId(), type: 'segment', ref: [p.name, name] });
      }
      return { pending: [], ops };
    }
    case 'angle': {
      const pts = [...pointNames, target.name];
      if (pts.length < 3) return { pending: [...pending, target] };
      const op = { id: newOpId(), type: 'angle', pts };
      if (opts.arcs > 1) op.arcs = opts.arcs;
      if (opts.angleLabel?.trim()) {
        const label = opts.angleLabel.trim();
        op.label = /^\d+(?:[.,]\d+)?$/.test(label) ? `${label}°` : label;
      }
      return { pending: [], ops: [op] };
    }
    case 'tick':
    case 'measure': {
      let seg = null;
      if (target.kind === 'line') seg = pieceOf(model, target);
      else if (!pending.length) return { pending: [target] };
      else seg = [pending[0].name, target.name];
      if (!seg) return { pending: [], error: 'Кликните по отрезку между двумя точками — или выберите две точки' };
      if (tool === 'tick') {
        return { pending: [], ops: [{ id: newOpId(), type: 'tick', segs: [seg], n: Math.min(3, Math.max(1, opts.ticks || 1)) }] };
      }
      let text = (opts.measureText || '').trim();
      if (!text) {
        const A = model.points[seg[0]]?.pos;
        const B = model.points[seg[1]]?.pos;
        text = A && B ? String(Math.round(dist(A, B) * 100) / 100).replace('.', ',') : '?';
      }
      return { pending: [], ops: [{ id: newOpId(), type: 'measure', ref: seg, text }] };
    }
    case 'fill': {
      if (closing) {
        if (pending.length < 3) return { pending };
        return { pending: [], ops: [{ id: newOpId(), type: 'fill', pts: pending.map((p) => p.name) }] };
      }
      return { pending: [...pending, target] };
    }
    case 'color':
    case 'dash': {
      // Оформление — не шаг журнала: решает редактор.
      const key = tool === 'color' ? 'paint' : 'dash';
      if (target.kind === 'point') return { pending: [], [key]: { name: target.name } };
      if (target.kind === 'circle') return { pending: [], [key]: { circle: target.id } };
      if (target.kind === 'poly') return { pending: [], [key]: { poly: target.id } };
      // Клик по линии — кусок между соседними точками, Shift — отрезок целиком.
      const seg = (!hit.shift && segmentAt(model, target, target.pos)) || (Array.isArray(target.ref) ? target.ref : null);
      if (!seg) return { pending: [], error: 'На этой прямой нет двух точек — поставьте точки, между которыми её выделить' };
      return { pending: [], [key]: { segment: segKey(seg[0], seg[1]) } };
    }
    case 'rename':
      return { pending: [], rename: { name: target.name } };
    default:
      return { pending: [] };
  }
}

/** Enter: замкнуть многоугольник / заливку. */
export function finishPending(tool, pending) {
  const names = pending.filter((p) => p.kind === 'point').map((p) => p.name);
  if ((tool === 'fill' || tool === 'polygon') && names.length >= 3) {
    return { pending: [], ops: [{ id: newOpId(), type: tool, pts: names }] };
  }
  return { pending };
}

// --- перемещение точек ---------------------------------------------------------
//
// Двигаются точки с собственной свободой: свободная (x, y), точка на прямой
// (доля t) и точка на окружности (угол). Пересечения, основания высот, центры
// — производные: едут сами, когда двигаются точки, через которые построены.

/** Операция, поставившая точку name, если точку можно двигать. */
export function draggableOp(scene, name) {
  return (scene?.ops || []).find(
    (o) => (o.type === 'point' || o.type === 'pointOnLine' || o.type === 'pointOnCircle') && o.name === name,
  ) || null;
}

/** Цель перетаскивания для точки операции; null — двигать нечем. */
export function dragTarget(model, op) {
  if (op.type === 'point') return { kind: 'free', name: op.name, opId: op.id };
  if (op.type === 'pointOnLine') {
    const line = model.lineOf(op.ref);
    if (!line) return null;
    return { kind: 'line', name: op.name, opId: op.id, line, onSegment: Array.isArray(op.ref) && op.t >= 0 && op.t <= 1 };
  }
  if (op.type === 'pointOnCircle') {
    const C = model.circleOf(op.circle);
    return C ? { kind: 'circle', name: op.name, opId: op.id, c: C.c } : null;
  }
  return null;
}

/**
 * Новое положение точки по курсору.
 * @param opts.step — шаг прилипания свободной точки (0 — без прилипания)
 */
export function dragPosition(target, frame, x, y, opts = {}) {
  const w = frame.toWorld(x, y);
  if (target.kind === 'free') return snapWorld(w, opts.step ?? 0);
  if (target.kind === 'circle') {
    return { angle: snapAngle((Math.atan2(w.y - target.c.y, w.x - target.c.x) * 180) / Math.PI) };
  }
  const { line } = target;
  let t = paramOnLine(w, line.p, line.u);
  t = target.onSegment ? Math.min(1, Math.max(0, t)) : Math.min(6, Math.max(-5, t));
  const snapped = snapPosition(t, Math.hypot(line.u.x, line.u.y) * frame.scale);
  // Концы отрезка — уже существующие точки; стоять ровно на них незачем.
  if (target.onSegment && (snapped.t <= 0.005 || snapped.t >= 0.995)) {
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
      if (o.type === 'point') return { ...o, x: pos.x, y: pos.y };
      if (o.type === 'pointOnCircle') return { ...o, angle: pos.angle };
      const next = { ...o, t: pos.t };
      if (pos.ratio && Array.isArray(o.ref)) next.ratio = pos.ratio; else delete next.ratio;
      return next;
    }),
  };
}

/** Угол буквы точки по курсору: направление «точка → курсор», шаг 15°. */
export function labelAngleAt(label, x, y) {
  const a = (Math.atan2(-(y - label.py), x - label.px) * 180) / Math.PI;
  return ((Math.round(a / 15) * 15) % 360 + 360) % 360;
}
