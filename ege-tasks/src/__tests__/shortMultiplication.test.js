import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  fsuGenerators, fsuRootGenerators, fsuAnswerTex,
  FSU_KEYS, FSU_ROOT_KEYS, FSU_DOMAIN_KEYS,
} from '../utils/shortMultiplication';
import { rat } from '../utils/linearExpr';

// ─── Независимый вычислитель LaTeX ──────────────────────────────────────────
// Разворачивает дроби, корни и степени в обычное JS-выражение: ответ должен
// совпасть с прямым вычислением напечатанного условия, а не с тем, что
// генератор «думает» о своём результате.
function readBraced(tex, start) {          // start указывает на '{'
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

function expandCmd(tex, cmd, build) {
  const i = tex.indexOf(cmd + '{');
  if (i === -1) return tex;
  const first = readBraced(tex, i + cmd.length);
  let second = null;
  if (build.length === 2) {
    if (tex[first.end + 1] !== '{') throw new Error(`нет второго аргумента: ${tex}`);
    second = readBraced(tex, first.end + 1);
  }
  const end = second ? second.end : first.end;

  // Смешанное число: 1\dfrac{1}{2} — целая часть прижата к дроби вплотную,
  // и это сумма, а не произведение. Забираем её в замену вместе с дробью.
  let start = i;
  let head = '';
  if (cmd === '\\dfrac' && /\d/.test(tex[i - 1] || '')) {
    while (start > 0 && /\d/.test(tex[start - 1])) start--;
    head = tex.slice(start, i);
  }

  const body = build(expandAll(first.body), second && expandAll(second.body));
  const replaced =
    tex.slice(0, start) +
    (head ? `(${head}+${body})` : body) +
    tex.slice(end + 1);
  return expandAll(replaced);
}

function expandAll(tex) {
  let out = expandCmd(tex, '\\dfrac', (a, b) => `((${a})/(${b}))`);
  out = expandCmd(out, '\\sqrt', (a) => `(Math.sqrt(${a}))`);
  return out;
}

function evalLatex(tex) {
  let e = expandAll(tex)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\{,\}/g, '.')
    .replace(/\s+/g, '');

  // Степень: 51^2, (…)^2, 1{,}02^2 → Math.pow(...)
  for (let guard = 0; guard < 40 && e.includes('^'); guard++) {
    const i = e.indexOf('^');
    // основание — либо скобка, либо число
    let start = i - 1;
    if (e[start] === ')') {
      let depth = 0;
      for (; start >= 0; start--) {
        if (e[start] === ')') depth++;
        else if (e[start] === '(') { depth--; if (depth === 0) break; }
      }
    } else {
      while (start >= 0 && /[\d.]/.test(e[start])) start--;
      start++;
    }
    const base = e.slice(start, i);
    const m = e.slice(i + 1).match(/^\{?(\d+)\}?/);
    if (!m) throw new Error(`не разобрана степень: ${tex} → ${e}`);
    e = e.slice(0, start) + `Math.pow(${base},${m[1]})` + e.slice(i + 1 + m[0].length);
  }

  e = e.replace(/(\d|\))\(/g, '$1*(').replace(/\)(?=Math)/g, ')*');
  if (!/^[-+*/()., \dMathpowsqrt]+$/.test(e)) throw new Error(`не разобрано: ${tex} → ${e}`);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${e});`)();
}

function parseAnswer(latex) {
  const mixed = latex.match(/^(-?)(\d+)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (mixed) {
    const [, sign, whole, n, d] = mixed;
    const v = Number(whole) + Number(n) / Number(d);
    return sign === '-' ? -v : v;
  }
  const frac = latex.match(/^(-?)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (frac) {
    const [, sign, n, d] = frac;
    const v = Number(n) / Number(d);
    return sign === '-' ? -v : v;
  }
  return Number(latex.replace('{,}', '.'));
}

function sample(gens, cat, count, seenNull = { n: 0 }) {
  const out = [];
  for (let i = 0; i < count * 8 && out.length < count; i++) {
    const q = gens[cat]();
    if (q) out.push(q); else seenNull.n++;
  }
  return out;
}

describe('вычислитель тестов сам по себе', () => {
  it('считает дроби, степени и корни', () => {
    expect(evalLatex('51^2')).toBe(2601);
    expect(evalLatex('\\dfrac{37^2 - 13^2}{37 - 13}')).toBeCloseTo(50, 9);
    expect(evalLatex('1{,}02^2')).toBeCloseTo(1.0404, 9);
    expect(evalLatex('\\left(\\sqrt{7} - \\sqrt{3}\\right)\\left(\\sqrt{7} + \\sqrt{3}\\right)'))
      .toBeCloseTo(4, 9);
    expect(evalLatex('\\left(1\\dfrac{1}{2}\\right)^2')).toBeCloseTo(2.25, 9);
  });
});

describe('формулы сокращённого умножения — числовые домены', () => {
  for (const domain of ['int', 'dec', 'mix']) {
    const gens = fsuGenerators({ domain, style: domain === 'mix' ? 'mix' : 'auto' });
    // Не всякая формула уместна в каждом домене: смешанные числа не возводим
    // в куб, сумма кубов живёт только на целых — набор объявлен в модуле.
    const keys = FSU_DOMAIN_KEYS[domain];

    it(`домен ${domain}: ответ совпадает с вычислением условия`, () => {
      for (const cat of keys) {
        const questions = sample(gens, cat, 120);
        expect(questions.length, cat).toBeGreaterThan(60);
        for (const q of questions) {
          const expected = evalLatex(q.exprLatex);
          const actual = parseAnswer(q.resultLatex);
          expect(Number.isFinite(actual), `${cat}: ${q.resultLatex}`).toBe(true);
          expect(Math.abs(actual - expected), `${cat}: ${q.exprLatex} = ${q.resultLatex}`)
            .toBeLessThan(1e-6);
        }
      }
    });

    it(`домен ${domain}: условие рендерится KaTeX`, () => {
      for (const cat of keys) {
        for (const q of sample(gens, cat, 40)) {
          expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
            `${cat}: ${q.exprLatex}`).not.toThrow();
        }
      }
    });
  }

  it('десятичный домен даёт только десятичные ответы', () => {
    const gens = fsuGenerators({ domain: 'dec', style: 'dec' });
    for (const cat of FSU_DOMAIN_KEYS.dec) {
      for (const q of sample(gens, cat, 60)) {
        expect(q.resultLatex, `${cat}: ${q.resultLatex}`).toMatch(/^-?\d+(\{,\}\d+)?$/);
      }
    }
  });
});

describe('формулы сокращённого умножения — корни', () => {
  const gens = fsuRootGenerators({ style: 'auto' });

  it('иррациональность уходит: ответ рациональный и совпадает с условием', () => {
    for (const cat of FSU_ROOT_KEYS) {
      const questions = sample(gens, cat, 120);
      expect(questions.length, cat).toBeGreaterThan(60);
      for (const q of questions) {
        const expected = evalLatex(q.exprLatex);
        const actual = parseAnswer(q.resultLatex);
        expect(Math.abs(actual - expected), `${cat}: ${q.exprLatex} = ${q.resultLatex}`)
          .toBeLessThan(1e-6);
        expect(q.resultLatex, `${cat}: ${q.resultLatex}`).toMatch(/^-?\d+$/);
      }
    }
  });

  it('условие рендерится KaTeX', () => {
    for (const cat of FSU_ROOT_KEYS) {
      for (const q of sample(gens, cat, 40)) {
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
          `${cat}: ${q.exprLatex}`).not.toThrow();
      }
    }
  });
});

describe('fsuAnswerTex', () => {
  it('целое печатается без дроби', () => {
    expect(fsuAnswerTex(rat(2500))).toBe('2500');
    expect(fsuAnswerTex(rat(-7))).toBe('-7');
  });

  it('короткая десятичная запись предпочтительнее дроби', () => {
    expect(fsuAnswerTex(rat(2601, 100))).toBe('26{,}01');
    expect(fsuAnswerTex(rat(1, 2))).toBe('0{,}5');
  });

  it('смешанное число, когда десятичной записи нет', () => {
    expect(fsuAnswerTex(rat(32, 9))).toBe('3\\dfrac{5}{9}');
    expect(fsuAnswerTex(rat(15, 4), 'mix')).toBe('3\\dfrac{3}{4}');
    expect(fsuAnswerTex(rat(-5, 3))).toBe('-1\\dfrac{2}{3}');
  });

  it('стиль dec отбрасывает бесконечную дробь', () => {
    expect(fsuAnswerTex(rat(1, 3), 'dec')).toBe(null);
  });
});

// ─── Подключение к разделам устного счёта ────────────────────────────────────
describe('ФСУ в разделах устного счёта', () => {
  it('арифметика: целые и десятичные, блок выключен по умолчанию', async () => {
    const m = await import('../hooks/useOralCounting');
    for (const cat of FSU_KEYS) {
      expect(m.CATEGORY_LABELS, cat).toHaveProperty(cat);
      expect(m.DEFAULT_SETTINGS.categories[cat], cat).toBe(false);
    }
    const block = m.CATEGORY_GROUPS_ORAL.find(g => g.keys === FSU_KEYS
      || g.keys.every(k => FSU_KEYS.includes(k)) && g.keys.length === FSU_KEYS.length);
    expect(block?.label).toContain('сокращённого умножения');
  });

  it('десятичные: без суммы кубов, ответы десятичные', async () => {
    const m = await import('../hooks/useOralEgeBase');
    const { FSU_DEC_KEYS } = await import('../utils/shortMultiplication');
    expect(FSU_DEC_KEYS).not.toContain('fsuQuotCubes');
    for (const cat of FSU_DEC_KEYS) {
      expect(m.CATEGORY_LABELS_EGE, cat).toHaveProperty(cat);
      expect(m.DEFAULT_SETTINGS_EGE.categories[cat], cat).toBe(false);

      const categories = Object.fromEntries(
        Object.keys(m.CATEGORY_LABELS_EGE).map(k => [k, k === cat]));
      const [questions] = m.generateEgeBaseVariants({
        variantsCount: 1, questionsCount: 10, categories,
      });
      expect(questions, cat).toHaveLength(10);
      for (const q of questions) {
        expect(q.resultLatex, `${cat}: ${q.exprLatex}`).toMatch(/^-?\d+(\{,\}\d+)?$/);
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
      }
    }
  });

  it('обыкновенные дроби: смешанные числа', async () => {
    const m = await import('../hooks/useOralFractions');
    const { FSU_MIX_KEYS } = await import('../utils/shortMultiplication');
    for (const cat of FSU_MIX_KEYS) {
      expect(m.CATEGORY_LABELS_FR, cat).toHaveProperty(cat);
      expect(m.DEFAULT_SETTINGS_FR.categories[cat], cat).toBe(false);

      const categories = Object.fromEntries(
        Object.keys(m.CATEGORY_LABELS_FR).map(k => [k, k === cat]));
      const [questions] = m.generateFractionsVariants({
        variantsCount: 1, questionsCount: 10, categories,
      });
      expect(questions, cat).toHaveLength(10);
      for (const q of questions) {
        const expected = evalLatex(q.exprLatex);
        expect(Math.abs(parseAnswer(q.resultLatex) - expected),
          `${cat}: ${q.exprLatex} = ${q.resultLatex}`).toBeLessThan(1e-6);
        // Неправильных дробей в ответе нет — только целое или смешанное число
        expect(q.resultLatex, q.exprLatex).not.toMatch(/^\\dfrac\{\d+\}\{\d+\}$/);
      }
    }
  });

  it('степени и корни: ответ рациональный', async () => {
    const m = await import('../hooks/useOralPowersRoots');
    for (const cat of FSU_ROOT_KEYS) {
      expect(m.CATEGORY_LABELS_PR, cat).toHaveProperty(cat);
      expect(m.DEFAULT_SETTINGS_PR.categories[cat], cat).toBe(false);

      const categories = Object.fromEntries(
        Object.keys(m.CATEGORY_LABELS_PR).map(k => [k, k === cat]));
      const [questions] = m.generatePowersRootsVariants({
        variantsCount: 1, questionsCount: 10, categories,
      });
      expect(questions, cat).toHaveLength(10);
      for (const q of questions) {
        expect(q.resultLatex, `${cat}: ${q.exprLatex}`).toMatch(/^-?\d+$/);
        const expected = evalLatex(q.exprLatex);
        expect(Math.abs(parseAnswer(q.resultLatex) - expected),
          `${cat}: ${q.exprLatex} = ${q.resultLatex}`).toBeLessThan(1e-6);
      }
    }
  });

  it('смешанная работа берёт дефолты раздела, а не «всё включено»', async () => {
    const { getOralType } = await import('../hooks/oralMixedRegistry');
    for (const type of ['oral_counting', 'ege_base', 'fractions', 'powers_roots']) {
      const meta = getOralType(type);
      const fsuOn = Object.entries(meta.defaultCategories)
        .filter(([k, v]) => v && k.startsWith('fsu'));
      expect(fsuOn, `${type}: ФСУ не должны включаться сами`).toHaveLength(0);
    }
  });
});
