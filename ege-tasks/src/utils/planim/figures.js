// Готовые фигуры: с них обычно начинается чертёж. Фигура — не особая
// сущность, а просто набор шагов журнала (свободные точки + многоугольник),
// поэтому вершины потом двигаются как любые точки.
//
// Буквы — как в школьных учебниках: у треугольника A слева внизу, B наверху,
// C справа; у четырёхугольника ABCD — A слева внизу, дальше по часовой
// стрелке (AD — нижнее основание, BC — верхнее).

import { newOpId } from './scene';

const r4 = (x) => Math.round(x * 10000) / 10000;
const RAD = Math.PI / 180;

/** Виды фигур: подпись, число вершин, параметры с умолчаниями (для окна «Новый чертёж»). */
export const FIGURE_KINDS = {
  empty: { label: 'Пустой лист', n: 0, params: [] },
  triangle: { label: 'Треугольник', n: 3, params: [] },
  quad: { label: 'Четырёхугольник', n: 4, params: [] },
  triangleSss: {
    label: 'Треугольник по трём сторонам', n: 3,
    params: [{ key: 'a', label: 'AB', def: 5 }, { key: 'b', label: 'BC', def: 6 }, { key: 'c', label: 'AC', def: 7 }],
  },
  rightTriangle: {
    label: 'Прямоугольный треугольник', n: 3,
    params: [{ key: 'a', label: 'Катет AC', def: 3 }, { key: 'b', label: 'Катет BC', def: 4 }],
  },
  isoTriangle: {
    label: 'Равнобедренный треугольник', n: 3,
    params: [{ key: 'a', label: 'Основание AC', def: 6 }, { key: 'h', label: 'Высота', def: 5 }],
  },
  equilateral: { label: 'Равносторонний треугольник', n: 3, params: [{ key: 'a', label: 'Сторона', def: 6 }] },
  square: { label: 'Квадрат', n: 4, params: [{ key: 'a', label: 'Сторона', def: 5 }] },
  rectangle: {
    label: 'Прямоугольник', n: 4,
    params: [{ key: 'a', label: 'AD', def: 7 }, { key: 'b', label: 'AB', def: 4 }],
  },
  parallelogram: {
    label: 'Параллелограмм', n: 4,
    params: [{ key: 'a', label: 'AD', def: 7 }, { key: 'b', label: 'AB', def: 4 }, { key: 'angle', label: 'Угол A, °', def: 60 }],
  },
  rhombus: {
    label: 'Ромб', n: 4,
    params: [{ key: 'a', label: 'Сторона', def: 5 }, { key: 'angle', label: 'Угол A, °', def: 60 }],
  },
  trapezoid: {
    label: 'Трапеция', n: 4,
    params: [{ key: 'a', label: 'Основание AD', def: 8 }, { key: 'b', label: 'Основание BC', def: 4 }, { key: 'h', label: 'Высота', def: 4 }],
  },
  isoTrapezoid: {
    label: 'Равнобедренная трапеция', n: 4,
    params: [{ key: 'a', label: 'Основание AD', def: 8 }, { key: 'b', label: 'Основание BC', def: 4 }, { key: 'h', label: 'Высота', def: 4 }],
  },
  rightTrapezoid: {
    label: 'Прямоугольная трапеция', n: 4,
    params: [{ key: 'a', label: 'Основание AD', def: 8 }, { key: 'b', label: 'Основание BC', def: 4 }, { key: 'h', label: 'Высота', def: 4 }],
  },
  regular: {
    label: 'Правильный многоугольник', n: null,
    params: [{ key: 'n', label: 'Сторон', def: 6, int: true, min: 3, max: 12 }, { key: 'a', label: 'Сторона', def: 3 }],
  },
  circle: { label: 'Окружность', n: 1, params: [{ key: 'r', label: 'Радиус', def: 3 }] },
};

/** Параметры вида с умолчаниями (лишнее отбрасывается, мусор заменяется). */
export function normalizeFigureSpec(spec) {
  const kind = FIGURE_KINDS[spec?.kind] ? spec.kind : 'triangle';
  const out = { kind };
  for (const p of FIGURE_KINDS[kind].params) {
    let v = Number(spec?.[p.key]);
    if (!Number.isFinite(v) || v <= 0) v = p.def;
    if (p.int) v = Math.min(p.max, Math.max(p.min, Math.round(v)));
    out[p.key] = v;
  }
  return out;
}

/** Сколько вершин у фигуры. */
export function figureVertexCount(specIn) {
  const s = normalizeFigureSpec(specIn);
  if (s.kind === 'regular') return s.n;
  return FIGURE_KINDS[s.kind].n;
}

/** Координаты вершин фигуры (левый нижний угол — в начале координат). */
export function figurePoints(specIn) {
  const s = normalizeFigureSpec(specIn);
  switch (s.kind) {
    case 'triangle': return [[0, 0], [2, 4], [6, 0]];
    case 'quad': return [[0, 0], [1, 3.5], [5, 4.5], [6.5, 0]];
    case 'triangleSss': {
      // AB = a, BC = b, AC = c; A(0;0), C(c;0), B — сверху.
      const { a, b, c } = s;
      if (a + b <= c || a + c <= b || b + c <= a) return null;
      const x = (a * a - b * b + c * c) / (2 * c);
      return [[0, 0], [x, Math.sqrt(Math.max(0, a * a - x * x))], [c, 0]];
    }
    case 'rightTriangle': return [[0, s.a], [s.b, 0], [0, 0]]; // прямой угол C
    case 'isoTriangle': return [[0, 0], [s.a / 2, s.h], [s.a, 0]];
    case 'equilateral': return [[0, 0], [s.a / 2, (s.a * Math.sqrt(3)) / 2], [s.a, 0]];
    case 'square': return [[0, 0], [0, s.a], [s.a, s.a], [s.a, 0]];
    case 'rectangle': return [[0, 0], [0, s.b], [s.a, s.b], [s.a, 0]];
    case 'parallelogram': {
      const dx = s.b * Math.cos(s.angle * RAD);
      const dy = s.b * Math.sin(s.angle * RAD);
      return [[0, 0], [dx, dy], [dx + s.a, dy], [s.a, 0]];
    }
    case 'rhombus': {
      const dx = s.a * Math.cos(s.angle * RAD);
      const dy = s.a * Math.sin(s.angle * RAD);
      return [[0, 0], [dx, dy], [dx + s.a, dy], [s.a, 0]];
    }
    case 'trapezoid': {
      const shift = (s.a - s.b) * 0.3;
      return [[0, 0], [shift, s.h], [shift + s.b, s.h], [s.a, 0]];
    }
    case 'isoTrapezoid': return [[0, 0], [(s.a - s.b) / 2, s.h], [(s.a + s.b) / 2, s.h], [s.a, 0]];
    case 'rightTrapezoid': return [[0, 0], [0, s.h], [s.b, s.h], [s.a, 0]];
    case 'regular': {
      // Нижняя сторона горизонтальна, A — слева внизу, дальше по часовой.
      const R = s.a / (2 * Math.sin(Math.PI / s.n));
      const start = -90 - 180 / s.n;
      const pts = Array.from({ length: s.n }, (_, k) => {
        const phi = (start - (k * 360) / s.n) * RAD;
        return [R * Math.cos(phi), R * Math.sin(phi)];
      });
      const minX = Math.min(...pts.map((p) => p[0]));
      const minY = Math.min(...pts.map((p) => p[1]));
      return pts.map(([x, y]) => [x - minX, y - minY]);
    }
    case 'circle': return [[0, 0]];
    default: return [];
  }
}

/**
 * Шаги журнала для фигуры.
 * @param names  — имена вершин (по числу вершин фигуры)
 * @param origin — куда поставить левый нижний угол
 * @returns {{ ops } | { error }}
 */
export function figureOps(specIn, names, origin = { x: 0, y: 0 }) {
  const s = normalizeFigureSpec(specIn);
  if (s.kind === 'empty') return { ops: [] };
  const pts = figurePoints(s);
  if (!pts) return { error: 'Такого треугольника нет: сторона не меньше суммы двух других' };
  if (!Array.isArray(names) || names.length !== pts.length || new Set(names).size !== names.length) {
    return { error: `Нужно ${pts.length} разных имён вершин` };
  }
  const ops = pts.map(([x, y], i) => ({
    id: newOpId(), type: 'point', name: names[i], x: r4(x + origin.x), y: r4(y + origin.y),
  }));
  if (s.kind === 'circle') {
    ops.push({ id: newOpId(), type: 'circle', circle: { k: 'cr', o: names[0], r: s.r } });
    return { ops };
  }
  ops.push({ id: newOpId(), type: 'polygon', pts: [...names] });
  if (s.kind === 'rightTriangle') {
    ops.push({ id: newOpId(), type: 'angle', pts: [names[0], names[2], names[1]], right: true });
  }
  return { ops };
}
