/**
 * Проверка вписанного ответа тренировки — по значению (v3.9.296, решение
 * пользователя 05.10.2026: тренируем счёт, а не оформление).
 *
 * Ответы генераторов «формула → ответ» — рациональные числа в записи бланка:
 * «-7», «0{,}5», «\dfrac{7}{9}», «2\dfrac{1}{3}»; у линейных уравнений ещё
 * «\varnothing» (нет корней) и «x \in \mathbb{R}» (любое число). Ученик пишет
 * как ему удобно: 0,5 = 1/2 = .5; −7; 2 1/3; «нет корней», «любое».
 *
 * Значение — несократимая дробь {n, d} (d > 0), сравнение перекрёстным
 * умножением: никакой плавающей точки, 0,1 + 0,2 здесь равно 0,3.
 */

function gcd(a, b) {
  let x = Math.abs(a); let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function rat(n, d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) return null;
  const s = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { kind: 'num', n: (s * n) / g, d: (s * d) / g };
}

/** «-12.375» → 12375/1000 со знаком. */
function fromDecimal(str) {
  const m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(str);
  if (!m || (!m[2] && !m[3])) return null;
  const frac = m[3] || '';
  const n = Number((m[2] || '0') + frac);
  const r = rat(n, 10 ** frac.length);
  return r && m[1] === '-' ? { ...r, n: -r.n } : r;
}

function signed(sign, whole, num, den) {
  const r = rat(whole * den + num, den);
  return r && sign === '-' ? { ...r, n: -r.n } : r;
}

const EMPTY = { kind: 'empty' };
const ALL = { kind: 'all' };

/** Ответ генератора (LaTeX) → значение; null — проверить по значению нельзя. */
export function parseExpectedAnswer(latex) {
  const s = String(latex ?? '')
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\\[,!;: ]/g, '')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (/\\varnothing|\\emptyset|∅/.test(s)) return EMPTY;
  if (/\\mathbb\{R\}|ℝ/.test(s)) return ALL;

  const body = s.replace(/^[a-z]\s*=\s*/i, '');
  const fr = /^([+-]?)\s*(\d+)?\s*\\[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}$/.exec(body);
  if (fr) return signed(fr[1], Number(fr[2] || 0), Number(fr[3]), Number(fr[4]));
  return fromDecimal(body.replace(/\s/g, ''));
}

const EMPTY_WORDS = /^(нет|нет корней|корней нет|нет решений|решений нет|∅|пусто|пустое множество|пустое)$/;
const ALL_WORDS = /^(любое|любое число|[a-z] любое|r|ℝ|все|все числа|бесконечно много|[a-z]?∈ ?[rℝ]|\(-∞; ?\+?∞\))$/;

/** Ответ ученика (текст) → значение; null — не разобрать. */
export function parseStudentAnswer(text) {
  const s = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/^[a-zа-я]\s*=\s*/, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\.$/, '');
  if (!s) return null;
  if (EMPTY_WORDS.test(s)) return EMPTY;
  if (ALL_WORDS.test(s)) return ALL;

  const mixed = /^([+-]?)(\d+) (\d+)\/(\d+)$/.exec(s);
  if (mixed) return signed(mixed[1], Number(mixed[2]), Number(mixed[3]), Number(mixed[4]));

  const fr = /^([+-]?)(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (fr) {
    const a = fromDecimal(fr[2]);
    const b = fromDecimal(fr[3]);
    if (!a || !b || b.n === 0) return null;
    const r = rat(a.n * b.d, a.d * b.n);
    return r && fr[1] === '-' ? { ...r, n: -r.n } : r;
  }
  return fromDecimal(s.replace(/ /g, ''));
}

/** Можно ли проверить вписанный ответ на это задание. */
export function canCheckByValue(latex) {
  return parseExpectedAnswer(latex) !== null;
}

/** Верен ли ответ ученика `given` для ответа генератора `expectedLatex`. */
export function checkDrillAnswer(given, expectedLatex) {
  const e = parseExpectedAnswer(expectedLatex);
  const g = parseStudentAnswer(given);
  if (!e || !g || e.kind !== g.kind) return false;
  if (e.kind !== 'num') return true;
  return e.n === g.n && e.d === g.d;
}
