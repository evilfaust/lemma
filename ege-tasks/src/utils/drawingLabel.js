// Подписи на чертежах планиметрии и стереометрии — LaTeX через mathSvgText.
//
// Вёрстку формулы (дробь столбиком, корень с чертой, индексы, греческие
// буквы) делает общий `mathSvgText` — тот же, что у ```plot и ```numline.
// Здесь только то, что нужно подписям этих редакторов:
//  • старый «простой» синтаксис, которым подписи набирали до LaTeX, — в LaTeX:
//    `sqrt(3)`, `√2`, `√(a+b)`, `альфа`/`alpha`, `0,5`, а `a/b`, `(a+b)/2`,
//    `2√3/3` — дробью столбиком;
//  • белая подложка (halo) под подписью на линиях чертежа.

import { mathSvgText, measureMathSvg } from './mathSvgText';

const GREEK_WORDS = {
  альфа: 'alpha', бета: 'beta', гамма: 'gamma', дельта: 'delta', фи: 'varphi', пси: 'psi',
  омега: 'omega', тета: 'theta', лямбда: 'lambda', пи: 'pi',
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', phi: 'varphi', varphi: 'varphi',
  psi: 'psi', omega: 'omega', theta: 'theta', lambda: 'lambda', mu: 'mu', pi: 'pi',
};

/** Конец группы, открытой в s[i] скобкой «(» или «{». */
function closeOf(s, i) {
  const open = s[i];
  const close = open === '(' ? ')' : '}';
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth += 1;
    else if (s[j] === close) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/** Открывающая скобка группы, закрытой в s[i]. */
function openOf(s, i) {
  const close = s[i];
  const open = close === ')' ? '(' : '{';
  let depth = 0;
  for (let j = i; j >= 0; j--) {
    if (s[j] === close) depth += 1;
    else if (s[j] === open) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/** sqrt(…), √(…), √{…}, √17 → \sqrt{…}. */
function rootsToTex(src) {
  let s = src.replace(/(^|[^\\A-Za-z])sqrt\s*(?=[({])/gi, '$1√').replace(/\\sqrt(?=[^{[A-Za-z])/g, '√');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '√') { out += s[i]; continue; }
    const nx = s[i + 1];
    if (nx === '(' || nx === '{') {
      const end = closeOf(s, i + 1);
      if (end > 0) {
        out += `\\sqrt{${rootsToTex(s.slice(i + 2, end))}}`;
        i = end;
        continue;
      }
    }
    const m = /^[0-9A-Za-zα-ω.,]+/.exec(s.slice(i + 1));
    if (m) {
      out += `\\sqrt{${m[0]}}`;
      i += m[0].length;
      continue;
    }
    out += '\\sqrt{}';
  }
  s = out;
  return s;
}

/** Левый операнд дроби, кончающийся перед позицией i: [начало, конец, текст без скобок]. */
function leftOperand(s, i) {
  let j = i - 1;
  while (j >= 0 && s[j] === ' ') j -= 1;
  if (j < 0) return null;
  let start;
  let inner;
  if (s[j] === ')') {
    start = openOf(s, j);
    if (start < 0) return null;
    inner = s.slice(start + 1, j);
  } else if (s[j] === '}') {
    start = openOf(s, j);
    if (start < 0) return null;
    // \sqrt{…}, \text{…} — вместе с командой
    const cmd = /\\[A-Za-z]+$/.exec(s.slice(0, start));
    if (cmd) start -= cmd[0].length;
    inner = s.slice(start, j + 1);
  } else {
    const m = /[0-9A-Za-zα-ω.,']+$/.exec(s.slice(0, j + 1));
    if (!m) return null;
    start = j + 1 - m[0].length;
    inner = m[0];
  }
  // «2√3/3», «3a/4» — множитель-число вместе со своим множимым
  if (s[j] === '}' || s[j] === ')') {
    const coef = /[0-9.,]+$/.exec(s.slice(0, start));
    if (coef) {
      start -= coef[0].length;
      inner = coef[0] + (s[j] === ')' ? `(${inner})` : inner);
    }
  }
  return { start, inner };
}

/** Правый операнд дроби, начинающийся после позиции i. */
function rightOperand(s, i) {
  let j = i + 1;
  while (j < s.length && s[j] === ' ') j += 1;
  if (j >= s.length) return null;
  if (s[j] === '(' || s[j] === '{') {
    const end = closeOf(s, j);
    if (end < 0) return null;
    return { end: end + 1, inner: s.slice(j + 1, end) };
  }
  const cmd = /^\\[A-Za-z]+/.exec(s.slice(j));
  if (cmd) {
    const k = j + cmd[0].length;
    if (s[k] === '{') {
      const end = closeOf(s, k);
      if (end > 0) return { end: end + 1, inner: s.slice(j, end + 1) };
    }
    return { end: k, inner: cmd[0] };
  }
  const m = /^[0-9A-Za-zα-ω.,']+/.exec(s.slice(j));
  if (!m) return null;
  return { end: j + m[0].length, inner: m[0] };
}

/** a/b → \frac{a}{b} (только «a/b» вне фигурных скобок команд). */
function slashToFrac(src) {
  let s = src;
  for (let guard = 0; guard < 20; guard++) {
    const k = s.indexOf('/');
    if (k < 0) break;
    const L = leftOperand(s, k);
    const R = rightOperand(s, k);
    if (!L || !R) {
      s = `${s.slice(0, k)}\\slash${s.slice(k + 1)}`;
      continue;
    }
    s = `${s.slice(0, L.start)}\\frac{${L.inner}}{${R.inner}}${s.slice(R.end)}`;
  }
  return s.replace(/\\slash/g, '/');
}

/**
 * Подпись чертежа → строка для mathSvgText.
 * Уже правильный LaTeX проходит как есть; доллары можно ставить, можно нет.
 */
export function drawingLabelTex(raw) {
  let s = String(raw ?? '').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/(\\?)([A-Za-zА-Яа-яё]+)/g, (w, slash, word) => {
    if (slash) return w;
    const g = GREEK_WORDS[word.toLowerCase()];
    return g ? `\\${g} ` : w;
  }).replace(/\s+$/, '');
  s = s.replace(/\^\s*°/g, '°');
  s = rootsToTex(s);
  s = slashToFrac(s);
  // десятичная запятая: «0,5» — без пробела после запятой
  s = s.replace(/(\d),(?=\d)/g, '$1{,}');
  return s;
}

/** Габариты подписи: { width, ascent, descent } в единицах кадра. */
export function measureDrawingLabel(raw, size = 15, opts = {}) {
  return measureMathSvg(drawingLabelTex(raw), { size, bold: !!opts.bold, fracScale: FRAC_SCALE });
}

const HALO = 3;
// Дробь на чертеже крупнее, чем в строке графика: подпись «a/2» у ребра
// должна читаться с бумаги (числитель 0,9 кегля вместо 0,8).
const FRAC_SCALE = 0.9;

/**
 * SVG подписи. (x, y) — середина подписи по горизонтали и базовая линия
 * (как у <text text-anchor="middle">).
 * @param opts — { size, color, halo, bold }
 */
export function drawingLabelSvg(raw, x, y, opts = {}) {
  const tex = drawingLabelTex(raw);
  if (!tex) return '';
  const base = { x, y, size: opts.size || 15, anchor: 'middle', bold: !!opts.bold, fracScale: FRAC_SCALE };
  const ink = mathSvgText(tex, { ...base, color: opts.color || '#111827' });
  if (!opts.halo) return ink;
  // Подложка: тот же набор белым и толще — линии чертежа не режут буквы.
  const halo = mathSvgText(tex, { ...base, color: '#ffffff' })
    .replace(/<text /g, `<text stroke="#ffffff" stroke-width="${HALO}" stroke-linejoin="round" `)
    .replace(/stroke-width="([\d.]+)"(?=\s*(?:stroke-linecap|\/>))/g, (m, w) => `stroke-width="${Number(w) + HALO}"`)
    .replace(/<path d="([^"]*)" fill="#ffffff"\/>/g, `<path d="$1" fill="#ffffff" stroke="#ffffff" stroke-width="${HALO}"/>`);
  return halo + ink;
}

/**
 * Где поставить базовую линию, чтобы подпись встала серединой высоты на cy.
 * Для обычной строки это ~cy + 4 (как прежний «y + 5»), для дроби — выше.
 */
export function drawingLabelBaseline(raw, cy, size = 15, opts = {}) {
  const m = measureDrawingLabel(raw, size, opts);
  return cy + (m.ascent - m.descent) / 2;
}
