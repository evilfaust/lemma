import {
  Card, Checkbox, Form, Input, InputNumber, Select, Space, Tooltip, Typography,
} from 'antd';
import MathRenderer from '../MathRenderer';
import LatexField from '../shared/LatexField';
import FieldInsertToolbar from '../shared/FieldInsertToolbar';

const { Text } = Typography;

const DIFFICULTY_OPTIONS = [
  { value: 1, label: '1 — Базовый' },
  { value: 2, label: '2 — Средний' },
  { value: 3, label: '3 — Повышенный' },
  { value: 4, label: '4 — Высокий' },
  { value: 5, label: '5 — Олимпиадный' },
];

export default function TabCondition({
  fieldMode = 'plain', previewStatement, onStatementChange, statementRef, inserts,
  geoTopics, geoSubtopics, selectedTopicId, onTopicChange,
}) {
  const filteredSubtopics = selectedTopicId
    ? geoSubtopics.filter((s) => s.topic === selectedTopicId)
    : geoSubtopics;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
        <Form.Item
          name="code"
          label="Код задачи"
          rules={[{ required: true, message: 'Укажите код' }]}
        >
          <Input placeholder="GEO-001" />
        </Form.Item>

        <Form.Item name="difficulty" label="Сложность">
          <Select options={DIFFICULTY_OPTIONS} allowClear placeholder="Не указана" />
        </Form.Item>

        <Form.Item name="ready" valuePropName="checked">
          <Checkbox>
            <Tooltip title="Задача решается по готовому чертежу: без него условие неполное, при печати чертёж обязателен">
              На готовом чертеже
            </Tooltip>
          </Checkbox>
        </Form.Item>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        <Form.Item name="topic" label="Тема">
          <Select
            placeholder="Выберите тему"
            allowClear
            options={geoTopics.map((t) => ({ value: t.id, label: t.title }))}
            onChange={onTopicChange}
          />
        </Form.Item>

        <Form.Item name="subtopic" label="Подтема">
          <Select
            placeholder={selectedTopicId ? 'Выберите подтему' : 'Сначала выберите тему'}
            allowClear
            disabled={!selectedTopicId && filteredSubtopics.length === 0}
            options={filteredSubtopics.map((s) => ({ value: s.id, label: s.title }))}
          />
        </Form.Item>

        <Form.Item name="source" label="Источник">
          <Input placeholder="Атанасян, §7" />
        </Form.Item>

        <Form.Item name="year" label="Год">
          <InputNumber
            style={{ width: '100%' }}
            placeholder="2024"
            min={1990}
            max={2030}
          />
        </Form.Item>
      </div>

      <Form.Item
        name="statement_md"
        label={(
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Условие задачи (Markdown + LaTeX)
            {inserts && <FieldInsertToolbar tools={inserts} field="statement_md" rootsLabel="условие" />}
          </span>
        )}
      >
        <LatexField
          ref={statementRef}
          mode={fieldMode}
          rows={5}
          placeholder="Дано: $\triangle MEN$, $MN - KL = 6$. Найдите $MN$."
          onTextChange={onStatementChange}
          onCaret={inserts?.onCaret('statement_md')}
        />
      </Form.Item>

      {previewStatement && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр условия</Text>}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <MathRenderer text={previewStatement} answerBoxes />
        </Card>
      )}

      <Form.Item name="answer" label="Ответ">
        <Input placeholder="12 (числовой ответ; для нескольких вариантов: 3|3.0)" style={{ maxWidth: 300 }} />
      </Form.Item>
    </Space>
  );
}
