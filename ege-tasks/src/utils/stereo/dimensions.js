// Размеры тела: арифметика без eval/Function и исходная запись для редактора.
export const BODY_DIMENSIONS = ['a', 'b', 'c', 'h', 'r', 'r2', 'roof', 'cut'];

export const dimensionText = (value) => String(value ?? '').trim().replace(/\s+/g, '');

/** Число, 2√3, sqrt(3)/2, (1+√5)/2, π; ошибка → NaN. */
export function dimensionValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string' || value.length > 256 || !value.trim()) return NaN;
  if (/[\d.,]\s+[\d.,]/.test(value)) return NaN;
  const src = dimensionText(value).replace(/,/g, '.').replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  let pos = 0;
  const checked = (n) => {
    if (!Number.isFinite(n)) throw new Error('Недопустимое значение');
    return n;
  };
  const eat = (token) => src.startsWith(token, pos) && ((pos += token.length), true);
  const atom = () => {
    if (eat('(')) {
      const n = sum();
      if (!eat(')')) throw new Error(')');
      return n;
    }
    if (eat('sqrt') || eat('√')) return checked(Math.sqrt(src[pos] === '(' ? atom() : unary()));
    if (eat('pi') || eat('π')) return Math.PI;
    const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(pos));
    if (!m) throw new Error('число');
    pos += m[0].length;
    return checked(Number(m[0]));
  };
  const power = () => {
    const n = atom();
    return eat('^') ? checked(n ** unary()) : n;
  };
  const unary = () => (eat('+') ? unary() : eat('-') ? -unary() : power());
  const product = () => {
    let n = unary();
    while (pos < src.length) {
      if (eat('*')) n = checked(n * unary());
      else if (eat('/')) n = checked(n / unary());
      else if (/^(?:sqrt|√|pi|π|\()/.test(src.slice(pos))) n = checked(n * unary());
      else break;
    }
    return n;
  };
  const sum = () => {
    let n = product();
    while (pos < src.length) {
      if (eat('+')) n = checked(n + product());
      else if (eat('-')) n = checked(n - product());
      else break;
    }
    return n;
  };
  try {
    const n = sum();
    return pos === src.length && Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
}

/** Метаданные храним лишь для действующих размеров, совпадающих с геометрией. */
export function dimensionExpressions(spec, normalized) {
  const out = {};
  for (const key of BODY_DIMENSIONS) {
    if (!(key in normalized)) continue;
    const text = typeof spec?.[key] === 'string' ? spec[key] : spec?.expressions?.[key];
    if (typeof text !== 'string') continue;
    const n = dimensionValue(text);
    if (Number.isFinite(n) && n === normalized[key]
      && !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(dimensionText(text))) {
      out[key] = dimensionText(text);
    }
  }
  return out;
}

export const dimensionLabel = (spec, key) => spec.expressions?.[key] ?? String(spec[key]);
