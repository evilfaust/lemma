import { useState, useCallback } from 'react';
import { message } from 'antd';

/**
 * Хук для операций с GeoGebra: сохранение/очистка чертежа, экспорт PNG, нормализация base64.
 * Используется в GeometryTaskEditor.
 *
 * @param {React.RefObject} ggbApiRef — ref на GeoGebra API
 * @param {Object} options — начальные значения
 * @param {string} options.initialGgbBase64 — начальный .ggb base64
 * @param {string} options.initialImageBase64 — начальный PNG base64
 * @param {boolean} options.initialSaved — сохранён ли чертёж
 * @param {string} options.initialAppName — тип приложения GeoGebra
 * @param {string} options.initialDrawingView — режим отображения ('image' | 'geogebra')
 * @returns {Object} состояния и методы
 */
export const useGeoGebraOperations = (ggbApiRef, options = {}) => {
  const {
    initialGgbBase64 = '',
    initialImageBase64 = '',
    initialSaved = false,
    initialAppName = 'geometry',
    initialDrawingView = 'image',
  } = options;

  const [ggbBase64, setGgbBase64] = useState(initialGgbBase64);
  const [ggbImageBase64, setGgbImageBase64] = useState(initialImageBase64);
  const [ggbSaved, setGgbSaved] = useState(initialSaved);
  const [savingDrawing, setSavingDrawing] = useState(false);
  const [appName, setAppName] = useState(initialAppName);
  const [drawingView, setDrawingView] = useState(initialDrawingView);

  const normalizeBase64ToDataUrl = useCallback((base64) => {
    if (!base64) return '';
    return base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`;
  }, []);

  const handleSaveDrawing = useCallback(() => {
    if (!ggbApiRef.current) {
      message.warning('GeoGebra ещё не загружена');
      return;
    }
    setSavingDrawing(true);
    ggbApiRef.current.getBase64(async (base64) => {
      setGgbBase64(base64 || '');

      try {
        const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
        if (pngBase64) {
          const imageData = pngBase64.startsWith('data:image/')
            ? pngBase64
            : `data:image/png;base64,${pngBase64}`;
          setGgbImageBase64(imageData);
        }
      } catch {
        // ignore
      }

      setGgbSaved(true);
      setSavingDrawing(false);
      message.success('Чертёж сохранён (GeoGebra + PNG)');
    });
  }, [ggbApiRef]);

  const handleClearDrawing = useCallback(() => {
    setGgbBase64('');
    setGgbImageBase64('');
    setGgbSaved(false);
    if (ggbApiRef.current) ggbApiRef.current.reset();
  }, [ggbApiRef]);

  const handleSaveDrawingAsImage = useCallback(() => {
    if (!ggbApiRef.current || typeof ggbApiRef.current.getPNGBase64 !== 'function') {
      message.warning('GeoGebra ещё не загружена');
      return;
    }

    setSavingDrawing(true);
    try {
      const pngBase64 = ggbApiRef.current.getPNGBase64(2, false, 300);
      if (!pngBase64) {
        throw new Error('GeoGebra не вернула изображение');
      }

      const imageData = pngBase64.startsWith('data:image/')
        ? pngBase64
        : `data:image/png;base64,${pngBase64}`;

      setGgbImageBase64(imageData);
      setGgbSaved(true);
      message.success('PNG обновлён');
    } catch (error) {
      message.error(`Не удалось сохранить PNG: ${error?.message || 'неизвестная ошибка'}`);
    } finally {
      setSavingDrawing(false);
    }
  }, [ggbApiRef]);

  return {
    ggbBase64,
    setGgbBase64,
    ggbImageBase64,
    setGgbImageBase64,
    ggbSaved,
    setGgbSaved,
    savingDrawing,
    appName,
    setAppName,
    drawingView,
    setDrawingView,
    normalizeBase64ToDataUrl,
    handleSaveDrawing,
    handleClearDrawing,
    handleSaveDrawingAsImage,
  };
};
