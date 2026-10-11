// Тела вращения: цилиндр, конус, усечённый конус, шар (база №11/№13,
// профиль №3 — треть банка стереометрии первой части).
//
// Для движка тело — выпуклый многогранник с N гранями по кругу (вписанный):
// на нём работают сечения, жидкость, точки, следы. Рисуется оно иначе:
//   • curves — окружности оснований (экватор шара) ломаной по рёбрам
//     многогранника: видимость кусков — как у рёбер (задняя половина
//     эллипса пунктиром);
//   • silhouette(toViewer) — контур под текущий ракурс, аналитически:
//     две образующие цилиндра, касательные из вершины конуса, у шара —
//     окружность, перпендикулярная взгляду. Контур всегда виден (своим телом
//     не закрывается);
//   • рёбра граней-полосок не рисуются вовсе.
// У шара и видимость аналитическая (sphere): луч к зрителю сквозь шар.
//
// Именованные точки: центры оснований O, O1, вершина S, точки A, A1 на
// окружностях. Без «с буквами» они скрыты (как на рисунках банка); на
// окружности точку ставит шаг «K на окружности O 120».

import {
  v3, add, sub, mul, dot, cross, norm,
} from './vec3';

export const REV_N = 48;

export const REVOLUTION_KINDS = ['cylinder', 'cone', 'tcone', 'sphere'];

const ring = (r, z, n = REV_N) => Array.from({ length: n }, (_, k) => {
  const t = (2 * Math.PI * k) / n;
  return v3(r * Math.cos(t), r * Math.sin(t), z);
});

function planeFace(pts, inwardRef) {
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  let p = pts;
  if (dot(n, sub(pts[0], inwardRef)) < 0) { n = mul(n, -1); p = [...pts].reverse(); }
  return { id: '', verts: null, pts3: p, n, d: dot(n, p[0]) };
}

/** Нормализованное описание тела вращения. */
export function normalizeRevolution(spec, num) {
  switch (spec.kind) {
    case 'cylinder': return { kind: 'cylinder', r: num(spec.r, 2), h: num(spec.h, 4) };
    case 'cone': return { kind: 'cone', r: num(spec.r, 2), h: num(spec.h, 4), ...(spec.down ? { down: true } : {}) };
    case 'tcone': {
      const r = num(spec.r, 3);
      let r2 = num(spec.r2, r / 2);
      if (r2 >= r) r2 = r / 2;
      return { kind: 'tcone', r, r2, h: num(spec.h, 3) };
    }
    case 'sphere': return { kind: 'sphere', r: num(spec.r, 2) };
    default: return null;
  }
}

/**
 * Строит тело вращения в формате buildBody + curves, silhouette, circles.
 */
export function buildRevolutionBody(spec) {
  const N = REV_N;
  const vertices = {};
  const order = [];
  const put = (name, p) => { vertices[name] = p; order.push(name); };
  const faces = [];
  const curves = [];
  const circles = {};
  const center = v3(0, 0, 0);
  const axisUp = v3(0, 0, 1);

  if (spec.kind === 'sphere') {
    const { r } = spec;
    // UV-сфера для граней (сечения у шара — аналитические, см. geometry.js)
    const LAT = 16;
    const rings = [];
    for (let i = 1; i < LAT; i += 1) {
      const phi = -Math.PI / 2 + (Math.PI * i) / LAT;
      rings.push(ring(r * Math.cos(phi), r * Math.sin(phi), N));
    }
    const south = v3(0, 0, -r);
    const north = v3(0, 0, r);
    for (let k = 0; k < N; k += 1) {
      const k2 = (k + 1) % N;
      faces.push(planeFace([south, rings[0][k2], rings[0][k]], center));
      faces.push(planeFace([north, rings[rings.length - 1][k], rings[rings.length - 1][k2]], center));
      for (let i = 0; i + 1 < rings.length; i += 1) {
        faces.push(planeFace([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], center));
      }
    }
    for (const f of faces) { f.surface = 'sphere'; f.center = 'O'; }
    const eq = ring(r, 0, N * 2);
    curves.push({ id: 'eq', pts: eq, analytic: true });
    put('O', center);
    put('A', v3(r * Math.cos(-Math.PI / 6), r * Math.sin(-Math.PI / 6), 0)); // на экваторе, спереди справа
    circles.O = { c: center, r, e1: v3(1, 0, 0), e2: v3(0, 1, 0), axis: axisUp, sphere: true };
    return finish(spec, {
      vertices, order, edges: [], faces, curves, circles, center, size: 2 * r,
      sphere: { c: center, r },
      silhouette: (v) => {
        const w = norm(v);
        const ref = Math.abs(w.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0);
        const e1 = norm(cross(w, ref));
        const e2 = cross(w, e1);
        const pts = Array.from({ length: 96 }, (_, k) => {
          const t = (2 * Math.PI * k) / 96;
          return add(mul(e1, r * Math.cos(t)), mul(e2, r * Math.sin(t)));
        });
        return pts.map((p, k) => [p, pts[(k + 1) % pts.length]]);
      },
    });
  }

  const { h } = spec;
  // Конус «вершиной вниз» (сосуд): у нижнего края радиус 0 — там вершина S,
  // основание с центром O — сверху.
  const down = spec.kind === 'cone' && spec.down;
  const rB = down ? 0 : spec.r; // радиус внизу
  const rT = spec.kind === 'cylinder' ? spec.r : spec.kind === 'tcone' ? spec.r2 : down ? spec.r : 0; // наверху
  const r1 = rB;
  const r2 = rT;
  const zb = -h / 2;
  const zt = h / 2;
  const bottom = rB > 0 ? ring(rB, zb) : null;
  const top = rT > 0 ? ring(rT, zt) : null;
  const apex = !top ? v3(0, 0, zt) : !bottom ? v3(0, 0, zb) : null;
  if (bottom) faces.push({ ...planeFace(bottom, center), surface: 'disk', center: 'O' });
  if (top) faces.push({ ...planeFace(top, center), surface: 'disk', center: down ? 'O' : 'O1' });
  const sideCenter = down ? 'S' : 'O';
  for (let k = 0; k < N; k += 1) {
    const k2 = (k + 1) % N;
    const quad = bottom && top
      ? [bottom[k], bottom[k2], top[k2], top[k]]
      : bottom ? [bottom[k], bottom[k2], apex] : [apex, top[k2], top[k]];
    faces.push({ ...planeFace(quad, center), surface: 'side', center: sideCenter });
  }
  if (bottom) curves.push({ id: 'b', pts: bottom });
  if (top) curves.push({ id: 't', pts: top });

  const E1 = v3(1, 0, 0);
  const E2 = v3(0, 1, 0);
  const ca = Math.cos(-Math.PI / 3);
  const sa = Math.sin(-Math.PI / 3);
  if (down) {
    // Вершина S внизу, основание O сверху; боковая поверхность — от вершины
    put('O', v3(0, 0, zt));
    put('S', apex);
    put('A', v3(rT * ca, rT * sa, zt));
    circles.O = { c: v3(0, 0, zt), r: rT, e1: E1, e2: E2, axis: axisUp };
    circles.S = { c: v3(0, 0, zb), r: 0, e1: E1, e2: E2, axis: axisUp, h, rTop: rT };
  } else {
    put('O', v3(0, 0, zb));
    // У нижней окружности — и ось с высотой: по ним точка на боковой поверхности
    circles.O = { c: v3(0, 0, zb), r: r1, e1: E1, e2: E2, axis: axisUp, h, rTop: r2 };
    if (top) {
      put('O1', v3(0, 0, zt));
      circles.O1 = { c: v3(0, 0, zt), r: r2, e1: E1, e2: E2, axis: axisUp };
    } else put('S', apex);
    // A — спереди справа (не на контуре, иначе образующая AA1 сливается с ним)
    put('A', v3(r1 * ca, r1 * sa, zb));
    if (top) put('A1', v3(r2 * ca, r2 * sa, zt));
  }

  // Контурная образующая под углом φ: нормаль боковой поверхности ⊥ взгляду.
  // Нормаль в точке φ — (h·cosφ, h·sinφ, r1 − r2): h(vx cosφ + vy sinφ) = −(r1 − r2)·vz.
  const silhouette = (v) => {
    const rho = Math.hypot(v.x, v.y);
    if (rho < 1e-9) return [];
    const c = (-(r1 - r2) * v.z) / (h * rho);
    if (Math.abs(c) > 1) return []; // смотрим почти вдоль оси: контура-образующих нет
    const psi = Math.atan2(v.y, v.x);
    const d = Math.acos(c);
    return [psi + d, psi - d].map((phi) => [
      v3(r1 * Math.cos(phi), r1 * Math.sin(phi), zb),
      v3(r2 * Math.cos(phi), r2 * Math.sin(phi), zt),
    ]);
  };
  return finish(spec, {
    vertices, order, edges: [], faces, curves, circles, center: v3(0, 0, 0), size: Math.hypot(2 * Math.max(r1, r2), h), silhouette,
  });
}

function finish(spec, body) {
  body.faces.forEach((f, i) => { f.id = `r${i}`; });
  // Рёбра многогранника — для сечений (sectionPolygon), на чертеже их нет.
  const seen = new Map();
  for (const f of body.faces) {
    f.pts3.forEach((a, i) => {
      const b = f.pts3[(i + 1) % f.pts3.length];
      const k = [a, b].map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`).sort().join('|');
      if (!seen.has(k)) seen.set(k, [a, b]);
    });
  }
  body.meshEdges = [...seen.values()];
  // Габарит — для масштаба чертежа (у тела мало именованных точек).
  const all = body.faces.flatMap((f) => f.pts3);
  const lo = all.reduce((m, p) => v3(Math.min(m.x, p.x), Math.min(m.y, p.y), Math.min(m.z, p.z)), v3(Infinity, Infinity, Infinity));
  const hi = all.reduce((m, p) => v3(Math.max(m.x, p.x), Math.max(m.y, p.y), Math.max(m.z, p.z)), v3(-Infinity, -Infinity, -Infinity));
  body.extent = [lo, hi, v3(lo.x, hi.y, lo.z), v3(hi.x, lo.y, hi.z), v3(lo.x, lo.y, hi.z), v3(hi.x, hi.y, lo.z)];
  // Буквы — только «с буквами»; иначе точки есть, но скрыты.
  body.concealed = new Set(spec.letters ? [] : body.order);
  body.revolution = true;
  return { spec, ...body };
}

// ─── шар: видимость и сечение ──────────────────────────────────────────────

/** Луч P + t·v (t > 0) проходит сквозь шар на ненулевой длине. */
export function rayThroughSphere(sp, P, v, eps) {
  const w = sub(P, sp.c);
  const a = dot(v, v);
  const b = 2 * dot(w, v);
  const c = dot(w, w) - sp.r * sp.r;
  const D = b * b - 4 * a * c;
  if (D <= 0) return false;
  const s = Math.sqrt(D);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  return t2 > eps && t2 - Math.max(t1, 0) > eps;
}

/** Сечение шара плоскостью — окружность ломаной; [] — не пересекает. */
export function sphereSection(sp, plane, n = 96) {
  const dist0 = dot(plane.n, sp.c) - plane.d;
  if (Math.abs(dist0) >= sp.r) return [];
  const rho = Math.sqrt(sp.r * sp.r - dist0 * dist0);
  const c = sub(sp.c, mul(plane.n, dist0));
  const ref = Math.abs(plane.n.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0);
  const e1 = norm(cross(plane.n, ref));
  const e2 = cross(plane.n, e1);
  return Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n;
    return add(c, add(mul(e1, rho * Math.cos(t)), mul(e2, rho * Math.sin(t))));
  });
}

/** Точка окружности тела по углу (°, против часовой, если смотреть сверху). */
export function circlePoint(circle, deg) {
  const t = (deg * Math.PI) / 180;
  return add(circle.c, add(mul(circle.e1, circle.r * Math.cos(t)), mul(circle.e2, circle.r * Math.sin(t))));
}

// ─── точка на поверхности тела вращения ───────────────────────────────────
//
// Шаг pointOnBody: surface 'side' (боковая поверхность: угол и доля t от
// нижней окружности к верхней / вершине), 'disk' (круг основания: угол и
// доля радиуса rho), 'sphere' (долгота и широта, °). center — центр нижней
// окружности (у верхнего круга — O1).

const rad = (d) => (d * Math.PI) / 180;
const around = (c, deg) => add(mul(c.e1, Math.cos(rad(deg))), mul(c.e2, Math.sin(rad(deg))));

/** Положение точки шага pointOnBody по окружности тела; null — не та поверхность. */
export function bodySurfacePoint(circle, op) {
  if (!circle) return null;
  const a = Number(op.angle) || 0;
  if (op.surface === 'sphere') {
    if (!circle.sphere) return null;
    const lat = rad(Number(op.lat) || 0);
    return add(circle.c, add(mul(around(circle, a), circle.r * Math.cos(lat)), mul(circle.axis, circle.r * Math.sin(lat))));
  }
  if (op.surface === 'disk') {
    const rho = Math.max(0, Math.min(1, Number(op.rho)));
    return add(circle.c, mul(around(circle, a), circle.r * rho));
  }
  if (op.surface === 'side') {
    if (circle.h == null) return null;
    const t = Number(op.t);
    const B = add(circle.c, mul(around(circle, a), circle.r));
    const T = add(add(circle.c, mul(circle.axis, circle.h)), mul(around(circle, a), circle.rTop || 0));
    return add(B, mul(sub(T, B), t));
  }
  return null;
}

const snapDeg = (d) => {
  const n = ((d % 360) + 360) % 360;
  const s15 = Math.round(n / 15) * 15;
  return Math.abs(s15 - n) <= 4 ? s15 % 360 : Math.round(n);
};
const snapFrac = (x) => {
  for (const f of [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]) if (Math.abs(x - f) <= 0.04) return Math.round(f * 1000) / 1000;
  return Math.round(x * 100) / 100;
};

/** Параметры шага pointOnBody по точке P на поверхности (прилипание к 15° и ½, ⅓…). */
export function bodySurfaceParams(circle, surface, P) {
  const w = sub(P, circle.c);
  const along = dot(w, circle.axis);
  const flat = sub(w, mul(circle.axis, along));
  const angle = snapDeg((Math.atan2(dot(flat, circle.e2), dot(flat, circle.e1)) * 180) / Math.PI);
  const radial = Math.hypot(dot(flat, circle.e1), dot(flat, circle.e2));
  if (surface === 'sphere') {
    const lat = Math.max(-90, Math.min(90, (Math.atan2(along, radial) * 180) / Math.PI));
    return { angle, lat: Math.abs(lat) <= 4 ? 0 : Math.round(lat) };
  }
  if (surface === 'disk') {
    const rho = radial / circle.r;
    return { angle, rho: rho >= 0.94 ? 1 : snapFrac(rho) };
  }
  return { angle, t: Math.max(0, Math.min(1, snapFrac(along / circle.h))) };
}

/** Объём и площадь поверхности тела вращения (точные формулы). */
export function revolutionMeasures(spec) {
  const { PI } = Math;
  switch (spec.kind) {
    case 'cylinder': return { V: PI * spec.r ** 2 * spec.h, S: 2 * PI * spec.r * (spec.r + spec.h), Sside: 2 * PI * spec.r * spec.h };
    case 'cone': {
      const l = Math.hypot(spec.r, spec.h);
      return { V: (PI * spec.r ** 2 * spec.h) / 3, S: PI * spec.r * (spec.r + l), Sside: PI * spec.r * l, l };
    }
    case 'tcone': {
      const l = Math.hypot(spec.r - spec.r2, spec.h);
      return {
        V: (PI * spec.h * (spec.r ** 2 + spec.r * spec.r2 + spec.r2 ** 2)) / 3,
        S: PI * (spec.r ** 2 + spec.r2 ** 2 + (spec.r + spec.r2) * l),
        Sside: PI * (spec.r + spec.r2) * l,
        l,
      };
    }
    case 'sphere': return { V: (4 / 3) * PI * spec.r ** 3, S: 4 * PI * spec.r ** 2 };
    default: return null;
  }
}

