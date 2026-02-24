/**
 * Утилиты для обрезки PNG-изображений.
 * Используются в GeometryTaskEditor и GeoGebraDrawingPanel.
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export const normalizeCrop = (crop = {}) => ({
  left: clamp(crop.left, 0, 45),
  right: clamp(crop.right, 0, 45),
  top: clamp(crop.top, 0, 45),
  bottom: clamp(crop.bottom, 0, 45),
});

export const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export const cropPngByMargins = async (dataUrl, crop) => {
  const normalized = normalizeCrop(crop);
  const img = await loadImage(dataUrl);
  const sx = Math.round((normalized.left / 100) * img.width);
  const sy = Math.round((normalized.top / 100) * img.height);
  const sw = Math.round(img.width * (1 - (normalized.left + normalized.right) / 100));
  const sh = Math.round(img.height * (1 - (normalized.top + normalized.bottom) / 100));

  if (sw < 20 || sh < 20) {
    throw new Error('Слишком сильная обрезка. Уменьшите поля.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось создать canvas');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
};

export const dataUrlToFile = (dataUrl, filename = 'drawing.png') => {
  const raw = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: 'image/png' });
};
