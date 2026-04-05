/**
 * Заполняет QR-матрицу числами.
 *
 * Правило:
 *  - чёрный модуль (true)  → случайное число из набора ответов
 *  - белый модуль (false)  → «шумовое» число, НЕ входящее в набор ответов
 *
 * Когда ученик закрашивает все клетки с числами-ответами,
 * он получает правильный QR-паттерн.
 *
 * @param {boolean[][]} matrix - QR-матрица (true = чёрный)
 * @param {number[]} answers   - правильные числовые ответы на задания
 * @returns {{ value: number, isAnswer: boolean }[][]}
 */
export function fillQRGrid(matrix, answers) {
  const answerNums = answers.map(Number).filter(n => !isNaN(n));
  if (answerNums.length === 0) {
    // Нет ответов — заполнить случайными числами без смысла
    return matrix.map(row => row.map(() => ({ value: Math.floor(Math.random() * 90) + 10, isAnswer: false })));
  }

  const answerSet = new Set(answerNums);
  const matRows = matrix.length;
  const matCols = matrix[0]?.length || matRows;
  const totalCells = matRows * matCols;

  const noise = generateNoise(answerSet, totalCells);
  let noiseIdx = 0;

  return matrix.map(row =>
    row.map(isBlack => {
      if (isBlack) {
        // Случайный ответ из набора
        const val = answerNums[Math.floor(Math.random() * answerNums.length)];
        return { value: val, isAnswer: true };
      } else {
        return { value: noise[noiseIdx++], isAnswer: false };
      }
    })
  );
}

/**
 * Генерирует массив «шумовых» чисел, не пересекающихся с answerSet.
 * Числа берутся из диапазона, близкого к ответам, чтобы выглядеть правдоподобно.
 *
 * @param {Set<number>} answerSet
 * @param {number} count - сколько шумовых чисел нужно
 * @returns {number[]}
 */
function generateNoise(answerSet, count) {
  const answers = [...answerSet];
  const minVal = Math.min(...answers);
  const maxVal = Math.max(...answers);
  const range = Math.max(maxVal - minVal, 20);

  const lo = Math.floor(minVal - range * 0.6);
  const hi = Math.ceil(maxVal + range * 0.6);

  // Собираем пул кандидатов
  const pool = [];
  for (let n = lo; n <= hi; n++) {
    if (!answerSet.has(n)) pool.push(n);
  }

  // Если пул слишком мал — расширяем диапазон
  if (pool.length < 10) {
    for (let n = hi + 1; n <= hi + 100; n++) {
      if (!answerSet.has(n)) pool.push(n);
    }
    for (let n = lo - 1; n >= lo - 100; n--) {
      if (!answerSet.has(n)) pool.push(n);
    }
  }

  // Перемешиваем пул
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Зацикливаем если нужно больше чисел, чем в пуле
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}
