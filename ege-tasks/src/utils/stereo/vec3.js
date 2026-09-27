// Векторная алгебра для стереочертежей. Точки и векторы — {x, y, z},
// мир: z — вверх. Всё чистое, без мутаций.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => len(sub(a, b));
export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export function norm(a) {
  const l = len(a);
  return l > 0 ? mul(a, 1 / l) : v3();
}
export function centroid(pts) {
  const c = pts.reduce((s, p) => add(s, p), v3());
  return mul(c, 1 / (pts.length || 1));
}

/** Параметр проекции точки P на прямую p + t·u (u — не обязательно единичный). */
export function paramOnLine(P, p, u) {
  const uu = dot(u, u);
  return uu > 0 ? dot(sub(P, p), u) / uu : 0;
}

/** Расстояние от точки до прямой p + t·u. */
export function distToLine(P, p, u) {
  const t = paramOnLine(P, p, u);
  return dist(P, add(p, mul(u, t)));
}
