/**
 * Название работы, которое видит ученик (v3.9.372).
 *
 * У выдачи свой заголовок `work_sessions.student_title`, и по умолчанию он
 * безликий — «Самостоятельная работа» (так его ставит `SessionPanel`), «Тест».
 * В ленте результатов ученик видел три «Самостоятельные работы» подряд и не
 * понимал, какая из них какая. Поэтому заголовок-заглушка уступает место
 * названию самой работы (или теста), а свой заголовок учителя — нет.
 */

// Заголовки, которые ничего не говорят о работе (сравнение без регистра и «ё»).
const GENERIC_TITLES = new Set([
  'самостоятельная работа',
  'самостоятельная',
  'работа',
  'тест',
  'тест с выбором ответа',
  'контрольная работа',
  'проверочная работа',
]);

const norm = (s) => String(s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

/** Заголовок-заглушка, по которому работу не узнать. */
export function isGenericTitle(title) {
  const t = norm(title);
  return !t || GENERIC_TITLES.has(t);
}

/**
 * Название выдачи для ученика: свой заголовок учителя → название работы /
 * теста → заглушка, если больше ничего нет.
 * `session` — запись `work_sessions` (с `expand.work` / `expand.mc_test`, если есть).
 */
export function studentWorkTitle(session, fallback = 'Тест') {
  const own = String(session?.student_title || '').trim();
  if (own && !isGenericTitle(own)) return own;
  const e = session?.expand || {};
  const named = [e.work?.title, e.mc_test?.title, e.trig_mc_test?.title]
    .map((t) => String(t || '').trim())
    .find(Boolean);
  return named || own || fallback;
}
