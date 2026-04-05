import { useRef, useEffect, useCallback } from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import { ClearOutlined, BorderOutlined, HighlightOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Интерактивный редактор матрицы пиксель-арта.
 *
 * Левая кнопка мыши: рисует (делает клетку чёрной или белой — определяется при первом клике).
 * Перетаскивание: рисует непрерывно.
 *
 * Props:
 *   matrix       — boolean[][] (текущая матрица)
 *   onToggleCell — (r, c, value: boolean) => void
 *   onClear      — () => void
 *   onFill       — () => void
 *   onInvert     — () => void
 *   availWidth   — доступная ширина в px (для расчёта размера клетки)
 *   availHeight  — доступная высота в px (для расчёта размера клетки)
 */
export default function MatrixEditor({ matrix, onToggleCell, onClear, onFill, onInvert, availWidth, availHeight }) {
  const canvasRef = useRef(null);
  const isPainting = useRef(false);
  const paintValue = useRef(true); // значение которое рисуем (определяется по первой ячейке)

  const rows = matrix?.length || 0;
  const cols = matrix?.[0]?.length || 0;

  // Размер клетки: вписываем в доступную область
  const aW = availWidth  || 380;
  const aH = availHeight || 380;
  const CELL = rows > 0 && cols > 0
    ? Math.max(5, Math.min(40, Math.floor(Math.min(aW / cols, aH / rows))))
    : 10;

  // ── Отрисовка на canvas ────────────────────────────────────────────────────
  const draw = useCallback(() => {
    if (!matrix || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = matrix[r][c] ? '#1a1a1a' : '#f8f8f8';
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }

    // Сетка
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(cols * CELL, r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, rows * CELL);
      ctx.stroke();
    }
  }, [matrix, rows, cols, CELL]);

  // При изменении размера сетки — пересоздаём canvas
  useEffect(() => {
    if (!canvasRef.current || !rows || !cols) return;
    canvasRef.current.width = cols * CELL;
    canvasRef.current.height = rows * CELL;
    draw();
  }, [rows, cols, CELL]);

  // При изменении данных матрицы — перерисовываем
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Получить ячейку из события мыши / тача ─────────────────────────────────
  const getCellFromPoint = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r >= 0 && r < rows && c >= 0 && c < cols) return { r, c };
    return null;
  };

  // ── Мышь ──────────────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    isPainting.current = true;
    paintValue.current = !matrix[cell.r][cell.c];
    onToggleCell(cell.r, cell.c, paintValue.current);
  };

  const handleMouseMove = (e) => {
    if (!isPainting.current) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    if (matrix[cell.r][cell.c] !== paintValue.current) {
      onToggleCell(cell.r, cell.c, paintValue.current);
    }
  };

  const handleMouseUp = () => { isPainting.current = false; };

  // ── Тач (планшеты) ────────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const cell = getCellFromPoint(t.clientX, t.clientY);
    if (!cell) return;
    isPainting.current = true;
    paintValue.current = !matrix[cell.r][cell.c];
    onToggleCell(cell.r, cell.c, paintValue.current);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isPainting.current) return;
    const t = e.touches[0];
    const cell = getCellFromPoint(t.clientX, t.clientY);
    if (!cell) return;
    if (matrix[cell.r][cell.c] !== paintValue.current) {
      onToggleCell(cell.r, cell.c, paintValue.current);
    }
  };

  const handleTouchEnd = () => { isPainting.current = false; };

  if (!matrix || !rows || !cols) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
        <Text type="secondary">Сначала загрузите изображение или нажмите «Пересчитать»</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Панель инструментов */}
      <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <Tooltip title="Очистить всю матрицу (все клетки белые)">
          <Button size="small" icon={<ClearOutlined />} onClick={onClear}>
            Очистить
          </Button>
        </Tooltip>
        <Tooltip title="Заполнить всю матрицу (все клетки чёрные)">
          <Button size="small" icon={<BorderOutlined />} onClick={onFill}>
            Заполнить
          </Button>
        </Tooltip>
        <Tooltip title="Инвертировать: чёрные → белые, белые → чёрные">
          <Button size="small" icon={<HighlightOutlined />} onClick={onInvert}>
            Инвертировать
          </Button>
        </Tooltip>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {cols}×{rows} клеток ·{' '}
          {matrix.flat().filter(Boolean).length} закрашено
        </Text>
      </Space>

      {/* Canvas */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: availHeight ? availHeight + 8 : 480 }}>
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            cursor: 'crosshair',
            display: 'block',
            imageRendering: 'pixelated',
            userSelect: 'none',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
        Левая кнопка мыши: закрасить / стереть. Перетащите для рисования нескольких клеток.
      </Text>
    </div>
  );
}
