import { describe, it, expect } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';
import {
  parseGridPaper, gridPaperSvg, gridPaperSvgFromSpec, gridToSpec, buildGridSnippet,
} from '../utils/gridPaper';
import { findGridAtCursor, findPlotAtCursor } from '../utils/plotSnippet';

const lines = (svg) => (svg.match(/<line /g) || []).length;

describe('gridPaper: разбор DSL', () => {
  it('пустая спецификация → поле на всю ширину, 6 клеток в высоту', () => {
    expect(parseGridPaper('')).toEqual({ cols: null, rows: 6, stepMm: 5, kind: 'grid', frame: true });
  });

  it('«10x6» — ширина и высота в клетках', () => {
    expect(parseGridPaper('10x6')).toMatchObject({ cols: 10, rows: 6 });
  });

  it('русская «х» и знак «×» работают как латинская x', () => {
    expect(parseGridPaper('10х6')).toMatchObject({ cols: 10, rows: 6 });
    expect(parseGridPaper('10×6')).toMatchObject({ cols: 10, rows: 6 });
  });

  it('«x8» и просто «8» — только высота, ширина по месту', () => {
    expect(parseGridPaper('x8')).toMatchObject({ cols: null, rows: 8 });
    expect(parseGridPaper('8')).toMatchObject({ cols: null, rows: 8 });
  });

  it('«cell 7» / «клетка 7» меняют размер клетки', () => {
    expect(parseGridPaper('10x6 cell 7').stepMm).toBe(7);
    expect(parseGridPaper('10x6 клетка 7').stepMm).toBe(7);
  });

  it('линейка получает шаг 8 мм, если он не задан явно', () => {
    expect(parseGridPaper('x8 lines')).toMatchObject({ kind: 'lines', stepMm: 8 });
    expect(parseGridPaper('x8 в линейку').kind).toBe('lines');
    expect(parseGridPaper('x8 lines cell 10').stepMm).toBe(10);
  });

  it('«blank» / «пусто» — чистое поле', () => {
    expect(parseGridPaper('x4 blank').kind).toBe('blank');
    expect(parseGridPaper('x4 пусто').kind).toBe('blank');
  });

  it('«noframe» и «без рамки» убирают контур', () => {
    expect(parseGridPaper('x6 noframe').frame).toBe(false);
    expect(parseGridPaper('x6 без рамки').frame).toBe(false);
  });

  it('размеры зажимаются в разумные пределы', () => {
    expect(parseGridPaper('200x200')).toMatchObject({ cols: 60, rows: 60 });
    expect(parseGridPaper('x6 cell 99').stepMm).toBe(20);
  });

  it('опечатка не ломает поле — неизвестные слова игнорируются', () => {
    expect(parseGridPaper('10x6 клеточкаа')).toMatchObject({ cols: 10, rows: 6, kind: 'grid' });
  });
});

describe('gridPaper: сборка SVG', () => {
  it('фиксированный размер — миллиметры и viewBox', () => {
    const svg = gridPaperSvgFromSpec('4x3');
    expect(svg).toContain('width="20mm"');
    expect(svg).toContain('height="15mm"');
    expect(svg).toContain('viewBox="0 0 20 15"');
    // внутренние линии: 3 вертикали + 2 горизонтали (крайние закрывает рамка)
    expect(lines(svg)).toBe(5);
    expect(svg).toContain('<rect');
  });

  it('без ширины — тянущееся поле: 100% и координаты в мм', () => {
    const svg = gridPaperSvgFromSpec('x3');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="15mm"');
    expect(svg).not.toContain('viewBox');
    expect(svg).toContain('y1="5mm"');
    // ширина заранее неизвестна → вертикали с запасом, лишние обрежет вьюпорт
    expect(lines(svg)).toBeGreaterThan(50);
    // колонка таблицы не должна схлопнуться под width:100%
    expect(svg).toContain('min-width:40mm');
  });

  it('в линейку — только горизонтальные линии', () => {
    const svg = gridPaperSvgFromSpec('10x4 lines');
    expect(lines(svg)).toBe(3);
  });

  it('чистое поле — одна рамка без разлиновки', () => {
    const svg = gridPaperSvgFromSpec('10x4 blank');
    expect(lines(svg)).toBe(0);
    expect(svg).toContain('<rect');
  });

  it('без рамки рисуются и крайние линии', () => {
    const withFrame = gridPaperSvgFromSpec('4x3');
    const noFrame = gridPaperSvgFromSpec('4x3 noframe');
    expect(noFrame).not.toContain('<rect');
    expect(lines(noFrame)).toBe(lines(withFrame) + 4);
  });

  it('никаких defs/pattern/url(#…) — разметка должна пережить DOMPurify', () => {
    const svg = gridPaperSvgFromSpec('10x6');
    expect(svg).not.toMatch(/<defs|<pattern|url\(#/);
  });

  it('модель и спецификация дают одинаковую картинку', () => {
    expect(gridPaperSvg(parseGridPaper('8x5 cell 7'))).toBe(gridPaperSvgFromSpec('8x5 cell 7'));
  });
});

describe('gridPaper: сериализация конструктора', () => {
  it('gridToSpec → parseGridPaper возвращает ту же модель', () => {
    for (const model of [
      { cols: 10, rows: 6, stepMm: 5, kind: 'grid', frame: true },
      { cols: null, rows: 12, stepMm: 7, kind: 'grid', frame: false },
      { cols: null, rows: 5, stepMm: 8, kind: 'lines', frame: true },
      { cols: 20, rows: 4, stepMm: 5, kind: 'blank', frame: true },
    ]) {
      expect(parseGridPaper(gridToSpec(model))).toEqual(model);
    }
  });

  it('сниппет: inline — для ячейки таблицы, block — отдельным полем', () => {
    expect(buildGridSnippet('10x6', 'inline')).toBe('`grid: 10x6`');
    expect(buildGridSnippet('10x6', 'block')).toBe('\n```grid\n10x6\n```\n');
  });
});

describe('MathRenderer (условия задач): поле в клетку', () => {
  it('fenced-блок ```grid → svg', () => {
    const { container } = render(<MathRenderer text={'```grid\n10x6\n```'} />);
    expect(container.querySelector('svg.grid-paper-svg')).toBeTruthy();
  });

  it('кириллический алиас ```клетка', () => {
    const { container } = render(<MathRenderer text={'```клетка\nx4\n```'} />);
    expect(container.querySelector('svg.grid-paper-svg')).toBeTruthy();
  });

  it('inline-форма `grid: …` в ячейке таблицы', () => {
    const md = '| ЗАДАНИЕ | РЕШЕНИЕ |\n| --- | --- |\n| $2x+1=7$ | `grid: x5` |';
    const { container } = render(<MathRenderer text={md} />);
    const svg = container.querySelector('td svg.grid-paper-svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('width')).toBe('100%');
  });

  it('поле для записи не прячется под .mr-figure (его нельзя масштабировать)', () => {
    const { container } = render(<MathRenderer text={'```grid\n10x6\n```'} />);
    expect(container.querySelector('.mr-figure')).toBeFalsy();
    expect(container.querySelector('.grid-paper')).toBeTruthy();
  });

  it('обычный блок кода не превращается в поле', () => {
    const { container } = render(<MathRenderer text={'```js\nconst grid = 1;\n```'} />);
    expect(container.querySelector('svg.grid-paper-svg')).toBeFalsy();
    expect(container.querySelector('pre')).toBeTruthy();
  });

  it('соседние чертежи продолжают работать', () => {
    const { container } = render(<MathRenderer text={'```numline\nray right 1 open\n```'} />);
    expect(container.querySelector('svg.numline-svg')).toBeTruthy();
  });
});

describe('useMarkdownProcessor (теория): поле в клетку', () => {
  it('блок ```grid переживает DOMPurify целиком', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('```grid\n10x6\n```'));
    await waitFor(() => expect(result.current).toContain('grid-paper-block'));
    expect(result.current).toContain('<svg');
    expect(result.current).toContain('<line');
    expect(result.current).toContain('<rect');
  });

  it('inline-форма `grid: …` тянется на всю ширину ячейки', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('в ячейке `grid: x5` конец'));
    await waitFor(() => expect(result.current).toContain('grid-paper-inline'));
    expect(result.current).toContain('width="100%"');
  });
});

describe('findGridAtCursor: правка готового поля по курсору', () => {
  it('курсор внутри блока ```grid → диапазон блока', () => {
    const text = 'Условие\n\n```grid\n10x6\n```\n\nдальше';
    const found = findGridAtCursor(text, text.indexOf('10x6') + 2);
    expect(found).toMatchObject({ spec: '10x6', format: 'block' });
    expect(text.slice(found.start, found.end)).toBe('```grid\n10x6\n```');
  });

  it('курсор внутри inline-поля в ячейке таблицы', () => {
    const text = '| задание | `grid: x5` |';
    const found = findGridAtCursor(text, text.indexOf('x5'));
    expect(found).toMatchObject({ spec: 'x5', format: 'inline' });
    expect(text.slice(found.start, found.end)).toBe('`grid: x5`');
  });

  it('вне поля — null, и чертежи друг друга не перехватывают', () => {
    const text = 'просто текст';
    expect(findGridAtCursor(text, 3)).toBeNull();
    const plot = '```plot\nx -3 3\n```';
    expect(findGridAtCursor(plot, 5)).toBeNull();
    expect(findPlotAtCursor('```grid\n10x6\n```', 5)).toBeNull();
  });
});
