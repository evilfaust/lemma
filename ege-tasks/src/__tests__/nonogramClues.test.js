/**
 * Сторож подсказок японского кроссворда: каждый пример пересчитывается
 * независимым вычислителем по НАПЕЧАТАННОЙ записи и обязан дать ровно число
 * подсказки. Числа у вариантов одни и те же, запись — разная.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { evalTex, close } from './helpers/texEval';
import {
  CLUE_SECTIONS, MAX_CLUE, targetTask, shortTask, buildClueVariants, buildPool,
  enabledCategories, sectionCategories, texWidthEm, isTallTex, widestEm,
  DEFAULT_CLUE_CATEGORIES,
} from '../utils/nonogram/clueTasks';
import { cluesOf } from '../utils/nonogram/solver';

const INT = CLUE_SECTIONS.find(s => s.key === 'int');
const allCats = () => Object.assign({}, ...CLUE_SECTIONS.map(s => sectionCategories(s.key)));

function randomPic(n, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() < 0.6));
}

describe('примеры «от ответа» (Целые числа)', () => {
  for (const cat of Object.keys(INT.labels)) {
    for (const level of [1, 2, 3]) {
      it(`${cat}, уровень ${level}: каждое число 1…${MAX_CLUE}`, () => {
        for (let v = 1; v <= MAX_CLUE; v++) {
          for (let t = 0; t < 15; t++) {
            const q = targetTask(cat, v, level);
            expect(close(evalTex(q.exprLatex), v), `${q.exprLatex} ≠ ${v}`).toBe(true);
            expect(() => katex.renderToString(q.exprLatex, { throwOnError: true })).not.toThrow();
            // в записи нет отрицательных «пустышек» вида «- 0» и нулей-слагаемых
            expect(q.exprLatex).not.toMatch(/[-+] 0(?!\d)/);
          }
        }
      });
    }
  }

  it('короткие записи для узких клеток: верны и не шире 2,3 em', () => {
    for (let v = 1; v <= MAX_CLUE; v++) {
      for (let t = 0; t < 20; t++) {
        const q = shortTask(v);
        expect(close(evalTex(q.exprLatex), v), `${q.exprLatex} ≠ ${v}`).toBe(true);
        expect(texWidthEm(q.exprLatex)).toBeLessThanOrEqual(2.3);
      }
    }
  });

  it('разнообразие: на одно число много разных записей', () => {
    for (const level of [1, 2, 3]) {
      const seen = new Set();
      for (let t = 0; t < 200; t++) {
        const cat = Object.keys(INT.labels)[t % 5];
        seen.add(targetTask(cat, 3, level).exprLatex);
      }
      expect(seen.size).toBeGreaterThan(20);
    }
  });
});

describe('пул из разделов устного счёта', () => {
  it('только целые ответы 1…15, и они верны', () => {
    for (const level of [1, 2, 3]) {
      const pool = buildPool(enabledCategories(allCats()), level, { tries: 20 });
      for (const [v, list] of pool) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(MAX_CLUE);
        for (const q of list) {
          expect(close(evalTex(q.exprLatex), v), `${q.exprLatex} ≠ ${v}`).toBe(true);
        }
      }
    }
  });
});

describe('варианты подсказок', () => {
  it('числа вариантов совпадают с подсказками картинки, примеры верны', () => {
    const clues = cluesOf(randomPic(10, 3));
    for (const level of [1, 2, 3]) {
      const { variants } = buildClueVariants(clues, { categories: allCats(), level, variantsCount: 3 });
      expect(variants).toHaveLength(3);
      for (const vr of variants) {
        expect(vr.rows.map(l => l.map(q => q.value))).toEqual(clues.rows);
        expect(vr.cols.map(l => l.map(q => q.value))).toEqual(clues.cols);
        for (const q of [...vr.rows.flat(), ...vr.cols.flat()]) {
          expect(close(evalTex(q.exprLatex), q.value), `${q.exprLatex} ≠ ${q.value}`).toBe(true);
        }
      }
    }
  });

  it('варианты отличаются записью', () => {
    const clues = cluesOf(randomPic(10, 5));
    const { variants: [a, b] } = buildClueVariants(clues, { variantsCount: 2 });
    const flat = (v) => [...v.rows.flat(), ...v.cols.flat()].map(q => q.exprLatex);
    const same = flat(a).filter((e, i) => e === flat(b)[i]).length;
    expect(same / flat(a).length).toBeLessThan(0.3);
  });

  it('внутри варианта повторов почти нет', () => {
    const clues = cluesOf(randomPic(10, 9));
    const { variants: [v] } = buildClueVariants(clues, { level: 2 });
    const all = [...v.rows.flat(), ...v.cols.flat()].map(q => q.exprLatex);
    expect(new Set(all).size).toBe(all.length);
  });

  it('предел ширины соблюдается, голых чисел нет', () => {
    const clues = cluesOf(randomPic(15, 11));
    const limits = { row: { em: 6 }, col: { em: 3.6, noTall: true } };
    const { variants: [v], stats } = buildClueVariants(clues, { categories: allCats(), level: 2, limits });
    expect(widestEm(v.cols)).toBeLessThanOrEqual(3.6);
    expect(widestEm(v.rows)).toBeLessThanOrEqual(6);
    for (const q of v.cols.flat()) expect(isTallTex(q.exprLatex)).toBe(false);
    expect(stats.numbers).toBe(0);
  });

  it('без выбранных категорий — «Целые числа»', () => {
    const clues = cluesOf(randomPic(5, 2));
    const { variants: [v] } = buildClueVariants(clues, { categories: {} });
    for (const q of v.rows.flat()) expect(q.cat.startsWith('int.')).toBe(true);
    expect(Object.keys(DEFAULT_CLUE_CATEGORIES).every(k => k.startsWith('int.'))).toBe(true);
  });
});

describe('ширина записи', () => {
  it('короткое короче длинного, дробь шире числителя', () => {
    expect(texWidthEm('7')).toBeLessThan(texWidthEm('56 : 8'));
    expect(texWidthEm('\\sqrt{49}')).toBeLessThan(texWidthEm('\\log_{2} 64'));
    expect(texWidthEm('\\dfrac{12}{3}')).toBeLessThan(texWidthEm('12 : 3'));
    expect(isTallTex('\\dfrac{1}{2}')).toBe(true);
    expect(isTallTex('2^{3}')).toBe(false);
  });
});
