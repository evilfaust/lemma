// Числовая прямая со штриховкой интервалов.
//
// Один модуль обслуживает ОБА конвейера рендеринга проекта:
//   • условия/решения задач → react-markdown (MathRenderer) ловит fenced-блок
//     ```numline и рендерит React-компонент <NumberLineSVG spec=…/>;
//   • теория → useMarkdownProcessor получает HTML-строку, postprocess подменяет
//     <pre><code class="language-numline">…</code></pre> на готовый <svg>-string.
//
// Чтобы обе ветки давали идентичную картинку, SVG всегда строит ОДНА функция
// numberLineSvg(model). SVG нарочно собран БЕЗ <defs>/<pattern>/<marker>:
// стрелка оси — это <path>, штриховка — аналитически обрезанные диагонали.
// Так разметка надёжно проходит DOMPurify (нет id-ссылок url(#…)) и корректно
// печатается в Chrome.
//
// API:
//   parseNumberLine(spec)        → model
//   numberLineSvg(model, opts?)  → '<svg>…</svg>'
//   numberLineSvgFromSpec(spec)  → '<svg>…</svg>'  (parse + render)
//   shapesToSpec({domain,shapes})→ текст DSL (для конструктора)
//
// DSL (по одной команде на строку; строки c # — комментарии):
//   domain 0 3            — диапазон оси (по умолчанию 0..5)
//   ray right 1 open      — луч вправо от 1, конец выколот (open|fill)
//   ray left 2 fill       — луч влево до 2, конец закрашен
//   seg 1 2 open open     — отрезок [1;2], концы open|fill
//   point 2 fill          — отдельная точка
//   all                   — заштриховать всю прямую (решение — любое число)
//   tick 1.5 1,5          — подпись под осью (label опционален)
//   nolabels              — не подписывать координаты под осью (точки без чисел)
//                           синонимы: labels off / labels on
//
// Подписи (tick, mark, буква оси) набираются как формулы — подмножеством LaTeX
// через mathSvgText.js: `tick 1.41 \sqrt{2}`, `tick 3.14 \pi`, `mark A_1 2`,
// `axis \varphi`. Обыкновенная дробь по-прежнему пишется просто «1/2» — она
// сама разворачивается в \frac{1}{2} и печатается стопкой. Последнее слово
// `bold` делает подпись жирной (`tick 2 два bold`, `mark A 0 bold`).

import { mathSvgText, measureMathSvg, takeTrailingBold } from './mathSvgText';

const DEFAULT_DOMAIN = [0, 5];
// Строгий монохромный стиль: чернильная ось, штриховка чуть светлее серым,
// никаких цветных акцентов — чисто и без потерь печатается в Ч/Б.
const COLORS = { axis: '#1f2937', hatch: '#4b5563', tick: '#374151', mark: '#1f2937' };

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (n) => Math.round(n * 100) / 100;

// Обыкновенная дробь a/b в подписи (числитель/знаменатель, опц. минус)
const FRAC_RE = /^(-?)(\d+)\/(\d+)$/;

// «1,5» / «-2» / «1/2» / «inf» / … → число (включая дроби и ±Infinity)
function parseCoord(tok) {
  const t = String(tok ?? '').trim().toLowerCase().replace(',', '.');
  if (t === 'inf' || t === '+inf' || t === '∞' || t === '+∞') return Infinity;
  if (t === '-inf' || t === '-∞') return -Infinity;
  const fm = t.replace(/\s+/g, '').match(FRAC_RE);
  if (fm) {
    const den = Number(fm[3]);
    if (den) return (fm[1] === '-' ? -1 : 1) * (Number(fm[2]) / den);
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// Для DSL: ±Infinity → inf/-inf, иначе исходный токен как есть (строка/число).
// Дроби «1/2» и десятичные сохраняются без преобразования.
function coordToken(v) {
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  const s = String(v ?? '').trim();
  return s || '0';
}

// Подпись по координатному токену: дробь «1/2» сохраняем (отрисуется дробью),
// десятичные — с запятой. Используется для авто-тиков лучей/отрезков/точек.
function coordLabel(tok) {
  const t = String(tok ?? '').trim().replace(/\s+/g, '');
  if (FRAC_RE.test(t)) return t;
  return t.replace('.', ',');
}

// Десятичная подпись по-русски (точка → запятая)
function fmtLabel(x) {
  return String(x).replace('.', ',');
}

// Зазор от оси до ВЕРХА подписи. Кружок точки (r 3.4 + обводка) опускается
// примерно на 4 px ниже оси, так что меньше — и подпись читается приклеенной.
const LABEL_TOP_GAP = 7;
// Расстояние от верха холста до оси и зазор от оси до подписи mark над ней.
const AXIS_TOP = 28;
const MARK_LABEL_GAP = 8;

// Подпись координаты пишется в DSL как «1/2» — это обыкновенная дробь, а не
// деление: разворачиваем её в \frac, чтобы верстальщик напечатал стопкой.
function labelTex(label) {
  const m = String(label ?? '').trim().match(FRAC_RE);
  return m ? `${m[1] === '-' ? '-' : ''}\\frac{${m[2]}}{${m[3]}}` : String(label ?? '');
}

// Сколько места подпись займёт под осью (с зазором) — по этому размеру растёт
// холст: дробь, корень и степень выше обычной строки.
function belowLabelHeight(label, fs, bold) {
  const { ascent, descent } = measureMathSvg(labelTex(label), { size: fs, bold });
  return LABEL_TOP_GAP + ascent + descent;
}

// SVG-подпись ПОД осью. Верх подписи всегда на LABEL_TOP_GAP ниже оси, каким бы
// высоким ни был набор (дробь, корень), — поэтому строка и дробь стоят ровно.
function belowLabelSvg(label, cx, axisY, fs, color, bold) {
  const tex = labelTex(label);
  const { ascent } = measureMathSvg(tex, { size: fs, bold });
  return mathSvgText(tex, {
    x: cx, y: axisY + LABEL_TOP_GAP + ascent, size: fs, color, anchor: 'middle', bold,
  });
}

const isFilledToken = (tok) => {
  const t = String(tok || '').toLowerCase();
  return t === 'fill' || t === 'closed';
};

/**
 * Разбор текстового DSL в модель.
 * @returns {{domain:[number,number], bars:Array, points:Array, ticks:Array}}
 */
export function parseNumberLine(spec) {
  const model = {
    domain: [...DEFAULT_DOMAIN], bars: [], points: [], ticks: [],
    axisLabel: 'x', axisBold: false, scale: null, marks: [], hideLabels: false,
  };
  if (!spec || typeof spec !== 'string') return model;
  let domainSet = false;

  const tickAt = new Map(); // x → {label, bold}; label=undefined → формат по значению
  const addTick = (x, label, bold = false) => {
    if (!Number.isFinite(x)) return;
    if (label != null) tickAt.set(x, { label, bold });
    else if (!tickAt.has(x)) tickAt.set(x, { label: undefined, bold });
  };
  const addPoint = (x, filled) => {
    if (!Number.isFinite(x)) return;
    model.points.push({ x, filled: !!filled });
  };

  // Команды разделяются переносом строки (блочная форма) ИЛИ «;» (inline-форма
  // для ячеек markdown-таблиц, где переносов нет).
  for (const rawLine of spec.split(/[\n;]/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const p = line.split(/\s+/);
    const cmd = p[0].toLowerCase();

    if (cmd === 'domain') {
      const a = parseCoord(p[1]);
      const b = parseCoord(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a < b) { model.domain = [a, b]; domainSet = true; }
    } else if (cmd === 'all') {
      // Вся прямая заштрихована целиком: ни точек, ни подписей.
      model.bars.push({ from: -Infinity, to: Infinity });
    } else if (cmd === 'nolabels') {
      // Точки/концы лучей рисуем, но координаты под осью не подписываем —
      // нужно для задач «определите знаки коэффициентов по рисунку».
      model.hideLabels = true;
    } else if (cmd === 'labels') {
      model.hideLabels = String(p[1] || '').toLowerCase() === 'off';
    } else if (cmd === 'axis' || cmd === 'label') {
      const { parts, bold } = takeTrailingBold(p.slice(1), 1);
      if (parts.length) { model.axisLabel = parts.join(' '); model.axisBold = bold; }
    } else if (cmd === 'scale') {
      // Линейка с целыми засечками: scale FROM TO [STEP]
      const from = parseCoord(p[1]);
      const to = parseCoord(p[2]);
      const step = p[3] != null ? parseCoord(p[3]) : 1;
      if (Number.isFinite(from) && Number.isFinite(to) && from < to) {
        model.scale = { from, to, step: Number.isFinite(step) && step > 0 ? step : 1 };
        if (!domainSet) model.domain = [from, to];
      }
    } else if (cmd === 'mark') {
      // Помеченная точка над осью: mark LABEL X [bold]
      const { parts, bold } = takeTrailingBold(p.slice(1), 2);
      const label = parts[0];
      const x = parseCoord(parts[1]);
      if (label && Number.isFinite(x)) model.marks.push({ x, label, bold });
    } else if (cmd === 'seg' || cmd === 'segment') {
      const a = parseCoord(p[1]);
      const b = parseCoord(p[2]);
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
        model.bars.push({ from: Math.min(a, b), to: Math.max(a, b) });
        addPoint(a, isFilledToken(p[3]));
        addPoint(b, isFilledToken(p[4]));
        addTick(a, coordLabel(p[1]));
        addTick(b, coordLabel(p[2]));
      }
    } else if (cmd === 'ray') {
      const dir = (p[1] || '').toLowerCase();
      const x = parseCoord(p[2]);
      if (Number.isFinite(x)) {
        if (dir === 'left') model.bars.push({ from: -Infinity, to: x });
        else model.bars.push({ from: x, to: Infinity });
        addPoint(x, isFilledToken(p[3]));
        addTick(x, coordLabel(p[2]));
      }
    } else if (cmd === 'point') {
      const x = parseCoord(p[1]);
      addPoint(x, isFilledToken(p[2]));
      addTick(x, coordLabel(p[1]));
    } else if (cmd === 'tick') {
      // keep = 1: после флага должна остаться хотя бы координата, иначе
      // «tick 2 bold» потеряло бы саму засечку.
      const { parts, bold } = takeTrailingBold(p.slice(1), 1);
      const x = parseCoord(parts[0]);
      const label = parts.slice(1).join(' ') || undefined;
      addTick(x, label, bold);
    }
  }

  model.ticks = [...tickAt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, t]) => ({ x, label: t.label, bold: !!t.bold }));
  return model;
}

// Аналитически обрезанные диагонали 45° (x+y=c) внутри полосы [x1..x2]×[yt..yb].
// Возвращает массив [x1,y1,x2,y2] — без выхода за границы полосы (важно для печати).
function hatchSegments(x1, yt, x2, yb, gap = 5) {
  const segs = [];
  const cMin = x1 + yt;
  const cMax = x2 + yb;
  for (let c = Math.ceil(cMin / gap) * gap; c <= cMax; c += gap) {
    const xlo = Math.max(x1, c - yb);
    const xhi = Math.min(x2, c - yt);
    if (xlo <= xhi) segs.push([xlo, c - xlo, xhi, c - xhi]);
  }
  return segs;
}

/**
 * Построить SVG-строку числовой прямой по модели.
 */
export function numberLineSvg(model, opts = {}) {
  const W = opts.width || 260;
  const PAD = 14;
  const dom = (model && model.domain) || DEFAULT_DOMAIN;
  const [dmin, dmax] = dom;
  // Точка за пределами видимого диапазона не рисуется вовсе: раньше её
  // прижимало клампом к краю оси и на прямой появлялся кружок из ниоткуда.
  // Штриховки это не касается — она честно доходит до края (уход в ±∞).
  const visible = (x) => Number.isFinite(x) && x >= dmin - 1e-9 && x <= dmax + 1e-9;
  const points = (model?.points || []).filter((pt) => visible(pt.x));
  // Без подписей поле под осью не нужно: холст ниже, но AXIS_Y тот же (28) —
  // штриховка и точки встают ровно там же, где у подписанной прямой.
  const hideLabels = !!(model && model.hideLabels);
  const ticks = hideLabels ? [] : (model?.ticks || []).filter((t) => visible(t.x));
  // Поле под осью — по самой высокой подписи: строка помещается в прежние 20,
  // дробь, корень и степень просят больше. Меряем тем же верстальщиком, что и
  // рисует, поэтому знаменатель не окажется за краем холста.
  const tickSize = 11;
  const scaleSize = 10;
  const below = [
    ...ticks.map((t) => belowLabelHeight(t.label != null ? t.label : fmtLabel(t.x), tickSize, t.bold)),
    ...(model?.scale && !hideLabels ? [belowLabelHeight('0', scaleSize, false)] : []),
  ];
  const bottomPad = hideLabels ? 8 : Math.max(20, Math.ceil(Math.max(0, ...below)) + 3);
  // Подпись mark стоит НАД осью — ей тоже нужно место (например, «A_1» с
  // индексом или дробь). AXIS_TOP — прежнее расстояние от верха холста до оси.
  const markNeed = (model?.marks || []).map(
    (m) => MARK_LABEL_GAP + measureMathSvg(labelTex(m.label), { size: 11, bold: m.bold }).ascent,
  );
  const AXIS_Y = opts.height
    ? opts.height - bottomPad
    : Math.max(AXIS_TOP, Math.ceil(Math.max(0, ...markNeed)) + 2);
  const H = opts.height || AXIS_Y + bottomPad;
  const span = dmax - dmin || 1;
  const sx = (v) => PAD + ((clampNum(v, dmin, dmax) - dmin) / span) * (W - 2 * PAD);

  const parts = [];

  // 1) Штриховка интервалов (полоска над осью)
  for (const b of model?.bars || []) {
    const lo = Math.min(sx(b.from), sx(b.to));
    const hi = Math.max(sx(b.from), sx(b.to));
    for (const [a1, c1, a2, c2] of hatchSegments(lo, AXIS_Y - 8, hi, AXIS_Y - 1)) {
      parts.push(
        `<line x1="${round2(a1)}" y1="${round2(c1)}" x2="${round2(a2)}" y2="${round2(c2)}" stroke="${COLORS.hatch}" stroke-width="1.15"/>`,
      );
    }
  }

  // 2) Ось + единственная правая стрелка (направление оси) + буква-подпись.
  //    Левую стрелку НЕ рисуем: уход в −∞ показывает сама штриховка до края.
  const axisLabel = (model && model.axisLabel) || 'x';
  parts.push(
    `<line x1="${PAD}" y1="${AXIS_Y}" x2="${W - PAD}" y2="${AXIS_Y}" stroke="${COLORS.axis}" stroke-width="1.3"/>`,
  );
  parts.push(
    `<path d="M${W - PAD},${AXIS_Y} L${W - PAD - 6.5},${AXIS_Y - 3} L${W - PAD - 6.5},${AXIS_Y + 3} Z" fill="${COLORS.axis}"/>`,
  );
  const axisM = measureMathSvg(axisLabel, { size: 11, bold: model?.axisBold });
  parts.push(mathSvgText(axisLabel, {
    x: W - 2,
    // Выключка по середине строки: у «x» это прежние +4 от оси.
    y: AXIS_Y + (axisM.ascent - axisM.descent) / 2,
    size: 11,
    color: COLORS.axis,
    anchor: 'end',
    bold: model?.axisBold,
  }));

  // 3) Линейка с целыми засечками (scale): короткие штрихи + числа под осью
  if (model?.scale) {
    const { from, to, step } = model.scale;
    for (let v = from; v <= to + 1e-9; v += step) {
      const x = round2(sx(v));
      parts.push(
        `<line x1="${x}" y1="${AXIS_Y - 3}" x2="${x}" y2="${AXIS_Y + 3}" stroke="${COLORS.axis}" stroke-width="1"/>`,
      );
      parts.push(belowLabelSvg(fmtLabel(Math.round(v * 1e6) / 1e6), x, AXIS_Y, scaleSize, COLORS.tick));
    }
  }

  // 4) Помеченные точки над осью (mark): штрих + закрашенная точка + буква сверху
  for (const m of model?.marks || []) {
    const x = round2(sx(m.x));
    parts.push(
      `<line x1="${x}" y1="${AXIS_Y - 4}" x2="${x}" y2="${AXIS_Y + 4}" stroke="${COLORS.mark}" stroke-width="1.1"/>`,
    );
    parts.push(
      `<circle cx="${x}" cy="${AXIS_Y}" r="2.1" fill="${COLORS.mark}"/>`,
    );
    // Низ подписи — на MARK_LABEL_GAP выше оси: у формулы с хвостом (дробь,
    // «y») базовая линия поднимается на её глубину, иначе хвост лёг бы на штрих.
    const markM = measureMathSvg(labelTex(m.label), { size: 11, bold: m.bold });
    parts.push(mathSvgText(labelTex(m.label), {
      x,
      y: AXIS_Y - MARK_LABEL_GAP - markM.descent,
      size: 11,
      color: COLORS.axis,
      anchor: 'middle',
      bold: m.bold,
    }));
  }

  // 5) Точки интервалов (выколотые ○ / закрашенные ●)
  for (const pt of points) {
    parts.push(
      `<circle cx="${round2(sx(pt.x))}" cy="${AXIS_Y}" r="3.4" fill="${pt.filled ? COLORS.axis : '#fff'}" stroke="${COLORS.axis}" stroke-width="1.3"/>`,
    );
  }

  // 6) Подписи под осью (ticks интервалов; дроби — стопкой).
  //     При nolabels список пуст — цифр под точками нет.
  for (const t of ticks) {
    const label = t.label != null ? t.label : fmtLabel(t.x);
    parts.push(belowLabelSvg(label, round2(sx(t.x)), AXIS_Y, tickSize, COLORS.tick, t.bold));
  }

  // max-width:100% — чтобы блочная прямая не вылезала в узкой печатной колонке.
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" class="numline-svg" role="img">${parts.join('')}</svg>`;
}

export function numberLineSvgFromSpec(spec, opts) {
  return numberLineSvg(parseNumberLine(spec), opts);
}

/**
 * Сериализация состояния конструктора в текст DSL.
 * @param {{domain:[number,number], shapes:Array, axisLabel?:string, showLabels?:boolean}} state
 */
export function shapesToSpec({
  domain = DEFAULT_DOMAIN, shapes = [], axisLabel = 'x', axisBold = false, showLabels = true,
} = {}) {
  const lines = [`domain ${coordToken(domain[0])} ${coordToken(domain[1])}`];
  if ((axisLabel && axisLabel !== 'x') || axisBold) lines.push(`axis ${axisLabel || 'x'}${axisBold ? ' bold' : ''}`);
  if (!showLabels) lines.push('nolabels');
  for (const s of shapes) {
    if (s.type === 'ray') {
      lines.push(`ray ${s.dir === 'left' ? 'left' : 'right'} ${coordToken(s.x)} ${s.filled ? 'fill' : 'open'}`);
    } else if (s.type === 'seg') {
      lines.push(`seg ${coordToken(s.a)} ${coordToken(s.b)} ${s.ea ? 'fill' : 'open'} ${s.eb ? 'fill' : 'open'}`);
    } else if (s.type === 'all') {
      lines.push('all');
    } else if (s.type === 'point') {
      lines.push(`point ${coordToken(s.x)} ${s.filled ? 'fill' : 'open'}`);
    } else if (s.type === 'tick') {
      lines.push(`tick ${coordToken(s.x)}${s.label ? ` ${s.label}` : ''}${s.bold ? ' bold' : ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Сериализация «точечного» типа (линейка + помеченные точки A,B,C,D).
 * @param {{scale:{from,to,step}, marks:Array<{label,x}>, axisLabel?:string}} state
 */
export function pointsToSpec({
  scale, marks = [], axisLabel = 'x', axisBold = false,
} = {}) {
  const lines = [];
  if ((axisLabel && axisLabel !== 'x') || axisBold) lines.push(`axis ${axisLabel || 'x'}${axisBold ? ' bold' : ''}`);
  if (scale) {
    lines.push(`scale ${coordToken(scale.from)} ${coordToken(scale.to)} ${scale.step || 1}`);
  }
  for (const m of marks) {
    if (m.label && m.x != null) lines.push(`mark ${m.label} ${coordToken(m.x)}${m.bold ? ' bold' : ''}`);
  }
  return lines.join('\n');
}
