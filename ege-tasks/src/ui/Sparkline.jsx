/**
 * Sparkline — миниатюрный столбчатый график тренда.
 * data: number[] (значения 1–5 или 0–100)
 * max: максимальное значение шкалы (default 5)
 * height: высота px (default 18)
 */
export function Sparkline({ data = [], max = 5, height = 18 }) {
  if (!data.length) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => {
        const pct = Math.max(0, Math.min(1, v / max));
        const color = v / max >= 0.8
          ? 'var(--lvl-1)'
          : v / max >= 0.6
            ? 'var(--lvl-2)'
            : 'var(--lvl-3)';
        return (
          <span
            key={i}
            style={{
              width: 3,
              height: Math.max(3, Math.round(pct * height)),
              background: color,
              borderRadius: 1,
              opacity: 0.85,
              display: 'inline-block',
            }}
          />
        );
      })}
    </span>
  );
}
