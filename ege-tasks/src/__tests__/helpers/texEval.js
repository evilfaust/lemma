/**
 * Мини-вычислитель LaTeX для тестов устного счёта.
 *
 * Понимает ровно то, чем говорят листы «выражение → ответ»: числа с «{,}»,
 * смешанные числа (2\dfrac{1}{3}), \dfrac/\frac, \sqrt и \sqrt[n], степени,
 * \log_a / \lg / \ln, модуль, скобки (\left/\right), «\cdot» и «:», неявное
 * умножение (2\sqrt{3}, 14x). Переменная x подставляется для проверки
 * уравнений. Независим от генераторов: ответ сверяется с тем, что НАПЕЧАТАНО.
 */
export function evalTex(src, x = null) {
  const s = src
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\\[,!]/g, '')
    .replace(/−/g, '-');
  let i = 0;

  const ws = () => { while (s[i] === ' ') i++; };
  const peek = (t) => { ws(); return s.startsWith(t, i); };
  const eat = (t) => { if (peek(t)) { i += t.length; return true; } return false; };
  const need = (t) => { if (!eat(t)) throw new Error(`ожидалось «${t}» в позиции ${i}: ${src}`); };

  function num() {
    ws();
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }

  function group() {
    ws();
    if (eat('{')) { const v = expr(); need('}'); return v; }
    return atom();
  }

  function expr() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (peek('-')) { i++; v -= term(); }
      else return v;
    }
  }

  function term() {
    let v = unary();
    for (;;) {
      if (eat('\\cdot')) v *= unary();
      else if (eat(':')) v /= unary();
      else {
        ws();
        // неявное умножение: 2\sqrt{3}, 3(x + 1), 14x
        if (i < s.length && /[\d(\\x]/.test(s[i])) v *= unary();
        else return v;
      }
    }
  }

  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return power();
  }

  function power() {
    const b = atom();
    ws();
    if (!eat('^')) return b;
    ws();
    let e;
    if (s[i] === '{') e = group();
    else if (/\d/.test(s[i])) { e = Number(s[i]); i += 1; }
    else e = atom();
    return Math.pow(b, e);
  }

  function frac() { const a = group(); const b = group(); return a / b; }

  function atom() {
    ws();
    if (eat('(')) { const v = expr(); need(')'); return v; }
    if (eat('|')) { const v = expr(); need('|'); return Math.abs(v); }
    if (s[i] === '{') return group();
    if (eat('\\dfrac') || eat('\\frac') || eat('\\tfrac')) return frac();
    if (eat('\\sqrt')) {
      ws();
      let n = 2;
      if (eat('[')) { n = num(); need(']'); }
      const v = group();
      return v < 0 && n % 2 ? -Math.pow(-v, 1 / n) : Math.pow(v, 1 / n);
    }
    if (eat('\\log_')) {
      ws();
      // основание — одно число, {…} или x; не смешанное число (\log_4 \dfrac{1}{64})
      let base;
      if (s[i] === '{') base = group();
      else if (eat('x')) base = x;
      else base = num();
      let arg = power();
      while (peek('x')) { i += 1; arg *= x; }
      return Math.log(arg) / Math.log(base);
    }
    if (eat('\\lg')) return Math.log10(power());
    if (eat('\\ln')) return Math.log(power());
    if (eat('x')) {
      if (x == null) throw new Error(`в выражении есть x: ${src}`);
      return x;
    }
    const n = num();
    if (n != null) {
      // смешанное число: 2\dfrac{1}{3} — целое прямо перед правильной дробью
      ws();
      const fracCmd = s.startsWith('\\dfrac', i) ? 6 : s.startsWith('\\frac', i) ? 5 : 0;
      if (Number.isInteger(n) && fracCmd) {
        const save = i;
        i += fracCmd;
        const f = frac();
        if (f > 0 && f < 1) return n + f;
        i = save;
      }
      return n;
    }
    throw new Error(`не разобрано «${s.slice(i, i + 12)}»: ${src}`);
  }

  const v = expr();
  ws();
  if (i < s.length) throw new Error(`лишний хвост «${s.slice(i)}»: ${src}`);
  return v;
}

/** Совпадают ли два числа с точностью до погрешности вычислений. */
export function close(a, b) {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
}

/**
 * Верен ли напечатанный ответ: выражение равно ответу, а у уравнения ответ
 * обращает обе части в одно число («x = …» в ответе допускается).
 */
export function answerMatches(exprLatex, resultLatex) {
  const ans = evalTex(String(resultLatex).replace(/^x\s*=\s*/, ''));
  if (exprLatex.includes('=')) {
    const [left, right] = exprLatex.split('=');
    return close(evalTex(left, ans), evalTex(right, ans));
  }
  return close(evalTex(exprLatex), ans);
}
