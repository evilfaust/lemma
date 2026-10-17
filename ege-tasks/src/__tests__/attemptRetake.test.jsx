import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import dayjs from 'dayjs';
import {
  attemptLimit, maxAttemptsValue, attemptsSettingOf, retakeCandidates, retakeOf, retakeLabel,
  sessionSettingsChanged,
} from '../utils/attemptRetake';
import { retakeOffers, recentResults, todoList, unfinishedAttempts } from '../utils/studentHome';
import { itemResult } from '../utils/lessonResults';

// Повторные попытки (v3.9.380): «Несколько попыток» прямо в «Результатах» и в
// уроке, «Ещё попытка тем, кто ниже порога», экран ученика узнаёт о новой
// попытке без перезагрузки, «можно пересдать» на главной и в уроке.

const mockApi = vi.hoisted(() => ({
  getAttemptsBySession: vi.fn(),
  getSession: vi.fn(),
  getMCTest: vi.fn(),
  getAchievements: vi.fn(),
  getSessionsByIds: vi.fn(),
  getVariantsByWork: vi.fn(),
  createAttempt: vi.fn(),
  setSessionsMaxAttempts: vi.fn(),
  getAttemptAnswers: vi.fn(),
}));
vi.mock('../services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/MathRenderer', () => ({ default: ({ text }) => <span>{text}</span> }));
vi.mock('../components/worksheet/ClassRemediationModal', () => ({ default: () => null }));

// eslint-disable-next-line import/first
import TeacherResultsDashboard from '../components/worksheet/TeacherResultsDashboard';
// eslint-disable-next-line import/first
import StudentResultPage from '../components/student/StudentResultPage';

const at = (id, o) => ({
  id, session: 's1', status: 'submitted', score: 0, total: 10, created: '2026-10-16T09:00:00Z', ...o,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('attemptRetake: настройки выдачи', () => {
  it('лимит: пусто/0/1 — одна попытка, 2+ — как есть', () => {
    expect(attemptLimit({})).toBe(1);
    expect(attemptLimit({ max_attempts: 0 })).toBe(1);
    expect(attemptLimit({ max_attempts: 1 })).toBe(1);
    expect(attemptLimit({ max_attempts: 3 })).toBe(3);
    expect(maxAttemptsValue(1)).toBe(0);
    expect(maxAttemptsValue(4)).toBe(4);
  });

  it('несколько выдач: наибольший лимит и пометка «по-разному»', () => {
    expect(attemptsSettingOf([])).toEqual({ limit: 1, mixed: false });
    expect(attemptsSettingOf([{ max_attempts: 2 }, { max_attempts: 2 }])).toEqual({ limit: 2, mixed: false });
    expect(attemptsSettingOf([{ max_attempts: 0 }, { max_attempts: 3 }])).toEqual({ limit: 3, mixed: true });
  });

  it('экран ученика замечает только настройки, которые на нём видны', () => {
    const s = { id: 's1', max_attempts: 0, is_open: true, updated: 'a' };
    expect(sessionSettingsChanged(s, { ...s, updated: 'b' })).toBe(false);
    expect(sessionSettingsChanged(s, { ...s, max_attempts: 2 })).toBe(true);
    expect(sessionSettingsChanged(s, { ...s, is_open: false })).toBe(true);
  });
});

describe('retakeCandidates — кому дать ещё попытку', () => {
  const attempts = [
    at('a1', { student: 'u1', student_name: 'Иванова', score: 3 }),
    at('a2', { student: 'u2', student_name: 'Петров', score: 4 }),
    at('a3', { student: 'u2', student_name: 'Петров', score: 9, created: '2026-10-16T10:00:00Z' }),
    at('a4', { student: 'u3', student_name: 'Сидоров', score: 2 }),
    at('a5', { student: 'u3', student_name: 'Сидоров', status: 'started', created: '2026-10-16T11:00:00Z' }),
    at('a6', { device_id: 'd1', student_name: 'Гость', score: 5 }),
    at('a7', { student: 'u4', student_name: 'Не сдал', status: 'started' }),
  ];

  it('по лучшему результату ниже порога, слабые сверху', () => {
    const rows = retakeCandidates(attempts, 60);
    expect(rows.map((r) => r.name)).toEqual(['Иванова', 'Гость']);
    expect(rows[0]).toMatchObject({ bestPct: 30, count: 1 });
    expect(rows[0].attempt.id).toBe('a1');
  });

  it('у кого уже выдана попытка, и кто не сдавал вовсе — не в списке', () => {
    const names = retakeCandidates(attempts, 101).map((r) => r.name);
    expect(names).not.toContain('Сидоров');
    expect(names).not.toContain('Не сдал');
    expect(names).toContain('Петров');
  });
});

describe('retakeOf — ученику: можно ли пройти ещё раз', () => {
  const session = { id: 's1', max_attempts: 3, is_open: true };

  it('«Несколько попыток»: сколько осталось', () => {
    const r = retakeOf('s1', [at('a1')], session);
    expect(r).toEqual({ kind: 'more', left: 2, limit: 3 });
    expect(retakeLabel(r)).toBe('Можно пересдать · ещё 2 попытки');
    expect(retakeLabel({ kind: 'more', left: 1 })).toBe('Можно пересдать · ещё 1 попытка');
    expect(retakeLabel({ kind: 'more', left: 5 })).toBe('Можно пересдать · ещё 5 попыток');
  });

  it('лимит исчерпан, приём закрыт, одна попытка, ещё не сдавал — нет', () => {
    const three = [at('a1'), at('a2'), at('a3')];
    expect(retakeOf('s1', three, session)).toBeNull();
    expect(retakeOf('s1', [at('a1')], { ...session, is_open: false })).toBeNull();
    expect(retakeOf('s1', [at('a1')], { max_attempts: 0 })).toBeNull();
    expect(retakeOf('s1', [at('a1', { status: 'started' })], session)).toBeNull();
  });

  it('учитель выдал попытку — «issued» и без «Нескольких попыток»', () => {
    const list = [at('a1'), at('a2', { status: 'started', created: '2026-10-16T12:00:00Z' })];
    expect(retakeOf('s1', list, { max_attempts: 0 })).toEqual({ kind: 'issued' });
  });

  it('выдача берётся из expand попыток', () => {
    const list = [at('a1', { expand: { session: { max_attempts: 2, is_open: true } } })];
    expect(retakeOf('s1', list)).toMatchObject({ kind: 'more', left: 1 });
  });
});

describe('главная ученика: «можно пересдать»', () => {
  const now = dayjs('2026-10-17T10:00:00Z');
  const sess = (o = {}) => ({ id: 's1', max_attempts: 2, is_open: true, student_title: 'Устный счёт', ...o });

  it('retakeOffers: не на 100 %, свежая, лимит не исчерпан', () => {
    const list = [at('a1', { score: 4, expand: { session: sess() } })];
    expect(retakeOffers(list, now)).toEqual([
      expect.objectContaining({ sessionId: 's1', title: 'Устный счёт', left: 1, pct: 40 }),
    ]);
    const perfect = [at('a1', { score: 10, expand: { session: sess() } })];
    expect(retakeOffers(perfect, now)).toEqual([]);
    const old = [at('a1', { score: 4, created: '2026-09-01T09:00:00Z', expand: { session: sess() } })];
    expect(retakeOffers(old, now)).toEqual([]);
  });

  it('последние результаты и «Сделать» несут пометку', () => {
    const list = [at('a1', { score: 4, expand: { session: sess() } })];
    expect(recentResults(list)[0].retake).toMatchObject({ kind: 'more', left: 1 });
    const lessons = [{
      id: 'l1', group: 'g1', owner: 't1', date_plan: '2026-10-16T08:00:00.000Z',
      items: [{ kind: 'work', role: 'homework', session_id: 's1', title: 'Устный счёт' }],
    }];
    const row = todoList(lessons, list, now).find((r) => r.item.session_id === 's1');
    expect(row.done).toBe(true);
    expect(row.retake).toMatchObject({ kind: 'more' });
  });

  it('выданная учителем попытка — «новая попытка», а не брошенный тест', () => {
    const list = [
      at('a2', { status: 'started', created: '2026-10-16T12:00:00Z', expand: { session: sess({ max_attempts: 0 }) } }),
      at('a1', { expand: { session: sess({ max_attempts: 0 }) } }),
    ];
    expect(unfinishedAttempts(list, now)).toEqual([expect.objectContaining({ sessionId: 's1', issued: true })]);
  });
});

describe('карточка урока: «можно пересдать»', () => {
  const item = { kind: 'work', session_id: 's1' };
  it('сдано с баллом + остались попытки', () => {
    const res = itemResult(item, [at('a1', { score: 6, expand: { session: { max_attempts: 2, is_open: true } } })]);
    expect(res).toMatchObject({ state: 'done', pct: 60, retake: { kind: 'more', left: 1 } });
  });
  it('на 100 % пересдать не предлагаем, выданную учителем — всегда', () => {
    const s = { max_attempts: 2, is_open: true };
    expect(itemResult(item, [at('a1', { score: 10, expand: { session: s } })]).retake).toBeNull();
    const issued = [
      at('a1', { score: 10, expand: { session: s } }),
      at('a2', { status: 'started', created: '2026-10-16T12:00:00Z', expand: { session: s } }),
    ];
    expect(itemResult(item, issued).retake).toEqual({ kind: 'issued' });
  });
});

describe('«Результаты»: попытки и «Ещё попытка…»', () => {
  const SESSION = { id: 's1', work: '', mc_test: 'mc1', max_attempts: 0, is_open: true };
  const MC_TEST = {
    id: 'mc1',
    variants: [
      { number: 1, tasks: [{ id: 'q1' }, { id: 'q2' }] },
      { number: 2, tasks: [{ id: 'q3' }, { id: 'q4' }] },
    ],
  };
  const ATTEMPTS = [
    at('a1', { student: 'u1', student_name: 'Иванова Мария', score: 0, total: 2, mc_variant: 1 }),
    at('a2', { student: 'u2', student_name: 'Петров Глеб', score: 2, total: 2, mc_variant: 2 }),
    at('a3', { student: 'u3', student_name: 'Рубцова Екатерина', score: 1, total: 4, mc_variant: 1 }),
  ];

  beforeEach(() => {
    mockApi.getAttemptsBySession.mockResolvedValue(ATTEMPTS.map((a) => ({ ...a })));
    mockApi.getSession.mockResolvedValue(SESSION);
    mockApi.getMCTest.mockResolvedValue(MC_TEST);
    mockApi.getAchievements.mockResolvedValue([]);
    mockApi.getSessionsByIds.mockResolvedValue([SESSION]);
    mockApi.createAttempt.mockImplementation(async (d) => ({ id: `n-${d.student}`, ...d }));
    mockApi.setSessionsMaxAttempts.mockImplementation(async (ids, v) => ids.map((id) => ({ ...SESSION, id, max_attempts: v })));
  });

  it('включает «Несколько попыток» прямо из результатов', async () => {
    const onSessionsChange = vi.fn();
    render(<AntApp><TeacherResultsDashboard sessionId="s1" onSessionsChange={onSessionsChange} /></AntApp>);
    fireEvent.click(await screen.findByRole('switch', { name: 'Несколько попыток' }));
    await waitFor(() => expect(mockApi.setSessionsMaxAttempts).toHaveBeenCalledWith(['s1'], 2));
    await waitFor(() => expect(onSessionsChange).toHaveBeenCalled());
    expect(await screen.findByRole('spinbutton', { name: 'Сколько попыток' })).toBeTruthy();
  });

  it('выдаёт попытку тем, кто ниже порога — каждому другой вариант', async () => {
    render(<AntApp><TeacherResultsDashboard sessionId="s1" /></AntApp>);
    fireEvent.click(await screen.findByText('Ещё попытка…'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Иванова Мария')).toBeTruthy();
    expect(within(dialog).getByText('Рубцова Екатерина')).toBeTruthy();
    expect(within(dialog).queryByText('Петров Глеб')).toBeNull();
    fireEvent.click(within(dialog).getByText('Дать попытку (2)'));

    await waitFor(() => expect(mockApi.createAttempt).toHaveBeenCalledTimes(2));
    const payloads = mockApi.createAttempt.mock.calls.map((c) => c[0]);
    expect(payloads.map((p) => p.student).sort()).toEqual(['u1', 'u3']);
    payloads.forEach((p) => {
      expect(p).toMatchObject({ session: 's1', status: 'started', mc_variant: 2, total: 2 });
    });
    // Выдача и тест читаются один раз на пачку
    expect(mockApi.getMCTest.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('экран результата ученика: попытку выдал учитель', () => {
  it('показывает «Начать попытку» без «Нескольких попыток»', async () => {
    const startRetry = vi.fn();
    mockApi.getAttemptAnswers.mockResolvedValue([]);
    render(
      <AntApp>
        <StudentResultPage studentSession={{
          attempt: at('a1', { score: 3 }),
          tasks: [],
          session: { id: 's1', max_attempts: 0 },
          issuedAttempt: at('a2', { status: 'started' }),
          startRetry,
        }} />
      </AntApp>,
    );
    expect(await screen.findByText('Учитель дал тебе ещё одну попытку')).toBeTruthy();
    fireEvent.click(screen.getByText('Начать попытку'));
    expect(startRetry).toHaveBeenCalled();
  });
});
