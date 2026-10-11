import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, renderStereo, DEFAULT_CAMERA, toolClick, finishPending,
  dragOpPatch, setOpFields, parseCommand, opToCommand, pickFace, facePointAt,
} from '../utils/stereo';
import { dist } from '../utils/stereo/vec3';

// Точки и плоскости кликом там, где граней с вершинами нет: чертёж без тела,
// листы, поверхности тел вращения; перетаскивание таких точек.

const VP = { width: 400, height: 360 };
const space = { body: { kind: 'space' }, ops: [] };

function commit(sc, op) {
  const r = tryAppendOp(sc, op);
  expect(r.error).toBeNull();
  return r.scene;
}

function clickAt(scene, tool, x, y, pending = []) {
  const model = evaluateScene(scene);
  const frame = renderStereo(model, DEFAULT_CAMERA, VP);
  const f = pickFace(frame, x, y);
  const hit = {
    ray: frame.unproject(x, y),
    face: f ? { id: f.id, verts: f.verts, surface: f.surface, center: f.center, pos: facePointAt(model, frame, f.id, x, y) } : null,
  };
  return { r: toolClick(tool, pending, hit, model), model, frame };
}

describe('без тела: точки и листы кликом', () => {
  it('клик в пустоту ставит точку на «пол» z = 0', () => {
    const { r } = clickAt(space, 'point', 200, 180);
    expect(r.op).toMatchObject({ type: 'freePoint', name: 'A' });
    expect(r.op.at[2]).toBe(0);
  });

  it('«Плоскость»: клик в пустоту — лист z = 0 с буквой α, одна точка дважды — горизонтальный лист', () => {
    expect(clickAt(space, 'plane', 200, 180).r.op).toMatchObject({ type: 'sheet', z: 0, label: 'α' });
    let sc = commit(space, { id: 'p', type: 'freePoint', name: 'M', at: [0, 0, 1] });
    sc = commit(sc, { id: 's', type: 'sheet', z: 0, label: 'α' });
    const m = evaluateScene(sc);
    const r1 = toolClick('plane', [], { point: 'M' }, m);
    const r2 = toolClick('plane', r1.pending, { point: 'M' }, m);
    expect(r2.op).toMatchObject({ type: 'sheet', through: 'M', label: 'β' });
    expect(finishPending('plane', r1.pending, m).op).toMatchObject({ type: 'sheet', through: 'M' });
  });

  it('три точки «Плоскостью» — лист через них', () => {
    let sc = space;
    [[0, 0, 0], [3, 0, 0], [0, 3, 1]].forEach((at, i) => { sc = commit(sc, { id: `p${i}`, type: 'freePoint', name: 'ABC'[i], at }); });
    const m = evaluateScene(sc);
    let p = [];
    let r;
    for (const n of ['A', 'B', 'C']) { r = toolClick('plane', p, { point: n }, m); p = r.pending; }
    expect(r.op).toMatchObject({ type: 'sheet', pts: ['A', 'B', 'C'] });
    expect(tryAppendOp(sc, r.op).error).toBeNull();
  });

  it('клик по листу — точка в листе', () => {
    const sc = commit(space, { id: 's', type: 'sheet', z: 1, label: 'α', size: [8, 6] });
    const m = evaluateScene(sc);
    const fr = renderStereo(m, DEFAULT_CAMERA, VP);
    const c = fr.project({ x: 0.5, y: 0.5, z: 1 });
    const r = toolClick('point', [], { poly: { id: 's' }, ray: fr.unproject(c.x, c.y) }, m);
    expect(r.op.type).toBe('freePoint');
    expect(r.op.at[2]).toBeCloseTo(1);
  });

  it('«плоскость ABC» командой без тела — лист', () => {
    let sc = space;
    [[0, 0, 0], [3, 0, 0], [0, 3, 0]].forEach((at, i) => { sc = commit(sc, { id: `p${i}`, type: 'freePoint', name: 'ABC'[i], at }); });
    sc = commit(sc, parseCommand('плоскость ABC', evaluateScene(sc)).op);
    expect(evaluateScene(sc).sheets).toHaveLength(1);
  });

  it('перетаскивание: по горизонтали, с Shift — по высоте', () => {
    const sc = commit(space, { id: 'p', type: 'freePoint', name: 'A', at: [0, 0, 0] });
    const m = evaluateScene(sc);
    const fr = renderStereo(m, DEFAULT_CAMERA, VP);
    const op = sc.ops[0];
    const a = fr.project({ x: 0, y: 0, z: 0 });
    const flat = dragOpPatch(m, op, fr, a.x + 40, a.y + 10, {});
    expect(flat.at[2]).toBe(0);
    expect(flat.at[0]).not.toBe(0);
    const up = dragOpPatch(m, op, fr, a.x, a.y - 60, { shiftKey: true });
    expect(up.at.slice(0, 2)).toEqual([0, 0]);
    expect(up.at[2]).toBeGreaterThan(0);
    expect(setOpFields(sc, 'p', up).ops[0].at).toEqual(up.at);
  });
});

describe('тела вращения: точка кликом по поверхности', () => {
  const cyl = { body: { kind: 'cylinder', r: 2, h: 4 }, ops: [] };

  it('боковая поверхность: угол и доля высоты, точка лежит на цилиндре', () => {
    const m = evaluateScene(cyl);
    const fr = renderStereo(m, DEFAULT_CAMERA, VP);
    const P = { x: 2 * Math.cos(-0.6), y: 2 * Math.sin(-0.6), z: 0 };
    const s = fr.project(P);
    const { r } = clickAt(cyl, 'point', s.x, s.y);
    expect(r.op).toMatchObject({ type: 'pointOnBody', surface: 'side', center: 'O' });
    const sc = commit(cyl, r.op);
    const K = evaluateScene(sc).points[r.op.name].pos;
    expect(Math.hypot(K.x, K.y)).toBeCloseTo(2, 1);
    expect(K.z).toBeCloseTo(0, 0);
  });

  it('верхнее основание — точка в круге', () => {
    const fr = renderStereo(evaluateScene(cyl), DEFAULT_CAMERA, VP);
    const s = fr.project({ x: 0.5, y: 0.3, z: 2 });
    const { r } = clickAt(cyl, 'point', s.x, s.y);
    expect(r.op).toMatchObject({ type: 'pointOnBody', surface: 'disk', center: 'O1' });
  });

  it('шар — точка на сфере', () => {
    const sph = { body: { kind: 'sphere', r: 2 }, ops: [] };
    const fr = renderStereo(evaluateScene(sph), DEFAULT_CAMERA, VP);
    const c = fr.project({ x: 0, y: 0, z: 0 });
    const { r } = clickAt(sph, 'point', c.x + 10, c.y - 10);
    expect(r.op).toMatchObject({ type: 'pointOnBody', surface: 'sphere' });
    const K = evaluateScene(commit(sph, r.op)).points[r.op.name].pos;
    expect(dist(K, { x: 0, y: 0, z: 0 })).toBeCloseTo(2);
  });

  it('команды туда и обратно', () => {
    const m = evaluateScene(cyl);
    for (const c of ['K на поверхности O 30 0.5', 'K в круге O1 30 0.5', 'K на окружности O 120']) {
      const op = parseCommand(c, m).op;
      expect(opToCommand(op).replace(/,/g, '.')).toBe(c);
    }
    expect(parseCommand('K на сфере O 30 45', evaluateScene({ body: { kind: 'sphere', r: 2 }, ops: [] })).op)
      .toMatchObject({ surface: 'sphere', angle: 30, lat: 45 });
  });

  it('перетаскивание точки на окружности меняет угол', () => {
    const sc = commit(cyl, { id: 'k', type: 'pointOnCircle', name: 'K', center: 'O', angle: 0 });
    const m = evaluateScene(sc);
    const fr = renderStereo(m, DEFAULT_CAMERA, VP);
    const s = fr.project({ x: 2 * Math.cos(-1), y: 2 * Math.sin(-1), z: -2 });
    expect(dragOpPatch(m, sc.ops[0], fr, s.x, s.y).angle).toBe(300); // −57,3° = 302,7° → прилипает к 300°
  });
});

// --- в самом редакторе: клик мышью по холсту ---------------------------------
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';

describe('редактор: точки кликом без тела и на цилиндре', () => {
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
  beforeEach(() => localStorage.clear());
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'mouse' });
  const click = async (svg, x, y) => {
    await act(async () => {
      fireEvent.pointerDown(svg, ev(x, y));
      fireEvent.pointerUp(svg, ev(x, y));
    });
  };

  it('без тела: «Точка» в пустоту дважды, «Плоскость» по точке дважды — лист α', async () => {
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: { body: { kind: 'space' }, ops: [] }, camera: DEFAULT_CAMERA }));
    render(<AntApp><StereoEditor /></AntApp>);
    const svg = document.querySelector('.stereo-canvas svg');
    await act(async () => { fireEvent.keyDown(window, { key: 'p', code: 'KeyP' }); });
    await click(svg, 250, 260);
    await click(svg, 360, 240);
    expect(screen.getByText(/^A = \(/)).toBeTruthy();
    expect(screen.getByText(/^B = \(/)).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'g', code: 'KeyG' }); });
    // точка A — первый кружок на холсте
    const svgDots = document.querySelectorAll('.stereo-canvas svg circle');
    expect(svgDots.length).toBeGreaterThanOrEqual(2);
    const a = svgDots[0];
    const ax = Number(a.getAttribute('cx'));
    const ay = Number(a.getAttribute('cy'));
    await click(svg, ax, ay);
    await click(svg, ax, ay);
    expect(screen.getByText(/^Плоскость α через A/)).toBeTruthy();
  });

  it('цилиндр: «Точка» по боковой поверхности — шаг «на боковой поверхности»', async () => {
    const scene = { body: { kind: 'cylinder', r: 2, h: 4 }, ops: [] };
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene, camera: DEFAULT_CAMERA }));
    render(<AntApp><StereoEditor /></AntApp>);
    const svg = document.querySelector('.stereo-canvas svg');
    await act(async () => { fireEvent.keyDown(window, { key: 'p', code: 'KeyP' }); });
    const fr = renderStereo(evaluateScene(scene), DEFAULT_CAMERA, { width: W, height: H });
    const s = fr.project({ x: 2 * Math.cos(-0.6), y: 2 * Math.sin(-0.6), z: 0.3 });
    await click(svg, s.x, s.y);
    expect(screen.getByText(/на боковой поверхности/)).toBeTruthy();
  });
});
