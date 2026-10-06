import { describe, it, expect } from 'vitest';
import {
  buildBody, normalizeBodySpec, bodyTitle, evaluateScene, renderStereo, DEFAULT_CAMERA,
  BASE_SHAPES,
} from '../utils/stereo';
import { parseBodyLine, bodyLine, parseStereoBlock } from '../utils/stereo/dsl';

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dist = (a, b) => len(sub(a, b));

// Все вершины — по внутреннюю сторону каждой грани, грани плоские.
function checkBody(body) {
  const scale = body.size;
  for (const f of body.faces) {
    for (const v of f.verts) {
      expect(Math.abs(dot(f.n, body.vertices[v]) - f.d)).toBeLessThan(1e-9 * scale);
    }
    for (const v of body.order) {
      expect(dot(f.n, body.vertices[v])).toBeLessThanOrEqual(f.d + 1e-9 * scale);
    }
  }
  // Эйлер: В − Р + Г = 2
  expect(body.order.length - body.edges.length + body.faces.length).toBe(2);
}

const SPECS = [
  { kind: 'prism', n: 5, a: 3 },
  { kind: 'prism', n: 8, a: 2 },
  { kind: 'prism', n: 3, base: 'free', tilt: 60 },
  { kind: 'prism', n: 4, base: 'trapezoid', h: 4 },
  { kind: 'prism', n: 4, base: 'free', tilt: 50, dir: 180, cw: true },
  { kind: 'prism', n: 6, base: 'free' },
  { kind: 'prism', base: 'right', tilt: 70, dir: 90 },
  { kind: 'prism', base: 'parallelogram', b: 3 },
  { kind: 'box', a: 4, b: 3, c: 5, tilt: 60 },
  { kind: 'box', a: 4, b: 3, c: 5, base: 'parallelogram', tilt: 65, cw: true },
  { kind: 'box', a: 4, c: 5, base: 'rhombus' },
  { kind: 'pyramid', n: 5 },
  { kind: 'pyramid', n: 4, base: 'free' },
  { kind: 'pyramid', n: 4, over: [0] },
  { kind: 'pyramid', n: 4, base: 'rect', over: [0, 1] },
  { kind: 'pyramid', n: 3, base: 'right', shift: [1, 0.5] },
  { kind: 'frustum', n: 3 },
  { kind: 'frustum', n: 4, base: 'trapezoid', k: 0.4, over: [1] },
  { kind: 'tetra', base: 'free' },
  { kind: 'tetra', over: [0] },
  { kind: 'pyramid', poly: [[0, 0], [4, 0], [5, 3], [1, 3]] },
];

describe('многогранники школьного курса', () => {
  it('все тела выпуклые, грани плоские, Эйлер сходится', () => {
    for (const spec of SPECS) checkBody(buildBody(spec));
    for (const base of Object.keys(BASE_SHAPES)) {
      for (const n of BASE_SHAPES[base].ns) {
        checkBody(buildBody({ kind: 'prism', n, base, tilt: 55 }));
        checkBody(buildBody({ kind: 'pyramid', n, base, over: [0] }));
        checkBody(buildBody({ kind: 'frustum', n, base, cw: true }));
      }
    }
  });

  it('тело центрировано (крутится вокруг себя)', () => {
    for (const spec of SPECS) {
      const b = buildBody(spec);
      expect(Math.hypot(b.center.x, b.center.y)).toBeLessThan(1e-9);
    }
  });

  it('наклонная призма: высота h, угол бокового ребра с основанием = tilt', () => {
    const b = buildBody({ kind: 'prism', n: 3, a: 4, h: 5, tilt: 60 });
    const { A, A1, B, B1 } = b.vertices;
    expect(A1.z - A.z).toBeCloseTo(5, 9);
    const edge = sub(A1, A);
    expect(Math.asin(edge.z / len(edge)) * 180 / Math.PI).toBeCloseTo(60, 6);
    // боковые рёбра параллельны и равны
    const e2 = sub(B1, B);
    expect(dist(edge, e2)).toBeLessThan(1e-9);
  });

  it('наклонный параллелепипед: AB = a, AD = b, грани — параллелограммы', () => {
    const b = buildBody({ kind: 'box', a: 5, b: 3, c: 4, base: 'parallelogram', tilt: 60 });
    const { A, B, C, D, A1, C1 } = b.vertices;
    expect(dist(A, B)).toBeCloseTo(5, 9);
    expect(dist(A, D)).toBeCloseTo(3, 9);
    expect(dist(sub(B, A), sub(C, D))).toBeLessThan(1e-9);
    expect(dist(sub(A1, A), sub(C1, C))).toBeLessThan(1e-9);
    expect(bodyTitle({ kind: 'box', tilt: 60 })).toMatch(/^Наклонный параллелепипед/);
  });

  it('пирамида «над A»: SA ⊥ основанию; «над AB» — над серединой AB', () => {
    const p = buildBody({ kind: 'pyramid', n: 4, a: 4, h: 5, over: [0] });
    const { S, A, B } = p.vertices;
    expect(S.x).toBeCloseTo(A.x, 9);
    expect(S.y).toBeCloseTo(A.y, 9);
    expect(S.z - A.z).toBeCloseTo(5, 9);
    const q = buildBody({ kind: 'pyramid', n: 4, a: 4, h: 5, over: [0, 1] });
    expect(q.vertices.S.x).toBeCloseTo((q.vertices.A.x + q.vertices.B.x) / 2, 9);
    expect(q.vertices.S.y).toBeCloseTo((q.vertices.A.y + q.vertices.B.y) / 2, 9);
  });

  it('усечённая пирамида: верхнее основание подобно нижнему с k, боковые рёбра сходятся', () => {
    const b = buildBody({ kind: 'frustum', n: 4, a: 4, h: 3, k: 0.5 });
    const { A, B, A1, B1, C, C1 } = b.vertices;
    expect(dist(A1, B1) / dist(A, B)).toBeCloseTo(0.5, 9);
    // продолжения AA₁ и CC₁ пересекаются (в вершине полной пирамиды)
    const S1 = { x: A.x + (A1.x - A.x) * 2, y: A.y + (A1.y - A.y) * 2, z: A.z + (A1.z - A.z) * 2 };
    const S2 = { x: C.x + (C1.x - C.x) * 2, y: C.y + (C1.y - C.y) * 2, z: C.z + (C1.z - C.z) * 2 };
    expect(dist(S1, S2)).toBeLessThan(1e-9);
    expect(bodyTitle({ kind: 'frustum', n: 3 })).toBe('Усечённая пирамида ABCA₁B₁C₁');
  });

  it('трапеция: AD ∥ BC, AD = a, BC = a/2', () => {
    const b = buildBody({ kind: 'prism', base: 'trapezoid', a: 6, cw: true });
    const { A, B, C, D } = b.vertices;
    expect(dist(A, D)).toBeCloseTo(6, 9);
    expect(dist(B, C)).toBeCloseTo(3, 9);
    const u = sub(D, A);
    const w = sub(C, B);
    expect(Math.abs(u.x * w.y - u.y * w.x)).toBeLessThan(1e-9);
    // по часовой AD — переднее ребро (A спереди слева, D спереди справа)
    expect(A.y).toBeCloseTo(D.y, 9);
    expect(D.x).toBeGreaterThan(A.x);
  });

  it('прямоугольный треугольник: угол C прямой; равнобедренный: AC = BC', () => {
    const r = buildBody({ kind: 'pyramid', base: 'right', a: 5 }).vertices;
    expect(Math.abs(dot(sub(r.A, r.C), sub(r.B, r.C)))).toBeLessThan(1e-9);
    const s = buildBody({ kind: 'prism', base: 'isosceles', a: 5 }).vertices;
    expect(dist(s.A, s.C)).toBeCloseTo(dist(s.B, s.C), 9);
  });

  it('неверное своё основание (невыпуклое) — правильное', () => {
    const s = normalizeBodySpec({ kind: 'prism', poly: [[0, 0], [4, 0], [1, 1], [0, 4]] });
    expect(s.base).toBeUndefined();
  });

  it('правильные тела не изменились: n = 5..8 разрешены', () => {
    expect(normalizeBodySpec({ kind: 'prism', n: 4 })).toEqual({ kind: 'prism', n: 4, a: 4, h: 4.8 });
    expect(normalizeBodySpec({ kind: 'pyramid', n: 5 }).n).toBe(5);
    expect(normalizeBodySpec({ kind: 'pyramid', n: 9 }).n).toBe(4);
    expect(normalizeBodySpec({ kind: 'tetra' })).toEqual({ kind: 'tetra', a: 4, apex: 'D' });
  });

  it('сечение строится на наклонной призме (задача 3.11)', () => {
    const scene = {
      body: { kind: 'prism', n: 3, base: 'free', tilt: 65 },
      ops: [
        { id: 'o1', type: 'pointOnLine', name: 'D', a: 'C', b: 'C1', t: 1.3 },
        { id: 'o2', type: 'pointOnLine', name: 'E', a: 'B', b: 'C', t: 0.5 },
        { id: 'o3', type: 'section', pts: ['A', 'E', 'D'] },
      ],
    };
    const model = evaluateScene(scene);
    expect(model.errors || []).toEqual([]);
    const frame = renderStereo(model, DEFAULT_CAMERA, { width: 400, height: 300 });
    expect(frame.polygons?.length || frame.fills?.length || 1).toBeGreaterThan(0);
  });
});

describe('тела в тексте блока ```stereo', () => {
  it('туда и обратно', () => {
    // числа в тексте округлены до сотых — сравниваем так же
    const round = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)));
    for (const spec of SPECS) {
      const s = normalizeBodySpec(spec);
      const line = bodyLine(s);
      const back = parseBodyLine(line);
      expect({ line, spec: round(back) }).toEqual({ line, spec: round(s) });
      expect(bodyLine(back)).toBe(line);
    }
  });

  it('человеческие строки', () => {
    expect(parseBodyLine('наклонная призма 3 4 5')).toMatchObject({ kind: 'prism', n: 3, tilt: 60 });
    expect(parseBodyLine('призма 3 4 5 наклон 70 влево')).toMatchObject({ tilt: 70, dir: 180 });
    expect(parseBodyLine('наклонный параллелепипед 4 3 5')).toMatchObject({ kind: 'box', tilt: 60 });
    expect(parseBodyLine('пирамида 5 3 4 S')).toMatchObject({ kind: 'pyramid', n: 5 });
    expect(parseBodyLine('пирамида 4 4 5 S над A')).toMatchObject({ over: [0] });
    expect(parseBodyLine('пирамида 4 4 5 S прямоугольник над AB')).toMatchObject({ base: 'rect', over: [0, 1] });
    expect(parseBodyLine('тетраэдр 4 D над A')).toMatchObject({ kind: 'tetra', over: [0] });
    expect(parseBodyLine('тетраэдр 4 3 D произвольный')).toMatchObject({ base: 'free', h: 3 });
    expect(parseBodyLine('произвольный тетраэдр 4 D')).toMatchObject({ base: 'free' });
    expect(parseBodyLine('усечённая пирамида 3 4 2')).toMatchObject({ kind: 'frustum', n: 3, a: 4, h: 2, k: 0.5 });
    expect(parseBodyLine('усеченная пирамида 4 4 2 0.3')).toMatchObject({ kind: 'frustum', k: 0.3 });
    // n у трапеции можно не писать
    expect(parseBodyLine('призма трапеция 6 4')).toMatchObject({ n: 4, base: 'trapezoid', a: 6, h: 4 });
    expect(parseBodyLine('пирамида основание (0 0) (4 0) (5 3) (1 3) h=5')).toMatchObject({
      base: 'poly', n: 4, h: 5, poly: [[0, 0], [4, 0], [5, 3], [1, 3]],
    });
    expect(parseBodyLine('призма основание (0;0) (4;0) (2,5;3)')).toMatchObject({ n: 3, poly: [[0, 0], [4, 0], [2.5, 3]] });
    // не тело
    expect(parseBodyLine('прямая MN')).toBeNull();
    expect(parseBodyLine('M на AA1 1:2')).toBeNull();
  });

  it('блок с наклонной призмой и сечением', () => {
    const r = parseStereoBlock('наклонная призма 3 4 5 произвольное\nD на CC1 1,3\nE на BC\nсечение AED');
    expect(r.errors).toEqual([]);
    expect(r.scene.body).toMatchObject({ kind: 'prism', base: 'free', tilt: 60 });
    expect(r.scene.ops.length).toBe(3);
  });
});
