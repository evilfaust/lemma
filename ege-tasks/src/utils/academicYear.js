// Учебный год как строка «2025/2026».
//
// Отдельной сущности «учебный год» в базе нет — год живёт строкой в
// `teaching_groups.year` (и её копией в `group_memberships.year`), а список
// доступных лет собирается из самих групп. Этот модуль — единственное место,
// где знают формат года, границу «сентябрь = новый год» и порядок сортировки.

// С августа считаем, что начался следующий учебный год: расписание и группы
// заводят до 1 сентября.
const NEW_YEAR_FROM_MONTH = 7; // 0-based, 7 = август

/** Учебный год, которому принадлежит дата: «2025/2026». */
export function academicYearOf(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const start = d.getMonth() >= NEW_YEAR_FROM_MONTH ? y : y - 1;
  return `${start}/${start + 1}`;
}

/** Текущий учебный год. */
export function currentAcademicYear() {
  return academicYearOf(new Date());
}

/** Год начала («2025/2026» → 2025) либо null, если строка не разбирается. */
export function parseAcademicYear(year) {
  const m = String(year ?? '').match(/(\d{4})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1900 && n <= 2999 ? n : null;
}

export function isValidAcademicYear(year) {
  return /^\d{4}\/\d{4}$/.test(String(year ?? '').trim());
}

/**
 * Привести к канону «2025/2026». Понимает «2025-2026», «2025/26», «2025 26»,
 * «2025». Возвращает '' для неразбираемого — вызывающий решает, что делать.
 */
export function normalizeAcademicYear(value) {
  const start = parseAcademicYear(value);
  return start ? `${start}/${start + 1}` : '';
}

/** Следующий учебный год: «2025/2026» → «2026/2027». */
export function nextAcademicYear(year = currentAcademicYear()) {
  const start = parseAcademicYear(year);
  return start ? `${start + 1}/${start + 2}` : '';
}

/** Предыдущий учебный год: «2025/2026» → «2024/2025». */
export function prevAcademicYear(year = currentAcademicYear()) {
  const start = parseAcademicYear(year);
  return start ? `${start - 1}/${start}` : '';
}

/** Сравнение для сортировки по возрастанию; неразбираемые уходят в конец. */
export function compareAcademicYears(a, b) {
  const x = parseAcademicYear(a);
  const y = parseAcademicYear(b);
  if (x === null && y === null) return String(a ?? '').localeCompare(String(b ?? ''));
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
}

/** Уникальные годы списка групп (или строк), новые сверху. */
export function collectAcademicYears(groupsOrYears = []) {
  const years = new Set();
  for (const item of groupsOrYears) {
    const y = typeof item === 'string' ? item : item?.year;
    if (y) years.add(String(y).trim());
  }
  return Array.from(years).sort((a, b) => compareAcademicYears(b, a));
}

/**
 * 1 сентября года начала — дата зачисления по умолчанию.
 * Возвращает строку в формате PocketBase; '' если год не разобрался.
 */
export function academicYearStartDate(year) {
  const start = parseAcademicYear(year);
  return start ? `${start}-09-01 00:00:00.000Z` : '';
}
