/**
 * Экранирует строку для использования в фильтрах PocketBase.
 * Предотвращает инъекцию через спецсимволы в пользовательском вводе.
 *
 * @param {*} value — значение для экранирования
 * @returns {string}
 */
export function escapeFilter(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
