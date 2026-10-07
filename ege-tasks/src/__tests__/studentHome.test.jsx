import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import dayjs from 'dayjs';
import {
  lessonWindow, currentLesson, nextLesson, relDayLabel, untilLabel, attemptTitle,
  unfinishedAttempts, recentResults, itemLink, todoList, summerSeason,
} from '../utils/studentHome';

// Главная ученика (v3.9.316): лента «что делать».

const mockApi = vi.hoisted(() => ({
  getMyLessons: vi.fn(),
  getRecentStudentAttempts: vi.fn(),
  getMyStereoFeed: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StudentHome from '../components/student/StudentHome';

// среда, 7 октября 2026, 12:00
const NOW = dayjs('2026-10-07T12:00:00');
const at = (s) => dayjs(s).toISOString();

const lesson = (id, date, extra = {}) => ({ id, date_plan: at(date), group: 'g1', owner: 't1', items: [], ...extra });
const attempt = (id, session, status, extra = {}) => ({
  id, session, status, created: at('2026-10-06T10:00:00'), ...extra,
});

describe('уроки: сейчас и дальше', () => {
  it('окно урока — по паре расписания, иначе 45 минут', () => {
    const w = lessonWindow(lesson('a', '2026-10-07T10:15:00', { time_slot: '1' }));
    expect(w.start.format('HH:mm')).toBe('10:15');
    expect(w.end.format('HH:mm')).toBe('11:45');
    const plain = lessonWindow(lesson('b', '2026-10-07T13:00:00'));
    expect(plain.end.format('HH:mm')).toBe('13:45');
  });

  it('идущий урок и ближайший; отменённый и скрытый — мимо', () => {
    const list = [
      lesson('past', '2026-10-06T10:00:00'),
      lesson('now', '2026-10-07T11:30:00'),
      lesson('cancel', '2026-10-07T14:00:00', { status: 'cancelled' }),
      lesson('hidden', '2026-10-07T15:00:00', { hidden_from_students: true }),
      lesson('next', '2026-10-08T10:15:00'),
    ];
    expect(currentLesson(list, NOW).id).toBe('now');
    expect(nextLesson(list, NOW).id).toBe('next');
    expect(currentLesson([lesson('x', '2026-10-07T13:00:00')], NOW)).toBeNull();
  });

  it('подписи дней и отсчёт', () => {
    expect(relDayLabel('2026-10-07T18:00:00', NOW)).toBe('сегодня');
    expect(relDayLabel('2026-10-08T08:00:00', NOW)).toBe('завтра');
    expect(relDayLabel('2026-10-06T08:00:00', NOW)).toBe('вчера');
    expect(relDayLabel('2026-10-09T08:00:00', NOW)).toBe('пт, 9 окт.');
    expect(untilLabel(lesson('a', '2026-10-07T12:25:00'), NOW)).toBe('через 25 мин');
    expect(untilLabel(lesson('a', '2026-10-07T15:00:00'), NOW)).toBe('сегодня в 15:00');
    expect(untilLabel(lesson('a', '2026-10-08T10:15:00'), NOW)).toBe('завтра в 10:15');
  });
});

describe('попытки', () => {
  const session = (title, extra = {}) => ({ expand: { session: { student_title: title, ...extra } } });

  it('название — как видел ученик при выдаче', () => {
    expect(attemptTitle(session('Логарифмы'))).toBe('Логарифмы');
    expect(attemptTitle({ expand: { session: { expand: { work: { title: 'Работа' } } } } })).toBe('Работа');
    expect(attemptTitle({})).toBe('Тест');
  });

  it('недорешённые: открытая выдача, не старше двух недель, без уже сданной', () => {
    const list = [
      attempt('a1', 's1', 'started', session('Логарифмы')),
      attempt('a2', 's1', 'started', session('Логарифмы')), // та же выдача — одна строка
      attempt('a3', 's2', 'started', session('Закрыто', { is_open: false })),
      attempt('a4', 's3', 'started', { ...session('Старьё'), created: at('2026-09-01T10:00:00') }),
      attempt('a5', 's4', 'started', session('Сдал раньше')),
      attempt('a6', 's4', 'submitted', session('Сдал раньше')),
      attempt('a7', 's5', 'submitted', session('Готово')),
    ];
    const out = unfinishedAttempts(list, NOW);
    expect(out.map((u) => u.title)).toEqual(['Логарифмы']);
    expect(out[0].sessionId).toBe('s1');
  });

  it('недорешённая при нескольких попытках — напоминаем, даже если одна сдана', () => {
    const list = [
      attempt('a1', 's1', 'started', session('Повтор', { max_attempts: 3 })),
      attempt('a0', 's1', 'submitted', session('Повтор', { max_attempts: 3 })),
    ];
    expect(unfinishedAttempts(list, NOW)).toHaveLength(1);
  });

  it('последние результаты: свежие сверху, одна на выдачу, с процентом', () => {
    const list = [
      attempt('a1', 's1', 'submitted', { ...session('Старая'), score: 3, total: 10, submitted_at: at('2026-10-01T10:00:00') }),
      attempt('a2', 's2', 'corrected', { ...session('Свежая'), score: 8, total: 10, submitted_at: at('2026-10-06T10:00:00') }),
      attempt('a3', 's2', 'submitted', { ...session('Свежая'), score: 5, total: 10, submitted_at: at('2026-10-05T10:00:00') }),
      attempt('a4', 's3', 'started', session('Не сдана')),
      attempt('a5', 's4', 'submitted', { ...session('Без задач'), score: 0, total: 0 }),
    ];
    const out = recentResults(list);
    expect(out.map((r) => r.title)).toEqual(['Свежая', 'Старая']);
    expect(out[0]).toMatchObject({ score: 8, total: 10, pct: 80 });
  });
});

describe('Сделать', () => {
  it('ссылки пунктов', () => {
    expect(itemLink({ kind: 'work', session_id: 's1' })).toEqual({ href: '/student/s1', action: 'Решать' });
    expect(itemLink({ kind: 'work' })).toBeNull();
    expect(itemLink({ kind: 'show', work_id: 'w1' }).href).toBe('/student/r/w1');
    expect(itemLink({ kind: 'show', work_id: 'w1', geometry: true }).href).toBe('/student/w/w1');
    expect(itemLink({ kind: 'file', file_url: 'https://x/f.pdf' })).toMatchObject({ external: true });
    expect(itemLink({ kind: 'text', description: 'п. 5' })).toBeNull();
  });

  it('ДЗ по срокам, сданное — в конце и с отметкой', () => {
    const list = [
      lesson('l1', '2026-10-06T10:15:00', {
        items: [
          { role: 'homework', due: 'next', kind: 'work', title: 'Производная', session_id: 's1' },
          { role: 'homework', kind: 'work', title: 'Уже сдал', session_id: 's2' },
        ],
      }),
      lesson('l2', '2026-10-09T10:15:00'),
    ];
    const atts = [attempt('a', 's2', 'submitted')];
    const rows = todoList(list, atts, NOW);
    expect(rows.map((r) => r.title)).toEqual(['Производная', 'Уже сдал']);
    expect(rows[0]).toMatchObject({ done: false, dueLabel: 'к уроку пт, 9 окт.' });
    expect(rows[1]).toMatchObject({ done: true, dueLabel: 'задано вчера' });
  });

  it('ДЗ к будущему уроку видно сразу — со сроком «к уроку»', () => {
    const list = [
      lesson('l1', '2026-10-08T00:00:00', {
        items: [{ role: 'homework', kind: 'show', work_id: 'w1', geometry: true, title: 'ДЗ Геометрия 10.1' }],
      }),
    ];
    const rows = todoList(list, [], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'ДЗ Геометрия 10.1', dueLabel: 'к уроку завтра', done: false });
    expect(rows[0].link.href).toBe('/student/w/w1');
  });

  it('каникулярное — только в сезон', () => {
    expect(summerSeason(dayjs('2026-07-01'))).toBe(true);
    expect(summerSeason(dayjs('2026-09-20'))).toBe(true);
    expect(summerSeason(NOW)).toBe(false);
  });
});

describe('экран главной', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW.toDate());
    Object.values(mockApi).forEach((f) => f.mockReset());
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const renderHome = async (props = {}) => {
    render(
      <StudentHome
        student={{ id: 'st1', name: 'Иванов Пётр', username: 'ivanov.p' }}
        isDark={false}
        onToggleTheme={() => {}}
        onLogout={() => {}}
        onChangePassword={() => {}}
        go={() => {}}
        hasSummer={false}
        {...props}
      />,
    );
    await act(async () => {});
  };

  it('приветствие, эфир, недорешённый тест, ДЗ, ближайший урок, результат', async () => {
    mockApi.getMyLessons.mockResolvedValue({
      groups: [{ id: 'g1', name: '10 А' }],
      lessons: [
        lesson('l1', '2026-10-06T10:15:00', {
          items: [{ role: 'homework', due: 'next', kind: 'work', title: 'Производная', session_id: 's1' }],
        }),
        lesson('l2', '2026-10-08T10:15:00', { title: 'Тригонометрия', time_slot: '1' }),
      ],
    });
    mockApi.getRecentStudentAttempts.mockResolvedValue([
      attempt('a1', 's9', 'started', { expand: { session: { student_title: 'Логарифмы' } } }),
      attempt('a2', 's8', 'submitted', {
        expand: { session: { student_title: 'Степени' } }, score: 7, total: 10, submitted_at: at('2026-10-05T10:00:00'),
      }),
    ]);
    mockApi.getMyStereoFeed.mockResolvedValue({
      rooms: [{ code: '10a', title: 'Сечение куба' }], scenes: [], works: [], shows: [],
    });
    await renderHome();

    expect(document.querySelector('.sh-hello').textContent).toBe('Привет, Пётр!');
    expect(screen.getByText('10 А')).toBeTruthy();
    expect(screen.getByText('Сечение куба').closest('a').getAttribute('href')).toBe('/student/b/10a');
    expect(screen.getByText('Логарифмы').closest('a').getAttribute('href')).toBe('/student/s9');
    expect(screen.getByText('Производная')).toBeTruthy();
    expect(screen.getByText('Решать').closest('a').getAttribute('href')).toBe('/student/s1');
    expect(screen.getByText('Тригонометрия')).toBeTruthy();
    expect(screen.getByText('завтра в 10:15')).toBeTruthy();
    expect(screen.getByText('Степени').closest('a').getAttribute('href')).toBe('/student/s8');
    expect(screen.queryByText('Пока здесь пусто')).toBeNull();
    expect(screen.getByLabelText('Код теста')).toBeTruthy();
  });

  it('ни уроков, ни материалов, ни результатов — объяснение и код теста', async () => {
    mockApi.getMyLessons.mockResolvedValue(null);
    mockApi.getRecentStudentAttempts.mockResolvedValue([]);
    mockApi.getMyStereoFeed.mockResolvedValue(null);
    await renderHome();
    expect(screen.getByText('Пока здесь пусто')).toBeTruthy();
    expect(screen.queryByText('Сделать')).toBeNull();
    expect(screen.getByLabelText('Код теста')).toBeTruthy();
  });

  it('класс с расписанием, но без ДЗ — «Сделать» успокаивает', async () => {
    mockApi.getMyLessons.mockResolvedValue({ groups: [{ id: 'g1', name: '10 А' }], lessons: [] });
    mockApi.getRecentStudentAttempts.mockResolvedValue([]);
    mockApi.getMyStereoFeed.mockResolvedValue(null);
    await renderHome();
    expect(screen.getByText('Домашних заданий нет.')).toBeTruthy();
  });
});
