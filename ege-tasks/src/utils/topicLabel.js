/**
 * Подписи тем в списках выбора.
 *
 * Названия тем базы и ОГЭ повторяют номер задания: «ЕГЭ-База. №5 Начала
 * теории вероятностей», «ОГЭ. №6 Числа и вычисления». В списке рядом стоит
 * свой номер («№5 · …»), и повтор съедал половину узкого поля — на планшете
 * от темы оставалось «№5 — ЕГЭ-База. №5 Нача…».
 */

const EXAM_HEAD = /^\s*(?:ЕГЭ[-\s]?(?:база|профиль)|ЕГЭ|ОГЭ|ВПР)\s*\.?\s*№\s*\d+\s*[.:—–-]?\s*/i;

/** Название темы без повтора «ЕГЭ-База. №5» в начале. */
export function shortTopicTitle(title) {
  const t = String(title || '');
  const short = t.replace(EXAM_HEAD, '');
  return short.trim() ? short : t;
}

/** «№5 · Начала теории вероятностей»; тема без номера — просто название. */
export function topicOptionLabel(topic) {
  if (!topic) return '';
  const title = shortTopicTitle(topic.title);
  return topic.ege_number ? `№${topic.ege_number} · ${title}` : title;
}
