/**
 * Действия с десятичными дробями: ЕГЭ база №14 и ОГЭ №6.
 *
 * Задание строится от ответа: сначала выбираются «удобные» числа (частное,
 * сумма в скобке), потом из них собирается запись — поэтому деление всегда
 * нацело, а ответ — конечная десятичная дробь. Числа точные (рациональные),
 * условие и ответ разойтись не могут.
 *
 * Ручные примеры раздела (многие — прямо из «Решу») — образцы уровня
 * «Как на экзамене» (`ORIG`), объём даёт генерация.
 */
import {
  rat, addR, subR, mulR, divR, negR, absR, decTex, niceDecimal,
  rand, randInt, chance, task, withOriginals, par,
} from './kit';

// ─── Числа ───────────────────────────────────────────────────────────────────

/** Случайное число с шагом 1/den на отрезке [lo; hi]; nonInt — не целое. */
function num(lo, hi, { den = 10, nonInt = true } = {}) {
  for (let i = 0; i < 50; i++) {
    const n = randInt(Math.round(lo * den), Math.round(hi * den));
    if (n === 0) continue;
    if (!nonInt || n % den !== 0) return rat(n, den);
  }
  return rat(Math.round(lo * den) || 1, den);
}

const D = (r) => decTex(r);
const DP = (r) => par(decTex(r));

/** a ± b с правильным знаком: (3,1 − 4,2), а не (3,1 + (−4,2)). */
function sumTex(a, b) {
  return b.n < 0 ? `${D(a)} - ${D(absR(b))}` : `${D(a)} + ${D(b)}`;
}

/** Ответ годится: конечная десятичная не длиннее digits знаков и не огромная. */
function ok(r, digits = 3, max = 1000) {
  return r && niceDecimal(r, digits) && Math.abs(r.n / r.d) < max;
}

function t(expr, r, digits = 3) {
  return ok(r, digits) ? task(expr, r) : null;
}

// Образцы — ручные примеры раздела (уровень «Как на экзамене»)
const ORIG = {
  sumTimes: [
    { expr: '(3{,}1 + 3{,}4) \\cdot 3{,}8', ans: '24{,}7' },
    { expr: '(1{,}7 + 2{,}8) \\cdot 4{,}8', ans: '21{,}6' },
    { expr: '(2{,}3 + 3{,}7) \\cdot 2{,}5', ans: '15' },
    { expr: '(1{,}2 + 0{,}8) \\cdot 3{,}6', ans: '7{,}2' },
    { expr: '(4{,}5 + 5{,}5) \\cdot 0{,}7', ans: '7' },
    { expr: '(0{,}3 + 0{,}7) \\cdot 2{,}4', ans: '2{,}4' },
    { expr: '(2{,}5 + 2{,}5) \\cdot 1{,}8', ans: '9' },
    { expr: '(1{,}6 + 2{,}4) \\cdot 1{,}5', ans: '6' },
    { expr: '(1{,}8 + 0{,}2) \\cdot 4{,}5', ans: '9' },
    { expr: '(4{,}7 + 5{,}3) \\cdot 0{,}6', ans: '6' },
    { expr: '(2{,}4 + 0{,}6) \\cdot 1{,}5', ans: '4{,}5' },
    { expr: '(3{,}2 + 0{,}8) \\cdot 2{,}5', ans: '10' },
    { expr: '(2{,}9 + 4{,}1) \\cdot 0{,}5', ans: '3{,}5' },
    { expr: '(0{,}6 + 1{,}4) \\cdot 3{,}5', ans: '7' },
    { expr: '(1{,}9 + 3{,}1) \\cdot 1{,}2', ans: '6' },
  ],
  diffTimes: [
    { expr: '(3{,}9 - 2{,}4) \\cdot 8{,}2', ans: '12{,}3' },
    { expr: '(5{,}7 - 3{,}2) \\cdot 1{,}6', ans: '4' },
    { expr: '(8{,}3 - 6{,}8) \\cdot 4', ans: '6' },
    { expr: '(4{,}6 - 1{,}6) \\cdot 2{,}5', ans: '7{,}5' },
    { expr: '(7{,}2 - 5{,}7) \\cdot 0{,}6', ans: '0{,}9' },
    { expr: '(9{,}4 - 3{,}4) \\cdot 1{,}5', ans: '9' },
    { expr: '(6{,}8 - 4{,}3) \\cdot 0{,}8', ans: '2' },
    { expr: '(3{,}7 - 1{,}2) \\cdot 0{,}4', ans: '1' },
    { expr: '(5{,}5 - 3) \\cdot 1{,}2', ans: '3' },
    { expr: '(7{,}3 - 4{,}8) \\cdot 0{,}4', ans: '1' },
    { expr: '(8{,}6 - 6{,}1) \\cdot 1{,}6', ans: '4' },
    { expr: '(2{,}2 - 1{,}7) \\cdot 6{,}4', ans: '3{,}2' },
    { expr: '(4{,}1 - 1{,}1) \\cdot 1{,}5', ans: '4{,}5' },
  ],
  prodMinus: [
    { expr: '8{,}5 \\cdot 2{,}6 - 1{,}7', ans: '20{,}4' },
    { expr: '1{,}5 \\cdot 4 - 2', ans: '4' },
    { expr: '2{,}5 \\cdot 3 - 1{,}5', ans: '6' },
    { expr: '0{,}4 \\cdot 5 - 1', ans: '1' },
    { expr: '1{,}2 \\cdot 5 - 3', ans: '3' },
    { expr: '3{,}5 \\cdot 2 - 1', ans: '6' },
    { expr: '1{,}4 \\cdot 5 - 2', ans: '5' },
    { expr: '1{,}8 \\cdot 5 - 4', ans: '5' },
    { expr: '0{,}6 \\cdot 5 - 1', ans: '2' },
    { expr: '2{,}5 \\cdot 4 - 3', ans: '7' },
    { expr: '1{,}6 \\cdot 2{,}5 - 1', ans: '3' },
    { expr: '0{,}8 \\cdot 2{,}5 - 1', ans: '1' },
    { expr: '1{,}4 \\cdot 2{,}5 - 1{,}5', ans: '2' },
  ],
  prodPlus: [
    { expr: '1{,}5 \\cdot 4 + 2', ans: '8' },
    { expr: '2{,}5 \\cdot 3 + 0{,}5', ans: '8' },
    { expr: '0{,}4 \\cdot 5 + 3', ans: '5' },
    { expr: '0{,}5 \\cdot 8 + 1{,}5', ans: '5{,}5' },
    { expr: '1{,}6 \\cdot 5 + 2', ans: '10' },
    { expr: '0{,}25 \\cdot 4 + 1{,}5', ans: '2{,}5' },
    { expr: '0{,}8 \\cdot 2 + 0{,}4', ans: '2' },
    { expr: '1{,}2 \\cdot 5 + 4', ans: '10' },
    { expr: '0{,}6 \\cdot 5 + 0{,}5', ans: '3{,}5' },
    { expr: '1{,}5 \\cdot 6 + 1', ans: '10' },
    { expr: '2{,}5 \\cdot 4 + 0{,}5', ans: '10{,}5' },
    { expr: '0{,}8 \\cdot 5 + 2{,}5', ans: '6{,}5' },
  ],
  addDivision: [
    { expr: '3{,}8 + 1{,}08 : 0{,}9', ans: '5' },
    { expr: '2{,}2 + 1{,}04 : 1{,}3', ans: '3' },
    { expr: '1{,}5 + 2{,}4 : 0{,}6', ans: '5{,}5' },
    { expr: '0{,}5 + 1{,}8 : 0{,}3', ans: '6{,}5' },
    { expr: '2 + 4{,}8 : 1{,}2', ans: '6' },
    { expr: '1{,}3 + 1{,}5 : 0{,}5', ans: '4{,}3' },
    { expr: '0{,}4 + 0{,}6 : 0{,}2', ans: '3{,}4' },
    { expr: '2{,}5 + 2{,}4 : 0{,}8', ans: '5{,}5' },
    { expr: '4 + 0{,}6 : 0{,}3', ans: '6' },
    { expr: '1 + 0{,}9 : 0{,}3', ans: '4' },
    { expr: '3{,}5 + 4{,}8 : 1{,}6', ans: '6{,}5' },
    { expr: '2{,}1 + 1{,}2 : 0{,}4', ans: '5{,}1' },
    { expr: '0{,}5 + 2{,}1 : 0{,}7', ans: '3{,}5' },
  ],
  subDivision: [
    { expr: '5 - 1{,}2 : 0{,}4', ans: '2' },
    { expr: '7 - 4{,}8 : 1{,}6', ans: '4' },
    { expr: '3{,}5 - 1{,}5 : 0{,}5', ans: '0{,}5' },
    { expr: '8 - 1{,}4 : 0{,}7', ans: '6' },
    { expr: '4{,}5 - 1{,}6 : 0{,}4', ans: '0{,}5' },
    { expr: '6 - 2{,}7 : 0{,}9', ans: '3' },
    { expr: '5{,}5 - 2{,}4 : 0{,}6', ans: '1{,}5' },
    { expr: '10 - 2{,}1 : 0{,}7', ans: '7' },
    { expr: '4{,}8 - 1{,}2 : 0{,}5', ans: '2{,}4' },
    { expr: '3 - 0{,}6 : 0{,}3', ans: '1' },
    { expr: '7{,}5 - 1{,}6 : 0{,}4', ans: '3{,}5' },
    { expr: '6{,}2 - 2{,}4 : 0{,}8', ans: '3{,}2' },
    { expr: '5{,}3 - 0{,}9 : 0{,}3', ans: '2{,}3' },
  ],
  divBySum: [
    { expr: '\\dfrac{2{,}7}{1{,}4 + 0{,}1}', ans: '1{,}8' },
    { expr: '\\dfrac{4{,}5}{0{,}5 + 1}', ans: '3' },
    { expr: '\\dfrac{6}{0{,}4 + 0{,}1}', ans: '12' },
    { expr: '\\dfrac{3{,}6}{0{,}2 + 0{,}4}', ans: '6' },
    { expr: '\\dfrac{7{,}5}{1{,}7 + 0{,}8}', ans: '3' },
    { expr: '\\dfrac{2{,}4}{0{,}6 + 0{,}6}', ans: '2' },
    { expr: '\\dfrac{1}{0{,}2 + 0{,}3}', ans: '2' },
    { expr: '\\dfrac{4{,}8}{0{,}6 + 0{,}6}', ans: '4' },
    { expr: '\\dfrac{3{,}6}{1{,}1 + 0{,}7}', ans: '2' },
    { expr: '\\dfrac{8{,}1}{1{,}5 + 1{,}2}', ans: '3' },
    { expr: '\\dfrac{1{,}5}{0{,}2 + 0{,}3}', ans: '3' },
    { expr: '\\dfrac{9}{1{,}3 + 0{,}2}', ans: '6' },
  ],
  divByDiff: [
    { expr: '\\dfrac{4{,}4}{5{,}8 - 5{,}3}', ans: '8{,}8' },
    { expr: '0{,}6 : (1{,}7 - 2{,}9)', ans: '-0{,}5' },
    { expr: '\\dfrac{2{,}4}{3{,}7 - 1{,}7}', ans: '1{,}2' },
    { expr: '\\dfrac{1{,}8}{0{,}9 - 0{,}6}', ans: '6' },
    { expr: '\\dfrac{5{,}6}{1{,}4 - 0{,}6}', ans: '7' },
    { expr: '\\dfrac{4}{2{,}5 - 1{,}5}', ans: '4' },
    { expr: '\\dfrac{1{,}8}{0{,}6 - 1{,}2}', ans: '-3' },
    { expr: '\\dfrac{1{,}5}{0{,}5 - 1}', ans: '-3' },
    { expr: '\\dfrac{2{,}5}{1{,}3 - 0{,}8}', ans: '5' },
    { expr: '\\dfrac{3{,}9}{2{,}1 - 0{,}8}', ans: '3' },
    { expr: '0{,}8 : (1{,}2 - 2)', ans: '-1' },
    { expr: '\\dfrac{2{,}1}{1{,}5 - 0{,}8}', ans: '3' },
  ],
  diffDiv: [
    { expr: '\\dfrac{9{,}4 - 1{,}3}{1{,}8}', ans: '4{,}5' },
    { expr: '\\dfrac{0{,}5 - 1{,}5}{0{,}8}', ans: '-1{,}25' },
    { expr: '\\dfrac{7{,}5 - 2{,}5}{2{,}5}', ans: '2' },
    { expr: '\\dfrac{4{,}8 - 1{,}2}{1{,}2}', ans: '3' },
    { expr: '\\dfrac{3 - 0{,}6}{0{,}4}', ans: '6' },
    { expr: '\\dfrac{10 - 2{,}5}{0{,}5}', ans: '15' },
    { expr: '\\dfrac{1 - 4}{0{,}5}', ans: '-6' },
    { expr: '\\dfrac{2{,}4 - 4{,}8}{0{,}8}', ans: '-3' },
    { expr: '\\dfrac{6{,}3 - 2{,}1}{0{,}6}', ans: '7' },
    { expr: '\\dfrac{8{,}1 - 1{,}8}{0{,}9}', ans: '7' },
    { expr: '\\dfrac{2{,}5 - 1{,}9}{0{,}3}', ans: '2' },
    { expr: '\\dfrac{4{,}5 - 1{,}5}{1{,}5}', ans: '2' },
  ],
  trickFraction: [
    { expr: '\\dfrac{1{,}92 \\cdot 0{,}244}{0{,}192 \\cdot 2{,}44}', ans: '1' },
    { expr: '\\dfrac{0{,}207 \\cdot 2{,}08}{2{,}07 \\cdot 0{,}208}', ans: '1' },
    { expr: '\\dfrac{3{,}6 \\cdot 0{,}52}{0{,}36 \\cdot 5{,}2}', ans: '1' },
    { expr: '\\dfrac{4{,}5 \\cdot 0{,}18}{0{,}45 \\cdot 1{,}8}', ans: '1' },
    { expr: '\\dfrac{7{,}2 \\cdot 0{,}34}{0{,}72 \\cdot 3{,}4}', ans: '1' },
    { expr: '\\dfrac{6{,}5 \\cdot 0{,}18}{0{,}65 \\cdot 1{,}8}', ans: '1' },
    { expr: '\\dfrac{8{,}4 \\cdot 0{,}15}{0{,}84 \\cdot 1{,}5}', ans: '1' },
    { expr: '\\dfrac{0{,}36 \\cdot 2{,}5}{3{,}6 \\cdot 0{,}25}', ans: '1' },
    { expr: '\\dfrac{6{,}3 \\cdot 0{,}24}{0{,}63 \\cdot 2{,}4}', ans: '1' },
    { expr: '\\dfrac{0{,}54 \\cdot 1{,}8}{5{,}4 \\cdot 0{,}18}', ans: '1' },
    { expr: '\\dfrac{2{,}5 \\cdot 0{,}144}{0{,}25 \\cdot 1{,}44}', ans: '1' },
    { expr: '\\dfrac{0{,}48 \\cdot 1{,}6}{4{,}8 \\cdot 0{,}16}', ans: '1' },
  ],
};

// ─── Генераторы ──────────────────────────────────────────────────────────────

// 1. (a + b) · c
function sumTimes(level) {
  return withOriginals(level, ORIG.sumTimes, (lv) => {
    if (lv === 1) {
      const s = randInt(2, 9);
      const a = num(0.1, s - 0.1);
      const c = randInt(2, 9);
      return t(`(${sumTex(a, subR(rat(s), a))}) \\cdot ${c}`, rat(s * c));
    }
    if (lv === 2) {
      const a = num(0.1, 9.9);
      const b = num(0.1, 9.9);
      // половина заданий — «удобный» множитель: 2,5 / 1,5 / целое
      const c = chance(0.5) ? num(0.5, 9.5, { den: 2 }) : num(0.2, 9.9);
      return t(`(${sumTex(a, b)}) \\cdot ${D(c)}`, mulR(addR(a, b), c));
    }
    const a = num(-9.9, 9.9);
    const b = num(-9.9, 9.9);
    const c = chance(0.5) ? num(-9.9, -0.2) : num(0.02, 2.5, { den: 100 });
    return t(`(${sumTex(a, b)}) \\cdot ${DP(c)}`, mulR(addR(a, b), c), 4);
  });
}

// 2. (a − b) · c
function diffTimes(level) {
  return withOriginals(level, ORIG.diffTimes, (lv) => {
    if (lv === 1) {
      const s = randInt(1, 7);
      const b = num(0.1, 4.9);
      const c = randInt(2, 9);
      return t(`(${D(addR(b, rat(s)))} - ${D(b)}) \\cdot ${c}`, rat(s * c));
    }
    if (lv === 2) {
      const b = num(0.1, 6.9);
      const a = addR(b, num(0.1, 4.9));
      const c = num(0.2, 9.9, { nonInt: chance(0.8) });
      return t(`(${D(a)} - ${D(b)}) \\cdot ${D(c)}`, mulR(subR(a, b), c));
    }
    // уровень 3: разность отрицательная, множитель тоже бывает
    const a = num(0.1, 5.9);
    const b = addR(a, num(0.1, 6.9));
    const c = chance(0.5) ? num(-9.9, -0.2) : num(0.2, 9.9);
    return t(`(${D(a)} - ${D(b)}) \\cdot ${DP(c)}`, mulR(subR(a, b), c));
  });
}

// 3. a · b − c и 4. a · b + c
function prodOp(level, sign) {
  const orig = sign < 0 ? ORIG.prodMinus : ORIG.prodPlus;
  return withOriginals(level, orig, (lv) => {
    const op = sign < 0 ? '-' : '+';
    if (lv === 1) {
      const a = num(0.2, 4.5, { den: 2 });
      const b = rat(randInt(2, 8));
      const c = rat(randInt(1, 5));
      const r = sign < 0 ? subR(mulR(a, b), c) : addR(mulR(a, b), c);
      return t(`${D(a)} \\cdot ${D(b)} ${op} ${D(c)}`, r);
    }
    if (lv === 2) {
      const a = num(0.2, 9.9);
      const b = num(0.2, 9.9);
      const c = num(0.1, 9.9);
      const r = sign < 0 ? subR(mulR(a, b), c) : addR(mulR(a, b), c);
      return t(`${D(a)} \\cdot ${D(b)} ${op} ${D(c)}`, r);
    }
    // уровень 3: c − k · (−b) (6,6 − 5 · (−3,5)) и отрицательный множитель
    const c = num(0.1, 9.9);
    const k = rat(randInt(2, 9));
    const b = num(-9.9, -0.1);
    const r = sign < 0 ? subR(c, mulR(k, b)) : addR(c, mulR(k, b));
    return t(`${D(c)} ${op} ${D(k)} \\cdot ${DP(b)}`, r);
  });
}
const prodMinus = (level) => prodOp(level, -1);
const prodPlus = (level) => prodOp(level, 1);

// 5. a + b : c и 6. a − b : c
function divOp(level, sign) {
  const orig = sign < 0 ? ORIG.subDivision : ORIG.addDivision;
  return withOriginals(level, orig, (lv) => {
    const op = sign < 0 ? '-' : '+';
    let c; let q;
    if (lv === 1) {
      c = rand([rat(2), rat(3), rat(4), rat(5), rat(1, 2), rat(1, 5)]);
      q = rat(randInt(2, 9));
    } else if (lv === 2) {
      if (chance(0.25)) {
        // 2 : 0,04 + 34
        c = rand([rat(4, 100), rat(5, 100), rat(2, 100), rat(25, 100), rat(8, 10)]);
        q = divR(rat(randInt(1, 9)), c);
        if (q.d !== 1) return null;
      } else {
        c = num(0.2, 2.5);
        q = num(0.2, 9.9, { nonInt: chance(0.6) });
      }
    } else {
      c = chance(0.5) ? num(-2.5, -0.2) : num(0.02, 0.9, { den: 100 });
      q = num(-9.9, 9.9, { nonInt: chance(0.6) });
    }
    const b = mulR(q, c);
    if (!ok(b, 3)) return null;
    const a = lv === 3 ? num(-9.9, 9.9) : num(0.1, 9.9, { nonInt: chance(0.7) });
    const r = sign < 0 ? subR(a, q) : addR(a, q);
    return t(`${D(a)} ${op} ${DP(b)} : ${DP(c)}`, r);
  });
}
const addDivision = (level) => divOp(level, 1);
const subDivision = (level) => divOp(level, -1);

// 7. a / (b + c), 8. a / (b − c)
function divByBracket(level, sign) {
  const orig = sign < 0 ? ORIG.divByDiff : ORIG.divBySum;
  return withOriginals(level, orig, (lv) => {
    // знаменатель s, частное q, числитель a = q·s
    let s; let q;
    if (lv === 1) {
      s = rand([rat(1, 2), rat(1), rat(2), rat(3), rat(1, 5), rat(5)]);
      q = rat(randInt(2, 12));
    } else if (lv === 2) {
      s = num(0.2, 2.5);
      q = num(0.5, 9.9, { nonInt: chance(0.5) });
      if (sign < 0 && chance(0.3)) s = negR(s);
    } else {
      s = chance(0.5) ? negR(num(0.1, 1.5)) : num(0.05, 0.95, { den: 100 });
      q = num(-9.9, 9.9, { den: chance(0.5) ? 10 : 100 });
    }
    const a = mulR(q, s);
    if (!ok(a, 2) || a.n <= 0 && lv < 3) return null;
    // знаменатель — сумма или разность двух десятичных
    let b; let c;
    if (sign > 0) {
      b = num(0.1, Math.max(0.2, Math.abs(s.n / s.d) + 3));
      c = subR(s, b);
      if (lv < 3 && c.n <= 0) return null;
    } else {
      c = num(0.1, 6.9);
      b = addR(s, c);
      if (b.n <= 0) return null;
    }
    if (!ok(b, 2) || !ok(c, 2)) return null;
    const den = sign > 0 ? sumTex(b, c) : `${D(b)} - ${D(c)}`;
    return chance(0.7)
      ? t(`\\dfrac{${D(a)}}{${den}}`, q)
      : t(`${DP(a)} : (${den})`, q);
  });
}
const divBySum = (level) => divByBracket(level, 1);
const divByDiff = (level) => divByBracket(level, -1);

// 9. (a − b) / c
function diffDiv(level) {
  return withOriginals(level, ORIG.diffDiv, (lv) => {
    const c = lv === 1 ? rand([rat(2), rat(5), rat(1, 2), rat(4)]) : num(0.2, 2.5);
    const q = lv === 1 ? rat(randInt(2, 9)) : num(-9.9, 9.9, { nonInt: chance(0.5) });
    const n = mulR(q, c);
    if (!ok(n, 2)) return null;
    const b = lv === 3 ? num(-5, 9.9) : num(0.1, 6.9);
    const a = addR(n, b);
    if (!ok(a, 2) || (lv < 3 && a.n <= 0)) return null;
    return t(`\\dfrac{${D(a)} - ${DP(b)}}{${D(c)}}`, q);
  });
}

// 10. «Хитрая дробь»: одинаковые цифры, сдвинутая запятая
function trickFraction(level) {
  return withOriginals(level, ORIG.trickFraction, (lv) => {
    const X = randInt(12, lv === 3 ? 999 : 99);
    const Y = randInt(12, lv === 3 ? 999 : 99);
    if (X % 10 === 0 || Y % 10 === 0 || X === Y) return null;
    const sh = () => randInt(0, 3);
    const [i, j, k] = [sh(), sh(), sh()];
    // ответ 10^d: d = (k + l) − (i + j)
    const d = lv === 1 ? 0 : rand(lv === 2 ? [0, 1, 2, -1] : [2, -1, -2, 3]);
    const l = i + j + d - k;
    if (l < 0 || l > 3) return null;
    const x1 = rat(X, 10 ** i); const y1 = rat(Y, 10 ** j);
    const x2 = rat(X, 10 ** k); const y2 = rat(Y, 10 ** l);
    if (i === k || j === l) return null;   // каждый множитель «сдвинут»
    const r = d >= 0 ? rat(10 ** d) : rat(1, 10 ** -d);
    return task(`\\dfrac{${D(x1)} \\cdot ${D(y1)}}{${D(x2)} \\cdot ${D(y2)}}`, r);
  });
}

// 11. (a · b) / c — ОГЭ №6
function decimalFraction(level) {
  const q = level === 1 ? rat(randInt(2, 9)) : num(0.2, 9.9, { nonInt: level === 3 || chance(0.6) });
  const a = num(0.2, 9.9, { nonInt: true });
  const b = num(0.2, 9.9, { nonInt: level > 1 });
  const c = divR(mulR(a, b), q);
  if (!ok(c, level === 3 ? 2 : 1) || c.n / c.d < 0.2 || c.n / c.d > 20) return null;
  // знаменатель не повторяет множитель — иначе дробь сокращается без счёта
  if ((c.n === a.n && c.d === a.d) || (c.n === b.n && c.d === b.d)) return null;
  if (level === 3 && chance(0.5)) {
    return t(`\\dfrac{${DP(negR(a))} \\cdot ${D(b)}}{${D(c)}}`, negR(q));
  }
  return t(`\\dfrac{${D(a)} \\cdot ${D(b)}}{${D(c)}}`, q);
}

// 12. a ± b (± c) — первое задание ОГЭ №6, разминка
function decAddSub(level) {
  if (level === 1) {
    const a = num(0.1, 9.9);
    const b = num(0.1, 9.9);
    return chance(0.5)
      ? t(`${D(a)} + ${D(b)}`, addR(a, b))
      : t(`${D(addR(a, b))} - ${D(b)}`, a);
  }
  if (level === 2) {
    // через ноль: 3,6 − 4,1 = −0,5
    const a = num(0.1, 9.9);
    const b = addR(a, num(0.1, 5));
    return chance(0.5)
      ? t(`${D(a)} - ${D(b)}`, subR(a, b))
      : t(`${D(negR(a))} + ${D(b)}`, subR(b, a));
  }
  const a = num(-9.9, 9.9, { den: 100 });
  const b = num(-9.9, 9.9);
  const c = num(0.1, 9.9);
  return t(`${D(a)} ${b.n < 0 ? '-' : '+'} ${D(absR(b))} - ${D(c)}`, subR(addR(a, b), c));
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export const DEC_GENERATORS = {
  decAddSub, sumTimes, diffTimes, prodMinus, prodPlus, addDivision, subDivision,
  divBySum, divByDiff, diffDiv, decimalFraction, trickFraction,
};

export const DEC_LABELS = {
  decAddSub:       'a ± b: 3,6 − 4,1',
  sumTimes:        '(a + b) · c',
  diffTimes:       '(a − b) · c',
  prodMinus:       'a · b − c',
  prodPlus:        'a · b + c',
  addDivision:     'a + b : c',
  subDivision:     'a − b : c',
  divBySum:        'a / (b + c)',
  divByDiff:       'a / (b − c)',
  diffDiv:         '(a − b) / c',
  decimalFraction: '(a · b) / c',
  trickFraction:   'Хитрая дробь: 1,92·0,244 / (0,192·2,44)',
};

const BO = ['Б14', 'О6'];
export const DEC_EXAM = {
  decAddSub: ['О6'], sumTimes: BO, diffTimes: BO, prodMinus: BO, prodPlus: BO,
  addDivision: BO, subDivision: BO, divBySum: BO, divByDiff: BO, diffDiv: BO,
  decimalFraction: BO, trickFraction: ['Б14'],
};

export const DEC_GROUPS = [
  { label: 'Сложение и вычитание', keys: ['decAddSub'] },
  { label: 'Сумма / разность · число', keys: ['sumTimes', 'diffTimes'] },
  { label: 'Произведение ± число', keys: ['prodPlus', 'prodMinus'] },
  { label: 'Порядок действий', keys: ['addDivision', 'subDivision'] },
  { label: 'Дробная черта', keys: ['divBySum', 'divByDiff', 'diffDiv', 'decimalFraction'] },
  { label: 'Спецзадачи', keys: ['trickFraction'] },
];
