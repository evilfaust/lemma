import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  buildEvents, schoolEventToEvent, schoolEventFormToData, schoolEventToForm,
  sortMonthEvents, TYPE_ORDER,
} from '../components/workspace/calendar/calendarUtils';

/**
 * Общий школьный календарь: четвёртый тип события на сетке.
 * Проверяем сборку события (в т.ч. многодневного) и маппинг формы ⇄ записи —
 * от него зависит, отличит ли база однодневное мероприятие от диапазона.
 */

const ALL = { school: true, lesson: true, deadline: true, todo: true };

const event = (extra = {}) => ({
  id: 'se1',
  title: 'Педсовет',
  kind: 'meeting',
  date_start: '2026-09-16 00:00:00.000Z',
  date_end: '',
  all_day: true,
  owner: 't1',
  expand: { owner: { id: 't1', name: 'Иванов И.' } },
  ...extra,
});

describe('schoolEventToEvent', () => {
  it('однодневное мероприятие занимает свой день целиком', () => {
    const e = schoolEventToEvent(event());
    expect(e.allDay).toBe(true);
    expect(dayjs(e.start).isSame('2026-09-16', 'day')).toBe(true);
    expect(dayjs(e.end).isSame('2026-09-16', 'day')).toBe(true);
    expect(e.resource.multiDay).toBe(false);
  });

  it('многодневное отдаётся ОДНИМ событием с диапазоном', () => {
    // Каникулы: одна полоса на неделю, а не семь отдельных событий.
    const e = schoolEventToEvent(event({
      title: 'Осенние каникулы', kind: 'holiday',
      date_end: '2026-11-08 00:00:00.000Z', date_start: '2026-11-02 00:00:00.000Z',
    }));
    expect(e.resource.multiDay).toBe(true);
    expect(dayjs(e.end).diff(dayjs(e.start), 'day')).toBe(6);
  });

  it('несёт тип, цвет и автора — по ним рисуется чип и карточка', () => {
    const { resource } = schoolEventToEvent(event({ color: 'green' }));
    expect(resource.type).toBe('school');
    expect(resource.kind).toBe('meeting');
    expect(resource.color).toBe('green');
    expect(resource.ownerName).toBe('Иванов И.');
  });
});

describe('buildEvents со школьными мероприятиями', () => {
  const base = { lessons: [], deadlines: [], todos: [], schoolEvents: [event()] };

  it('тумблер «Школьные» убирает их с сетки', () => {
    expect(buildEvents({ ...base, filters: ALL, groupFilter: null })).toHaveLength(1);
    expect(buildEvents({ ...base, filters: { ...ALL, school: false }, groupFilter: null })).toHaveLength(0);
  });

  it('фильтр по группе мероприятие не прячет — оно ничьё', () => {
    const out = buildEvents({ ...base, filters: ALL, groupFilter: 'grp1' });
    expect(out).toHaveLength(1);
  });

  it('старый вызов без schoolEvents не падает', () => {
    const out = buildEvents({ lessons: [], deadlines: [], todos: [], filters: ALL, groupFilter: null });
    expect(out).toEqual([]);
  });

  it('в ячейке дня мероприятие идёт первым', () => {
    expect(TYPE_ORDER.school).toBeLessThan(TYPE_ORDER.lesson);
    const day = new Date('2026-09-16T09:00:00Z');
    const evts = [
      { start: day, resource: { type: 'lesson' } },
      { start: day, resource: { type: 'school' } },
    ].sort(sortMonthEvents);
    expect(evts[0].resource.type).toBe('school');
  });
});

describe('форма мероприятия ⇄ запись', () => {
  it('пустое «по» остаётся пустым: однодневное ≠ диапазон', () => {
    const data = schoolEventFormToData({
      title: '  Педсовет ', kind: 'meeting', all_day: true,
      date_start: dayjs('2026-09-16T13:40:00'), date_end: null,
    });
    expect(data.title).toBe('Педсовет');
    expect(data.date_end).toBe('');
    // «Весь день» обнуляет время начала, иначе событие всплывёт в сетке часов.
    expect(dayjs(data.date_start).isSame(dayjs('2026-09-16').startOf('day'))).toBe(true);
  });

  it('диапазон дотягивается до конца последнего дня', () => {
    const data = schoolEventFormToData({
      title: 'Каникулы', kind: 'holiday', all_day: true,
      date_start: dayjs('2026-11-02'), date_end: dayjs('2026-11-08'),
    });
    expect(dayjs(data.date_end).isSame(dayjs('2026-11-08').endOf('day'))).toBe(true);
  });

  it('со временем (не весь день) время сохраняется', () => {
    const data = schoolEventFormToData({
      title: 'Педсовет', kind: 'meeting', all_day: false,
      date_start: dayjs('2026-09-16T15:00:00'),
    });
    expect(data.all_day).toBe(false);
    expect(dayjs(data.date_start).hour()).toBe(15);
  });

  it('запись разбирается обратно в форму', () => {
    const f = schoolEventToForm(event({ date_end: '2026-09-18 00:00:00.000Z', color: 'green' }));
    expect(f.title).toBe('Педсовет');
    expect(f.color).toBe('green');
    expect(f.all_day).toBe(true);
    expect(dayjs(f.date_start).isSame('2026-09-16', 'day')).toBe(true);
    expect(dayjs(f.date_end).isSame('2026-09-18', 'day')).toBe(true);
  });

  it('новое мероприятие открывается на дне ячейки', () => {
    const f = schoolEventToForm({}, '2026-10-01');
    expect(dayjs(f.date_start).isSame('2026-10-01', 'day')).toBe(true);
    expect(f.date_end).toBeNull();
    expect(f.kind).toBe('other');
  });
});
