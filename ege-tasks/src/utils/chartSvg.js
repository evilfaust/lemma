// Графики и диаграммы «из жизни» для базы №3/№7: температура по суткам,
// среднемесячные значения столбиками, разогрев двигателя, крутящий момент.
//
// Координатная плоскость `coordPlot` здесь не годится: у неё клетка
// квадратная и оси математические (x, y, O, стрелки), а у практических
// графиков свои шкалы (обороты тысячами, градусы, часы суток), подписи дат
// под осью и столбики. Поэтому — отдельный маленький рендер в SVG-строку.
//
// Модель чертежа (`chart`) — простой JSON: он сохраняется вместе с листом в
// `generator_sheets`, поэтому ни функций, ни классов внутри нет.
//
//   type      'line' | 'bar'
//   x         { min, max, grid?, ticks: [{ v, label }], groups?: [{ from, to, label }], unit? }
//   y         { min, max, grid, labelEvery, unit? }
//   series    [{ points: [[x, y], …], smooth?, dots? }]      — линии
//   bars      [{ x, v }], barWidth                             — столбики
//
// Краска только чёрная (правило печатного стека: серое на ч/б принтере
// пропадает), иерархия — толщиной: клетка волосяная, оси и линия графика
// плотные, столбики залиты целиком.

import { buildSpline } from './splineCurve';

const FONT = "'Helvetica Neue', Arial, sans-serif";
const INK = '#000';

const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Число по-русски: минус U+2212 и десятичная запятая. */
export function fmtNum(v) {
  const s = String(Math.round(v * 1000) / 1000).replace('.', ',');
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

const text = (x, y, s, { size = 9, anchor = 'middle', weight } = {}) => (
  `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" font-family="${FONT}" text-anchor="${anchor}"`
  + `${weight ? ` font-weight="${weight}"` : ''} fill="${INK}">${esc(s)}</text>`
);

const line = (x1, y1, x2, y2, w = 1) => (
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${INK}" stroke-width="${w}"/>`
);

// Поля холста: слева — подписи шкалы, снизу — подписи оси (и строка дат),
// справа — единица оси x, сверху — единица оси y.
function paddings(chart) {
  const yLabelW = Math.max(
    ...gridValues(chart.y).filter((v) => isLabelled(chart.y, v)).map((v) => fmtNum(v).length),
  ) * 5.2 + 6;
  return {
    l: Math.max(18, yLabelW),
    // Справа — единица оси x, а без неё хотя бы половина последней подписи
    // («24:00» у края иначе срезалась)
    r: Math.max(
      chart.x.unit ? 8 + chart.x.unit.length * 5 : 8,
      (String(chart.x.ticks?.at(-1)?.label ?? '').length * 4.8) / 2 + 3,
    ),
    t: chart.y.unit ? 16 : 8,
    b: 15 + (chart.x.groups?.length ? 12 : 0),
  };
}

function gridValues({ min, max, grid }) {
  const out = [];
  const n = Math.round((max - min) / grid);
  for (let i = 0; i <= n; i += 1) out.push(min + i * grid);
  return out;
}

// Подписываются значения, кратные labelEvery (0 попадает всегда, если в окне).
function isLabelled({ labelEvery, grid }, v) {
  const k = labelEvery || grid;
  return Math.abs(v / k - Math.round(v / k)) < 1e-6;
}

/** Точки линии в координатах данных: гладкая — через монотонный сплайн. */
export function seriesPath(series) {
  const pts = series.points;
  if (!series.smooth || pts.length < 3) return pts;
  const spline = buildSpline(pts.map(([x, y]) => ({ x, y })));
  if (!spline.ok) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [a] = pts[i];
    const [b] = pts[i + 1];
    for (let k = 0; k < 24; k += 1) {
      const x = a + ((b - a) * k) / 24;
      out.push([x, spline.f(x)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Чертёж → SVG-строка.
 * @param {object} chart
 * @param {{ width?: number, height?: number }} opts — размер холста (px)
 */
export function chartSvg(chart, { width = 300, height = 180 } = {}) {
  if (!chart || !chart.x || !chart.y) return '';
  const W = width;
  const H = height;
  const P = paddings(chart);
  const pw = W - P.l - P.r;
  const ph = H - P.t - P.b;
  const { x, y } = chart;
  const sx = (v) => P.l + ((v - x.min) / (x.max - x.min)) * pw;
  const sy = (v) => P.t + ((y.max - v) / (y.max - y.min)) * ph;
  const bottom = P.t + ph;
  const parts = [];

  // 1) Клетка: горизонтали всегда, вертикали — у графиков с непрерывной осью
  for (const v of gridValues(y)) parts.push(line(P.l, sy(v), P.l + pw, sy(v), 0.35));
  if (x.grid) for (const v of gridValues({ min: x.min, max: x.max, grid: x.grid })) {
    parts.push(line(sx(v), P.t, sx(v), bottom, 0.35));
  }

  // 2) Столбики (под осями, чтобы ось нуля шла поверх)
  if (chart.type === 'bar') {
    const bw = ((chart.barWidth || 0.6) / (x.max - x.min)) * pw;
    for (const b of chart.bars || []) {
      const top = sy(Math.max(b.v, 0));
      const h = Math.abs(sy(b.v) - sy(0));
      if (h > 0) {
        parts.push(`<rect x="${r2(sx(b.x) - bw / 2)}" y="${r2(top)}" width="${r2(bw)}" height="${r2(h)}" fill="${INK}"/>`);
      }
    }
  }

  // 3) Оси: левая и нижняя рамка; ноль, если он внутри окна, — плотной линией
  parts.push(line(P.l, P.t, P.l, bottom, 1));
  parts.push(line(P.l, bottom, P.l + pw, bottom, 1));
  if (y.min < 0 && y.max > 0) parts.push(line(P.l, sy(0), P.l + pw, sy(0), 1.2));

  // 4) Подписи шкалы y и единицы осей
  for (const v of gridValues(y)) {
    if (isLabelled(y, v)) parts.push(text(P.l - 3, sy(v) + 3, fmtNum(v), { anchor: 'end' }));
  }
  if (y.unit) parts.push(text(P.l - 3, P.t - 6, y.unit, { anchor: 'start', size: 9 }));
  if (x.unit) parts.push(text(P.l + pw + 4, bottom + 3, x.unit, { anchor: 'start', size: 9 }));

  // 5) Подписи оси x и строка дат под ними
  for (const t of x.ticks || []) {
    parts.push(line(sx(t.v), bottom, sx(t.v), bottom + 2.5, 0.8));
    parts.push(text(sx(t.v), bottom + 11, t.label, { size: 8.5 }));
  }
  for (const g of x.groups || []) {
    parts.push(text((sx(g.from) + sx(g.to)) / 2, H - 2, g.label, { size: 8.5 }));
  }
  if (x.groups?.length) {
    const edges = new Set(x.groups.flatMap((g) => [g.from, g.to]));
    for (const v of edges) parts.push(line(sx(v), bottom, sx(v), H - 1, 0.5));
  }

  // 6) Линии графика и точки измерений
  for (const s of chart.series || []) {
    const pts = seriesPath(s);
    const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${r2(sx(px))},${r2(sy(py))}`).join('');
    parts.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`);
    if (s.dots) {
      for (const [px, py] of s.points) {
        parts.push(`<circle cx="${r2(sx(px))}" cy="${r2(sy(py))}" r="2.1" fill="${INK}"/>`);
      }
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg" class="chart-svg" role="img">${parts.join('')}</svg>`;
}
