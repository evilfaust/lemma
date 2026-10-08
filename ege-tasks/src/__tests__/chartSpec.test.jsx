import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  parseChartSpec, chartToSpec, docToChart, chartSvgFromSpec, buildChartSnippet,
  parseTablePaste, fitAxesToData, splitChartCommands, autoAxis,
} from '../utils/chartSpec';
import { chartSvg } from '../utils/chartSvg';
import { findChartAtCursor } from '../utils/plotSnippet';
import MathRenderer from '../shared/components/MathRenderer';
import { splitSideFigure } from '../components/print-sheet/sideFigure';
import { hasFigure } from '../components/print-sheet/SheetTask';

// Блок ```chart — график по таблице значений (осадки по дням и т. п.).

const RAIN = `x 8 24 step 1
y 0 4,5 step 0,5 decimals 1
xtitle Число месяца
ytitle Количество осадков, мм
values 4 1,5 0,25 1,5 4 0 3 1,5 1,75 0,5 1 0 0,5 0,8 0 0 0,5 color orange`;

const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('разбор DSL', () => {
  it('values раскладываются с начала оси x с её шагом', () => {
    const { doc, errors } = parseChartSpec(RAIN);
    expect(errors).toEqual([]);
    expect(doc.series).toHaveLength(1);
    const pts = doc.series[0].points;
    expect(pts).toHaveLength(17);
    expect(pts[0]).toEqual([8, 4]);
    expect(pts[2]).toEqual([10, 0.25]);
    expect(pts.at(-1)).toEqual([24, 0.5]);
    expect(doc.series[0].color).toBe('orange');
    expect(doc.y).toMatchObject({ min: 0, max: 4.5, step: 0.5, decimals: 1 });
  });

  it('порядок команд не важен: values до окна x', () => {
    const { doc } = parseChartSpec('values 1 2 3\nx 10 12 step 1');
    expect(doc.series[0].points).toEqual([[10, 1], [11, 2], [12, 3]]);
  });

  it('line — точки «(x; y)», «;» в скобках не режет команду в строку', () => {
    expect(splitChartCommands('x 0 4; line (0; 1) (2; 3,5); y 0 4')).toEqual(['x 0 4', 'line (0; 1) (2; 3,5)', 'y 0 4']);
    const { doc } = parseChartSpec('x 0 4; line (0; 1) (2; 3,5) (4 2) smooth nodots dash');
    expect(doc.series[0]).toMatchObject({ points: [[0, 1], [2, 3.5], [4, 2]], smooth: true, dots: false, dash: true });
  });

  it('столбики с подписями (через пробел и через «|»)', () => {
    const a = parseChartSpec('bar 3 5 2\nlabels янв фев мар').doc;
    expect(a.type).toBe('bar');
    expect(a.bars).toEqual([{ label: 'янв', v: 3 }, { label: 'фев', v: 5 }, { label: 'мар', v: 2 }]);
    const b = parseChartSpec('bar 3 5\nlabels 1 кв. | 2 кв.').doc;
    expect(b.bars.map((x) => x.label)).toEqual(['1 кв.', '2 кв.']);
  });

  it('без окна — оси подбираются по данным', () => {
    const { doc } = parseChartSpec('line (1; 12) (2; 37) (3; 20)');
    expect(doc.x.min).toBeLessThanOrEqual(1);
    expect(doc.x.max).toBeGreaterThanOrEqual(3);
    expect(doc.y.min).toBe(0);
    expect(doc.y.max).toBeGreaterThanOrEqual(37);
  });

  it('непонятные строки — в ошибки и сохраняются при сборке', () => {
    const { doc, errors } = parseChartSpec('values 1 2\nчто-то странное');
    expect(errors).toEqual(['что-то странное']);
    expect(chartToSpec(doc)).toContain('что-то странное');
  });
});

describe('DSL ↔ документ без потерь', () => {
  it.each([
    RAIN,
    'x 0 24 step 3\ny -6 6 step 2\nxunit ч\nyunit °C\nline (0; -4) (3; -6) (7; -2) smooth color blue',
    'y 0 80 step 10 label 20\nytitle Осадки, мм\nbar 30 25 35 color green\nlabels янв фев мар',
    'x 1 5 step 1\ny 0 10 step 2\nvalues 3 5 4 8 6\nvalues 1 2 3 4 5 color red dash\nsize 420 260\nfont 1,35',
  ])('%s', (spec) => {
    const once = chartToSpec(parseChartSpec(spec).doc);
    const twice = chartToSpec(parseChartSpec(once).doc);
    expect(twice).toBe(once);
    expect(parseChartSpec(once).doc).toEqual(parseChartSpec(spec).doc);
  });

  it('регулярная линия записывается коротко через values', () => {
    expect(chartToSpec(parseChartSpec('x 0 2 step 1\nline (0; 1) (1; 2) (2; 3)').doc)).toContain('values 1 2 3');
  });
});

describe('рисунок', () => {
  it('осадки: шкала «4,0», подписи осей, засечки 8…24, точки', () => {
    const svg = chartSvgFromSpec(RAIN);
    expect(svg).toMatch(/^<svg/);
    expect(svg).not.toMatch(/NaN|undefined/);
    const t = texts(svg);
    expect(t).toEqual(expect.arrayContaining(['4,0', '4,5', '0,0', '2,5', '8', '16', '24', 'Число месяца', 'Количество осадков, мм']));
    expect(svg).toMatch(/transform="rotate\(-90 /); // подпись оси y — вертикально
    expect((svg.match(/<circle/g) || []).length).toBe(17);
    expect(svg).toContain('stroke="#c8772e"'); // оранжевая линия
  });

  it('по умолчанию — только чёрная краска (печать на ч/б принтере)', () => {
    const svg = chartSvgFromSpec('x 0 2 step 1\nvalues 1 2 3');
    expect(svg).not.toMatch(/#c8772e|#2f6fb5/);
  });

  it('столбики: подписи категорий, заливка цветом', () => {
    const svg = chartSvgFromSpec('y 0 10 step 2\nbar 3 5 8 color blue\nlabels A B C');
    expect((svg.match(/<rect/g) || []).length).toBe(3);
    expect(svg).toContain('fill="#2f6fb5"');
    expect(texts(svg)).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  });

  it('в ячейку — та же картинка, уменьшенная целиком', () => {
    const full = chartSvgFromSpec(RAIN);
    const cell = chartSvgFromSpec(RAIN, { inline: true });
    expect(cell).toMatch(/width="220"/);
    expect(texts(cell)).toEqual(texts(full));
  });

  it('генератор «Графики и диаграммы» рисуется как раньше (новые поля необязательны)', () => {
    const chart = docToChart(parseChartSpec('x 0 4 step 1\nvalues 1 2 3 2 1').doc);
    delete chart.x.title;
    const svg = chartSvg(chart);
    expect(svg).toMatch(/width="300" height="180"/);
    expect(svg).not.toMatch(/rotate/);
  });
});

describe('вставка из таблиц', () => {
  it('два столбца из Excel (табуляция), с шапкой', () => {
    expect(parseTablePaste('День\tОсадки\n8\t4\n9\t1,5')).toEqual({ rows: [['8', 4], ['9', 1.5]], values: false });
  });
  it('строка значений и столбец значений', () => {
    expect(parseTablePaste('4 1,5 0,25').rows.map((r) => r[1])).toEqual([4, 1.5, 0.25]);
    expect(parseTablePaste('4\n1,5\n0,25')).toMatchObject({ values: true });
  });
  it('две строки «по горизонтали» — x сверху, значения снизу', () => {
    expect(parseTablePaste('8\t9\t10\n4\t1,5\t0,25').rows).toEqual([['8', 4], ['9', 1.5], ['10', 0.25]]);
  });
  it('подпись и значение через пробел', () => {
    expect(parseTablePaste('янв 30\nфев 25').rows).toEqual([['янв', 30], ['фев', 25]]);
  });
  it('мусор — null', () => {
    expect(parseTablePaste('просто текст')).toBeNull();
  });
});

describe('подбор осей', () => {
  it('x — по точкам, y — с нуля до круглого, знаки после запятой по шагу', () => {
    const doc = fitAxesToData(parseChartSpec('line (8; 4) (9; 1,5) (10; 0,25) (11; 3,7)').doc);
    expect(doc.x).toMatchObject({ min: 8, max: 11, step: 1 });
    expect(doc.y.min).toBe(0);
    expect(doc.y.max).toBeGreaterThanOrEqual(3.7);
    expect(doc.y.decimals).toBe(1);
  });
  it('autoAxis: красивый шаг', () => {
    expect(autoAxis(0, 37)).toEqual({ min: 0, max: 40, step: 5, label: null });
  });
});

describe('редакторы и конвейеры', () => {
  it('курсор внутри блока и внутри `chart: …` находится', () => {
    const text = `Условие\n\n\`\`\`chart\n${RAIN}\n\`\`\`\n\n| a | \`chart: values 1 2\` |`;
    const block = findChartAtCursor(text, text.indexOf('values'));
    expect(block).toMatchObject({ format: 'block', spec: RAIN });
    const cell = findChartAtCursor(text, text.indexOf('chart: values') + 3);
    expect(cell).toMatchObject({ format: 'inline', spec: 'values 1 2' });
    expect(findChartAtCursor(text, 2)).toBeNull();
  });

  it('сниппет: блок и строка', () => {
    expect(buildChartSnippet('a\nb', 'block')).toBe('\n```chart\na\nb\n```\n');
    expect(buildChartSnippet('a\nb', 'inline')).toBe('`chart: a; b`');
  });

  it('MathRenderer рисует блок и ячейку, класс coordplot для печатных листов', () => {
    const md = `\`\`\`chart\n${RAIN}\n\`\`\`\n\n| a | \`chart: x 1 3 step 1; values 1 2 3\` |\n| --- | --- |`;
    const { container } = render(<MathRenderer text={md} />);
    expect(container.querySelectorAll('.mr-figure .chartplot svg')).toHaveLength(1);
    expect(container.querySelectorAll('td .chartplot svg, th .chartplot svg')).toHaveLength(1);
    expect(container.querySelector('.coordplot.chartplot')).toBeTruthy();
  });

  it('печатный лист видит блок как чертёж (сбоку и «есть рисунок»)', () => {
    const md = `Найдите…\n\n\`\`\`chart\n${RAIN}\n\`\`\``;
    expect(hasFigure({ statement_md: md })).toBe(true);
    expect(splitSideFigure(md).figure).toMatchObject({ kind: 'drawing' });
  });
});
