import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Segmented, Tooltip } from 'antd';
import { PicCenterOutlined, PicLeftOutlined, PicRightOutlined } from '@ant-design/icons';
import MathRenderer from '../../MathRenderer';
import { api } from '../../../shared/services/pocketbase';
import { sanitizeSvg } from '../../../utils/sanitizeSvg';
import { parsePlanimBlock, planimSpecFromSvg, planimPrintFrame } from '../../../utils/planim/dsl';
import {
  chooseCardPlacement, fitByAspect, svgAspect, SIDE_SHARES, KATEX_EM, CELL_PAD_MM, GAP_MM,
} from '../../../utils/geometryCards';

// Выбор учителя у карточки. Подписи — по месту ЧЕРТЕЖА, как у листа задач.
export const PLACE_OPTIONS = [
  { value: 'auto', label: 'Авто', title: 'Раскладку выбирает карточка: где чертёж крупнее' },
  { value: 'top', icon: <PicCenterOutlined />, title: 'Чертёж под условием' },
  { value: 'right', icon: <PicLeftOutlined />, title: 'Чертёж слева' },
  { value: 'left', icon: <PicRightOutlined />, title: 'Чертёж справа' },
];

const statementOf = (task) => (task?.statement_md || '').trim();

/**
 * Чертёж задачи для карточки. Планиметрический (наш редактор) строится заново
 * под место — буквы как в условии; прочие SVG и картинки вписываются целиком.
 * Картинка решения (`image_role = 'solution'`, банк МЦНМО) с условием не идёт.
 */
export function cardDrawingOf(task) {
  if (!task) return null;
  if (task.drawing_view === 'svg' && task.drawing_svg) {
    const spec = planimSpecFromSvg(task.drawing_svg);
    if (spec) {
      const { scene, color, grid } = parsePlanimBlock(spec);
      return { kind: 'planim', key: spec, scene, color, grid };
    }
    const html = sanitizeSvg(task.drawing_svg);
    return { kind: 'svg', key: task.drawing_svg, html, aspect: svgAspect(html) || 4 / 3 };
  }
  if (task.image_role === 'solution') return null;
  const url = api.getGeometryImageUrl(task) || '';
  return url ? { kind: 'image', key: url, url, aspect: null } : null;
}

/** Пропорции картинки — после загрузки (до неё — 4 : 3). */
function useImageAspect(url) {
  const [aspect, setAspect] = useState(null);
  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive && img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight); };
    img.src = url;
    return () => { alive = false; };
  }, [url]);
  return aspect;
}

function CardText({ task, number, showAnswer, numMm }) {
  return (
    <div className="gc-text">
      <span className="gc-num" style={{ width: `${numMm}mm`, height: `${numMm}mm` }}>{number}</span>
      <MathRenderer text={statementOf(task) || ' '} />
      {showAnswer && task?.answer != null && String(task.answer) !== '' && (
        <div className="gc-answer">
          <span className="gc-answer-label">Ответ:</span> <MathRenderer text={String(task.answer)} />
        </div>
      )}
    </div>
  );
}

/**
 * Карточка: номер, условие, чертёж. Раскладку выбирает сама — меряет условие
 * при нескольких ширинах (скрытый слой) и отдаёт выбор chooseCardPlacement.
 *
 * @param {object} size — cardSizeMm(...): cell и content в мм
 * @param {number} textMm — кегль условия, мм
 * @param {string} place — auto | top | left | right (выбор учителя)
 * @param {function} [onPlaceChange] — смена выбора (кнопки на экране)
 * @param {function} [onOverflow] — (bool) текст не влез и кегль уменьшен
 */
export default function GeometryCard({
  task, number, size, textMm, place = 'auto', showAnswer = false, showCode = true,
  showGrid = false, onPlaceChange, onOverflow, placeholder = false,
}) {
  const W = size.content.w;
  const H = size.content.h;
  const drawing = useMemo(() => (placeholder ? null : cardDrawingOf(task)), [task, placeholder]);
  const imageAspect = useImageAspect(drawing?.kind === 'image' ? drawing.url : null);

  // Кегль уменьшается, только если условие не влезло ни в один вариант.
  const [fontK, setFontK] = useState(1);
  const fontMm = textMm * fontK;
  // Квадрат номера — ровно в строку: обтекает его только первая строка.
  const numMm = fontMm * 1.3;
  const letterMm = fontMm * KATEX_EM;

  // Высоты условия при ширинах-кандидатах, мм.
  const widths = useMemo(() => [W, ...SIDE_SHARES.map((s) => W * s)], [W]);
  const measureRef = useRef(null);
  const [heights, setHeights] = useState(null);
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) setFontsTick((t) => t + 1); });
    return () => { alive = false; };
  }, []);
  const statement = statementOf(task);
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const ruler = root.querySelector('.gc-ruler');
    const pxPerMm = (ruler?.offsetWidth || 0) / 100;
    if (!pxPerMm) { setHeights(null); return; }
    const hs = [...root.querySelectorAll('.gc-measure-item')].map((el) => el.offsetHeight / pxPerMm);
    setHeights(hs);
  }, [statement, showAnswer, fontMm, widths, fontsTick, number]);

  const fitDrawing = useMemo(() => {
    if (!drawing) return null;
    if (drawing.kind === 'planim') {
      const cache = new Map();
      return (w, h) => {
        const key = `${w.toFixed(1)}x${h.toFixed(1)}`;
        if (!cache.has(key)) {
          const r = planimPrintFrame(drawing.scene, {
            widthMm: w, heightMm: h, letterMm, grid: drawing.grid, color: drawing.color,
          });
          cache.set(key, { w: r.widthMm, h: r.heightMm, svg: r.svg });
        }
        return cache.get(key);
      };
    }
    return fitByAspect(drawing.kind === 'image' ? (imageAspect || 4 / 3) : drawing.aspect);
  }, [drawing, imageAspect, letterMm]);

  const plan = useMemo(() => {
    const textHeight = (w) => {
      if (!heights) return 0;
      const i = widths.findIndex((x) => Math.abs(x - w) < 0.01);
      return heights[i >= 0 ? i : 0] ?? 0;
    };
    return chooseCardPlacement({ W, H, textHeight, fitDrawing, place });
  }, [W, H, heights, widths, fitDrawing, place]);

  // Не влезло — шаг вниз по кеглю (не меньше 0,7) и перемер.
  useEffect(() => {
    if (!heights || placeholder) return;
    if (plan.overflow && plan.fontK < 0.995 && fontK > 0.71) {
      setFontK((k) => Math.max(0.7, Math.round(k * plan.fontK * 100) / 100));
    }
  }, [plan, heights, fontK, placeholder]);
  // Кегль считается заново при смене текста, кегля листа и места.
  useEffect(() => { setFontK(1); }, [statement, textMm, W, H, place, showAnswer]);

  const shrunk = fontK < 0.995;
  const overflow = !!heights && !placeholder && plan.overflow;
  useEffect(() => { onOverflow?.(shrunk || overflow); }, [shrunk, overflow, onOverflow]);

  // Клетка — только в свободном месте под условием и чертежом (решение, если
  // ученик решает на карточке). Пустая карточка (добивка листа) — без клетки.
  const usedH = !heights ? H : plan.place === 'top'
    ? plan.textH + (plan.fit ? GAP_MM + plan.fit.h : 0)
    : Math.max(plan.textH, plan.fit?.h || 0);
  const gridH = showGrid && !placeholder ? Math.floor((H - usedH - 2) / 5) * 5 : 0;
  const grid = gridH >= 10 ? { h: gridH / 5, v: Math.floor(W / 5) } : null;
  const dir = { top: 'column', left: 'row', right: 'row-reverse' }[plan.place] || 'column';
  const fit = plan.fit;

  let drawingNode = null;
  if (drawing && plan.box && fit) {
    if (drawing.kind === 'planim') {
      // eslint-disable-next-line react/no-danger
      drawingNode = <div className="gc-drawing-planim" dangerouslySetInnerHTML={{ __html: fit.svg }} />;
    } else if (drawing.kind === 'svg') {
      drawingNode = (
        <div
          className="gc-drawing-svg"
          style={{ width: `${fit.w}mm`, height: `${fit.h}mm` }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: drawing.html }}
        />
      );
    } else {
      drawingNode = (
        <img
          className="gc-drawing-img"
          src={drawing.url}
          alt=""
          draggable={false}
          style={{ width: `${fit.w}mm`, height: `${fit.h}mm` }}
        />
      );
    }
  }

  const textStyle = { fontSize: `${fontMm}mm` };

  return (
    <article
      className={`gc-card${overflow || shrunk ? ' gc-card--tight' : ''}`}
      style={{ padding: `${CELL_PAD_MM}mm` }}
    >
      {grid && (
        <div
          className="gc-grid"
          aria-hidden="true"
          style={{
            left: `${CELL_PAD_MM}mm`,
            width: `${grid.v * 5}mm`,
            top: `${CELL_PAD_MM + H - grid.h * 5}mm`,
            height: `${grid.h * 5}mm`,
          }}
        >
          {Array.from({ length: grid.h + 1 }, (_, i) => <div key={`h${i}`} className="gc-grid-h" style={{ top: `${i * 5}mm` }} />)}
          {Array.from({ length: grid.v + 1 }, (_, i) => <div key={`v${i}`} className="gc-grid-v" style={{ left: `${i * 5}mm` }} />)}
        </div>
      )}

      {!placeholder && (
        <div className="gc-body" style={{ height: `${H}mm`, flexDirection: dir }}>
          <div className="gc-text-wrap" style={{ ...textStyle, width: `${plan.textW}mm` }}>
            <CardText task={task} number={number} showAnswer={showAnswer} numMm={numMm} />
          </div>
          {plan.box && (
            <div className="gc-drawing" style={{ width: `${plan.box.w}mm`, height: `${plan.box.h}mm` }}>
              {drawingNode}
            </div>
          )}
        </div>
      )}

      {showCode && !placeholder && task?.code && <div className="gc-code">{task.code}</div>}

      {!placeholder && (
        <div className="gc-measure" ref={measureRef} aria-hidden="true">
          <div className="gc-ruler" style={{ width: '100mm' }} />
          {widths.map((w) => (
            <div key={w} className="gc-measure-item gc-text-wrap" style={{ ...textStyle, width: `${w}mm` }}>
              <CardText task={task} number={number} showAnswer={showAnswer} numMm={numMm} />
            </div>
          ))}
        </div>
      )}

      {onPlaceChange && !placeholder && (
        <div className="gc-controls no-print">
          <Segmented
            size="small"
            value={place}
            onChange={onPlaceChange}
            options={PLACE_OPTIONS.map((o) => ({
              value: o.value,
              label: <Tooltip title={o.title}>{o.icon || <span className="gc-auto-label">{o.label}</span>}</Tooltip>,
            }))}
          />
        </div>
      )}
    </article>
  );
}
