// Векторная алгебра на плоскости для планиметрических чертежей.

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
/** Косое произведение: > 0 — b слева от a (против часовой). */
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const unit = (a) => {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
/** Поворот на 90° против часовой. */
export const rot90 = (a) => ({ x: -a.y, y: a.x });
/** Поворот на угол (радианы) против часовой. */
export const rotate = (a, phi) => {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
/** Параметр проекции точки P на прямую p + t·u. */
export const paramOnLine = (P, p, u) => dot(sub(P, p), u) / dot(u, u);
/** Расстояние от точки P до прямой p + t·u. */
export const distToLine = (P, p, u) => Math.abs(cross(sub(P, p), u)) / len(u);
