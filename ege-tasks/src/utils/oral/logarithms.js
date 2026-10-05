/**
 * Логарифмы для устного счёта: ЕГЭ профиль №8 и база №16.
 *
 * Почти все задания держатся на одной идее: основание и аргумент — степени
 * одного числа t (`b = t^β`, `N = t^ν`), тогда `log_b N = ν/β`. Записать
 * t^e можно многими способами — 8, 2³, 0,125, √8, 2√2, ∛4, — поэтому один
 * «двигатель» (`powerForms`) даёт и табличное `log₂ 8`, и экзаменационное
 * `log_{0,25} 2`, и `log_{√3} 9`. Ответ считается из ν/β, а не подбирается.
 *
 * Генератор категории — `(level) => { exprLatex, resultLatex } | null`;
 * null значит «числа не подошли», план листа попросит ещё раз.
 */
import {
  rat, mulR, divR, addR, decTex, rand, randInt, chance, answerTex, task,
  withOriginals, ipow,
} from './kit';

// ─── Запись числа t^e ────────────────────────────────────────────────────────

const LIMIT = 100000;

const rootTex = (q, inner) => (q === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${q}]{${inner}}`);

/**
 * Способы записать t^e (e — рациональное, знаменатель ≤ 4).
 * `pow` — разрешена запись степенью (2^{5}), `dec` — десятичной дробью.
 */
export function powerForms(t, e, { pow = false, dec = true, frac = true } = {}) {
  const forms = [];
  if (e.d === 1) {
    const k = e.n;
    if (k >= 0) {
      const v = ipow(t, k);
      if (v <= LIMIT) forms.push(String(v));
      if (pow && k >= 2) forms.push(`${t}^{${k}}`);
    } else {
      const v = ipow(t, -k);
      if (v <= LIMIT) {
        if (frac) forms.push(`\\dfrac{1}{${v}}`);
        const d = dec ? decTex(rat(1, v)) : null;
        if (d && d.length <= 9) forms.push(d);
      }
      if (pow) forms.push(`${t}^{${k}}`);
    }
    return forms;
  }
  const q = e.d;
  const p = e.n;
  if (q > 4) return forms;
  if (p > 0) {
    const inner = ipow(t, p);
    if (inner <= 10000) forms.push(rootTex(q, inner));
    const whole = Math.floor(p / q);
    const rest = p - whole * q;
    if (whole >= 1 && rest > 0 && ipow(t, whole) <= 1000) {
      forms.push(`${ipow(t, whole)}${rootTex(q, ipow(t, rest))}`);
    }
  } else if (frac) {
    const inner = ipow(t, -p);
    if (inner <= 10000) forms.push(`\\dfrac{1}{${rootTex(q, inner)}}`);
  }
  return forms;
}

/** Основание логарифма в нижнем индексе: дроби там мельче — \frac. */
function baseForm(t, beta, opts) {
  const forms = powerForms(t, beta, opts).filter(f => f !== '1');
  if (!forms.length) return null;
  return rand(forms).replace(/\\dfrac/g, '\\frac');
}

/** \log_{b} с правильной записью: lg для 10, фигурные скобки всегда. */
function logOp(baseTex) {
  return baseTex === '10' ? '\\lg' : `\\log_{${baseTex}}`;
}

// Основания без «степенной» записи: 4, 8, 9 получаются как t^β
const PRIMES_SMALL = [2, 3, 5];
const BASES_MID = [2, 3, 5, 6, 7];

/**
 * log_b N, где b = t^β и N = t^ν: ответ ν/β. `argOpts`/`baseOpts` — какими
 * записями можно печатать аргумент и основание.
 */
function logTask(t, beta, nu, { argOpts = {}, baseOpts = {} } = {}) {
  if (beta.n === 0) return null;
  const forms = powerForms(t, nu, argOpts);
  if (!forms.length) return null;
  const arg = argTex(rand(forms));
  if (t === 10 && beta.n === 1 && beta.d === 1) return task(`\\lg ${arg}`, divR(nu, beta));
  const b = baseForm(t, beta, baseOpts);
  if (!b) return null;
  return task(`${logOp(b)} ${arg}`, divR(nu, beta));
}

/** Аргумент «число·корень» берётся в скобки: log₂ (5√2), а не log₂ 5√2. */
function argTex(form) {
  return /^\d+\\sqrt/.test(form) ? `\\left(${form}\\right)` : form;
}

/** Ответ «удобный»: целое или короткая десятичная, иначе дробь со знаменателем ≤ 4. */
function niceValue(r, level) {
  if (r.d === 1) return Math.abs(r.n) <= 12;
  const digits = r.d === 2 || r.d === 4 || r.d === 5 || r.d === 10;
  return digits || (level === 3 && r.d <= 4);
}

// ─── Группа «Определение» ───────────────────────────────────────────────────

// Образцы с «Решу» / ФИПИ (уровень «Как на экзамене»)
const ORIG = {
  basicLog: [
    { expr: '\\log_{\\sqrt{3}} 9', ans: '4' },
    { expr: '\\log_{\\sqrt[6]{13}} 13', ans: '6' },
    { expr: '\\log_{\\frac{1}{11}} \\sqrt{11}', ans: '-0{,}5' },
    { expr: '\\log_{0{,}25} 2', ans: '-0{,}5' },
  ],
  logSum: [
    { expr: '\\log_{3} 8{,}1 + \\log_{3} 10', ans: '4' },
    { expr: '\\log_{3} 0{,}9 + \\log_{3} 10', ans: '2' },
  ],
  logDiff: [
    { expr: '\\log_{5} 60 - \\log_{5} 2{,}4', ans: '2' },
    { expr: '\\log_{2} 112 - \\log_{2} 7', ans: '4' },
    { expr: '\\log_{0{,}3} 10 - \\log_{0{,}3} 3', ans: '-1' },
  ],
  basicIdentity: [
    { expr: '6 \\cdot 7^{\\log_{7} 2}', ans: '12' },
    { expr: '7^{\\log_{7} 3 + 1}', ans: '21' },
    { expr: '2^{\\log_{2} 6 - 3}', ans: '0{,}75' },
    { expr: '8^{2 + \\log_{8} 12}', ans: '768' },
  ],
  complexIdentity: [
    { expr: '36^{\\log_{6} 5}', ans: '25' },
    { expr: '9^{\\log_{3} 4}', ans: '16' },
    { expr: '64^{\\log_{4} 5}', ans: '125' },
    { expr: '5^{\\log_{25} 49}', ans: '7' },
    { expr: '64^{\\log_{8} \\sqrt{3}}', ans: '3' },
  ],
  logRatio: [
    { expr: '\\dfrac{\\log_{2} 49}{\\log_{2} 7}', ans: '2' },
    { expr: '\\dfrac{\\log_{5} 11^{15}}{3 \\log_{5} 11}', ans: '5' },
    { expr: '\\dfrac{\\log_{9} \\sqrt[10]{8}}{\\log_{9} 8}', ans: '0{,}1' },
  ],
  nestedLog: [
    { expr: '\\log_{16} \\left(\\log_{2} 4\\right)', ans: '0{,}25' },
    { expr: '\\log_{4} \\log_{5} 25', ans: '0{,}5' },
    { expr: '\\log_{2} \\left(\\log_{3} 81 + 124\\right)', ans: '7' },
  ],
  logProduct: [
    { expr: '\\log_{3} 243 \\cdot \\log_{2} 256', ans: '40' },
    { expr: '\\log_{2} 32 \\cdot \\log_{5} 125', ans: '15' },
    { expr: '\\left(1 - \\log_{8} 24\\right)\\left(1 - \\log_{3} 24\\right)', ans: '1' },
  ],
};

// 1. log_a N — целый ответ
function basicLog(level) {
  return withOriginals(level, ORIG.basicLog, (lv) => {
    if (lv === 1) {
      const t = rand(PRIMES_SMALL);
      return logTask(t, rat(1), rat(randInt(1, t === 2 ? 6 : 4)));
    }
    if (lv === 2) {
      // основание — степень: log₄ 64, log₈ 512, log₉ 729
      const t = rand(BASES_MID);
      const beta = rat(rand([1, 1, 2, 3]));
      const k = randInt(beta.n > 1 ? 2 : 1, 4);
      return logTask(t, beta, mulR(beta, rat(k)));
    }
    // уровень 3: основание — корень или дробь, ответ всё равно целый
    const t = rand([2, 3, 5, 7]);
    const beta = rand([rat(1, 2), rat(1, 3), rat(-1), rat(-2), rat(-1, 2)]);
    const k = rand([-3, -2, 2, 3, 4, 5, 6]);
    return logTask(t, beta, mulR(beta, rat(k)), { argOpts: { pow: true } });
  });
}

// 2. log_a (1/N) — отрицательный ответ
function logReciprocal(level) {
  if (level === 1) {
    const t = rand(PRIMES_SMALL);
    return logTask(t, rat(1), rat(-randInt(1, 3)), { argOpts: { dec: false } });
  }
  if (level === 2) {
    // аргумент десятичной дробью или «1/N»: log₂ 0,125, log₅ 0,04, log₃ (1/81)
    const t = rand([2, 3, 5, 7, 10]);
    const beta = rat(t === 2 ? rand([1, 1, 2, 3]) : t === 3 ? rand([1, 2]) : 1);
    const k = randInt(1, t === 2 ? 6 : t === 10 ? 4 : 3);
    return logTask(t, beta, mulR(beta, rat(-k)), { argOpts: { frac: chance(0.5) } });
  }
  // уровень 3: основание тоже дробь — минус на минус
  const t = rand([2, 3, 5]);
  const beta = rat(-rand([1, 2]));
  const k = randInt(1, 3);
  return logTask(t, beta, mulR(beta, rat(chance(0.5) ? -k : k)));
}

// 3. log_a 1 = 0 и log_a a = 1
function logOne(level) {
  const a = rand([2, 3, 5, 7, 9, 11, 13, 17]);
  if (level === 1) {
    return chance(0.5)
      ? task(`\\log_{${a}} 1`, rat(0))
      : task(`\\log_{${a}} ${a}`, rat(1));
  }
  const b = rand([2, 3, 6, 7, 12, 19].filter(x => x !== a));
  const k = randInt(2, level === 3 ? 9 : 5);
  const m = randInt(2, 7);
  if (level === 2) {
    return task(`${k}\\log_{${a}} ${a} - \\log_{${b}} 1`, rat(k));
  }
  return task(`${k}\\log_{${a}} ${a} + ${m}\\log_{${b}} 1 - \\lg 10`, rat(k - 1));
}

// 4. Логарифм корня: log_a √a, log₂ √8, log_{√3} 9
function logOfRoot(level) {
  const t = rand([2, 3, 5, 7]);
  if (level === 1) {
    return logTask(t, rat(1), rat(1, rand([2, 3, 4])));
  }
  if (level === 2) {
    const nu = rand([rat(3, 2), rat(5, 2), rat(1, 2), rat(3, 4), rat(2, 3)]);
    if (chance(0.35)) {
      // основание — корень: log_{√3} 9 = 4, log_{⁶√13} 13 = 6
      const q = rand([2, 3]);
      return logTask(rand([2, 3, 5, 7, 13]), rat(1, q), rat(rand([1, 2])));
    }
    return logTask(t, rat(1), nu);
  }
  // уровень 3: корень и в основании, и в аргументе
  const beta = rand([rat(1, 2), rat(1, 3), rat(3, 2)]);
  const nu = rand([rat(2, 3), rat(3, 2), rat(-1, 2), rat(5, 2), rat(-2), rat(4)]);
  const r = divR(nu, beta);
  if (!niceValue(r, 3)) return null;
  return logTask(t, beta, nu, { argOpts: { pow: true } });
}

// 5. Десятичный логарифм степеней 10
function lgPower(level) {
  if (level === 1) {
    return logTask(10, rat(1), rat(rand([1, 2, 3, 4, 5, 6, -1, -2, -3, -4])), { argOpts: { frac: chance(0.3) } });
  }
  if (level === 2) {
    const nu = rand([rat(-3), rat(-4), rat(-5), rat(-2), rat(-1), rat(1, 2), rat(3, 2), rat(5, 2),
      rat(1, 3), rat(2, 3), rat(1, 4), rat(3, 4), rat(5), rat(6), rat(-1, 2)]);
    return logTask(10, rat(1), nu, { argOpts: { pow: chance(0.3) } });
  }
  const nu = rand([rat(2, 3), rat(3, 4), rat(-1, 2), rat(5, 2), rat(-3, 2), rat(1, 4)]);
  return logTask(10, rat(1), nu);
}

// ─── Группа «Основное тождество» ────────────────────────────────────────────

// 6. a^{log_a b} = b и его вариации с множителем и сдвигом показателя
function basicIdentity(level) {
  return withOriginals(level, ORIG.basicIdentity, (lv) => {
    const a = rand([2, 3, 5, 6, 7, 8, 9]);
    const b = rand([2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 15].filter(x => x !== a));
    const lg = a === 10 ? '\\lg' : `\\log_{${a}}`;
    if (lv === 1) return task(`${a}^{${lg} ${b}}`, rat(b));
    if (lv === 2) {
      const kind = rand(['mul', 'plus', 'minus']);
      if (kind === 'mul') {
        const k = randInt(2, 9);
        return task(`${k} \\cdot ${a}^{${lg} ${b}}`, rat(k * b));
      }
      if (kind === 'plus') {
        const k = rand([1, 1, 2]);
        if (ipow(a, k) * b > 1000) return null;
        return task(chance(0.5) ? `${a}^{${lg} ${b} + ${k}}` : `${a}^{${k} + ${lg} ${b}}`,
          rat(ipow(a, k) * b));
      }
      const k = rand([1, 2]);
      const r = rat(b, ipow(a, k));
      return answerTex(r, { maxDigits: 3 }).includes('frac') ? null
        : task(`${a}^{${lg} ${b} - ${k}}`, r);
    }
    // уровень 3: и множитель, и сдвиг; ответ десятичной дробью
    const k = rand([1, 2, 3]);
    const m = randInt(2, 6);
    const r = rat(m * b, ipow(a, k));
    if (!/^-?\d+(\{,\}\d{1,3})?$/.test(answerTex(r))) return null;
    return task(`${m} \\cdot ${a}^{${lg} ${b} - ${k}}`, r);
  });
}

// 7. (a^m)^{log_{a^n} c^n} = c^m: 9^{log₃ 4} = 16, 5^{log₂₅ 49} = 7
function complexIdentity(level) {
  return withOriginals(level, ORIG.complexIdentity, (lv) => {
    if (lv === 1) {
      // a^{k·log_a c} = c^k
      const a = rand([2, 3, 5, 7]);
      const c = rand([2, 3, 4, 5, 6, 7, 9].filter(x => x !== a));
      const k = rand([2, 3]);
      if (ipow(c, k) > 400) return null;
      return task(`${a}^{${k}\\log_{${a}} ${c}}`, rat(ipow(c, k)));
    }
    const p = rand(lv === 2 ? [2, 3, 5, 6] : [2, 3, 5]);
    const m = rand(lv === 2 ? [2, 3] : [2, 3, 1]);
    const n = rand(lv === 2 ? [1, 1, 2] : [2, 3]);
    if (m === n) return null;
    const c = rand([2, 3, 4, 5, 6, 7].filter(x => x !== p));
    const ans = ipow(c, m);
    if (ans > 1000) return null;
    // уровень 3: основания — дроби (0,5 и 0,25) — минусы сокращаются
    const flip = lv === 3 && chance(0.5);
    const T = flip ? powerForms(p, rat(-m), { frac: false })[0] ?? `\\dfrac{1}{${ipow(p, m)}}`
      : String(ipow(p, m));
    const B = flip ? baseForm(p, rat(-n)) : String(ipow(p, n));
    const arg = ipow(c, n);
    if (!B || arg > 10000) return null;
    const Ttex = T.includes('frac') || T.includes('{,}') ? `\\left(${T}\\right)` : T;
    return task(`${Ttex}^{${logOp(B)} ${arg}}`, rat(ans));
  });
}

// 8. log_a a^k
function logOfSameBasePower(level) {
  if (level === 1) {
    const a = rand([2, 3, 4, 5, 7, 10]);
    const k = rand([-5, -3, -2, 2, 3, 4, 5, 7, 10]);
    return task(`${logOp(String(a))} ${a}^{${k}}`, rat(k));
  }
  if (level === 2) {
    // (a^j)^k или дробный показатель: log₃ 9⁵ = 10, log₇ 7^{0,5}
    const t = rand([2, 3, 5]);
    if (chance(0.5)) {
      const j = rand([2, 3]);
      const k = rand([-3, -2, 2, 3, 4, 5]);
      return task(`\\log_{${t}} ${ipow(t, j)}^{${k}}`, rat(j * k));
    }
    const e = rand([rat(1, 2), rat(3, 2), rat(-1, 2), rat(5, 2), rat(1, 5)]);
    const eTex = decTex(e);
    return task(`\\log_{${t}} ${t}^{${eTex}}`, e);
  }
  // уровень 3: основание — корень: log_{√3} 3⁴ = 8
  const t = rand([2, 3, 5, 7]);
  const q = rand([2, 3]);
  const k = rand([2, 3, 4, -2, -3]);
  return task(`\\log_{${rootTex(q, t)}} ${t}^{${k}}`, rat(q * k));
}

// ─── Группа «Сумма, разность, частное» ──────────────────────────────────────

/** Делители числа v, для которых v/d — короткая десятичная дробь. */
function decimalSplits(v) {
  const out = [];
  for (const d of [2, 4, 5, 8, 10, 20, 25, 40, 50, 100]) {
    const r = rat(v, d);
    const tex = decTex(r);
    if (tex && tex.includes('{,}') && tex.length <= 6) out.push([tex, String(d)]);
  }
  return out;
}

/** Разбить t^k на два множителя, ни один из которых не степень t. */
function splitPower(t, k, level) {
  const v = ipow(t, k);
  const isPow = (x) => { let y = x; while (y % t === 0) y /= t; return y === 1; };
  if (level >= 2 && chance(0.6)) {
    const dec = decimalSplits(v);
    if (dec.length) return rand(dec);
  }
  const pairs = [];
  for (let d = 2; d * d <= v; d++) {
    if (v % d === 0 && !isPow(d) && !isPow(v / d)) pairs.push([String(d), String(v / d)]);
  }
  return pairs.length ? rand(pairs) : null;
}

// 9. log_a x + log_a y, где xy — степень a
function logSum(level) {
  return withOriginals(level, ORIG.logSum, (lv) => {
    if (lv === 1) {
      const t = rand(PRIMES_SMALL);
      const i = randInt(1, 3);
      const j = randInt(1, 3);
      return task(`\\log_{${t}} ${ipow(t, i)} + \\log_{${t}} ${ipow(t, j)}`, rat(i + j));
    }
    const t = rand(lv === 2 ? [2, 3, 5, 6, 12, 15] : [2, 3, 5, 6, 10, 12]);
    const k = randInt(t > 5 ? 2 : 2, t > 5 ? 2 : 4);
    const pair = splitPower(t, k, lv);
    if (!pair) return null;
    const [x, y] = chance(0.5) ? pair : [pair[1], pair[0]];
    const op = logOp(String(t));
    if (lv === 2) return task(`${op} ${x} + ${op} ${y}`, rat(k));
    // уровень 3: коэффициент — 2·log₆ 3 + log₆ 4 = 2
    const s = rand([2, 3]);
    const base = rand([2, 3, 5]);
    const big = ipow(base, s);
    for (let m = 1; m <= 3; m++) {
      const target = ipow(t, m);
      if (target % big === 0 && target / big > 1) {
        const rest = target / big;
        return task(`${s}${op} ${base} + ${op} ${rest}`, rat(m));
      }
    }
    return task(`${op} ${x} + ${op} ${y} - ${op} ${t}`, rat(k - 1));
  });
}

// 10. log_a x − log_a y, где x/y — степень a
function logDiff(level) {
  return withOriginals(level, ORIG.logDiff, (lv) => {
    const t = rand(lv === 1 ? PRIMES_SMALL : [2, 3, 5, 7]);
    const k = randInt(1, lv === 1 ? 3 : 4);
    const op = `\\log_{${t}}`;
    if (lv === 1) {
      const j = randInt(1, 3);
      return task(`${op} ${ipow(t, j + k)} - ${op} ${ipow(t, j)}`, rat(k));
    }
    // y — не степень t, x = y·t^k; y бывает десятичной дробью
    const ys = [rat(3), rat(7), rat(6), rat(12, 10), rat(24, 10), rat(8, 10), rat(15, 10), rat(5, 2)];
    const y = rand(ys.filter(r => r.n % t !== 0 || r.d !== 1));
    const x = mulR(y, rat(ipow(t, k)));
    const xt = decTex(x);
    const yt = decTex(y);
    if (!xt || !yt || xt.length > 7) return null;
    if (lv === 2) return task(`${op} ${xt} - ${op} ${yt}`, rat(k));
    // уровень 3: основание — десятичная дробь или «наоборот» (ответ отрицательный)
    if (chance(0.5)) return task(`${op} ${yt} - ${op} ${xt}`, rat(-k));
    const s = rand([2, 3]);
    const b = rand([6, 10, 12]);
    // s·log_t b − log_t (b^s / t^m) = m
    const m = randInt(1, 3);
    const rest = rat(ipow(b, s), ipow(t, m));
    const rt = decTex(rest);
    if (!rt || rt.length > 7) return null;
    return task(`${s}${op} ${b} - ${op} ${rt}`, rat(m));
  });
}

// 11. lg x ± lg y
function lgSumDiff(level) {
  if (level === 1) {
    const k = randInt(1, 3);
    const v = ipow(10, k);
    const ds = [2, 4, 5, 20, 25, 50].filter(d => v % d === 0 && v / d > 1);
    const d = rand(ds);
    return chance(0.5)
      ? task(`\\lg ${d} + \\lg ${v / d}`, rat(k))
      : task(`\\lg ${v * d} - \\lg ${d}`, rat(k));
  }
  const k = rand(level === 2 ? [1, 2, 3] : [-1, 1, 2, 3]);
  const target = k >= 0 ? rat(ipow(10, k)) : rat(1, ipow(10, -k));
  const xs = [rat(5, 10), rat(25, 10), rat(4), rat(8), rat(125), rat(2), rat(5), rat(16), rat(25), rat(40),
    rat(625, 10), rat(2, 10), rat(4, 10), rat(8, 10), rat(125, 10), rat(32), rat(50), rat(250), rat(20), rat(80)];
  const x = rand(xs);
  const y = divR(target, x);
  const xt = decTex(x);
  const yt = decTex(y);
  if (!xt || !yt || yt.length > 6) return null;
  if (level === 2) {
    return chance(0.7)
      ? task(`\\lg ${xt} + \\lg ${yt}`, rat(k))
      : task(`\\lg ${decTex(mulR(x, target))} - \\lg ${xt}`, rat(k));
  }
  // уровень 3: 2·lg 5 + lg 4 = 2, lg 0,4 − lg 40 = −2
  if (chance(0.5)) {
    const pairs = [['5', '4', 2], ['2', '25', 2], ['4', '62{,}5', 3], ['5', '40', 3], ['3', '\\dfrac{1}{9}', 0]];
    const [a, b, ans] = rand(pairs);
    return task(`2\\lg ${a} + \\lg ${b}`, rat(ans));
  }
  return task(`\\lg ${xt} - \\lg ${decTex(mulR(x, rat(ipow(10, 2))))}`, rat(-2));
}

// ─── Группа «Переход к другому основанию» ───────────────────────────────────

// 12. log_{a^β} a^ν = ν/β
function changeBase(level) {
  const t = rand([2, 3, 5]);
  if (level === 1) {
    const beta = rat(2);
    const nu = rat(rand([1, 3, 4, 6].filter(x => ipow(t, x) <= 1000)));
    return logTask(t, beta, nu);
  }
  if (level === 2) {
    const tt = rand([2, 2, 3, 5, 7]);
    const beta = rat(rand([2, 3, 4, 5]));
    const nu = rat(rand([1, 2, 3, 5, 6, 7, 9].filter(x => x % beta.n !== 0)));
    const r = divR(nu, beta);
    if (!niceValue(r, 2) || ipow(tt, Math.max(beta.n, nu.n)) > 100000) return null;
    return logTask(tt, beta, nu);
  }
  // уровень 3: основание — дробь: log_{0,25} 2, log_{1/9} 27
  const beta = rat(-rand([1, 2, 3]));
  const nu = rand([rat(1), rat(3), rat(-2), rat(1, 2), rat(5), rat(-3)]);
  const r = divR(nu, beta);
  if (r.d === 1 || !niceValue(r, 3)) return null;
  return logTask(t, beta, nu);
}

// 13. Вложенный логарифм: log_a (log_b N)
function nestedLog(level) {
  return withOriginals(level, ORIG.nestedLog, (lv) => {
    const b = rand([2, 3, 5]);
    // внутреннее значение v = log_b N
    if (lv === 1) {
      const outer = rand([2, 3]);
      const k = rand([1, 2]);
      const v = ipow(outer, k);
      if (ipow(b, v) > 1000 || b === outer && v === 1) return null;
      return task(`\\log_{${outer}} \\log_{${b}} ${ipow(b, v)}`, rat(k));
    }
    if (lv === 2) {
      if (chance(0.4)) {
        // log_a(log_b N + c): внутреннее плюс число даёт степень a
        const outer = 2;
        const v = randInt(2, 4);
        const k = randInt(3, 7);
        const c = ipow(outer, k) - v;
        if (c <= 0 || ipow(b, v) > 1000) return null;
        return task(`\\log_{${outer}} \\left(\\log_{${b}} ${ipow(b, v)} + ${c}\\right)`, rat(k));
      }
      // log_16 (log_2 4) = 0,25: внешнее основание — степень внутреннего значения
      const v = rand([2, 3]);
      const m = rand([2, 4]);
      if (ipow(b, v) > 1000) return null;
      return task(`\\log_{${ipow(v, m)}} \\left(\\log_{${b}} ${ipow(b, v)}\\right)`, rat(1, m));
    }
    // уровень 3: внешнее основание — дробь
    const v = rand([2, 3, 4]);
    const outer = v === 4 ? 2 : v;
    const k = v === 4 ? 2 : 1;
    if (ipow(b, v) > 1000) return null;
    return task(`\\log_{\\frac{1}{${outer}}} \\left(\\log_{${b}} ${ipow(b, v)}\\right)`, rat(-k));
  });
}

// 14. Частное логарифмов: log_c x / log_c y = log_y x
function logRatio(level) {
  return withOriginals(level, ORIG.logRatio, (lv) => {
    const c = rand([2, 3, 5, 7]);
    const lc = c === 10 ? '\\lg' : `\\log_{${c}}`;
    const y = rand([2, 3, 5, 7, 11, 13].filter(x => x !== c));
    if (lv === 1) {
      const k = randInt(2, 3);
      if (ipow(y, k) > 400) return null;
      return task(`\\dfrac{${lc} ${ipow(y, k)}}{${lc} ${y}}`, rat(k));
    }
    if (lv === 2) {
      if (chance(0.5)) {
        // log_c y^{p} / (q·log_c y) = p/q
        const q = rand([2, 3, 4]);
        const p = q * randInt(2, 5);
        return task(`\\dfrac{${lc} ${y}^{${p}}}{${q} ${lc} ${y}}`, rat(p, q));
      }
      // log_c 81 / log_c 9: основания одного числа
      const t = rand([2, 3]);
      const i = rand([2, 3]);
      const j = rand([4, 6].filter(x => x !== i));
      if (ipow(t, j) > 1000) return null;
      return task(`\\dfrac{${lc} ${ipow(t, j)}}{${lc} ${ipow(t, i)}}`, rat(j, i));
    }
    // уровень 3: log_c a / log_c b + log_b (1/a)… = 0 и корень в числителе
    if (chance(0.5)) {
      const a = rand([2, 3]);
      const b = rand([5, 7, 13]);
      return task(`\\dfrac{${lc} ${a}}{${lc} ${b}} + \\log_{${b}} \\dfrac{1}{${a}}`, rat(0));
    }
    const q = rand([2, 3, 4, 5, 10]);
    return task(`\\dfrac{${lc} ${rootTex(q, y)}}{${lc} ${y}}`, rat(1, q));
  });
}

// 15. Произведение логарифмов
function logProduct(level) {
  return withOriginals(level, ORIG.logProduct, (lv) => {
    if (lv === 1) {
      const a = rand([2, 3]);
      const b = rand([2, 5]);
      const i = randInt(2, 4);
      const j = randInt(2, 3);
      return task(`\\log_{${a}} ${ipow(a, i)} \\cdot \\log_{${b}} ${ipow(b, j)}`, rat(i * j));
    }
    if (lv === 2) {
      const a = rand([2, 3, 4, 5]);
      const b = rand([2, 3, 5, 6, 7, 10].filter(x => x !== a));
      const i = randInt(2, a === 2 ? 9 : 4);
      const j = randInt(-3, 4);
      if (j === 0 || ipow(a, i) > 1000 || ipow(b, Math.abs(j)) > 1000) return null;
      const arg = j > 0 ? String(ipow(b, j)) : `\\dfrac{1}{${ipow(b, -j)}}`;
      return task(`${logOp(String(a))} ${ipow(a, i)} \\cdot ${logOp(String(b))} ${arg}`, rat(i * j));
    }
    // уровень 3: цепочка оснований и (1 − log_a N)(1 − log_b N) при N = ab
    if (chance(0.5)) {
      const a = rand([2, 3, 5]);
      const b = rand([3, 5, 7].filter(x => x !== a));
      const i = rand([1, 2, 3]);
      const j = rand([1, 2]);
      if (ipow(b, i) > 400 || ipow(a, j) > 400) return null;
      // log_a b^i · log_b a^j = i·j
      return task(`\\log_{${a}} ${ipow(b, i)} \\cdot \\log_{${b}} ${ipow(a, j)}`, rat(i * j));
    }
    const a = rand([2, 3, 4, 5, 8]);
    const b = rand([3, 5, 6, 7].filter(x => x !== a));
    return task(`\\left(1 - \\log_{${a}} ${a * b}\\right)\\left(1 - \\log_{${b}} ${a * b}\\right)`, rat(1));
  });
}

// 16. log_a(a^m b^n), если log_a b = k
const pw = (v, k) => (k === 1 ? v : `${v}^{${k}}`);

function logParam(level) {
  const k = rand(level === 1 ? [2, 3, 4, 5] : [-12, -7, -4, -2, 3, 5, 7, 8, 10]);
  const ifTex = `,\\ \\text{если}\\ \\log_{a} b = ${k}`;
  if (level === 1) {
    const n = randInt(1, 3);
    return task(`\\log_{a} \\left(a${pw('b', n)}\\right)${ifTex}`, rat(1 + n * k));
  }
  const m = randInt(1, 7);
  const n = randInt(2, 10);
  if (level === 2) {
    return chance(0.5)
      ? task(`\\log_{a} \\left(${pw('a', m)} ${pw('b', n)}\\right)${ifTex}`, rat(m + n * k))
      : task(`\\log_{a} \\dfrac{${pw('a', m)}}{${pw('b', n)}}${ifTex}`, rat(m - n * k));
  }
  // уровень 3: корни — дробный ответ
  const q = rand([2, 3]);
  if (n % q === 0) return null;
  return task(`\\log_{a} \\left(${pw('a', m)} ${rootTex(q, pw('b', n))}\\right)${ifTex}`,
    addR(rat(m), mulR(rat(n, q), rat(k))));
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export const LOG_GENERATORS = {
  basicLog, logReciprocal, logOne, logOfRoot, lgPower,
  basicIdentity, complexIdentity, logOfSameBasePower,
  logSum, logDiff, lgSumDiff,
  changeBase, nestedLog, logRatio, logProduct, logParam,
};

export const LOG_LABELS = {
  basicLog:           'log_a N — целый ответ',
  logReciprocal:      'log_a (1/N), десятичный аргумент',
  logOne:             'log_a 1 и log_a a',
  logOfRoot:          'Логарифм корня, корень в основании',
  lgPower:            'lg от степеней 10',
  basicIdentity:      'a^{log_a b} = b',
  complexIdentity:    '9^{log₃ 4}, 5^{log₂₅ 49}',
  logOfSameBasePower: 'log_a a^k',
  logSum:             'log_a x + log_a y',
  logDiff:            'log_a x − log_a y',
  lgSumDiff:          'lg x ± lg y',
  changeBase:         'Основание-степень: log₄ 8, log₀,₂₅ 2',
  nestedLog:          'Вложенный логарифм',
  logRatio:           'Частное логарифмов',
  logProduct:         'Произведение логарифмов',
  logParam:           'log_a(a^m b^n), если log_a b = k',
};

const BP = ['Б16', 'П8'];
export const LOG_EXAM = {
  basicLog: BP, logReciprocal: BP, logOfRoot: BP,
  basicIdentity: BP, complexIdentity: BP, logOfSameBasePower: BP,
  logSum: BP, logDiff: BP, lgSumDiff: BP,
  changeBase: BP, nestedLog: BP, logRatio: BP, logProduct: BP,
  logParam: ['П8'],
};

export const LOG_GROUPS = [
  { label: 'Определение логарифма', keys: ['basicLog', 'logReciprocal', 'logOne', 'logOfRoot', 'lgPower', 'logOfSameBasePower'] },
  { label: 'Основное тождество', keys: ['basicIdentity', 'complexIdentity'] },
  { label: 'Сумма и разность', keys: ['logSum', 'logDiff', 'lgSumDiff'] },
  { label: 'Другое основание, частное, произведение', keys: ['changeBase', 'nestedLog', 'logRatio', 'logProduct', 'logParam'] },
];
