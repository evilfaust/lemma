/**
 * Действия с обыкновенными дробями: ЕГЭ база №14 и ОГЭ №6.
 *
 * На экзамене ответ — целое или конечная десятичная дробь, поэтому задание
 * подбирается так, чтобы значение было «записываемым» (уровни 2–3); на
 * разминке допускается ответ обыкновенной дробью. Значения точные, условие
 * и ответ печатаются из одних и тех же рациональных чисел.
 *
 * Ручные примеры раздела — образцы уровня «Как на экзамене» (`ORIG`).
 */
import {
  rat, addR, subR, mulR, divR, negR, absR, decTex, niceDecimal, gcd, rand,
  randInt, chance, task, withOriginals,
} from './kit';

// ─── Запись чисел ────────────────────────────────────────────────────────────

/** Дробь: \dfrac{a}{b}; mixed — неправильная печатается смешанным числом. */
function F(r, { mixed = false } = {}) {
  if (r.d === 1) return String(r.n);
  const a = Math.abs(r.n);
  const sign = r.n < 0 ? '-' : '';
  const whole = Math.floor(a / r.d);
  if (mixed && whole > 0) return `${sign}${whole}\\dfrac{${a - whole * r.d}}{${r.d}}`;
  return `${sign}\\dfrac{${a}}{${r.d}}`;
}
/** То же в скобках, если отрицательное (после знака действия). */
const FP = (r, o) => {
  const tex = F(r, o);
  return tex.startsWith('-') ? `\\left(${tex}\\right)` : tex;
};
const D = (r) => decTex(r);

/** Случайная несократимая дробь со знаменателем из списка. */
function frac(dens, { maxNum = null, proper = true } = {}) {
  const d = rand(dens);
  const top = maxNum ?? (proper ? d - 1 : 3 * d);
  for (let i = 0; i < 30; i++) {
    const n = randInt(1, top);
    if (gcd(n, d) === 1 && n !== d) return rat(n, d);
  }
  return rat(1, d);
}

/** Повторять построение, пока не выйдет (числа подбираются случайно). */
function search(fn, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const q = fn();
    if (q) return q;
  }
  return null;
}

/** Ответ записывается конечной десятичной (экзамен); на разминке — любая простая дробь. */
function okAns(r, level) {
  if (!r) return false;
  if (Math.abs(r.n / r.d) > 1000) return false;
  if (level === 1) return r.d <= 12;
  return niceDecimal(r, 3);
}

function t(expr, r, level) {
  return okAns(r, level) ? task(expr, r) : null;
}

const lcm = (a, b) => (a * b) / gcd(a, b);
const same = (x, y) => x.n === y.n && x.d === y.d;
const sumTex = (x, y, o) => (y.n < 0 ? `${F(x, o)} - ${F(absR(y), o)}` : `${F(x, o)} + ${F(y, o)}`);

const DENS_EASY = [2, 3, 4, 5, 6, 8, 10];
const DENS_EXAM = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 20, 25];
const DENS_DEC = [2, 4, 5, 8, 10, 20, 25, 50];   // дают конечную десятичную

// Образцы — ручные примеры раздела (уровень «Как на экзамене»)
const ORIG = {
  sumFracTimesInt: [
    { expr: '\\left(1\\dfrac{2}{3} + \\dfrac{3}{8}\\right) \\cdot 24', ans: '49' },
    { expr: '\\left(1\\dfrac{7}{8} - 8\\dfrac{1}{2}\\right) \\cdot 8', ans: '-53' },
    { expr: '\\left(-2\\dfrac{3}{4} - \\dfrac{3}{8}\\right) \\cdot 160', ans: '-500' },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{4}\\right) \\cdot 12', ans: '7' },
    { expr: '\\left(\\dfrac{3}{4} + \\dfrac{1}{6}\\right) \\cdot 12', ans: '11' },
    { expr: '\\left(\\dfrac{5}{6} + \\dfrac{1}{3}\\right) \\cdot 6', ans: '7' },
    { expr: '\\left(2\\dfrac{1}{4} - \\dfrac{2}{3}\\right) \\cdot 12', ans: '19' },
    { expr: '\\left(\\dfrac{7}{8} - \\dfrac{5}{12}\\right) \\cdot 24', ans: '11' },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{3}{5}\\right) \\cdot 15', ans: '19' },
    { expr: '\\left(\\dfrac{1}{2} - \\dfrac{3}{8}\\right) \\cdot 16', ans: '2' },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{2}\\right) \\cdot 18', ans: '6' },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{4}\\right) \\cdot 24', ans: '16' },
  ],
  fracSumTimesDecimal: [
    { expr: '\\left(-\\dfrac{7}{8} - 1\\dfrac{1}{6}\\right) \\cdot 2{,}4', ans: '-4{,}9' },
    { expr: '\\left(\\dfrac{3}{4} + \\dfrac{1}{2}\\right) \\cdot 0{,}4', ans: '0{,}5' },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{3}\\right) \\cdot 0{,}6', ans: '0{,}3' },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{1}{6}\\right) \\cdot 1{,}2', ans: '1' },
    { expr: '\\left(\\dfrac{3}{8} + \\dfrac{1}{4}\\right) \\cdot 1{,}6', ans: '1' },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{4}\\right) \\cdot 1{,}2', ans: '0{,}8' },
    { expr: '\\left(\\dfrac{3}{4} - \\dfrac{1}{2}\\right) \\cdot 0{,}8', ans: '0{,}2' },
    { expr: '\\left(\\dfrac{7}{10} + \\dfrac{1}{5}\\right) \\cdot 0{,}5', ans: '0{,}45' },
    { expr: '\\left(\\dfrac{1}{4} + \\dfrac{1}{3}\\right) \\cdot 1{,}2', ans: '0{,}7' },
    { expr: '\\left(\\dfrac{3}{5} + \\dfrac{1}{4}\\right) \\cdot 2', ans: '1{,}7' },
  ],
  decimalDivFrac: [
    { expr: '0{,}42 : \\dfrac{3}{10}', ans: '1{,}4' },
    { expr: '0{,}6 : \\dfrac{3}{5}', ans: '1' },
    { expr: '0{,}5 : \\dfrac{1}{4}', ans: '2' },
    { expr: '1{,}2 : \\dfrac{3}{5}', ans: '2' },
    { expr: '0{,}9 : \\dfrac{3}{10}', ans: '3' },
    { expr: '0{,}4 : \\dfrac{2}{5}', ans: '1' },
    { expr: '0{,}8 : \\dfrac{4}{5}', ans: '1' },
    { expr: '0{,}75 : \\dfrac{3}{8}', ans: '2' },
    { expr: '0{,}25 : \\dfrac{1}{8}', ans: '2' },
    { expr: '0{,}35 : \\dfrac{7}{20}', ans: '1' },
    { expr: '1{,}5 : \\dfrac{3}{4}', ans: '2' },
    { expr: '0{,}28 : \\dfrac{7}{25}', ans: '1' },
    { expr: '0{,}18 : \\dfrac{9}{50}', ans: '1' },
  ],
  bracketDivFrac: [
    { expr: '\\left(5\\dfrac{1}{3} - 2\\right) : \\dfrac{5}{21}', ans: '14' },
    { expr: '\\left(\\dfrac{11}{18} + \\dfrac{2}{9}\\right) : \\dfrac{5}{48}', ans: '8' },
    { expr: '\\left(2\\dfrac{1}{2} - 1\\right) : \\dfrac{3}{4}', ans: '2' },
    { expr: '\\left(\\dfrac{5}{6} - \\dfrac{1}{3}\\right) : \\dfrac{1}{6}', ans: '3' },
    { expr: '\\left(\\dfrac{2}{3} + \\dfrac{1}{6}\\right) : \\dfrac{5}{12}', ans: '2' },
    { expr: '\\left(3 - \\dfrac{1}{4}\\right) : \\dfrac{11}{8}', ans: '2' },
    { expr: '\\left(\\dfrac{7}{8} + \\dfrac{1}{4}\\right) : \\dfrac{3}{8}', ans: '3' },
    { expr: '\\left(1\\dfrac{1}{2} - \\dfrac{1}{6}\\right) : \\dfrac{2}{3}', ans: '2' },
    { expr: '\\left(\\dfrac{5}{12} + \\dfrac{1}{3}\\right) : \\dfrac{3}{8}', ans: '2' },
    { expr: '\\left(2 - \\dfrac{1}{3}\\right) : \\dfrac{5}{6}', ans: '2' },
  ],
  multiFracTimesInt: [
    { expr: '12 \\cdot \\left(\\dfrac{13}{24} - \\dfrac{7}{12} - \\dfrac{1}{6}\\right)', ans: '-2{,}5' },
    { expr: '24 \\cdot \\left(\\dfrac{5}{6} - \\dfrac{3}{8} - \\dfrac{1}{4}\\right)', ans: '5' },
    { expr: '12 \\cdot \\left(\\dfrac{5}{6} - \\dfrac{1}{4} - \\dfrac{1}{3}\\right)', ans: '3' },
    { expr: '6 \\cdot \\left(\\dfrac{1}{2} - \\dfrac{1}{3} + \\dfrac{1}{6}\\right)', ans: '2' },
    { expr: '20 \\cdot \\left(\\dfrac{3}{4} - \\dfrac{1}{5} - \\dfrac{1}{2}\\right)', ans: '1' },
    { expr: '15 \\cdot \\left(\\dfrac{2}{3} + \\dfrac{1}{5} - \\dfrac{1}{3}\\right)', ans: '8' },
    { expr: '24 \\cdot \\left(\\dfrac{5}{12} - \\dfrac{1}{3} + \\dfrac{1}{8}\\right)', ans: '5' },
    { expr: '12 \\cdot \\left(\\dfrac{7}{12} - \\dfrac{1}{4} - \\dfrac{1}{6}\\right)', ans: '2' },
    { expr: '30 \\cdot \\left(\\dfrac{1}{2} + \\dfrac{1}{3} - \\dfrac{2}{5}\\right)', ans: '13' },
  ],
  fracProdPlusInt: [
    { expr: '\\dfrac{1}{3} \\cdot 0{,}99 + 2', ans: '2{,}33' },
    { expr: '\\dfrac{1}{2} \\cdot 0{,}48 + 1', ans: '1{,}24' },
    { expr: '\\dfrac{1}{4} \\cdot 0{,}88 + 3', ans: '3{,}22' },
    { expr: '\\dfrac{1}{5} \\cdot 1{,}5 + 2', ans: '2{,}3' },
    { expr: '\\dfrac{1}{3} \\cdot 0{,}9 + 1', ans: '1{,}3' },
    { expr: '\\dfrac{1}{2} \\cdot 0{,}6 + 4', ans: '4{,}3' },
    { expr: '\\dfrac{1}{4} \\cdot 0{,}8 + 1', ans: '1{,}2' },
    { expr: '\\dfrac{1}{6} \\cdot 0{,}6 + 2', ans: '2{,}1' },
    { expr: '\\dfrac{1}{5} \\cdot 0{,}5 + 1', ans: '1{,}1' },
    { expr: '\\dfrac{2}{3} \\cdot 0{,}9 + 1', ans: '1{,}6' },
  ],
  fracDivPlusMixed: [
    { expr: '\\dfrac{4}{11} : \\left(-\\dfrac{16}{33}\\right) + 5\\dfrac{3}{4}', ans: '5' },
    { expr: '\\dfrac{3}{8} : \\left(-\\dfrac{3}{4}\\right) + 2\\dfrac{1}{2}', ans: '2' },
    { expr: '\\dfrac{2}{5} : \\left(-\\dfrac{4}{15}\\right) + 4', ans: '2{,}5' },
    { expr: '\\dfrac{5}{6} : \\left(-\\dfrac{5}{12}\\right) + 3', ans: '1' },
    { expr: '\\dfrac{1}{4} : \\left(-\\dfrac{1}{2}\\right) + 1\\dfrac{1}{2}', ans: '1' },
    { expr: '\\dfrac{7}{8} : \\left(-\\dfrac{7}{16}\\right) + 3', ans: '1' },
    { expr: '\\dfrac{3}{5} : \\left(-\\dfrac{6}{25}\\right) + 3\\dfrac{1}{2}', ans: '1' },
  ],
  oneOverDiff: [
    { expr: '\\dfrac{1}{\\dfrac{1}{3} - \\dfrac{1}{4}}', ans: '12' },
    { expr: '\\dfrac{1}{\\dfrac{1}{4} - \\dfrac{1}{5}}', ans: '20' },
    { expr: '\\dfrac{1}{\\dfrac{1}{5} - \\dfrac{1}{6}}', ans: '30' },
    { expr: '\\dfrac{1}{\\dfrac{1}{6} - \\dfrac{1}{7}}', ans: '42' },
    { expr: '\\dfrac{1}{\\dfrac{1}{2} - \\dfrac{1}{3}}', ans: '6' },
    { expr: '\\dfrac{1}{\\dfrac{1}{9} - \\dfrac{1}{12}}', ans: '36' },
    { expr: '\\dfrac{1}{\\dfrac{1}{6} - \\dfrac{1}{10}}', ans: '15' },
    { expr: '\\dfrac{1}{\\dfrac{1}{8} - \\dfrac{1}{10}}', ans: '40' },
    { expr: '\\dfrac{1}{\\dfrac{1}{4} - \\dfrac{1}{6}}', ans: '12' },
    { expr: '\\dfrac{1}{\\dfrac{1}{3} - \\dfrac{1}{5}}', ans: '7{,}5' },
    { expr: '\\dfrac{1}{\\dfrac{1}{2} - \\dfrac{1}{4}}', ans: '4' },
  ],
  fracDecMix: [
    { expr: '\\dfrac{5}{2} - 2{,}5 - \\left(-\\dfrac{3}{5}\\right)', ans: '0{,}6' },
    { expr: '\\dfrac{3}{4} + 0{,}25 - \\dfrac{1}{2}', ans: '0{,}5' },
    { expr: '\\dfrac{1}{2} - 0{,}3 + \\dfrac{1}{5}', ans: '0{,}4' },
    { expr: '\\dfrac{7}{10} - 0{,}2 - \\dfrac{1}{5}', ans: '0{,}3' },
    { expr: '\\dfrac{3}{5} + 0{,}4 - \\dfrac{1}{2}', ans: '0{,}5' },
    { expr: '\\dfrac{9}{4} - 1{,}25 + \\left(-\\dfrac{1}{2}\\right)', ans: '0{,}5' },
    { expr: '\\dfrac{4}{5} - 0{,}5 + \\dfrac{3}{10}', ans: '0{,}6' },
    { expr: '\\dfrac{7}{4} + 0{,}25 - 1', ans: '1' },
    { expr: '\\dfrac{1}{4} + 0{,}5 - \\dfrac{3}{4}', ans: '0' },
    { expr: '\\dfrac{5}{8} - 0{,}25 + \\dfrac{1}{8}', ans: '0{,}5' },
  ],
  fracProdMinusFrac: [
    { expr: '\\dfrac{8}{3} \\cdot \\dfrac{11}{5} - \\dfrac{13}{15}', ans: '5' },
    { expr: '\\dfrac{5}{4} \\cdot \\dfrac{8}{3} - \\dfrac{1}{3}', ans: '3' },
    { expr: '\\dfrac{7}{2} \\cdot \\dfrac{4}{3} - \\dfrac{2}{3}', ans: '4' },
    { expr: '\\dfrac{9}{4} \\cdot \\dfrac{8}{3} - 2', ans: '4' },
    { expr: '\\dfrac{5}{6} \\cdot \\dfrac{12}{5} + \\dfrac{1}{2}', ans: '2{,}5' },
    { expr: '\\dfrac{3}{4} \\cdot \\dfrac{8}{3} - 1', ans: '1' },
    { expr: '\\dfrac{7}{5} \\cdot \\dfrac{10}{3} - \\dfrac{2}{3}', ans: '4' },
    { expr: '\\dfrac{4}{3} \\cdot \\dfrac{9}{2} - 4', ans: '2' },
    { expr: '\\dfrac{11}{6} \\cdot \\dfrac{12}{5} - \\dfrac{2}{5}', ans: '4' },
  ],
  fracPlusFracDivFrac: [
    { expr: '\\dfrac{7}{8} + \\dfrac{15}{4} : \\dfrac{10}{3}', ans: '2' },
    { expr: '\\dfrac{1}{4} + \\dfrac{3}{8} : \\dfrac{3}{2}', ans: '0{,}5' },
    { expr: '\\dfrac{1}{6} + \\dfrac{5}{6} : \\dfrac{5}{2}', ans: '0{,}5' },
    { expr: '\\dfrac{2}{3} + \\dfrac{4}{9} : \\dfrac{4}{3}', ans: '1' },
    { expr: '\\dfrac{1}{2} + \\dfrac{3}{4} : \\dfrac{3}{2}', ans: '1' },
    { expr: '\\dfrac{3}{4} + \\dfrac{5}{8} : \\dfrac{5}{2}', ans: '1' },
    { expr: '\\dfrac{2}{5} + \\dfrac{3}{10} : \\dfrac{3}{4}', ans: '0{,}8' },
  ],
};

// ─── Генераторы ──────────────────────────────────────────────────────────────

// 1. a/b ± c/d (ОГЭ №6: 3/4 + 7/25 = 1,03)
function fracAddSub(level) {
  return search(() => {
    if (level === 1) {
      const d = rand([2, 3, 4, 5, 6, 8, 10, 12]);
      const x = frac([d]); const y = frac([d]);
      if (same(x, y)) return null;
      return chance(0.5) ? t(`${F(x)} + ${F(y)}`, addR(x, y), 1) : t(`${F(x)} - ${F(y)}`, subR(x, y), 1);
    }
    const x = frac(level === 2 ? DENS_DEC : [...DENS_DEC, 3, 6], { proper: level === 2 ? chance(0.7) : false });
    const y = frac(DENS_DEC, { proper: chance(0.5) });
    const mixed = level === 3;
    const r = chance(0.5) ? addR(x, y) : subR(x, y);
    const op = r.n === addR(x, y).n && r.d === addR(x, y).d ? '+' : '-';
    return t(`${F(x, { mixed })} ${op} ${F(y, { mixed })}`, r, level);
  });
}

// 2. a/b · c/d и a/b : c/d
function fracMulDiv(level) {
  return search(() => {
    const dens = level === 1 ? DENS_EASY : DENS_EXAM;
    const x = frac(dens, { proper: level === 1 ? true : chance(0.5) });
    const y = frac(dens, { proper: chance(0.5) });
    const mixed = level === 3;
    if (chance(0.5)) return t(`${F(x, { mixed })} \\cdot ${F(y, { mixed })}`, mulR(x, y), level);
    return t(`${F(x, { mixed })} : ${F(y, { mixed })}`, divR(x, y), level);
  });
}

// 3. (a/b ± c/d) · N
function sumFracTimesInt(level) {
  return withOriginals(level, ORIG.sumFracTimesInt, () => search(() => {
    const dens = level === 1 ? [2, 3, 4, 6] : [3, 4, 5, 6, 8, 12];
    const x = frac(dens, { proper: level === 1 || chance(0.5) });
    const y = level === 3 ? negR(frac(dens)) : frac(dens);
    if (same(x, absR(y))) return null;
    const k = randInt(1, level === 1 ? 2 : 4);
    const N = lcm(x.d, y.d) * k * (level === 3 ? rand([1, 2, 5]) : 1);
    const mixed = level > 1;
    const sub = level < 3 && chance(0.5);
    const s = sub ? subR(x, y) : addR(x, y);
    const inner = sub ? `${F(x, { mixed })} - ${F(y, { mixed })}` : sumTex(x, y, { mixed });
    return t(`\\left(${inner}\\right) \\cdot ${N}`, mulR(s, rat(N)), level);
  }));
}

// 4. (a/b ± c/d) · D — множитель десятичный
function fracSumTimesDecimal(level) {
  return withOriginals(level, ORIG.fracSumTimesDecimal, () => search(() => {
    const dens = level === 1 ? [2, 4, 5] : [3, 4, 5, 6, 8, 12];
    const x = frac(dens); const y = frac(dens);
    const s = level === 3 && chance(0.5) ? subR(negR(x), y) : addR(x, y);
    const Dv = rat(randInt(2, level === 1 ? 20 : 48), 10);
    if (Dv.d === 1) return null;
    const inner = s.n === addR(x, y).n ? `${F(x)} + ${F(y)}` : `-${F(x)} - ${F(y)}`;
    return t(`\\left(${inner}\\right) \\cdot ${D(Dv)}`, mulR(s, Dv), level === 1 ? 2 : level);
  }));
}

// 5. D : a/b
function decimalDivFrac(level) {
  return withOriginals(level, ORIG.decimalDivFrac, () => search(() => {
    const f = frac(level === 1 ? [2, 4, 5, 10] : [3, 4, 5, 7, 8, 9, 10, 20, 25, 50]);
    const q = level === 1 ? rat(randInt(1, 6)) : rat(randInt(2, 40), chance(0.5) ? 10 : 1);
    const dv = mulR(q, f);
    if (!niceDecimal(dv, 3) || dv.d === 1) return null;
    const neg = level === 3 && chance(0.5);
    return t(`${neg ? `(${D(negR(dv))})` : D(dv)} : ${F(f)}`, neg ? negR(q) : q, level);
  }));
}

// 6. (скобка) : e/f — ОГЭ №6: (7/25 + 7/33) : 14/33
function bracketDivFrac(level) {
  return withOriginals(level, ORIG.bracketDivFrac, () => search(() => {
    const dens = level === 1 ? [2, 3, 4, 6] : [3, 4, 5, 6, 8, 9, 10, 11, 12, 22, 25, 33];
    const x = frac(dens, { proper: level !== 3 });
    const y = frac(dens);
    const sub = chance(0.5);
    const s = sub ? subR(x, y) : addR(x, y);
    if (s.n === 0) return null;
    // делитель e/f: s / (e/f) — «хорошее» число
    const q = level === 1 ? rat(randInt(1, 6)) : rat(randInt(-30, 50), rand([1, 10, 100]));
    if (q.n === 0) return null;
    const e = divR(s, q);
    if (e.d === 1 || e.d > 60 || Math.abs(e.n) > 60 || same(x, y)) return null;
    const mixed = level === 3;
    const inner = sub ? `${F(x, { mixed })} - ${F(y)}` : `${F(x, { mixed })} + ${F(y)}`;
    return t(`\\left(${inner}\\right) : ${FP(e)}`, q, level);
  }));
}

// 7. N · (a/b ± c/d ± e/f)
function multiFracTimesInt(level) {
  return withOriginals(level, ORIG.multiFracTimesInt, () => search(() => {
    const dens = level === 1 ? [2, 3, 4, 6] : [3, 4, 6, 8, 12, 16, 24, 32];
    const fs = [frac(dens), frac(dens), frac(dens)];
    if (same(fs[0], fs[1]) || same(fs[1], fs[2]) || same(fs[0], fs[2])) return null;
    const signs = [1, rand([1, -1]), rand([1, -1])];
    const N = fs.reduce((m, f) => lcm(m, f.d), 1) * randInt(1, level === 3 ? 3 : 1);
    if (N > 120) return null;
    const s = fs.reduce((acc, f, i) => addR(acc, signs[i] > 0 ? f : negR(f)), rat(0));
    const inner = fs.map((f, i) => (i === 0 ? F(f) : `${signs[i] > 0 ? '+' : '-'} ${F(f)}`)).join(' ');
    return t(`${N} \\cdot \\left(${inner}\\right)`, mulR(s, rat(N)), level);
  }));
}

// 8. a/b · D + N
function fracProdPlusInt(level) {
  return withOriginals(level, ORIG.fracProdPlusInt, () => search(() => {
    const f = level === 1 ? rat(1, randInt(2, 5)) : frac([3, 4, 5, 6, 7, 8, 9]);
    const dv = mulR(rat(randInt(2, 99), 100), rat(f.d));
    const dt = D(dv);
    if (!dt || dv.d === 1) return null;
    const N = randInt(1, 9) * (level === 3 && chance(0.5) ? -1 : 1);
    const r = addR(mulR(f, dv), rat(N));
    return t(`${F(f)} \\cdot ${dt} ${N < 0 ? '-' : '+'} ${Math.abs(N)}`, r, level);
  }));
}

// 9. a/b : (−c/d) + смешанное
function fracDivPlusMixed(level) {
  return withOriginals(level, ORIG.fracDivPlusMixed, () => search(() => {
    const x = frac([3, 4, 5, 6, 7, 8, 11]);
    const k = rand(level === 1 ? [2, 3] : [2, 3, 4, 5]);
    const y = rat(x.n * k, x.d * rand([1, 2, 3]));   // частное x/y — «удобное»
    if (y.d > 40 || y.n > 40 || same(x, y)) return null;
    const q = negR(divR(x, y));
    const m = frac([2, 3, 4, 5, 6, 8], { proper: false });
    if (m.n / m.d < 1) return null;
    return t(`${F(x)} : ${FP(negR(y))} + ${F(m, { mixed: true })}`, addR(q, m), level);
  }));
}

// 10. 1 / (1/a ± 1/b): 1/(1/33 + 1/12) = 8,8
function oneOverDiff(level) {
  return withOriginals(level, ORIG.oneOverDiff, () => search(() => {
    const a = randInt(2, level === 1 ? 9 : 40);
    const b = randInt(a + 1, level === 1 ? 12 : 60);
    const sum = level > 1 && chance(0.5);
    const s = sum ? addR(rat(1, a), rat(1, b)) : subR(rat(1, a), rat(1, b));
    const r = divR(rat(1), s);
    const top = level === 3 ? rand([1, 2, 3]) : 1;
    return t(`\\dfrac{${top}}{\\dfrac{1}{${a}} ${sum ? '+' : '-'} \\dfrac{1}{${b}}}`, mulR(r, rat(top)), level);
  }));
}

// 11. a/b ± D ± (−c/d) — дроби вперемешку с десятичными
function fracDecMix(level) {
  return withOriginals(level, ORIG.fracDecMix, () => search(() => {
    const x = frac(level === 1 ? [2, 4, 5] : [2, 4, 5, 8, 10, 20], { proper: chance(0.5) });
    const dv = rat(randInt(1, 39), level === 3 ? 100 : 10);
    const y = frac([2, 4, 5, 10]);
    const sx = chance(0.5) ? 1 : -1;
    const r = level === 1 ? subR(x, dv) : addR(subR(x, dv), mulR(rat(sx), negR(y)));
    const tail = level === 1 ? '' : ` ${sx > 0 ? '+' : '-'} \\left(-${F(y)}\\right)`;
    return t(`${F(x)} - ${D(dv)}${tail}`, r, level === 1 ? 2 : level);
  }));
}

// 12. a/b · c/d − e/f
function fracProdMinusFrac(level) {
  return withOriginals(level, ORIG.fracProdMinusFrac, () => search(() => {
    const x = frac([2, 3, 4, 5, 6, 7], { proper: false });
    const y = frac([2, 3, 4, 5, 6, 7, 10], { proper: false });
    const p = mulR(x, y);
    const z = frac([2, 3, 5, 6, 10, 12, 15]);
    const r = chance(0.5) ? subR(p, z) : addR(p, z);
    const op = r.n === addR(p, z).n && r.d === addR(p, z).d ? '+' : '-';
    if (level === 2 && r.d !== 1 && !niceDecimal(r, 1)) return null;
    return t(`${F(x, { mixed: level === 3 })} \\cdot ${F(y)} ${op} ${F(z)}`, r, level);
  }));
}

// 13. a/b + c/d : e/f — порядок действий
function fracPlusFracDivFrac(level) {
  return withOriginals(level, ORIG.fracPlusFracDivFrac, () => search(() => {
    const x = frac([2, 3, 4, 5, 6, 8]);
    const y = frac([3, 4, 5, 6, 8, 9], { proper: false });
    const z = frac([2, 3, 4, 5, 10], { proper: false });
    const r = addR(x, divR(y, z));
    if (level === 2 && r.d !== 1 && !niceDecimal(r, 1)) return null;
    const op = level === 3 && chance(0.5) ? '-' : '+';
    const val = op === '-' ? subR(x, divR(y, z)) : r;
    return t(`${F(x)} ${op} ${F(y)} : ${F(z)}`, val, level);
  }));
}

// 14. k·(1/n)² − m·(1/n) — ОГЭ №6: 18·(1/9)² − 20·(1/9) = −2
function fracSquareExpr(level) {
  return search(() => {
    const n = randInt(2, level === 1 ? 5 : 9);
    const x = level === 3 ? rat(rand([-1, 1, 2, -2]), n) : rat(1, n);
    if (x.d !== n) return null;
    const k = n * n * randInt(1, 3) * (level === 1 ? 1 : rand([1, 1, 2]));
    const m = n * randInt(1, 5);
    const r = subR(mulR(rat(k), mulR(x, x)), mulR(rat(m), x));
    const xt = FP(x);
    return t(`${k} \\cdot \\left(${F(x)}\\right)^{2} - ${m} \\cdot ${xt}`, r, level);
  });
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export const FR_GENERATORS = {
  fracAddSub, fracMulDiv, sumFracTimesInt, fracSumTimesDecimal, decimalDivFrac,
  bracketDivFrac, multiFracTimesInt, fracProdPlusInt, fracDivPlusMixed,
  oneOverDiff, fracDecMix, fracProdMinusFrac, fracPlusFracDivFrac, fracSquareExpr,
};

export const FR_LABELS = {
  fracAddSub:          'a/b ± c/d: 3/4 + 7/25',
  fracMulDiv:          'a/b · c/d, a/b : c/d',
  sumFracTimesInt:     '(a/b ± c/d) · N',
  fracSumTimesDecimal: '(a/b ± c/d) · D',
  decimalDivFrac:      'D : a/b',
  bracketDivFrac:      '(a/b ± c/d) : e/f',
  multiFracTimesInt:   'N · (a/b ± c/d ± e/f)',
  fracProdPlusInt:     'a/b · D + n',
  fracDivPlusMixed:    'a/b : (−c/d) + смешанное',
  oneOverDiff:         '1 / (1/a ± 1/b)',
  fracDecMix:          'Смесь дробей и десятичных',
  fracProdMinusFrac:   'a/b · c/d − e/f',
  fracPlusFracDivFrac: 'a/b + c/d : e/f',
  fracSquareExpr:      'k·(1/n)² − m·(1/n)',
};

const BO = ['Б14', 'О6'];
export const FR_EXAM = {
  fracAddSub: ['О6'], fracMulDiv: ['О6'], sumFracTimesInt: ['Б14'],
  fracSumTimesDecimal: BO, decimalDivFrac: BO, bracketDivFrac: BO,
  multiFracTimesInt: ['Б14'], fracProdPlusInt: ['Б14'], fracDivPlusMixed: ['Б14'],
  oneOverDiff: ['Б14'], fracDecMix: BO, fracProdMinusFrac: BO, fracPlusFracDivFrac: BO,
  fracSquareExpr: ['О6'],
};

export const FR_GROUPS = [
  { label: 'Одно действие', keys: ['fracAddSub', 'fracMulDiv'] },
  { label: 'Скобка × число / десятичная', keys: ['sumFracTimesInt', 'fracSumTimesDecimal', 'multiFracTimesInt'] },
  { label: 'Деление', keys: ['decimalDivFrac', 'bracketDivFrac', 'fracDivPlusMixed', 'oneOverDiff'] },
  { label: 'Произведения и смеси', keys: ['fracProdPlusInt', 'fracProdMinusFrac', 'fracPlusFracDivFrac', 'fracDecMix', 'fracSquareExpr'] },
];
