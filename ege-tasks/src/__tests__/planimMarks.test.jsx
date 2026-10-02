import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import PlanimEditor from '../components/planim/PlanimEditor';
import {
  parsePlanimBlock, buildPlanimBlock, evaluateScene, renderPlanim, fitView, pickMarkText,
  setMarkTextPosition, setMarkText, markTextOf, opToCommand, parseCommand, toolClick,
} from '../utils/planim';

// Чертёж со скрина учителя: параллелограмм, биссектриса BK, подписи 60°, 6, 2.
const SPEC = [
  'параллелограмм ABCD 8 6 60',
  'K на AD 0,75',
  'BK',
  'угол ABK 60',
  'длина BK 6',
  'длина KD 2',
].join('\n');

const VIEWPORT = { width: 600, height: 500 };
const frameOf = (scene) => {
  const model = evaluateScene(scene);
  return renderPlanim(model, fitView(model, VIEWPORT, { padding: 56 }), VIEWPORT);
};
const opOf = (scene, type, i = 0) => scene.ops.filter((o) => o.type === type)[i];
const textOf = (frame, opId) => frame.texts.find((t) => t.opId === opId);

describe('подписи пометок: движок', () => {
  it('у каждой подписи — шаг журнала (opId), по ней её и находит курсор', () => {
    const { scene } = parsePlanimBlock(SPEC);
    const frame = frameOf(scene);
    const angle = opOf(scene, 'angle');
    const t = textOf(frame, angle.id);
    expect(t.text).toBe('60°');
    expect(pickMarkText(frame, t.x, t.y - 5)?.opId).toBe(angle.id);
    expect(pickMarkText(frame, t.x + 200, t.y + 200)).toBeNull();
  });

  it('перетащенная «длина» встаёт куда поставили и едет вместе с отрезком', () => {
    const { scene } = parsePlanimBlock(SPEC);
    const ms = opOf(scene, 'measure', 1); // KD
    const model = evaluateScene(scene);
    const K = model.points.K.pos;
    const D = model.points.D.pos;
    const mid = { x: (K.x + D.x) / 2, y: (K.y + D.y) / 2 };
    const want = { x: mid.x, y: mid.y + 0.5 };
    const moved = setMarkTextPosition(scene, ms.id, want);
    expect(opOf(moved, 'measure', 1).at).toEqual({ x: 0, y: 0.5 });
    const frame = frameOf(moved);
    const t = textOf(frame, ms.id);
    const p = frame.project(want);
    expect(t.x).toBeCloseTo(p.x, 5);
    expect(t.y - 5).toBeCloseTo(p.y, 5);
    // сдвиг — от середины отрезка, а не точка на плоскости
    expect(setMarkTextPosition(moved, ms.id, null).ops.find((o) => o.id === ms.id).at).toBeUndefined();
  });

  it('подпись угла — сдвиг от вершины; надпись — свои координаты', () => {
    const { scene } = parsePlanimBlock(`${SPEC}\nтекст (1; 1) a`);
    const ang = opOf(scene, 'angle');
    const B = evaluateScene(scene).points.B.pos;
    const s1 = setMarkTextPosition(scene, ang.id, { x: B.x + 0.4, y: B.y - 1.2 });
    expect(opOf(s1, 'angle').at).toEqual({ x: 0.4, y: -1.2 });
    const txt = opOf(scene, 'text');
    const s2 = setMarkTextPosition(scene, txt.id, { x: 2.345, y: -1 });
    expect(opOf(s2, 'text')).toMatchObject({ x: 2.35, y: -1 });
  });

  it('правка текста: надпись, длина, угол (пусто — угол без подписи)', () => {
    const { scene } = parsePlanimBlock(`${SPEC}\nтекст (1; 1) a`);
    const ang = opOf(scene, 'angle');
    expect(markTextOf(ang)).toBe('60°');
    let s = setMarkText(scene, ang.id, '30');
    expect(opOf(s, 'angle').label).toBe('30°');
    s = setMarkText(s, ang.id, 'α');
    expect(opOf(s, 'angle').label).toBe('α');
    s = setMarkText(s, ang.id, '');
    expect(opOf(s, 'angle').label).toBeUndefined();
    s = setMarkText(s, opOf(s, 'measure').id, '6 см');
    expect(opOf(s, 'measure').text).toBe('6 см');
    s = setMarkText(s, opOf(s, 'text').id, 'b');
    expect(opOf(s, 'text').text).toBe('b');
    expect(evaluateScene(s).steps.every((st) => st.ok)).toBe(true);
  });

  it('сдвиг пишется в текст чертежа «@(x; y)» и читается обратно', () => {
    const { scene } = parsePlanimBlock(SPEC);
    const ang = opOf(scene, 'angle');
    const ms = opOf(scene, 'measure');
    let s = setMarkTextPosition(scene, ang.id, { ...evaluateScene(scene).points.B.pos, y: evaluateScene(scene).points.B.pos.y - 1.5 });
    s = { ...s, ops: s.ops.map((o) => (o.id === ms.id ? { ...o, at: { x: -0.6, y: 0.25 } } : o)) };
    expect(opToCommand(opOf(s, 'angle'))).toBe('угол ABK 60° @(0; -1,5)');
    expect(opToCommand(opOf(s, 'measure'))).toBe('длина BK 6 @(-0,6; 0,25)');
    const back = parsePlanimBlock(buildPlanimBlock(s).text).scene;
    expect(opOf(back, 'angle')).toMatchObject({ label: '60°', at: { x: 0, y: -1.5 } });
    expect(opOf(back, 'measure')).toMatchObject({ text: '6', at: { x: -0.6, y: 0.25 } });
  });

  it('«@(…)» не съедает подпись и не мешает без неё', () => {
    const model = evaluateScene(parsePlanimBlock(SPEC).scene);
    expect(parseCommand('длина AB x+1', model).op).toMatchObject({ text: 'x+1' });
    expect(parseCommand('длина AB x+1', model).op.at).toBeUndefined();
    expect(parseCommand('длина AB 5 @(1; −2)', model).op).toMatchObject({ text: '5', at: { x: 1, y: -2 } });
    expect(parseCommand('угол ABC 2 α @(0,3; 0,3)', model).op).toMatchObject({ arcs: 2, label: 'α', at: { x: 0.3, y: 0.3 } });
  });

  it('инструмент «Надпись» отдаёт место клика, текст спрашивает редактор', () => {
    const model = evaluateScene(parsePlanimBlock(SPEC).scene);
    const r = toolClick('text', [], { raw: { x: 1.234, y: -2.5 }, pos: { x: 1, y: -2.5 } }, model);
    expect(r).toEqual({ pending: [], textAt: { x: 1.23, y: -2.5 } });
  });
});

describe('подписи пометок: редактор', () => {
  const { width: W, height: H } = VIEWPORT;
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
  const mountWith = (scene) => {
    localStorage.setItem('planim.editor.v1', JSON.stringify({ scene }));
    render(<AntApp><PlanimEditor /></AntApp>);
    return document.querySelector('.planim-canvas svg');
  };

  it('«Надпись»: клик по чертежу → текст → надпись в журнале и на чертеже', async () => {
    const svg = mountWith(parsePlanimBlock('треугольник ABC 5 6 7').scene);
    await act(async () => { fireEvent.keyDown(window, { key: 'y', code: 'KeyY' }); });
    await act(async () => {
      fireEvent.pointerDown(svg, ev(500, 80));
      fireEvent.pointerUp(svg, ev(500, 80));
    });
    fireEvent.change(await screen.findByLabelText('Текст подписи'), { target: { value: 'sqrt(3)' } });
    expect(screen.getByText('√3')).toBeTruthy(); // предпросмотр
    await act(async () => { fireEvent.click(screen.getByText('Поставить')); });
    expect(screen.getByText('Надпись «sqrt(3)»')).toBeTruthy();
    expect([...svg.querySelectorAll('.planim-mark-text')].map((t) => t.textContent)).toContain('√3');
  });

  it('подпись тянется мышью в любом инструменте, двойной клик — правка', async () => {
    const { scene } = parsePlanimBlock(SPEC);
    const svg = mountWith(scene);
    const ms = opOf(scene, 'measure', 1);
    const t = textOf(frameOf(scene), ms.id);
    const from = { x: t.x, y: t.y - 5 };
    const to = { x: from.x + 30, y: from.y - 40 };
    await act(async () => {
      fireEvent.pointerDown(svg, ev(from.x, from.y));
      fireEvent.pointerMove(svg, ev(from.x + 10, from.y - 10));
      fireEvent.pointerMove(svg, ev(to.x, to.y));
      fireEvent.pointerUp(svg, ev(to.x, to.y));
    });
    const moved = [...svg.querySelectorAll('.planim-mark-text')].find((n) => n.textContent === '2');
    expect(Number(moved.getAttribute('x'))).toBeCloseTo(to.x, 0);
    expect(Number(moved.getAttribute('y')) - 5).toBeCloseTo(to.y, 0);

    await act(async () => { fireEvent.doubleClick(svg, { clientX: to.x, clientY: to.y }); });
    const input = await screen.findByLabelText('Текст подписи');
    expect(input.value).toBe('2');
    expect(screen.getByText('Место по умолчанию')).toBeTruthy();
    fireEvent.change(input, { target: { value: '2 см' } });
    await act(async () => { fireEvent.click(screen.getByText('Готово')); });
    expect(screen.getByText('KD = 2 см')).toBeTruthy();
  });
});
