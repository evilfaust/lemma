import { describe, it, expect } from 'vitest';
import {
  parseNumberLine, numberLineSvg, numberLineSvgFromSpec, shapesToSpec, pointsToSpec,
} from '../utils/numberLine';
import { buildNumlineSnippet } from '../components/shared/NumberLineModal';

describe('parseNumberLine', () => {
  it('разбирает домен', () => {
    expect(parseNumberLine('domain 0 3').domain).toEqual([0, 3]);
  });

  it('игнорирует битый домен (min>=max)', () => {
    expect(parseNumberLine('domain 5 1').domain).toEqual([0, 5]);
  });

  it('луч вправо: бар до +inf, выколотая точка, тик', () => {
    const m = parseNumberLine('domain 0 3\nray right 1 open');
    expect(m.bars).toEqual([{ from: 1, to: Infinity }]);
    expect(m.points).toEqual([{ x: 1, filled: false }]);
    expect(m.ticks).toEqual([{ x: 1, label: '1', bold: false }]);
  });

  it('луч влево: бар от -inf', () => {
    const m = parseNumberLine('ray left 2 fill');
    expect(m.bars).toEqual([{ from: -Infinity, to: 2 }]);
    expect(m.points).toEqual([{ x: 2, filled: true }]);
  });

  it('отрезок: нормализует порядок концов и ставит две точки', () => {
    const m = parseNumberLine('seg 2 1 open fill');
    expect(m.bars).toEqual([{ from: 1, to: 2 }]);
    expect(m.points).toContainEqual({ x: 2, filled: false });
    expect(m.points).toContainEqual({ x: 1, filled: true });
  });

  it('запятая как десятичный разделитель', () => {
    expect(parseNumberLine('point 1,5 fill').points).toEqual([{ x: 1.5, filled: true }]);
  });

  it('tick с явной подписью перекрывает дефолт', () => {
    const m = parseNumberLine('point 1 fill\ntick 1 один');
    expect(m.ticks).toEqual([{ x: 1, label: 'один', bold: false }]);
  });

  it('дедуп тиков по координате, сортировка', () => {
    const m = parseNumberLine('point 2 open\npoint 1 open');
    expect(m.ticks.map((t) => t.x)).toEqual([1, 2]);
  });

  it('комментарии и пустые строки пропускаются', () => {
    const m = parseNumberLine('# коммент\n\nray right 1 open');
    expect(m.bars.length).toBe(1);
  });

  it('inline-форма: «;» как разделитель команд', () => {
    const m = parseNumberLine('domain 0 2; ray left 1 open');
    expect(m.domain).toEqual([0, 2]);
    expect(m.bars).toEqual([{ from: -Infinity, to: 1 }]);
  });
});

describe('numberLineSvg', () => {
  it('строит валидный svg без defs/pattern/marker', () => {
    const svg = numberLineSvgFromSpec('domain 0 3\nray right 1 open');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<pattern');
    expect(svg).not.toContain('<marker');
    expect(svg).not.toContain('<defs');
    // ось + стрелка + хотя бы одна штриховая линия + точка
    expect(svg).toContain('<path');
    expect(svg).toContain('<circle');
    expect(svg).toMatch(/<line[^>]+stroke="#4b5563"/); // штриховка (строгий монохром)
  });

  it('всегда одна стрелка (вправо) — луч влево НЕ добавляет вторую', () => {
    const svg = numberLineSvgFromSpec('ray left 2 open');
    expect((svg.match(/<path/g) || []).length).toBe(1);
  });

  it('экранирует подпись тика', () => {
    // Подпись набирается по глифам, поэтому «<b>» приезжает не одним куском —
    // важно, что угловые скобки экранированы и тега в разметке нет.
    const svg = numberLineSvgFromSpec('tick 1 <b>');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&gt;');
  });

  it('буква оси настраивается через axis', () => {
    expect(numberLineSvgFromSpec('axis y\nray right 1 open')).toMatch(/>y<\/text>/);
    expect(numberLineSvgFromSpec('ray right 1 open')).toMatch(/>x<\/text>/);
  });
});

describe('дробные значения', () => {
  it('parse: дробь в координате позиционируется как число', () => {
    const m = parseNumberLine('domain 0 1\nray right 1/2 open');
    expect(m.bars).toEqual([{ from: 0.5, to: Infinity }]);
    expect(m.points).toEqual([{ x: 0.5, filled: false }]);
  });

  it('подпись дроби сохраняется как «1/2» (не «0,5»)', () => {
    const m = parseNumberLine('point 1/2 fill');
    expect(m.ticks).toEqual([{ x: 0.5, label: '1/2', bold: false }]);
  });

  it('svg рисует дробь стопкой: числитель, черта, знаменатель', () => {
    const svg = numberLineSvgFromSpec('domain 0 1\npoint 1/2 fill');
    // числитель «1» и знаменатель «2» как отдельные text + горизонтальная черта
    expect(svg).toMatch(/>1<\/text>/);
    expect(svg).toMatch(/>2<\/text>/);
    expect(svg).toMatch(/<line[^>]+stroke="#374151"/); // дробная черта
    // холст выше обычного (48), чтобы знаменатель не обрезался
    expect(Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1])).toBeGreaterThan(48);
  });

  it('дробь не налезает на кружок точки', () => {
    const svg = numberLineSvgFromSpec('domain 0 1\npoint 1/2 open');
    const axisY = Number(/<circle[^>]*cy="([\d.]+)"[^>]*r="3\.4"/.exec(svg)[1]);
    const [, numY, numFs] = /<text[^>]*y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>1<\/text>/.exec(svg);
    // верх цифры ≈ базовая линия минус 0,72 кегля; низ кружка ≈ axisY + 4
    const numTop = Number(numY) - 0.72 * Number(numFs);
    expect(numTop).toBeGreaterThan(axisY + 6);
    // знаменатель при этом остаётся внутри холста
    const denY = Number(/<text[^>]*y="([\d.]+)"[^>]*>2<\/text>/.exec(svg)[1]);
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);
    expect(denY).toBeLessThan(height);
  });

  it('отрицательная дробь рисует минус', () => {
    const svg = numberLineSvgFromSpec('domain -1 0\npoint -1/2 fill');
    expect(svg).toContain('>−</text>');
  });

  it('shapesToSpec сохраняет дробный токен координаты', () => {
    const spec = shapesToSpec({ domain: [0, 1], shapes: [{ type: 'point', x: '1/2', filled: true }] });
    expect(spec).toContain('point 1/2 fill');
  });
});

describe('формулы в подписях', () => {
  it('подпись набирается как формула: корень, дробь, индекс', () => {
    const svg = numberLineSvgFromSpec('domain 0 4\ntick 1.41 \\sqrt{2}\ntick 3.14 \\pi');
    expect(svg).toContain('<path'); // знак корня — путь, а не глиф
    expect(svg).toContain('>π</text>');
    expect(svg).toContain('KaTeX_Main'); // шрифт формул, как в условии задачи

    const mark = numberLineSvgFromSpec('scale 0 4 1\nmark A_1 2');
    expect(mark).toContain('>A</text>');
    expect(mark).toContain('>1</text>'); // индекс отдельным фрагментом
  });

  it('обыкновенная дробь «1/2» так и пишется — разворачивается в \\frac сама', () => {
    const svg = numberLineSvgFromSpec('domain 0 1\npoint 1/2 fill');
    const tex = numberLineSvgFromSpec('domain 0 1\npoint 0.5 fill\ntick 0.5 \\frac{1}{2}');
    const bars = (str) => (str.match(/<line/g) || []).length;
    expect(bars(svg)).toBe(bars(tex)); // и там и там дробная черта
  });

  it('флаг bold делает подпись жирной, координата при этом цела', () => {
    const m = parseNumberLine('tick 2 два bold\nmark A 1 bold\naxis t bold');
    expect(m.ticks[0]).toMatchObject({ x: 2, label: 'два', bold: true });
    expect(m.marks[0]).toMatchObject({ x: 1, label: 'A', bold: true });
    expect(m.axisLabel).toBe('t');
    expect(m.axisBold).toBe(true);

    const bare = parseNumberLine('tick 2 bold');
    expect(bare.ticks[0]).toMatchObject({ x: 2, bold: true }); // подпись = само число

    const svg = numberLineSvgFromSpec('domain 0 3\ntick 2 два bold');
    expect(/<text[^>]*font-weight="bold"/.test(svg)).toBe(true);
  });

  it('жирность переживает круг «конструктор → DSL → разбор»', () => {
    const spec = pointsToSpec({
      scale: { from: 0, to: 4, step: 1 },
      marks: [{ label: 'A', x: 1, bold: true }],
      axisLabel: 'x',
    });
    expect(parseNumberLine(spec).marks[0]).toMatchObject({ label: 'A', bold: true });

    const withTick = shapesToSpec({
      domain: [0, 3],
      shapes: [{ type: 'tick', x: '2', label: 'два', bold: true }],
    });
    expect(parseNumberLine(withTick).ticks[0]).toMatchObject({ label: 'два', bold: true });
  });

  it('высокая подпись не вылезает за холст', () => {
    const svg = numberLineSvgFromSpec('domain 0 4\ntick 2 \\frac{\\pi}{2}');
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1]);
    const ys = [...svg.matchAll(/<text[^>]*y="([-\d.]+)"/g)].map((m2) => Number(m2[1]));
    expect(Math.max(...ys)).toBeLessThan(height);
  });
});

describe('точечный тип (scale + mark)', () => {
  it('parse: scale задаёт линейку и домен, mark — помеченную точку', () => {
    const m = parseNumberLine('scale -1 5 1\nmark A 0\nmark B 2');
    expect(m.scale).toEqual({ from: -1, to: 5, step: 1 });
    expect(m.domain).toEqual([-1, 5]);
    expect(m.marks).toEqual([{ x: 0, label: 'A', bold: false }, { x: 2, label: 'B', bold: false }]);
  });

  it('явный domain не перетирается scale', () => {
    const m = parseNumberLine('domain -2 6\nscale -1 5 1');
    expect(m.domain).toEqual([-2, 6]);
  });

  it('svg рисует засечки, числа и буквы точек', () => {
    const svg = numberLineSvgFromSpec('scale -1 1 1\nmark A 0');
    expect(svg).toMatch(/>−1<\/text>/); // минус набирается знаком минуса
    expect(svg).toMatch(/>A<\/text>/);
    expect(svg).toMatch(/<circle[^>]+r="2\.1"/); // помеченная точка (строгий стиль)
  });

  it('pointsToSpec round-trip', () => {
    const spec = pointsToSpec({ scale: { from: -1, to: 5, step: 1 }, marks: [{ label: 'A', x: 0.5 }], axisLabel: 'y' });
    const m = parseNumberLine(spec);
    expect(m.axisLabel).toBe('y');
    expect(m.scale).toEqual({ from: -1, to: 5, step: 1 });
    expect(m.marks).toEqual([{ x: 0.5, label: 'A', bold: false }]);
  });
});

describe('buildNumlineSnippet', () => {
  it('блок — fenced ```numline', () => {
    const s = buildNumlineSnippet('domain 0 2\nray left 1 open', 'block');
    expect(s).toContain('```numline');
    expect(s).toContain('domain 0 2\nray left 1 open');
  });

  it('inline — код `numline: …` с «;» и без переносов (для таблиц)', () => {
    const s = buildNumlineSnippet('domain 0 2\nray left 1 open', 'inline');
    expect(s).toBe('`numline: domain 0 2; ray left 1 open`');
    expect(s).not.toContain('\n');
  });
});

describe('shapesToSpec (round-trip конструктора)', () => {
  it('сериализует и парсит обратно', () => {
    const spec = shapesToSpec({
      domain: [0, 3],
      shapes: [
        { type: 'ray', dir: 'right', x: 1, filled: false },
        { type: 'seg', a: 1, b: 2, ea: false, eb: true },
        { type: 'point', x: 2, filled: true },
      ],
    });
    const m = parseNumberLine(spec);
    expect(m.domain).toEqual([0, 3]);
    expect(m.bars).toContainEqual({ from: 1, to: Infinity });
    expect(m.bars).toContainEqual({ from: 1, to: 2 });
  });
});

describe('nolabels — прямая без подписей координат', () => {
  it('parseNumberLine поднимает флаг и не трогает точки', () => {
    const m = parseNumberLine('domain 0 3\nnolabels\nray right 1 open');
    expect(m.hideLabels).toBe(true);
    expect(m.points).toEqual([{ x: 1, filled: false }]);
    expect(m.ticks).toEqual([{ x: 1, label: '1', bold: false }]);
  });

  it('labels off / labels on', () => {
    expect(parseNumberLine('labels off\npoint 1 fill').hideLabels).toBe(true);
    expect(parseNumberLine('labels on\npoint 1 fill').hideLabels).toBe(false);
  });

  it('«label» остаётся буквой оси, а не переключателем подписей', () => {
    const m = parseNumberLine('label y\npoint 1 fill');
    expect(m.axisLabel).toBe('y');
    expect(m.hideLabels).toBe(false);
  });

  it('SVG без чисел под осью, но с кружком точки и штриховкой', () => {
    const svg = numberLineSvgFromSpec('domain 0 3\nnolabels\nray right 1 open');
    expect(svg).toContain('<circle');
    expect(svg).not.toMatch(/>1<\/text>/);
    // остаётся только буква оси
    expect(svg.match(/<text/g)).toHaveLength(1);
  });

  it('без подписей холст ниже, ось на прежнем уровне', () => {
    const withLabels = numberLineSvgFromSpec('domain 0 3\nray right 1 open');
    const without = numberLineSvgFromSpec('domain 0 3\nnolabels\nray right 1 open');
    expect(withLabels).toContain('viewBox="0 0 260 48"');
    expect(without).toContain('viewBox="0 0 260 36"');
    // AXIS_Y = 28 в обоих случаях
    expect(withLabels).toContain('y1="28"');
    expect(without).toContain('y1="28"');
  });

  it('shapesToSpec пишет nolabels при showLabels=false и молчит по умолчанию', () => {
    const off = shapesToSpec({ domain: [0, 3], shapes: [{ type: 'point', x: '1', filled: true }], showLabels: false });
    expect(off).toContain('nolabels');
    expect(parseNumberLine(off).hideLabels).toBe(true);
    expect(shapesToSpec({ domain: [0, 3], shapes: [] })).not.toContain('nolabels');
  });
});

describe('all — вся прямая заштрихована', () => {
  it('parseNumberLine даёт полосу от −∞ до +∞ без точек', () => {
    const m = parseNumberLine('domain -3 3\nall');
    expect(m.bars).toEqual([{ from: -Infinity, to: Infinity }]);
    expect(m.points).toEqual([]);
    expect(m.ticks).toEqual([]);
  });

  it('SVG: штриховка есть, кружков нет', () => {
    const svg = numberLineSvgFromSpec('domain -3 3\nall');
    expect(svg).not.toContain('<circle');
    // диагонали штриховки — обычные <line>, ось тоже line: штрихов должно быть много
    expect((svg.match(/<line/g) || []).length).toBeGreaterThan(10);
  });

  it('shapesToSpec сериализует фигуру «вся прямая»', () => {
    const spec = shapesToSpec({ domain: [-3, 3], shapes: [{ type: 'all' }] });
    expect(spec).toContain('all');
    expect(parseNumberLine(spec).bars).toEqual([{ from: -Infinity, to: Infinity }]);
  });
});

describe('точки вне видимого диапазона', () => {
  it('точка за границей domain не рисуется и не подписывается', () => {
    const svg = numberLineSvgFromSpec('domain 0 3\npoint 7 fill');
    expect(svg).not.toContain('<circle');
    expect(svg).not.toMatch(/>7<\/text>/);
  });

  it('штриховка луча с началом за границей всё равно видна', () => {
    const svg = numberLineSvgFromSpec('domain 0 3\nray left 7 fill');
    expect(svg).not.toContain('<circle');
    expect((svg.match(/<line/g) || []).length).toBeGreaterThan(10);
  });

  it('точка внутри диапазона рисуется как прежде', () => {
    const svg = numberLineSvgFromSpec('domain 0 3\npoint 2 fill');
    expect(svg).toContain('<circle');
    expect(svg).toMatch(/>2<\/text>/);
  });
});
