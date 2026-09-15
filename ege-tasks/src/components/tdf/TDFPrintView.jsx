import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Space } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import PrintFill from '../shared/PrintFill';
import TDFSheetSettings from './TDFSheetSettings';
import { tdfTypeShort } from './tdfTypes';
import { printPaged } from '../../utils/printPage';
import {
  MM_PX, PAD, PAGE,
  columnPercents, columnWidthMm, contentHeightMm, contentWidthMm, drawingHeightMm,
  normalizeTdfSheetSettings, pluralRu, paginateRows, parseFormulas,
  readTdfSheetSettings, splitIntoPages, stretchRowHeights, writeTdfSheetSettings,
} from '../../utils/tdfSheet';
import './TDFPrintView.css';

const FOOT_MM = 7;          // резерв под колонтитул и поле оценки
const CELL_PAD_MM = 3;      // вертикальные поля ячейки (1.5 мм сверху и снизу)
const FORMULA_WORDS = ['формулу', 'формулы', 'формул'];

/**
 * Печатный лист ТДФ: эталонный конспект (`mode="etalon"`) и бланк устного
 * опроса (`mode="blank"`).
 *
 * Оформление — язык движка `print-sheet` (монохром, миллиметры, четыре толщины
 * линеек); геометрия и пагинация считаются в чистом `utils/tdfSheet.js`.
 *
 * Двухфазный рендер:
 *  1. measure-зона шириной ровно с полосу набора: из неё берутся высоты строк
 *     и высота шапки, а `pxPerMm` — из реальной ширины контейнера;
 *  2. строки раскладываются по страницам A4.
 *
 * 🚨 Перемер идёт после `document.fonts.ready` и после загрузки КАЖДОГО
 * чертежа: незагруженный `<img>` имеет высоту 0, строка меряется короче
 * реальной, и хвост страницы уезжает (класс багов из ege-tasks/CLAUDE.md).
 */
export default function TDFPrintView({ tdfSet, items, mode, variantNumber, variantTitle, onBack }) {
  const isBlank = mode === 'blank';
  // «Ключ» — тот же конспект, но составом одного варианта: учитель проверяет
  // ответы, не перебирая весь набор.
  const isKey = mode === 'key';

  const [settings, setSettings] = useState(() => readTdfSheetSettings());
  const patch = useCallback((p) => {
    setSettings(prev => {
      const next = normalizeTdfSheetSettings({ ...prev, ...p });
      writeTdfSheetSettings(next);
      return next;
    });
  }, []);

  const measureRef = useRef(null);
  const headRef = useRef(null);
  const rowRefs = useRef({});
  const [layout, setLayout] = useState({ key: null, pages: [[]], rowHeights: null });
  const [bump, setBump] = useState(0);

  const nonHeaderItems = useMemo(() => items.filter(i => !i.is_section_header), [items]);

  // Вариант целиком из геометрических формул печатается компактными полосками:
  // ученику достаётся узкая лента «чертёж → формула», а не лист-таблица.
  const geoMode = isBlank
    && nonHeaderItems.length > 0
    && nonHeaderItems.every(i => i.type === 'geometry_formula');

  const orientation = geoMode ? 'portrait' : settings.orientation;
  const sheet = { ...settings, orientation };

  const widthMm = contentWidthMm(sheet);
  const percents = columnPercents(sheet);
  const figHeightMm = drawingHeightMm(sheet);

  const measureKey = useMemo(() => [
    items.map(i => i.id).join(','),
    mode,
    orientation,
    settings.drawingSize,
    settings.font,
    settings.showType,
    settings.showFormulation,
    settings.showDrawing,
    settings.showNotation,
    settings.showFio,
    settings.showFooter,
    settings.showScore,
    settings.pages,
  ].join('|'), [items, mode, orientation, settings]);

  // Перемер после загрузки шрифтов и чертежей.
  useEffect(() => {
    if (geoMode) return undefined;
    let alive = true;
    const trigger = () => { if (alive) setBump(b => b + 1); };

    document.fonts?.ready?.then(trigger).catch(() => {});

    const root = measureRef.current;
    if (!root) return () => { alive = false; };
    const pending = Array.from(root.querySelectorAll('img')).filter(img => !img.complete);
    pending.forEach(img => {
      img.addEventListener('load', trigger, { once: true });
      img.addEventListener('error', trigger, { once: true });
    });
    return () => {
      alive = false;
      pending.forEach(img => {
        img.removeEventListener('load', trigger);
        img.removeEventListener('error', trigger);
      });
    };
  }, [measureKey, geoMode]);

  useLayoutEffect(() => {
    if (geoMode) return;
    const root = measureRef.current;
    if (!root) return;

    const pxPerMm = root.offsetWidth ? root.offsetWidth / widthMm : MM_PX;
    const footMm = (settings.showFooter || (isBlank && settings.showScore)) ? FOOT_MM : 0;
    const bodyPx = (contentHeightMm(sheet) - footMm) * pxPerMm;
    const headPx = headRef.current ? headRef.current.offsetHeight : 0;
    const firstCap = bodyPx - headPx;
    const restCap = bodyPx;

    let pages;
    let rowHeights = null;

    if (isBlank) {
      // Бланк: состав делится на заданное число листов и растягивается на всю
      // высоту — место для записи важнее «естественной» высоты строки.
      pages = splitIntoPages(items, settings.pages);
      rowHeights = stretchRowHeights(pages, firstCap, restCap, pxPerMm);
    } else {
      const heights = {};
      items.forEach(item => {
        const el = rowRefs.current[item.id];
        if (el) heights[item.id] = el.offsetHeight;
      });
      pages = paginateRows(items, heights, firstCap, restCap);
    }

    setLayout(prev => {
      const same = prev.key === measureKey
        && prev.pages.length === pages.length
        && prev.pages.every((p, i) => p.length === pages[i].length)
        && JSON.stringify(prev.rowHeights) === JSON.stringify(rowHeights);
      return same ? prev : { key: measureKey, pages, rowHeights, pxPerMm };
    });
    // settings/sheet намеренно вне зависимостей: всё, что меняет раскладку,
    // входит в measureKey, а объект настроек пересоздаётся каждый рендер и
    // гонял бы замеры DOM вхолостую.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey, bump, geoMode, isBlank, items]);

  const handlePrint = () => {
    printPaged({ size: `A4 ${orientation}`, margin: '0' });
  };

  const pxPerMm = layout.pxPerMm || MM_PX;

  /* ── Части листа ──────────────────────────────────────────────────────── */

  const colgroup = (
    <colgroup>
      <col style={{ width: '10mm' }} />
      {sheet.showFormulation && <col style={{ width: `${percents.formulation}%` }} />}
      {sheet.showDrawing && <col style={{ width: `${percents.drawing}%` }} />}
      {sheet.showNotation && <col style={{ width: `${percents.notation}%` }} />}
    </colgroup>
  );

  const colCount = 1 + [sheet.showFormulation, sheet.showDrawing, sheet.showNotation].filter(Boolean).length;

  const sheetHead = (refCb) => (
    <div className="tdfp-head" ref={refCb}>
      <div className="tdfp-head__top">
        <div>
          <div className="tdfp-head__kind">
            {isBlank ? 'Устный опрос' : isKey ? 'Ключ учителя' : 'Эталонный конспект'}
          </div>
          <div className="tdfp-head__title">
            {tdfSet?.title}
            {tdfSet?.class_number ? ` · ${tdfSet.class_number} класс` : ''}
          </div>
        </div>
        {(isBlank || isKey) && (
          <div className="tdfp-head__variant">
            Вариант {variantNumber}{variantTitle ? ` — ${variantTitle}` : ''}
          </div>
        )}
      </div>

      {isBlank && settings.showFio && (
        <div className="tdfp-head__fields">
          <div className="tdfp-head__field">
            <span>Фамилия, имя</span>
            <span className="tdfp-head__field-line" />
          </div>
          <div className="tdfp-head__field tdfp-head__field--date">
            <span>Дата</span>
            <span className="tdfp-head__field-line" />
          </div>
        </div>
      )}

      {isBlank && (
        <div className="tdfp-head__note">
          Заполните таблицу по памяти: {[
            sheet.showFormulation && 'формулировка',
            sheet.showDrawing && 'чертёж',
            sheet.showNotation && 'краткая запись',
          ].filter(Boolean).join(', ')}.
        </div>
      )}
    </div>
  );

  const tableHead = (
    <thead className="tdfp-thead">
      <tr>
        <th>№</th>
        {sheet.showFormulation && <th>{isBlank ? 'Пункт и формулировка' : 'Формулировка'}</th>}
        {sheet.showDrawing && <th>Чертёж</th>}
        {sheet.showNotation && <th>Краткая запись</th>}
      </tr>
    </thead>
  );

  /** Поле для записи: разлиновка считается точно под размер ячейки. */
  const writeField = (column, heightMm) => (
    <div className="tdfp-field" style={heightMm ? { height: `${heightMm}mm` } : undefined}>
      <PrintFill
        fill={settings.fill}
        heightMm={heightMm || 12}
        widthMm={Math.max(0, columnWidthMm(sheet, column) - 4)}
      />
    </div>
  );

  const renderRow = (item, num, refCb, rowHeightPx) => {
    const rowStyle = rowHeightPx ? { height: `${rowHeightPx}px` } : undefined;
    const fieldMm = rowHeightPx ? Math.max(8, rowHeightPx / pxPerMm - CELL_PAD_MM) : 0;

    if (item.is_section_header) {
      return (
        <tr key={item.id} ref={refCb} className="tdfp-row" style={rowStyle}>
          <td className="tdfp-cell" colSpan={colCount}>
            <div className="tdfp-head__kind">{item.section_title}</div>
          </td>
        </tr>
      );
    }

    const isGeoFormula = item.type === 'geometry_formula';
    const hideFormula = isBlank && isGeoFormula && item.formula_control_hidden !== false;

    // 🚨 В бланке обычный пункт чертежа НЕ получает — его рисует ученик, это
    // часть ответа. Исключение — гео-формула: там печатается контрольный
    // чертёж (фигура без обозначений), по нему и пишется формула.
    const drawingUrl = isBlank
      ? (isGeoFormula ? api.getTdfItemControlDrawingUrl(item) : null)
      : api.getTdfItemDrawingUrl(item);

    return (
      <tr key={item.id} ref={refCb} className="tdfp-row" style={rowStyle}>
        <td className="tdfp-cell tdfp-cell--num">
          <span className="tdfp-num">{num}</span>
          {settings.showType && item.type && (
            // Короткая подпись: полное слово «Определение» в колонке 10 мм
            // разваливается переносом на три строки.
            <span className="tdfp-type">{tdfTypeShort(item.type)}</span>
          )}
        </td>

        {sheet.showFormulation && (
          <td className="tdfp-cell">
            {isBlank ? (
              <div className="tdfp-field" style={fieldMm ? { height: `${fieldMm}mm` } : undefined}>
                <PrintFill
                  fill={settings.fill}
                  heightMm={fieldMm || 12}
                  widthMm={Math.max(0, columnWidthMm(sheet, 'formulation') - 4)}
                />
                <div className="tdfp-name">{item.name || '—'}</div>
              </div>
            ) : (
              <>
                <div className="tdfp-name">{item.name || '—'}</div>
                <div className="tdfp-text">
                  {item.formulation_md
                    ? <MathRenderer content={item.formulation_md} />
                    : <span className="tdfp-empty">—</span>}
                </div>
              </>
            )}
          </td>
        )}

        {sheet.showDrawing && (
          <td className="tdfp-cell">
            {drawingUrl ? (
              <div className="tdfp-fig">
                <img src={drawingUrl} alt="" style={{ maxHeight: `${figHeightMm}mm` }} />
              </div>
            ) : isBlank ? (
              writeField('drawing', fieldMm)
            ) : (
              <span className="tdfp-empty">—</span>
            )}
          </td>
        )}

        {sheet.showNotation && (
          <td className="tdfp-cell">
            {(isBlank && (hideFormula || !isGeoFormula))
              ? writeField('notation', fieldMm)
              : (
                <div className="tdfp-text">
                  {item.short_notation_md
                    ? <MathRenderer content={item.short_notation_md} />
                    : <span className="tdfp-empty">—</span>}
                </div>
              )}
          </td>
        )}
      </tr>
    );
  };

  const footer = (pageIdx, pageCount) => {
    const showScore = isBlank && settings.showScore && pageIdx === pageCount - 1;
    if (!settings.showFooter && !showScore) return null;
    return (
      <div className="tdfp-foot">
        {showScore ? (
          <span className="tdfp-foot__score">
            Оценка
            <span className="tdfp-foot__line" />
          </span>
        ) : <span />}
        {settings.showFooter && (
          <span className="tdfp-foot__page">
            {tdfSet?.title} · лист {pageIdx + 1} из {pageCount}
          </span>
        )}
      </div>
    );
  };

  /* ── Гео-формат: компактные полоски ───────────────────────────────────── */

  const geoStrips = () => {
    const title = (variantTitle || tdfSet?.title || '').trim();
    return Array.from({ length: settings.geoStrips }, (_, stripIdx) => (
      <div key={stripIdx} className="tdfp-strip">
        <div className="tdfp-strip__head">
          <span className="tdfp-strip__title">{title}</span>
          <span className="tdfp-strip__fio">
            ФИ
            <span className="tdfp-strip__fio-line" />
          </span>
        </div>
        <ol className="tdfp-strip__list">
          {nonHeaderItems.map((item, i) => {
            const showFormula = item.formula_control_hidden === false;
            const formulas = parseFormulas(item.short_notation_md);
            return (
              <li key={item.id} className="tdfp-strip__item">
                <span className="tdfp-strip__num">{i + 1}.</span>
                <div className="tdfp-strip__fig">
                  {item.drawing_image_control
                    ? <img src={api.getTdfItemControlDrawingUrl(item)} alt="" />
                    : <div className="tdfp-strip__fig--empty" />}
                </div>
                <div className="tdfp-strip__formulas">
                  {item.name && <div className="tdfp-strip__name">{item.name}</div>}
                  {formulas.length > 1 && (
                    <div className="tdfp-strip__hint">
                      Запишите {formulas.length} {pluralRu(formulas.length, FORMULA_WORDS)}:
                    </div>
                  )}
                  {showFormula && item.short_notation_md ? (
                    <div className="tdfp-text"><MathRenderer content={item.short_notation_md} /></div>
                  ) : (
                    formulas.map((f, idx) => (
                      <div key={idx} className="tdfp-strip__row">
                        <span className="tdfp-strip__lhs"><MathRenderer content={f.lhs} /></span>
                        <span className="tdfp-strip__line" />
                      </div>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    ));
  };

  /* ── Сборка ───────────────────────────────────────────────────────────── */

  const rootClass = [
    'tdfp-root',
    `tdfp-root--${orientation}`,
    settings.font === 'serif' ? 'tdfp-root--serif' : '',
  ].filter(Boolean).join(' ');

  const pages = layout.key === measureKey ? layout.pages : null;
  const pageClass = `tdfp-page${orientation === 'portrait' ? ' tdfp-page--portrait' : ''}`;

  let globalNum = 0;

  return (
    <div className={rootClass}>
      <div className="tdfp-toolbar no-print">
        <div className="tdfp-toolbar__row">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <span className="tdfp-toolbar__title">
            {isBlank
              ? `Бланк опроса · вариант ${variantNumber}${variantTitle ? ` — ${variantTitle}` : ''}`
              : isKey
                ? `Ключ учителя · вариант ${variantNumber}`
                : 'Эталонный конспект'}
          </span>
          <span className="tdfp-toolbar__hint">
            {pages ? `${pages.length} ${pluralRu(pages.length, ['лист', 'листа', 'листов'])} A4` : 'считаем раскладку…'}
          </span>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
        </div>
        <div className="tdfp-toolbar__row">
          <TDFSheetSettings settings={settings} patch={patch} isBlank={isBlank} geoMode={geoMode} />
        </div>
        {geoMode && (
          <div className="tdfp-toolbar__hint">
            Вариант целиком из геометрических формул — печатается компактными полосками: чертёж и место для формулы.
          </div>
        )}
      </div>

      {/* Зона измерения: ширина ровно с полосу набора */}
      {!geoMode && (
        <div className="tdfp-measure" ref={measureRef} style={{ width: `${widthMm}mm` }}>
          {sheetHead(headRef)}
          {!isBlank && (
            <table className="tdfp-table">
              {colgroup}
              {tableHead}
              <tbody>
                {items.map(item => renderRow(item, 0, el => { rowRefs.current[item.id] = el; }))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="tdfp-pages">
        {geoMode ? (
          <div className={`${pageClass} tdfp-page--geo`}>{geoStrips()}</div>
        ) : pages ? (
          pages.map((pageItems, pageIdx) => (
            <div key={pageIdx} className={pageClass}>
              {pageIdx === 0 && sheetHead()}
              <table className="tdfp-table">
                {colgroup}
                {tableHead}
                <tbody>
                  {pageItems.map(item => {
                    if (!item.is_section_header) globalNum++;
                    const rowH = layout.rowHeights ? layout.rowHeights[pageIdx] : undefined;
                    return renderRow(item, globalNum, undefined, rowH);
                  })}
                </tbody>
              </table>
              {footer(pageIdx, pages.length)}
            </div>
          ))
        ) : (
          <div className={pageClass} />
        )}
      </div>
    </div>
  );
}
