import dayjs from 'dayjs';

/**
 * Домашние задания уроков (v3.9.291) — чистая логика без сети.
 *
 * У пункта урока (lessons.materials у учителя, items из /api/lessons/my у
 * ученика) роль `role: 'class'|'homework'`, а у ДЗ ещё и срок `due`:
 *   'lesson' (или пусто) — ДЗ к этому уроку, показывается в нём самом;
 *   'next'               — ДЗ к следующему уроку. Урок-цель НЕ хранится, он
 *                          вычисляется каждый раз: появился новый урок,
 *                          перенесли, отменили — ДЗ переезжает само.
 *
 * Следующий урок (решения пользователя 05.10.2026): ближайший урок того же
 * класса и того же учителя в ДРУГОЙ день (ДЗ с первой полупары не уходит на
 * вторую), не отменённый и не скрытый от учеников.
 */

// 🚨 Копия правила из pocketbase/pb_hooks/lessons_feed_lib.js — учитель видит
// в модалке ровно то, что уйдёт ученику. Сверяет тест studentLessons.test.js.
export function materialVisible(m, isCourse) {
  if (!m) return false;
  if (m.type === 'material') return isCourse ? m.visible !== false : m.visible === true;
  return m.visible !== false;
}

/**
 * Видят ли ученики уроки этой группы: курс — пока не завершён (v3.9.293),
 * класс — если учитель открыл расписание (`student_schedule`). То же правило
 * в хуке lessons_feed.pb.js.
 */
export function studentFacing(group) {
  if (!group) return false;
  if (group.kind === 'course') return !group.completed;
  return !!group.student_schedule;
}

export const isNextDue = (it) => !!it && it.role === 'homework' && it.due === 'next';

// Роль и срок одним значением — так их выбирает учитель в модалке урока.
export const ITEM_MODES = [
  { value: 'class', label: 'Классн.' },
  { value: 'hw', label: 'ДЗ' },
  { value: 'hw-next', label: 'ДЗ к след.' },
];

export function itemMode(it) {
  if (!it || it.role !== 'homework') return 'class';
  return it.due === 'next' ? 'hw-next' : 'hw';
}

// Название пункта-ссылки, когда учитель его не ввёл, — по режиму. Раньше всегда
// было «Домашняя работа», и классная работа выглядела у ученика домашней.
const DEFAULT_TITLES = {
  class: 'Классная работа',
  hw: 'Домашняя работа',
  'hw-next': 'ДЗ к следующему уроку',
};
export const defaultItemTitle = (mode) => DEFAULT_TITLES[mode] || DEFAULT_TITLES.hw;
const isDefaultTitle = (title) => Object.values(DEFAULT_TITLES).includes((title || '').trim());

// Новое значение режима → пункт. ДЗ-файл в классе сразу становится видимым:
// задать ученикам невидимое домашнее задание незачем. Стандартное название
// меняется вместе с режимом, своё (введённое учителем) — остаётся.
export function withMode(it, mode) {
  const next = { ...it, role: mode === 'class' ? 'class' : 'homework' };
  if (isDefaultTitle(it.title)) next.title = defaultItemTitle(mode);
  if (mode === 'hw-next') next.due = 'next';
  else delete next.due;
  if (mode !== 'class' && it.type === 'material' && it.visible !== false) next.visible = true;
  return next;
}

const dayKey = (d) => dayjs(d).format('YYYY-MM-DD');
const receives = (l) => l.status !== 'cancelled' && !l.hidden_from_students;
const lineOf = (l) => `${l.group || ''}|${l.owner || ''}`;

/** id урока → id следующего урока (того же класса и учителя, в другой день) или null. */
export function nextLessonMap(lessons) {
  const lines = new Map();
  for (const l of lessons || []) {
    if (!l?.date_plan) continue;
    const key = lineOf(l);
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(l);
  }
  const out = new Map();
  for (const list of lines.values()) {
    list.sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan));
    for (let i = 0; i < list.length; i++) {
      const day = dayKey(list[i].date_plan);
      let target = null;
      for (let j = i + 1; j < list.length; j++) {
        if (dayKey(list[j].date_plan) > day && receives(list[j])) { target = list[j].id; break; }
      }
      out.set(list[i].id, target);
    }
  }
  return out;
}

/**
 * ДЗ «к следующему уроку» по урокам-целям.
 * itemsOf(lesson) → пункты урока (учитель: l.materials, ученик: l.items).
 * → { incoming: Map(idЦели → [{ item, from }]), pending: [{ item, from }],
 *     targetOf: Map(idИсточника → урок-цель | null) }
 */
export function resolveHomework(lessons, itemsOf) {
  const list = lessons || [];
  const next = nextLessonMap(list);
  const byId = new Map(list.map((l) => [l.id, l]));
  const incoming = new Map();
  const pending = [];
  const targetOf = new Map();
  for (const l of list) {
    const items = (itemsOf(l) || []).filter(isNextDue);
    if (!items.length) continue;
    const tid = next.get(l.id) || null;
    targetOf.set(l.id, tid ? byId.get(tid) : null);
    for (const item of items) {
      if (tid) {
        if (!incoming.has(tid)) incoming.set(tid, []);
        incoming.get(tid).push({ item, from: l });
      } else {
        pending.push({ item, from: l });
      }
    }
  }
  return { incoming, pending, targetOf };
}

/**
 * Следующий урок для ещё не сохранённого состояния модалки: уроки класса
 * вокруг + сам редактируемый урок с текущими датой/статусом.
 */
export function nextLessonFor(lesson, neighbours) {
  if (!lesson?.date_plan) return null;
  const self = { ...lesson, id: lesson.id || '__self' };
  const list = [...(neighbours || []).filter((l) => l.id !== self.id), self];
  const tid = nextLessonMap(list).get(self.id);
  return tid ? list.find((l) => l.id === tid) : null;
}

/**
 * ДЗ, которые задали к этому уроку на прошлых уроках: [{ item, from }].
 * Отменённый или скрытый урок ДЗ не принимает — оно уходит дальше.
 */
export function incomingFor(lesson, neighbours, itemsOf) {
  if (!lesson?.date_plan) return [];
  const self = { ...lesson, id: lesson.id || '__self' };
  const list = [...(neighbours || []).filter((l) => l.id !== self.id), self];
  return resolveHomework(list, itemsOf).incoming.get(self.id) || [];
}

/**
 * Лента «Домашнее задание» ученика: что сделать и к какому уроку.
 * → [{ item, from, due: урок | null }] по сроку; без даты — в конце.
 * ДЗ к самому уроку берутся с уроков последней недели (по сегодня), ДЗ к
 * следующему — с целью сегодня или позже, либо ещё без цели.
 */
export function homeworkFeed(lessons, now = dayjs()) {
  const list = lessons || [];
  const today = dayjs(now).startOf('day');
  const weekAgo = today.subtract(7, 'day');
  const endOfToday = today.endOf('day');
  const out = [];
  for (const l of list) {
    const d = dayjs(l.date_plan);
    if (d.isBefore(weekAgo) || d.isAfter(endOfToday) || l.status === 'cancelled') continue;
    for (const item of l.items || []) {
      if (item.role === 'homework' && !isNextDue(item)) out.push({ item, from: l, due: l });
    }
  }
  const { incoming, pending } = resolveHomework(list, (l) => l.items);
  const byId = new Map(list.map((l) => [l.id, l]));
  for (const [tid, arr] of incoming) {
    const target = byId.get(tid);
    if (!target || dayjs(target.date_plan).isBefore(today)) continue;
    for (const { item, from } of arr) out.push({ item, from, due: target });
  }
  for (const { item, from } of pending) out.push({ item, from, due: null });
  const t = (x) => (x.due ? new Date(x.due.date_plan).getTime() : Infinity);
  return out.sort((a, b) => t(a) - t(b));
}
