/**
 * Тренировки из генераторов (v3.9.296): задания не попадают в банк, ответы —
 * в попытку. Сторож режима «Вписать ответ»: каждый ответ каждого генератора с
 * числовым ответом читается по значению, а ученик, написавший его как ему
 * удобно (0,5 · 1/2 · 2 1/3), получает «верно».
 */
import { describe, it, expect } from 'vitest';
import {
  parseExpectedAnswer, parseStudentAnswer, checkDrillAnswer, canCheckByValue,
} from '../utils/drillAnswer';
import {
  INPUT_GENERATORS, drillVariants, isDrillTest, uncheckableItems, drillStudentTasks,
  gradeDrill, setDrillAnswerCorrect, drillAnswerRows, drillAnswerStats,
  drillAttemptRows,
} from '../utils/drillTest';
import { generateOralCountingVariants, DEFAULT_SETTINGS } from '../hooks/useOralCounting';
import { generateEgeBaseVariants } from '../hooks/useOralEgeBase';
import { generateFractionsVariants } from '../hooks/useOralFractions';
import { generatePowersRootsVariants } from '../hooks/useOralPowersRoots';
import { generateLogarithmsVariants } from '../hooks/useOralLogarithms';
import { generateLogExpVariants } from '../hooks/useLogExpEquations';
import { generateLinearEquationVariants, DEFAULT_SETTINGS_LINEQ } from '../hooks/useLinearEquations';

const allOn = (cats) => Object.fromEntries(Object.keys(cats || {}).map(k => [k, true]));

const GENERATORS = {
  oral_counting: (s) => generateOralCountingVariants({ ...s, categories: allOn(DEFAULT_SETTINGS.categories) }),
  oral_ege_base: generateEgeBaseVariants,
  oral_fractions: generateFractionsVariants,
  oral_powers_roots: generatePowersRootsVariants,
  oral_logarithms: generateLogarithmsVariants,
  log_exp_equations: generateLogExpVariants,
  linear_equations: (s) => generateLinearEquationVariants({
    ...DEFAULT_SETTINGS_LINEQ, ...s, categories: allOn(DEFAULT_SETTINGS_LINEQ.categories),
  }),
};

/** Ответ так, как его напишет ученик: дробью через «/», запятой, словами. */
function typedForms(value) {
  if (value.kind === 'empty') return ['нет корней', '∅', 'нет'];
  if (value.kind === 'all') return ['любое число', 'R', 'x любое'];
  const { n, d } = value;
  const forms = [d === 1 ? String(n) : `${n}/${d}`];
  const dec = n / d;
  if (Number.isInteger(dec * 10000)) forms.push(String(dec).replace('.', ','));
  if (d !== 1 && Math.abs(n) > d) {
    const whole = Math.trunc(Math.abs(n) / d);
    forms.push(`${n < 0 ? '-' : ''}${whole} ${Math.abs(n) % d}/${d}`);
  }
  if (n < 0) forms.push(forms[0].replace('-', '−'));
  return forms;
}

describe('проверка вписанного ответа', () => {
  it('читает запись бланка', () => {
    expect(parseExpectedAnswer('-7')).toEqual({ kind: 'num', n: -7, d: 1 });
    expect(parseExpectedAnswer('0{,}125')).toEqual({ kind: 'num', n: 1, d: 8 });
    expect(parseExpectedAnswer('-\\dfrac{2}{6}')).toEqual({ kind: 'num', n: -1, d: 3 });
    expect(parseExpectedAnswer('2\\dfrac{1}{3}')).toEqual({ kind: 'num', n: 7, d: 3 });
    expect(parseExpectedAnswer('-2\\dfrac{2}{3}')).toEqual({ kind: 'num', n: -8, d: 3 });
    expect(parseExpectedAnswer('\\varnothing')).toEqual({ kind: 'empty' });
    expect(parseExpectedAnswer('y \\in \\mathbb{R}')).toEqual({ kind: 'all' });
    expect(parseExpectedAnswer('\\dfrac{\\sqrt{3}}{2}')).toBeNull();
    expect(parseExpectedAnswer('(-\\infty; 2)')).toBeNull();
  });

  it('принимает любую запись того же числа', () => {
    expect(checkDrillAnswer('0,5', '\\dfrac{1}{2}')).toBe(true);
    expect(checkDrillAnswer('1/2', '0{,}5')).toBe(true);
    expect(checkDrillAnswer('.5', '0{,}5')).toBe(true);
    expect(checkDrillAnswer('2/4', '0{,}5')).toBe(true);
    expect(checkDrillAnswer('−7', '-7')).toBe(true);
    expect(checkDrillAnswer(' x = -7 ', '-7')).toBe(true);
    expect(checkDrillAnswer('2 1/3', '2\\dfrac{1}{3}')).toBe(true);
    expect(checkDrillAnswer('7/3', '2\\dfrac{1}{3}')).toBe(true);
    expect(checkDrillAnswer('-2 2/3', '-2\\dfrac{2}{3}')).toBe(true);
    expect(checkDrillAnswer('0,3', '0{,}3')).toBe(true);
    expect(checkDrillAnswer('1 000', '1000')).toBe(true);
    expect(checkDrillAnswer('нет корней', '\\varnothing')).toBe(true);
    expect(checkDrillAnswer('любое число', 'x \\in \\mathbb{R}')).toBe(true);
  });

  it('не засчитывает неверное и мусор', () => {
    expect(checkDrillAnswer('7', '-7')).toBe(false);
    expect(checkDrillAnswer('0,33', '\\dfrac{1}{3}')).toBe(false);
    expect(checkDrillAnswer('2 1/3', '2\\dfrac{2}{3}')).toBe(false);
    expect(checkDrillAnswer('', '0')).toBe(false);
    expect(checkDrillAnswer('семь', '7')).toBe(false);
    expect(checkDrillAnswer('1/0', '0')).toBe(false);
    expect(checkDrillAnswer('0', '\\varnothing')).toBe(false);
    expect(checkDrillAnswer('нет корней', '0')).toBe(false);
    expect(parseStudentAnswer('1,2,3')).toBeNull();
  });
});

describe.each(Object.entries(GENERATORS))('генератор %s', (name, generate) => {
  it('объявлен генератором с вводом ответа', () => {
    expect(INPUT_GENERATORS.has(name)).toBe(true);
  });

  it('каждый ответ проверяется по значению, и ученик получает «верно»', () => {
    const seen = new Set();
    for (const level of [1, 2, 3]) {
      for (const variant of generate({ variantsCount: 16, questionsCount: 30, level })) {
        for (const q of variant) {
          if (seen.has(q.resultLatex)) continue;
          seen.add(q.resultLatex);
          const value = parseExpectedAnswer(q.resultLatex);
          expect(value, `не читается ответ «${q.resultLatex}»`).not.toBeNull();
          for (const typed of typedForms(value)) {
            expect(checkDrillAnswer(typed, q.resultLatex), `«${typed}» для «${q.resultLatex}»`).toBe(true);
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('тест-тренировка', () => {
  const sheet = [
    [{ exprLatex: '2 + 2', resultLatex: '4' }, { exprLatex: '1 : 2', resultLatex: '0{,}5', instruction: 'Найдите:' }],
    [{ exprLatex: '3 \\cdot 3', resultLatex: '9' }, { exprLatex: '2x = 1', resultLatex: '\\dfrac{1}{2}', askInStatement: true }],
  ];

  it('снимок листа → варианты без ссылок на банк', () => {
    const variants = drillVariants(sheet);
    expect(variants).toHaveLength(2);
    expect(variants[0].tasks[0]).toEqual({ key: 'v1-q1', instruction: 'Вычислите:', question: '2 + 2', answer: '4' });
    expect(variants[0].tasks[1].instruction).toBe('Найдите:');
    expect(variants[1].tasks[1].question).toBe('2x = 1,\\; x = \\,?');
    expect(variants.flatMap(v => v.tasks).every(t => !('task_id' in t))).toBe(true);
    expect(isDrillTest({ variants })).toBe(true);
    expect(isDrillTest({ variants: [{ tasks: [{ task_id: 'abc', question: '1' }] }] })).toBe(false);
    expect(isDrillTest({ variants: [] })).toBe(false);
  });

  it('находит задания, которые не проверить по значению', () => {
    expect(uncheckableItems(sheet)).toEqual([]);
    const bad = uncheckableItems([[{ resultLatex: '4' }, { resultLatex: '(-\\infty; 2)' }]]);
    expect(bad).toEqual([{ variant: 1, position: 2, answer: '(-\\infty; 2)' }]);
    expect(canCheckByValue('4')).toBe(true);
  });

  it('выбор ответа: в попытку пишется исходный номер варианта ответа', () => {
    const variant = {
      number: 1,
      tasks: [{
        key: 'v1-q1', instruction: 'Вычислите:', question: '2 + 2', answer: '4',
        options: [{ text: '4', is_correct: true }, { text: '5' }, { text: '3' }, { text: '6' }],
      }],
    };
    const tasks = drillStudentTasks(variant, { shuffleMode: 'per_student', seedBase: 'att1', variantNumber: 1 });
    expect(tasks[0].id).toBe('v1-q1');
    expect(tasks[0].statement_md).toBe('Вычислите:\n\n$$2 + 2$$');
    const shown = tasks[0].mc_options.findIndex(o => o.is_correct);
    const graded = gradeDrill(tasks, { 'v1-q1': shown }, 'choice');
    expect(graded).toEqual({ score: 1, drill_answers: [{ key: 'v1-q1', given: 0, correct: true }] });
    const wrong = gradeDrill(tasks, { 'v1-q1': (shown + 1) % 4 }, 'choice');
    expect(wrong.score).toBe(0);
    expect(wrong.drill_answers[0].given).not.toBe(0);
    expect(gradeDrill(tasks, {}, 'choice').drill_answers[0]).toEqual({ key: 'v1-q1', given: null, correct: false });
  });

  it('ввод ответа: проверка по значению, пустое — не ответ', () => {
    const tasks = drillStudentTasks({ number: 1, tasks: drillVariants(sheet)[0].tasks }, {});
    const graded = gradeDrill(tasks, { 'v1-q1': ' 4 ', 'v1-q2': '1/2' }, 'input');
    expect(graded.score).toBe(2);
    expect(graded.drill_answers).toEqual([
      { key: 'v1-q1', given: '4', correct: true },
      { key: 'v1-q2', given: '1/2', correct: true },
    ]);
    expect(gradeDrill(tasks, { 'v1-q1': '  ' }, 'input').drill_answers[0]).toEqual({ key: 'v1-q1', given: null, correct: false });
  });

  it('зачёт учителем пересчитывает балл', () => {
    const answers = [{ key: 'a', given: '1', correct: false }, { key: 'b', given: '2', correct: true }];
    const res = setDrillAnswerCorrect(answers, 'a', true);
    expect(res.score).toBe(2);
    expect(res.drill_answers[0]).toEqual({ key: 'a', given: '1', correct: true, manual: true });
    expect(setDrillAnswerCorrect(res.drill_answers, 'b', false).score).toBe(1);
  });

  it('строки для учителя и статистика по заданиям', () => {
    const mcTest = {
      variants: [{
        number: 2,
        tasks: [
          { key: 'v2-q1', question: '3 \\cdot 3', answer: '9', options: [{ text: '9', is_correct: true }, { text: '6' }] },
          { key: 'v2-q2', question: '1 : 4', answer: '0{,}25' },
        ],
      }],
    };
    const attempt = {
      mc_variant: 2,
      drill_answers: [{ key: 'v2-q1', given: 1, correct: false }, { key: 'v2-q2', given: '1/4', correct: true }],
    };
    const rows = drillAnswerRows(attempt, mcTest);
    expect(rows[0]).toMatchObject({ position: 1, given: '6', givenIsLatex: true, answer: '9', is_correct: false });
    expect(rows[1]).toMatchObject({ position: 2, given: '1/4', givenIsLatex: false, is_correct: true });

    const stats = drillAnswerStats([attempt, { drill_answers: [{ key: 'v2-q1', given: 0, correct: true }] }]);
    expect(stats['v2-q1']).toEqual({ choices: { 1: 1, 0: 1 }, correctCount: 1, total: 2 });
    expect(stats['v2-q2'].correctCount).toBe(1);
  });
});

describe('«Прогресс» ученика: ответы тренировки', () => {
  const mcTest = {
    variants: [{
      number: 2,
      tasks: [
        { key: 'v2-q1', question: '3^2', instruction: 'Вычислите', answer: '9', options: [{ text: '9', is_correct: true }, { text: '6' }] },
        { key: 'v2-q2', question: '\\log_2 8', answer: '3', options: [] },
      ],
    }],
  };

  it('условие из снимка, ответ ученика; выбранный вариант — формулой, верного ответа нет', () => {
    const rows = drillAttemptRows({
      mc_variant: 2,
      drill_answers: [
        { key: 'v2-q1', given: 1, correct: false },
        { key: 'v2-q2', given: '4', correct: false },
      ],
    }, mcTest);
    expect(rows).toHaveLength(2);
    expect(rows[0].expand.task.statement_md).toContain('3^2');
    expect(rows[0].givenLatex).toBe('6');
    expect(rows[1].givenLatex).toBeNull();
    expect(rows[1].answer_raw).toBe('4');
    expect(JSON.stringify(rows)).not.toMatch(/"answer"|is_correct":true/);
  });

  it('тест не пришёл — строки всё равно есть, без условия', () => {
    const rows = drillAttemptRows({ variant: 2, drill_answers: [{ key: 'v2-q1', given: '9', correct: true }] }, null);
    expect(rows[0]).toMatchObject({ is_correct: true, answer_raw: '9' });
    expect(rows[0].expand.task).toBeNull();
  });
});
