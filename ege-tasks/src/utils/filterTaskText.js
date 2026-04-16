/**
 * Список типовых фраз для удаления из начала условия задач.
 * Длинные фразы идут первыми, чтобы матчились раньше коротких.
 *
 * Примечание: мягкие переносы (­) автоматически удаляются при сравнении,
 * поэтому нет необходимости дублировать фразы.
 */
const PREFIXES_TO_REMOVE = [
  'Найдите значение выражения ',
  'Найдите значение выражения',
  'Найдите корень уравнения: ',
  'Найдите корень уравнения ',
  'Найдите корень уравнения',
  'Найдите частное от деления ',
  'Найдите частное от деления',
  'Найдите произведение чисел ',
  'Найдите произведение чисел',
  'Вычислите произведение: ',
  'Вычислите произведение',
  'Найдите сумму чисел ',
  'Найдите сумму чисел',
  'Решите уравнение: ',
  'Решите уравнение ',
  'Решите уравнение',
  'Сложите дроби: ',
  'Сложите дроби',
  'Вычислите: ',
  'Вычислите',
  'Найдите: ',
  'Найдите',
  'Упростите выражение: ',
  'Упростите выражение',
  'Упростите: ',
  'Упростите',
  'Решите: ',
  'Решите',
  'Определите: ',
  'Определите',
];

/**
 * Удаляет мягкие переносы из текста для нормализации.
 * @param {string} text — текст
 * @returns {string} — текст без мягких переносов
 */
function removeSoftHyphens(text) {
  return text.replace(/\u00AD/g, '');
}

/**
 * Удаляет типовые фразы из начала текста задачи.
 * @param {string} text — текст условия задачи
 * @returns {string} — текст без типовой фразы в начале
 */
export function filterTaskText(text) {
  if (!text) return text;

  // Нормализуем текст: удаляем мягкие переносы
  const normalizedText = removeSoftHyphens(text);

  for (const prefix of PREFIXES_TO_REMOVE) {
    const normalizedPrefix = removeSoftHyphens(prefix);

    if (normalizedText.startsWith(normalizedPrefix)) {
      // Находим конец префикса в оригинальном тексте
      // Проходим по символам оригинального текста, пока не наберём normalizedPrefix
      let originalIndex = 0;
      let normalizedCount = 0;

      while (originalIndex < text.length && normalizedCount < normalizedPrefix.length) {
        if (text.charCodeAt(originalIndex) !== 0x00AD) {
          normalizedCount++;
        }
        originalIndex++;
      }

      // Получаем текст без префикса
      let result = text.substring(originalIndex).trim();

      // Удаляем оставшиеся двоеточия и пробелы в начале
      result = result.replace(/^[:\s]+/, '').trim();

      return result;
    }
  }

  return text;
}
