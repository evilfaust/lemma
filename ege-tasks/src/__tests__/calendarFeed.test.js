// Календарь учителя по подписке (v3.9.352): чистая логика хука
// pocketbase/pb_hooks/calendar_feed_lib.js + ссылки utils/calendarFeedLink.js.
import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { PAIRS, slotLabel, slotRangeFromCode } from '../components/workspace/lessonTime';
import { calendarFeedLinks } from '../utils/calendarFeedLink';

const require = createRequire(import.meta.url);
const lib = require('../../../pocketbase/pb_hooks/calendar_feed_lib.js');

const NOW = Date.UTC(2026, 9, 11, 12, 0); // 11.10.2026 15:00 МСК
const utf8 = (s) => new TextEncoder().encode(s).length;
const unfold = (ics) => ics.replace(/\r\n /g, '');
const events = (ics) => unfold(ics).split('BEGIN:VEVENT').slice(1)
  .map((chunk) => Object.fromEntries(chunk.split('\r\n')
    .filter((l) => l && !l.startsWith('END:'))
    .map((l) => { const i = l.indexOf(':'); return [l.slice(0, i), l.slice(i + 1)]; })));

const lesson = (over = {}) => ({
  id: 'l1', title: 'Логарифмы', date_plan: '2026-10-12 07:15:00.000Z', time_slot: '1',
  status: 'planned', owner: 't1', groupName: '10А', updated: '2026-10-10 10:00:00.000Z', ...over,
});

describe('таблица пар — копия хука совпадает с фронтом', () => {
  it('пары и звонки одинаковые', () => {
    expect(lib.PAIRS).toEqual(PAIRS);
  });
  it('коды слотов дают те же время и подпись', () => {
    const codes = ['0', ...PAIRS.flatMap((p) => [p.key, `${p.key}a`, `${p.key}b`]), '1-3', '2-4', '6-7', 'x', ''];
    for (const code of codes) {
      expect(lib.slotRange(code)).toEqual(slotRangeFromCode(code));
      expect(lib.slotLabel(code)).toBe(slotLabel(code));
    }
  });
});

describe('время урока', () => {
  const at = (iso) => new Date(iso).getTime();
  it('пара «1» — 10:15–11:45 МСК', () => {
    expect(lib.lessonTimes(lesson())).toEqual({ start: at('2026-10-12T07:15:00Z'), end: at('2026-10-12T08:45:00Z') });
  });
  it('урок, созданный кликом по ячейке (полночь + слот), берёт старт из пары', () => {
    const t = lib.lessonTimes(lesson({ date_plan: '2026-10-14 21:00:00.000Z', time_slot: '1-3' }));
    expect(t).toEqual({ start: at('2026-10-15T07:15:00Z'), end: at('2026-10-15T12:40:00Z') });
  });
  it('вторая полупара', () => {
    const t = lib.lessonTimes(lesson({ date_plan: '2026-10-12 09:50:00.000Z', time_slot: '2b' }));
    expect(t).toEqual({ start: at('2026-10-12T09:50:00Z'), end: at('2026-10-12T10:45:00Z') });
  });
  it('без слота: старт пары → её конец, иначе 45 минут', () => {
    expect(lib.lessonTimes(lesson({ time_slot: '', date_plan: '2026-10-12 09:00:00.000Z' })).end)
      .toBe(at('2026-10-12T10:45:00Z'));
    expect(lib.lessonTimes(lesson({ time_slot: '', date_plan: '2026-10-12 06:30:00.000Z' })).end)
      .toBe(at('2026-10-12T07:15:00Z'));
  });
  it('пустая дата — урока нет', () => {
    expect(lib.lessonTimes(lesson({ date_plan: '' }))).toBeNull();
  });
});

describe('текст iCalendar', () => {
  const ics = lib.buildIcs({
    teacher: { id: 't1', name: 'Анна Учитель' },
    nowMs: NOW,
    lessons: [
      lesson(),
      lesson({ id: 'l2', status: 'cancelled', title: 'Интенсив; повторение, часть 2' }),
      lesson({ id: 'l3', owner: 't2', ownerName: 'Борис Коллега', status: 'done' }),
    ],
    events: [
      { id: 'e1', title: 'Осенние каникулы', kind: 'holiday', all_day: true,
        date_start: '2026-10-25 21:00:00.000Z', date_end: '2026-11-02 20:59:59.999Z' },
      { id: 'e2', title: 'Педсовет', kind: 'meeting', all_day: false,
        date_start: '2026-10-13 13:00:00.000Z', date_end: '', note_md: 'Актовый зал\nвторой этаж' },
      { id: 'e3', title: 'Олимпиада', kind: 'olympiad', all_day: true,
        date_start: '2026-10-19 21:00:00.000Z', date_end: '' },
    ],
    todos: [{ id: 'd1', title: 'Проверить тетради', due_date: '2026-10-12 21:00:00.000Z', groupName: '9Б' }],
  });
  const ev = events(ics);
  const byUid = Object.fromEntries(ev.map((e) => [e.UID.split('@')[0], e]));

  it('строки разделены CRLF и не длиннее 75 октетов', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of ics.split('\r\n')) expect(utf8(line)).toBeLessThanOrEqual(75);
  });

  it('перенос строки кириллицу не рвёт и обратно склеивается', () => {
    const long = 'SUMMARY:' + 'Тригонометрические уравнения '.repeat(6);
    const folded = lib.fold(long);
    expect(folded).toContain('\r\n ');
    expect(unfold(folded)).toBe(long);
  });

  it('шапка календаря', () => {
    expect(ics).toContain('X-WR-CALNAME:Lemma — Анна Учитель');
    expect(ics).toContain('VERSION:2.0');
  });

  it('урок: время, класс в названии, ссылка, постоянный UID', () => {
    const l = byUid['lesson-l1'];
    expect(l.DTSTART).toBe('20261012T071500Z');
    expect(l.DTEND).toBe('20261012T084500Z');
    expect(l.SUMMARY).toBe('10А · Логарифмы');
    expect(l.DESCRIPTION).toBe('1-я пара\\nhttps://l.oipav.ru/app/calendar');
    expect(l.STATUS).toBe('CONFIRMED');
  });

  it('отменённый урок помечен, а не пропадает; спецсимволы экранированы', () => {
    const l = byUid['lesson-l2'];
    expect(l.STATUS).toBe('CANCELLED');
    expect(l.SUMMARY).toBe('Отменён: 10А · Интенсив\\; повторение\\, часть 2');
  });

  it('чужой урок — с именем ведущего', () => {
    expect(byUid['lesson-l3'].DESCRIPTION).toContain('Проведён\\nВедёт: Борис Коллега');
  });

  it('многодневное событие на весь день: конец исключающий', () => {
    const e = byUid['school-e1'];
    expect(e['DTSTART;VALUE=DATE']).toBe('20261026');
    expect(e['DTEND;VALUE=DATE']).toBe('20261103');
    expect(e.TRANSP).toBe('TRANSPARENT');
  });

  it('однодневное событие на весь день — один день', () => {
    const e = byUid['school-e3'];
    expect(e['DTSTART;VALUE=DATE']).toBe('20261020');
    expect(e['DTEND;VALUE=DATE']).toBe('20261021');
  });

  it('событие со временем без конца — час', () => {
    const e = byUid['school-e2'];
    expect(e.DTSTART).toBe('20261013T130000Z');
    expect(e.DTEND).toBe('20261013T140000Z');
    expect(e.DESCRIPTION).toBe('Педсовет\\nАктовый зал\\nвторой этаж');
  });

  it('дело — на день срока', () => {
    const d = byUid['todo-d1'];
    expect(d['DTSTART;VALUE=DATE']).toBe('20261013');
    expect(d['DTEND;VALUE=DATE']).toBe('20261014');
    expect(d.SUMMARY).toBe('☐ Проверить тетради (9Б)');
  });

  it('у каждого события есть DTSTAMP', () => {
    expect(ev).toHaveLength(7);
    for (const e of ev) expect(e.DTSTAMP).toBe('20261011T120000Z');
  });
});

describe('токен и ссылки', () => {
  const token = 'a'.repeat(20) + '0123456789abcdefghij';
  it('токен из пути: с .ics и без, мусор и короткий — нет', () => {
    expect(lib.tokenFromPath(`${token}.ics`)).toBe(token);
    expect(lib.tokenFromPath(token.toUpperCase())).toBe(token);
    expect(lib.tokenFromPath('')).toBe('');
    expect(lib.tokenFromPath('.ics')).toBe('');
    expect(lib.tokenFromPath('abc')).toBe('');
    expect(lib.tokenFromPath(`${token}/../x`)).toBe('');
  });
  it('ссылки подписки', () => {
    const l = calendarFeedLinks('https://task-ege.oipav.ru/', token);
    expect(l.https).toBe(`https://task-ege.oipav.ru/api/calendar/feed/${token}.ics`);
    expect(l.webcal).toBe(`webcal://task-ege.oipav.ru/api/calendar/feed/${token}.ics`);
    expect(l.google).toBe(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(l.webcal)}`);
    expect(calendarFeedLinks('https://x', null)).toBeNull();
  });
});
