// Ступенчатые многогранники — «все двугранные углы прямые» (база №11/№13,
// профиль №3): объединение прямоугольных блоков, из которого можно вычесть
// блоки. Тело невыпуклое, поэтому у него своя геометрия:
//
//   • сетка — все границы блоков по осям; ячейка сетки либо целиком внутри
//     тела, либо снаружи (filled);
//   • рёбра — отрезки сетки, где поверхность ломается (вокруг них 1 или 3
//     заполненные ячейки из четырёх, или 2 по диагонали); вершина — точка,
//     где ребро кончается или поворачивает;
//   • грани — прямоугольники (слитые квадраты поверхности одной плоскости):
//     нужны выбору кликом, жидкости и плоскостям по грани;
//   • видимость — точка скрыта, если луч к зрителю проходит сквозь
//     внутренность хоть одного блока (cells); у отрезка скрытых кусков может
//     быть несколько (visibility.js).
//
// Вершины подписываются только те, которым дали имя (labels — по
// координатам «x y z»), остальные — V1, V2… и скрыты, как на рисунках банка,
// где буквы стоят лишь у нужных вершин. «все буквы» — подписать все.

import { v3, sub, dot, dist } from './vec3';
import { sectionPolygon } from './geometry';

const AUTO_LETTERS = 'ABCDEFGHKLMNPRSTUWXYZ'.split('');

const key3 = (x, y, z) => `${fmtK(x)} ${fmtK(y)} ${fmtK(z)}`;
function fmtK(x) {
  return String(Math.round(x * 1000) / 1000);
}

/** [x, y, z, a, b, c] — угол блока и размеры; null — не блок. */
function normBox(b) {
  if (!Array.isArray(b) || b.length !== 6) return null;
  const v = b.map(Number);
  if (!v.every(Number.isFinite) || v[3] <= 0 || v[4] <= 0 || v[5] <= 0) return null;
  return v;
}

/** Нормализованное описание ступенчатого тела; null — блоков нет. */
export function normalizeBlocksSpec(spec) {
  const boxes = (Array.isArray(spec?.boxes) ? spec.boxes : []).map(normBox).filter(Boolean).slice(0, 16);
  if (!boxes.length) return null;
  const out = { kind: 'blocks', boxes };
  const minus = (Array.isArray(spec?.minus) ? spec.minus : []).map(normBox).filter(Boolean).slice(0, 16);
  if (minus.length) out.minus = minus;
  if (spec?.labels && typeof spec.labels === 'object') {
    const labels = {};
    for (const [k, n] of Object.entries(spec.labels)) {
      const pt = String(k).trim().split(/\s+/).map(Number);
      if (pt.length === 3 && pt.every(Number.isFinite) && /^[A-Z][0-9]*$/.test(n)) labels[key3(...pt)] = n;
    }
    if (Object.keys(labels).length) out.labels = labels;
  }
  if (spec?.letters) out.letters = true;
  // Есть ли хоть одна ячейка
  return gridOf(out).filled.some(Boolean) ? out : null;
}

const inBox = (b, p) => p[0] > b[0] && p[0] < b[0] + b[3] && p[1] > b[1] && p[1] < b[1] + b[4] && p[2] > b[2] && p[2] < b[2] + b[5];

/** Сетка и заполненность ячеек. */
function gridOf(spec) {
  const axes = [0, 1, 2].map((ax) => {
    const set = new Set();
    for (const b of [...spec.boxes, ...(spec.minus || [])]) { set.add(b[ax]); set.add(b[ax] + b[ax + 3]); }
    return [...set].sort((a, b) => a - b);
  });
  const [X, Y, Z] = axes;
  const nx = X.length - 1;
  const ny = Y.length - 1;
  const nz = Z.length - 1;
  const filled = new Array(Math.max(0, nx * ny * nz)).fill(false);
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let k = 0; k < nz; k += 1) {
        const c = [(X[i] + X[i + 1]) / 2, (Y[j] + Y[j + 1]) / 2, (Z[k] + Z[k + 1]) / 2];
        filled[(i * ny + j) * nz + k] = spec.boxes.some((b) => inBox(b, c)) && !(spec.minus || []).some((b) => inBox(b, c));
      }
    }
  }
  return { X, Y, Z, nx, ny, nz, filled };
}

/**
 * Строит ступенчатое тело в формате buildBody (+ cells, concealed, coordOf).
 */
export function buildBlocksBody(spec) {
  const g = gridOf(spec);
  const { X, Y, Z, nx, ny, nz } = g;
  const F = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && g.filled[(i * ny + j) * nz + k];
  const mid = [(X[0] + X[nx]) / 2, (Y[0] + Y[ny]) / 2, (Z[0] + Z[nz]) / 2];
  const P = (i, j, k) => v3(X[i] - mid[0], Y[j] - mid[1], Z[k] - mid[2]);
  const pk = (i, j, k) => `${i},${j},${k}`;

  // --- рёбра: единичные отрезки сетки, где поверхность ломается -----------
  const crease = new Map(); // ключ точки → Set направлений 'x+','x-',…
  const addDir = (a, d) => { if (!crease.has(a)) crease.set(a, new Set()); crease.get(a).add(d); };
  const isCrease = (c00, c10, c01, c11) => {
    const n = c00 + c10 + c01 + c11;
    if (n === 1 || n === 3) return true;
    return n === 2 && c00 === c11; // по диагонали
  };
  for (let i = 0; i <= nx; i += 1) {
    for (let j = 0; j <= ny; j += 1) {
      for (let k = 0; k <= nz; k += 1) {
        if (i < nx && isCrease(+F(i, j - 1, k - 1), +F(i, j, k - 1), +F(i, j - 1, k), +F(i, j, k))) {
          addDir(pk(i, j, k), 'x+'); addDir(pk(i + 1, j, k), 'x-');
        }
        if (j < ny && isCrease(+F(i - 1, j, k - 1), +F(i, j, k - 1), +F(i - 1, j, k), +F(i, j, k))) {
          addDir(pk(i, j, k), 'y+'); addDir(pk(i, j + 1, k), 'y-');
        }
        if (k < nz && isCrease(+F(i - 1, j - 1, k), +F(i, j - 1, k), +F(i - 1, j, k), +F(i, j, k))) {
          addDir(pk(i, j, k), 'z+'); addDir(pk(i, j, k + 1), 'z-');
        }
      }
    }
  }
  const isVertex = (dirs) => !(dirs.size === 2 && ['x', 'y', 'z'].some((a) => dirs.has(`${a}+`) && dirs.has(`${a}-`)));
  const vkeys = [...crease.entries()].filter(([, d]) => isVertex(d)).map(([k]) => k);
  const idx = (k) => k.split(',').map(Number);
  // Порядок: снизу вверх, спереди назад, слева направо
  vkeys.sort((a, b) => {
    const [ai, aj, ak] = idx(a);
    const [bi, bj, bk] = idx(b);
    return ak - bk || aj - bj || ai - bi;
  });

  // --- имена ---------------------------------------------------------------
  const labels = spec.labels || {};
  const nameOf = {};
  const coordOf = {};
  const concealed = new Set();
  const taken = new Set(Object.values(labels));
  let auto = 0;
  let hidden = 0;
  const nextAuto = () => {
    while (auto < AUTO_LETTERS.length && taken.has(AUTO_LETTERS[auto])) auto += 1;
    const n = auto < AUTO_LETTERS.length ? AUTO_LETTERS[auto] : `P${auto - AUTO_LETTERS.length + 1}`;
    auto += 1;
    taken.add(n);
    return n;
  };
  for (const k of vkeys) {
    const [i, j, kk] = idx(k);
    const ck = key3(X[i], Y[j], Z[kk]);
    let name = labels[ck];
    if (!name) {
      if (spec.letters) name = nextAuto();
      else {
        do { hidden += 1; name = `V${hidden}`; } while (taken.has(name));
        taken.add(name);
        concealed.add(name);
      }
    }
    nameOf[k] = name;
    coordOf[name] = ck;
  }
  const vertices = {};
  const order = vkeys.map((k) => nameOf[k]);
  for (const k of vkeys) vertices[nameOf[k]] = P(...idx(k));

  const STEP = { 'x+': [1, 0, 0], 'x-': [-1, 0, 0], 'y+': [0, 1, 0], 'y-': [0, -1, 0], 'z+': [0, 0, 1], 'z-': [0, 0, -1] };
  const edges = [];
  const seen = new Set();
  for (const k of vkeys) {
    for (const d of crease.get(k)) {
      let cur = idx(k);
      for (;;) {
        cur = cur.map((x, a) => x + STEP[d][a]);
        const ck = pk(...cur);
        if (nameOf[ck]) {
          const e = [nameOf[k], nameOf[ck]];
          const ek = [...e].sort().join('|');
          if (!seen.has(ek)) { seen.add(ek); edges.push(e); }
          break;
        }
        if (!crease.get(ck)?.has(d)) break; // не должно случаться: цепочка рёбер обрывается только в вершине
      }
    }
  }

  // --- грани: квадраты поверхности, слитые в прямоугольники ---------------
  const faces = [];
  const vertexAt = new Map(vkeys.map((k) => [k, nameOf[k]]));
  const AX = [
    { a: 0, u: 1, v: 2, n: [nx, ny, nz] },
    { a: 1, u: 2, v: 0, n: [nx, ny, nz] },
    { a: 2, u: 0, v: 1, n: [nx, ny, nz] },
  ];
  const cellF = (c) => F(c[0], c[1], c[2]);
  for (const { a, u, v } of AX) {
    const size = [nx, ny, nz];
    for (let s = 0; s <= size[a]; s += 1) {
      for (const sign of [1, -1]) {
        // квадрат (iu, iv) на плоскости a = s: ячейка изнутри заполнена, снаружи — нет
        const W = size[u];
        const H = size[v];
        const mark = Array.from({ length: W }, () => new Array(H).fill(false));
        for (let iu = 0; iu < W; iu += 1) {
          for (let iv = 0; iv < H; iv += 1) {
            const inside = [0, 0, 0];
            const outside = [0, 0, 0];
            inside[a] = sign > 0 ? s - 1 : s; outside[a] = sign > 0 ? s : s - 1;
            inside[u] = iu; outside[u] = iu; inside[v] = iv; outside[v] = iv;
            mark[iu][iv] = cellF(inside) && !cellF(outside);
          }
        }
        // жадное слияние в прямоугольники
        const used = mark.map((col) => col.map(() => false));
        for (let iu = 0; iu < W; iu += 1) {
          for (let iv = 0; iv < H; iv += 1) {
            if (!mark[iu][iv] || used[iu][iv]) continue;
            let w = 1;
            while (iu + w < W && mark[iu + w][iv] && !used[iu + w][iv]) w += 1;
            let h = 1;
            const rowOk = (r) => { for (let t = 0; t < w; t += 1) if (!mark[iu + t][r] || used[iu + t][r]) return false; return true; };
            while (iv + h < H && rowOk(iv + h)) h += 1;
            for (let t = 0; t < w; t += 1) for (let r = 0; r < h; r += 1) used[iu + t][iv + r] = true;
            const corner = (du, dv) => { const c = [0, 0, 0]; c[a] = s; c[u] = iu + du; c[v] = iv + dv; return c; };
            // обход против часовой снаружи: (u, v, a) — правая тройка
            let cs = [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)];
            if (sign < 0) cs = cs.reverse();
            const pts3 = cs.map((c) => P(...c));
            const nrm = [0, 0, 0];
            nrm[a] = sign;
            const n = v3(...nrm);
            const names = cs.map((c) => vertexAt.get(pk(...c)) || null);
            const verts = names.every(Boolean) ? names : null;
            faces.push({
              id: verts ? verts.join('') : `q${faces.length}`, verts, pts3, n, d: dot(n, pts3[0]),
            });
          }
        }
      }
    }
  }

  // --- ячейки для видимости: слитые в крупные блоки -------------------------
  const cells = [];
  const usedC = new Array(nx * ny * nz).fill(false);
  const U = (i, j, k) => usedC[(i * ny + j) * nz + k];
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let k = 0; k < nz; k += 1) {
        if (!F(i, j, k) || U(i, j, k)) continue;
        let di = 1;
        while (i + di < nx && F(i + di, j, k) && !U(i + di, j, k)) di += 1;
        let dj = 1;
        const okJ = (jj) => { for (let t = 0; t < di; t += 1) if (!F(i + t, jj, k) || U(i + t, jj, k)) return false; return true; };
        while (j + dj < ny && okJ(j + dj)) dj += 1;
        let dk = 1;
        const okK = (kk) => {
          for (let t = 0; t < di; t += 1) for (let r = 0; r < dj; r += 1) if (!F(i + t, j + r, kk) || U(i + t, j + r, kk)) return false;
          return true;
        };
        while (k + dk < nz && okK(k + dk)) dk += 1;
        for (let t = 0; t < di; t += 1) for (let r = 0; r < dj; r += 1) for (let q = 0; q < dk; q += 1) usedC[((i + t) * ny + j + r) * nz + k + q] = true;
        cells.push({ lo: P(i, j, k), hi: P(i + di, j + dj, k + dk) });
      }
    }
  }
  // Единичные ячейки — для сечений (соседние куски сечения делят ребро целиком)
  const unitCells = [];
  for (let i = 0; i < nx; i += 1) for (let j = 0; j < ny; j += 1) for (let k = 0; k < nz; k += 1) {
    if (F(i, j, k)) unitCells.push({ lo: P(i, j, k), hi: P(i + 1, j + 1, k + 1) });
  }

  const center = v3(0, 0, 0);
  const size = dist(P(0, 0, 0), P(nx, ny, nz));
  return {
    spec, vertices, order, edges, faces, center, size, cells, unitCells, concealed, coordOf,
  };
}

// ─── видимость ────────────────────────────────────────────────────────────

/** Луч P + t·d (t > 0) проходит сквозь внутренность блока на ненулевой длине. */
function rayThroughBox(box, P, d, eps) {
  let lo = 0;
  let hi = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const a = box.lo[ax];
    const b = box.hi[ax];
    if (Math.abs(d[ax]) < 1e-12) {
      if (P[ax] <= a + eps || P[ax] >= b - eps) return false;
      continue;
    }
    let t1 = (a - P[ax]) / d[ax];
    let t2 = (b - P[ax]) / d[ax];
    if (t1 > t2) [t1, t2] = [t2, t1];
    lo = Math.max(lo, t1);
    hi = Math.min(hi, t2);
    if (hi - lo <= eps) return false;
  }
  return hi - lo > eps;
}

/** Точка скрыта ступенчатым телом. */
export function isPointHiddenBlocks(body, P, toViewer) {
  const eps = 1e-6 * body.size;
  return body.cells.some((c) => rayThroughBox(c, P, toViewer, eps));
}

// ─── сечение ──────────────────────────────────────────────────────────────

/** Ячейка как выпуклое тело (для sectionPolygon). */
function cellBody(c, size) {
  const { lo, hi } = c;
  const pts = {
    a: v3(lo.x, lo.y, lo.z), b: v3(hi.x, lo.y, lo.z), c: v3(hi.x, hi.y, lo.z), d: v3(lo.x, hi.y, lo.z),
    e: v3(lo.x, lo.y, hi.z), f: v3(hi.x, lo.y, hi.z), g: v3(hi.x, hi.y, hi.z), h: v3(lo.x, hi.y, hi.z),
  };
  const edges = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['e', 'f'], ['f', 'g'], ['g', 'h'], ['h', 'e'], ['a', 'e'], ['b', 'f'], ['c', 'g'], ['d', 'h']];
  return { vertices: pts, edges, size };
}

/**
 * Сечение ступенчатого тела плоскостью — куски по ячейкам и признак общих
 * сторон (их контур не рисуется: внутри сечения линий нет).
 * @returns {{ pts: {x,y,z}[], skip: number[] }[]}
 */
export function blocksSectionPieces(body, plane) {
  const pieces = body.unitCells.map((c) => sectionPolygon(cellBody(c, body.size), plane)).filter((p) => p.length >= 3);
  const eps = 1e-7 * body.size;
  const same = (p, q) => dist(p, q) <= eps;
  return pieces.map((pts, pi) => {
    const skip = [];
    pts.forEach((A, i) => {
      const B = pts[(i + 1) % pts.length];
      const shared = pieces.some((other, oi) => oi !== pi && other.some((C, j) => {
        const D = other[(j + 1) % other.length];
        return (same(A, D) && same(B, C)) || (same(A, C) && same(B, D));
      }));
      if (shared) skip.push(i);
    });
    return { pts, skip };
  });
}

/** Объём ступенчатого тела (сумма ячеек). */
export function blocksVolume(body) {
  return body.unitCells.reduce((acc, c) => {
    const s = sub(c.hi, c.lo);
    return acc + s.x * s.y * s.z;
  }, 0);
}

