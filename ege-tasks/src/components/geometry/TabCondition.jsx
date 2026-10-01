import {
  Card, Checkbox, Form, Input, InputNumber, Select, Space, Tooltip, Typography,
} from 'antd';
import MathRenderer from '../MathRenderer';
import LatexField from '../shared/LatexField';
import FieldInsertToolbar from '../shared/FieldInsertToolbar';
import { GEOMETRY_SECTIONS } from '../../utils/geometrySection';
import { FacetSelect, FacetSuggestions, useTagById } from './FacetFields';

const FACET_FIELDS = { object: 'facetsObject', method: 'facetsMethod', fact: 'facetsFact' };

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
  geoTopics, geoSubtopics, selectedTopicId, onTopicChange, geoTags = null, taskId = null, onFacetsChange, refsLoading = {},
}) {
  const form = Form.useFormInstance();
  const tagById = useTagById(geoTags);
  const facetObject = Form.useWatch('facetsObject', form) || [];
  const facetMethod = Form.useWatch('facetsMethod', form) || [];
  const facetFact = Form.useWatch('facetsFact', form) || [];
  const addFacet = (kind, id) => {
    const name = FACET_FIELDS[kind];
    const cur = form.getFieldValue(name) || [];
    if (!cur.includes(id)) form.setFieldValue(name, [...cur, id]);
    // setFieldValue не зовёт onValuesChange — отмечаем правку явно
    form.setFields([{ name, touched: true }]);
    onFacetsChange?.();
  };
  const filteredSubtopics = selectedTopicId
    ? geoSubtopics.filter((s) => s.topic === selectedTopicId)
    : geoSubtopics;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
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

        <Form.Item
          name="section"
          label={(
            <Tooltip title="Фильтр «Планиметрия / Стереометрия» в банке. Пусто — угадаем при сохранении по теме и условию">
              Раздел
            </Tooltip>
          )}
        >
          <Select options={GEOMETRY_SECTIONS} allowClear placeholder="Угадать" />
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
            loading={refsLoading.topics}
            showSearch
            optionFilterProp="label"
            allowClear
            options={geoTopics.map((t) => ({ value: t.id, label: t.title }))}
            onChange={onTopicChange}
          />
        </Form.Item>

        <Form.Item name="subtopic" label="Подтема">
          <Select
            placeholder={!selectedTopicId
              ? 'Сначала выберите тему'
              : refsLoading.subtopics ? 'Загрузка…'
                : filteredSubtopics.length ? 'Выберите подтему' : 'У темы нет подтем'}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={refsLoading.subtopics}
            disabled={!!selectedTopicId && !refsLoading.subtopics && filteredSubtopics.length === 0}
            options={filteredSubtopics.map((s) => ({ value: s.id, label: s.title }))}
            notFoundContent="Подтем нет — их заводят в «Геометрия → Темы и подтемы»"
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

      {geoTags && (
        <Card
          size="small"
          title={<Text style={{ fontSize: 13 }}>Фасеты — общие с банком МЦНМО</Text>}
          styles={{ body: { padding: '10px 12px' } }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {Object.entries(FACET_FIELDS).map(([kind, name]) => (
              <Form.Item key={kind} name={name} style={{ marginBottom: 8 }}>
                <FacetSelect kind={kind} geoTags={geoTags} />
              </Form.Item>
            ))}
          </div>
          <FacetSuggestions
            taskId={taskId}
            tagById={tagById}
            have={[...facetObject, ...facetMethod, ...facetFact]}
            onAdd={addFacet}
          />
        </Card>
      )}

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
          onImageFiles={inserts?.onImageFiles?.('statement_md')}
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
