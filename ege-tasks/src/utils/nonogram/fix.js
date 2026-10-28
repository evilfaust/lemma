/**
 * Что делать с картинкой, которая не решается логикой однозначно.
 *
 * Два пути (решение 29.10.2026, NONOGRAM_PLAN.md):
 *  - `suggestGivens` — готовые клетки: несколько клеток закрашены (или
 *    помечены пустыми) заранее, рисунок не искажается. Путь по умолчанию;
 *  - `suggestFlips` — «подправить картинку»: переключить пару пикселей, пока
 *    рисунок не станет решаемым.
 */
import { cluesOf, solveNonogram, startGrid, UNKNOWN } from './solver';

/** Неизвестные клетки сетки решателя. */
function unknownCells(grid) {
  const out = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === UNKNOWN) out.push({ r, c }); }));
  return out;
}

/** Равномерная выборка: каждая k-я клетка, без случайности — результат повторяем. */
function sampleOf(cells, n) {
  if (cells.length <= n) return cells;
  const step = cells.length / n;
  return Array.from({ length: n }, (_, i) => cells[Math.floor(i * step)]);
}

/**
 * Минимум готовых клеток, после которых решатель доходит до конца.
 * Жадно: на каждом шаге открывается клетка, после которой логика продвигается
 * дальше всего; закрашенная клетка при равенстве лучше пустой — на листе её
 * видно сразу. `limit` — потолок числа клеток.
 *
 * Возвращает `{ givens: [{r, c, v}], result }` — result решателя с ними.
 */
export function suggestGivens(matrix, { limit = 40, keep = [], sample = 90 } = {}) {
  const clues = cluesOf(matrix);
  const R = matrix.length;
  const C = matrix[0]?.length ?? 0;
  const givens = keep.filter(g => g.r < R && g.c < C && Boolean(matrix[g.r][g.c]) === Boolean(g.v));
  let result = solveNonogram(clues, startGrid(R, C, givens));
  while (result.status === 'stuck' && givens.length < limit) {
    let best = null;
    // На большой сетке пробуем не все неизвестные клетки, а выборку:
    // жадному выбору хватает, а 20×20 иначе считается секундами.
    for (const { r, c } of sampleOf(unknownCells(result.grid), sample)) {
      const v = matrix[r][c] ? 1 : 0;
      const trial = result.grid.map(row => row.slice());
      trial[r][c] = v;
      const res = solveNonogram(clues, trial);
      const score = res.known + (v ? 0.5 : 0);
      if (!best || score > best.score) best = { r, c, v, res, score };
    }
    if (!best) break;
    givens.push({ r: best.r, c: best.c, v: best.v });
    result = best.res;
  }
  return { givens, result };
}

/**
 * «Подправить картинку»: переключать по пикселю, пока рисунок не решится
 * логикой без готовых клеток. Кандидаты — неизвестные клетки застрявшего
 * решения (меняется только то, что и так неоднозначно). `maxFlips` — потолок.
 *
 * Возвращает `{ matrix, flips: [{r, c}], result }`; если не удалось — status
 * у result остаётся `stuck`, matrix — лучший найденный вариант.
 */
export function suggestFlips(matrix, { maxFlips = 8, sample = 60 } = {}) {
  let current = matrix.map(row => row.slice());
  let result = solveNonogram(cluesOf(current));
  const flips = [];
  while (result.status !== 'unique' && flips.length < maxFlips) {
    let best = null;
    for (const { r, c } of sampleOf(unknownCells(result.grid), sample)) {
      const trial = current.map(row => row.slice());
      trial[r][c] = !trial[r][c];
      const res = solveNonogram(cluesOf(trial));
      if (res.status === 'contradiction') continue;
      if (!best || res.known > best.res.known) best = { r, c, res, trial };
    }
    if (!best || best.res.known <= result.known) break;
    current = best.trial;
    flips.push({ r: best.r, c: best.c });
    result = best.res;
  }
  return { matrix: current, flips, result };
}

/** Готовая клетка для печати: закрашенная — залита, пустая — с точкой. */
export function givenAt(givens, r, c) {
  return givens.find(g => g.r === r && g.c === c) || null;
}
