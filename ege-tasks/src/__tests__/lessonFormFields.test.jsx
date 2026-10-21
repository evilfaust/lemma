import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonStatusField, PairButtons } from '../components/workspace/calendar/LessonFormFields';

describe('LessonStatusField', () => {
  it('показывает три статуса и отмечает текущий', () => {
    render(<LessonStatusField value="done" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Запланирован', 'Проведён', 'Отменён']);
    expect(screen.getByRole('radio', { name: /Проведён/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('клик меняет статус, повторный клик по текущему — ничего', () => {
    const onChange = vi.fn();
    render(<LessonStatusField value="planned" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Отменён/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Запланирован/ }));
    expect(onChange.mock.calls).toEqual([['cancelled']]);
  });

  it('без прав кнопки выключены', () => {
    render(<LessonStatusField value="planned" disabled />);
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });
});

describe('PairButtons', () => {
  it('выбор пары, повторный клик и «своё» снимают её', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PairButtons value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /^1\s*10:15/ }));
    expect(onChange).toHaveBeenLastCalledWith('1');
    rerender(<PairButtons value="1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /^1\s*10:15/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('radio', { name: /своё/ }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('у интенсива нет «своё», а пары до начала выключены', () => {
    render(<PairButtons value={null} allowNone={false} isDisabled={(k) => Number(k) <= 2} />);
    expect(screen.queryByRole('radio', { name: /своё/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /^2\s*12:00/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^3\s*14:05/ })).not.toBeDisabled();
  });
});
