import { describe, it, expect } from 'vitest';
import {
  lineClue, cluesOf, checksum, clueStats, solveLine, solveNonogram,
  startGrid, difficultyOf, UNKNOWN,
} from '../utils/nonogram/solver';
import { suggestGivens, suggestFlips } from '../utils/nonogram/fix';

const pic = (rows) => rows.map(s => [...s].map(ch => ch === '#'));
const U = UNKNOWN;

// Сердце 7×6 — классика, решается логикой
const HEART = pic([
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
]);

// Случайная картинка из сида — для свойств решателя
function randomPic(n, seed, density = 0.55) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() < density));
}

describe('подсказки', () => {
  it('блоки строки', () => {
    expect(lineClue([true, true, false, true])).toEqual([2, 1]);
    expect(lineClue([false, false])).toEqual([]);
    expect(lineClue([true, true, true])).toEqual([3]);
  });

  it('строки и столбцы сердца', () => {
    const { rows, cols } = cluesOf(HEART);
    expect(rows).toEqual([[2, 2], [7], [7], [5], [3], [1]]);
    expect(cols).toEqual([[2], [4], [5], [5], [5], [4], [2]]);
  });

  it('контрольная сумма: слева = сверху = закрашенных', () => {
    const clues = cluesOf(HEART);
    const filled = HEART.flat().filter(Boolean).length;
    expect(checksum(clues)).toEqual({ rows: filled, cols: filled });
  });

  it('статистика подсказок', () => {
    const st = clueStats(cluesOf(HEART));
    expect(st.maxValue).toBe(7);
    expect(st.maxRowLen).toBe(2);
    expect(st.maxColLen).toBe(1);
  });
});

describe('решение линии', () => {
  it('перекрытие: 3 в 5 клетках даёт середину', () => {
    expect(solveLine([U, U, U, U, U], [3])).toEqual([U, U, 1, U, U]);
  });

  it('полная линия и пустая линия', () => {
    expect(solveLine([U, U, U], [3])).toEqual([1, 1, 1]);
    expect(solveLine([U, U, U], [])).toEqual([0, 0, 0]);
    expect(solveLine([U, U, U], [1, 1])).toEqual([1, 0, 1]);
  });

  it('известная клетка сужает расстановки', () => {
    // блок 2, первая клетка закрашена → 1 1 0 0
    expect(solveLine([1, U, U, U], [2])).toEqual([1, 1, 0, 0]);
  });

  it('противоречие — null', () => {
    expect(solveLine([U, U], [3])).toBeNull();
    expect(solveLine([1, U, U], [])).toBeNull();
    expect(solveLine([1, 0, 1], [3])).toBeNull();
  });
});

describe('решатель', () => {
  it('сердце решается однозначно и совпадает с картинкой', () => {
    const res = solveNonogram(cluesOf(HEART));
    expect(res.status).toBe('unique');
    expect(res.grid.map(r => r.map(Boolean))).toEqual(HEART);
    expect(difficultyOf(res, 7)).toBeTruthy();
  });

  it('две диагонали 2×2 — неоднозначно, логика встаёт', () => {
    const res = solveNonogram(cluesOf(pic(['#.', '.#'])));
    expect(res.status).toBe('stuck');
    expect(res.known).toBe(0);
    expect(difficultyOf(res, 2)).toBeNull();
  });

  it('противоречивые подсказки', () => {
    const res = solveNonogram({ rows: [[2], []], cols: [[1], []] });
    expect(res.status).toBe('contradiction');
  });

  it('решение всегда согласуется с картинкой (100 случайных)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = randomPic(8, seed);
      const res = solveNonogram(cluesOf(m));
      expect(res.status).not.toBe('contradiction');
      res.grid.forEach((row, r) => row.forEach((v, c) => {
        if (v !== UNKNOWN) expect(Boolean(v)).toBe(m[r][c]);
      }));
    }
  });

  it('стартовые клетки не теряются', () => {
    const start = startGrid(2, 2, [{ r: 0, c: 0, v: 1 }]);
    const res = solveNonogram(cluesOf(pic(['#.', '.#'])), start);
    expect(res.status).toBe('unique');
    expect(res.grid).toEqual([[1, 0], [0, 1]]);
  });
});

describe('готовые клетки и правка картинки', () => {
  it('неоднозначная картинка решается с готовыми клетками', () => {
    const m = pic(['#.', '.#']);
    const { givens, result } = suggestGivens(m);
    expect(result.status).toBe('unique');
    expect(givens).toHaveLength(1);
    // готовая клетка — правда картинки
    for (const g of givens) expect(Boolean(g.v)).toBe(m[g.r][g.c]);
  });

  it('однозначной картинке готовые клетки не нужны', () => {
    expect(suggestGivens(HEART).givens).toEqual([]);
  });

  it('на случайных 10×10 готовых клеток немного и всё решается', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = randomPic(10, seed * 7);
      const { givens, result } = suggestGivens(m);
      expect(result.status).toBe('unique');
      expect(givens.length).toBeLessThanOrEqual(15);
      for (const g of givens) expect(Boolean(g.v)).toBe(m[g.r][g.c]);
    }
  });

  it('учительские готовые клетки сохраняются, чужие правде — отброшены', () => {
    const m = pic(['#.', '.#']);
    const { givens } = suggestGivens(m, { keep: [{ r: 1, c: 1, v: 1 }, { r: 0, c: 1, v: 1 }] });
    expect(givens).toEqual([{ r: 1, c: 1, v: 1 }]);
  });

  it('правка картинки делает рисунок решаемым', () => {
    const m = pic(['#.', '.#']);
    const { matrix, flips, result } = suggestFlips(m);
    expect(result.status).toBe('unique');
    expect(flips.length).toBeGreaterThan(0);
    expect(solveNonogram(cluesOf(matrix)).status).toBe('unique');
  });
});
