// КТП: единицы времени, раскладка шаблона под сетку часов и недели.
// Чистый модуль (без React и сети) — под тестом `ktpPlan.test.js`.
//
// Единица плана (`courses.unit`, миграция 1789200000): урок (45 мин) или пара
// (90 мин = 2 академических часа). Число в `ktp_entries.hours` — в единицах
// плана: у КТП «по парам» строка «2» = две пары. Нет поля / старый план — уроки.
import { pluralRu } from './tdfSheet';

export const KTP_UNITS = {
  lesson: { key: 'lesson', label: 'Уроки (45 мин)', column: 'Часы', forms: ['час', 'часа', 'часов'], academic: 1 },
  pair: { key: 'pair', label: 'Пары (90 мин)', column: 'Пары', forms: ['пара', 'пары', 'пар'], academic: 2 },
};

export const DEFAULT_PER_WEEK = 2;
export const DEFAULT_WEEKS = 34;

export function unitOf(course) {
  return KTP_UNITS[course?.unit] || KTP_UNITS.lesson;
}

export function perWeekOf(course) {
  const n = Number(course?.per_week);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PER_WEEK;
}

/** «68 пар», «1 час», «2,5 часа» */
export function formatAmount(n, unit = KTP_UNITS.lesson) {
  const num = Number(n) || 0;
  const text = String(Math.round(num * 10) / 10).replace('.', ',');
  const forms = unit.forms;
  return `${text} ${Number.isInteger(num) ? pluralRu(num, forms) : forms[1]}`;
}

/** Сумма часов плана (разделы-заголовки не считаются). */
export function totalAmount(entries = []) {
  return entries
    .filter((e) => !e.is_section && e.hours != null && e.hours !== '')
    .reduce((s, e) => s + Number(e.hours || 0), 0);
}

/** «68 пар (136 ч)» — для пар показываем и академические часы. */
export function totalLabel(entries, course) {
  const unit = unitOf(course);
  const total = totalAmount(entries);
  const main = formatAmount(total, unit);
  return unit.academic > 1 && total ? `${main} (${Math.round(total * unit.academic * 10) / 10} ч)` : main;
}

// Строки, которые не растягиваются с часами: контроль длится одно занятие.
const FIXED_KINDS = new Set(['control', 'credit']);

/**
 * Раскладывает часы шаблона на `totalSlots` занятий своей сетки.
 * Шаблон считан в часах гос. программы; у учителя занятий может быть больше
 * (пары, больше часов в неделю) или меньше. Контрольные и зачёты остаются по
 * одному занятию, остальное делится пропорционально (метод наибольших
 * остатков, у каждой строки ≥ 1; лишнее при равенстве — сначала практике).
 * Возвращает `{ rows, total, base, overflow }`: rows — копии строк шаблона с
 * полем `slots`, overflow > 0 — занятий не хватило даже по одному на строку.
 */
export function scaleTemplate(items = [], totalSlots) {
  const lessons = items.filter((it) => !it.section);
  const base = lessons.reduce((s, it) => s + (Number(it.hours) || 0), 0);
  const fixed = lessons.filter((it) => FIXED_KINDS.has(it.kind));
  const flex = lessons.filter((it) => !FIXED_KINDS.has(it.kind));
  const target = Number.isFinite(totalSlots) && totalSlots > 0 ? Math.floor(totalSlots) : base;

  const flexBase = flex.reduce((s, it) => s + (Number(it.hours) || 0), 0);
  const avail = Math.max(target - fixed.length, flex.length);
  const quota = new Map(flex.map((it) => [it, flexBase ? ((Number(it.hours) || 0) * avail) / flexBase : 1]));
  const alloc = new Map(flex.map((it) => [it, Math.max(1, Math.floor(quota.get(it)))]));

  let sum = [...alloc.values()].reduce((s, v) => s + v, 0);
  const practiceFirst = (a, b) => (b.kind === 'practice') - (a.kind === 'practice');
  while (sum < avail) {
    const best = [...flex].sort((a, b) => (quota.get(b) - alloc.get(b)) - (quota.get(a) - alloc.get(a)) || practiceFirst(a, b))[0];
    alloc.set(best, alloc.get(best) + 1);
    sum += 1;
  }
  while (sum > avail) {
    const cand = flex.filter((it) => alloc.get(it) > 1);
    if (!cand.length) break;
    const worst = cand.sort((a, b) => (alloc.get(b) - quota.get(b)) - (alloc.get(a) - quota.get(a)) || practiceFirst(b, a))[0];
    alloc.set(worst, alloc.get(worst) - 1);
    sum -= 1;
  }

  const rows = items.map((it) => {
    if (it.section) return { ...it };
    return { ...it, slots: FIXED_KINDS.has(it.kind) ? 1 : alloc.get(it) };
  });
  const total = rows.reduce((s, r) => s + (r.slots || 0), 0);
  return { rows, total, base, overflow: Math.max(0, total - target) };
}

/** Понедельник недели, в которую попадает дата (локальное время). */
function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Недели строк по накопленным часам: строка встаёт в неделю, где начинается.
 * `startDate` (необязательно) — первый учебный день: дата по плану = понедельник
 * недели строки (1 сентября в субботу → первая неделя всё равно с этой даты).
 * Возвращает новые объекты `{ ...entry, week_no, planned_date? }`.
 */
export function assignWeeks(entries = [], perWeek = DEFAULT_PER_WEEK, { startDate = null, firstWeek = 1 } = {}) {
  const pw = Number(perWeek) > 0 ? Number(perWeek) : DEFAULT_PER_WEEK;
  const start = startDate ? new Date(startDate) : null;
  const monday = start ? weekStart(start) : null;
  let pos = 0;
  return entries.map((e) => {
    if (e.is_section) return { ...e };
    const week = Math.floor(pos / pw + 1e-9) + firstWeek;
    pos += Number(e.hours) || 0;
    const next = { ...e, week_no: week };
    if (monday) {
      const d = week === firstWeek ? new Date(start) : new Date(monday);
      if (week !== firstWeek) d.setDate(monday.getDate() + (week - firstWeek) * 7);
      d.setHours(12, 0, 0, 0);
      next.planned_date = d.toISOString();
    }
    return next;
  });
}

/** Сколько недель займёт план при `perWeek` занятиях в неделю. */
export function weeksNeeded(entries, perWeek = DEFAULT_PER_WEEK) {
  const pw = Number(perWeek) > 0 ? Number(perWeek) : DEFAULT_PER_WEEK;
  return Math.ceil(totalAmount(entries) / pw - 1e-9);
}

/**
 * Строки КТП из шаблона под свою сетку: заголовки разделов + темы с часами.
 * Поля — как у `ktp_entries` (без course/order: их ставит вызывающий).
 */
export function buildKtpRows(template, { totalSlots, perWeek = DEFAULT_PER_WEEK, startDate = null } = {}) {
  const { rows, total, base, overflow } = scaleTemplate(template?.items || [], totalSlots);
  const entries = rows.map((r) => (r.section
    ? { title: r.section, is_section: true, planned_results: '' }
    : { title: r.title, hours: r.slots, is_section: false, planned_results: plannedText(r) }));
  return { entries: assignWeeks(entries, perWeek, { startDate }), total, base, overflow };
}

/** Планируемые результаты строки шаблона: цель + пункты учебника + контроль. */
export function plannedText(row) {
  return [
    row.goal || '',
    row.ref ? `Учебник: ${row.ref}` : '',
    row.check ? `Контроль: ${row.check}` : '',
  ].filter(Boolean).join('\n');
}

/** Разделы шаблона с суммой занятий после раскладки — для превью. */
export function sectionSummary(rows = []) {
  const out = [];
  let cur = null;
  for (const r of rows) {
    if (r.section) {
      cur = { title: r.section, slots: 0, lessons: 0 };
      out.push(cur);
    } else if (cur) {
      cur.slots += r.slots || 0;
      cur.lessons += 1;
    }
  }
  return out;
}
