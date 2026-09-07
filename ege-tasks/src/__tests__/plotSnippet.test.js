import { describe, it, expect } from 'vitest';
import { findPlotAtCursor, plotKindOf } from '../utils/plotSnippet';

// Текст с двумя чертежами: блок в условии и inline в ячейке таблицы.
const TEXT = [
  'Задача про графики.',
  '',
  '```plot',
  'x -5 5',
  'f 2-2x',
  'label 0 2 2',
  '```',
  '',
  'А ещё вот такой: | 1) `plot: x -3 3; f x^2` | 2) текст |',
  '',
].join('\n');

const at = (needle, shift = 0) => TEXT.indexOf(needle) + shift;

describe('findPlotAtCursor', () => {
  it('курсор внутри блока ```plot — отдаёт спеку и границы блока', () => {
    const found = findPlotAtCursor(TEXT, at('label 0 2 2'));
    expect(found).toBeTruthy();
    expect(found.format).toBe('block');
    expect(found.kind).toBe('function');
    expect(found.spec).toBe('x -5 5\nf 2-2x\nlabel 0 2 2');
    // границы покрывают ровно блок с обеими оградами
    expect(TEXT.slice(found.start, found.end)).toBe('```plot\nx -5 5\nf 2-2x\nlabel 0 2 2\n```');
  });

  it('границы блока считаются и от открывающей, и от закрывающей ограды', () => {
    const open = findPlotAtCursor(TEXT, at('```plot'));
    const close = findPlotAtCursor(TEXT, at('```\n\nА ещё') + 2);
    expect(open).toMatchObject({ start: open.start, format: 'block' });
    expect(close).toMatchObject({ start: open.start, end: open.end });
  });

  it('курсор в inline `plot: …` — отдаёт спеку ячейки', () => {
    const found = findPlotAtCursor(TEXT, at('f x^2'));
    expect(found).toMatchObject({ format: 'inline', kind: 'function', spec: 'x -3 3; f x^2' });
    expect(TEXT.slice(found.start, found.end)).toBe('`plot: x -3 3; f x^2`');
  });

  it('курсор вне чертежей — ничего не находит (значит, вставка новым блоком)', () => {
    expect(findPlotAtCursor(TEXT, at('Задача про'))).toBeNull();
    expect(findPlotAtCursor(TEXT, at('2) текст'))).toBeNull();
    expect(findPlotAtCursor('', 0)).toBeNull();
    expect(findPlotAtCursor(TEXT, null)).toBeNull();
    expect(findPlotAtCursor(TEXT, 10 ** 6)).toBeNull();
  });

  it('незакрытый блок не считается чертежом', () => {
    const broken = 'текст\n```plot\nx -5 5\nf x\n';
    expect(findPlotAtCursor(broken, broken.indexOf('f x'))).toBeNull();
  });

  it('вкладка конструктора определяется по содержимому и алиасу', () => {
    const vec = '```vectors\nx -1 5\nvec a 0 0 3 2\n```';
    expect(findPlotAtCursor(vec, vec.indexOf('vec a')).kind).toBe('vectors');
    // пустой ```vectors команд ещё не содержит — вкладку берём из алиаса
    const empty = '```vectors\nx -1 5\n```';
    expect(findPlotAtCursor(empty, empty.indexOf('x -1 5')).kind).toBe('vectors');
    expect(findPlotAtCursor('`vectors: x -1 5; vec a 2 3`', 5).kind).toBe('vectors');
    expect(plotKindOf('f x^2; point 1 1')).toBe('function');
  });

  it('из нескольких блоков выбирается тот, в котором стоит курсор', () => {
    const two = '```plot\nf x\n```\n\n```plot\nf 2x\n```';
    expect(findPlotAtCursor(two, two.indexOf('f 2x')).spec).toBe('f 2x');
    expect(findPlotAtCursor(two, two.indexOf('f x')).spec).toBe('f x');
  });
});
