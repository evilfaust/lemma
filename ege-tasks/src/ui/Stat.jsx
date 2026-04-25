/**
 * Stat — числовой блок: label + крупное значение + подпись.
 * accent: 'good' | 'warn' | 'bad' | undefined
 */
export function Stat({ label, value, sub, accent, style }) {
  const valueColor = accent === 'good'
    ? 'var(--lvl-1)'
    : accent === 'warn'
      ? 'var(--lvl-2)'
      : accent === 'bad'
        ? 'var(--lvl-3)'
        : 'var(--ink)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '16px 18px',
      border: '1px solid var(--rule)',
      background: 'var(--bg-raised)',
      borderRadius: 'var(--radius-lg)',
      ...style,
    }}>
      <div style={{
        fontSize: 'var(--eyebrow-size)',
        fontWeight: 'var(--eyebrow-weight)',
        letterSpacing: 'var(--eyebrow-tracking)',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--stat-value-size)',
        fontWeight: 'var(--stat-value-weight)',
        letterSpacing: 'var(--stat-value-tracking)',
        lineHeight: 1.1,
        color: valueColor,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--font-body)',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Сетка из 2–4 Stat-карточек */
export function StatRow({ children, cols = 4, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 12,
      marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}
