import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import dayjs from 'dayjs';

// Окно «Создать» в календаре (v3.9.393): класс кнопками, темы прошлых уроков,
// пара кнопками, итог и «Создать и открыть», срок дедлайна до конца дня.

const mockApi = vi.hoisted(() => ({
  getLessons: vi.fn(),
  createLesson: vi.fn(),
  createSession: vi.fn(),
  createTodo: vi.fn(),
  createSchoolEvent: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import CreateEventModal from '../components/workspace/calendar/CreateEventModal';

const GROUPS = [{ id: 'g1', name: '11 БАЗА' }, { id: 'g2', name: '10 кл' }];
const WORKS = [{ id: 'w1', title: 'Контрольная №2' }];
const DAY = new Date(2026, 9, 21);

const renderModal = (props = {}) => {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <AntApp>
      <CreateEventModal open type="lesson" day={DAY} pair={null} groups={GROUPS} works={WORKS}
        onClose={onClose} onCreated={onCreated} {...props} />
    </AntApp>,
  );
  return { onCreated, onClose };
};

beforeEach(() => {
  mockApi.getLessons.mockResolvedValue([
    { id: 'l1', title: 'Проценты' },
    { id: 'l2', title: 'Логарифмы' },
    { id: 'l3', title: 'проценты' },
  ]);
  mockApi.createLesson.mockImplementation(async (d) => ({ id: 'new', ...d }));
  mockApi.createSession.mockResolvedValue({ id: 's1' });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('CreateEventModal — урок', () => {
  it('класс кнопкой, тема из недавних, пара кнопкой → урок с кодом пары', async () => {
    const { onCreated } = renderModal();
    expect(screen.getByText('Новый урок')).toBeInTheDocument();

    fireEvent.click(screen.getByText('11 БАЗА'));
    // Недавние темы: свежие первыми, без повторов без учёта регистра.
    const chip = await screen.findByText('Логарифмы');
    expect(screen.getAllByText(/^проценты$/i)).toHaveLength(1);
    fireEvent.click(chip);

    fireEvent.click(screen.getByTitle(/^2-я пара/));
    expect(await screen.findByText(/«Логарифмы» · 11 БАЗА · .*12:00–13:45/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Создать урок'));
    await waitFor(() => expect(mockApi.createLesson).toHaveBeenCalled());
    const data = mockApi.createLesson.mock.calls[0][0];
    expect(data).toMatchObject({ title: 'Логарифмы', group: 'g1', time_slot: '2', status: 'planned' });
    expect(dayjs(data.date_plan).format('YYYY-MM-DD HH:mm')).toBe('2026-10-21 12:00');
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }), { open: false });
  });

  it('«Создать и открыть» просит открыть окно урока', async () => {
    const { onCreated } = renderModal({ pair: '1' });
    fireEvent.change(screen.getByPlaceholderText(/Квадратные уравнения/), { target: { value: 'Алгебра' } });
    fireEvent.click(screen.getByText('Создать и открыть'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mockApi.createLesson.mock.calls[0][0]).toMatchObject({ title: 'Алгебра', time_slot: '1' });
    expect(onCreated.mock.calls[0][1]).toEqual({ open: true });
  });

  it('без темы не создаёт', async () => {
    renderModal();
    fireEvent.click(screen.getByText('Создать урок'));
    expect(await screen.findByText('Напишите тему урока')).toBeInTheDocument();
    expect(mockApi.createLesson).not.toHaveBeenCalled();
  });
});

describe('CreateEventModal — дедлайн', () => {
  it('срок дня из ячейки — до 23:59, «Через неделю» сохраняет время', async () => {
    renderModal({ type: 'deadline' });
    expect(screen.getByText('Новый дедлайн')).toBeInTheDocument();
    expect(await screen.findByText(/сдать до .*23:59/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Через неделю'));
    const week = dayjs().startOf('day').add(7, 'day');
    expect(await screen.findByText(new RegExp(`сдать до ${week.format('dd, D MMMM')}, 23:59`))).toBeInTheDocument();
  });
});
