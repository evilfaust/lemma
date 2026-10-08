import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { homeworkFeed } from './homework';
import { slotRangeFromCode } from '../components/workspace/lessonTime';
import { attemptResultsHidden } from './resultsVisibility';

/**
 * Главная ученика (v3.9.316) — лента «что делать»: чистая логика без сети.
 *
 * Экран (`components/student/StudentHome.jsx`) берёт данные из трёх мест —
 * уроки и ДЗ (`/api/lessons/my`), эфиры и материалы (`/api/stereo/my`),
 * попытки ученика — и раскладывает их здесь: что идёт сейчас, что сделать,
 * ближайший урок, последние результаты. Новое правило главной — сюда и под
 * тест `__tests__/studentHome.test.js`.
 */

const LESSON_MIN = 45;          // урок без пары в расписании
const UNFINISHED_DAYS = 14;     // старше — не напоминаем о брошенном тесте

const ru = (d) => dayjs(d).locale('ru');

/** Начало и конец урока: конец — по паре расписания, иначе +45 мин. */
export function lessonWindow(lesson) {
  if (!lesson?.date_plan) return null;
  const start = ru(lesson.date_plan);
  const r = slotRangeFromCode(lesson.time_slot);
  if (r) {
    // Начало — время урока (его могли сдвинуть вручную), конец — по паре.
    const [eh, em] = r[1].split(':').map(Number);
    let end = start.hour(eh).minute(em).second(0);
    if (!end.isAfter(start)) end = start.add(LESSON_MIN, 'minute');
    return { start, end };
  }
  return { start, end: start.add(LESSON_MIN, 'minute') };
}

/** Время урока строкой: «10:15–11:45» по паре, иначе «10:15». */
export function lessonTimeLabel(lesson) {
  const r = slotRangeFromCode(lesson?.time_slot);
  if (r) return `${r[0]}–${r[1]}`;
  return lesson?.date_plan ? ru(lesson.date_plan).format('HH:mm') : '';
}

const live = (l) => l && l.status !== 'cancelled' && !l.hidden_from_students;

/** Урок, который идёт прямо сейчас, или null. */
export function currentLesson(lessons, now = dayjs()) {
  const t = dayjs(now);
  return (lessons || []).find((l) => {
    if (!live(l)) return false;
    const w = lessonWindow(l);
    return w && !t.isBefore(w.start) && t.isBefore(w.end);
  }) || null;
}

/** Ближайший ещё не начавшийся урок, или null. */
export function nextLesson(lessons, now = dayjs()) {
  const t = dayjs(now);
  return [...(lessons || [])]
    .filter((l) => live(l) && l.date_plan && lessonWindow(l).start.isAfter(t))
    .sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan))[0] || null;
}

/** «сегодня» / «завтра» / «вчера» / «чт, 9 окт». */
export function relDayLabel(d, now = dayjs()) {
  const day = ru(d).startOf('day');
  const today = dayjs(now).startOf('day');
  const diff = day.diff(today, 'day');
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  return day.format('dd, D MMM');
}

/** Отсчёт до урока: «через 25 мин», «через 2 ч», иначе день. */
export function untilLabel(lesson, now = dayjs()) {
  const w = lessonWindow(lesson);
  if (!w) return '';
  const t = dayjs(now);
  const mins = w.start.diff(t, 'minute');
  if (mins < 1) return 'вот-вот начнётся';
  if (mins < 60) return `через ${mins} мин`;
  if (w.start.isSame(t, 'day')) return `сегодня в ${w.start.format('HH:mm')}`;
  return `${relDayLabel(w.start, t)} в ${w.start.format('HH:mm')}`;
}

/** Название работы попытки: как его видел ученик при выдаче. */
export function attemptTitle(a) {
  const s = a?.expand?.session;
  return s?.student_title || s?.expand?.work?.title || s?.expand?.mc_test?.title || 'Тест';
}

const attemptDate = (a) => a?.submitted_at || a?.updated || a?.created;

/**
 * Недорешённые тесты: попытка начата, выдача ещё открыта, не старше двух недель.
 * → [{ sessionId, title, started }] — по одной на выдачу, свежие сверху.
 */
export function unfinishedAttempts(attempts, now = dayjs()) {
  const edge = dayjs(now).subtract(UNFINISHED_DAYS, 'day');
  const done = new Set((attempts || [])
    .filter((a) => a.status === 'submitted' || a.status === 'corrected')
    .map((a) => a.session));
  const seen = new Set();
  const out = [];
  const list = [...(attempts || [])].sort((a, b) => new Date(b.created) - new Date(a.created));
  for (const a of list) {
    if (a.status !== 'started' || !a.session || seen.has(a.session)) continue;
    if (a.expand?.session?.is_open === false) continue;
    if (dayjs(a.created).isBefore(edge)) continue;
    // Уже сдал эту выдачу другой попыткой — висящая попытка не дело.
    if (done.has(a.session) && !(a.expand?.session?.max_attempts > 1)) continue;
    seen.add(a.session);
    out.push({ sessionId: a.session, title: attemptTitle(a), started: a.created });
  }
  return out;
}

/**
 * Последние результаты: сданные попытки с баллом, последняя на выдачу.
 * → [{ sessionId, title, score, total, pct, date, hidden? }]
 * Учитель закрыл результаты выдачи (v3.9.321) → `hidden: true`, без баллов:
 * ученик видит, что работа сдана, а результат появится позже.
 */
export function recentResults(attempts, limit = 3) {
  const seen = new Set();
  const out = [];
  const list = [...(attempts || [])]
    .filter((a) => (a.status === 'submitted' || a.status === 'corrected') && Number(a.total) > 0)
    .sort((a, b) => new Date(attemptDate(b)) - new Date(attemptDate(a)));
  for (const a of list) {
    if (seen.has(a.session)) continue;
    seen.add(a.session);
    if (attemptResultsHidden(a)) {
      out.push({
        sessionId: a.session, title: attemptTitle(a), hidden: true,
        score: null, total: null, pct: null, date: attemptDate(a),
      });
      if (out.length >= limit) break;
      continue;
    }
    const score = Number(a.score) || 0;
    const total = Number(a.total);
    out.push({
      sessionId: a.session,
      title: attemptTitle(a),
      score,
      total,
      pct: Math.round((score / total) * 100),
      date: attemptDate(a),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Куда ведёт пункт ДЗ и как называется кнопка. */
export function itemLink(item) {
  if (!item) return null;
  if (item.kind === 'work') {
    return item.session_id ? { href: `/student/${item.session_id}`, action: 'Решать' } : null;
  }
  if (item.kind === 'show') {
    return item.work_id
      ? { href: `/student/${item.geometry ? 'w' : 'r'}/${item.work_id}`, action: 'Открыть' }
      : null;
  }
  if (item.kind === 'file') {
    return item.file_url ? { href: item.file_url, action: 'Открыть', external: true } : null;
  }
  return null;
}

/**
 * Список «Сделать»: ДЗ из ленты уроков, со сроком и отметкой «сдано».
 * Сдано = есть сданная попытка по выдаче пункта-работы. Несданное — сверху
 * по сроку, сданное — в конце.
 * → [{ key, item, title, kind, link, due, dueLabel, done, groupId }]
 */
export function todoList(lessons, attempts, now = dayjs()) {
  const submitted = new Set((attempts || [])
    .filter((a) => a.status === 'submitted' || a.status === 'corrected')
    .map((a) => a.session));
  const t = dayjs(now);
  const rows = homeworkFeed(lessons, t).map(({ item, from, due }, i) => {
    let dueLabel;
    if (!due) dueLabel = 'к следующему уроку';
    // ДЗ к самому уроку: урок впереди — это срок, урок начался — когда задано.
    else if (due.id === from.id && !dayjs(from.date_plan).isAfter(t)) {
      dueLabel = `задано ${relDayLabel(from.date_plan, t)}`;
    }
    else dueLabel = `к уроку ${relDayLabel(due.date_plan, t)}`;
    const done = item.kind === 'work' && !!item.session_id && submitted.has(item.session_id);
    return {
      key: `${from.id}:${i}`,
      item,
      kind: item.kind,
      title: item.title || (item.kind === 'text' ? 'Задание' : 'Домашняя работа'),
      link: itemLink(item),
      due,
      dueLabel,
      done,
      groupId: from.group,
    };
  });
  return [...rows.filter((r) => !r.done), ...rows.filter((r) => r.done)];
}

/** Каникулярное задание показываем летом и в сентябре (досдают), не круглый год. */
export function summerSeason(now = dayjs()) {
  const m = dayjs(now).month();
  return m >= 5 && m <= 8;
}

/** «среда, 7 октября». */
export function todayLabel(now = dayjs()) {
  return ru(now).format('dddd, D MMMM');
}
