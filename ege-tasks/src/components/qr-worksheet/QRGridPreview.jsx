import { Spin, Typography } from 'antd';

const { Text } = Typography;

/**
 * Интерактивное превью QR-сетки.
 *
 * Props:
 *   grid    — Cell[][] | null  ({ value, isAnswer })
 *   mode    — 'student' | 'teacher'
 *   loading — boolean
 */
export default function QRGridPreview({ grid, mode, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <Spin tip="Генерируем QR-сетку..." />
      </div>
    );
  }

  if (!grid) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        border: '2px dashed #d9d9d9',
        borderRadius: 8,
        color: '#bfbfbf',
        fontSize: 14,
      }}>
        Сетка появится после генерации
      </div>
    );
  }

  const size = grid.length;

  // Адаптивный размер ячейки в превью (экранный, не печатный)
  const cellPx = Math.max(14, Math.min(22, Math.floor(420 / size)));

  return (
    <div>
      {mode === 'teacher' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: '#333', border: '1px solid #333', borderRadius: 2,
            }} />
            <Text type="secondary">= ответ на задание (закрасить)</Text>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: '#fff', border: '1px solid #d9d9d9', borderRadius: 2,
            }} />
            <Text type="secondary">= «шумовое» число (не закрашивать)</Text>
          </span>
        </div>
      )}

      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
          gap: 0,
          border: '2px solid #000',
          lineHeight: 1,
        }}
      >
        {grid.flat().map((cell, i) => {
          const isHighlighted = mode === 'teacher' && cell.isAnswer;
          return (
            <div
              key={i}
              style={{
                width: cellPx,
                height: cellPx,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(7, cellPx - 8),
                fontFamily: 'monospace',
                fontWeight: 500,
                background: isHighlighted ? '#333' : '#fff',
                color: isHighlighted ? '#fff' : '#222',
                border: '0.5px solid #ccc',
                boxSizing: 'border-box',
                userSelect: 'none',
              }}
            >
              {cell.value}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Размер сетки: {size}×{size} ({size * size} клеток)
        </Text>
      </div>
    </div>
  );
}
