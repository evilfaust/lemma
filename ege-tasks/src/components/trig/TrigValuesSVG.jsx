import React from 'react';
import katex from 'katex';

// ─── Константы ───────────────────────────────────────────────────────────────
const VB   = 360;
const CX   = 180;
const CY   = 180;
const R    = 125;       // радиус окружности
const AXIS = R + 22;    // длина оси от центра
const LR   = R + 26;    // радиус для подписей углов снаружи

// ─── SVG-вспомогалка для KaTeX ───────────────────────────────────────────────
function SvgMath({ latex, x, y, anchor = 'middle', baseline = 'central', size = 9, color = '#333' }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }

  const W = 72;
  const H = 30;
  const ox = anchor === 'end'    ? x - W
           : anchor === 'middle' ? x - W / 2
           : x;
  const oy = baseline === 'hanging' ? y
           : baseline === 'auto'    ? y - H
           : y - H / 2;
  const jc = anchor === 'end' ? 'flex-end' : anchor === 'middle' ? 'center' : 'flex-start';

  return (
    <foreignObject x={ox} y={oy} width={W} height={H} style={{ pointerEvents: 'none' }}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: jc,
          width: '100%', height: '100%',
          fontSize: `${size}px`, color, lineHeight: 1,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </foreignObject>
  );
}

// Координаты точки на окружности
function toXY(num, den, radius = R) {
  const theta = (num / den) * Math.PI;
  return { x: CX + radius * Math.cos(theta), y: CY - radius * Math.sin(theta) };
}

// ─── Вспомогательные квадраты ────────────────────────────────────────────────
// Каждый квадрат = 3 пары углов, где sin и cos принимают фиксированные значения.
// xR = cos-значение × R, yR = sin-значение × R
const HELPER_SQUARES = [
  {
    xR: R * Math.sqrt(3) / 2,
    yR: R * 0.5,
    color: '#2ecc71',
    labelX: '\\frac{\\sqrt{3}}{2}',
    labelY: '\\frac{1}{2}',
  },
  {
    xR: R * Math.sqrt(2) / 2,
    yR: R * Math.sqrt(2) / 2,
    color: '#e84393',
    labelX: '\\frac{\\sqrt{2}}{2}',
    labelY: '\\frac{\\sqrt{2}}{2}',
  },
  {
    xR: R * 0.5,
    yR: R * Math.sqrt(3) / 2,
    color: '#f39c12',
    labelX: '\\frac{1}{2}',
    labelY: '\\frac{\\sqrt{3}}{2}',
  },
];

// ─── Основной компонент ──────────────────────────────────────────────────────
export default function TrigValuesSVG({
  points          = [],
  showHelperLines = true,
  showAngleLabels = false,
}) {
  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* ── Вспомогательные квадраты ── */}
      {showHelperLines && HELPER_SQUARES.map((sq, i) => (
        <g key={i}>
          {/* Горизонтальные линии (sin) */}
          <line x1={CX - sq.xR} y1={CY - sq.yR} x2={CX + sq.xR} y2={CY - sq.yR}
            stroke={sq.color} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.8" />
          <line x1={CX - sq.xR} y1={CY + sq.yR} x2={CX + sq.xR} y2={CY + sq.yR}
            stroke={sq.color} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.8" />
          {/* Вертикальные линии (cos) */}
          <line x1={CX - sq.xR} y1={CY - sq.yR} x2={CX - sq.xR} y2={CY + sq.yR}
            stroke={sq.color} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.8" />
          <line x1={CX + sq.xR} y1={CY - sq.yR} x2={CX + sq.xR} y2={CY + sq.yR}
            stroke={sq.color} strokeWidth="0.9" strokeDasharray="3 2" opacity="0.8" />

          {/* Подписи значений на осях */}
          {/* sin-значения на оси Y (справа от оси) */}
          <SvgMath latex={`\\color{${sq.color}}{${sq.labelY}}`}
            x={CX + 4} y={CY - sq.yR} anchor="start" size={7.5} />
          <SvgMath latex={`\\color{${sq.color}}{-${sq.labelY}}`}
            x={CX + 4} y={CY + sq.yR} anchor="start" size={7.5} />

          {/* cos-значения на оси X (ниже оси) */}
          <SvgMath latex={`\\color{${sq.color}}{${sq.labelX}}`}
            x={CX + sq.xR} y={CY + 6} anchor="middle" baseline="hanging" size={7.5} />
          <SvgMath latex={`\\color{${sq.color}}{-${sq.labelX}}`}
            x={CX - sq.xR} y={CY + 6} anchor="middle" baseline="hanging" size={7.5} />

          {/* Точки на окружности (4 симметричные) */}
          {[1, -1].flatMap(mx => [1, -1].map(my => (
            <circle key={`${i}-${mx}-${my}`}
              cx={CX + sq.xR * mx} cy={CY + sq.yR * my}
              r="2" fill={sq.color} opacity="0.9" />
          )))}
        </g>
      ))}

      {/* ── Окружность ── */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#5c3db8" strokeWidth="1.4" />

      {/* ── Оси координат ── */}
      {/* X-ось */}
      <line x1={CX - AXIS} y1={CY} x2={CX + AXIS} y2={CY} stroke="#5c3db8" strokeWidth="1.3" />
      <polygon points={`${CX+AXIS},${CY} ${CX+AXIS-6},${CY-3} ${CX+AXIS-6},${CY+3}`} fill="#5c3db8" />
      {/* Y-ось */}
      <line x1={CX} y1={CY + AXIS} x2={CX} y2={CY - AXIS} stroke="#5c3db8" strokeWidth="1.3" />
      <polygon points={`${CX},${CY-AXIS} ${CX-3},${CY-AXIS+6} ${CX+3},${CY-AXIS+6}`} fill="#5c3db8" />

      {/* ── Засечки ±1 на осях ── */}
      <line x1={CX + R} y1={CY - 3} x2={CX + R} y2={CY + 3} stroke="#5c3db8" strokeWidth="1" />
      <line x1={CX - R} y1={CY - 3} x2={CX - R} y2={CY + 3} stroke="#5c3db8" strokeWidth="1" />
      <line x1={CX - 3} y1={CY - R} x2={CX + 3} y2={CY - R} stroke="#5c3db8" strokeWidth="1" />
      <line x1={CX - 3} y1={CY + R} x2={CX + 3} y2={CY + R} stroke="#5c3db8" strokeWidth="1" />
      {/* Подписи ±1 */}
      <SvgMath latex="1"  x={CX + R + 2} y={CY - 10} anchor="middle" size={8.5} color="#5c3db8" />
      <SvgMath latex="-1" x={CX - R - 2} y={CY - 10} anchor="middle" size={8.5} color="#5c3db8" />
      <SvgMath latex="1"  x={CX + 8}    y={CY - R}   anchor="start"  size={8.5} color="#5c3db8" />
      <SvgMath latex="-1" x={CX + 8}    y={CY + R}   anchor="start"  size={8.5} color="#5c3db8" />

      {/* ── Угловые метки осей ── */}
      <SvgMath latex="\color{#5c3db8}{0}"          x={CX + AXIS + 2} y={CY - 14} anchor="start" size={9} />
      <SvgMath latex="\color{#5c3db8}{\frac{\pi}{2}}" x={CX}         y={CY - AXIS - 4} anchor="middle" baseline="auto" size={9} />
      <SvgMath latex="\color{#5c3db8}{\pi}"        x={CX - AXIS - 2} y={CY - 14} anchor="end"   size={9} />
      <SvgMath latex="\color{#5c3db8}{\frac{3\pi}{2}}" x={CX}        y={CY + AXIS + 4} anchor="middle" baseline="hanging" size={9} />

      {/* ── Центр ── */}
      <circle cx={CX} cy={CY} r="3" fill="#5c3db8" />

      {/* ── Точки на окружности (без нумерации) ── */}
      {points.map((p) => {
        const pos = toXY(p.num, p.den, R);
        return (
          <circle key={p.id} cx={pos.x} cy={pos.y} r="5" fill="#1677ff" stroke="white" strokeWidth="1.5" />
        );
      })}

      {/* ── Подписи углов снаружи (опционально) ── */}
      {showAngleLabels && points.map((p) => {
        const cos = Math.cos((p.num / p.den) * Math.PI);
        const sin = Math.sin((p.num / p.den) * Math.PI);
        const pos = toXY(p.num, p.den, LR);
        const anchor  = cos >  0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
        const baseln  = sin >  0.2 ? 'auto'  : sin < -0.2 ? 'hanging' : 'central';
        return (
          <SvgMath key={p.id}
            latex={`\\color{#c0392b}{${p.angleDisplay}}`}
            x={pos.x} y={pos.y}
            anchor={anchor} baseline={baseln}
            size={8}
          />
        );
      })}
    </svg>
  );
}
