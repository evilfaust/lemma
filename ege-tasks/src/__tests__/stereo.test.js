import { describe, it, expect } from 'vitest';
import {
  buildBody, findFace, bodyTitle, prettyName,
  evaluateScene, tryAppendOp, removeOpCascade, renamePointInScene,
  intersectLines, sectionPolygon, planeFromPoints,
  splitByVisibility, isPointHidden, cameraBasis, DEFAULT_CAMERA,
  renderStereo, pickLine, pickPoint, pickFace, stereoSvgString,
  parseCommand, describeOp, opToCommand, parsePosition, splitNames, normalizeCommand,
  nextFreeName,
} from '../utils/stereo';
import { sub, dot, dist, len, cross } from '../utils/stereo/vec3';

const cube = { kind: 'cube', a: 4 };
const V = (body, n) => body.vertices[n];
const near = (a, b, eps = 1e-9) => dist(a, b) < eps;
const collinear = (a, b, c) => len(cross(sub(b, a), sub(c, a))) < 1e-9;

function scene(ops, body = cube) {
  return { body, ops: ops.map((o, i) => ({ id: `t${i}`, ...o })) };
}

describe('тела', () => {
  it('куб: 8 вершин, 12 рёбер, 6 граней, нормали наружу', () => {
    const b = buildBody(cube);
    expect(b.order).toEqual(['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1']);
    expect(b.edges).toHaveLength(12);
    expect(b.faces).toHaveLength(6);
    for (const f of b.faces) {
      for (const n of b.order) expect(dot(f.n, V(b, n)) - f.d).toBeLessThan(1e-9);
    }
    expect(b.size).toBeCloseTo(4 * Math.sqrt(3), 9);
  });

  it('ребро AB — переднее и горизонтальное, основание снизу', () => {
    const b = buildBody(cube);
    expect(V(b, 'A').y).toBeLessThan(V(b, 'D').y);
    expect(V(b, 'A').z).toBeCloseTo(V(b, 'B').z, 12);
    expect(V(b, 'A1').z).toBeGreaterThan(V(b, 'A').z);
  });

  it('призма и пирамида', () => {
    const p3 = buildBody({ kind: 'prism', n: 3 });
    expect(p3.order).toEqual(['A', 'B', 'C', 'A1', 'B1', 'C1']);
    expect([p3.edges.length, p3.faces.length]).toEqual([9, 5]);
    const p6 = buildBody({ kind: 'prism', n: 6, a: 2 });
    expect([p6.order.length, p6.edges.length, p6.faces.length]).toEqual([12, 18, 8]);
    const pyr = buildBody({ kind: 'pyramid', n: 4 });
    expect(pyr.order).toEqual(['A', 'B', 'C', 'D', 'S']);
    expect([pyr.edges.length, pyr.faces.length]).toEqual([8, 5]);
    for (const f of pyr.faces) {
      for (const n of pyr.order) expect(dot(f.n, V(pyr, n)) - f.d).toBeLessThan(1e-9);
    }
  });

  it('правильный тетраэдр ABCD: все рёбра равны', () => {
    const t = buildBody({ kind: 'tetra', a: 3 });
    expect(t.order).toEqual(['A', 'B', 'C', 'D']);
    for (const [a, b] of t.edges) expect(dist(V(t, a), V(t, b))).toBeCloseTo(3, 9);
  });

  it('грань по именам в любом порядке и по трём вершинам', () => {
    const b = buildBody(cube);
    expect(findFace(b, ['A', 'D', 'D1', 'A1'])?.verts.length).toBe(4);
    expect(findFace(b, ['A', 'B', 'C'])?.verts.sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(findFace(b, ['A', 'C', 'C1'])).toBeNull(); // диагональная плоскость — не грань
  });

  it('подписи', () => {
    expect(prettyName('A1')).toBe('A₁');
    expect(bodyTitle(cube)).toBe('Куб ABCDA₁B₁C₁D₁');
    expect(bodyTitle({ kind: 'pyramid', n: 4 })).toBe('Пирамида SABCD');
  });
});

describe('геометрия', () => {
  const b = buildBody(cube);
  const L = (p, q) => ({ p: V(b, p), u: sub(V(b, q), V(b, p)) });

  it('скрещивающиеся, параллельные, пересекающиеся', () => {
    expect(intersectLines(L('A', 'B'), L('C', 'C1'), b.size).kind).toBe('skew');
    expect(intersectLines(L('A', 'B'), L('D', 'C'), b.size).kind).toBe('parallel');
    expect(intersectLines(L('A', 'B'), L('B', 'A'), b.size).kind).toBe('same');
    const r = intersectLines(L('A', 'C'), L('B', 'D'), b.size);
    expect(r.kind).toBe('intersect');
    expect(r.point.x).toBeCloseTo(0, 12);
    expect(r.point.y).toBeCloseTo(0, 12);
    expect(r.point.z).toBeCloseTo(-2, 12);
  });

  it('сечение куба: угол, диагональный прямоугольник, шестиугольник', () => {
    const mid = (p, q) => ({ x: (V(b, p).x + V(b, q).x) / 2, y: (V(b, p).y + V(b, q).y) / 2, z: (V(b, p).z + V(b, q).z) / 2 });
    const tri = sectionPolygon(b, planeFromPoints(mid('A', 'B'), mid('B', 'C'), mid('B', 'B1'), b.size));
    expect(tri).toHaveLength(3);
    const rect = sectionPolygon(b, planeFromPoints(V(b, 'A'), V(b, 'C'), V(b, 'A1'), b.size));
    expect(rect).toHaveLength(4);
    const hex = sectionPolygon(b, planeFromPoints(mid('A', 'B'), mid('B', 'C'), mid('C1', 'D1'), b.size));
    expect(hex).toHaveLength(6);
    // Обход без самопересечений: соседние стороны поворачивают в одну сторону.
    const n = planeFromPoints(hex[0], hex[1], hex[2], b.size).n;
    for (let i = 0; i < hex.length; i++) {
      const a = hex[i];
      const c = hex[(i + 1) % hex.length];
      const d = hex[(i + 2) % hex.length];
      expect(dot(cross(sub(c, a), sub(d, c)), n)).toBeGreaterThan(0);
    }
  });

  it('плоскость мимо тела — пусто', () => {
    const plane = { n: { x: 0, y: 0, z: 1 }, d: 10 };
    expect(sectionPolygon(b, plane)).toEqual([]);
  });
});

describe('видимость', () => {
  const b = buildBody(cube);
  const w = cameraBasis(DEFAULT_CAMERA).toViewer;

  it('в стандартном ракурсе скрыта только вершина D и три её ребра', () => {
    const hiddenVerts = b.order.filter((n) => isPointHidden(b, V(b, n), w));
    expect(hiddenVerts).toEqual(['D']);
    const hiddenEdges = b.edges
      .filter(([p, q]) => splitByVisibility(b, V(b, p), V(b, q), w).some((s) => s.hidden))
      .map((e) => e.join(''))
      .sort();
    expect(hiddenEdges).toEqual(['CD', 'DA', 'DD1']);
    for (const [p, q] of [['A', 'D'], ['C', 'D'], ['D', 'D1']]) {
      const pieces = splitByVisibility(b, V(b, p), V(b, q), w);
      expect(pieces).toEqual([{ t0: 0, t1: 1, hidden: true }]);
    }
  });

  it('диагональ сквозь тело скрыта целиком, по передней грани — видна', () => {
    const inner = splitByVisibility(b, V(b, 'A'), V(b, 'C1'), w);
    expect(inner).toHaveLength(1);
    expect(inner[0].hidden).toBe(true);
    const front = splitByVisibility(b, V(b, 'A'), V(b, 'B1'), w);
    expect(front).toEqual([{ t0: 0, t1: 1, hidden: false }]);
  });

  it('отрезок снаружи частично за телом — один скрытый кусок', () => {
    // Прямая через всё тело вдоль оси y на средней высоте, чуть сдвинутая влево.
    const A = { x: -1, y: -8, z: 0 };
    const B = { x: -1, y: 8, z: 0 };
    const pieces = splitByVisibility(b, A, B, w);
    expect(pieces.filter((p) => p.hidden)).toHaveLength(1);
    expect(pieces[0].hidden).toBe(false);
    expect(pieces[pieces.length - 1].hidden).toBe(false);
  });
});

describe('сцена', () => {
  it('точка на ребре по отношению', () => {
    const m = evaluateScene(scene([{ type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 1 / 3 }]));
    const b = m.body;
    expect(m.steps[0].ok).toBe(true);
    expect(dist(V(b, 'A'), m.points.M.pos) / dist(m.points.M.pos, V(b, 'A1'))).toBeCloseTo(0.5, 12);
  });

  it('MN ∥ AC: понятная ошибка, точка не появляется', () => {
    const m = evaluateScene(scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
      { type: 'intersect', name: 'X', l1: ['M', 'N'], l2: ['A', 'C'] },
    ]));
    expect(m.steps[2].ok).toBe(false);
    expect(m.steps[2].error).toMatch(/параллельны/);
    expect(m.points.X).toBeUndefined();
  });

  it('скрещивающиеся прямые — сообщение для класса', () => {
    const m = evaluateScene(scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'intersect', name: 'X', l1: ['M', 'C1'], l2: ['B', 'D'] },
    ]));
    expect(m.steps[1].error).toBe('Прямые MC₁ и BD скрещиваются — общей точки нет');
  });

  it('пересечение в плоскости AA1C1C лежит на обеих прямых и дорисовывает продолжения', () => {
    const m = evaluateScene(scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 1 / 3 },
      { type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 1 / 2 },
      { type: 'segment', ref: ['M', 'N'] },
      { type: 'intersect', name: 'X', l1: ['M', 'N'], l2: ['A', 'C'] },
    ]));
    const b = m.body;
    expect(m.steps[3].ok).toBe(true);
    const X = m.points.X.pos;
    expect(collinear(V(b, 'A'), V(b, 'C'), X)).toBe(true);
    expect(collinear(m.points.M.pos, m.points.N.pos, X)).toBe(true);
    // X за пределами куба: продолжение MN и сама прямая AC (её не было) дорисованы.
    const created = m.steps[3].created.lines.map((id) => m.lines.find((l) => l.id === id));
    expect(created.length).toBeGreaterThanOrEqual(2);
    expect(created.every((l) => l.kind === 'ext')).toBe(true);
    expect(created.some((l) => near(l.b, X) || near(l.a, X))).toBe(true);
  });

  it('след прямой на плоскости основания', () => {
    const m = evaluateScene(scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'pointOnLine', name: 'N', ref: ['B', 'B1'], t: 0.25 },
      { type: 'trace', name: 'X', ref: ['M', 'N'], plane: ['A', 'B', 'C', 'D'] },
    ]));
    expect(m.steps[2].ok).toBe(true);
    expect(m.points.X.pos.z).toBeCloseTo(-2, 12);
    const bad = evaluateScene(scene([{ type: 'trace', name: 'X', ref: ['A1', 'B1'], plane: ['A', 'B', 'C'] }]));
    expect(bad.steps[0].error).toMatch(/параллельна плоскости/);
  });

  it('совпадение с вершиной — синоним, без новой точки', () => {
    const m = evaluateScene(scene([{ type: 'intersect', name: 'X', l1: ['A', 'B'], l2: ['B', 'C'] }]));
    expect(m.steps[0].ok).toBe(true);
    expect(m.steps[0].created.note).toBe('Это точка B');
    expect(m.points.X.alias).toBe('B');
  });

  it('параллельная прямая и сечение, заливка, плоскость', () => {
    const m = evaluateScene(scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'parallel', through: 'M', ref: ['A', 'C'] },
      { type: 'section', pts: ['A', 'C', 'A1'] },
      { type: 'plane', pts: ['A', 'B', 'C', 'D'] },
      { type: 'fill', pts: ['A', 'B', 'C1', 'D1'] },
    ]));
    expect(m.steps.every((s) => s.ok)).toBe(true);
    expect(m.lines.find((l) => l.id === 't1').kind).toBe('line');
    expect(m.polys.map((p) => [p.kind, p.pts.length])).toEqual([['section', 4], ['plane', 4], ['fill', 4]]);
    const notFlat = evaluateScene(scene([{ type: 'fill', pts: ['A', 'B', 'C', 'C1'] }]));
    expect(notFlat.steps[0].error).toMatch(/не лежат в одной плоскости/);
  });

  it('ссылка на несуществующую точку и занятое имя', () => {
    const m = evaluateScene(scene([
      { type: 'segment', ref: ['M', 'A'] },
      { type: 'pointOnLine', name: 'A', ref: ['B', 'C'], t: 0.5 },
    ]));
    expect(m.steps[0].error).toBe('Нет точки M');
    expect(m.steps[1].error).toMatch(/занято/);
  });

  it('upTo — пошаговый просмотр', () => {
    const s = scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
    ]);
    expect(evaluateScene(s, { upTo: 1 }).points.N).toBeUndefined();
    expect(evaluateScene(s).points.N).toBeDefined();
  });

  it('tryAppendOp не портит сцену и сообщает ошибку', () => {
    const s = scene([]);
    const r = tryAppendOp(s, { id: 'x', type: 'intersect', name: 'X', l1: ['A', 'B'], l2: ['C', 'C1'] });
    expect(r.ok).toBe(false);
    expect(s.ops).toHaveLength(0);
  });

  it('удаление шага уносит зависимые', () => {
    const s = scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'pointOnLine', name: 'N', ref: ['C', 'C1'], t: 0.5 },
      { type: 'parallel', through: 'M', ref: ['A', 'C'] },
      { type: 'pointOnLine', name: 'K', ref: 't2', t: 0.3 },
      { type: 'segment', ref: ['N', 'B'] },
    ]);
    const { scene: next, removed } = removeOpCascade(s, 't0');
    expect(removed).toEqual(['t0', 't2', 't3']);
    expect(next.ops.map((o) => o.id)).toEqual(['t1', 't4']);
  });

  it('переименование точки во всём журнале', () => {
    const s = scene([
      { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
      { type: 'segment', ref: ['M', 'C'] },
    ]);
    const r = renamePointInScene(s, 'M', 'K');
    expect(r.ops[0].name).toBe('K');
    expect(r.ops[1].ref).toEqual(['K', 'C']);
    expect(evaluateScene(r).steps.every((st) => st.ok)).toBe(true);
  });

  it('радиус чертежа растёт, если точка ушла за тело', () => {
    const base = evaluateScene(scene([])).radius;
    const far = evaluateScene(scene([{ type: 'pointOnLine', name: 'X', ref: ['A', 'D'], t: 3 }])).radius;
    expect(far).toBeGreaterThan(base * 1.5);
  });
});

describe('команды', () => {
  const model = evaluateScene(scene([]));

  it('нормализация и имена', () => {
    expect(normalizeCommand('М на АА1')).toBe('M на AA1');
    expect(normalizeCommand('m на aa1 1:2')).toBe('M на AA1 1:2');
    expect(splitNames('AA1C1C')).toEqual(['A', 'A1', 'C1', 'C']);
    expect(splitNames('(ABC)')).toEqual(['A', 'B', 'C']);
    expect(splitNames('Ab')).toBeNull();
  });

  it('положение точки', () => {
    expect(parsePosition('1:2')).toEqual({ t: 1 / 3, ratio: [1, 2] });
    expect(parsePosition('1/4').t).toBe(0.25);
    expect(parsePosition('0,3').t).toBeCloseTo(0.3, 12);
    expect(parsePosition('середина').t).toBe(0.5);
    expect(parsePosition('')).toEqual({ t: 0.5, ratio: [1, 1] });
    expect(parsePosition('abc')).toBeNull();
  });

  it('точка на ребре, отрезок, прямая, параллельная', () => {
    expect(parseCommand('M на AA1 1:2', model).op).toMatchObject({ type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], ratio: [1, 2] });
    expect(parseCommand('на CC1', model).op).toMatchObject({ type: 'pointOnLine', name: 'M', t: 0.5 });
    expect(parseCommand('MN', model).op).toMatchObject({ type: 'segment', ref: ['M', 'N'] });
    expect(parseCommand('прямая A1C', model).op).toMatchObject({ type: 'line', ref: ['A1', 'C'] });
    expect(parseCommand('прямая K || AB', model).op).toMatchObject({ type: 'parallel', through: 'K', ref: ['A', 'B'] });
    expect(parseCommand('через K ∥ AB', model).op).toMatchObject({ type: 'parallel', through: 'K' });
  });

  it('пересечения и следы', () => {
    expect(parseCommand('X = MN ∩ AC', model).op).toMatchObject({ type: 'intersect', name: 'X', l1: ['M', 'N'], l2: ['A', 'C'] });
    expect(parseCommand('MN x AC', model).op).toMatchObject({ type: 'intersect', name: 'M' });
    expect(parseCommand('Y = MN х AD', model).op).toMatchObject({ type: 'intersect', name: 'Y' });
    expect(parseCommand('X = MN ∩ (ABCD)', model).op).toMatchObject({ type: 'trace', ref: ['M', 'N'], plane: ['A', 'B', 'C', 'D'] });
    expect(parseCommand('след MN ABC', model).op).toMatchObject({ type: 'trace', plane: ['A', 'B', 'C'] });
  });

  it('сечение, плоскость, заливка, служебные', () => {
    expect(parseCommand('сечение MND', model).op).toMatchObject({ type: 'section', pts: ['M', 'N', 'D'] });
    expect(parseCommand('грань AA1D1D', model).op).toMatchObject({ type: 'plane', pts: ['A', 'A1', 'D1', 'D'] });
    expect(parseCommand('заливка KLMN', model).op).toMatchObject({ type: 'fill' });
    expect(parseCommand('отмена', model)).toEqual({ action: 'undo' });
    expect(parseCommand('переименовать M K', model)).toEqual({ action: 'rename', from: 'M', to: 'K' });
  });

  it('ошибки разбора — подсказкой', () => {
    expect(parseCommand('ABC', model).error).toMatch(/сечение ABC/);
    expect(parseCommand('что-то', model).error).toMatch(/Не понял/);
    expect(parseCommand('сечение MN', model).error).toMatch(/тремя точками/);
  });

  it('описание шагов и обратно в команду', () => {
    const ops = [
      parseCommand('M на AA1 1:2', model).op,
      parseCommand('X = MN ∩ AC', model).op,
      parseCommand('сечение MND', model).op,
    ];
    expect(describeOp(ops[0])).toBe('M ∈ AA₁, AM : MA₁ = 1 : 2');
    expect(describeOp(ops[1])).toBe('X = MN ∩ AC');
    expect(describeOp(ops[2])).toBe('Сечение (MND)');
    for (const op of ops) {
      const again = parseCommand(opToCommand(op), model).op;
      expect({ ...again, id: op.id }).toEqual(op);
    }
  });

  it('автоимя — следующая свободная буква', () => {
    expect(nextFreeName(['M', 'N'])).toBe('K');
    const m = evaluateScene(scene([{ type: 'pointOnLine', name: 'M', ref: ['A', 'B'], t: 0.5 }]));
    expect(nextFreeName(m)).toBe('N');
    expect(parseCommand('на CC1', m).op.name).toBe('N');
  });
});

describe('отрисовка и выбор', () => {
  const m = evaluateScene(scene([
    { type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
    { type: 'section', pts: ['A', 'C', 'A1'] },
  ]));
  const frame = renderStereo(m, DEFAULT_CAMERA, { width: 600, height: 500 });

  it('скрытые рёбра — пунктиром, подписи у всех точек', () => {
    const hiddenEdges = new Set(frame.strokes.filter((s) => s.hidden && s.kind === 'edge').map((s) => s.objId));
    expect([...hiddenEdges].sort()).toEqual(['edge:C-D', 'edge:D-A', 'edge:D-D1']);
    expect(frame.labels.map((l) => l.name).sort()).toEqual(['A', 'A1', 'B', 'B1', 'C', 'C1', 'D', 'D1', 'M'].sort());
    expect(frame.polys).toHaveLength(1);
    // Контур диагонального сечения: AC идёт по нижней грани за телом — пунктир.
    expect(frame.strokes.some((s) => s.kind === 'section' && s.hidden)).toBe(true);
  });

  it('подписи не налезают друг на друга', () => {
    const L = frame.labels;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        expect(Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y)).toBeGreaterThan(8);
      }
    }
  });

  it('клик по середине ребра AB и по точке', () => {
    const ab = frame.hits.lines.find((l) => l.id === 'edge:A-B');
    const hit = pickLine(frame, (ab.x1 + ab.x2) / 2, (ab.y1 + ab.y2) / 2);
    expect(hit.line.ref).toEqual(['A', 'B']);
    expect(hit.t).toBeCloseTo(0.5, 6);
    const a = frame.dots.find((d) => d.name === 'A');
    expect(pickPoint(frame, a.x + 2, a.y + 1)).toBe('A');
    expect(pickPoint(frame, a.x + 60, a.y + 60)).toBeNull();
  });

  it('клик внутри передней грани', () => {
    const f = frame.hits.faces.find((x) => x.front);
    const cx = f.pts.reduce((s, p) => s + p.x, 0) / f.pts.length;
    const cy = f.pts.reduce((s, p) => s + p.y, 0) / f.pts.length;
    expect(pickFace(frame, cx, cy).front).toBe(true);
  });

  it('SVG-строка', () => {
    const svg = stereoSvgString(frame);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('<tspan dy="4" font-size="11">1</tspan>');
  });
});
