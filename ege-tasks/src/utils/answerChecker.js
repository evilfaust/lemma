/**
 * Нормализация и проверка ответов учеников.
 *
 * Форматы ответов в БД:
 * - Простые числа: "8", "-2", "15"
 * - Десятичные: "1,5", "0.333", "-0,04"
 * - Дроби: "3/2", "1/2"
 * - LaTeX-обёртка: "$8$", "$-2$", "$0$"
 * - Присваивание: "$x = 5$", "$x = 27$", "x = 8"
 * - LaTeX-дроби: "$\frac{1}{2}$", "$-\frac{3}{4}$", "$\dfrac{2}{3}$"
 * - Смешанные дроби (LaTeX): "$10\dfrac{1}{4}$", "$1\frac{1}{2}$"
 * - Альтернативные ответы: "3|3,0"
 * - LaTeX-запятая: "$0{,}04$"
 * - Нечисловые (тригонометрия и т.д.): "$(-1)^n \frac{\pi}{3} + \pi n$"
 *   → для таких автопроверка невозможна
 */

/**
 * Очищает строку от LaTeX-обёртки и конструкций, извлекая числовое значение.
 */
function stripLatex(s) {
  // Убираем $...$ обёртку
  let cleaned = s.replace(/^\$+/, '').replace(/\$+$/, '').trim();

  // Убираем присваивание: "x = 5" → "5", "n = -3" → "-3"
  cleaned = cleaned.replace(/^[a-zA-Z]\s*=\s*/, '');

  // LaTeX-запятая: {,} → .
  cleaned = cleaned.replace(/\{,\}/g, '.');

  // Смешанные дроби: 10\dfrac{1}{4} → 10 + 1/4
  const mixedFracMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\\(?:d?frac)\s*\{(-?\d+(?:\.\d+)?)\}\s*\{(-?\d+(?:\.\d+)?)\}$/);
  if (mixedFracMatch) {
    const whole = parseFloat(mixedFracMatch[1]);
    const num = parseFloat(mixedFracMatch[2]);
    const den = parseFloat(mixedFracMatch[3]);
    if (den !== 0) {
      const sign = whole < 0 ? -1 : 1;
      return String(whole + sign * (num / den));
    }
  }

  // Простые LaTeX-дроби: \frac{a}{b} или \dfrac{a}{b}, с опциональным минусом
  const fracMatch = cleaned.match(/^(-?)\s*\\(?:d?frac)\s*\{(-?\d+(?:\.\d+)?)\}\s*\{(-?\d+(?:\.\d+)?)\}$/);
  if (fracMatch) {
    const sign = fracMatch[1] === '-' ? -1 : 1;
    const num = parseFloat(fracMatch[2]);
    const den = parseFloat(fracMatch[3]);
    if (den !== 0) {
      return String(sign * (num / den));
    }
  }

  // Заменяем запятую на точку
  cleaned = cleaned.replace(',', '.');

  return cleaned;
}

/**
 * Нормализует строковый ответ в число.
 * @param {string} raw — сырой ввод
 * @returns {number} — числовое значение или NaN
 */
export function normalizeAnswer(raw) {
  if (!raw || typeof raw !== 'string') return NaN;
  let s = raw.trim();
  if (s === '') return NaN;

  // Если содержит LaTeX-маркеры — обрабатываем через stripLatex
  if (s.includes('$') || s.includes('\\frac') || s.includes('\\dfrac')) {
    s = stripLatex(s);
  } else {
    // Убираем присваивание без LaTeX: "x = 5" → "5"
    s = s.replace(/^[a-zA-Z]\s*=\s*/, '');
    // LaTeX-запятая
    s = s.replace(/\{,\}/g, '.');
    // Обычная запятая
    s = s.replace(',', '.');
  }

  // Проверяем простую дробь a/b
  const fractionMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (denominator === 0) return NaN;
    return numerator / denominator;
  }

  return parseFloat(s);
}

/**
 * Сравнивает ответ ученика с эталонным.
 * Поддерживает альтернативные ответы через "|" (например "3|3,0").
 *
 * @param {string} studentRaw — сырой ответ ученика
 * @param {string} correctRaw — правильный ответ из БД
 * @param {number} epsilon — допуск сравнения
 * @returns {{ isCorrect: boolean, normalized: number }}
 */
export function checkAnswer(studentRaw, correctRaw, epsilon = 1e-6) {
  if (!correctRaw) return { isCorrect: false, normalized: NaN };

  const studentNorm = normalizeAnswer(studentRaw);

  // Разбираем альтернативные ответы (через "|")
  const alternatives = correctRaw.split('|');

  // Если ученик ввёл число — сравниваем численно
  if (!isNaN(studentNorm)) {
    for (const alt of alternatives) {
      const correctNorm = normalizeAnswer(alt.trim());
      if (isNaN(correctNorm)) continue;

      if (Math.abs(studentNorm - correctNorm) <= epsilon) {
        return { isCorrect: true, normalized: studentNorm };
      }
    }
    return { isCorrect: false, normalized: studentNorm };
  }

  // Ученик ввёл не число — пробуем текстовое сравнение
  const studentClean = (studentRaw || '').trim().toLowerCase();
  if (!studentClean) return { isCorrect: false, normalized: NaN };

  const isCorrect = alternatives.some(alt => alt.trim().toLowerCase() === studentClean);
  return { isCorrect, normalized: NaN };
}
