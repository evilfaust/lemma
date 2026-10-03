// Измерения на стереочертеже: длины, расстояния, углы.
//
// Измерение — не шаг журнала и не оформление: оно живёт только у учителя
// (как величина угла в журнале шагов), в сцену, эфир и библиотеку не
// попадает. Хранится ссылками на объекты (имена точек, прямые-ссылки,
// плоскости-ссылки), а величина пересчитывается по текущей модели — поэтому
// после перетаскивания точки число обновляется само.
//
// Чертёж считается числами; точную форму (2√2, √6/3, arccos ⅓, 60°)
// восстанавливаем по квадрату величины (exact.recognizeRational): при
// целых размерах тела и «хороших» долях он рационален.

import { sub, dot, cross, len, norm } from './vec3';
import { prettyName, findFace } from './bodies';
import { refName, planeName, isPairRef, isPlaneRefId } from './scene';
import { planeFromPoints } from './geometry';
import {
  sqrtQ, surdLatex, surdComplexity, formatAngle, recognizeRational,
} from './exact';

/** Объект измерения: { kind: 'point', name } | { kind: 'line', ref } | { kind: 'plane', ref }. */
const RANK = { point: 0, line: 1, plane: 2 };

/** Измерение по двум объектам (порядок не важен) или угол ∠ABC по трём точкам. */
export function makeMeasure(a, b) {
  const [x, y] = RANK[a.kind] <= RANK[b.kind] ? [a, b] : [b, a];
  return { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, a: x, b: y };
}

export function makeVertexAngle(names) {
  return { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, vertex: [...names] };
}

/** Ключ для поиска одинаковых измерений. */
export function measureKey(m) {
  if (m.vertex) return `v:${m.vertex.join('')}`;
  const k = (o) => {
    if (o.kind === 'point') return `p:${o.name}`;
    if (o.kind === 'line') return `l:${isPairRef(o.ref) ? [...o.ref].sort().join('-') : o.ref}`;
    return `s:${Array.isArray(o.ref) ? [...o.ref].sort().join('-') : o.ref}`;
  };
  return [k(m.a), k(m.b)].sort().join('|');
}

/** Имена точек, на которые опирается измерение (подсветка на чертеже). */
export function measurePoints(m, model) {
  const out = new Set();
  const add = (n) => { if (n && model?.points?.[n]) out.add(n); };
  if (m.vertex) m.vertex.forEach(add);
  for (const o of [m.a, m.b].filter(Boolean)) {
    if (o.kind === 'point') add(o.name);
    else if (Array.isArray(o.ref)) o.ref.forEach(add);
  }
  return out;
}

// ─── геометрия модели ───────────────────────────────────────────────────

function pointOf(model, name) {
  const P = model.points[name]?.pos;
  if (!P) throw new Error(`Нет точки ${prettyName(name)}`);
  return P;
}

function lineOf(model, ref) {
  if (isPairRef(ref)) {
    const A = pointOf(model, ref[0]);
    const B = pointOf(model, ref[1]);
    const u = sub(B, A);
    if (len(u) < 1e-9 * model.body.size) throw new Error(`Точки ${ref.map(prettyName).join(' и ')} совпадают`);
    return { p: A, u };
  }
  const l = model.lines.find((x) => x.id === ref);
  if (!l) throw new Error('Этой прямой больше нет');
  return { p: l.p, u: l.u };
}

function planeOf(model, ref) {
  if (isPlaneRefId(ref)) {
    const pl = model.planes?.[ref];
    if (!pl) throw new Error('Этой плоскости больше нет');
    return { n: norm(pl.n), d: pl.d };
  }
  const names = ref || [];
  const face = names.every((n) => model.body.vertices[n]) ? findFace(model.body, names) : null;
  if (face) return { n: face.n, d: face.d };
  const pts = names.map((n) => pointOf(model, n));
  for (let i = 2; i < pts.length; i += 1) {
    const pl = planeFromPoints(pts[0], pts[1], pts[i], model.body.size);
    if (pl) return { n: norm(pl.n), d: dot(norm(pl.n), pts[0]) };
  }
  throw new Error(`Точки ${names.map(prettyName).join(', ')} лежат на одной прямой`);
}

// ─── запись величины ───────────────────────────────────────────────────

const comma = (x, k = 2) => (Math.round(x * 10 ** k) / 10 ** k).toFixed(k).replace(/\.?0+$/, '').replace('.', ',');

/** Длина: точная форма (если узнаётся и не громоздкая) + приближение. */
function lengthValue(v) {
  const r = recognizeRational(v * v, 400);
  const s = r ? sqrtQ(r) : null;
  const exact = s && surdComplexity(s) <= 7 ? surdLatex(s) : null;
  const approx = comma(v);
  // «4» и «≈ 4» — одно и то же
  return { latex: exact, approx: exact && s.m === 1n && s.q === 1n ? null : approx, value: v };
}

/** Угол по cos (со знаком). acute — между прямыми/плоскостями (≤ 90°). */
function angleValue(cos, { acute = true } = {}) {
  const c = Math.max(-1, Math.min(1, acute ? Math.abs(cos) : cos));
  const deg = (Math.acos(c) * 180) / Math.PI;
  const r = recognizeRational(c * c, 2000);
  let latex = null;
  if (r) {
    const f = formatAngle(r, 'cos');
    if (f && (f.special || surdComplexity(f.surd) <= 6)) {
      if (c >= 0 || f.latex === '90^\\circ') latex = f.latex;
      else latex = f.special ? `${180 - f.deg}^\\circ` : `180^\\circ - ${f.latex}`;
    }
  }
  const approx = `${comma(deg)}°`;
  const plain = latex && /^\d+\^\\circ$/.test(latex);
  return { latex, approx: plain ? null : approx, value: deg };
}

// ─── сами измерения ───────────────────────────────────────────────────────

const lineLabel = (ref, opsById) => refName(ref, opsById);
const planeLabel = (ref, opsById) => planeName(ref, opsById);

/**
 * Посчитать измерение по модели.
 * @returns {{ label, rows: [{ what, latex, approx }], note?, error? }}
 *   label — что измеряем («∠(AB₁, BC₁)»), rows — величины (у скрещивающихся
 *   прямых их две: угол и расстояние)
 */
export function evaluateMeasure(model, m) {
  const ob = model.opsById || {};
  const nameOf = (o) => (o.kind === 'point' ? prettyName(o.name) : o.kind === 'line' ? lineLabel(o.ref, ob) : planeLabel(o.ref, ob));
  let label = '';
  try {
    if (m.vertex) {
      const [A, B, C] = m.vertex;
      label = `∠${m.vertex.map(prettyName).join('')}`;
      const u = sub(pointOf(model, A), pointOf(model, B));
      const v = sub(pointOf(model, C), pointOf(model, B));
      if (len(u) < 1e-9 || len(v) < 1e-9) throw new Error('Вершина угла совпадает с концом стороны');
      return { label, rows: [{ what: 'угол', ...angleValue(dot(u, v) / (len(u) * len(v)), { acute: false }) }] };
    }
    const { a, b } = m;
    const eps = 1e-7 * model.body.size;
    const kinds = `${a.kind}-${b.kind}`;
    switch (kinds) {
      case 'point-point': {
        label = `${prettyName(a.name)}${prettyName(b.name)}`;
        const d = len(sub(pointOf(model, b.name), pointOf(model, a.name)));
        return { label, rows: [{ what: 'длина', ...lengthValue(d) }] };
      }
      case 'point-line': {
        label = `ρ(${nameOf(a)}, ${nameOf(b)})`;
        const P = pointOf(model, a.name);
        const L = lineOf(model, b.ref);
        const d = len(cross(sub(P, L.p), L.u)) / len(L.u);
        if (d < eps) return { label, rows: [], note: 'точка лежит на прямой' };
        return { label, rows: [{ what: 'расстояние', ...lengthValue(d) }] };
      }
      case 'point-plane': {
        label = `ρ(${nameOf(a)}, ${nameOf(b)})`;
        const P = pointOf(model, a.name);
        const pl = planeOf(model, b.ref);
        const d = Math.abs(dot(pl.n, P) - pl.d);
        if (d < eps) return { label, rows: [], note: 'точка лежит в плоскости' };
        return { label, rows: [{ what: 'расстояние', ...lengthValue(d) }] };
      }
      case 'line-line': {
        label = `∠(${nameOf(a)}, ${nameOf(b)})`;
        const L1 = lineOf(model, a.ref);
        const L2 = lineOf(model, b.ref);
        const n = cross(L1.u, L2.u);
        const w = sub(L2.p, L1.p);
        if (len(n) < 1e-9 * len(L1.u) * len(L2.u)) {
          const d = len(cross(w, L1.u)) / len(L1.u);
          if (d < eps) return { label, rows: [], note: 'прямые совпадают' };
          return { label: `ρ(${nameOf(a)}, ${nameOf(b)})`, rows: [{ what: 'расстояние', ...lengthValue(d) }], note: 'прямые параллельны' };
        }
        const rows = [{ what: 'угол', ...angleValue(dot(L1.u, L2.u) / (len(L1.u) * len(L2.u))) }];
        const d = Math.abs(dot(w, n)) / len(n);
        if (d < eps) return { label, rows, note: 'прямые пересекаются' };
        rows.push({ what: 'расстояние', ...lengthValue(d) });
        return { label, rows, note: 'прямые скрещиваются' };
      }
      case 'line-plane': {
        label = `∠(${nameOf(a)}, ${nameOf(b)})`;
        const L = lineOf(model, a.ref);
        const pl = planeOf(model, b.ref);
        const s = dot(norm(L.u), pl.n);
        if (Math.abs(s) < 1e-9) {
          const d = Math.abs(dot(pl.n, L.p) - pl.d);
          if (d < eps) return { label, rows: [], note: 'прямая лежит в плоскости' };
          return { label: `ρ(${nameOf(a)}, ${nameOf(b)})`, rows: [{ what: 'расстояние', ...lengthValue(d) }], note: 'прямая параллельна плоскости' };
        }
        // угол с плоскостью: cos φ = √(1 − sin²), sin φ = |u·n|
        return { label, rows: [{ what: 'угол', ...angleValue(Math.sqrt(Math.max(0, 1 - s * s))) }] };
      }
      case 'plane-plane': {
        label = `∠(${nameOf(a)}, ${nameOf(b)})`;
        const p1 = planeOf(model, a.ref);
        const p2 = planeOf(model, b.ref);
        const c = dot(p1.n, p2.n);
        if (Math.abs(Math.abs(c) - 1) < 1e-12) {
          const d = Math.abs(p2.d - Math.sign(c) * p1.d);
          if (d < eps) return { label, rows: [], note: 'плоскости совпадают' };
          return { label: `ρ(${nameOf(a)}, ${nameOf(b)})`, rows: [{ what: 'расстояние', ...lengthValue(d) }], note: 'плоскости параллельны' };
        }
        return { label, rows: [{ what: 'угол', ...angleValue(c) }] };
      }
      default:
        return { label, rows: [], error: 'Такое измерение не поддерживается' };
    }
  } catch (e) {
    return { label: label || 'измерение', rows: [], error: e.message };
  }
}
