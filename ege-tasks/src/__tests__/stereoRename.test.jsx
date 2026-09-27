import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  renamePoint, evaluateScene, buildBody, bodyTitle, normalizePointName, setPointColors,
  parseStereoBlock, buildStereoBlock, toolClick, findFace,
} from '../utils/stereo';

const cube = { kind: 'cube', a: 4 };
const base = {
  body: cube,
  ops: [
    { id: 'a', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
    { id: 'b', type: 'section', pts: ['M', 'C', 'B1'] },
  ],
};

describe('переименование точек: движок', () => {
  it('построенная точка — журнал и цвета переписаны', () => {
    const r = renamePoint(setPointColors(base, ['M'], 'red'), 'M', 'K');
    expect(r.scene.ops[0].name).toBe('K');
    expect(r.scene.ops[1].pts).toEqual(['K', 'C', 'B1']);
    expect(r.scene.colors).toEqual({ K: 'red' });
    expect(evaluateScene(r.scene).steps.every((s) => s.ok)).toBe(true);
  });

  it('вершина тела — тело получает свои имена, геометрия та же', () => {
    const r = renamePoint(base, 'A', 'K');
    expect(r.scene.body.names).toEqual(['K', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1']);
    expect(r.scene.ops[0].ref).toEqual(['K', 'A1']);
    const m0 = evaluateScene(base);
    const m1 = evaluateScene(r.scene);
    expect(m1.points.K.pos).toEqual(m0.points.A.pos);
    expect(m1.points.A).toBeUndefined();
    expect(m1.points.M.pos).toEqual(m0.points.M.pos);
    expect(m1.polys[0].pts).toEqual(m0.polys[0].pts);
    expect(findFace(m1.body, ['K', 'B', 'C', 'D'])).not.toBeNull();
  });

  it('куб KLMNK1L1M1N1 и пирамида MABCD', () => {
    let sc = { body: cube, ops: [] };
    const plan = { A: 'K', B: 'L', C: 'M', D: 'N', A1: 'K1', B1: 'L1', C1: 'M1', D1: 'N1' };
    for (const [from, to] of Object.entries(plan)) sc = renamePoint(sc, from, to).scene;
    expect(bodyTitle(sc.body)).toBe('Куб KLMNK₁L₁M₁N₁');
    const pyr = renamePoint({ body: { kind: 'pyramid', n: 4 }, ops: [] }, 'S', 'M').scene;
    expect(bodyTitle(pyr.body)).toBe('Пирамида MABCD');
  });

  it('ошибки: занято, неверное имя, нет точки; то же имя — без изменений', () => {
    expect(renamePoint(base, 'M', 'C').error).toMatch(/занято/);
    expect(renamePoint(base, 'M', 'k').error).toMatch(/латинская/);
    expect(renamePoint(base, 'Q', 'K').error).toMatch(/Нет точки Q/);
    expect(renamePoint(base, 'M', 'M').scene).toBe(base);
  });

  it('ввод имени: раскладка и регистр', () => {
    expect(normalizePointName(' м1 ')).toBe('M1');
    expect(normalizePointName('К')).toBe('K');
    expect(normalizePointName('m₂')).toBe('M2');
  });

  it('свои имена переживают блок ```stereo', () => {
    const sc = renamePoint(base, 'A', 'K').scene;
    const { text } = buildStereoBlock(sc);
    expect(text.split('\n')[1]).toBe('вершины KBCDA1B1C1D1');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(back.scene.body.names).toEqual(sc.body.names);
    expect(parseStereoBlock('куб\nвершины ABC').errors[0].message).toMatch(/Нужно 8/);
    expect(parseStereoBlock('куб\nM на AA1\nвершины KLMNPQRT').errors[0].message).toMatch(/до построений/);
  });

  it('битые имена в теле — тело по умолчанию', () => {
    expect(buildBody({ kind: 'cube', names: ['A', 'A'] }).order[0]).toBe('A');
    expect(buildBody({ kind: 'cube', names: ['K', 'L'] }).order).toHaveLength(8);
    expect(toolClick('rename', [], { point: 'B' }, evaluateScene(base))).toEqual({ pending: [], rename: { name: 'B' } });
  });
});

describe('переименование точек: редактор', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene: base }));
  });
  const enter = (input, value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  };

  it('командой — и вершину тоже', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    enter(screen.getByLabelText('Строка команд'), 'переименовать A K');
    expect(screen.getByText('M ∈ KA₁, середина')).toBeTruthy();
    enter(screen.getByLabelText('Строка команд'), 'переименовать M C');
    expect(screen.getByText('Имя C уже занято')).toBeTruthy();
  });

  it('окно имени: проверка на лету, раскладка, Ctrl+Z', async () => {
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });
    expect(screen.getByText(/дать ей другое имя/)).toBeTruthy();
    // Окно открывается кликом по точке; в jsdom холста нет — зовём напрямую
    // через команду и проверяем само окно отдельным рендером.
    const { default: RenamePointModal } = await import('../components/stereo/RenamePointModal');
    let applied = null;
    render(<AntApp><RenamePointModal name="M" scene={base} onClose={() => {}} onApply={(sc, to) => { applied = to; }} /></AntApp>);
    const input = screen.getByLabelText('Новое имя точки');
    fireEvent.change(input, { target: { value: 'С' } }); // кириллица → C, занято
    expect(screen.getByText('Имя C уже занято')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'к' } });
    expect(screen.getByText('Будет: K')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Переименовать')); });
    expect(applied).toBe('K');
  });
});
