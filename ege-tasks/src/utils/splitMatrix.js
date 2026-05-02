/**
 * Разбивает полную матрицу пиксель-арта на tileCount×tileCount равных плиток.
 *
 * Плитки нумеруются row-major: (0,0)=0, (0,1)=1, ..., (1,0)=tileCount, ...
 *
 * Требование: полная матрица должна быть квадратной и её размер должен быть
 * кратен tileCount. Если условие не выполнено — матрица обрезается по ближайшему
 * кратному значению.
 *
 * @param {boolean[][]} matrix     - Полная матрица (rows × cols, rows == cols рекомендуется)
 * @param {number}      tileCount  - Количество плиток на сторону (2, 3 или 4)
 * @returns {boolean[][][]}         - Массив из tileCount² подматриц
 */
export function splitMatrix(matrix, tileCount) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  // Размер одной плитки (обрезаем до кратного)
  const tileH = Math.floor(rows / tileCount);
  const tileW = Math.floor(cols / tileCount);

  const tiles = [];
  for (let tr = 0; tr < tileCount; tr++) {
    for (let tc = 0; tc < tileCount; tc++) {
      const rowStart = tr * tileH;
      const colStart = tc * tileW;
      const tile = [];
      for (let r = rowStart; r < rowStart + tileH; r++) {
        const row = [];
        for (let c = colStart; c < colStart + tileW; c++) {
          row.push(matrix[r]?.[c] ?? false);
        }
        tile.push(row);
      }
      tiles.push(tile);
    }
  }
  return tiles;
}

/**
 * Вычисляет оптимальный размер квадратной сетки, кратный tileCount.
 * Используется при выборе gridCols/gridRows при загрузке изображения.
 *
 * @param {number} targetSize  - Желаемый размер (например 30)
 * @param {number} tileCount   - Количество плиток на сторону
 * @returns {number}           - Ближайший кратный tileCount размер (≥ tileCount*3)
 */
export function snapToTileCount(targetSize, tileCount) {
  const min = tileCount * 3; // минимум 3 клетки на плитку
  const snapped = Math.max(min, Math.round(targetSize / tileCount) * tileCount);
  return snapped;
}
