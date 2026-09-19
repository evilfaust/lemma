import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import {
  COPY_GAP_MM, COPY_GRIDS, COPY_PAD_MM, COL_GAP_MM, FS_PAD, FS_PAGE, MM_PX, NUM_COL_MM,
  columnWidthMm, copySizeMm, flattenSections, layoutCopy, pagesForMode, stretchExtraPx,
} from '../../utils/formulaSheet';
import './FormulaSheetPrint.css';

function Tex({ latex }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || '', { throwOnError: false, displayMode: false, trust: true });
    } catch {
      return latex || '';
    }
  }, [latex]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** LaTeX строки в выбранном режиме: эталон показывает ответ, бланк — только левую часть. */
export function rowLatex(item, mode, boxedAnswer) {
  const left = item.left || '';
  if (mode === 'blank') return `${left} =`;
  const right = item.right || '';
  if (!right.trim()) return `${left} =`;
  return boxedAnswer ? `${left} = \\boxed{${right}}` : `${left} = ${right}`;
}

/**
 * Лист формул — ОДИН компонент на экран и на печать.
 *
 * Раньше их было два: `FormulaSheetPrintLayout` (жил целиком внутри
 * `@media print`, на экране `display: none`) и отдельное превью в генераторе со
 * своей вёрсткой. Учитель печатал вслепую, а две вёрстки расходились.
 *
 * Оформление — язык движка `print-sheet`: только чёрная краска, миллиметры,
 * иерархия кеглем и толщиной линеек. Геометрия и раскладка считаются в чистом
 * `utils/formulaSheet.js`.
 */
export default function FormulaSheetPrint({ title, subtitle, sections, settings, onFit }) {
  const measureRef = useRef(null);
  const headRefs = useRef({});
  const rowRefs = useRef({});
  const [layout, setLayout] = useState({ key: null, pages: [] });
  const [bump, setBump] = useState(0);

  const items = useMemo(() => flattenSections(sections), [sections]);
  const modes = pagesForMode(settings.printMode);
  const copy = copySizeMm(settings.copies);
  const grid = COPY_GRIDS[settings.copies] || COPY_GRIDS[2];
  const colWidthMm = columnWidthMm(settings);
  const measureWidthMm = colWidthMm + (settings.showNumbers ? NUM_COL_MM : 0);

  const measureKey = useMemo(() => [
    items.map(i => `${i.id}:${i.left}:${i.right}:${i.title || ''}`).join('|'),
    title, subtitle,
    settings.copies, settings.columns, settings.textSize, settings.font,
    settings.printMode, settings.showFields, settings.showNumbers,
    settings.boxedAnswer, settings.stretch,
  ].join('~'), [items, title, subtitle, settings]);

  // 🚨 Перемер после загрузки шрифтов: KaTeX подтягивает свои, и до них высоты
  // строк занижены — копия набиралась бы с запасом, которого на бумаге нет.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) setBump(b => b + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [measureKey]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;

    const pxPerMm = root.offsetWidth ? root.offsetWidth / measureWidthMm : MM_PX;
    const capOf = (mode) => {
      const headPx = headRefs.current[mode]?.offsetHeight || 0;
      return (copy.hMm - 2 * COPY_PAD_MM) * pxPerMm - headPx;
    };

    const heights = {};
    for (const mode of modes) {
      for (const item of items) {
        const el = rowRefs.current[`${mode}:${item.id}`];
        if (el) heights[`${mode}:${item.id}`] = el.offsetHeight;
      }
    }

    const pages = modes.map(mode => {
      const modeHeights = {};
      for (const item of items) modeHeights[item.id] = heights[`${mode}:${item.id}`] ?? 0;
      const capPx = capOf(mode);
      const { columns, overflow } = layoutCopy(items, modeHeights, settings.columns, capPx);
      // Заполнение копии — по самой набитой колонке: по нему учитель видит,
      // что на листе осталось место под ещё одну порцию формул.
      const usedPx = Math.max(0, ...columns.map(col => col.reduce((sum, i) => sum + (modeHeights[i.id] ?? 0), 0)));
      const fill = capPx > 0 ? Math.min(1, usedPx / capPx) : 0;
      // 🚨 Растягиваем только бланк: в нём прирост строки — это место для
      // записи. Эталон читают как шпаргалку, разреженные строки там мешают.
      const extra = settings.stretch && mode === 'blank'
        ? stretchExtraPx(columns, modeHeights, capPx, pxPerMm)
        : columns.map(() => 0);
      return { mode, columns, overflow, extra, fill };
    });

    setLayout(prev => (prev.key === measureKey ? prev : { key: measureKey, pages }));
    // Панель настроек показывает, сколько формул не поместилось в копию и
    // насколько копия заполнена.
    onFit?.({
      overflow: pages.reduce((max, p) => Math.max(max, p.overflow.filter(i => i.kind === 'formula').length), 0),
      fill: pages.length ? Math.max(...pages.map(p => p.fill)) : 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey, bump]);

  const renderRow = (item, mode, extraPx, refCb) => {
    if (item.kind === 'section') {
      return (
        <div key={`${mode}:${item.id}`} ref={refCb} className="fsp-section">
          {item.title}
        </div>
      );
    }
    return (
      <div
        key={`${mode}:${item.id}`}
        ref={refCb}
        className="fsp-row"
        style={extraPx ? { paddingBottom: `${extraPx}px` } : undefined}
      >
        {settings.showNumbers && (
          <span className="fsp-num" style={{ width: `${NUM_COL_MM}mm` }}>{item.num}.</span>
        )}
        <span className="fsp-expr"><Tex latex={rowLatex(item, mode, settings.boxedAnswer)} /></span>
        {mode === 'blank' && <span className="fsp-answer-line" />}
      </div>
    );
  };

  const head = (mode, refCb) => (
    <div className="fsp-head" ref={refCb}>
      <div className="fsp-title">{title || 'Лист формул'}</div>
      {subtitle && <div className="fsp-subtitle">{subtitle}</div>}
      {mode === 'blank' && settings.showFields && (
        <div className="fsp-fields">
          <span className="fsp-field fsp-field--name">
            Фамилия, имя<span className="fsp-field-line" />
          </span>
          <span className="fsp-field">
            Класс<span className="fsp-field-line fsp-field-line--short" />
          </span>
        </div>
      )}
    </div>
  );

  const renderCopy = (page, idx) => (
    <div
      key={idx}
      className="fsp-copy"
      style={{
        width: `${copy.wMm}mm`,
        height: `${copy.hMm}mm`,
        padding: `${COPY_PAD_MM}mm`,
        fontSize: `${settings.textSize}pt`,
      }}
    >
      {head(page.mode)}
      <div className="fsp-cols" style={{ gap: `${COL_GAP_MM}mm` }}>
        {page.columns.map((column, ci) => (
          <div key={ci} className="fsp-col" style={{ width: `${columnWidthMm(settings) + (settings.showNumbers ? NUM_COL_MM : 0)}mm` }}>
            {column.map(item => renderRow(item, page.mode, page.extra[ci]))}
          </div>
        ))}
      </div>
    </div>
  );

  const pages = layout.key === measureKey ? layout.pages : [];

  return (
    <div className={`fsp-root fsp-root--${settings.font}`}>
      {/* Зона измерения: ширина ровно с колонку формул */}
      <div
        className="fsp-measure"
        ref={measureRef}
        style={{ width: `${measureWidthMm}mm`, fontSize: `${settings.textSize}pt` }}
      >
        {modes.map(mode => (
          <div key={mode}>
            {head(mode, el => { headRefs.current[mode] = el; })}
            {items.map(item => renderRow(item, mode, 0, el => { rowRefs.current[`${mode}:${item.id}`] = el; }))}
          </div>
        ))}
      </div>

      <div className="fsp-pages">
        {pages.map((page, pi) => (
          <div
            key={pi}
            className="fsp-page"
            style={{
              width: `${FS_PAGE.w}mm`,
              height: `${FS_PAGE.h}mm`,
              padding: `${FS_PAD.top}mm ${FS_PAD.x}mm ${FS_PAD.bottom}mm`,
              gap: `${COPY_GAP_MM}mm`,
              gridTemplateColumns: `repeat(${grid.cols}, ${copy.wMm}mm)`,
              gridTemplateRows: `repeat(${grid.rows}, ${copy.hMm}mm)`,
            }}
          >
            {Array.from({ length: settings.copies }, (_, i) => renderCopy(page, i))}

            {/* Линии отреза идут по середине полосы между копиями */}
            {settings.showCutLine && grid.cols > 1 && (
              <span className="fsp-cut fsp-cut--v" style={{ left: `${FS_PAD.x + copy.wMm + COPY_GAP_MM / 2}mm` }} />
            )}
            {settings.showCutLine && grid.rows > 1 && (
              <span className="fsp-cut fsp-cut--h" style={{ top: `${FS_PAD.top + copy.hMm + COPY_GAP_MM / 2}mm` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
