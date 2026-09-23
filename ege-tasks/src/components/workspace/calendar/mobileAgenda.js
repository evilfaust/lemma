/**
 * Чистая логика телефонного календаря (MobileCalendar): какие события в дне,
 * какие пары свободны, какие точки рисовать под числами. Без React и сети —
 * события приходят готовыми из `buildEvents` (calendarUtils).
 */
import dayjs from 'dayjs';
import { PAIRS, slotPairIndexes } from '../lessonTime';
import { lessonHex } from '../ui/groupColor';

// Пары обычного школьного дня: свободные из них предлагаются «+ добавить».
// Нулевая и вечерние — только если учитель ими пользуется (см. usedExtraPairs).
export const CORE_PAIRS = ['1', '2', '3', '4', '5'];
const EXTRA_PAIRS = ['0', '6', '7'];

const DEADLINE_DOT = '#D97706';
const TODO_DOT = '#0D9488';

/** Событие приходится на день `day` (многодневное — на каждый день диапазона). */
export function eventOnDay(e, day) {
  const d = dayjs(day);
  const start = dayjs(e.start);
  let end = dayjs(e.end || e.start);
  // Конец ровно в полночь — это «до начала следующего дня», сам день не входит.
  if (end.isAfter(start) && end.valueOf() === end.startOf('day').valueOf()) end = end.subtract(1, 'ms');
  return !d.isBefore(start, 'day') && !d.isAfter(end, 'day');
}

const at = (day, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return dayjs(day).hour(h).minute(m).second(0).millisecond(0).toDate();
};

/**
 * Свободные пары дня: пара занята, если с ней пересекается любой неотменённый
 * урок. keys — какие пары вообще рассматривать (по порядку PAIRS).
 */
export function freePairSlots(day, dayLessons, keys = CORE_PAIRS) {
  return PAIRS
    .filter((p) => keys.includes(p.key))
    .map((p) => ({ key: p.key, label: p.label, start: at(day, p.full[0]), end: at(day, p.full[1]) }))
    .filter((slot) => !dayLessons.some((e) => e.resource?.status !== 'cancelled'
      && e.start < slot.end && e.end > slot.start));
}

/**
 * Нулевая/вечерние пары, которыми учитель пользуется в переданных уроках:
 * только их стоит предлагать свободными, иначе список дня раздувается.
 */
export function usedExtraPairs(lessonEvents) {
  const used = new Set();
  lessonEvents.forEach((e) => {
    const idx = slotPairIndexes(e.resource?.raw?.time_slot);
    if (!idx) return;
    for (let i = idx[0]; i <= idx[1]; i += 1) {
      const key = PAIRS[i]?.key;
      if (EXTRA_PAIRS.includes(key)) used.add(key);
    }
  });
  return [...used];
}

/**
 * Лента дня: мероприятия (полосой сверху), уроки вперемешку со свободными
 * парами по времени, дедлайны и дела.
 * opts.freeKeys — пары, которые предлагать свободными ([] — не предлагать).
 */
export function dayAgenda(events, day, { freeKeys = [] } = {}) {
  const inDay = events.filter((e) => eventOnDay(e, day));
  const byType = (t) => inDay.filter((e) => e.resource?.type === t);
  const lessons = byType('lesson').sort((a, b) => a.start - b.start);
  const free = freeKeys.length ? freePairSlots(day, lessons, freeKeys) : [];
  const rows = [
    ...lessons.map((e) => ({ kind: 'lesson', key: e.id, start: e.start, event: e })),
    ...free.map((s) => ({ kind: 'free', key: `free_${s.key}`, start: s.start, slot: s })),
  ].sort((a, b) => a.start - b.start || (a.kind === 'lesson' ? -1 : 1));
  return {
    school: byType('school'),
    rows,
    lessonsCount: lessons.length,
    deadlines: byType('deadline').sort((a, b) => a.start - b.start),
    todos: byType('todo').sort((a, b) => Number(a.resource?.done) - Number(b.resource?.done)),
  };
}

/**
 * Метки дней для сетки: до четырёх точек (уроки цветом класса, дедлайн,
 * открытое дело) + цвет полосы мероприятия. Ключ — 'YYYY-MM-DD'.
 */
export function dayMarks(events, days, schoolColor = () => '#94A3B8') {
  const out = new Map();
  days.forEach((d) => {
    const inDay = events.filter((e) => eventOnDay(e, d));
    const dots = [];
    inDay.filter((e) => e.resource?.type === 'lesson' && e.resource.status !== 'cancelled')
      .sort((a, b) => a.start - b.start)
      .forEach((e) => dots.push(lessonHex(e.resource.raw).base));
    if (inDay.some((e) => e.resource?.type === 'deadline')) dots.push(DEADLINE_DOT);
    if (inDay.some((e) => e.resource?.type === 'todo' && !e.resource.done)) dots.push(TODO_DOT);
    const school = inDay.find((e) => e.resource?.type === 'school');
    out.set(dayjs(d).format('YYYY-MM-DD'), {
      dots: dots.slice(0, 4),
      more: Math.max(0, dots.length - 4),
      school: school ? schoolColor(school) : null,
    });
  });
  return out;
}

/** Дни сетки: неделя выбранного дня или весь месяц целыми неделями. */
export function gridDays(date, mode) {
  const d = dayjs(date);
  if (mode === 'week') {
    const s = d.startOf('week');
    return Array.from({ length: 7 }, (_, i) => s.add(i, 'day'));
  }
  const s = d.startOf('month').startOf('week');
  const e = d.endOf('month').endOf('week');
  const n = e.startOf('day').diff(s, 'day') + 1;
  return Array.from({ length: n }, (_, i) => s.add(i, 'day'));
}
