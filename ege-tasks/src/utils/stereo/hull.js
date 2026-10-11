// Выпуклая оболочка точек в пространстве — тела «по точкам»: октаэдр,
// куб с пирамидой сверху, куб со срезанными вершинами, свой многогранник.
//
// Точек немного (до 60), поэтому перебор: плоскость через три точки — грань
// оболочки, если все точки по одну сторону от неё. Грань — все точки на
// плоскости, упорядоченные плоской оболочкой (точки внутри грани и на её
// сторонах отбрасываются). Результат — выпуклый многогранник, на котором
// работают сечения и видимость движка без изменений.

import { sub, cross, dot, len, mul, norm } from './vec3';

/** Плоская выпуклая оболочка (Эндрю): индексы против часовой в базисе e1, e2. */
function hull2d(idx, pts, e1, e2) {
  const P = idx.map((i) => ({ i, x: dot(pts[i], e1), y: dot(pts[i], e2) }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (P.length < 3) return P.map((p) => p.i);
  const crossZ = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const scale = Math.max(1e-12, ...P.map((p) => Math.abs(p.x) + Math.abs(p.y)));
  const tol = 1e-9 * scale * scale;
  const lower = [];
  for (const p of P) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], p) <= tol) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let k = P.length - 1; k >= 0; k--) {
    const p = P[k];
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], p) <= tol) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map((p) => p.i);
}

/**
 * Выпуклая оболочка.
 * @param pts — [{x,y,z}]
 * @returns {{ faces: { verts: number[], n, d }[], edges: [number, number][], vertices: number[] } | null}
 *   verts грани — против часовой, если смотреть снаружи; null — точки в одной плоскости
 */
export function convexHull3(pts, eps = 1e-7) {
  const n = pts.length;
  if (n < 4) return null;
  let size = 0;
  for (const p of pts) for (const q of pts) size = Math.max(size, len(sub(p, q)));
  const tol = eps * Math.max(size, 1e-9);
  const planes = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const c = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
        const cl = len(c);
        if (cl <= tol * size) continue;
        let u = mul(c, 1 / cl);
        let d = dot(u, pts[i]);
        let pos = false;
        let neg = false;
        for (let m = 0; m < n && !(pos && neg); m++) {
          const s = dot(u, pts[m]) - d;
          if (s > tol) pos = true;
          else if (s < -tol) neg = true;
        }
        if (pos && neg) continue;
        if (!pos && !neg) return null; // все точки в одной плоскости
        if (pos) { u = mul(u, -1); d = -d; }
        if (planes.some((pl) => dot(pl.n, u) > 1 - 1e-9 && Math.abs(pl.d - d) <= tol)) continue;
        planes.push({ n: u, d });
      }
    }
  }
  if (planes.length < 4) return null;
  const faces = [];
  const edgeSet = new Map();
  for (const pl of planes) {
    const on = [];
    for (let m = 0; m < n; m++) if (Math.abs(dot(pl.n, pts[m]) - pl.d) <= tol) on.push(m);
    const ref = Math.abs(pl.n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const e1 = norm(cross(ref, pl.n));
    const e2 = cross(pl.n, e1);
    const verts = hull2d(on, pts, e1, e2);
    if (verts.length < 3) continue;
    faces.push({ verts, n: pl.n, d: pl.d });
    verts.forEach((a, t) => {
      const b = verts[(t + 1) % verts.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeSet.has(key)) edgeSet.set(key, a < b ? [a, b] : [b, a]);
    });
  }
  const used = new Set(faces.flatMap((f) => f.verts));
  return {
    faces,
    edges: [...edgeSet.values()],
    vertices: [...used].sort((a, b) => a - b),
  };
}
