// Геометрия плоскости: пересечения прямых и окружностей, описанная и
// вписанная окружности, касательные. Прямая — { p, u } (точка и направляющий
// вектор), окружность — { c, r }.

import {
  add, sub, mul, dot, cross, len, dist, unit, rot90, rotate, paramOnLine,
} from './vec2';

/**
 * Пересечение двух прямых.
 * @returns {{ kind: 'point', point, t1, t2 } | { kind: 'parallel' } | { kind: 'same' }}
 */
export function intersectLines(L1, L2, tol = 1e-9) {
  const d = cross(L1.u, L2.u);
  if (Math.abs(d) <= 1e-10 * len(L1.u) * len(L2.u)) {
    const off = Math.abs(cross(sub(L2.p, L1.p), L1.u)) / len(L1.u);
    return { kind: off <= tol ? 'same' : 'parallel' };
  }
  const w = sub(L2.p, L1.p);
  const t1 = cross(w, L2.u) / d;
  const t2 = cross(w, L1.u) / d;
  return { kind: 'point', point: add(L1.p, mul(L1.u, t1)), t1, t2 };
}

/**
 * Точки пересечения прямой с окружностью — по возрастанию t вдоль прямой.
 * Касание — одна точка.
 * @returns {{ t, point }[]}
 */
export function lineCircle(L, C, tol = 1e-9) {
  const t0 = paramOnLine(C.c, L.p, L.u);
  const foot = add(L.p, mul(L.u, t0));
  const h = dist(foot, C.c);
  if (h > C.r + tol) return [];
  const ul = len(L.u);
  const half = Math.sqrt(Math.max(0, C.r * C.r - h * h));
  if (half * half <= 2 * tol * C.r) return [{ t: t0, point: foot }];
  const dt = half / ul;
  return [
    { t: t0 - dt, point: add(L.p, mul(L.u, t0 - dt)) },
    { t: t0 + dt, point: add(L.p, mul(L.u, t0 + dt)) },
  ];
}

/**
 * Точки пересечения двух окружностей: первая — слева от луча «центр 1 →
 * центр 2», вторая — справа (порядок не меняется, пока центры не совпали).
 * @returns {{ kind: 'points', points: {x,y}[] } | { kind: 'none' } | { kind: 'same' }}
 */
export function circleCircle(C1, C2, tol = 1e-9) {
  const d = dist(C1.c, C2.c);
  if (d <= tol) return { kind: Math.abs(C1.r - C2.r) <= tol ? 'same' : 'none' };
  if (d > C1.r + C2.r + tol || d < Math.abs(C1.r - C2.r) - tol) return { kind: 'none' };
  const a = (C1.r * C1.r - C2.r * C2.r + d * d) / (2 * d);
  const e = unit(sub(C2.c, C1.c));
  const mid = add(C1.c, mul(e, a));
  const h2 = C1.r * C1.r - a * a;
  const h = Math.sqrt(Math.max(0, h2));
  if (h * h <= 2 * tol * C1.r) return { kind: 'points', points: [mid] };
  const n = rot90(e);
  return { kind: 'points', points: [add(mid, mul(n, h)), add(mid, mul(n, -h))] };
}

/** Описанная окружность треугольника; null — точки на одной прямой. */
export function circumcircle(A, B, C, tol = 1e-9) {
  const d = 2 * cross(sub(B, A), sub(C, A));
  const scale = Math.max(dist(A, B), dist(A, C), dist(B, C));
  if (Math.abs(d) <= tol * scale) return null;
  const b2 = dot(sub(B, A), sub(B, A));
  const c2 = dot(sub(C, A), sub(C, A));
  const ux = ((C.y - A.y) * b2 - (B.y - A.y) * c2) / d;
  const uy = ((B.x - A.x) * c2 - (C.x - A.x) * b2) / d;
  const c = { x: A.x + ux, y: A.y + uy };
  return { c, r: Math.hypot(ux, uy) };
}

/** Вписанная окружность треугольника; null — точки на одной прямой. */
export function incircle(A, B, C, tol = 1e-9) {
  const a = dist(B, C);
  const b = dist(A, C);
  const c = dist(A, B);
  const p = a + b + c;
  const area2 = Math.abs(cross(sub(B, A), sub(C, A)));
  if (area2 <= tol * Math.max(a, b, c) || p <= 0) return null;
  return {
    c: { x: (a * A.x + b * B.x + c * C.x) / p, y: (a * A.y + b * B.y + c * C.y) / p },
    r: area2 / p,
  };
}

/**
 * Точки касания касательных из точки P: первая — против часовой от луча
 * «центр → P», вторая — по часовой.
 * @returns {{ kind: 'points', points } | { kind: 'inside' } | { kind: 'on' }}
 */
export function tangentPoints(P, C, tol = 1e-9) {
  const d = dist(P, C.c);
  if (Math.abs(d - C.r) <= tol) return { kind: 'on' };
  if (d < C.r) return { kind: 'inside' };
  const alpha = Math.acos(C.r / d);
  const e = mul(unit(sub(P, C.c)), C.r);
  return { kind: 'points', points: [add(C.c, rotate(e, alpha)), add(C.c, rotate(e, -alpha))] };
}

/** Угол AVB в градусах (0…180). */
export function angleDeg(A, V, B) {
  const a = sub(A, V);
  const b = sub(B, V);
  const la = len(a);
  const lb = len(b);
  if (!(la > 0) || !(lb > 0)) return 0;
  const c = Math.max(-1, Math.min(1, dot(a, b) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}
