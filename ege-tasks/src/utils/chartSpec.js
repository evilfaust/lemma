// Блок ```chart — график или диаграмма «из жизни» по таблице значений
// (осадки по дням, температура по часам, продажи по месяцам), как на
// картинках базы №3/№7 «Решу ЕГЭ». Рисует общий рендер `chartSvg`.
//
// Почему не ```plot: у координатной плоскости клетка квадратная и оси
// математические (x, y, O, стрелки). Здесь у каждой оси свой масштаб
// (1 день ↔ 0,5 мм), подписи шкалы «4,0», подписи осей словами.
//
// Модель документа (`doc`) — состояние конструктора ChartModal; DSL ↔ doc
// без потерь (`parseChartSpec` / `chartToSpec`), doc → модель рендера
// (`docToChart`). Чистый модуль без DOM.
//
// DSL (команда на строку; в строку `chart: …` — через «;»):
//   x 8 24 step 1 [label 2]           окно по x, шаг клетки, подписи через label
//   y 0 4,5 step 0,5 [label 1] [decimals 1]
//   xtitle Число месяца               подпись под осью x
//   ytitle Количество осадков, мм     подпись оси y (вертикально)
//   xunit ч / yunit °C                маленькая единица у конца оси
//   values 4 1,5 0,25 …               линия: значения подряд с x = начало окна, шаг — step
//   line (8; 4) (9; 1,5) …            линия по точкам (x; y)
//     … color orange | smooth | nodots | dash   — модификаторы линии
//   bar 12 15 20 …  [color blue]      столбики (на каждую категорию — один)
//   labels янв фев мар …              подписи столбиков (с пробелами — через «|»)
//   size 340 210 / font 1,2            холст (px) и масштаб шрифта

import { num, PLOT_PALETTE } from './coordPlot';
import { chartSvg } from './chartSvg';

export const CHART_COLORS = ['ink', 'orange', 'blue', 'green', 'red', 'violet', 'gray'];
export const CHART_SIZES = { S: [280, 175], M: [340, 210], L: [420, 260] };
export const CHART_DEFAULT_FONT = 1.15;
const INLINE_WIDTH = 220;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const fmt = (v) => String(Math.round(v * 10000) / 10000).replace('.', ',').replace(/^-/, '-');

export function emptyChartDoc() {
  return {
    type: 'line',
    x: { min: 0, max: 10, step: 1, label: null },
    y: { min: 0, max: 10, step: 1, label: null, decimals: null },
    xtitle: '',
    ytitle: '',
    xunit: '',
    yunit: '',
    series: [],
    bars: [],
    barColor: 'ink',
    size: { w: CHART_SIZES.M[0], h: CHART_SIZES.M[1] },
    font: CHART_DEFAULT_FONT,
    raw: [],
  };
}

/** Команды: перевод строки или «;», но «;» внутри скобок «(8; 4)» команду не режет. */
export function splitChartCommands(spec) {
  const out = [];
  let cur = '';
  let depth = 0;
  for (const ch of String(spec ?? '')) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '\n' || (ch === ';' && depth === 0)) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Пары «ключ число» из хвоста команды оси: step 0,5 label 1 decimals 1
function axisOpts(tokens) {
  const o = {};
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const k = tokens[i].toLowerCase();
    if (['step', 'label', 'decimals'].includes(k)) {
      const v = num(tokens[i + 1]);
      if (isNum(v)) { o[k] = v; i += 1; }
    }
  }
  return o;
}

// Модификаторы линии/столбиков: color X, smooth, nodots, dash
function seriesMods(tokens) {
  const mods = { color: 'ink', dots: true, smooth: false, dash: false };
  const rest = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i].toLowerCase();
    if (t === 'color' && tokens[i + 1]) { mods.color = tokens[i + 1].toLowerCase(); i += 1; } else if (t === 'smooth') mods.smooth = true;
    else if (t === 'nodots') mods.dots = false;
    else if (t === 'dots') mods.dots = true;
    else if (t === 'dash') mods.dash = true;
    else rest.push(tokens[i]);
  }
  return { mods, rest };
}

function parsePoints(src) {
  const pts = [];
  for (const m of String(src).matchAll(/\(([^)]*)\)/g)) {
    const body = m[1].trim();
    const parts = body.includes(';') ? body.split(';') : body.split(/\s+/);
    const x = num(parts[0]);
    const y = num(parts[1]);
    if (parts.length === 2 && isNum(x) && isNum(y)) pts.push([x, y]);
    else return null;
  }
  return pts;
}

/**
 * DSL → документ. Неизвестные строки сохраняются в `raw` (и в `errors`):
 * правка в конструкторе их не выбрасывает.
 */
export function parseChartSpec(spec) {
  const doc = emptyChartDoc();
  const errors = [];
  const pendingValues = [];
  let xGiven = false;
  let yGiven = false;
  let labels = null;

  for (const cmd of splitChartCommands(spec)) {
    const [head, ...tail] = cmd.split(/\s+/);
    const key = head.toLowerCase();
    const bodyText = cmd.slice(head.length).trim();
    if (key === 'x' || key === 'y') {
      const a = num(tail[0]);
      const b = num(tail[1]);
      if (!isNum(a) || !isNum(b) || a >= b) { errors.push(cmd); doc.raw.push(cmd); continue; }
      const o = axisOpts(tail.slice(2));
      const ax = doc[key];
      ax.min = a;
      ax.max = b;
      if (o.step > 0) ax.step = o.step;
      if (o.label > 0) ax.label = o.label;
      if (key === 'y' && Number.isInteger(o.decimals) && o.decimals >= 0 && o.decimals <= 3) ax.decimals = o.decimals;
      if (key === 'x') xGiven = true; else yGiven = true;
    } else if (['xtitle', 'ytitle', 'xunit', 'yunit'].includes(key)) {
      doc[key] = bodyText;
    } else if (key === 'values' || key === 'line') {
      const { mods, rest } = seriesMods(tail);
      if (key === 'values') {
        const vals = rest.map(num);
        if (!vals.length || !vals.every(isNum)) { errors.push(cmd); doc.raw.push(cmd); continue; }
        const s = { ...mods, points: [] };
        doc.series.push(s);
        pendingValues.push({ s, vals });
      } else {
        const pts = parsePoints(rest.join(' '));
        if (!pts || !pts.length) { errors.push(cmd); doc.raw.push(cmd); continue; }
        doc.series.push({ ...mods, points: pts });
      }
    } else if (key === 'bar' || key === 'bars') {
      const { mods, rest } = seriesMods(tail);
      const vals = rest.map(num);
      if (!vals.length || !vals.every(isNum)) { errors.push(cmd); doc.raw.push(cmd); continue; }
      doc.type = 'bar';
      doc.barColor = mods.color;
      doc.bars = vals.map((v) => ({ label: '', v }));
    } else if (key === 'labels') {
      labels = bodyText.includes('|') ? bodyText.split('|').map((s) => s.trim()) : bodyText.split(/\s+/);
    } else if (key === 'size') {
      const w = num(tail[0]);
      const h = num(tail[1]);
      if (isNum(w) && w >= 120) doc.size = { w, h: isNum(h) && h >= 80 ? h : Math.round(w * 0.62) };
    } else if (key === 'font') {
      const f = num(tail[0]);
      if (isNum(f) && f > 0.4 && f < 3) doc.font = f;
    } else {
      errors.push(cmd);
      doc.raw.push(cmd);
    }
  }

  // «values» — от начала окна x с шагом клетки (порядок команд не важен)
  for (const { s, vals } of pendingValues) {
    s.points = vals.map((v, i) => [doc.x.min + i * doc.x.step, v]);
  }
  if (labels) doc.bars.forEach((b, i) => { b.label = labels[i] ?? ''; });

  // Не задано окно — подбираем по данным
  if (!xGiven && doc.type === 'line') {
    const xs = doc.series.flatMap((s) => s.points.map((p) => p[0]));
    if (xs.length) Object.assign(doc.x, autoAxis(Math.min(...xs), Math.max(...xs), { fromZero: false }));
  }
  if (!yGiven) {
    const ys = doc.type === 'bar'
      ? doc.bars.map((b) => b.v)
      : doc.series.flatMap((s) => s.points.map((p) => p[1]));
    if (ys.length) Object.assign(doc.y, autoAxis(Math.min(...ys), Math.max(...ys), { fromZero: true }));
  }
  return { doc, errors };
}

const NICE = [1, 2, 2.5, 5, 10];

/** Красивые границы и шаг клетки под данные (≈ 6–10 делений). */
export function autoAxis(lo, hi, { fromZero = true } = {}) {
  let a = Math.min(lo, hi);
  let b = Math.max(lo, hi);
  if (fromZero && a > 0) a = 0;
  if (fromZero && b < 0) b = 0;
  if (a === b) { b = a + 1; }
  const raw = (b - a) / 8;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = NICE.map((k) => k * p).find((s) => s >= raw * 0.999) || 10 * p;
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return { min: r(Math.floor(a / step + 1e-9) * step), max: r(Math.ceil(b / step - 1e-9) * step), step: r(step), label: null };
}

// Линия идёт ровно по шагам окна — записываем коротко, через values
function isRegular(points, x) {
  return points.length > 0 && points.every(([px], i) => Math.abs(px - (x.min + i * x.step)) < 1e-9);
}

function modsText(s, isBar = false) {
  const out = [];
  if (s.color && s.color !== 'ink') out.push(`color ${s.color}`);
  if (isBar) return out;
  if (s.smooth) out.push('smooth');
  if (s.dots === false) out.push('nodots');
  if (s.dash) out.push('dash');
  return out;
}

/** Документ → DSL (строка на команду). */
export function chartToSpec(doc) {
  const lines = [];
  const axis = (k, ax) => {
    let s = `${k} ${fmt(ax.min)} ${fmt(ax.max)} step ${fmt(ax.step)}`;
    if (ax.label && Math.abs(ax.label - ax.step) > 1e-9) s += ` label ${fmt(ax.label)}`;
    if (k === 'y' && Number.isInteger(ax.decimals)) s += ` decimals ${ax.decimals}`;
    return s;
  };
  if (doc.type !== 'bar') lines.push(axis('x', doc.x));
  lines.push(axis('y', doc.y));
  if (doc.xtitle) lines.push(`xtitle ${doc.xtitle}`);
  if (doc.ytitle) lines.push(`ytitle ${doc.ytitle}`);
  if (doc.xunit) lines.push(`xunit ${doc.xunit}`);
  if (doc.yunit) lines.push(`yunit ${doc.yunit}`);
  if (doc.type === 'bar') {
    if (doc.bars.length) {
      lines.push(['bar', ...doc.bars.map((b) => fmt(b.v)), ...modsText({ color: doc.barColor }, true)].join(' '));
      if (doc.bars.some((b) => b.label)) {
        const ls = doc.bars.map((b) => b.label || '');
        lines.push(ls.some((l) => !l || /\s/.test(l)) ? `labels ${ls.join(' | ')}` : `labels ${ls.join(' ')}`);
      }
    }
  } else {
    for (const s of doc.series) {
      if (!s.points.length) continue;
      const body = isRegular(s.points, doc.x)
        ? ['values', ...s.points.map((p) => fmt(p[1]))]
        : ['line', ...s.points.map(([px, py]) => `(${fmt(px)}; ${fmt(py)})`)];
      lines.push([...body, ...modsText(s)].join(' '));
    }
  }
  const [mw, mh] = CHART_SIZES.M;
  if (doc.size && (doc.size.w !== mw || doc.size.h !== mh)) lines.push(`size ${doc.size.w} ${doc.size.h}`);
  if (doc.font && Math.abs(doc.font - CHART_DEFAULT_FONT) > 1e-9) lines.push(`font ${fmt(doc.font)}`);
  lines.push(...doc.raw);
  return lines.join('\n');
}

const colorHex = (c) => (!c || c === 'ink' ? '#000' : PLOT_PALETTE[c] || '#000');

/** Документ → модель рендера chartSvg. */
export function docToChart(doc) {
  const y = {
    min: doc.y.min,
    max: doc.y.max,
    grid: doc.y.step > 0 ? doc.y.step : 1,
    labelEvery: doc.y.label || null,
    decimals: doc.y.decimals,
    unit: doc.yunit || undefined,
    title: doc.ytitle || undefined,
  };
  if (doc.type === 'bar') {
    const n = doc.bars.length || 1;
    return {
      type: 'bar',
      x: {
        min: 0.4,
        max: n + 0.6,
        ticks: doc.bars.map((b, i) => ({ v: i + 1, label: b.label || String(i + 1) })),
        unit: doc.xunit || undefined,
        title: doc.xtitle || undefined,
      },
      y,
      bars: doc.bars.map((b, i) => ({ x: i + 1, v: b.v })),
      barWidth: 0.55,
      barColor: doc.barColor && doc.barColor !== 'ink' ? colorHex(doc.barColor) : undefined,
    };
  }
  const { min, max, step } = doc.x;
  const every = doc.x.label || step;
  const ticks = [];
  const n = Math.round((max - min) / step);
  if (n <= 400) {
    for (let i = 0; i <= n; i += 1) {
      const v = Math.round((min + i * step) * 1e9) / 1e9;
      const k = v / every;
      if (Math.abs(k - Math.round(k)) < 1e-6) ticks.push({ v, label: fmt(v).replace('-', '−') });
    }
  }
  return {
    type: 'line',
    x: {
      min, max, grid: n <= 400 ? step : null, ticks, unit: doc.xunit || undefined, title: doc.xtitle || undefined,
    },
    y,
    series: doc.series.filter((s) => s.points.length).map((s) => ({
      points: s.points,
      dots: s.dots !== false,
      smooth: !!s.smooth,
      dash: !!s.dash,
      color: s.color && s.color !== 'ink' ? colorHex(s.color) : undefined,
    })),
  };
}

/** Опции холста для chartSvg из документа. inline — в ячейку таблицы (уменьшенный целиком). */
export function chartSvgOptions(doc, { inline = false } = {}) {
  const { w, h } = doc.size;
  if (!inline) return { width: w, height: h, fontScale: doc.font };
  return { width: w, height: h, fontScale: doc.font, displayWidth: INLINE_WIDTH };
}

/** Готовый к вставке сниппет: блок ```chart или `chart: …` для ячейки. */
export function buildChartSnippet(spec, format) {
  if (format === 'inline') return `\`chart: ${spec.replace(/\n/g, '; ')}\``;
  return `\n\`\`\`chart\n${spec}\n\`\`\`\n`;
}

/** DSL → SVG-строка (оба конвейера: задачи и теория). */
export function chartSvgFromSpec(spec, { inline = false } = {}) {
  const { doc } = parseChartSpec(spec);
  return chartSvg(docToChart(doc), chartSvgOptions(doc, { inline }));
}

// Ячейки строки: табуляция (Excel), «;», «|»; иначе — пробелы («8 4», «янв 12»)
function cellsOf(line) {
  const cells = line.split(/\t|;|\|/).map((c) => c.trim()).filter((c) => c !== '');
  return cells.length === 1 ? cells[0].split(/\s+/) : cells;
}

/**
 * Вставка из Excel / Google Таблиц / текста → строки данных.
 * Понимает: два столбца (x и y, или подпись и значение), одну строку или
 * один столбец значений, две строки (вверху x, внизу y — таблица «по горизонтали»).
 * Строка-шапка со словами пропускается.
 * @returns {{ rows: Array<[string, number]>, values: boolean } | null}
 *   values — пришли только значения (x возьмётся по шагу окна)
 */
export function parseTablePaste(text) {
  let lines = String(text ?? '').split(/\r?\n/).map(cellsOf).filter((l) => l.length);
  if (!lines.length) return null;
  const numericRow = (l) => l.every((c) => isNum(num(c)));
  // Две строки по горизонтали → столбцы
  if (lines.length === 2 && lines[0].length > 2 && lines[0].length === lines[1].length) {
    lines = lines[0].map((c, i) => [c, lines[1][i]]);
  }
  // Шапка «День | Осадки»
  if (lines.length > 1 && !isNum(num(lines[0].at(-1)))) lines = lines.slice(1);
  if (!lines.length) return null;
  // Одна строка значений
  if (lines.length === 1 && numericRow(lines[0])) {
    return { rows: lines[0].map((c, i) => [String(i + 1), num(c)]), values: true };
  }
  if (lines.every((l) => l.length === 1)) {
    if (!lines.every(numericRow)) return null;
    return { rows: lines.map((l, i) => [String(i + 1), num(l[0])]), values: true };
  }
  const rows = [];
  for (const l of lines) {
    const v = num(l.at(-1));
    if (!isNum(v)) return null;
    rows.push([l.slice(0, -1).join(' '), v]);
  }
  return { rows, values: false };
}

/** Окна осей по данным документа: x — от первой до последней точки, y — с нуля. */
export function fitAxesToData(doc) {
  const next = { ...doc, x: { ...doc.x }, y: { ...doc.y } };
  const ys = doc.type === 'bar'
    ? doc.bars.map((b) => b.v)
    : doc.series.flatMap((s) => s.points.map((p) => p[1]));
  if (doc.type !== 'bar') {
    const xs = [...new Set(doc.series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
    if (xs.length > 1) {
      const gaps = xs.slice(1).map((v, i) => Math.round((v - xs[i]) * 1e6) / 1e6);
      const step = Math.min(...gaps);
      const regular = gaps.every((g) => Math.abs(g / step - Math.round(g / step)) < 1e-6);
      const n = (xs.at(-1) - xs[0]) / step;
      if (regular && n <= 40) Object.assign(next.x, { min: xs[0], max: xs.at(-1), step, label: n > 24 ? step * 2 : null });
      else Object.assign(next.x, autoAxis(xs[0], xs.at(-1), { fromZero: false }));
    }
  }
  if (ys.length) {
    const ax = autoAxis(Math.min(...ys), Math.max(...ys), { fromZero: true });
    const frac = String(ax.step).split('.')[1]?.length || 0;
    Object.assign(next.y, ax, { decimals: frac ? frac : next.y.decimals });
  }
  return next;
}
