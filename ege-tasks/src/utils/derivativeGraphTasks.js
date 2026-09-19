// Задания «производная и график» (профиль №9, база №7) — чистая логика.
//
// Задача этого типа — не формула, а КАРТИНКА: график функции, её производной
// или первообразной, нарисованный по целым точкам. Поэтому задание строится
// так же, как учитель рисует его на доске: сначала «пила» из целых узлов,
// потом вопрос, ответ на который читается по этим же узлам.
//
// Правильность держится на одном: и картинку, и ответ считает ОДНА модель —
// сплайн `splineCurve.js`. Между соседними узлами он монотонен, значит
// экстремумы стоят ровно в заданных точках, нули производной — там, где их
// поставил генератор, и ответ «сколько точек максимума» не может разойтись с
// тем, что видит ученик. Ответ, который не удалось подтвердить моделью
// (например, заданный наклон касательной не выдержан), отбраковывается —
// генератор просто пробует другие числа.
//
// Три сцены:
//   'f'     — дан график функции y = f(x)      (что читается: экстремумы,
//             знаки f′, наибольшее значение, f′(x₀) по касательной);
//   'deriv' — дан график производной y = f′(x) (экстремумы и монотонность
//             самой f: они прячутся в нулях нарисованной кривой);
//   'prim'  — дан график первообразной y = F(x) (площадь под графиком f).
//
// API:
//   generateDerivativeGraphVariants(settings) → Variant[][]  (лист генератора)
//   makeGraphTask(cat)                        → одно задание или null
//   CATEGORY_LABELS_GRAPH / CATEGORY_GROUPS_GRAPH / DEFAULT_SETTINGS_GRAPH
//
// Задание: { cat, plot, question, resultLatex, answerValue, matching?, note? }
//   plot     — текст DSL координатной плоскости (`coordPlot.js`),
//   question — условие обычным текстом (формулы в $…$),
//   matching — задание на соответствие: { points: ['K','L',…], values: [tex] };
//              ответ тогда четыре цифры («2143»),
//   note     — строка под списками («Запишите в ответ цифры…»),
//   resultLatex — ответ для ключа учителя.

import {
  buildSpline, splineAnalysis, splineZeros, splineSignIntervals, integersInIntervals,
} from './splineCurve';
import { rand, randInt, chance } from './linearExpr';
import { shuffleArray } from './shuffle';
import { generateByCategories } from './questionPlan';

const EPS = 1e-6;

// Число по-русски: минус − (U+2212), десятичная запятая.
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (v) => String(Math.round(v * 1e6) / 1e6).replace('.', ',').replace(/^-/, '−');
// Ответ в ключе учителя — так же, как ученик впишет в бланк: «-3», «0,5».
// Запятая в KaTeX берётся в скобки, иначе за ней появится лишний пробел.
const ans = (v) => String(Math.round(v * 1e6) / 1e6).replace('.', '{,}');

// ───────────────────────────── случайные графики ─────────────────────────────

// Ширина окна по X. Чертёж печатается в колонку фиксированной ширины, поэтому
// чем шире окно, тем мельче клетка: при размахе 20 сетка превращается в рябь.
// Размах держим в пределах КИМовских 10–14 клеток — лишнее отбраковываем.
const MAX_SPAN_X = 13;

/**
 * Целые x-узлы: старт слева от нуля, шаги 2–4 клетки, весь график — не шире
 * `maxSpan`. Шаги режутся не отбраковкой, а бюджетом: каждому следующему
 * оставляем минимум на все оставшиеся, иначе редкие типы заданий (их сцена
 * подходит не всегда) переставали собираться вовсе.
 */
function xGrid(count, { gapMin = 2, gapMax = 4, maxSpan = MAX_SPAN_X } = {}) {
  const steps = count - 1;
  if (steps * gapMin > maxSpan) return null;
  const gaps = [];
  let budget = maxSpan;
  for (let i = 0; i < steps; i += 1) {
    const left = steps - i - 1;
    const hi = Math.min(gapMax, budget - left * gapMin);
    const g = randInt(gapMin, Math.max(gapMin, hi));
    gaps.push(g);
    budget -= g;
  }
  const span = gaps.reduce((a, b) => a + b, 0);
  // График стоит вокруг нуля, но не строго симметрично — иначе все варианты
  // на листе выглядят одинаково.
  const start = -Math.round(span / 2) + randInt(-1, 1);
  const xs = [start];
  for (const g of gaps) xs.push(xs[xs.length - 1] + g);
  return xs;
}

/**
 * График функции: «пила» с целыми вершинами. Соседние узлы отличаются не
 * меньше чем на 2 — иначе горка не читается по клеткам.
 * `flat` — добавить стационарную точку (f′ = 0 без смены знака).
 */
function waveNodes({ turns, ymax = 4, flat = false, maxSpan }) {
  const xs = xGrid(turns + 2, maxSpan ? { maxSpan } : {});
  if (!xs) return null;
  let dir = chance(0.5) ? 1 : -1;
  const ys = [randInt(-ymax, ymax)];
  for (let i = 1; i < xs.length; i += 1) {
    const prev = ys[i - 1];
    const lo = dir > 0 ? prev + 2 : -ymax;
    const hi = dir > 0 ? ymax : prev - 2;
    if (lo > hi) return null; // упёрлись в потолок — пробуем другие числа
    ys.push(randInt(lo, hi));
    dir = -dir;
  }
  const nodes = xs.map((x, i) => ({ x, y: ys[i] }));
  if (flat) {
    // Стационарную точку ставим на середине монотонного куска: там она видна
    // как «полочка», а экстремумом не становится.
    const i = randInt(0, nodes.length - 2);
    const a = nodes[i];
    const b = nodes[i + 1];
    if (b.x - a.x < 2 || Math.abs(b.y - a.y) < 2) return null;
    const x = a.x + Math.round((b.x - a.x) / 2);
    const y = Math.round((a.y + b.y) / 2);
    if (x <= a.x || x >= b.x || y === a.y || y === b.y) return null;
    nodes.splice(i + 1, 0, { x, y, flat: true });
  }
  return nodes;
}

/**
 * График производной: нули ровно в целых точках. Узлы идут «край — ноль —
 * вершина — ноль — … — край», знаки вершин чередуются, поэтому каждый ноль —
 * со сменой знака, и точки экстремума самой f читаются однозначно.
 */
function derivNodes({ zeros, ymax = 3 }) {
  // Края добавятся по бокам от крайних нулей — под них оставляем запас.
  const zs = xGrid(zeros, { gapMin: 3, gapMax: 5, maxSpan: MAX_SPAN_X - 4 });
  if (!zs) return null;
  const nodes = [];
  let sign = chance(0.5) ? 1 : -1;
  const peak = () => sign * randInt(1, ymax);

  nodes.push({ x: zs[0] - randInt(1, 3), y: peak() });
  for (let i = 0; i < zs.length; i += 1) {
    nodes.push({ x: zs[i], y: 0 });
    sign = -sign;
    const next = i < zs.length - 1 ? zs[i + 1] : zs[i] + randInt(2, 3);
    const mid = zs[i] + Math.floor((next - zs[i]) / 2);
    if (mid <= zs[i] || mid >= next) return null;
    nodes.push({ x: mid, y: peak() });
  }
  const last = nodes[nodes.length - 1];
  nodes[nodes.length - 1] = { x: last.x + randInt(1, 2), y: last.y };
  return nodes;
}

// ──────────────────────────────── сцена ────────────────────────────────

// Ширину чертежа задаёт место, куда он попал: печатный лист передаёт её пропом
// (`CoordPlotSVG width`), а в задаче после экспорта .md работает размер по
// умолчанию и масштабирование CSS. Поэтому `size` в DSL не пишем — иначе
// выгруженное задание принесло бы в чужую работу жёсткие 320 px.

/** Окно чертежа: график с полем в клетку, ось x всегда в кадре. */
function viewOf(nodes, { padX = 1, padY = 1 } = {}) {
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return {
    x0: Math.min(...xs) - padX,
    x1: Math.max(...xs) + padX,
    y0: Math.min(0, ...ys) - padY,
    y1: Math.max(0, ...ys) + padY,
  };
}

// `slopeToken` — как наклон записать в DSL: у 2/3 десятичная запись бесконечна,
// и «slope 0.6666666666666666» читалось бы как другое число.
const nodeToken = (n) => {
  const slope = n.slopeToken || (Number.isFinite(n.slope) ? String(n.slope) : '');
  return `(${n.x} ${n.y}${n.flat ? ' flat' : ''}${slope ? ` slope ${slope}` : ''})`;
};

// Подпись графика («y = f(x)») занимает примерно столько клеток в ширину:
const LABEL_W = 3;

/**
 * Куда поставить подпись графика, чтобы она не легла ни на кривую, ни на оси.
 *
 * Привязка к концу кривой не годится: у пологих графиков конец лежит у самой
 * оси. Поэтому перебираем четыре угла окна и берём тот, где до кривой и до
 * осей дальше всего. Подпись — не точка, а полоска длиной LABEL_W, так что
 * меряем от нескольких точек вдоль неё.
 */
function labelSpot(spline, v) {
  const [a, b] = spline.domain;
  const curve = [];
  for (let i = 0; i <= 120; i += 1) {
    const x = a + ((b - a) * i) / 120;
    const y = spline.f(x);
    if (Number.isFinite(y)) curve.push({ x, y });
  }
  const candidates = [
    { x: v.x0 + 0.6, y: v.y1 - 0.6, at: 'se' },
    { x: v.x1 - 0.6, y: v.y1 - 0.6, at: 'sw' },
    { x: v.x0 + 0.6, y: v.y0 + 0.6, at: 'ne' },
    { x: v.x1 - 0.6, y: v.y0 + 0.6, at: 'nw' },
  ];
  const clearance = (c) => {
    const dir = c.at.endsWith('e') ? 1 : -1;
    let worst = Infinity;
    for (let k = 0; k <= LABEL_W; k += 1) {
      const px = c.x + dir * k;
      const py = c.y;
      // до осей (они тоже нарисованы) и до кривой
      worst = Math.min(worst, Math.abs(py), Math.abs(px));
      for (const q of curve) {
        worst = Math.min(worst, Math.hypot(q.x - px, q.y - py));
      }
    }
    return worst;
  };
  return candidates.reduce((best, c) => (clearance(c) > clearance(best) ? c : best));
}

/**
 * Собрать DSL чертежа. `name` — имя нарисованной кривой: `f`, `f'` (сцена
 * производной) или `F`; штрих в имени включает роль «точки задают f′».
 */
function buildSpec({
  nodes, name, label, extra = [], view, spline,
}) {
  const v = view || viewOf(nodes);
  const lines = [
    `x ${v.x0} ${v.x1}`,
    `y ${v.y0} ${v.y1}`,
    `spline ${name} ${nodes.map(nodeToken).join(' ')}`,
  ];
  if (label) {
    const s = spline || buildSpline(nodes);
    const spot = labelSpot(s, v);
    lines.push(`label ${r1(spot.x)} ${r1(spot.y)} ${label} at ${spot.at}`);
  }
  return [...lines, ...extra].join('\n');
}

/** Промежуток по-русски: (−8; 3) / [−8; 3] */
const interval = (a, b, closed = false) => (closed ? `[${fmt(a)}; ${fmt(b)}]` : `(${fmt(a)}; ${fmt(b)})`);

/**
 * Сцена: узлы + построенная модель + то, что по ней читается.
 * Строится ровно один раз на задание — и картинка, и ответ идут отсюда.
 */
function scene(nodes, name) {
  if (!nodes) return null;
  const spline = buildSpline(nodes);
  if (!spline.ok) return null;
  const an = splineAnalysis(spline);
  const [a, b] = spline.domain;
  return {
    nodes,
    name,
    spline,
    an,
    a,
    b,
    // Промежутки знакопостоянства нарисованной кривой (нужны сцене производной)
    sign: splineSignIntervals(spline),
    zeros: splineZeros(spline).filter((z) => !z.atEdge),
  };
}

const fScene = (opts = {}) => scene(
  waveNodes({ turns: opts.turns ?? randInt(2, 4), flat: !!opts.flat }), 'f',
);
const dScene = () => scene(derivNodes({ zeros: randInt(2, 4) }), "f'");
const pScene = () => scene(waveNodes({ turns: randInt(2, 3) }), 'F');

// Длина наибольшего промежутка из списка [[a, b], …]
const longest = (list) => list.reduce((m, [a, b]) => Math.max(m, b - a), 0);
const sumX = (list) => list.reduce((s, p) => s + p.x, 0);

// ──────────────────────────── вопросы по сценам ────────────────────────────

// Общая часть условия: где определена функция.
const definedOn = (s, name = 'f(x)') => `Функция $${name}$ определена на интервале $${interval(s.a, s.b)}$.`;

const GRAPH_F = (s) => `На рисунке изображён график функции $y = f(x)$, определённой на интервале $${interval(s.a, s.b)}$.`;
const GRAPH_D = (s) => `На рисунке изображён график $y = f'(x)$ — производной функции $f(x)$, определённой на интервале $${interval(s.a, s.b)}$.`;

const specF = (s, extra = []) => buildSpec({
  nodes: s.nodes, name: 'f', label: 'y = f(x)', extra, spline: s.spline,
});
const specD = (s, extra = []) => buildSpec({
  nodes: s.nodes, name: "f'", label: "y = f'(x)", extra, spline: s.spline,
});

/**
 * Целые точки промежутков монотонности, где производная ОТЛИЧНА от нуля.
 * Стационарная точка («полочка» на подъёме) лежит внутри промежутка
 * возрастания, но f′ там равна нулю — в ответ она не идёт.
 */
function derivIntegers(s, runs) {
  const flat = new Set(s.an.stationary.map((p) => p.x));
  return integersInIntervals(runs.map(([a, b]) => ({ a, b }))).filter((k) => !flat.has(k));
}

/** Задание сцены «график функции». */
function askF(cat) {
  const needFlat = cat === 'f_deriv_zero_count';
  const s = fScene({ flat: needFlat || chance(0.25) });
  if (!s) return null;
  const q = (question, value, extra = []) => (value === null || value === undefined
    ? null
    : { plot: specF(s, extra), question: `${GRAPH_F(s)} ${question}`, resultLatex: ans(value), answerValue: value });

  switch (cat) {
    case 'f_max_count':
      return s.an.maxima.length ? q('Найдите количество точек максимума функции $f(x)$.', s.an.maxima.length) : null;
    case 'f_min_count':
      return s.an.minima.length ? q('Найдите количество точек минимума функции $f(x)$.', s.an.minima.length) : null;
    case 'f_extremum_count': {
      const n = s.an.maxima.length + s.an.minima.length;
      return n ? q('Найдите количество точек экстремума функции $f(x)$.', n) : null;
    }
    case 'f_extremum_sum': {
      const pts = [...s.an.maxima, ...s.an.minima];
      return pts.length >= 2 ? q('Найдите сумму точек экстремума функции $f(x)$.', sumX(pts)) : null;
    }
    case 'f_deriv_zero_count': {
      const n = s.an.maxima.length + s.an.minima.length + s.an.stationary.length;
      // Без стационарной точки вопрос повторял бы «сколько точек экстремума»
      return s.an.stationary.length ? q('Найдите количество точек, в которых производная функции $f(x)$ равна нулю.', n) : null;
    }
    case 'f_deriv_pos_int': {
      const list = derivIntegers(s, s.an.increasing);
      return list.length ? q('Найдите количество целых точек, в которых производная функции $f(x)$ положительна.', list.length) : null;
    }
    case 'f_deriv_neg_int': {
      const list = derivIntegers(s, s.an.decreasing);
      return list.length ? q('Найдите количество целых точек, в которых производная функции $f(x)$ отрицательна.', list.length) : null;
    }
    case 'f_increase_len': {
      const len = longest(s.an.increasing);
      return len ? q('Найдите длину наибольшего промежутка возрастания функции $f(x)$.', len) : null;
    }
    case 'f_decrease_len': {
      const len = longest(s.an.decreasing);
      return len ? q('Найдите длину наибольшего промежутка убывания функции $f(x)$.', len) : null;
    }
    case 'f_max_value_point':
    case 'f_min_value_point': {
      // Наибольшее значение ищется на ОТРЕЗКЕ: на интервале концы не в счёт,
      // и ответ мог бы не достигаться.
      const best = cat === 'f_max_value_point'
        ? s.nodes.reduce((m, n) => (n.y > m.y ? n : m))
        : s.nodes.reduce((m, n) => (n.y < m.y ? n : m));
      // Единственность: второго узла с тем же значением быть не должно
      if (s.nodes.filter((n) => n.y === best.y).length > 1) return null;
      const word = cat === 'f_max_value_point' ? 'наибольшее' : 'наименьшее';
      return q(
        `Найдите точку отрезка $${interval(s.a, s.b, true)}$, в которой функция $f(x)$ принимает ${word} значение.`,
        best.x,
      );
    }
    default:
      return null;
  }
}

/**
 * Значения производной, которые встречаются в КИМ: целые, половинки и простые
 * дроби. `token` — запись наклона в DSL, `tex` — как значение печатается в
 * списке (в KaTeX десятичная запятая берётся в скобки).
 */
const SLOPE_VALUES = [
  { v: 4, token: '4', tex: '4' },
  { v: 3, token: '3', tex: '3' },
  { v: 2, token: '2', tex: '2' },
  { v: 1.5, token: '3/2', tex: '1{,}5' },
  { v: 1, token: '1', tex: '1' },
  { v: 2 / 3, token: '2/3', tex: '\\frac{2}{3}' },
  { v: 0.5, token: '1/2', tex: '0{,}5' },
];

const negSlope = (s) => ({
  v: -s.v,
  token: `-${s.token}`,
  tex: s.tex.startsWith('\\frac') ? `-${s.tex}` : `-${s.tex}`,
});

/** Куски кривой, на которых помещается точка касания и виден наклон. */
function tangentSpots(base, { minDx = 3 } = {}) {
  return base.slice(0, -1)
    .map((n, i) => i)
    .filter((i) => base[i + 1].x - base[i].x >= minDx && Math.abs(base[i + 1].y - base[i].y) >= 2);
}

/**
 * Поставить точку касания в середину куска `i` и подобрать ей наклон.
 *
 * Наклон не круче соседних секущих: иначе кривая перестала бы быть монотонной
 * на куске, и сплайн начал бы её «чинить» — заявленное значение производной
 * разошлось бы с нарисованным. `used` — уже занятые значения: в задании на
 * соответствие два одинаковых ответа сделали бы его неразрешимым.
 */
function tangentAt(base, i, used = [], { decimalOnly = false } = {}) {
  const a = base[i];
  const b = base[i + 1];
  const x0 = a.x + Math.round((b.x - a.x) / 2);
  const y0 = Math.round((a.y + b.y) / 2);
  if (x0 <= a.x || x0 >= b.x || y0 === a.y || y0 === b.y) return null;

  const lim = Math.min(Math.abs((y0 - a.y) / (x0 - a.x)), Math.abs((b.y - y0) / (b.x - x0)));
  const up = b.y > a.y;
  const pool = SLOPE_VALUES
    .filter((s) => s.v <= lim + EPS)
    // Ответ одиночной задачи ученик пишет в бланк, а «2/3» туда не вписать
    .filter((s) => !decimalOnly || !s.token.includes('/') || s.tex.startsWith('0{,}') || s.tex.startsWith('1{,}'))
    .map((s) => (up ? s : negSlope(s)))
    // Различаются и по модулю: «2/3» рядом с «−2/3» ученик читает как опечатку.
    // Сравниваем модули уже ПОСЛЕ смены знака — иначе проверка мимо.
    .filter((s) => !used.some((u) => Math.abs(Math.abs(u) - Math.abs(s.v)) < EPS));
  if (!pool.length) return null;
  const slope = rand(pool);
  return {
    node: { x: x0, y: y0, slope: slope.v, slopeToken: slope.token }, slope,
  };
}

/**
 * f′(x₀) по касательной. Точку касания ставим НА СЕРЕДИНЕ монотонного куска —
 * во всех вершинах «пилы» ответ был бы нулём, — задаём ей наклон и сверяем его
 * с моделью: слишком крутую касательную сплайн не выдержит, такое задание
 * отбраковывается вместе с кривой, которую пришлось сглаживать.
 */
function askTangent() {
  const base = waveNodes({ turns: randInt(2, 3) });
  if (!base) return null;
  const spots = tangentSpots(base);
  if (!spots.length) return null;
  const i = rand(spots);
  const spot = tangentAt(base, i, [], { decimalOnly: true });
  if (!spot) return null;

  const nodes = [...base];
  nodes.splice(i + 1, 0, spot.node);
  const s = scene(nodes, 'f');
  if (!s || s.spline.warning) return null;
  const x0 = spot.node.x;
  if (Math.abs(s.spline.df(x0) - spot.slope.v) > 1e-6) return null;

  const extra = [`tangent ${x0} f`, `mark ${x0} f`, `xtick ${x0}`];
  return {
    plot: buildSpec({
      nodes, name: 'f', label: 'y = f(x)', extra, spline: s.spline,
    }),
    question: `На рисунке изображён график функции $y = f(x)$ и касательная к нему в точке с абсциссой $x_0 = ${fmt(x0)}$. Найдите значение производной $f'(x)$ в точке $x_0$.`,
    resultLatex: ans(spot.slope.v),
    answerValue: spot.slope.v,
  };
}

// Точки касания подписываются буквами по порядку слева направо, ответы —
// цифрами под буквами А, Б, В, Г (как в бланке).
const POINT_NAMES = ['K', 'L', 'M', 'N'];
export const MATCH_LETTERS = ['А', 'Б', 'В', 'Г'];

/**
 * Соответствие «точка ↔ значение производной»: к графику проведены четыре
 * касательные, ученик сопоставляет точкам значения f′ и пишет в ответ четыре
 * цифры («2143»).
 *
 * Каждая касательная живёт на своём монотонном куске: на соседних кусках знаки
 * наклона разные, поэтому в списке значений сами собой оказываются и
 * положительные, и отрицательные — как в КИМ.
 */
function askTangentMatch() {
  const base = waveNodes({ turns: randInt(3, 4), maxSpan: 14 });
  if (!base) return null;
  const spots = tangentSpots(base, { minDx: 2 });
  if (spots.length < POINT_NAMES.length) return null;

  const chosen = shuffleArray(spots).slice(0, POINT_NAMES.length).sort((a, b) => a - b);
  const nodes = [...base];
  const picked = [];
  // Вставляем справа налево: индексы левых кусков от этого не съезжают.
  for (const i of [...chosen].reverse()) {
    const spot = tangentAt(base, i, picked.map((p) => p.slope.v));
    if (!spot) return null;
    nodes.splice(i + 1, 0, spot.node);
    picked.unshift(spot);
  }

  const s = scene(nodes, 'f');
  if (!s || s.spline.warning) return null;
  // Заявленный наклон обязан совпасть с нарисованным — иначе ответ соврёт
  for (const p of picked) {
    if (Math.abs(s.spline.df(p.node.x) - p.slope.v) > 1e-6) return null;
  }

  // Касательные — короткими отрезками у точки касания: четыре прямые через всё
  // окно превращают рисунок в паутину, в КИМ их тоже рисуют локально.
  const TAN_HALF = 3;
  const extra = picked.flatMap((p, k) => [
    `tangent ${p.node.x} f from ${p.node.x - TAN_HALF} to ${p.node.x + TAN_HALF}`,
    `mark ${p.node.x} f`,
    `drop ${p.node.x} f`,
    `xtick ${p.node.x} ${POINT_NAMES[k]} bold`,
  ]);

  // Значения в списке перемешаны, ответ — их номера в порядке точек
  const values = shuffleArray(picked.map((p) => p.slope));
  const answer = picked
    .map((p) => values.findIndex((v) => Math.abs(v.v - p.slope.v) < EPS) + 1)
    .join('');

  return {
    plot: buildSpec({
      nodes, name: 'f', label: '', extra, spline: s.spline,
    }),
    question: 'На рисунке изображён график функции, к которому проведены касательные в четырёх точках. Ниже указаны значения производной в данных точках. Пользуясь графиком, поставьте в соответствие каждой точке значение производной в ней.',
    matching: {
      points: POINT_NAMES.slice(0, picked.length),
      values: values.map((v) => v.tex),
    },
    note: 'Запишите в ответ цифры, расположив их в порядке, соответствующем буквам: А Б В Г.',
    resultLatex: answer,
    answerValue: Number(answer),
  };
}

/** Задание сцены «график производной»: спрашиваем про саму f. */
function askD(cat) {
  const s = dScene();
  if (!s) return null;
  const up = s.zeros.filter((z) => z.type === 'up'); // f′: − → +, минимум f
  const down = s.zeros.filter((z) => z.type === 'down'); // максимум f
  const inc = s.sign.filter((i) => i.sign > 0);
  const dec = s.sign.filter((i) => i.sign < 0);
  const q = (question, value) => (value === null || value === undefined
    ? null
    : { plot: specD(s), question: `${GRAPH_D(s)} ${question}`, resultLatex: ans(value), answerValue: value });

  switch (cat) {
    case 'd_max_count':
      return down.length ? q('Найдите количество точек максимума функции $f(x)$.', down.length) : null;
    case 'd_min_count':
      return up.length ? q('Найдите количество точек минимума функции $f(x)$.', up.length) : null;
    case 'd_extremum_count':
      return q('Найдите количество точек экстремума функции $f(x)$.', s.zeros.length);
    case 'd_extremum_sum':
      return s.zeros.length >= 2 ? q('Найдите сумму точек экстремума функции $f(x)$.', s.zeros.reduce((t, z) => t + z.x, 0)) : null;
    case 'd_increase_int': {
      const list = integersInIntervals(inc);
      return list.length ? q('Найдите количество целых точек, в которых функция $f(x)$ возрастает.', list.length) : null;
    }
    case 'd_decrease_int': {
      const list = integersInIntervals(dec);
      return list.length ? q('Найдите количество целых точек, в которых функция $f(x)$ убывает.', list.length) : null;
    }
    case 'd_increase_len': {
      const len = longest(inc.map((i) => [i.a, i.b]));
      return len ? q('Найдите длину наибольшего промежутка возрастания функции $f(x)$.', len) : null;
    }
    case 'd_decrease_len': {
      const len = longest(dec.map((i) => [i.a, i.b]));
      return len ? q('Найдите длину наибольшего промежутка убывания функции $f(x)$.', len) : null;
    }
    default:
      return null;
  }
}

/**
 * Сцена «график первообразной»: площадь под графиком f на отрезке равна
 * F(b) − F(a). Отрезок берём внутри промежутка ВОЗРАСТАНИЯ F — только там
 * f = F′ неотрицательна и разность значений действительно площадь.
 */
function askP() {
  const s = pScene();
  if (!s) return null;
  const rise = s.an.increasing.filter(([a, b]) => b - a >= 2);
  if (!rise.length) return null;
  const [a, b] = rand(rise);
  const ya = s.spline.f(a);
  const yb = s.spline.f(b);
  const area = Math.round((yb - ya) * 1e6) / 1e6;
  if (area <= 0 || Math.abs(area - Math.round(area)) > EPS) return null;
  const extra = [
    `drop ${a} F`, `drop ${b} F`,
    `mark ${a} F`, `mark ${b} F`,
    `band ${a} ${b} color ink`,
  ];
  return {
    plot: buildSpec({
      nodes: s.nodes, name: 'F', label: 'y = F(x)', extra, spline: s.spline,
    }),
    question: `На рисунке изображён график $y = F(x)$ — одной из первообразных функции $f(x)$. Найдите площадь фигуры, ограниченной графиком $y = f(x)$, осью $Ox$ и прямыми $x = ${fmt(a)}$ и $x = ${fmt(b)}$.`,
    resultLatex: ans(area),
    answerValue: area,
  };
}

/** Чтение графика (базовый уровень): значение, нули, число решений f(x) = c. */
function askBase(cat) {
  const s = fScene();
  if (!s) return null;
  const q = (question, value, extra = []) => (value === null || value === undefined
    ? null
    : { plot: specF(s, extra), question: `${GRAPH_F(s)} ${question}`, resultLatex: ans(value), answerValue: value });

  if (cat === 'b_value_at') {
    const inner = s.nodes.slice(1, -1);
    if (!inner.length) return null;
    const n = rand(inner);
    return q(`Найдите значение $f(${fmt(n.x)})$.`, n.y, [`xtick ${n.x}`]);
  }
  if (cat === 'b_zeros_count') {
    const zeros = splineZeros(s.spline);
    return zeros.length ? q('Найдите количество нулей функции $f(x)$ (точек, в которых график пересекает ось $Ox$).', zeros.length) : null;
  }
  if (cat === 'b_solutions_count') {
    // Горизонталь y = c не должна проходить через вершину: иначе «касание»
    // спорно для ученика.
    const ys = s.nodes.map((n) => n.y);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const pool = [];
    for (let c = lo + 1; c <= hi - 1; c += 1) if (!ys.includes(c)) pool.push(c);
    if (!pool.length) return null;
    const c = rand(pool);
    const count = countCrossings(s, c);
    return count >= 2
      ? q(`Найдите количество решений уравнения $f(x) = ${fmt(c)}$.`, count, [`ytick ${c}`])
      : null;
  }
  if (cat === 'b_max_value') {
    const best = Math.max(...s.nodes.map((n) => n.y));
    return q(`Найдите наибольшее значение функции $f(x)$ на отрезке $${interval(s.a, s.b, true)}$.`, best);
  }
  return null;
}

/** Сколько раз график пересекает горизонталь y = c (куски монотонны). */
function countCrossings(s, c) {
  let count = 0;
  for (let i = 0; i < s.nodes.length - 1; i += 1) {
    const a = s.nodes[i].y - c;
    const b = s.nodes[i + 1].y - c;
    if (a === 0 || b === 0) return null; // через узел — считать спорно
    if (a * b < 0) count += 1;
  }
  return count;
}

// ──────────────────────────── категории листа ────────────────────────────

export const CATEGORY_LABELS_GRAPH = {
  // График функции
  f_max_count: 'Точки максимума',
  f_min_count: 'Точки минимума',
  f_extremum_count: 'Точки экстремума',
  f_extremum_sum: 'Сумма точек экстремума',
  f_deriv_zero_count: 'Где f′ = 0',
  f_deriv_pos_int: 'Целые точки, где f′ > 0',
  f_deriv_neg_int: 'Целые точки, где f′ < 0',
  f_increase_len: 'Длина промежутка возрастания',
  f_decrease_len: 'Длина промежутка убывания',
  f_max_value_point: 'Точка наибольшего значения',
  f_min_value_point: 'Точка наименьшего значения',
  f_tangent_slope: 'f′(x₀) по касательной',
  f_tangent_match: 'Соответствие: точки и f′',
  // График производной
  d_max_count: 'Точки максимума f',
  d_min_count: 'Точки минимума f',
  d_extremum_count: 'Точки экстремума f',
  d_extremum_sum: 'Сумма точек экстремума f',
  d_increase_int: 'Целые точки, где f возрастает',
  d_decrease_int: 'Целые точки, где f убывает',
  d_increase_len: 'Длина возрастания f',
  d_decrease_len: 'Длина убывания f',
  // Первообразная
  p_area: 'Площадь по графику F',
  // Чтение графика (база)
  b_value_at: 'Значение f(x₀)',
  b_zeros_count: 'Количество нулей',
  b_solutions_count: 'Число решений f(x) = c',
  b_max_value: 'Наибольшее значение',
};

export const CATEGORY_GROUPS_GRAPH = [
  {
    label: 'Дан график функции',
    hint: 'Профиль №9, база №7',
    keys: [
      'f_max_count', 'f_min_count', 'f_extremum_count', 'f_extremum_sum',
      'f_deriv_zero_count', 'f_deriv_pos_int', 'f_deriv_neg_int',
      'f_increase_len', 'f_decrease_len',
      'f_max_value_point', 'f_min_value_point', 'f_tangent_slope', 'f_tangent_match',
    ],
  },
  {
    label: 'Дан график производной',
    hint: 'Профиль №9',
    keys: [
      'd_max_count', 'd_min_count', 'd_extremum_count', 'd_extremum_sum',
      'd_increase_int', 'd_decrease_int', 'd_increase_len', 'd_decrease_len',
    ],
  },
  {
    label: 'Дан график первообразной',
    hint: 'Профиль №9',
    keys: ['p_area'],
  },
  {
    label: 'Чтение графика',
    hint: 'База №3 и №7',
    keys: ['b_value_at', 'b_zeros_count', 'b_solutions_count', 'b_max_value'],
  },
];

const ALL_CATS = CATEGORY_GROUPS_GRAPH.flatMap((g) => g.keys);

// По умолчанию — самое ходовое: экстремумы по графику f и по графику f′.
const DEFAULT_ON = [
  'f_max_count', 'f_min_count', 'f_extremum_count', 'f_deriv_pos_int',
  'f_tangent_slope', 'f_tangent_match',
  'd_max_count', 'd_min_count', 'd_increase_int',
];

export const DEFAULT_SETTINGS_GRAPH = {
  variantsCount: 2,
  questionsCount: 8,
  categories: Object.fromEntries(ALL_CATS.map((k) => [k, DEFAULT_ON.includes(k)])),
  categoryCounts: {},
  showAnswerSpace: true,
  columnsCount: 2,
  figureSize: 'm',
  // Ответы по графику на глаз не проверишь — лист учителя нужен всегда,
  // поэтому он включён сразу.
  showTeacherKey: true,
  // Ключ печатается чёрным: на ч/б принтере красный выходит блёклым серым
  // (правило всего печатного стека — краска только чёрная).
  keyColor: false,
};

const ASK_TRIES = 8;

/**
 * Одно задание категории или null, если случайные числа так и не подошли.
 *
 * Сцена строится случайно, а вопрос предъявляет к ней свои требования
 * («наибольшее значение достигается ровно в одной точке», «нули не совпали с
 * узлами»), поэтому пробуем несколько раз: одиночная попытка отбраковывала
 * каждое второе задание у придирчивых типов.
 */
export function makeGraphTask(cat) {
  const build = () => (cat === 'f_tangent_slope' ? askTangent()
    : cat === 'f_tangent_match' ? askTangentMatch()
      : cat === 'p_area' ? askP()
        : cat.startsWith('f_') ? askF(cat)
          : cat.startsWith('d_') ? askD(cat)
            : cat.startsWith('b_') ? askBase(cat)
              : null);
  for (let i = 0; i < ASK_TRIES; i += 1) {
    const task = build();
    if (task) return { ...task, cat };
  }
  return null;
}

/** Чистая генерация листа (смешанные работы и сохранённые листы зовут её же). */
export function generateGraphVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_GRAPH, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => ALL_CATS.includes(k),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 120,
    make: (cat) => makeGraphTask(cat),
  });
}

export const GRAPH_CATEGORIES = ALL_CATS;
