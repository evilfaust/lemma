// Геометрия построений: взаимное расположение прямых, след прямой на
// плоскости, плоскость по трём точкам, сечение выпуклого тела.
//
// Прямая — { p, u }: точка и направляющий вектор (не обязательно единичный).
// Плоскость — { n, d }: единичная нормаль, n·x = d.
// Допуски считаются от размера тела (size), чтобы не зависеть от масштаба.

import { add, sub, mul, dot, cross, len, norm, dist, centroid } from './vec3';

const REL_EPS = 1e-7;

/**
 * Взаимное расположение двух прямых.
 * @returns {{ kind: 'intersect', point, t1, t2 } | { kind: 'skew'|'parallel'|'same' }}
 */
export function intersectLines(l1, l2, size = 1) {
  const eps = REL_EPS * size;
  const c = cross(l1.u, l2.u);
  const cl = len(c);
  const w = sub(l2.p, l1.p);
  // Угол между прямыми: |u1×u2| / (|u1||u2|) = sin φ.
  if (cl <= 1e-9 * len(l1.u) * len(l2.u)) {
    const dLines = len(cross(w, l1.u)) / len(l1.u);
    return { kind: dLines <= eps ? 'same' : 'parallel' };
  }
  const gap = Math.abs(dot(w, c)) / cl; // расстояние между прямыми
  if (gap > Math.max(eps, 1e-6 * size)) return { kind: 'skew', gap };
  const c2 = cl * cl;
  const t1 = dot(cross(w, l2.u), c) / c2;
  const t2 = dot(cross(w, l1.u), c) / c2;
  return { kind: 'intersect', point: add(l1.p, mul(l1.u, t1)), t1, t2 };
}

/** Плоскость по трём точкам; null, если точки на одной прямой. */
export function planeFromPoints(a, b, c, size = 1) {
  const n = cross(sub(b, a), sub(c, a));
  const nl = len(n);
  if (nl <= REL_EPS * size * size) return null;
  const u = mul(n, 1 / nl);
  return { n: u, d: dot(u, a) };
}

/**
 * След прямой на плоскости.
 * @returns {{ kind: 'point', point, t } | { kind: 'parallel'|'inside' }}
 */
export function intersectLinePlane(line, plane, size = 1) {
  const denom = dot(plane.n, line.u);
  const off = plane.d - dot(plane.n, line.p);
  if (Math.abs(denom) <= 1e-9 * len(line.u)) {
    return { kind: Math.abs(off) <= REL_EPS * size ? 'inside' : 'parallel' };
  }
  const t = off / denom;
  return { kind: 'point', point: add(line.p, mul(line.u, t)), t };
}

/** Точки, совпадающие с точностью eps, схлопываются в одну. */
export function uniquePoints(pts, eps) {
  const out = [];
  for (const p of pts) if (!out.some((q) => dist(p, q) <= eps)) out.push(p);
  return out;
}

/** Выпуклый многоугольник в плоскости с нормалью n — упорядочить обходом. */
export function orderPolygon(pts, n) {
  if (pts.length < 3) return pts;
  const c = centroid(pts);
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const e1 = norm(cross(n, ref));
  const e2 = cross(n, e1);
  return pts
    .map((p) => {
      const d = sub(p, c);
      return { p, a: Math.atan2(dot(d, e2), dot(d, e1)) };
    })
    .sort((A, B) => A.a - B.a)
    .map((o) => o.p);
}

/**
 * Сечение выпуклого тела плоскостью: пересечение плоскости со всеми рёбрами,
 * вершины сечения — по обходу. Пусто, если плоскость тело не режет
 * (касание по вершине или ребру — тоже пусто).
 */
export function sectionPolygon(body, plane) {
  const eps = REL_EPS * body.size * 10;
  const pts = [];
  for (const [a, b] of body.edges) {
    const A = body.vertices[a];
    const B = body.vertices[b];
    const da = dot(plane.n, A) - plane.d;
    const db = dot(plane.n, B) - plane.d;
    if (Math.abs(da) <= eps) pts.push(A);
    if (Math.abs(db) <= eps) pts.push(B);
    if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
      const t = da / (da - db);
      pts.push(add(A, mul(sub(B, A), t)));
    }
  }
  const uniq = uniquePoints(pts, eps * 10);
  if (uniq.length < 3) return [];
  return orderPolygon(uniq, plane.n);
}

/** Точка внутри тела или на его поверхности. */
export function insideBody(body, P, eps = REL_EPS * body.size * 10) {
  return body.faces.every((f) => dot(f.n, P) - f.d <= eps);
}
