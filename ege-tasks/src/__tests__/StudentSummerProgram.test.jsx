/**
 * Тесты ученического каникулярного задания: видно ли, что уже сделано.
 *
 * Ученики жаловались, что список работ есть, а статуса выполнения нет —
 * проверяем, что факт сдачи доезжает до строки, счётчика недели и сводки.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const program = {
  id: 'prog1',
  campaign: '',
  config: { startDate: '2026-06-01', endDate: '2026-06-14' },
};

const items = [
  { id: 'i1', session: 'se1', title: 'Алгебра · неделя 1', block_type: 'algebra', params: { week: 1 } },
  { id: 'i2', session: 'se2', title: 'Геометрия · неделя 1', block_type: 'geometry', params: { week: 1 } },
  { id: 'i3', session: 'se3', title: 'Алгебра · неделя 2', block_type: 'algebra', params: { week: 2 } },
];

// se1 — сдана, se2 — начата и не сдана, se3 — ни одной попытки.
const attempts = [
  { id: 'a1', session: 'se1', status: 'submitted', score: 7, total: 10, submitted_at: '2026-06-03T10:00:00Z' },
  { id: 'a2', session: 'se2', status: 'started', score: 0, total: 0, created: '2026-06-04T10:00:00Z' },
];

vi.mock('../shared/services/pocketbase', () => ({
  api: {
    getStudyProgramForStudent: vi.fn(async () => program),
    getProgramItems: vi.fn(async () => items),
    getCampaign: vi.fn(async () => null),
    getAttemptsBySessions: vi.fn(async () => attempts),
  },
}));

vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));

const { default: StudentSummerProgram } = await import('../components/student/StudentSummerProgram');

describe('StudentSummerProgram — статус выполнения', () => {
  it('показывает сделанное, начатое и нетронутое', async () => {
    render(<StudentSummerProgram student={{ id: 'st1', name: 'Ученик' }} />);

    // Сводка: из трёх выдач сдана одна.
    await waitFor(() => expect(screen.getByText('1 из 3')).toBeInTheDocument());

    // Метки по строкам.
    expect(screen.getByText(/сделано · 7\/10/)).toBeInTheDocument();
    expect(screen.getByText('начато')).toBeInTheDocument();
    expect(screen.getAllByText('ещё не начато').length).toBeGreaterThan(0);

    // Подписи кнопок зависят от состояния.
    expect(screen.getByText('Ещё раз')).toBeInTheDocument();
    expect(screen.getByText('Продолжить')).toBeInTheDocument();
    expect(screen.getAllByText('Решать').length).toBeGreaterThan(0);
  });

  it('считает сданные работы по неделям', async () => {
    render(<StudentSummerProgram student={{ id: 'st1', name: 'Ученик' }} />);
    // Неделя 1: две работы, сдана одна. Неделя 2: одна, не сдана.
    await waitFor(() => expect(screen.getByText('1 из 2')).toBeInTheDocument());
    expect(screen.getByText('0 из 1')).toBeInTheDocument();
  });
});
