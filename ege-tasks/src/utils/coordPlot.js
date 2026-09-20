// Координатная плоскость: графики функций и векторы.
//
// Модуль-близнец numberLine.js и обслуживает ОБА конвейера рендеринга проекта:
//   • условия/решения задач → react-markdown (MathRenderer) ловит fenced-блок
//     ```plot (алиас ```vectors) и рендерит <CoordPlotSVG spec=…/>;
//   • теория → useMarkdownProcessor получает HTML-строку, postprocess подменяет
//     <pre><code class="language-plot">…</code></pre> на готовый <svg>-string.
//
// Чтобы обе ветки давали идентичную картинку, SVG всегда строит ОДНА функция
// coordPlotSvg(model). SVG нарочно собран БЕЗ <defs>/<pattern>/<marker>:
// стрелки осей и векторов — это <path>, клетка — обычные <line>. Так разметка
// надёжно проходит DOMPurify (нет id-ссылок url(#…)) и печатается вектором.
//
// API:
//   parseCoordPlot(spec)        → model
//   coordPlotSvg(model, opts?)  → '<svg>…</svg>'
//   coordPlotSvgFromSpec(spec)  → '<svg>…</svg>'  (parse + render)
//   compileExpr(src)            → { fn, error }   (безопасный калькулятор f(x))
//   plotToSpec(state)           → текст DSL (для конструктора)
//   specToPlotState(spec)       → состояние конструктора (обратная plotToSpec)
//
// DSL (одна команда на строку; «;» тоже разделитель — для inline-формы
// в ячейках markdown-таблиц; строки с # — комментарии):
//   x -4 4               — диапазон по оси X (алиас: xrange)
//   y -3 5               — диапазон по оси Y (алиас: yrange)
//   grid 1 | grid off    — шаг клетки
//   size 280             — ширина картинки в px
//   axis x y             — буквы осей
//   units off            — не подписывать единичные отрезки «1»
//   f x^2-4              — график функции; модификаторы: color NAME,
//                          from A to B (видна только часть графика; можно
//                          одностороннее «from A» или «to B»), dash
//   vec a 1 4 3 1        — вектор из (1;4) в (3;1) с подписью a
//   vec b 2 3            — вектор из начала координат в (2;3)
//   point 1 3 fill       — точка на плоскости: вид fill|open|cross|plus и
//                          размер small|big (по умолчанию обычный)
//   seg 0 0 2 3 dash     — отрезок
//   label 2 3 A          — текстовая подпись у точки (2;3); модификатор
//                          at ne|n|nw|w|sw|s|se|e [расстояние] — с какой стороны
//                          от точки стоит подпись (по умолчанию ne — справа
//                          сверху) и как далеко (1 — вплотную, «at nw 2» — вдвое
//                          дальше, когда подпись накрывает график)
//   xtick -5             — засечка с подписью на оси X (алиас подписи вторым словом)
//   ytick 3 три          — засечка с подписью на оси Y
//
// Подписи (label/text, xtick/ytick, буквы осей, подпись вектора) набираются
// как формулы — подмножеством LaTeX через mathSvgText.js: индексы и степени
// (`label 1 -1 M_1`, `y^2`), дроби (`xtick 1.57 \frac{\pi}{2}`), корни
// (`\sqrt{2}`), греческие буквы, знаки (`\le`, `\pm`, `\to`, `\infty`),
// штрих (`f'(x)`), `\text{…}`, `\vec{a}`. Обычные слова проходят как есть:
// латиница — курсивом (переменная), кириллица — прямым шрифтом документа.
// Последнее слово `bold` в этих командах делает подпись жирной
// (`label 1 1 x_1 bold`, `xtick 2 bold`, `vec a 0 0 3 2 bold`); подпись,
// которая сама НАЧИНАЕТСЯ словом bold, остаётся текстом.
//
// Кривые по точкам и производная (splineCurve.js). Кривая монотонна между
// соседними точками, поэтому экстремумы — ровно в заданных точках:
//   spline f (-5 -3) (-3 2) (0 -1) (3 3)   — кривая f по точкам; внутри скобок
//                          флаги flat (f′ = 0 без смены знака) и slope K (наклон
//                          касательной); «(-3; 2)» тоже годится. Без скобок —
//                          пары чисел подряд. Модификаторы: color, dash, bold,
//                          hide (задать, но не рисовать), from A to B
//   deriv f              — график производной f′ (color/dash/bold/from…to);
//                          `deriv f'` — вторая производная f″
//   prim F f 0 1         — первообразная F кривой f, F(0) = 1 (без точки —
//                          F(левый край) = 0); hide — не рисовать
//   spline f' (…)        — точки задают ПРОИЗВОДНУЮ: нарисована f′, а сама
//                          функция берётся первообразной, `prim f f' 0 1 hide`.
//                          Так собираются задачи «на рисунке график f′(x)»:
//                          точки максимума f — нули f′ со сменой + на −.
//   drop -3 f            — пунктир от оси x до графика (f, f′ или F); solid
//   mark -3 f' open      — точка на графике в x = −3 (вид и размер — как у point)
//   tangent 1 f          — касательная к графику в точке x = 1 (from…to)
//   band -3 3            — отрезок оси x (по умолчанию красный, как на плакатах)
//   part f -3 1 color green bold
//                        — кусок уже нарисованной кривой другим цветом поверх
//                          неё: так показывают, где функция возрастает, а где
//                          убывает (или где она выше нуля, а где ниже)

import { buildSpline, antiderivative } from './splineCurve';
import {
  mathSvgText, measureMathSvg, mathLineMetrics, takeTrailingBold,
} from './mathSvgText';

const DEFAULT_VIEW = { xrange: [-5, 5], yrange: [-5, 5], grid: 1 };
const DEFAULT_WIDTH = 280;
const MAX_HEIGHT = 320;
// Поля холста: слева/снизу больше — там живут подписи засечек и «1».
const PAD = { l: 18, r: 14, t: 12, b: 18 };

// Строгий монохром по умолчанию (как у числовой прямой) — печатается в Ч/Б.
// Цвет включается явно модификатором `color …` (как на картинках «Решу ЕГЭ»).
const COLORS = { axis: '#1f2937', grid: '#d6dae0', label: '#374151' };
const PALETTE = {
  ink: '#1f2937', black: '#1f2937', orange: '#c8772e', blue: '#2f6fb5',
  green: '#2f7a3f', red: '#b3403a', violet: '#6d4aa8', gray: '#6b7280',
};

export const PLOT_COLORS = Object.keys(PALETTE).filter((c) => c !== 'black');

const r2 = (n) => Math.round(n * 100) / 100;
const colorOf = (name) => PALETTE[String(name || '').toLowerCase()] || PALETTE.ink;

/** «1,5» / «-2» / «1/2» → число; иначе NaN. */
export function num(tok) {
  const t = String(tok ?? '').trim().replace(/[−–—]/g, '-').replace(',', '.');
  const fm = t.replace(/\s+/g, '').match(/^(-?)(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (fm) {
    const den = Number(fm[3]);
    if (den) return (fm[1] === '-' ? -1 : 1) * (Number(fm[2]) / den);
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Число → подпись по-русски: точка → запятая, минус → «−» (U+2212). */
function fmtNum(v) {
  const s = String(Math.round(v * 1e6) / 1e6).replace('.', ',');
  return s.replace(/^-/, '−');
}

// ───────────────────────────── калькулятор f(x) ─────────────────────────────
// Безопасный разбор арифметического выражения (без eval/Function): токенизация →
// рекурсивный спуск → AST → вычисление. Поддержаны неявное умножение (2x, 3(x+1)),
// степень с правой ассоциативностью, школьные функции и константы pi/e.

const FUNCS1 = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
  ctg: (v) => 1 / Math.tan(v), cot: (v) => 1 / Math.tan(v),
  asin: Math.asin, arcsin: Math.asin, acos: Math.acos, arccos: Math.acos,
  atan: Math.atan, arctg: Math.atan, arctan: Math.atan,
  ln: Math.log, lg: Math.log10, log10: Math.log10, log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign,
};
const FUNCS2 = {
  log: (b, v) => Math.log(v) / Math.log(b), // log(основание, аргумент)
  pow: Math.pow, min: Math.min, max: Math.max, root: (n, v) => Math.pow(v, 1 / n),
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const s = String(src)
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2') // десятичная запятая (аргументы log(2,x) не задеты)
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/[·×]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(`Непонятное число «${s.slice(i, j)}»`);
      out.push({ t: 'num', v });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j += 1;
      out.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if ('+-*/^(),'.includes(ch)) { out.push({ t: ch }); i += 1; continue; }
    throw new Error(`Недопустимый символ «${ch}»`);
  }
  return out;
}

function parseTokens(toks) {
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => {
    if (toks[p] && toks[p].t === t) { p += 1; return true; }
    return false;
  };
  const expect = (t) => { if (!eat(t)) throw new Error(`Ожидалось «${t}»`); };

  const startsPrimary = () => {
    const t = peek();
    return !!t && (t.t === 'num' || t.t === 'id' || t.t === '(');
  };

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Выражение оборвалось');
    if (t.t === 'num') { p += 1; return { op: 'num', v: t.v }; }
    if (t.t === '(') { p += 1; const e = parseExpr(); expect(')'); return e; }
    if (t.t === 'id') {
      p += 1;
      const name = t.v;
      if (peek() && peek().t === '(') {
        p += 1;
        const args = [];
        if (!eat(')')) {
          args.push(parseExpr());
          while (eat(',')) args.push(parseExpr());
          expect(')');
        }
        return { op: 'call', name, args };
      }
      return { op: 'var', name };
    }
    throw new Error('Лишний символ в выражении');
  }
  function parsePower() {
    const base = parsePrimary();
    // ^ правоассоциативна, справа допускаем унарный минус: 2^-x
    if (eat('^')) return { op: '^', a: base, b: parseUnary() };
    return base;
  }
  function parseUnary() {
    if (eat('-')) return { op: 'neg', a: parseUnary() };
    if (eat('+')) return parseUnary();
    return parsePower();
  }
  function parseTerm() {
    let node = parseUnary();
    for (;;) {
      if (eat('*')) node = { op: '*', a: node, b: parseUnary() };
      else if (eat('/')) node = { op: '/', a: node, b: parseUnary() };
      else if (startsPrimary()) node = { op: '*', a: node, b: parseUnary() }; // 2x, 3(x+1)
      else return node;
    }
  }
  function parseExpr() {
    let node = parseTerm();
    for (;;) {
      if (eat('+')) node = { op: '+', a: node, b: parseTerm() };
      else if (eat('-')) node = { op: '-', a: node, b: parseTerm() };
      else return node;
    }
  }

  const ast = parseExpr();
  if (p !== toks.length) throw new Error('Лишний символ в выражении');
  return ast;
}

// Проверка имён (переменных и функций) до вычисления — чтобы конструктор мог
// показать внятную ошибку, а не «пустой график».
function validate(node) {
  if (node.op === 'var') {
    if (node.name !== 'x' && !(node.name in CONSTS)) {
      throw new Error(`Неизвестное обозначение «${node.name}» (переменная только x)`);
    }
    return;
  }
  if (node.op === 'call') {
    const n = node.args.length;
    const ok = (n === 1 && (node.name in FUNCS1 || node.name === 'log'))
      || (n === 2 && node.name in FUNCS2);
    if (!ok) throw new Error(`Неизвестная функция «${node.name}» от ${n} арг.`);
    node.args.forEach(validate);
    return;
  }
  if (node.a) validate(node.a);
  if (node.b) validate(node.b);
}

function evalNode(node, x) {
  switch (node.op) {
    case 'num': return node.v;
    case 'var': return node.name === 'x' ? x : CONSTS[node.name];
    case 'neg': return -evalNode(node.a, x);
    case '+': return evalNode(node.a, x) + evalNode(node.b, x);
    case '-': return evalNode(node.a, x) - evalNode(node.b, x);
    case '*': return evalNode(node.a, x) * evalNode(node.b, x);
    case '/': return evalNode(node.a, x) / evalNode(node.b, x);
    case '^': return Math.pow(evalNode(node.a, x), evalNode(node.b, x));
    case 'call': {
      const args = node.args.map((a) => evalNode(a, x));
      if (args.length === 1) {
        if (node.name === 'log') return Math.log(args[0]); // log(x) = ln x
        return FUNCS1[node.name](args[0]);
      }
      return FUNCS2[node.name](args[0], args[1]);
    }
    default: return NaN;
  }
}

/**
 * Скомпилировать выражение f(x) в функцию. Без eval — только свой разбор.
 * @returns {{fn: ((x:number)=>number)|null, error: string|null}}
 */
export function compileExpr(src) {
  const text = String(src ?? '').trim().replace(/^y\s*=\s*/i, '').replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '');
  if (!text) return { fn: null, error: 'Пустая формула' };
  try {
    const ast = parseTokens(tokenize(text));
    validate(ast);
    return {
      fn: (x) => {
        const v = evalNode(ast, x);
        return typeof v === 'number' ? v : NaN;
      },
      error: null,
    };
  } catch (e) {
    return { fn: null, error: e.message || 'Ошибка в формуле' };
  }
}

// ───────────────────────────────── парсер DSL ───────────────────────────────

// Вырезает из хвоста команды модификаторы (color/dash/from…to/width) и
// возвращает остаток строки + разобранные модификаторы.
// `range: true` разрешает одностороннее «from A» / «to B» — показать хвост
// графика без правой (левой) границы. Только для команд линий: в тексте подписи
// «\to 5» тоже похоже на границу, и вырезать его оттуда нельзя.
function extractMods(rest, { range = false } = {}) {
  const mods = {};
  let s = String(rest || '');
  s = s.replace(/\bcolor\s+([a-zA-Zа-яА-Я]+)/i, (_, c) => { mods.color = c.toLowerCase(); return ' '; });
  s = s.replace(/\bfrom\s+(\S+)\s+to\s+(\S+)/i, (_, a, b) => {
    const fa = num(a); const fb = num(b);
    if (Number.isFinite(fa) && Number.isFinite(fb)) mods.from = Math.min(fa, fb);
    if (Number.isFinite(fa) && Number.isFinite(fb)) mods.to = Math.max(fa, fb);
    return ' ';
  });
  if (range) {
    const edge = (word, key) => {
      s = s.replace(new RegExp(`\\b${word}\\s+(-?[\\d.,/]+)(?=\\s|$)`, 'i'), (_, v) => {
        const n = num(v);
        if (Number.isFinite(n)) mods[key] = n;
        return ' ';
      });
    };
    edge('from', 'from');
    edge('to', 'to');
  }
  s = s.replace(/\bdash\b/i, () => { mods.dash = true; return ' '; });
  s = s.replace(/\bside\s+(left|right)\b/i, (_, v) => { mods.side = v.toLowerCase(); return ' '; });
  s = s.replace(
    /\bat\s+(up-right|up-left|down-right|down-left|ne|nw|se|sw|up|down|left|right|n|s|e|w)\b(?:\s+(\d+(?:[.,]\d+)?))?/i,
    (_, v, d) => {
      mods.at = LABEL_DIRS[v.toLowerCase()];
      if (d !== undefined) mods.atDist = labelDist(d);
      return ' ';
    },
  );
  return { rest: s.trim(), mods };
}

// Куда сдвинуть подпись относительно её точки. Компас (ne = справа сверху) +
// человеческие синонимы, чтобы DSL читался и без шпаргалки.
const LABEL_DIRS = {
  ne: 'ne', nw: 'nw', se: 'se', sw: 'sw', n: 'n', s: 's', e: 'e', w: 'w',
  up: 'n', down: 's', left: 'w', right: 'e',
  'up-right': 'ne', 'up-left': 'nw', 'down-right': 'se', 'down-left': 'sw',
};
export const LABEL_PLACEMENTS = ['ne', 'n', 'nw', 'w', 'sw', 's', 'se', 'e'];
export const DEFAULT_LABEL_AT = 'ne';
export const DEFAULT_LABEL_DIST = 1;

/** Множитель расстояния подписи от точки: 1 — вплотную, 5 — на пол-окна. */
export function labelDist(v) {
  const d = num(v);
  if (!Number.isFinite(d) || d <= 0) return DEFAULT_LABEL_DIST;
  return Math.min(Math.max(d, 0.5), 5);
}

// Вид точки и её размер. Кружок (закрашенный/выколотый) — школьная классика;
// крестик и плюсик помечают точку, не закрывая собой график. Размер отвечает
// за «жирность»: тот же кружок мелким не спорит с линией, крупным виден на
// проекторе. Токены идут в любом порядке: `point 1 3 open small`.
const POINT_STYLE_ALIAS = {
  fill: 'fill', filled: 'fill', dot: 'fill',
  open: 'open', hollow: 'open', o: 'open',
  cross: 'cross', x: 'cross',
  plus: 'plus',
};
const POINT_SIZE_ALIAS = { small: 'small', thin: 'small', normal: 'normal', big: 'big', bold: 'big' };
const POINT_GEOM = {
  small: { r: 2.3, sw: 1.1 },
  normal: { r: 3.3, sw: 1.4 },
  big: { r: 4.6, sw: 1.8 },
};
export const POINT_STYLES = ['fill', 'open', 'cross', 'plus'];
export const POINT_SIZES = ['small', 'normal', 'big'];

/** Токены хвоста команды point/mark → { style, size } с умолчаниями. */
export function pointLook(tokens) {
  const look = { style: 'fill', size: 'normal' };
  for (const tok of tokens || []) {
    const t = String(tok || '').toLowerCase();
    if (POINT_STYLE_ALIAS[t]) look.style = POINT_STYLE_ALIAS[t];
    else if (POINT_SIZE_ALIAS[t]) look.size = POINT_SIZE_ALIAS[t];
  }
  return look;
}

// Флаг-слово в хвосте команды (bold, hide, solid, open). Только для команд, где
// он что-то значит: в тексте подписи слово «bold» должно остаться текстом.
function takeFlag(s, word) {
  const re = new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'i');
  return re.test(s) ? { s: s.replace(re, ' ').trim(), has: true } : { s, has: false };
}

/**
 * Разбить DSL на команды: перевод строки и «;», но не «;» внутри скобок —
 * точку кривой по-русски пишут «(-3; 2)».
 */
export function splitPlotCommands(spec) {
  const out = [];
  let cur = '';
  let depth = 0;
  for (const ch of String(spec || '')) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(depth - 1, 0);
    if (ch === '\n' || (ch === ';' && depth === 0)) {
      out.push(cur);
      cur = '';
      if (ch === '\n') depth = 0;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Имя кривой: f, g, F… и со штрихом — `spline f' (…)` значит «точки задают
// ПРОИЗВОДНУЮ»: сама функция получается первообразной (`prim f f'`), а её
// экстремумы читаются по нулям нарисованной кривой. Так собраны задачи ЕГЭ
// «на рисунке изображён график производной».
const REF_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*'{0,2}$/;
// Штрих производной пишут чем угодно: f', f′, f’.
const normRef = (tok) => String(tok || '').replace(/[′’‘`´]/g, "'");
/** Имя без штрихов: f' → f. */
export const baseCurveName = (name) => normRef(name).replace(/'+$/, '');

/**
 * Опорные точки кривой: «(x y [flat] [slope K])…» или пары чисел подряд.
 * @returns {{nodes: Array, error: string|null}}
 */
export function parseSplineNodes(text) {
  const src = String(text || '').trim();
  const groups = [...src.matchAll(/\(([^()]*)\)/g)].map((mm) => mm[1]);
  const nodes = [];
  if (groups.length) {
    for (const g of groups) {
      // «;» и «, » — разделители координат; «0,5» — десятичная запятая.
      const toks = g.replace(/;|,(?=\s)/g, ' ').split(/\s+/).filter(Boolean);
      const x = num(toks[0]); const y = num(toks[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { nodes: [], error: `Непонятная точка «(${g.trim()})»` };
      }
      const node = { x, y };
      for (let k = 2; k < toks.length; k += 1) {
        const t = toks[k].toLowerCase();
        if (t === 'flat') node.flat = true;
        else if (t === 'slope' || t === 'k') {
          const s = num(toks[k + 1]);
          if (Number.isFinite(s)) { node.slope = s; k += 1; }
        }
      }
      nodes.push(node);
    }
  } else if (src) {
    const nums = src.split(/\s+/).map(num);
    if (nums.some((v) => !Number.isFinite(v)) || nums.length % 2) {
      return { nodes: [], error: 'Точки кривой пишутся парами: (x y) (x y) …' };
    }
    for (let k = 0; k < nums.length; k += 2) nodes.push({ x: nums[k], y: nums[k + 1] });
  }
  if (nodes.length < 2) return { nodes, error: 'Нужны хотя бы две точки кривой' };
  return { nodes, error: null };
}

const CURVE_CMDS = new Set(['spline', 'curve', 'deriv', 'prim', 'tangent', 'drop', 'mark', 'band', 'part']);
// Пустой токен — «числа нет», а не ноль (num('') === 0).
const optNum = (tok) => (tok == null || tok === '' ? NaN : num(tok));

/**
 * Одна команда кривых (spline/deriv/prim/tangent/drop/mark/band) → описание
 * без вычислений. Им пользуются и отрисовка (parseCoordPlot), и конструктор
 * (specToPlotState) — поэтому синтаксис разбирается ровно в одном месте.
 * @returns {object|null} null — не команда кривых или она неполная
 */
export function parseCurveCommand(line) {
  const text = String(line || '').trim();
  const head = text.split(/\s+/)[0] || '';
  const cmd = head.toLowerCase();
  if (!CURVE_CMDS.has(cmd)) return null;
  const { rest: tail, mods } = extractMods(text.slice(head.length), { range: true });
  let rest = tail;
  const flag = (word) => {
    const r = takeFlag(rest, word);
    rest = r.s;
    return r.has;
  };
  const style = () => ({
    color: mods.color || null, dash: !!mods.dash, bold: flag('bold'), from: mods.from, to: mods.to,
  });

  if (cmd === 'spline' || cmd === 'curve') {
    const st = style();
    const hide = flag('hide');
    const first = rest.split(/\s+/)[0] || '';
    const named = REF_NAME_RE.test(normRef(first));
    const { nodes, error } = parseSplineNodes(named ? rest.slice(first.length) : rest);
    return { cmd: 'spline', name: named ? normRef(first) : 'f', nodes, error, hide, ...st };
  }
  if (cmd === 'deriv') {
    const st = style();
    // Штрих в имени значим: `deriv f` → f′, `deriv f'` → f″.
    const name = normRef(rest.split(/\s+/)[0]);
    return REF_NAME_RE.test(name) ? { cmd, name, ...st } : null;
  }
  if (cmd === 'prim') {
    const st = style();
    const hide = flag('hide');
    const parts = rest.split(/\s+/).filter(Boolean);
    const name = normRef(parts[0]);
    const src = normRef(parts[1]);
    if (!REF_NAME_RE.test(name || '') || !REF_NAME_RE.test(src || '')) {
      return { cmd, error: 'prim: нужно «prim F f» — имя первообразной и имя кривой' };
    }
    return { cmd, name, src, x0: optNum(parts[2]), y0: optNum(parts[3]), hide, ...st };
  }
  if (cmd === 'tangent') {
    const st = style();
    const parts = rest.split(/\s+/).filter(Boolean);
    const x = optNum(parts[0]);
    return Number.isFinite(x) && parts[1] ? { cmd, x, ref: normRef(parts[1]), ...st } : null;
  }
  if (cmd === 'drop' || cmd === 'mark') {
    const solid = flag('solid'); // только для drop: сплошная выноска вместо пунктира
    const parts = rest.split(/\s+/).filter(Boolean);
    const x = optNum(parts[0]);
    if (!Number.isFinite(x) || !parts[1]) return null;
    return {
      cmd, x, ref: normRef(parts[1]), color: mods.color || null, solid, ...pointLook(parts.slice(2)),
    };
  }
  // Кусок уже нарисованной кривой другим цветом: `part f -3 1 color green bold`.
  // Рисуется поверх неё, поэтому по умолчанию жирный и красный — как выделение
  // маркером на доске.
  if (cmd === 'part') {
    const st = style();
    const parts = rest.split(/\s+/).filter(Boolean);
    const ref = normRef(parts[0] || '');
    const a = Number.isFinite(optNum(parts[1])) ? optNum(parts[1]) : st.from;
    const b = Number.isFinite(optNum(parts[2])) ? optNum(parts[2]) : st.to;
    if (!REF_NAME_RE.test(ref) || !Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
    return {
      ...st, cmd, ref, color: st.color || 'red', from: Math.min(a, b), to: Math.max(a, b),
    };
  }
  const nums = rest.split(/\s+/).filter(Boolean).map(num).filter(Number.isFinite);
  if (nums.length < 2 || nums[0] === nums[1]) return null;
  return { cmd: 'band', a: Math.min(nums[0], nums[1]), b: Math.max(nums[0], nums[1]), color: mods.color || null };
}

// Разобранная команда кривых → модель. Ссылки на кривые копятся в `deferred`
// и разрешаются после всех строк (resolveCurveRefs).
function applyCurveCommand(model, c, prims, deferred) {
  if (!c) return;
  const draw = (ref, extra = {}) => {
    const curve = {
      ref, expr: '', fn: null, error: null, color: c.color || 'ink',
      from: c.from, to: c.to, dash: !!c.dash, bold: !!c.bold, ...extra,
    };
    model.curves.push(curve);
    deferred.push({ kind: 'curve', curve });
  };
  if (c.cmd === 'spline') {
    const spline = c.error ? null : buildSpline(c.nodes);
    const error = c.error || (spline && spline.error) || null;
    if (spline && spline.ok) model.splines[c.name] = spline;
    if (error) model.errors.push(`Кривая ${c.name}: ${error}`);
    if (!c.hide) draw(c.name, { error });
  } else if (c.cmd === 'deriv') {
    draw(`${c.name}'`);
  } else if (c.cmd === 'prim') {
    if (c.error) { model.errors.push(c.error); return; }
    prims[c.name] = { src: c.src, x0: c.x0, y0: c.y0 };
    if (!c.hide) draw(c.name);
  } else if (c.cmd === 'tangent') {
    draw(c.ref, { tangentAt: c.x });
  } else if (c.cmd === 'part') {
    draw(c.ref);
  } else if (c.cmd === 'band') {
    model.bands.push({ a: c.a, b: c.b, color: c.color || 'red' });
  } else {
    deferred.push({
      kind: c.cmd, x: c.x, ref: c.ref, color: c.color, solid: c.solid, style: c.style, size: c.size,
    });
  }
}

/**
 * Разбор текстового DSL в модель координатной плоскости.
 */
export function parseCoordPlot(spec) {
  const model = {
    xrange: [...DEFAULT_VIEW.xrange],
    yrange: [...DEFAULT_VIEW.yrange],
    grid: DEFAULT_VIEW.grid,
    width: null,
    axisX: 'x',
    axisY: 'y',
    units: true,
    curves: [],
    vectors: [],
    points: [],
    segments: [],
    labels: [],
    xticks: [],
    yticks: [],
    bands: [],
    splines: {}, // имя → сплайн (для разбора графика и тестов)
    errors: [],
  };
  if (!spec || typeof spec !== 'string') return model;

  // Ссылки на кривые (f, f′, F) разрешаются после разбора всех строк:
  // `deriv f` может стоять выше `spline f`.
  const prims = {};
  const deferred = [];

  for (const rawLine of splitPlotCommands(spec)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toLowerCase();

    if (cmd === 'x' || cmd === 'xrange') {
      const a = num(p[1]); const b = num(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) model.xrange = [a, b];
    } else if (cmd === 'y' || cmd === 'yrange') {
      const a = num(p[1]); const b = num(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) model.yrange = [a, b];
    } else if (cmd === 'grid') {
      const t = String(p[1] || '').toLowerCase();
      if (t === 'off' || t === 'no' || t === '0') model.grid = 0;
      else { const g = num(p[1]); if (Number.isFinite(g) && g > 0) model.grid = g; }
    } else if (cmd === 'size' || cmd === 'width') {
      const w = num(p[1]);
      if (Number.isFinite(w) && w >= 80) model.width = Math.min(w, 900);
    } else if (cmd === 'axis') {
      if (p[1]) model.axisX = p[1];
      if (p[2]) model.axisY = p[2];
    } else if (cmd === 'units') {
      model.units = !/^(off|no|0|false)$/i.test(p[1] || '');
    } else if (cmd === 'f' || cmd === 'plot' || cmd === 'func') {
      const { rest: tail, mods } = extractMods(line.slice(p[0].length), { range: true });
      const { s: rest, has: bold } = takeFlag(tail, 'bold');
      const { fn, error } = compileExpr(rest);
      model.curves.push({
        expr: rest, fn, error, color: mods.color || 'ink',
        from: mods.from, to: mods.to, dash: !!mods.dash, bold,
      });
    } else if (CURVE_CMDS.has(cmd)) {
      applyCurveCommand(model, parseCurveCommand(line), prims, deferred);
    } else if (cmd === 'vec' || cmd === 'vector') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const { parts, bold } = takeTrailingBold(rest.split(/\s+/).filter(Boolean), 2);
      // Первый токен — подпись, если он не число: «vec a 1 4 3 1» / «vec 1 4 3 1»
      const label = Number.isFinite(num(parts[0])) ? '' : (parts.shift() || '');
      const nums = parts.map(num).filter(Number.isFinite);
      let coords = null;
      if (nums.length >= 4) coords = nums.slice(0, 4);
      else if (nums.length === 2) coords = [0, 0, nums[0], nums[1]]; // из начала координат
      if (coords) {
        model.vectors.push({
          label, x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3],
          color: mods.color || 'ink', side: mods.side || 'left', dash: !!mods.dash, bold,
        });
      }
    } else if (cmd === 'point' || cmd === 'dot') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const parts = rest.split(/\s+/).filter(Boolean);
      const x = num(parts[0]); const y = num(parts[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        model.points.push({ x, y, ...pointLook(parts.slice(2)), color: mods.color || 'ink' });
      }
    } else if (cmd === 'seg' || cmd === 'segment') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      const nums = rest.split(/\s+/).map(num).filter(Number.isFinite);
      if (nums.length >= 4) {
        model.segments.push({
          x1: nums[0], y1: nums[1], x2: nums[2], y2: nums[3],
          color: mods.color || 'ink', dash: !!mods.dash,
        });
      }
    } else if (cmd === 'label' || cmd === 'text') {
      const { rest, mods } = extractMods(line.slice(p[0].length));
      // keep = 3: две координаты и хотя бы одно слово текста, иначе «label 1 1
      // bold» осталось бы вовсе без подписи.
      const { parts, bold } = takeTrailingBold(rest.split(/\s+/).filter(Boolean), 3);
      const x = num(parts[0]); const y = num(parts[1]);
      // Текст подписи — всё, что осталось после координат: это формула
      // (подмножество LaTeX), пробелы в ней значимы.
      const text = parts.slice(2).join(' ');
      if (Number.isFinite(x) && Number.isFinite(y) && text) {
        model.labels.push({
          x, y, text, color: mods.color || 'ink', bold,
          at: mods.at || DEFAULT_LABEL_AT, dist: mods.atDist || DEFAULT_LABEL_DIST,
        });
      }
    } else if (cmd === 'xtick' || cmd === 'ytick') {
      const { parts, bold } = takeTrailingBold(
        line.slice(p[0].length).trim().split(/\s+/).filter(Boolean), 1,
      );
      const v = num(parts[0]);
      if (Number.isFinite(v)) {
        const label = parts.slice(1).join(' ') || fmtNum(v);
        (cmd === 'xtick' ? model.xticks : model.yticks).push({ v, label, bold });
      }
    }
  }

  resolveCurveRefs(model, prims, deferred);
  return model;
}

// Имя → { fn, dfn, domain }: f и f′ у каждой кривой, F и F′ = f у первообразной.
function curveRefs(splines, prims) {
  const refs = new Map();
  for (const [name, s] of Object.entries(splines)) {
    refs.set(name, { fn: s.f, dfn: s.df, domain: s.domain });
    refs.set(`${name}'`, { fn: s.df, dfn: s.d2f, domain: s.domain });
  }
  for (const [name, pr] of Object.entries(prims)) {
    const s = splines[pr.src];
    if (!s || refs.has(name)) continue;
    const { fn } = antiderivative(s, pr.x0, pr.y0);
    refs.set(name, { fn, dfn: s.f, domain: s.domain });
    refs.set(`${name}'`, { fn: s.f, dfn: s.df, domain: s.domain });
  }
  return refs;
}

function resolveCurveRefs(model, prims, deferred) {
  if (!deferred.length) return;
  const refs = curveRefs(model.splines, prims);
  const missing = (ref) => {
    const msg = `Не найдена кривая «${ref}»`;
    if (!model.errors.includes(msg)) model.errors.push(msg);
    return msg;
  };

  for (const item of deferred) {
    if (item.kind === 'curve') {
      const c = item.curve;
      if (c.error) continue; // кривая с битыми точками — ошибка уже записана
      const r = refs.get(c.ref);
      if (!r) { c.error = missing(c.ref); continue; }
      if (Number.isFinite(c.tangentAt)) {
        const y0 = r.fn(c.tangentAt);
        const k = r.dfn(c.tangentAt);
        if (!Number.isFinite(y0) || !Number.isFinite(k)) {
          c.error = `Точка x = ${fmtNum(c.tangentAt)} вне кривой «${c.ref}»`;
          model.errors.push(c.error);
          continue;
        }
        c.fn = (x) => y0 + k * (x - c.tangentAt);
        c.slope = k;
        continue;
      }
      c.fn = r.fn;
      // Рисуем ровно по области кривой: выборка графика попадает в её концы.
      c.from = Number.isFinite(c.from) ? Math.max(c.from, r.domain[0]) : r.domain[0];
      c.to = Number.isFinite(c.to) ? Math.min(c.to, r.domain[1]) : r.domain[1];
      continue;
    }
    const r = refs.get(item.ref);
    if (!r) { missing(item.ref); continue; }
    const y = r.fn(item.x);
    if (!Number.isFinite(y)) continue;
    if (item.kind === 'drop') {
      model.segments.push({
        ref: item.ref, x1: item.x, y1: 0, x2: item.x, y2: y,
        color: item.color || 'ink', dash: !item.solid, thin: true,
      });
    } else {
      model.points.push({
        ref: item.ref, x: item.x, y, color: item.color || 'ink',
        style: item.style || 'fill', size: item.size || 'normal',
      });
    }
  }
}

// ─────────────────────────────────── рендер ─────────────────────────────────

// Сдвиг подписи (в px) относительно её точки + выключка. Вертикаль считана «на
// глаз» под font-size 12: −6 поднимает базовую линию над кружком, +11 опускает
// под него. `base` — поправка выравнивания по высоте строки, она НЕ тянется
// расстоянием (иначе «слева» с отступом 3 уползало бы вниз), масштабируются
// только dx/dy. dominant-baseline не используем — он капризен в печати и старых
// конвертерах SVG.
const LABEL_OFFSETS = {
  ne: { dx: 6, dy: -6, base: 0, anchor: 'start' },
  n: { dx: 0, dy: -8, base: 0, anchor: 'middle' },
  nw: { dx: -6, dy: -6, base: 0, anchor: 'end' },
  w: { dx: -8, dy: 0, base: 4, anchor: 'end' },
  sw: { dx: -6, dy: 11, base: 4, anchor: 'end' },
  s: { dx: 0, dy: 13, base: 4, anchor: 'middle' },
  se: { dx: 6, dy: 11, base: 4, anchor: 'start' },
  e: { dx: 8, dy: 0, base: 4, anchor: 'start' },
};

// Выключка подписи по вертикали. Обычная строка стоит там же, где стояла до
// появления формул (LABEL_OFFSETS выверены под кегль 12), а дробь или корень
// дополнительно отодвигаются на то, чем они торчат за пределы строки — иначе
// числитель наезжает на точку, к которой подпись относится.
function labelBase(at, text, bold) {
  const { ascent, descent } = measureMathSvg(text, { size: 12, bold });
  const line = mathLineMetrics(12);
  const overAsc = Math.max(0, ascent - line.ascent);
  const overDesc = Math.max(0, descent - line.descent);
  if (at.dy < 0) return at.base - overDesc; // подпись сверху — поднимаем
  if (at.dy > 0) return at.base + overAsc; // снизу — опускаем
  return at.base + (overAsc - overDesc) / 2; // сбоку — центрируем
}

// Подпись засечки на оси X: высокой формуле (дробь) нужен зазор от оси.
function tickDrop(t, size) {
  const { ascent } = measureMathSvg(t.label, { size, bold: t.bold });
  return Math.max(0, ascent - mathLineMetrics(size).ascent);
}

// Подпись засечки на оси Y стоит по центру строки засечки.
function tickMiddle(t, size) {
  const { ascent, descent } = measureMathSvg(t.label, { size, bold: t.bold });
  return (ascent - descent) / 2;
}

// Треугольная стрелка остриём в (x,y) вдоль единичного вектора (ux,uy).
function arrowHead(x, y, ux, uy, color, len = 7, half = 3.1) {
  const bx = x - ux * len; const by = y - uy * len;
  const px = -uy * half; const py = ux * half;
  return `<path d="M${r2(x)},${r2(y)} L${r2(bx + px)},${r2(by + py)} L${r2(bx - px)},${r2(by - py)} Z" fill="${color}"/>`;
}

// Подпись вектора: формула + стрелочка над ней (аналог \vec{a}). Ширину
// стрелки берём у самой подписи — она может быть и «a», и «F_1».
function vecLabel(text, cx, cy, color, bold) {
  const { width } = measureMathSvg(text, { size: 12, bold });
  const barY = cy - 10.5;
  const x0 = cx - width / 2;
  return [
    mathSvgText(text, {
      x: cx, y: cy, size: 12, color, anchor: 'middle', bold,
    }),
    `<line x1="${r2(x0)}" y1="${r2(barY)}" x2="${r2(x0 + width - 1)}" y2="${r2(barY)}" stroke="${color}" stroke-width="1"/>`,
    arrowHead(x0 + width + 0.3, barY, 1, 0, color, 3.2, 1.6),
  ].join('');
}

/**
 * Построить SVG-строку координатной плоскости по модели.
 */
/**
 * Геометрия холста: размеры и перевод «координаты ↔ пиксели viewBox».
 * Её же берёт интерактивный холст конструктора, чтобы клик попадал ровно
 * туда, куда рисует coordPlotSvg.
 */
export function plotGeometry(model, opts = {}) {
  const m = model || parseCoordPlot('');
  const [x0, x1] = m.xrange || DEFAULT_VIEW.xrange;
  const [y0, y1] = m.yrange || DEFAULT_VIEW.yrange;
  const spanX = (x1 - x0) || 1;
  const spanY = (y1 - y0) || 1;

  // Клетка квадратная: один и тот же масштаб по обеим осям (иначе векторы врут).
  const wantW = opts.width || m.width || DEFAULT_WIDTH;
  const maxH = opts.maxHeight || MAX_HEIGHT;
  let cell = (wantW - PAD.l - PAD.r) / spanX;
  if (PAD.t + PAD.b + spanY * cell > maxH) cell = (maxH - PAD.t - PAD.b) / spanY;
  cell = Math.max(cell, 4);
  return {
    x0, x1, y0, y1, cell,
    W: Math.round(PAD.l + PAD.r + spanX * cell),
    H: Math.round(PAD.t + PAD.b + spanY * cell),
    sx: (v) => PAD.l + (v - x0) * cell,
    sy: (v) => PAD.t + (y1 - v) * cell,
    fromScreen: (px, py) => ({ x: x0 + (px - PAD.l) / cell, y: y1 - (py - PAD.t) / cell }),
  };
}

export function coordPlotSvg(model, opts = {}) {
  const m = model || parseCoordPlot('');
  const {
    x0, x1, y0, y1, W, H, sx, sy,
  } = plotGeometry(m, opts);
  const inX = 0 >= x0 && 0 <= x1;
  const inY = 0 >= y0 && 0 <= y1;
  // Если начало координат вне окна — ось прижимаем к краю, картинка остаётся читаемой.
  const axisX0 = sy(Math.min(Math.max(0, y0), y1)); // экранный Y горизонтальной оси
  const axisY0 = sx(Math.min(Math.max(0, x0), x1)); // экранный X вертикальной оси

  const parts = [];

  // 1) Клетка
  if (m.grid > 0) {
    const g = m.grid;
    for (let v = Math.ceil(x0 / g) * g; v <= x1 + 1e-9; v += g) {
      const px = r2(sx(v));
      parts.push(`<line x1="${px}" y1="${r2(PAD.t)}" x2="${px}" y2="${r2(H - PAD.b)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    }
    for (let v = Math.ceil(y0 / g) * g; v <= y1 + 1e-9; v += g) {
      const py = r2(sy(v));
      parts.push(`<line x1="${r2(PAD.l)}" y1="${py}" x2="${r2(W - PAD.r)}" y2="${py}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    }
  }

  // 2) Оси со стрелками и буквами
  parts.push(`<line x1="${r2(PAD.l)}" y1="${r2(axisX0)}" x2="${r2(W - PAD.r + 4)}" y2="${r2(axisX0)}" stroke="${COLORS.axis}" stroke-width="1.4"/>`);
  parts.push(arrowHead(W - PAD.r + 4, axisX0, 1, 0, COLORS.axis));
  parts.push(mathSvgText(m.axisX || 'x', {
    x: W - 1, y: axisX0 + 12, size: 12, color: COLORS.axis, anchor: 'end',
  }));

  parts.push(`<line x1="${r2(axisY0)}" y1="${r2(H - PAD.b)}" x2="${r2(axisY0)}" y2="${r2(PAD.t - 4)}" stroke="${COLORS.axis}" stroke-width="1.4"/>`);
  parts.push(arrowHead(axisY0, PAD.t - 4, 0, -1, COLORS.axis));
  parts.push(mathSvgText(m.axisY || 'y', {
    x: axisY0 - 5, y: PAD.t + 2, size: 12, color: COLORS.axis, anchor: 'end',
  }));

  // 3) Единичные отрезки и начало координат (как на бланках «Решу ЕГЭ»)
  const xtickAt = new Set(m.xticks.map((t) => t.v));
  const ytickAt = new Set(m.yticks.map((t) => t.v));
  if (m.units) {
    if (inY && 1 >= x0 && 1 <= x1 && !xtickAt.has(1)) {
      parts.push(mathSvgText('1', {
        x: sx(1), y: axisX0 + 13, size: 11, color: COLORS.label, anchor: 'middle',
      }));
    }
    if (inX && 1 >= y0 && 1 <= y1 && !ytickAt.has(1)) {
      parts.push(mathSvgText('1', {
        x: axisY0 - 5, y: sy(1) + 4, size: 11, color: COLORS.label, anchor: 'end',
      }));
    }
    // Буква «O» стоит слева-снизу от начала координат — ровно там, где
    // оказывается подпись засечки в нуле или в −1. Подпись важнее (это данные
    // задачи, а не оформление), поэтому в таком соседстве «O» не рисуем.
    const labelNearOrigin = m.xticks.some((t) => t.label && t.v <= 0 && t.v >= -1);
    if (inX && inY && !labelNearOrigin) {
      parts.push(mathSvgText('O', {
        x: axisY0 - 4, y: axisX0 + 13, size: 11, color: COLORS.label, anchor: 'end',
      }));
    }
  }

  // 4) Явные засечки с подписями
  for (const t of m.xticks) {
    if (t.v < x0 || t.v > x1) continue;
    const px = r2(sx(t.v));
    parts.push(`<line x1="${px}" y1="${r2(axisX0 - 3)}" x2="${px}" y2="${r2(axisX0 + 3)}" stroke="${COLORS.axis}" stroke-width="1.2"/>`);
    parts.push(mathSvgText(t.label, {
      x: px, y: axisX0 + 13 + tickDrop(t, 11), size: 11, color: COLORS.label,
      anchor: 'middle', bold: t.bold,
    }));
  }
  for (const t of m.yticks) {
    if (t.v < y0 || t.v > y1) continue;
    const py = r2(sy(t.v));
    parts.push(`<line x1="${r2(axisY0 - 3)}" y1="${py}" x2="${r2(axisY0 + 3)}" y2="${py}" stroke="${COLORS.axis}" stroke-width="1.2"/>`);
    parts.push(mathSvgText(t.label, {
      x: axisY0 - 5, y: py + tickMiddle(t, 11), size: 11, color: COLORS.label,
      anchor: 'end', bold: t.bold,
    }));
  }

  // 4б) Отрезки оси x — промежуток (a; b) поверх оси, под графиками
  for (const b of m.bands || []) {
    const a = Math.max(b.a, x0); const z = Math.min(b.b, x1);
    if (!(z > a)) continue;
    parts.push(`<line x1="${r2(sx(a))}" y1="${r2(axisX0)}" x2="${r2(sx(z))}" y2="${r2(axisX0)}" stroke="${colorOf(b.color)}" stroke-width="2.6"/>`);
  }

  // 5) Графики функций
  for (const c of m.curves) {
    if (!c.fn) continue;
    const d = curvePath(c, { x0, x1, y0, y1, sx, sy });
    if (!d) continue;
    const dash = c.dash ? ' stroke-dasharray="5 4"' : '';
    parts.push(`<path d="${d}" fill="none" stroke="${colorOf(c.color)}" stroke-width="${c.bold ? 2.4 : 1.7}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  }

  // 6) Отрезки (тонкие — выноски от оси к графику)
  for (const s of m.segments) {
    const dash = s.dash ? ` stroke-dasharray="${s.thin ? '4 3' : '5 4'}"` : '';
    parts.push(`<line x1="${r2(sx(s.x1))}" y1="${r2(sy(s.y1))}" x2="${r2(sx(s.x2))}" y2="${r2(sy(s.y2))}" stroke="${colorOf(s.color)}" stroke-width="${s.thin ? 1 : 1.5}"${dash}/>`);
  }

  // 7) Векторы: линия + стрелка + подпись со стрелочкой сверху
  for (const v of m.vectors) {
    const col = colorOf(v.color);
    const ax = sx(v.x1); const ay = sy(v.y1);
    const bx = sx(v.x2); const by = sy(v.y2);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len; const uy = (by - ay) / len;
    const dash = v.dash ? ' stroke-dasharray="5 4"' : '';
    // Линию не доводим до острия — иначе стрелка выглядит «раздутой».
    const tipBack = Math.min(6, len * 0.5);
    parts.push(`<line x1="${r2(ax)}" y1="${r2(ay)}" x2="${r2(bx - ux * tipBack)}" y2="${r2(by - uy * tipBack)}" stroke="${col}" stroke-width="1.7"${dash}/>`);
    parts.push(arrowHead(bx, by, ux, uy, col, 8, 3.4));
    if (v.label) {
      const sgn = v.side === 'right' ? -1 : 1;
      const nx = -uy * sgn; const ny = ux * sgn; // нормаль к вектору
      parts.push(vecLabel(v.label, (ax + bx) / 2 + nx * 13, (ay + by) / 2 + ny * 13 + 4, col, v.bold));
    }
  }

  // 8) Точки и подписи
  for (const pt of m.points) {
    const g = POINT_GEOM[pt.size] || POINT_GEOM.normal;
    const cx = r2(sx(pt.x)); const cy = r2(sy(pt.y));
    const col = colorOf(pt.color);
    if (pt.style === 'cross' || pt.style === 'plus') {
      // Крестик и плюсик не закрывают собой линию — ими помечают точку на графике.
      const a = r2(g.r * 1.3);
      const d = pt.style === 'cross'
        ? `M${r2(cx - a)},${r2(cy - a)}L${r2(cx + a)},${r2(cy + a)}M${r2(cx - a)},${r2(cy + a)}L${r2(cx + a)},${r2(cy - a)}`
        : `M${r2(cx - a)},${cy}L${r2(cx + a)},${cy}M${cx},${r2(cy - a)}L${cx},${r2(cy + a)}`;
      parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${r2(g.sw + 0.2)}" stroke-linecap="round"/>`);
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${g.r}" fill="${pt.style === 'open' ? '#fff' : col}" stroke="${col}" stroke-width="${g.sw}"/>`);
    }
  }
  for (const l of m.labels) {
    const at = LABEL_OFFSETS[l.at] || LABEL_OFFSETS[DEFAULT_LABEL_AT];
    const k = labelDist(l.dist);
    const lx = sx(l.x) + at.dx * k;
    const ly = sy(l.y) + at.dy * k + labelBase(at, l.text, l.bold);
    parts.push(mathSvgText(l.text, {
      x: lx, y: ly, size: 12, color: colorOf(l.color), anchor: at.anchor, bold: l.bold,
    }));
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" class="coordplot-svg" role="img">${parts.join('')}</svg>`;
}

/**
 * Путь графика: плотная выборка + аналитическая обрезка по окну Y.
 * Разрывы (асимптоты, вне области определения) рвут путь на подпути «M…L…».
 */
function curvePath(curve, { x0, x1, y0, y1, sx, sy }) {
  const from = Number.isFinite(curve.from) ? Math.max(curve.from, x0) : x0;
  const to = Number.isFinite(curve.to) ? Math.min(curve.to, x1) : x1;
  if (!(to > from)) return '';
  const spanY = y1 - y0;
  const N = 600;
  const step = (to - from) / N;
  const d = [];
  let open = false; // начат ли подпуть
  let prev = null;

  const moveTo = (x, y) => { d.push(`M${r2(sx(x))},${r2(sy(y))}`); open = true; };
  const lineTo = (x, y) => { d.push(`L${r2(sx(x))},${r2(sy(y))}`); };
  // Точка пересечения отрезка с горизонталью y = edge
  const cross = (p, q, edge) => {
    const t = (edge - p.y) / (q.y - p.y);
    return { x: p.x + (q.x - p.x) * t, y: edge };
  };
  const clampEdge = (y) => (y > y1 ? y1 : y0);

  for (let i = 0; i <= N; i += 1) {
    const x = i === N ? to : from + i * step;
    const y = curve.fn(x);
    const cur = Number.isFinite(y) ? { x, y } : null;
    if (!cur) { open = false; prev = null; continue; }
    if (prev) {
      const pIn = prev.y >= y0 && prev.y <= y1;
      const cIn = cur.y >= y0 && cur.y <= y1;
      const jump = Math.abs(cur.y - prev.y) > spanY * 4; // скачок через асимптоту
      if (pIn && cIn) {
        if (!open) moveTo(prev.x, prev.y);
        lineTo(cur.x, cur.y);
      } else if (pIn && !cIn) {
        if (!open) moveTo(prev.x, prev.y);
        const c = cross(prev, cur, clampEdge(cur.y));
        lineTo(c.x, c.y);
        open = false;
      } else if (!pIn && cIn) {
        const c = cross(prev, cur, clampEdge(prev.y));
        moveTo(c.x, c.y);
        lineTo(cur.x, cur.y);
      } else if (!jump && ((prev.y < y0 && cur.y > y1) || (prev.y > y1 && cur.y < y0))) {
        // Крутой участок, пересекающий всё окно насквозь
        const a = cross(prev, cur, clampEdge(prev.y));
        const b = cross(prev, cur, clampEdge(cur.y));
        moveTo(a.x, a.y);
        lineTo(b.x, b.y);
        open = false;
      } else {
        open = false;
      }
    }
    prev = cur;
  }
  return d.join('');
}

export function coordPlotSvgFromSpec(spec, opts) {
  return coordPlotSvg(parseCoordPlot(spec), opts);
}

// ─────────────────────────── сериализация конструктора ──────────────────────

const numToken = (v) => {
  const s = String(v ?? '').trim().replace(/[−–—]/g, '-');
  return s === '' ? '0' : s.replace(',', '.');
};

/**
 * Состояние конструктора → текст DSL.
 * @param {{view:object, curves?:Array, vectors?:Array, points?:Array, labels?:Array}} state
 */
const atToken = (at, dist) => {
  const dir = LABEL_DIRS[String(at || '').toLowerCase()] || DEFAULT_LABEL_AT;
  const k = labelDist(dist);
  const far = k === DEFAULT_LABEL_DIST ? '' : ` ${numToken(k)}`;
  return dir === DEFAULT_LABEL_AT && !far ? '' : ` at ${dir}${far}`;
};

const hasNum = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

// Хвост модификаторов линии: color / from…to / dash / bold.
function styleTail(o, defColor = 'ink') {
  let s = '';
  if (o.color && o.color !== defColor) s += ` color ${o.color}`;
  if (hasNum(o.from) && hasNum(o.to)) s += ` from ${numToken(o.from)} to ${numToken(o.to)}`;
  else if (hasNum(o.from)) s += ` from ${numToken(o.from)}`;
  else if (hasNum(o.to)) s += ` to ${numToken(o.to)}`;
  if (o.dash) s += ' dash';
  if (o.bold) s += ' bold';
  return s;
}

// Хвост «вид и размер» точки: умолчания (закрашенная, обычная) не пишем.
const pointLookTail = (p) => {
  // `filled: false` — форма состояния до появления вида точки; держим её, чтобы
  // старый вызов конструктора не превратил выколотую точку в закрашенную.
  const legacy = p.style === undefined && p.filled === false ? 'open' : p.style;
  const style = POINT_STYLE_ALIAS[String(legacy || '').toLowerCase()] || 'fill';
  const size = POINT_SIZE_ALIAS[String(p.size || '').toLowerCase()] || 'normal';
  return `${style === 'fill' ? '' : ` ${style}`}${size === 'normal' ? '' : ` ${size}`}`;
};

const nodeToken = (n) => {
  let s = `(${numToken(n.x)} ${numToken(n.y)}`;
  if (n.flat) s += ' flat';
  if (hasNum(n.slope)) s += ` slope ${numToken(n.slope)}`;
  return `${s})`;
};

/** Точки кривой, пригодные к записи: с числами и по возрастанию x. */
export function cleanCurveNodes(nodes) {
  return (nodes || [])
    .filter((n) => hasNum(n.x) && hasNum(n.y))
    .map((n) => ({ ...n, x: Number(n.x), y: Number(n.y) }))
    .sort((a, b) => a.x - b.x);
}

// Кривые по точкам конструктора → строки spline/deriv/prim + разметка.
function curveLines(splines, annotations) {
  const lines = [];
  for (const c of splines) {
    if (!REF_NAME_RE.test(c.name || '')) continue;
    const nodes = cleanCurveNodes(c.nodes);
    lines.push(`spline ${c.name} ${nodes.map(nodeToken).join(' ')}${styleTail(c)}${c.show === false ? ' hide' : ''}`);
    if (c.deriv && c.deriv.on) lines.push(`deriv ${c.name}${styleTail(c.deriv)}`);
    if (c.prim && c.prim.on && REF_NAME_RE.test(c.prim.name || '')) {
      const at = hasNum(c.prim.x0) && hasNum(c.prim.y0) ? ` ${numToken(c.prim.x0)} ${numToken(c.prim.y0)}` : '';
      lines.push(`prim ${c.prim.name} ${c.name}${at}${styleTail(c.prim)}${c.prim.show === false ? ' hide' : ''}`);
    }
  }
  for (const a of annotations) {
    if (a.type === 'band') {
      if (hasNum(a.a) && hasNum(a.b) && Number(a.a) !== Number(a.b)) {
        lines.push(`band ${numToken(a.a)} ${numToken(a.b)}${a.color && a.color !== 'red' ? ` color ${a.color}` : ''}`);
      }
    } else if (a.type === 'part') {
      if (a.ref && hasNum(a.a) && hasNum(a.b) && Number(a.a) !== Number(a.b)) {
        // Границы куска — позиционные, поэтому from/to из стиля тут не нужны.
        lines.push(`part ${a.ref} ${numToken(a.a)} ${numToken(a.b)}${styleTail({ ...a, from: '', to: '' }, 'red')}`);
      }
    } else if (hasNum(a.x) && a.ref) {
      const color = a.color && a.color !== 'ink' ? ` color ${a.color}` : '';
      if (a.type === 'tangent') lines.push(`tangent ${numToken(a.x)} ${a.ref}${styleTail(a)}`);
      else if (a.type === 'drop') lines.push(`drop ${numToken(a.x)} ${a.ref}${color}${a.solid ? ' solid' : ''}`);
      else if (a.type === 'mark') lines.push(`mark ${numToken(a.x)} ${a.ref}${color}${pointLookTail(a)}`);
    }
  }
  return lines;
}

/**
 * Состояние конструктора → текст DSL.
 * `segments`/`xticks`/`yticks`/`raw` конструктор не редактирует — они приходят
 * из разбора готового блока (`specToPlotState`) и переписываются как есть,
 * чтобы правка подписи не стирала остальную разметку.
 */
export function plotToSpec({
  view = {}, curves = [], splines = [], annotations = [], vectors = [], points = [], labels = [],
  segments = [], xticks = [], yticks = [], raw = [],
} = {}) {
  const xr = view.xrange || DEFAULT_VIEW.xrange;
  const yr = view.yrange || DEFAULT_VIEW.yrange;
  const lines = [
    `x ${numToken(xr[0])} ${numToken(xr[1])}`,
    `y ${numToken(yr[0])} ${numToken(yr[1])}`,
  ];
  if (view.grid != null && Number(view.grid) !== 1) {
    lines.push(`grid ${Number(view.grid) > 0 ? numToken(view.grid) : 'off'}`);
  }
  if ((view.axisX && view.axisX !== 'x') || (view.axisY && view.axisY !== 'y')) {
    lines.push(`axis ${view.axisX || 'x'} ${view.axisY || 'y'}`);
  }
  if (view.units === false) lines.push('units off');
  if (view.width) lines.push(`size ${Math.round(view.width)}`);

  for (const c of curves) {
    const expr = String(c.expr || '').trim();
    if (!expr) continue;
    lines.push(`f ${expr}${styleTail(c)}`);
  }
  lines.push(...curveLines(splines, annotations));
  for (const v of vectors) {
    const label = String(v.label || '').trim();
    let s = `vec${label ? ` ${label}` : ''} ${numToken(v.x1)} ${numToken(v.y1)} ${numToken(v.x2)} ${numToken(v.y2)}`;
    if (v.color && v.color !== 'ink') s += ` color ${v.color}`;
    if (v.side === 'right') s += ' side right';
    if (v.dash) s += ' dash';
    if (v.bold) s += ' bold';
    lines.push(s);
  }
  for (const p of points) {
    // Вид пишем всегда: `point 1 3` без слова читается как закрашенная, но в
    // готовом блоке явное «fill» спасает от опечатки при правке руками.
    let s = `point ${numToken(p.x)} ${numToken(p.y)}${pointLookTail(p) || ' fill'}`;
    if (p.color && p.color !== 'ink') s += ` color ${p.color}`;
    lines.push(s);
    if (p.label) {
      lines.push(`label ${numToken(p.x)} ${numToken(p.y)} ${p.label}${atToken(p.labelAt, p.labelDist)}${p.labelBold ? ' bold' : ''}`);
    }
  }
  for (const l of labels) {
    if (l.text) lines.push(`label ${numToken(l.x)} ${numToken(l.y)} ${l.text}${atToken(l.at, l.dist)}${l.bold ? ' bold' : ''}`);
  }
  for (const g of segments) {
    let s = `seg ${numToken(g.x1)} ${numToken(g.y1)} ${numToken(g.x2)} ${numToken(g.y2)}`;
    if (g.color && g.color !== 'ink') s += ` color ${g.color}`;
    if (g.dash) s += ' dash';
    lines.push(s);
  }
  for (const [cmd, ticks] of [['xtick', xticks], ['ytick', yticks]]) {
    for (const t of ticks) {
      // Подпись по умолчанию = само число; такую не выписываем.
      const label = t.label && t.label !== fmtNum(t.v) ? ` ${t.label}` : '';
      lines.push(`${cmd} ${numToken(t.v)}${label}${t.bold ? ' bold' : ''}`);
    }
  }
  lines.push(...raw);
  return lines.join('\n');
}

// Команды, которые конструктор понимает; всё остальное (комментарии, опечатки)
// переносится в правку дословно.
const KNOWN_CMDS = new Set([
  'x', 'xrange', 'y', 'yrange', 'grid', 'size', 'width', 'axis', 'units',
  'f', 'plot', 'func', 'vec', 'vector', 'point', 'dot', 'seg', 'segment',
  'label', 'text', 'xtick', 'ytick',
]);

const exprToken = (v) => (Number.isFinite(v) ? String(v) : '');

const lineStyle = (c) => ({
  color: c.color || 'ink', bold: !!c.bold, dash: !!c.dash, from: exprToken(c.from), to: exprToken(c.to),
});

/** Пустая кривая конструктора с настройками по умолчанию. */
export function newCurveState(name = 'f', nodes = []) {
  const upper = name.toUpperCase();
  return {
    name,
    nodes,
    show: true,
    ...lineStyle({}),
    deriv: { on: false, ...lineStyle({}) },
    prim: {
      on: false, show: true, name: upper !== name ? upper : `${name}1`, x0: '', y0: '', ...lineStyle({}),
    },
  };
}

/**
 * Строки кривых (spline/deriv/prim/tangent/drop/mark/band) → кривые и разметка
 * конструктора. Чего конструктор не выразит (производная неизвестной кривой,
 * вторая первообразная, битые точки), остаётся в raw дословно.
 */
function curveState(lines) {
  const splines = [];
  const annotations = [];
  const rawAt = []; // [порядковый номер строки, строка] — порядок как в исходнике
  const parsed = [];
  lines.forEach((line, i) => {
    const c = parseCurveCommand(line);
    if (!c || c.error) rawAt.push([i, line]);
    else parsed.push({ c, line, i });
  });
  const keep = (item) => rawAt.push([item.i, item.line]);
  const byName = new Map();
  for (const item of parsed) {
    const { c } = item;
    if (c.cmd !== 'spline') continue;
    if (byName.has(c.name)) { keep(item); continue; }
    const s = newCurveState(c.name, c.nodes.map((n) => ({
      x: n.x, y: n.y, flat: !!n.flat, slope: Number.isFinite(n.slope) ? n.slope : null,
    })));
    Object.assign(s, lineStyle(c), { show: !c.hide });
    splines.push(s);
    byName.set(c.name, s);
  }
  for (const item of parsed) {
    const { c } = item;
    if (c.cmd === 'spline') continue;
    if (c.cmd === 'deriv') {
      const s = byName.get(c.name);
      if (s && !s.deriv.on) s.deriv = { on: true, ...lineStyle(c) };
      else keep(item);
    } else if (c.cmd === 'prim') {
      const s = byName.get(c.src);
      if (s && !s.prim.on && !byName.has(c.name)) {
        s.prim = {
          on: true, show: !c.hide, name: c.name, x0: exprToken(c.x0), y0: exprToken(c.y0), ...lineStyle(c),
        };
      } else keep(item);
    } else if (c.cmd === 'band') {
      annotations.push({ type: 'band', a: c.a, b: c.b, color: c.color || 'red' });
    } else if (c.cmd === 'tangent') {
      annotations.push({ type: 'tangent', x: c.x, ref: c.ref, ...lineStyle(c) });
    } else if (c.cmd === 'part') {
      annotations.push({
        type: 'part', ref: c.ref, a: c.from, b: c.to,
        color: c.color || 'red', bold: !!c.bold, dash: !!c.dash,
      });
    } else {
      annotations.push({
        type: c.cmd, x: c.x, ref: c.ref, color: c.color || 'ink', solid: !!c.solid,
        style: c.style || 'fill', size: c.size || 'normal',
      });
    }
  }
  const raw = rawAt.sort((a, b) => a[0] - b[0]).map(([, line]) => line);
  return { splines, annotations, raw };
}

/**
 * Текст DSL → состояние конструктора (обратная `plotToSpec`).
 * Подпись, стоящая ровно в точке, приклеивается к этой точке — в конструкторе
 * подпись живёт в строке точки, а не отдельной сущностью.
 */
export function specToPlotState(spec) {
  const m = parseCoordPlot(spec);
  const free = [...m.labels];
  const takeLabel = (p) => {
    const i = free.findIndex((l) => l.x === p.x && l.y === p.y);
    return i >= 0 ? free.splice(i, 1)[0] : null;
  };
  const unknown = splitPlotCommands(spec)
    .map((l) => l.trim())
    .filter((l) => l && !KNOWN_CMDS.has(l.split(/\s+/)[0].toLowerCase()));
  const curveCmd = (l) => CURVE_CMDS.has(l.split(/\s+/)[0].toLowerCase());
  const curvesPart = curveState(unknown.filter(curveCmd));

  return {
    view: {
      xrange: [...m.xrange],
      yrange: [...m.yrange],
      grid: m.grid,
      axisX: m.axisX,
      axisY: m.axisY,
      units: m.units,
      width: m.width, // null = в блоке не было `size`, не дописываем его
    },
    // Следы кривых по точкам (ref) — не формулы и не точки конструктора: они
    // живут в splines/annotations, иначе правка продублировала бы их.
    curves: m.curves.filter((c) => !c.ref).map((c) => ({
      expr: c.expr, color: c.color, dash: !!c.dash, bold: !!c.bold,
      from: exprToken(c.from), to: exprToken(c.to),
    })),
    splines: curvesPart.splines,
    annotations: curvesPart.annotations,
    vectors: m.vectors.map((v) => ({
      label: v.label, x1: v.x1, y1: v.y1, x2: v.x2, y2: v.y2,
      color: v.color, side: v.side, dash: !!v.dash, bold: !!v.bold,
    })),
    points: m.points.filter((p) => !p.ref).map((p) => {
      const l = takeLabel(p);
      return {
        x: p.x, y: p.y, style: p.style || 'fill', size: p.size || 'normal', color: p.color,
        label: l ? l.text : '',
        labelAt: l ? l.at : DEFAULT_LABEL_AT,
        labelDist: l ? l.dist : DEFAULT_LABEL_DIST,
        labelBold: l ? !!l.bold : false,
      };
    }),
    labels: free, // подписи не при точке — конструктор их не показывает, но хранит
    segments: m.segments.filter((s) => !s.ref),
    xticks: m.xticks,
    yticks: m.yticks,
    raw: [...unknown.filter((l) => !curveCmd(l)), ...curvesPart.raw],
  };
}

// ───────────────────────── пара «f′ и f рядом» ─────────────────────────

// Окно по Y под производную: её размах на видимой части кривой + поля,
// кратно клетке, ось x всегда в кадре.
function derivYRange(nodes, view) {
  const s = buildSpline(cleanCurveNodes(nodes));
  const [vx0, vx1] = view.xrange || DEFAULT_VIEW.xrange;
  const g = Number(view.grid) > 0 ? Number(view.grid) : 1;
  if (!s.ok) return [-2 * g, 2 * g];
  const a = Math.max(s.domain[0], vx0);
  const b = Math.min(s.domain[1], vx1);
  let lo = 0; let hi = 0;
  for (let k = 0; k <= 240; k += 1) {
    const v = s.df(a + ((b - a) * k) / 240);
    if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const pad = Math.max((hi - lo) * 0.12, g * 0.5);
  const y0 = Math.floor((lo - pad) / g) * g;
  const y1 = Math.ceil((hi + pad) / g) * g;
  return y1 - y0 >= 2 * g ? [y0, y1] : [y0 - g, y1 + g];
}

/**
 * Две картинки для справочника «если f′ … — то f …»: слева график
 * производной кривой, справа сама кривая. Выноски и точки на графике
 * переезжают на левую картинку уже к f′, касательная к f остаётся справа.
 * @returns {{left:string, right:string}|null}
 */
export function derivativePairSpecs(state, index = 0) {
  const c = state && state.splines && state.splines[index];
  if (!c) return null;
  const n = c.name;
  const off = { ...c.prim, on: false };
  const annotations = state.annotations || [];
  const serialize = (list) => [...new Map(list.map((a) => [JSON.stringify(a), a])).values()];

  const right = plotToSpec({
    ...state,
    splines: [{ ...c, show: true, deriv: { ...c.deriv, on: false }, prim: off }],
    annotations: annotations.filter((a) => a.type === 'band' || a.ref === n),
  });
  const leftAnn = serialize(annotations.flatMap((a) => {
    if (a.type === 'band') return [a];
    if ((a.type === 'drop' || a.type === 'mark') && (a.ref === n || a.ref === `${n}'`)) return [{ ...a, ref: `${n}'` }];
    // Касательная и цветной кусок остаются при своей кривой: кусок f′ — слева,
    // кусок самой f — справа.
    if ((a.type === 'tangent' || a.type === 'part') && a.ref === `${n}'`) return [a];
    return [];
  }));
  const deriv = c.deriv && c.deriv.on
    ? c.deriv
    : { ...lineStyle(c), from: '', to: '' };
  const left = plotToSpec({
    view: { ...state.view, yrange: derivYRange(c.nodes, state.view || {}) },
    splines: [{ ...c, show: false, deriv: { ...deriv, on: true }, prim: off }],
    annotations: leftAnn,
    points: state.points || [],
    labels: state.labels || [],
    xticks: state.xticks || [],
  });
  return { left, right };
}
