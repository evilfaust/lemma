// Математические подписи на чертежах: подмножество LaTeX → SVG.
//
// Зачем свой верстальщик, а не KaTeX. Чертежи проекта (coordPlot, numberLine,
// gridPaper) — это СТРОКА SVG, которую собирают обе ветки рендера и которая
// потом проходит DOMPurify и печатается вектором. KaTeX выдаёт HTML, положить
// его в SVG можно только через <foreignObject> — а он ломается в печати
// (Chrome теряет его при разбиении на страницы) и вырезается санитайзером.
// Поэтому формула раскладывается здесь в абсолютно позиционированные <text> +
// <line>/<path>: ни <defs>, ни id-ссылок, ни внешних объектов — как и весь
// остальной SVG проекта.
//
// Покрыто то, чем реально подписывают графики: индексы и степени (x_1, y^2),
// дроби (\frac{\pi}{2}), корни (\sqrt{2}), греческие буквы, знаки (\le, \pm,
// \to, \infty), штрихи (f'), \text{…}/\mathrm{…} и акценты (\vec, \overline).
// Обычный текст («Точка входа») проходит насквозь: латиница — курсивом, как
// переменная, кириллица — прямым шрифтом документа.
//
// API:
//   mathSvgText(src, opts) → '<text …/>…'   — готовые примитивы
//   measureMathSvg(src, opts) → { width, ascent, descent }
//
// Ширины букв берутся из таблицы метрик KaTeX (em на кегль) — тех же шрифтов,
// которыми набраны формулы в условиях задач, поэтому индексы и дробные черты
// встают точно. Кириллица в KaTeX-шрифтах отсутствует и рисуется шрифтом
// документа — для неё метрика приблизительная (ширины Times).

// Ширины глифов (em) — сгенерированы из fontMetricsData KaTeX.
const W_MAIN = {
  0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 0.5, 7: 0.5, 8: 0.5, 9: 0.5,
  ' ': 0.25, '!': 0.278, '"': 0.5, '#': 0.833, $: 0.5, '%': 0.833, '&': 0.778,
  "'": 0.278, '(': 0.389, ')': 0.389, '*': 0.5, '+': 0.778, ',': 0.278, '-': 0.333,
  '.': 0.278, '/': 0.5, ':': 0.278, ';': 0.278, '<': 0.778, '=': 0.778, '>': 0.778,
  '?': 0.472, '@': 0.778, A: 0.75, B: 0.708, C: 0.722, D: 0.764, E: 0.681, F: 0.653,
  G: 0.785, H: 0.75, I: 0.361, J: 0.514, K: 0.778, L: 0.625, M: 0.917, N: 0.75,
  O: 0.778, P: 0.681, Q: 0.778, R: 0.736, S: 0.556, T: 0.722, U: 0.75, V: 0.75,
  W: 1.028, X: 0.75, Y: 0.75, Z: 0.611, '[': 0.278, '\\': 0.5, ']': 0.278,
  a: 0.5, b: 0.556, c: 0.444, d: 0.556, e: 0.444, f: 0.306, g: 0.5, h: 0.556,
  i: 0.278, j: 0.306, k: 0.528, l: 0.278, m: 0.833, n: 0.556, o: 0.5, p: 0.556,
  q: 0.528, r: 0.392, s: 0.394, t: 0.389, u: 0.556, v: 0.528, w: 0.722, x: 0.528,
  y: 0.528, z: 0.444, '{': 0.5, '|': 0.278, '}': 0.5,
  Γ: 0.625, Δ: 0.833, Θ: 0.778, Λ: 0.694, Ξ: 0.667, Π: 0.75, Σ: 0.722, Φ: 0.722,
  Ψ: 0.778, Ω: 0.722,
  '−': 0.778, '±': 0.778, '∓': 0.778, '×': 0.778, '÷': 0.778, '⋅': 0.278,
  '≤': 0.778, '≥': 0.778, '≠': 0.778, '≈': 0.778, '≡': 0.778, '→': 1, '∞': 1,
  '∈': 0.667, '∉': 0.667, '∪': 0.667, '∩': 0.667, '⊂': 0.778, '∅': 0.5, '∠': 0.722,
  '°': 0.75, '′': 0.275, '…': 1.172, '⋯': 1.172, '∂': 0.531, '∫': 0.417, '∑': 1.056,
  '∏': 1.056, '∘': 0.5, '∆': 0.833,
};

const W_ITALIC = {
  0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 0.5, 7: 0.5, 8: 0.5, 9: 0.5,
  ' ': 0.25, A: 0.75, B: 0.759, C: 0.715, D: 0.828, E: 0.738, F: 0.643, G: 0.786,
  H: 0.831, I: 0.44, J: 0.555, K: 0.849, L: 0.681, M: 0.97, N: 0.803, O: 0.763,
  P: 0.642, Q: 0.791, R: 0.759, S: 0.613, T: 0.584, U: 0.683, V: 0.583, W: 0.944,
  X: 0.828, Y: 0.581, Z: 0.683, a: 0.529, b: 0.429, c: 0.433, d: 0.52, e: 0.466,
  f: 0.49, g: 0.477, h: 0.576, i: 0.345, j: 0.412, k: 0.521, l: 0.298, m: 0.878,
  n: 0.6, o: 0.485, p: 0.503, q: 0.446, r: 0.451, s: 0.469, t: 0.361, u: 0.572,
  v: 0.485, w: 0.716, x: 0.572, y: 0.49, z: 0.465,
  α: 0.64, β: 0.566, γ: 0.518, δ: 0.444, ε: 0.466, ζ: 0.438, η: 0.497, θ: 0.469,
  ι: 0.354, κ: 0.576, λ: 0.583, μ: 0.603, ν: 0.494, ξ: 0.438, ο: 0.485, π: 0.57,
  ρ: 0.517, σ: 0.571, τ: 0.437, υ: 0.54, φ: 0.654, χ: 0.626, ψ: 0.651, ω: 0.622,
  Γ: 0.615, Δ: 0.833, Θ: 0.763, Λ: 0.694, Ξ: 0.742, Π: 0.831, Σ: 0.78, Φ: 0.667,
  Ψ: 0.612, Ω: 0.772, ϑ: 0.591, ϕ: 0.596, ϖ: 0.828, ϱ: 0.517, ς: 0.363, ϵ: 0.406,
};

// Кириллица (и всё, чего нет в таблицах) рисуется шрифтом документа — берём
// усреднённую ширину Times/Arial, точнее без измерения в DOM не получится.
const W_FALLBACK = 0.55;

// Шрифты: те же, что у формул KaTeX в условии задачи, с честным запасным
// стеком — если woff2 KaTeX не подгрузился, подписи останутся читаемыми.
const FONT_MATH = "KaTeX_Math, 'Times New Roman', Times, serif";
const FONT_MAIN = "KaTeX_Main, 'Times New Roman', Times, serif";

// Метрики строки в em (под кегль 1): высота заглавной и глубина хвоста «у».
const ASC = 0.72;
const DESC = 0.2;
const AXIS = 0.25; // математическая ось — на ней стоит дробная черта
const SCRIPT = 0.72; // кегль индекса/степени относительно базового
const FRAC = 0.8; // кегль числителя и знаменателя
const SUP_SHIFT = 0.42;
const SUB_SHIFT = 0.2;

// Классы символов — от них зависят отбивки (как \medmuskip/\thickmuskip в TeX).
const BINARY = new Set(['+', '−', '±', '∓', '×', '÷', '⋅', '∪', '∩']);
const RELATION = new Set(['=', '<', '>', '≤', '≥', '≠', '≈', '≡', '→', '∈', '∉', '⊂']);
const OPENING = new Set(['(', '[', '{', '|']);

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
  varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

// Команды-символы, которые набираются прямым шрифтом.
const SYMBOLS = {
  cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  to: '→', rightarrow: '→', Rightarrow: '⇒', infty: '∞', in: '∈', notin: '∉',
  cup: '∪', cap: '∩', subset: '⊂', varnothing: '∅', emptyset: '∅', angle: '∠',
  circ: '∘', degree: '°', ldots: '…', dots: '…', cdots: '⋯', partial: '∂',
  int: '∫', sum: '∑', prod: '∏', prime: '′', star: '*',
};

// Многобуквенные имена функций — прямым шрифтом, как \sin в TeX.
const FUNCS = new Set([
  'sin', 'cos', 'tg', 'ctg', 'tan', 'cot', 'arcsin', 'arccos', 'arctg', 'arcctg',
  'arctan', 'ln', 'lg', 'log', 'exp', 'max', 'min', 'lim', 'sup', 'inf',
]);

const SPACES = { ',': 0.17, ':': 0.22, ';': 0.28, '!': -0.17, ' ': 0.25, quad: 1, qquad: 2 };

const r2 = (n) => Math.round(n * 100) / 100;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const isCyrillic = (ch) => /[Ѐ-ӿ]/.test(ch);
const isLatinLetter = (ch) => /[A-Za-z]/.test(ch);
const isGreekLower = (ch) => /[α-ωϑϕϖϱςϵ]/.test(ch);

/** Ширина глифа в em с учётом начертания. */
function glyphWidth(ch, italic) {
  const table = italic ? W_ITALIC : W_MAIN;
  const w = table[ch] ?? (italic ? W_MAIN[ch] : undefined);
  if (w !== undefined) return w;
  if (isCyrillic(ch)) return W_FALLBACK;
  return W_MAIN[ch] ?? W_FALLBACK;
}

// ───────────────────────────────── разбор ───────────────────────────────────

/**
 * Разбор строки в список узлов. Узлы: glyph, frac, sqrt, accent, space;
 * индексы и степени висят на узле полями sub/sup.
 * @param {string} src
 * @param {{rm?: boolean, bold?: boolean}} mode
 */
function parseMath(src, mode = {}) {
  const s = String(src ?? '');
  let i = 0;

  const nodes = [];
  const last = () => nodes[nodes.length - 1];
  const push = (node) => { nodes.push(node); };

  const skipBlanks = () => { while (i < s.length && s[i] === ' ') i += 1; };

  const readGroup = () => {
    // s[i] === '{'
    let depth = 0; const start = i;
    for (; i < s.length; i += 1) {
      if (s[i] === '{') depth += 1;
      else if (s[i] === '}') { depth -= 1; if (depth === 0) { i += 1; break; } }
    }
    return parseMath(s.slice(start + 1, Math.max(start + 1, i - 1)), mode);
  };

  const readCommand = () => {
    i += 1; // \
    const m = /^[A-Za-z]+/.exec(s.slice(i));
    if (!m) { const ch = s[i] ?? ''; i += 1; return ch; }
    i += m[0].length;
    return m[0];
  };

  // Аргументы команд читаются теми же приёмами, что и основной поток:
  // группа {…}, одиночный атом или необязательный [n] у корня.
  const io = {
    readGroup: () => { skipBlanks(); return s[i] === '{' ? readGroup() : readAtom(); },
    readOptional: () => {
      skipBlanks();
      if (s[i] !== '[') return null;
      const end = s.indexOf(']', i);
      if (end < 0) return null;
      const inner = s.slice(i + 1, end);
      i = end + 1;
      return parseMath(inner, mode);
    },
  };

  // Атом для _ и ^: группа {…}, команда (со своими аргументами) или символ.
  function readAtom() {
    skipBlanks();
    if (i >= s.length) return [];
    if (s[i] === '{') return readGroup();
    if (s[i] === '\\') {
      const node = commandNode(readCommand(), mode, io);
      return node ? [node] : [];
    }
    const ch = s[i]; i += 1;
    if (ch === '-') return [{ t: 'glyph', ch: '−', rm: true, bold: mode.bold }];
    return [glyphNode(ch, mode)];
  }

  while (i < s.length) {
    const ch = s[i];

    if (ch === '$') { i += 1; continue; } // «$x_1$» — доллары просто игнорируем

    if (ch === '{') { const inner = readGroup(); push({ t: 'row', items: inner }); continue; }
    if (ch === '}') { i += 1; continue; }

    if (ch === '_' || ch === '^') {
      i += 1;
      const arg = readAtom();
      const target = last();
      if (!target) { push({ t: 'row', items: [], [ch === '_' ? 'sub' : 'sup']: arg }); continue; }
      if (ch === '_') target.sub = [...(target.sub || []), ...arg];
      else target.sup = [...(target.sup || []), ...arg];
      continue;
    }

    if (ch === "'") { // штрих: f' — это степень со знаком «прайм»
      i += 1;
      const target = last();
      const prime = { t: 'glyph', ch: '′', rm: true };
      if (target) target.sup = [...(target.sup || []), prime];
      else push(prime);
      continue;
    }

    if (ch === '\\') {
      const node = commandNode(readCommand(), mode, io);
      if (node) push(node);
      continue;
    }

    i += 1;
    if (ch === ' ') { push({ t: 'space', w: 0.25 }); continue; }
    if (ch === '-') { push({ t: 'glyph', ch: '−', rm: true }); continue; } // минус, не дефис
    if (ch === '*') { push({ t: 'glyph', ch: '⋅', rm: true }); continue; }
    push(glyphNode(ch, mode));
  }

  return nodes;
}

function glyphNode(ch, mode) {
  const italic = !mode.rm && (isLatinLetter(ch) || isGreekLower(ch));
  return { t: 'glyph', ch, rm: !italic, bold: mode.bold };
}

function textNodes(src, mode) {
  return String(src).split('').map((ch) => (ch === ' '
    ? { t: 'space', w: 0.25 }
    : { t: 'glyph', ch, rm: true, bold: mode.bold }));
}

/** Узел для команды `\name` (аргументы читает через переданные хелперы). */
function commandNode(cmd, mode, io) {
  if (GREEK[cmd]) {
    const ch = GREEK[cmd];
    return { t: 'glyph', ch, rm: !isGreekLower(ch), bold: mode.bold };
  }
  if (SYMBOLS[cmd]) return { t: 'glyph', ch: SYMBOLS[cmd], rm: true, bold: mode.bold };
  if (FUNCS.has(cmd)) return { t: 'row', items: textNodes(cmd, mode), pre: 0.1, post: 0.1 };
  if (SPACES[cmd] !== undefined) return { t: 'space', w: SPACES[cmd] };

  switch (cmd) {
    case 'frac': case 'dfrac': case 'tfrac': {
      const num = io.readGroup();
      const den = io.readGroup();
      return { t: 'frac', num, den };
    }
    case 'sqrt': {
      const index = io.readOptional();
      const arg = io.readGroup();
      return { t: 'sqrt', arg, index };
    }
    case 'text': case 'mathrm': case 'operatorname': case 'mbox': {
      const arg = io.readGroup();
      return { t: 'row', items: uprightify(arg) };
    }
    case 'mathbf': case 'boldsymbol': case 'bf': {
      const arg = io.readGroup();
      return { t: 'row', items: boldify(arg) };
    }
    case 'mathit': case 'it': {
      const arg = io.readGroup();
      return { t: 'row', items: arg };
    }
    case 'vec': case 'overrightarrow': return { t: 'accent', kind: 'vec', arg: io.readGroup() };
    case 'overline': case 'bar': return { t: 'accent', kind: 'bar', arg: io.readGroup() };
    case 'hat': case 'widehat': return { t: 'accent', kind: 'hat', arg: io.readGroup() };
    case 'left': case 'right': case 'displaystyle': case 'textstyle': case 'limits':
      return null; // разделители рисуем обычными скобками
    case '%': case '{': case '}': case '_': case '^': case '&': case '#': case '$':
      return { t: 'glyph', ch: cmd, rm: true, bold: mode.bold };
    default:
      // Незнакомая команда: показываем её имя прямым шрифтом — это заметно
      // в превью конструктора, но не рушит весь чертёж.
      return { t: 'row', items: textNodes(cmd, mode) };
  }
}

const mapNodes = (nodes, fn) => (nodes || []).map((n) => {
  const next = fn({ ...n });
  ['items', 'num', 'den', 'arg', 'index', 'sub', 'sup'].forEach((key) => {
    if (next[key]) next[key] = mapNodes(next[key], fn);
  });
  return next;
});

const uprightify = (nodes) => mapNodes(nodes, (n) => (n.t === 'glyph' ? { ...n, rm: true } : n));
const boldify = (nodes) => mapNodes(nodes, (n) => ({ ...n, bold: true }));

// ──────────────────────────────── раскладка ─────────────────────────────────

/**
 * Разложить список узлов. Возвращает габариты и функцию, которая выкладывает
 * примитивы от точки (x, baselineY).
 * @returns {{w:number, asc:number, desc:number, place:(x:number,y:number)=>Array}}
 */
function layoutRow(nodes, size, ctx) {
  const boxes = [];
  let w = 0;
  let asc = 0;
  let desc = 0;
  let prevClass = 'open'; // чтобы первый «−» был унарным (без отбивки)
  let first = true;

  for (const node of nodes || []) {
    let cls = nodeClass(node);
    // Знак после открывающей скобки или другого знака — унарный: «−2», «(−x)».
    // Он не получает отбивки ни слева, ни справа, иначе минус «отклеивается».
    if (cls === 'bin' && (prevClass === 'open' || prevClass === 'bin' || prevClass === 'rel')) cls = 'ord';
    if (!first) w += spaceBetween(prevClass, cls) * size;
    first = false;

    const box = layoutNode(node, size, ctx);
    boxes.push({ box, x: w });
    w += box.w;
    asc = Math.max(asc, box.asc);
    desc = Math.max(desc, box.desc);
    prevClass = cls;
  }

  return {
    w,
    asc,
    desc,
    place: (x, y) => boxes.flatMap(({ box, x: dx }) => box.place(x + dx, y)),
  };
}

// Отбивки как в наборе: вокруг знака отношения шире, чем вокруг знака действия.
function spaceBetween(a, b) {
  if (a === 'rel' || b === 'rel') return 0.26;
  if (a === 'bin' || b === 'bin') return 0.2;
  return 0;
}

function nodeClass(node) {
  if (!node) return 'ord';
  if (node.t === 'glyph') {
    if (node.sub || node.sup) return 'ord';
    if (BINARY.has(node.ch)) return 'bin';
    if (RELATION.has(node.ch)) return 'rel';
    if (OPENING.has(node.ch)) return 'open';
  }
  return 'ord';
}

function layoutNode(node, size, ctx) {
  const base = layoutBase(node, size, ctx);
  if (!node.sub && !node.sup) return base;

  // Индекс и степень — уменьшенным кеглем, с фиксированным сдвигом от базовой
  // линии (в подписях чертежа хватает: формулы низкие, этажей не бывает).
  const sSize = size * SCRIPT;
  const sup = node.sup ? layoutRow(node.sup, sSize, ctx) : null;
  const sub = node.sub ? layoutRow(node.sub, sSize, ctx) : null;
  const supY = -(SUP_SHIFT * size + (sup && sub ? 0.06 * size : 0));
  const subY = SUB_SHIFT * size + (sup && sub ? 0.04 * size : 0);
  const scriptW = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);

  return {
    w: base.w + scriptW + 0.04 * size,
    asc: Math.max(base.asc, sup ? -supY + sup.asc : 0),
    desc: Math.max(base.desc, sub ? subY + sub.desc : 0),
    place: (x, y) => [
      ...base.place(x, y),
      ...(sup ? sup.place(x + base.w + 0.04 * size, y + supY) : []),
      ...(sub ? sub.place(x + base.w + 0.04 * size, y + subY) : []),
    ],
  };
}

function layoutBase(node, size, ctx) {
  const empty = { w: 0, asc: 0, desc: 0, place: () => [] };
  if (!node) return empty;

  switch (node.t) {
    case 'space':
      return { ...empty, w: node.w * size };

    case 'glyph': {
      const italic = !node.rm;
      const bold = !!node.bold || !!ctx.bold;
      const w = glyphWidth(node.ch, italic) * size;
      const tall = /[(){}\[\]|]/.test(node.ch);
      return {
        w,
        asc: ASC * size * (tall ? 1.05 : 1),
        desc: DESC * size * (/[gjpqy(){}\[\]|]/.test(node.ch) ? 1 : 0.1),
        place: (x, y) => [{
          k: 'glyph', x, y, size, italic, bold, ch: node.ch, cyr: isCyrillic(node.ch),
        }],
      };
    }

    case 'row': {
      const row = layoutRow(node.items, size, ctx);
      const pre = (node.pre || 0) * size;
      const post = (node.post || 0) * size;
      return {
        w: row.w + pre + post,
        asc: row.asc,
        desc: row.desc,
        place: (x, y) => row.place(x + pre, y),
      };
    }

    case 'frac': {
      const fs = size * FRAC;
      const num = layoutRow(node.num, fs, ctx);
      const den = layoutRow(node.den, fs, ctx);
      const pad = 0.12 * size;
      const rule = Math.max(0.055 * size, 0.7);
      const gap = 0.14 * size;
      const w = Math.max(num.w, den.w) + 2 * pad;
      const axis = AXIS * size;
      const numY = -(axis + rule / 2 + gap + num.desc);
      const denY = -axis + rule / 2 + gap + den.asc;
      return {
        w,
        asc: -numY + num.asc,
        desc: denY + den.desc,
        place: (x, y) => [
          ...num.place(x + (w - num.w) / 2, y + numY),
          ...den.place(x + (w - den.w) / 2, y + denY),
          {
            k: 'rule', x1: x + pad * 0.4, x2: x + w - pad * 0.4, y: y - axis, h: rule,
          },
        ],
      };
    }

    case 'sqrt': {
      const arg = layoutRow(node.arg, size, ctx);
      const rule = Math.max(0.055 * size, 0.8);
      const padTop = 0.14 * size;
      const signW = 0.52 * size;
      const tail = 0.1 * size;
      const top = -(arg.asc + padTop + rule);
      const bottom = Math.max(arg.desc, 0.06 * size);
      const idx = node.index && node.index.length ? layoutRow(node.index, size * 0.6, ctx) : null;
      const lead = idx ? Math.max(0, idx.w - signW * 0.55) : 0;
      return {
        w: lead + signW + arg.w + tail,
        asc: -top,
        desc: bottom,
        place: (x, y) => {
          const x0 = x + lead;
          const h = bottom - top;
          const d = [
            `M${r2(x0 + 0.04 * size)},${r2(y + top + h * 0.62)}`,
            `L${r2(x0 + 0.2 * size)},${r2(y + top + h * 0.54)}`,
            `L${r2(x0 + 0.36 * size)},${r2(y + bottom)}`,
            `L${r2(x0 + signW)},${r2(y + top + rule / 2)}`,
            `L${r2(x0 + signW + arg.w + tail)},${r2(y + top + rule / 2)}`,
          ].join(' ');
          return [
            { k: 'path', d, w: rule },
            ...arg.place(x0 + signW + 0.04 * size, y),
            ...(idx ? idx.place(x, y + top + h * 0.42) : []),
          ];
        },
      };
    }

    case 'accent': {
      const arg = layoutRow(node.arg, size, ctx);
      const gap = 0.1 * size;
      const stroke = Math.max(0.05 * size, 0.7);
      const top = -(arg.asc + gap);
      return {
        w: arg.w,
        asc: -top + stroke,
        desc: arg.desc,
        place: (x, y) => {
          const ay = y + top;
          const prims = arg.place(x, y);
          if (node.kind === 'hat') {
            prims.push({
              k: 'path',
              d: `M${r2(x + arg.w * 0.2)},${r2(ay + 0.1 * size)} L${r2(x + arg.w * 0.5)},${r2(ay - 0.06 * size)} L${r2(x + arg.w * 0.8)},${r2(ay + 0.1 * size)}`,
              w: stroke,
            });
            return prims;
          }
          const x2 = node.kind === 'vec' ? x + arg.w - 0.1 * size : x + arg.w;
          prims.push({
            k: 'rule', x1: x, x2, y: ay, h: stroke,
          });
          if (node.kind === 'vec') {
            const tip = x + arg.w + 0.06 * size;
            const half = 0.09 * size;
            prims.push({
              k: 'fill',
              d: `M${r2(tip)},${r2(ay)} L${r2(tip - 0.16 * size)},${r2(ay - half)} L${r2(tip - 0.16 * size)},${r2(ay + half)} Z`,
            });
          }
          return prims;
        },
      };
    }

    default:
      return empty;
  }
}

// ───────────────────────────────── вывод SVG ────────────────────────────────

// Соседние глифы одного начертания и одной базовой линии склеиваются в один
// <text>: меньше разметки, а главное — внутри строки буквы расставляет сам
// браузер, поэтому кернинг не зависит от точности нашей таблицы метрик.
function emit(prims, color) {
  const out = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    const family = run.cyr ? '' : ` font-family="${run.italic ? FONT_MATH : FONT_MAIN}"`;
    out.push(
      `<text x="${r2(run.x)}" y="${r2(run.y)}" font-size="${r2(run.size)}"${family}`
      + `${run.italic ? ' font-style="italic"' : ''}${run.bold ? ' font-weight="bold"' : ''}`
      + ` fill="${color}">${escapeXml(run.text)}</text>`,
    );
    run = null;
  };

  for (const p of prims) {
    if (p.k === 'glyph') {
      const key = `${p.size}|${p.italic}|${p.bold}|${p.cyr}|${r2(p.y)}`;
      if (run && run.key === key && Math.abs(run.end - p.x) < 0.15) {
        run.text += p.ch;
        run.end = p.x + glyphWidth(p.ch, p.italic) * p.size;
      } else {
        flush();
        run = {
          key,
          x: p.x,
          y: p.y,
          size: p.size,
          italic: p.italic,
          bold: p.bold,
          cyr: p.cyr,
          text: p.ch,
          end: p.x + glyphWidth(p.ch, p.italic) * p.size,
        };
      }
      continue;
    }
    flush();
    if (p.k === 'rule') {
      out.push(`<line x1="${r2(p.x1)}" y1="${r2(p.y)}" x2="${r2(p.x2)}" y2="${r2(p.y)}" stroke="${color}" stroke-width="${r2(p.h)}"/>`);
    } else if (p.k === 'path') {
      out.push(`<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${r2(p.w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (p.k === 'fill') {
      out.push(`<path d="${p.d}" fill="${color}"/>`);
    }
  }
  flush();
  return out.join('');
}

function build(src, opts = {}) {
  const size = opts.size || 12;
  const ctx = { bold: !!opts.bold };
  const nodes = parseMath(src, { bold: !!opts.bold, rm: !!opts.upright });
  const row = layoutRow(opts.upright ? uprightify(nodes) : nodes, size, ctx);
  return {
    width: row.w,
    // Пустую строку всё равно считаем строкой: так выключка подписи не прыгает.
    ascent: Math.max(row.asc, ASC * size),
    descent: Math.max(row.desc, 0),
    place: row.place,
  };
}

/**
 * Габариты формулы (px) — для выключки подписи и для разметки вокруг неё.
 * @param {string} src — подпись в подмножестве LaTeX
 * @param {{size?:number, bold?:boolean, upright?:boolean}} opts
 */
export function measureMathSvg(src, opts = {}) {
  const b = build(src, opts);
  return { width: b.width, ascent: b.ascent, descent: b.descent };
}

/**
 * Отрисовать подпись. Точка (x, y) — базовая линия, как у обычного <text>;
 * `anchor` работает как text-anchor (сдвигом, потому что внутри несколько
 * независимых <text>).
 * @param {string} src
 * @param {{x?:number, y?:number, size?:number, color?:string,
 *          anchor?:'start'|'middle'|'end', bold?:boolean, upright?:boolean}} opts
 */
export function mathSvgText(src, opts = {}) {
  const text = String(src ?? '').trim();
  if (!text) return '';
  const b = build(text, opts);
  const x = (opts.x || 0) - (opts.anchor === 'middle' ? b.width / 2 : 0)
    - (opts.anchor === 'end' ? b.width : 0);
  return emit(b.place(x, opts.y || 0), opts.color || '#1f2937');
}

/**
 * Флаг `bold` последним словом команды DSL-чертежа.
 * Подпись может и сама начинаться словом «bold» («bold text»), поэтому флагом
 * считается только ПОСЛЕДНИЙ токен и только если после него остаётся ещё `keep`
 * значимых токенов (координаты и, для подписи, хотя бы одно слово текста).
 * @param {string[]} parts — токены команды без её имени
 * @param {number} keep
 */
export function takeTrailingBold(parts, keep) {
  const last = parts[parts.length - 1];
  if (parts.length > keep && /^bold$/i.test(last || '')) {
    return { parts: parts.slice(0, -1), bold: true };
  }
  return { parts, bold: false };
}

/** Габариты ОБЫЧНОЙ строки этого кегля — эталон, с которым сравнивают формулу. */
export function mathLineMetrics(size = 12) {
  return { ascent: ASC * size, descent: DESC * size };
}

/** Есть ли в строке математическая разметка (для подсказок в конструкторе). */
export function hasMathMarkup(src) {
  return /[\\_^{}]/.test(String(src ?? ''));
}
