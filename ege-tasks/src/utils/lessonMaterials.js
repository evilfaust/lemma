/**
 * Учительские материалы урока (`lessons.materials`), которые открываются
 * в своём редакторе: работа, работа по геометрии, тест (v3.9.299 — тесты из
 * генераторов и тесты с выбором ответа прикрепляются к уроку как `mc_test`).
 * `work_view` (v3.9.306) — работа в режиме показа условий: ученику ссылка
 * /r/<id>, учителю — та же работа в редакторе.
 * Файлы (`material`) и ученические пункты (`session`, `text`) — не сюда.
 */
export const OPENABLE_TYPES = new Set(['work', 'geometry_work', 'mc_test', 'work_view']);

/** Адрес редактора материала урока. */
export function materialPath(id, type = 'work') {
  if (type === 'geometry_work') return `/app/geometry/works/${id}`;
  if (type === 'mc_test') return `/app/worksheets/mc-test/${id}`;
  return `/app/works/${id}/edit`;
}

/** Значение пункта в мульти-селекте «Материалы урока»: тест — с префиксом. */
export const TEST_PREFIX = 'mc:';
export const testOption = (id) => `${TEST_PREFIX}${id}`;
export const isTestOption = (value) => String(value || '').startsWith(TEST_PREFIX);
export const testIdOf = (value) => String(value).slice(TEST_PREFIX.length);
