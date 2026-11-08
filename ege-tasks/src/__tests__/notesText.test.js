import { describe, it, expect } from 'vitest';
import { extractNoteText, extractCheckItems } from '../components/workspace/notesText';

describe('extractCheckItems', () => {
  it('возвращает [] для не-массива', () => {
    expect(extractCheckItems(null)).toEqual([]);
    expect(extractCheckItems(undefined)).toEqual([]);
    expect(extractCheckItems('x')).toEqual([]);
  });

  it('собирает чек-айтемы с текстом и состоянием', () => {
    const body = [
      { id: 'a', type: 'paragraph', content: [{ type: 'text', text: 'обычный' }] },
      { id: 'b', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'купить мел' }] },
      { id: 'c', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'позвонить' }] },
    ];
    expect(extractCheckItems(body)).toEqual([
      { blockId: 'b', text: 'купить мел', checked: false },
      { blockId: 'c', text: 'позвонить', checked: true },
    ]);
  });

  it('обходит вложенные чек-айтемы (children)', () => {
    const body = [
      {
        id: 'p', type: 'bulletListItem', content: [{ type: 'text', text: 'раздел' }],
        children: [
          { id: 'n', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'вложенный' }] },
        ],
      },
    ];
    expect(extractCheckItems(body)).toEqual([
      { blockId: 'n', text: 'вложенный', checked: true },
    ]);
  });

  it('checked по умолчанию false, если props отсутствует', () => {
    const body = [{ id: 'x', type: 'checkListItem', content: [{ type: 'text', text: 't' }] }];
    expect(extractCheckItems(body)[0].checked).toBe(false);
  });
});

describe('extractNoteText (регрессия)', () => {
  it('читает строковый content новых шаблонов до первой правки в редакторе', () => {
    const body = [{ type: 'heading', content: 'Повторение' }, { id: 'c', type: 'checkListItem', content: 'Проверить' }];
    expect(extractNoteText(body)).toBe('Повторение Проверить');
    expect(extractCheckItems(body)[0].text).toBe('Проверить');
  });

  it('индексирует формулы внутри строки, включая таблицы и чек-листы', () => {
    const formula = { type: 'inlineMath', props: { formula: 'x^2+1' } };
    const body = [
      { id: 'p', type: 'paragraph', content: [{ type: 'text', text: 'Решить ' }, formula] },
      { id: 't', type: 'table', content: { rows: [{ cells: [[formula]] }] } },
      { id: 'c', type: 'checkListItem', content: [formula] },
    ];
    expect(extractNoteText(body)).toBe('Решить x^2+1 x^2+1 x^2+1');
    expect(extractCheckItems(body)[0].text).toBe('x^2+1');
  });

  it('склеивает инлайны и не падает на math-блоке', () => {
    const body = [
      { id: 'a', type: 'paragraph', content: [{ type: 'text', text: 'Формула' }] },
      { id: 'b', type: 'math', props: { formula: 'x^2' } },
    ];
    const t = extractNoteText(body);
    expect(t).toContain('Формула');
    expect(t).toContain('x^2');
  });
});
