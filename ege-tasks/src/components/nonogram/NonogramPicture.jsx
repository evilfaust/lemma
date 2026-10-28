import { useMemo } from 'react';
import { UNKNOWN } from '../../utils/nonogram/solver';

/**
 * Схема картинки для учителя: рисунок, готовые клетки и где застрял решатель.
 *
 * Клик по клетке ставит или снимает готовую клетку (закрашенная клетка
 * рисунка станет залитой на листе, пустая — с точкой). Клетки, которые
 * решатель не смог вывести логикой, подсвечены — туда и нужна подсказка.
 */
export default function NonogramPicture({ matrix, givens, result, onToggleGiven, maxPx = 520 }) {
  const R = matrix.length;
  const C = matrix[0]?.length ?? 0;
  const cell = Math.max(10, Math.min(28, Math.floor(maxPx / Math.max(R, C))));
  const givenSet = useMemo(() => new Set((givens || []).map(g => `${g.r}:${g.c}`)), [givens]);
  const stuck = result?.status === 'stuck';

  return (
    <div
      role="grid"
      aria-label="Схема картинки"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${C}, ${cell}px)`,
        gridTemplateRows: `repeat(${R}, ${cell}px)`,
        border: '2px solid var(--ink, #111)',
        width: 'max-content',
        background: '#fff',
        userSelect: 'none',
      }}
    >
      {matrix.map((row, r) => row.map((v, c) => {
        const given = givenSet.has(`${r}:${c}`);
        const unknown = stuck && result.grid[r][c] === UNKNOWN;
        const major = (i, n) => (i + 1) % 5 === 0 && i + 1 < n;
        let background = v ? '#2b2f36' : '#fff';
        if (unknown) background = v ? '#9a6b00' : '#ffe8a3';
        return (
          <div
            key={`${r}:${c}`}
            role="gridcell"
            aria-label={`${r + 1}:${c + 1}${given ? ', готовая' : ''}`}
            data-given={given ? '1' : undefined}
            onClick={() => onToggleGiven?.(r, c)}
            title={given ? 'Готовая клетка — снять' : 'Сделать готовой клеткой'}
            style={{
              boxSizing: 'border-box',
              background,
              borderRight: `${major(c, C) ? 2 : 1}px solid ${major(c, C) ? '#555' : '#d6dae0'}`,
              borderBottom: `${major(r, R) ? 2 : 1}px solid ${major(r, R) ? '#555' : '#d6dae0'}`,
              cursor: 'pointer',
              position: 'relative',
              boxShadow: given ? 'inset 0 0 0 2px #1677ff' : undefined,
            }}
          >
            {given && !v && (
              <span style={{
                position: 'absolute', left: '50%', top: '50%', width: 4, height: 4,
                margin: '-2px 0 0 -2px', borderRadius: 2, background: '#1677ff',
              }} />
            )}
          </div>
        );
      }))}
    </div>
  );
}
