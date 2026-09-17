import { describe, it, expect } from 'vitest';
import {
  buildSpline, antiderivative, splineZeros, splineAnalysis,
} from '../utils/splineCurve';

const pts = (arr) => arr.map(([x, y, extra]) => ({ x, y, ...(extra || {}) }));
const grid = (a, b, n = 400) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);

// Детерминированный ГПСЧ — случайные наборы точек воспроизводимы.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Внутри каждого куска f′ не меняет знак приращения — кривая монотонна.
function monotoneViolations(s) {
  let bad = 0;
  for (let i = 0; i < s.nodes.length - 1; i += 1) {
    const p = s.nodes[i]; const q = s.nodes[i + 1];
    const dir = Math.sign(q.y - p.y);
    for (const x of grid(p.x, q.x, 200).slice(1, -1)) {
      const v = s.df(x);
      if (dir === 0 ? Math.abs(v) > 1e-9 : Math.sign(v) !== dir) bad += 1;
    }
  }
  return bad;
}

const WAVE = pts([[-5, -3], [-3, 2], [0, -1], [3, 3], [5.5, -2]]);

describe('buildSpline — кривая по точкам', () => {
  it('проходит через все опорные точки', () => {
    const s = buildSpline(WAVE);
    expect(s.ok).toBe(true);
    for (const p of WAVE) expect(s.f(p.x)).toBeCloseTo(p.y, 10);
    expect(s.domain).toEqual([-5, 5.5]);
  });

  it('точки можно передавать в любом порядке', () => {
    const s = buildSpline([...WAVE].reverse());
    expect(s.nodes.map((p) => p.x)).toEqual([-5, -3, 0, 3, 5.5]);
  });

  it('экстремумы ровно в заданных точках: f′ = 0 и меняет знак', () => {
    const s = buildSpline(WAVE);
    expect(s.nodes.map((p) => p.kind)).toEqual(['end', 'max', 'min', 'max', 'end']);
    for (const x of [-3, 0, 3]) {
      expect(s.df(x)).toBeCloseTo(0, 12);
    }
    expect(s.df(-3.01)).toBeGreaterThan(0);
    expect(s.df(-2.99)).toBeLessThan(0);
    expect(s.df(-0.01)).toBeLessThan(0);
    expect(s.df(0.01)).toBeGreaterThan(0);
  });

  it('между соседними точками монотонна — лишних горбов нет', () => {
    expect(monotoneViolations(buildSpline(WAVE))).toBe(0);
  });

  it('f′ и f″ непрерывны в узлах — у графика производной нет изломов', () => {
    const s = buildSpline(WAVE);
    for (const p of s.nodes.slice(1, -1)) {
      expect(Math.abs(s.df(p.x - 1e-7) - s.df(p.x + 1e-7))).toBeLessThan(1e-5);
      expect(Math.abs(s.d2f(p.x - 1e-7) - s.d2f(p.x + 1e-7))).toBeLessThan(1e-4);
    }
  });

  it('df, d2f и integral согласованы с f', () => {
    const s = buildSpline(WAVE);
    const e = 1e-5;
    for (const x of grid(-4.9, 5.4, 60)) {
      expect((s.f(x + e) - s.f(x - e)) / (2 * e)).toBeCloseTo(s.df(x), 5);
      expect((s.df(x + e) - s.df(x - e)) / (2 * e)).toBeCloseTo(s.d2f(x), 3);
      expect((s.integral(x + e) - s.integral(x - e)) / (2 * e)).toBeCloseTo(s.f(x), 5);
    }
    expect(s.integral(-5)).toBe(0);
  });

  it('у экстремума f″ ненулевая — f′ пересекает ось, а не касается', () => {
    const s = buildSpline(WAVE);
    expect(s.d2f(-3)).toBeLessThan(-0.1);
    expect(s.d2f(0)).toBeGreaterThan(0.1);
  });

  it('прямая остаётся прямой', () => {
    const s = buildSpline(pts([[-4, -2], [-1, -0.5], [2, 1], [6, 3]]));
    for (const x of grid(-4, 6, 50)) expect(s.df(x)).toBeCloseTo(0.5, 9);
  });

  it('три точки параболы дают ту же параболу', () => {
    const s = buildSpline(pts([[-2, -4], [0, 0], [2, -4]]));
    for (const x of grid(-2, 2, 40)) expect(s.f(x)).toBeCloseTo(-x * x, 9);
  });

  it('проходная точка на оси: f′ там не ноль (нет ложного «плеча»)', () => {
    // график производной из задачи ЕГЭ: нули в −5, −1, 3 — пересечения
    const g = buildSpline(pts([[-7, 3], [-5, 0], [-3, -2], [-1, 0], [1, 2.5], [3, 0], [5, -2.5]]));
    for (const x of [-5, -1, 3]) expect(Math.abs(g.df(x))).toBeGreaterThan(0.5);
  });

  it('flat — f′ = 0 без смены знака', () => {
    const s = buildSpline(pts([[-3, -3], [0, 0, { flat: true }], [3, 3]]));
    expect(s.nodes[1].kind).toBe('flat');
    expect(s.df(0)).toBeCloseTo(0, 12);
    expect(s.df(-0.5)).toBeGreaterThan(0);
    expect(s.df(0.5)).toBeGreaterThan(0);
    expect(monotoneViolations(s)).toBe(0);
  });

  it('slope — касательная с заданным наклоном', () => {
    const s = buildSpline(pts([[-2, -2], [1, 3], [3, 1, { slope: -1 }], [5, -1], [7, 3.5]]));
    expect(s.df(3)).toBeCloseTo(-1, 12);
    expect(s.warning).toBeNull();
    expect(monotoneViolations(s)).toBe(0);
  });

  it('flat в экстремуме игнорируется — там и так f′ = 0', () => {
    const s = buildSpline(pts([[-2, 0], [0, 2, { flat: true }], [2, 0]]));
    expect(s.nodes[1].kind).toBe('max');
  });

  it('две точки — отрезок прямой', () => {
    const s = buildSpline(pts([[0, 1], [2, 5]]));
    expect(s.f(1)).toBeCloseTo(3, 12);
    expect(s.df(0.3)).toBeCloseTo(2, 12);
  });

  it('полка: одинаковые y — горизонтальный участок', () => {
    const s = buildSpline(pts([[-3, 0], [-1, 2], [1, 2], [3, 0]]));
    for (const x of grid(-1, 1, 20)) {
      expect(s.f(x)).toBeCloseTo(2, 9);
      expect(s.df(x)).toBeCloseTo(0, 9);
    }
    expect(monotoneViolations(s)).toBe(0);
  });

  it('вне области — NaN', () => {
    const s = buildSpline(WAVE);
    expect(s.f(-6)).toBeNaN();
    expect(s.df(6)).toBeNaN();
  });

  it('ошибки: меньше двух точек, одинаковый x', () => {
    expect(buildSpline(pts([[0, 0]])).error).toMatch(/две точки/);
    expect(buildSpline(pts([[0, 0], [0, 1], [2, 2]])).error).toMatch(/одинаковым x/);
    expect(buildSpline(null).ok).toBe(false);
  });

  it('случайные наборы точек: через точки, монотонно, f′ без изломов', () => {
    const rand = rng(20260917);
    for (let t = 0; t < 150; t += 1) {
      const n = 3 + Math.floor(rand() * 6);
      const nodes = [];
      let x = -8;
      for (let i = 0; i < n; i += 1) {
        x += 0.3 + rand() * 3;
        nodes.push({ x: Math.round(x * 10) / 10, y: Math.round((rand() * 10 - 5) * 10) / 10 });
      }
      const s = buildSpline(nodes);
      expect(s.ok).toBe(true);
      for (const p of nodes) expect(s.f(p.x)).toBeCloseTo(p.y, 8);
      expect(monotoneViolations(s)).toBe(0);
      for (const p of s.nodes.slice(1, -1)) {
        const scale = 1 + Math.abs(s.d2f(p.x));
        expect(Math.abs(s.d2f(p.x - 1e-7) - s.d2f(p.x + 1e-7)) / scale).toBeLessThan(1e-3);
      }
    }
  });
});

describe('antiderivative — первообразная', () => {
  it('F′ = f и F(x0) = y0', () => {
    const s = buildSpline(WAVE);
    const { fn, dfn } = antiderivative(s, 0, 1);
    expect(fn(0)).toBeCloseTo(1, 12);
    const e = 1e-5;
    for (const x of grid(-4.9, 5.4, 30)) {
      expect((fn(x + e) - fn(x - e)) / (2 * e)).toBeCloseTo(s.f(x), 5);
      expect(dfn(x)).toBe(s.f(x));
    }
  });

  it('без точки — F(левый край) = 0', () => {
    const s = buildSpline(WAVE);
    expect(antiderivative(s).fn(-5)).toBe(0);
  });

  it('у кривой с ошибкой — NaN', () => {
    expect(antiderivative(buildSpline([])).fn(0)).toBeNaN();
  });
});

describe('splineZeros — нули кривой', () => {
  it('пересечения между точками и в точках, с направлением смены знака', () => {
    const g = buildSpline(pts([[-7, 3], [-5, 0], [-3, -2], [-1, 0], [1, 2.5], [3, 0], [5, -2.5]]));
    const zs = splineZeros(g);
    expect(zs.map((z) => [z.x, z.type])).toEqual([[-5, 'down'], [-1, 'up'], [3, 'down']]);
  });

  it('корень внутри куска находится бисекцией', () => {
    const s = buildSpline(pts([[-2, -1], [0, 3], [2, -1]]));
    const zs = splineZeros(s);
    expect(zs).toHaveLength(2);
    for (const z of zs) expect(s.f(z.x)).toBeCloseTo(0, 6);
    expect(zs.map((z) => z.type)).toEqual(['up', 'down']);
  });

  it('касание оси в экстремуме — touch; на краю — atEdge', () => {
    const s = buildSpline(pts([[-2, 0], [0, 2], [2, 0], [4, 2]]));
    const zs = splineZeros(s);
    expect(zs.map((z) => [z.x, z.type, z.atEdge])).toEqual([
      [-2, 'touch', true], [2, 'touch', false],
    ]);
  });
});

describe('splineAnalysis — что читается по графику', () => {
  it('экстремумы и промежутки монотонности', () => {
    const an = splineAnalysis(buildSpline(WAVE));
    expect(an.maxima).toEqual([{ x: -3, y: 2 }, { x: 3, y: 3 }]);
    expect(an.minima).toEqual([{ x: 0, y: -1 }]);
    expect(an.increasing).toEqual([[-5, -3], [0, 3]]);
    expect(an.decreasing).toEqual([[-3, 0], [3, 5.5]]);
  });

  it('стационарная точка без экстремума не рвёт промежуток возрастания', () => {
    const an = splineAnalysis(buildSpline(pts([[-3, -3], [0, 0, { flat: true }], [3, 3]])));
    expect(an.stationary).toEqual([{ x: 0, y: 0 }]);
    expect(an.maxima).toEqual([]);
    expect(an.increasing).toEqual([[-3, 3]]);
  });

  it('у кривой с ошибкой — пусто', () => {
    expect(splineAnalysis(buildSpline([])).maxima).toEqual([]);
  });
});
