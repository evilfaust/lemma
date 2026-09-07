import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PlotModal from '../components/shared/PlotModal';

const wrapper = ({ children }) => <App>{children}</App>;

function open(props = {}) {
  const onInsert = vi.fn();
  render(<PlotModal open onCancel={() => {}} onInsert={onInsert} {...props} />, { wrapper });
  return onInsert;
}

describe('PlotModal', () => {
  it('режим «график»: рисует превью и вставляет блок ```plot', () => {
    const onInsert = open({ kind: 'function' });
    // «График функции» — и заголовок модала, и пункт переключателя
    expect(screen.getAllByText('График функции').length).toBeGreaterThan(0);
    // живое превью — inline-svg координатной плоскости
    expect(document.querySelector('svg.coordplot-svg')).toBeTruthy();

    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert).toHaveBeenCalledTimes(1);
    const snippet = onInsert.mock.calls[0][0];
    expect(snippet).toContain('```plot');
    expect(snippet).toContain('f x^2-4');
  });

  it('шаблон добавляет вторую кривую', () => {
    const onInsert = open({ kind: 'function' });
    fireEvent.click(screen.getByText('Гипербола'));
    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert.mock.calls[0][0]).toContain('f 2/x');
  });

  it('битая формула показывает ошибку и не роняет превью', () => {
    open({ kind: 'function' });
    const input = screen.getByDisplayValue('x^2-4');
    fireEvent.change(input, { target: { value: 'x^^' } });
    expect(screen.getByText(/Лишний символ|Ожидалось|Выражение оборвалось/)).toBeInTheDocument();
    expect(document.querySelector('svg.coordplot-svg')).toBeTruthy();
  });

  it('режим «векторы»: вставляет команду vec', () => {
    const onInsert = open({ kind: 'vectors' });
    expect(screen.getByText('Векторы на плоскости')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert.mock.calls[0][0]).toContain('vec a 0 0 3 2');
  });

  it('правка: открывается на готовой спеке и возвращает её же', () => {
    const spec = 'x -5 5\ny -5 5\nf 2-2x\npoint 0 2 fill\nlabel 0 2 A at nw';
    const onInsert = open({ kind: 'function', initialSpec: spec });
    expect(screen.getByText('Правка: График функции')).toBeInTheDocument();
    // поля подняты из DSL, а не дефолтные
    expect(screen.getByDisplayValue('2-2x')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('x^2-4')).toBeNull();

    fireEvent.click(screen.getByText('Сохранить'));
    const snippet = onInsert.mock.calls[0][0];
    expect(snippet).toContain('label 0 2 A at nw');
    expect(snippet).toContain('f 2-2x');
    expect(snippet).not.toContain('vec '); // дефолтный вектор не приезжает
  });

  it('правка: смена направления подписи попадает в спеку', () => {
    const onInsert = open({ kind: 'function', initialSpec: 'x -5 5\npoint 0 2 fill\nlabel 0 2 A' });
    fireEvent.mouseDown(screen.getByTitle('↗ вправо-вверх'));
    fireEvent.click(screen.getByText('↓ вниз'));
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert.mock.calls[0][0]).toContain('label 0 2 A at s');
  });

  it('inline-формат отдаёт код-спан для ячейки таблицы', () => {
    const onInsert = open({ kind: 'function', defaultFormat: 'inline' });
    fireEvent.click(screen.getByText('Вставить'));
    const snippet = onInsert.mock.calls[0][0];
    expect(snippet.startsWith('`plot:')).toBe(true);
    expect(snippet).not.toContain('\n');
  });
});
