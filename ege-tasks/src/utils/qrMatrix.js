import QRCode from 'qrcode';

/**
 * Генерирует булеву матрицу QR-кода из строки URL.
 * true = чёрный модуль, false = белый модуль.
 *
 * @param {string} url - URL для кодирования
 * @param {'L'|'M'|'Q'|'H'} errorLevel - уровень коррекции ошибок (M по умолчанию)
 * @returns {Promise<boolean[][]>}
 */
export async function urlToQRMatrix(url, errorLevel = 'M') {
  const qr = QRCode.create(url, { errorCorrectionLevel: errorLevel });
  const size = qr.modules.size;
  const data = qr.modules.data; // Uint8Array, size*size

  const matrix = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(!!data[r * size + c]);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Возвращает размер QR-матрицы для URL без полной генерации.
 * Версия 1 = 21, версия 2 = 25, версия 3 = 29, ...
 */
export function estimateQRSize(url) {
  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    return qr.modules.size;
  } catch {
    return null;
  }
}
