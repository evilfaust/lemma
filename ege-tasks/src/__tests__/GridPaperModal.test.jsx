import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import GridPaperModal from '../components/shared/GridPaperModal';

const wrapper = ({ children }) => <App>{children}</App>;

function open(props = {}) {
  const onInsert = vi.fn();
  render(<GridPaperModal open onCancel={() => {}} onInsert={onInsert} {...props} />, { wrapper });
  return onInsert;
}

describe('GridPaperModal', () => {
  it('по умолчанию вставляет inline-поле для ячейки таблицы', () => {
    const onInsert = open();
    expect(document.querySelector('svg.grid-paper-svg')).toBeTruthy();

    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert).toHaveBeenCalledWith('`grid: x6`');
  });

  it('пресет высоты меняет поле', () => {
    const onInsert = open();
    fireEvent.click(screen.getByText('Полстраницы'));
    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert.mock.calls[0][0]).toBe('`grid: x12`');
  });

  it('«в линейку» переключает шаг на 8 мм', () => {
    const onInsert = open();
    fireEvent.click(screen.getByText('В линейку'));
    fireEvent.click(screen.getByText('Вставить'));
    expect(onInsert.mock.calls[0][0]).toBe('`grid: x6 lines`');
  });

  it('initialSpec открывает конструктор на правку', () => {
    const onInsert = open({ initialSpec: '12x8 cell 7', defaultFormat: 'block' });
    expect(screen.getByText('Правка места для записи')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Сохранить'));
    expect(onInsert).toHaveBeenCalledWith('\n```grid\n12x8 cell 7\n```\n');
  });
});
