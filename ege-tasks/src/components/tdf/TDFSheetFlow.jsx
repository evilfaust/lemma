import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Segmented, Space, Switch, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import PrintFill from '../shared/PrintFill';
import MathText from '../shared/MathText';
import TdfText from './TdfText';
import { tdfTypeLabel } from './tdfTypes';
import { printPaged } from '../../utils/printPage';
import { MM_PX, paginateRows, pluralRu } from '../../utils/tdfSheet';
import {
  FLOW_DRAWING_SHARE, SPACE_FACTORS, TEXT_PT_OPTIONS,
  answerSpaceMm, flowContentHeightMm, flowContentWidthMm, flowSummary, hasOwnNumber,
  itemView, normalizeFlowSettings, readFlowSettings, writeFlowSettings,
} from '../../utils/tdfFlowSheet';
import './TDFSheetFlow.css';

const { Text } = Typography;

const MODE_OPTIONS = [
  { value: 'etalon', label: 'Эталон' },
  { value: 'gaps', label: 'С пропусками' },
  { value: 'headers', label: 'Только заголовки' },
];
const MODE_TITLES = { etalon: 'Конспект', gaps: 'Лист с пропусками', headers: 'Лист для записи' };
const FILL_OPTIONS = [
  { value: 'grid', label: 'Клетка' },
  { value: 'lines', label: 'Линейка' },
  { value: 'blank', label: 'Пусто' },
];
const FONT_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];

function Row({ label, hint, children }) {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
}

/**
 * «Лист» ТДФ: пункты набора потоком на A4 книжном — номер, название, под ним
 * текст пункта (формулы, свойства, графики). Три вида: эталон, с пропусками,
 * только заголовки (место для записи по высоте эталона).
 *
 * Двухфазный рендер, как у конспекта: measure-зона шириной с полосу набора →
 * высоты блоков → `paginateRows`. 🚨 Перемер — после `document.fonts.ready`
 * и загрузки каждого чертежа (незагруженный <img> имеет высоту 0).
 */
export default function TDFSheetFlow({ tdfSet, items, variantNumber, variantTitle, onBack }) {
  const [settings, setSettings] = useState(() => readFlowSettings());
  const patch = useCallback((p) => {
    setSettings(prev => {
      const next = normalizeFlowSettings({ ...prev, ...p });
      writeFlowSettings(next);
      return next;
    });
  }, []);

  const widthMm = flowContentWidthMm();
  const measureRef = useRef(null);
  const headRef = useRef(null);
  const blockRefs = useRef({});
  const bodyRefs = useRef({});
  const [bump, setBump] = useState(0);
  const [layout, setLayout] = useState({ key: null, pages: null, spaces: {}, pxPerMm: MM_PX });

  const summary = useMemo(() => flowSummary(items, settings), [items, settings]);

  const measureKey = useMemo(() => [
    items.map(i => `${i.id}:${i.updated || ''}`).join(','),
    settings.mode, settings.plainItems, settings.spaceFactor, settings.font,
    settings.textPt, settings.drawingSize, settings.showFio, settings.showFooter, settings.showType,
  ].join('|'), [items, settings]);

  useEffect(() => {
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
  }, [measureKey]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const pxPerMm = root.offsetWidth ? root.offsetWidth / widthMm : MM_PX;
    const bodyCap = flowContentHeightMm(settings) * pxPerMm;
    const headPx = headRef.current ? headRef.current.offsetHeight : 0;

    const heights = {};
    const spaces = {};
    for (const item of items) {
      const block = blockRefs.current[item.id];
      if (!block) continue;
      let h = block.offsetHeight;
      if (!item.is_section_header && itemView(item, settings) === 'header') {
        // В measure-зоне у такого пункта нарисован ЭТАЛОН — по нему и место.
        const body = bodyRefs.current[item.id];
        const bodyPx = body ? body.offsetHeight : 0;
        const space = answerSpaceMm(bodyPx / pxPerMm, settings.spaceFactor);
        spaces[item.id] = space;
        h = h - bodyPx + space * pxPerMm;
      }
      heights[item.id] = h;
    }
    const pages = paginateRows(items, heights, bodyCap - headPx, bodyCap);

    setLayout(prev => {
      const same = prev.key === measureKey
        && prev.pages?.length === pages.length
        && prev.pages.every((p, i) => p.length === pages[i].length)
        && JSON.stringify(prev.spaces) === JSON.stringify(spaces);
      return same ? prev : { key: measureKey, pages, spaces, pxPerMm };
    });
    // settings входят в measureKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey, bump, items]);

  const drawingShare = FLOW_DRAWING_SHARE[settings.drawingSize];

  /* ── Части листа ──────────────────────────────────────────────────────── */

  const sheetTitle = (() => {
    const t = (variantTitle || tdfSet?.title || '').trim();
    const cls = tdfSet?.class_number ? ` ${tdfSet.class_number} класс.` : '';
    return `ТДФ «${t}».${cls}`;
  })();

  const sheetHead = (refCb) => (
    <div className="tdfs-head" ref={refCb}>
      {settings.showFio ? (
        <div className="tdfs-head__fio">
          <span>ФИ</span>
          <span className="tdfs-head__line" />
        </div>
      ) : <span />}
      <div className="tdfs-head__title">
        {sheetTitle}
        {variantNumber ? <span className="tdfs-head__variant"> Вариант {variantNumber}</span> : null}
      </div>
    </div>
  );

  const drawingUrlFor = (item, view) => {
    if (view === 'header') return null;
    if (item.type === 'geometry_formula' && view === 'gaps') {
      return item.drawing_image_control ? api.getTdfItemControlDrawingUrl(item) : null;
    }
    return item.drawing_image ? api.getTdfItemDrawingUrl(item) : null;
  };

  /** Текст пункта в виде `view` (эталон / с пропусками). */
  const itemBody = (item, view) => {
    const mode = view === 'gaps' ? 'gaps' : 'etalon';
    const url = drawingUrlFor(item, view);
    const hasText = (item.formulation_md || '').trim() || (item.short_notation_md || '').trim();
    if (!hasText && !url) return null;
    return (
      <div className={`tdfs-item__content${url ? ' tdfs-item__content--fig' : ''}`}>
        <div className="tdfs-item__text">
          {(item.formulation_md || '').trim() && <TdfText md={item.formulation_md} mode={mode} seed={item.id} />}
          {(item.short_notation_md || '').trim() && (
            <div className="tdfs-item__notation"><TdfText md={item.short_notation_md} mode={mode} seed={item.id} /></div>
          )}
        </div>
        {url && (
          <div className="tdfs-item__fig" style={{ width: `${drawingShare * 100}%` }}>
            <img src={url} alt="" />
          </div>
        )}
      </div>
    );
  };

  /**
   * Блок пункта. В measure-зоне (`measure`) у пункта «только заголовок»
   * рисуется эталон — по его высоте считается место для записи.
   */
  const renderBlock = (item, num, { measure = false } = {}) => {
    if (item.is_section_header) {
      return (
        <div key={item.id} className="tdfs-section" ref={measure ? (el => { blockRefs.current[item.id] = el; }) : undefined}>
          {item.section_title}
        </div>
      );
    }
    const view = itemView(item, settings);
    const ownNum = hasOwnNumber(item.name);
    const typeLabel = settings.showType && item.type ? `${tdfTypeLabel(item.type)}. ` : '';
    const spaceMm = layout.spaces[item.id];

    let body;
    if (view === 'header' && !measure) {
      const h = spaceMm || 20;
      body = (
        <div className="tdfs-space" style={{ height: `${h}mm` }}>
          <PrintFill fill={settings.fill} heightMm={h} widthMm={widthMm - 10} />
        </div>
      );
    } else {
      body = itemBody(item, view === 'header' ? 'etalon' : view);
    }

    return (
      <div
        key={item.id}
        className="tdfs-item"
        ref={measure ? (el => { blockRefs.current[item.id] = el; }) : undefined}
      >
        <div className="tdfs-item__head">
          {!ownNum && <span className="tdfs-item__num">{num}.</span>}
          <span className="tdfs-item__name">{typeLabel}<MathText text={item.name || ''} /></span>
        </div>
        {body && (
          <div className="tdfs-item__body" ref={measure ? (el => { bodyRefs.current[item.id] = el; }) : undefined}>
            {body}
          </div>
        )}
      </div>
    );
  };

  const numbered = useMemo(() => {
    let n = 0;
    const map = {};
    for (const item of items) {
      if (!item.is_section_header) { n += 1; map[item.id] = n; }
    }
    return map;
  }, [items]);

  const pages = layout.key === measureKey ? layout.pages : null;

  const rootClass = [
    'tdfs-root',
    settings.font === 'serif' ? 'tdfs-root--serif' : '',
  ].filter(Boolean).join(' ');

  const summaryText = [
    summary.etalon && `целиком: ${summary.etalon}`,
    summary.gaps && `с пропусками: ${summary.gaps}`,
    summary.header && `только заголовок: ${summary.header}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className={rootClass} style={{ '--tdfs-pt': `${settings.textPt}pt` }}>
      <div className="tdfs-toolbar no-print">
        <div className="tdfs-toolbar__row">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <span className="tdfs-toolbar__title">
            {MODE_TITLES[settings.mode]}{variantNumber ? ` · вариант ${variantNumber}` : ''}
          </span>
          <span className="tdfs-toolbar__hint">
            {pages ? `${pages.length} ${pluralRu(pages.length, ['лист', 'листа', 'листов'])} A4` : 'считаем раскладку…'}
          </span>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => printPaged({ size: 'A4 portrait', margin: '0' })}>
            Печать
          </Button>
        </div>
        <div className="tdfs-toolbar__row">
          <Segmented value={settings.mode} onChange={v => patch({ mode: v })} options={MODE_OPTIONS} />
          {settings.mode === 'gaps' && (
            <Row
              label="Пункты без пропусков:"
              hint="В тексте пункта нет ни одного пропуска [[…]] — печатать его целиком (как образец) или оставить место для записи."
            >
              <Segmented
                size="small"
                value={settings.plainItems}
                onChange={v => patch({ plainItems: v })}
                options={[{ value: 'full', label: 'целиком' }, { value: 'header', label: 'место для записи' }]}
              />
            </Row>
          )}
          {(settings.mode === 'headers' || (settings.mode === 'gaps' && settings.plainItems === 'header')) && (
            <>
              <Row label="Место:" hint="Высота места для записи = высота эталонного ответа × множитель (почерк крупнее печати).">
                <Segmented
                  size="small"
                  value={settings.spaceFactor}
                  onChange={v => patch({ spaceFactor: v })}
                  options={SPACE_FACTORS.map(f => ({ value: f, label: `×${String(f).replace('.', ',')}` }))}
                />
              </Row>
              <Row label="Разлиновка:">
                <Segmented size="small" value={settings.fill} onChange={v => patch({ fill: v })} options={FILL_OPTIONS} />
              </Row>
            </>
          )}
        </div>
        <div className="tdfs-toolbar__row">
          <Row label="Кегль:">
            <Segmented size="small" value={settings.textPt} onChange={v => patch({ textPt: v })} options={TEXT_PT_OPTIONS.map(v => ({ value: v, label: `${v}` }))} />
          </Row>
          <Row label="Шрифт:">
            <Segmented size="small" value={settings.font} onChange={v => patch({ font: v })} options={FONT_OPTIONS} />
          </Row>
          <Row label="Чертёж:">
            <Segmented size="small" value={settings.drawingSize} onChange={v => patch({ drawingSize: v })} options={['s', 'm', 'l'].map(v => ({ value: v, label: v.toUpperCase() }))} />
          </Row>
          <Row label="ФИ"><Switch size="small" checked={settings.showFio} onChange={v => patch({ showFio: v })} /></Row>
          <Row label="Тип пункта"><Switch size="small" checked={settings.showType} onChange={v => patch({ showType: v })} /></Row>
          <Row label="Колонтитул"><Switch size="small" checked={settings.showFooter} onChange={v => patch({ showFooter: v })} /></Row>
          {summaryText && <span className="tdfs-toolbar__hint">{summaryText}</span>}
        </div>
      </div>

      {/* Зона измерения: ширина ровно с полосу набора */}
      <div className="tdfs-measure" ref={measureRef} style={{ width: `${widthMm}mm` }}>
        {sheetHead(headRef)}
        {items.map(item => renderBlock(item, numbered[item.id], { measure: true }))}
      </div>

      <div className="tdfs-pages">
        {pages ? pages.map((pageItems, pageIdx) => (
          <div key={pageIdx} className="tdfs-page">
            <div className="tdfs-page__body">
              {pageIdx === 0 && sheetHead()}
              {pageItems.map(item => renderBlock(item, numbered[item.id]))}
            </div>
            {settings.showFooter && (
              <div className="tdfs-foot">
                <span>{tdfSet?.title}</span>
                <span>лист {pageIdx + 1} из {pages.length}</span>
              </div>
            )}
          </div>
        )) : <div className="tdfs-page" />}
      </div>
    </div>
  );
}
