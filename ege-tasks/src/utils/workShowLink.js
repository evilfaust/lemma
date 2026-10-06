// Показ условий работы ученикам (v3.9.306): student.oipav.ru/r/<id> (общая —
// ученик выбирает вариант) и /r/<id>?v=2 (свой вариант, выбора нет).
// Не выдача: ни попытки, ни ответов — работа для разбора в классе или как ДЗ,
// решение в тетради. Ученику — только условия и картинки (решение
// пользователя 12.07.2026 — решения и ответы ученику не показываем).
// Устроено как ссылка на геометрическую работу (utils/geometryWorkLink.js).

export const STUDENT_ORIGIN = 'https://student.oipav.ru';

/** Ссылка на работу; variantNumber — номер варианта (variants.number), null — общая. */
export function showLink(id, variantNumber = null, origin = STUDENT_ORIGIN) {
  const n = Number(variantNumber);
  const v = Number.isInteger(n) && n >= 1 ? `?v=${n}` : '';
  const full = `${origin.replace(/\/+$/, '')}/r/${id}${v}`;
  return { full, short: full.replace(/^https?:\/\//, '') };
}

/**
 * Работа из адреса ученика: /r/<id> или /student/r/<id>, вариант — ?v=N.
 * @returns {{ id, variant: number|null } | null} variant — номер варианта
 */
export function showFromLocation(pathname, search = '') {
  const m = /^(?:\/student)?\/r\/([a-z0-9]{15})\/?$/.exec(String(pathname || ''));
  if (!m) return null;
  const v = Number(new URLSearchParams(search || '').get('v'));
  return { id: m[1], variant: Number.isInteger(v) && v >= 1 ? v : null };
}

/**
 * id задач варианта по порядку: `order` ([{ taskId, position }]) главнее,
 * задачи без позиции — в конце в порядке `tasks`. Без `order` — как в `tasks`.
 */
export function variantTaskIds(variant) {
  const ids = (Array.isArray(variant?.tasks) ? variant.tasks : [])
    .map((t) => (typeof t === 'string' ? t : t?.id))
    .filter(Boolean);
  const order = Array.isArray(variant?.order) ? variant.order : [];
  if (!order.length) return ids;
  const pos = new Map();
  for (const o of order) {
    if (o && o.taskId && Number.isFinite(Number(o.position)) && !pos.has(o.taskId)) pos.set(o.taskId, Number(o.position));
  }
  return ids
    .map((id, i) => ({ id, i, p: pos.has(id) ? pos.get(id) : Infinity }))
    .sort((a, b) => (a.p - b.p) || (a.i - b.i))
    .map((x) => x.id);
}

/** Вариант по номеру из ссылки; нет такого — null. */
export function pickVariant(variants, number) {
  if (number == null) return null;
  return (variants || []).find((v) => Number(v.number) === Number(number)) || null;
}
