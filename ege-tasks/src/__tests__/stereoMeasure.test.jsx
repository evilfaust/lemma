import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, evaluateMeasure, makeMeasure, makeVertexAngle, parseCommand, toolClick,
  measureKey, measurePoints, setOpPosition, TOOLS,
} from '../utils/stereo';
import { recognizeRational } from '../utils/stereo/exact';

const P = (name) => ({ kind: 'point', name });
const L = (a, b) => ({ kind: 'line', ref: [a, b] });
const S = (...ref) => ({ kind: 'plane', ref });

const scene = {
  body: { kind: 'cube', a: 4 },
  ops: [{ id: 'm', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5, ratio: [1, 1] }],
};
const model = evaluateScene(scene);
const val = (m, mdl = model) => evaluateMeasure(mdl, m);

describe('измерения на кубе с ребром 4 — точно', () => {
  it('длина диагонали — 4√3, приближённо 6,93', () => {
    const r = val(makeMeasure(P('A'), P('C1')));
    expect(r.label).toBe('AC₁');
    expect(r.rows[0]).toMatchObject({ what: 'длина', latex: '4\\sqrt{3}', approx: '6,93' });
  });

  it('целая длина — без «≈»', () => {
    const r = val(makeMeasure(P('A'), P('B')));
    expect(r.rows[0]).toMatchObject({ latex: '4', approx: null });
  });

  it('угол ∠ABC и тупой угол с вершиной', () => {
    expect(val(makeVertexAngle(['A', 'B', 'C'])).rows[0].latex).toBe('90^\\circ');
    // ∠MBC1… возьмём ∠ACB1 в правильном треугольнике — 60°
    expect(val(makeVertexAngle(['A', 'C', 'B1'])).rows[0].latex).toBe('60^\\circ');
    // ∠AOB у центра куба: cos = −1/3 → 180° − arccos(1/3)
    const r = val(makeVertexAngle(['A', 'M', 'B']));
    expect(r.label).toBe('∠AMB');
    expect(r.rows[0].value).toBeCloseTo((Math.atan2(4, 2) * 180) / Math.PI, 6);
  });

  it('скрещивающиеся диагонали граней: 60° и расстояние 4√3/3', () => {
    const r = val(makeMeasure(L('A', 'B1'), L('B', 'C1')));
    expect(r.note).toBe('прямые скрещиваются');
    expect(r.rows[0]).toMatchObject({ what: 'угол', latex: '60^\\circ' });
    expect(r.rows[1]).toMatchObject({ what: 'расстояние', latex: '\\dfrac{4\\sqrt{3}}{3}' });
  });

  it('пересекающиеся и параллельные прямые', () => {
    expect(val(makeMeasure(L('A', 'B'), L('A', 'D'))).note).toBe('прямые пересекаются');
    const par = val(makeMeasure(L('A', 'B'), L('C1', 'D1')));
    expect(par.note).toBe('прямые параллельны');
    expect(par.rows[0].latex).toBe('4\\sqrt{2}');
  });

  it('расстояния до прямой и до плоскости', () => {
    expect(val(makeMeasure(P('A'), S('A1', 'B', 'D'))).rows[0].latex).toBe('\\dfrac{4\\sqrt{3}}{3}');
    expect(val(makeMeasure(P('M'), L('B', 'C'))).rows[0].latex).toBe('2\\sqrt{5}');
    expect(val(makeMeasure(P('M'), L('A', 'B'))).rows[0].latex).toBe('2');
    expect(val(makeMeasure(P('M'), L('A', 'A1'))).note).toBe('точка лежит на прямой');
  });

  it('угол прямой с плоскостью и между плоскостями', () => {
    const lp = val(makeMeasure(L('B', 'D1'), S('A', 'B', 'C')));
    expect(lp.rows[0].value).toBeCloseTo((Math.asin(1 / Math.sqrt(3)) * 180) / Math.PI, 6);
    expect(lp.rows[0].latex).toMatch(/^\\arc/);
    const pp = val(makeMeasure(S('A', 'B', 'C'), S('A1', 'B', 'D')));
    expect(pp.rows[0].value).toBeCloseTo((Math.acos(1 / Math.sqrt(3)) * 180) / Math.PI, 6);
    expect(pp.rows[0].latex).toBe('\\arctg \\sqrt{2}');
  });

  it('параллельные — расстояние, лежит в плоскости — пометка', () => {
    const pl = val(makeMeasure(S('A', 'B', 'C'), S('A1', 'B1', 'C1')));
    expect(pl.note).toBe('плоскости параллельны');
    expect(pl.rows[0].latex).toBe('4');
    const lp = val(makeMeasure(L('A1', 'B1'), S('A', 'B', 'C')));
    expect(lp.note).toBe('прямая параллельна плоскости');
    expect(val(makeMeasure(L('A', 'C'), S('A', 'B', 'C'))).note).toBe('прямая лежит в плоскости');
  });

  it('точку подвинули — величина пересчиталась', () => {
    const m = makeMeasure(P('M'), S('A', 'B', 'C'));
    expect(val(m).rows[0].latex).toBe('2');
    const moved = evaluateScene(setOpPosition(scene, 'm', { t: 0.25, ratio: [1, 3] }));
    expect(val(m, moved).rows[0].latex).toBe('1');
  });

  it('пропавшая точка — ошибка, а не падение', () => {
    const r = val(makeMeasure(P('Q'), P('A')));
    expect(r.error).toMatch(/Нет точки Q/);
  });

  it('распознавание: «некрасивое» число остаётся приближённым', () => {
    expect(recognizeRational(2.5)).toEqual({ n: 5n, d: 2n });
    expect(recognizeRational(Math.PI)).toBeNull();
  });

  it('ключ одинаковый при любом порядке объектов, точки — для подсветки', () => {
    expect(measureKey(makeMeasure(P('A'), P('B')))).toBe(measureKey(makeMeasure(P('B'), P('A'))));
    expect(measureKey(makeMeasure(L('A', 'B'), S('A', 'B', 'C')))).toBe(measureKey(makeMeasure(S('C', 'B', 'A'), L('B', 'A'))));
    expect([...measurePoints(makeMeasure(P('M'), L('B', 'C')), model)]).toEqual(['M', 'B', 'C']);
  });
});

describe('команда «измерить» и инструмент', () => {
  it('команда разбирается по видам объектов', () => {
    expect(parseCommand('измерить AC1', model).measure).toMatchObject({ a: P('A'), b: P('C1') });
    expect(parseCommand('измерить ABC', model).measure).toMatchObject({ vertex: ['A', 'B', 'C'] });
    expect(parseCommand('измерить AB1 BC1', model).measure).toMatchObject({ a: L('A', 'B1'), b: L('B', 'C1') });
    expect(parseCommand('измерить M (ABC)', model).measure).toMatchObject({ a: P('M'), b: S('A', 'B', 'C') });
    expect(parseCommand('измерить между BD1 и (ABC)', model).measure).toMatchObject({ a: L('B', 'D1'), b: S('A', 'B', 'C') });
    expect(parseCommand('измерить Q', model).error).toBeTruthy();
    expect(parseCommand('измерить AQ', model).error).toMatch(/Нет точки Q/);
  });

  it('инструмент: два клика — измерение, шага журнала нет', () => {
    expect(TOOLS.find((t) => t.key === 'measure').hot).toBe('U');
    const first = toolClick('measure', [], { point: 'A' }, model);
    expect(first.pending).toHaveLength(1);
    const second = toolClick('measure', first.pending, { face: { id: 'x', verts: ['A1', 'B1', 'C1', 'D1'] } }, model);
    expect(second.op).toBeUndefined();
    expect(second.measure).toMatchObject({ a: P('A'), b: { kind: 'plane', ref: ['A1', 'B1', 'C1', 'D1'] } });
    expect(val(second.measure).rows[0].latex).toBe('4');
  });
});

describe('панель в редакторе', () => {
  it('команда добавляет измерение, сцена не меняется, ✕ убирает', async () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    const input = screen.getByLabelText('Строка команд');
    fireEvent.change(input, { target: { value: 'измерить AC1' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    const panel = await screen.findByLabelText('Измерения');
    expect(within(panel).getByText('AC₁')).toBeTruthy();
    expect(within(panel).getByText(/6,93/)).toBeTruthy();
    expect(screen.getByText(/Пока пусто/)).toBeTruthy(); // в журнал шагов ничего не ушло
    // Повтор того же измерения не дублирует строку
    fireEvent.change(input, { target: { value: 'измерить C1A' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(within(panel).getAllByText('AC₁')).toHaveLength(1);
    fireEvent.click(within(panel).getByLabelText('Убрать измерение'));
    expect(screen.queryByLabelText('Измерения')).toBeNull();
  });
});
