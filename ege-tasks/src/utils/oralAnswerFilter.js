/**
 * Проверяет, является ли LaTeX-ответ целым числом или конечной десятичной дробью.
 * Принимает: "3", "-3", "0", "1{,}5", "-0{,}2", "0.5"
 * Отвергает: "\\dfrac{1}{3}", "\\sqrt{2}", "1\\dfrac{2}{3}", "\\log_2 5"
 *
 * Логика простая: если в строке есть обратный слэш — это LaTeX-команда
 * (дробь, корень, логарифм и т.п.) → отвергаем.
 * Иначе проверяем, что это число с возможной десятичной частью
 * (запятая в LaTeX-нотации "{,}" или обычная точка).
 */
export function isFiniteDecimalAnswer(latex) {
  if (typeof latex !== 'string') return false;
  const s = latex.trim();
  if (s === '') return false;
  // Любая LaTeX-команда → не целое и не конечная десятичная
  if (s.includes('\\')) return false;
  // Целое или десятичное (с "{,}" или ".")
  return /^-?\d+(\{,\}\d+|\.\d+)?$/.test(s);
}

/** Целое число? «3», «-12». Дробь, десятичная и LaTeX-команда — нет. */
export function isIntegerAnswer(latex) {
  return typeof latex === 'string' && /^-?\d+$/.test(latex.trim());
}

// Унарный минус: в начале выражения, сразу после скобки или после знака
// операции. Вычитание («12 - 4,6») минусом числа не считается — иначе
// вместе с отрицательными числами из листа ушла бы половина примеров.
const UNARY_MINUS = /(^|\(|\{|[+\-:]\s*|\\cdot\s*)\s*-/;

/** Есть ли в задании отрицательное число — в условии или в ответе. */
export function hasNegativeNumber(exprLatex, resultLatex = '') {
  if (String(resultLatex).trim().startsWith('-')) return true;
  return UNARY_MINUS.test(String(exprLatex ?? ''));
}

/** Смешанное число → неправильная дробь: 1\dfrac{3}{4} → \dfrac{7}{4}. */
export function toImproperFraction(latex) {
  const m = /^(-?)(\d+)\\dfrac\{(\d+)\}\{(\d+)\}$/.exec(String(latex ?? ''));
  if (!m) return latex;
  const [, sign, whole, n, d] = m;
  return `${sign}\\dfrac{${Number(whole) * Number(d) + Number(n)}}{${d}}`;
}
