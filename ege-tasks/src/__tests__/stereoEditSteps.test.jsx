import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, tryAppendOp, parseCommand, editStepCommand, toolClick, acceptedKinds,
  stepOfTarget, TOOLS,
} from '../utils/stereo';
import { dist } from '../utils/stereo/vec3';

const cube = { kind: 'cube', a: 4 };

/** Сцена из строк команд — так же, как её набирает учитель. */
function build(cmds, body = cube) {
  let scene = { body, ops: [] };
  for (const cmd of cmds) {
    const r = parseCommand(cmd, evaluateScene(scene));
    expect({ cmd, error: r.error }).toEqual({ cmd, error: undefined });
    const res = tryAppendOp(scene, r.op);
    expect({ cmd, error: res.error }).toEqual({ cmd, error: null });
    scene = res.scene;
  }
  return scene;
}
const pos = (sc, n) => evaluateScene(sc).points[n].pos;

describe('инструмент «Удалить»', () => {
  const sc = build(['M на AA1 1:2', 'N на CC1 1:1', 'MN', 'сечение MNB']);
  const m = evaluateScene(sc);

  it('клик по точке, отрезку, сечению — шаг, который их построил', () => {
    expect(TOOLS.find((t) => t.key === 'erase').hot).toBe('D');
    expect(acceptedKinds('erase', [])).toEqual(['point', 'line', 'poly']);
    expect(toolClick('erase', [], { point: 'N' }, m).erase).toEqual({ opId: sc.ops[1].id });
    const mn = m.lines.find((l) => l.kind === 'segment');
    expect(toolClick('erase', [], { line: { id: mn.id, ref: mn.ref } }, m).erase).toEqual({ opId: sc.ops[2].id });
    expect(toolClick('erase', [], { poly: { id: sc.ops[3].id } }, m).erase).toEqual({ opId: sc.ops[3].id });
  });

  it('вершины и рёбра — само тело: не удаляются, с объяснением', () => {
    expect(toolClick('erase', [], { point: 'A' }, m).error).toMatch(/Вершина — часть самого тела/);
    expect(toolClick('erase', [], { line: { id: 'edge:A-B', ref: ['A', 'B'] } }, m).error).toMatch(/Ребро/);
    expect(stepOfTarget(m, { kind: 'point', name: 'B' })).toBeNull();
  });

  it('продолжение прямой, дорисованное шагом, удаляет этот шаг', () => {
    const sc2 = build(['M на AA1 1:2', 'K на AB 1,5']);
    const m2 = evaluateScene(sc2);
    const ext = m2.lines.find((l) => l.kind === 'ext' && l.step === 1);
    expect(stepOfTarget(m2, { kind: 'line', id: ext.id })).toBe(sc2.ops[1].id);
  });
});

describe('правка шага командой', () => {
  it('точка переезжает, всё построенное от неё пересчитывается, id и подпись те же', () => {
    let sc = build(['M на AA1 1:2', 'N на CC1 1:1', 'X = MN ∩ (ABC)']);
    sc = { ...sc, ops: sc.ops.map((o, i) => (i === 0 ? { ...o, note: 'делим ребро' } : o)) };
    const before = pos(sc, 'X');
    const res = editStepCommand(sc, sc.ops[0].id, 'M на AA1 1:3');
    expect(res.error).toBeUndefined();
    expect(res.broken).toEqual([]);
    expect(res.scene.ops[0]).toMatchObject({ id: sc.ops[0].id, t: 0.25, note: 'делим ребро' });
    expect(dist(pos(res.scene, 'X'), before)).toBeGreaterThan(0.1);
  });

  it('команда разбирается на чертеже ДО шага и заменяет его тип', () => {
    const sc = build(['M на AA1 1:2', 'N на CC1 1:1', 'MN']);
    const res = editStepCommand(sc, sc.ops[2].id, 'прямая MN');
    expect(res.scene.ops[2]).toMatchObject({ id: sc.ops[2].id, type: 'line', ref: ['M', 'N'] });
    // N на момент шага 1 ещё нет — ошибка, сцена не меняется
    expect(editStepCommand(sc, sc.ops[0].id, 'M на AN 1:2').error).toMatch(/Нет точки N/);
  });

  it('имя, которое учитель не написал, остаётся прежним', () => {
    const sc = build(['M на AA1 1:2', 'N на CC1 1:1', 'X = MN ∩ (ABC)', 'K на AB 1:1', 'XK']);
    // Без «X =» автоимя на момент шага было бы «K» — и сломало бы шаг 4.
    const res = editStepCommand(sc, sc.ops[2].id, 'MN ∩ (ABC)');
    expect(res.scene.ops[2].name).toBe('X');
    expect(res.broken).toEqual([]);
    // Явно написанное новое имя — берётся; шаги, где было X, перестают строиться.
    const renamed = editStepCommand(sc, sc.ops[2].id, 'Y = MN ∩ (ABC)');
    expect(renamed.scene.ops[2].name).toBe('Y');
    expect(renamed.broken).toEqual([5]);
  });

  it('ошибка самого шага — не применяется; не построение — отказ', () => {
    const sc = build(['M на AA1 1:2', 'MC']);
    expect(editStepCommand(sc, sc.ops[1].id, 'X = MC ∩ BD').error).toMatch(/скрещиваются/);
    expect(editStepCommand(sc, sc.ops[1].id, 'цвет M красный').error).toMatch(/Шаг — это построение/);
    expect(editStepCommand(sc, 'нет', 'MC').error).toMatch(/Нет такого шага/);
  });
});

describe('экран: правка шага и удаление', () => {
  beforeEach(() => localStorage.clear());

  const enter = (input, value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  };

  it('кнопка </> открывает команду шага, Enter заменяет шаг', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    enter(screen.getByLabelText('Строка команд'), 'M на AA1 1:2');
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Изменить команду шага'));
    const field = screen.getByLabelText('Команда шага');
    expect(field.value).toBe('M на AA1 1:2');
    enter(field, 'M на AA1 3:1');
    expect(screen.queryByLabelText('Команда шага')).toBeNull();
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 3 : 1')).toBeTruthy();
  });

  it('двойной клик по шагу; ошибка остаётся в поле, Esc — отмена', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    enter(screen.getByLabelText('Строка команд'), 'M на AA1 1:2');
    fireEvent.doubleClick(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2'));
    const field = screen.getByLabelText('Команда шага');
    enter(field, 'M на AZ 1:2');
    expect(screen.getByText('Нет точки Z')).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByLabelText('Команда шага')).toBeNull();
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();
  });

  it('клавиша D выбирает «Удалить»', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: 'd', code: 'KeyD' });
    expect(screen.getByText(/уберётся шаг, который их построил/)).toBeTruthy();
  });
});
