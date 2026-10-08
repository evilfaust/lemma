import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App as AntApp } from 'antd';

// Панель результатов учителя (v3.9.321): переключатель «Результаты ученикам»
// (по умолчанию видны, закрываются вручную) и выгрузка в Excel.

const mockApi = vi.hoisted(() => ({
  getAttemptsBySession: vi.fn(),
  getAttemptsBySessionsFull: vi.fn(),
  getSession: vi.fn(),
  getMCTest: vi.fn(),
  getAchievements: vi.fn(),
  getSessionsByIds: vi.fn(),
  setSessionsResultsHidden: vi.fn(),
  getAttemptAnswersForExport: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));
vi.mock('../components/worksheet/ClassRemediationModal', () => ({ default: () => null }));

const download = vi.hoisted(() => vi.fn());
vi.mock('../utils/xlsxWriter', async (orig) => ({ ...(await orig()), downloadXlsx: download }));

// eslint-disable-next-line import/first
import TeacherResultsDashboard from '../components/worksheet/TeacherResultsDashboard';

const SESSION = { id: 's1', work: 'w1', expand: { work: { id: 'w1', title: 'Контрольная 2', class: 10 } } };
const VARIANT = { id: 'v1', number: 1, tasks: ['t1', 't2'], order: [] };
const ATTEMPTS = [
  { id: 'a1', session: 's1', student: 'st1', student_name: 'Белова Анна', status: 'submitted', score: 2, total: 2,
    submitted_at: '2026-10-07T09:00:00Z', created: '2026-10-07T09:00:00Z', expand: { variant: VARIANT } },
  { id: 'a2', session: 's1', student: 'st2', student_name: 'Волков Борис', status: 'started', score: 0, total: 2,
    created: '2026-10-07T09:00:00Z', expand: { variant: VARIANT } },
];

function setup() {
  return render(<AntApp><TeacherResultsDashboard sessionId="s1" /></AntApp>);
}

const visibilitySwitch = () => screen.getByRole('switch', { name: 'Результаты ученикам' });

beforeEach(() => {
  mockApi.getAttemptsBySession.mockResolvedValue(ATTEMPTS);
  mockApi.getSession.mockResolvedValue(SESSION);
  mockApi.getAchievements.mockResolvedValue([]);
  mockApi.getSessionsByIds.mockResolvedValue([SESSION]);
  mockApi.getAttemptAnswersForExport.mockResolvedValue([
    { id: 'x1', attempt: 'a1', task: 't1', is_correct: true, answer_raw: '5' },
    { id: 'x2', attempt: 'a1', task: 't2', is_correct: true, answer_raw: '7' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('TeacherResultsDashboard — видимость результатов', () => {
  it('по умолчанию результаты видны; выключатель закрывает их', async () => {
    mockApi.setSessionsResultsHidden.mockResolvedValue([{ id: 's1', results_hidden: true }]);
    setup();
    await waitFor(() => expect(visibilitySwitch()).toBeTruthy());
    expect(visibilitySwitch().getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/Результаты скрыты от учеников/)).toBeNull();

    fireEvent.click(visibilitySwitch());
    await waitFor(() => expect(mockApi.setSessionsResultsHidden).toHaveBeenCalledWith(['s1'], true));
    await screen.findByText(/Результаты скрыты от учеников/);
    expect(visibilitySwitch().getAttribute('aria-checked')).toBe('false');
  });

  it('закрытые результаты — плашка с кнопкой «Открыть результаты»', async () => {
    mockApi.getSessionsByIds.mockResolvedValue([{ ...SESSION, results_hidden: true }]);
    mockApi.setSessionsResultsHidden.mockResolvedValue([{ id: 's1', results_hidden: false }]);
    setup();
    fireEvent.click(await screen.findByText('Открыть результаты'));
    await waitFor(() => expect(mockApi.setSessionsResultsHidden).toHaveBeenCalledWith(['s1'], false));
    await waitFor(() => expect(screen.queryByText(/Результаты скрыты от учеников/)).toBeNull());
  });

  it('без миграции на сервере — честная ошибка, переключатель не врёт', async () => {
    const err = new Error('no field');
    err.code = 'NO_FIELD';
    mockApi.setSessionsResultsHidden.mockRejectedValue(err);
    setup();
    await waitFor(() => expect(visibilitySwitch()).toBeTruthy());
    fireEvent.click(visibilitySwitch());
    await screen.findByText(/нужна миграция базы/);
    expect(visibilitySwitch().getAttribute('aria-checked')).toBe('true');
  });
});

describe('TeacherResultsDashboard — выгрузка в Excel', () => {
  it('кнопка Excel → окно → файл с названием работы, только сданные', async () => {
    setup();
    await screen.findByText('Белова Анна');
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));
    fireEvent.click(await screen.findByText('Скачать .xlsx'));
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(mockApi.getAttemptAnswersForExport).toHaveBeenCalledWith(['a1']);
    const [sheets, fileName] = download.mock.calls[0];
    expect(fileName).toBe('Контрольная 2 — 10 класс — 07.10.2026');
    expect(sheets[0].rows[0][0].v).toBe('Контрольная 2');
    const names = sheets[0].rows.map((r) => r[1]?.v);
    expect(names).toContain('Белова Анна');
    expect(names).not.toContain('Волков Борис');
  });
});
