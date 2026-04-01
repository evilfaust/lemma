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

      const canvas = document.createElement('canvas');
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext('2d');

      // Белый фон (letterbox)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cols, rows);

      // Масштабируем с сохранением пропорций (fit inside)
      const scale = Math.min(cols / img.width, rows / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (cols - drawW) / 2;
      const offsetY = (rows - drawH) / 2;

      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      const imageData = ctx.getImageData(0, 0, cols, rows);
      const pixels = imageData.data; // RGBA flat array

      const matrix = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          const idx = (r * cols + c) * 4;
          const R = pixels[idx];
          const G = pixels[idx + 1];
          const B = pixels[idx + 2];
          // Воспринимаемая яркость (человеческий глаз чувствительнее к зелёному)
          const brightness = 0.299 * R + 0.587 * G + 0.114 * B;
          row.push(brightness < threshold);
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
