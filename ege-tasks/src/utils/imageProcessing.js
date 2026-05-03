/**
 * Enhanced image processing for pixel art.
 * Modes: 'original' | 'silhouette' | 'contour' | 'contrast'
 */

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось загрузить изображение')); };
    img.src = url;
  });
}

function renderToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height).data;
}

function toGrayscale(rgba, width, height) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3] / 255;
    const rf = r * a + 255 * (1 - a);
    const gf = g * a + 255 * (1 - a);
    const bf = b * a + 255 * (1 - a);
    gray[i] = 0.299 * rf + 0.587 * gf + 0.114 * bf;
  }
  return gray;
}

export function computeOtsu(gray) {
  const hist = new Int32Array(256);
  for (const v of gray) hist[Math.min(255, Math.round(v))]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxVar) { maxVar = v; threshold = t; }
  }
  return threshold;
}

function applySobel(gray, width, height) {
  const result = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y-1)*width+(x-1)], t  = gray[(y-1)*width+x], tr = gray[(y-1)*width+(x+1)];
      const l  = gray[y*width+(x-1)],                                 r  = gray[y*width+(x+1)];
      const bl = gray[(y+1)*width+(x-1)], b  = gray[(y+1)*width+x], br = gray[(y+1)*width+(x+1)];
      const gx = -tl - 2*l - bl + tr + 2*r + br;
      const gy = -tl - 2*t - tr + bl + 2*b + br;
      result[y * width + x] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  return result;
}

function stretchContrast(gray) {
  let min = 255, max = 0;
  for (const v of gray) { if (v < min) min = v; if (v > max) max = v; }
  if (max === min) return gray;
  const range = max - min;
  const result = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) result[i] = ((gray[i] - min) / range) * 255;
  return result;
}

function sCurve(gray) {
  const result = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    result[i] = 255 / (1 + Math.exp(-10 * (gray[i] / 255 - 0.5)));
  }
  return result;
}

function avgRegion(gray, width, height, x0, x1, y0, y1) {
  const px0 = Math.max(0, Math.floor(x0));
  const px1 = Math.min(width - 1, Math.ceil(x1 - 1e-9));
  const py0 = Math.max(0, Math.floor(y0));
  const py1 = Math.min(height - 1, Math.ceil(y1 - 1e-9));
  let sum = 0, count = 0;
  for (let py = py0; py <= py1; py++)
    for (let px = px0; px <= px1; px++) { sum += gray[py * width + px]; count++; }
  return count > 0 ? sum / count : 255;
}

function grayToMatrix(gray, origW, origH, cols, rows, threshold) {
  const scale = Math.min(cols / origW, rows / origH);
  const drawW = origW * scale, drawH = origH * scale;
  const offsetX = (cols - drawW) / 2, offsetY = (rows - drawH) / 2;
  const matrix = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const imgX0 = (c - offsetX) / scale, imgX1 = (c + 1 - offsetX) / scale;
      const imgY0 = (r - offsetY) / scale, imgY1 = (r + 1 - offsetY) / scale;
      if (imgX1 <= 0 || imgX0 >= origW || imgY1 <= 0 || imgY0 >= origH) {
        row.push(false); continue;
      }
      row.push(avgRegion(gray, origW, origH, imgX0, imgX1, imgY0, imgY1) < threshold);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Конвертирует File → boolean[][] с поддержкой режимов.
 *
 * options.mode:
 *   'original'   — текущий алгоритм (box avg + порог)
 *   'silhouette' — растяжка контраста + авто-порог Otsu
 *   'contour'    — рёбра Собеля + нормализация
 *   'contrast'   — S-кривая + порог
 */
export async function processImageToMatrix(file, cols, rows, options = {}) {
  const { threshold = 128, mode = 'original' } = options;
  const img = await loadImageFromFile(file);
  const rgba = renderToCanvas(img);
  const gray = toGrayscale(rgba, img.width, img.height);

  let processedGray;
  let effectiveThreshold = threshold;

  switch (mode) {
    case 'silhouette': {
      processedGray = stretchContrast(gray);
      effectiveThreshold = computeOtsu(processedGray);
      break;
    }
    case 'contour': {
      const grad = applySobel(gray, img.width, img.height);
      let maxG = 1;
      for (const v of grad) if (v > maxG) maxG = v;
      // Инвертируем: сильный край → низкое значение (grayToMatrix: avg < threshold → тёмная клетка)
      const invNorm = new Float32Array(grad.length);
      for (let i = 0; i < grad.length; i++) invNorm[i] = 255 - (grad[i] / maxG) * 255;
      processedGray = invNorm;
      effectiveThreshold = threshold;
      break;
    }
    case 'contrast': {
      processedGray = sCurve(gray);
      effectiveThreshold = threshold;
      break;
    }
    default: // 'original'
      processedGray = gray;
      effectiveThreshold = threshold;
  }

  return grayToMatrix(processedGray, img.width, img.height, cols, rows, effectiveThreshold);
}

/**
 * Автообрезка: находит bounding box содержимого и обрезает изображение.
 * Возвращает { file: File, didCrop: boolean }.
 */
export async function autoCropFile(file, padding = 0.07) {
  const img = await loadImageFromFile(file);
  const rgba = renderToCanvas(img);
  const gray = toGrayscale(rgba, img.width, img.height);

  let minX = img.width, maxX = -1, minY = img.height, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (gray[y * img.width + x] < 230) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return { file, didCrop: false };

  const padX = Math.round((maxX - minX + 1) * padding);
  const padY = Math.round((maxY - minY + 1) * padding);
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(img.width, maxX + padX + 1);
  const y1 = Math.min(img.height, maxY + padY + 1);

  // Обрезка бессмысленна если убирается менее 5% площади
  if ((x1 - x0) * (y1 - y0) / (img.width * img.height) > 0.95) {
    return { file, didCrop: false };
  }

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = x1 - x0;
  cropCanvas.height = y1 - y0;
  const cropCtx = cropCanvas.getContext('2d');
  cropCtx.fillStyle = '#ffffff';
  cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);

  return new Promise((resolve) => {
    cropCanvas.toBlob((blob) => {
      resolve({ file: new File([blob], file.name, { type: 'image/png' }), didCrop: true });
    }, 'image/png');
  });
}

/** Вычисляет порог Otsu из файла изображения. */
export async function computeOtsuFromFile(file) {
  const img = await loadImageFromFile(file);
  const rgba = renderToCanvas(img);
  return computeOtsu(toGrayscale(rgba, img.width, img.height));
}
