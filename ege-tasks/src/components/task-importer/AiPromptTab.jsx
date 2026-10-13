import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Input, Select, Space, Typography, App } from 'antd';
import { CopyOutlined, FileTextOutlined } from '@ant-design/icons';
import { buildTaskImportPrompt, NEEDS_PICTURE_TAG } from '../../utils/taskImportPrompt';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * Вкладка «Промпт для ИИ» в «Импорте задач»: учитель копирует промпт с
 * каталогом тем во внешнюю модель вместе с фото/PDF задач и вставляет ответ
 * во вкладку «Вставить текст». Своей ИИ-ручки нет — как в «Импорте работы».
 */
export default function AiPromptTab({ topics = [], examTypeOptions = [], onGoToText }) {
  const { message } = App.useApp();
  const [examType, setExamType] = useState(null);
  const [drawings, setDrawings] = useState(true);

  const prompt = useMemo(
    () => buildTaskImportPrompt({ topics, examType, drawings }),
    [topics, examType, drawings],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      message.success('Промпт скопирован — вставьте его в ИИ вместе с фото задач');
    } catch {
      message.warning('Не удалось скопировать автоматически — выделите текст и скопируйте вручную');
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Задачи с фото, скана или PDF"
        description={
          <div>
            <Paragraph style={{ marginBottom: 8 }}>
              Скопируйте промпт и отправьте его любой ИИ вместе с фото задач. Ответ ИИ
              вставьте во вкладку <Text strong>«Вставить текст»</Text>. В промпт уже вшит
              список ваших тем — все задачи файла уйдут в одну тему.
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              Чертежи, графики, диаграммы и числовые прямые ИИ перерисует командами наших
              редакторов. Что перерисовать нельзя, придёт без рисунка с тегом
              {' '}<Text code>{NEEDS_PICTURE_TAG}</Text> — картинку добавите в карточке задачи.
            </Paragraph>
          </div>
        }
      />
      <Space wrap>
        <Select
          style={{ minWidth: 220 }}
          allowClear
          placeholder="Темы: все экзамены"
          value={examType}
          onChange={(v) => setExamType(v ?? null)}
          options={examTypeOptions}
        />
        <Checkbox checked={drawings} onChange={(e) => setDrawings(e.target.checked)}>
          Чертежи текстом
        </Checkbox>
      </Space>
      <TextArea
        value={prompt}
        readOnly
        autoSize={{ minRows: 12, maxRows: 20 }}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
        aria-label="Промпт для ИИ"
      />
      <Space wrap>
        <Button type="primary" icon={<CopyOutlined />} onClick={copy}>Скопировать промпт</Button>
        {onGoToText && (
          <Button icon={<FileTextOutlined />} onClick={onGoToText}>Вставить ответ ИИ</Button>
        )}
      </Space>
    </Space>
  );
}
