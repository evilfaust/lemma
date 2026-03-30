/**
 * Определение служебных зон QR-кода.
 *
 * В QR-коде есть три типа структурных зон, не несущих данных:
 *  - finder    — три поисковых квадрата 7×7 + разделители (углы)
 *  - timing    — тайминговые полосы (строка 6 и столбец 6)
 *  - format    — маска формата (вокруг поисковых квадратов)
 *
 * Все функции принимают size — сторона QR-матрицы (21, 25, 29 …).
 * Возвращают Set строк вида "r,c".
 */

/**
 * Поисковые квадраты + разделители (3 угла, 8×8 каждый).
 * Top-left: (0-7, 0-7)
 * Top-right: (0-7, size-8 … size-1)
 * Bottom-left: (size-8 … size-1, 0-7)
 */
export function getFinderZone(size) {
  const cells = new Set();
  const addRect = (r0, c0, r1, c1) => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        cells.add(`${r},${c}`);
  };
  addRect(0, 0, 7, 7);                       // top-left
  addRect(0, size - 8, 7, size - 1);         // top-right
  addRect(size - 8, 0, size - 1, 7);         // bottom-left
  return cells;
}

/**
 * Тайминговые полосы — чередующиеся чёрно-белые полосы по строке 6 и столбцу 6
 * между поисковыми квадратами.
 */
export function getTimingZone(size) {
  const cells = new Set();
  for (let c = 8; c <= size - 9; c++) cells.add(`6,${c}`);   // горизонтальная
  for (let r = 8; r <= size - 9; r++) cells.add(`${r},6`);   // вертикальная
  return cells;
}

/**
 * Маска формата — ячейки, хранящие информацию об уровне коррекции и маске данных.
 * Располагается вплотную к поисковым квадратам:
 *   - строка 8 и столбец 8 вблизи top-left (cols/rows 0-8)
 *   - строка 8 вблизи top-right (cols size-8 … size-1)
 *   - столбец 8 вблизи bottom-left (rows size-8 … size-1)
 */
export function getFormatZone(size) {
  const cells = new Set();
  // Вокруг top-left
  for (let c = 0; c <= 8; c++) cells.add(`8,${c}`);
  for (let r = 0; r <= 8; r++) cells.add(`${r},8`);
  // Вокруг top-right
  for (let c = size - 8; c <= size - 1; c++) cells.add(`8,${c}`);
  // Вокруг bottom-left
  for (let r = size - 8; r <= size - 1; r++) cells.add(`${r},8`);
  return cells;
}

/**
 * Вычисляет тип зоны для конкретной ячейки.
 * Приоритет: finder > timing > format > null
 *
 * @param {number} r  — строка
 * @param {number} c  — столбец
 * @param {number} size — размер матрицы
 * @param {object} [cache] — необязательный кеш { finder, timing, format } уже построенных Set-ов
 * @returns {'finder'|'timing'|'format'|null}
 */
export function getCellZone(r, c, size, cache = null) {
  const key = `${r},${c}`;
  const finder  = cache?.finder  ?? getFinderZone(size);
  const timing  = cache?.timing  ?? getTimingZone(size);
  const format  = cache?.format  ?? getFormatZone(size);
  if (finder.has(key))  return 'finder';
  if (timing.has(key))  return 'timing';
  if (format.has(key))  return 'format';
  return null;
}

/**
 * Создаёт кеш всех трёх зон для данного размера — чтобы не пересчитывать на каждую ячейку.
 */
export function buildZoneCache(size) {
  return {
    finder: getFinderZone(size),
    timing: getTimingZone(size),
    format: getFormatZone(size),
  };
}
