/**
 * Сторож ответов устного счёта: каждое задание всех разделов на всех трёх
 * уровнях пересчитывается независимым вычислителем по НАПЕЧАТАННОМУ
 * условию. Ручные образцы набирались руками — здесь ловятся опечатки в
 * ответах; параметрические генераторы держатся тем же сторожем.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { evalTex, answerMatches, close } from './helpers/texEval';
import { generateOralCountingVariants, DEFAULT_SETTINGS } from '../hooks/useOralCounting';
import { generateEgeBaseVariants } from '../hooks/useOralEgeBase';
import { generateFractionsVariants } from '../hooks/useOralFractions';
import { generatePowersRootsVariants } from '../hooks/useOralPowersRoots';
import { generateLogarithmsVariants } from '../hooks/useOralLogarithms';
import { generateLogExpVariants } from '../hooks/useLogExpEquations';
import { LOG_GENERATORS, LOG_EXAM, LOG_LABELS } from '../utils/oral/logarithms';
import { POW_GENERATORS, POW_EXAM, POW_LABELS } from '../utils/oral/powers';
import { DEC_GENERATORS, DEC_EXAM, DEC_LABELS } from '../utils/oral/decimals';
import { FR_GENERATORS, FR_EXAM, FR_LABELS } from '../utils/oral/fractions';
import { LOGEXP_GENERATORS, LOGEXP_EXAM, LOGEXP_LABELS } from '../utils/oral/logexp';
import {
  EXAM_TAG_TITLES, categoriesForExam, hasExam, levelOf, tagsOf,
} from '../utils/oral/levels';
import { byExpr } from '../utils/questionPlan';

const allOn = (cats) => Object.fromEntries(Object.keys(cats).map(k => [k, true]));

const SECTIONS = {
  'арифметика': (s) => generateOralCountingVariants({ ...s, categories: allOn(DEFAULT_SETTINGS.categories) }),
  'действия с десятичными': generateEgeBaseVariants,
  'обыкновенные дроби': generateFractionsVariants,
  'степени и корни': generatePowersRootsVariants,
  'логарифмы': generateLogarithmsVariants,
  'показательные и логарифмические уравнения': generateLogExpVariants,
};

const MODULES = {
  'логарифмы': [LOG_GENERATORS, LOG_EXAM, LOG_LABELS],
  'степени и корни': [POW_GENERATORS, POW_EXAM, POW_LABELS],
  'десятичные': [DEC_GENERATORS, DEC_EXAM, DEC_LABELS],
  'дроби': [FR_GENERATORS, FR_EXAM, FR_LABELS],
  'уравнения': [LOGEXP_GENERATORS, LOGEXP_EXAM, LOGEXP_LABELS],
};

// Задания словами («20 % от 45», «если log_a b = 3», «при a = 5») вычислитель
// не читает — для них ниже свои проверки
const isWordy = (q) => /\\text|\\%|(?<![\\a-z])[ab](?![a-z])/.test(q.exprLatex);

function collect(generate, level, rounds = 3) {
  const tasks = new Map();
  for (let r = 0; r < rounds; r++) {
    for (const v of generate({ variantsCount: 32, questionsCount: 30, level })) {
      for (const q of v) tasks.set(q.exprLatex, q);
    }
  }
  return [...tasks.values()];
}

describe('вычислитель для тестов', () => {
  it('понимает запись листов', () => {
    expect(evalTex('2\\dfrac{1}{3} + \\dfrac{2}{3}')).toBeCloseTo(3);
    expect(evalTex('-1\\dfrac{1}{2} \\cdot 4')).toBeCloseTo(-6);
    expect(evalTex('\\left(0{,}5 - 1{,}5\\right) : 0{,}8')).toBeCloseTo(-1.25);
    expect(evalTex('\\sqrt[3]{-\\dfrac{8}{125}}')).toBeCloseTo(-0.4);
    expect(evalTex('\\log_{2} 8 + \\lg 100')).toBeCloseTo(5);
    expect(evalTex('\\log_4 \\dfrac{1}{64}')).toBeCloseTo(-3);
    expect(evalTex('\\log_{2} \\left(5\\sqrt{2}\\right)')).toBeCloseTo(Math.log2(5 * Math.SQRT2));
    expect(evalTex('2\\sqrt{3} \\cdot \\sqrt{3}')).toBeCloseTo(6);
    expect(evalTex('27^{\\frac{2}{3}}')).toBeCloseTo(9);
    expect(answerMatches('\\log_x 27 = 3', '3')).toBe(true);
    expect(answerMatches('\\log_{x - 7} 64 = 2', '15')).toBe(true);
    expect(answerMatches('2^{x - 1} = 8', 'x = 4')).toBe(true);
  });
});

describe('ответы всех разделов сходятся с условием — на всех уровнях', () => {
  for (const [name, generate] of Object.entries(SECTIONS)) {
    for (const level of [1, 2, 3]) {
      it(`${name}, уровень ${level}`, () => {
        const wrong = [];
        for (const q of collect(generate, level)) {
          if (isWordy(q)) continue;
          let ok;
          try { ok = answerMatches(q.exprLatex, q.resultLatex); }
          catch (e) { ok = false; q.resultLatex += `  [${e.message}]`; }
          if (!ok) wrong.push(`${q.cat}: ${q.exprLatex} → ${q.resultLatex}`);
        }
        expect(wrong).toEqual([]);
      });
    }
  }
});

describe('KaTeX печатает каждое задание и ответ', () => {
  for (const [name, generate] of Object.entries(SECTIONS)) {
    it(name, () => {
      const broken = [];
      for (const level of [1, 2, 3]) {
        for (const q of collect(generate, level, 1)) {
          for (const tex of [q.exprLatex, q.resultLatex]) {
            try { katex.renderToString(tex, { throwOnError: true }); }
            catch (e) { broken.push(`${tex}: ${e.message}`); }
          }
        }
      }
      expect(broken).toEqual([]);
    });
  }
});

describe('задания со словами', () => {
  it('log_a(a^m b^n), если log_a b = k', () => {
    for (const level of [1, 2, 3]) {
      for (let i = 0; i < 300; i++) {
        const q = LOG_GENERATORS.logParam(level);
        if (!q) continue;
        const k = Number(/=\s*(-?\d+)$/.exec(q.exprLatex)[1]);
        // вместо a — основание 2, вместо b — 2^k: тогда log_a b = k
        const expr = q.exprLatex
          .replace(/,\\ \\text\{если\}.*$/, '')
          .replace(/ab/g, 'a \\cdot b')
          .replace(/\\log_\{a\}/, '\\log_{2}')
          .replace(/(?<![\\a-z])a(?![a-z])/g, '2')
          .replace(/(?<![\\a-z])b(?![a-z])/g, `\\left(2^{${k}}\\right)`);
        expect(close(evalTex(expr), evalTex(q.resultLatex)), q.exprLatex).toBe(true);
      }
    }
  });

  it('степени при a = …: подстановка числа', () => {
    for (const level of [1, 2, 3]) {
      for (let i = 0; i < 300; i++) {
        const q = POW_GENERATORS.powerAtValue(level);
        if (!q) continue;
        const m = /a = (\d+)$/.exec(q.exprLatex);
        const a = m ? m[1] : '3';   // уровень 3: от a не зависит — любое
        const expr = q.exprLatex
          .replace(/\\ \\text\{при\}.*$/, '')
          .replace(/,\\ a \\neq 0$/, '')
          .replace(/(\d)a/g, '$1 \\cdot a')
          .replace(/(?<![\\a-z])a(?![a-z])/g, `(${a})`);
        expect(close(evalTex(expr), evalTex(q.resultLatex)), q.exprLatex).toBe(true);
      }
    }
  });
});

describe('каждый тип даёт задания на каждом уровне', () => {
  for (const [name, [gens]] of Object.entries(MODULES)) {
    it(name, () => {
      const dead = [];
      for (const [cat, g] of Object.entries(gens)) {
        for (const level of [1, 2, 3]) {
          let got = 0;
          for (let i = 0; i < 200 && got < 3; i++) if (g(level)) got++;
          if (got < 3) dead.push(`${cat} L${level}`);
        }
      }
      expect(dead).toEqual([]);
    });
  }
});

describe('метки экзаменов', () => {
  it('только известные метки и только существующие типы', () => {
    for (const [, [gens, exam, labels]] of Object.entries(MODULES)) {
      for (const cat of Object.keys(exam)) {
        expect(gens[cat], cat).toBeTypeOf('function');
        for (const tag of tagsOf(exam, cat)) expect(EXAM_TAG_TITLES[tag], tag).toBeTruthy();
      }
      for (const cat of Object.keys(gens)) expect(labels[cat], cat).toBeTruthy();
    }
  });

  it('«Готовлю к» отмечает ровно типы этого экзамена', () => {
    const keys = Object.keys(POW_GENERATORS);
    const cats = categoriesForExam(keys, POW_EXAM, 'О', {});
    expect(cats.rootOfProduct).toBe(true);        // только ОГЭ №8
    expect(cats.sqrtDiffSquares).toBe(false);     // только профиль
    expect(cats.nestedRoot).toBe(false);          // без метки
    expect(hasExam(LOGEXP_EXAM, 'О')).toBe(false);
    expect(hasExam(LOGEXP_EXAM, 'П')).toBe(true);
  });

  it('уровень по умолчанию — «как на экзамене», старые листы его не знают', () => {
    expect(levelOf({})).toBe(2);
    expect(levelOf({ level: 1 })).toBe(1);
    expect(levelOf({ level: '7' })).toBe(2);
  });
});

describe('повторы', () => {
  for (const [name, generate] of Object.entries(SECTIONS)) {
    it(`${name}: в варианте нет одинаковых примеров ни на каком уровне`, () => {
      for (const level of [1, 2, 3]) {
        for (const v of generate({ variantsCount: 4, questionsCount: 20, level })) {
          expect(new Set(v.map(byExpr)).size).toBe(v.length);
        }
      }
    });
  }

  for (const [name, generate] of Object.entries(SECTIONS)) {
    if (name === 'арифметика') continue;
    it(`${name}: на 16 вариантах «как на экзамене» повторов меньше 5 %`, () => {
      const all = generate({ variantsCount: 16, questionsCount: 20, level: 2 }).flat().map(byExpr);
      const repeats = all.length - new Set(all).size;
      expect(repeats / all.length).toBeLessThan(0.05);
    });
  }
});
