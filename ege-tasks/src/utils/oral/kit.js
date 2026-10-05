/**
 * Общие заготовки параметрических генераторов устного счёта.
 *
 * Задание строится из точных рациональных чисел (`linearExpr`): и условие, и
 * ответ печатаются из одного значения, поэтому разойтись не могут. Ответ
 * печатается так, как его пишут на экзамене: целое, конечная десятичная
 * дробь, и только если её нет — обыкновенная дробь.
 */
import {
  rat, addR, subR, mulR, divR, negR, absR, toNum, gcd,
  decTex, niceDecimal, isTerminating, rand, randInt, chance,
} from '../linearExpr';

export {
  rat, addR, subR, mulR, divR, negR, absR, toNum, gcd,
  decTex, niceDecimal, isTerminating, rand, randInt, chance,
};

/** Значение по уровню: `{1: …, 2: …, 3: …}`, недостающий — от соседнего. */
export function byLevel(level, table) {
  return table[level] ?? table[2] ?? table[1] ?? table[3];
}

/** Перемешанная копия массива. */
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Обыкновенная дробь со знаком впереди: -\dfrac{3}{4}. */
export function fracTex(r) {
  if (r.d === 1) return String(r.n);
  return r.n < 0 ? `-\\dfrac{${-r.n}}{${r.d}}` : `\\dfrac{${r.n}}{${r.d}}`;
}

/** Смешанное число: 7/2 → 3\dfrac{1}{2}; правильная дробь — как есть. */
export function mixedTex(r) {
  if (r.d === 1) return String(r.n);
  const a = Math.abs(r.n);
  const whole = Math.floor(a / r.d);
  const rest = a - whole * r.d;
  const sign = r.n < 0 ? '-' : '';
  if (!whole) return `${sign}\\dfrac{${rest}}{${r.d}}`;
  return `${sign}${whole}\\dfrac{${rest}}{${r.d}}`;
}

/**
 * Число в условии. `style`: 'dec' — десятичной записью (если её нет — null),
 * 'frac' — обыкновенной дробью, 'mixed' — смешанным числом.
 */
export function numTex(r, style = 'dec') {
  if (r.d === 1) return String(r.n);
  if (style === 'dec') return decTex(r);
  if (style === 'mixed') return mixedTex(r);
  return fracTex(r);
}

/** Отрицательное число в произведении/после знака — в скобках. */
export function par(tex) {
  return String(tex).startsWith('-') ? `(${tex})` : String(tex);
}

/** То же для дроби: \left(-\dfrac{1}{2}\right). */
export function parFrac(tex) {
  return String(tex).startsWith('-') ? `\\left(${tex}\\right)` : String(tex);
}

/**
 * Ответ так, как его пишут в бланке: целое, десятичная (не длиннее
 * `maxDigits` знаков) или обыкновенная дробь.
 */
export function answerTex(r, { maxDigits = 4 } = {}) {
  if (!r) return null;
  if (r.d === 1) return String(r.n);
  if (niceDecimal(r, maxDigits)) return decTex(r);
  return fracTex(r);
}

/** Готовое задание; `null`, если значения нет. */
export function task(exprLatex, r, opts) {
  if (!r || !exprLatex) return null;
  const resultLatex = answerTex(r, opts);
  return resultLatex == null ? null : { exprLatex, resultLatex };
}

/**
 * Образцы из банка («Решу», ФИПИ) подмешиваются на уровне «Как на экзамене»:
 * реальные формулировки не теряются, а параметрический генератор даёт объём.
 * `share` — доля образцов; повторы между ними снимает план листа.
 */
export function withOriginals(level, originals, make, { share = 0.3, levels = [2] } = {}) {
  if (originals?.length && levels.includes(level) && Math.random() < share) {
    const p = rand(originals);
    return { exprLatex: p.expr, resultLatex: p.ans };
  }
  return make(level);
}

/** Целая степень: a^k для целых a, k ≥ 0. */
export const ipow = (a, k) => {
  let r = 1;
  for (let i = 0; i < k; i++) r *= a;
  return r;
};

/** Рациональная степень с целым показателем (k может быть отрицательным). */
export function rpow(r, k) {
  if (k >= 0) return rat(ipow(r.n, k), ipow(r.d, k));
  return r.n === 0 ? null : rat(ipow(r.d, -k), ipow(r.n, -k));
}

/** Десятичная запись числа, которое заведомо конечное (0,25 и т. п.). */
export function dec(n, d = 1) {
  return decTex(rat(n, d));
}
