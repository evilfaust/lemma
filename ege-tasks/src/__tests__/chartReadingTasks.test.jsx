import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  makeChartTask, generateChartVariants, CHART_CATEGORIES,
  CATEGORY_LABELS_CHART, CATEGORY_GROUPS_CHART, DEFAULT_SETTINGS_CHART,
} from '../utils/chartReadingTasks';
import { chartSvg, seriesPath } from '../utils/chartSvg';
import GraphSheetPrintLayout from '../components/functions/GraphSheetPrintLayout';
import { sheetGeneratorRoute } from '../utils/sheetRegistry';

// Ответ проверяется НЕЗАВИСИМО: по самому чертежу (точки линии, столбики) и
// числам из текста условия, а не по внутренним данным генератора.

const N = 40;
const many = (cat) => Array.from({ length: N }, () => makeChartTask(cat)).filter(Boolean);
const numsOf = (text) => [...text.matchAll(/(\d+)\s?(?:°C|Н·м|минут)/g)].map((m) => Number(m[1]));
const pts = (task) => task.chart.series[0].points;
const yAt = (task, x) => pts(task).find(([px]) => px === x)[1];

describe('каталог', () => {
  it('у каждого типа есть подпись и место в блоке', () => {
    const inGroups = CATEGORY_GROUPS_CHART.flatMap((g) => g.keys);
    expect(new Set(inGroups).size).toBe(inGroups.length);
    CHART_CATEGORIES.forEach((c) => expect(CATEGORY_LABELS_CHART[c]).toBeTruthy());
  });

  it.each(CHART_CATEGORIES)('%s собирается и рисуется', (cat) => {
    const tasks = many(cat);
    expect(tasks.length).toBeGreaterThan(N * 0.9);
    for (const t of tasks) {
      expect(t.cat).toBe(cat);
      expect(t.question.length).toBeGreaterThan(40);
      expect(Number.isFinite(t.answerValue)).toBe(true);
      const svg = chartSvg(t.chart);
      expect(svg).toMatch(/^<svg/);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });

  it('лист по умолчанию: 2 варианта по 6 заданий', () => {
    const v = generateChartVariants(DEFAULT_SETTINGS_CHART);
    expect(v).toHaveLength(2);
    v.forEach((variant) => expect(variant).toHaveLength(6));
  });

  it('генератор зарегистрирован для сохранённых листов', () => {
    expect(sheetGeneratorRoute('chart_reading')).toBe('/app/functions/charts');
  });
});

describe('ответы сверены с графиком', () => {
  // Дата в условии → сутки на оси (подпись группы) → четыре замера этих суток
  const dayPoints = (t) => {
    const g = t.chart.x.groups.find((gr) => t.question.includes(gr.label));
    return pts(t).filter(([x]) => x >= g.from && x < g.to).map(([, y]) => y);
  };

  it('температура за сутки: наибольшая, наименьшая, разность', () => {
    many('temp_day_max').forEach((t) => expect(t.answerValue).toBe(Math.max(...dayPoints(t))));
    many('temp_day_min').forEach((t) => expect(t.answerValue).toBe(Math.min(...dayPoints(t))));
    many('temp_day_range').forEach((t) => {
      const d = dayPoints(t);
      expect(t.answerValue).toBe(Math.max(...d) - Math.min(...d));
    });
  });

  it('температура в заданный час', () => {
    many('temp_at_time').forEach((t) => {
      const g = t.chart.x.groups.find((gr) => t.question.includes(gr.label));
      const hour = Number(t.question.match(/в (\d\d):00/)[1]);
      expect(t.answerValue).toBe(yAt(t, g.from + hour));
    });
  });

  it('полночь следующих суток не выходит за размах дня', () => {
    many('temp_day_max').forEach((t) => {
      const g = t.chart.x.groups.find((gr) => t.question.includes(gr.label));
      const d = dayPoints(t);
      const next = yAt(t, g.to);
      expect(next).toBeLessThanOrEqual(Math.max(...d));
      expect(next).toBeGreaterThanOrEqual(Math.min(...d));
    });
  });

  it('разогрев: время от A до B — по единственным точкам кривой', () => {
    many('heat_time').forEach((t) => {
      const [a, b] = numsOf(t.question);
      const xa = pts(t).filter(([, y]) => y === a);
      const xb = pts(t).filter(([, y]) => y === b);
      expect(xa).toHaveLength(1);
      expect(xb).toHaveLength(1);
      expect(t.answerValue).toBe(xb[0][0] - xa[0][0]);
      // между узлами кривая монотонна: значение не встречается второй раз
      const path = seriesPath(t.chart.series[0]);
      const crossings = path.filter(([, y], i) => i && (path[i - 1][1] - b) * (y - b) < 0);
      expect(crossings.length).toBeLessThanOrEqual(1);
    });
  });

  it('разогрев: температура через t минут и момент достижения', () => {
    many('heat_value').forEach((t) => {
      const m = Number(t.question.match(/первые (\d+) мин/)[1]);
      expect(t.answerValue).toBe(yAt(t, m));
    });
    many('heat_reach').forEach((t) => {
      const [X] = numsOf(t.question);
      expect(pts(t).filter(([, y]) => y === X).map(([x]) => x)).toEqual([t.answerValue]);
    });
  });

  it('крутящий момент: наименьшие обороты и скорость', () => {
    const firstAtLeast = (t, X) => {
      const path = seriesPath(t.chart.series[0]);
      return path.find(([, y]) => y >= X - 1e-9)[0];
    };
    many('torque_rpm').forEach((t) => {
      const X = Number(t.question.match(/не менее (\d+)/)[1]);
      expect(Math.abs(firstAtLeast(t, X) - t.answerValue)).toBeLessThan(1);
    });
    many('torque_speed').forEach((t) => {
      const X = Number(t.question.match(/не меньше (\d+)/)[1]);
      expect(t.answerValue).toBeCloseTo(0.036 * Math.round(firstAtLeast(t, X)), 6);
    });
  });

  it('реакция: сколько граммов вступило за t минут', () => {
    many('reaction_used').forEach((t) => {
      const m = Number(t.question.match(/за (\d+) мин/)[1]);
      expect(t.answerValue).toBe(yAt(t, 0) - yAt(t, m));
    });
  });

  it('диаграмма: наибольшее, наименьшее, разность', () => {
    const vals = (t) => t.chart.bars.map((b) => b.v);
    many('bar_max').forEach((t) => expect(t.answerValue).toBe(Math.max(...vals(t))));
    many('bar_min').forEach((t) => expect(t.answerValue).toBe(Math.min(...vals(t))));
    many('bar_range').forEach((t) => expect(t.answerValue).toBe(Math.max(...vals(t)) - Math.min(...vals(t))));
  });

  it('диаграмма: вершина столбика — на линии сетки, нулевых месяцев нет', () => {
    many('bar_max').forEach((t) => t.chart.bars.forEach((b) => {
      expect(Math.abs(b.v % t.chart.y.grid)).toBe(0);
      expect(b.v).not.toBe(0);
    }));
  });
});

describe('соответствие', () => {
  const ORD = ['первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой'];
  // Интервал из подписи → отрезок ломаной → его наклон
  const slopeOf = (t, label) => {
    const p = pts(t);
    const step = p[1][0] - p[0][0];
    const ord = ORD.findIndex((w) => label.startsWith(w));
    const i = ord >= 0 ? ord : Number(label.match(/^(\d+)/)[1]) / step;
    return p[i + 1][1] - p[i][1];
  };
  const fits = (text, s, all) => {
    const up = all.filter((v) => v > 0);
    const down = all.filter((v) => v < 0);
    if (/не менялась|постоянной/.test(text)) return s === 0;
    if (/уменьшалась|падала/.test(text)) return s < 0;
    if (/росла быстрее/.test(text)) return s > 0 && s === Math.max(...up);
    if (/росла медленнее/.test(text)) return s > 0 && s === Math.min(...up);
    if (/снижалась быстрее/.test(text)) return s < 0 && s === Math.min(...down);
    if (/снижалась медленнее/.test(text)) return s < 0 && s === Math.max(...down);
    throw new Error(`неизвестная характеристика: ${text}`);
  };

  it('интервалы ↔ скорость изменения: ответ однозначен и верен', () => {
    many('match_rate').forEach((t) => {
      const { points, values } = t.matching;
      const slopes = points.map((l) => slopeOf(t, l));
      const digits = String(t.resultLatex).split('').map(Number);
      expect([...digits].sort().join('')).toBe('1234');
      points.forEach((_, k) => {
        // ровно одна характеристика подходит интервалу, и это — ответ
        const ok = values.map((v) => fits(v, slopes[k], slopes));
        expect(ok.filter(Boolean)).toHaveLength(1);
        expect(ok.indexOf(true) + 1).toBe(digits[k]);
      });
    });
  });

  it('кварталы ↔ характеристики: четыре разные цифры', () => {
    many('match_quarters').forEach((t) => {
      expect(t.matching.points).toHaveLength(4);
      expect(String(t.resultLatex).split('').sort().join('')).toBe('1234');
    });
  });
});

describe('печать', () => {
  it('лист рисует диаграммы и подписывает типы в ключе', () => {
    const s = {
      ...DEFAULT_SETTINGS_CHART,
      categories: Object.fromEntries(CHART_CATEGORIES.map((k) => [k, true])),
      variantsCount: 1,
      questionsCount: CHART_CATEGORIES.length,
    };
    const tasksData = generateChartVariants(s);
    const { container } = render(
      <GraphSheetPrintLayout
        tasksData={tasksData}
        settings={s}
        title="Графики и диаграммы"
        layout={[]}
        categoryLabels={CATEGORY_LABELS_CHART}
      />,
    );
    const figures = container.querySelectorAll('.gsp-page .gsp-figure svg.chart-svg');
    expect(figures.length).toBe(tasksData[0].length);
    const cats = [...container.querySelectorAll('.gsp-key-cat')].map((n) => n.textContent);
    expect(cats).toContain(CATEGORY_LABELS_CHART.match_quarters);
  });
});
