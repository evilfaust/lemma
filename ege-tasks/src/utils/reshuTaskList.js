/**
 * Работа по номерам «Решу ЕГЭ/ОГЭ»: учитель вставляет список задач (номера,
 * ссылки, скопированную страницу варианта или распознанный скриншот), а мы
 * находим задачи в банке Лемма по `tasks.sdamgia_id` и собираем из них работу.
 *
 * Здесь — чистая логика без сети (покрыта `__tests__/reshuTaskList.test.js`).
 * Сетевая часть — `hooks/useReshuWorkImport.js`.
 */

/** Контексты, для которых умеем ходить на Решу: домен сайта и подпись источника. */
export const RESHU_EXAMS = {
  ege_profile: { label: 'ЕГЭ профиль', origin: 'https://ege.sdamgia.ru', sourceType: 'ege_prof' },
  ege_base: { label: 'ЕГЭ база', origin: 'https://mathb-ege.sdamgia.ru', sourceType: 'ege_base' },
  oge: { label: 'ОГЭ', origin: 'https://math-oge.sdamgia.ru', sourceType: 'oge' },
};

const HOST_TO_EXAM = [
  [/mathb-ege\.sdamgia\.ru/i, 'ege_base'],
  [/(?:math-)?oge\.sdamgia\.ru/i, 'oge'],
  [/(?:math-)?ege\.sdamgia\.ru/i, 'ege_profile'],
];

/** Ссылка на одну задачу Решу нужного экзамена. */
export function reshuProblemUrl(id, examType = 'ege_profile') {
  const exam = RESHU_EXAMS[examType] || RESHU_EXAMS.ege_profile;
  return `${exam.origin}/problem?id=${id}`;
}

/** Экзамен по первой ссылке на sdamgia в тексте (или null). */
export function detectReshuExam(text) {
  const m = String(text || '').match(/https?:\/\/[\w.-]*sdamgia\.ru/i);
  if (!m) return null;
  for (const [re, exam] of HOST_TO_EXAM) if (re.test(m[0])) return exam;
  return null;
}

/**
 * Ссылки на целые варианты / подборки Решу (`/test?id=…`, `/test?category_id=…`):
 * такую ссылку разбирает сервер, и задачи приходят в порядке варианта.
 */
export function extractVariantUrls(text) {
  const re = /https?:\/\/[\w.-]*sdamgia\.ru\/test\?[^\s)"'<>]+/gi;
  return [...new Set(String(text || '').match(re) || [])];
}

// Номер задачи в базе Решу — 3–7 цифр (порядковые 1…20 варианта отсекаются).
const ID = '(\\d{3,7})';
// «Тип 7 № 27455», «Тип Д4 № 509202», «№ 27455», «№27455»
const NUMBERED_RE = new RegExp(`(?:Тип\\s+([^\\s№]+)\\s*)?№\\s*${ID}(?!\\d)`, 'g');
// …/problem?id=27455
const LINK_RE = new RegExp(`problem\\?id=${ID}(?!\\d)`, 'g');
// голое число в списке «27455, 27456» / по строкам
const BARE_RE = new RegExp(`(?<![\\d.,])${ID}(?![\\d.,]\\d|\\d)`, 'g');

/**
 * Номера задач из произвольного текста — по порядку появления, без повторов.
 *
 * Если в тексте есть «№ …» или ссылки problem?id=…, берём только их: в
 * скопированной странице Решу полно посторонних чисел (годы, ответы, баллы).
 * Иначе считаем, что это просто список номеров.
 *
 * @returns {{ items: Array<{id: string, typeLabel: string|null}>, duplicates: string[] }}
 */
export function extractReshuIds(text) {
  const src = String(text || '').replace(/\u00A0/g, ' ');
  const found = [];

  const numbered = [...src.matchAll(NUMBERED_RE)]
    // «Вариант № 1234567» — номер варианта, а не задачи
    .filter((m) => m[1] || !/вариант\s*$/i.test(src.slice(Math.max(0, m.index - 12), m.index)))
    .map((m) => ({ index: m.index, id: m[2], typeLabel: m[1] || null }));
  const links = [...src.matchAll(LINK_RE)].map((m) => ({ index: m.index, id: m[1], typeLabel: null }));

  if (numbered.length || links.length) {
    found.push(...numbered, ...links);
    found.sort((a, b) => a.index - b.index);
  } else {
    // Ссылки на варианты (`test?id=`) — не номера задач
    const cleaned = src.replace(/https?:\/\/\S+/g, ' ');
    found.push(...[...cleaned.matchAll(BARE_RE)].map((m) => ({ index: m.index, id: m[1], typeLabel: null })));
  }

  const seen = new Map();
  const duplicates = [];
  for (const item of found) {
    const prev = seen.get(item.id);
    if (prev) {
      // «Тип N» мог стоять только у одного из упоминаний (ссылка + «№»)
      if (!prev.typeLabel && item.typeLabel) prev.typeLabel = item.typeLabel;
      if (!duplicates.includes(item.id)) duplicates.push(item.id);
      continue;
    }
    seen.set(item.id, { id: item.id, typeLabel: item.typeLabel });
  }
  return { items: [...seen.values()], duplicates };
}

/** Список в тексте — для поля ввода после распознавания скриншота. */
export function formatReshuList(items = []) {
  return items
    .map((it) => (it.typeLabel ? `Тип ${it.typeLabel} № ${it.id}` : `№ ${it.id}`))
    .join('\n');
}

/**
 * Тема Лемма для новой задачи по «Тип N» с Решу: номер задания = `ege_number`
 * действующей (не архивной) темы экзамена. «Д4» и прочие нечисловые типы —
 * без автоподбора, тему выбирает учитель.
 */
export function topicForReshuType(topics = [], examType, typeLabel) {
  if (!typeLabel || !/^\d+$/.test(String(typeLabel))) return null;
  const n = Number(typeLabel);
  const candidates = topics.filter((t) => t.exam_type === examType && Number(t.ege_number) === n);
  return candidates.find((t) => !t.archived) || null;
}

/**
 * Одна sdamgia_id может встречаться в банке несколько раз (задача живёт и в базе,
 * и в профиле; дубль после импорта). Берём ту, что относится к выбранному
 * экзамену, действующие темы — раньше архивных.
 */
export function pickBankTask(candidates = [], examType, topicsById = new Map()) {
  if (candidates.length <= 1) return candidates[0] || null;
  const score = (task) => {
    const topic = topicsById.get(task.topic);
    if (!topic) return 0;
    return (topic.exam_type === examType ? 2 : 0) + (topic.archived ? 0 : 1);
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/** Самая частая тема среди строк — она пишется в `works.topic`. */
export function mainTopicOf(topicIds = []) {
  const counts = new Map();
  topicIds.filter(Boolean).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Перестановка строки на одну позицию вверх/вниз (для таблицы порядка). */
export function moveItem(list, index, delta) {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
