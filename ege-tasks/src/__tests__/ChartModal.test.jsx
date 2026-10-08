import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import ChartModal from '../components/shared/ChartModal';

const wrapper = ({ children }) => <App>{children}</App>;

function open(props = {}) {
  const onInsert = vi.fn();
  render(<ChartModal open onCancel={() => {}} onInsert={onInsert} {...props} />, { wrapper });
  return onInsert;
}

describe('ChartModal', () => {
  it('новый график: пример с осадками, превью и вставка блока ```chart', () => {
    const onInsert = open();
    expect(document.querySelector('.plot-modal-preview .chartplot svg')).toBeTruthy();
    fireEvent.click(screen.getByText('Вставить'));
    const snippet = onInsert.mock.calls[0][0];
    expect(snippet).toContain('```chart');
    expect(snippet).toContain('ytitle Количество осадков, мм');
    expect(snippet).toContain('values 4 1,5 0,25');
  });

  it('правка готового блока: «Сохранить», формат в строку', () => {
    const onInsert = open({ initialSpec: 'x 1 3 step 1\ny 0 10 step 2\nvalues 2 4 6', defaultFormat: 'inline' });
    expect(screen.getByText('Правка графика по таблице')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert.mock.calls[0][0]).toBe('`chart: x 1 3 step 1; y 0 10 step 2; values 2 4 6`');
  });

  it('подпись оси попадает в разметку', () => {
    const onInsert = open({ initialSpec: 'x 1 3 step 1\ny 0 10 step 2\nvalues 2 4 6' });
    fireEvent.change(screen.getByPlaceholderText('под осью x: Число месяца'), { target: { value: 'Час' } });
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert.mock.calls[0][0]).toContain('xtitle Час');
  });

  it('переключение на столбики строит их из точек линии', () => {
    const onInsert = open({ initialSpec: 'x 1 3 step 1\ny 0 10 step 2\nvalues 2 4 6' });
    fireEvent.click(screen.getByText('Столбики (диаграмма)'));
    expect(document.querySelectorAll('.plot-modal-preview rect')).toHaveLength(3);
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert.mock.calls[0][0]).toContain('bar 2 4 6');
  });

  it('непонятные строки предупреждают и не теряются', () => {
    const onInsert = open({ initialSpec: 'values 1 2\nабракадабра' });
    expect(screen.getByText(/не понял, сохранятся как есть: абракадабра/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert.mock.calls[0][0]).toContain('абракадабра');
  });
});
