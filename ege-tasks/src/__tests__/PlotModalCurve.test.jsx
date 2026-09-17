import {
  describe, it, expect, vi, beforeAll,
} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PlotModal from '../components/shared/PlotModal';
import { parseCoordPlot, plotGeometry } from '../utils/coordPlot';
import { findPlotAtCursor } from '../utils/plotSnippet';

// jsdom не знает PointerEvent — без него у событий нет clientX/button.
beforeAll(() => {
  if (!window.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    window.PointerEvent = PointerEventPolyfill;
  }
});

const wrapper = ({ children }) => <App>{children}</App>;

function open(props = {}) {
  const onInsert = vi.fn();
  render(<PlotModal open onCancel={() => {}} onInsert={onInsert} kind="curve" {...props} />, { wrapper });
  return onInsert;
}

const insert = (onInsert, label = 'Вставить') => {
  fireEvent.click(screen.getByText(label));
  return onInsert.mock.calls.at(-1)[0];
};

// Холст рисуется в окне −5…5 размером CANVAS (600×440) — та же геометрия.
const GEO = plotGeometry(parseCoordPlot('x -5 5\ny -5 5'), { width: 600, maxHeight: 440 });

function overlay() {
  const el = screen.getByTestId('curve-overlay');
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, width: GEO.W, height: GEO.H, right: GEO.W, bottom: GEO.H,
  });
  return el;
}
const at = (x, y) => ({
  clientX: GEO.sx(x), clientY: GEO.sy(y), button: 0, pointerId: 1,
});

describe('PlotModal — кривая по точкам', () => {
  it('открывается на своей вкладке и вставляет spline по умолчанию', () => {
    const onInsert = open();
    expect(screen.getAllByText('Кривая по точкам').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^curve-node-/)).toHaveLength(5);
    const snippet = insert(onInsert);
    expect(snippet).toContain('```plot');
    expect(snippet).toContain('spline f (-4 -3) (-2 2) (1 -2) (3 3) (4.5 1)');
    expect(snippet).not.toContain('f x^2-4'); // формула соседней вкладки не приезжает
  });

  it('ручки стоят там, где рисуется кривая', () => {
    open();
    overlay();
    const dot = screen.getByTestId('curve-node-1').querySelectorAll('circle')[1];
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(GEO.sx(-2), 6);
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(GEO.sy(2), 6);
  });

  it('разбор графика: экстремумы и промежутки монотонности', () => {
    open();
    const text = screen.getByTestId('curve-analysis').textContent;
    expect(text).toContain('Точки максимума f: −2; 3 · минимума: 1');
    expect(text).toContain('f возрастает на [−4; −2], [1; 3]');
  });

  it('галочка «Производная» добавляет deriv', () => {
    const onInsert = open();
    fireEvent.click(screen.getByText(/Производная f′/));
    expect(insert(onInsert)).toContain('deriv f');
  });

  it('первообразная через точку', () => {
    const onInsert = open();
    fireEvent.click(screen.getByText('Первообразная'));
    fireEvent.change(screen.getByLabelText('x0 первообразной'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('y0 первообразной'), { target: { value: '1' } });
    expect(screen.getByTestId('curve-analysis').textContent).toMatch(/Точки максимума F: .* \(нули f\)/);
    expect(insert(onInsert)).toContain('prim F f 0 1');
  });

  it('клик по холсту ставит точку с привязкой к шагу', () => {
    const onInsert = open();
    const el = overlay();
    fireEvent.pointerDown(el, at(0.1, 3.9));
    fireEvent.pointerUp(el, at(0.1, 3.9));
    expect(screen.getAllByTestId(/^curve-node-/)).toHaveLength(6);
    expect(insert(onInsert)).toContain('(-2 2) (0 4) (1 -2)');
  });

  it('перетаскивание двигает точку, но не за соседнюю', () => {
    const onInsert = open();
    const el = overlay();
    fireEvent.pointerDown(screen.getByTestId('curve-node-1'), at(-2, 2));
    fireEvent.pointerMove(el, at(-2.6, 3.4));
    fireEvent.pointerUp(el, at(-2.6, 3.4));
    expect(insert(onInsert)).toContain('(-4 -3) (-2.5 3.5) (1 -2)');

    fireEvent.pointerDown(screen.getByTestId('curve-node-1'), at(-2.5, 3.5));
    fireEvent.pointerMove(el, at(-4.5, 3.5)); // левее соседа (−4)
    fireEvent.pointerUp(el, at(-4.5, 3.5));
    expect(insert(onInsert)).toContain('(-4 -3) (-3.5 3.5) (1 -2)');
  });

  it('двойной клик и Delete удаляют точку', () => {
    const onInsert = open();
    const el = overlay();
    fireEvent.doubleClick(el, at(1, -2));
    expect(screen.getAllByTestId(/^curve-node-/)).toHaveLength(4);

    fireEvent.pointerDown(screen.getByTestId('curve-node-0'), at(-4, -3));
    fireEvent.pointerUp(el, at(-4, -3));
    fireEvent.keyDown(document.querySelector('.curve-canvas'), { key: 'Delete' });
    expect(insert(onInsert)).toContain('spline f (-2 2) (3 3) (4.5 1)');
  });

  it('стрелки сдвигают выбранную точку на шаг', () => {
    const onInsert = open();
    const el = overlay();
    fireEvent.pointerDown(screen.getByTestId('curve-node-2'), at(1, -2));
    fireEvent.pointerUp(el, at(1, -2));
    fireEvent.keyDown(document.querySelector('.curve-canvas'), { key: 'ArrowUp' });
    expect(insert(onInsert)).toContain('(1 -1.5)');
  });

  it('разметка: касательная к выбранной точке', () => {
    const onInsert = open();
    const el = overlay();
    fireEvent.pointerDown(screen.getByTestId('curve-node-2'), at(1, -2));
    fireEvent.pointerUp(el, at(1, -2));
    fireEvent.click(screen.getByText('Касательная'));
    expect(insert(onInsert)).toContain('tangent 1 f');
  });

  it('формат «рядом» — таблица-галерея из двух картинок', () => {
    const onInsert = open();
    fireEvent.click(screen.getByText('f′ и f рядом'));
    expect(screen.getByTestId('pair-preview').querySelectorAll('svg.coordplot-svg')).toHaveLength(2);
    const snippet = insert(onInsert);
    expect(snippet).toMatch(/^\n\{галерея\}\n\| `plot: [^`]*deriv f[^`]*` \| `plot: [^`]*spline f[^`]*` \|\n$/);
  });

  it('правка готового блока: вкладка, точки и разметка поднимаются из DSL', () => {
    const spec = 'x -6 6\ny -4 4\nspline g (-5 -3) (-3 2) (0 -1) (3 3) color blue\nderiv g color green\ndrop -3 g';
    const onInsert = open({ kind: 'function', initialSpec: spec });
    expect(screen.getByText('Правка: Кривая по точкам')).toBeInTheDocument();
    expect(screen.getByLabelText('x точки 2')).toHaveValue('-3');
    expect(screen.getByLabelText('имя кривой')).toHaveValue('g');
    const out = insert(onInsert, 'Сохранить');
    expect(out).toContain('spline g (-5 -3) (-3 2) (0 -1) (3 3) color blue');
    expect(out).toContain('deriv g color green');
    expect(out).toContain('drop -3 g');
  });

  it('переименование кривой переносит ссылки разметки', () => {
    const onInsert = open({ initialSpec: 'spline f (-2 0) (0 2) (2 0)\nmark 0 f\ndrop 1 f\'' });
    const name = screen.getByLabelText('имя кривой');
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.change(name, { target: { value: 'h' } });
    const out = insert(onInsert, 'Сохранить');
    expect(out).toContain('mark 0 h');
    expect(out).toContain("drop 1 h'");
  });
});

describe('findPlotAtCursor — вкладка кривой', () => {
  it('блок со spline открывается на вкладке «Кривая по точкам»', () => {
    const text = 'Условие\n```plot\nspline f (0 0) (1 1) (2 0)\n```\n';
    expect(findPlotAtCursor(text, 12).kind).toBe('curve');
    expect(findPlotAtCursor('`plot: x -3 3; f x^2`', 3).kind).toBe('function');
  });
});
