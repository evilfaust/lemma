import React from 'react';
import katex from 'katex';
import { formatAngleLatex } from '../../hooks/useUnitCircle';

// ─── Константы SVG ────────────────────────────────────────────────────────────
const VB   = 380;   // viewBox size
const CX   = 190;   // центр X
const CY   = 190;   // центр Y
const R    = 120;   // радиус окружности
const LR   = 158;   // радиус для подписей стандартных углов
const ALR  = 144;   // радиус для ответных подписей (ближе к кружку)
const AXIS = R + 20; // длина осей от центра

// Все 16 стандартных позиций
const ALL_STANDARD = [
  { num: 0,  den: 1  },
  { num: 1,  den: 6  },
  { num: 1,  den: 4  },
  { num: 1,  den: 3  },
  { num: 1,  den: 2  },
  { num: 2,  den: 3  },
  { num: 3,  den: 4  },
  { num: 5,  den: 6  },
  { num: 1,  den: 1  },
  { num: 7,  den: 6  },
  { num: 5,  den: 4  },
  { num: 4,  den: 3  },
  { num: 3,  den: 2  },
  { num: 5,  den: 3  },
  { num: 7,  den: 4  },
  { num: 11, den: 6  },
];

// Только 4 оси
const AXES_ONLY = [
  { num: 0,  den: 1, deg: '0°'   },
  { num: 1,  den: 2, deg: '90°'  },
  { num: 1,  den: 1, deg: '180°' },
  { num: 3,  den: 2, deg: '270°' },
];

// ─── Утилиты ─────────────────────────────────────────────────────────────────
function toXY(num, den, radius) {
  const theta = (num / den) * Math.PI;
  return {
    x: CX + radius * Math.cos(theta),
    y: CY - radius * Math.sin(theta),
  };
}

function textAlign(num, den) {
  const theta = (num / den) * Math.PI;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    textAnchor:       cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle',
    dominantBaseline: sin > 0.2 ? 'auto'  : sin < -0.2 ? 'hanging' : 'central',
  };
}

// ─── Рендер KaTeX внутри SVG через <foreignObject> ───────────────────────────
function SvgMathLabel({ latex, x, y, textAnchor, dominantBaseline, fontSize, color }) {
  const W = 72;
  const H = 34;

  // Позиционируем foreignObject так, чтобы содержимое выровнялось по (x, y)
  let ox;
  if (textAnchor === 'end')    ox = x - W;
  else if (textAnchor === 'middle') ox = x - W / 2;
  else                          ox = x;

  let oy;
  if (dominantBaseline === 'auto')    oy = y - H;       // текст выше y
  else if (dominantBaseline === 'hanging') oy = y;       // текст ниже y
  else                                 oy = y - H / 2;  // по центру

  const justifyContent =
    textAnchor === 'end' ? 'flex-end' :
    textAnchor === 'middle' ? 'center' : 'flex-start';

  let html;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    html = latex;
  }

  return (
    <foreignObject x={ox} y={oy} width={W} height={H}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent,
          width: '100%',
          height: '100%',
          fontSize: `${fontSize}px`,
          color,
          lineHeight: 1,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </foreignObject>
  );
}

// ─── Компонент ────────────────────────────────────────────────────────────────
export default function UnitCircleSVG({
  points = [],
  taskType = 'direct',
  isAnswer = false,
  showAxes = 'axes',
  showDegrees = false,
  showTicks = true,
  cipherMap = null,
}) {
  const showAll   = showAxes === 'all';
  const showAxesL = showAxes !== 'none';
  const showDots  = taskType === 'direct' || (taskType === 'inverse' && isAnswer);

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* ── Оси ── */}
      <line x1={CX - AXIS} y1={CY} x2={CX + AXIS} y2={CY}
        stroke="#333" strokeWidth="1" />
      <line x1={CX} y1={CY - AXIS} x2={CX} y2={CY + AXIS}
        stroke="#333" strokeWidth="1" />

      {/* Стрелки осей */}
      <polygon points={`${CX+AXIS},${CY} ${CX+AXIS-6},${CY-4} ${CX+AXIS-6},${CY+4}`}
        fill="#333" />
      <polygon points={`${CX},${CY-AXIS} ${CX-4},${CY-AXIS+6} ${CX+4},${CY-AXIS+6}`}
        fill="#333" />

      {/* ── Окружность ── */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#333" strokeWidth="1.5" />

      {/* ── Засечки на всех 16 позициях ── */}
      {showTicks && ALL_STANDARD.map(({ num, den }, i) => {
        const inner = toXY(num, den, R - 5);
        const outer = toXY(num, den, R + 5);
        return (
          <line key={i}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke="#999" strokeWidth="0.8" />
        );
      })}

      {/* ── Подписи ВСЕХ стандартных углов (showAxes === 'all') ── */}
      {showAll && ALL_STANDARD.map(({ num, den }, i) => {
        const pos = toXY(num, den, LR);
        const { textAnchor, dominantBaseline } = textAlign(num, den);
        return (
          <SvgMathLabel key={i}
            latex={formatAngleLatex(num, den, 0)}
            x={pos.x} y={pos.y}
            textAnchor={textAnchor} dominantBaseline={dominantBaseline}
            fontSize={9.5} color="#444"
          />
        );
      })}

      {/* ── Подписи только осей (showAxes === 'axes') ── */}
      {showAxesL && !showAll && AXES_ONLY.map(({ num, den, deg }, i) => {
        const pos = toXY(num, den, LR);
        const { textAnchor, dominantBaseline } = textAlign(num, den);
        return (
          <g key={i}>
            <SvgMathLabel
              latex={formatAngleLatex(num, den, 0)}
              x={pos.x} y={pos.y}
              textAnchor={textAnchor} dominantBaseline={dominantBaseline}
              fontSize={11} color="#333"
            />
            {showDegrees && (
              <text
                x={pos.x}
                y={pos.y + (dominantBaseline === 'hanging' ? 38 : dominantBaseline === 'auto' ? -38 : 0)}
                fontSize="8.5" fill="#888"
                textAnchor={textAnchor} dominantBaseline={dominantBaseline}
                fontFamily="Arial, sans-serif"
              >{deg}</text>
            )}
          </g>
        );
      })}

      {/* ── Подписи градусов для 'all' режима ── */}
      {showAll && showDegrees && AXES_ONLY.map(({ num, den, deg }, i) => {
        const pos = toXY(num, den, LR + 18);
        const { textAnchor, dominantBaseline } = textAlign(num, den);
        return (
          <text key={i} x={pos.x} y={pos.y}
            fontSize="8" fill="#888"
            textAnchor={textAnchor} dominantBaseline={dominantBaseline}
            fontFamily="Arial, sans-serif"
          >{deg}</text>
        );
      })}

      {/* ── Центр ── */}
      <circle cx={CX} cy={CY} r="2.5" fill="#333" />

      {/* ── Точки задания ── */}
      {showDots && points.map((p) => {
        const pos = toXY(p.num, p.den, R);
        return (
          <g key={p.id}>
            <circle cx={pos.x} cy={pos.y} r="7"
              fill="#1677ff" stroke="white" strokeWidth="1.2" />
            <text x={pos.x} y={pos.y}
              fontSize="7.5" fill="white" fontWeight="bold"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="Arial, sans-serif"
            >{p.id}</text>
          </g>
        );
      })}

      {/* ── Ответные подписи углов (версия учителя, прямая задача) ── */}
      {isAnswer && taskType === 'direct' && points.map((p) => {
        const pos = toXY(p.num, p.den, ALR);
        const { textAnchor, dominantBaseline } = textAlign(p.num, p.den);
        return (
          <SvgMathLabel key={p.id}
            latex={p.display}
            x={pos.x} y={pos.y}
            textAnchor={textAnchor} dominantBaseline={dominantBaseline}
            fontSize={9} color="#c41d7f"
          />
        );
      })}

      {/* ── Буквы для шифровок (криптограмм) ── */}
      {cipherMap && cipherMap.map((p, i) => {
        const posDot = toXY(p.num, p.den, R);
        const posText = toXY(p.num, p.den, R - 18);
        return (
          <g key={`cipher-${i}`}>
            <circle cx={posDot.x} cy={posDot.y} r="3" fill="#333" />
            <text x={posText.x} y={posText.y}
              fontSize="12" fill="#000" fontWeight="bold"
              textAnchor="middle" dominantBaseline="central"
              fontFamily="Arial, sans-serif"
            >{p.letter}</text>
          </g>
        );
      })}
    </svg>
  );
}
