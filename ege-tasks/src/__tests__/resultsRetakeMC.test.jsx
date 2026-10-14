import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App as AntApp } from 'antd';

// «Другой вариант» в «Результатах» у теста A/B/C/D (v3.9.368): попытка
// выдаётся с номером варианта теста (`mc_variant`), а не с записью `variants`
// чужой работы — иначе ученик вместо теста видел вечную загрузку.

const mockApi = vi.hoisted(() => ({
  getAttemptsBySession: vi.fn(),
  getSession: vi.fn(),
  getMCTest: vi.fn(),
  getAchievements: vi.fn(),
  getSessionsByIds: vi.fn(),
  getVariantsByWork: vi.fn(),
  createAttempt: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));
vi.mock('../components/worksheet/ClassRemediationModal', () => ({ default: () => null }));

// eslint-disable-next-line import/first
import TeacherResultsDashboard from '../components/worksheet/TeacherResultsDashboard';

const SESSION = { id: 's1', work: '', mc_test: 'mc1', student_title: 'Тест по логарифмам' };
const MC_TEST = {
  id: 'mc1',
  variants: [
    { number: 1, tasks: [{ task_id: 't1' }, { task_id: 't2' }] },
    { number: 2, tasks: [{ task_id: 't3' }, { task_id: 't4' }] },
  ],
};
const ATTEMPTS = [
  { id: 'a1', session: 's1', student: 'st1', student_name: 'Белова Анна', status: 'submitted',
    score: 1, total: 2, mc_variant: 1, variant: '', created: '2026-10-07T09:00:00Z' },
];

beforeEach(() => {
  mockApi.getAttemptsBySession.mockResolvedValue(ATTEMPTS);
  mockApi.getSession.mockResolvedValue(SESSION);
  mockApi.getMCTest.mockResolvedValue(MC_TEST);
  mockApi.getAchievements.mockResolvedValue([]);
  mockApi.getSessionsByIds.mockResolvedValue([SESSION]);
  mockApi.createAttempt.mockResolvedValue({ id: 'a2' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('«Другой вариант» у теста A/B/C/D', () => {
  it('выдаёт попытку с номером другого варианта теста', async () => {
    render(<AntApp><TeacherResultsDashboard sessionId="s1" /></AntApp>);
    fireEvent.click(await screen.findByTitle('Другой вариант'));
    fireEvent.click(await screen.findByText('Да, выдать'));

    await waitFor(() => expect(mockApi.createAttempt).toHaveBeenCalled());
    const payload = mockApi.createAttempt.mock.calls[0][0];
    expect(payload).toMatchObject({
      session: 's1', student: 'st1', status: 'started', mc_variant: 2, total: 2,
    });
    expect(payload.variant).toBeUndefined();
    expect(mockApi.getVariantsByWork).not.toHaveBeenCalled();
  });
});
