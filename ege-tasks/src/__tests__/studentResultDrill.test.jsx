import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StudentResultPage from '../components/student/StudentResultPage';
import { drillStudentTasks, gradeDrill, drillResultAnswers, drillGivenOption } from '../utils/drillTest';

// Тренировка из генератора (v3.9.296) хранит ответы в attempts.drill_answers.
// Экран результата обязан показать ученику примеры, где он ошибся, и его
// ответ — но НЕ верный ответ (решение пользователя 12.07.2026).

const VARIANT = {
  number: 1,
  tasks: [
    { key: 'v1-q1', instruction: 'Вычислите:', question: '\\sqrt{49}', answer: '7',
      options: [{ text: '7', is_correct: true }, { text: '49', is_correct: false }, { text: '14', is_correct: false }] },
    { key: 'v1-q2', instruction: 'Вычислите:', question: '2^{5}', answer: '32',
      options: [{ text: '32', is_correct: true }, { text: '10', is_correct: false }, { text: '25', is_correct: false }] },
    { key: 'v1-q3', instruction: 'Вычислите:', question: '3 \\cdot 4', answer: '12',
      options: [{ text: '12', is_correct: true }, { text: '7', is_correct: false }, { text: '34', is_correct: false }] },
  ],
};

const renderResult = (tasks, drill_answers, score) => render(
  <StudentResultPage studentSession={{
    tasks,
    session: {},
    attempt: { id: 'a1', status: 'submitted', score, total: tasks.length, drill_answers, student_name: 'Ученик' },
  }} />,
);

describe('экран результата тренировки — ошибочные примеры', () => {
  it('выбор ответа: показаны условия с ошибкой и ответ ученика, верного ответа нет', () => {
    // перемешанные варианты: показанный индекс ≠ исходному
    const tasks = drillStudentTasks(VARIANT, { shuffleMode: 'per_student', seedBase: 'att-1', variantNumber: 1 });
    const pick = (ti, text) => tasks[ti].mc_options.findIndex(o => o.text === text);
    const { score, drill_answers } = gradeDrill(tasks, { 'v1-q1': pick(0, '49'), 'v1-q2': pick(1, '32'), 'v1-q3': pick(2, '34') }, 'choice');
    expect(score).toBe(1);

    const { container } = renderResult(tasks, drill_answers, score);
    const errors = container.querySelectorAll('.error-task');
    expect(errors).toHaveLength(2);
    expect(container.textContent).toContain('Ошибок: 2');
    expect(errors[0].textContent).toContain('Задача 1');
    expect(errors[1].textContent).toContain('Задача 3');
    // условие — формулой (корень рендерится KaTeX)
    expect(errors[0].querySelector('.katex')).not.toBeNull();
    // ответ ученика — тот вариант, что он выбрал, а не тот, что стоит на его месте в исходном списке
    expect(errors[0].querySelector('.wrong-badge').textContent).toContain('49');
    expect(errors[1].querySelector('.wrong-badge').textContent).toContain('34');
    // верного ответа на экране нет
    expect(errors[0].textContent).not.toMatch(/Правильн|Верный/);
  });

  it('вписать ответ: показан вписанный текст, пустой ответ — «(пусто)»', () => {
    const tasks = drillStudentTasks(VARIANT, { variantNumber: 1 });
    const { score, drill_answers } = gradeDrill(tasks, { 'v1-q1': '5', 'v1-q2': '32', 'v1-q3': '' }, 'input');
    const { container } = renderResult(tasks, drill_answers, score);
    const badges = [...container.querySelectorAll('.error-task .wrong-badge')].map(b => b.textContent);
    expect(badges).toEqual(['5', '(пусто)']);
  });

  it('всё верно — список ошибок не показывается', () => {
    const tasks = drillStudentTasks(VARIANT, { variantNumber: 1 });
    const { score, drill_answers } = gradeDrill(tasks, { 'v1-q1': 0, 'v1-q2': 0, 'v1-q3': 0 }, 'choice');
    const { container } = renderResult(tasks, drill_answers, score);
    expect(container.querySelector('.student-result-errors-title')).toBeNull();
    expect(container.textContent).toContain('Все ответы верны');
  });

  it('хелперы: строки ответов и выбранный вариант по исходному номеру', () => {
    expect(drillResultAnswers([{ key: 'v1-q1', given: 2, correct: false }]))
      .toEqual([{ id: 'v1-q1', task: 'v1-q1', is_correct: false, given: 2, answer_raw: '2' }]);
    const task = { mc_options: [{ text: 'b', orig: 1 }, { text: 'a', orig: 0 }] };
    expect(drillGivenOption(task, 0).text).toBe('a');
    expect(drillGivenOption(task, '0')).toBeNull();
    expect(drillGivenOption(task, null)).toBeNull();
  });
});
