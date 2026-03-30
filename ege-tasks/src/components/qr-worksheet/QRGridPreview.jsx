import { useMemo } from 'react';
import { Spin, Typography } from 'antd';
import { buildZoneCache, getCellZone } from '../../utils/qrZones';

const { Text } = Typography;

// Цвета предзакрашенных зон (для режима учителя — чуть тусклее, чтобы отличались от «ответов»)
const ZONE_COLORS = {
  finder: '#2a2a2a',
  timing: '#444',
  format: '#555',
};

/**
 * Интерактивное превью QR-сетки.
 *
 * Props:
 *   grid           — Cell[][] | null  ({ value, isAnswer })
 *   mode           — 'student' | 'teacher'
 *   loading        — boolean
 *   matrix         — boolean[][] | null  (оригинальная QR-матрица, true = чёрный)
 *   preFillFinder  — boolean
 *   preFillTiming  — boolean
 *   preFillFormat  — boolean
 */
export default function QRGridPreview({
  grid,
  mode,
  loading,
  matrix,
  preFillFinder = false,
  preFillTiming = false,
  preFillFormat = false,
}) {
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
  const anyPreFill = preFillFinder || preFillTiming || preFillFormat;

  // Адаптивный размер ячейки в превью (экранный, не печатный)
  const cellPx = Math.max(14, Math.min(22, Math.floor(420 / size)));

  // Кеш зон строим один раз для данного размера
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const zoneCache = useMemo(() => anyPreFill ? buildZoneCache(size) : null, [size, anyPreFill]);

  return (
    <div>
      {mode === 'teacher' && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: '#333', border: '1px solid #333', borderRadius: 2,
            }} />
            <Text type="secondary">= ответ (закрасить)</Text>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: '#fff', border: '1px solid #d9d9d9', borderRadius: 2,
            }} />
            <Text type="secondary">= шум (не закрашивать)</Text>
          </span>
          {anyPreFill && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                background: 'repeating-linear-gradient(45deg, #ccc 0px, #ccc 3px, #eee 3px, #eee 6px)',
                border: '1px solid #bbb', borderRadius: 2,
              }} />
              <Text type="secondary">= предзакрашено</Text>
            </span>
          )}
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
        {grid.map((row, ri) =>
          row.map((cell, ci) => {
            // Определяем зону
            const zone = zoneCache ? getCellZone(ri, ci, size, zoneCache) : null;
            const isPreFilled =
              (zone === 'finder' && preFillFinder) ||
              (zone === 'timing' && preFillTiming) ||
              (zone === 'format' && preFillFormat);

            if (isPreFilled) {
              const isBlack = matrix?.[ri]?.[ci] ?? false;
              return (
                <div
                  key={`${ri}-${ci}`}
                  title={`${zone}`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isBlack
                      ? ZONE_COLORS[zone]
                      : 'repeating-linear-gradient(45deg, #d0d0d0 0px, #d0d0d0 2px, #f0f0f0 2px, #f0f0f0 5px)',
                    border: '0.5px solid #aaa',
                    boxSizing: 'border-box',
                    userSelect: 'none',
                  }}
                />
              );
            }

            const isHighlighted = mode === 'teacher' && cell.isAnswer;
            return (
              <div
                key={`${ri}-${ci}`}
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
          })
        )}
      </div>

      <div style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Размер сетки: {size}×{size} ({size * size} клеток)
        </Text>
      </div>
    </div>
  );
}
