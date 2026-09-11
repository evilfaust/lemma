import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateOralCountingVariants,
  CATEGORY_LABELS,
  CATEGORY_GROUPS_ORAL,
  DEFAULT_SETTINGS,
} from '../hooks/useOralCounting';
import { FSU_KEYS } from '../utils/shortMultiplication';
import {
  isIntegerAnswer, hasNegativeNumber, toImproperFraction,
} from '../utils/oralAnswerFilter';

const CATS = Object.keys(CATEGORY_LABELS);

function onlyCategory(cat, count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, k === cat]));
  const [questions] = generateOralCountingVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

function allCategories(count, extra = {}) {
  const categories = Object.fromEntries(CATS.map(k => [k, true]));
  const [questions] = generateOralCountingVariants({
    variantsCount: 1, questionsCount: count, categories, ...extra,
  });
  return questions || [];
}

// ─── Независимый счёт по напечатанному условию ──────────────────────────────
// Проверяем не «что генератор думал», а что написано в задании.
// \dfrac{A}{B} → ((A)/(B)) с учётом вложенных фигурных скобок («2{,}5»)
function expandFracs(tex) {
  const i = tex.indexOf('\\dfrac{');
  if (i === -1) return tex;

  const readBraced = (start) => {
    let depth = 0;
    for (let j = start; j < tex.length; j++) {
      if (tex[j] === '{') depth++;
      else if (tex[j] === '}') {
        depth--;
        if (depth === 0) return { body: tex.slice(start + 1, j), end: j };
      }
    }
    throw new Error(`несбалансированные скобки: ${tex}`);
  };

  const numer = readBraced(i + '\\dfrac'.length);
  if (tex[numer.end + 1] !== '{') throw new Error(`нет знаменателя: ${tex}`);
  const denom = readBraced(numer.end + 1);
  return expandFracs(
    `${tex.slice(0, i)}((${expandFracs(numer.body)})/(${expandFracs(denom.body)}))${tex.slice(denom.end + 1)}`,
  );
}

function evalPlain(rawTex) {
  const tex = expandFracs(rawTex);
  let e = tex
    .replace(/\\left\|([^|]*)\\right\|/g, (_, body) => `Math.abs(${evalPlain(body)})`)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\{,\}/g, '.')
    .replace(/:/g, '/')
    .replace(/\s+/g, '');

  // Степени: 13^2, 2^{10}, (-4)^3
  for (let guard = 0; guard < 20 && e.includes('^'); guard++) {
    const i = e.indexOf('^');
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
    const m = e.slice(i + 1).match(/^\{?(\d+)\}?/);
    if (!m) throw new Error(`не разобрана степень: ${rawTex}`);
    e = `${e.slice(0, start)}Math.pow(${e.slice(start, i)},${m[1]})${e.slice(i + 1 + m[0].length)}`;
  }

  if (!/^[-+*/()., \dMathpowabs]+$/.test(e)) throw new Error(`не разобрано: ${rawTex} → ${e}`);
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

describe('устный счёт → арифметика: состав листа', () => {
  it('каждая категория объявлена в лейблах, блоках и дефолтных настройках', () => {
    const inBlocks = CATEGORY_GROUPS_ORAL.flatMap(g => g.keys);
    expect(new Set(inBlocks)).toEqual(new Set(CATS));
    expect(inBlocks, 'категория объявлена ровно в одном блоке')
      .toHaveLength(new Set(inBlocks).size);
    for (const cat of CATS) {
      expect(typeof CATEGORY_LABELS[cat], cat).toBe('string');
      expect(DEFAULT_SETTINGS.categories, cat).toHaveProperty(cat);
    }
  });

  it('шесть блоков; новые выключены по умолчанию, прежний состав листа цел', () => {
    expect(CATEGORY_GROUPS_ORAL).toHaveLength(6);
    const on = ['fracTimesInt', 'intDivFrac', 'fracDivInt', 'fracDivFrac',
      'timesReciprocal', 'mixedArith', 'decimalPower', 'mulPow10',
      'decimalDiv', 'decimalSimple', 'negSigns'];
    for (const cat of on) expect(DEFAULT_SETTINGS.categories[cat], cat).toBe(true);
    const off = ['intOrder', 'mulRound', 'intPowers', 'absValue', 'signProduct',
      'percentOf', 'percentOfDec', 'partOfNumber', ...FSU_KEYS];
    for (const cat of off) expect(DEFAULT_SETTINGS.categories[cat], cat).toBe(false);
  });

  it('каждая категория выдаёт запрошенное число заданий', () => {
    for (const cat of CATS) {
      expect(onlyCategory(cat, 15), cat).toHaveLength(15);
    }
  });

  it('условие рендерится KaTeX, ответ — непустая строка', () => {
    for (const cat of CATS) {
      for (const q of onlyCategory(cat, 40)) {
        expect(() => katex.renderToString(q.exprLatex, { throwOnError: true }),
          `${cat}: ${q.exprLatex}`).not.toThrow();
        expect(q.resultLatex, `${cat}`).toMatch(/\S/);
        expect(q.cat, 'задание помнит свою категорию').toBe(cat);
      }
    }
  });
});

describe('новые категории: ответ совпадает с условием', () => {
  const arithmetic = ['intOrder', 'mulRound', 'intPowers', 'absValue', 'signProduct',
    ...FSU_KEYS];

  it('целые, модуль, знаки и ФСУ считаются напрямую', () => {
    for (const cat of arithmetic) {
      for (const q of onlyCategory(cat, 120)) {
        const expected = evalPlain(q.exprLatex);
        const actual = parseAnswer(q.resultLatex);
        expect(Math.abs(actual - expected), `${cat}: ${q.exprLatex} = ${q.resultLatex}`)
          .toBeLessThan(1e-6);
      }
    }
  });

  it('процент и доля от числа', () => {
    for (const q of onlyCategory('percentOf', 150).concat(onlyCategory('percentOfDec', 150))) {
      const m = q.exprLatex.match(/^(\d+)\\% \\text\{ от \} (\S+)$/);
      expect(m, q.exprLatex).not.toBeNull();
      const base = Number(m[2].replace('{,}', '.'));
      const expected = (Number(m[1]) * base) / 100;
      expect(Math.abs(parseAnswer(q.resultLatex) - expected), q.exprLatex).toBeLessThan(1e-9);
    }
    for (const q of onlyCategory('partOfNumber', 150)) {
      const m = q.exprLatex.match(/^\\dfrac\{(\d+)\}\{(\d+)\} \\text\{ от \} (\d+)$/);
      expect(m, q.exprLatex).not.toBeNull();
      // Считаем умножением, а не делением: 7/10 · 90 в double даёт 62,999…
      const expected = (Number(m[1]) * Number(m[3])) / Number(m[2]);
      expect(parseAnswer(q.resultLatex), q.exprLatex).toBe(expected);
    }
  });

  it('ответы не выходят за устный масштаб', () => {
    for (const cat of arithmetic) {
      for (const q of onlyCategory(cat, 80)) {
        expect(Math.abs(parseAnswer(q.resultLatex)), `${cat}: ${q.exprLatex}`)
          .toBeLessThanOrEqual(11500);
      }
    }
  });
});

describe('опции листа', () => {
  it('«только целые ответы» убирает дроби и десятичные', () => {
    const questions = allCategories(26, { integerOnly: true });
    expect(questions).toHaveLength(26);
    for (const q of questions) expect(q.resultLatex, q.exprLatex).toMatch(/^-?\d+$/);
  });

  it('«только целые / десятичные» оставляет конечную десятичную запись', () => {
    const questions = allCategories(26, { decimalOnly: true });
    expect(questions).toHaveLength(26);
    for (const q of questions) {
      expect(q.resultLatex, q.exprLatex).toMatch(/^-?\d+(\{,\}\d+)?$/);
    }
  });

  it('без отрицательных чисел: ни в ответе, ни в условии', () => {
    const questions = allCategories(26, { allowNegative: false });
    expect(questions).toHaveLength(26);
    for (const q of questions) {
      expect(hasNegativeNumber(q.exprLatex, q.resultLatex), q.exprLatex).toBe(false);
    }
  });

  it('«Минусы и скобки» без отрицательных чисел ничего не даёт', () => {
    // Категория целиком про них — включать её вместе с запретом бессмысленно,
    // позиции доберутся другими типами (fallback плана).
    expect(onlyCategory('negSigns', 5, { allowNegative: false })).toHaveLength(0);
  });

  it('неправильная дробь вместо смешанного числа', () => {
    const questions = allCategories(30, { answerForm: 'improper' });
    expect(questions).toHaveLength(30);
    for (const q of questions) {
      expect(q.resultLatex, q.exprLatex).not.toMatch(/^-?\d+\\dfrac/);
    }
  });

  it('по умолчанию дробный ответ — смешанное число', () => {
    const mixed = allCategories(60).filter(q => /^-?\d+\\dfrac/.test(q.resultLatex));
    expect(mixed.length).toBeGreaterThan(0);
  });
});

describe('хелперы фильтра ответов', () => {
  it('isIntegerAnswer', () => {
    expect(isIntegerAnswer('2500')).toBe(true);
    expect(isIntegerAnswer('-7')).toBe(true);
    expect(isIntegerAnswer('0{,}5')).toBe(false);
    expect(isIntegerAnswer('\\dfrac{1}{2}')).toBe(false);
  });

  it('hasNegativeNumber отличает минус числа от вычитания', () => {
    expect(hasNegativeNumber('12 - 4{,}6', '7{,}4')).toBe(false);
    expect(hasNegativeNumber('(13 - 8) \\cdot 6', '30')).toBe(false);
    expect(hasNegativeNumber('4{,}2 - 8', '-3{,}8')).toBe(true);
    expect(hasNegativeNumber('-10 + 2{,}8', '-7{,}2')).toBe(true);
    expect(hasNegativeNumber('3{,}7 + (-6)', '-2{,}3')).toBe(true);
    expect(hasNegativeNumber('(-0{,}5)^3', '-0{,}125')).toBe(true);
  });

  it('toImproperFraction', () => {
    expect(toImproperFraction('1\\dfrac{3}{4}')).toBe('\\dfrac{7}{4}');
    expect(toImproperFraction('-2\\dfrac{1}{3}')).toBe('-\\dfrac{7}{3}');
    expect(toImproperFraction('\\dfrac{2}{3}')).toBe('\\dfrac{2}{3}');
    expect(toImproperFraction('5')).toBe('5');
  });
});
