import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, renderStereo, DEFAULT_CAMERA, pickLine,
  toolClick, finishPending, snapPosition, lineHitParam, chooseHit, toolHint,
} from '../utils/stereo';

const model0 = evaluateScene({ body: { kind: 'cube', a: 4 }, ops: [] });

describe('инструменты', () => {
  it('прилипание к ½, ⅓ и продолжению', () => {
    expect(snapPosition(0.49, 200)).toEqual({ t: 0.5, ratio: [1, 1] });
    expect(snapPosition(0.34, 200)).toEqual({ t: 1 / 3, ratio: [1, 2] });
    expect(snapPosition(1.52, 200)).toEqual({ t: 1.5 });
    expect(snapPosition(0.42, 200)).toEqual({ t: 0.42 });
  });

  it('доля по клику на ребре совпадает с долей в пространстве', () => {
    const frame = renderStereo(model0, DEFAULT_CAMERA, { width: 600, height: 500 });
    const ab = frame.hits.lines.find((l) => l.id === 'edge:A-A1');
    const x = ab.x1 + (ab.x2 - ab.x1) * 0.25;
    const y = ab.y1 + (ab.y2 - ab.y1) * 0.25;
    const hit = pickLine(frame, x, y);
    const { t } = lineHitParam(hit, frame.project);
    expect(t).toBeCloseTo(0.25, 6);
  });

  it('точка: клик по линии даёт операцию с автоименем', () => {
    const r = toolClick('point', [], { line: { id: 'edge:A-A1', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] } }, model0);
    expect(r.op).toMatchObject({ type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] });
    const busy = toolClick('point', [], { point: 'A' }, model0);
    expect(busy.error).toMatch(/уже есть точка A/);
  });

  it('отрезок — две точки; прямая по клику на ребро — продолжение', () => {
    let r = toolClick('segment', [], { point: 'A' }, model0);
    expect(r.op).toBeUndefined();
    r = toolClick('segment', r.pending, { point: 'A' }, model0);
    expect(r.pending).toHaveLength(1); // та же точка второй раз не считается
    r = toolClick('segment', r.pending, { point: 'C1' }, model0);
    expect(r.op).toMatchObject({ type: 'segment', ref: ['A', 'C1'] });
    const ext = toolClick('line', [], { line: { id: 'edge:A-D', ref: ['A', 'D'], t: 0.3 } }, model0);
    expect(ext.op).toMatchObject({ type: 'line', ref: ['A', 'D'] });
  });

  it('пересечь, след, параллельная, сечение, плоскость, закрасить', () => {
    const L1 = { line: { id: 'a', ref: ['A', 'C'], t: 0.2 } };
    const L2 = { line: { id: 'b', ref: ['B', 'D'], t: 0.2 } };
    let r = toolClick('intersect', [], L1, model0);
    r = toolClick('intersect', r.pending, L2, model0);
    expect(r.op).toMatchObject({ type: 'intersect', l1: ['A', 'C'], l2: ['B', 'D'] });

    r = toolClick('trace', [], L1, model0);
    r = toolClick('trace', r.pending, { face: { id: 'ABB1A1', verts: ['A', 'B', 'B1', 'A1'] } }, model0);
    expect(r.op).toMatchObject({ type: 'trace', ref: ['A', 'C'], plane: ['A', 'B', 'B1', 'A1'] });

    r = toolClick('parallel', [], L1, model0);
    r = toolClick('parallel', r.pending, { point: 'B1' }, model0);
    expect(r.op).toMatchObject({ type: 'parallel', through: 'B1', ref: ['A', 'C'] });

    r = { pending: [] };
    for (const p of ['A', 'C', 'B1']) r = toolClick('section', r.pending, { point: p }, model0);
    expect(r.op).toMatchObject({ type: 'section', pts: ['A', 'C', 'B1'] });

    r = toolClick('plane', [], { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, model0);
    expect(r.op).toMatchObject({ type: 'plane', pts: ['A', 'B', 'C', 'D'] });

    r = { pending: [] };
    for (const p of ['A', 'B', 'C1', 'D1']) r = toolClick('fill', r.pending, { point: p }, model0);
    expect(r.op).toBeUndefined();
    const closed = toolClick('fill', r.pending, { point: 'A' }, model0);
    expect(closed.op).toMatchObject({ type: 'fill', pts: ['A', 'B', 'C1', 'D1'] });
    expect(finishPending('fill', r.pending).op.pts).toEqual(['A', 'B', 'C1', 'D1']);
  });

  it('точка важнее линии, а у «пересечь» — только линии', () => {
    const hit = { point: 'A', line: { id: 'edge:A-B', ref: ['A', 'B'], t: 0 } };
    expect(chooseHit('segment', [], hit).kind).toBe('point');
    expect(chooseHit('intersect', [], hit).kind).toBe('line');
    expect(toolHint('section', [{ kind: 'point', name: 'M' }])).toMatch(/ещё 2/);
  });
});

describe('экран редактора', () => {
  beforeEach(() => localStorage.clear());

  const mount = () => render(<AntApp><StereoEditor /></AntApp>);
  // Поле antd игнорирует повторный Enter, пока клавишу не отпустили.
  const enter = (input, value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  };

  it('строка команд добавляет шаг, ошибка остаётся под строкой', () => {
    mount();
    const input = screen.getByLabelText('Строка команд');
    enter(input, 'M на AA1 1:2');
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();

    enter(input, 'X = MC1 ∩ BD');
    expect(screen.getByText('Прямые MC₁ и BD скрещиваются — общей точки нет')).toBeTruthy();
    expect(screen.queryByText(/X = MC₁ ∩ BD/)).toBeNull();
  });

  it('черновик сохраняется в localStorage и восстанавливается', async () => {
    const { unmount } = mount();
    const input = screen.getByLabelText('Строка команд');
    enter(input, 'N на CC1');
    await new Promise((r) => setTimeout(r, 400));
    unmount();
    mount();
    expect(screen.getByText('N ∈ CC₁, середина')).toBeTruthy();
  });

  it('битый черновик не ломает страницу', () => {
    localStorage.setItem('stereo.editor.v1', '{"scene":{"body":{"kind":"cube"},"ops":[{"type":"???"}]}}');
    mount();
    expect(screen.getByText('Стереометрия')).toBeTruthy();
  });
});
