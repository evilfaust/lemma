/**
 * Точные значения с корнями и π — для проверки вписанного ответа
 * тренировки (v3.9.350): √3/2, (√6 + √2)/4, 2 − √3, 5π/6, 30°.
 *
 * Значение — линейная комбинация базисных чисел √m·π^p (m свободно от
 * квадратов, p ∈ {0, 1}) с рациональными коэффициентами. Сравнение точное,
 * без плавающей точки: 0,866 ≠ √3/2, а √3/2 = (√3)/2 = sqrt(3)/2 = √(3/4).
 *
 * Один разборщик на обе стороны: ответ генератора (LaTeX переводится в
 * линейную запись) и текст ученика («√3/2», «корень из 3 / 2», «5pi/6»).
 * Буквы и функции (sin α) не разбираются — такое задание вписывать нельзя.
 */

function gcd(a, b) {
  let x = Math.abs(a); let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}
const rat = (n, d = 1) => {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) return null;
  const s = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (s * n) / g, d: (s * d) / g };
};
const rAdd = (a, b) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const rMul = (a, b) => rat(a.n * b.n, a.d * b.d);

function squareFree(n) {
  let k = 1; let m = n;
  for (let p = 2; p * p <= m; p++) while (m % (p * p) === 0) { m /= p * p; k *= p; }
  return { k, m };
}

// ─── Векторы: Map «m|p» → rat ────────────────────────────────────────────────
const key = (m, p) => `${m}|${p}`;
const unkey = (k) => k.split('|').map(Number);

function vec(entries) {
  const out = new Map();
  for (const [k, r] of entries) {
    if (!r) return null;
    const prev = out.get(k);
    const sum = prev ? rAdd(prev, r) : r;
    if (!sum) return null;
    if (sum.n === 0) out.delete(k); else out.set(k, sum);
  }
  return out;
}
const vNum = (r) => vec([[key(1, 0), r]]);
const vAdd = (a, b) => (a && b ? vec([...a, ...b]) : null);
const vNeg = (a) => (a ? vec([...a].map(([k, r]) => [k, rat(-r.n, r.d)])) : null);

function vMul(a, b) {
  if (!a || !b) return null;
  const out = [];
  for (const [ka, ra] of a) {
    for (const [kb, rb] of b) {
      const [ma, pa] = unkey(ka); const [mb, pb] = unkey(kb);
      if (pa + pb > 1) return null;                       // π² — не наш ответ
      const { k, m } = squareFree(ma * mb);
      out.push([key(m, pa + pb), rMul(rMul(ra, rb), rat(k))]);
    }
  }
  return vec(out);
}

function vDiv(a, b) {
  if (!a || !b || b.size !== 1) return null;             // делим только на одночлен
  const [[kb, rb]] = [...b];
  const [m, p] = unkey(kb);
  if (p !== 0 || rb.n === 0) return null;
  // 1/(r·√m) = √m / (r·m)
  return vMul(a, vec([[key(m, 0), rat(rb.d, rb.n * m)]]));
}

function vSqrt(a) {
  if (!a || a.size > 1) return a && a.size === 0 ? a : null;
  const [[k, r]] = [...a];
  const [m, p] = unkey(k);
  if (m !== 1 || p !== 0 || r.n < 0) return null;
  // √(n/d) = √(n·d)/d
  const { k: kk, m: mm } = squareFree(r.n * r.d);
  return vec([[key(mm, 0), rat(kk, r.d)]]);
}

export const exactEqual = (a, b) => {
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, r] of a) {
    const o = b.get(k);
    if (!o || o.n !== r.n || o.d !== r.d) return false;
  }
  return true;
};

// ─── Разбор линейной записи ──────────────────────────────────────────────────
// Лексемы: числа, √, π, ( ) + - * /
function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (m) { out.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    if ('+-*/()√π'.includes(c)) { out.push({ t: c }); i++; continue; }
    return null;
  }
  return out;
}

function parseLinear(s) {
  const toks = tokenize(s);
  if (!toks || !toks.length) return null;
  let i = 0;
  const peek = () => toks[i]?.t;
  const startsFactor = () => ['num', '√', 'π', '('].includes(peek());

  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++].t;
      const r = term();
      v = op === '+' ? vAdd(v, r) : vAdd(v, vNeg(r));
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (peek() === '*') { i++; v = vMul(v, unary()); }
      else if (peek() === '/') { i++; v = vDiv(v, unary()); }
      else if (startsFactor()) v = vMul(v, factor());       // 2√3, 5π, 2(…)
      else return v;
    }
  }
  function unary() {
    if (peek() === '-') { i++; return vNeg(unary()); }
    if (peek() === '+') { i++; return unary(); }
    return factor();
  }
  function factor() {
    const t = toks[i++];
    if (!t) return null;
    if (t.t === 'num') {
      const [whole, frac = ''] = t.v.split('.');
      return vNum(rat(Number(whole + frac), 10 ** frac.length));
    }
    if (t.t === 'π') return vec([[key(1, 1), rat(1)]]);
    if (t.t === '(') { const v = expr(); if (toks[i++]?.t !== ')') return null; return v; }
    if (t.t === '√') return vSqrt(factor());
    return null;
  }
  const v = expr();
  return i === toks.length ? v : null;
}

// ─── LaTeX → линейная запись ─────────────────────────────────────────────────
function readGroup(s, i) {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') { depth--; if (depth === 0) return { body: s.slice(i + 1, j), end: j + 1 }; }
  }
  return null;
}

export function latexToLinear(latex) {
  let s = String(latex ?? '')
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\^\{\\circ\}|\^\\circ/g, '')
    .replace(/\\[,!;: ]/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/−/g, '-')
    .trim();
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('\\dfrac', i) || s.startsWith('\\frac', i) || s.startsWith('\\tfrac', i)) {
      i += s.startsWith('\\frac', i) ? 5 : 6;
      const a = readGroup(s, i); if (!a) return null;
      const b = readGroup(s, a.end); if (!b) return null;
      const A = latexToLinear(a.body); const B = latexToLinear(b.body);
      if (A == null || B == null) return null;
      out += `((${A})/(${B}))`;
      i = b.end;
      continue;
    }
    if (s.startsWith('\\sqrt', i)) {
      i += 5;
      const a = readGroup(s, i); if (!a) return null;
      const A = latexToLinear(a.body); if (A == null) return null;
      out += `√(${A})`;
      i = a.end;
      continue;
    }
    if (s.startsWith('\\pi', i)) { out += 'π'; i += 3; continue; }
    if (s[i] === '\\' || /[a-zA-Zа-яА-Я{}]/.test(s[i])) return null;   // буквы, функции
    out += s[i];
    i++;
  }
  return out;
}

/** Ответ генератора (LaTeX) → точное значение или null */
export function exactFromLatex(latex) {
  const lin = latexToLinear(latex);
  return lin == null ? null : parseLinear(lin);
}

/** Текст ученика → точное значение или null */
export function exactFromText(text) {
  const s = String(text ?? '')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/[×·]/g, '*')
    .replace(/°/g, '')
    .replace(/квадратный\s+корень\s+из|корень\s+из|корень|sqrt/g, '√')
    .replace(/pi|пи/g, 'π')
    .replace(/^[a-zа-я]\s*=\s*/, '')
    .trim();
  return parseLinear(s);
}

/** Запись значения так, как его наберёт ученик: «(√6+√2)/4», «-5π/6» */
export function exactToText(v) {
  if (!v) return '';
  if (v.size === 0) return '0';
  const entries = [...v];
  const den = entries.reduce((l, [, r]) => (l * r.d) / gcd(l, r.d), 1);
  const parts = entries.map(([k, r]) => {
    const [m, p] = unkey(k);
    const c = (r.n * den) / r.d;
    const body = `${m > 1 ? `√${m}` : ''}${p ? 'π' : ''}`;
    const abs = Math.abs(c);
    const coef = body && abs === 1 ? '' : String(abs);
    return { sign: c < 0 ? '-' : '+', text: `${coef}${body}` };
  });
  const num = parts.map((p, i) => (i === 0 ? (p.sign === '-' ? '-' : '') + p.text : `${p.sign}${p.text}`)).join('');
  if (den === 1) return num;
  return parts.length > 1 ? `(${num})/${den}` : `${num}/${den}`;
}
