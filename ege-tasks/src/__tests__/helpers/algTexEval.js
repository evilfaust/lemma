/**
 * Вычислитель LaTeX с буквами — для сторожа формул сокращённого умножения.
 *
 * Понимает то, чем говорят эти листы: числа с «{,}», \frac/\dfrac, \sqrt,
 * степени (x^2, x^{10}), буквы a–z, скобки (\left/\right), «\cdot» и «:»,
 * неявное умножение (2x\sqrt{x + 1}, 3(x + 1)). Значения букв — из `env`.
 * Независим от генератора: проверяется то, что НАПЕЧАТАНО.
 */
export function evalAlg(src, env = {}) {
  const s = String(src)
    .replace(/\\left|\\right/g, '')
    .replace(/\{,\}/g, '.')
    .replace(/\\[,!;]|\\ /g, ' ')
    .replace(/−/g, '-');
  let i = 0;

  const ws = () => { while (s[i] === ' ') i++; };
  const peek = (t) => { ws(); return s.startsWith(t, i); };
  const eat = (t) => { if (peek(t)) { i += t.length; return true; } return false; };
  const need = (t) => { if (!eat(t)) throw new Error(`ожидалось «${t}» в позиции ${i}: ${src}`); };

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
        if (i < s.length && /[\d(\\a-z{]/.test(s[i])) v *= power();
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
    if (s[i] === '{') { i++; e = expr(); need('}'); }
    else { e = Number(s[i]); i += 1; }
    return Math.pow(b, e);
  }

  function group() {
    ws();
    need('{');
    const v = expr();
    need('}');
    return v;
  }

  function atom() {
    ws();
    if (eat('(')) { const v = expr(); need(')'); return v; }
    if (s[i] === '{') return group();
    if (eat('\\dfrac') || eat('\\frac') || eat('\\tfrac')) { const a = group(); return a / group(); }
    if (eat('\\sqrt')) {
      const v = group();
      if (v < -1e-9) throw new Error(`корень из отрицательного: ${src}`);
      return Math.sqrt(Math.max(0, v));
    }
    if (/[a-z]/.test(s[i] || '')) {
      const name = s[i];
      i += 1;
      if (!(name in env)) throw new Error(`буква ${name} без значения: ${src}`);
      return env[name];
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    throw new Error(`не разобрано «${s.slice(i, i + 12)}»: ${src}`);
  }

  const v = expr();
  ws();
  if (i < s.length) throw new Error(`лишний хвост «${s.slice(i)}»: ${src}`);
  return v;
}

/** Буквы, которые встречаются в формуле (без команд вроде \sqrt). */
export function lettersOf(src) {
  return [...new Set(String(src).replace(/\\[a-zA-Z]+/g, ' ').match(/[a-z]/g) || [])];
}

/** Случайные значения букв: большие — чтобы подкоренные были положительны. */
export function randomEnv(letters, seed = 0) {
  const env = {};
  letters.forEach((l, k) => { env[l] = 7.3 + 1.7 * k + 2.9 * seed + 0.37 * ((seed * 7 + k * 3) % 5); });
  return env;
}

export const near = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

/** Равны ли два выражения при нескольких наборах значений букв. */
export function sameAlg(left, right, rounds = 4) {
  const letters = lettersOf(`${left} ${right}`);
  for (let r = 0; r < rounds; r++) {
    const env = randomEnv(letters, r);
    if (!near(evalAlg(left, env), evalAlg(right, env))) return false;
  }
  return true;
}
