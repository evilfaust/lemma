import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  X, N, PI, add, mul, pow, div, sin, cos, tg, ctg, ln, exp, sqrt, lin, poly,
  logA, apow, fn, derivative, tex, evalAt, verifyDerivative, sameFunction,
  toNiceRational,
} from '../utils/derivativeCalc';
import {
  __test, generateDerivativeVariants, derivInstruction,
  CATEGORY_GROUPS_DERIV, CATEGORY_LABELS_DERIV, DEFAULT_SETTINGS_DERIV,
} from '../hooks/useDerivatives';
import { statementLatexOf, sheetPrompt } from '../utils/sheetMarkdown';
import { SHEET_GENERATORS } from '../utils/sheetRegistry';

const d = (f) => tex(derivative(f));
const rat = (n, dd) => ({ n, d: dd });

describe('derivativeCalc — таблица производных', () => {
  it('степени и корни', () => {
    expect(d(pow(X, 5))).toBe('5x^{4}');
    expect(d(mul(N(3), pow(X, -2)))).toBe('-\\frac{6}{x^{3}}');
    expect(d(sqrt(X))).toBe('\\frac{1}{2\\sqrt{x}}');
    expect(d(pow(X, rat(2, 3)))).toBe('\\frac{2}{3\\sqrt[3]{x}}');
    expect(d(pow(X, rat(-1, 2)))).toBe('-\\frac{1}{2x\\sqrt{x}}');
    expect(d(mul(N(3), pow(X, -2, 'power')))).toBe('-6x^{-3}');
  });

  it('тригонометрия, экспонента, логарифмы', () => {
    expect(d(mul(N(3), cos(X)))).toBe('-3\\sin x');
    expect(d(tg(X))).toBe('\\frac{1}{\\cos^{2} x}');
    expect(d(ctg(X))).toBe('-\\frac{1}{\\sin^{2} x}');
    expect(d(exp(X))).toBe('e^{x}');
    expect(d(apow(5, X))).toBe('5^{x} \\ln 5');
    expect(d(ln(X))).toBe('\\frac{1}{x}');
    expect(d(logA(3, X))).toBe('\\frac{1}{x \\ln 3}');
    expect(d(fn('arctg', X))).toBe('\\frac{1}{x^{2} + 1}');
  });
});

describe('derivativeCalc — правила дифференцирования', () => {
  it('сумма и постоянный множитель', () => {
    expect(d(poly([-1, 7, -5, 2]))).toBe('6x^{2} - 10x + 7');
    expect(d(poly([0, 4, rat(-1, 2), rat(1, 3)]))).toBe('x^{2} - x + 4');
    // Слагаемые суммы не сливаются в одну дробь
    expect(d(add(pow(X, rat(1, 3)), mul(N(7), pow(X, 4)))))
      .toBe('\\frac{1}{3\\sqrt[3]{x^{2}}} + 28x^{3}');
    expect(d(add(pow(X, 4), mul(N(-2), pow(X, -1))))).toBe('4x^{3} + \\frac{2}{x^{2}}');
  });

  it('произведение', () => {
    expect(d(mul(pow(X, 2), sin(X)))).toBe('2x \\sin x + x^{2} \\cos x');
    expect(d(mul(X, ln(X)))).toBe('\\ln x + 1');
    expect(d(mul(pow(X, 2), exp(X)))).toBe('e^{x} \\left(x^{2} + 2x\\right)');
    expect(d(mul(sqrt(X), lin(1, -4)))).toBe('\\frac{3x - 4}{2\\sqrt{x}}');
    expect(d(mul(pow(lin(1, 1), 2), pow(lin(1, -2), 3))))
      .toBe('\\left(x + 1\\right) \\left(x - 2\\right)^{2} \\left(5x - 1\\right)');
  });

  it('частное', () => {
    expect(d(div(lin(2, 1), lin(1, -3)))).toBe('-\\frac{7}{\\left(x - 3\\right)^{2}}');
    expect(d(div(sin(X), X))).toBe('\\frac{x \\cos x - \\sin x}{x^{2}}');
    expect(d(div(X, exp(X)))).toBe('\\frac{1 - x}{e^{x}}');
    expect(d(div(ln(X), X))).toBe('\\frac{1 - \\ln x}{x^{2}}');
    expect(d(div(cos(X), sin(X)))).toBe('-\\frac{1}{\\sin^{2} x}');
    expect(d(div(ln(X), lin(1, 9))))
      .toBe('\\frac{x + 9 - x \\ln x}{x \\left(x + 9\\right)^{2}}');
  });

  it('сложная функция', () => {
    expect(d(pow(lin(3, -2), 5))).toBe('15\\left(3x - 2\\right)^{4}');
    expect(d(sqrt(poly([1, 0, 1])))).toBe('\\frac{x}{\\sqrt{x^{2} + 1}}');
    expect(d(sin(lin(3, 1)))).toBe('3\\cos\\left(3x + 1\\right)');
    expect(d(cos(add(mul(N(2), X), mul(N(-1, 3), PI)))))
      .toBe('-2\\sin\\left(2x - \\frac{\\pi}{3}\\right)');
    expect(d(pow(sin(X), 2))).toBe('2\\sin x \\cos x');
    expect(d(exp(pow(X, 2)))).toBe('2x e^{x^{2}}');
    expect(d(ln(sin(X)))).toBe('\\operatorname{ctg} x');
    expect(d(ln(cos(X)))).toBe('-\\operatorname{tg} x');
    expect(d(apow(2, mul(N(3), X)))).toBe('3 \\cdot 2^{3x} \\ln 2');
    expect(d(mul(X, sqrt(lin(2, 1))))).toBe('\\frac{3x + 1}{\\sqrt{2x + 1}}');
  });

  it('проверка ловит неверную производную', () => {
    const f = mul(pow(X, 2), sin(X));
    expect(verifyDerivative(f, derivative(f))).toBe(true);
    // (uv)′ = u′v′ — типичная ошибка
    expect(verifyDerivative(f, mul(N(2), X, cos(X)))).toBe(false);
    expect(sameFunction(derivative(f), derivative(f))).toBe(true);
  });

  it('проверка не спотыкается о полюса tg и узкую область arcsin', () => {
    const f = tg(mul(N(5), X));
    expect(verifyDerivative(f, derivative(f))).toBe(true);
    const g = fn('arcsin', mul(N(2), X));
    expect(verifyDerivative(g, derivative(g))).toBe(true);
  });

  it('значение в точке — «круглое» рациональное или null', () => {
    expect(toNiceRational(0.25)).toEqual({ n: 1, d: 4 });
    expect(toNiceRational(Math.sqrt(3) / 2)).toBeNull();
    expect(evalAt(derivative(mul(X, sin(X))), Math.PI / 2)).toBeCloseTo(1, 12);
  });
});

// ─── Генератор ───────────────────────────────────────────────────────────────
const renders = (latex) => {
  katex.renderToString(latex, { throwOnError: true, strict: false });
  return true;
};

const ASK = new Set(CATEGORY_GROUPS_DERIV[7].keys);

describe('генератор производных — все категории', () => {
  const cats = Object.keys(CATEGORY_LABELS_DERIV);

  it('у каждой категории есть генератор и место в блоке', () => {
    const inGroups = CATEGORY_GROUPS_DERIV.flatMap(g => g.keys);
    expect(new Set(inGroups).size).toBe(inGroups.length);
    expect([...inGroups].sort()).toEqual([...cats].sort());
    cats.forEach(c => expect(__test.GENERATORS[c]).toBeTypeOf('function'));
    expect(Object.keys(DEFAULT_SETTINGS_DERIV.categories).sort()).toEqual([...cats].sort());
  });

  for (const level of [1, 2, 3]) {
    it(`уровень ${level}: задания собираются и печатаются KaTeX`, () => {
      for (const cat of cats) {
        let made = 0;
        for (let i = 0; i < 40; i++) {
          const q = __test.buildQuestion(cat, { P: __test.pools(level), notation: 'y' });
          if (!q) continue;
          made += 1;
          expect(q.cat).toBe(cat);
          expect(renders(q.exprLatex)).toBe(true);
          expect(renders(q.resultLatex)).toBe(true);
          expect(renders(`${q.varLatex} = ${q.resultLatex}`)).toBe(true);
          expect(q.exprLatex).not.toMatch(/\+ -|- -|NaN|undefined/);
          expect(q.resultLatex).not.toMatch(/\+ -|- -|\?|NaN|undefined/);
          if (ASK.has(cat)) {
            expect(q.askInStatement).toBe(true);
            expect(renders(statementLatexOf(q))).toBe(true);
          } else {
            (q.mistakes || []).forEach(m => {
              expect(renders(m)).toBe(true);
              expect(m).not.toBe(q.resultLatex);
            });
            expect(new Set(q.mistakes).size).toBe(q.mistakes.length);
          }
        }
        // Узкие категории отбраковывают часть чисел, но пустыми не бывают
        expect(made, `${cat} на уровне ${level}`).toBeGreaterThan(10);
      }
    });
  }
});

describe('генератор производных — задания с вопросом', () => {
  const opts = { P: __test.pools(2), notation: 'y' };
  const many = (cat, n = 30) => Array.from({ length: n }, () => __test.buildQuestion(cat, opts)).filter(Boolean);

  it('значение производной — число для бланка (не больше двух знаков)', () => {
    for (const cat of ['vPoly', 'vRules', 'vTrans', 'vSlope', 'vVelocity', 'vAccel']) {
      many(cat).forEach(q => expect(q.resultLatex).toMatch(/^-?\d+(\{,\}\d{1,2})?$/));
    }
  });

  it('уравнение касательной — прямая y = kx + b', () => {
    many('vTangent').forEach(q => {
      expect(q.varLatex).toBe('y');
      expect(q.resultLatex).not.toMatch(/\\(sin|cos|ln|sqrt)|e\^/);
    });
  });

  it('стационарные точки — целые, через «;»', () => {
    many('vStationary').forEach(q => expect(q.resultLatex).toMatch(/^-?\d+(;\\ -?\d+)?$/));
  });

  it('в условии для теста и .md дописан вопрос', () => {
    const q = many('vPoly', 5)[0];
    expect(statementLatexOf(q)).toBe(`${q.exprLatex},\\; ${q.varLatex} = \\,?`);
    const plain = { exprLatex: 'y = x^{2}', varLatex: "y'" };
    expect(statementLatexOf(plain)).toBe('y = x^{2}');
  });

  it('запись f(x) — вопрос «f′(x) =»', () => {
    const q = __test.buildQuestion('tPower', { P: __test.pools(2), notation: 'f' });
    expect(q.exprLatex.startsWith('f(x) = ')).toBe(true);
    expect(q.varLatex).toBe("f'(x)");
  });
});

describe('генератор производных — лист', () => {
  it('варианты по плану: одинаковые категории на одинаковых местах', () => {
    const variants = generateDerivativeVariants({ variantsCount: 3, questionsCount: 12 });
    expect(variants).toHaveLength(3);
    variants.forEach(v => expect(v).toHaveLength(12));
    for (let i = 0; i < 12; i++) {
      expect(new Set(variants.map(v => v[i].cat)).size).toBe(1);
    }
  });

  it('инструкция зависит от состава листа', () => {
    expect(derivInstruction({ tPower: true })).toBe('Найдите производную функции:');
    expect(derivInstruction({ tPower: true, vTangent: true })).toBe('Выполните задания:');
  });

  it('зарегистрирован для сохранённых листов и экспорта', () => {
    expect(SHEET_GENERATORS.derivatives.route).toBe('/app/functions/derivatives');
    expect(sheetPrompt('derivatives')).toBe('var');
  });
});
