import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import {
  layoutGrid, layoutPuzzle, paginateTasks, isMajorLine, resolveOrientation,
  columnLabel, LABEL_MM, CONTENT_GAP_MM, MIN_TASK_FONT_PT,
} from '../../utils/nonogram/layout';
import { sheetBlock } from '../../utils/nonogram/sheet';
import { cluesOf, checksum } from '../../utils/nonogram/solver';
import './NonogramPrintLayout.css';

/** Общая вёрстка предпросмотра и печати; примеры отделены от поля. */
const texCache = new Map();
function texHtml(tex) {
  let html = texCache.get(tex);
  if (html == null) {
    html = katex.renderToString(tex, { throwOnError: false, output: 'html' });
    if (texCache.size > 4000) texCache.clear();
    texCache.set(tex, html);
  }
  return html;
}

function ClueItem({ q, solution }) {
  if (q === 0 || solution) return <span className="nng-answer nng-q--num">{q}</span>;
  return <span className="nng-answer nng-answer--blank" />;
}

function cellBorders(r, c, R, C) {
  return {
    borderRightWidth: isMajorLine(c + 1, C) ? '0.35mm' : '0.2pt',
    borderBottomWidth: isMajorLine(r + 1, R) ? '0.35mm' : '0.2pt',
  };
}

function NonogramGrid({ rows, cols, layout, matrix, givens, solution = false }) {
  const R = rows.length;
  const C = cols.length;
  const { cellMm, rowZoneMm, colZoneMm } = layout;
  const givenMap = useMemo(() => new Map((givens || []).map(g => [`${g.r}:${g.c}`, g.v])), [givens]);
  return (
    <div
      className="nng-grid"
      aria-label={solution ? 'Решение японского кроссворда' : 'Поле японского кроссворда'}
      style={{
        gridTemplateColumns: `${rowZoneMm}mm repeat(${C}, ${cellMm}mm)`,
        gridTemplateRows: `${LABEL_MM}mm ${colZoneMm - LABEL_MM}mm repeat(${R}, ${cellMm}mm)`,
      }}
    >
      <div />
      {cols.map((_, c) => <div key={`label${c}`} className="nng-col-label">{columnLabel(c)}</div>)}
      <div className="nng-corner" />
      {cols.map((line, c) => (
        <div key={`c${c}`} className="nng-colclue" aria-label={`Столбец ${columnLabel(c)}`}
          style={{ borderRightWidth: isMajorLine(c + 1, C) ? '0.35mm' : '0.2pt' }}>
          {line.length ? line.map((q, i) => <ClueItem key={i} q={q} solution={solution} />) : <ClueItem q={0} />}
        </div>
      ))}
      {rows.map((line, r) => (
        <RowCells key={`r${r}`} r={r} R={R} C={C} line={line}
          matrix={matrix} givenMap={givenMap} solution={solution} />
      ))}
    </div>
  );
}

function RowCells({ r, R, C, line, matrix, givenMap, solution }) {
  return (
    <>
      <div className="nng-rowclue" aria-label={`Строка ${r + 1}`}
        style={{ borderBottomWidth: isMajorLine(r + 1, R) ? '0.35mm' : '0.2pt' }}>
        <span className="nng-row-label">{r + 1}</span>
        <span className="nng-row-answers">
          {line.length ? line.map((q, i) => <ClueItem key={i} q={q} solution={solution} />) : <ClueItem q={0} />}
        </span>
      </div>
      {Array.from({ length: C }, (_, c) => {
        const given = givenMap.get(`${r}:${c}`);
        const fill = solution ? matrix?.[r]?.[c] : given === 1;
        const dot = !solution && given === 0;
        return <div key={c} className={`nng-cell${fill ? ' nng-cell--fill' : ''}${dot ? ' nng-cell--dot' : ''}`}
          style={cellBorders(r, c, R, C)} />;
      })}
    </>
  );
}

/** Выражение не разрывается переносом; порядок подсказок задан точками с запятой. */
function TaskGroup({ entries, side }) {
  return (
    <section className="nng-task-group" aria-label={side === 'rows' ? 'Примеры для строк' : 'Примеры для столбцов'}>
      <div className="nng-task-head">{side === 'rows' ? 'Строки →' : 'Столбцы ↓'}</div>
      {entries.map(({ line, index }) => (
        <div className="nng-task-row" key={index} data-line={index} data-side={side}>
          <span className="nng-task-label">{side === 'rows' ? index + 1 : columnLabel(index)}</span>
          <div className="nng-task-expressions">
            {line.length ? line.map((q, i) => (
              <span className="nng-task-expression" key={i}>
                <span className="nng-q" dangerouslySetInnerHTML={{ __html: texHtml(typeof q === 'number' ? String(q) : q.exprLatex) }} />
                {i < line.length - 1 && <span className="nng-task-separator">;</span>}
              </span>
            )) : <span className="nng-empty-line">0</span>}
          </div>
        </div>
      ))}
    </section>
  );
}

function tasksOverflowing(root) {
  const box = root.getBoundingClientRect();
  if (!box.width) return false; // jsdom / ещё не разложенный DOM
  for (const el of root.querySelectorAll('.nng-task-group, .nng-task-expression, .nng-task-head')) {
    const r = el.getBoundingClientRect();
    const parent = el.classList.contains('nng-task-expression')
      ? el.parentElement.getBoundingClientRect() : box;
    if (r.left < parent.left - 0.5 || r.right > parent.right + 0.5 || r.bottom > box.bottom + 0.5) return true;
  }
  return false;
}

function TaskLists({ rows, cols, fontPt, heightMm, onOverflow }) {
  const ref = useRef(null);
  const key = useMemo(() => ({}), [rows, cols, fontPt, heightMm]);
  const [fit, setFit] = useState({ key, pt: fontPt });
  const pt = fit.key === key ? fit.pt : fontPt;
  useLayoutEffect(() => {
    if (fit.key !== key) { setFit({ key, pt: fontPt }); return; }
    const overflow = tasksOverflowing(ref.current);
    if (overflow && pt > MIN_TASK_FONT_PT) {
      setFit({ key, pt: Math.max(MIN_TASK_FONT_PT, pt - 0.25) });
    } else {
      ref.current.dataset.overflow = String(overflow);
      if (overflow) onOverflow?.();
    }
  }, [key, fit.key, fontPt, pt, onOverflow]);
  return (
    <div ref={ref} className="nng-tasks" style={{ fontSize: `${pt}pt`, height: `${heightMm}mm` }}>
      <TaskGroup entries={rows} side="rows" />
      <TaskGroup entries={cols} side="cols" />
    </div>
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
  'Вычислите примеры и впишите ответы у сетки. В строках 1, 2, … порядок подсказок — '
  + 'слева направо, в столбцах A, B, … — сверху вниз. Ответ — длина группы '
  + 'закрашенных клеток. Между группами — хотя бы одна пустая клетка.';

const indexed = lines => lines.map((line, index) => ({ line, index }));

function Puzzle({ title, number, variantsCount, variant, plan, block, matrix, givens, settings, sum, compact, onOverflow }) {
  const rows = useMemo(() => indexed(variant.rows), [variant.rows]);
  const cols = useMemo(() => indexed(variant.cols), [variant.cols]);
  return (
    <div className="nng-block" style={{ height: `${block.slot}mm` }}>
      <Head title={title} number={number} variantsCount={variantsCount} compact={compact} />
      {settings.showInstruction && (
        <div className="nng-instr">
          <b>Задание.</b> {NONOGRAM_INSTRUCTION}
          {givens?.some(g => g.v === 1) && ' Закрашенные клетки уже даны.'}
          {givens?.some(g => g.v === 0) && ' Клетка с точкой — пустая.'}
        </div>
      )}
      <div className={`nng-work nng-work--${plan.separate ? 'separate' : plan.placement}`}
        style={{ height: `${block.h}mm`, gridTemplateColumns: !plan.separate && plan.placement === 'aside' ? `${plan.grid.widthMm}mm minmax(0, 1fr)` : undefined }}>
        <div className="nng-field-grid">
          <NonogramGrid rows={variant.rows} cols={variant.cols} layout={plan.grid} matrix={matrix} givens={givens} />
        </div>
        {plan.separate
          ? <div className="nng-page-note">Примеры для этого поля — на следующих страницах.</div>
          : <TaskLists rows={rows} cols={cols} fontPt={plan.fontPt}
            heightMm={plan.placement === 'aside' ? block.h : block.h - plan.grid.heightMm - CONTENT_GAP_MM}
            onOverflow={onOverflow} />}
      </div>
      {settings.showChecksum && (
        <div className="nng-foot">
          Проверьте себя: сумма ответов слева = сумма ответов сверху = <b>{sum}</b>.
        </div>
      )}
    </div>
  );
}

function TaskPage({ title, number, variantsCount, page, part, parts, block, compact }) {
  return (
    <div className="nng-block nng-block--tasks" style={{ height: `${block.slot}mm` }}>
      <Head title={`${title} · Примеры${parts > 1 ? ` ${part}/${parts}` : ''}`}
        number={number} variantsCount={variantsCount} compact={compact} />
      <div className="nng-work" style={{ height: `${block.h}mm` }}>
        <TaskLists rows={page.rows} cols={page.cols} fontPt={page.fontPt} heightMm={block.h} />
      </div>
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
    const plans = variants.map(v => layoutPuzzle(v.rows, v.cols, block, orientation));
    const taskBlock = sheetBlock({ ...settings, showInstruction: false, showChecksum: false }, C);
    const keyBlock = sheetBlock({ ...settings, perPage: 1, showInstruction: false, showChecksum: false }, C);
    const keyLayout = layoutGrid(clues.rows, clues.cols, keyBlock);
    return { orientation, clues, plans, block, taskBlock, keyLayout, sum: checksum(clues).rows };
  }, [matrix, variants, settings]);
  // Реальная геометрия KaTeX может отличаться от оценки: переносим списки,
  // которые не вместились даже при 8 pt, на отдельные страницы.
  const [measuredSeparate, setMeasuredSeparate] = useState({ key: null, indices: [] });
  if (!data) return null;
  const compact = settings.perPage === 2;
  const pageCls = `nng-page nng-page--${data.orientation}`;
  const pages = [];
  const twice = child => <>{child}{compact && <><div className="nng-cut" />{child}</>}</>;
  if (only !== 'key') {
    variants.forEach((variant, i) => {
      let plan = data.plans[i];
      if (!plan.separate && measuredSeparate.key === data && measuredSeparate.indices.includes(i)) {
        plan = { ...plan, separate: true, grid: layoutGrid(variant.rows, variant.cols, { w: data.block.w, h: data.block.h - CONTENT_GAP_MM }) };
      }
      const onOverflow = () => setMeasuredSeparate(prev => {
        const indices = prev.key === data ? prev.indices : [];
        return indices.includes(i) ? prev : { key: data, indices: [...indices, i] };
      });
      pages.push(
        <div key={`v${i}`} className={pageCls}>
          {twice(<Puzzle title={title} number={i + 1} variantsCount={variants.length} variant={variant}
            plan={plan} block={data.block} matrix={matrix} givens={givens} settings={settings}
            sum={data.sum} compact={compact} onOverflow={onOverflow} />)}
        </div>,
      );
      if (plan.separate) {
        const tasks = paginateTasks(variant.rows, variant.cols, data.taskBlock);
        tasks.forEach((page, j) => pages.push(
          <div key={`v${i}-tasks${j}`} className={`${pageCls} nng-page--tasks`}>
            {twice(<TaskPage title={title} number={i + 1} variantsCount={variants.length} page={page}
              part={j + 1} parts={tasks.length} block={data.taskBlock} compact={compact} />)}
          </div>,
        ));
      }
    });
  }
  if (only === 'key' || (only == null && settings.showKey)) {
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
          <NonogramGrid rows={data.clues.rows} cols={data.clues.cols}
            layout={data.keyLayout} matrix={matrix} givens={givens} solution />
        </div>
      </div>,
    );
  }
  return <div className={screenMode ? 'nng-screen-root' : `nng-print-root nng-print-root--${data.orientation}`}>{pages}</div>;
}

/** Нехватка места под само поле; длинные списки раскладываются на отдельные страницы. */
export function nonogramOverflow(matrix, variants, settings) {
  if (!matrix?.length || !variants?.length) return false;
  const C = matrix[0].length;
  const block = sheetBlock(settings, C);
  const orientation = resolveOrientation(settings.orientation, C);
  return variants.some(v => layoutPuzzle(v.rows, v.cols, block, orientation).grid.overflow);
}
