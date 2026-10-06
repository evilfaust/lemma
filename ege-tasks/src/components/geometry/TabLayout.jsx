import { useMemo, useState } from 'react';
import { Alert, Segmented, Select, Space, Switch, Tooltip, Typography } from 'antd';
import GeometryCard, { PLACE_OPTIONS } from './cards/GeometryCard';
import {
  CARD_LAYOUTS, DEFAULT_CARD_LAYOUT, cardLayoutById, cardSizeMm, cardTextMm,
} from '../../utils/geometryCards';
import './cards/geometryCards.css';

const { Text } = Typography;

/**
 * Вкладка «Макет»: как задача встанет на карточку A5/A4. Раскладку «текст ↔
 * чертёж» карточка выбирает сама; здесь задаётся выбор по умолчанию для этой
 * задачи (`preview_layout.card.place`). В работе его можно переопределить.
 */
export default function TabLayout({
  task, previewStatement, ggbImageBase64, drawingSvg, drawingView, place = 'auto', onPlaceChange,
}) {
  const [layoutId, setLayoutId] = useState(DEFAULT_CARD_LAYOUT);
  const [showAnswer, setShowAnswer] = useState(false);

  const previewTask = useMemo(() => ({
    ...(task || {}),
    statement_md: previewStatement || task?.statement_md || '',
    ...(ggbImageBase64 ? { geogebra_image_base64: ggbImageBase64 } : {}),
    // живой чертёж редактора, а не сохранённый
    ...(drawingView ? { drawing_view: drawingView, drawing_svg: drawingSvg || '' } : {}),
  }), [task, previewStatement, ggbImageBase64, drawingSvg, drawingView]);

  const layout = cardLayoutById(layoutId);
  const size = cardSizeMm(layout, { header: false, code: true });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <Alert
        type="info"
        showIcon
        message="Карточка раскладывается сама: условие и чертёж не перекрываются, чертёж — как можно крупнее, буквы на нём — как в условии. Если автоматический выбор не нравится, укажите, где стоять чертежу."
      />

      <Space wrap size={[16, 8]}>
        <Space size={6}>
          <Text>Чертёж</Text>
          <Segmented
            value={place}
            onChange={onPlaceChange}
            options={PLACE_OPTIONS.map((o) => ({
              value: o.value,
              label: <Tooltip title={o.title}>{o.icon || o.label}</Tooltip>,
            }))}
          />
        </Space>
        <Space size={6}>
          <Text>Карточка</Text>
          <Select
            value={layoutId}
            onChange={setLayoutId}
            options={CARD_LAYOUTS.map((l) => ({ value: l.id, label: l.label }))}
            style={{ width: 150 }}
          />
        </Space>
        <Space size={6}>
          <Switch size="small" checked={showAnswer} onChange={setShowAnswer} />
          <Text>Ответ</Text>
        </Space>
      </Space>

      <div className="gc-root gc-font-sans gc-preview-one" lang="ru">
        <div
          className="gc-grid-sheet"
          style={{
            gridTemplateColumns: `${size.cell.w}mm`,
            gridTemplateRows: `${size.cell.h}mm`,
          }}
        >
          <GeometryCard
            task={previewTask}
            number={1}
            size={size}
            textMm={cardTextMm(layout)}
            place={place}
            showAnswer={showAnswer}
            showCode
          />
        </div>
      </div>
    </Space>
  );
}
