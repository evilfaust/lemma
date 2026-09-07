import { describe, it, expect } from 'vitest';
import { insertAtCaret } from '../utils/caretInsert';

describe('insertAtCaret', () => {
  const text = 'Начало | ячейка | конец';

  it('вставляет по курсору и возвращает позицию за вставкой', () => {
    const pos = text.indexOf('ячейка');
    const r = insertAtCaret(text, { start: pos, end: pos }, 'ЧЕРТЁЖ');
    expect(r.text).toBe('Начало | ЧЕРТЁЖячейка | конец');
    expect(r.text.slice(0, r.caret)).toBe('Начало | ЧЕРТЁЖ');
  });

  it('выделение заменяется сниппетом', () => {
    const from = text.indexOf('ячейка');
    const r = insertAtCaret(text, { start: from, end: from + 'ячейка'.length }, 'X');
    expect(r.text).toBe('Начало | X | конец');
  });

  it('без позиции — в конец (прежнее поведение)', () => {
    expect(insertAtCaret(text, null, '!').text).toBe(`${text}!`);
    expect(insertAtCaret(text, { start: 999, end: 999 }, '!').text).toBe(`${text}!`);
    expect(insertAtCaret(text, { start: 5, end: 2 }, '!').text).toBe(`${text}!`);
  });

  it('в пустом поле у блочного сниппета срезается ведущий перевод строки', () => {
    const r = insertAtCaret('', null, '\n```plot\nf x\n```\n');
    expect(r.text.startsWith('```plot')).toBe(true);
    expect(r.caret).toBe(r.text.length);
  });
});
