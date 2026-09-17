import { describe, it, expect } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';

// Координатная плоскость подключена к ДВУМ разным конвейерам рендера:
// условия задач (react-markdown → MathRenderer) и теория (remark → HTML-строка
// → DOMPurify). Проверяем обе ветки: картинка должна доезжать до DOM целиком.

describe('MathRenderer: координатная плоскость', () => {
  it('fenced-блок ```plot → svg', () => {
    const { container } = render(<MathRenderer text={'```plot\nx -3 3\nf x^2\n```'} />);
    const svg = container.querySelector('svg.coordplot-svg');
    expect(svg).toBeTruthy();
    expect(svg.querySelector('path')).toBeTruthy();
  });

  it('алиас ```vectors тоже рисует плоскость', () => {
    const { container } = render(<MathRenderer text={'```vectors\nvec a 1 1 3 2\n```'} />);
    expect(container.querySelector('svg.coordplot-svg')).toBeTruthy();
  });

  it('inline-форма `plot: …` в ячейке таблицы', () => {
    const md = '| ГРАФИК | ФОРМУЛА |\n| --- | --- |\n| `plot: x -3 3; f x^2` | $y=x^2$ |';
    const { container } = render(<MathRenderer text={md} />);
    expect(container.querySelector('td svg.coordplot-svg')).toBeTruthy();
  });

  it('обычный блок кода не превращается в картинку', () => {
    const { container } = render(<MathRenderer text={'```js\nconst a = 1;\n```'} />);
    expect(container.querySelector('svg.coordplot-svg')).toBeFalsy();
    expect(container.querySelector('pre')).toBeTruthy();
  });

  it('числовая прямая продолжает работать рядом', () => {
    const { container } = render(<MathRenderer text={'```numline\nray right 1 open\n```'} />);
    expect(container.querySelector('svg.numline-svg')).toBeTruthy();
  });
});

describe('useMarkdownProcessor (теория): координатная плоскость', () => {
  it('блок ```plot переживает DOMPurify целиком', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('```plot\nx -3 3\nf x^2 color orange\npoint 1 1 fill\n```'));
    await waitFor(() => expect(result.current).toContain('coordplot-block'));
    expect(result.current).toContain('<svg');
    expect(result.current).toContain('<path');
    expect(result.current).toContain('stroke-linecap');
    expect(result.current).toContain('#c8772e');
    expect(result.current).toContain('<circle');
  });

  it('формула в подписи переживает DOMPurify (шрифт, жирность, корень)', async () => {
    const { result } = renderHook(() => useMarkdownProcessor(
      '```plot\nx -3 3\ny -3 3\nlabel 1 1 x_1 bold\nxtick 2 \\sqrt{2}\n```',
    ));
    await waitFor(() => expect(result.current).toContain('coordplot-block'));
    expect(result.current).toContain('font-family="KaTeX_Math');
    expect(result.current).toContain('font-weight="bold"');
    expect(result.current).toContain('<path'); // знак корня не вырезан санитайзером
  });

  it('inline-форма `plot: …` даёт компактную картинку', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('в ячейке `plot: x 0 4; vec a 1 1 3 3` конец'));
    await waitFor(() => expect(result.current).toContain('coordplot-inline'));
    expect(result.current).toContain('<svg');
  });
});

// Вставка «f′ и f рядом» из конструктора кривой: однострочная таблица-галерея
// с двумя inline-картинками. Штрих f′ в теории приходит HTML-сущностью.
describe('кривая по точкам: пара «f′ | f» в обоих конвейерах', () => {
  const PAIR = "\n{галерея}\n| `plot: x -5 5; y -3 3; spline f (-4 -2) (-1 2) (3 -2) hide; deriv f; mark -1 f'` "
    + '| `plot: x -5 5; y -3 3; spline f (-4 -2) (-1 2) (3 -2); drop -1 f` |\n';

  it('MathRenderer: две картинки в одной строке галереи', () => {
    const { container } = render(<MathRenderer text={PAIR} />);
    const svgs = container.querySelectorAll('table.md-table--gallery :is(th, td) svg.coordplot-svg');
    expect(svgs).toHaveLength(2);
    expect(svgs[0].querySelectorAll('path[stroke-linecap]').length).toBeGreaterThan(0);
    expect(svgs[0].querySelector('circle')).toBeTruthy(); // mark на f′
    expect(svgs[1].innerHTML).toContain('stroke-dasharray="4 3"'); // drop к f
  });

  it('теория: картинки переживают DOMPurify, штрих не ломает ссылку', async () => {
    const { result } = renderHook(() => useMarkdownProcessor(PAIR));
    await waitFor(() => expect(result.current).toContain('coordplot-inline'));
    expect(result.current.match(/<svg/g)).toHaveLength(2);
    expect(result.current).toContain('<circle');
    expect(result.current).toContain('stroke-dasharray="4 3"');
  });
});
