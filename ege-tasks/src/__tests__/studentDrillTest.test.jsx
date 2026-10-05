/**
 * Ученик проходит тренировку из генератора (v3.9.296): ответы уходят в
 * attempts.drill_answers, в attempt_answers (а значит, и в банк задач) — ничего.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from 'antd';

vi.mock('../services/pocketbase', () => ({
  api: {
    getAttemptAnswers: vi.fn().mockResolvedValue([]),
    batchCreateAttemptAnswers: vi.fn(),
    batchUpdateAttemptAnswers: vi.fn(),
    updateAttempt: vi.fn(async (id, data) => ({ id, ...data })),
  },
}));

import { api } from '../services/pocketbase';
import StudentMCTestPage from '../components/student/StudentMCTestPage';
import { drillStudentTasks } from '../utils/drillTest';

const variantData = {
  number: 1,
  tasks: [
    { key: 'v1-q1', instruction: 'Вычислите:', question: '1 : 2', answer: '0{,}5' },
    { key: 'v1-q2', instruction: 'Вычислите:', question: '2 + 2', answer: '4' },
  ],
};

function renderPage(setAttempt = vi.fn()) {
  const studentSession = {
    attempt: { id: 'att1', student_name: 'Иванов' },
    setAttempt,
    variant: { id: 'mc-1', number: 1, isMC: true, drill: true, answerMode: 'input' },
    tasks: drillStudentTasks(variantData),
    session: { achievements_enabled: false },
  };
  render(<App><StudentMCTestPage studentSession={studentSession} /></App>);
  return setAttempt;
}

describe('тренировка «Вписать ответ» у ученика', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('поле ввода вместо вариантов, проверка по значению, ответы — в попытку', async () => {
    const setAttempt = renderPage();
    const inputs = screen.getAllByPlaceholderText(/Ответ/);
    expect(inputs).toHaveLength(2);
    expect(screen.queryByRole('radio')).toBeNull();

    fireEvent.change(inputs[0], { target: { value: '1/2' } });
    fireEvent.change(inputs[1], { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Отправить ответы/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Отправить' }));

    await waitFor(() => expect(api.updateAttempt).toHaveBeenCalled());
    const [id, data] = api.updateAttempt.mock.calls[0];
    expect(id).toBe('att1');
    expect(data).toMatchObject({
      status: 'submitted',
      score: 1,
      total: 2,
      drill_answers: [
        { key: 'v1-q1', given: '1/2', correct: true },
        { key: 'v1-q2', given: '5', correct: false },
      ],
    });
    expect(api.getAttemptAnswers).not.toHaveBeenCalled();
    expect(api.batchCreateAttemptAnswers).not.toHaveBeenCalled();
    expect(setAttempt).toHaveBeenCalled();
  });
});
