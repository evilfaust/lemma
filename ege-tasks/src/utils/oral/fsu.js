/**
 * Раздел «Формулы сокращённого умножения»: разминка на 5–7 минут в начале
 * урока — раскрыть скобки, свернуть (разложить на множители), вставить
 * пропуски, корни как в иррациональных уравнениях, устный счёт по формуле.
 *
 * Каждый тип строит задание из «частей» формулы (A, B, знак): условие,
 * ответ и типичные ошибки (для теста A/B/C/D) считаются из них алгеброй
 * `fsuAlgebra.js`. Ошибка, которая случайно совпала с ответом по значению
 * ((2 − √3)² и (√3 − 2)²), в варианты ответа не попадает.
 *
 * Уровень меняет части, а не набор типов: на разминке (x + 3)², на «как на
 * экзамене» (2a − 5b)², на «сложнее» (x² + 3)², (½x − 4)², две буквы с
 * коэффициентами, общий множитель.
 *
 * Сторож — `__tests__/fsuSection.test.js`: каждое задание пересчитывается
 * подстановкой чисел в НАПЕЧАТАННОЕ условие и ответ.
 */
import {
  num, mono, add, neg, sub, mul, pow, sqrt, scale, equal, tex, sorted,
} from './fsuAlgebra';
import { rat, rand, randInt, chance, gcd } from '../linearExpr';
import {
  fsuSquareNear, fsuConjProduct, fsuDiffSquares, fsuFoldSquare,
  fsuQuotSquares, fsuConjRoots, fsuFoldRoots, fsuSumSquaresRoots,
} from '../shortMultiplication';

// ─── Буквы и части ───────────────────────────────────────────────────────────

const LETTERS = ['x', 'a', 'y', 'b', 'm', 'c', 't', 'p'];
const PAIRS = [['a', 'b'], ['x', 'y'], ['m', 'n'], ['p', 'q'], ['a', 'c']];
const NONSQ = [2, 3, 5, 6, 7, 10, 11];

const letter = () => rand(LETTERS);
/** Число, взаимно простое с k: (4t − 2)² прячет общий множитель 4. */
const coprime = (k, lo, hi) => rand(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(t => gcd(t, k) === 1));
/** Два разных взаимно простых коэффициента 2…5. */
function coefPair() {
  const k = randInt(2, 5);
  return [k, coprime(k, 2, 5)];
}
const pair = () => rand(PAIRS);
/** k·v^e одной буквой. */
const v = (name, k = 1, e = 1) => mono(k, { [name]: e });
const n = (k, d = 1) => num(k, d);
const sgnTex = (s) => (s > 0 ? '+' : '-');
const sc = (p, s) => (s > 0 ? p : neg(p));
const ksq = (k) => k * k;

/** «A ± B» в порядке построения (5 − a, а не −a + 5). */
const bin = (A, s, B) => `${tex(A)} ${sgnTex(s)} ${tex(B)}`;
const br = (t) => `\\left(${t}\\right)`;

/**
 * Многочлен ответа: ведущий член с минусом печатается с младших
 * (25 − x², 1 + 2x − x²) — так пишут в тетради.
 */
function nice(p, { shuffle = false } = {}) {
  const lead = sorted(p)[0];
  if (lead && lead.c.n < 0 && p.some(t => t.c.n > 0)) return tex(p, { order: 'asc' });
  if (shuffle && p.length > 2 && chance(0.3)) return tex(p, { order: 'asc' });
  return tex(p);
}

// ─── Задание ─────────────────────────────────────────────────────────────────

export const FSU_INSTRUCTIONS = {
  expand:  'Раскройте скобки:',
  combo:   'Упростите выражение:',
  factor:  'Разложите на множители:',
  square:  'Представьте в виде квадрата или произведения:',
  fill:    'Вставьте пропущенные одночлены:',
  calc:    'Вычислите:',
};

/**
 * `answer` — значение ответа (многочлен) для отсева ошибок, совпавших с ним;
 * `mistakes` — `[tex, значение]`. `prompt: 'answer'` — строка кончается
 * «Ответ:», а не «=» (в условии уже есть знак равенства).
 */
function task(kind, exprLatex, resultLatex, answer, mistakes = [], extra = {}) {
  const seen = new Set([resultLatex]);
  const own = [];
  for (const [t, val] of mistakes) {
    if (!t || seen.has(t)) continue;
    if (val && answer && equal(val, answer)) continue;
    seen.add(t);
    own.push(t);
  }
  return {
    exprLatex, resultLatex, kind,
    instruction: extra.instruction || FSU_INSTRUCTIONS[kind],
    ...(own.length ? { mistakes: own.slice(0, 3) } : {}),
    ...(extra.prompt ? { prompt: extra.prompt } : {}),
  };
}

// ─── Части формулы по уровню ─────────────────────────────────────────────────

/**
 * Пара одночленов (A, B) для квадрата суммы/разности и разности квадратов.
 * `numFirst` — первым стоит число: (5 − a).
 */
function binomParts(level, { allowNumFirst = true, allowFrac = true } = {}) {
  if (level === 1) {
    if (chance(0.25)) { const [a, b] = pair(); return { A: v(a), B: v(b) }; }
    const x = letter();
    const k = randInt(1, 10);
    if (allowNumFirst && chance(0.15)) return { A: n(randInt(2, 9)), B: v(x) };
    return { A: v(x), B: n(k) };
  }
  if (level === 2) {
    const x = letter();
    const [a, b] = pair();
    const kind = rand(['kx', 'kx', 'kb', 'ka', 'numFirst']);
    if (kind === 'kx') { const k = randInt(2, 5); return { A: v(x, k), B: n(coprime(k, 1, 7)) }; }
    if (kind === 'kb') return { A: v(a), B: v(b, randInt(2, 4)) };
    if (kind === 'ka') return { A: v(a, randInt(2, 4)), B: v(b) };
    const k = rand([1, 1, 2, 3]);
    return allowNumFirst
      ? { A: n(coprime(k, 2, 9)), B: v(x, k) }
      : { A: v(x, k + 1), B: n(coprime(k + 1, 1, 7)) };
  }
  const x = letter();
  const [a, b] = pair();
  const kinds = ['kakb', 'kakb', 'x2', 'a2b'];
  if (allowFrac) kinds.push('frac');
  const kind = rand(kinds);
  if (kind === 'kakb') {
    const [k, m] = coefPair();
    return { A: v(a, k), B: v(b, m) };
  }
  if (kind === 'x2') { const k = rand([1, 1, 2, 3]); return { A: v(x, k, 2), B: n(coprime(k, 1, 6)) }; }
  if (kind === 'a2b') return { A: v(a, 1, 2), B: v(b, rand([1, 2, 3])) };
  // ½x ± 4, ⅓x ± 3: двойное произведение остаётся целым
  const d = rand([2, 3]);
  const k = d === 2 ? randInt(1, 6) : 3 * randInt(1, 2);
  return { A: mono(rat(1, d), { [x]: 1 }), B: n(k) };
}

// ─── Раскрыть скобки ─────────────────────────────────────────────────────────

const square = (A, s, B) => pow(add(A, sc(B, s)), 2);

/** (A ± B)² = A² ± 2AB + B² */
function sqBinom(level) {
  const { A, B } = binomParts(level);
  const s = chance(0.5) ? 1 : -1;
  const ans = square(A, s, B);
  const A2 = pow(A, 2);
  const B2 = pow(B, 2);
  const AB = mul(A, B);
  const mistakes = [
    add(A2, sc(B2, s)),                                // a² ± b²
    add(A2, sc(AB, s), B2),                            // ab вместо 2ab
    add(A2, sc(scale(AB, 2), -s), B2),                 // не тот знак
  ];
  // (3x)² = 3x²: коэффициент не возведён
  const c = A[0]?.c;
  if (A.length === 1 && Object.keys(A[0].vars).length && c && !(c.n === 1 && c.d === 1)) {
    const vars = Object.fromEntries(Object.entries(A[0].vars).map(([k, e]) => [k, e * 2]));
    mistakes.push(add(mono(c, vars), sc(scale(AB, 2), s), B2));
  }
  return task('expand', `${br(bin(A, s, B))}^2`, nice(ans), ans,
    mistakes.map(p => [nice(p), p]));
}

/** (A − B)(A + B) = A² − B² */
function conj(level) {
  const { A, B } = binomParts(level);
  const ans = sub(pow(A, 2), pow(B, 2));
  let f1 = br(bin(A, -1, B));
  let f2 = br(bin(A, 1, B));
  // (3 + x)(x − 3): сумма записана «с другой стороны»
  if (level > 1 && chance(0.3)) f2 = br(bin(B, 1, A));
  const exprLatex = chance(0.5) ? f1 + f2 : f2 + f1;
  const mistakes = [
    add(pow(A, 2), pow(B, 2)),
    sub(pow(B, 2), pow(A, 2)),
    square(A, -1, B),
  ];
  return task('expand', exprLatex, nice(ans), ans, mistakes.map(p => [nice(p), p]));
}

function cubeParts(level) {
  const x = letter();
  const [a, b] = pair();
  if (level === 1) return chance(0.2) ? { A: v(a), B: v(b) } : { A: v(x), B: n(rand([1, 2])) };
  if (level === 2) {
    return rand([
      () => ({ A: v(x), B: n(randInt(1, 4)) }),
      () => ({ A: v(x, 2), B: n(rand([1, 3])) }),
      () => ({ A: v(a), B: v(b) }),
    ])();
  }
  return rand([
    () => { const k = rand([2, 3]); return { A: v(x, k), B: n(coprime(k, 1, 3)) }; },
    () => ({ A: v(a), B: v(b, 2) }),
    () => ({ A: v(a, 2), B: v(b) }),
    () => ({ A: n(rand([1, 2, 3])), B: v(x) }),
  ])();
}

/** (A ± B)³ */
function cube(level) {
  const { A, B } = cubeParts(level);
  const s = chance(0.5) ? 1 : -1;
  const ans = pow(add(A, sc(B, s)), 3);
  const A3 = pow(A, 3);
  const B3 = pow(B, 3);
  const A2B = mul(pow(A, 2), B);
  const AB2 = mul(A, pow(B, 2));
  const mistakes = [
    add(A3, sc(B3, s)),                                  // забыли середину
    add(A3, sc(A2B, s), AB2, sc(B3, s)),                 // забыли тройки
    s < 0
      ? add(A3, neg(scale(A2B, 3)), neg(scale(AB2, 3)), neg(B3))   // «все минусы»
      : pow(sub(A, B), 3),
  ];
  return task('expand', `${br(bin(A, s, B))}^3`, nice(ans), ans, mistakes.map(p => [nice(p), p]));
}

function sumCubeParts(level) {
  const x = letter();
  const [a, b] = pair();
  if (level === 1) return { A: v(x), B: n(randInt(1, 4)) };
  if (level === 2) {
    return rand([
      () => ({ A: v(x), B: n(randInt(1, 5)) }),
      () => { const k = rand([2, 3]); return { A: v(x, k), B: n(coprime(k, 1, 3)) }; },
      () => ({ A: v(a), B: v(b) }),
    ])();
  }
  return rand([
    () => ({ A: v(a), B: v(b, rand([2, 3])) }),
    () => ({ A: v(x, 1, 2), B: n(rand([1, 2])) }),
    () => ({ A: v(a, 2), B: v(b, 3) }),
  ])();
}

/** (A ± B)(A² ∓ AB + B²) = A³ ± B³ */
function sumCubes(level) {
  const { A, B } = sumCubeParts(level);
  const s = chance(0.5) ? 1 : -1;
  const Q = add(pow(A, 2), sc(mul(A, B), -s), pow(B, 2));
  const ans = add(pow(A, 3), sc(pow(B, 3), s));
  const f1 = br(bin(A, s, B));
  const f2 = br(tex(Q));
  const exprLatex = level > 1 && chance(0.3) ? f2 + f1 : f1 + f2;
  const mistakes = [
    add(pow(A, 3), sc(pow(B, 3), -s)),
    pow(add(A, sc(B, s)), 3),
    mul(add(A, sc(B, s)), add(pow(A, 2), sc(mul(A, B), s), pow(B, 2))),
  ];
  return task('expand', exprLatex, nice(ans), ans, mistakes.map(p => [nice(p), p]));
}

// ─── Упростить: несколько формул в одном выражении ───────────────────────────

/**
 * Часть выражения: `{ sgn, f, A, B, s }`, f — sq | conj | cube | sumcubes |
 * plain (одночлен как есть). Значение и запись — из одной части.
 */
function partValue(p, mode = 'ok') {
  const { f, A, B, s } = p;
  if (f === 'plain') return A;
  if (f === 'sq') {
    const A2 = pow(A, 2);
    const B2 = pow(B, 2);
    const AB2 = scale(mul(A, B), 2);
    if (mode === 'noMid') return add(A2, B2);
    if (mode === 'signMid') return add(A2, sc(AB2, -s), B2);
    if (mode === 'halfMid') return add(A2, sc(mul(A, B), s), B2);
    if (mode === 'b2asB') return add(A2, sc(AB2, s), B);          // 3² = 3
    return add(A2, sc(AB2, s), B2);
  }
  if (f === 'conj') {
    if (mode === 'noMid') return add(pow(A, 2), pow(B, 2));
    if (mode === 'halfMid') return sub(pow(B, 2), pow(A, 2));     // b² − a²
    if (mode === 'b2asB') return sub(pow(A, 2), B);
    return sub(pow(A, 2), pow(B, 2));
  }
  if (f === 'cube') {
    const A3 = pow(A, 3);
    const B3 = sc(pow(B, 3), s);
    const A2B = sc(mul(pow(A, 2), B), s);
    const AB2 = mul(A, pow(B, 2));
    if (mode === 'noMid') return add(A3, B3);
    if (mode === 'halfMid') return add(A3, A2B, AB2, B3);                 // забыли тройки
    if (mode === 'signMid') return pow(add(A, sc(B, -s)), 3);
    return pow(add(A, sc(B, s)), 3);
  }
  if (f === 'sumcubes') {
    if (mode === 'noMid' || mode === 'halfMid') return add(pow(A, 3), sc(pow(B, 3), -s));
    if (mode === 'signMid') return pow(add(A, sc(B, s)), 3);
    return add(pow(A, 3), sc(pow(B, 3), s));
  }
  return [];
}

function partTex(p) {
  const { f, A, B, s } = p;
  if (f === 'plain') return tex(A);
  if (f === 'sq') return `${br(bin(A, s, B))}^2`;
  if (f === 'conj') return br(bin(A, -1, B)) + br(bin(A, 1, B));
  if (f === 'cube') return `${br(bin(A, s, B))}^3`;
  const Q = add(pow(A, 2), sc(mul(A, B), -s), pow(B, 2));
  return br(bin(A, s, B)) + br(tex(Q));
}

function comboValue(parts, mode) {
  const plain = mode === 'minusFirst' || mode === 'plusAll' || mode === 'aOnce';
  return add(...parts.map((p, i) => {
    let val = partValue(p, plain ? 'ok' : mode);
    // «x² уже был»: квадрат первого слагаемого посчитан один раз на всё выражение
    if (mode === 'aOnce' && i > 0 && (p.f === 'sq' || p.f === 'conj')) val = sub(val, pow(p.A, 2));
    if (p.sgn > 0 || mode === 'plusAll') return val;
    // «минус перед скобкой» сменил знак только у первого члена
    if (mode === 'minusFirst' && p.f !== 'plain') {
      const [first, ...rest] = sorted(val);
      return add(neg([first]), rest);
    }
    return neg(val);
  }));
}

function comboParts(level) {
  const x = letter();
  const [a, b] = pair();
  const k = randInt(2, 6);
  let m = randInt(1, 6);
  if (m === k) m = k + 1;
  const X = v(x);
  const s = chance(0.5) ? 1 : -1;
  const L1 = [
    () => [{ sgn: 1, f: 'sq', A: X, B: n(k), s }, { sgn: -1, f: 'plain', A: v(x, 1, 2) }],
    () => [{ sgn: 1, f: 'plain', A: v(x, 1, 2) }, { sgn: -1, f: 'conj', A: X, B: n(k) }],
    () => [{ sgn: 1, f: 'conj', A: X, B: n(k) }, { sgn: 1, f: 'plain', A: n(k * k) }],
    () => [{ sgn: 1, f: 'sq', A: X, B: n(k), s }, { sgn: -1, f: 'plain', A: n(k * k) }],
  ];
  const L2 = [
    () => [{ sgn: 1, f: 'sq', A: X, B: n(k), s: 1 }, { sgn: -1, f: 'sq', A: X, B: n(k), s: -1 }],
    () => [{ sgn: 1, f: 'sq', A: X, B: n(k), s: 1 }, { sgn: 1, f: 'sq', A: X, B: n(k), s: -1 }],
    () => [{ sgn: 1, f: 'sq', A: X, B: n(m), s }, { sgn: -1, f: 'conj', A: X, B: n(k) }],
    () => [{ sgn: 1, f: 'conj', A: X, B: n(k) }, { sgn: -1, f: 'sq', A: X, B: n(k), s: -1 }],
    () => [{ sgn: 1, f: 'sq', A: v(a), B: v(b), s }, { sgn: -1, f: 'plain', A: v(a, 1, 2) }, { sgn: -1, f: 'plain', A: v(b, 1, 2) }],
  ];
  const kx = v(x, randInt(2, 4));
  const L3 = [
    () => [{ sgn: 1, f: 'sq', A: kx, B: n(k), s }, { sgn: -1, f: 'conj', A: kx, B: n(k) }],
    () => [{ sgn: 1, f: 'sq', A: v(a), B: v(b), s: 1 }, { sgn: -1, f: 'sq', A: v(a), B: v(b), s: -1 }],
    () => [{ sgn: 1, f: 'cube', A: X, B: n(rand([1, 2])), s }, { sgn: -1, f: 'plain', A: v(x, 1, 3) }],
    () => [{ sgn: 1, f: 'sumcubes', A: X, B: n(rand([1, 2, 3])), s }, { sgn: -1, f: 'plain', A: v(x, 1, 3) }],
    () => [{ sgn: 1, f: 'sq', A: kx, B: n(m), s }, { sgn: 1, f: 'sq', A: n(m), B: kx, s: -s }],
    () => [{ sgn: 1, f: 'conj', A: v(a), B: v(b) }, { sgn: -1, f: 'sq', A: v(a), B: v(b), s }],
  ];
  return rand(level === 1 ? L1 : level === 2 ? L2 : L3)();
}

function combo(level) {
  const parts = comboParts(level);
  const exprLatex = parts.map((p, i) => {
    const t = partTex(p);
    if (i === 0) return p.sgn > 0 ? t : `-${t}`;
    return `${p.sgn > 0 ? ' + ' : ' - '}${t}`;
  }).join('');
  const ans = comboValue(parts, 'ok');
  const mistakes = ['minusFirst', 'noMid', 'halfMid', 'signMid', 'plusAll', 'b2asB', 'aOnce'].map(m => comboValue(parts, m));
  return task('combo', exprLatex, nice(ans), ans, mistakes.map(p => [nice(p), p]));
}

// ─── Свернуть: разложить на множители ────────────────────────────────────────

const statement = (p, level) => nice(p, { shuffle: level > 1 });
const sqOf = (A, s, B) => `${br(bin(A, s, B))}^2`;
const prodOf = (...fs) => fs.map(br).join('');

/** A² − B² = (A − B)(A + B) */
function facDiffSq(level) {
  const x = letter();
  if (level === 3) {
    const kind = rand(['quart', 'common', 'shift', 'parts']);
    if (kind === 'quart') {
      const k = randInt(1, 3);
      const X = v(x);
      const ans = sub(v(x, 1, 4), n(k ** 4));
      return task('factor', tex(ans),
        prodOf(bin(X, -1, n(k)), bin(X, 1, n(k)), bin(v(x, 1, 2), 1, n(k * k))), ans, [
          [`${sqOf(X, -1, n(k))}${br(bin(v(x, 1, 2), 1, n(k * k)))}`, mul(square(X, -1, n(k)), add(v(x, 1, 2), n(k * k)))],
          [prodOf(bin(v(x, 1, 2), -1, n(k)), bin(v(x, 1, 2), 1, n(k))), sub(v(x, 1, 4), n(k * k))],
          [`${sqOf(X, -1, n(k))}${sqOf(X, 1, n(k))}`, mul(square(X, -1, n(k)), square(X, 1, n(k)))],
        ]);
    }
    if (kind === 'common') {
      const c = rand([2, 3, 5]);
      const k = randInt(1, 6);
      const X = v(x);
      const ans = scale(sub(pow(X, 2), n(k * k)), c);
      return task('factor', tex(ans), `${c}${prodOf(bin(X, -1, n(k)), bin(X, 1, n(k)))}`, ans, [
        [prodOf(bin(X, -1, n(k)), bin(X, 1, n(k))), sub(pow(X, 2), n(k * k))],
        [`${c}${sqOf(X, -1, n(k))}`, scale(square(X, -1, n(k)), c)],
        [`${c}${prodOf(bin(X, -1, n(c * k)), bin(X, 1, n(c * k)))}`, scale(sub(pow(X, 2), n(c * c * k * k)), c)],
      ]);
    }
    if (kind === 'shift') {
      // (x + m)² − k² = (x + m − k)(x + m + k)
      const m = rand([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
      let k = randInt(1, 6);
      if (Math.abs(m) === k) k += 1;
      const X = v(x);
      const lin = (c) => tex(add(X, n(c)));
      const ans = sub(pow(add(X, n(m)), 2), n(k * k));
      const exprLatex = `${br(lin(m))}^2 - ${k * k}`;
      return task('factor', exprLatex, prodOf(lin(m - k), lin(m + k)), ans, [
        [prodOf(lin(-m - k), lin(-m + k)), mul(add(X, n(-m - k)), add(X, n(-m + k)))],
        [prodOf(lin(m - k * k), lin(m + k * k)), mul(add(X, n(m - k * k)), add(X, n(m + k * k)))],
        [`${br(lin(m - k))}^2`, pow(add(X, n(m - k)), 2)],
      ]);
    }
  }
  const { A, B } = binomParts(Math.min(level, 2), { allowFrac: false });
  // x² − ¼ на уровне 2 — иногда
  const parts = level >= 2 && chance(0.2) ? { A: v(x), B: n(1, rand([2, 3, 4, 5])) } : { A, B };
  const ans = sub(pow(parts.A, 2), pow(parts.B, 2));
  const exprLatex = statement(ans, level);
  return task('factor', exprLatex, prodOf(bin(parts.A, -1, parts.B), bin(parts.A, 1, parts.B)), ans, [
    [sqOf(parts.A, -1, parts.B), square(parts.A, -1, parts.B)],
    [sqOf(parts.A, 1, parts.B), square(parts.A, 1, parts.B)],
    [prodOf(bin(parts.A, -1, pow(parts.B, 2)), bin(parts.A, 1, pow(parts.B, 2))),
      sub(pow(parts.A, 2), pow(parts.B, 4))],
  ]);
}

/** A² ± 2AB + B² = (A ± B)² */
function facSquare(level) {
  const x = letter();
  let A; let B; let c = 1;
  let s = chance(0.5) ? 1 : -1;
  if (level === 1) { A = v(x); B = n(randInt(1, 9)); }
  else if (level === 2) {
    const [a, b] = pair();
    ({ A, B } = rand([
      () => { const k = randInt(2, 5); return { A: v(x, k), B: n(coprime(k, 1, 7)) }; },
      () => ({ A: v(a), B: v(b, randInt(2, 4)) }),
      () => ({ A: v(a, randInt(2, 4)), B: v(b) }),
    ])());
  } else {
    const [a, b] = pair();
    const kind = rand(['ab', 'x2', 'common', 'frac']);
    if (kind === 'ab') {
      const [k, m] = coefPair();
      A = v(a, k); B = v(b, m);
    } else if (kind === 'x2') { A = v(x, 1, 2); B = n(randInt(1, 5)); s = 1; }
    else if (kind === 'common') { A = v(x); B = n(randInt(1, 5)); c = rand([2, 3]); }
    else { A = v(x); B = n(1, rand([2, 3])); }
  }
  const ans = scale(square(A, s, B), c);
  const pre = c === 1 ? '' : String(c);
  return task('factor', statement(ans, level), pre + sqOf(A, s, B), ans, [
    [pre + sqOf(A, -s, B), scale(square(A, -s, B), c)],
    [pre + prodOf(bin(A, -1, B), bin(A, 1, B)), scale(sub(pow(A, 2), pow(B, 2)), c)],
    [pre + sqOf(A, s, scale(B, 2)), scale(square(A, s, scale(B, 2)), c)],
    ...(c === 1 ? [] : [[sqOf(A, s, B), square(A, s, B)]]),
  ]);
}

/** A³ ± B³ = (A ± B)(A² ∓ AB + B²) */
function facCubes(level) {
  const x = letter();
  const [a, b] = pair();
  let A; let B; let c = 1;
  if (level === 1) { A = v(x); B = n(randInt(1, 3)); }
  else if (level === 2) {
    ({ A, B } = rand([
      () => ({ A: v(x), B: n(rand([4, 5])) }),
      () => { const k = rand([2, 3]); return { A: v(a, k), B: n(coprime(k, 1, 2)) }; },
      () => ({ A: n(rand([2, 3])), B: v(x) }),
      () => ({ A: v(a), B: v(b) }),
    ])());
  } else {
    ({ A, B, c } = rand([
      () => ({ A: v(a), B: v(b, rand([2, 3])), c: 1 }),
      () => ({ A: v(a, rand([2, 3])), B: v(b), c: 1 }),
      () => ({ A: v(x), B: n(randInt(1, 3)), c: rand([2, 3]) }),
    ])());
  }
  const s = chance(0.5) ? 1 : -1;
  const ans = scale(add(pow(A, 3), sc(pow(B, 3), s)), c);
  const pre = c === 1 ? '' : String(c);
  const Q = (sq) => add(pow(A, 2), sc(mul(A, B), sq), pow(B, 2));
  return task('factor', statement(ans, level), pre + prodOf(bin(A, s, B), nice(Q(-s))), ans, [
    [pre + prodOf(bin(A, s, B), nice(Q(s))), scale(mul(add(A, sc(B, s)), Q(s)), c)],
    [pre + prodOf(bin(A, -s, B), nice(Q(-s))), scale(mul(add(A, sc(B, -s)), Q(-s)), c)],
    [pre + `${br(bin(A, s, B))}^3`, scale(pow(add(A, sc(B, s)), 3), c)],
  ]);
}

// ─── Пропуски: (x + □)² = x² + 10x + □ ───────────────────────────────────────

const BOX = '\\square';

/**
 * Слоты тождества и какие из них спрятать. Каждый набор оставляет задание
 * однозначным: по видимым частям спрятанные восстанавливаются.
 */
const FILL_HIDE = {
  1: [['B', 'B2'], ['B', 'M'], ['M', 'B2']],
  2: [['A', 'M'], ['A', 'B2'], ['A2', 'B'], ['B', 'B2'], ['A2', 'M'], ['B', 'M']],
};

function fill(level) {
  // Разность квадратов: (□ − 4)(□ + 4) = 9x² − □
  if (level === 3 && chance(0.35)) {
    const { A, B } = binomParts(2, { allowNumFirst: false });
    const A2 = pow(A, 2);
    const B2 = pow(B, 2);
    const exprLatex = `${br(`${BOX} - ${tex(B)}`)}${br(`${BOX} + ${tex(B)}`)} = ${tex(A2)} - ${BOX}`;
    const ans = [tex(A), tex(A), tex(B2)];
    return task('fill', exprLatex, ans.join(';\\ '), null, [
      [[tex(A), tex(A), tex(scale(B, 2))].join(';\\ ')],
      [[tex(A2), tex(A2), tex(B2)].join(';\\ ')],
      [[tex(scale(A, 2)), tex(scale(A, 2)), tex(B2)].join(';\\ ')],
    ], { prompt: 'answer' });
  }
  const { A, B } = level === 1
    ? { A: v(letter()), B: n(randInt(2, 9)) }
    : binomParts(2, { allowNumFirst: false });
  const s = chance(0.5) ? 1 : -1;
  const val = {
    A: tex(A), B: tex(B),
    A2: tex(pow(A, 2)), M: tex(scale(mul(A, B), 2)), B2: tex(pow(B, 2)),
  };
  // Частые ошибки по слотам: B² = 2B, 2AB = AB, A² = 2A
  const alt = {
    A: [pow(A, 2), scale(A, 2)], B: [scale(B, 2), pow(B, 2)],
    A2: [scale(A, 2), A], M: [mul(A, B), scale(B, 2)], B2: [scale(B, 2), B],
  };
  const hide = rand(FILL_HIDE[Math.min(level, 2)]);
  const show = (k) => (hide.includes(k) ? BOX : val[k]);
  const left = `${br(`${show('A')} ${sgnTex(s)} ${show('B')}`)}^2`;
  const right = `${show('A2')} ${sgnTex(s)} ${show('M')} + ${show('B2')}`;
  // На «сложнее» тождество иногда записано справа налево
  const swap = level === 3 && chance(0.5);
  const exprLatex = swap ? `${right} = ${left}` : `${left} = ${right}`;
  const order = swap ? ['A2', 'M', 'B2', 'A', 'B'] : ['A', 'B', 'A2', 'M', 'B2'];
  const hidden = order.filter(k => hide.includes(k));
  const answerOf = (repl) => hidden.map(k => (repl[k] ?? val[k])).join(';\\ ');
  const mistakes = [
    ...[0, 1].flatMap(j => hidden.map(k => [answerOf({ [k]: tex(alt[k][j]) })])),
    [answerOf(Object.fromEntries(hidden.map(k => [k, tex(alt[k][0])])))],
  ];
  return task('fill', exprLatex, answerOf({}), null, mistakes, { prompt: 'answer' });
}

// ─── Корни — как в иррациональных уравнениях ─────────────────────────────────

const rt = (p) => sqrt(p);
/** √(x + m): m ≠ 0 */
const shiftM = () => rand([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);

function rootParts(level) {
  const x = letter();
  const X = v(x);
  if (level === 1) {
    return chance(0.2)
      ? { A: n(randInt(2, 6)), B: rt(X) }
      : { A: rt(X), B: n(randInt(1, 6)) };
  }
  if (level === 2) {
    return rand([
      () => ({ A: rt(add(X, n(shiftM()))), B: n(randInt(1, 4)) }),
      () => ({ A: scale(rt(X), rand([2, 3])), B: n(randInt(1, 3)) }),
      () => ({ A: rt(X), B: rt(n(rand(NONSQ))) }),
      () => ({ A: rt(add(v(x, 2), n(rand([-1, 1, 3])))), B: n(randInt(1, 3)) }),
    ])();
  }
  const m1 = shiftM();
  let m2 = shiftM();
  if (m2 === m1) m2 = m1 === 6 ? 5 : m1 + 1;
  return rand([
    () => ({ A: rt(add(X, n(m1))), B: rt(add(X, n(m2))) }),
    () => ({ A: rt(add(v(x, 2), n(m1))), B: rt(X) }),
    () => ({ A: scale(rt(add(X, n(m1))), 2), B: n(randInt(1, 3)) }),
  ])();
}

/** (√(x + 1) − 2)² = x − 4√(x + 1) + 5 */
function rootSq(level) {
  const { A, B } = rootParts(level);
  const s = chance(0.5) ? 1 : -1;
  const ans = square(A, s, B);
  const A2 = pow(A, 2);
  const B2 = pow(B, 2);
  const AB = mul(A, B);
  return task('expand', `${br(bin(A, s, B))}^2`, nice(ans), ans, [
    [nice(add(A2, sc(B2, s))), add(A2, sc(B2, s))],
    [nice(add(A2, sc(AB, s), B2)), add(A2, sc(AB, s), B2)],
    [nice(add(A2, sc(scale(AB, 2), -s), B2)), add(A2, sc(scale(AB, 2), -s), B2)],
  ]);
}

/** (√(x + 5) − √x)(√(x + 5) + √x) = 5 */
function rootConj(level) {
  const x = letter();
  const X = v(x);
  let A; let B;
  if (level === 1) { A = rt(X); B = n(randInt(1, 7)); }
  else if (level === 2) {
    ({ A, B } = rand([
      () => ({ A: rt(add(X, n(shiftM()))), B: n(randInt(1, 4)) }),
      () => ({ A: rt(add(X, n(randInt(1, 9)))), B: rt(X) }),
      () => ({ A: scale(rt(X), rand([2, 3])), B: n(randInt(1, 5)) }),
    ])());
  } else {
    const m = shiftM();
    ({ A, B } = rand([
      () => ({ A: rt(add(v(x, rand([2, 4])), n(randInt(1, 5)))), B: X }),
      () => ({ A: rt(add(X, n(randInt(2, 7)))), B: rt(add(X, n(-randInt(1, 4)))) }),
      () => ({ A: rt(add(X, n(m))), B: scale(rt(X), 2) }),
    ])());
  }
  const ans = sub(pow(A, 2), pow(B, 2));
  const f1 = br(bin(A, -1, B));
  const f2 = br(bin(A, 1, B));
  const exprLatex = chance(0.5) ? f1 + f2 : f2 + f1;
  const mistakes = [
    add(pow(A, 2), pow(B, 2)),
    sub(pow(B, 2), pow(A, 2)),
    sub(pow(A, 2), B),
  ];
  return task('expand', exprLatex, nice(ans), ans, mistakes.map(p => [nice(p), p]));
}

function rootNumParts(level) {
  if (level === 1) {
    const p = rand([2, 3, 5, 6, 7]);
    return chance(0.3) ? { A: n(randInt(2, 3)), B: rt(n(p)) } : { A: rt(n(p)), B: n(randInt(1, 3)) };
  }
  if (level === 2) {
    return rand([
      () => ({ A: scale(rt(n(rand([2, 3, 5]))), rand([2, 3])), B: n(randInt(1, 3)) }),
      () => ({ A: n(randInt(2, 5)), B: rt(n(rand(NONSQ))) }),
      () => {
        const p = rand(NONSQ);
        const q = rand(NONSQ.filter(t => t < p && gcd(t, p) === 1));
        return q ? { A: rt(n(p)), B: rt(n(q)) } : null;
      },
    ])();
  }
  return rand([
    // √6 + √3: двойное произведение 2√18 = 6√2
    () => rand([[6, 3], [6, 2], [10, 5], [10, 2], [15, 5], [15, 3], [14, 7], [6, 3]])
      .reduce((o, t, i) => ({ ...o, [i ? 'B' : 'A']: rt(n(t)) }), {}),
    () => ({ A: scale(rt(n(rand([2, 3]))), rand([2, 3])), B: scale(rt(n(5)), 1) }),
    () => ({ A: scale(rt(n(3)), 2), B: scale(rt(n(2)), 3) }),
  ])();
}

/** (√3 + 1)² = 4 + 2√3 */
function rootNum(level) {
  const parts = rootNumParts(level);
  if (!parts) return null;
  const { A, B } = parts;
  const s = chance(0.5) ? 1 : -1;
  const ans = square(A, s, B);
  const A2 = pow(A, 2);
  const B2 = pow(B, 2);
  const AB = mul(A, B);
  return task('combo', `${br(bin(A, s, B))}^2`, nice(ans), ans, [
    [nice(add(A2, sc(B2, s))), add(A2, sc(B2, s))],
    [nice(add(A2, sc(AB, s), B2)), add(A2, sc(AB, s), B2)],
    [nice(add(A2, sc(scale(AB, 2), -s), B2)), add(A2, sc(scale(AB, 2), -s), B2)],
  ]);
}

/**
 * Обратная дорога: 7 − 4√3 = (2 − √3)², x − 9 = (√x − 3)(√x + 3),
 * √(7 − 4√3) = 2 − √3. Скобка «(…)²» в условии подсказывает, что от
 * ученика ждут.
 */
function rootFold(level) {
  const x = letter();
  const X = v(x);
  const DOTS = '\\left(\\ldots\\right)';
  const kinds = level === 1 ? ['sqVar', 'sqVar', 'prod'] : level === 2 ? ['sqNum', 'sqNum', 'prod', 'sqVar'] : ['sqrtNum', 'sqrtNum', 'sqShift', 'sqNum'];
  const kind = rand(kinds);

  if (kind === 'prod') {
    // x − 9 = (√x − 3)(√x + 3)
    const A = level === 1 ? rt(X) : rt(add(X, n(shiftM())));
    const B = n(randInt(1, 6));
    const val = sub(pow(A, 2), pow(B, 2));
    return task('square', `${nice(val)} = ${DOTS}${DOTS}`,
      prodOf(bin(A, -1, B), bin(A, 1, B)), val, [
        [prodOf(bin(A, -1, n(B[0].c.n ** 2)), bin(A, 1, n(B[0].c.n ** 2))),
          sub(pow(A, 2), n(B[0].c.n ** 4))],
        [sqOf(A, -1, B), square(A, -1, B)],
        [prodOf(bin(B, -1, A), bin(B, 1, A)), sub(pow(B, 2), pow(A, 2))],
      ], { prompt: 'answer', instruction: 'Разложите на множители:' });
  }

  // Части: A > B > 0, чтобы и квадрат, и корень писались «большее − меньшее»
  let A; let B;
  if (kind === 'sqVar') { A = rt(X); B = n(randInt(1, 6)); }
  else if (kind === 'sqShift') { A = rt(add(X, n(shiftM()))); B = n(randInt(1, 3)); }
  else {
    const p = rand([2, 3, 5, 6, 7]);
    const k = randInt(1, 4);
    const big = n(k + 1 + Math.floor(Math.sqrt(p)));     // заведомо больше √p
    ({ A, B } = chance(0.5 + (level === 3 ? 0.2 : 0))
      ? { A: big, B: rt(n(p)) }
      : (() => {
        // k√q больше B: (2√2 − 3)² = (3 − 2√2)², а под корнем ответ — 3 − 2√2
        const q = rand([2, 3, 5]);
        const m = rand([2, 3]);
        const top = Math.min(3, Math.floor(Math.sqrt(m * m * q - 1)));
        return { A: scale(rt(n(q)), m), B: n(randInt(1, top)) };
      })());
  }
  const s = chance(0.5) ? 1 : -1;
  const val = square(A, s, B);

  if (kind === 'sqrtNum') {
    return task('calc', `\\sqrt{${nice(val)}}`, bin(A, s, B), add(A, sc(B, s)), [
      [bin(B, -1, A), sub(B, A)],
      [bin(A, -s, B), add(A, sc(B, -s))],
      [tex(add(pow(A, 2), sc(B, s)))],
    ], { instruction: 'Вычислите:' });
  }
  // «Потерял корень»: (x − 5)² вместо (√x − 5)²; у чисел — удвоил первое
  const lost = kind === 'sqNum' ? scale(A, 2) : null;
  const third = lost
    ? [sqOf(lost, s, B), square(lost, s, B)]
    : [`${br(nice(add(pow(A, 2), sc(B, s))))}^2`, pow(add(pow(A, 2), sc(B, s)), 2)];
  return task('square', `${nice(val)} = ${DOTS}^2`, sqOf(A, s, B), val, [
    [sqOf(A, -s, B), square(A, -s, B)],
    [sqOf(A, s, scale(B, 2)), square(A, s, scale(B, 2))],
    third,
  ], { prompt: 'answer', instruction: 'Представьте в виде квадрата:' });
}

// ─── Числа: считаем по формуле ───────────────────────────────────────────────

const NUM_DOMAINS = { 1: ['int'], 2: ['int', 'dec'], 3: ['dec', 'mix'] };

function numeric(fn, allowed, level) {
  const domains = NUM_DOMAINS[level].filter(d => allowed.includes(d));
  const domain = rand(domains.length ? domains : [allowed[0]]);
  const q = fn({ domain, style: 'auto' });
  if (!q) return null;
  return { exprLatex: q.exprLatex, resultLatex: q.resultLatex, kind: 'calc', instruction: FSU_INSTRUCTIONS.calc };
}

function numRoots(level) {
  const fn = level === 3 ? rand([fsuConjRoots, fsuFoldRoots, fsuSumSquaresRoots]) : fsuConjRoots;
  const q = fn({ style: 'auto' });
  return q && { exprLatex: q.exprLatex, resultLatex: q.resultLatex, kind: 'calc', instruction: FSU_INSTRUCTIONS.calc };
}

// ─── Реестр раздела ──────────────────────────────────────────────────────────

const safe = (fn) => (level) => {
  try { return fn(level); } catch { return null; }
};

export const FSU_SECTION_GENERATORS = Object.fromEntries(Object.entries({
  sqBinom, conj, cube, sumCubes, combo,
  facSquare, facDiffSq, facCubes,
  fill,
  rootSq, rootConj, rootNum, rootFold,
  numSquare:   (l) => numeric(fsuSquareNear, ['int', 'dec', 'mix'], l),
  numConj:     (l) => numeric(fsuConjProduct, ['int', 'dec', 'mix'], l),
  numDiffSq:   (l) => numeric(fsuDiffSquares, ['int', 'dec', 'mix'], l),
  numFold:     (l) => numeric(fsuFoldSquare, ['int', 'dec'], l),
  numQuot:     (l) => numeric(fsuQuotSquares, ['int', 'dec'], l),
  numRoots,
}).map(([k, fn]) => [k, safe(fn)]));

export const FSU_SECTION_LABELS = {
  sqBinom:   'Квадрат суммы и разности: (x + 3)²',
  conj:      'Разность квадратов: (x − 5)(x + 5)',
  cube:      'Куб суммы и разности: (x + 2)³',
  sumCubes:  'Сумма и разность кубов: (x + 2)(x² − 2x + 4)',
  combo:     'Упростить: (x + 3)² − (x − 3)(x + 3)',
  facSquare: 'Свернуть в квадрат: x² + 6x + 9',
  facDiffSq: 'Разность квадратов: x² − 49',
  facCubes:  'Сумма и разность кубов: x³ − 8',
  fill:      'Пропуски: (x + □)² = x² + 10x + □',
  rootSq:    'Квадрат с корнем: (√(x + 1) − 2)²',
  rootConj:  'Сопряжённые: (√(x + 5) − √x)(√(x + 5) + √x)',
  rootNum:   'Числа с корнями: (√3 + 1)²',
  rootFold:  'Обратно в квадрат: 7 − 4√3 = (…)², √(7 − 4√3)',
  numSquare: 'Квадрат рядом с круглым: 51²',
  numConj:   'Сопряжённое произведение: 43 · 37',
  numDiffSq: 'Разность квадратов: 27² − 23²',
  numFold:   'Свёртка квадрата: 37² + 2·37·13 + 13²',
  numQuot:   'Дробь: (37² − 13²) : (37 − 13)',
  numRoots:  'Корни: (√7 − √3)(√7 + √3)',
};

export const FSU_SECTION_GROUPS = [
  { label: 'Раскрыть скобки', keys: ['sqBinom', 'conj', 'cube', 'sumCubes', 'combo'] },
  { label: 'Разложить на множители', keys: ['facSquare', 'facDiffSq', 'facCubes', 'fill'] },
  { label: 'С корнями — для иррациональных уравнений', keys: ['rootSq', 'rootConj', 'rootNum', 'rootFold'] },
  { label: 'Числа — считаем по формуле', keys: ['numSquare', 'numConj', 'numDiffSq', 'numFold', 'numQuot', 'numRoots'] },
];

/** Что делает тип — из этого строится строка задания над листом. */
const KIND_OF = {
  sqBinom: 'expand', conj: 'expand', cube: 'expand', sumCubes: 'expand', combo: 'combo',
  facSquare: 'factor', facDiffSq: 'factor', facCubes: 'factor', fill: 'fill',
  rootSq: 'expand', rootConj: 'expand', rootNum: 'combo', rootFold: 'square',
  numSquare: 'calc', numConj: 'calc', numDiffSq: 'calc', numFold: 'calc', numQuot: 'calc', numRoots: 'calc',
};

/** Строка над заданиями листа — по включённым типам. */
export function fsuInstruction(categories = {}) {
  const kinds = new Set(Object.entries(categories).filter(([, on]) => on).map(([k]) => KIND_OF[k]).filter(Boolean));
  if (kinds.size === 1) return FSU_INSTRUCTIONS[[...kinds][0]];
  if (kinds.size === 2 && kinds.has('expand') && kinds.has('combo')) return 'Раскройте скобки и упростите:';
  return 'Выполните преобразования:';
}

/** По умолчанию — то, что нужно к иррациональным уравнениям, и обратная дорога. */
export const FSU_DEFAULT_ON = ['sqBinom', 'conj', 'combo', 'facSquare', 'facDiffSq', 'rootSq', 'rootConj'];
