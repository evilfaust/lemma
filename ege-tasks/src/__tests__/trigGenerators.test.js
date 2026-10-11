/**
 * Сторож тригонометрических генераторов.
 *
 * Каждое задание каждого генератора пересчитывается НЕЗАВИСИМЫМ вычислителем
 * (`helpers/trigTexEval.js`) по напечатанному условию: выражение равно ответу,
 * тождество верно при случайных значениях переменной, у уравнения каждая точка
 * каждой серии — корень, и корней на окне ровно столько, сколько даёт ответ.
 * До v3.9.347 этого теста не было — и 16 ответов уравнений f(kx+b)=a,
 * набранных руками, оказались неверными.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { evalTrig, close, stripHint, checkEquation, parseFamilies } from './helpers/trigTexEval';
import {
  generateTrigEquationsAdvancedVariants, CATEGORY_LABELS_TRIG_ADV,
} from '../hooks/useTrigEquationsAdvanced';
import { generateTrigEquationsVariants } from '../hooks/useTrigEquations';
import { simpleEquation } from '../utils/trig/equations';
import { generateTrigValuesVariants } from '../hooks/useTrigValues';
import { generateUnitCircleVariants } from '../hooks/useUnitCircle';
import { generateTrigExpressionsVariants } from '../hooks/useTrigExpressions';
import { generateInverseTrigVariants } from '../hooks/useInverseTrig';
import { generateReductionFormulasVariants } from '../hooks/useReductionFormulas';
import { generateAdditionFormulasVariants } from '../hooks/useAdditionFormulas';
import { generateDoubleAngleVariants } from '../hooks/useDoubleAngle';
import { TRIG_TYPES } from '../hooks/trigMixedRegistry';
import { generateTrigByValueVariants, CATEGORY_LABELS_BY_VALUE } from '../hooks/useTrigByValue';
import { QUARTERS } from '../utils/trig/byValue';

const renders = (tex) => {
  katex.renderToString(tex, { throwOnError: true });
  return true;
};

const allCats = (labels) => Object.fromEntries(Object.keys(labels).map(k => [k, true]));

function collect(gen, settings, rounds = 4) {
  const out = new Map();
  for (let r = 0; r < rounds; r++) {
    for (const v of gen({ variantsCount: 8, questionsCount: 16, ...settings })) {
      for (const q of v) out.set(q.exprLatex, q);
    }
  }
  return [...out.values()];
}

describe('вычислитель тригонометрии', () => {
  it('читает запись листов', () => {
    expect(evalTrig('\\sin\\,\\dfrac{\\pi}{6}')).toBeCloseTo(0.5);
    expect(evalTrig('2\\sin 15^{\\circ}\\cos 15^{\\circ}')).toBeCloseTo(0.5);
    expect(evalTrig('\\cos^2 x - \\sin^2 x', { x: 0.3 })).toBeCloseTo(Math.cos(0.6));
    expect(evalTrig('\\operatorname{tg}\\!\\left(-\\dfrac{\\pi}{4}\\right)')).toBeCloseTo(-1);
    expect(evalTrig('\\operatorname{arcctg}(-1)')).toBeCloseTo(3 * Math.PI / 4);
    expect(evalTrig('(-1)^{n+1}\\dfrac{\\pi}{6} + \\pi n', { n: 1 })).toBeCloseTo(Math.PI / 6 + Math.PI);
    expect(evalTrig('\\sin 2x\\cos 3x', { x: 0.2 })).toBeCloseTo(Math.sin(0.4) * Math.cos(0.6));
    expect(evalTrig('\\cos\\dfrac{\\pi(x - 1)}{3}', { x: 2 })).toBeCloseTo(0.5);
  });

  it('ловит неверные ответы (старые записи таблицы)', () => {
    // так было в таблице до v3.9.347
    expect(checkEquation('\\cos\\dfrac{x}{2} = 0', 'x = \\pi + 4\\pi n,\\; n \\in \\mathbb{Z}')).toMatch(/потеряны/);
    expect(checkEquation(
      '2\\sin\\!\\left(3x - \\dfrac{\\pi}{4}\\right) = -\\sqrt{2}',
      'x = -\\dfrac{\\pi}{12} + \\dfrac{\\pi n}{3} \\text{ или } x = \\dfrac{5\\pi}{12} + \\dfrac{\\pi n}{3},\\; n \\in \\mathbb{Z}',
    )).toMatch(/не корень/);
    expect(checkEquation('\\cos\\dfrac{x}{2} = 0', 'x = \\pi + 2\\pi n,\\; n \\in \\mathbb{Z}')).toBeNull();
  });
});

describe('уравнения f(kx + b) = a', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_TRIG_ADV)) {
    it(cat, { timeout: 60000 }, () => {
      const tasks = collect(generateTrigEquationsAdvancedVariants, {
        categories: { [cat]: true },
      }, 2);
      expect(tasks.length).toBeGreaterThan(3);
      const wrong = [];
      for (const q of tasks) {
        expect(renders(q.exprLatex)).toBe(true);
        expect(renders(q.resultLatex)).toBe(true);
        if (cat.startsWith('part1')) {
          const [eq, tail] = q.exprLatex.split('\\;\\text{');
          const v = Number(q.resultLatex.replace('{,}', '.'));
          const [l, r] = eq.split('=');
          if (!close(evalTrig(l, { x: v }), evalTrig(r, { x: v }))) wrong.push(q.exprLatex);
          // это действительно наибольший отрицательный / наименьший положительный
          const g = (x) => evalTrig(l, { x }) - evalTrig(r, { x });
          const step = 1e-3;
          const neg = tail.includes('отрицательный');
          const from = neg ? v + step : step; const to = neg ? -step : v - step;
          for (let x = from; x < to; x += step) {
            if (Math.abs(g(x)) < 1e-9) { wrong.push(`${q.exprLatex}: корень ${x}`); break; }
          }
          continue;
        }
        const err = checkEquation(q.exprLatex, q.resultLatex);
        if (err) wrong.push(`${q.exprLatex} → ${q.resultLatex}: ${err}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  it('у дистракторов теста нет верного ответа', { timeout: 60000 }, () => {
    const tasks = collect(generateTrigEquationsAdvancedVariants, {
      categories: allCats(CATEGORY_LABELS_TRIG_ADV),
    }, 1);
    for (const q of tasks) {
      for (const m of q.mistakes || []) {
        expect(m).not.toBe(q.resultLatex);
        expect(checkEquation(q.exprLatex, m)).not.toBeNull();
      }
    }
  });

  it('старые листы (useType1/useType2) открываются', () => {
    const v = generateTrigEquationsAdvancedVariants({ variantsCount: 2, questionsCount: 4, useType1: true, useType2: true });
    expect(v).toHaveLength(2);
    expect(v[0]).toHaveLength(4);
  });
});

describe('простейшие уравнения', () => {
  const settings = { useSin: true, useCos: true, useTan: true, useCot: true, useNonTable: true, useNoRoots: true };

  it('ответы верны (все функции, нетабличные, без корней)', { timeout: 60000 }, () => {
    const tasks = collect(generateTrigEquationsVariants, settings, 3);
    const wrong = [];
    for (const q of tasks) {
      expect(renders(q.exprLatex)).toBe(true);
      expect(renders(q.resultLatex)).toBe(true);
      const err = checkEquation(q.exprLatex, q.resultLatex, 't');
      if (err) wrong.push(`${q.exprLatex} → ${q.resultLatex}: ${err}`);
    }
    expect(wrong).toEqual([]);
  });

  it('все табличные значения — по учебнику', () => {
    expect(simpleEquation('cot', 'table', { key: '-1', tex: '-1', val: -1, atan: { n: -1, d: 4 } }).resultLatex)
      .toBe('t = \\dfrac{3\\pi}{4} + \\pi n,\\; n \\in \\mathbb{Z}');
    expect(simpleEquation('sin', 'table', { key: '-1/2', tex: '-\\dfrac{1}{2}', val: -0.5, asin: { n: -1, d: 6 } }).resultLatex)
      .toBe('t = (-1)^{n+1}\\dfrac{\\pi}{6} + \\pi n,\\; n \\in \\mathbb{Z}');
    expect(simpleEquation('cos', 'table', { key: '-s2/2', tex: '-\\dfrac{\\sqrt{2}}{2}', val: -Math.SQRT2 / 2, asin: { n: -1, d: 4 } }).resultLatex)
      .toBe('t = \\pm \\dfrac{3\\pi}{4} + 2\\pi n,\\; n \\in \\mathbb{Z}');
  });

  it('без корней — «корней нет»', () => {
    const q = simpleEquation('sin', 'noroots');
    expect(q.resultLatex).toBe('\\text{корней нет}');
    expect(parseFamilies(q.resultLatex)).toEqual([]);
  });

  it('в варианте нет повторов', () => {
    for (const v of generateTrigEquationsVariants({ ...settings, variantsCount: 8, questionsCount: 10 })) {
      expect(new Set(v.map(q => q.exprLatex)).size).toBe(v.length);
    }
  });
});

// ─── «выражение → ответ» ─────────────────────────────────────────────────────
// Тождество (есть переменная) проверяется в нескольких точках.
const POINTS = [0.37, 1.13, -0.71, 2.3];
const VARS_AT = (x) => ({ '\\alpha': x, '\\beta': x, '\\varphi': x, x, t: x, y: x });

function exprMismatch(q) {
  const expr = stripHint(q.exprLatex);
  try {
    for (const x of POINTS) {
      const env = VARS_AT(x);
      const a = evalTrig(expr, env);
      const b = evalTrig(q.resultLatex, env);
      if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
      if (!close(a, b, 1e-7)) return `${expr} = ${a}, ответ ${q.resultLatex} = ${b}`;
    }
  } catch (e) {
    return `${expr}: ${e.message}`;
  }
  return null;
}

function checkSheet(variants, { minTasks = 1 } = {}) {
  const wrong = [];
  let total = 0;
  for (const v of variants) {
    expect(new Set(v.map(q => q.exprLatex)).size).toBe(v.length);   // нет повторов
    for (const q of v) {
      total += 1;
      expect(q.exprLatex).not.toBe('?');
      expect(renders(q.exprLatex)).toBe(true);
      expect(renders(q.resultLatex)).toBe(true);
      const err = exprMismatch(q);
      if (err) wrong.push(err);
    }
  }
  expect(total).toBeGreaterThanOrEqual(minTasks);
  return wrong;
}

const many = (gen, settings, rounds = 3) =>
  Array.from({ length: rounds }, () => gen({ variantsCount: 8, ...settings })).flat();

describe('сторож ловит ошибки', () => {
  it('в выражениях и тождествах', () => {
    expect(exprMismatch({ exprLatex: '\\sin 30^{\\circ}', resultLatex: '\\dfrac{\\sqrt{3}}{2}' })).not.toBeNull();
    expect(exprMismatch({ exprLatex: '\\cos\\!\\left(\\dfrac{\\pi}{2} + \\alpha\\right)', resultLatex: '\\sin\\,\\alpha' })).not.toBeNull();
    expect(exprMismatch({ exprLatex: '\\cos\\!\\left(\\dfrac{\\pi}{2} + \\alpha\\right)', resultLatex: '-\\sin\\,\\alpha' })).toBeNull();
    expect(exprMismatch({ exprLatex: '6{,}5\\,\\operatorname{tg}\\,47^{\\circ}\\cdot\\operatorname{tg}\\,223^{\\circ}', resultLatex: '6{,}5' })).toBeNull();
  });
});

describe('значения функций и окружность', () => {
  it('таблица значений сходится с углом', () => {
    for (const useDegrees of [false, true]) {
      for (const v of generateTrigValuesVariants({ variantsCount: 8, anglesCount: 16, maxK: 2, useDegrees })) {
        for (const a of v) {
          const x = evalTrig(a.angleDisplay);
          expect(close(x, (a.num / a.den + 2 * a.k) * Math.PI)).toBe(true);
          expect(close(evalTrig(a.sin), Math.sin(x), 1e-9)).toBe(true);
          expect(close(evalTrig(a.cos), Math.cos(x), 1e-9)).toBe(true);
          if (a.tanUndef) expect(Math.abs(Math.cos(x))).toBeLessThan(1e-9);
          else expect(close(evalTrig(a.tan), Math.tan(x), 1e-9)).toBe(true);
          if (a.cotUndef) expect(Math.abs(Math.sin(x))).toBeLessThan(1e-9);
          else expect(close(evalTrig(a.cot), 1 / Math.tan(x), 1e-9)).toBe(true);
        }
      }
    }
  });

  it('подписи точек окружности — это их углы', () => {
    for (const useDegrees of [false, true]) {
      for (const v of generateUnitCircleVariants({ variantsCount: 4, circlesPerPage: 4, pointsPerCircle: 12, maxK: 2, useDegrees })) {
        for (const task of v) {
          for (const p of task.points) {
            expect(close(evalTrig(p.display), (p.num / p.den + 2 * p.k) * Math.PI)).toBe(true);
          }
        }
      }
    }
  });
});

describe('вычисление выражений', () => {
  for (const taskType of ['sum', 'product', 'mixed']) {
    for (const useDegrees of [false, true]) {
      it(`${taskType}${useDegrees ? ', градусы' : ''}`, () => {
        const wrong = checkSheet(many(generateTrigExpressionsVariants, {
          questionsCount: 10, taskType, termsCount: 3,
          useSin: true, useCos: true, useTan: true, useCot: true, useNegAngles: true, useDegrees,
        }), { minTasks: 50 });
        expect(wrong).toEqual([]);
      });
    }
  }
});

describe('обратные функции', () => {
  const all = {
    useArcsin: true, useArccos: true, useArctan: true, useArccot: true,
    useOuterSin: true, useOuterCos: true, useOuterTan: true, useOuterCot: true,
  };
  for (const taskType of ['basic', 'sum', 'nested', 'arcOfTrig', 'nestedNonTable', 'mixed']) {
    it(taskType, () => {
      const wrong = checkSheet(many(generateInverseTrigVariants, { ...all, questionsCount: 10, taskType }), { minTasks: 50 });
      expect(wrong).toEqual([]);
    });
  }
  it('в градусах', () => {
    const wrong = checkSheet(many(generateInverseTrigVariants, { ...all, questionsCount: 10, taskType: 'mixed', useDegrees: true }));
    expect(wrong).toEqual([]);
  });
});

describe('формулы приведения', () => {
  for (const taskTypes of [['basic'], ['reversed'], ['numeric'], ['basic', 'reversed', 'numeric']]) {
    for (const angleMode of ['radians', 'degrees']) {
      it(`${taskTypes.join('+')} (${angleMode})`, () => {
        const wrong = checkSheet(many(generateReductionFormulasVariants, {
          tasksPerVariant: 10, taskTypes, angleMode, funcs: ['sin', 'cos', 'tan', 'cot'],
        }), { minTasks: 50 });
        expect(wrong).toEqual([]);
      });
    }
  }
  it('числовые шаблоны по отдельности и только ctg', () => {
    for (const numPatterns of [{ sqrt3: true }, { sqrt2: true }, { complementary: true }]) {
      expect(checkSheet(many(generateReductionFormulasVariants, {
        tasksPerVariant: 8, taskTypes: ['numeric'], funcs: ['sin', 'cos', 'tan', 'cot'], numPatterns,
      }))).toEqual([]);
    }
  });
});

describe('формулы сложения', () => {
  for (const taskTypes of [['formula_eval'], ['symbolic'], ['nonstandard']]) {
    for (const funcs of [['sin', 'cos', 'tan'], ['tan']]) {
      it(`${taskTypes[0]}: ${funcs.join(', ')}`, () => {
        for (const showHint of [false, true]) {
          const wrong = checkSheet(many(generateAdditionFormulasVariants, {
            tasksPerVariant: 8, taskTypes, funcs, incSum: true, incDiff: true, showHint,
          }));
          expect(wrong).toEqual([]);
        }
      });
    }
  }
  it('при одном tg символьные задания — про tg', () => {
    for (const v of generateAdditionFormulasVariants({ variantsCount: 4, tasksPerVariant: 6, taskTypes: ['symbolic'], funcs: ['tan'] })) {
      for (const q of v) expect(q.exprLatex).toContain('operatorname{tg}');
    }
  });
  it('запись tg 30° — \\dfrac{\\sqrt{3}}{3}, а не 1/√3', () => {
    const tasks = many(generateAdditionFormulasVariants, { tasksPerVariant: 10, taskTypes: ['formula_eval'], funcs: ['tan'] }, 4).flat();
    for (const q of tasks) expect(q.resultLatex).not.toMatch(/\\dfrac\{1\}\{\\sqrt/);
  });
});

describe('двойной аргумент', () => {
  for (const taskTypes of [['numeric'], ['symbolic'], ['mixed']]) {
    it(taskTypes[0], () => {
      const wrong = checkSheet(many(generateDoubleAngleVariants, {
        tasksPerVariant: 8, taskTypes, funcs: ['sin', 'cos', 'tan'], incSin: true, incCos: true, incTan: true,
      }));
      expect(wrong).toEqual([]);
    });
  }
  it('несовместимые настройки — пустой лист, а не «?»', () => {
    expect(generateDoubleAngleVariants({ taskTypes: ['numeric'], funcs: ['tan'], incTan: false })).toEqual([]);
  });
});

describe('смешанная работа: каждый раздел', () => {
  for (const t of TRIG_TYPES) {
    it(t.label, { timeout: 60000 }, () => {
      const variants = t.generator({ ...t.defaultCfg, variantsCount: 4 });
      expect(variants.length).toBe(4);
      if (t.type === 'unitCircle') return;
      for (const v of variants) {
        expect(v.length).toBeGreaterThan(0);
        for (const q of v) {
          expect(renders(q.exprLatex)).toBe(true);
          if (t.questionMode === 'twoLine') {
            const err = checkEquation(q.exprLatex, q.resultLatex, q.varLatex || 'x');
            expect(err).toBeNull();
          } else {
            expect(exprMismatch(q)).toBeNull();
          }
        }
      }
    });
  }
});

// ─── По значению и четверти ─────────────────────────────────────────────────
// Условия «sin α = …» и промежуток α ∈ (…) задают угол: ищем его численно на
// промежутке по напечатанным условиям и считаем по нему напечатанный вопрос.
function solveAlpha(check) {
  const conds = check.conds.map((c) => {
    const [l, r] = c.split('=');
    const L = (a) => evalTrig(l, { '\\alpha': a });
    const R = evalTrig(r);
    return (a) => L(a) - R;
  });
  const [lo, hi] = check.range ? check.range.map(x => x * Math.PI) : [-Math.PI + 1e-6, Math.PI + 1e-6];
  const g = conds[0];
  const roots = [];
  const N = 4000;
  for (let k = 0; k < N; k++) {
    let a = lo + ((hi - lo) * k) / N; let b = lo + ((hi - lo) * (k + 1)) / N;
    let fa = g(a); const fb = g(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) { roots.push(a); continue; }
    if (fa * fb > 0) continue;
    for (let it = 0; it < 80; it++) {
      const m = (a + b) / 2; const fm = g(m);
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    if (Math.abs(g((a + b) / 2)) < 1e-9) roots.push((a + b) / 2);
  }
  return roots;
}

describe('по значению и четверти', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_BY_VALUE)) {
    it(cat, () => {
      const tasks = collect(generateTrigByValueVariants, { categories: { [cat]: true } }, 2);
      expect(tasks.length).toBeGreaterThan(5);
      const wrong = [];
      for (const q of tasks) {
        expect(renders(q.exprLatex)).toBe(true);
        expect(q.resultLatex).not.toMatch(/dfrac|sqrt/);          // в бланк — число
        const ans = Number(q.resultLatex.replace('{,}', '.'));
        const ask = q.check.ask;
        expect(q.exprLatex.startsWith(ask)).toBe(true);
        for (const c of q.check.conds) expect(q.exprLatex).toContain(c);
        let value;
        if (!q.check.conds.length) value = evalTrig(ask);
        else {
          const roots = solveAlpha(q.check);
          if (!roots.length) { wrong.push(`${q.exprLatex}: нет угла`); continue; }
          // все углы, подходящие под условия, дают один ответ
          const vals = roots.map(a => evalTrig(ask, { '\\alpha': a }));
          if (vals.some(v => !close(v, vals[0], 1e-6))) { wrong.push(`${q.exprLatex}: ответ зависит от угла`); continue; }
          value = vals[0];
        }
        if (!close(value, ans, 1e-7)) wrong.push(`${q.exprLatex} = ${value}, в ключе ${q.resultLatex}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  it('промежуток в условии совпадает с четвертью', () => {
    for (const q of QUARTERS) {
      const [lo, hi] = q.tex.replace(/\\left\(|\\right\)/g, '').split(';').map(t => evalTrig(t));
      expect(close(lo / Math.PI, Number(q.lo.n / q.lo.d))).toBe(true);
      expect(close(hi / Math.PI, Number(q.hi.n / q.hi.d))).toBe(true);
    }
  });
});
