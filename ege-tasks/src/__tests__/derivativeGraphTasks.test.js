import { describe, it, expect } from 'vitest';
import {
  makeGraphTask, generateGraphVariants, GRAPH_CATEGORIES,
  CATEGORY_LABELS_GRAPH, DEFAULT_SETTINGS_GRAPH,
} from '../utils/derivativeGraphTasks';
import { parseCoordPlot } from '../utils/coordPlot';

// Независимая проверка ответа: считаем всё численно по КАРТИНКЕ (разобранной
// из DSL задания), а не по внутренней модели генератора.
function sampleCurve(task) {
  const m = parseCoordPlot(task.plot);
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
      expect(t.plot).toContain('spline');
      expect(t.question.length).toBeGreaterThan(30);
      expect(Number.isFinite(t.answerValue)).toBe(true);
      // ключ учителя печатается KaTeX: десятичная запятая — в скобках
      expect(t.resultLatex).toBe(String(t.answerValue).replace('.', '{,}'));
      const m = parseCoordPlot(t.plot);
      expect(m.errors).toEqual([]); // чертёж строится без ошибок
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
