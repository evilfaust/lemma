/**
 * Японский кроссворд (нонограмма): подсказки по картинке и решатель.
 *
 * Клетка решателя: -1 — неизвестна, 0 — пустая, 1 — закрашена.
 * Картинка (`matrix`) — boolean[][], как у пиксель-арта (`utils/imageToMatrix`).
 *
 * Решатель — «по строкам»: строка решается целиком по своей подсказке
 * (клетка закрашена во всех расстановках блоков — значит, закрашена), строки и
 * столбцы чередуются до неподвижной точки. Перебора нет НАМЕРЕННО: ученик тоже
 * решает логикой, без угадывания. Поэтому «unique» здесь значит больше, чем
 * «решение одно»: рисунок выводится шаг за шагом.
 */

export const UNKNOWN = -1;
export const EMPTY = 0;
export const FILLED = 1;

/** Подсказка одной линии: длины подряд идущих закрашенных клеток. */
export function lineClue(line) {
  const out = [];
  let run = 0;
  for (const cell of line) {
    if (cell) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out;
}

/** Подсказки строк и столбцов картинки. Пустая линия — пустой массив («0»). */
export function cluesOf(matrix) {
  const rows = matrix.map(lineClue);
  const width = matrix[0]?.length ?? 0;
  const cols = [];
  for (let c = 0; c < width; c++) cols.push(lineClue(matrix.map(r => r[c])));
  return { rows, cols };
}

/** Сумма всех чисел подсказок строк (столбцов) — число закрашенных клеток. */
export function clueSum(lines) {
  return lines.reduce((s, line) => s + line.reduce((a, b) => a + b, 0), 0);
}

/**
 * Контрольная сумма листа: сумма чисел слева, сумма чисел сверху, закрашенных.
 * У верных подсказок все три равны — ученик проверяет себя ещё до рисования.
 */
export function checksum(clues) {
  return { rows: clueSum(clues.rows), cols: clueSum(clues.cols) };
}

/** Самое большое число подсказок и самая длинная подсказка (в числах). */
export function clueStats(clues) {
  const all = [...clues.rows, ...clues.cols];
  return {
    maxValue: Math.max(0, ...all.flat()),
    maxRowLen: Math.max(1, ...clues.rows.map(l => l.length)),
    maxColLen: Math.max(1, ...clues.cols.map(l => l.length)),
    count: all.reduce((s, l) => s + l.length, 0),
  };
}

/**
 * Решить одну линию. `cells` — массив -1/0/1, `clue` — длины блоков.
 * Возвращает новый массив (известное дополнено) или null — противоречие.
 */
export function solveLine(cells, clue) {
  const n = cells.length;
  const k = clue.length;
  // whites[i] — число пустых клеток среди первых i: блок не может их накрыть
  const whites = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) whites[i + 1] = whites[i] + (cells[i] === EMPTY ? 1 : 0);
  const noWhite = (a, b) => whites[b] - whites[a] === 0;

  // fit[i][j]: клетки i..n−1 можно закончить блоками j..k−1
  const W = k + 1;
  const fit = new Uint8Array((n + 1) * W);
  fit[n * W + k] = 1;
  const blockNext = (i, j) => {
    // куда ведёт блок j, поставленный с клетки i (или −1, если нельзя)
    const L = clue[j];
    const end = i + L;
    if (end > n || !noWhite(i, end)) return -1;
    if (end === n) return n;
    return cells[end] === FILLED ? -1 : end + 1;
  };
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      let ok = cells[i] !== FILLED && fit[(i + 1) * W + j];
      if (!ok && j < k) {
        const nx = blockNext(i, j);
        if (nx >= 0) ok = fit[nx * W + j + 1];
      }
      if (ok) fit[i * W + j] = 1;
    }
  }
  if (!fit[0 * W + 0]) return null;

  // Прямой проход по достижимым состояниям: что клетка может быть в решении
  const reach = new Uint8Array((n + 1) * W);
  reach[0] = 1;
  const canW = new Uint8Array(n);
  const blackDiff = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!reach[i * W + j] || !fit[i * W + j]) continue;
      if (cells[i] !== FILLED && fit[(i + 1) * W + j]) {
        canW[i] = 1;
        reach[(i + 1) * W + j] = 1;
      }
      if (j < k) {
        const nx = blockNext(i, j);
        if (nx >= 0 && fit[nx * W + j + 1]) {
          const end = i + clue[j];
          blackDiff[i]++;
          blackDiff[end]--;
          if (end < n) canW[end] = 1;
          reach[nx * W + j + 1] = 1;
        }
      }
    }
  }
  const out = cells.slice();
  let black = 0;
  for (let i = 0; i < n; i++) {
    black += blackDiff[i];
    const b = black > 0;
    const w = canW[i] === 1;
    if (b && !w) out[i] = FILLED;
    else if (w && !b) out[i] = EMPTY;
  }
  return out;
}

/** Пустая сетка решателя, с уже известными клетками `givens` ([{r, c, v}]). */
export function startGrid(rows, cols, givens = []) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(UNKNOWN));
  for (const g of givens) grid[g.r][g.c] = g.v ? FILLED : EMPTY;
  return grid;
}

/**
 * Решить нонограмму по подсказкам. `start` — сетка с известными клетками
 * (не меняется). Результат: `{ status, grid, passes, known }`:
 *  - `unique` — всё выведено логикой;
 *  - `stuck` — логика встала, часть клеток неизвестна;
 *  - `contradiction` — подсказки несовместны.
 * `passes` — число проходов «строки → столбцы», мера трудности.
 */
export function solveNonogram(clues, start = null) {
  const R = clues.rows.length;
  const C = clues.cols.length;
  const grid = start ? start.map(r => r.slice()) : startGrid(R, C);
  const rowDirty = new Array(R).fill(true);
  const colDirty = new Array(C).fill(true);
  let passes = 0;
  let changedAny = true;
  while (changedAny) {
    changedAny = false;
    let touched = false;
    for (let r = 0; r < R; r++) {
      if (!rowDirty[r]) continue;
      rowDirty[r] = false;
      const next = solveLine(grid[r], clues.rows[r]);
      if (!next) return { status: 'contradiction', grid, passes, known: countKnown(grid) };
      for (let c = 0; c < C; c++) {
        if (next[c] !== grid[r][c]) {
          grid[r][c] = next[c];
          colDirty[c] = true;
          touched = true;
        }
      }
    }
    for (let c = 0; c < C; c++) {
      if (!colDirty[c]) continue;
      colDirty[c] = false;
      const col = grid.map(row => row[c]);
      const next = solveLine(col, clues.cols[c]);
      if (!next) return { status: 'contradiction', grid, passes, known: countKnown(grid) };
      for (let r = 0; r < R; r++) {
        if (next[r] !== grid[r][c]) {
          grid[r][c] = next[r];
          rowDirty[r] = true;
          touched = true;
        }
      }
    }
    if (touched) { passes++; changedAny = rowDirty.some(Boolean) || colDirty.some(Boolean); }
  }
  const known = countKnown(grid);
  return { status: known === R * C ? 'unique' : 'stuck', grid, passes, known };
}

export function countKnown(grid) {
  let n = 0;
  for (const row of grid) for (const v of row) if (v !== UNKNOWN) n++;
  return n;
}

/**
 * Трудность по числу проходов, с поправкой на размер: сетке 15×15 нужно
 * больше проходов, чем 5×5, при той же «хитрости» рисунка.
 */
export const DIFFICULTY_LABELS = { easy: 'лёгкая', medium: 'средняя', hard: 'трудная' };

export function difficultyOf(result, size) {
  if (!result || result.status !== 'unique') return null;
  const scale = Math.max(1, size / 10);
  const p = result.passes / scale;
  if (p <= 3) return 'easy';
  if (p <= 6) return 'medium';
  return 'hard';
}
