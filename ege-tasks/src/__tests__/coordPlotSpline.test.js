import { describe, it, expect } from 'vitest';
import {
  parseCoordPlot, coordPlotSvgFromSpec, plotToSpec, specToPlotState,
  splitPlotCommands, parseSplineNodes, derivativePairSpecs, newCurveState, plotGeometry,
} from '../utils/coordPlot';

const WAVE = '(-5 -3) (-3 2) (0 -1) (3 3) (5,5 -2)';

describe('parseSplineNodes', () => {
  it('скобки, «;» и «, » внутри, десятичная запятая', () => {
    const { nodes, error } = parseSplineNodes('(-3; 2) (0, -1) (1,5 0,5)');
    expect(error).toBeNull();
    expect(nodes).toEqual([{ x: -3, y: 2 }, { x: 0, y: -1 }, { x: 1.5, y: 0.5 }]);
  });

  it('флаги flat и slope внутри скобок', () => {
    const { nodes } = parseSplineNodes('(0 0 flat) (2 1 slope 1/2) (4 3)');
    expect(nodes[0].flat).toBe(true);
    expect(nodes[1].slope).toBe(0.5);
  });

  it('пары чисел без скобок', () => {
    expect(parseSplineNodes('-2 0  0 3  2 0').nodes).toHaveLength(3);
  });

  it('ошибки: нечётное число координат, мусор в скобках, одна точка', () => {
    expect(parseSplineNodes('1 2 3').error).toMatch(/парами/);
    expect(parseSplineNodes('(1 два)').error).toMatch(/Непонятная точка/);
    expect(parseSplineNodes('(1 2)').error).toMatch(/две точки/);
  });
});

describe('splitPlotCommands', () => {
  it('«;» внутри скобок не режет команду', () => {
    expect(splitPlotCommands('x -3 3; spline f (-3; 0) (0; 2) (3; 0); deriv f')).toEqual([
      'x -3 3', ' spline f (-3; 0) (0; 2) (3; 0)', ' deriv f',
    ]);
  });

  it('старые формы разбиваются как раньше', () => {
    expect(splitPlotCommands('x -3 3\ny -1 9;f x^2')).toEqual(['x -3 3', 'y -1 9', 'f x^2']);
  });
});

describe('DSL: кривая-производная (имя со штрихом)', () => {
  const SPEC = "x -5 5\ny -3 3\nspline f' (-4 2) (-2 0) (0 -2) (2 0) (4 2)\nprim f f' -4 1 hide";

  it("spline f' рисуется сам, а f берётся первообразной", () => {
    const m = parseCoordPlot(SPEC);
    expect(m.errors).toEqual([]);
    expect(m.splines["f'"].ok).toBe(true);
    // нарисована одна кривая — сама производная (f спрятана `hide`)
    expect(m.curves.map((c) => c.ref)).toEqual(["f'"]);
    expect(m.curves[0].fn(-2)).toBeCloseTo(0, 9);
  });

  it('разметка ссылается и на f, и на f′, и на f″', () => {
    const m = parseCoordPlot(`${SPEC}\nmark -4 f\nmark 0 f'\nderiv f'`);
    expect(m.errors).toEqual([]);
    expect(m.points.find((p) => p.ref === 'f').y).toBeCloseTo(1, 6); // f(-4) = 1 задано в prim
    expect(m.points.find((p) => p.ref === "f'").y).toBeCloseTo(-2, 9);
    expect(m.curves.some((c) => c.ref === "f''")).toBe(true); // deriv f' = f″
  });

  it("типографский штрих в имени нормализуется: spline f′ = spline f'", () => {
    const m = parseCoordPlot('spline f′ (-1 0) (0 1) (1 0)\nprim f f′');
    expect(m.errors).toEqual([]);
    expect(Object.keys(m.splines)).toEqual(["f'"]);
  });

  it('правка поднимает роль обратно: кривая f′ + первообразная f', () => {
    const st = specToPlotState(SPEC);
    expect(st.splines).toHaveLength(1);
    expect(st.splines[0].name).toBe("f'");
    expect(st.splines[0].prim).toMatchObject({ on: true, show: false, name: 'f', x0: '-4', y0: '1' });
    expect(plotToSpec(st)).toContain("prim f f' -4 1");
    expect(st.raw).toEqual([]);
  });
});

describe('DSL: spline / deriv / prim', () => {
  it('spline рисует кривую по области точек', () => {
    const m = parseCoordPlot(`x -6 6\ny -4 4\nspline f ${WAVE} color blue bold`);
    expect(m.errors).toEqual([]);
    const c = m.curves[0];
    expect(c.ref).toBe('f');
    expect([c.from, c.to]).toEqual([-5, 5.5]);
    expect(c.fn(-3)).toBeCloseTo(2, 10);
    expect(c.bold).toBe(true);
    expect(m.splines.f.ok).toBe(true);
  });

  it('имя по умолчанию — f', () => {
    const m = parseCoordPlot(`spline ${WAVE}\nderiv f`);
    expect(m.errors).toEqual([]);
    expect(m.curves).toHaveLength(2);
  });

  it('deriv рисует f′, даже если стоит выше spline', () => {
    const m = parseCoordPlot(`deriv f color green\nspline f ${WAVE} hide`);
    expect(m.errors).toEqual([]);
    expect(m.curves).toHaveLength(1);
    expect(m.curves[0].ref).toBe("f'");
    expect(m.curves[0].fn(-3)).toBeCloseTo(0, 10);
    expect(m.curves[0].fn(-4)).toBeGreaterThan(0);
  });

  it('штрих любым символом: f′, f’', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\ndrop -4 f′\nmark -4 f’`);
    expect(m.errors).toEqual([]);
    expect(m.segments[0].y2).toBeCloseTo(m.splines.f.df(-4), 10);
  });

  it('prim — первообразная через заданную точку', () => {
    const m = parseCoordPlot(`spline f ${WAVE} hide\nprim F f 0 1 color violet`);
    const F = m.curves[0];
    expect(F.ref).toBe('F');
    expect(F.fn(0)).toBeCloseTo(1, 10);
    const e = 1e-5;
    expect((F.fn(1 + e) - F.fn(1 - e)) / (2 * e)).toBeCloseTo(m.splines.f.f(1), 5);
  });

  it('F′ = f: выноска к производной первообразной ведёт к f', () => {
    const m = parseCoordPlot(`spline f ${WAVE} hide\nprim F f hide\nmark 1 F'`);
    expect(m.points[0].y).toBeCloseTo(m.splines.f.f(1), 10);
  });

  it('tangent — прямая с наклоном f′(x₀) через точку графика', () => {
    const m = parseCoordPlot('spline f (-2 -2) (1 3) (3 1 slope -1) (5 -1) (7 3.5)\ntangent 3 f');
    const t = m.curves[1];
    expect(t.slope).toBeCloseTo(-1, 12);
    expect(t.fn(2)).toBeCloseTo(2, 12);
    expect(t.fn(4)).toBeCloseTo(0, 12);
  });

  it('ошибки: неизвестная кривая, битые точки, точка касания вне кривой', () => {
    const m = parseCoordPlot('deriv g\nspline h (1 2)\nspline f (0 0) (1 1)\ntangent 9 f');
    expect(m.errors).toContain('Не найдена кривая «g'.concat("'»"));
    expect(m.errors.some((e) => /Кривая h/.test(e))).toBe(true);
    expect(m.errors.some((e) => /вне кривой/.test(e))).toBe(true);
    expect(m.curves.filter((c) => c.fn)).toHaveLength(1);
  });

  it('prim без имён — внятная ошибка', () => {
    expect(parseCoordPlot('prim 0 1').errors[0]).toMatch(/prim F f/);
  });
});

describe('DSL: drop / mark / band', () => {
  it('drop — пунктир от оси до графика, solid — сплошной', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\ndrop -3 f\ndrop 3 f solid color red`);
    expect(m.segments[0]).toMatchObject({ x1: -3, y1: 0, x2: -3, dash: true, thin: true });
    expect(m.segments[0].y2).toBeCloseTo(2, 10);
    expect(m.segments[1]).toMatchObject({ dash: false, color: 'red' });
  });

  it('mark — точка на графике, open — пустая', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\nmark 0 f open`);
    expect(m.points[0]).toMatchObject({ x: 0, style: 'open' });
    expect(m.points[0].y).toBeCloseTo(-1, 10);
  });

  it('mark вне области кривой не рисуется', () => {
    expect(parseCoordPlot(`spline f ${WAVE}\nmark 9 f`).points).toEqual([]);
  });

  it('part — кусок кривой другим цветом поверх неё', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\npart f -3 0 color green bold\npart f 0 3 color red`);
    expect(m.curves).toHaveLength(3);
    // Куски идут ПОСЛЕ самой кривой — значит, рисуются поверх неё.
    expect(m.curves[1]).toMatchObject({ ref: 'f', from: -3, to: 0, color: 'green', bold: true });
    expect(m.curves[2]).toMatchObject({ ref: 'f', from: 0, to: 3, color: 'red', bold: false });
    expect(typeof m.curves[1].fn).toBe('function');
    expect(m.errors).toEqual([]);
  });

  it('part: границы можно писать и модификатором from…to, порядок не важен', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\npart f from 2 to -1`);
    expect(m.curves[1]).toMatchObject({ from: -1, to: 2, color: 'red' });
  });

  it('part к несуществующей кривой — понятная ошибка', () => {
    const m = parseCoordPlot(`spline f ${WAVE}\npart g -1 1`);
    expect(m.errors).toContain('Не найдена кривая «g»');
  });

  it('part переживает круг «DSL → конструктор → DSL»', () => {
    const spec = `x -6 6\ny -4 4\nspline f ${WAVE}\npart f' -3 0 color green bold`;
    const st = specToPlotState(spec);
    expect(st.annotations).toEqual([
      { type: 'part', ref: "f'", a: -3, b: 0, color: 'green', bold: true, dash: false },
    ]);
    expect(plotToSpec(st)).toContain("part f' -3 0 color green bold");
    expect(st.raw).toEqual([]);
  });

  it('видимая часть кривой: границу можно задать с одной стороны', () => {
    const m = parseCoordPlot(`spline f ${WAVE} from -2`);
    expect(m.curves[0].from).toBeCloseTo(-2, 10);
    expect(m.curves[0].to).toBeCloseTo(5.5, 10); // правый край взят по области кривой
    expect(plotToSpec(specToPlotState(`spline f ${WAVE} to 2`))).toContain('to 2');
  });

  it('band — красный отрезок по оси x, обрезанный окном', () => {
    const m = parseCoordPlot('x -4 4\nband 3 -9');
    expect(m.bands).toEqual([{ a: -9, b: 3, color: 'red' }]);
    const svg = coordPlotSvgFromSpec('x -4 4\ny -2 2\nband 3 -9');
    expect(svg).toMatch(/stroke="#b3403a" stroke-width="2\.6"/);
  });
});

describe('рендер и конструктор', () => {
  const SPEC = [
    'x -6 6', 'y -4 4', 'grid off',
    'f x/2 color gray bold',
    `spline f ${WAVE} hide`,
    'deriv f color green bold',
    'band -3 3',
    "drop -3 f'",
    "mark 0 f' color red",
    'point 1 1 fill',
  ].join('\n');

  it('SVG без <defs> и url(#…) — проходит DOMPurify и печать', () => {
    const svg = coordPlotSvgFromSpec(SPEC);
    expect(svg).not.toMatch(/<defs|url\(#/);
    expect((svg.match(/stroke-width="2\.4"/g) || []).length).toBe(2);
    expect(svg).toMatch(/stroke-dasharray="4 3"/);
  });

  it('inline-форма с «;» и точками «(x; y)»', () => {
    const m = parseCoordPlot('x -4 4; spline f (-3; 0) (0; 2) (3; 0); deriv f; band -3 3');
    expect(m.errors).toEqual([]);
    expect(m.curves).toHaveLength(2);
    expect(m.bands).toHaveLength(1);
  });

  it('подпись со словом bold остаётся текстом', () => {
    const m = parseCoordPlot('label 1 1 bold text');
    expect(m.labels[0].text).toBe('bold text');
  });

  it('правка в конструкторе не превращает кривые по точкам в формулы', () => {
    const st = specToPlotState(SPEC);
    expect(st.curves).toEqual([
      { expr: 'x/2', color: 'gray', dash: false, bold: true, from: '', to: '' },
    ]);
    expect(st.points).toHaveLength(1); // mark — не точка конструктора
    expect(st.raw).toEqual([]);
    expect(st.splines).toHaveLength(1);
    expect(st.annotations.map((a) => a.type)).toEqual(['band', 'drop', 'mark']);
    const again = parseCoordPlot(plotToSpec(st));
    const before = parseCoordPlot(SPEC);
    expect(again.curves.map((c) => c.ref || c.expr)).toEqual(before.curves.map((c) => c.ref || c.expr));
    expect(again.points).toHaveLength(before.points.length);
    expect(again.segments).toHaveLength(before.segments.length);
    expect(again.curves[1].fn(2)).toBeCloseTo(before.curves[1].fn(2), 12);
  });
});

describe('конструктор: кривые по точкам ↔ DSL', () => {
  it('кривая, производная и первообразная со стилями переживают круг', () => {
    const spec = [
      'x -6 6', 'y -4 4',
      'spline g (-5 -3) (-3 2 slope 0) (0 -1) (2 1 flat) (5,5 -2) color blue bold',
      'deriv g color green dash',
      'prim G g 0 1 color violet hide',
      'tangent 1 g from -2 to 4',
      'drop -3 g solid',
      'mark 0 g\' open color red',
      'band -3 3 color orange',
    ].join('\n');
    const st = specToPlotState(spec);
    const [g] = st.splines;
    expect(g).toMatchObject({ name: 'g', show: true, color: 'blue', bold: true, dash: false });
    expect(g.nodes[4]).toMatchObject({ x: 5.5, y: -2 });
    expect(g.nodes[3].flat).toBe(true);
    expect(g.deriv).toMatchObject({ on: true, color: 'green', dash: true, bold: false });
    expect(g.prim).toMatchObject({ on: true, show: false, name: 'G', x0: '0', y0: '1', color: 'violet' });
    expect(st.annotations).toEqual([
      { type: 'tangent', x: 1, ref: 'g', color: 'ink', bold: false, dash: false, from: '-2', to: '4' },
      { type: 'drop', x: -3, ref: 'g', color: 'ink', solid: true, style: 'fill', size: 'normal' },
      { type: 'mark', x: 0, ref: "g'", color: 'red', solid: false, style: 'open', size: 'normal' },
      { type: 'band', a: -3, b: 3, color: 'orange' },
    ]);
    const out = plotToSpec(st);
    expect(out).toContain('spline g (-5 -3) (-3 2 slope 0) (0 -1) (2 1 flat) (5.5 -2) color blue bold');
    expect(out).toContain('deriv g color green dash');
    expect(out).toContain('prim G g 0 1 color violet hide');
    expect(out).toContain('tangent 1 g from -2 to 4');
    expect(out).toContain('drop -3 g solid');
    expect(out).toContain("mark 0 g' color red open");
    expect(out).toContain('band -3 3 color orange');
    expect(specToPlotState(out)).toEqual(st);
  });

  it('чего конструктор не выразит — остаётся строкой', () => {
    const st = specToPlotState('spline f (0 0) (1 1)\nderiv q\nspline h (1 2)\nprim F f\nprim H f');
    expect(st.splines.map((c) => c.name)).toEqual(['f']);
    expect(st.splines[0].prim.name).toBe('F');
    expect(st.raw).toEqual(['deriv q', 'spline h (1 2)', 'prim H f']);
  });

  it('точки пишутся по возрастанию x, пустые отбрасываются', () => {
    const out = plotToSpec({
      splines: [{ ...newCurveState('f', [{ x: 2, y: 1 }, { x: null, y: 3 }, { x: -1, y: 0 }]) }],
    });
    expect(out).toContain('spline f (-1 0) (2 1)');
  });
});

describe('derivativePairSpecs — «f′ и f рядом»', () => {
  const state = specToPlotState([
    'x -6 5', 'y -4 4', 'grid off',
    'spline f (-5.5 -3) (-1 2.6) (3.8 -3) color blue bold',
    'band -1 3', 'drop -1 f', 'mark -1 f', 'tangent 2 f',
    'point -1 0 fill', 'label -1 0 a at s',
  ].join('\n'));
  const pair = derivativePairSpecs(state, 0);

  it('справа — кривая с касательной, без производной', () => {
    const m = parseCoordPlot(pair.right);
    expect(m.curves.map((c) => c.ref)).toEqual(['f', 'f']);
    expect(m.curves[1].tangentAt).toBe(2);
    expect(m.bands).toHaveLength(1);
  });

  it('слева — f′ в своём окне по Y, выноски переехали к f′', () => {
    const m = parseCoordPlot(pair.left);
    expect(m.errors).toEqual([]);
    expect(m.curves.map((c) => c.ref)).toEqual(["f'"]);
    expect(m.curves[0].color).toBe('blue');
    expect(m.segments[0].y2).toBeCloseTo(0, 9); // f′(−1) = 0 — экстремум
    expect(m.points.map((p) => p.ref || 'point')).toEqual(['point', "f'"]);
    expect(m.labels).toHaveLength(1);
    const s = m.splines.f;
    for (const x of [-5.5, -1, 3.8]) {
      const v = s.df(x);
      expect(v).toBeGreaterThanOrEqual(m.yrange[0]);
      expect(v).toBeLessThanOrEqual(m.yrange[1]);
    }
    expect(m.yrange[0]).toBeLessThan(0);
    expect(m.yrange[1]).toBeGreaterThan(0);
  });

  it('нет кривой — null', () => {
    expect(derivativePairSpecs({ splines: [] }, 0)).toBeNull();
  });
});

describe('plotGeometry', () => {
  it('fromScreen обратна sx/sy', () => {
    const g = plotGeometry(parseCoordPlot('x -6 5\ny -4 4'), { width: 560, maxHeight: 420 });
    const p = g.fromScreen(g.sx(1.5), g.sy(-2));
    expect(p.x).toBeCloseTo(1.5, 9);
    expect(p.y).toBeCloseTo(-2, 9);
    expect(coordPlotSvgFromSpec('x -6 5\ny -4 4', { width: 560, maxHeight: 420 }))
      .toContain(`viewBox="0 0 ${g.W} ${g.H}"`);
  });
});
