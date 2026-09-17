import { useMemo, useRef, useState } from 'react';
import { parseCoordPlot, coordPlotSvg, plotGeometry } from '../../utils/coordPlot';

// Интерактивный холст конструктора «Кривая по точкам».
//
// Снизу — та же картинка, что попадёт в задачу (coordPlotSvg по готовому DSL),
// сверху — прозрачный <svg> той же геометрии (plotGeometry) с ручками точек.
// Клик по пустому месту ставит точку, перетаскивание двигает, двойной клик и
// Delete удаляют, стрелки сдвигают выбранную на шаг. Всё с привязкой к шагу.
//
// Точка не перепрыгивает соседей: кривая строится по возрастанию x, и если бы
// порядок менялся на лету, строка таблицы и ручка под курсором разъезжались бы.

const KIND_COLOR = {
  max: '#d4380d', min: '#389e0d', flat: '#722ed1', plateau: '#8c8c8c',
};
const HANDLE = '#1677ff';

const roundTo = (v, step) => Math.round(Math.round(v / step) * step * 1e6) / 1e6;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fmt = (v) => String(Math.round(v * 1e4) / 1e4).replace('.', ',').replace(/^-/, '−');

export default function CurveCanvas({
  spec, nodes, kinds = [], selected, onSelect, onNodesChange,
  step = 0.5, width = 560, maxHeight = 420,
}) {
  const model = useMemo(() => parseCoordPlot(spec || ''), [spec]);
  const html = useMemo(() => coordPlotSvg(model, { width, maxHeight }), [model, width, maxHeight]);
  const geo = useMemo(() => plotGeometry(model, { width, maxHeight }), [model, width, maxHeight]);
  const overlayRef = useRef(null);
  const dragRef = useRef(null); // индекс перетаскиваемой точки
  const pressRef = useRef(null); // нажатие на пустом месте — точка появится на отпускании
  const [hover, setHover] = useState(null);

  // Координаты события в единицах viewBox холста.
  const toScreen = (e) => {
    const el = overlayRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { px: (e.clientX - r.left) * (geo.W / r.width), py: (e.clientY - r.top) * (geo.H / r.height) };
  };
  const toPlot = (e) => {
    const s = toScreen(e);
    return s ? geo.fromScreen(s.px, s.py) : null;
  };
  // Ручка под курсором. Двойной клик ловим на холсте, а не на ручке: при
  // захвате указателя браузер отдаёт click/dblclick элементу-захватчику.
  const nodeAt = (e) => {
    const s = toScreen(e);
    if (!s) return -1;
    let best = -1;
    let bestD = 12;
    nodes.forEach((n, i) => {
      const d = Math.hypot(geo.sx(n.x) - s.px, geo.sy(n.y) - s.py);
      if (d <= bestD) { best = i; bestD = d; }
    });
    return best;
  };
  const snap = (p) => ({
    x: clamp(roundTo(p.x, step), geo.x0, geo.x1),
    y: clamp(roundTo(p.y, step), geo.y0, geo.y1),
  });

  const moveNode = (i, p) => {
    const cur = nodes[i];
    if (!cur) return;
    const lo = i > 0 ? nodes[i - 1].x : -Infinity;
    const hi = i < nodes.length - 1 ? nodes[i + 1].x : Infinity;
    let { x } = p;
    if (x <= lo) x = roundTo(lo + step, 1e-6);
    if (x >= hi) x = roundTo(hi - step, 1e-6);
    if (x <= lo || x >= hi) x = cur.x; // соседи вплотную — двигаем только по y
    if (x === cur.x && p.y === cur.y) return;
    onNodesChange(nodes.map((n, k) => (k === i ? { ...n, x, y: p.y } : n)));
  };

  const addNode = (p) => {
    const same = nodes.findIndex((n) => Math.abs(n.x - p.x) < 1e-9);
    if (same >= 0) { onSelect(same); return; }
    const next = [...nodes, { x: p.x, y: p.y, flat: false, slope: null }].sort((a, b) => a.x - b.x);
    onNodesChange(next);
    onSelect(next.findIndex((n) => n.x === p.x));
  };

  const removeNode = (i) => {
    onNodesChange(nodes.filter((_, k) => k !== i));
    onSelect(null);
  };

  const handleDown = (e, i) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = i;
    pressRef.current = null;
    onSelect(i);
    overlayRef.current?.setPointerCapture?.(e.pointerId);
  };

  const overlayDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = toPlot(e);
    if (!p) return;
    pressRef.current = p;
    overlayRef.current?.setPointerCapture?.(e.pointerId);
  };

  const overlayMove = (e) => {
    const p = toPlot(e);
    setHover(p ? snap(p) : null);
    if (dragRef.current !== null && p) moveNode(dragRef.current, snap(p));
  };

  const overlayUp = (e) => {
    if (dragRef.current !== null) {
      dragRef.current = null;
      return;
    }
    const start = pressRef.current;
    pressRef.current = null;
    if (!start) return;
    const p = toPlot(e) || start;
    // Сдвиг больше клетки — это не клик, а промах мимо ручки при перетаскивании.
    if (Math.hypot(p.x - start.x, p.y - start.y) * geo.cell > 8) return;
    addNode(snap(p));
  };

  const onKeyDown = (e) => {
    if (selected == null || !nodes[selected]) return;
    const n = nodes[selected];
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeNode(selected);
    } else if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      moveNode(selected, snap({ x: n.x + dx, y: n.y + dy }));
    }
  };

  return (
    <div>
      <div
        className="curve-canvas"
        role="application"
        aria-label="Холст кривой: клик — поставить точку, перетаскивание — сдвинуть"
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%', outline: 'none' }}
      >
        <span
          className="coordplot"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <svg
          ref={overlayRef}
          data-testid="curve-overlay"
          viewBox={`0 0 ${geo.W} ${geo.H}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair',
          }}
          onPointerDown={overlayDown}
          onPointerMove={overlayMove}
          onPointerUp={overlayUp}
          onPointerLeave={() => setHover(null)}
          onDoubleClick={(e) => {
            const i = nodeAt(e);
            if (i >= 0) removeNode(i);
          }}
        >
          {nodes.map((n, i) => {
            if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return null; // поле x/y ещё набирается
            const cx = geo.sx(n.x);
            const cy = geo.sy(n.y);
            const color = KIND_COLOR[kinds[i]] || HANDLE;
            const active = i === selected;
            return (
              <g
                key={i}
                data-testid={`curve-node-${i}`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => handleDown(e, i)}
              >
                <circle cx={cx} cy={cy} r={12} fill="transparent" />
                <circle cx={cx} cy={cy} r={active ? 6.5 : 5.5} fill={active ? color : '#fff'} stroke={color} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{
        fontSize: 12, color: '#8c8c8c', marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}
      >
        <span>Клик — точка · перетащить — сдвинуть · двойной клик или Delete — удалить · стрелки — на шаг</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 120, textAlign: 'right' }}>
          {hover ? `x = ${fmt(hover.x)}; y = ${fmt(hover.y)}` : ''}
        </span>
      </div>
    </div>
  );
}
