/**
 * Конвертирует File (изображение) в boolean[][] матрицу для пиксельной раскраски.
 *
 * true  = тёмный пиксель (клетка должна быть закрашена)
 * false = светлый пиксель (клетка остаётся пустой)
 *
 * Изображение масштабируется с сохранением пропорций + белый letterbox.
 *
 * @param {File} file         - загруженный файл изображения
 * @param {number} cols       - ширина сетки в клетках
 * @param {number} rows       - высота сетки в клетках
 * @param {number} threshold  - порог яркости 0–255 (пиксели темнее → true)
 * @returns {Promise<boolean[][]>}
 */
export async function imageToMatrix(file, cols, rows, threshold = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Рисуем изображение в ПОЛНОМ разрешении — без потери качества
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = img.width;
      fullCanvas.height = img.height;
      const fullCtx = fullCanvas.getContext('2d');

      // Белый фон (для PNG с прозрачностью)
      fullCtx.fillStyle = '#ffffff';
      fullCtx.fillRect(0, 0, img.width, img.height);
      fullCtx.drawImage(img, 0, 0);

      const fullData = fullCtx.getImageData(0, 0, img.width, img.height).data;

      // Вычисляем letterbox: как изображение вписывается в сетку cols×rows
      const scale = Math.min(cols / img.width, rows / img.height);
      const drawW = img.width * scale;   // ширина в единицах сетки
      const drawH = img.height * scale;  // высота в единицах сетки
      const offsetX = (cols - drawW) / 2; // отступ в единицах сетки
      const offsetY = (rows - drawH) / 2;

      const matrix = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          // Какой регион оригинального изображения соответствует ячейке [c, r]?
          const imgX0 = (c - offsetX) / scale;
          const imgX1 = (c + 1 - offsetX) / scale;
          const imgY0 = (r - offsetY) / scale;
          const imgY1 = (r + 1 - offsetY) / scale;

          // Ячейка полностью в letterbox-зоне → белая (false)
          if (imgX1 <= 0 || imgX0 >= img.width || imgY1 <= 0 || imgY0 >= img.height) {
            row.push(false);
            continue;
          }

          // Зажимаем координаты до границ изображения
          const x0 = Math.max(0, Math.floor(imgX0));
          const x1 = Math.min(img.width - 1, Math.ceil(imgX1 - 1e-9));
          const y0 = Math.max(0, Math.floor(imgY0));
          const y1 = Math.min(img.height - 1, Math.ceil(imgY1 - 1e-9));

          // Усредняем яркость всех пикселей оригинала, попавших в ячейку (box filter)
          let totalBrightness = 0;
          let count = 0;
          for (let py = y0; py <= y1; py++) {
            for (let px = x0; px <= x1; px++) {
              const idx = (py * img.width + px) * 4;
              const R = fullData[idx];
              const G = fullData[idx + 1];
              const B = fullData[idx + 2];
              const A = fullData[idx + 3] / 255;
              // Смешиваем с белым фоном по альфа-каналу
              const rF = R * A + 255 * (1 - A);
              const gF = G * A + 255 * (1 - A);
              const bF = B * A + 255 * (1 - A);
              // Воспринимаемая яркость
              totalBrightness += 0.299 * rF + 0.587 * gF + 0.114 * bF;
              count++;
            }
          }

          const avgBrightness = count > 0 ? totalBrightness / count : 255;
          row.push(avgBrightness < threshold);
        }
        matrix.push(row);
      }

      resolve(matrix);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };

    img.src = url;
  });
}

/**
 * Предлагает размер сетки исходя из пропорций изображения.
 * Фиксирует cols, вычисляет rows (или наоборот если portrait).
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} targetCols  - желаемая ширина в клетках (по умолчанию 25)
 * @returns {{ cols: number, rows: number }}
 */
export function suggestGridSize(imageWidth, imageHeight, targetCols = 25) {
  if (!imageWidth || !imageHeight) return { cols: targetCols, rows: targetCols };
  const ratio = imageHeight / imageWidth;
  const rows = Math.max(5, Math.min(50, Math.round(targetCols * ratio)));
  return { cols: targetCols, rows };
}

/**
 * Вычисляет размер клетки в мм при печати на А4.
 *
 * Клетки всегда квадратные: размер = min(доступная_ширина/cols, доступная_высота/rows).
 *
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} twoSheets  - true если сетка на отдельном листе (больше места по высоте)
 * @returns {number}  - размер клетки в мм
 */
export function calcCellSize(cols, rows, twoSheets = false) {
  const availW = 190; // A4 210mm − 2×10mm поля
  const availH = twoSheets ? 240 : 120; // на отдельном листе ~240мм, на совместном ~120мм
  return Math.min(availW / cols, availH / rows);
}
