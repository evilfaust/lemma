import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import {
  weekStart, weekDays, weekLabel, lessonsByDay, dayMarks, rangeToLoad, mergeRange,
} from '../utils/studentWeek';

// Календарь «неделя» в «Моих уроках» ученика (v3.9.292).

const mockApi = vi.hoisted(() => ({ getMyLessons: vi.fn() }));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StudentCoursePortal from '../components/student/StudentCoursePortal';

describe('неделя: чистая логика', () => {
  it('неделя с понедельника, воскресенье — конец прошлой', () => {
    expect(weekStart('2026-10-11T15:00:00').format('YYYY-MM-DD')).toBe('2026-10-05');
    expect(weekStart('2026-10-05T00:30:00').format('YYYY-MM-DD')).toBe('2026-10-05');
    expect(weekDays('2026-10-07').map((d) => d.format('DD'))).toEqual(['05', '06', '07', '08', '09', '10', '11']);
  });

  it('подпись недели: один месяц, два месяца, другой год', () => {
    const now = dayjs('2026-10-07');
    expect(weekLabel('2026-10-07', now)).toBe('5–11 октября');
    expect(weekLabel('2026-10-01', now)).toBe('28 сентября – 4 октября');
    expect(weekLabel('2027-01-13', now)).toBe('11–17 января 2027');
  });

  it('уроки по дням — по времени', () => {
    const map = lessonsByDay([
      { id: 'b', date_plan: '2026-10-05T12:00:00' },
      { id: 'a', date_plan: '2026-10-05T09:00:00' },
      { id: 'c', date_plan: '2026-10-06T09:00:00' },
    ]);
    expect(map.get('2026-10-05').map((l) => l.id)).toEqual(['a', 'b']);
    expect(map.get('2026-10-06')).toHaveLength(1);
  });

  it('отметки дня: уроки без отменённых, ДЗ к уроку и пришедшее с прошлого', () => {
    const plain = { id: 'p', items: [] };
    const off = { id: 'o', status: 'cancelled', items: [{ role: 'homework' }] };
    expect(dayMarks([plain, off], new Map())).toEqual({ lessons: 1, cancelled: 1, homework: false });
    expect(dayMarks([plain], new Map([['p', [{}]]])).homework).toBe(true);
    expect(dayMarks([{ id: 'h', items: [{ role: 'homework' }] }], new Map()).homework).toBe(true);
    // «ДЗ к след.» — отметка у урока-цели, а не у урока, где задано
    expect(dayMarks([{ id: 'n', items: [{ role: 'homework', due: 'next' }] }], new Map()).homework).toBe(false);
  });

  it('догрузка: внутри окна — ничего, рядом — расширяем, далеко — только окрестность', () => {
    const loaded = { from: dayjs('2026-09-01').valueOf(), to: dayjs('2026-12-01').valueOf() };
    expect(rangeToLoad('2026-10-07', loaded)).toBeNull();
    const ext = rangeToLoad('2026-12-10', loaded);
    expect(ext.from).toBe(loaded.from);
    expect(ext.to).toBeGreaterThan(dayjs('2026-12-14').valueOf());
    const far = rangeToLoad('2028-03-01', loaded);
    expect(far.from).toBeGreaterThan(loaded.to);
    // Запрос в полёте уже покрывает неделю — второй не нужен
    expect(rangeToLoad('2026-12-10', loaded, ext)).toBeNull();
  });

  it('окно после ответа: непрерывное — объединение, разрыв или слишком длинное — новое', () => {
    const a = { from: 0, to: 100 };
    expect(mergeRange(a, { from: 50, to: 200 })).toEqual({ from: 0, to: 200 });
    expect(mergeRange(a, { from: 300, to: 400 })).toEqual({ from: 300, to: 400 });
    const DAY = 24 * 3600 * 1000;
    const long = { from: 90 * DAY, to: 500 * DAY };
    expect(mergeRange({ from: 0, to: 100 * DAY }, long)).toEqual(long);
  });
});

describe('вкладка «Уроки»: неделя', () => {
  const GROUPS = [{ id: 'g1', name: '9 А', kind: 'class' }];
  const LESSONS = [
    { id: 'mon', group: 'g1', owner: 't', title: 'Тема понедельника', date_plan: '2026-10-05T10:15:00', time_slot: '1',
      items: [{ kind: 'text', role: 'homework', due: 'next', description: 'Задача 7' }] },
    { id: 'wed', group: 'g1', owner: 't', title: 'Тема среды', date_plan: '2026-10-07T16:00:00', time_slot: '4', items: [] },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T12:00:00'));
    try { localStorage.clear(); } catch { /* нет хранилища */ }
    mockApi.getMyLessons.mockReset();
    mockApi.getMyLessons.mockResolvedValue({ groups: GROUPS, lessons: LESSONS });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('сегодняшний день открыт, ДЗ с понедельника — у урока среды', async () => {
    render(<StudentCoursePortal student={{ id: 's1' }} />);
    expect(await screen.findByText('Тема среды')).toBeTruthy();
    expect(screen.getByText('5–11 октября')).toBeTruthy();
    expect(screen.getByText('📌 Сделать к этому уроку')).toBeTruthy();
    // У среды отметка ДЗ, у понедельника — нет (там ДЗ задано, а не сдаётся)
    expect(screen.getByLabelText(/среда, 7 октября: уроков: 1, есть ДЗ/)).toBeTruthy();
    expect(screen.getByLabelText(/понедельник, 5 октября: уроков: 1$/)).toBeTruthy();
  });

  it('клик по дню, листание недель, «Сегодня», догрузка далёкой недели', async () => {
    render(<StudentCoursePortal student={{ id: 's1' }} />);
    await screen.findByText('Тема среды');

    fireEvent.click(screen.getByLabelText(/понедельник, 5 октября/));
    expect(screen.getAllByText('Тема понедельника').length).toBeGreaterThan(0);
    expect(screen.getByText(/К следующему уроку · 7 окт/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Следующая неделя'));
    expect(screen.getByText('12–18 октября')).toBeTruthy();
    expect(screen.getByText('В этот день уроков нет')).toBeTruthy();
    expect(mockApi.getMyLessons).toHaveBeenCalledTimes(1); // в загруженном окне

    fireEvent.click(screen.getByText('Сегодня'));
    expect(screen.getByText('5–11 октября')).toBeTruthy();

    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByLabelText('Следующая неделя'));
    await waitFor(() => expect(mockApi.getMyLessons).toHaveBeenCalledTimes(2));
    const [{ to }] = mockApi.getMyLessons.mock.calls[1];
    expect(new Date(to).getTime()).toBeGreaterThan(new Date('2027-02-28').getTime());
  });

  it('вид «Списком» запоминается', async () => {
    render(<StudentCoursePortal student={{ id: 's1' }} />);
    await screen.findByText('Тема среды');
    fireEvent.click(screen.getByText('Списком'));
    expect(screen.getByText(/Прошедшие уроки/)).toBeTruthy();
    expect(localStorage.getItem('student.lessons.view')).toBe('list');
  });
});
