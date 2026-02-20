/**
 * Fisher-Yates shuffle — корректная случайная перестановка массива.
 * Возвращает новый массив, не мутируя исходный.
 * @param {Array} array
 * @returns {Array}
 */
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
