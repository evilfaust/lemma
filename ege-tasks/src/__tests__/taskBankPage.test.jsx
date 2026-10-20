import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';

// «Банк задач» (v3.9.387): обзор вместо «Аналитики», вкладки вместо «Каталога».

const mockApi = vi.hoisted(() => ({
  getTaskBankFlags: vi.fn(),
  getAllVariantTasks: vi.fn(),
  getInternalTaskStats: vi.fn(),
  getExternalTaskStatsByProblem: vi.fn(),
  getTaskIdsBySdamgiaIds: vi.fn(),
  getTasksBrief: vi.fn(),
  getTasksForDuplicateCheck: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));

const ref = vi.hoisted(() => ({ value: null }));
vi.mock('../contexts/ReferenceDataContext', () => ({ useReferenceData: () => ref.value }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ canEdit: true, canDelete: true }),
}));
vi.mock('../hooks/useVectorIndexStats', () => ({ useVectorIndexStats: () => ({ missing: 7, tasks_total: 10 }) }));

// eslint-disable-next-line import/first
import TaskBank from '../components/bank/TaskBank';
// eslint-disable-next-line import/first
import { invalidateBankData } from '../components/bank/BankOverview';
// eslint-disable-next-line import/first
import { invalidateTaskStats } from '../hooks/useTaskStats';

const TOPICS = [
  { id: 'b1', title: 'Простейшие уравнения', exam_type: 'ege_base', ege_number: 1 },
  { id: 'b2', title: 'Проценты', exam_type: 'ege_base', ege_number: 2 },
  { id: 'o1', title: 'Числа', exam_type: 'oge', ege_number: 1 },
  { id: 'x', title: 'Разное', exam_type: 'other' },
];
const SNAPSHOT = [
  ...Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, topic: 'b1', tags: [], difficulty: '1', source: 'Решу' })),
  { id: 'c1', topic: 'o1', tags: [], difficulty: '0', source: 'ФИПИ', year: 2025 },
  { id: 'c2', topic: '', tags: [], difficulty: '2' },
];

function setup({ path = '/app/bank', onOpenTasks = vi.fn() } = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AntApp><TaskBank onOpenTasks={onOpenTasks} onOpenWork={vi.fn()} onOpenImport={vi.fn()} /></AntApp>
    </MemoryRouter>,
  );
  return { onOpenTasks };
}

beforeEach(() => {
  invalidateBankData();
  invalidateTaskStats();
  ref.value = {
    topics: TOPICS,
    subtopics: [],
    tags: [{ id: 'g1', title: 'Дроби' }],
    sources: ['Решу', 'ФИПИ'],
    tasksSnapshot: SNAPSHOT,
    loading: false,
    reloadData: vi.fn(),
  };
  mockApi.getTaskBankFlags.mockResolvedValue({ noAnswer: ['b1', 'b1', ''], noSolution: ['b1'], review: ['b1'] });
  mockApi.getAllVariantTasks.mockResolvedValue([{ work: 'w1', tasks: ['a0', 'a1'] }]);
  mockApi.getInternalTaskStats.mockResolvedValue({ a0: { c: 1, n: 6 }, a1: { c: 5, n: 6 } });
  mockApi.getExternalTaskStatsByProblem.mockResolvedValue({});
  mockApi.getTaskIdsBySdamgiaIds.mockResolvedValue({});
  mockApi.getTasksBrief.mockResolvedValue([{ id: 'a0', code: '1-001', topic: 'b1', statement_md: 'Решите…' }]);
  mockApi.getTasksForDuplicateCheck.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Банк задач — обзор', () => {
  it('шапка и показатели банка', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Банк задач' })).toBeTruthy();
    expect(screen.getByText(/22 задач · 4 тем/)).toBeTruthy();
    // 3 из 22 без ответа → 86 %
    await screen.findByText('86%');
    expect(screen.getByText('19 задач')).toBeTruthy();
    // в работах — 2 задачи
    await waitFor(() => expect(screen.getByText(/9% банка/)).toBeTruthy());
  });

  it('покрытие экзамена: номера заданий, «пусто», доли и использование', async () => {
    setup();
    const card = screen.getByText('Покрытие экзаменов').closest('section');
    await waitFor(() => expect(within(card).getByText('90%')).toBeTruthy()); // ответ у 18 из 20
    expect(within(card).getByText('Простейшие уравнения')).toBeTruthy();
    expect(within(card).getByText('пусто')).toBeTruthy(); // «Проценты»
    expect(within(card).getByText('LaTeX: 1')).toBeTruthy();
    // решаемость темы: 6 верных из 12
    await waitFor(() => expect(within(card).getByText('50%')).toBeTruthy());
  });

  it('клик по заданию открывает его задачи', async () => {
    const { onOpenTasks } = setup();
    fireEvent.click(screen.getByText('Простейшие уравнения'));
    expect(onOpenTasks).toHaveBeenCalledWith({ topic: 'b1' });
  });

  it('«Требует внимания» ведёт в список с нужным фильтром', async () => {
    const { onOpenTasks } = setup();
    const card = screen.getByText('Требует внимания').closest('section');
    fireEvent.click(await within(card).findByText('Проверить LaTeX'));
    expect(onOpenTasks).toHaveBeenLastCalledWith({ issue: 'latex' });
    fireEvent.click(within(card).getByText('Без ответа'));
    expect(onOpenTasks).toHaveBeenLastCalledWith({ hasAnswer: false });
    fireEvent.click(within(card).getByText('Без темы'));
    expect(onOpenTasks).toHaveBeenLastCalledWith({ issue: 'notopic' });
    fireEvent.click(within(card).getByText('Сложность «0»'));
    expect(onOpenTasks).toHaveBeenLastCalledWith({ difficulty: '0' });
    expect(within(card).getByText('Вне векторного индекса')).toBeTruthy();
  });

  it('«Чаще всего ошибаются» — код задачи и переход по нему', async () => {
    const { onOpenTasks } = setup();
    fireEvent.click(await screen.findByText('1-001'));
    expect(onOpenTasks).toHaveBeenCalledWith({ search: '1-001' });
  });

  it('пустая сложность и «0» больше не считаются «Базовой»', () => {
    setup();
    const card = screen.getByText('Состав банка').closest('section');
    expect(within(card).getByText('Вне шкалы (0)')).toBeTruthy();
  });
});

describe('Банк задач — вкладки', () => {
  it('вкладка из адреса: ?tab=topics открывает справочник тем', async () => {
    setup({ path: '/app/bank?tab=topics' });
    const tabs = screen.getAllByRole('tab', { selected: true });
    expect(tabs[0].textContent).toMatch(/Темы/);
    expect(await screen.findByText('Добавить тему')).toBeTruthy();
  });

  it('«Дубли» подгружают условия задач только по заходу', async () => {
    setup();
    expect(mockApi.getTasksForDuplicateCheck).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: /Дубли/ }));
    await waitFor(() => expect(mockApi.getTasksForDuplicateCheck).toHaveBeenCalledTimes(1));
  });
});
