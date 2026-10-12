/**
 * Единый список материалов урока (v3.9.358) — чистая логика окна урока.
 *
 * До v3.9.358 одна и та же работа добавлялась в урок в двух местах:
 * «Материалы урока» (только учителю, ученик её не видел никогда) и
 * «Задания-ссылки» (ученикам). Теперь у работы одна запись в
 * `lessons.materials`, а как её получит ученик, решает поле `deliver`:
 *
 *   { type: 'work',          id, title, deliver?: 'online'|'show'|'paper', session? }
 *   { type: 'mc_test',       id, title, deliver?: 'online', session? }
 *   { type: 'geometry_work', id, title, deliver?: 'show' }
 *   { type: 'material',      id, title, url, visible? }   — файл: видимость = visible
 *   { type: 'text',          text }                        — всегда ученикам
 *
 * Без `deliver` — «Только мне» (так читаются все старые записи). У каждого
 * пункта ещё роль и срок (`role`/`due`, utils/homework.js) и `required` —
 * «обязательно / для удобства» (по умолчанию — `requiredOf`).
 *
 * Старые записи (`session`, `work_view`, `geometry_view`) окно приводит к
 * этому виду при открытии (`normalizeLessonItems`); сервер читает обе формы
 * (pocketbase/pb_hooks/lessons_feed_lib.js).
 */

import { parseStudentLink } from './lessonMaterials';
import { materialVisible, requiredOf, itemMode } from './homework';

export const WORK_TYPES = new Set(['work', 'mc_test', 'geometry_work']);

/** Способы выдачи: подпись в окне и что это значит для ученика. */
export const DELIVERIES = {
  online: { label: 'Решать онлайн', hint: 'Выдача по ссылке, ответы проверяются сразу' },
  show: { label: 'Только условия', hint: 'Ученик видит условия без ответов, решает в тетради' },
  paper: { label: 'Писали на бумаге', hint: 'Результаты вносите вы — ученик увидит свой балл' },
  file: { label: 'Посмотреть', hint: 'Ученик открывает файл у себя' },
  text: { label: 'Текст ученикам', hint: 'Ученик видит текст в уроке' },
  none: { label: 'Только мне', hint: 'Ученики этот пункт не видят' },
};

/** Какие способы выдачи есть у пункта (порядок — как в списке). */
export function deliveryChoices(item) {
  switch (item?.type) {
    case 'work': return ['online', 'show', 'paper', 'none'];
    case 'mc_test': return ['online', 'none'];
    case 'geometry_work': return ['show', 'none'];
    case 'material': return ['file', 'none'];
    case 'session': return ['online'];
    default: return [];
  }
}

/** Текущий способ выдачи пункта. */
export function deliveryOf(item, isCourse) {
  if (!item) return 'none';
  if (WORK_TYPES.has(item.type)) return item.deliver || 'none';
  if (item.type === 'material') return materialVisible(item, isCourse) ? 'file' : 'none';
  if (item.type === 'session') return 'online';
  if (item.type === 'text') return 'text';
  return 'none';
}

/** Способ выдачи по умолчанию для только что выбранной работы. */
export function defaultDelivery(type) {
  return type === 'geometry_work' ? 'show' : 'online';
}

/**
 * Пункт с новым способом выдачи. Для «Решать онлайн» нужна выдача — её id
 * приходит `session` (подбирает или создаёт окно урока).
 */
export function withDelivery(item, deliver, { session } = {}) {
  if (item.type === 'material') return { ...item, visible: deliver === 'file' };
  if (!WORK_TYPES.has(item.type)) return item;
  const next = { ...item };
  delete next.session;
  if (deliver === 'none' || !deliver) {
    delete next.deliver;
    return next;
  }
  next.deliver = deliver;
  if (deliver === 'online') next.session = session || item.session || '';
  return next;
}

const keyOf = (m) => `${m.type}:${m.id || ''}`;

/**
 * lessons.materials → пункты единого списка.
 * `sessionsById` — Map(id выдачи → запись work_sessions с полями work/mc_test):
 * по ней выдача старого вида узнаёт свою работу или тест.
 * Учительская запись работы, у которой есть запись для учеников, — дубль из
 * старой двойной схемы: остаётся одна строка.
 */
export function normalizeLessonItems(materials, sessionsById = new Map()) {
  const list = [];
  for (const raw of Array.isArray(materials) ? materials : []) {
    if (!raw || typeof raw !== 'object') continue;
    let m = raw;
    if (m.type === 'session') {
      const link = parseStudentLink(m.id);
      if (link && link.type !== 'session') m = { ...m, type: link.type, id: link.id };
    }
    if (m.type === 'work_view') m = { ...m, type: 'work', deliver: 'show' };
    else if (m.type === 'geometry_view') m = { ...m, type: 'geometry_work', deliver: 'show' };
    else if (m.type === 'session') {
      const s = sessionsById.get(m.id);
      if (s?.work) m = { ...m, type: 'work', id: s.work, deliver: 'online', session: m.id };
      else if (s?.mc_test) m = { ...m, type: 'mc_test', id: s.mc_test, deliver: 'online', session: m.id };
    }
    list.push(m === raw ? { ...raw } : m); // копия: ниже дописываем название
  }
  const delivered = new Map();
  for (const m of list) {
    if (WORK_TYPES.has(m.type) && m.deliver) {
      if (!delivered.has(keyOf(m))) delivered.set(keyOf(m), m);
    }
  }
  const out = [];
  const seen = new Set();
  for (const m of list) {
    if (WORK_TYPES.has(m.type)) {
      const k = keyOf(m);
      if (!m.deliver) {
        // Учительская запись: название берём, если у ученической его нет.
        const twin = delivered.get(k);
        if (twin) { if (!twin.title && m.title) twin.title = m.title; continue; }
      }
      const sig = `${k}|${m.deliver || ''}|${m.session || ''}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
    }
    out.push(m);
  }
  return out;
}

/** Пункт уже есть в уроке (та же работа, тест, файл). */
export function hasItem(items, type, id) {
  return (items || []).some((m) => m.type === type && m.id === id);
}

/** Где ученик увидит пункт: 'required' | 'materials' | 'results' | null. */
export function studentSection(item, isCourse) {
  if (!materialVisible(item, isCourse)) return null;
  if (item.deliver === 'paper') return 'results';
  return requiredOf(item) ? 'required' : 'materials';
}

const SECTION_TITLES = { required: '«Обязательно»', materials: '«Материалы»', results: '«Результаты»' };
const WHEN = { class: 'на уроке', hw: 'ДЗ к этому уроку', 'hw-next': 'ДЗ к следующему уроку' };
const ACTION = {
  online: 'кнопка «Решать», после сдачи — балл',
  show: 'условия без ответов',
  paper: 'балл появится, когда вы внесёте результаты',
  file: 'файл',
  text: 'текст',
};

/**
 * Подпись под строкой: что увидит ученик. Пустая строка — урок ученикам не
 * показывается вовсе (подпись не нужна).
 */
export function studentPreview(item, { isCourse = false, studentFacing = true } = {}) {
  if (!studentFacing) return '';
  const section = studentSection(item, isCourse);
  if (!section) return 'Ученики не видят';
  const d = deliveryOf(item, isCourse);
  const when = section === 'results' ? '' : ` · ${WHEN[itemMode(item)]}`;
  return `Ученик увидит: ${SECTION_TITLES[section]}${when} · ${ACTION[d] || ''}`.replace(/ · $/, '');
}

/** Открывается ли пункт в учительском редакторе: { id, type } или null. */
export function openTarget(item) {
  if (!item || !WORK_TYPES.has(item.type) || !item.id) return null;
  return { id: item.id, type: item.type };
}

/**
 * Выдача для «Решать онлайн»: открытая (самая свежая) из уже выданных.
 * Закрытые не годятся — среди них бумажные выдачи бланков.
 */
export function pickOpenSession(sessions) {
  return (sessions || []).find((s) => s && s.is_open) || null;
}

/** Выдачи, результаты которых видит ученик за этим пунктом. */
export function resultSessionIds(item, sessionsOfWork = []) {
  if (!item) return [];
  if (item.deliver === 'online') return item.session ? [item.session] : [];
  if (item.deliver === 'paper') return (sessionsOfWork || []).map((s) => s.id).filter(Boolean);
  return [];
}

/**
 * Короткая пометка для списков урока (шторка, инспектор календаря): как
 * пункт выдан ученикам. Пусто — класс уроков ученикам не показывает.
 */
export function deliveryBadge(item, { isCourse = false, studentFacing = true } = {}) {
  if (!studentFacing || !item) return '';
  const d = deliveryOf(item, isCourse);
  if (d === 'none') return 'только мне';
  if (d === 'file') return 'ученикам';
  return (DELIVERIES[d]?.label || '').toLowerCase();
}
