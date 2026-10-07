// Выбор работы для урока (окно вместо длинного селекта, v3.9.320).
//
// Чистая логика: из работ, тестов и работ по геометрии собирается единый
// список, раскладывается по разделам (недавние, закреплённые, папки, тесты,
// геометрия, работы каникулярных программ) и фильтруется поиском и классом
// урока. Значение пункта — то же, что у прежнего селекта: id работы,
// `testOption(id)` или `geoOption(id)`.

import { testOption, geoOption } from './lessonMaterials';

export const RECENT_LIMIT = 15;
export const NO_FOLDER = '__none__';

const FOLDER_PREFIX = 'folder:';
export const folderSection = (name) => `${FOLDER_PREFIX}${name}`;

/** Регистр, «ё», лишние пробелы — поиск по словам в любом порядке. */
export const normalizeQuery = (s) => String(s || '')
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/\s+/g, ' ')
  .trim();

const dateOf = (rec) => {
  const t = Date.parse(rec?.updated || rec?.created || '');
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Пункты окна. `programWorkIds` — работы, созданные каникулярными
 * программами (по одной на ученика и тему): по названию их не узнать
 * («Каникулы · …», «Лето · …»), поэтому признак берётся из самих программ.
 */
export function buildPickerItems({
  works = [], tests = [], geoWorks = [],
  workSessions = {}, testSessions = {}, programWorkIds = new Set(),
} = {}) {
  const items = [];
  works.forEach((w) => {
    items.push({
      value: w.id,
      kind: 'work',
      title: w.title || 'Без названия',
      date: dateOf(w),
      folder: (w.folder || '').trim(),
      pinned: !!w.is_pinned,
      program: programWorkIds.has(w.id),
      grade: w.class != null && w.class !== '' ? String(w.class) : '',
      topic: w.expand?.topic?.title || '',
      issued: (workSessions[w.id] || []).length,
    });
  });
  tests.forEach((t) => {
    items.push({
      value: testOption(t.id),
      kind: 'test',
      title: t.title || 'Тест',
      date: dateOf(t),
      folder: '',
      pinned: false,
      program: false,
      grade: '',
      topic: '',
      issued: (testSessions[t.id] || []).length,
    });
  });
  geoWorks.forEach((g) => {
    items.push({
      value: geoOption(g.id),
      kind: 'geo',
      title: g.title || 'Работа по геометрии',
      date: dateOf(g),
      folder: '',
      pinned: false,
      program: false,
      grade: g.class != null && g.class !== '' ? String(g.class) : '',
      topic: '',
      issued: 0,
    });
  });
  return items;
}

/** Подходит ли пункт классу урока. У теста класса нет — подходит всегда. */
export const fitsGrade = (item, grade) => !grade || !item.grade || item.grade === String(grade);

const inSection = (item, section) => {
  if (section === 'pinned') return item.pinned && !item.program;
  if (section === 'tests') return item.kind === 'test';
  if (section === 'geo') return item.kind === 'geo';
  if (section === 'program') return item.program;
  if (section === NO_FOLDER) return item.kind === 'work' && !item.program && !item.folder;
  if (section?.startsWith(FOLDER_PREFIX)) {
    return item.kind === 'work' && !item.program && item.folder === section.slice(FOLDER_PREFIX.length);
  }
  return true;
};

const byDate = (a, b) => b.date - a.date || a.title.localeCompare(b.title, 'ru');

const recentOf = (items) => items
  .filter((it) => !it.program)
  .sort(byDate)
  .slice(0, RECENT_LIMIT);

/**
 * Разделы левой колонки с числом пунктов (с учётом класса). Пустые разделы
 * не показываются, кроме «Недавних».
 */
export function pickerSections(items, { grade = '' } = {}) {
  const visible = items.filter((it) => fitsGrade(it, grade));
  const count = (section) => visible.filter((it) => inSection(it, section)).length;
  const folders = [...new Set(visible
    .filter((it) => it.kind === 'work' && !it.program && it.folder)
    .map((it) => it.folder))]
    .sort((a, b) => a.localeCompare(b, 'ru'));

  const sections = [
    { key: 'recent', label: 'Недавние', count: recentOf(visible).length },
    { key: 'pinned', label: 'Закреплённые', count: count('pinned') },
    ...folders.map((f) => ({ key: folderSection(f), label: f, count: count(folderSection(f)), folder: true })),
    { key: NO_FOLDER, label: folders.length ? 'Без папки' : 'Работы', count: count(NO_FOLDER) },
    { key: 'tests', label: 'Тесты', count: count('tests') },
    { key: 'geo', label: 'Работы по геометрии', count: count('geo') },
    { key: 'program', label: 'Каникулярные программы', count: count('program') },
  ];
  return sections.filter((s) => s.key === 'recent' || s.count > 0);
}

/**
 * Пункты справа. С запросом поиск идёт по ВСЕМ разделам (название, папка,
 * тема), слова — в любом порядке. `hiddenByGrade` — сколько найдено бы ещё
 * без фильтра по классу (подсказка «снять фильтр»).
 */
export function filterPickerItems(items, { section = 'recent', query = '', grade = '' } = {}) {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  const matches = (it) => {
    if (!words.length) return true;
    const hay = normalizeQuery(`${it.title} ${it.folder} ${it.topic}`);
    return words.every((w) => hay.includes(w));
  };

  if (words.length) {
    const found = items.filter(matches);
    const list = found.filter((it) => fitsGrade(it, grade))
      // своё — выше каникулярных персональных работ
      .sort((a, b) => Number(a.program) - Number(b.program) || byDate(a, b));
    return { items: list, hiddenByGrade: found.length - list.length };
  }

  const visible = items.filter((it) => fitsGrade(it, grade));
  if (section === 'recent') return { items: recentOf(visible), hiddenByGrade: 0 };
  const list = visible.filter((it) => inSection(it, section)).sort(byDate);
  const all = items.filter((it) => inSection(it, section)).length;
  return { items: list, hiddenByGrade: all - list.length };
}

/** Раздел, в котором лежит пункт (открыть окно там, где выбранная работа). */
export function sectionOfValue(items, value) {
  const it = items.find((x) => x.value === value);
  if (!it) return null;
  if (it.kind === 'test') return 'tests';
  if (it.kind === 'geo') return 'geo';
  if (it.program) return 'program';
  if (it.pinned) return 'pinned';
  return it.folder ? folderSection(it.folder) : NO_FOLDER;
}
