import { useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Switch, Tag, Typography } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { GeometryPreviewCard, normalizeLayout, PRINT_CELL_ASPECT_RATIO } from '../GeometryTaskPreview';
import '../GeometryTaskPreview.css';

const { Text } = Typography;

export default function TabLayout({ task, previewStatement, ggbImageBase64, layout, onLayoutChange, onReset }) {
  const [layoutEditMode, setLayoutEditMode] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);

  const previewTask = useMemo(() => ({
    ...(task || {}),
    statement_md: previewStatement || task?.statement_md || '',
    ...(ggbImageBase64 ? { geogebra_image_base64: ggbImageBase64 } : {}),
  }), [task, previewStatement, ggbImageBase64]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <Alert
        type="info"
        showIcon
        message="Расположение чертежа и условия для печатного листа A5. Перетаскивайте блоки мышью, тяните за угловые маркеры для изменения размера. Макет сохраняется вместе с задачей."
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Space size={8}>
            <Switch checked={layoutEditMode} onChange={setLayoutEditMode} />
            <Text>Редактировать макет</Text>
          </Space>
          <Space size={8}>
            <Switch checked={showAnswers} onChange={setShowAnswers} />
            <Text>Показывать ответ</Text>
          </Space>
          <Tag>Карточка A5</Tag>
        </Space>
        <Button icon={<UndoOutlined />} onClick={onReset}>
          Сбросить по умолчанию
        </Button>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <div
          className="geometry-preview-grid a5"
          style={{
            gridTemplateColumns: '1fr',
            gridTemplateRows: '1fr',
            aspectRatio: String(PRINT_CELL_ASPECT_RATIO),
            border: '1.5px solid #c0c0c0',
            background: '#fff',
          }}
        >
          <GeometryPreviewCard
            task={previewTask}
            index={0}
            showAnswers={showAnswers}
            mode="student"
            drawingMode="task"
            editable={layoutEditMode}
            layout={layout}
            onLayoutChange={onLayoutChange}
          />
        </div>
      </div>

      <Card
        size="small"
        styles={{ body: { padding: '10px 16px', color: '#888', fontSize: 12, lineHeight: 1.6 } }}
      >
        <strong>Как это работает:</strong> здесь задаётся расположение блоков на ячейке листа A5.
        При формировании листа позиции берутся из этого макета автоматически — ничего не нужно
        настраивать заново. При необходимости тонкую настройку можно сделать прямо на листе A5.
      </Card>
    </Space>
  );
}
