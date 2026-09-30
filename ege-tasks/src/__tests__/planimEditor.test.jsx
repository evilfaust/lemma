import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { App as AntApp } from 'antd';
import PlanimEditor from '../components/planim/PlanimEditor';
import MathRenderer from '../shared/components/MathRenderer';
import {
  COMMAND_HELP, KEY_HELP, DSL_HELP, TOOLS, parseCommand, evaluateScene, tryAppendOps, applyAction,
  parsePlanimBlock, renderPlanim, fitView,
} from '../utils/planim';
import { findPlanimAtCursor } from '../utils/plotSnippet';
import { splitSideFigure } from '../components/print-sheet/sideFigure';
import { hasFigure } from '../components/print-sheet/SheetTask';

// Сцена, на которой справка «живёт»: треугольник ABC, четырёхугольник ABCD,
// окружность с центром O, точка вне её.
const BASE = [
  'A = (0; 0)', 'B = (2; 4)', 'C = (6; 0)', 'D = (5; 5)', 'многоугольник ABC',
  'AB', 'BD', 'AC', 'O = (2; 1)', 'окружность O 2', 'E = (6; 3)',
];
function baseScene() {
  let scene = { ops: [] };
  for (const cmd of BASE) {
    const r = parseCommand(cmd, evaluateScene(scene));
    scene = tryAppendOps(scene, r.ops || [r.op]).scene;
  }
  return scene;
}

describe('справка планиметрического редактора — сторож', () => {
  it('каждая команда из справки разбирается и строится', () => {
    const scene = baseScene();
    const all = COMMAND_HELP.flatMap((s) => s.items);
    expect(all.length).toBeGreaterThan(40);
    for (const { cmd } of all) {
      const m = evaluateScene(scene);
      const r = parseCommand(cmd, m);
      expect({ cmd, error: r.error }).toEqual({ cmd, error: undefined });
      if (r.action === 'undo') continue;
      if (r.action) {
        expect({ cmd, error: applyAction(scene, r).error }).toEqual({ cmd, error: undefined });
        continue;
      }
      const res = tryAppendOps(scene, r.ops || [r.op]);
      expect({ cmd, error: res.error }).toEqual({ cmd, error: null });
    }
  });

  it('каждая строка блока ```planim из справки читается без ошибок', () => {
    for (const { line } of DSL_HELP) {
      const r = parsePlanimBlock(`треугольник ABC 5 6 7\n${line}`);
      expect({ line, errors: r.errors }).toEqual({ line, errors: [] });
    }
  });

  it('буквы инструментов в справке совпадают с горячими клавишами', () => {
    const row = KEY_HELP.flatMap((s) => s.items).find((r) => r.keys === 'Буква инструмента');
    const letters = row.what.match(/\(([^)]+)\)/)[1].split(/,\s*/);
    expect(letters).toEqual(TOOLS.map((t) => t.hot));
  });
});

describe('блок ```planim в тексте задачи', () => {
  it('блок и строка в ячейке таблицы рисуются чертежом', () => {
    const md = 'Найдите высоту.\n\n```planim\nтреугольник ABC 5 6 7\nH = высота B AC\n```\n\n'
      + '| Рисунок |\n| --- |\n| `planim: квадрат ABCD 4; AC` |';
    const { container } = render(<MathRenderer text={md} />);
    expect(container.querySelectorAll('svg.planim-svg')).toHaveLength(2);
    expect(container.querySelector('.mr-figure .stereo-figure')).toBeTruthy();
    expect(container.querySelector('td .stereo-inline')).toBeTruthy();
    expect(container.querySelector('.stereo-svg-errors')).toBeFalsy();
  });

  it('курсор внутри блока — правка его; печатные листы считают его чертежом', () => {
    const text = 'Условие.\n\n```planim\nквадрат ABCD 4\nAC\n```\n\nОтвет: 4';
    expect(findPlanimAtCursor(text, text.indexOf('AC'))).toMatchObject({
      start: text.indexOf('```planim'), spec: 'квадрат ABCD 4\nAC', format: 'block',
    });
    const inline = '| `planim: A = (0; 0); B = (3; 0); AB` |';
    expect(findPlanimAtCursor(inline, 12)).toMatchObject({ spec: 'A = (0; 0)\nB = (3; 0)\nAB', format: 'inline' });
    expect(findPlanimAtCursor(text, 2)).toBeNull();
    expect(hasFigure({ statement_md: text })).toBe(true);
    expect(splitSideFigure(text).figure).toMatchObject({ kind: 'drawing' });
  });
});

describe('редактор', () => {
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

  const mount = (props) => render(<AntApp><PlanimEditor {...props} /></AntApp>);
  const runCmd = async (text) => {
    const input = screen.getByLabelText('Строка команд');
    fireEvent.change(input, { target: { value: text } });
    // antd держит «замок» Enter до отпускания клавиши — отпускаем, как настоящая клавиатура.
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
      fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    });
  };
  const ev = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'mouse', ...extra });
  const click = async (svg, x, y) => {
    await act(async () => {
      fireEvent.pointerDown(svg, ev(x, y));
      fireEvent.pointerUp(svg, ev(x, y));
    });
  };

  it('кнопка «?» открывает справку, клик по команде вставляет её в строку', async () => {
    mount();
    fireEvent.click(screen.getByLabelText('Справка по командам'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Справка: планиметрические чертежи')).toBeTruthy();
    fireEvent.click(within(dlg).getByText('середина AC'));
    expect(screen.getByLabelText('Строка команд').value).toBe('середина AC');
  });

  it('строка команд: фигура, построение, ошибка с объяснением, отмена', async () => {
    mount();
    await runCmd('треугольник ABC 5 6 7');
    expect(screen.getByText('Треугольник ABC')).toBeTruthy();
    await runCmd('H = высота B AC');
    expect(screen.getByText(/H — основание перпендикуляра из B на AC/)).toBeTruthy();
    expect(screen.getByText('Прямой угол BHC')).toBeTruthy();
    await runCmd('X = AH ∩ HC');
    expect(screen.getByText(/совпадают/)).toBeTruthy(); // шага нет, ошибка под строкой
    expect(screen.queryByText(/X = /)).toBeNull();
    await act(async () => { fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true }); });
    expect(screen.queryByText('Прямой угол BHC')).toBeNull(); // высота ушла целиком — одним действием
    expect(screen.getByText('Треугольник ABC')).toBeTruthy();
  });

  it('черновик переживает перезагрузку', async () => {
    vi.useFakeTimers();
    try {
      const first = mount();
      await runCmd('квадрат ABCD 4');
      await act(async () => { vi.advanceTimersByTime(400); });
      first.unmount();
      mount();
      expect(screen.getByText('Четырёхугольник ABCD')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Новый чертёж»: выбор фигуры создаёт её шаги', async () => {
    mount();
    fireEvent.click(screen.getByText('Новый чертёж'));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByText('Ромб'));
    await act(async () => { fireEvent.click(within(dlg).getByText('Создать')); });
    expect(screen.getByText('Четырёхугольник ABCD')).toBeTruthy();
    expect(screen.getByText(/Точка A \(0; 0\)/)).toBeTruthy();
  });

  it('инструмент «Отрезок»: два клика по пустому месту — две точки и отрезок', async () => {
    mount();
    const svg = document.querySelector('.planim-canvas svg');
    await act(async () => { fireEvent.keyDown(window, { key: 's', code: 'KeyS' }); });
    await click(svg, 200, 300);
    await click(svg, 400, 200);
    expect(screen.getByText('Отрезок AB')).toBeTruthy();
    expect(screen.getAllByText(/^Точка [AB] /)).toHaveLength(2);
  });

  it('свободная точка тянется мышью и прилипает к сетке; Ctrl+Z возвращает', async () => {
    const scene = { ops: [
      { id: 'a', type: 'point', name: 'A', x: 0, y: 0 },
      { id: 'b', type: 'point', name: 'B', x: 4, y: 0 },
      { id: 'c', type: 'point', name: 'C', x: 0, y: 3 },
      { id: 'p', type: 'polygon', pts: ['A', 'B', 'C'] },
    ] };
    localStorage.setItem('planim.editor.v1', JSON.stringify({ scene }));
    mount();
    const svg = document.querySelector('.planim-canvas svg');
    const model = evaluateScene(scene);
    const frame = renderPlanim(model, fitView(model, { width: W, height: H }, { padding: 56 }), { width: W, height: H });
    const from = frame.project({ x: 4, y: 0 });
    const to = frame.project({ x: 5.1, y: 1.05 });
    expect(screen.getByText('Точка B (4; 0)')).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(svg, ev(from.x, from.y));
      fireEvent.pointerMove(svg, ev((from.x + to.x) / 2, (from.y + to.y) / 2));
      fireEvent.pointerMove(svg, ev(to.x, to.y));
      fireEvent.pointerUp(svg, ev(to.x, to.y));
    });
    expect(screen.getByText('Точка B (5; 1)')).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', ctrlKey: true }); });
    expect(screen.getByText('Точка B (4; 0)')).toBeTruthy();
  });

  it('двойной клик по точке: имя и «скрыть»', async () => {
    const scene = { ops: [{ id: 'a', type: 'point', name: 'A', x: 0, y: 0 }, { id: 'b', type: 'point', name: 'B', x: 4, y: 0 }, { id: 's', type: 'segment', ref: ['A', 'B'] }] };
    localStorage.setItem('planim.editor.v1', JSON.stringify({ scene }));
    mount();
    const svg = document.querySelector('.planim-canvas svg');
    const model = evaluateScene(scene);
    const frame = renderPlanim(model, fitView(model, { width: W, height: H }, { padding: 56 }), { width: W, height: H });
    const a = frame.project({ x: 0, y: 0 });
    await act(async () => { fireEvent.doubleClick(svg, { clientX: a.x, clientY: a.y }); });
    fireEvent.change(screen.getByLabelText('Имя точки'), { target: { value: 'к' } });
    await act(async () => { fireEvent.click(screen.getByText('Готово')); });
    expect(screen.getByText('Отрезок KB')).toBeTruthy();
  });

  it('в окне задачи: «Вставить» отдаёт сцену и настройки вида', async () => {
    const onApply = vi.fn();
    mount({ embedded: true, onApply, initialScene: parsePlanimBlock('квадрат ABCD 4').scene, initialGrid: true });
    expect(screen.getByText('Четырёхугольник ABCD')).toBeTruthy();
    fireEvent.click(screen.getByText('Вставить'));
    expect(onApply).toHaveBeenCalledTimes(1);
    const [scene, opts] = onApply.mock.calls[0];
    expect(scene.ops).toHaveLength(5);
    expect(opts).toEqual({ color: false, grid: true });
    expect(localStorage.getItem('planim.editor.v1')).toBeNull(); // черновик страницы не тронут
  });
});
