import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, renderStereo, DEFAULT_CAMERA, pickFace,
  draggableOp, lineOfOp, dragPosition, setOpPosition,
  toolClick, facePointAt, faceDragTarget, dragFacePosition, describeOp, isPointHidden, cameraBasis,
} from '../utils/stereo';

const cube = { kind: 'cube', a: 4 };
const traceScene = {
  body: cube,
  ops: [
    { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] },
    { id: 'b', type: 'pointOnLine', name: 'N', ref: ['B', 'B1'], t: 0.45 },
    { id: 'c', type: 'trace', name: 'X', ref: ['M', 'N'], plane: ['A', 'B', 'C', 'D'] },
  ],
};

describe('перемещение точек: логика', () => {
  it('двигать можно только точку на прямой', () => {
    expect(draggableOp(traceScene, 'M').id).toBe('a');
    expect(draggableOp(traceScene, 'X')).toBeNull(); // след — производный
    expect(draggableOp(traceScene, 'A')).toBeNull(); // вершина
  });

  it('позиция по курсору: прилипание, точка остаётся на ребре', () => {
    const model = evaluateScene(traceScene);
    const frame = renderStereo(model, DEFAULT_CAMERA, { width: 600, height: 500 });
    const line = lineOfOp(model, draggableOp(traceScene, 'M'));
    const a = frame.project(line.p);
    const b = frame.project({ x: line.p.x + line.u.x, y: line.p.y + line.u.y, z: line.p.z + line.u.z });
    const at = (t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
    expect(dragPosition(line, frame.project, ...at(0.34))).toEqual({ t: 1 / 3, ratio: [1, 2] });
    expect(dragPosition(line, frame.project, ...at(1.7)).t).toBe(0.99); // с ребра не съезжает
    expect(dragPosition(line, frame.project, ...at(1.7), { onSegment: false })).toEqual({ t: 1.7 });
  });

  it('сдвиг M тянет за собой след X, лишний ratio уходит', () => {
    const before = evaluateScene(traceScene).points.X.pos;
    const moved = setOpPosition(traceScene, 'a', { t: 0.42 });
    expect(moved.ops[0]).toEqual({ id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.42 });
    const after = evaluateScene(moved).points.X.pos;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.1); // след переехал
    expect(after.z).toBeCloseTo(-2, 9); // и остался в плоскости основания
    expect(traceScene.ops[0].t).toBe(0.5); // исходная сцена не тронута
  });
});

describe('точка внутри грани', () => {
  const model = evaluateScene({ body: cube, ops: [] });
  const frame = renderStereo(model, DEFAULT_CAMERA, { width: 600, height: 500 });
  const front = frame.hits.faces.find((f) => f.front && f.verts.includes('A') && f.verts.includes('B1'));
  const cx = front.pts.reduce((a, p) => a + p.x, 0) / front.pts.length;
  const cy = front.pts.reduce((a, p) => a + p.y, 0) / front.pts.length;

  it('клик по центру передней грани — точка в центре грани', () => {
    const face = pickFace(frame, cx, cy);
    expect(face.id).toBe(front.id);
    const pos = facePointAt(model, frame, face.id, cx, cy);
    const r = toolClick('point', [], { face: { id: face.id, verts: face.verts, pos } }, model);
    expect(r.op.type).toBe('pointOnFace');
    const m = evaluateScene({ body: cube, ops: [r.op] });
    const P = m.points[r.op.name].pos;
    expect(P.y).toBeCloseTo(-2, 6); // передняя грань y = −2
    expect(P.x).toBeCloseTo(0, 1);
    expect(P.z).toBeCloseTo(0, 1);
    expect(isPointHidden(m.body, P, cameraBasis(DEFAULT_CAMERA).toViewer)).toBe(false);
    expect(describeOp(r.op)).toMatch(/^M ∈ \(/);
  });

  it('перетаскивание по грани и край грани', () => {
    const op = { id: 'f', type: 'pointOnFace', name: 'K', face: front.verts, s: 0.5, t: 0.5 };
    const m = evaluateScene({ body: cube, ops: [op] });
    expect(draggableOp({ ops: [op] }, 'K')).toBe(op);
    const target = faceDragTarget(m, op);
    const inside = dragFacePosition(target, frame, cx + 10, cy + 5, m.body.size);
    expect(inside).not.toBeNull();
    const moved = evaluateScene({ body: cube, ops: [setOpPosition({ ops: [op] }, 'f', inside).ops[0]] });
    expect(moved.points.K.pos.y).toBeCloseTo(-2, 6); // осталась в плоскости грани
    expect(dragFacePosition(target, frame, cx + 2000, cy, m.body.size)).toBeNull(); // за край — нет
  });

  it('точка грани переименовывается и удаляется с зависимыми', async () => {
    const { renamePointInScene, removeOpCascade } = await import('../utils/stereo');
    const sc = { body: cube, ops: [
      { id: 'f', type: 'pointOnFace', name: 'K', face: ['A', 'B', 'B1', 'A1'], s: 0.3, t: 0.4 },
      { id: 'g', type: 'segment', ref: ['K', 'C1'] },
    ] };
    expect(renamePointInScene(sc, 'A', 'Q').ops[0].face[0]).toBe('Q');
    expect(removeOpCascade(sc, 'f').removed).toEqual(['f', 'g']);
  });
});

describe('перемещение точек: жест в редакторе', () => {
  const W = 600;
  const H = 500;
  let restoreRect;
  beforeAll(() => {
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function rect() {
      return { x: 0, y: 0, left: 0, top: 0, width: W, height: H, right: W, bottom: H, toJSON() {} };
    };
    restoreRect = () => { Element.prototype.getBoundingClientRect = orig; };
    if (!window.PointerEvent) {
      window.PointerEvent = class extends MouseEvent {
        constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; }
      };
    }
  });
  afterAll(() => restoreRect());
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: traceScene, camera: DEFAULT_CAMERA }));
  });

  it('двойной клик по точке открывает переименование, по вершине тоже', async () => {
    render(<AntApp><StereoEditor /></AntApp>);
    const svg = document.querySelector('.stereo-canvas svg');
    const frame = renderStereo(evaluateScene(traceScene), DEFAULT_CAMERA, { width: W, height: H });
    const b = frame.dots.find((d) => d.name === 'B');
    await act(async () => { fireEvent.doubleClick(svg, { clientX: b.x, clientY: b.y }); });
    const input = screen.getByLabelText('Новое имя точки');
    fireEvent.change(input, { target: { value: 'Q' } });
    await act(async () => { fireEvent.click(screen.getByText('Переименовать')); });
    expect(screen.getByText('N ∈ QB₁')).toBeTruthy(); // шаг «N на BB1» теперь на QB1
  });

  it('тянем M — меняется доля, след пересчитан; Ctrl+Z возвращает', async () => {
    render(<AntApp><StereoEditor /></AntApp>);
    const svg = document.querySelector('.stereo-canvas svg');
    // Кадр холста считается от описанной сферы — берём ту же модель и размер.
    const frame = renderStereo(evaluateScene(traceScene), DEFAULT_CAMERA, { width: W, height: H });
    const m = frame.dots.find((d) => d.name === 'M');
    const line = lineOfOp(evaluateScene(traceScene), traceScene.ops[0]);
    const a = frame.project(line.p);
    const b = frame.project({ x: line.p.x + line.u.x, y: line.p.y + line.u.y, z: line.p.z + line.u.z });
    const target = { x: a.x + (b.x - a.x) * 0.34, y: a.y + (b.y - a.y) * 0.34 };

    const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'mouse' });
    expect(screen.getByText('M ∈ AA₁, середина')).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(svg, ev(m.x, m.y));
      fireEvent.pointerMove(svg, ev((m.x + target.x) / 2, (m.y + target.y) / 2));
      fireEvent.pointerMove(svg, ev(target.x, target.y));
      fireEvent.pointerUp(svg, ev(target.x, target.y));
    });
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();
    expect(screen.getByText('X = MN ∩ (ABCD)')).toBeTruthy(); // след жив

    await act(async () => { fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true }); });
    expect(screen.getByText('M ∈ AA₁, середина')).toBeTruthy();
    expect(screen.getByText('X = MN ∩ (ABCD)')).toBeTruthy(); // отмена не сняла шаг
  });
});
