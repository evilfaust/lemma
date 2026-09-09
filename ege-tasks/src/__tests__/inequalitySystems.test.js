import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateLinearSystemVariants,
  linsysInstruction,
  CATEGORY_LABELS_LINSYS,
  CATEGORY_GROUPS_LINSYS,
  DEFAULT_SETTINGS_LINSYS,
} from '../hooks/useLinearSystems';
import {
  generateQuadraticSystemVariants,
  qsysInstruction,
  CATEGORY_LABELS_QSYS,
  CATEGORY_GROUPS_QSYS,
  DEFAULT_SETTINGS_QSYS,
} from '../hooks/useQuadraticSystems';
import { contains } from '../utils/quadraticInequality';
import { OPS } from '../utils/inequalityCore';

// ─── Независимый разбор напечатанного условия ────────────────────────────────
// Условие читается из LaTeX и вычисляется само по себе, без решателя: если
// ответ разойдётся с системой, тест это увидит.
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
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '')
    .replace(/\^(\d)/g, '**$1')
    .replace(new RegExp(`([\\d)])(?=${varName})`, 'g'), '$1*')
    .replace(/([\d)])(?=\()/g, '$1*');
  e = e.replace(new RegExp(varName, 'g'), `(${xValue})`);
  e = e.replace(/(^|[-+*/(])-(?=\()/g, '$1(-1)*');   // JS не даёт унарный минус перед **
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

const OP_TOKENS = [['\\leqslant', 'le'], ['\\geqslant', 'ge'], ['<', 'lt'], ['>', 'gt']];

function splitInequality(tex) {
  for (const [token, op] of OP_TOKENS) {
    const i = tex.indexOf(token);
    if (i === -1) continue;
    return { op, left: tex.slice(0, i), right: tex.slice(i + token.length) };
  }
  throw new Error(`знак не найден: ${tex}`);
}

/** Система из напечатанного условия: сами неравенства и «и» это или «или» */
function parseSystem(exprLatex) {
  const isOr = exprLatex.includes('\\begin{array}');
  const body = exprLatex
    .replace(/^\\begin\{cases\}/, '')
    .replace(/\\end\{cases\}[\s\S]*$/, '')
    .replace(/^\\left\[\\begin\{array\}\{l\}/, '')
    .replace(/\\end\{array\}\\right\.[\s\S]*$/, '');
  return { isOr, parts: body.split('\\\\').map(splitInequality) };
}

/** Выполняется ли система при данном x — по напечатанному условию */
function systemHolds(system, varName, x) {
  const one = (part) => {
    const diff = evalSide(part.left, varName, x) - evalSide(part.right, varName, x);
    return OPS[part.op].test(Math.abs(diff) < 1e-9 ? 0 : diff, 0);
  };
  return system.isOr ? system.parts.some(one) : system.parts.every(one);
}

/** Точки, на которых ловятся ошибки знака и строгости: границы и их окрестности */
function probesFor(solution) {
  const bounds = solution.pieces
    .flatMap(p => [p.lo, p.hi])
    .filter(Boolean)
    .map(b => (b.p ? b.p.n / b.p.d + (b.q ? (b.q.n / b.q.d) * Math.sqrt(b.m) : 0) : NaN))
    .filter(Number.isFinite);
  const probes = [-100, -13.5, -0.5, 0, 0.5, 13.5, 100];
  for (const b of bounds) probes.push(b, b - 0.01, b + 0.01, b - 1, b + 1);
  for (let x = -25; x <= 25; x++) probes.push(x);
  return probes;
}

// ─── Помощники ───────────────────────────────────────────────────────────────
const GENS = [
  {
    name: 'системы линейных неравенств',
    generate: generateLinearSystemVariants,
    labels: CATEGORY_LABELS_LINSYS,
    groups: CATEGORY_GROUPS_LINSYS,
    defaults: DEFAULT_SETTINGS_LINSYS,
    instruction: linsysInstruction,
  },
  {
    name: 'системы квадратных неравенств',
    generate: generateQuadraticSystemVariants,
    labels: CATEGORY_LABELS_QSYS,
    groups: CATEGORY_GROUPS_QSYS,
    defaults: DEFAULT_SETTINGS_QSYS,
    instruction: qsysInstruction,
  },
];

const onlyCategory = (gen, cat, count, extra = {}) => {
  const categories = Object.fromEntries(Object.keys(gen.labels).map(k => [k, k === cat]));
  const [questions] = gen.generate({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
};

const allCategories = (gen, count, extra = {}) => {
  const categories = Object.fromEntries(Object.keys(gen.labels).map(k => [k, true]));
  const [questions] = gen.generate({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
};

for (const gen of GENS) {
  describe(gen.name, () => {
    const CATS = Object.keys(gen.labels);
    const ASK_CATS = new Set(gen.groups[gen.groups.length - 1].keys);

    it('каждая категория объявлена в лейблах, блоках и настройках', () => {
      const inGroups = gen.groups.flatMap(g => g.keys);
      expect(new Set(inGroups)).toEqual(new Set(CATS));
      expect(inGroups).toHaveLength(new Set(inGroups).size);
      for (const cat of CATS) {
        expect(typeof gen.labels[cat], cat).toBe('string');
        expect(gen.defaults.categories, cat).toHaveProperty(cat);
      }
    });

    it('каждая категория выдаёт запрошенное число заданий', () => {
      for (const cat of CATS) {
        expect(onlyCategory(gen, cat, 12), cat).toHaveLength(12);
      }
    });

    it('условие и ответ рендерятся KaTeX', () => {
      for (const q of allCategories(gen, 120, { level: 3 })) {
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
          `${q.cat}: ${q.exprLatex}`).not.toThrow();
        expect(() => katex.renderToString(q.resultLatex, { throwOnError: true }),
          `${q.cat}: ${q.resultLatex}`).not.toThrow();
      }
    });

    it('ответ совпадает с самой системой в пробных точках', () => {
      for (const cat of CATS) {
        for (const q of onlyCategory(gen, cat, 25)) {
          const system = parseSystem(q.exprLatex);
          for (const x of probesFor(q.solution)) {
            expect(systemHolds(system, q.varLatex, x), `${cat}: ${q.exprLatex} при x = ${x}`)
              .toBe(contains(q.solution, x));
          }
        }
      }
    });

    it('система печатается фигурной скобкой, совокупность — квадратной', () => {
      for (const q of allCategories(gen, 60)) {
        const isUnion = q.cat.startsWith('union');
        expect(q.exprLatex.includes('\\begin{array}'), `${q.cat}: ${q.exprLatex}`).toBe(isUnion);
        expect(q.exprLatex.includes('\\begin{cases}'), `${q.cat}: ${q.exprLatex}`).toBe(!isUnion);
      }
    });

    it('вопрос о целых решениях сходится с перебором по ответу', () => {
      for (const cat of ASK_CATS) {
        for (const q of onlyCategory(gen, cat, 10)) {
          const ints = [];
          for (let x = -200; x <= 200; x++) if (contains(q.solution, x)) ints.push(x);
          const expected = cat === 'countIntegers' ? ints.length
            : cat === 'leastInteger' ? ints[0]
            : ints[ints.length - 1];
          expect(Number(q.resultLatex), `${cat}: ${q.exprLatex}`).toBe(expected);
        }
      }
    });

    it('«только строгие знаки» убирает ⩽ и ⩾, «только нестрогие» — < и >', () => {
      for (const q of allCategories(gen, 40, { opsMode: 'strict' })) {
        expect(q.exprLatex, q.cat).not.toMatch(/leqslant|geqslant/);
      }
      for (const q of allCategories(gen, 40, { opsMode: 'loose' })) {
        // «<» встречается только внутри команд \leqslant — сравниваем очищенное
        expect(q.exprLatex.replace(/\\[a-z]+/g, ''), q.cat).not.toMatch(/[<>]/);
      }
    });

    it('«целые границы» не пускают дроби в ответ', () => {
      for (const q of allCategories(gen, 60, { boundKind: 'integer' })) {
        expect(q.resultLatex, `${q.cat}: ${q.resultLatex}`).not.toContain('dfrac');
      }
    });

    it('форма ответа переключается между промежутками и неравенствами', () => {
      const interval = allCategories(gen, 30, { answerForm: 'interval' });
      const inequality = allCategories(gen, 30, { answerForm: 'inequality' });
      expect(interval.some(q => /\\left[([]/.test(q.resultLatex))).toBe(true);
      expect(inequality.some(q => q.resultLatex.includes(q.varLatex))).toBe(true);
    });

    it('строка-инструкция меняется вместе с набором категорий', () => {
      const plain = Object.fromEntries(gen.groups[0].keys.map(k => [k, true]));
      expect(gen.instruction(plain)).toBe('Решите систему:');
      expect(gen.instruction({ ...plain, [[...ASK_CATS][0]]: true })).toBe('Выполните задания:');
    });
  });
}

// ─── Виды ответов, ради которых всё затевалось ───────────────────────────────
describe('линейные системы: формы ответа', () => {
  const one = (cat, n = 8, extra) => onlyCategory(GENS[0], cat, n, extra);

  it('полоса, луч, пустое множество и точка', () => {
    for (const q of one('band')) expect(q.solution.pieces).toHaveLength(1);
    for (const q of one('emptyBand')) expect(q.resultLatex).toBe('\\varnothing');
    for (const q of one('point')) expect(q.resultLatex).toMatch(/\\left\\\{/);
    for (const q of one('sameSide')) {
      const p = q.solution.pieces[0];
      expect(p.lo === null || p.hi === null).toBe(true);      // луч уходит в бесконечность
    }
  });

  it('совокупность даёт два куска, а перекрывающаяся — всю прямую', () => {
    for (const q of one('unionRays')) expect(q.solution.pieces).toHaveLength(2);
    for (const q of one('unionAll')) expect(q.resultLatex).toMatch(/infty; \+\\infty/);
  });

  it('вырожденная часть не мешает: «всегда верно» оставляет второе условие', () => {
    for (const q of one('alwaysPart')) {
      expect(q.resultLatex).not.toBe('\\varnothing');
      expect(q.solution.pieces).toHaveLength(1);
    }
    for (const q of one('neverPart')) expect(q.resultLatex).toBe('\\varnothing');
  });

  it('три неравенства в системе печатаются тремя строками', () => {
    for (const q of one('threeParts')) {
      expect(q.exprLatex.split('\\\\')).toHaveLength(3);
    }
  });
});

describe('квадратные системы: формы ответа', () => {
  const one = (cat, n = 8, extra) => onlyCategory(GENS[1], cat, n, extra);

  it('квадратное «наружу» с ограничением даёт два промежутка', () => {
    for (const q of one('pureOutAndBand')) expect(q.solution.pieces).toHaveLength(2);
  });

  it('две точки печатаются множеством, а не двумя отрезками', () => {
    for (const q of one('twoPoints')) {
      expect(q.resultLatex).toMatch(/\\left\\\{.*;.*\\right\\\}/);
      expect(q.resultLatex).not.toContain('cup');
    }
  });

  it('(x − a)² ⩽ 0 вместе с ограничением даёт единственную точку', () => {
    for (const q of one('squarePoint')) {
      expect(q.solution.pieces).toHaveLength(1);
      const p = q.solution.pieces[0];
      expect(p.loOpen).toBe(false);
      expect(p.hiOpen).toBe(false);
    }
  });

  it('несовместная пара не имеет решений', () => {
    for (const q of one('emptyPair')) expect(q.resultLatex).toBe('\\varnothing');
  });

  it('дробные границы печатаются обыкновенной дробью', () => {
    const qs = one('fracBounds', 10);
    expect(qs.some(q => q.resultLatex.includes('dfrac'))).toBe(true);
  });

  it('уровень сложности меняет размах чисел', () => {
    const big = (qs) => Math.max(...qs.flatMap(q => (q.exprLatex.match(/\d+/g) || []).map(Number)));
    const easy = big(allCategories(GENS[1], 40, { level: 1 }));
    const hard = big(allCategories(GENS[1], 40, { level: 3 }));
    expect(hard).toBeGreaterThan(easy);
  });
});
