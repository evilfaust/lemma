import { rat, decTex, niceDecimal } from './linearExpr';

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

// ─── Ответ «как в бланке» ─────────────────────────────────────────────────────

// Сколько знаков после запятой ещё считаем устным ответом: 0,0625 — да,
// 0,03125 — уже нет (такую дробь на экзамене в первой части не дают).
export const EXAM_MAX_DIGITS = 4;

const FRAC = String.raw`\\[dt]?frac\{(\d+)\}\{(\d+)\}`;
const MIXED_RE = new RegExp(String.raw`^(-?)(\d+)?\s*${FRAC}$`);
const DECIMAL_RE = /^(-?)(\d+)(?:\{,\}|[.,])(\d+)$/;

/** Число из записи ответа: целое, десятичная, дробь, смешанное. Иначе null. */
export function parseAnswerNumber(latex) {
  if (typeof latex !== 'string') return null;
  const s = latex.trim().replace(/^\{(.*)\}$/, '$1').replace(/^−/, '-');
  if (/^-?\d+$/.test(s)) return rat(Number(s));
  let m = DECIMAL_RE.exec(s);
  if (m) {
    const [, sign, whole, frac] = m;
    const r = rat(Number(whole + frac), 10 ** frac.length);
    return sign ? rat(-r.n, r.d) : r;
  }
  m = MIXED_RE.exec(s);
  if (m) {
    const [, sign, whole, n, d] = m;
    if (Number(d) === 0) return null;
    const r = rat((Number(whole) || 0) * Number(d) + Number(n), Number(d));
    return sign ? rat(-r.n, r.d) : r;
  }
  return null;
}

/**
 * Ответ так, как его пишут в бланке первой части ОГЭ и ЕГЭ: целое число или
 * конечная десятичная дробь. Дробь с конечной записью переписывается
 * десятичной (1\dfrac{3}{4} → 1{,}75, \dfrac{1}{4} → 0{,}25); дробь без неё,
 * корень, π, логарифм — null: такой ответ в бланк не впишешь.
 */
export function examAnswerLatex(latex, { maxDigits = EXAM_MAX_DIGITS } = {}) {
  const r = parseAnswerNumber(latex);
  if (!r) return null;
  if (r.d === 1) return String(r.n);
  return niceDecimal(r, maxDigits) ? decTex(r) : null;
}

/**
 * Строка для ученика под инструкцией листа: в каком виде писать ответ.
 * null — ответ не ограничен, строки нет.
 */
export function examAnswerNote(settings = {}) {
  if (settings.integerOnly) return 'Ответ — целое число.';
  if (settings.decimalOnly) return 'Ответ — целое число или конечная десятичная дробь.';
  return null;
}
