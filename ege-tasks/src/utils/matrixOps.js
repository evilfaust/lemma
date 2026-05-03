/**
 * Постобработка булевых матриц пиксель-арта.
 * Все функции возвращают новую матрицу, не изменяя исходную.
 *
 * true  = тёмная клетка (закрашена)
 * false = светлая клетка (пустая)
 */

const rows = (m) => m.length;
const cols = (m) => m[0]?.length || 0;
const get  = (m, r, c) => r >= 0 && r < rows(m) && c >= 0 && c < cols(m) ? m[r][c] : false;

function darkNeighborCount(m, r, c) {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && get(m, r + dr, c + dc)) n++;
  return n;
}

/** Удаляет изолированные тёмные клетки: меньше 2 тёмных 8-соседей → белая. */
export function removeNoise(matrix) {
  return matrix.map((row, r) =>
    row.map((cell, c) => cell && darkNeighborCount(matrix, r, c) >= 2)
  );
}

/** Закрывает белые «дырки»: 6+ тёмных 8-соседей → тёмная. */
export function closeHoles(matrix) {
  return matrix.map((row, r) =>
    row.map((cell, c) => cell || darkNeighborCount(matrix, r, c) >= 6)
  );
}

/** Утолщает: расширяет каждую тёмную клетку на 4 ортогональных соседа (дилатация). */
export function thicken(matrix) {
  const R = rows(matrix), C = cols(matrix);
  const out = matrix.map(row => [...row]);
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (matrix[r][c])
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < R && nc >= 0 && nc < C) out[nr][nc] = true;
        }
  return out;
}

/** Сглаживает края: тёмная клетка с менее чем 3 тёмными соседями → белая. */
export function smooth(matrix) {
  return matrix.map((row, r) =>
    row.map((cell, c) => cell && darkNeighborCount(matrix, r, c) >= 3)
  );
}

/** Инвертирует: меняет тёмные и светлые клетки местами. */
export function invertMatrix(matrix) {
  return matrix.map(row => row.map(cell => !cell));
}
