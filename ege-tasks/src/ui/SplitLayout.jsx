/**
 * SplitLayout — двухпанельный grid: левая колонка фиксированной ширины + правая 1fr.
 *
 * Props:
 *   left        ReactNode  — содержимое левой панели
 *   right       ReactNode  — содержимое правой панели
 *   leftWidth   number     — ширина левой панели в px (default 320)
 *   gap         number     — расстояние между панелями в px (default 20)
 *   divider     boolean    — вертикальная линия-разделитель между панелями (default true)
 *   style       object     — доп. стили на корневой div
 */
export function SplitLayout({ left, right, leftWidth = 320, gap = 20, divider = true, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${leftWidth}px 1fr`,
      gap,
      height: '100%',
      minHeight: 0,
      ...style,
    }}>
      {/* Левая панель */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...(divider ? {
          borderRight: '1px solid var(--rule)',
          paddingRight: Math.round(gap * 0.6),
          marginRight: -Math.round(gap * 0.6),
        } : {}),
      }}>
        {left}
      </div>

      {/* Правая панель — отступ от разделителя */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        paddingLeft: divider ? Math.round(gap * 0.4) : 0,
      }}>
        {right}
      </div>
    </div>
  );
}
