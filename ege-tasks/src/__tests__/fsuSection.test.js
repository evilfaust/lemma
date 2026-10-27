/**
 * Сторож раздела «Формулы сокращённого умножения»: каждое задание на всех
 * уровнях пересчитывается подстановкой чисел в НАПЕЧАТАННЫЕ условие и
 * ответ; ошибки-дистракторы теста A/B/C/D обязаны с ответом НЕ совпадать.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { evalAlg, sameAlg } from './helpers/algTexEval';
import { answerMatches } from './helpers/texEval';
import {
  num, mono, add, mul, pow, sqrt, tex, sub, equal,
} from '../utils/oral/fsuAlgebra';
import {
  FSU_SECTION_GENERATORS, FSU_SECTION_LABELS, FSU_SECTION_GROUPS, fsuInstruction,
} from '../utils/oral/fsu';
import { generateFsuVariants, DEFAULT_SETTINGS_FSU } from '../hooks/useOralFsu';
import { byExpr } from '../utils/questionPlan';

const NUMERIC = new Set(['numSquare', 'numConj', 'numDiffSq', 'numFold', 'numQuot', 'numRoots']);
const BOX = /\\square/g;

/** Пропуски: подставить ответ в квадратики и проверить тождество. */
function fillHolds(exprLatex, answer) {
  const parts = answer.split(/;\\ /);
  let k = 0;
  const filled = exprLatex.replace(BOX, () => `\\left(${parts[k++]}\\right)`);
  if (k !== parts.length) return false;
  const [l, r] = filled.split(' = ');
  return sameAlg(l, r);
}

/** Верно ли задание по напечатанному. */
function holds(cat, q, answer = q.resultLatex) {
  if (NUMERIC.has(cat)) return answerMatches(q.exprLatex, answer);
  if (cat === 'fill') return fillHolds(q.exprLatex, answer);
  // «7 − 4√3 = (…)²»: левая часть против ответа
  const left = q.exprLatex.split(' = ')[0];
  return sameAlg(left, answer);
}

function sample(cat, level, count = 150) {
  const out = [];
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const q = FSU_SECTION_GENERATORS[cat](level);
    if (q) out.push(q);
  }
  return out;
}

describe('алгебра многочленов', () => {
  const x = mono(1, 'x');
  it('квадрат и разность квадратов', () => {
    expect(tex(pow(add(x, num(3)), 2))).toBe('x^2 + 6x + 9');
    expect(tex(pow(add(mono(2, 'a'), mono(-3, 'b')), 2))).toBe('4a^2 - 12ab + 9b^2');
    expect(tex(sub(pow(x, 2), num(49)))).toBe('x^2 - 49');
  });
  it('корни упрощаются', () => {
    const r = sqrt(add(x, num(1)));
    expect(tex(pow(add(r, num(-2)), 2))).toBe('x - 4\\sqrt{x + 1} + 5');
    expect(tex(sqrt(num(18)))).toBe('3\\sqrt{2}');
    expect(tex(pow(add(sqrt(num(6)), sqrt(num(3))), 2))).toBe('9 + 6\\sqrt{2}');
    expect(tex(mul(sqrt(x), sqrt(num(5))))).toBe('\\sqrt{5x}');
    expect(tex(mul(sqrt(add(x, num(1))), sqrt(add(x, num(-2)))))).toBe('\\sqrt{x^2 - x - 2}');
  });
  it('равенство многочленов', () => {
    expect(equal(pow(add(x, num(1)), 2), add(pow(x, 2), mono(2, 'x'), num(1)))).toBe(true);
  });
  it('вычислитель понимает запись листа', () => {
    expect(evalAlg('\\left(2a - 3b\\right)^2', { a: 2, b: 1 })).toBeCloseTo(1);
    expect(evalAlg('x - 4\\sqrt{x + 1} + 5', { x: 3 })).toBeCloseTo(0);
    expect(evalAlg('\\frac{1}{4}x^2 + 4x + 16', { x: 2 })).toBeCloseTo(25);
  });
});

describe('ответ сходится с условием — все типы, все уровни', () => {
  for (const cat of Object.keys(FSU_SECTION_GENERATORS)) {
    it(cat, () => {
      const wrong = [];
      for (const level of [1, 2, 3]) {
        for (const q of sample(cat, level)) {
          let ok;
          try { ok = holds(cat, q); } catch (e) { ok = false; q.resultLatex += ` [${e.message}]`; }
          if (!ok) wrong.push(`L${level}: ${q.exprLatex} → ${q.resultLatex}`);
        }
      }
      expect(wrong.slice(0, 10)).toEqual([]);
    });
  }
});

describe('ошибки-дистракторы не совпадают с ответом', () => {
  for (const cat of Object.keys(FSU_SECTION_GENERATORS)) {
    if (NUMERIC.has(cat)) continue;
    it(cat, () => {
      const bad = [];
      for (const level of [1, 2, 3]) {
        for (const q of sample(cat, level, 80)) {
          for (const m of q.mistakes || []) {
            let same;
            try { same = holds(cat, q, m); } catch { same = false; }
            if (same) bad.push(`L${level}: ${q.exprLatex} → ${m} (ответ ${q.resultLatex})`);
          }
          // типам с буквами хватает трёх своих ошибок на тест A/B/C/D
          if ((q.mistakes || []).length < 2) bad.push(`мало ошибок L${level}: ${q.exprLatex}`);
        }
      }
      expect(bad.slice(0, 10)).toEqual([]);
    });
  }
});

describe('KaTeX печатает каждое задание, ответ и ошибки', () => {
  it('все типы', () => {
    const broken = [];
    for (const cat of Object.keys(FSU_SECTION_GENERATORS)) {
      for (const level of [1, 2, 3]) {
        for (const q of sample(cat, level, 40)) {
          for (const t of [q.exprLatex, q.resultLatex, ...(q.mistakes || [])]) {
            try { katex.renderToString(t, { throwOnError: true }); } catch (e) { broken.push(`${t}: ${e.message}`); }
          }
        }
      }
    }
    expect(broken.slice(0, 10)).toEqual([]);
  });
});

describe('каждый тип даёт разные задания на каждом уровне', () => {
  it('нет «мёртвых» и однообразных типов', () => {
    const dead = [];
    for (const cat of Object.keys(FSU_SECTION_GENERATORS)) {
      for (const level of [1, 2, 3]) {
        const uniq = new Set(sample(cat, level, 60).map(q => q.exprLatex));
        if (uniq.size < 12) dead.push(`${cat} L${level}: ${uniq.size}`);
      }
    }
    expect(dead).toEqual([]);
  });
});

describe('раздел', () => {
  it('подписи и группы покрывают все типы', () => {
    const grouped = FSU_SECTION_GROUPS.flatMap(g => g.keys);
    expect(new Set(grouped)).toEqual(new Set(Object.keys(FSU_SECTION_GENERATORS)));
    for (const k of grouped) expect(FSU_SECTION_LABELS[k], k).toBeTruthy();
  });

  it('строка задания по включённым типам', () => {
    expect(fsuInstruction({ sqBinom: true, conj: true })).toBe('Раскройте скобки:');
    expect(fsuInstruction({ facSquare: true, facDiffSq: true })).toBe('Разложите на множители:');
    expect(fsuInstruction({ sqBinom: true, combo: true })).toBe('Раскройте скобки и упростите:');
    expect(fsuInstruction({ sqBinom: true, facSquare: true })).toBe('Выполните преобразования:');
  });

  it('лист: варианты по плану, без повторов в варианте, на всех уровнях', () => {
    const all = Object.fromEntries(Object.keys(FSU_SECTION_GENERATORS).map(k => [k, true]));
    for (const level of [1, 2, 3]) {
      const vars = generateFsuVariants({ categories: all, variantsCount: 6, questionsCount: 19, level });
      expect(vars).toHaveLength(6);
      for (const v of vars) {
        expect(v).toHaveLength(19);
        expect(new Set(v.map(byExpr)).size).toBe(v.length);
        v.forEach((q, i) => expect(q.cat).toBe(vars[0][i].cat));
      }
    }
  });

  it('по умолчанию — короткая разминка', () => {
    const vars = generateFsuVariants({});
    expect(vars).toHaveLength(DEFAULT_SETTINGS_FSU.variantsCount);
    expect(vars[0]).toHaveLength(DEFAULT_SETTINGS_FSU.questionsCount);
  });
});
