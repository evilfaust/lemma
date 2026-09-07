import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LatexField from '../components/shared/LatexField';

// Позиция каретки нужна кнопкам «График»/«Векторы»: по ней ищется чертёж под
// курсором. Проверяем, что Ant TextArea действительно пробрасывает обработчики
// на нативный <textarea> (в code-режиме позицию отдаёт CodeMirror).
describe('LatexField onCaret (plain)', () => {
  it('сообщает позицию курсора при клике и наборе', () => {
    const onCaret = vi.fn();
    render(<LatexField value={'первая строка\n```plot\nf x\n```'} onCaret={onCaret} />);
    const el = screen.getByRole('textbox');

    el.setSelectionRange(20, 20);
    fireEvent.click(el);
    expect(onCaret).toHaveBeenLastCalledWith({ start: 20, end: 20 });

    el.setSelectionRange(5, 5);
    fireEvent.keyUp(el, { key: 'ArrowLeft' });
    expect(onCaret).toHaveBeenLastCalledWith({ start: 5, end: 5 });

    // выделение отдаётся целиком — вставка сниппета его заменяет
    el.setSelectionRange(0, 6);
    fireEvent.select(el);
    expect(onCaret).toHaveBeenLastCalledWith({ start: 0, end: 6 });
  });
});
