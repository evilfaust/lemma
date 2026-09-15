import { useMemo, useState } from 'react';
import { Button, Segmented, Space, Switch, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import { printPaged } from '../../utils/printPage';
import { tdfTypeLabel } from './tdfTypes';
import {
  CARD_GAP, CARD_HEAD_MM, CARD_PAD, CARD_PAGE,
  applyCardCount, cardContentMm, cardFormatLabel, cardSizeMm, fillPage,
  normalizeCardSettings, paginateCards, readCardSettings, writeCardSettings,
  CARD_COUNTS, CARD_GRIDS,
} from '../../utils/tdfCards';
import './TDFCardsPrint.css';

const { Text } = Typography;

function Row({ label, hint, children }) {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
}

const MODE_OPTIONS = [
  { value: 'question', label: 'Только вопрос' },
  { value: 'both', label: 'Вопрос и ответ' },
];
const FONT_OPTIONS = [
  { value: 'sans', label: 'Гротеск' },
  { value: 'serif', label: 'Антиква' },
];
const TEXT_OPTIONS = [7, 8, 9, 10, 11, 12, 14, 16, 18].map(pt => ({ value: pt, label: String(pt) }));

/**
 * Лист карточек ТДФ: A4 режется на равные карточки, карточка достаётся ученику.
 *
 * Два режима. «Только вопрос» — карточка для опроса у доски или жеребьёвки.
 * «Вопрос и ответ» — карточка для работы в парах: спрашивающий видит ответ
 * мелким под волосяной линией и проверяет соседа сам.
 */
export default function TDFCardsPrint({ tdfSet, items, onBack }) {
  const [settings, setSettings] = useState(() => readCardSettings());

  const save = (next) => { writeCardSettings(next); return next; };
  const patch = (p) => setSettings(prev => save(normalizeCardSettings({ ...prev, ...p })));
  const setCount = (count) => setSettings(prev => save(applyCardCount(prev, count)));

  const cards = useMemo(() => items.filter(i => !i.is_section_header), [items]);
  const pages = useMemo(() => paginateCards(cards, settings.count), [cards, settings.count]);

  const size = cardSizeMm(settings.count);
  const content = cardContentMm(settings.count);
  const grid = CARD_GRIDS[settings.count];

  const handlePrint = () => printPaged({ size: 'A4 portrait', margin: '0' });

  const renderCard = (item, idx) => {
    if (!item) {
      return <div key={`empty-${idx}`} className="tdfc-card tdfc-card--empty" style={{ width: `${size.wMm}mm`, height: `${size.hMm}mm` }} />;
    }
    const figureUrl = settings.showFigure && item.drawing_image ? api.getTdfItemDrawingUrl(item) : null;
    const question = (item.question_md || '').trim();

    return (
      <div key={item.id} className="tdfc-card" style={{ width: `${size.wMm}mm`, height: `${size.hMm}mm` }}>
        <div className="tdfc-head" style={{ height: `${CARD_HEAD_MM}mm` }}>
          <span className="tdfc-num">{idx + 1}</span>
          {settings.showType && item.type && <span className="tdfc-type">{tdfTypeLabel(item.type)}</span>}
          {settings.showTitle && tdfSet?.title && <span className="tdfc-set">{tdfSet.title}</span>}
        </div>

        <div className="tdfc-body" style={{ height: `${content.hMm}mm`, fontSize: `${settings.textSize}pt` }}>
          <div className="tdfc-question">
            {question ? <MathRenderer content={question} /> : (item.name || '—')}
          </div>

          {figureUrl && (
            <div className="tdfc-fig">
              <img src={figureUrl} alt="" style={{ maxHeight: `${content.hMm * (settings.mode === 'both' ? 0.3 : 0.5)}mm` }} />
            </div>
          )}

          {settings.mode === 'both' && (
            <div className="tdfc-answer">
              <div className="tdfc-answer__label">Ответ</div>
              {item.formulation_md
                ? <MathRenderer content={item.formulation_md} />
                : <span>{item.short_notation_md ? <MathRenderer content={item.short_notation_md} /> : '—'}</span>}
              {item.formulation_md && item.short_notation_md && (
                <div className="tdfc-answer__short"><MathRenderer content={item.short_notation_md} /></div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`tdfc-root${settings.font === 'serif' ? ' tdfc-root--serif' : ''}`}>
      <div className="tdfc-toolbar no-print">
        <div className="tdfc-toolbar__row">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <span className="tdfc-toolbar__title">Карточки ТДФ</span>
          <span className="tdfc-toolbar__hint">
            {cards.length} карточек · {pages.length} лист(ов) · {cardFormatLabel(settings.count)}
          </span>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!pages.length}>
            Печать
          </Button>
        </div>

        <div className="tdfc-toolbar__row">
          <Row label="Карточек на лист:" hint="Лист A4 делится на равные карточки; между ними — поле для реза.">
            <Segmented size="small" value={settings.count} onChange={setCount} options={CARD_COUNTS} />
          </Row>
          <Row label="Кегль, pt:" hint="Размер текста вопроса. На плотных листах ставьте мельче.">
            <Segmented size="small" value={settings.textSize} onChange={v => patch({ textSize: v })} options={TEXT_OPTIONS} />
          </Row>
          <Row label="Что на карточке:" hint="«Вопрос и ответ» — для работы в парах: спрашивающий проверяет соседа сам.">
            <Segmented size="small" value={settings.mode} onChange={v => patch({ mode: v })} options={MODE_OPTIONS} />
          </Row>
        </div>

        <div className="tdfc-toolbar__row">
          <Row label="Шрифт:"><Segmented size="small" value={settings.font} onChange={v => patch({ font: v })} options={FONT_OPTIONS} /></Row>
          <Row label="Чертёж:"><Switch size="small" checked={settings.showFigure} onChange={v => patch({ showFigure: v })} /></Row>
          <Row label="Тип пункта:"><Switch size="small" checked={settings.showType} onChange={v => patch({ showType: v })} /></Row>
          <Row label="Название набора:"><Switch size="small" checked={settings.showTitle} onChange={v => patch({ showTitle: v })} /></Row>
        </div>
      </div>

      <div className="tdfc-pages">
        {pages.map((pageItems, pageIdx) => (
          <div
            key={pageIdx}
            className="tdfc-sheet"
            style={{
              width: `${CARD_PAGE.w}mm`,
              height: `${CARD_PAGE.h}mm`,
              padding: `${CARD_PAD}mm`,
              gap: `${CARD_GAP}mm`,
              gridTemplateColumns: `repeat(${grid.cols}, ${size.wMm}mm)`,
              gridTemplateRows: `repeat(${grid.rows}, ${size.hMm}mm)`,
            }}
          >
            {fillPage(pageItems, settings.count).map((item, i) =>
              renderCard(item, item ? pageIdx * settings.count + i : i))}
          </div>
        ))}
      </div>
    </div>
  );
}
