// Ссылка ученику на геометрическую работу: student.oipav.ru/w/<id>
// (общая — ученик выбирает вариант) и /w/<id>?v=2 (свой вариант, выбора нет).
// Ученику — только условия и чертежи: ответы и решения страница не
// запрашивает (решение пользователя 12.07.2026 — решения ученику не показываем).

import { normalizeStructure } from './geometryWork';

export const STUDENT_ORIGIN = 'https://student.oipav.ru';

/** Ссылка на работу; variant — номер варианта с нуля (null — общая). */
export function workLink(id, variant = null, origin = STUDENT_ORIGIN) {
  const v = Number.isInteger(variant) && variant >= 0 ? `?v=${variant + 1}` : '';
  const full = `${origin.replace(/\/+$/, '')}/w/${id}${v}`;
  return { full, short: full.replace(/^https?:\/\//, '') };
}

/**
 * Работа из адреса ученика: /w/<id> или /student/w/<id>, вариант — ?v=N.
 * @returns {{ id, variant: number|null } | null} variant — с нуля
 */
export function workFromLocation(pathname, search = '') {
  const m = /^(?:\/student)?\/w\/([a-z0-9]{15})\/?$/.exec(String(pathname || ''));
  if (!m) return null;
  const v = Number(new URLSearchParams(search || '').get('v'));
  return { id: m[1], variant: Number.isInteger(v) && v >= 1 ? v - 1 : null };
}

/**
 * Задания варианта для ученика: позиции с задачей, по порядку, с номером
 * позиции работы (пустая ячейка номер не сдвигает — у всех вариантов
 * «задача 3» одна и та же позиция).
 * @returns {Array<{ no: number, taskId: string }>}
 */
export function variantItems(structure, variant) {
  const s = normalizeStructure(structure);
  const items = s.variants[variant]?.items || [];
  return items
    .map((it, i) => (it?.task ? { no: i + 1, taskId: it.task } : null))
    .filter(Boolean);
}

/** Сколько вариантов в работе (минимум 1). */
export function variantCount(structure) {
  return Math.max(1, normalizeStructure(structure).variants.length);
}
