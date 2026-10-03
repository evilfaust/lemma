// Тела генератора задач по стереометрии: куб, прямоугольный параллелепипед,
// правильные призмы (3, 4, 6), правильный тетраэдр, правильные пирамиды
// (3, 4, 6).
//
// У каждого тела три лица:
//   • spec(dims) — описание для стереодвижка (чертёж, решение по шагам);
//   • lattice(dims) — точные координаты вершин в решётке (exact.js), по ним
//     считаются ответы;
//   • intro(dims) — первая фраза условия.
// Имена и порядок вершин — как у движка (bodies.js): основание, верх (A1…),
// вершина пирамиды. Расположение в пространстве у двух моделей разное, но
// тела конгруэнтны — длины и углы совпадают (это сверяют тесты).

import {
  Q, qmul, qdiv, qsub, qadd, qnum, sqrtQ, ZERO,
} from './exact';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** «A1» → «A_1» для LaTeX. */
export const texName = (name) => String(name).replace(/(\d+)/, '_{$1}').replace(/_\{(\d)\}/, '_$1');
export const texNames = (arr) => arr.map(texName).join('');

const pickInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// Квадрат радиуса описанной окружности правильного n-угольника со стороной a.
const R2 = (n, a) => qmul(Q(a * a), n === 3 ? Q(1, 3) : n === 4 ? Q(1, 2) : Q(1));

// Основание в решётке: коэффициенты (x, y), y — в единицах √gy.
function basePolygon(n, a, b = a) {
  const A = Q(a);
  const h = qdiv(A, Q(2));
  if (n === 3) return { gy: 3, pts: [[ZERO, ZERO], [A, ZERO], [h, h]], center: [h, qdiv(A, Q(6))] };
  if (n === 6) {
    const m = qmul(h, Q(-1));
    return {
      gy: 3,
      pts: [[A, ZERO], [h, h], [m, h], [qmul(A, Q(-1)), ZERO], [m, m], [h, m]],
      center: [ZERO, ZERO],
    };
  }
  const B = Q(b);
  return { gy: 1, pts: [[ZERO, ZERO], [A, ZERO], [A, B], [ZERO, B]], center: [h, qdiv(B, Q(2))] };
}

/** Высота h = √(h²) → единица оси √g и коэффициент. */
function zAxis(h2) {
  const s = sqrtQ(h2);
  return { gz: Number(s.m), z: Q(s.k, s.q) };
}

function prismLattice(n, a, h2, b) {
  const base = basePolygon(n, a, b);
  const { gz, z } = zAxis(h2);
  const names = LETTERS.slice(0, n);
  const vertices = {};
  names.forEach((nm, i) => { vertices[nm] = [...base.pts[i], ZERO]; });
  names.forEach((nm, i) => { vertices[`${nm}1`] = [...base.pts[i], z]; });
  return { g: [1, base.gy, gz], vertices, order: [...names, ...names.map((x) => `${x}1`)], baseCenter: [...base.center, ZERO] };
}

function pyramidLattice(n, a, h2, apex) {
  const base = basePolygon(n, a);
  const { gz, z } = zAxis(h2);
  const names = LETTERS.filter((l) => l !== apex).slice(0, n);
  const vertices = {};
  names.forEach((nm, i) => { vertices[nm] = [...base.pts[i], ZERO]; });
  vertices[apex] = [...base.center, z];
  return { g: [1, base.gy, gz], vertices, order: [...names, apex], baseCenter: [...base.center, ZERO] };
}

const num = (x) => `$${String(x).replace('.', '{,}')}$`;

// Оси координат для решения — словами
const AXES_A = 'начало — в точке $A$, оси $Ox$, $Oy$, $Oz$ направим по лучам $AB$, $AD$, $AA_1$';
const AXES_TRI = (up) => `начало — в точке $A$, ось $Ox$ направим по лучу $AB$, ось $Oy$ — в плоскости $ABC$ перпендикулярно $AB$ (в сторону $C$), ось $Oz$ — ${up}`;
const AXES_HEX = (up) => `начало — в центре $O$ основания, ось $Ox$ направим по лучу $OA$, ось $Oy$ — в плоскости основания перпендикулярно $OA$ (в сторону $B$), ось $Oz$ — ${up}`;
const AXES_SQ_PYR = 'начало — в точке $A$, оси $Ox$ и $Oy$ направим по лучам $AB$ и $AD$, ось $Oz$ — вверх, перпендикулярно основанию';

// Форма призмы: сторона a и высота h — целые, пропорции «как на картинке».
const prismShape = (widthK) => (rand) => {
  for (let k = 0; k < 50; k += 1) {
    const a = pickInt(rand, 1, 6);
    const h = pickInt(rand, 1, 8);
    const r = h / (a * widthK);
    if (r >= 0.6 && r <= 2.2) return { a, h, h2: Q(h * h) };
  }
  return { a: 2, h: 3, h2: Q(9) };
};

// Форма пирамиды: сторона a и боковое ребро l (или высота h) — целые.
const pyramidShape = (n, widthK) => (rand) => {
  for (let k = 0; k < 80; k += 1) {
    const a = pickInt(rand, 1, 6);
    if (rand() < 0.6) {
      const l = pickInt(rand, 1, 12);
      const h2 = qsub(Q(l * l), R2(n, a));
      if (h2.n <= 0n) continue;
      const r = Math.sqrt(qnum(h2)) / (a * widthK);
      if (r >= 0.7 && r <= 2) return { a, l, h2 };
    } else {
      const h = pickInt(rand, 1, 10);
      const r = h / (a * widthK);
      if (r >= 0.7 && r <= 2) return { a, h, h2: Q(h * h) };
    }
  }
  return { a: 2, h: 3, h2: Q(9) };
};

const prismIntro = (word) => (names, d, withDims) => (withDims
  ? `В правильной ${word} призме $${names}$ сторона основания равна ${num(d.a)}, а боковое ребро равно ${num(d.h)}.`
  : `Дана правильная ${word} призма $${names}$.`);

const pyramidIntro = (word) => (names, d, withDims) => {
  if (!withDims) return `Дана правильная ${word} пирамида $${names}$.`;
  const second = d.l != null ? `боковое ребро равно ${num(d.l)}` : `высота равна ${num(d.h)}`;
  return `В правильной ${word} пирамиде $${names}$ сторона основания равна ${num(d.a)}, а ${second}.`;
};

/**
 * Каталог тел. draw — чертёж для заданий без чисел («Постройте сечение»).
 */
export const GEN_BODIES = {
  cube: {
    label: 'Куб', short: 'куб', gen: 'куба', facet: 'Куб', prism: true, n: 4,
    draw: { kind: 'cube', a: 4 },
    shape: () => ({ a: 1 }),
    spec: (d) => ({ kind: 'cube', a: d.a }),
    lattice: (d) => prismLattice(4, d.a, Q(d.a * d.a)),
    axes: AXES_A,
    angleNeedsDims: false,
    intro: (names, d, withDims) => (withDims ? `Ребро куба $${names}$ равно ${num(d.a)}.` : `Дан куб $${names}$.`),
  },
  box: {
    label: 'Прямоугольный параллелепипед', short: 'параллелепипед', gen: 'параллелепипеда', facet: 'Прямоугольный параллелепипед', prism: true, n: 4,
    draw: { kind: 'box', a: 4, b: 3, c: 3.6 },
    shape: (rand) => {
      for (let k = 0; k < 50; k += 1) {
        const [a, b, c] = [pickInt(rand, 1, 6), pickInt(rand, 1, 6), pickInt(rand, 1, 7)];
        if (a === b && b === c) continue;
        if (Math.max(a, b, c) / Math.min(a, b, c) <= 3) return { a, b, c };
      }
      return { a: 2, b: 3, c: 4 };
    },
    spec: (d) => ({ kind: 'box', a: d.a, b: d.b, c: d.c }),
    lattice: (d) => prismLattice(4, d.a, Q(d.c * d.c), d.b),
    axes: AXES_A,
    angleNeedsDims: true,
    intro: (names, d, withDims) => (withDims
      ? `В прямоугольном параллелепипеде $${names}$ известны рёбра $AB = ${d.a}$, $AD = ${d.b}$, $AA_1 = ${d.c}$.`
      : `Дан прямоугольный параллелепипед $${names}$.`),
  },
  prism3: {
    label: 'Правильная треугольная призма', short: 'призма', gen: 'призмы', facet: 'Правильная треугольная призма', prism: true, n: 3,
    draw: { kind: 'prism', n: 3, a: 4, h: 4.8 },
    shape: prismShape(1),
    spec: (d) => ({ kind: 'prism', n: 3, a: d.a, h: d.h }),
    lattice: (d) => prismLattice(3, d.a, d.h2),
    axes: AXES_TRI('по лучу $AA_1$'),
    angleNeedsDims: true,
    intro: prismIntro('треугольной'),
  },
  prism4: {
    label: 'Правильная четырёхугольная призма', short: 'призма', gen: 'призмы', facet: 'Правильная четырёхугольная призма', prism: true, n: 4,
    draw: { kind: 'prism', n: 4, a: 3.6, h: 4.8 },
    shape: (rand) => {
      const s = prismShape(1)(rand);
      return s.a === s.h ? { ...s, h: s.h + 1, h2: Q((s.h + 1) ** 2) } : s;
    },
    spec: (d) => ({ kind: 'prism', n: 4, a: d.a, h: d.h }),
    lattice: (d) => prismLattice(4, d.a, d.h2),
    axes: AXES_A,
    angleNeedsDims: true,
    intro: prismIntro('четырёхугольной'),
  },
  prism6: {
    label: 'Правильная шестиугольная призма', short: 'призма', gen: 'призмы', facet: 'Правильная шестиугольная призма', prism: true, n: 6,
    draw: { kind: 'prism', n: 6, a: 2.4, h: 4.4 },
    shape: prismShape(2),
    spec: (d) => ({ kind: 'prism', n: 6, a: d.a, h: d.h }),
    lattice: (d) => prismLattice(6, d.a, d.h2),
    axes: AXES_HEX('по направлению $AA_1$'),
    angleNeedsDims: true,
    intro: prismIntro('шестиугольной'),
  },
  tetra: {
    label: 'Правильный тетраэдр', short: 'тетраэдр', gen: 'тетраэдра', facet: 'Правильный тетраэдр', prism: false, n: 3,
    draw: { kind: 'tetra', a: 4, apex: 'D' },
    shape: () => ({ a: 1 }),
    spec: (d) => ({ kind: 'tetra', a: d.a, apex: 'D' }),
    lattice: (d) => pyramidLattice(3, d.a, qmul(Q(2 * d.a * d.a), Q(1, 3)), 'D'),
    axes: AXES_TRI('вверх, перпендикулярно $ABC$'),
    angleNeedsDims: false,
    intro: (names, d, withDims) => (withDims
      ? `Ребро правильного тетраэдра $${names}$ равно ${num(d.a)}.`
      : `Дан правильный тетраэдр $${names}$.`),
  },
  pyramid3: {
    label: 'Правильная треугольная пирамида', short: 'пирамида', gen: 'пирамиды', facet: 'Правильная треугольная пирамида', prism: false, n: 3,
    draw: { kind: 'pyramid', n: 3, a: 4.4, h: 4.4, apex: 'S' },
    shape: pyramidShape(3, 1),
    spec: (d) => ({ kind: 'pyramid', n: 3, a: d.a, h: Math.sqrt(qnum(d.h2)), apex: 'S' }),
    lattice: (d) => pyramidLattice(3, d.a, d.h2, 'S'),
    axes: AXES_TRI('вверх, перпендикулярно основанию'),
    angleNeedsDims: true,
    intro: pyramidIntro('треугольной'),
  },
  pyramid4: {
    label: 'Правильная четырёхугольная пирамида', short: 'пирамида', gen: 'пирамиды', facet: 'Правильная четырёхугольная пирамида', prism: false, n: 4,
    draw: { kind: 'pyramid', n: 4, a: 4, h: 4.4, apex: 'S' },
    shape: pyramidShape(4, 1),
    spec: (d) => ({ kind: 'pyramid', n: 4, a: d.a, h: Math.sqrt(qnum(d.h2)), apex: 'S' }),
    lattice: (d) => pyramidLattice(4, d.a, d.h2, 'S'),
    axes: AXES_SQ_PYR,
    angleNeedsDims: true,
    intro: pyramidIntro('четырёхугольной'),
  },
  pyramid6: {
    label: 'Правильная шестиугольная пирамида', short: 'пирамида', gen: 'пирамиды', facet: 'Правильная шестиугольная пирамида', prism: false, n: 6,
    draw: { kind: 'pyramid', n: 6, a: 2.6, h: 4.4, apex: 'S' },
    shape: pyramidShape(6, 2),
    spec: (d) => ({ kind: 'pyramid', n: 6, a: d.a, h: Math.sqrt(qnum(d.h2)), apex: 'S' }),
    lattice: (d) => pyramidLattice(6, d.a, d.h2, 'S'),
    axes: AXES_HEX('вверх, по высоте $OS$'),
    angleNeedsDims: true,
    intro: pyramidIntro('шестиугольной'),
  },
};

export const GEN_BODY_KEYS = Object.keys(GEN_BODIES);

/** Размеры, умноженные на k (h² — на k²). */
export function scaleDims(d, k) {
  const out = { ...d };
  for (const f of ['a', 'b', 'c', 'h', 'l']) if (out[f] != null) out[f] *= k;
  if (out.h2) out.h2 = qmul(out.h2, Q(k * k));
  return out;
}

/** Наибольший линейный размер (для ограничения масштаба). */
export const maxDim = (d) => Math.max(...['a', 'b', 'c', 'h', 'l'].map((f) => d[f] || 0));

/** Имя тела в тексте: пирамида — с вершины («SABCD»), остальные — по порядку. */
export function bodyNamesTex(key, order) {
  if (key.startsWith('pyramid')) return `${texName(order.at(-1))}${texNames(order.slice(0, -1))}`;
  return texNames(order);
}

/** Первая фраза условия. */
export function bodyIntro(key, order, dims, withDims) {
  const def = GEN_BODIES[key];
  return def.intro(bodyNamesTex(key, order), dims || {}, withDims && !!dims);
}

/** Сумма вершин / их число — центр грани (решётка). */
export function latticeCenter(lat, names) {
  let s = [ZERO, ZERO, ZERO];
  for (const n of names) s = s.map((x, i) => qadd(x, lat.vertices[n][i]));
  return s.map((x) => qdiv(x, Q(names.length)));
}
