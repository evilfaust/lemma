import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderStereo, DASH, STEREO_COLORS } from '../../utils/stereo/render';
import { clampCamera } from '../../utils/stereo/camera';
import './stereo.css';

const DRAG_START_PX = 4;
const YAW_PER_PX = 0.45;
const PITCH_PER_PX = 0.35;

/**
 * Холст стереочертежа — общий для учителя и ученика.
 *
 * Мышь/палец: перетаскивание — вращение (по горизонтали yaw, по вертикали
 * pitch), колёсико/щипок — масштаб. Короткий клик без сдвига уходит в
 * onClick — им живут инструменты редактора.
 *
 * @param highlight — { points:Set, lines:Set, faces:Set } — выбор инструмента
 * @param flashStep — номер шага, чьи объекты вспыхивают (новое на чертеже)
 * @param pulse     — { points:Set, lines:Set, key } — «смотрите сюда»
 */
export default function StereoCanvas({
  model,
  camera,
  onCameraChange,
  onClick,
  onHover,
  onDoubleClick,
  highlight = null,
  flashStep = null,
  pulse = null,
  cursor = 'grab',
  className = '',
  style,
  ariaLabel = 'Стереометрический чертёж',
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const camRef = useRef(camera);
  camRef.current = camera;

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

  const frame = useMemo(() => {
    if (!model || size.width < 40 || size.height < 40) return null;
    return renderStereo(model, camera, size);
  }, [model, camera, size]);
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

  const handleDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const g = gesture.current;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* нет захвата — не страшно */ }
    const pt = local(e);
    g.pointers.set(e.pointerId, pt);
    if (g.pointers.size === 2) {
      g.mode = 'pinch';
      g.start = { dist: pinchDist() || 1, zoom: camRef.current.zoom || 1 };
    } else if (g.pointers.size === 1) {
      g.mode = 'press';
      g.start = { x: pt.x, y: pt.y, yaw: camRef.current.yaw, pitch: camRef.current.pitch };
    }
  };

  const handleMove = (e) => {
    const g = gesture.current;
    const pt = local(e);
    if (!g.pointers.has(e.pointerId)) {
      if (onHover && frameRef.current && e.pointerType === 'mouse') onHover({ ...pt, frame: frameRef.current });
      return;
    }
    g.pointers.set(e.pointerId, pt);
    if (g.mode === 'pinch' && g.pointers.size >= 2) {
      const d = pinchDist();
      if (d > 0) onCameraChange?.(clampCamera({ ...camRef.current, zoom: g.start.zoom * (d / g.start.dist) }));
      return;
    }
    if (g.mode === 'press' || g.mode === 'rotate') {
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (g.mode === 'press' && Math.hypot(dx, dy) < DRAG_START_PX) return;
      g.mode = 'rotate';
      onCameraChange?.(clampCamera({
        ...camRef.current,
        yaw: g.start.yaw - dx * YAW_PER_PX,
        pitch: g.start.pitch + dy * PITCH_PER_PX,
      }));
    }
  };

  const handleUp = (e) => {
    const g = gesture.current;
    const wasPress = g.mode === 'press' && g.pointers.size === 1;
    g.pointers.delete(e.pointerId);
    if (wasPress && onClick && frameRef.current) {
      onClick({ ...local(e), frame: frameRef.current, shiftKey: e.shiftKey, altKey: e.altKey });
    }
    if (g.pointers.size === 1) {
      const rest = [...g.pointers.values()][0];
      g.mode = 'rotate';
      g.start = { x: rest.x, y: rest.y, yaw: camRef.current.yaw, pitch: camRef.current.pitch };
    } else if (g.pointers.size === 0) {
      g.mode = null;
    }
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      onCameraChange?.(clampCamera({ ...camRef.current, zoom: (camRef.current.zoom || 1) * k }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onCameraChange]);

  // --- отрисовка ----------------------------------------------------------------
  const hlLine = (s) => highlight?.lines?.has(s.objId) || [...(highlight?.lines || [])].some((id) => s.objId.startsWith(`${id}:e`));
  const isFlash = (step) => flashStep != null && step === flashStep;
  const pulseLine = (s) => pulse?.lines?.has(s.objId);

  const renderStroke = (s) => {
    const hl = hlLine(s);
    const cls = [
      isFlash(s.step) ? 'stereo-flash' : '',
      pulseLine(s) ? 'stereo-pulse' : '',
    ].filter(Boolean).join(' ');
    return (
      <line
        key={s.id}
        x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
        stroke={hl ? STEREO_COLORS.newPoint : s.color}
        strokeWidth={(s.hidden ? s.width * 0.8 : s.width) + (hl ? 1.4 : 0)}
        strokeDasharray={s.hidden ? DASH : undefined}
        strokeLinecap="round"
        className={cls || undefined}
      />
    );
  };

  return (
    <div ref={wrapRef} className={`stereo-canvas ${className}`} style={style}>
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
        onDoubleClick={onDoubleClick}
      >
        {frame && (
          <>
            {highlight?.faces?.size > 0 && frame.hits.faces
              .filter((f) => highlight.faces.has(f.id))
              .map((f) => (
                <polygon
                  key={`hf-${f.id}`}
                  points={f.pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={STEREO_COLORS.plane}
                  fillOpacity={0.22}
                  stroke="none"
                />
              ))}
            {frame.polys.map((pg) => (
              <polygon
                key={pg.id}
                points={pg.points}
                fill={pg.fill}
                fillOpacity={pg.opacity}
                stroke="none"
                className={isFlash(pg.step) ? 'stereo-flash-fill' : undefined}
              />
            ))}
            {frame.strokes.filter((s) => s.hidden).map(renderStroke)}
            {frame.strokes.filter((s) => !s.hidden).map(renderStroke)}
            {frame.dots.map((d) => {
              const hl = highlight?.points?.has(d.name);
              const pl = pulse?.points?.has(d.name);
              return (
                <circle
                  key={`p-${d.name}`}
                  cx={d.x}
                  cy={d.y}
                  r={(d.vertex ? 2.6 : 3.4) + (hl ? 2 : 0)}
                  fill={hl ? STEREO_COLORS.newPoint : STEREO_COLORS.point}
                  className={[isFlash(d.step) ? 'stereo-flash-dot' : '', pl ? 'stereo-pulse-dot' : ''].filter(Boolean).join(' ') || undefined}
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
              >
                {l.base}
                {l.sub && <tspan dy="4" fontSize="11">{l.sub}</tspan>}
              </text>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
