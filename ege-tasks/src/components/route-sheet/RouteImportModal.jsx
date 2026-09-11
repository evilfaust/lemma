import { useMemo, useState } from 'react';
import {
  Alert, App, Button, Input, InputNumber, Modal, Space, Tabs, Typography, Upload,
} from 'antd';
import {
  CopyOutlined, InboxOutlined, RobotOutlined, PlusOutlined, SwapOutlined,
} from '@ant-design/icons';
import RouteStatementRenderer from './RouteStatementRenderer';
import { circleNum } from '../../utils/routeSheet';
import { parseRouteMarkdown, buildRouteAiPrompt } from '../../utils/routeImport';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

const EXAMPLE = `---
маршрут: Проценты и площади
класс: 7
---

### 1
ответ: 48

Найдите 12 % от 400.

### 2
ответ: 2304

Сторона квадрата равна [1] см. Найдите его площадь (в см$^2$).

### 3
ответ: 4

Во сколько раз [2] больше, чем 576?`;

/**
 * Загрузка готового маршрута текстом.
 *
 * Своей ИИ-ручки под разбор фото здесь нет намеренно — то же решение, что в
 * «Импорте работы»: кнопка «Промпт для ИИ», внешняя модель, вставка результата
 * обратно. Так маршрут можно получить и от коллеги файлом, и от любой модели,
 * а единственная своя ручка (`/generate-chain`) перестаёт быть точкой отказа.
 *
 * Задачи попадают в лист снимком, в банк не пишутся: цепочка «уменьшите [②] в
 * [①] раз» вне своего листа бессмысленна.
 */
export default function RouteImportModal({ open, onClose, onApply, hasTasks }) {
  const { message } = App.useApp();
  const [text, setText] = useState('');
  const [promptTopic, setPromptTopic] = useState('');
  const [promptClass, setPromptClass] = useState(7);
  const [promptLength, setPromptLength] = useState(4);

  const parsed = useMemo(() => (text.trim() ? parseRouteMarkdown(text) : null), [text]);
  const canApply = !!parsed && parsed.tasks.length > 0 && parsed.errors.length === 0;

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setText(String(e.target?.result || ''));
    reader.readAsText(file);
    return false; // Upload ничего не отправляет — читаем файл на месте
  };

  const handleCopyPrompt = async () => {
    const prompt = buildRouteAiPrompt({
      classNumber: promptClass || null,
      topic: promptTopic.trim(),
      length: promptLength || 4,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      message.success('Промпт скопирован — вставьте его в любую ИИ-модель');
    } catch {
      // Буфер недоступен (не-https, отказ в правах) — отдаём текст глазами.
      Modal.info({
        title: 'Промпт для ИИ',
        width: 720,
        content: <TextArea value={prompt} rows={16} readOnly style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />,
      });
    }
  };

  const apply = (mode) => {
    onApply(mode, {
      title: parsed.title,
      tasks: parsed.tasks.map(t => ({ statement_md: t.statement_md, answer: t.answer })),
    });
    setText('');
    onClose();
  };

  return (
    <Modal
      title="Загрузить готовый маршрут"
      open={open}
      onCancel={onClose}
      width={820}
      footer={[
        <Button key="cancel" onClick={onClose}>Отмена</Button>,
        hasTasks && (
          <Button key="add" icon={<PlusOutlined />} disabled={!canApply} onClick={() => apply('append')}>
            Добавить в конец
          </Button>
        ),
        <Button key="replace" type="primary" icon={<SwapOutlined />} disabled={!canApply} onClick={() => apply('replace')}>
          {hasTasks ? 'Заменить цепочку' : 'Загрузить'}
        </Button>,
      ].filter(Boolean)}
    >
      <Tabs
        items={[
          {
            key: 'paste',
            label: 'Текст маршрута',
            children: (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Dragger accept=".md,.txt,.markdown" beforeUpload={handleFile} showUploadList={false}>
                  <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}><InboxOutlined /></p>
                  <p className="ant-upload-text" style={{ fontSize: 13 }}>Перетащите файл .md или нажмите</p>
                </Dragger>

                <TextArea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={12}
                  placeholder={EXAMPLE}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />

                <Space size={8}>
                  <Button size="small" onClick={() => setText(EXAMPLE)}>Вставить пример</Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Формат: шапка, «### N», строка «ответ:» под заголовком, место подстановки — [1], [2]…
                  </Text>
                </Space>
              </Space>
            ),
          },
          {
            key: 'ai',
            label: <span><RobotOutlined /> Промпт для ИИ</span>,
            children: (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                  Скопируйте промпт и вставьте его в любую ИИ-модель — вместе с фотографией
                  листка, если переносите готовый маршрут с бумаги. Результат вставьте
                  на вкладку «Текст маршрута».
                </Paragraph>
                <Space wrap>
                  <Input
                    value={promptTopic}
                    onChange={e => setPromptTopic(e.target.value)}
                    placeholder="Тема (необязательно)"
                    style={{ width: 260 }}
                  />
                  <InputNumber
                    value={promptClass}
                    onChange={setPromptClass}
                    min={1} max={11}
                    addonBefore="класс"
                    style={{ width: 130 }}
                  />
                  <InputNumber
                    value={promptLength}
                    onChange={setPromptLength}
                    min={2} max={20}
                    addonBefore="задач"
                    style={{ width: 130 }}
                  />
                  <Button type="primary" icon={<CopyOutlined />} onClick={handleCopyPrompt}>
                    Скопировать промпт
                  </Button>
                </Space>
              </Space>
            ),
          },
        ]}
      />

      {parsed && (
        <div style={{ marginTop: 12 }}>
          {parsed.errors.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 8 }}
              message="Так загрузить нельзя"
              description={<ul style={{ margin: 0, paddingLeft: 16 }}>{parsed.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            />
          )}
          {parsed.warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              message={`Стоит проверить: ${parsed.warnings.length}`}
              description={<ul style={{ margin: 0, paddingLeft: 16 }}>{parsed.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>}
            />
          )}

          {parsed.tasks.length > 0 && (
            <div style={{
              border: '1px solid var(--rule-soft)',
              borderRadius: 'var(--radius)',
              padding: '8px 12px',
              maxHeight: 260,
              overflowY: 'auto',
              background: 'var(--bg-raised)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                {parsed.title ? `«${parsed.title}» · ` : ''}{parsed.tasks.length} задач
              </div>
              {parsed.tasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {circleNum(i)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RouteStatementRenderer content={task.statement_md} />
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      Ответ: <b style={{ color: 'var(--ink)' }}>{task.answer || '—'}</b>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
