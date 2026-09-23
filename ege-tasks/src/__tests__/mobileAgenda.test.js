import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  eventOnDay, freePairSlots, usedExtraPairs, dayAgenda, dayMarks, gridDays, CORE_PAIRS,
} from '../components/workspace/calendar/mobileAgenda';
import {
  lessonToEvent, schoolEventToEvent, deadlineToEvent, todoToEvent,
} from '../components/workspace/calendar/calendarUtils';
import { slotLabel } from '../components/workspace/lessonTime';

dayjs.locale('ru');

// Среда 23 сентября 2026.
const DAY = '2026-09-23';
const lesson = (over = {}) => lessonToEvent({
  id: 'l1', title: 'Алгебра', date_plan: `${DAY} 12:00:00`, time_slot: '2',
  group: 'g1', status: 'planned', expand: { group: { id: 'g1', name: '10 А' } }, ...over,
});

describe('eventOnDay', () => {
  it('урок — только в свой день', () => {
    const e = lesson();
    expect(eventOnDay(e, DAY)).toBe(true);
    expect(eventOnDay(e, '2026-09-24')).toBe(false);
  });

  it('многодневное мероприятие — на каждый день диапазона', () => {
    const e = schoolEventToEvent({
      id: 's1', title: 'Каникулы', date_start: '2026-10-26 00:00:00', date_end: '2026-11-03 00:00:00', all_day: true,
    });
    expect(eventOnDay(e, '2026-10-25')).toBe(false);
    expect(eventOnDay(e, '2026-10-26')).toBe(true);
    expect(eventOnDay(e, '2026-10-30')).toBe(true);
    expect(eventOnDay(e, '2026-11-03')).toBe(true);
    expect(eventOnDay(e, '2026-11-04')).toBe(false);
  });

  it('дедлайн и дело — в день срока', () => {
    expect(eventOnDay(deadlineToEvent({ id: 'd', deadline: `${DAY} 18:00:00` }), DAY)).toBe(true);
    expect(eventOnDay(todoToEvent({ id: 't', title: 'x', due_date: `${DAY} 00:00:00` }), DAY)).toBe(true);
  });
});

describe('freePairSlots', () => {
  it('занятая пара не предлагается, остальные — по порядку', () => {
    const free = freePairSlots(DAY, [lesson()], CORE_PAIRS);
    expect(free.map((s) => s.key)).toEqual(['1', '3', '4', '5']);
    expect(dayjs(free[1].start).format('HH:mm')).toBe('14:05');
  });

  it('интенсив занимает все свои пары', () => {
    const free = freePairSlots(DAY, [lesson({ date_plan: `${DAY} 10:15:00`, time_slot: '1-3' })], CORE_PAIRS);
    expect(free.map((s) => s.key)).toEqual(['4', '5']);
  });

  it('полупара занимает пару целиком', () => {
    const free = freePairSlots(DAY, [lesson({ date_plan: `${DAY} 12:50:00`, time_slot: '2b' })], CORE_PAIRS);
    expect(free.map((s) => s.key)).not.toContain('2');
  });

  it('отменённый урок пару не занимает', () => {
    const free = freePairSlots(DAY, [lesson({ status: 'cancelled' })], CORE_PAIRS);
    expect(free.map((s) => s.key)).toContain('2');
  });
});

describe('usedExtraPairs', () => {
  it('вечерние и нулевая — только если ими пользуются', () => {
    expect(usedExtraPairs([lesson()])).toEqual([]);
    const evening = lesson({ id: 'e', date_plan: `${DAY} 18:00:00`, time_slot: '6-7' });
    expect(usedExtraPairs([lesson(), evening]).sort()).toEqual(['6', '7']);
  });
});

describe('dayAgenda', () => {
  it('уроки и свободные пары вперемешку по времени, мероприятия и дела отдельно', () => {
    const events = [
      lesson(),
      lesson({ id: 'l0', title: 'Геометрия', date_plan: `${DAY} 10:15:00`, time_slot: '1' }),
      lesson({ id: 'other', date_plan: '2026-09-24 12:00:00' }),
      deadlineToEvent({ id: 'd', deadline: `${DAY} 18:00:00`, student_title: 'ДЗ' }),
      todoToEvent({ id: 't', title: 'Проверить тетради', due_date: `${DAY} 00:00:00` }),
      schoolEventToEvent({ id: 's', title: 'Педсовет', date_start: `${DAY} 00:00:00`, all_day: true }),
    ];
    const a = dayAgenda(events, DAY, { freeKeys: CORE_PAIRS });
    expect(a.lessonsCount).toBe(2);
    expect(a.rows.map((r) => (r.kind === 'free' ? `+${r.slot.key}` : r.event.id)))
      .toEqual(['l0', 'l1', '+3', '+4', '+5']);
    expect(a.school).toHaveLength(1);
    expect(a.deadlines).toHaveLength(1);
    expect(a.todos).toHaveLength(1);
  });

  it('без freeKeys свободные пары не предлагаются', () => {
    const a = dayAgenda([lesson()], DAY);
    expect(a.rows.map((r) => r.kind)).toEqual(['lesson']);
  });
});

describe('dayMarks', () => {
  it('точки: уроки, дедлайн, открытое дело; полоса мероприятия', () => {
    const events = [
      lesson(),
      deadlineToEvent({ id: 'd', deadline: `${DAY} 18:00:00` }),
      todoToEvent({ id: 't', title: 'x', due_date: `${DAY} 00:00:00`, done: true }),
      schoolEventToEvent({ id: 's', title: 'Педсовет', date_start: `${DAY} 00:00:00`, all_day: true }),
    ];
    const m = dayMarks(events, [dayjs(DAY)], () => '#123456').get(DAY);
    expect(m.dots).toHaveLength(2); // урок + дедлайн, сделанное дело не в счёт
    expect(m.school).toBe('#123456');
  });
});

describe('gridDays', () => {
  it('неделя — 7 дней с понедельника', () => {
    const d = gridDays(new Date(`${DAY}T12:00:00`), 'week');
    expect(d).toHaveLength(7);
    expect(d[0].format('YYYY-MM-DD')).toBe('2026-09-21');
  });

  it('месяц — целыми неделями', () => {
    const d = gridDays(new Date(`${DAY}T12:00:00`), 'month');
    expect(d.length % 7).toBe(0);
    expect(d[0].format('YYYY-MM-DD')).toBe('2026-08-31');
    expect(d[d.length - 1].format('YYYY-MM-DD')).toBe('2026-10-04');
  });
});

describe('slotLabel', () => {
  it('пара, половина, интенсив', () => {
    expect(slotLabel('2')).toBe('2-я пара');
    expect(slotLabel('3a')).toBe('3-я пара, 1-я половина');
    expect(slotLabel('1-3')).toBe('интенсив, пары 1–3');
    expect(slotLabel('')).toBe('');
  });
});
