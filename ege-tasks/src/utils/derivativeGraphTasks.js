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
import { parseCoordPlot, plotGeometry } from './coordPlot';
import { measureMathSvg } from './mathSvgText';

const EPS = 1e-6;

// Число по-русски: минус − (U+2212), десятичная запятая.
const r2 = (v) => Math.round(v * 100) / 100;
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

// Подпись графика ставится не «в угол наугад», а туда, где её рамке дальше
// всего до нарисованного. Меряем в пикселях чертежа штатного размера: кегль
// подписи в пикселях постоянный, а клетка у каждого окна своя.
const LABEL_PLOT = { width: 300, maxHeight: 180 };
// Карта расстояний строится на сетке LABEL_RES px, рамка перебирается с шагом
// LABEL_STEP px. Зазор больше LABEL_ENOUGH уже не важен — тогда выигрывает
// место ближе к краю окна (подпись в углу читается как подпись, а не как
// точка графика).
const LABEL_RES = 2;
const LABEL_STEP = 4;
const LABEL_ENOUGH = 9;
// Смещение текста подписи `at se` от её точки (см. LABEL_OFFSETS в coordPlot)
const LABEL_SE = { dx: 6, base: 15 };

/**
 * Карта расстояний (px) от каждой клетки сетки до ближайшей отметки —
 * двухпроходная фаска (chamfer 1/√2). Перебор «рамка × все точки кривой»
 * замедлял генерацию листа в ~20 раз: подпись считается и для каждой
 * отбракованной попытки задания.
 */
function distanceMap(points, gw, gh) {
  const d = new Float32Array(gw * gh).fill(1e9);
  for (const [px, py] of points) {
    const i = Math.round(px / LABEL_RES);
    const j = Math.round(py / LABEL_RES);
    if (i >= 0 && i < gw && j >= 0 && j < gh) d[j * gw + i] = 0;
  }
  const D = Math.SQRT2;
  for (let j = 0; j < gh; j += 1) {
    for (let i = 0; i < gw; i += 1) {
      const k = j * gw + i;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) {
        v = Math.min(v, d[k - gw] + 1);
        if (i > 0) v = Math.min(v, d[k - gw - 1] + D);
        if (i < gw - 1) v = Math.min(v, d[k - gw + 1] + D);
      }
      d[k] = v;
    }
  }
  for (let j = gh - 1; j >= 0; j -= 1) {
    for (let i = gw - 1; i >= 0; i -= 1) {
      const k = j * gw + i;
      let v = d[k];
      if (i < gw - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < gh - 1) {
        v = Math.min(v, d[k + gw] + 1);
        if (i < gw - 1) v = Math.min(v, d[k + gw + 1] + D);
        if (i > 0) v = Math.min(v, d[k + gw - 1] + D);
      }
      d[k] = v;
    }
  }
  return d;
}

/**
 * Куда поставить подпись графика, чтобы она не легла ни на кривую, ни на
 * касательную, ни на оси с их подписями («x», «y», «O», «1», засечки).
 *
 * Прежний перебор четырёх углов проигрывал там, где кривая уходит во все
 * углы (подпись ложилась прямо на линию), и не знал о касательных. Теперь
 * разбираем готовый чертёж той же `parseCoordPlot`, что его нарисует, и
 * перебираем положения рамки подписи по всему окну.
 */
function labelSpot(lines, label) {
  const model = parseCoordPlot(lines.join('\n'));
  const g = plotGeometry(model, LABEL_PLOT);
  const { x0, x1, y0, y1, sx, sy } = g;
  const obstacles = [];
  const add = (x, y) => obstacles.push([x, y]);

  for (const c of model.curves) {
    if (!c.fn) continue;
    const from = Math.max(Number.isFinite(c.from) ? c.from : x0, x0);
    const to = Math.min(Number.isFinite(c.to) ? c.to : x1, x1);
    // Шаг — не длиннее клетки карты и по x, и по y: у крутого участка
    // редкая выборка оставляла дыры, в которые «пролезала» подпись.
    let prev = null;
    const n = Math.ceil((sx(to) - sx(from)) / LABEL_RES) + 1;
    for (let i = 0; i <= n; i += 1) {
      const x = from + ((to - from) * i) / n;
      const y = c.fn(x);
      if (!Number.isFinite(y) || y < y0 || y > y1) { prev = null; continue; }
      const p = [sx(x), sy(y)];
      if (prev) {
        const steps = Math.ceil(Math.abs(p[1] - prev[1]) / LABEL_RES);
        for (let t = 1; t < steps; t += 1) {
          add(prev[0] + ((p[0] - prev[0]) * t) / steps, prev[1] + ((p[1] - prev[1]) * t) / steps);
        }
      }
      add(p[0], p[1]);
      prev = p;
    }
  }
  for (const p of model.points) add(sx(p.x), sy(p.y));
  // Оси — линии через всё окно, с буквами на концах и «O», «1» у начала
  const ax = sy(Math.min(Math.max(0, y0), y1));
  const ay = sx(Math.min(Math.max(0, x0), x1));
  for (let px = sx(x0); px <= sx(x1) + 8; px += LABEL_RES) add(px, ax);
  for (let py = sy(y1) - 6; py <= sy(y0); py += LABEL_RES) add(ay, py);
  [[sx(x1) - 4, ax + 8], [ay - 9, sy(y1)], [ay - 8, ax + 9], [sx(1), ax + 9], [ay - 8, sy(1)]]
    .forEach(([px, py]) => add(px, py));
  for (const t of model.xticks) { add(sx(t.v) - 6, ax + 10); add(sx(t.v) + 6, ax + 10); }

  const gw = Math.ceil((sx(x1) + 12) / LABEL_RES) + 1;
  const gh = Math.ceil((sy(y0) + 12) / LABEL_RES) + 1;
  const dist = distanceMap(obstacles, gw, gh);

  const m = measureMathSvg(label, { size: 12 });
  const w = m.width + 2;
  const h = m.ascent + m.descent + 2;
  const left = sx(x0) + 2;
  const top = sy(y1) + 2;
  const right = sx(x1) - 2 - w;
  const bottom = sy(y0) - 2 - h;

  let best = null;
  for (let bx = left; bx <= right; bx += LABEL_STEP) {
    for (let by = top; by <= bottom; by += LABEL_STEP) {
      // Зазор рамки = минимум карты по её клеткам (внутри рамки — ноль,
      // если на неё что-то легло)
      let clear = Infinity;
      const i0 = Math.floor(bx / LABEL_RES);
      const i1 = Math.ceil((bx + w) / LABEL_RES);
      const j0 = Math.floor(by / LABEL_RES);
      const j1 = Math.ceil((by + h) / LABEL_RES);
      for (let j = j0; j <= j1 && clear > 0; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const v = dist[j * gw + i];
          if (v < clear) clear = v;
        }
      }
      clear *= LABEL_RES;
      const edge = Math.min(bx - left, right - bx) + Math.min(by - top, bottom - by);
      const score = Math.min(clear, LABEL_ENOUGH) - edge * 0.01;
      if (!best || score > best.score) best = { score, bx, by };
    }
  }
  if (!best) return { x: x0 + 0.6, y: y1 - 0.6, at: 'se' };
  const pt = g.fromScreen(best.bx - LABEL_SE.dx + 1, best.by - LABEL_SE.base + m.ascent + 1);
  return { x: pt.x, y: pt.y, at: 'se' };
}

/**
 * Собрать DSL чертежа. `name` — имя нарисованной кривой: `f`, `f'` (сцена
 * производной) или `F`; штрих в имени включает роль «точки задают f′».
 */
function buildSpec({
  nodes, name, label, extra = [], view,
}) {
  const v = view || viewOf(nodes);
  const lines = [
    `x ${v.x0} ${v.x1}`,
    `y ${v.y0} ${v.y1}`,
    `spline ${name} ${nodes.map(nodeToken).join(' ')}`,
  ];
  if (label) {
    // Подпись обходит и то, что пришло в `extra` (касательные, отметки)
    const spot = labelSpot([...lines, ...extra], label);
    lines.push(`label ${r2(spot.x)} ${r2(spot.y)} ${label} at ${spot.at}`);
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

// Условие говорит «на интервале (a; b)» — концов у графика нет, рисуем их выколотыми.
const openEnds = (s, ref) => [`mark ${s.a} ${ref} open`, `mark ${s.b} ${ref} open`];

const specF = (s, extra = []) => buildSpec({
  nodes: s.nodes, name: 'f', label: 'y = f(x)', extra: [...extra, ...openEnds(s, 'f')], spline: s.spline,
});
const specD = (s, extra = []) => buildSpec({
  nodes: s.nodes, name: "f'", label: "y = f'(x)", extra: [...extra, ...openEnds(s, "f'")], spline: s.spline,
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
      const seg = segmentExtremum(s, cat === 'f_max_value_point');
      if (!seg) return null;
      const word = cat === 'f_max_value_point' ? 'наибольшее' : 'наименьшее';
      return q(
        `Найдите точку отрезка $${interval(seg.p, seg.q, true)}$, в которой функция $f(x)$ принимает ${word} значение.`,
        seg.node.x,
      );
    }
    default:
      return null;
  }
}

/**
 * Отрезок внутри области определения и вершина, в которой на нём достигается
 * наибольшее (или наименьшее) значение.
 *
 * 🚨 Отрезок обязан лежать СТРОГО внутри интервала (a; b): функция объявлена
 * на открытом интервале, в самих a и b её нет, и «наибольшее значение на
 * отрезке [a; b]» — бессмыслица (поймано учителем 20.09.2026 на выданной
 * работе). В КИМ по той же причине всегда берут внутренний отрезок.
 *
 * Концы отрезка подбираются вокруг выбранной вершины так, чтобы значение в ней
 * ни с чем не спорило: между сплайновыми узлами кривая монотонна, поэтому
 * достаточно, чтобы ни один узел отрезка и ни один его конец не дотягивал до
 * вершины. Тогда ответ единственный — и по модели, и по чертежу.
 */
function segmentExtremum(s, wantMax) {
  const MIN_SEGMENT = 3; // короче отрезок не читается по клеткам
  const vertices = wantMax ? s.an.maxima : s.an.minima;

  for (const node of shuffleArray(vertices)) {
    // «конкурент» — точка не хуже вершины: с ней ответ перестал бы быть один
    const rival = (y) => (wantMax ? y >= node.y - EPS : y <= node.y + EPS);
    // Идём от вершины в сторону края, пока между концом и вершиной не окажется
    // узел-конкурент: за ним отрезок тянуть уже нельзя.
    const ends = (limit, step) => {
      const out = [];
      for (let x = node.x + step; (x - limit) * step <= 0; x += step) {
        const between = s.nodes.filter((n) => (n.x - x) * step <= 0 && (n.x - node.x) * step > 0);
        if (between.some((n) => rival(n.y))) break;
        if (!rival(s.spline.f(x))) out.push(x);
      }
      return out;
    };
    const lefts = ends(s.a + 1, -1);
    const rights = ends(s.b - 1, 1);
    const pairs = [];
    for (const p of lefts) {
      for (const qq of rights) if (qq - p >= MIN_SEGMENT) pairs.push([p, qq]);
    }
    if (!pairs.length) continue;
    const [p, q] = rand(pairs);
    return { p, q, node };
  }
  return null;
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

// Касательная рисуется коротким отрезком у точки касания: прямая через всё
// окно превращает рисунок в паутину, в КИМ их тоже рисуют локально.
const TAN_HALF = 3;

// Место у начала координат занято буквой «O»: подпись засечки в −1, 0 или 1
// наезжает на неё. В нуле засечку не ставим никогда, ±1 — только если иначе
// задание не собрать.
const nearOrigin = (x) => Math.abs(x) <= 1;
/** Из списка берём тот, что подальше от начала координат; нет такого — любой. */
const preferFreeSpot = (list, xOf = (v) => v) => {
  const free = list.filter((v) => !nearOrigin(xOf(v)));
  return rand(free.length ? free : list);
};

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
      valuesTitle: 'ЗНАЧЕНИЯ ПРОИЗВОДНОЙ',
      values: values.map((v) => v.tex),
    },
    note: MATCH_NOTE,
    resultLatex: answer,
    answerValue: Number(answer),
  };
}

// Строка под списками — общая для всех заданий на соответствие.
const MATCH_NOTE = 'Запишите в ответ цифры, расположив их в порядке, соответствующем буквам: А Б В Г.';

/**
 * Характеристики точки в базовом КИМ: знак самой функции и знак её производной.
 * Ключ — то, что читается по графику: первый символ — знак f, второй — знак f′
 * («0» = точка экстремума, касательная горизонтальна).
 */
const SIGN_CHARACTERISTICS = {
  '++': 'функция положительна, производная положительна',
  '+-': 'функция положительна, производная отрицательна',
  '+0': 'функция положительна, производная равна нулю',
  '-+': 'функция отрицательна, производная положительна',
  '--': 'функция отрицательна, производная отрицательна',
  '-0': 'функция отрицательна, производная равна нулю',
};

// Насколько далеко от оси должна стоять точка, чтобы знак функции читался по
// клеткам, и насколько крутой должна быть кривая, чтобы знак производной был
// очевиден без касательной.
const SIGN_MIN_Y = 0.75;
const SIGN_MIN_SLOPE = 0.4;
// Под осью на том же месте стоит подпись точки (K, L, …), и жирная точка
// графика её закрывает — снизу к оси подходим не ближе полутора клеток.
const SIGN_MIN_Y_BELOW = 1.5;

/** Целые точки, в которых оба знака читаются уверенно. */
function signCandidates(s) {
  const extrema = new Set([...s.an.maxima, ...s.an.minima].map((p) => p.x));
  const out = [];
  for (let x = Math.ceil(s.a); x <= Math.floor(s.b); x += 1) {
    if (x <= s.a + EPS || x >= s.b - EPS) continue;
    if (x === 0) continue; // засечка в начале координат сольётся с осью y
    const y = s.spline.f(x);
    const d = s.spline.df(x);
    if (!Number.isFinite(y) || !Number.isFinite(d)) continue;
    // точка у самой оси — знак спорен, а снизу она ещё и закрывает подпись
    if (y > 0 ? y < SIGN_MIN_Y : -y < SIGN_MIN_Y_BELOW) continue;
    let sd = null;
    if (extrema.has(x) && Math.abs(d) < EPS) sd = '0';
    else if (d > SIGN_MIN_SLOPE) sd = '+';
    else if (d < -SIGN_MIN_SLOPE) sd = '-';
    if (!sd) continue;
    out.push({ x, key: `${y > 0 ? '+' : '-'}${sd}` });
  }
  return out;
}

/**
 * Соответствие «точка ↔ характеристика функции и производной» (база №7).
 *
 * На оси x отмечены четыре точки, ученик читает по графику знак функции и знак
 * производной в каждой. Характеристики берутся РАЗНЫЕ — иначе задание имеет
 * несколько верных ответов.
 */
function askSignMatch() {
  const s = fScene({ turns: randInt(2, 4) });
  if (!s || s.spline.warning) return null;

  const byKey = new Map();
  for (const c of signCandidates(s)) {
    if (!byKey.has(c.key)) byKey.set(c.key, []);
    byKey.get(c.key).push(c);
  }
  if (byKey.size < POINT_NAMES.length) return null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const keys = shuffleArray([...byKey.keys()]).slice(0, POINT_NAMES.length);
    const picked = keys
      .map((key) => ({ key, x: preferFreeSpot(byKey.get(key), (c) => c.x).x }))
      .sort((p, q) => p.x - q.x);
    // Подписи стоят на оси рядом с засечками: вплотную они сливаются.
    if (picked.some((p, i) => i && p.x - picked[i - 1].x < 2)) continue;

    const extra = picked.flatMap((p, k) => [
      `mark ${p.x} f`,
      `drop ${p.x} f`,
      `xtick ${p.x} ${POINT_NAMES[k]} bold`,
    ]);
    const values = shuffleArray(picked.map((p) => SIGN_CHARACTERISTICS[p.key]));
    const answer = picked
      .map((p) => values.indexOf(SIGN_CHARACTERISTICS[p.key]) + 1)
      .join('');

    return {
      plot: buildSpec({
        nodes: s.nodes, name: 'f', label: 'y = f(x)', extra, spline: s.spline,
      }),
      question: `На рисунке изображён график функции $y = f(x)$ и отмечены точки ${POINT_NAMES.map((n) => `$${n}$`).join(', ')} на оси $x$. Пользуясь графиком, поставьте в соответствие каждой точке характеристику функции и её производной.`,
      matching: {
        points: [...POINT_NAMES],
        valuesTitle: 'ХАРАКТЕРИСТИКИ ФУНКЦИИ И ПРОИЗВОДНОЙ',
        values,
        plain: true,
      },
      note: MATCH_NOTE,
      resultLatex: answer,
      answerValue: Number(answer),
    };
  }
  return null;
}

// ────────── соответствие «интервал ↔ характеристика» (база №7) ──────────

// Числа на оси, задающие четыре интервала.
const INTERVAL_MARKS = ['a', 'b', 'c', 'd', 'e'];

const INTERVAL_CHARACTERISTICS = {
  d_pos: 'производная положительна на всём интервале',
  d_neg: 'производная отрицательна на всём интервале',
  f_pos: 'функция положительна на всём интервале',
  f_neg: 'функция отрицательна на всём интервале',
  d_up_down: 'производная положительна в начале интервала и отрицательна в конце интервала',
  d_down_up: 'производная отрицательна в начале интервала и положительна в конце интервала',
  f_neg_pos: 'функция отрицательна в начале интервала и положительна в конце интервала',
  f_pos_neg: 'функция положительна в начале интервала и отрицательна в конце интервала',
};

// Сетка выборки частая намеренно: на редкой «функция положительна на всём
// интервале» проходит там, где у самого края график ныряет под ось.
const INT_STEPS = 160;
// Насколько уверенно должно читаться по клеткам: наклон у концов интервала,
// удаление графика от оси и общий подъём на монотонном куске.
const INT_MIN_SLOPE = 0.3;
const INT_MIN_DIST = 0.4;
const INT_MIN_RISE = 1;

/** Сколько раз список чисел меняет знак. */
function signChanges(list) {
  let changes = 0;
  let prev = 0;
  for (const v of list) {
    const sg = v > EPS ? 1 : v < -EPS ? -1 : 0;
    if (!sg) continue;
    if (prev && sg !== prev) changes += 1;
    prev = sg;
  }
  return changes;
}

/**
 * Что верно про кривую на интервале (p; q). Концы не берутся: в них
 * производная может быть нулевой (там стоит вершина), а интервал открытый.
 *
 * 🚨 Наборов ДВА, и путать их нельзя. `strict` — то, что уверенно читается по
 * клеткам: график заметно отошёл от оси, подъём виден. `loose` — то, что верно
 * математически, пусть и еле заметно. Характеристику интервалу выдаём по
 * `strict`, а исключаем по `loose`: иначе характеристика, на соседнем
 * интервале верная «чуть-чуть», прошла бы как уникальная, и у задания
 * оказалось бы два верных ответа.
 */
function intervalTraits(s, p, q) {
  const fs = [];
  const ds = [];
  for (let i = 1; i < INT_STEPS; i += 1) {
    const x = p + ((q - p) * i) / INT_STEPS;
    fs.push(s.spline.f(x));
    ds.push(s.spline.df(x));
  }
  const strict = new Set();
  const loose = new Set();
  if (fs.some((v) => !Number.isFinite(v)) || ds.some((v) => !Number.isFinite(v))) {
    return { strict, loose };
  }

  const first = (list) => list[0];
  const last = (list) => list[list.length - 1];
  const rise = Math.abs(s.spline.f(q) - s.spline.f(p));
  // Признак кладётся в loose всегда, в strict — если виден по клеткам
  const add = (key, ok, visible) => {
    if (!ok) return;
    loose.add(key);
    if (visible) strict.add(key);
  };

  add('d_pos', ds.every((v) => v > 0), rise >= INT_MIN_RISE);
  add('d_neg', ds.every((v) => v < 0), rise >= INT_MIN_RISE);
  add('f_pos', fs.every((v) => v > 0), fs.every((v) => v > INT_MIN_DIST));
  add('f_neg', fs.every((v) => v < 0), fs.every((v) => v < -INT_MIN_DIST));

  // «в начале … в конце»: ученик смотрит на концы интервала, поэтому в loose
  // идут ОДНИ КОНЦЫ. Разворот ровно один — требование только к strict: при
  // трёх разворотах характеристика формально верна, но задание запутывает.
  const dOnce = signChanges(ds) === 1;
  const fOnce = signChanges(fs) === 1;
  add('d_up_down', first(ds) > 0 && last(ds) < 0,
    dOnce && first(ds) > INT_MIN_SLOPE && last(ds) < -INT_MIN_SLOPE);
  add('d_down_up', first(ds) < 0 && last(ds) > 0,
    dOnce && first(ds) < -INT_MIN_SLOPE && last(ds) > INT_MIN_SLOPE);
  add('f_neg_pos', first(fs) < 0 && last(fs) > 0,
    fOnce && first(fs) < -INT_MIN_DIST && last(fs) > INT_MIN_DIST);
  add('f_pos_neg', first(fs) > 0 && last(fs) < 0,
    fOnce && first(fs) > INT_MIN_DIST && last(fs) < -INT_MIN_DIST);
  return { strict, loose };
}

/**
 * Пять целых отметок на оси: слева направо, не ближе двух клеток друг к другу.
 *
 * Часть отметок ставится в вершины «пилы» — тогда соседние интервалы выходят
 * строго монотонными, и у них появляются характеристики «производная
 * положительна/отрицательна на всём интервале». На чисто случайных отметках
 * почти каждый интервал содержал вершину, и четыре РАЗНЫЕ характеристики на
 * них не набирались.
 */
function intervalMarks(s) {
  const lo = Math.ceil(s.a) + 1;
  const hi = Math.floor(s.b) - 1;
  const steps = INTERVAL_MARKS.length - 1;
  // Отметки строятся шагами 2–4 клетки по бюджету (как узлы графика), а не
  // случайным подмножеством с отбраковкой: подмножество почти всегда
  // выкидывалось из-за двух соседних отметок в одной клетке.
  const gaps = [];
  let budget = hi - lo;
  for (let i = 0; i < steps; i += 1) {
    const left = steps - i - 1;
    const room = budget - left * 2;
    if (room < 2) return null;
    const g = randInt(2, Math.min(4, room));
    gaps.push(g);
    budget -= g;
  }
  const span = gaps.reduce((a, b) => a + b, 0);
  const offsets = [0];
  for (const g of gaps) offsets.push(offsets[offsets.length - 1] + g);
  // Отметка у начала координат слилась бы с буквой «O»: сдвигаем весь набор,
  // а не пересобираем его — иначе при широком графике отбраковка съедала
  // каждую пятую попытку. Ноль запрещён совсем, ±1 — по возможности.
  const starts = [];
  const roomy = [];
  for (let x = lo; x <= hi - span; x += 1) {
    if (offsets.some((off) => x + off === 0)) continue;
    starts.push(x);
    if (!offsets.some((off) => nearOrigin(x + off))) roomy.push(x);
  }
  if (!starts.length) return null;
  const start = rand(roomy.length ? roomy : starts);
  const marks = offsets.map((off) => start + off);

  // Отметку рядом с вершиной двигаем НА вершину: соседние интервалы тогда
  // выходят строго монотонными, и у них появляются характеристики
  // «производная положительна/отрицательна на всём интервале».
  const peaks = [...s.an.maxima, ...s.an.minima].map((p) => p.x);
  for (const peak of peaks) {
    if (peak === 0) continue; // см. выше: в нуле стоит «O»
    const i = marks.findIndex((x) => Math.abs(x - peak) === 1);
    if (i < 0) continue;
    const prev = i > 0 ? marks[i - 1] : -Infinity;
    const next = i < marks.length - 1 ? marks[i + 1] : Infinity;
    if (peak - prev >= 2 && next - peak >= 2 && peak > lo - 1 && peak < hi + 1) marks[i] = peak;
  }
  return marks;
}

/**
 * Соответствие «интервал ↔ характеристика функции или её производной».
 *
 * 🚨 Единственность ответа здесь не даётся даром: характеристика вроде
 * «производная отрицательна на всём интервале» легко подходит сразу двум
 * интервалам. Поэтому каждому интервалу достаётся характеристика, которая
 * верна ТОЛЬКО для него — остальные в задание не идут.
 */
function askIntervalMatch() {
  // Кривая и отметки подбираются вместе: на неудачной кривой четыре разные
  // характеристики не набираются ни при какой расстановке отметок.
  const s = fScene({ turns: randInt(2, 4) });
  if (!s || s.spline.warning) return null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const marks = intervalMarks(s);
    if (!marks) continue;
    const traits = [];
    for (let i = 0; i < marks.length - 1; i += 1) {
      traits.push(intervalTraits(s, marks[i], marks[i + 1]));
    }
    // характеристика годится, если читается на своём интервале и не верна —
    // даже «чуть-чуть» — ни на одном из остальных
    const own = traits.map((t, i) => [...t.strict].filter(
      (key) => traits.every((other, j) => j === i || !other.loose.has(key)),
    ));
    if (own.some((list) => !list.length)) continue;

    const keys = own.map((list) => rand(list));
    const values = shuffleArray(keys.map((k) => INTERVAL_CHARACTERISTICS[k]));
    const answer = keys
      .map((k) => values.indexOf(INTERVAL_CHARACTERISTICS[k]) + 1)
      .join('');

    return {
      plot: buildSpec({
        nodes: s.nodes,
        name: 'f',
        label: 'y = f(x)',
        extra: marks.map((x, i) => `xtick ${x} ${INTERVAL_MARKS[i]}`),
        spline: s.spline,
      }),
      question: `На рисунке изображён график функции $y = f(x)$. Числа ${INTERVAL_MARKS.map((n) => `$${n}$`).join(', ')} задают на оси $x$ четыре интервала. Пользуясь графиком, поставьте в соответствие каждому интервалу характеристику функции или её производной.`,
      matching: {
        points: marks.slice(0, -1).map((_, i) => `$(${INTERVAL_MARKS[i]}; ${INTERVAL_MARKS[i + 1]})$`),
        leftTitle: 'ИНТЕРВАЛЫ',
        valuesTitle: 'ХАРАКТЕРИСТИКИ ФУНКЦИИ ИЛИ ПРОИЗВОДНОЙ',
        values,
        plain: true,
      },
      note: MATCH_NOTE,
      resultLatex: answer,
      answerValue: Number(answer),
    };
  }
  return null;
}

// ────────── соответствие «график ↔ значение производной в x₀» (база №7) ──────────

// Наклон круче двух в мини-чертёж не влезает: соседний узел обязан лежать
// дальше касательной, а при k = 4 это 5 клеток вниз от точки касания.
const MINI_SLOPES = SLOPE_VALUES.filter((s) => s.v <= 2);

// Окно мини-чертежа: 8 клеток в каждую сторону, одно и то же у всех четырёх.
// Своё окно на каждый график («по месту кривой») давало в ряду картинки
// разной высоты и разного масштаба — сравнивать наклоны стало бы нельзя.
const MINI_VIEW = 4;
const MINI_WINDOW = {
  x0: -MINI_VIEW, x1: MINI_VIEW, y0: -MINI_VIEW, y1: MINI_VIEW,
};

/** Знаменатель наклона: `2/3` → 3. Узлы кривой обязаны попасть в целые точки. */
const slopeDenominator = (token) => Number(String(token).split('/')[1] || 1);

/**
 * Мини-чертёж под ЗАДАННОЕ значение производной: кривая с касательной в x₀.
 *
 * Здесь кривая строится ПОД наклон, а не наоборот (как в `askTangent`, где
 * наклон подбирается к готовой «пиле»): случайная пила выдерживала заданное
 * значение едва ли в каждом седьмом случае. Соседние узлы отодвигаются от
 * касательной на целую клетку — тогда секущие заведомо круче касательной, и
 * сплайн не станет «чинить» кривую, ужимая наклон.
 */
function tangentMiniPlot(slope) {
  const k = Math.abs(slope.v);
  const den = slopeDenominator(slope.token);
  const dir = slope.v > 0 ? 1 : -1;

  // Шаги до соседних узлов кратны знаменателю наклона (иначе узел попадёт
  // между клетками) и обязаны уместиться в общее окно. Отсюда и выбор точки
  // касания: от ±2 наклон с третями (шаг 3 клетки) в окно не влезает, поэтому
  // ему приходится вставать в ±1 — вплотную к «O».
  const stepsLeft = (x) => Math.floor((MINI_VIEW + x) / den);
  const stepsRight = (x) => Math.floor((MINI_VIEW - x) / den);
  const spots = [-2, -1, 1, 2].filter((x) => stepsLeft(x) >= 1 && stepsRight(x) >= 1);
  if (!spots.length) return null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const x0 = preferFreeSpot(spots);
    const hl = den * randInt(1, stepsLeft(x0));
    const hr = den * randInt(1, stepsRight(x0));
    const y0 = randInt(-1, 1);
    const ya = y0 - dir * (k * hl + randInt(1, 2));
    const yb = y0 + dir * (k * hr + randInt(1, 2));
    if (!Number.isInteger(ya) || !Number.isInteger(yb)) continue;
    if (Math.abs(ya) > MINI_VIEW || Math.abs(yb) > MINI_VIEW) continue;
    const nodes = [
      { x: x0 - hl, y: ya },
      { x: x0, y: y0, slope: slope.v, slopeToken: slope.token },
      { x: x0 + hr, y: yb },
    ];
    const s = scene(nodes, 'f');
    if (!s || s.spline.warning) continue;
    if (Math.abs(s.spline.df(x0) - slope.v) > 1e-6) continue;
    // Касательная — отрезком у точки касания: через всё окно она спорит с
    // самой кривой, и мини-чертёж читается как две пересекающиеся линии
    return buildSpec({
      nodes,
      name: 'f',
      view: MINI_WINDOW,
      extra: [
        `tangent ${x0} f from ${x0 - TAN_HALF} to ${x0 + TAN_HALF}`,
        `mark ${x0} f`,
        `xtick ${x0} x_0`,
      ],
      spline: s.spline,
    });
  }
  return null;
}

function askTangentGraphsMatch() {
  // Значения различаются и по модулю: «2/3» рядом с «−2/3» читается как опечатка
  const picked = shuffleArray(MINI_SLOPES).slice(0, 4)
    .map((s) => (chance(0.5) ? s : negSlope(s)));
  if (picked.length < 4) return null;

  const plots = [];
  for (const slope of picked) {
    const spec = tangentMiniPlot(slope);
    if (!spec) return null;
    plots.push(spec);
  }

  const values = shuffleArray(picked);
  const answer = picked
    .map((p) => values.findIndex((v) => Math.abs(v.v - p.v) < EPS) + 1)
    .join('');
  return {
    plots,
    question: 'Установите соответствие между графиками функций и значениями производных этих функций в точке $x_0$.',
    matching: {
      kind: 'graphs',
      leftTitle: 'ГРАФИКИ',
      valuesTitle: 'ЗНАЧЕНИЯ ПРОИЗВОДНЫХ',
      values: values.map((v) => v.tex),
      count: values.length,
    },
    note: MATCH_NOTE,
    resultLatex: answer,
    answerValue: Number(answer),
  };
}

// ────────── соответствие «прямая ↔ угловой коэффициент» (база №7) ──────────

/**
 * Угловые коэффициенты КИМ: целые, простые дроби и «красивые» десятичные.
 * `expr` — как коэффициент пишется в DSL (дробь берётся в скобки: `4/3*x`
 * разобралось бы как `4/(3x)`), `tex` — как он печатается в списке.
 */
const LINE_SLOPES = [
  { v: 1 / 3, expr: '(1/3)', tex: '\\frac{1}{3}' },
  { v: 0.4, expr: '0.4', tex: '0{,}4' },
  { v: 0.5, expr: '0.5', tex: '0{,}5' },
  { v: 2 / 3, expr: '(2/3)', tex: '\\frac{2}{3}' },
  { v: 0.75, expr: '0.75', tex: '0{,}75' },
  { v: 0.8, expr: '0.8', tex: '0{,}8' },
  { v: 1, expr: '1', tex: '1' },
  { v: 1.25, expr: '1.25', tex: '1{,}25' },
  { v: 4 / 3, expr: '(4/3)', tex: '\\frac{4}{3}' },
  { v: 1.5, expr: '1.5', tex: '1{,}5' },
  { v: 2, expr: '2', tex: '2' },
  { v: 2.5, expr: '2.5', tex: '2{,}5' },
  { v: 3, expr: '3', tex: '3' },
];

const negLine = (s) => ({ v: -s.v, expr: `-${s.expr}`, tex: `-${s.tex}` });

/** Прямая y = kx + b одной строкой DSL. */
function linePlot(slope) {
  const b = randInt(-3, 3);
  const shift = b === 0 ? '' : `${b > 0 ? '+' : '-'}${Math.abs(b)}`;
  // Окно — общее с мини-чертежами касательных: коэффициент считается по
  // клеткам, поэтому сетка у всех четырёх прямых обязана быть одинаковой.
  return [
    `x ${-MINI_VIEW} ${MINI_VIEW}`,
    `y ${-MINI_VIEW} ${MINI_VIEW}`,
    `f ${slope.expr}*x${shift}`,
  ].join('\n');
}

function askLinearSlopeMatch() {
  const picked = shuffleArray(LINE_SLOPES).slice(0, 4)
    .map((s) => (chance(0.5) ? s : negLine(s)));
  const plots = picked.map((s) => linePlot(s));
  const values = shuffleArray(picked);
  const answer = picked
    .map((p) => values.findIndex((v) => Math.abs(v.v - p.v) < EPS) + 1)
    .join('');
  return {
    plots,
    question: 'Установите соответствие между графиками линейных функций и угловыми коэффициентами прямых.',
    matching: {
      kind: 'graphs',
      leftTitle: 'ГРАФИКИ',
      valuesTitle: 'УГЛОВЫЕ КОЭФФИЦИЕНТЫ',
      values: values.map((v) => v.tex),
      count: values.length,
    },
    note: MATCH_NOTE,
    resultLatex: answer,
    answerValue: Number(answer),
  };
}

// ────────── соответствие «график ↔ характеристика на отрезке» (база №7) ──────────

const SEGMENT_CHARACTERISTICS = {
  min: 'У функции есть точка минимума на отрезке $[-1; 1]$.',
  max: 'У функции есть точка максимума на отрезке $[-1; 1]$.',
  inc: 'Функция возрастает на отрезке $[-1; 1]$.',
  dec: 'Функция убывает на отрезке $[-1; 1]$.',
};

/**
 * Мини-график под одну характеристику на отрезке [−1; 1].
 *
 * Вершина ставится либо ровно в ноль (экстремум внутри отрезка), либо не ближе
 * ±2 (тогда весь отрезок лежит внутри куска монотонности). Промежуточных
 * положений нет намеренно: вершина у самого края отрезка спорна для ученика.
 */
function segmentNodes(kind) {
  const amp = () => randInt(2, 3);
  const base = randInt(-1, 1);
  if (kind === 'max' || kind === 'min') {
    const dir = kind === 'max' ? 1 : -1;
    const top = base + dir;
    return [
      { x: -randInt(3, 4), y: top - dir * amp() },
      { x: 0, y: top },
      { x: randInt(3, 4), y: top - dir * amp() },
    ];
  }
  const dir = kind === 'inc' ? 1 : -1;
  if (chance(0.5)) {
    // излом слева от отрезка
    return [
      { x: -2 - randInt(1, 2), y: base + dir * amp() },
      { x: -2, y: base },
      { x: randInt(3, 4), y: base + dir * (amp() + 1) },
    ];
  }
  // излом справа от отрезка
  return [
    { x: -randInt(3, 4), y: base - dir * (amp() + 1) },
    { x: 2, y: base },
    { x: 2 + randInt(1, 2), y: base - dir * amp() },
  ];
}

const SEG_A = -1;
const SEG_B = 1;

/** Что кривая делает на отрезке [−1; 1] — читаем по самой модели. */
function segmentCharacter(spline) {
  if (!spline?.ok) return null;
  const [a, b] = spline.domain;
  if (a > SEG_A + EPS || b < SEG_B - EPS) return null;
  const an = splineAnalysis(spline);
  const turns = [...an.maxima, ...an.minima, ...an.stationary];
  // Вершина у самого края отрезка читается неоднозначно — такой график не берём
  if (turns.some((p) => Math.abs(p.x) > EPS && Math.abs(p.x) < 2 - EPS)) return null;
  const inside = turns.filter((p) => p.x > SEG_A + EPS && p.x < SEG_B - EPS);
  if (inside.length > 1) return null;
  if (inside.length === 1) {
    if (an.maxima.some((p) => p.x === inside[0].x)) return 'max';
    if (an.minima.some((p) => p.x === inside[0].x)) return 'min';
    return null; // стационарная точка — ни максимум, ни минимум
  }
  const STEPS = 40;
  let pos = 0;
  let neg = 0;
  for (let i = 0; i <= STEPS; i += 1) {
    const d = spline.df(SEG_A + ((SEG_B - SEG_A) * i) / STEPS);
    if (d > 1e-3) pos += 1;
    else if (d < -1e-3) neg += 1;
  }
  if (pos === STEPS + 1) return 'inc';
  if (neg === STEPS + 1) return 'dec';
  return null;
}

/**
 * Соответствие «график ↔ характеристика на отрезке [−1; 1]» (база №7).
 *
 * Здесь чертёж не один, а четыре: задание несёт `plots` вместо `plot`, и
 * раскладка печатает их сеткой с буквами А–Г. Каждый график строится под свою
 * характеристику и принимается только после проверки моделью — так четыре
 * варианта ответа заведомо разные.
 */
function askSegmentMatch() {
  const kinds = shuffleArray(Object.keys(SEGMENT_CHARACTERISTICS));
  const plots = [];
  for (const kind of kinds) {
    let spec = null;
    for (let i = 0; i < 10 && !spec; i += 1) {
      const nodes = segmentNodes(kind);
      if (nodes.some((n) => Math.abs(n.y) > 4)) continue;
      const spline = buildSpline(nodes);
      if (!spline.ok || spline.warning) continue;
      if (segmentCharacter(spline) !== kind) continue;
      spec = buildSpec({ nodes, name: 'f', spline });
    }
    if (!spec) return null;
    plots.push(spec);
  }

  const order = shuffleArray(Object.keys(SEGMENT_CHARACTERISTICS));
  const answer = kinds.map((k) => order.indexOf(k) + 1).join('');
  return {
    plots,
    question: 'Установите соответствие между графиками функций и характеристиками этих функций на отрезке $[-1; 1]$.',
    matching: {
      kind: 'graphs',
      leftTitle: 'ГРАФИКИ',
      valuesTitle: 'ХАРАКТЕРИСТИКИ',
      values: order.map((k) => SEGMENT_CHARACTERISTICS[k]),
      plain: true,
      count: order.length,
    },
    note: MATCH_NOTE,
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
    // Отрезок — внутри области определения, и на нём максимум достигается
    // ровно в одной вершине (см. segmentExtremum)
    const seg = segmentExtremum(s, true);
    return seg
      ? q(`Найдите наибольшее значение функции $f(x)$ на отрезке $${interval(seg.p, seg.q, true)}$.`, seg.node.y)
      : null;
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
  // Задания на соответствие (база)
  f_tangent_match: 'Точки ↔ значения f′',
  f_sign_match: 'Точки ↔ знаки f и f′',
  b_interval_match: 'Интервалы ↔ характеристики',
  b_tangent_graphs: 'Графики ↔ значения f′(x₀)',
  b_linear_slope: 'Прямые ↔ угловые коэффициенты',
  b_char_match: 'Графики ↔ характеристики на [−1; 1]',
};

/**
 * Из какого экзамена задание: «Б» — базовый ЕГЭ, «П» — профильный.
 *
 * Сверено с банком (сентябрь 2026): счёт точек экстремума, целых точек и длин
 * промежутков встречается только в профиле №9; соответствия (касательные,
 * точки, четыре графика) — только в базе №7; чтение графика — база №3 и №7.
 */
export const CATEGORY_EXAM_GRAPH = {
  f_max_count: 'П',
  f_min_count: 'П',
  f_extremum_count: 'П',
  f_extremum_sum: 'П',
  f_deriv_zero_count: 'П',
  f_deriv_pos_int: 'П',
  f_deriv_neg_int: 'П',
  f_increase_len: 'П',
  f_decrease_len: 'П',
  f_max_value_point: 'П',
  f_min_value_point: 'П',
  f_tangent_slope: 'П',
  f_tangent_match: 'Б',
  f_sign_match: 'Б',
  b_interval_match: 'Б',
  b_tangent_graphs: 'Б',
  b_linear_slope: 'Б',
  d_max_count: 'П',
  d_min_count: 'П',
  d_extremum_count: 'П',
  d_extremum_sum: 'П',
  d_increase_int: 'П',
  d_decrease_int: 'П',
  d_increase_len: 'П',
  d_decrease_len: 'П',
  p_area: 'П',
  b_value_at: 'Б',
  b_zeros_count: 'Б',
  b_solutions_count: 'Б',
  b_max_value: 'Б',
  b_char_match: 'Б',
};

export const EXAM_LABELS_GRAPH = { 'Б': 'Базовый ЕГЭ', 'П': 'Профильный ЕГЭ' };

export const CATEGORY_GROUPS_GRAPH = [
  {
    label: 'Дан график функции',
    hint: 'Профиль №9',
    keys: [
      'f_max_count', 'f_min_count', 'f_extremum_count', 'f_extremum_sum',
      'f_deriv_zero_count', 'f_deriv_pos_int', 'f_deriv_neg_int',
      'f_increase_len', 'f_decrease_len',
      'f_max_value_point', 'f_min_value_point', 'f_tangent_slope',
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
  // Шесть типов базового №7: ответ — четыре цифры под буквами А–Г. Блок
  // отдельный, потому что они различаются не сценой, а видом соответствия.
  {
    label: 'Задания на соответствие',
    hint: 'База №7',
    keys: [
      'f_tangent_match', 'f_sign_match', 'b_interval_match',
      'b_tangent_graphs', 'b_linear_slope', 'b_char_match',
    ],
  },
];

const ALL_CATS = CATEGORY_GROUPS_GRAPH.flatMap((g) => g.keys);

// По умолчанию — самое ходовое: экстремумы по графику f и по графику f′.
const DEFAULT_ON = [
  'f_max_count', 'f_min_count', 'f_extremum_count', 'f_deriv_pos_int',
  'f_tangent_slope', 'f_tangent_match', 'f_sign_match',
  'd_max_count', 'd_min_count', 'd_increase_int',
  'b_char_match',
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
      : cat === 'f_sign_match' ? askSignMatch()
        : cat === 'b_interval_match' ? askIntervalMatch()
          : cat === 'b_tangent_graphs' ? askTangentGraphsMatch()
            : cat === 'b_linear_slope' ? askLinearSlopeMatch()
              : cat === 'b_char_match' ? askSegmentMatch()
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
