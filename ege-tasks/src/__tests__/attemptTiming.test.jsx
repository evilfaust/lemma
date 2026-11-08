import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AttemptTiming from '../components/worksheet/AttemptTiming';
import { averageAttemptDuration } from '../utils/attemptTiming';

describe('время в результатах', () => {
  it('показывает обе даты и считает интервал от created для записи без started_at', () => {
    render(<AttemptTiming attempt={{ created: '2026-11-02T12:00:00Z', submitted_at: '2026-11-02T13:30:00Z', status: 'submitted' }} />);
    expect(screen.getByText('От начала до сдачи · 1 ч 30 мин')).toBeTruthy();
    expect(screen.getByText(/02.11.*→.*02.11/)).toBeTruthy();
  });
  it('считает интервал по отметкам PocketBase вместо старых 46 секунд', () => {
    render(<AttemptTiming attempt={{
      created: '2026-10-30 08:00:00.000Z',
      started_at: '2026-10-31 09:46:55.900Z',
      submitted_at: '2026-11-01 14:36:26.100Z',
      duration_seconds: 46,
      status: 'submitted',
    }} />);
    expect(screen.getByText('От начала до сдачи · 28 ч 49 мин')).toBeTruthy();
  });
  it('не придумывает время сдачи незавершённой попытки', () => {
    render(<AttemptTiming attempt={{ created: '2026-11-02T12:00:00Z', status: 'started' }} />);
    expect(screen.getByText('В работе')).toBeTruthy();
  });
  it('не выдаёт время сканирования бланка за время решения', () => {
    render(<AttemptTiming attempt={{ source: 'scan', duration_seconds: 300 }} />);
    expect(screen.getByText('Бланк')).toBeTruthy();
  });
  it('отличает выданную попытку, которую ученик ещё не открыл', () => {
    render(<AttemptTiming attempt={{ created: '2026-11-02T12:00:00Z', started_at: '', status: 'started' }} />);
    expect(screen.getByText('Не приступил')).toBeTruthy();
  });
  it.each(['', 'invalid', '2026-11-02T11:59:00Z'])('не выводит длительность при неподходящей дате сдачи %s', (submitted_at) => {
    render(<AttemptTiming attempt={{
      started_at: '2026-11-02T12:00:00Z', submitted_at, duration_seconds: 46, status: 'submitted',
    }} />);
    expect(screen.getByText('Время не записано')).toBeTruthy();
  });
  it('считает среднее только по завершённым онлайн-попыткам с обеими датами', () => {
    const attempt = { status: 'corrected', started_at: '2026-11-02T12:00:00Z', submitted_at: '2026-11-02T12:04:00Z', duration_seconds: 46 };
    expect(averageAttemptDuration([
      attempt,
      { ...attempt, submitted_at: attempt.started_at },
      { ...attempt, source: 'scan' },
      { ...attempt, status: 'started' },
      { ...attempt, started_at: '' },
    ])).toBe(120);
  });
});
