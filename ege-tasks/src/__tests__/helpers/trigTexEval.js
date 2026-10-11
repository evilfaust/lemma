/**
 * Вычислитель LaTeX для сторожа тригонометрии.
 *
 * Независим от генераторов: читает ТО, ЧТО НАПЕЧАТАНО, — \sin, \cos,
 * \operatorname{tg|ctg|arctg|arcctg}, \arcsin/\arccos, \pi, градусы ^{\circ},
 * дроби, корни, степени (\cos^2 x), неявное умножение (2\sin x\cos x) и
 * переменные (x, t, n, \alpha, \beta, \varphi, y). Аргумент функции без скобок
 * — «одночлен» до ближайших +, −, = или следующей функции, как читает ученик.
 */

const FUNCS = [
  ['\\operatorname{arcctg}', (v) => Math.PI / 2 - Math.atan(v)],
  ['\\operatorname{arctg}', Math.atan],
  ['\\operatorname{ctg}', (v) => 1 / Math.tan(v)],
  ['\\operatorname{tg}', Math.tan],
  ['\\arcsin', Math.asin],
  ['\\arccos', Math.acos],
  ['\\sin', Math.sin],
  ['\\cos', Math.cos],
];
const VARS = ['\\alpha', '\\beta', '\\varphi', 'x', 't', 'n', 'y'];

const cache = new Map();

/** Разбор один раз → функция окружения (переменные → число) */
export function compileTrig(src) {
  if (cache.has(src)) return cache.get(src);
  const s = String(src)
    .replace(/\\left|\\right|\\bigl|\\bigr|\\Bigl|\\Bigr/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\\[,!;:]|\\quad|\\qquad/g, ' ')
    .replace(/−/g, '-');
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const peek = (t) => { ws(); return s.startsWith(t, i); };
  const eat = (t) => { if (peek(t)) { i += t.length; return true; } return false; };
  const need = (t) => { if (!eat(t)) throw new Error(`ожидалось «${t}» в ${i}: ${src}`); };

  const funcAt = () => { ws(); return FUNCS.find(([n]) => s.startsWith(n, i)); };
  const varAt = () => { ws(); return VARS.find(v => s.startsWith(v, i) && !/[a-z]/i.test(s[i + v.length] || '')); };

  function num() {
    ws();
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }

  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) { const a = v; const b = term(); v = (e) => a(e) + b(e); }
      else if (peek('-')) { i++; const a = v; const b = term(); v = (e) => a(e) - b(e); }
      else return v;
    }
  }

  // неявное умножение — пока дальше атом; `stopAtFunc` — аргумент функции
  function term(stopAtFunc = false) {
    let v = unary(stopAtFunc);
    for (;;) {
      // аргумент функции без скобок кончается на «\cdot»: tg 47° · tg 223°
      if (stopAtFunc && peek('\\cdot')) return v;
      if (eat('\\cdot')) { const a = v; const b = unary(stopAtFunc); v = (e) => a(e) * b(e); continue; }
      ws();
      if (i >= s.length) return v;
      if (stopAtFunc && funcAt()) return v;
      if (/[\d(]/.test(s[i]) || s.startsWith('\\dfrac', i) || s.startsWith('\\frac', i)
        || s.startsWith('\\sqrt', i) || s.startsWith('\\pi', i) || funcAt() || varAt()
        || s[i] === '{') {
        const a = v; const b = unary(stopAtFunc); v = (e) => a(e) * b(e);
        continue;
      }
      return v;
    }
  }

  function unary(stopAtFunc) {
    if (eat('-')) { const a = unary(stopAtFunc); return (e) => -a(e); }
    if (eat('+')) return unary(stopAtFunc);
    return power();
  }

  function exponent() {
    ws();
    if (s.startsWith('{\\circ}', i)) { i += 7; return 'deg'; }
    if (s.startsWith('\\circ', i)) { i += 5; return 'deg'; }
    if (s[i] === '{') { i++; const e = expr(); need('}'); return e; }
    if (/\d/.test(s[i])) { const c = Number(s[i]); i++; return () => c; }
    return atom();
  }

  function power() {
    const b = atom();
    ws();
    if (!eat('^')) return b;
    const p = exponent();
    if (p === 'deg') return (e) => (b(e) * Math.PI) / 180;
    return (e) => Math.pow(b(e), p(e));
  }

  function group() {
    ws();
    if (eat('{')) { const v = expr(); need('}'); return v; }
    return atom();
  }

  function atom() {
    ws();
    if (eat('(')) { const v = expr(); need(')'); return v; }
    if (eat('|')) { const v = expr(); need('|'); return (e) => Math.abs(v(e)); }
    if (s[i] === '{') return group();
    if (eat('\\dfrac') || eat('\\frac') || eat('\\tfrac')) {
      const a = group(); const b = group(); return (e) => a(e) / b(e);
    }
    if (eat('\\sqrt')) { const a = group(); return (e) => Math.sqrt(a(e)); }
    if (eat('\\pi')) return () => Math.PI;
    const f = funcAt();
    if (f) {
      i += f[0].length;
      ws();
      // \cos^2 x — степень функции
      let pw = () => 1;
      if (eat('^')) pw = exponent();
      ws();
      let arg;
      if (s[i] === '(') { i++; arg = expr(); need(')'); }
      else arg = term(true);
      const fn = f[1];
      return (e) => Math.pow(fn(arg(e)), pw(e));
    }
    const v = varAt();
    if (v) {
      i += v.length;
      return (e) => {
        if (!(v in e)) throw new Error(`нет значения ${v}: ${src}`);
        return e[v];
      };
    }
    const n = num();
    if (n != null) return () => n;
    throw new Error(`не разобрано «${s.slice(i, i + 14)}»: ${src}`);
  }

  const v = expr();
  ws();
  if (i < s.length) throw new Error(`хвост «${s.slice(i)}»: ${src}`);
  cache.set(src, v);
  return v;
}

export function evalTrig(src, vars = {}) {
  return compileTrig(src)(vars);
}

export const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

/** Подсказка в скобках после задания: «\sin 75^{\circ}\;\bigl(75^{\circ}=…\bigr)» */
export const stripHint = (t) => String(t).replace(/\\;\\bigl\(.*\\bigr\)\s*$/, '');

/**
 * Ответ уравнения → список функций n ↦ x (по одной на ветвь «±»).
 * Формат: «x = … + 2\pi n\;\text{ или }\;x = …,\; n \in \mathbb{Z}».
 * «корней нет» → [].
 */
export function parseFamilies(answer) {
  const a = String(answer);
  if (/корней нет|нет корней|\\varnothing/.test(a)) return [];
  const body = a.replace(/,\s*(\\[;,]\s*)?n\s*\\in\s*\\mathbb\{Z\}\s*$/, '');
  const parts = body.split(/\\text\{\s*или\s*\}/).map(p => p.replace(/\\;/g, ' ').trim());
  const out = [];
  for (const p of parts) {
    const m = /^([a-z]|\\[a-z]+)\s*=\s*(.+)$/.exec(p);
    if (!m) throw new Error(`не серия: ${p}`);
    const rhs = m[2];
    if (rhs.includes('\\pm')) {
      const p1 = compileTrig(rhs.replace('\\pm', '+'));
      const p2 = compileTrig(rhs.replace('\\pm', '-'));
      out.push((n) => p1({ n }));
      out.push((n) => p2({ n }));
    } else {
      const c = compileTrig(rhs);
      out.push((n) => c({ n }));
    }
  }
  return out;
}

/**
 * Корни f на отрезке [lo; hi]: смена знака (с уточнением бисекцией и отсевом
 * полюсов tg) и касание оси (локальный минимум |f|, уточнённый троичным поиском).
 */
export function numericRoots(f, lo, hi, steps = 30000) {
  const h = (hi - lo) / steps;
  const roots = [];
  const push = (x) => { if (!roots.some(r => Math.abs(r - x) < 1e-5)) roots.push(x); };
  let xp = lo; let yp = f(xp);
  let ypp = null;
  for (let k = 1; k <= steps; k++) {
    const x = lo + k * h;
    const y = f(x);
    if (Number.isFinite(y) && Number.isFinite(yp)) {
      if (y === 0) push(x);
      else if (yp * y < 0) {
        let a = xp; let b = x; let fa = yp;
        for (let it = 0; it < 80; it++) {
          const m = (a + b) / 2; const fm = f(m);
          if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
        }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) < 1e-9) push(r);
      } else if (ypp !== null && Math.abs(yp) < Math.abs(y) && Math.abs(yp) < Math.abs(ypp) && Math.abs(yp) < 1e-2) {
        let a = xp - h; let b = x;
        for (let it = 0; it < 100; it++) {
          const m1 = a + (b - a) / 3; const m2 = b - (b - a) / 3;
          if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2; else a = m1;
        }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) < 1e-9) push(r);
      }
    }
    ypp = yp; xp = x; yp = y;
  }
  return roots.sort((p, q) => p - q);
}

/**
 * Область определения: где в уравнении есть tg (ctg), точки с cos x = 0
 * (sin x = 0) — не корни, даже если произведение там «обнуляется» численно
 * ((sin x − 1)·tg x при x = π/2). Только для аргумента x без множителя.
 */
export function domainGuarded(tex, g) {
  const tg = /\\operatorname\{tg\}\s*x/.test(tex);
  const ctg = /\\operatorname\{ctg\}\s*x/.test(tex);
  if (!tg && !ctg) return g;
  return (x) => {
    if (tg && Math.abs(Math.cos(x)) < 1e-5) return NaN;
    if (ctg && Math.abs(Math.sin(x)) < 1e-5) return NaN;
    return g(x);
  };
}

/**
 * Сверка ответа уравнения с самим уравнением (обе части — напечатанный текст).
 * Возвращает null, если всё сходится, иначе — текст проблемы.
 */
export function checkEquation(exprLatex, resultLatex, v = 'x', window = [-28, 28]) {
  const [left, right] = exprLatex.split('=');
  const L = compileTrig(left); const R = compileTrig(right);
  const g = domainGuarded(exprLatex, (x) => L({ [v]: x }) - R({ [v]: x }));
  const fams = parseFamilies(resultLatex);
  // каждая точка серии — корень
  for (const fam of fams) {
    for (let n = -3; n <= 3; n++) {
      const x = fam(n);
      const r = g(x);
      if (!Number.isFinite(r) || Math.abs(r) > 1e-6) return `не корень: n=${n}, x=${x}, невязка ${r}`;
    }
  }
  // и корней ровно столько, сколько даёт ответ
  const [lo, hi] = window;
  const pts = [];
  for (const fam of fams) {
    for (let n = -400; n <= 400; n++) {
      const x = fam(n);
      if (x > lo + 1e-4 && x < hi - 1e-4 && !pts.some(p => Math.abs(p - x) < 1e-5)) pts.push(x);
    }
  }
  const roots = numericRoots(g, lo, hi).filter(x => x > lo + 1e-4 && x < hi - 1e-4);
  const missed = roots.filter(r => !pts.some(p => Math.abs(p - r) < 1e-4));
  if (missed.length) return `потеряны корни: ${missed.slice(0, 3).map(r => r.toFixed(4)).join(', ')}`;
  const extra = pts.filter(p => !roots.some(r => Math.abs(p - r) < 1e-4));
  if (extra.length) return `лишние точки: ${extra.slice(0, 3).map(r => r.toFixed(4)).join(', ')}`;
  return null;
}

// ─── Неравенства ─────────────────────────────────────────────────────────────
const REL = [
  ['\\geqslant', (a, b) => a >= b], ['\\leqslant', (a, b) => a <= b],
  ['>', (a, b) => a > b], ['<', (a, b) => a < b],
];

/** Ответ неравенства → x ↦ принадлежит ли. Читает обе записи и ∅, ℝ, «=», «≠». */
export function parseInequalityAnswer(answer) {
  const a = String(answer).replace(/,\s*(\\[;,]\s*)?n\s*\\in\s*\\mathbb\{Z\}\s*$/, '').trim();
  if (a === '\\varnothing') return () => false;
  if (/^x\s*\\in\s*\\mathbb\{R\}$/.test(a)) return () => true;
  // серия линейна по n: период = c(1) − c(0), проверяем только соседние n
  const periodic = (c, f) => {
    const c0 = c({ n: 0 }); const T = c({ n: 1 }) - c0;
    return (x) => {
      const n0 = Math.floor((x - c0) / T);
      for (let n = n0 - 2; n <= n0 + 2; n++) if (f(n, x)) return true;
      return false;
    };
  };
  let m = /^x\s*=\s*(.+)$/.exec(a);
  if (m) { const c = compileTrig(m[1]); return periodic(c, (n, x) => Math.abs(c({ n }) - x) < 1e-9); }
  m = /^x\s*\\ne\s*(.+)$/.exec(a);
  if (m) { const c = compileTrig(m[1]); const on = periodic(c, (n, x) => Math.abs(c({ n }) - x) < 1e-9); return (x) => !on(x); }
  m = /^x\s*\\in\s*\\left([[(])(.+);\\,\s*(.+)\\right([\])])$/.exec(a);
  if (m) {
    const L = compileTrig(m[2]); const R = compileTrig(m[3]);
    const lo = m[1] === '[' ? (p, x) => p <= x : (p, x) => p < x;
    const hi = m[4] === ']' ? (x, p) => x <= p : (x, p) => x < p;
    return periodic(L, (n, x) => lo(L({ n }), x) && hi(x, R({ n })));
  }
  // «L < x ⩽ R»
  const parts = a.split(/\s(\\leqslant|<)\s/);
  if (parts.length === 5 && parts[2].trim() === 'x') {
    const L = compileTrig(parts[0]); const R = compileTrig(parts[4]);
    const r1 = REL.find(([t]) => t === parts[1])[1];
    const r2 = REL.find(([t]) => t === parts[3])[1];
    return periodic(L, (n, x) => r1(L({ n }), x) && r2(x, R({ n })));
  }
  throw new Error(`не разобран ответ неравенства: ${answer}`);
}

/** Сверка ответа неравенства с напечатанным неравенством в пробных точках */
export function checkInequality(exprLatex, resultLatex) {
  const [tex, fn] = REL.find(([t]) => exprLatex.includes(` ${t} `));
  const [l, r] = exprLatex.split(` ${tex} `);
  const L = compileTrig(l); const R = compileTrig(r);
  const inAns = parseInequalityAnswer(resultLatex);
  for (let i = 0; i < 1500; i++) {
    const x = -14 + (28 * i) / 1500 + 0.00731;
    const lv = L({ x }); const rv = R({ x });
    if (!Number.isFinite(lv) || Math.abs(lv) > 1e6) continue;
    if (Math.abs(lv - rv) < 1e-5) continue;          // у границы — не судим
    if (fn(lv, rv) !== inAns(x)) return `x = ${x.toFixed(4)}: неравенство ${fn(lv, rv)}, ответ ${inAns(x)}`;
  }
  // и граничные точки: при нестрогом знаке входят, при строгом — нет
  return null;
}
