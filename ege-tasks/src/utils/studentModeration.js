// Чистая логика панели модерации учеников: нормализация полей профиля,
// проверка логина, разбор изменений и подбор telegram_id по журналу «Решу ЕГЭ».
// Без React и сети — покрыта тестами (`__tests__/studentModeration.test.js`).

/** Ключ имени: регистр и порядок слов не важны («Сергеева Яна» = «Яна Сергеева»). */
export function studentNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[\s.,]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Telegram ID — числовой идентификатор пользователя (по нему сходятся внешние
 * результаты «Решу ЕГЭ»). Принимаем «@user», «t.me/user», «id: 123» — из этого
 * вытаскиваем цифры; если цифр нет, отдаём очищенную строку и флаг сомнения.
 */
export function normalizeTelegramId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { value: '', looksNumeric: true, hint: '' };
  const digits = raw.replace(/\D+/g, '');
  if (digits && digits.length >= 5) {
    return { value: digits, looksNumeric: true, hint: '' };
  }
  const cleaned = raw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
  return {
    value: cleaned,
    looksNumeric: false,
    hint: 'Похоже на имя пользователя, а не на числовой ID — результаты «Решу ЕГЭ» сходятся по числовому.',
  };
}

/** Логин ученика: латиница, цифры, точка, дефис, подчёркивание; 3–50 символов. */
export function validateUsername(username, { taken = [] } = {}) {
  const value = String(username ?? '').trim();
  if (!value) return 'Логин обязателен';
  if (value.length < 3) return 'Логин короче 3 символов';
  if (value.length > 50) return 'Логин длиннее 50 символов';
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    return 'Только латиница, цифры и символы . _ -';
  }
  if (taken.some((t) => String(t).toLowerCase() === value.toLowerCase())) {
    return 'Такой логин уже занят';
  }
  return '';
}

export const PROFILE_LABELS = {
  name: 'Имя',
  username: 'Логин',
  student_class: 'Класс',
  teaching_group: 'Группа',
  telegram_id: 'Telegram ID',
  status: 'Статус',
  grad_year: 'Год выпуска',
  owner: 'Учитель',
  external: 'Тип аккаунта',
};

/**
 * Что изменилось в профиле: только реально отличающиеся поля.
 * Пустая строка и undefined считаются одним и тем же «пусто» — иначе
 * нетронутая форма выглядела бы как правка.
 */
export function profileDiff(before = {}, after = {}) {
  const out = [];
  for (const field of Object.keys(PROFILE_LABELS)) {
    if (!(field in after)) continue;
    const from = before[field] ?? '';
    const to = after[field] ?? '';
    const same = String(from) === String(to)
      || (from === false && to === '') || (from === '' && to === false);
    if (!same) out.push({ field, label: PROFILE_LABELS[field], from, to });
  }
  return out;
}

/**
 * Кандидаты на telegram_id из внешнего журнала «Решу ЕГЭ».
 * Сначала совпавшие по имени, затем остальные свободные id — учитель
 * сопоставляет вручную, когда в журнале ученик записан иначе.
 *
 * @param {object} p
 * @param {object} p.student — { name }
 * @param {Array}  p.extRows — строки ext_journal_results ({ student_name, telegram_id, group_name })
 * @param {Array}  p.takenIds — telegram_id, уже занятые другими учениками
 */
export function suggestTelegramMatches({ student, extRows = [], takenIds = [] } = {}) {
  const taken = new Set(takenIds.map((t) => String(t)).filter(Boolean));
  const byId = new Map();
  for (const row of extRows) {
    const id = String(row?.telegram_id || '').trim();
    if (!id || taken.has(id)) continue;
    if (!byId.has(id)) {
      byId.set(id, { telegramId: id, names: new Set(), groups: new Set() });
    }
    const entry = byId.get(id);
    if (row.student_name) entry.names.add(row.student_name);
    if (row.group_name) entry.groups.add(row.group_name);
  }

  const key = studentNameKey(student?.name);
  const surname = String(student?.name || '').toLowerCase().split(/\s+/).filter(Boolean)[0] || '';

  return Array.from(byId.values())
    .map((entry) => {
      const names = Array.from(entry.names);
      const exact = names.some((n) => studentNameKey(n) === key && key);
      const partial = !exact && !!surname && names.some(
        (n) => studentNameKey(n).split(' ').includes(surname),
      );
      return {
        telegramId: entry.telegramId,
        names,
        groups: Array.from(entry.groups),
        match: exact ? 'exact' : (partial ? 'partial' : 'none'),
      };
    })
    .sort((a, b) => {
      const rank = { exact: 0, partial: 1, none: 2 };
      if (rank[a.match] !== rank[b.match]) return rank[a.match] - rank[b.match];
      return (a.names[0] || '').localeCompare(b.names[0] || '', 'ru');
    });
}

export const BULK_ACTIONS = {
  GROUP: 'group',       // перевести в группу
  STATUS: 'status',     // сменить статус (учится / выпустился / выбыл)
  OWNER: 'owner',       // передать другому учителю
  CLASS: 'class',       // проставить класс строкой
};

/**
 * Сводка массовой операции: что реально изменится, а что уже и так такое.
 * Возвращает { changed: [...], skipped: [...], text }.
 */
export function bulkSummary(students = [], action, value, { groupNames = {}, teacherNames = {} } = {}) {
  const field = {
    [BULK_ACTIONS.GROUP]: 'teaching_group',
    [BULK_ACTIONS.STATUS]: 'status',
    [BULK_ACTIONS.OWNER]: 'owner',
    [BULK_ACTIONS.CLASS]: 'student_class',
  }[action];
  if (!field) return { changed: [], skipped: students, text: 'Неизвестная операция' };

  const norm = (v) => String(v ?? '') || (field === 'status' ? 'active' : '');
  const changed = [];
  const skipped = [];
  for (const s of students) {
    if (norm(s[field]) === norm(value)) skipped.push(s);
    else changed.push(s);
  }

  const target = {
    [BULK_ACTIONS.GROUP]: value ? (groupNames[value] || 'другую группу') : 'без группы',
    [BULK_ACTIONS.STATUS]: { active: 'учится', graduated: 'выпустился', left: 'выбыл' }[value] || value,
    [BULK_ACTIONS.OWNER]: value ? (teacherNames[value] || 'другого учителя') : 'без учителя',
    [BULK_ACTIONS.CLASS]: value ? `класс «${value}»` : 'пустой класс',
  }[action];

  const verb = {
    [BULK_ACTIONS.GROUP]: 'Перевести в',
    [BULK_ACTIONS.STATUS]: 'Поставить статус',
    [BULK_ACTIONS.OWNER]: 'Передать',
    [BULK_ACTIONS.CLASS]: 'Проставить',
  }[action];

  const text = changed.length
    ? `${verb} ${target}: ${changed.length} чел.`
      + (skipped.length ? ` (${skipped.length} уже так)` : '')
    : 'Изменений не будет — у всех выбранных уже так';

  return { changed, skipped, text };
}
