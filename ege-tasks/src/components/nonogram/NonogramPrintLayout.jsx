import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import { layoutGrid, isMajorLine, resolveOrientation } from '../../utils/nonogram/layout';
import { sheetBlock } from '../../utils/nonogram/sheet';
import { cluesOf, checksum } from '../../utils/nonogram/solver';
import './NonogramPrintLayout.css';

/**
 * Печатный лист японского кроссворда — и предпросмотр (`screenMode`).
 *
 * Страница ученика: шапка, инструкция, сетка с подсказками-примерами, готовые
 * клетки, строка самопроверки. При `perPage = 2` на листе два ОДИНАКОВЫХ
 * кроссворда с линией отреза. Ключ учителя — одна страница на все варианты:
 * картинка и числа у вариантов общие, различается только запись примеров.
 *
 * Оформление — канон `print-sheet`: только чёрная краска, миллиметры,
 * волосяная клетка и жирная линия каждые 5 клеток.
 */

const texCache = new Map();
function texHtml(tex) {
  let html = texCache.get(tex);
  if (html == null) {
    try {
      html = katex.renderToString(tex, { throwOnError: false, output: 'html' });
    } catch {
      html = tex;
    }
    if (texCache.size > 4000) texCache.clear();
    texCache.set(tex, html);
  }
  return html;
}

function ClueItem({ q }) {
  if (typeof q === 'number') return <span className="nng-q nng-q--num">{q}</span>;
  return <span className="nng-q" dangerouslySetInnerHTML={{ __html: texHtml(q.exprLatex) }} />;
}

function cellBorders(r, c, R, C) {
  return {
    borderRightWidth: isMajorLine(c + 1, C) ? '0.35mm' : '0.2pt',
    borderBottomWidth: isMajorLine(r + 1, R) ? '0.35mm' : '0.2pt',
  };
}

// Самый мелкий кегль подгонки: дальше пример уже не прочесть
const MIN_FIT_PT = 5;

/**
 * Что-то из подсказок вылезло за свою клетку (по настоящей вёрстке).
 * Сравниваются рамки элементов, а не scrollWidth: подсказки строки прижаты
 * вправо, и вылет влево scrollWidth не считает.
 */
function overflowing(root) {
  for (const el of root.querySelectorAll('.nng-rowclue, .nng-colclue')) {
    const box = el.getBoundingClientRect();
    for (const q of el.children) {
      const r = q.getBoundingClientRect();
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5
        || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5) return true;
    }
  }
  return false;
}

/**
 * Сетка с подсказками. `rows`/`cols` — примеры или числа; `solution` — залить картинку.
 *
 * Кегль раскладка выбирает по ОЦЕНКЕ ширины примеров; если настоящая вёрстка
 * всё же не влезла (у KaTeX свои отступы), кегль шагает вниз до `MIN_FIT_PT`.
 * Клетки при этом не меняются — меньше становятся только примеры.
 */
function NonogramGrid({ rows, cols, layout, matrix, givens, solution = false }) {
  const R = rows.length;
  const C = cols.length;
  const { cellMm, rowZoneMm, colZoneMm } = layout;
  const ref = useRef(null);
  const [fit, setFit] = useState({ key: layout, pt: layout.fontPt });
  const fontPt = fit.key === layout ? fit.pt : layout.fontPt;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || fit.key !== layout) { setFit({ key: layout, pt: layout.fontPt }); return; }
    if (fontPt > MIN_FIT_PT && overflowing(el)) setFit({ key: layout, pt: Math.max(MIN_FIT_PT, fontPt - 0.25) });
  }, [layout, fontPt, fit.key, rows, cols]);
  const givenMap = useMemo(() => {
    const m = new Map();
    for (const g of givens || []) m.set(`${g.r}:${g.c}`, g.v);
    return m;
  }, [givens]);

  return (
    <div
      ref={ref}
      className="nng-grid"
      style={{
        gridTemplateColumns: `${rowZoneMm}mm repeat(${C}, ${cellMm}mm)`,
        gridTemplateRows: `${colZoneMm}mm repeat(${R}, ${cellMm}mm)`,
        fontSize: `${fontPt}pt`,
      }}
    >
      <div className="nng-corner" />
      {cols.map((line, c) => (
        <div
          key={`c${c}`}
          className="nng-colclue"
          style={{ borderRightWidth: isMajorLine(c + 1, C) ? '0.35mm' : '0.2pt' }}
        >
          {line.length ? line.map((q, i) => <ClueItem key={i} q={q} />) : <ClueItem q={0} />}
        </div>
      ))}
      {rows.map((line, r) => (
        <RowCells
          key={`r${r}`}
          r={r} R={R} C={C} line={line}
          matrix={matrix} givenMap={givenMap} solution={solution}
        />
      ))}
    </div>
  );
}

function RowCells({ r, R, C, line, matrix, givenMap, solution }) {
  const cells = [];
  for (let c = 0; c < C; c++) {
    const given = givenMap.get(`${r}:${c}`);
    const fill = solution ? matrix?.[r]?.[c] : given === 1;
    const dot = !solution && given === 0;
    cells.push(
      <div
        key={c}
        className={`nng-cell${fill ? ' nng-cell--fill' : ''}${dot ? ' nng-cell--dot' : ''}`}
        style={cellBorders(r, c, R, C)}
      />,
    );
  }
  return (
    <>
      <div
        className="nng-rowclue"
        style={{ borderBottomWidth: isMajorLine(r + 1, R) ? '0.35mm' : '0.2pt' }}
      >
        {line.length ? line.map((q, i) => <ClueItem key={i} q={q} />) : <ClueItem q={0} />}
      </div>
      {cells}
    </>
  );
}

function Head({ title, number, variantsCount, compact }) {
  const variant = variantsCount > 1 ? `Вариант ${number}` : null;
  if (compact) {
    return (
      <div className="nng-head nng-head--compact">
        <span className="nng-title nng-title--compact">{title}</span>
        {variant && <span className="nng-variant">{variant}</span>}
        <span className="nng-field nng-field--wide"><span className="nng-field-label">Фамилия, имя</span><span className="nng-line" /></span>
        <span className="nng-field"><span className="nng-field-label">Класс</span><span className="nng-line" /></span>
      </div>
    );
  }
  return (
    <div className="nng-head">
      <div className="nng-eyebrow">
        Японский кроссворд{variant ? ` · ${variant}` : ''}
      </div>
      <div className="nng-title">{title}</div>
      <div className="nng-fields">
        <span className="nng-field nng-field--wide"><span className="nng-field-label">Фамилия, имя</span><span className="nng-line" /></span>
        <span className="nng-field"><span className="nng-field-label">Класс</span><span className="nng-line" /></span>
        <span className="nng-field"><span className="nng-field-label">Дата</span><span className="nng-line" /></span>
      </div>
    </div>
  );
}

export const NONOGRAM_INSTRUCTION =
  'Вычислите примеры: ответ — сколько клеток подряд закрасить. Слева — по строке '
  + 'слева направо, сверху — по столбцу сверху вниз. Между группами закрашенных '
  + 'клеток — хотя бы одна пустая.';

function Puzzle({ title, number, variantsCount, variant, layout, matrix, givens, settings, sum, compact }) {
  return (
    <div className="nng-block">
      <Head title={title} number={number} variantsCount={variantsCount} compact={compact} />
      {settings.showInstruction && (
        <div className="nng-instr">
          <b>Задание.</b> {NONOGRAM_INSTRUCTION}
          {givens?.some(g => g.v === 1) && ' Закрашенные клетки уже даны.'}
          {givens?.some(g => g.v === 0) && ' Клетка с точкой — пустая.'}
        </div>
      )}
      <div className="nng-grid-wrap">
        <NonogramGrid rows={variant.rows} cols={variant.cols} layout={layout} matrix={matrix} givens={givens} />
      </div>
      {settings.showChecksum && (
        <div className="nng-foot">
          Проверьте себя: сумма ответов слева = сумма ответов сверху = <b>{sum}</b>.
        </div>
      )}
    </div>
  );
}

export default function NonogramPrintLayout({
  title, settings, matrix, givens, variants, screenMode = false, only = null,
}) {
  const data = useMemo(() => {
    if (!matrix?.length || !variants?.length) return null;
    const C = matrix[0].length;
    const orientation = resolveOrientation(settings.orientation, C);
    const block = sheetBlock(settings, C);
    const clues = cluesOf(matrix);
    const layouts = variants.map(v => layoutGrid(v.rows, v.cols, block));
    // Ключ: числа вместо примеров, места — на всю страницу
    const keyBlock = sheetBlock({ ...settings, perPage: 1, showInstruction: false, showChecksum: true }, C);
    const keyLayout = layoutGrid(clues.rows, clues.cols, keyBlock);
    return { orientation, clues, layouts, keyLayout, sum: checksum(clues).rows };
  }, [matrix, variants, settings]);

  if (!data) return null;
  const compact = settings.perPage === 2;
  const pageCls = `nng-page nng-page--${data.orientation}`;
  const showStudent = only !== 'key';
  const showKey = (only === 'key') || (only == null && settings.showKey);

  const pages = [];
  if (showStudent) {
    variants.forEach((variant, i) => {
      const props = {
        title, number: i + 1, variantsCount: variants.length, variant,
        layout: data.layouts[i], matrix, givens, settings, sum: data.sum, compact,
      };
      pages.push(
        <div key={`v${i}`} className={pageCls}>
          <Puzzle {...props} />
          {compact && <div className="nng-cut" />}
          {compact && <Puzzle {...props} />}
        </div>,
      );
    });
  }
  if (showKey) {
    pages.push(
      <div key="key" className={`${pageCls} nng-page--key`}>
        <div className="nng-head">
          <div className="nng-eyebrow">Ключ учителя</div>
          <div className="nng-title">{title}</div>
          <div className="nng-key-note">
            У всех вариантов ({variants.length}) одна картинка и одни числа — различается запись примеров.
            Закрашено клеток: <b>{data.sum}</b>.
          </div>
        </div>
        <div className="nng-grid-wrap">
          <NonogramGrid
            rows={data.clues.rows} cols={data.clues.cols}
            layout={data.keyLayout} matrix={matrix} givens={givens} solution
          />
        </div>
      </div>,
    );
  }

  const rootCls = screenMode
    ? 'nng-screen-root'
    : `nng-print-root nng-print-root--${data.orientation}`;
  return <div className={rootCls}>{pages}</div>;
}

/** Хоть один вариант не уместился — предупреждение для панели. */
export function nonogramOverflow(matrix, variants, settings) {
  if (!matrix?.length || !variants?.length) return false;
  const block = sheetBlock(settings, matrix[0].length);
  return variants.some(v => layoutGrid(v.rows, v.cols, block).overflow);
}
