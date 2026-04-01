import { useRef, useEffect, useState } from 'react';
import { Upload, Typography, Spin } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { imageToMatrix } from '../../utils/imageToMatrix';

const { Text } = Typography;

/**
 * Компонент загрузки изображения с двойным canvas-превью.
 *
 * Левый canvas: оригинальное изображение.
 * Правый canvas: пикселизованный превью (обновляется с дебаунсом
 *   при изменении gridCols/gridRows/threshold — независимо от основной matrix в хуке).
 *
 * Props:
 *   imageFile     — текущий File | null
 *   gridCols      — ширина сетки
 *   gridRows      — высота сетки
 *   threshold     — порог яркости
 *   onImageChange(file) — вызывается при загрузке нового файла
 */
export default function ImageUploader({
  imageFile,
  gridCols,
  gridRows,
  threshold,
  onImageChange,
}) {
  const originalCanvasRef = useRef(null);
  const pixelCanvasRef = useRef(null);
  const [previewMatrix, setPreviewMatrix] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Рисуем оригинал ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageFile || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxPx = 220;
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [imageFile]);

  // ── Пересчитываем пиксельный превью с дебаунсом ───────────────────────────
  useEffect(() => {
    if (!imageFile) { setPreviewMatrix(null); return; }
    setPreviewLoading(true);

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const mat = await imageToMatrix(imageFile, gridCols, gridRows, threshold);
        if (!cancelled) setPreviewMatrix(mat);
      } catch {
        // игнорируем ошибки превью
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [imageFile, gridCols, gridRows, threshold]);

  // ── Рисуем пиксельный превью на canvas ────────────────────────────────────
  useEffect(() => {
    if (!previewMatrix || !pixelCanvasRef.current) return;
    const mat = previewMatrix;
    const rows = mat.length;
    const cols = mat[0]?.length || 0;
    if (!rows || !cols) return;

    const canvas = pixelCanvasRef.current;
    // Размер клетки на экране: впишем в ~220px по большей стороне
    const cellPx = Math.max(3, Math.min(14, Math.floor(220 / Math.max(cols, rows))));
    canvas.width = cols * cellPx;
    canvas.height = rows * cellPx;
    const ctx = canvas.getContext('2d');

    // Рисуем пиксели
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = mat[r][c] ? '#1a1a1a' : '#f8f8f8';
        ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
      }
    }

    // Сетка (только если клетки ≥ 4px)
    if (cellPx >= 4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellPx);
        ctx.lineTo(cols * cellPx, r * cellPx);
        ctx.stroke();
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellPx, 0);
        ctx.lineTo(c * cellPx, rows * cellPx);
        ctx.stroke();
      }
    }
  }, [previewMatrix]);

  const beforeUpload = (file) => {
    onImageChange(file);
    return false; // не загружать автоматически
  };

  return (
    <div>
      <Upload.Dragger
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        beforeUpload={beforeUpload}
        showUploadList={false}
        style={{ marginBottom: imageFile ? 12 : 0 }}
      >
        <p className="ant-upload-drag-icon" style={{ margin: '8px 0' }}>
          <InboxOutlined style={{ fontSize: 28 }} />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 13 }}>
          {imageFile ? 'Заменить изображение' : 'Перетащите или нажмите для загрузки'}
        </p>
        <p className="ant-upload-hint" style={{ fontSize: 11 }}>
          PNG, JPG, WebP · Лучше всего: иконки, силуэты, логотипы с контрастом
        </p>
      </Upload.Dragger>

      {imageFile && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Оригинал */}
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Оригинал
            </Text>
            <canvas
              ref={originalCanvasRef}
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                maxWidth: '100%',
                display: 'block',
              }}
            />
          </div>

          {/* Пиксельный превью */}
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Пикселизация ({gridCols}×{gridRows})
            </Text>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <canvas
                ref={pixelCanvasRef}
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  imageRendering: 'pixelated',
                  maxWidth: '100%',
                  display: 'block',
                }}
              />
              {previewLoading && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.7)',
                }}>
                  <Spin size="small" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
