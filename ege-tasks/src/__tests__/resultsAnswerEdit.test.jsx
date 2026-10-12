import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { regradeAnswer } from '../utils/answerChecker';

// Панель результатов: учитель исправляет сам ответ ученика (неверно
// распознанный бланк) — ответ перепроверяется, балл попытки пересчитывается.

const mockApi = vi.hoisted(() => ({
  getAttemptsBySession: vi.fn(),
  getAttemptsBySessionsFull: vi.fn(),
  getSession: vi.fn(),
  getMCTest: vi.fn(),
  getAchievements: vi.fn(),
  getSessionsByIds: vi.fn(),
  getAttemptAnswers: vi.fn(),
  updateAttemptAnswer: vi.fn(),
  updateAttempt: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));
vi.mock('../components/worksheet/ClassRemediationModal', () => ({ default: () => null }));

// eslint-disable-next-line import/first
import TeacherResultsDashboard from '../components/worksheet/TeacherResultsDashboard';

const SESSION = { id: 's1', work: 'w1', expand: { work: { id: 'w1', title: 'Контрольная', class: 10 } } };
const VARIANT = { id: 'v1', number: 1, tasks: ['t1', 't2'], order: [] };
const ATTEMPT = {
  id: 'a1', session: 's1', student: 'st1', student_name: 'Белова Анна', status: 'submitted',
  score: 1, total: 2, source: 'scan', created: '2026-10-07T09:00:00Z', expand: { variant: VARIANT },
};
const T1 = { id: 't1', code: '1-001', answer: '12' };
const T2 = { id: 't2', code: '2-001', answer: '0,5' };

let answers;

function setup() {
  return render(<AntApp><TeacherResultsDashboard sessionId="s1" /></AntApp>);
}

async function openAnswers() {
  setup();
  await screen.findByText('Белова Анна');
  fireEvent.click(document.querySelector('.ant-table-row-expand-icon'));
  await screen.findByText('1-001');
}

beforeEach(() => {
  answers = [
    { id: 'x1', attempt: 'a1', task: 't1', answer_raw: '17', is_correct: false, expand: { task: T1 } },
    { id: 'x2', attempt: 'a1', task: 't2', answer_raw: '0,5', is_correct: true, expand: { task: T2 } },
  ];
  mockApi.getAttemptsBySession.mockResolvedValue([ATTEMPT]);
  mockApi.getSession.mockResolvedValue(SESSION);
  mockApi.getAchievements.mockResolvedValue([]);
  mockApi.getSessionsByIds.mockResolvedValue([SESSION]);
  mockApi.getAttemptAnswers.mockImplementation(async () => answers.map((a) => ({ ...a })));
  mockApi.updateAttemptAnswer.mockImplementation(async (id, patch) => {
    answers = answers.map((a) => (a.id === id ? { ...a, ...patch } : a));
    return answers.find((a) => a.id === id);
  });
  mockApi.updateAttempt.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('regradeAnswer', () => {
  it('перепроверяет ответ по эталону', () => {
    expect(regradeAnswer(' 12 ', '12')).toEqual({ answer_raw: '12', answer_normalized: 12, is_correct: true });
    expect(regradeAnswer('1/2', '0,5').is_correct).toBe(true);
    expect(regradeAnswer('17', '12').is_correct).toBe(false);
    expect(regradeAnswer('', '12')).toEqual({ answer_raw: '', answer_normalized: 0, is_correct: false });
  });
});

describe('TeacherResultsDashboard — правка ответа', { timeout: 20000 }, () => {
  it('исправленный верный ответ засчитывается, балл +1', async () => {
    await openAnswers();
    fireEvent.click(screen.getAllByRole('button', { name: 'Исправить ответ' })[0]);
    const input = screen.getByLabelText('Исправленный ответ');
    expect(input.value).toBe('17');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить ответ' }));

    await waitFor(() => expect(mockApi.updateAttemptAnswer).toHaveBeenCalledWith('x1', {
      answer_raw: '12', answer_normalized: 12, is_correct: true,
    }));
    await waitFor(() => expect(mockApi.updateAttempt).toHaveBeenCalledWith('a1', { score: 2 }));
    await waitFor(() => expect(screen.queryByLabelText('Исправленный ответ')).toBeNull());
    expect(screen.getByText('12', { selector: '.ant-space-item' })).toBeTruthy();
  });

  it('верный ответ, исправленный на неверный, — балл −1', async () => {
    await openAnswers();
    fireEvent.click(screen.getAllByRole('button', { name: 'Исправить ответ' })[1]);
    const input = screen.getByLabelText('Исправленный ответ');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });

    await waitFor(() => expect(mockApi.updateAttemptAnswer).toHaveBeenCalledWith('x2',
      expect.objectContaining({ answer_raw: '5', is_correct: false })));
    await waitFor(() => expect(mockApi.updateAttempt).toHaveBeenCalledWith('a1', { score: 0 }));
  });

  it('правка без изменения итога не трогает балл; Esc отменяет', async () => {
    await openAnswers();
    fireEvent.click(screen.getAllByRole('button', { name: 'Исправить ответ' })[0]);
    let input = screen.getByLabelText('Исправленный ответ');
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByLabelText('Исправленный ответ')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Исправить ответ' })[0]);
    input = screen.getByLabelText('Исправленный ответ');
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить ответ' }));
    await waitFor(() => expect(mockApi.updateAttemptAnswer).toHaveBeenCalledWith('x1',
      expect.objectContaining({ answer_raw: '13', is_correct: false })));
    expect(mockApi.updateAttempt).not.toHaveBeenCalled();
  });
});
