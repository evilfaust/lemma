/**
 * Ответ «как в бланке» — формат первой части ОГЭ и ЕГЭ: целое число или
 * конечная десятичная дробь. Сторож режима во всех разделах устного счёта:
 * дробь с конечной записью переписывается десятичной, а не выбрасывается;
 * каждый тип на каждом уровне продолжает давать задания; ответ совпадает
 * со значением напечатанного условия.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from 'antd';
import { answerMatches } from './helpers/texEval';
import {
  examAnswerLatex, parseAnswerNumber, examAnswerNote, isFiniteDecimalAnswer,
} from '../utils/oralAnswerFilter';
import { sheetCapacity } from '../utils/sheetCapacity';
import { generateOralCountingVariants, CATEGORY_LABELS } from '../hooks/useOralCounting';
import { generateEgeBaseVariants, CATEGORY_LABELS_EGE } from '../hooks/useOralEgeBase';
import { generateFractionsVariants, CATEGORY_LABELS_FR } from '../hooks/useOralFractions';
import { generatePowersRootsVariants, CATEGORY_LABELS_PR } from '../hooks/useOralPowersRoots';
import { generateLogarithmsVariants, CATEGORY_LABELS_LOG } from '../hooks/useOralLogarithms';
import { generateLogExpVariants, CATEGORY_LABELS_LOGEXP } from '../hooks/useLogExpEquations';
import OralFractionsGenerator from '../components/OralFractionsGenerator';
import OralCountingGenerator from '../components/OralCountingGenerator';

// [генератор, все типы раздела (с ФСУ), понимает ли уровень]
const SECTIONS = {
  'арифметика':      [generateOralCountingVariants, CATEGORY_LABELS, false],
  'десятичные':      [generateEgeBaseVariants, CATEGORY_LABELS_EGE, true],
  'дроби':           [generateFractionsVariants, CATEGORY_LABELS_FR, true],
  'степени и корни': [generatePowersRootsVariants, CATEGORY_LABELS_PR, true],
  'логарифмы':       [generateLogarithmsVariants, CATEGORY_LABELS_LOG, true],
  'уравнения':       [generateLogExpVariants, CATEGORY_LABELS_LOGEXP, true],
};

// Задания словами («20 % от 45», «если log_a b = 3») вычислитель не читает
const isWordy = (q) => /\\text|\\%|(?<![\\a-z])[ab](?![a-z])/.test(q.exprLatex);

describe('запись ответа как в бланке', () => {
  it('целое и десятичная остаются, конечная дробь становится десятичной', () => {
    expect(examAnswerLatex('12')).toBe('12');
    expect(examAnswerLatex('-0{,}5')).toBe('-0{,}5');
    expect(examAnswerLatex('0.25')).toBe('0{,}25');
    expect(examAnswerLatex('\\dfrac{1}{4}')).toBe('0{,}25');
    expect(examAnswerLatex('-\\dfrac{3}{8}')).toBe('-0{,}375');
    expect(examAnswerLatex('1\\dfrac{3}{4}')).toBe('1{,}75');
    expect(examAnswerLatex('-20\\dfrac{1}{4}')).toBe('-20{,}25');
    expect(examAnswerLatex('\\frac{6}{3}')).toBe('2');
    expect(examAnswerLatex('\\dfrac{1}{16}')).toBe('0{,}0625');
  });

  it('в бланк не вписать — null', () => {
    for (const a of ['\\dfrac{1}{3}', '2\\dfrac{1}{6}', '\\sqrt{2}', '2\\sqrt{3}', '\\pi',
      '\\log_2 3', '\\dfrac{1}{32}', 'x', '', null]) {
      expect(examAnswerLatex(a)).toBeNull();
    }
  });

  it('разбор числа', () => {
    expect(parseAnswerNumber('-1\\dfrac{1}{2}')).toEqual({ n: -3, d: 2 });
    expect(parseAnswerNumber('3{,}20')).toEqual({ n: 16, d: 5 });
    expect(parseAnswerNumber('\\sqrt{4}')).toBeNull();
  });

  it('строка для ученика', () => {
    expect(examAnswerNote({ decimalOnly: true })).toMatch(/конечная десятичная дробь/);
    expect(examAnswerNote({ integerOnly: true, decimalOnly: true })).toBe('Ответ — целое число.');
    expect(examAnswerNote({})).toBeNull();
  });

  it('строка о формате ответа отнимает место у заданий', () => {
    for (const per of [1, 4, 8]) {
      const without = sheetCapacity(per, {});
      const withNote = sheetCapacity(per, { answerNote: true });
      expect(withNote.availableMm).toBeLessThan(without.availableMm);
    }
  });
});

describe('каждый тип раздела даёт задания как в бланке — на каждом уровне', () => {
  for (const [name, [generate, labels, levels]] of Object.entries(SECTIONS)) {
    it(name, () => {
      const dead = [];
      const wrong = [];
      for (const level of levels ? [1, 2, 3] : [2]) {
        for (const cat of Object.keys(labels)) {
          const variants = generate({
            categories: { [cat]: true }, variantsCount: 3, questionsCount: 4,
            decimalOnly: true, level,
          });
          const tasks = variants.flat();
          // позицию типа без годных заданий план отдал бы другому типу
          if (tasks.length < 12 || tasks.some(q => q.cat !== cat)) dead.push(`${cat} L${level}`);
          for (const q of tasks) {
            if (!isFiniteDecimalAnswer(q.resultLatex)) wrong.push(`${cat}: ${q.resultLatex}`);
          }
        }
      }
      expect(dead).toEqual([]);
      expect(wrong).toEqual([]);
    });
  }
});

describe('переписанный ответ равен значению условия', () => {
  for (const [name, [generate, labels, levels]] of Object.entries(SECTIONS)) {
    it(name, () => {
      const categories = Object.fromEntries(Object.keys(labels).map(k => [k, true]));
      const wrong = [];
      for (const level of levels ? [1, 2, 3] : [2]) {
        const variants = generate({
          categories, variantsCount: 16, questionsCount: 40, decimalOnly: true, level,
        });
        for (const q of variants.flat()) {
          if (isWordy(q)) continue;
          let ok;
          try { ok = answerMatches(q.exprLatex, q.resultLatex); } catch { ok = false; }
          if (!ok) wrong.push(`${q.cat}: ${q.exprLatex} → ${q.resultLatex}`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }

  it('арифметика: «a/b : n» больше не выпадает, ответ десятичный', () => {
    const v = generateOralCountingVariants({
      categories: { fracDivInt: true }, variantsCount: 4, questionsCount: 5, decimalOnly: true,
    });
    const answers = v.flat().map(q => q.resultLatex);
    expect(answers).toHaveLength(20);
    expect(answers.every(a => !a.includes('\\'))).toBe(true);
  });
});

describe('переключатель на странице', () => {
  const wrapper = ({ children }) => <MemoryRouter><App>{children}</App></MemoryRouter>;

  it('дроби: «Как в бланке» рядом с уровнем, строка о формате на листе', () => {
    const { container } = render(<OralFractionsGenerator />, { wrapper });
    expect(screen.queryByText('Только целые / десятичные ответы')).toBeNull();
    fireEvent.click(screen.getByText('Как в бланке'));
    expect(screen.getByText(/¾ → 0,75/)).toBeTruthy();
    fireEvent.click(screen.getByText('Сформировать'));
    const notes = container.querySelectorAll('.oral-answer-note');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].textContent).toMatch(/целое число или конечная десятичная дробь/);
    // строку можно снять
    fireEvent.click(screen.getByText('Подсказка, в каком виде писать ответ'));
    expect(container.querySelectorAll('.oral-answer-note')).toHaveLength(0);
  });

  it('арифметика: «Как в бланке» в выборе ответа', () => {
    const { container } = render(<OralCountingGenerator />, { wrapper });
    fireEvent.click(screen.getByText('Как в бланке'));
    fireEvent.click(screen.getByText('Сформировать'));
    expect(container.querySelector('.oral-answer-note')).toBeTruthy();
  });
});
