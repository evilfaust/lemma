// «Банк задач» — все подсчёты раздела в одном месте.
//
// До v3.9.387 те же разбивки (темы, подтемы, теги, источники, сложность, годы)
// считали две страницы — «Аналитика» и «Каталог» — двумя копиями кода, и копии
// успели разойтись (задача без сложности в одной была «не указана», в другой —
// «1»). Теперь вкладки и обзор берут числа отсюда. Модуль чистый: без React и
// сети, под тестом `__tests__/taskBank.test.js`.

export const UNSET_DIFFICULTY = '__unset__';

// Экзамены, у которых есть нумерация заданий, — для них строится «покрытие».
export const EXAM_SCOPES = [
  { key: 'ege_base', label: 'ЕГЭ база' },
  { key: 'ege_profile', label: 'ЕГЭ профиль' },
  { key: 'oge', label: 'ОГЭ' },
  { key: 'vpr', label: 'ВПР' },
];

// Все контексты тем — для полосы «из чего состоит банк».
export const EXAM_TYPE_LABELS = {
  ege_base: 'ЕГЭ база',
  ege_profile: 'ЕГЭ профиль',
  oge: 'ОГЭ',
  vpr: 'ВПР',
  oral: 'Устный счёт',
  trig: 'Тригонометрия',
  mordkovich: 'Мордкович',
  other: 'Прочее',
  none: 'Без контекста',
  notopic: 'Без темы',
};

// Тема экзамена считается «тонкой», если задач в ней меньше этого числа:
// двух-трёх параллельных вариантов уже не собрать без повторов.
export const THIN_TOPIC = 15;

// Решаемость задачи показываем, только если ответов набралось хотя бы столько.
export const MIN_SOLVE_N = 5;

const inc = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

const asList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string' && v) return [v];
  return [];
};

/** Сложность задачи как ключ: пусто/нет → UNSET_DIFFICULTY. */
export function difficultyKey(value) {
  if (value === undefined || value === null || value === '') return UNSET_DIFFICULTY;
  return String(value);
}

/** Один проход по снимку банка → все разбивки. */
export function countSnapshot(snapshot = []) {
  const byTopic = new Map();
  const bySubtopic = new Map();
  const byTag = new Map();
  const bySource = new Map();
  const byDifficulty = new Map();
  const byYear = new Map();
  let withImage = 0;
  let noTopic = 0;

  for (const task of snapshot) {
    if (task.topic) inc(byTopic, task.topic);
    else noTopic += 1;
    asList(task.subtopic).forEach((id) => inc(bySubtopic, id));
    asList(task.tags).forEach((id) => inc(byTag, id));
    if (task.source) inc(bySource, task.source);
    if (task.year) inc(byYear, task.year);
    inc(byDifficulty, difficultyKey(task.difficulty));
    if (task.has_image) withImage += 1;
  }

  return {
    total: snapshot.length,
    withImage,
    noTopic,
    byTopic, bySubtopic, byTag, bySource, byDifficulty, byYear,
  };
}

const byCountDesc = (a, b) => b.count - a.count;

export function topicLabel(topic) {
  if (!topic) return '';
  return topic.ege_number ? `№${topic.ege_number} ${topic.title}` : topic.title;
}

/** Строки вкладки «Темы» — по числу задач. */
export function topicRows(topics, counts) {
  return topics.map((t) => ({
    key: t.id, title: t.title, ege: t.ege_number, order: t.order,
    count: counts.byTopic.get(t.id) || 0, raw: t,
  })).sort(byCountDesc);
}

export function subtopicRows(subtopics, topics, counts) {
  const topicById = new Map(topics.map((t) => [t.id, t]));
  return subtopics.map((st) => ({
    key: st.id, title: st.name || st.title,
    topicTitle: topicLabel(topicById.get(st.topic)),
    topicId: st.topic, order: st.order,
    count: counts.bySubtopic.get(st.id) || 0, raw: st,
  })).sort(byCountDesc);
}

export function tagRows(tags, counts) {
  return tags.map((t) => ({
    key: t.id, title: t.title, color: t.color,
    count: counts.byTag.get(t.id) || 0, raw: t,
  })).sort(byCountDesc);
}

/** Источники: из справочника и из самих задач, без повторов. */
export function sourceRows(sources, counts) {
  const all = new Map();
  sources.forEach((s) => all.set(s, counts.bySource.get(s) || 0));
  counts.bySource.forEach((count, s) => { if (!all.has(s)) all.set(s, count); });
  return [...all.entries()]
    .map(([source, count]) => ({ key: source, source, count }))
    .sort(byCountDesc);
}

export function difficultyRows(counts) {
  return [...counts.byDifficulty.entries()]
    .map(([difficulty, count]) => ({ key: difficulty, difficulty, count }))
    .sort((a, b) => {
      if (a.difficulty === UNSET_DIFFICULTY) return 1;
      if (b.difficulty === UNSET_DIFFICULTY) return -1;
      return Number(a.difficulty) - Number(b.difficulty);
    });
}

export function yearRows(counts) {
  return [...counts.byYear.entries()]
    .map(([year, count]) => ({ key: year, year, count }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

/** Из чего состоит банк: задачи по контексту темы (ЕГЭ база, ОГЭ…). */
export function examMix(topics, counts) {
  const typeOf = new Map(topics.map((t) => [t.id, t.exam_type || 'none']));
  const mix = new Map();
  counts.byTopic.forEach((count, id) => inc(mix, typeOf.get(id) || 'none', count));
  if (counts.noTopic) inc(mix, 'notopic', counts.noTopic);
  return [...mix.entries()]
    .map(([key, count]) => ({ key, label: EXAM_TYPE_LABELS[key] || key, count }))
    .sort(byCountDesc);
}

/** Список id тем (по задаче) → Map тема → сколько задач. */
export function countByTopic(topicIds = []) {
  const map = new Map();
  topicIds.forEach((id) => { if (id) inc(map, id); });
  return map;
}

/**
 * Использование задач: в каких работах они стоят и как их решают.
 * variants — [{ tasks: [id…] }], statsByTask — { id: { c, n } } (useTaskStats),
 * topicOf — Map задача → тема (по снимку).
 */
export function usageStats({ variants = [], statsByTask = {}, topicOf = new Map() }) {
  const used = new Set();
  const works = new Set();
  variants.forEach((v) => {
    asList(v.tasks).forEach((id) => used.add(id));
    if (v.work) works.add(v.work);
  });

  const usedByTopic = new Map();
  used.forEach((id) => {
    const topic = topicOf.get(id);
    if (topic) inc(usedByTopic, topic);
  });

  const solveByTopic = new Map();
  let answers = 0;
  let correct = 0;
  let measured = 0;
  Object.entries(statsByTask || {}).forEach(([id, s]) => {
    if (!s || !s.n) return;
    answers += s.n;
    correct += s.c;
    measured += 1;
    const topic = topicOf.get(id);
    if (!topic) return;
    const t = solveByTopic.get(topic) || { c: 0, n: 0 };
    t.c += s.c;
    t.n += s.n;
    solveByTopic.set(topic, t);
  });

  return {
    usedTasks: used.size,
    usedIds: used,
    works: works.size,
    usedByTopic,
    solveByTopic,
    answers,
    correct,
    measured,
    rate: answers ? correct / answers : null,
  };
}

/** Доля 0..1 или null, если делить не на что. */
export const share = (part, total) => (total ? part / total : null);

/**
 * Покрытие экзамена: строка на номер задания (архивные темы — нет).
 * flags — Map тема → число задач без ответа / без решения / с битым LaTeX.
 */
export function examCoverage({ topics, examType, counts, flags = {}, usage = null }) {
  const noAnswer = flags.noAnswer || new Map();
  const noSolution = flags.noSolution || new Map();
  const review = flags.review || new Map();

  return topics
    .filter((t) => t.exam_type === examType && !t.archived)
    .sort((a, b) => (Number(a.ege_number) || 999) - (Number(b.ege_number) || 999)
      || (a.order || 0) - (b.order || 0))
    .map((t) => {
      const count = counts.byTopic.get(t.id) || 0;
      const solve = usage?.solveByTopic.get(t.id) || { c: 0, n: 0 };
      return {
        key: t.id,
        topicId: t.id,
        number: t.ege_number || null,
        part: t.exam_part || null,
        title: t.title,
        count,
        answerShare: share(count - (noAnswer.get(t.id) || 0), count),
        solutionShare: share(count - (noSolution.get(t.id) || 0), count),
        review: review.get(t.id) || 0,
        used: usage ? (usage.usedByTopic.get(t.id) || 0) : null,
        solve: solve.n ? { ...solve, rate: solve.c / solve.n } : null,
        level: count === 0 ? 'empty' : count < THIN_TOPIC ? 'thin' : 'ok',
      };
    });
}

/** Итог по экзамену для подписи вкладки: тем, задач, пустых и тонких. */
export function coverageSummary(rows) {
  return {
    topics: rows.length,
    tasks: rows.reduce((s, r) => s + r.count, 0),
    empty: rows.filter((r) => r.level === 'empty').length,
    thin: rows.filter((r) => r.level === 'thin').length,
    unused: rows.filter((r) => r.count > 0 && r.used === 0).length,
  };
}

/**
 * Задачи, на которых чаще всего ошибаются: решаемость по ≥ minN ответам,
 * от худшей. taskById — Map id → задача снимка (нужны код и тема).
 */
export function hardestTasks(statsByTask = {}, taskById = new Map(), { minN = MIN_SOLVE_N, limit = 8 } = {}) {
  return Object.entries(statsByTask)
    .filter(([id, s]) => s && s.n >= minN && taskById.has(id))
    .map(([id, s]) => ({ id, c: s.c, n: s.n, rate: s.c / s.n, task: taskById.get(id) }))
    .sort((a, b) => a.rate - b.rate || b.n - a.n)
    .slice(0, limit);
}
