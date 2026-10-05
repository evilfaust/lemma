import dayjs from 'dayjs';
import { isNextDue } from './homework';

/**
 * Неделя в кабинете ученика (v3.9.292) — чистая логика без сети и React.
 * Неделя с понедельника, день — ключ 'YYYY-MM-DD' в местном времени.
 */

export const dayKey = (d) => dayjs(d).format('YYYY-MM-DD');

/** Понедельник недели, в которую попадает дата (начало дня). */
export function weekStart(d) {
  const x = dayjs(d).startOf('day');
  return x.subtract((x.day() + 6) % 7, 'day');
}

/** Семь дней недели с понедельника. */
export function weekDays(d) {
  const start = weekStart(d);
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
}

/** Подпись недели: «6–12 октября», «29 сентября – 5 октября», с годом, если не текущий. */
export function weekLabel(d, now = dayjs()) {
  const days = weekDays(d);
  const a = days[0].locale('ru');
  const b = days[6].locale('ru');
  const year = b.year() !== dayjs(now).year() ? ` ${b.year()}` : '';
  if (a.month() === b.month()) return `${a.format('D')}–${b.format('D MMMM')}${year}`;
  return `${a.format('D MMMM')} – ${b.format('D MMMM')}${year}`;
}

/** Уроки по дням: Map('YYYY-MM-DD' → уроки по времени). */
export function lessonsByDay(lessons) {
  const map = new Map();
  const sorted = [...(lessons || [])].sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan));
  for (const l of sorted) {
    if (!l?.date_plan) continue;
    const k = dayKey(l.date_plan);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(l);
  }
  return map;
}

/**
 * Отметки дня для полосы недели: сколько уроков (без отменённых), есть ли
 * отменённые и есть ли к этому дню ДЗ (задано к его урокам раньше — `incoming`
 * из resolveHomework — или «ДЗ к этому уроку» в самих уроках).
 */
export function dayMarks(dayLessons, incoming) {
  const list = dayLessons || [];
  let lessons = 0;
  let cancelled = 0;
  let homework = false;
  for (const l of list) {
    if (l.status === 'cancelled') { cancelled++; continue; }
    lessons++;
    if ((incoming?.get(l.id) || []).length) homework = true;
    if ((l.items || []).some((i) => i.role === 'homework' && !isNextDue(i))) homework = true;
  }
  return { lessons, cancelled, homework };
}

// Хук /api/lessons/my отдаёт не больше 400 дней за раз — держим запас.
export const MAX_RANGE_DAYS = 390;

/**
 * Какой диапазон догрузить, чтобы неделя `d` была внутри загруженного
 * [from, to] (даты-миллисекунды). null — неделя уже загружена или её покроет
 * запрос в полёте (`pending`) — быстрое листание не плодит запросы.
 * Загруженное расширяется с запасом в месяц (листают обычно подряд); если
 * окно вышло бы длиннее MAX_RANGE_DAYS — грузим только окрестность недели.
 */
const covers = (r, a, b) => !!r && a >= r.from && b <= r.to;

export function rangeToLoad(d, loaded, pending = null) {
  const start = weekStart(d);
  const end = start.add(7, 'day');
  // Уже загружено — или уже летит запрос, который неделю покроет.
  if (covers(loaded, start.valueOf(), end.valueOf())) return null;
  if (covers(pending, start.valueOf(), end.valueOf())) return null;
  const near = { from: start.subtract(30, 'day').valueOf(), to: end.add(30, 'day').valueOf() };
  if (!loaded) return near;
  const from = Math.min(loaded.from, near.from);
  const to = Math.max(loaded.to, near.to);
  if (to - from > MAX_RANGE_DAYS * 24 * 3600 * 1000) return near;
  return { from, to };
}

/**
 * Загруженное окно после ответа на `range`: объединение, если оно непрерывно
 * и не длиннее MAX_RANGE_DAYS, иначе — само `range` (уроки прежнего окна в
 * данных остаются, просто окно о них «забывает» и при возврате догрузит).
 */
export function mergeRange(loaded, range) {
  if (!loaded) return range;
  if (range.from > loaded.to || range.to < loaded.from) return range;
  const from = Math.min(loaded.from, range.from);
  const to = Math.max(loaded.to, range.to);
  return to - from > MAX_RANGE_DAYS * 24 * 3600 * 1000 ? range : { from, to };
}
