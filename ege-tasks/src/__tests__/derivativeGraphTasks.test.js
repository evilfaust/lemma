import { describe, it, expect } from 'vitest';
import {
  makeGraphTask, generateGraphVariants, GRAPH_CATEGORIES,
  CATEGORY_LABELS_GRAPH, DEFAULT_SETTINGS_GRAPH,
} from '../utils/derivativeGraphTasks';
import { parseCoordPlot } from '../utils/coordPlot';

// Независимая проверка ответа: считаем всё численно по КАРТИНКЕ (разобранной
// из DSL задания), а не по внутренней модели генератора.
function sampleCurve(task, spec = task.plot) {
  const m = parseCoordPlot(spec);
  expect(m.errors).toEqual([]);
  const name = Object.keys(m.splines)[0];
  const s = m.splines[name];
  const [a, b] = s.domain;
  const N = 4000;
  const xs = Array.from({ length: N + 1 }, (_, i) => a + ((b - a) * i) / N);
  return { s, a, b, xs, name };
}

// Количество смен знака f′ по мелкой сетке: «+ → −» это максимум.
function countTurns({ s, xs }, from, to) {
  let turns = 0;
  let prev = 0;
  for (const x of xs) {
    const v = s.df(x);
    const sg = v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0;
    if (!sg) continue;
    if (prev && sg !== prev) {
      if (prev > 0 && sg < 0 && (from === 'max' || from === 'any')) turns += 1;
      if (prev < 0 && sg > 0 && (from === 'min' || from === 'any')) turns += 1;
    }
    prev = sg;
  }
  return turns;
}

const tasksFor = (cat, n = 12) => Array.from({ length: n }, () => makeGraphTask(cat)).filter(Boolean);

describe('derivativeGraphTasks — каждая категория работает', () => {
  it.each(GRAPH_CATEGORIES)('%s даёт задания с чертежом, условием и числовым ответом', (cat) => {
    const list = tasksFor(cat, 20);
    expect(list.length).toBeGreaterThan(8); // не «раз в сто попыток»
    for (const t of list) {
      expect(t.cat).toBe(cat);
      expect(t.question.length).toBeGreaterThan(30);
      expect(Number.isFinite(t.answerValue)).toBe(true);
      // ключ учителя печатается KaTeX: десятичная запятая — в скобках
      expect(t.resultLatex).toBe(String(t.answerValue).replace('.', '{,}'));
      // у задания либо один чертёж, либо набор (соответствие «графики ↔ …»)
      const specs = t.plots || [t.plot];
      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) {
        // кривая задана точками (spline) либо формулой (прямые задания «↔ k»)
        expect(spec).toMatch(/^(spline|f) /m);
        expect(parseCoordPlot(spec).errors).toEqual([]); // чертёж строится без ошибок
      }
    }
    expect(CATEGORY_LABELS_GRAPH[cat]).toBeTruthy();
  });
});

describe('ответы сверены с картинкой', () => {
  it('точки максимума/минимума на графике f', () => {
    for (const t of tasksFor('f_max_count', 12)) {
      expect(t.answerValue).toBe(countTurns(sampleCurve(t), 'max'));
    }
    for (const t of tasksFor('f_min_count', 12)) {
      expect(t.answerValue).toBe(countTurns(sampleCurve(t), 'min'));
    }
  });

  it('целые точки, где f′ > 0', () => {
    for (const t of tasksFor('f_deriv_pos_int', 12)) {
      const { s, a, b } = sampleCurve(t);
      let n = 0;
      // функция задана на ИНТЕРВАЛЕ — концы не в счёт
      for (let k = Math.floor(a) + 1; k <= Math.ceil(b) - 1; k += 1) if (s.df(k) > 1e-6) n += 1;
      expect(t.answerValue).toBe(n);
    }
  });

  it('по графику f′: точки максимума f — это «+ → −» самой кривой', () => {
    for (const t of tasksFor('d_max_count', 12)) {
      const { s, xs } = sampleCurve(t);
      let n = 0;
      let prev = 0;
      for (const x of xs) {
        const v = s.f(x);
        const sg = v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0;
        if (!sg) continue;
        if (prev > 0 && sg < 0) n += 1;
        prev = sg;
      }
      expect(t.answerValue).toBe(n);
    }
  });

  it('по графику f′: целые точки возрастания f — там, где кривая выше оси', () => {
    for (const t of tasksFor('d_increase_int', 12)) {
      const { s, a, b } = sampleCurve(t);
      let n = 0;
      for (let k = Math.floor(a) + 1; k <= Math.ceil(b) - 1; k += 1) if (s.f(k) > 1e-6) n += 1;
      expect(t.answerValue).toBe(n);
    }
  });

  it('f′(x₀) по касательной: наклон совпадает с производной в точке', () => {
    for (const t of tasksFor('f_tangent_slope', 12)) {
      const { s } = sampleCurve(t);
      const x0 = Number(/x_0 = (−?-?[\d,.]+)/.exec(t.question)[1].replace('−', '-').replace(',', '.'));
      expect(s.df(x0)).toBeCloseTo(t.answerValue, 6);
    }
  });

  it('площадь по графику первообразной = F(b) − F(a)', () => {
    for (const t of tasksFor('p_area', 12)) {
      const { s } = sampleCurve(t);
      const nums = [...t.question.matchAll(/x = (−?-?[\d,.]+)/g)]
        .map((mm) => Number(mm[1].replace('−', '-').replace(',', '.')));
      expect(nums).toHaveLength(2);
      expect(s.f(nums[1]) - s.f(nums[0])).toBeCloseTo(t.answerValue, 6);
      // площадь считается там, где f = F′ ⩾ 0 — иначе разность не площадь
      expect(s.df((nums[0] + nums[1]) / 2)).toBeGreaterThan(0);
    }
  });
});

describe('соответствие «точка ↔ значение производной»', () => {
  // Значение из списка («-\\frac{2}{3}», «0{,}5», «-4») → число
  const texToNumber = (tex) => {
    const frac = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(tex);
    if (frac) return (frac[1] ? -1 : 1) * (Number(frac[2]) / Number(frac[3]));
    return Number(tex.replace('{,}', '.'));
  };

  it('каждая касательная нарисована в подписанной точке, ответ сходится с наклоном', () => {
    const list = tasksFor('f_tangent_match', 12);
    expect(list.length).toBeGreaterThan(8);

    for (const t of list) {
      const { s } = sampleCurve(t);
      expect(t.matching.points).toEqual(['K', 'L', 'M', 'N']);
      expect(t.matching.values).toHaveLength(4);
      // все значения различны — иначе соответствие неоднозначно
      expect(new Set(t.matching.values).size).toBe(4);
      expect(t.resultLatex).toMatch(/^[1-4]{4}$/);
      // ответ — перестановка: каждое значение использовано ровно раз
      expect([...t.resultLatex].sort().join('')).toBe('1234');

      // абсциссы точек берём из самого чертежа: подпись xtick и касательная
      const ticks = [...t.plot.matchAll(/^xtick (-?[\d.]+) ([KLMN])(?: bold)?$/gm)]
        .map((m) => ({ x: Number(m[1]), name: m[2] }));
      expect(ticks.map((p) => p.name)).toEqual(['K', 'L', 'M', 'N']);
      for (const p of ticks) {
        expect(t.plot).toContain(`tangent ${p.x} f`);
        expect(t.plot).toContain(`drop ${p.x} f`);
      }
      // точки идут слева направо
      const xs = ticks.map((p) => p.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);

      // и главное: цифра ответа указывает на значение, равное f′ в этой точке
      [...t.resultLatex].forEach((digit, i) => {
        const expected = texToNumber(t.matching.values[Number(digit) - 1]);
        expect(s.df(ticks[i].x)).toBeCloseTo(expected, 6);
      });
    }
  });

  it('в экспорте .md списки идут таблицей, а ответ — четырьмя цифрами', async () => {
    const { buildSheetMarkdown } = await import('../utils/sheetMarkdown');
    const task = tasksFor('f_tangent_match', 20)[0];
    const md = buildSheetMarkdown({
      generator: 'graph_derivative',
      title: 'Соответствие',
      tasksData: [[task]],
      layout: [],
    }, { format: 'work' });
    expect(md).toContain('| ТОЧКИ | ЗНАЧЕНИЯ ПРОИЗВОДНОЙ |');
    expect(md).toContain('| А) K |');
    expect(md).toContain('```plot');
    expect(md).toContain(`ответ: ${task.resultLatex}`);
  });
});

describe('соответствие «точка ↔ характеристика функции и производной»', () => {
  it('в каждой подписанной точке знаки f и f′ совпадают с выбранной характеристикой', () => {
    const list = tasksFor('f_sign_match', 12);
    expect(list.length).toBeGreaterThan(8);

    for (const t of list) {
      const { s } = sampleCurve(t);
      expect(t.matching.points).toEqual(['K', 'L', 'M', 'N']);
      expect(new Set(t.matching.values).size).toBe(4); // характеристики разные
      expect([...t.resultLatex].sort().join('')).toBe('1234');

      const ticks = [...t.plot.matchAll(/^xtick (-?[\d.]+) ([KLMN]) bold$/gm)]
        .map((m) => ({ x: Number(m[1]), name: m[2] }));
      expect(ticks.map((p) => p.name)).toEqual(['K', 'L', 'M', 'N']);
      const xs = ticks.map((p) => p.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);

      [...t.resultLatex].forEach((digit, i) => {
        const text = t.matching.values[Number(digit) - 1];
        const y = s.f(ticks[i].x);
        const d = s.df(ticks[i].x);
        // знак функции
        expect(y > 0).toBe(text.startsWith('функция положительна'));
        // знак производной
        if (text.endsWith('производная равна нулю')) expect(Math.abs(d)).toBeLessThan(1e-6);
        else if (text.endsWith('производная положительна')) expect(d).toBeGreaterThan(0);
        else expect(d).toBeLessThan(0);
      });
    }
  });
});

describe('соответствие «график ↔ характеристика на отрезке [−1; 1]»', () => {
  // Что кривая делает на [−1; 1] — читаем по самому чертежу
  const readSegment = (spec) => {
    const { s } = sampleCurve(null, spec);
    const N = 400;
    const at = (i) => -1 + (2 * i) / N;
    let pos = 0;
    let neg = 0;
    let turns = 0;
    let prev = 0;
    for (let i = 0; i <= N; i += 1) {
      const d = s.df(at(i));
      const sg = d > 1e-6 ? 1 : d < -1e-6 ? -1 : 0;
      if (sg > 0) pos += 1;
      if (sg < 0) neg += 1;
      if (sg && prev && sg !== prev) turns += 1;
      if (sg) prev = sg;
    }
    if (turns === 1) return pos && neg ? (s.df(-0.9) > 0 ? 'max' : 'min') : null;
    if (turns) return null;
    if (pos && !neg) return 'inc';
    if (neg && !pos) return 'dec';
    return null;
  };

  it('каждый из четырёх графиков делает ровно то, на что указывает ответ', () => {
    const list = tasksFor('b_char_match', 12);
    expect(list.length).toBeGreaterThan(8);

    const EXPECTED = {
      max: 'У функции есть точка максимума',
      min: 'У функции есть точка минимума',
      inc: 'Функция возрастает',
      dec: 'Функция убывает',
    };
    for (const t of list) {
      expect(t.plots).toHaveLength(4);
      expect(t.plot).toBeUndefined();
      expect(new Set(t.matching.values).size).toBe(4);
      expect([...t.resultLatex].sort().join('')).toBe('1234');

      [...t.resultLatex].forEach((digit, i) => {
        const kind = readSegment(t.plots[i]);
        expect(kind).toBeTruthy();
        expect(t.matching.values[Number(digit) - 1]).toContain(EXPECTED[kind]);
      });
    }
  });

  it('в экспорте .md чертежи идут галереей, а характеристики — столбцом', async () => {
    const { buildSheetMarkdown } = await import('../utils/sheetMarkdown');
    const task = tasksFor('b_char_match', 20)[0];
    const md = buildSheetMarkdown({
      generator: 'graph_derivative',
      title: 'Соответствие',
      tasksData: [[task]],
      layout: [],
    }, { format: 'work' });
    expect(md).toContain('{галерея}');
    expect(md).toContain('А) `plot:');
    expect(md).toContain('| ХАРАКТЕРИСТИКИ |');
    expect(md).toContain(`ответ: ${task.resultLatex}`);
  });
});

describe('соответствие «интервал ↔ характеристика»', () => {
  // Верна ли характеристика на интервале — считаем по разобранному чертежу
  const holds = (s, p, q, text) => {
    const N = 200;
    const at = (i) => p + ((q - p) * i) / N;
    const fs = [];
    const ds = [];
    for (let i = 1; i < N; i += 1) { fs.push(s.f(at(i))); ds.push(s.df(at(i))); }
    const list = text.startsWith('функция') ? fs : ds;
    const positive = /положительна на всём/.test(text);
    const negative = /отрицательна на всём/.test(text);
    if (positive) return list.every((v) => v > 0);
    if (negative) return list.every((v) => v < 0);
    const startPos = /положительна в начале/.test(text);
    return startPos
      ? list[0] > 0 && list[list.length - 1] < 0
      : list[0] < 0 && list[list.length - 1] > 0;
  };

  it('каждая характеристика верна для своего интервала и только для него', () => {
    const list = tasksFor('b_interval_match', 12);
    expect(list.length).toBeGreaterThan(8);

    for (const t of list) {
      const { s } = sampleCurve(t);
      expect([...t.resultLatex].sort().join('')).toBe('1234');
      expect(new Set(t.matching.values).size).toBe(4);

      // отметки a…e читаем с чертежа
      const marks = [...t.plot.matchAll(/^xtick (-?[\d.]+) ([abcde])$/gm)]
        .map((m) => Number(m[1]));
      expect(marks).toHaveLength(5);
      expect([...marks].sort((x, y) => x - y)).toEqual(marks);

      [...t.resultLatex].forEach((digit, i) => {
        const text = t.matching.values[Number(digit) - 1];
        // верна для своего интервала…
        expect(holds(s, marks[i], marks[i + 1], text)).toBe(true);
        // …и ни для какого другого — иначе у задания несколько ответов
        for (let j = 0; j < 4; j += 1) {
          if (j !== i) expect(holds(s, marks[j], marks[j + 1], text)).toBe(false);
        }
      });
    }
  });
});

describe('соответствие «график ↔ значение производной в x₀»', () => {
  const texToNumber = (tex) => {
    const frac = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(tex);
    if (frac) return (frac[1] ? -1 : 1) * (Number(frac[2]) / Number(frac[3]));
    return Number(tex.replace('{,}', '.'));
  };

  it('на каждом чертеже касательная стоит в x₀, а её наклон — заявленное значение', () => {
    const list = tasksFor('b_tangent_graphs', 12);
    expect(list.length).toBeGreaterThan(8);

    for (const t of list) {
      expect(t.plots).toHaveLength(4);
      expect(new Set(t.matching.values).size).toBe(4);
      expect([...t.resultLatex].sort().join('')).toBe('1234');

      [...t.resultLatex].forEach((digit, i) => {
        const spec = t.plots[i];
        const x0 = Number(/^xtick (-?[\d.]+) x_0$/m.exec(spec)[1]);
        expect(spec).toContain(`tangent ${x0} f`);
        const { s } = sampleCurve(null, spec);
        expect(s.df(x0)).toBeCloseTo(texToNumber(t.matching.values[Number(digit) - 1]), 6);
      });
    }
  });
});

describe('соответствие «прямая ↔ угловой коэффициент»', () => {
  it('наклон нарисованной прямой равен заявленному коэффициенту', async () => {
    const { compileExpr } = await import('../utils/coordPlot');
    const list = tasksFor('b_linear_slope', 12);
    expect(list.length).toBeGreaterThan(8);

    const texToNumber = (tex) => {
      const frac = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(tex);
      if (frac) return (frac[1] ? -1 : 1) * (Number(frac[2]) / Number(frac[3]));
      return Number(tex.replace('{,}', '.'));
    };

    for (const t of list) {
      expect(t.plots).toHaveLength(4);
      expect(new Set(t.matching.values).size).toBe(4);
      expect([...t.resultLatex].sort().join('')).toBe('1234');

      [...t.resultLatex].forEach((digit, i) => {
        const m = parseCoordPlot(t.plots[i]);
        expect(m.errors).toEqual([]);
        const { fn, error } = compileExpr(m.curves[0].expr);
        expect(error).toBeFalsy();
        // прямая: наклон один и тот же в любых двух точках
        const k = fn(2) - fn(1);
        expect(fn(0) - fn(-1)).toBeCloseTo(k, 9);
        expect(k).toBeCloseTo(texToNumber(t.matching.values[Number(digit) - 1]), 9);
      });
    }
  });
});

describe('лист генератора', () => {
  it('варианты одинаковой длины и план категорий общий', () => {
    const vars = generateGraphVariants({ ...DEFAULT_SETTINGS_GRAPH, variantsCount: 3, questionsCount: 6 });
    expect(vars).toHaveLength(3);
    for (const v of vars) expect(v).toHaveLength(6);
    // задание №k во всех вариантах одного типа
    for (let k = 0; k < 6; k += 1) {
      const cats = vars.map((v) => v[k].cat);
      expect(new Set(cats).size).toBe(1);
    }
  });

  it('без категорий лист пустой', () => {
    expect(generateGraphVariants({ categories: {} })).toEqual([]);
  });
});
