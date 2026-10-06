// Модель сцены + вид → примитивы для SVG. Чистая функция: её рисует
// React-холст редактора, из неё же собирается SVG-строка для задач, теории и
// печати, по ней же ищется объект под курсором.
//
// Вид — { cx, cy, scale }: точка мира в центре кадра и пикселей на единицу.
// Пометки (дуги углов, штрихи равных отрезков, подписи) имеют постоянный
// экранный размер, поэтому считаются здесь, а не в модели.

import { add, sub, mul, len, lerp, dist } from './vec2';
import { POINT_COLORS, pointColorHex, colorKeyFromWord, splitLabel } from '../stereo/render';

export { POINT_COLORS, pointColorHex, colorKeyFromWord, splitLabel };

export const PLANIM_COLORS = {
  ink: '#1f2937',
  aux: '#475569',
  fill: '#3b82f6',
  point: '#111827',
  label: '#111827',
  active: '#dc2626',
  grid: '#e5e7eb',
  gridAxis: '#cbd5e1',
};

// Шрифты подписей — те же, что у формул KaTeX в условии: буква A на чертеже
// выглядит как $A$ в тексте. Times — запасной (SVG картинкой <img> шрифтов
// страницы не видит).
export const LABEL_FONT = "KaTeX_Math, 'Times New Roman', Times, serif";
export const MARK_FONT = "KaTeX_Main, 'Times New Roman', Times, serif";

/** Буква точки — 17 единиц кадра (её высоту на бумаге задаёт масштаб кадра). */
export const LABEL_SIZE = 17;

const WIDTH = { side: 1.8, segment: 1.7, line: 1.4, ray: 1.4, ext: 1.0, circle: 1.6 };
const PAINTED = 1.35;
export const DASH = '6 4';

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', phi: 'φ', varphi: 'φ', psi: 'ψ', omega: 'ω',
  theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
  альфа: 'α', бета: 'β', гамма: 'γ', дельта: 'δ', фи: 'φ', пси: 'ψ', омега: 'ω', тета: 'θ',
};

/** Подпись пометки: «sqrt(3)» → «√3», «\alpha» / «альфа» → «α», «^\circ» → «°». */
export function formatMarkText(text) {
  return String(text ?? '')
    .replace(/\$/g, '')
    .replace(/\\sqrt\{([^}]*)\}/g, '√$1')
    .replace(/sqrt\(([^)]*)\)/gi, '√$1')
    .replace(/\^\s*\{?\\circ\}?|\\circ|\\degree/g, '°')
    .replace(/\\?([A-Za-zА-Яа-яё]+)/g, (w, name) => GREEK[name.toLowerCase()] || (w.startsWith('\\') ? name : w))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Курсивом — если в подписи есть буквы (x, a, α); число и градусы — прямым. */
const isItalic = (text) => /[A-Za-zα-ω]/.test(text);

const textWidth = (text, size = 15) => Math.max(6, String(text).length * size * 0.56);

/** Вид, в который чертёж вписан целиком. */
export function fitView(model, viewport, { padding = 40, maxScale = 120, minScale = 2 } = {}) {
  const { width, height } = viewport;
  const b = model?.bbox;
  if (!b) return { cx: 3, cy: 2, scale: 50 };
  const bw = Math.max(b.x1 - b.x0, 1e-9);
  const bh = Math.max(b.y1 - b.y0, 1e-9);
  const availW = Math.max(40, width - 2 * padding);
  const availH = Math.max(40, height - 2 * padding);
  let scale = Math.min(availW / bw, availH / bh);
  if (!Number.isFinite(scale) || bw < 1e-6 && bh < 1e-6) scale = 50;
  scale = Math.min(maxScale, Math.max(minScale, scale));
  return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, scale };
}

export const SCALE_MIN = 2;
export const SCALE_MAX = 400;

export function clampView(view) {
  const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Number(view?.scale) || 50));
  return { cx: Number(view?.cx) || 0, cy: Number(view?.cy) || 0, scale };
}

/**
 * Шаг сетки редактора — единичная клетка, пока она различима (дальше 2, 5, 10…).
 * Свободные точки прилипают к половине шага: к узлам и серединам клеток.
 */
export function gridStep(scale) {
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (s * scale >= 18) return s;
  return 1000;
}

/** Шаг линий сетки на экране: при крупном масштабе видны и половинки клеток. */
export function gridLineStep(scale) {
  const s = gridStep(scale);
  return s * scale >= 64 ? s / 2 : s;
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function labelBox(name) {
  const { base, sub: s } = splitLabel(name);
  return { w: 10 * base.length + 7 * s.length + 2, h: 16 };
}

const DIRS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return { x: Math.cos(a), y: -Math.sin(a) };
});

/**
 * Буквы точек: 8 позиций вокруг точки, выбирается наименее занятая; учитель
 * может задать угол сам (labelAngle).
 */
function placeLabels(dots, obstacles, center, extraBoxes) {
  const placed = [...extraBoxes];
  const out = [];
  for (const d of dots) {
    const box = labelBox(d.name);
    const lb = splitLabel(d.name);
    const push = (cx, cy, dir) => {
      placed.push({ x: cx, y: cy, w: box.w, h: box.h });
      out.push({
        name: d.name, x: cx, y: cy, base: lb.base, sub: lb.sub, step: d.step,
        color: d.color || null, ghost: !!d.ghost, w: box.w, h: box.h, px: d.x, py: d.y, manual: dir == null,
      });
    };
    if (Number.isFinite(d.labelAngle)) {
      const a = (d.labelAngle * Math.PI) / 180;
      const dir = { x: Math.cos(a), y: -Math.sin(a) };
      const r = 9 + Math.abs(dir.x) * box.w / 2 + Math.abs(dir.y) * box.h / 2;
      push(d.x + dir.x * r, d.y + dir.y * r, null);
      continue;
    }
    const away = { x: d.x - center.x, y: d.y - center.y };
    const al = Math.hypot(away.x, away.y) || 1;
    let best = null;
    for (const dir of DIRS) {
      const r = 9 + Math.abs(dir.x) * box.w / 2 + Math.abs(dir.y) * box.h / 2;
      const cx = d.x + dir.x * r;
      const cy = d.y + dir.y * r;
      let score = -2.5 * ((dir.x * away.x + dir.y * away.y) / al);
      for (const p of placed) {
        const ox = Math.max(0, Math.min(cx + box.w / 2, p.x + p.w / 2) - Math.max(cx - box.w / 2, p.x - p.w / 2));
        const oy = Math.max(0, Math.min(cy + box.h / 2, p.y + p.h / 2) - Math.max(cy - box.h / 2, p.y - p.h / 2));
        if (ox > 0 && oy > 0) score += 20 + (ox * oy) / 10;
      }
      const lim = Math.min(box.w, box.h) / 2 + 3;
      for (const s of obstacles) {
        const dd = segDist(cx, cy, s.x1, s.y1, s.x2, s.y2);
        if (dd < lim) score += 6 * (1 + (lim - dd) / lim);
      }
      for (const o of dots) {
        if (o === d) continue;
        if (Math.abs(o.x - cx) < box.w / 2 + 3 && Math.abs(o.y - cy) < box.h / 2 + 3) score += 12;
      }
      if (!best || score < best.score) best = { score, cx, cy };
    }
    push(best.cx, best.cy, true);
  }
  return out;
}

/** Куски линии [0; 1] со стилем отрезков (цвет, пунктир); позднее — главнее. */
export function stylePieces(ranges) {
  const cuts = [...new Set([0, 1, ...ranges.flatMap((r) => [r.t0, r.t1])])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i];
    const t1 = cuts[i + 1];
    if (t1 - t0 <= 1e-9) continue;
    const mid = (t0 + t1) / 2;
    let color = null;
    let dash = false;
    for (const r of ranges) {
      if (r.t0 <= mid && mid <= r.t1) {
        if (r.color) color = r.color;
        if (r.dash) dash = true;
      }
    }
    const last = out[out.length - 1];
    if (last && last.color === color && last.dash === dash) last.t1 = t1;
    else out.push({ t0, t1, color, dash });
  }
  return out;
}

const norm = (a) => {
  let x = a;
  while (x <= -Math.PI) x += 2 * Math.PI;
  while (x > Math.PI) x -= 2 * Math.PI;
  return x;
};

/**
 * @param model    — evaluateScene(...)
 * @param view     — { cx, cy, scale }
 * @param viewport — { width, height }
 * @param [opts]   — { grid: boolean } — клетчатый фон (единичные клетки);
 *                   markSize — кегль подписей пометок (по умолчанию 15)
 */
export function renderPlanim(model, view, viewport, opts = {}) {
  const { width, height } = viewport;
  const { cx, cy, scale } = view;
  const P = (v) => ({ x: width / 2 + (v.x - cx) * scale, y: height / 2 - (v.y - cy) * scale });
  const toWorld = (x, y) => ({ x: cx + (x - width / 2) / scale, y: cy - (y - height / 2) / scale });

  // Заливки.
  const polys = model.polys.map((pg) => {
    const pts = pg.pts.map(P);
    return {
      id: pg.id, pts, step: pg.step,
      points: pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      fill: pointColorHex(pg.color) || PLANIM_COLORS.fill,
      opacity: 0.22,
    };
  });

  // Линии: каждая режется на куски по стилю отрезков.
  const strokes = [];
  const hitLines = [];
  for (const o of model.lines) {
    const base = WIDTH[o.kind] || 1.5;
    const baseColor = o.kind === 'ext' ? PLANIM_COLORS.aux : PLANIM_COLORS.ink;
    const pieces = o.ranges?.length ? stylePieces(o.ranges) : [{ t0: 0, t1: 1, color: null, dash: false }];
    for (const pc of pieces) {
      const a = P(lerp(o.a, o.b, pc.t0));
      const b = P(lerp(o.a, o.b, pc.t1));
      strokes.push({
        id: `${o.id}#${strokes.length}`, objId: o.id, kind: o.kind,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        color: pc.color ? pointColorHex(pc.color) || pc.color : baseColor,
        width: base * (pc.color ? PAINTED : 1), dash: pc.dash, painted: !!pc.color, step: o.step,
      });
    }
    const a = P(o.a);
    const b = P(o.b);
    hitLines.push({ id: o.id, kind: o.kind, ref: o.ref, x1: a.x, y1: a.y, x2: b.x, y2: b.y, a: o.a, b: o.b, p: o.p, u: o.u });
  }

  // Окружности.
  const circles = model.circles.map((c) => {
    const s = P(c.c);
    return {
      id: c.id, ref: c.ref, cx: s.x, cy: s.y, r: c.r * scale, step: c.step,
      color: pointColorHex(c.color) || PLANIM_COLORS.ink,
      width: WIDTH.circle * (c.color ? PAINTED : 1), dash: c.dash, painted: !!c.color,
      c: c.c, rw: c.r,
    };
  });

  // Препятствия для подписей: линии и окружности (ломаной из 24 звеньев).
  const obstacles = strokes.map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 }));
  for (const c of circles) {
    for (let k = 0; k < 24; k++) {
      const a0 = (k * Math.PI) / 12;
      const a1 = ((k + 1) * Math.PI) / 12;
      obstacles.push({
        x1: c.cx + c.r * Math.cos(a0), y1: c.cy + c.r * Math.sin(a0),
        x2: c.cx + c.r * Math.cos(a1), y2: c.cy + c.r * Math.sin(a1),
      });
    }
  }

  const center = P(model.center);
  const texts = [];
  const reserved = [];
  // opId — шаг, чья это подпись (её двигают и правят мышью, pickMarkText).
  const markSize = opts.markSize || 15;
  const pushText = (id, x, y, raw, step, opId = id, size = markSize) => {
    const text = formatMarkText(raw);
    const w = textWidth(text, size);
    texts.push({ id, opId, x, y, text, italic: isItalic(text), size, step, w, h: size + 2 });
    reserved.push({ x, y, w, h: size + 2 });
  };

  // Пометки углов: дуги (или квадратик прямого угла) и подпись.
  const arcs = [];
  const arcsAtVertex = {};
  for (const an of model.angles) {
    const V = P(an.V);
    const va = sub(P(an.A), V);
    const vb = sub(P(an.B), V);
    const la = len(va);
    const lb = len(vb);
    if (la < 1e-6 || lb < 1e-6) continue;
    const ta = Math.atan2(va.y, va.x);
    const delta = norm(Math.atan2(vb.y, vb.x) - ta);
    const short = Math.min(la, lb);
    const key = an.names[1];
    const nth = arcsAtVertex[key] || 0;
    arcsAtVertex[key] = nth + 1;
    const midA = ta + delta / 2;
    if (an.right) {
      const s = Math.max(6, Math.min(11, short * 0.3));
      const ua = { x: va.x / la, y: va.y / la };
      const ub = { x: vb.x / lb, y: vb.y / lb };
      const p1 = { x: V.x + ua.x * s, y: V.y + ua.y * s };
      const p2 = { x: p1.x + ub.x * s, y: p1.y + ub.y * s };
      const p3 = { x: V.x + ub.x * s, y: V.y + ub.y * s };
      arcs.push({
        id: an.id, step: an.step, right: true,
        d: `M${p1.x.toFixed(2)} ${p1.y.toFixed(2)}L${p2.x.toFixed(2)} ${p2.y.toFixed(2)}L${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
        box: { x0: Math.min(p1.x, p2.x, p3.x, V.x), y0: Math.min(p1.y, p2.y, p3.y, V.y), x1: Math.max(p1.x, p2.x, p3.x, V.x), y1: Math.max(p1.y, p2.y, p3.y, V.y) },
      });
      if (an.label) {
        const at = an.at ? P(add(an.V, an.at)) : { x: V.x + Math.cos(midA) * (s + 16), y: V.y + Math.sin(midA) * (s + 16) };
        pushText(`${an.id}:t`, at.x, at.y + 5, an.label, an.step, an.id);
      }
      continue;
    }
    // Узкому углу — дуга подальше, иначе она сливается с вершиной.
    const sharp = Math.abs(delta) < 0.6 ? 1.5 : 1;
    const r0 = Math.max(9, Math.min(20 * sharp, short * 0.42)) + nth * 5;
    const parts = [];
    let rMax = r0;
    for (let k = 0; k < an.arcs; k++) {
      const r = r0 + k * 3.6;
      rMax = r;
      const x1 = V.x + r * Math.cos(ta);
      const y1 = V.y + r * Math.sin(ta);
      const x2 = V.x + r * Math.cos(ta + delta);
      const y2 = V.y + r * Math.sin(ta + delta);
      parts.push(`M${x1.toFixed(2)} ${y1.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${delta > 0 ? 1 : 0} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
    }
    arcs.push({
      id: an.id, step: an.step, right: false, d: parts.join(''),
      box: { x0: V.x - rMax, y0: V.y - rMax, x1: V.x + rMax, y1: V.y + rMax },
    });
    if (an.label) {
      const text = formatMarkText(an.label);
      const rl = Math.min(64, Math.max(rMax + 11, 9 / Math.max(0.12, Math.sin(Math.abs(delta) / 2)))) + textWidth(text, markSize) * 0.18;
      const at = an.at ? P(add(an.V, an.at)) : { x: V.x + Math.cos(midA) * rl, y: V.y + Math.sin(midA) * rl };
      pushText(`${an.id}:t`, at.x, at.y + 5, an.label, an.step, an.id);
    }
  }

  // Штрихи равных отрезков.
  const tickMarks = [];
  for (const t of model.ticks) {
    const a = P(t.a);
    const b = P(t.b);
    const L = dist(a, b);
    if (L < 1e-6) continue;
    const d = { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
    const n = { x: -d.y, y: d.x };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (let k = 0; k < t.n; k++) {
      const off = (k - (t.n - 1) / 2) * 4;
      const c = { x: mid.x + d.x * off, y: mid.y + d.y * off };
      tickMarks.push({
        id: `${t.id}:${k}`, opId: t.opId, step: t.step,
        x1: c.x - n.x * 5, y1: c.y - n.y * 5, x2: c.x + n.x * 5, y2: c.y + n.y * 5,
      });
    }
  }

  // Подписи отрезков — у середины. Сторона выбирается по занятости: где меньше
  // чужих линий; при равенстве — с внешней стороны фигуры.
  for (const ms of model.measures) {
    const a = P(ms.a);
    const b = P(ms.b);
    const L = dist(a, b);
    if (L < 1e-6) continue;
    // Подпись, которую учитель поставил мышью, — на её месте.
    if (ms.at) {
      const at = P(add(mul(add(ms.a, ms.b), 0.5), ms.at));
      pushText(ms.id, at.x, at.y + 5, ms.text, ms.step);
      continue;
    }
    const n0 = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L };
    const text = formatMarkText(ms.text);
    const w = textWidth(text, markSize);
    const lim = Math.max(w, 17) / 2 + 1;
    let best = null;
    // Сначала середина; если там тесно — подпись съезжает вдоль отрезка.
    for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) {
      const mid = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      for (const sign of [1, -1]) {
        const n = { x: n0.x * sign, y: n0.y * sign };
        const off = 11 + Math.abs(n.x) * w * 0.5;
        const x = mid.x + n.x * off;
        const y = mid.y + n.y * off;
        const outward = (mid.x - center.x) * n.x + (mid.y - center.y) * n.y;
        let score = Math.abs(t - 0.5) * 6;
        score += outward > 1e-6 ? -1 : outward < -1e-6 ? 0 : (n.y < 0 ? -0.5 : 0);
        for (const o of obstacles) {
          // Свой отрезок рядом по построению — считаем линии ближе 3/4 зазора.
          if (segDist(x, y, o.x1, o.y1, o.x2, o.y2) < Math.min(lim, off * 0.75)) score += 4;
        }
        for (const r of reserved) {
          if (Math.abs(r.x - x) < (r.w + w) / 2 + 6 && Math.abs(r.y - (y + 5)) < (r.h + 17) / 2) score += 6;
        }
        if (!best || score < best.score - 1e-9) best = { score, x, y };
      }
    }
    pushText(ms.id, best.x, best.y + 5, ms.text, ms.step);
  }

  for (const t of model.texts) {
    const s = P(t.pos);
    pushText(t.id, s.x, s.y + 5, t.text, t.step);
  }

  // Точки и их буквы.
  const dots = [];
  for (const name of model.pointOrder) {
    const pt = model.points[name];
    if (pt.alias) continue;
    const s = P(pt.pos);
    dots.push({
      name, x: s.x, y: s.y, step: pt.step, free: pt.kind === 'free',
      corner: !!pt.corner, ghost: !!pt.hidden,
      color: pointColorHex(pt.color), labelAngle: pt.labelAngle,
    });
  }
  for (const s of tickMarks) obstacles.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 });
  const labels = placeLabels(dots, obstacles, center, reserved);

  // Клетчатый фон.
  let grid = null;
  if (opts.grid) {
    const step = opts.gridStep || 1;
    const w0 = toWorld(0, height);
    const w1 = toWorld(width, 0);
    const xs = [];
    const ys = [];
    for (let gx = Math.ceil(w0.x / step - 1e-9) * step; gx <= w1.x + 1e-9; gx += step) xs.push(width / 2 + (gx - cx) * scale);
    for (let gy = Math.ceil(w0.y / step - 1e-9) * step; gy <= w1.y + 1e-9; gy += step) ys.push(height / 2 - (gy - cy) * scale);
    grid = { xs, ys, step };
  }

  return {
    width, height, scale, view, project: P, toWorld,
    polys, strokes, circles, arcs, tickMarks, texts, dots, labels, grid,
    hits: { lines: hitLines, circles, points: dots.filter((d) => !d.ghost || opts.showHidden), polys },
  };
}

// --- выбор объекта под курсором ------------------------------------------------

/** Ближайшая точка в пределах tol пикселей. */
export function pickPoint(frame, x, y, tol = 11) {
  let best = null;
  for (const d of frame.hits.points) {
    const dd = Math.hypot(d.x - x, d.y - y);
    if (dd <= tol && (!best || dd < best.d)) best = { d: dd, name: d.name };
  }
  return best?.name || null;
}

/** Все линии под курсором, ближайшая — первой. t — доля вдоль её отрезка. */
export function pickLines(frame, x, y, tol = 8) {
  const out = [];
  for (const l of frame.hits.lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const L = dx * dx + dy * dy;
    if (L < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((x - l.x1) * dx + (y - l.y1) * dy) / L));
    const dd = Math.hypot(x - (l.x1 + dx * t), y - (l.y1 + dy * t));
    if (dd <= tol) out.push({ d: dd, line: l, t, pos: lerp(l.a, l.b, t) });
  }
  return out.sort((a, b) => a.d - b.d);
}

export function pickLine(frame, x, y, tol = 8) {
  return pickLines(frame, x, y, tol)[0] || null;
}

/** Окружность под курсором; angle — угол точки на ней в градусах. */
export function pickCircle(frame, x, y, tol = 8) {
  let best = null;
  for (const c of frame.hits.circles) {
    const dd = Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r);
    if (dd <= tol && (!best || dd < best.d)) best = { d: dd, circle: c };
  }
  if (!best) return null;
  const w = frame.toWorld(x, y);
  const angle = (Math.atan2(w.y - best.circle.c.y, w.x - best.circle.c.x) * 180) / Math.PI;
  return { circle: best.circle, angle: (angle + 360) % 360 };
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Заливка под курсором (верхняя — нарисованная последней). */
export function pickPoly(frame, x, y) {
  for (let i = frame.polys.length - 1; i >= 0; i--) {
    const pg = frame.polys[i];
    if (pg.pts?.length >= 3 && pointInPoly(x, y, pg.pts)) return pg;
  }
  return null;
}

/**
 * Подпись пометки под курсором — надпись, «длина», подпись угла. Последняя
 * нарисованная — сверху, её и берём. В ответе opId — шаг журнала.
 */
export function pickMarkText(frame, x, y) {
  for (let i = frame.texts.length - 1; i >= 0; i--) {
    const t = frame.texts[i];
    if (Math.abs(x - t.x) <= t.w / 2 + 3 && Math.abs(y - (t.y - 5)) <= t.h / 2 + 2) return t;
  }
  return null;
}

/** Буква точки под курсором (её можно перетащить вокруг точки). */
export function pickLabel(frame, x, y) {
  for (const l of frame.labels) {
    if (Math.abs(x - l.x) <= l.w / 2 + 2 && Math.abs(y - l.y) <= l.h / 2 + 2) return l;
  }
  return null;
}

// --- SVG-строка (задача, теория, печать) ------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Нужно ли рисовать точку жирной на печатном чертеже. */
const dotVisible = (d) => !d.ghost && (!d.corner || !!d.color);

/** Габариты нарисованного с полем. */
export function contentBox(frame, pad = 8) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const s of frame.strokes) { add(s.x1, s.y1); add(s.x2, s.y2); }
  for (const s of frame.tickMarks) { add(s.x1, s.y1); add(s.x2, s.y2); }
  for (const c of frame.circles) { add(c.cx - c.r, c.cy - c.r); add(c.cx + c.r, c.cy + c.r); }
  for (const a of frame.arcs) { add(a.box.x0, a.box.y0); add(a.box.x1, a.box.y1); }
  for (const pg of frame.polys) for (const p of pg.pts) add(p.x, p.y);
  for (const d of frame.dots) if (!d.ghost) { add(d.x - 4, d.y - 4); add(d.x + 4, d.y + 4); }
  for (const l of frame.labels) {
    if (l.ghost) continue;
    add(l.x - l.w / 2 - 2, l.y - 11);
    add(l.x + l.w / 2 + 2, l.y + 10);
  }
  for (const t of frame.texts) { add(t.x - t.w / 2 - 2, t.y - t.h); add(t.x + t.w / 2 + 2, t.y + 5); }
  if (!Number.isFinite(x0)) return null;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

/**
 * SVG-строка кадра.
 * @param opts.background — белый фон (для файла); в тексте задачи — прозрачный
 * @param opts.responsive — ширина 100 % с потолком maxWidth
 * @param opts.mono       — только чёрная краска (печатный стек Lemma)
 * @param opts.crop       — обрезать по содержимому
 * @param opts.unitsPerMm — размер на бумаге: ширина и высота в мм (единиц
 *   кадра на миллиметр); чертёж не растягивается по контейнеру, только
 *   ужимается, если не влез
 */
export function planimSvgString(frame, opts = {}) {
  const { background = true, responsive = false, mono = false, crop = false } = opts;
  const ink = (c) => (mono ? '#000000' : c);
  const parts = [];
  let vb = { x: 0, y: 0, w: frame.width, h: frame.height };
  if (crop) {
    const b = contentBox(frame);
    if (b) vb = b;
  }
  // Клетчатый фон: рамка — по целым клеткам вокруг чертежа.
  let gridLines = null;
  if (frame.grid) {
    const step = frame.grid.step;
    const w0 = frame.toWorld(vb.x, vb.y + vb.h);
    const w1 = frame.toWorld(vb.x + vb.w, vb.y);
    const gx0 = (crop ? Math.floor(w0.x / step + 1e-9) : Math.ceil(w0.x / step - 1e-9)) * step;
    const gx1 = (crop ? Math.ceil(w1.x / step - 1e-9) : Math.floor(w1.x / step + 1e-9)) * step;
    const gy0 = (crop ? Math.floor(w0.y / step + 1e-9) : Math.ceil(w0.y / step - 1e-9)) * step;
    const gy1 = (crop ? Math.ceil(w1.y / step - 1e-9) : Math.floor(w1.y / step + 1e-9)) * step;
    if (crop) {
      const a = frame.project({ x: gx0, y: gy1 });
      const b = frame.project({ x: gx1, y: gy0 });
      vb = { x: a.x - 0.5, y: a.y - 0.5, w: b.x - a.x + 1, h: b.y - a.y + 1 };
    }
    gridLines = { xs: [], ys: [] };
    const nx = Math.round((gx1 - gx0) / step);
    const ny = Math.round((gy1 - gy0) / step);
    for (let i = 0; i <= nx && nx < 400; i++) gridLines.xs.push(frame.project({ x: gx0 + i * step, y: 0 }).x);
    for (let i = 0; i <= ny && ny < 400; i++) gridLines.ys.push(frame.project({ x: 0, y: gy0 + i * step }).y);
  }
  const maxWidth = Math.round(opts.maxWidth || vb.w);
  const k = opts.unitsPerMm;
  const size = k
    ? `width="${(vb.w / k).toFixed(2)}mm" height="${(vb.h / k).toFixed(2)}mm" style="width:${(vb.w / k).toFixed(2)}mm;max-width:100%;height:auto;display:block;margin:0 auto"`
    : responsive
      ? `width="100%" style="max-width:${maxWidth}px;height:auto;display:block;margin:0 auto"`
      : `width="${Math.round(vb.w)}" height="${Math.round(vb.h)}"`;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="stereo-svg planim-svg" ${size} viewBox="${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}">`);
  if (background) parts.push(`<rect x="${vb.x.toFixed(1)}" y="${vb.y.toFixed(1)}" width="${vb.w.toFixed(1)}" height="${vb.h.toFixed(1)}" fill="#ffffff"/>`);
  if (gridLines) {
    const gc = mono ? '#000000' : PLANIM_COLORS.gridAxis;
    const gw = mono ? 0.35 : 0.7;
    for (const x of gridLines.xs) {
      parts.push(`<line x1="${x.toFixed(2)}" y1="${vb.y.toFixed(2)}" x2="${x.toFixed(2)}" y2="${(vb.y + vb.h).toFixed(2)}" stroke="${gc}" stroke-width="${gw}"/>`);
    }
    for (const y of gridLines.ys) {
      parts.push(`<line x1="${vb.x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(vb.x + vb.w).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${gc}" stroke-width="${gw}"/>`);
    }
  }
  for (const pg of frame.polys) {
    parts.push(`<polygon points="${pg.points}" fill="${mono ? '#000000' : esc(pg.fill)}" fill-opacity="${mono ? 0.12 : pg.opacity}" stroke="none"/>`);
  }
  const dashAttr = (on) => (on ? ` stroke-dasharray="${DASH}"` : '');
  for (const c of frame.circles) {
    parts.push(`<circle cx="${c.cx.toFixed(2)}" cy="${c.cy.toFixed(2)}" r="${c.r.toFixed(2)}" fill="none" stroke="${esc(ink(c.color))}" stroke-width="${c.width.toFixed(2)}"${dashAttr(c.dash)}/>`);
  }
  for (const s of frame.strokes) {
    parts.push(`<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${esc(ink(s.color))}" stroke-width="${s.width.toFixed(2)}" stroke-linecap="round"${dashAttr(s.dash)}/>`);
  }
  for (const a of frame.arcs) {
    parts.push(`<path d="${a.d}" fill="none" stroke="${ink(PLANIM_COLORS.ink)}" stroke-width="1.1" stroke-linejoin="miter"/>`);
  }
  for (const s of frame.tickMarks) {
    parts.push(`<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${ink(PLANIM_COLORS.ink)}" stroke-width="1.2" stroke-linecap="round"/>`);
  }
  for (const d of frame.dots) {
    if (!dotVisible(d)) continue;
    const r = d.color ? (mono ? 3.6 : 3.4) : 2.4;
    const fill = d.color && !mono ? d.color : PLANIM_COLORS.point;
    parts.push(`<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${r}" fill="${fill}"/>`);
  }
  const halo = ' paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"';
  for (const l of frame.labels) {
    if (l.ghost) continue;
    parts.push(
      `<text x="${l.x.toFixed(2)}" y="${(l.y + 5).toFixed(2)}" text-anchor="middle" font-family="${LABEL_FONT}" font-style="italic" font-size="${LABEL_SIZE}"${l.color && mono ? ' font-weight="bold"' : ''} fill="${l.color && !mono ? l.color : PLANIM_COLORS.label}"${halo}>${esc(l.base)}${l.sub ? `<tspan dy="4" font-size="11">${esc(l.sub)}</tspan>` : ''}</text>`,
    );
  }
  for (const t of frame.texts) {
    parts.push(
      `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" text-anchor="middle" font-family="${t.italic ? LABEL_FONT : MARK_FONT}"${t.italic ? ' font-style="italic"' : ''} font-size="${t.size}" fill="${PLANIM_COLORS.label}"${halo}>${esc(t.text)}</text>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}
