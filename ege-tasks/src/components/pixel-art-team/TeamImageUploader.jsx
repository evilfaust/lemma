import { useRef, useEffect, useState } from 'react';
import { Upload, Typography, Spin, Radio, Button, Space, message } from 'antd';
import { InboxOutlined, ScissorOutlined, SyncOutlined } from '@ant-design/icons';
import { processImageToMatrix, autoCropFile, computeOtsuFromFile } from '../../utils/imageProcessing';
import { removeNoise, closeHoles, thicken, smooth, invertMatrix } from '../../utils/matrixOps';

const { Text } = Typography;

const MODES = [
  { value: 'original',   label: 'Оригинал' },
  { value: 'silhouette', label: 'Силуэт',   hint: 'Авто-порог, высокий контраст' },
  { value: 'contour',    label: 'Контур',   hint: 'Обводка рёбер (оператор Собеля)' },
  { value: 'contrast',   label: 'Контраст', hint: 'S-кривая, усиленный контраст' },
];

const CLEANUP_OPS = [
  { key: 'noise',  label: 'Удалить шум',    fn: removeNoise  },
  { key: 'holes',  label: 'Закрыть дырки',  fn: closeHoles   },
  { key: 'thick',  label: 'Утолстить',      fn: thicken      },
  { key: 'smooth', label: 'Сгладить',       fn: smooth       },
  { key: 'invert', label: 'Инвертировать',  fn: invertMatrix },
];

function drawMatrixToCanvas(canvas, matrix, maxPx = 220) {
  if (!canvas || !matrix?.length) return;
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (!rows || !cols) return;
  const cellPx = Math.max(2, Math.min(14, Math.floor(maxPx / Math.max(cols, rows))));
  canvas.width  = cols * cellPx;
  canvas.height = rows * cellPx;
  const ctx = canvas.getContext('2d');
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = matrix[r][c] ? '#1a1a1a' : '#f8f8f8';
      ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
    }
  if (cellPx >= 4) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellPx); ctx.lineTo(cols * cellPx, r * cellPx); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellPx, 0); ctx.lineTo(c * cellPx, rows * cellPx); ctx.stroke();
    }
  }
}

/**
 * Загрузчик изображения для командного пиксель-арта.
 *
 * Расширяет базовый ImageUploader:
 *  - 4 режима обработки: Оригинал / Силуэт / Контур / Контраст
 *  - Кнопка автообрезки (находит bounding box объекта)
 *  - Кнопка авто-порога (Otsu)
 *  - Кнопки очистки матрицы
 *  - Мини-превью всех 4 режимов для быстрого выбора
 *
 * Props:
 *   imageFile        — File | null
 *   gridCols         — ширина сетки
 *   gridRows         — высота сетки
 *   threshold        — порог яркости (50–220)
 *   onImageChange    — (file) => void
 *   onMatrixChange   — (matrix: boolean[][]) => void
 *   onThresholdChange — (value: number) => void  (опционально, для авто-порога)
 */
export default function TeamImageUploader({
  imageFile,
  gridCols,
  gridRows,
  threshold,
  onImageChange,
  onMatrixChange,
  onThresholdChange,
}) {
  const originalCanvasRef = useRef(null);
  const pixelCanvasRef    = useRef(null);
  const compareRefs       = useRef({});

  const [mode, setMode]             = useState('original');
  const [previewMatrix, setPreviewMatrix] = useState(null);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [isCropping, setIsCropping]       = useState(false);
  const [autoCroppedFile, setAutoCroppedFile] = useState(null);
  const [cropApplied, setCropApplied]         = useState(false);

  // Stale-closure guard для onMatrixChange
  const onMatrixChangeRef = useRef(onMatrixChange);
  useEffect(() => { onMatrixChangeRef.current = onMatrixChange; }, [onMatrixChange]);

  const activeFile = autoCroppedFile || imageFile;

  // ── Сброс обрезки при смене файла ────────────────────────────────────────
  useEffect(() => {
    setAutoCroppedFile(null);
    setCropApplied(false);
  }, [imageFile]);

  // ── Рисуем оригинал (или обрезанный) на левом canvas ─────────────────────
  useEffect(() => {
    const fileToShow = autoCroppedFile || imageFile;
    if (!fileToShow || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    const ctx    = canvas.getContext('2d');
    const img    = new Image();
    const url    = URL.createObjectURL(fileToShow);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(220 / img.width, 220 / img.height, 1);
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [imageFile, autoCroppedFile]);

  // ── Основная обработка с дебаунсом ────────────────────────────────────────
  useEffect(() => {
    if (!activeFile) { setPreviewMatrix(null); return; }
    let cancelled = false;
    setIsProcessing(true);
    const timer = setTimeout(async () => {
      try {
        const mat = await processImageToMatrix(activeFile, gridCols, gridRows, { threshold, mode });
        if (!cancelled) {
          setPreviewMatrix(mat);
          onMatrixChangeRef.current(mat);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setIsProcessing(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeFile, gridCols, gridRows, threshold, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Рисуем пиксельный превью ──────────────────────────────────────────────
  useEffect(() => {
    drawMatrixToCanvas(pixelCanvasRef.current, previewMatrix, 220);
  }, [previewMatrix]);

  // ── Вычисляем мини-превью всех 4 режимов ─────────────────────────────────
  useEffect(() => {
    if (!activeFile) return;
    // Очищаем старые превью
    for (const m of MODES) {
      const c = compareRefs.current[m.value];
      if (c) { c.width = 0; c.height = 0; }
    }
    let cancelled = false;
    const compCols = Math.min(gridCols, 22);
    const compRows = Math.min(gridRows, 22);
    const run = async () => {
      for (const m of MODES) {
        if (cancelled) return;
        try {
          const mat = await processImageToMatrix(activeFile, compCols, compRows, { threshold, mode: m.value });
          if (!cancelled) drawMatrixToCanvas(compareRefs.current[m.value], mat, 62);
        } catch { /* ignore */ }
      }
    };
    const timer = setTimeout(run, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeFile, gridCols, gridRows, threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Автообрезка ───────────────────────────────────────────────────────────
  const handleAutoCrop = async () => {
    if (!imageFile) return;
    setIsCropping(true);
    try {
      const result = await autoCropFile(imageFile);
      if (result.didCrop) {
        setAutoCroppedFile(result.file);
        setCropApplied(true);
      } else {
        message.info('Объект уже занимает большую часть изображения');
      }
    } catch {
      message.error('Ошибка при обрезке');
    } finally {
      setIsCropping(false);
    }
  };

  const handleResetCrop = () => {
    setAutoCroppedFile(null);
    setCropApplied(false);
  };

  // ── Авто-порог (Otsu) ─────────────────────────────────────────────────────
  const handleAutoThreshold = async () => {
    if (!activeFile || !onThresholdChange) return;
    try {
      const otsu = await computeOtsuFromFile(activeFile);
      onThresholdChange(otsu);
    } catch { /* ignore */ }
  };

  // ── Операции очистки матрицы ──────────────────────────────────────────────
  const applyOp = (opFn) => {
    if (!previewMatrix) return;
    const result = opFn(previewMatrix);
    setPreviewMatrix(result);
    onMatrixChangeRef.current(result);
  };

  const beforeUpload = (file) => { onImageChange(file); return false; };

  const currentModeHint = MODES.find(m => m.value === mode)?.hint;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Загрузка */}
      <Upload.Dragger
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        beforeUpload={beforeUpload}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon" style={{ margin: '8px 0' }}>
          <InboxOutlined style={{ fontSize: 28 }} />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 13 }}>
          {imageFile ? 'Заменить изображение' : 'Перетащите или нажмите для загрузки'}
        </p>
        <p className="ant-upload-hint" style={{ fontSize: 11 }}>
          PNG, JPG, WebP
        </p>
      </Upload.Dragger>

      {imageFile && (
        <>
          {/* Режим обработки */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Режим:</Text>
              <Radio.Group
                value={mode}
                onChange={e => setMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                {MODES.map(m => (
                  <Radio.Button key={m.value} value={m.value}>{m.label}</Radio.Button>
                ))}
              </Radio.Group>
            </div>
            {currentModeHint && (
              <Text type="secondary" style={{ fontSize: 11, paddingLeft: 2 }}>
                {currentModeHint}
              </Text>
            )}

            {/* Инструменты */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button
                size="small"
                icon={<ScissorOutlined />}
                onClick={cropApplied ? handleResetCrop : handleAutoCrop}
                loading={isCropping}
                type={cropApplied ? 'primary' : 'default'}
              >
                {cropApplied ? 'Сбросить обрезку' : 'Автообрезать'}
              </Button>
              {onThresholdChange && (
                <Button size="small" icon={<SyncOutlined />} onClick={handleAutoThreshold}>
                  Авто-порог
                </Button>
              )}
            </div>
          </div>

          {/* Оригинал + пиксельный превью */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                {cropApplied ? 'Оригинал (обрезан)' : 'Оригинал'}
              </Text>
              <canvas
                ref={originalCanvasRef}
                style={{ border: '1px solid #d9d9d9', borderRadius: 4, maxWidth: '100%', display: 'block' }}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                {MODES.find(m => m.value === mode)?.label} ({gridCols}×{gridRows})
              </Text>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <canvas
                  ref={pixelCanvasRef}
                  style={{
                    border: '1px solid #d9d9d9', borderRadius: 4,
                    imageRendering: 'pixelated', maxWidth: '100%', display: 'block',
                  }}
                />
                {isProcessing && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.75)',
                  }}>
                    <Spin size="small" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Сравнение вариантов */}
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 5 }}>
              Варианты — нажмите чтобы выбрать:
            </Text>
            <div style={{ display: 'flex', gap: 6 }}>
              {MODES.map(m => (
                <div
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'center',
                    padding: '4px 4px 2px',
                    borderRadius: 6,
                    border: `2px solid ${mode === m.value ? '#1677ff' : '#d9d9d9'}`,
                    background: mode === m.value ? '#e6f4ff' : 'transparent',
                    transition: 'border-color 0.15s',
                    minWidth: 0,
                  }}
                >
                  <canvas
                    ref={el => { compareRefs.current[m.value] = el; }}
                    style={{ display: 'block', imageRendering: 'pixelated' }}
                  />
                  <Text style={{
                    fontSize: 10,
                    color: mode === m.value ? '#1677ff' : 'var(--ink-3)',
                    lineHeight: '18px',
                    display: 'block',
                  }}>
                    {m.label}
                  </Text>
                </div>
              ))}
            </div>
          </div>

          {/* Очистка матрицы */}
          {previewMatrix && (
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 5 }}>
                Очистка матрицы:
              </Text>
              <Space size={4} wrap>
                {CLEANUP_OPS.map(op => (
                  <Button key={op.key} size="small" onClick={() => applyOp(op.fn)}>
                    {op.label}
                  </Button>
                ))}
              </Space>
            </div>
          )}
        </>
      )}
    </div>
  );
}
