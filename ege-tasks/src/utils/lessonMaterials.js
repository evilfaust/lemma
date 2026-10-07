/**
 * Учительские материалы урока (`lessons.materials`), которые открываются
 * в своём редакторе: работа, работа по геометрии, тест (v3.9.299 — тесты из
 * генераторов и тесты с выбором ответа прикрепляются к уроку как `mc_test`).
 * `work_view` (v3.9.306) — работа в режиме показа условий: ученику ссылка
 * /r/<id>, учителю — та же работа в редакторе. `geometry_view` (v3.9.308) —
 * то же для работы по геометрии: ученику /w/<id>.
 * Файлы (`material`) и ученические пункты (`session`, `text`) — не сюда.
 */
export const OPENABLE_TYPES = new Set(['work', 'geometry_work', 'mc_test', 'work_view', 'geometry_view']);

/** Адрес редактора материала урока. */
export function materialPath(id, type = 'work') {
  if (type === 'geometry_work' || type === 'geometry_view') return `/app/geometry/works/${id}`;
  if (type === 'mc_test') return `/app/worksheets/mc-test/${id}`;
  return `/app/works/${id}/edit`;
}

/** Значение пункта в мульти-селекте «Материалы урока»: тест — с префиксом. */
export const TEST_PREFIX = 'mc:';
export const testOption = (id) => `${TEST_PREFIX}${id}`;
export const isTestOption = (value) => String(value || '').startsWith(TEST_PREFIX);
export const testIdOf = (value) => String(value).slice(TEST_PREFIX.length);

/** Значение в пикере «Задания-ссылки»: работа по геометрии — с префиксом. */
export const GEO_PREFIX = 'gw:';
export const geoOption = (id) => `${GEO_PREFIX}${id}`;
export const isGeoOption = (value) => String(value || '').startsWith(GEO_PREFIX);
export const geoIdOf = (value) => String(value).slice(GEO_PREFIX.length);

/**
 * Что вставил учитель в «код сессии вручную»: ссылку на выдачу
 * (/student/<код> или голый код), на показ условий (/r/<id>) или на работу
 * по геометрии (/w/<id>). Раньше всё считалось выдачей, и ссылка /w/…
 * превращалась в «тест», который у ученика не открывался.
 * @returns {{ type: 'session'|'work_view'|'geometry_view', id: string } | null}
 */
export function parseStudentLink(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  // домен (со схемой или без) отрезаем: «student.oipav.ru/w/…» тоже ссылка
  const path = s.replace(/^(?:https?:\/\/)?[^/]*(?=\/)/i, '').replace(/[?#].*$/, '');
  const show = /^(?:\/student)?\/([rw])\/([a-z0-9]{15})\/?$/i.exec(path);
  if (show) return { type: show[1].toLowerCase() === 'w' ? 'geometry_view' : 'work_view', id: show[2].toLowerCase() };
  const session = /\/student\/([a-z0-9]{6,})/i.exec(path);
  if (session) return { type: 'session', id: session[1] };
  return /^[a-z0-9]{6,}$/i.test(s) ? { type: 'session', id: s } : null;
}
