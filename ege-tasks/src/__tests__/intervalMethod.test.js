import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateIntervalMethodVariants,
  intervalInstruction,
  CATEGORY_LABELS_INTERVAL,
  CATEGORY_GROUPS_INTERVAL,
  DEFAULT_SETTINGS_INTERVAL,
} from '../hooks/useIntervalMethod';
import {
  fLin, fQuad, fConst, polyFactor, polyFromRoots,
  solveIntervalMethod, criticalPoints, leadSignOf,
  renderExprTex, renderPolyTex, renderTermsTex,
  evalDisplayNum, verifyIntervalSolution, isBounded,
} from '../utils/intervalMethod';
import { inequalityAnswerTex, contains, isEmptySet, isAllReal } from '../utils/quadraticInequality';
import { OPS } from '../utils/inequalityCore';

const CATS = Object.keys(CATEGORY_LABELS_INTERVAL);
const ASK_CATS = new Set(CATEGORY_GROUPS_INTERVAL[6].keys);

// ─── Независимый разбор напечатанного условия ────────────────────────────────
// Условие проверяется не по модели задания, а по строке, которая уедет в печать:
// так ловится и ошибка решения, и ошибка вёрстки формулы.
function readBraced(tex, start) {
  let depth = 0;
  for (let j = start; j < tex.length; j++) {
    if (tex[j] === '{') depth++;
    else if (tex[j] === '}') {
      depth--;
      if (depth === 0) return { body: tex.slice(start + 1, j), end: j };
    }
  }
  throw new Error(`несбалансированные скобки: ${tex}`);
}

function expandFractions(tex) {
  const i = tex.indexOf('\\dfrac{');
  if (i === -1) return tex;
  const numer = readBraced(tex, i + '\\dfrac'.length);
  const denom = readBraced(tex, numer.end + 1);
  return expandFractions(
    `${tex.slice(0, i)}((${expandFractions(numer.body)})/(${expandFractions(denom.body)}))${tex.slice(denom.end + 1)}`,
  );
}

function evalSide(tex, varName, xValue) {
  let e = expandFractions(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\s+/g, '')
    .replace(/\^\{(\d+)\}/g, '**$1')
    .replace(/\^(\d)/g, '**$1')
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(new RegExp(`([\\d)${varName}])(?=\\()`, 'g'), '$1*');
  e = e.replace(new RegExp(varName, 'g'), `(${xValue})`);
  e = e.replace(/(^|[-+*/(])-(?=\()/g, '$1(-1)*');   // JS не даёт унарный минус перед **
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

const OP_TOKENS = [
  ['\\leqslant', 'le'], ['\\geqslant', 'ge'], ['<', 'lt'], ['>', 'gt'],
];

function splitInequality(exprLatex) {
  for (const [token, op] of OP_TOKENS) {
    const i = exprLatex.indexOf(token);
    if (i === -1) continue;
    return { op, left: exprLatex.slice(0, i), right: exprLatex.slice(i + token.length) };
  }
  throw new Error(`знак не найден: ${exprLatex}`);
}

/** «Левая минус правая»: знак решает всё, ±Infinity — точка не из области определения */
function residualAt(exprLatex, varName, x) {
  const { left, right } = splitInequality(exprLatex);
  return evalSide(left, varName, x) - evalSide(right, varName, x);
}

function holdsAt(exprLatex, varName, x) {
  const { op } = splitInequality(exprLatex);
  return OPS[op].test(residualAt(exprLatex, varName, x), 0);
}

// ─── Помощники ───────────────────────────────────────────────────────────────
function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateIntervalMethodVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateIntervalMethodVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

// ─── Ядро: знак произведения ─────────────────────────────────────────────────
describe('метод интервалов: решение', () => {
  const prod = (...f) => ({ numer: f, denom: [] });

  it('простые корни: знак чередуется через каждый', () => {
    const sol = solveIntervalMethod(prod(fLin(1, -2), fLin(1, 5)), 'lt');   // (x−2)(x+5) < 0
    expect(contains(sol, 0)).toBe(true);
    expect(contains(sol, 3)).toBe(false);
    expect(contains(sol, -6)).toBe(false);
  });

  it('чётная кратность знак не меняет', () => {
    const sol = solveIntervalMethod(prod(fLin(1, -2, 2), fLin(1, 1)), 'gt'); // (x−2)²(x+1) > 0
    expect(contains(sol, 0)).toBe(true);
    expect(contains(sol, 5)).toBe(true);
    expect(contains(sol, -3)).toBe(false);
    expect(contains(sol, 2, 0)).toBe(false);                                // сам корень строгому знаку не годится
  });

  it('нечётная кратность знак меняет', () => {
    const sol = solveIntervalMethod(prod(fLin(1, -2, 3), fLin(1, 1)), 'gt'); // (x−2)³(x+1) > 0
    expect(contains(sol, 5)).toBe(true);
    expect(contains(sol, 0)).toBe(false);
    expect(contains(sol, -3)).toBe(true);
  });

  it('корень чётной кратности входит в ответ отдельной точкой', () => {
    // (x−2)²(x+1) ⩽ 0 → (−∞; −1] ∪ {2}
    const sol = solveIntervalMethod(prod(fLin(1, -2, 2), fLin(1, 1)), 'le');
    expect(contains(sol, -3)).toBe(true);
    expect(contains(sol, 0)).toBe(false);
    expect(contains(sol, 2, 0)).toBe(true);
    expect(inequalityAnswerTex(sol, 'x', { form: 'interval' }))
      .toBe('\\left(-\\infty; -1\\right] \\cup \\left[2; 2\\right]');
  });

  it('корень знаменателя выколот даже при нестрогом знаке', () => {
    // (x − 3)/(x + 2) ⩾ 0
    const sol = solveIntervalMethod({ numer: [fLin(1, -3)], denom: [fLin(1, 2)] }, 'ge');
    expect(contains(sol, 3, 0)).toBe(true);
    expect(contains(sol, -2, 0)).toBe(false);
    expect(contains(sol, 0)).toBe(false);
    expect(contains(sol, -5)).toBe(true);
  });

  it('множитель без корней знака не даёт, но влияет на него', () => {
    const pos = solveIntervalMethod(prod(fQuad(1, 0, 4), fLin(1, -3)), 'lt'); // (x²+4)(x−3) < 0
    expect(contains(pos, 0)).toBe(true);
    expect(contains(pos, 5)).toBe(false);
    const neg = solveIntervalMethod(prod(fQuad(-1, 0, -4), fLin(1, -3)), 'lt'); // (−x²−4)(x−3) < 0
    expect(contains(neg, 5)).toBe(true);
    expect(contains(neg, 0)).toBe(false);
  });

  it('числовой множитель переворачивает ответ', () => {
    const sol = solveIntervalMethod(prod(fConst(-2), fLin(1, -1), fLin(1, 4)), 'gt');
    expect(contains(sol, 0)).toBe(true);            // −2(x−1)(x+4) > 0 ⟺ −4 < x < 1
    expect(contains(sol, 3)).toBe(false);
  });

  it('вырожденные случаи: вся прямая и пустое множество', () => {
    const squares = { numer: [fLin(1, -1, 2), fLin(1, 3, 2)], denom: [] };
    expect(isAllReal(solveIntervalMethod(squares, 'ge'))).toBe(true);
    expect(isEmptySet(solveIntervalMethod(squares, 'lt'))).toBe(true);
  });

  it('критические точки складывают кратности и помнят про знаменатель', () => {
    const pts = criticalPoints({ numer: [fLin(1, -2, 2)], denom: [fLin(1, 3)] });
    expect(pts).toHaveLength(2);
    expect(pts[0].denomMult).toBe(1);
    expect(pts[1].numerMult).toBe(2);
    expect(leadSignOf({ numer: [fLin(-1, 2)], denom: [fLin(1, 3)] })).toBe(-1);
  });
});

// ─── Печать ──────────────────────────────────────────────────────────────────
describe('печать выражения', () => {
  it('скобки, степени и одночлен x', () => {
    expect(renderExprTex({ numer: [fLin(1, -2), fLin(1, 5)] }, 'x'))
      .toBe('\\left(x - 2\\right)\\left(x + 5\\right)');
    expect(renderExprTex({ numer: [fLin(1, 0), fLin(1, -5, 2)] }, 'x'))
      .toBe('x\\left(x - 5\\right)^{2}');
  });

  it('единственный множитель дроби печатается без скобок', () => {
    expect(renderExprTex({ numer: [fLin(1, -3)], denom: [fLin(1, 2)] }, 'x'))
      .toBe('\\dfrac{x - 3}{x + 2}');
    expect(renderExprTex({ numer: [fConst(1)], denom: [fLin(1, -3)] }, 'x'))
      .toBe('\\dfrac{1}{x - 3}');
  });

  it('«3 − x» вместо «−x + 3», числовой множитель впереди', () => {
    expect(renderExprTex({ numer: [fLin(-1, 3), fLin(1, 4)] }, 'x'))
      .toBe('\\left(3 - x\\right)\\left(x + 4\\right)');
    expect(renderExprTex({ numer: [fConst(-2), fLin(1, -1)] }, 'x'))
      .toBe('-2\\left(x - 1\\right)');
  });

  it('многочлен по корням', () => {
    expect(polyFromRoots([{ r: 0 }, { r: 2 }, { r: -2 }])).toEqual([0, -4, 0, 1]);
    expect(renderPolyTex(polyFromRoots([{ r: 0 }, { r: 2 }, { r: -2 }]), 'x'))
      .toBe('x^{3} - 4x');
    const f = polyFactor([{ r: 1 }, { r: -1 }, { r: 2 }, { r: -2 }]);
    expect(renderPolyTex(f.coeffs, 'x')).toBe('x^{4} - 5x^{2} + 4');
  });

  it('сумма дробей печатается слагаемыми', () => {
    const display = {
      terms: [
        { numer: [fConst(1)], denom: [fLin(1, 0)], sign: 1 },
        { numer: [fConst(1)], denom: [fLin(1, -2)], sign: -1 },
      ],
    };
    expect(renderTermsTex(display, 'x')).toBe('\\dfrac{1}{x} - \\dfrac{1}{x - 2}');
    expect(evalDisplayNum(display, 4)).toBeCloseTo(1 / 4 - 1 / 2, 12);
  });
});

// ─── Генератор ───────────────────────────────────────────────────────────────
describe('генератор «Метод интервалов»', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inGroups = CATEGORY_GROUPS_INTERVAL.flatMap(g => g.keys);
    expect(new Set(inGroups)).toEqual(new Set(CATS));
    expect(inGroups).toHaveLength(new Set(inGroups).size);
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS_INTERVAL[cat], cat).toBe('string');
      expect(DEFAULT_SETTINGS_INTERVAL.categories, cat).toHaveProperty(cat);
    }
  });

  it('инструкция меняется, когда на листе есть вопросы', () => {
    expect(intervalInstruction({ prodTwo: true })).toBe('Решите неравенство методом интервалов:');
    expect(intervalInstruction({ countIntegers: true })).toBe('Выполните задания:');
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 10), cat).toHaveLength(10);
    }
  });

  it('условие и ответ рендерятся KaTeX', () => {
    for (const q of allCategories(240, { level: 3 })) {
      expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
        `${q.cat}: ${q.exprLatex}`).not.toThrow();
      expect(() => katex.renderToString(q.resultLatex, { throwOnError: true }),
        `${q.cat}: ${q.resultLatex}`).not.toThrow();
    }
  });

  it('ответ совпадает с напечатанным неравенством в пробных точках', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;                // у блока 7 свои проверки
      for (const q of onlyCategory(cat, 30)) {
        const probes = [-41.5, -12.25, -3.5, -0.75, 0.4, 3.5, 12.25, 41.5];
        for (const p of q.solution.pieces) {
          for (const b of [p.lo, p.hi]) {
            if (!b) continue;
            const v = b.p.n / b.p.d;
            probes.push(v - 0.37, v + 0.37);
          }
        }
        for (const x of probes) {
          const r = residualAt(q.exprLatex, q.varLatex, x);
          if (!Number.isFinite(r) || Math.abs(r) < 1e-9) continue;
          expect(holdsAt(q.exprLatex, q.varLatex, x),
            `${cat}: ${q.exprLatex} при x = ${x} → ${q.resultLatex}`)
            .toBe(contains(q.solution, x));
        }
      }
    }
  });

  it('границы ответа — корни числителя, выколотые точки в ответ не входят', () => {
    for (const cat of CATS) {
      if (ASK_CATS.has(cat)) continue;
      for (const q of onlyCategory(cat, 25)) {
        const loose = /\\leqslant|\\geqslant/.test(q.exprLatex);
        for (const p of q.solution.pieces) {
          for (const b of [p.lo, p.hi]) {
            if (!b) continue;
            const v = b.p.n / b.p.d;
            const r = residualAt(q.exprLatex, q.varLatex, v);
            if (!Number.isFinite(r)) {
              // Полюс: краем промежутка быть может, в ответ не входит никогда
              expect(contains(q.solution, v, 0),
                `${cat}: выколотая ${v} в ответе ${q.resultLatex}`).toBe(false);
              continue;
            }
            expect(Math.abs(r), `${cat}: ${q.exprLatex} на границе ${v}`).toBeLessThan(1e-9);
            expect(contains(q.solution, v, 0),
              `${cat}: ${q.exprLatex} → ${q.resultLatex}`).toBe(loose);
          }
        }
      }
    }
  });

  it('«сколько целых» и «наименьшее/наибольшее целое» отвечают числом', () => {
    for (const cat of ['countIntegers', 'leastInteger', 'greatestInteger']) {
      for (const q of onlyCategory(cat, 12)) {
        expect(Number.isInteger(Number(q.resultLatex)), `${cat}: ${q.resultLatex}`).toBe(true);
        if (cat === 'countIntegers') {
          expect(isBounded(q.solution)).toBe(true);
          const ints = [];
          for (let x = -200; x <= 200; x++) if (contains(q.solution, x)) ints.push(x);
          expect(ints).toHaveLength(Number(q.resultLatex));
        } else {
          const value = Number(q.resultLatex);
          expect(contains(q.solution, value)).toBe(true);
          const step = cat === 'leastInteger' ? -1 : 1;
          expect(contains(q.solution, value + step)).toBe(false);
        }
      }
    }
  });

  it('область определения: корень — нестрого, логарифм — строго', () => {
    for (const q of onlyCategory('domainSqrt', 10)) {
      expect(q.exprLatex).toContain('\\sqrt{');
      expect(q.solution.pieces.length).toBeGreaterThan(0);
    }
    for (const q of onlyCategory('domainLog', 10)) {
      expect(q.exprLatex).toContain('\\log_');
      for (const p of q.solution.pieces) {
        expect(p.loOpen).toBe(true);
        expect(p.hiOpen).toBe(true);
      }
    }
  });

  it('настройка «только целые корни» не пускает дробные границы', () => {
    const questions = allCategories(60, { rootKind: 'integer' });
    for (const q of questions) {
      for (const p of q.solution.pieces) {
        for (const b of [p.lo, p.hi]) {
          if (b) expect(b.p.d, `${q.cat}: ${q.resultLatex}`).toBe(1);
        }
      }
    }
  });

  it('настройка знаков сужает выбор', () => {
    for (const q of allCategories(40, { opsMode: 'strict' })) {
      if (ASK_CATS.has(q.cat)) continue;
      expect(/\\leqslant|\\geqslant/.test(q.exprLatex), q.exprLatex).toBe(false);
    }
  });

  it('решение и напечатанное неравенство сходятся по внутренней проверке', () => {
    // Та же проверка, которой пользуется генератор, — на заведомо неверном ответе
    const display = { numer: [fLin(1, -2), fLin(1, 5)], denom: [] };
    const right = solveIntervalMethod(display, 'lt');
    expect(verifyIntervalSolution(display, 'lt', right)).toBe(true);
    expect(verifyIntervalSolution(display, 'gt', right)).toBe(false);
  });
});
