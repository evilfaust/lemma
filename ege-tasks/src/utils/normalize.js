/**
 * Нормализация строки для поиска дубликатов по названию.
 */
export function normalizeLabel(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

/**
 * Строгая нормализация условия задачи (точное совпадение текста).
 */
export function normalizeStatementStrict(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

/**
 * Агрессивная нормализация условия задачи (убирает пунктуацию, пробелы, LaTeX).
 */
export function normalizeStatementLoose(value) {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/[.,:;!?'"`~()\[\]{}<>—–-]/g, '')
    .replace(/\$/g, '')
    .replace(/\\/g, '');
}
