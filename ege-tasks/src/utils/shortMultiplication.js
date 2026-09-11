/**
 * Формулы сокращённого умножения как приём устного счёта.
 *
 * Задания этого модуля считаются в голове только «по формуле»: 51² школьник
 * напишет в столбик, а (50 + 1)² = 2500 + 100 + 1 посчитает устно. Поэтому
 * числа подбираются вокруг круглого — иначе приём не включается и задание
 * теряет смысл.
 *
 * Значения точные (рациональные из `linearExpr`), и условие, и ответ строятся
 * из одного и того же числа — разойтись они не могут.
 *
 * Домен задаёт, каким языком говорит раздел устного счёта:
 *   'int' — целые (арифметика)
 *   'dec' — десятичные (действия с десятичными)
 *   'mix' — смешанные числа и обыкновенные дроби
 * Корни живут отдельно — `fsuConjRoots` и соседи (степени и корни).
 */

import {
  rat, addR, subR, mulR, divR, niceDecimal, decTex, gcd,
  rand, randInt, chance,
} from './linearExpr';

// ─── Числа задания ───────────────────────────────────────────────────────────
// Число печатается по-разному в произведении и под степенью: 1½ в квадрате
// требует скобок, а 51 — нет. Поэтому у числа две записи: `tex` и `pow`.

const mkInt = (k) => ({ r: rat(k), tex: String(k), pow: String(k) });

function mkDec(r) {
  const t = decTex(r);
  return t === null ? null : { r, tex: t, pow: t };
}

function mkMixed(whole, n, d) {
  const tex = whole ? `${whole}\\dfrac{${n}}{${d}}` : `\\dfrac{${n}}{${d}}`;
  return {
    r: rat(whole * d + n, d),
    tex,
    pow: `\\left(${tex}\\right)`,
  };
}

// Рациональное число → запись смешанным числом (7/2 → 3½)
function mixedOf(r) {
  if (r.d === 1) return mkInt(r.n);
  const whole = Math.floor(r.n / r.d);
  return mkMixed(whole, r.n - whole * r.d, r.d);
}

// ─── Ответ ───────────────────────────────────────────────────────────────────
/**
 * Ответ в языке раздела: 'auto' — целое, короткое десятичное или смешанное
 * число; 'dec' — только конечная десятичная запись; 'mix' — смешанное число.
 * null — таким ответом задание печатать нельзя, его надо отбросить.
 */
export function fsuAnswerTex(r, style = 'auto') {
  if (!r) return null;
  if (r.d === 1) return String(r.n);
  if (style === 'dec') return niceDecimal(r, 4) ? decTex(r) : null;
  if (style === 'auto' && niceDecimal(r, 4)) return decTex(r);

  const neg = r.n < 0;
  const n = Math.abs(r.n);
  const whole = Math.floor(n / r.d);
  const rem = n - whole * r.d;
  const body = whole
    ? `${whole}\\dfrac{${rem}}{${r.d}}`
    : `\\dfrac{${rem}}{${r.d}}`;
  return neg ? `-${body}` : body;
}

// Собрать готовое задание: ответ считаем из значения, а не из строки
function task(exprLatex, value, style) {
  const resultLatex = fsuAnswerTex(value, style);
  return resultLatex === null ? null : { exprLatex, resultLatex, value };
}

// ─── Пулы ────────────────────────────────────────────────────────────────────
const ROUND      = [20, 30, 40, 50, 60, 70, 80, 90, 100];
const DELTA      = [1, 2, 3, 4, 5];
const CUBE_NEAR  = [7, 8, 9, 11, 12, 13, 18, 19, 21];
const MIX_DENS   = [2, 3, 4];
const NONSQUARES = [2, 3, 5, 6, 7, 10, 11, 13, 15, 17, 19, 21, 23];

// Десятичный вариант: то же целое, сдвинутое на разряд-два
const shift = (k, p) => rat(k, p);

// ─── (a ± b)² = a² ± 2ab + b² ────────────────────────────────────────────────

/** Квадрат числа рядом с круглым: 51², 98², 1,02², (1½)² */
export function fsuSquareNear({ domain = 'int', style = 'auto' } = {}) {
  if (domain === 'mix') {
    const d = rand(MIX_DENS);
    const n = rand(d === 2 ? [1] : d === 3 ? [1, 2] : [1, 3]);
    const x = mkMixed(randInt(1, 4), n, d);
    return task(`${x.pow}^2`, mulR(x.r, x.r), style);
  }

  const base = rand(ROUND);
  const n = base + rand(DELTA) * (chance(0.5) ? 1 : -1);
  if (n <= 10 || n * n > 11500) return null;

  if (domain === 'dec') {
    const x = mkDec(shift(n, chance(0.6) ? 10 : 100));
    if (!x) return null;
    return task(`${x.pow}^2`, mulR(x.r, x.r), style);
  }
  return task(`${n}^2`, rat(n * n), style);
}

/** Свёртка полного квадрата: 37² + 2·37·13 + 13² */
export function fsuFoldSquare({ domain = 'int', style = 'auto' } = {}) {
  const m = rand([20, 30, 40, 50, 60, 70]);
  const plus = chance(0.55);

  // Сумма: a + b = m. Разность: a − b = m, тогда a = m + b
  const b = plus ? randInt(Math.ceil(m / 4), Math.floor(m / 2) - 1) : randInt(11, 49);
  const a = plus ? m - b : m + b;
  if (a <= 0 || b <= 0 || a === b || a > 99) return null;

  const p = domain === 'dec' ? 10 : 1;
  const ax = p === 1 ? mkInt(a) : mkDec(shift(a, p));
  const bx = p === 1 ? mkInt(b) : mkDec(shift(b, p));
  if (!ax || !bx) return null;

  const sign = plus ? '+' : '-';
  const expr =
    `${ax.pow}^2 ${sign} 2 \\cdot ${ax.tex} \\cdot ${bx.tex} + ${bx.pow}^2`;
  const value = mulR(shift(m, p), shift(m, p));
  return task(expr, value, style);
}

// ─── (a − b)(a + b) = a² − b² ────────────────────────────────────────────────

/** Сопряжённое произведение: 43 · 37, 2,1 · 1,9, 1½ · 2½ */
export function fsuConjProduct({ domain = 'int', style = 'auto' } = {}) {
  if (domain === 'mix') {
    const d = rand(MIX_DENS);
    const n = rand(d === 2 ? [1] : d === 3 ? [1, 2] : [1, 3]);
    const m = randInt(2, 6);
    const delta = rat(n, d);
    const lo = mixedOf(subR(rat(m), delta));
    const hi = mixedOf(addR(rat(m), delta));
    const value = subR(mulR(rat(m), rat(m)), mulR(delta, delta));
    return task(`${lo.tex} \\cdot ${hi.tex}`, value, style);
  }

  const m = rand(ROUND);
  const d = rand(DELTA);
  if (m - d <= 10) return null;

  const p = domain === 'dec' ? rand([10, 100]) : 1;
  const lo = p === 1 ? mkInt(m - d) : mkDec(shift(m - d, p));
  const hi = p === 1 ? mkInt(m + d) : mkDec(shift(m + d, p));
  if (!lo || !hi) return null;

  const value = divR(rat(m * m - d * d), rat(p * p));
  const expr = chance(0.5)
    ? `${lo.tex} \\cdot ${hi.tex}`
    : `${hi.tex} \\cdot ${lo.tex}`;
  return task(expr, value, style);
}

/** Разность квадратов: 27² − 23², 2,7² − 2,3², (3½)² − (2½)² */
export function fsuDiffSquares({ domain = 'int', style = 'auto' } = {}) {
  if (domain === 'mix') {
    const den = rand(MIX_DENS);
    const n = rand(den === 2 ? [1] : den === 3 ? [1, 2] : [1, 3]);
    const w2 = randInt(1, 3);
    const w1 = w2 + randInt(1, 3);
    const a = mkMixed(w1, n, den);
    const b = mkMixed(w2, n, den);
    const value = subR(mulR(a.r, a.r), mulR(b.r, b.r));
    return task(`${a.pow}^2 - ${b.pow}^2`, value, style);
  }

  // a + b = m, a − b = d — обе одной чётности, иначе a и b не целые
  const m = rand(ROUND);
  const d = rand([2, 4, 6, 8, 10]);
  if (d >= m) return null;
  const a = (m + d) / 2;
  const b = (m - d) / 2;

  const p = domain === 'dec' ? 10 : 1;
  const ax = p === 1 ? mkInt(a) : mkDec(shift(a, p));
  const bx = p === 1 ? mkInt(b) : mkDec(shift(b, p));
  if (!ax || !bx) return null;

  const value = divR(rat(m * d), rat(p * p));
  return task(`${ax.pow}^2 - ${bx.pow}^2`, value, style);
}

/** Разность квадратов в дроби: (37² − 13²) / (37 − 13) */
export function fsuQuotSquares({ domain = 'int', style = 'auto' } = {}) {
  const a = randInt(12, 48);
  const b = randInt(3, a - 2);
  const bySum = chance(0.45);

  const p = domain === 'dec' ? 10 : 1;
  const ax = p === 1 ? mkInt(a) : mkDec(shift(a, p));
  const bx = p === 1 ? mkInt(b) : mkDec(shift(b, p));
  if (!ax || !bx) return null;

  const den = bySum ? `${ax.tex} + ${bx.tex}` : `${ax.tex} - ${bx.tex}`;
  const value = bySum ? subR(ax.r, bx.r) : addR(ax.r, bx.r);
  return task(`\\dfrac{${ax.pow}^2 - ${bx.pow}^2}{${den}}`, value, style);
}

// ─── Кубы ────────────────────────────────────────────────────────────────────

/** Куб числа рядом с круглым: 11³, 19³, 1,1³ */
export function fsuCubeNear({ domain = 'int', style = 'auto' } = {}) {
  const n = rand(CUBE_NEAR);
  if (domain === 'dec') {
    const x = mkDec(shift(n, 10));
    if (!x) return null;
    return task(`${x.pow}^3`, mulR(mulR(x.r, x.r), x.r), style);
  }
  return task(`${n}^3`, rat(n * n * n), style);
}

/** Сумма и разность кубов в дроби: (7³ + 3³) / (7 + 3) */
export function fsuQuotCubes({ style = 'auto' } = {}) {
  const a = randInt(3, 9);
  const b = randInt(1, a - 1);
  const plus = chance(0.5);
  const sign = plus ? '+' : '-';
  // (a³ ± b³) : (a ± b) = a² ∓ ab + b²
  const value = rat(a * a + (plus ? -a * b : a * b) + b * b);
  return task(`\\dfrac{${a}^3 ${sign} ${b}^3}{${a} ${sign} ${b}}`, value, style);
}

// ─── Корни ───────────────────────────────────────────────────────────────────
// Ответы здесь рациональные: иррациональная часть уходит по формуле, за это
// задания и берут — «увидел сопряжённое, посчитал в голове».

const sq = (k, m) => (k === 1 ? `\\sqrt{${m}}` : `${k}\\sqrt{${m}}`);

/** Сопряжённые корни: (√7 − √3)(√7 + √3) = 4 */
export function fsuConjRoots({ style = 'auto' } = {}) {
  const kind = rand(['roots', 'rootInt', 'scaled']);

  if (kind === 'rootInt') {                       // (√a − n)(√a + n) = a − n²
    const n = rand([1, 2, 3]);
    const a = rand(NONSQUARES.filter(v => v > n * n));
    const value = rat(a - n * n);
    return task(
      `\\left(\\sqrt{${a}} - ${n}\\right)\\left(\\sqrt{${a}} + ${n}\\right)`,
      value, style,
    );
  }

  if (kind === 'scaled') {                        // (k√a − √b)(k√a + √b)
    const k = rand([2, 3]);
    const a = rand([2, 3, 5, 6, 7]);
    const b = rand(NONSQUARES.filter(v => v !== k * k * a && v < k * k * a));
    return task(
      `\\left(${sq(k, a)} - \\sqrt{${b}}\\right)\\left(${sq(k, a)} + \\sqrt{${b}}\\right)`,
      rat(k * k * a - b), style,
    );
  }

  const a = rand(NONSQUARES);                     // (√a − √b)(√a + √b) = a − b
  const b = rand(NONSQUARES.filter(v => v < a));
  if (b === undefined) return null;               // a — наименьшее в пуле
  const flip = chance(0.5);
  const first = flip ? `\\sqrt{${a}} + \\sqrt{${b}}` : `\\sqrt{${a}} - \\sqrt{${b}}`;
  const second = flip ? `\\sqrt{${a}} - \\sqrt{${b}}` : `\\sqrt{${a}} + \\sqrt{${b}}`;
  return task(`\\left(${first}\\right)\\left(${second}\\right)`, rat(a - b), style);
}

/** Квадрат суммы корней без двойного произведения: (√5 + √3)² − 2√15 = 8 */
export function fsuFoldRoots({ style = 'auto' } = {}) {
  const a = rand(NONSQUARES);
  const b = rand(NONSQUARES.filter(v => v < a && gcd(v, a) === 1));
  if (b === undefined) return null;

  const plus = chance(0.5);
  const inner = plus ? `\\sqrt{${a}} + \\sqrt{${b}}` : `\\sqrt{${a}} - \\sqrt{${b}}`;
  const tail = plus ? `- 2\\sqrt{${a * b}}` : `+ 2\\sqrt{${a * b}}`;
  return task(`\\left(${inner}\\right)^2 ${tail}`, rat(a + b), style);
}

/** Сумма квадратов сопряжённых: (√6 + 1)² + (√6 − 1)² = 14 */
export function fsuSumSquaresRoots({ style = 'auto' } = {}) {
  const a = rand(NONSQUARES);
  const asInt = chance(0.5);
  const b = asInt
    ? rand([1, 2, 3])
    : rand(NONSQUARES.filter(v => v !== a));
  const bTex = asInt ? String(b) : `\\sqrt{${b}}`;
  const bSquare = asInt ? b * b : b;
  return task(
    `\\left(\\sqrt{${a}} + ${bTex}\\right)^2 + \\left(\\sqrt{${a}} - ${bTex}\\right)^2`,
    rat(2 * (a + bSquare)), style,
  );
}

// ─── Метки ───────────────────────────────────────────────────────────────────
// Подписи общие для всех разделов устного счёта: формула одна и та же,
// меняются только числа, которыми раздел говорит.
export const FSU_LABELS = {
  fsuSquareNear:  'Квадрат рядом с круглым: 51²',
  fsuConjProduct: 'Сопряжённое произведение: 43 · 37',
  fsuDiffSquares: 'Разность квадратов: 27² − 23²',
  fsuFoldSquare:  'Свёртка квадрата: 37² + 2·37·13 + 13²',
  fsuQuotSquares: 'Дробь с разностью квадратов',
  fsuCubeNear:    'Куб рядом с круглым: 11³',
  fsuQuotCubes:   'Сумма и разность кубов',
};

export const FSU_ROOT_LABELS = {
  fsuConjRoots:       'Сопряжённые корни: (√7 − √3)(√7 + √3)',
  fsuFoldRoots:       'Квадрат суммы корней: (√5 + √3)² − 2√15',
  fsuSumSquaresRoots: 'Сумма квадратов: (√6 + 1)² + (√6 − 1)²',
};

// Подписи на языке раздела: формула та же, числа другие
export const FSU_DEC_LABELS = {
  fsuSquareNear:  'Квадрат рядом с круглым: 1,02²',
  fsuConjProduct: 'Сопряжённое произведение: 2,1 · 1,9',
  fsuDiffSquares: 'Разность квадратов: 2,7² − 2,3²',
  fsuFoldSquare:  'Свёртка квадрата: 3,7² + 2·3,7·1,3 + 1,3²',
  fsuQuotSquares: 'Дробь с разностью квадратов',
  fsuCubeNear:    'Куб рядом с круглым: 1,1³',
};

export const FSU_MIX_LABELS = {
  fsuSquareNear:  'Квадрат смешанного: (1½)²',
  fsuConjProduct: 'Сопряжённые смешанные: 1½ · 2½',
  fsuDiffSquares: 'Разность квадратов: (3½)² − (2½)²',
};

export const FSU_KEYS = Object.keys(FSU_LABELS);
export const FSU_ROOT_KEYS = Object.keys(FSU_ROOT_LABELS);
export const FSU_DEC_KEYS = Object.keys(FSU_DEC_LABELS);
export const FSU_MIX_KEYS = Object.keys(FSU_MIX_LABELS);

/**
 * Какие формулы уместны в домене. Смешанные числа не возводим в куб и не
 * делим — «(2½)³» устно уже не считают; сумма и разность кубов живёт только
 * на целых.
 */
export const FSU_DOMAIN_KEYS = {
  int: FSU_KEYS,
  dec: FSU_DEC_KEYS,
  mix: FSU_MIX_KEYS,
};

/**
 * Набор генераторов ФСУ для раздела: домен и вид ответа фиксируются один раз,
 * дальше раздел просто вызывает `GENERATORS[cat]()`.
 */
export function fsuGenerators({
  domain = 'int', style = 'auto', domains = null, keys = null,
} = {}) {
  // Раздел может говорить сразу на двух языках (арифметика — целые и
  // десятичные): тогда домен выбирается на каждое задание.
  const pick = () => (domains ? rand(domains) : domain);
  const opts = () => ({ domain: pick(), style });

  const all = {
    fsuSquareNear:  () => fsuSquareNear(opts()),
    fsuConjProduct: () => fsuConjProduct(opts()),
    fsuDiffSquares: () => fsuDiffSquares(opts()),
    fsuFoldSquare:  () => fsuFoldSquare(opts()),
    fsuQuotSquares: () => fsuQuotSquares(opts()),
    fsuCubeNear:    () => fsuCubeNear(opts()),
    fsuQuotCubes:   () => fsuQuotCubes({ style }),
  };

  const allowed = keys || [...new Set(
    (domains || [domain]).flatMap(d => FSU_DOMAIN_KEYS[d] || FSU_KEYS),
  )];
  return Object.fromEntries(allowed.map(k => [k, all[k]]).filter(([, fn]) => fn));
}

export function fsuRootGenerators({ style = 'auto' } = {}) {
  return {
    fsuConjRoots:       () => fsuConjRoots({ style }),
    fsuFoldRoots:       () => fsuFoldRoots({ style }),
    fsuSumSquaresRoots: () => fsuSumSquaresRoots({ style }),
  };
}

// Дефолтные флаги категорий: ФСУ — отдельный блок, по умолчанию выключен,
// чтобы состав листа «как было» не менялся у тех, кто его уже настроил.
export const fsuDefaults = (keys = FSU_KEYS, value = false) =>
  Object.fromEntries(keys.map(k => [k, value]));
