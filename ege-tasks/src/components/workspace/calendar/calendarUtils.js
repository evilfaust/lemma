/**
 * Утилиты редизайна календаря «Моё пространство».
 * Единый источник построения событий трёх типов (урок · дедлайн · дело) и
 * производных метрик для правого рейла.
 */
import dayjs from 'dayjs';
import { endForLesson } from '../lessonTime';

// Порядок типов в ячейке месяца: школьное → дедлайн → урок → дело.
// Мероприятие сверху намеренно: оно меняет весь день (педсовет, каникулы),
// и учитель должен увидеть его раньше, чем свои уроки.
export const TYPE_ORDER = { school: 0, deadline: 1, lesson: 2, todo: 3 };

// Заголовок дедлайна из связанной сущности.
export function deadlineTitle(s) {
  return s.expand?.work?.title
    || s.student_title
    || s.expand?.mc_test?.title
    || s.expand?.trig_mc_test?.title
    || 'Работа';
}

/** Инициалы учителя для метки чужого урока: «Иванов И.» → «ИИ». */
export function initialsOf(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).filter(Boolean).join('').toUpperCase();
}

// Урок → RBC-событие. myTeacherId — чтобы отличить свой урок от чужого
// (со-ведение класса или точечный доступ): у чужого на чипе метка ведущего.
export function lessonToEvent(l, myTeacherId = '') {
  const start = new Date(l.date_plan);
  const hasMaterials = Array.isArray(l.materials) && l.materials.length > 0;
  const ownerName = l.expand?.owner?.name || l.expand?.owner?.username || '';
  return {
    id: l.id,
    title: l.title,
    start,
    end: endForLesson(l, start),
    resource: {
      type: 'lesson',
      raw: l,
      groupId: l.group || '',
      ownerId: l.owner || '',
      ownerName,
      isForeign: !!(myTeacherId && l.owner && l.owner !== myTeacherId),
      // Сама запись группы — в ней лежит выбранный учителем цвет; по одному id
      // цвет тоже находится (реестр), но так он обновляется сразу после правки.
      group: l.expand?.group || null,
      groupName: l.expand?.group?.name,
      status: l.status || 'planned',
      hasMaterials,
    },
  };
}

/**
 * Школьное мероприятие → all-day событие (`school_events`).
 * Многодневное (каникулы, неделя математики) отдаётся ОДНИМ событием с
 * диапазоном — react-big-calendar сам растянет полосу по неделям.
 */
export function schoolEventToEvent(e) {
  const start = new Date(e.date_start);
  const allDay = e.all_day !== false;
  const endSource = e.date_end || e.date_start;
  const end = allDay
    ? dayjs(endSource).endOf('day').toDate()
    : new Date(e.date_end || e.date_start);
  return {
    id: `se_${e.id}`,
    title: e.title,
    start,
    end,
    allDay,
    resource: {
      type: 'school',
      raw: e,
      groupId: '',
      kind: e.kind || 'other',
      color: e.color || '',
      ownerId: e.owner || '',
      ownerName: e.expand?.owner?.name || e.expand?.owner?.username || '',
      multiDay: !!e.date_end && !dayjs(e.date_end).isSame(e.date_start, 'day'),
    },
  };
}

/**
 * Значения формы мероприятия → запись для PB. Пустой «по» пишем пустой строкой
 * (в PB это «однодневное»), а не датой начала: иначе однодневные и многодневные
 * события стали бы неразличимы.
 */
export function schoolEventFormToData(v = {}) {
  const allDay = v.all_day !== false;
  const end = v.date_end ? (allDay ? dayjs(v.date_end).endOf('day') : dayjs(v.date_end)) : null;
  return {
    title: (v.title || '').trim(),
    kind: v.kind || 'other',
    color: v.color || '',
    note_md: v.note_md || '',
    all_day: allDay,
    date_start: (allDay ? dayjs(v.date_start).startOf('day') : dayjs(v.date_start)).toISOString(),
    date_end: end ? end.toISOString() : '',
  };
}

/** Запись PB → значения формы. */
export function schoolEventToForm(e = {}, fallbackDay = null) {
  return {
    title: e.title || '',
    kind: e.kind || 'other',
    color: e.color || '',
    note_md: e.note_md || '',
    all_day: e.all_day !== false,
    date_start: e.date_start ? dayjs(e.date_start) : dayjs(fallbackDay || undefined),
    date_end: e.date_end ? dayjs(e.date_end) : null,
  };
}

// Дедлайн выдачи → all-day событие.
export function deadlineToEvent(s) {
  const start = new Date(s.deadline);
  return {
    id: `dl_${s.id}`,
    title: deadlineTitle(s),
    start,
    end: start,
    allDay: true,
    resource: { type: 'deadline', raw: s, groupId: '' },
  };
}

// Дело (только с due_date) → all-day событие.
export function todoToEvent(t) {
  if (!t.due_date) return null;
  const start = new Date(t.due_date);
  return {
    id: `td_${t.id}`,
    title: t.title,
    start,
    end: start,
    allDay: true,
    resource: {
      type: 'todo',
      raw: t,
      groupId: t.group || '',
      group: t.expand?.group || null,
      groupName: t.expand?.group?.name,
      done: !!t.done,
      priority: t.priority || 'normal',
    },
  };
}

/**
 * Собрать события под текущие фильтры.
 * filters: { school, lesson, deadline, todo } (bool), groupFilter: id|null.
 */
export function buildEvents({
  lessons, deadlines, todos, schoolEvents = [], filters, groupFilter, myTeacherId = '',
}) {
  const out = [];
  if (filters.school) {
    // Школьное мероприятие ничьё и без класса — фильтр по группе его не прячет.
    schoolEvents.forEach((e) => out.push(schoolEventToEvent(e)));
  }
  if (filters.lesson) {
    lessons
      .filter((l) => !groupFilter || l.group === groupFilter)
      .forEach((l) => out.push(lessonToEvent(l, myTeacherId)));
  }
  if (filters.deadline) {
    // У дедлайна нет группы — фильтр по группе его не прячет (как и раньше).
    deadlines.forEach((s) => out.push(deadlineToEvent(s)));
  }
  if (filters.todo) {
    todos
      .filter((t) => !groupFilter || t.group === groupFilter)
      .forEach((t) => { const e = todoToEvent(t); if (e) out.push(e); });
  }
  return out;
}

/**
 * Опции селектора групп. Списки групп во всех пикерах — только текущего
 * учебного года, поэтому у старого урока его собственная группа добавляется
 * отдельно (иначе в модалке вместо названия окажется голый id).
 */
export function groupOptions(groups = [], extra = null) {
  const opts = groups.map((g) => ({ value: g.id, label: g.name }));
  if (extra?.id && !groups.some((g) => g.id === extra.id)) {
    opts.push({ value: extra.id, label: extra.year ? `${extra.name} · ${extra.year}` : extra.name });
  }
  return opts;
}

/**
 * Запись группы по её id: сначала в списке пикера, затем — группа самой записи
 * (прошлогодняя в список не попадает). Пустой id — это «группа не выбрана»,
 * и никакая запись ему не подходит.
 */
export function resolveGroup(groups = [], groupId = '', ownGroup = null) {
  if (!groupId) return null;
  return (groups || []).find((g) => g.id === groupId)
    || (ownGroup?.id === groupId ? ownGroup : null);
}

// Сортировка событий внутри ячейки месяца: deadline → lesson → todo, затем время.
export function sortMonthEvents(a, b) {
  const ta = TYPE_ORDER[a.resource?.type] ?? 9;
  const tb = TYPE_ORDER[b.resource?.type] ?? 9;
  if (ta !== tb) return ta - tb;
  return a.start - b.start;
}

// Метрики правого рейла за неделю, в которую попадает `date`.
export function weekSummary({ lessons, deadlines, todos, date }) {
  const start = dayjs(date).startOf('week');
  const end = dayjs(date).endOf('week');
  const inWeek = (iso) => {
    const d = dayjs(iso);
    return d.isAfter(start) && d.isBefore(end);
  };
  const lessonsCount = lessons.filter((l) => inWeek(l.date_plan)).length;
  const deadlinesCount = deadlines.filter((s) => inWeek(s.deadline)).length;
  const todosOpen = todos.filter((t) => !t.done).length;

  // «Требует внимания» = просроченные невыполненные дела + дедлайны на сегодня.
  const today = dayjs();
  const overdueTodos = todos.filter((t) => !t.done && t.due_date
    && dayjs(t.due_date).isBefore(today, 'day')).length;
  const deadlinesToday = deadlines.filter((s) => dayjs(s.deadline).isSame(today, 'day')).length;
  const attention = overdueTodos + deadlinesToday;

  return { lessonsCount, deadlinesCount, todosOpen, attention };
}

// Дела на сегодня и просроченные (для блока рейла), отсортированы по сроку.
export function todayTodos(todos) {
  const end = dayjs().endOf('day');
  return todos
    .filter((t) => !t.done && t.due_date && dayjs(t.due_date).isBefore(end))
    .sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf());
}

// Подпись чипа срока дела относительно сегодня.
export function dueChip(due) {
  if (!due) return null;
  const d = dayjs(due);
  const today = dayjs();
  if (d.isSame(today, 'day')) return { tone: 'blue', label: 'сегодня' };
  if (d.isBefore(today, 'day')) {
    const days = today.startOf('day').diff(d.startOf('day'), 'day');
    return { tone: 'rose', label: `−${days} дн` };
  }
  return { tone: 'neutral', label: d.format('D MMM') };
}

// Заголовок периода для тулбара по активному виду.
export function periodTitle(date, view) {
  const d = dayjs(date);
  if (view === 'week') {
    const start = d.startOf('week');
    const end = d.endOf('week');
    if (start.month() === end.month()) {
      return `${start.date()}–${end.date()} ${end.format('MMMM YYYY')}`;
    }
    return `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  }
  if (view === 'day') return d.format('D MMMM YYYY');
  return d.format('MMMM YYYY');
}
