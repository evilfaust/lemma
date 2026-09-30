import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  renderPlanim, fitView, clampView, gridLineStep, DASH, PLANIM_COLORS,
} from '../../utils/planim/render';
import '../stereo/stereo.css';
import './planim.css';

const DRAG_START_PX = 4;

/**
 * Холст планиметрического чертежа.
 *
 * Мышь/палец: нажатие на цель (точку, букву) и сдвиг — перетаскивание цели,
 * по пустому месту — сдвиг чертежа; колёсико/щипок — масштаб вокруг курсора.
 * Короткий клик без сдвига уходит в onClick — им живут инструменты редактора.
 *
 * @param view      — { cx, cy, scale } или null: «вписать» (холст посчитает
 *                    вид сам и отдаст его в onViewChange — дальше вид не прыгает)
 * @param highlight — { points:Set, lines:Set, circles:Set, polys:Set } — выбор инструмента
 * @param flashStep — номер шага, чьи объекты вспыхивают (новое на чертеже)
 * @param getDragTarget — (pt, frame) → цель или null
 * @param onDrag    — ({ phase: 'start'|'move'|'end', x, y, frame, target, altKey })
 */
export default function PlanimCanvas({
  model,
  view,
  onViewChange,
  onClick,
  onHover,
  onDoubleClick,
  getDragTarget,
  onDrag,
  highlight = null,
  flashStep = null,
  showGrid = true,
  cursor = 'default',
  className = '',
  style,
  ariaLabel = 'Планиметрический чертёж',
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.max(0, Math.round(r.width)), height: Math.max(0, Math.round(r.height)) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size.width >= 40 && size.height >= 40;
  const effView = useMemo(
    () => (view ? clampView(view) : ready ? fitView(model, size, { padding: 56 }) : null),
    [view, ready, model, size],
  );
  const viewRef = useRef(effView);
  viewRef.current = effView;

  // «Вписать» считается один раз: дальше вид фиксирован, и новые точки не
  // заставляют чертёж прыгать.
  useEffect(() => {
    if (!view && effView && onViewChange) onViewChange(effView);
  }, [view, effView, onViewChange]);

  const frame = useMemo(() => {
    if (!model || !effView || !ready) return null;
    return renderPlanim(model, effView, size, {
      grid: showGrid, gridStep: gridLineStep(effView.scale), showHidden: true,
    });
  }, [model, effView, size, ready, showGrid]);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // --- жесты ------------------------------------------------------------------
  const gesture = useRef({ pointers: new Map(), mode: null, start: null });

  const local = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchDist = () => {
    const p = [...gesture.current.pointers.values()];
    return p.length >= 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;
  };
  const panStart = (pt) => ({ x: pt.x, y: pt.y, cx: viewRef.current?.cx || 0, cy: viewRef.current?.cy || 0 });

  const handleDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const g = gesture.current;
    if (g.mode === 'drag') return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* нет захвата — не страшно */ }
    const pt = local(e);
    g.pointers.set(e.pointerId, pt);
    if (g.pointers.size === 2) {
      g.mode = 'pinch';
      g.start = { dist: pinchDist() || 1, scale: viewRef.current?.scale || 50 };
    } else if (g.pointers.size === 1) {
      g.mode = 'press';
      const target = getDragTarget && frameRef.current ? getDragTarget(pt, frameRef.current) : null;
      g.start = { ...panStart(pt), target };
    }
  };

  const handleMove = (e) => {
    const g = gesture.current;
    const pt = local(e);
    if (!g.pointers.has(e.pointerId)) {
      if (onHover && frameRef.current && e.pointerType === 'mouse') onHover({ ...pt, frame: frameRef.current, altKey: e.altKey });
      return;
    }
    g.pointers.set(e.pointerId, pt);
    if (g.mode === 'pinch' && g.pointers.size >= 2) {
      const d = pinchDist();
      if (d > 0 && viewRef.current) onViewChange?.(clampView({ ...viewRef.current, scale: g.start.scale * (d / g.start.dist) }));
      return;
    }
    if (g.mode === 'drag') {
      onDrag?.({ phase: 'move', ...pt, frame: frameRef.current, target: g.start.target, altKey: e.altKey });
      return;
    }
    if (g.mode === 'press' || g.mode === 'pan') {
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (g.mode === 'press' && Math.hypot(dx, dy) < DRAG_START_PX) return;
      if (g.mode === 'press' && g.start.target && onDrag) {
        g.mode = 'drag';
        onDrag({ phase: 'start', ...pt, frame: frameRef.current, target: g.start.target, altKey: e.altKey });
        onDrag({ phase: 'move', ...pt, frame: frameRef.current, target: g.start.target, altKey: e.altKey });
        return;
      }
      g.mode = 'pan';
      const sc = viewRef.current?.scale || 50;
      onViewChange?.(clampView({ cx: g.start.cx - dx / sc, cy: g.start.cy + dy / sc, scale: sc }));
    }
  };

  const handleUp = (e) => {
    const g = gesture.current;
    const wasPress = g.mode === 'press' && g.pointers.size === 1;
    if (g.mode === 'drag') {
      onDrag?.({ phase: 'end', ...local(e), frame: frameRef.current, target: g.start.target });
      g.pointers.delete(e.pointerId);
      g.mode = g.pointers.size ? 'pan' : null;
      if (g.pointers.size) g.start = panStart([...g.pointers.values()][0]);
      return;
    }
    g.pointers.delete(e.pointerId);
    if (wasPress && onClick && frameRef.current) {
      onClick({ ...local(e), frame: frameRef.current, shiftKey: e.shiftKey, altKey: e.altKey });
    }
    if (g.pointers.size === 1) {
      g.mode = 'pan';
      g.start = panStart([...g.pointers.values()][0]);
    } else if (g.pointers.size === 0) {
      g.mode = null;
    }
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      const f = frameRef.current;
      if (!v || !f) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      // Точка под курсором остаётся на месте.
      const w = f.toWorld(x, y);
      const next = clampView({ ...v, scale: v.scale * Math.exp(-e.deltaY * 0.0015) });
      next.cx = w.x - (x - f.width / 2) / next.scale;
      next.cy = w.y + (y - f.height / 2) / next.scale;
      onViewChange?.(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onViewChange]);

  // --- отрисовка ----------------------------------------------------------------
  const isFlash = (step) => flashStep != null && step === flashStep;
  const hlLine = (s) => highlight?.lines?.has(s.objId);

  return (
    <div ref={wrapRef} className={`stereo-canvas planim-canvas ${className}`} style={style}>
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        role="img"
        aria-label={ariaLabel}
        style={{ cursor, touchAction: 'none' }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onDoubleClick={onDoubleClick && ((e) => {
          if (frameRef.current) onDoubleClick({ ...local(e), frame: frameRef.current });
        })}
      >
        {frame && (
          <>
            {frame.grid && (
              <g className="planim-grid">
                {frame.grid.xs.map((x) => <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={frame.height} />)}
                {frame.grid.ys.map((y) => <line key={`gy${y}`} x1={0} y1={y} x2={frame.width} y2={y} />)}
              </g>
            )}
            {frame.polys.map((pg) => (
              <polygon
                key={pg.id}
                points={pg.points}
                fill={pg.fill}
                fillOpacity={highlight?.polys?.has(pg.id) ? 0.45 : pg.opacity}
                stroke="none"
                className={isFlash(pg.step) ? 'stereo-flash-fill' : undefined}
              />
            ))}
            {frame.circles.map((c) => {
              const hl = highlight?.circles?.has(c.id);
              return (
                <circle
                  key={c.id}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill="none"
                  stroke={hl ? PLANIM_COLORS.active : c.color}
                  strokeWidth={c.width + (hl ? 1.2 : 0)}
                  strokeDasharray={c.dash ? DASH : undefined}
                  className={isFlash(c.step) ? 'stereo-flash' : undefined}
                />
              );
            })}
            {frame.strokes.map((s) => {
              const hl = hlLine(s);
              return (
                <line
                  key={s.id}
                  x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke={hl ? PLANIM_COLORS.active : s.color}
                  strokeWidth={s.width + (hl ? 1.3 : 0)}
                  strokeDasharray={s.dash ? DASH : undefined}
                  strokeLinecap="round"
                  className={isFlash(s.step) ? 'stereo-flash' : undefined}
                />
              );
            })}
            {frame.arcs.map((a) => (
              <path
                key={a.id}
                d={a.d}
                fill="none"
                stroke={PLANIM_COLORS.ink}
                strokeWidth={1.1}
                className={isFlash(a.step) ? 'stereo-flash' : undefined}
              />
            ))}
            {frame.tickMarks.map((s) => (
              <line
                key={s.id}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={PLANIM_COLORS.ink}
                strokeWidth={1.2}
                strokeLinecap="round"
                className={isFlash(s.step) ? 'stereo-flash' : undefined}
              />
            ))}
            {frame.dots.map((d) => {
              const hl = highlight?.points?.has(d.name);
              // Вершина-угол печатается без точки; в редакторе она видна бледной —
              // за неё удобно браться.
              const base = d.color ? 4 : d.corner ? 2.2 : 3;
              return (
                <circle
                  key={`p-${d.name}`}
                  cx={d.x}
                  cy={d.y}
                  r={base + (hl ? 2 : 0)}
                  fill={hl ? PLANIM_COLORS.active : d.color || (d.corner ? '#94a3b8' : d.free ? '#1d4ed8' : PLANIM_COLORS.point)}
                  opacity={d.ghost ? 0.3 : 1}
                  className={isFlash(d.step) ? 'stereo-flash-dot' : undefined}
                />
              );
            })}
            {frame.labels.map((l) => (
              <text
                key={`l-${l.name}`}
                x={l.x}
                y={l.y + 5}
                textAnchor="middle"
                className="stereo-label"
                opacity={l.ghost ? 0.3 : 1}
                style={l.color ? { fill: l.color, fontWeight: 600 } : undefined}
              >
                {l.base}
                {l.sub && <tspan dy="4" fontSize="11">{l.sub}</tspan>}
              </text>
            ))}
            {frame.texts.map((t) => (
              <text
                key={`t-${t.id}`}
                x={t.x}
                y={t.y}
                textAnchor="middle"
                className="stereo-label planim-mark-text"
                style={{ fontStyle: t.italic ? 'italic' : 'normal', fontSize: t.size }}
              >
                {t.text}
              </text>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
