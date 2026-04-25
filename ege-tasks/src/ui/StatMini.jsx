/**
 * StatMini — компактная мини-статистика для карточек в списках.
 * Отличие от Stat: меньший размер, нет рамки/фона — только текст.
 *
 * Props:
 *   label   string   — подпись (uppercase, 9.5px)
 *   value   any      — значение (mono, 13px, bold)
 *   good    boolean  — зелёный цвет (var(--lvl-1))
 *   warn    boolean  — оранжевый цвет (var(--lvl-2))
 *   danger  boolean  — красный цвет (var(--lvl-3))
 */
export function StatMini({ label, value, good, warn, danger }) {
  const color = good
    ? 'var(--lvl-1)'
    : warn
      ? 'var(--lvl-2)'
      : danger
        ? 'var(--lvl-3)'
        : 'var(--ink)';

  return (
    <div>
      <div style={{
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        color: 'var(--ink-4)',
        marginBottom: 1,
        lineHeight: 1,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color,
        lineHeight: 1.2,
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}
