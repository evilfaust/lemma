// Модель сцены + камера → примитивы для SVG. Чистая функция: её рисует
// React-холст (учитель и ученик), из неё же собирается SVG-строка для печати
// и самопроверки, по ней же ищется объект под курсором.

import { sub, lerp, len } from './vec3';
import { makeProjector } from './camera';
import { splitByVisibility, isPointHidden, isFaceFront } from './visibility';

export const STEREO_COLORS = {
  edge: '#1f2937',
  construct: '#1d4ed8',
  section: '#2563eb',
  sectionFill: '#3b82f6',
  plane: '#f59e0b',
  fill: '#10b981',
  point: '#111827',
  newPoint: '#dc2626',
  label: '#111827',
};

const WIDTH = { edge: 1.9, segment: 1.7, line: 1.5, ext: 1.3, section: 1.8 };
export const DASH = '6 4';

/** «A1» → { base: 'A', sub: '1' } */
export function splitLabel(name) {
  const m = /^([A-Z]+)([0-9]*)$/.exec(String(name));
  return m ? { base: m[1], sub: m[2] } : { base: String(name), sub: '' };
}

function labelBox(name) {
  const { base, sub: s } = splitLabel(name);
  return { w: 10 * base.length + 7 * s.length + 2, h: 16 };
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

const DIRS = Array.from({ length: 8 }, (_, k) => {
  const a = (k * Math.PI) / 4;
  return { x: Math.cos(a), y: -Math.sin(a) };
});

/** Подписи точек: 8 позиций вокруг точки, выбирается наименее занятая. */
function placeLabels(dots, strokes, center) {
  const placed = [];
  const out = [];
  const ordered = [...dots].sort((a, b) => (a.vertex === b.vertex ? 0 : a.vertex ? -1 : 1));
  for (const d of ordered) {
    const box = labelBox(d.name);
    const out2 = { x: d.x - center.x, y: d.y - center.y };
    const ol = Math.hypot(out2.x, out2.y) || 1;
    let best = null;
    for (const dir of DIRS) {
      const r = 9 + Math.abs(dir.x) * box.w / 2 + Math.abs(dir.y) * box.h / 2;
      const cx = d.x + dir.x * r;
      const cy = d.y + dir.y * r;
      let score = -2.5 * ((dir.x * out2.x + dir.y * out2.y) / ol);
      for (const p of placed) {
        const ox = Math.max(0, Math.min(cx + box.w / 2, p.x + p.w / 2) - Math.max(cx - box.w / 2, p.x - p.w / 2));
        const oy = Math.max(0, Math.min(cy + box.h / 2, p.y + p.h / 2) - Math.max(cy - box.h / 2, p.y - p.h / 2));
        if (ox > 0 && oy > 0) score += 20 + (ox * oy) / 10;
      }
      for (const s of strokes) {
        const dd = segDist(cx, cy, s.x1, s.y1, s.x2, s.y2);
        const lim = Math.min(box.w, box.h) / 2 + 2;
        if (dd < lim) score += (s.hidden ? 3 : 6) * (1 + (lim - dd) / lim);
      }
      for (const o of dots) {
        if (o === d) continue;
        if (Math.abs(o.x - cx) < box.w / 2 + 3 && Math.abs(o.y - cy) < box.h / 2 + 3) score += 12;
      }
      if (!best || score < best.score) best = { score, cx, cy };
    }
    placed.push({ x: best.cx, y: best.cy, w: box.w, h: box.h });
    const lb = splitLabel(d.name);
    out.push({ name: d.name, x: best.cx, y: best.cy, base: lb.base, sub: lb.sub, step: d.step });
  }
  return out;
}

/**
 * @param model   — evaluateScene(...)
 * @param camera  — { yaw, pitch, zoom }
 * @param viewport — { width, height }
 * @param [opts]  — { lastStep } — объекты этого шага подсвечиваются
 */
export function renderStereo(model, camera, viewport, opts = {}) {
  const { width, height } = viewport;
  const pr = makeProjector(camera, {
    width, height, center: model.viewCenter || model.center, radius: model.radius || model.body.size / 2,
  });
  const toViewer = pr.basis.toViewer;
  const P = (v) => pr.project(v);
  const body = model.body;

  // Заливки: сечения, плоскости, многоугольники.
  const polys = model.polys.map((pg) => {
    const pts = pg.pts.map(P);
    const color = pg.color || (pg.kind === 'plane' ? STEREO_COLORS.plane : pg.kind === 'fill' ? STEREO_COLORS.fill : STEREO_COLORS.sectionFill);
    return {
      id: pg.id,
      kind: pg.kind,
      points: pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      fill: color,
      opacity: pg.kind === 'plane' ? 0.2 : pg.kind === 'fill' ? 0.28 : 0.3,
      step: pg.step,
    };
  });

  // Линии: каждая режется на видимые и скрытые куски.
  const strokes = [];
  const hitLines = [];
  const pushSplit = (objId, kind, A, B, color, w, step) => {
    for (const piece of splitByVisibility(body, A, B, toViewer)) {
      const a = P(lerp(A, B, piece.t0));
      const b = P(lerp(A, B, piece.t1));
      strokes.push({
        id: `${objId}#${strokes.length}`, objId, kind,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        hidden: piece.hidden, color, width: w, step,
      });
    }
  };
  for (const o of model.lines) {
    const color = o.color || (o.kind === 'edge' ? STEREO_COLORS.edge : STEREO_COLORS.construct);
    pushSplit(o.id, o.kind, o.a, o.b, color, WIDTH[o.kind] || 1.5, o.step);
    const a = P(o.a);
    const b = P(o.b);
    hitLines.push({ id: o.id, kind: o.kind, ref: o.ref, x1: a.x, y1: a.y, x2: b.x, y2: b.y, a3: o.a, b3: o.b, p: o.p, u: o.u });
  }
  for (const pg of model.polys) {
    if (pg.kind !== 'section') continue;
    const color = pg.color || STEREO_COLORS.section;
    pg.pts.forEach((A, i) => {
      const B = pg.pts[(i + 1) % pg.pts.length];
      if (len(sub(B, A)) < 1e-9) return;
      pushSplit(`${pg.id}:e${i}`, 'section', A, B, color, WIDTH.section, pg.step);
    });
  }

  // Точки.
  const dots = [];
  for (const name of model.pointOrder) {
    const pt = model.points[name];
    if (pt.alias) continue;
    const s = P(pt.pos);
    dots.push({
      name, x: s.x, y: s.y, vertex: pt.kind === 'vertex', step: pt.step,
      hidden: isPointHidden(body, pt.pos, toViewer),
    });
  }
  const c2 = P(model.center);
  const labels = placeLabels(dots, strokes, c2);

  // Грани — для выбора кликом (передние первыми).
  const faces = body.faces.map((f) => ({
    id: f.id,
    verts: f.verts,
    pts: f.verts.map((v) => P(body.vertices[v])),
    front: isFaceFront(f, toViewer),
  }));

  return {
    width, height, scale: pr.scale, project: pr.project, unproject: pr.unproject,
    polys, strokes, dots, labels,
    hits: { lines: hitLines, faces, points: dots },
    lastStep: opts.lastStep ?? null,
  };
}

// --- выбор объекта под курсором ------------------------------------------------

/** Ближайшая точка в пределах tol пикселей. */
export function pickPoint(frame, x, y, tol = 12) {
  let best = null;
  for (const d of frame.hits.points) {
    const dd = Math.hypot(d.x - x, d.y - y);
    if (dd <= tol && (!best || dd < best.d)) best = { d: dd, name: d.name };
  }
  return best?.name || null;
}

/**
 * Ближайшая линия; t — доля вдоль её 3D-отрезка (проекция параллельная,
 * поэтому доля на экране и в пространстве совпадает).
 */
export function pickLine(frame, x, y, tol = 9) {
  let best = null;
  for (const l of frame.hits.lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const L = dx * dx + dy * dy;
    if (L < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((x - l.x1) * dx + (y - l.y1) * dy) / L));
    const dd = Math.hypot(x - (l.x1 + dx * t), y - (l.y1 + dy * t));
    if (dd <= tol && (!best || dd < best.d)) best = { d: dd, line: l, t };
  }
  if (!best) return null;
  const { line, t } = best;
  const pos = lerp(line.a3, line.b3, t);
  return { line, t, pos };
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

/** Грань под курсором: передняя, если есть; иначе задняя. */
export function pickFace(frame, x, y, { back = false } = {}) {
  const hits = frame.hits.faces.filter((f) => pointInPoly(x, y, f.pts));
  if (!hits.length) return null;
  const front = hits.filter((f) => f.front);
  const backs = hits.filter((f) => !f.front);
  if (back && backs.length) return backs[0];
  return (front[0] || backs[0]) ?? null;
}

// --- SVG-строка (печать, самопроверка) ------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * SVG-строка кадра.
 * @param opts.background — белый фон (для файла); в тексте задачи — прозрачный
 * @param opts.responsive — ширина 100 % с потолком maxWidth (блок в задаче/теории)
 * @param opts.mono       — только чёрная краска (печатный стек Lemma): линии
 *                          чёрные, заливки — светло-серые
 */
export function stereoSvgString(frame, opts = {}) {
  const { background = true, responsive = false, mono = false, maxWidth = frame.width } = opts;
  const ink = (c) => (mono ? '#000000' : c);
  const parts = [];
  const size = responsive
    ? `width="100%" style="max-width:${maxWidth}px;height:auto;display:block;margin:0 auto"`
    : `width="${frame.width}" height="${frame.height}"`;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="stereo-svg" ${size} viewBox="0 0 ${frame.width} ${frame.height}">`);
  if (background) parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  for (const pg of frame.polys) {
    const fill = mono ? '#000000' : pg.fill;
    const op = mono ? Math.min(0.14, pg.opacity * 0.45) : pg.opacity;
    parts.push(`<polygon points="${pg.points}" fill="${esc(fill)}" fill-opacity="${op}" stroke="none"/>`);
  }
  const line = (s) => {
    const w = (s.hidden ? s.width * 0.8 : s.width) * (mono && s.kind !== 'edge' && s.kind !== 'section' ? 0.85 : 1);
    return `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${esc(ink(s.color))}" stroke-width="${w.toFixed(2)}" stroke-linecap="round"${s.hidden ? ` stroke-dasharray="${DASH}"` : ''}/>`;
  };
  for (const s of frame.strokes) if (s.hidden) parts.push(line(s));
  for (const s of frame.strokes) if (!s.hidden) parts.push(line(s));
  for (const d of frame.dots) {
    parts.push(`<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.vertex ? 2.4 : 3.2}" fill="${STEREO_COLORS.point}"/>`);
  }
  for (const l of frame.labels) {
    parts.push(
      `<text x="${l.x.toFixed(2)}" y="${(l.y + 5).toFixed(2)}" text-anchor="middle" font-family="'Times New Roman', Times, serif" font-style="italic" font-size="17" fill="${STEREO_COLORS.label}">${esc(l.base)}${l.sub ? `<tspan dy="4" font-size="11">${esc(l.sub)}</tspan>` : ''}</text>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

