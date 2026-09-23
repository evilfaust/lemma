import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import MobileCalendar from '../components/workspace/calendar/MobileCalendar';
import { lessonToEvent } from '../components/workspace/calendar/calendarUtils';

dayjs.locale('ru');

// Среда 25 сентября 2030 — будний день в будущем: свободные пары предлагаются.
const DAY = '2030-09-25';
const raw = {
  id: 'l1', title: 'Алгебра', date_plan: `${DAY} 12:00:00`, time_slot: '2',
  group: 'g1', status: 'planned', expand: { group: { id: 'g1', name: '10 А' } },
};

const setup = (over = {}) => {
  const props = {
    events: [lessonToEvent(raw)],
    date: new Date(`${DAY}T09:00:00`),
    onDateChange: vi.fn(),
    groups: [],
    groupFilter: null,
    setGroupFilter: vi.fn(),
    onOpenLesson: vi.fn(),
    onOpenEvent: vi.fn(),
    onToggleTodo: vi.fn(),
    onToggleLessonDone: vi.fn(),
    onCreate: vi.fn(),
    canEdit: true,
    ...over,
  };
  render(<MobileCalendar {...props} />);
  return props;
};

describe('MobileCalendar', () => {
  it('тап по уроку открывает карточку, по кружку — только «провёл»', () => {
    const p = setup();
    fireEvent.click(screen.getByText('Алгебра'));
    expect(p.onOpenLesson).toHaveBeenCalledWith(raw);
    fireEvent.click(screen.getByLabelText('Отметить проведённым'));
    expect(p.onToggleLessonDone).toHaveBeenCalledWith(raw);
    expect(p.onOpenLesson).toHaveBeenCalledTimes(1);
  });

  it('свободная пара создаёт урок сразу на неё', () => {
    const p = setup();
    expect(screen.queryByText(/2-я пара свободна/)).toBeNull();
    fireEvent.click(screen.getByText(/3-я пара свободна/));
    const [start, pair] = p.onCreate.mock.calls[0];
    expect(pair).toBe('3');
    expect(dayjs(start).format('YYYY-MM-DD HH:mm')).toBe(`${DAY} 14:05`);
  });

  it('без прав на правку свободных пар и кнопок нет', () => {
    setup({ canEdit: false });
    expect(screen.queryByText(/свободна/)).toBeNull();
    expect(screen.queryByLabelText('Отметить проведённым')).toBeNull();
  });
});
