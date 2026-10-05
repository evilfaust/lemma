/**
 * Степени и корни для устного счёта: ОГЭ №8, ЕГЭ база №16, профиль №8.
 *
 * Каждый тип строит задание от ответа: сначала выбираются «хорошие» числа
 * (точные степени, разложение на простые), потом из них собирается запись.
 * Значение считается точно (рациональные числа), поэтому ответ не может
 * разойтись с условием; сторож — `__tests__/oralAnswers.test.js`.
 */
import {
  rat, mulR, divR, addR, decTex, rand, randInt, chance, gcd, task,
  withOriginals, ipow, rpow, mixedTex,
} from './kit';

const rootTex = (q, inner) => (q === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${q}]{${inner}}`);
// Степень; показатель 1 не пишем (5¹ → 5)
const pw = (b, e) => (String(e) === '1' ? String(b) : `${b}^{${e}}`);
const wrap = (t) => (/[-+]|frac|\{,\}|\\sqrt/.test(t) ? `\\left(${t}\\right)` : t);
const decOf = (r) => decTex(r);

// ─── Образцы с «Решу» / ФИПИ ────────────────────────────────────────────────
const ORIG = {
  rootQuotient: [
    { expr: '\\dfrac{\\sqrt{147}}{\\sqrt{3}}', ans: '7' },
    { expr: '\\dfrac{\\sqrt{252}}{2\\sqrt{7}}', ans: '3' },
    { expr: '\\dfrac{\\sqrt{20} \\cdot \\sqrt{32}}{\\sqrt{10}}', ans: '8' },
    { expr: '\\dfrac{\\sqrt{35} \\cdot \\sqrt{21}}{\\sqrt{15}}', ans: '7' },
    { expr: '\\dfrac{\\sqrt[4]{9} \\cdot \\sqrt[4]{36}}{\\sqrt[4]{4}}', ans: '3' },
  ],
  rootOfProduct: [
    { expr: '\\sqrt{45 \\cdot 220 \\cdot 44}', ans: '660' },
    { expr: '\\sqrt{66 \\cdot 110 \\cdot 15}', ans: '330' },
    { expr: '\\sqrt{2 \\cdot 45} \\cdot \\sqrt{10}', ans: '30' },
  ],
  rootSquareFrac: [
    { expr: '\\dfrac{\\left(6\\sqrt{5}\\right)^{2}}{24}', ans: '7{,}5' },
    { expr: '\\dfrac{220}{\\left(2\\sqrt{5}\\right)^{2}}', ans: '11' },
    { expr: '\\dfrac{\\left(5\\sqrt{6}\\right)^{2}}{10}', ans: '15' },
  ],
  sqrtDiffSquares: [
    { expr: '\\sqrt{89^{2} - 39^{2}}', ans: '80' },
  ],
  powerMixedBases: [
    { expr: '\\dfrac{8^{11} \\cdot 32^{-2}}{4^{7}}', ans: '512' },
    { expr: '49^{2} \\cdot 4^{3} : 196', ans: '784' },
    { expr: '\\dfrac{\\left(3 \\cdot 10\\right)^{8}}{3^{6} \\cdot 10^{7}}', ans: '90' },
    { expr: '\\dfrac{24^{4}}{3^{2} \\cdot 8^{3}}', ans: '72' },
    { expr: '\\dfrac{\\left(3^{7}\\right)^{-2}}{3^{-16}}', ans: '9' },
  ],
  decimalExponent: [
    { expr: '5^{0{,}36} \\cdot 25^{0{,}32}', ans: '5' },
    { expr: '8^{0{,}76} \\cdot 64^{0{,}12}', ans: '8' },
    { expr: '\\dfrac{4^{5{,}1}}{8^{2{,}4}}', ans: '8' },
    { expr: '35^{7{,}2} \\cdot 7^{-6{,}2} : 5^{4{,}2}', ans: '875' },
    { expr: '\\dfrac{5^{3{,}8} \\cdot 7^{5{,}8}}{35^{4{,}8}}', ans: '1{,}4' },
  ],
  sciNotation: [
    { expr: '\\left(4 \\cdot 10^{4}\\right) \\cdot \\left(2{,}4 \\cdot 10^{-1}\\right)', ans: '9600' },
    { expr: '4 \\cdot 10^{-3} + 8 \\cdot 10^{-2} + 5 \\cdot 10^{-1}', ans: '0{,}584' },
    { expr: '\\left(0{,}01\\right)^{2} \\cdot 10^{5} \\cdot 4^{2}', ans: '160' },
  ],
  irrationalExp: [
    { expr: '5^{\\sqrt{3} + 5} \\cdot 5^{-4 - \\sqrt{3}}', ans: '5' },
    { expr: '3^{2\\sqrt{2} + 1} \\cdot 9^{2 - \\sqrt{2}}', ans: '243' },
    { expr: '\\dfrac{7^{\\sqrt{6}} \\cdot 5^{\\sqrt{6}}}{35^{\\sqrt{6} - 2}}', ans: '1225' },
  ],
  productOfRoots: [
    { expr: '\\sqrt{10} \\cdot \\sqrt{1{,}6}', ans: '4' },
    { expr: '\\sqrt{20} \\cdot \\sqrt{3{,}2}', ans: '8' },
    { expr: '\\sqrt{12} \\cdot \\sqrt{3}', ans: '6' },
  ],
};

// ─── Корни ───────────────────────────────────────────────────────────────────

// 1. √N
function simpleSqrt(level) {
  if (level === 1) {
    const a = randInt(2, 20);
    return task(rootTex(2, a * a), rat(a));
  }
  if (level === 2) {
    if (chance(0.5)) {
      const a = randInt(21, 35);
      return task(rootTex(2, a * a), rat(a));
    }
    // десятичные: √0,49, √1,44, √0,0025
    const a = randInt(2, 15);
    const d = rand([10, 100]);
    const r = rat(a, d);
    const inner = decOf(mulR(r, r));
    if (!inner || inner.length > 10) return null;
    return task(rootTex(2, inner), r);
  }
  // уровень 3: смешанные числа и большие квадраты: √(2 1/4), √1764
  if (chance(0.5)) {
    const n = randInt(3, 9);
    const d = randInt(2, 7);
    if (n % d === 0) return null;
    const r = rat(n, d);
    return task(rootTex(2, mixedTex(mulR(r, r))), r);
  }
  const a = rand([36, 42, 45, 48, 52, 55, 64, 65, 72, 75, 85, 95]);
  return task(rootTex(2, a * a), rat(a));
}

// 2. Корень n-й степени
function nthRoot(level) {
  if (level === 1) {
    const n = rand([3, 3, 4, 5]);
    const a = randInt(2, n === 3 ? 10 : n === 4 ? 5 : 3);
    return task(rootTex(n, ipow(a, n)), rat(a));
  }
  if (level === 2) {
    // отрицательные и десятичные: ∛(−27), ∛0,008, ⁴√0,0016
    const n = rand([3, 3, 4, 5]);
    if (chance(0.5) && n !== 4) {
      const a = randInt(2, n === 3 ? 10 : 3);
      return task(rootTex(n, `-${ipow(a, n)}`), rat(-a));
    }
    const a = randInt(1, n === 3 ? 9 : 4);
    const r = rat(a, 10);
    const inner = decOf(rpow(r, n));
    if (!inner || inner.length > 12) return null;
    return task(rootTex(n, inner), r);
  }
  // уровень 3: смешанные числа: ∛(3 3/8) = 1,5
  const n = rand([3, 4]);
  const r = rand([rat(3, 2), rat(5, 2), rat(4, 3), rat(5, 4), rat(7, 2)]);
  const v = rpow(r, n);
  if (v.n > 3000) return null;
  return task(rootTex(n, mixedTex(v)), r);
}

// 3. Вложенный корень
function nestedRoot(level) {
  if (level === 1) {
    const a = randInt(2, 5);
    return task(`\\sqrt{\\sqrt{${ipow(a, 4)}}}`, rat(a));
  }
  const [p, q] = rand(level === 2 ? [[2, 3], [3, 2], [2, 2]] : [[3, 3], [2, 4], [4, 2], [3, 2]]);
  const a = randInt(2, level === 2 ? 4 : 3);
  const v = ipow(a, p * q);
  if (v > 100000) return null;
  return task(rootTex(p, rootTex(q, v)), rat(a));
}

// 4. ⁿ√(a^m)
function rootOfPower(level) {
  const a = rand([2, 3, 5, 7]);
  if (level === 1) {
    const n = rand([2, 3]);
    const k = rand([1, 2]);
    return task(rootTex(n, pw(a, n * k)), rat(ipow(a, k)));
  }
  // основание — степень: ⁶√(16³), ⁴√(81²)
  const n = rand([3, 4, 6]);
  const j = rand([2, 3, 4]);  // основание a^j
  const m = randInt(1, 6);
  if ((j * m) % n !== 0) return null;
  const k = (j * m) / n;
  if (ipow(a, k) > 1000 || ipow(a, j) > 100) return null;
  const sign = level === 3 && n % 2 === 1 && m % 2 === 1 && chance(0.5);
  const base = sign ? `\\left(-${ipow(a, j)}\\right)` : ipow(a, j);
  return task(rootTex(n, pw(base, m)), rat(sign ? -ipow(a, k) : ipow(a, k)));
}

// 5. (ⁿ√a)^m
function powerOfRoot(level) {
  const a = rand([2, 3, 5, 6, 7]);
  if (level === 1) {
    const n = rand([2, 3]);
    return task(pw(`\\left(${rootTex(n, a)}\\right)`, n), rat(a));
  }
  const n = rand([2, 3, 4]);
  const k = rand(level === 2 ? [2, 3] : [3, 4, 5]);
  const v = ipow(a, k);
  if (v > 1000) return null;
  if (level === 3 && chance(0.4)) {
    // коэффициент перед корнем: (2√3)² = 12
    const c = randInt(2, 5);
    const r = rat(ipow(c, n * k) * v);
    if (r.n > 5000) return null;
    return task(pw(`\\left(${c}${rootTex(n, a)}\\right)`, n * k), r);
  }
  return task(pw(`\\left(${rootTex(n, a)}\\right)`, n * k), rat(v));
}

// 6. ⁿ√a · ⁿ√b
function productOfRoots(level) {
  return withOriginals(level, ORIG.productOfRoots, (lv) => {
    if (lv === 1) {
      const c = rand([2, 3, 5, 6, 7]);
      const ans = randInt(2, 6) * c;
      // √c · √(ans²/c)
      const other = (ans * ans) / c;
      if (!Number.isInteger(other)) return null;
      return task(`${rootTex(2, c)} \\cdot ${rootTex(2, other)}`, rat(ans));
    }
    if (lv === 2) {
      if (chance(0.5)) {
        // √10 · √1,6 = 4: второй множитель десятичный
        const ans = randInt(2, 12);
        const a = rand([10, 20, 30, 40, 50, 5, 2]);
        const b = rat(ans * ans, a);
        const bt = decOf(b);
        if (!bt || bt.length > 7 || b.d === 1) return null;
        return task(`${rootTex(2, a)} \\cdot ${rootTex(2, bt)}`, rat(ans));
      }
      const n = rand([3, 4]);
      const a = rand([2, 3, 5]);
      const i = randInt(1, n - 1);
      const k = rand([1, 2]);
      return task(`${rootTex(n, ipow(a, i))} \\cdot ${rootTex(n, ipow(a, n * k - i))}`, rat(ipow(a, k)));
    }
    // уровень 3: три множителя и отрицательное под кубическим корнем
    if (chance(0.5)) {
      const a = rand([2, 3, 5]);
      const b = rand([3, 5, 7].filter(x => x !== a));
      return task(`${rootTex(2, a)} \\cdot ${rootTex(2, b)} \\cdot ${rootTex(2, a * b)}`, rat(a * b));
    }
    const a = rand([2, 3]);
    const i = rand([1, 2]);
    return task(`${rootTex(3, `-${ipow(a, i)}`)} \\cdot ${rootTex(3, ipow(a, 3 * 2 - i))}`, rat(-ipow(a, 2)));
  });
}

// 7. Корень из дроби
function rootOfFraction(level) {
  if (level === 1) {
    const d = randInt(2, 10);
    return task(rootTex(2, `\\dfrac{1}{${d * d}}`), rat(1, d));
  }
  const n = level === 2 ? rand([2, 3]) : rand([2, 3, 4]);
  const a = randInt(1, 7);
  const b = randInt(2, 9);
  if (a >= b && level === 2) return null;
  const r = rat(a, b);
  if (r.d === 1) return null;
  const v = rpow(r, n);
  const neg = n === 3 && chance(0.5);
  const inner = level === 3 && v.n > v.d ? mixedTex(v) : `\\dfrac{${v.n}}{${v.d}}`;
  return task(rootTex(n, `${neg ? '-' : ''}${inner}`), neg ? rat(-r.n, r.d) : r);
}

// ─── Степени ─────────────────────────────────────────────────────────────────

// 8. a^{p/q}
function fractionalPower(level) {
  const a = rand([2, 3, 5]);
  const q = rand(level === 1 ? [2, 3] : [2, 3, 4, 5]);
  const p = level === 1 ? 1 : rand(level === 2 ? [1, 2, 3] : [-1, -2, -3, 2, 3]);
  const j = rand([1, 2]);  // основание = a^{q·j}
  const base = ipow(a, q * j);
  if (base > 1000 || p % q === 0 || gcd(p, q) !== 1) return null;
  const r = rpow(rat(ipow(a, j)), p);
  if (!r || r.n > 2000 || r.d > 2000) return null;
  const e = p < 0 ? `-\\frac{${-p}}{${q}}` : `\\frac{${p}}{${q}}`;
  // уровень 3: основание десятичной дробью — 0,25^{−1/2} = 2
  if (level === 3 && chance(0.4)) {
    const bt = decOf(rat(1, base));
    if (!bt || bt.length > 9) return null;
    return task(pw(bt, e), rpow(rat(ipow(a, j)), -p));
  }
  return task(pw(base, e), r);
}

// 9. (a/b)^x
function fractionPower(level) {
  const a = randInt(1, 5);
  const b = randInt(2, 7);
  if (a >= b || rat(a, b).d !== b) return null;
  const q = rand(level === 1 ? [2] : [2, 3]);
  const p = level === 1 ? 1 : rand(level === 2 ? [1, 2] : [-1, -2, -3]);
  const base = rpow(rat(a, b), q);
  if (base.d > 1000 || gcd(p, q) !== 1) return null;
  const e = p < 0 ? `-\\frac{${-p}}{${q}}` : `\\frac{${p}}{${q}}`;
  return task(pw(`\\left(\\dfrac{${base.n}}{${base.d}}\\right)`, e), rpow(rat(a, b), p));
}

// 10. Отрицательная степень
function negPower(level) {
  if (level === 1) {
    const a = rand([2, 3, 4, 5, 10]);
    const k = rand([1, 2, 3].filter(x => ipow(a, x) <= 125));
    return chance(0.5)
      ? task(pw(a, -k), rat(1, ipow(a, k)))
      : task(pw(`\\left(\\dfrac{1}{${a}}\\right)`, -k), rat(ipow(a, k)));
  }
  if (level === 2) {
    // (2/5)^{−2} = 6,25; 0,2^{−3} = 125
    const r = rand([rat(2, 5), rat(1, 5), rat(1, 2), rat(3, 4), rat(4, 5), rat(5, 2), rat(1, 4), rat(3, 2)]);
    const k = rand([1, 2, 3]);
    const v = rpow(r, -k);
    if (v.n > 1000) return null;
    const bt = chance(0.5) && decOf(r) ? decOf(r) : `\\dfrac{${r.n}}{${r.d}}`;
    return task(pw(wrap(bt), -k), v);
  }
  // уровень 3: смешанные числа и минус в основании
  const r = rand([rat(3, 2), rat(5, 2), rat(4, 3), rat(1, 2), rat(2, 3)]);
  const k = rand([1, 2, 3]);
  const neg = chance(0.5);
  const base = neg ? `-${mixedTex(r)}` : mixedTex(r);
  const v = rpow(neg ? rat(-r.n, r.d) : r, -k);
  return task(pw(`\\left(${base}\\right)`, -k), v);
}

// 11. a^x · a^y
function sameBaseProduct(level) {
  const a = rand([2, 3, 5, 6, 7, 10]);
  const total = randInt(1, a <= 3 ? 5 : 3);
  if (level === 1) {
    const x = randInt(-3, total + 3);
    const y = total - x;
    if (x === 0 || y === 0) return null;
    return task(`${pw(a, x)} \\cdot ${pw(a, y)}`, rat(ipow(a, total)));
  }
  const q = rand(level === 2 ? [2, 3, 4, 5] : [10, 20, 25, 4]);
  const n = randInt(1, total * q - 1);
  const x = rat(n, q);
  const y = rat(total * q - n, q);
  const tex = (r) => (level === 3 && decOf(r) ? decOf(r) : `\\frac{${r.n}}{${r.d}}`);
  if (x.d === 1) return null;
  return task(`${pw(a, tex(x))} \\cdot ${pw(a, tex(y))}`, rat(ipow(a, total)));
}

// 12. a^x : a^y
function sameBaseQuotient(level) {
  const a = rand([2, 3, 5, 7]);
  const total = randInt(1, a <= 3 ? 4 : 2);
  if (level === 1) {
    const y = randInt(1, 5);
    return task(`${pw(a, total + y)} : ${pw(a, y)}`, rat(ipow(a, total)));
  }
  const q = rand(level === 2 ? [2, 3, 4] : [10, 5]);
  const n = randInt(1, 2 * q);
  const y = rat(n, q);
  const x = addR(y, rat(total));
  if (y.d === 1) return null;
  const tex = (r) => (level === 3 && decOf(r) ? decOf(r) : `\\frac{${r.n}}{${r.d}}`);
  return task(`\\dfrac{${pw(a, tex(x))}}{${pw(a, tex(y))}}`, rat(ipow(a, total)));
}

// 13. (a^p)^q
function powerOfPower(level) {
  const a = rand([2, 3, 5, 7]);
  if (level === 1) {
    const p = randInt(2, 3);
    const q = randInt(2, 3);
    if (ipow(a, p * q) > 1000) return null;
    return task(pw(`\\left(${pw(a, p)}\\right)`, q), rat(ipow(a, p * q)));
  }
  if (level === 2) {
    const q = rand([2, 3, 4]);
    const k = randInt(1, 3);
    const p = randInt(1, 2 * q);
    if ((k * q) % p !== 0 || p % q === 0) return null;
    const outer = (k * q) / p;
    if (ipow(a, k) > 1000) return null;
    return task(pw(`\\left(${pw(a, `\\frac{${p}}{${q}}`)}\\right)`, outer), rat(ipow(a, k)));
  }
  // уровень 3: иррациональные показатели и основание-дробь
  const [s, t] = rand([[2, 2], [2, 8], [3, 3], [3, 12], [5, 5]]);
  const k = Math.round(Math.sqrt(s * t));
  const r = rand([rat(1, 2), rat(1, 3), rat(2, 3), rat(1, 5)]);
  const v = rpow(r, k);
  if (v.d > 1000) return null;
  return task(pw(`\\left(${pw(`\\left(\\dfrac{${r.n}}{${r.d}}\\right)`, rootTex(2, s))}\\right)`, rootTex(2, t)), v);
}

// 14. Иррациональные показатели
function irrationalExp(level) {
  return withOriginals(level, ORIG.irrationalExp, (lv) => {
    const a = rand([2, 3, 5, 7]);
    const m = rand([2, 3, 5, 6, 7]);
    if (lv === 1) {
      // a^{c + √m} · a^{d − √m}
      const c = randInt(1, 4);
      const d = randInt(-2, 3);
      const total = c + d;
      if (total < 1 || ipow(a, total) > 1000) return null;
      const second = d === 0 ? `-\\sqrt{${m}}` : `${d} - \\sqrt{${m}}`;
      return task(`${pw(a, `${c} + \\sqrt{${m}}`)} \\cdot ${pw(a, second)}`, rat(ipow(a, total)));
    }
    if (lv === 2) {
      // a^{k√m + c} · (a^2)^{d − (k/2)√m}: 3^{2√2+1} · 9^{2−√2} = 3^5
      const k = 2;
      const c = randInt(-1, 2);
      const d = randInt(1, 2);
      const total = c + 2 * d;
      if (total < 1 || ipow(a, total) > 1000 || a === 7) return null;
      const cTex = c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${-c}`;
      return task(`${pw(a, `${k}\\sqrt{${m}}${cTex}`)} \\cdot ${pw(a * a, `${d} - \\sqrt{${m}}`)}`, rat(ipow(a, total)));
    }
    // уровень 3: (a^{p+√m})^{p−√m} = a^{p²−m}
    const p = randInt(2, 4);
    const e = p * p - m;
    if (e < 1 || e > 4 || ipow(a, e) > 1000) return null;
    return task(pw(`\\left(${pw(a, `${p} + \\sqrt{${m}}`)}\\right)`, `${p} - \\sqrt{${m}}`), rat(ipow(a, e)));
  });
}

// 15. Число · корень
function decimalTimesRoot(level) {
  const a = randInt(2, level === 1 ? 10 : 20);
  if (level === 1) {
    const k = rand([rat(1, 2), rat(1, 10), rat(2), rat(3), rat(1, 4)]);
    const r = mulR(k, rat(a));
    return task(`${decOf(k)} \\cdot ${rootTex(2, a * a)}`, r);
  }
  // корень из десятичной: 0,4 · √0,25 и минус
  const k = rand([rat(4, 10), rat(5), rat(-2), rat(12, 10), rat(25, 10), rat(-3, 10)]);
  const b = rat(a, level === 2 ? 10 : 100);
  const inner = decOf(mulR(b, b));
  if (!inner || inner.length > 10) return null;
  const kt = decOf(k);
  return task(`${kt} \\cdot ${rootTex(2, inner)}`, mulR(k, b));
}

// ─── Новые экзаменационные типы ─────────────────────────────────────────────

// 16. √a / √b и √a·√b / √c (ОГЭ №8, база №16)
function rootQuotient(level) {
  return withOriginals(level, ORIG.rootQuotient, (lv) => {
    const m = rand([2, 3, 5, 6, 7, 10, 11]);
    const ans = randInt(2, 9);
    if (lv === 1) return task(`\\dfrac{${rootTex(2, ans * ans * m)}}{${rootTex(2, m)}}`, rat(ans));
    if (lv === 2) {
      if (chance(0.5)) {
        // √(m·a²·c²) / (c√m)
        const c = randInt(2, 4);
        const v = ans * ans * c * c * m;
        if (v > 2000) return null;
        return task(`\\dfrac{${rootTex(2, v)}}{${c}${rootTex(2, m)}}`, rat(ans));
      }
      // √(p·q)·√(q·r) / √(p·r) = q: √35·√21/√15 = 7
      const [p, q, r] = shuffle3([2, 3, 5, 7, 11]);
      return task(`\\dfrac{${rootTex(2, p * q)} \\cdot ${rootTex(2, q * r)}}{${rootTex(2, p * r)}}`, rat(q));
    }
    // уровень 3: корни 3-й и 4-й степени
    const n = rand([3, 4]);
    const a = rand([2, 3]);
    const i = randInt(1, n - 1);
    const j = n - i + n * rand([0, 1]);
    const k = (i + j) / n;
    const other = rand([5, 7]);
    return task(`\\dfrac{${rootTex(n, ipow(a, i) * other)} \\cdot ${rootTex(n, ipow(a, j))}}{${rootTex(n, other)}}`, rat(ipow(a, k)));
  });
}

function shuffle3(arr) {
  const a = [...arr].sort(() => Math.random() - 0.5);
  return a.slice(0, 3);
}

// 17. √(a·b·c) (ОГЭ №8)
function rootOfProduct(level) {
  return withOriginals(level, ORIG.rootOfProduct, (lv) => {
    if (lv === 1) {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      return task(rootTex(2, `${a * a} \\cdot ${b * b}`), rat(a * b));
    }
    // три множителя, произведение — полный квадрат: p·q·k², q·r·…
    const pr = shuffle3([2, 3, 5, 7, 11]);
    const [p, q, r] = pr;
    const s = randInt(1, 3);
    const t = randInt(1, lv === 2 ? 3 : 4);
    const u = randInt(1, 2);
    const A = p * q * s * s;
    const B = q * r * t * t;
    const C = p * r * u * u;
    if (A < 6 || B < 6 || C < 6 || A > 300 || B > 300 || C > 300) return null;
    return task(rootTex(2, `${A} \\cdot ${B} \\cdot ${C}`), rat(p * q * r * s * t * u));
  });
}

// 18. (k√m)² / n и n / (k√m)²
function rootSquareFrac(level) {
  return withOriginals(level, ORIG.rootSquareFrac, (lv) => {
    const k = randInt(2, 7);
    const m = rand([2, 3, 5, 6, 7, 10, 11]);
    const sq = k * k * m;
    if (lv === 1) return task(pw(`\\left(${k}${rootTex(2, m)}\\right)`, 2), rat(sq));
    if (chance(0.5)) {
      const n = rand([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30]);
      const r = rat(sq, n);
      if (!decOf(r) || r.n > 500) return null;
      return task(`\\dfrac{${pw(`\\left(${k}${rootTex(2, m)}\\right)`, 2)}}{${n}}`, r);
    }
    const ans = randInt(2, lv === 2 ? 12 : 25);
    const top = ans * sq;
    if (top > 3000) return null;
    if (lv === 3) {
      // и в числителе квадрат: (3√2)² · (2√3)² / 36
      const k2 = randInt(2, 4);
      const m2 = rand([2, 3, 5]);
      const top3 = sq * k2 * k2 * m2;
      const n = rand([6, 8, 9, 10, 12, 15, 18, 20, 24]);
      const r = rat(top3, n);
      if (!decOf(r)) return null;
      return task(`\\dfrac{${pw(`\\left(${k}${rootTex(2, m)}\\right)`, 2)} \\cdot ${pw(`\\left(${k2}${rootTex(2, m2)}\\right)`, 2)}}{${n}}`, r);
    }
    return task(`\\dfrac{${top}}{${pw(`\\left(${k}${rootTex(2, m)}\\right)`, 2)}}`, rat(ans));
  });
}

// 19. √(a² − b²) — разность квадратов под корнем (профиль №8)
function sqrtDiffSquares(level) {
  return withOriginals(level, ORIG.sqrtDiffSquares, (lv) => {
    // a − b = s, a + b = t, s·t — полный квадрат
    const c = randInt(lv === 1 ? 3 : 10, lv === 1 ? 15 : lv === 2 ? 90 : 160);
    const sq = c * c;
    const pairs = [];
    for (let s = 1; s * s < sq; s++) {
      if (sq % s) continue;
      const t = sq / s;
      if ((s + t) % 2) continue;
      const a = (s + t) / 2;
      const b = (t - s) / 2;
      if (b < 2 || a > (lv === 1 ? 30 : 130)) continue;
      pairs.push([a, b]);
    }
    if (!pairs.length) return null;
    const [a, b] = rand(pairs);
    if (lv === 3 && chance(0.5)) {
      // в виде дроби: (a² − b²) : (a − b) = a + b
      return task(`\\left(${pw(a, 2)} - ${pw(b, 2)}\\right) : ${a + b}`, rat(a - b));
    }
    return task(rootTex(2, `${pw(a, 2)} - ${pw(b, 2)}`), rat(c));
  });
}

// 20. Степени разных оснований: 8¹¹·32⁻²/4⁷ (ОГЭ №8, база №16)
function powerMixedBases(level) {
  return withOriginals(level, ORIG.powerMixedBases, (lv) => {
    const p = rand([2, 3, 5]);
    const powers = [1, 2, 3, 4, 5].map(j => [ipow(p, j), j]).filter(([v]) => v <= 125);
    const target = randInt(1, p === 2 ? 6 : 3);
    if (lv === 1) {
      // одно основание: p^a · p^b : p^c
      const a = randInt(2, 9);
      const c = randInt(2, 9);
      const b = target + c - a;
      if (b === 0) return null;
      return task(`${pw(p, a)} \\cdot ${pw(p, b)} : ${pw(p, c)}`, rat(ipow(p, target)));
    }
    if (lv === 2) {
      // три числа — степени одного простого
      const [A, ja] = rand(powers.filter(([, j]) => j >= 2));
      const [B, jb] = rand(powers.filter(([v]) => v !== A));
      const [C, jc] = rand(powers.filter(([v]) => v !== A && v !== B));
      const x = randInt(2, 11);
      const y = rand([-3, -2, 2, 3]);
      // ja·x + jb·y − jc·z = target
      const rest = ja * x + jb * y - target;
      if (rest % jc !== 0) return null;
      const z = rest / jc;
      if (z === 0 || Math.abs(z) > 15) return null;
      return task(`\\dfrac{${pw(A, x)} \\cdot ${pw(B, y)}}{${pw(C, z)}}`, rat(ipow(p, target)));
    }
    // уровень 3: два простых: 24⁴ / (3²·8³) = 72
    const q = rand([3, 5].filter(x => x !== p));
    const a = rand([1, 2, 3]);           // база p^a·q
    const N = ipow(p, a) * q;
    const k = randInt(2, 4);
    const [P, jp] = rand(powers.filter(([, j]) => j >= 2));
    const tp = randInt(1, 2);
    const tq = randInt(0, 1);
    // N^k / (q^{k−tq} · P^{z}): степень p: a·k − jp·z = tp
    if ((a * k - tp) % jp !== 0) return null;
    const z = (a * k - tp) / jp;
    if (z < 1 || ipow(N, k) > 400000) return null;
    const ans = ipow(p, tp) * ipow(q, tq);
    return task(`\\dfrac{${pw(N, k)}}{${pw(q, k - tq)} \\cdot ${pw(P, z)}}`, rat(ans));
  });
}

// 21. Дробные показатели одного простого: 5^{0,36}·25^{0,32}
function decimalExponent(level) {
  return withOriginals(level, ORIG.decimalExponent, (lv) => {
    const p = rand([2, 3, 5, 7]);
    const target = randInt(1, p === 2 ? 4 : 2);
    if (lv === 1) {
      const x = rat(randInt(1, 9), 10);
      const y = addR(rat(target), rat(-x.n, x.d));
      return task(`${pw(p, decOf(x))} \\cdot ${pw(p, decOf(y))}`, rat(ipow(p, target)));
    }
    if (lv === 2) {
      // p^x · (p^j)^y или (p^i)^x : (p^j)^y
      const i = rand([1, 2, 3]);
      const j = rand([2, 3].filter(v => v !== i));
      if (ipow(p, j) > 125 || ipow(p, i) > 125) return null;
      const den = rand([10, 100]);
      const y = rat(randInt(1, den - 1) + (den === 10 ? 10 : 0), den);
      if (chance(0.5)) {
        // i·x + j·y = target
        const x = divR(addR(rat(target), rat(-j * y.n, y.d)), rat(i));
        const xt = decOf(x);
        if (!xt || x.n <= 0 || xt.length > 8) return null;
        return task(`${pw(ipow(p, i), xt)} \\cdot ${pw(ipow(p, j), decOf(y))}`, rat(ipow(p, target)));
      }
      // i·x − j·y = target
      const x = divR(addR(rat(target), rat(j * y.n, y.d)), rat(i));
      const xt = decOf(x);
      if (!xt || xt.length > 8) return null;
      return task(`\\dfrac{${pw(ipow(p, i), xt)}}{${pw(ipow(p, j), decOf(y))}}`, rat(ipow(p, target)));
    }
    // уровень 3: два простых: (pq)^{x} · p^{y} : q^{z}
    const q = rand([2, 3, 5, 7].filter(v => v !== p));
    const x = rat(randInt(21, 79), 10);
    if (x.d === 1) return null;
    const tp = randInt(0, 2);
    const tq = randInt(1, 2);
    const y = addR(rat(tp), rat(-x.n, x.d));   // p: x + y = tp
    const z = addR(x, rat(-tq));               // q: x − z = tq
    const ans = ipow(p, tp) * ipow(q, tq);
    if (ans > 2000) return null;
    return task(`${pw(p * q, decOf(x))} \\cdot ${pw(p, decOf(y))} : ${pw(q, decOf(z))}`, rat(ans));
  });
}

// 22. Стандартный вид числа (база №16)
function sciNotation(level) {
  return withOriginals(level, ORIG.sciNotation, (lv) => {
    const m1 = rand([rat(2), rat(3), rat(4), rat(5), rat(15, 10), rat(24, 10), rat(25, 10), rat(12, 10)]);
    const m2 = rand([rat(2), rat(3), rat(4), rat(6), rat(5, 10), rat(23, 10), rat(15, 10)]);
    if (lv === 1) {
      const a = randInt(1, 3);
      const b = randInt(1, 2);
      return task(`${decOf(m1)} \\cdot ${p10(a)} \\cdot ${decOf(m2)} \\cdot ${p10(b)}`,
        mulR(mulR(m1, m2), rat(ipow(10, a + b))), { maxDigits: 6 });
    }
    const a = randInt(-4, 5);
    const b = randInt(-7, 3);
    const e = a + b;
    if (e < -3 || e > 5 || a === 0 || b === 0) return null;
    const scale = pow10(e);
    if (lv === 2) {
      return task(`\\left(${decOf(m1)} \\cdot ${p10(a)}\\right) \\cdot \\left(${decOf(m2)} \\cdot ${p10(b)}\\right)`,
        mulR(mulR(m1, m2), scale), { maxDigits: 6 });
    }
    // уровень 3: частное и сумма разрядов
    if (chance(0.5)) {
      const d1 = randInt(1, 9);
      const d2 = randInt(1, 9);
      const d3 = randInt(1, 9);
      const r = addR(addR(rat(d1, 1000), rat(d2, 100)), rat(d3, 10));
      return task(`${d1} \\cdot 10^{-3} + ${d2} \\cdot 10^{-2} + ${d3} \\cdot 10^{-1}`, r);
    }
    const a3 = randInt(1, 5);
    const b3 = rand([-3, -2, -1, 1, 2]);
    const q = mulR(divR(m1, m2), pow10(a3 - b3));
    const qt = decOf(q);
    if (!qt || qt.length > 9 || q.n / q.d > 1e6) return null;
    return task(`\\dfrac{${decOf(m1)} \\cdot ${p10(a3)}}{${decOf(m2)} \\cdot ${p10(b3)}}`, q);
  });
}

// В стандартном виде 10¹ пишется степенью
const p10 = (e) => `10^{${e}}`;
const pow10 = (e) => (e >= 0 ? rat(ipow(10, e)) : rat(1, ipow(10, -e)));

// 23. Степени с буквой при a = …: a²¹·a⁻⁸:a¹¹ при a = 5 (ОГЭ №8)
function powerAtValue(level) {
  const a = rand([2, 3, 4, 5, 7]);
  const target = randInt(1, a <= 3 ? 4 : 3);
  const at = `\\ \\text{при}\\ a = ${a}`;
  if (level === 1) {
    const x = randInt(5, 15);
    return task(`\\dfrac{a^{${x}}}{a^{${x - target}}}${at}`, rat(ipow(a, target)));
  }
  if (level === 2) {
    if (chance(0.5)) {
      const x = randInt(8, 22);
      const y = randInt(-9, 9);
      const z = x + y - target;
      if (y === 0 || z <= 0) return null;
      return task(`a^{${x}} \\cdot a^{${y}} : a^{${z}}${at}`, rat(ipow(a, target)));
    }
    const p = randInt(2, 8);
    const q = rand([2, 3]);
    const z = p * q - target;
    return task(`\\dfrac{\\left(a^{${p}}\\right)^{${q}}}{a^{${z}}}${at}`, rat(ipow(a, target)));
  }
  // уровень 3: ответ от a не зависит — (6a)² : a⁷ · a⁵ = 36
  const c = randInt(2, 7);
  const k = rand([2, 3]);
  const x = randInt(4, 9);
  return task(`\\left(${c}a\\right)^{${k}} : a^{${x}} \\cdot a^{${x - k}},\\ a \\neq 0`, rat(ipow(c, k)));
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export const POW_GENERATORS = {
  simpleSqrt, nthRoot, nestedRoot, rootOfPower, powerOfRoot, productOfRoots,
  rootOfFraction, rootQuotient, rootOfProduct, rootSquareFrac, sqrtDiffSquares,
  fractionalPower, fractionPower, negPower, sameBaseProduct, sameBaseQuotient,
  powerOfPower, irrationalExp, decimalTimesRoot,
  powerMixedBases, decimalExponent, sciNotation, powerAtValue,
};

export const POW_LABELS = {
  simpleSqrt:       '√N',
  nthRoot:          'Корень n-й степени',
  nestedRoot:       'Корень из корня',
  rootOfPower:      'ⁿ√(aᵐ)',
  powerOfRoot:      '(ⁿ√a)ᵐ',
  productOfRoots:   'ⁿ√a · ⁿ√b: √10·√1,6',
  rootOfFraction:   'Корень из дроби',
  rootQuotient:     '√a / √b: √147/√3',
  rootOfProduct:    '√(a·b·c): √(45·220·44)',
  rootSquareFrac:   '(k√m)² / n: (6√5)²/24',
  sqrtDiffSquares:  '√(a² − b²): √(89² − 39²)',
  fractionalPower:  'Дробный показатель: 27^{2/3}',
  fractionPower:    'Степень дроби: (9/25)^{1/2}',
  negPower:         'Отрицательная степень',
  sameBaseProduct:  'aˣ · aʸ',
  sameBaseQuotient: 'aˣ : aʸ',
  powerOfPower:     '(aᵖ)^q',
  irrationalExp:    'Иррациональные показатели',
  decimalTimesRoot: 'Число · корень',
  powerMixedBases:  'Разные основания: 8¹¹·32⁻²/4⁷',
  decimalExponent:  'Десятичные показатели: 5^{0,36}·25^{0,32}',
  sciNotation:      'Стандартный вид: (4·10⁴)·(2,4·10⁻¹)',
  powerAtValue:     'aˣ·aʸ:aᶻ при a = 5',
};

export const POW_EXAM = {
  simpleSqrt: ['О8'],
  productOfRoots: ['О8', 'Б16', 'П8'],
  rootQuotient: ['О8', 'Б16', 'П8'],
  rootOfProduct: ['О8'],
  rootSquareFrac: ['О8', 'Б16', 'П8'],
  sqrtDiffSquares: ['П8'],
  rootOfFraction: ['Б16'],
  fractionalPower: ['Б16', 'П8'],
  fractionPower: ['П8'],
  negPower: ['О8', 'Б16'],
  sameBaseProduct: ['Б16', 'П8'],
  sameBaseQuotient: ['Б16', 'П8'],
  powerOfPower: ['П8'],
  irrationalExp: ['Б16', 'П8'],
  powerMixedBases: ['О8', 'Б16', 'П8'],
  decimalExponent: ['Б16', 'П8'],
  sciNotation: ['Б16'],
  powerAtValue: ['О8', 'П8'],
  rootOfPower: ['П8'],
  nthRoot: ['П8'],
};

export const POW_GROUPS = [
  { label: 'Корни', keys: ['simpleSqrt', 'nthRoot', 'nestedRoot', 'rootOfPower', 'powerOfRoot', 'rootOfFraction', 'decimalTimesRoot'] },
  { label: 'Действия с корнями', keys: ['productOfRoots', 'rootQuotient', 'rootOfProduct', 'rootSquareFrac', 'sqrtDiffSquares'] },
  { label: 'Степени', keys: ['fractionalPower', 'fractionPower', 'negPower', 'sameBaseProduct', 'sameBaseQuotient', 'powerOfPower', 'irrationalExp'] },
  { label: 'Степени: экзаменационные', keys: ['powerMixedBases', 'decimalExponent', 'sciNotation', 'powerAtValue'] },
];
