import {
  Button, Card, Divider, Form, Space, Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import LatexField from '../shared/LatexField';
import FieldInsertToolbar from '../shared/FieldInsertToolbar';
import SolutionAttachments from './SolutionAttachments';

const { Text } = Typography;

/**
 * Указания к задаче (подсказки перед решением). У банка МЦНМО они пришли из
 * импорта (json [{order, text_md}]), раньше их не было видно нигде.
 */
function HintsEditor({ hints, onChange, fieldMode }) {
  const set = (i, text) => onChange(hints.map((h, k) => (k === i ? { ...h, text_md: text } : h)));
  const remove = (i) => onChange(hints.filter((_, k) => k !== i));
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {hints.map((h, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) minmax(0,1fr) 32px', gap: 8, alignItems: 'start' }}>
          <Text type="secondary" style={{ paddingTop: 6 }}>{i + 1}.</Text>
          <LatexField
            mode={fieldMode}
            rows={2}
            value={h.text_md}
            onChange={(e) => set(i, typeof e === 'string' ? e : e?.target?.value ?? '')}
            placeholder="Например: проведите диаметр через точку касания"
          />
          <div style={{ padding: '6px 10px', background: '#fafafa', borderRadius: 6, minHeight: 34 }}>
            {h.text_md ? <MathRenderer text={h.text_md} /> : <Text type="secondary">—</Text>}
          </div>
          <Button type="text" icon={<DeleteOutlined />} onClick={() => remove(i)} aria-label="Удалить указание" />
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={() => onChange([...hints, { text_md: '' }])}>
        Добавить указание
      </Button>
    </Space>
  );
}

export default function TabSolution({
  fieldMode = 'plain', previewSolution, onSolutionChange, solutionRef, inserts,
  hints = [], onHintsChange,
  solutionFiles = [], onSolutionFilesChange,
  solutionDrawingUrl = '',
}) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '16px 0' }}>
      {/* Чертёж решения (банк МЦНМО, image_role='solution') — относится к решению, не к условию */}
      {solutionDrawingUrl && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Чертёж к решению</Text>}
          styles={{ body: { padding: 12, textAlign: 'center' } }}
        >
          <img src={solutionDrawingUrl} alt="Чертёж решения" style={{ maxWidth: '100%', maxHeight: 360 }} />
        </Card>
      )}

      <Divider style={{ margin: 0 }} orientation="left" plain>
        <Text type="secondary" style={{ fontSize: 12 }}>Указания (подсказки перед решением)</Text>
      </Divider>
      <HintsEditor hints={hints} onChange={onHintsChange} fieldMode={fieldMode} />

      <Form.Item
        name="solution_md"
        label={(
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Подробное решение (Markdown + LaTeX)
            {inserts && <FieldInsertToolbar tools={inserts} field="solution_md" rootsLabel="решение" />}
          </span>
        )}
      >
        <LatexField
          ref={solutionRef}
          mode={fieldMode}
          rows={10}
          placeholder={
            'Пример:\n\nПо теореме о средней линии треугольника $KL \\parallel MN$ и $KL = \\dfrac{MN}{2}$.\n\nЗначит $MN - KL = MN - \\dfrac{MN}{2} = \\dfrac{MN}{2} = 6$.\n\nОтсюда $MN = 12$.'
          }
          onTextChange={onSolutionChange}
          onCaret={inserts?.onCaret('solution_md')}
          onImageFiles={inserts?.onImageFiles?.('solution_md')}
        />
      </Form.Item>

      <Divider style={{ margin: 0 }} orientation="left" plain>
        <Text type="secondary" style={{ fontSize: 12 }}>Вложения (фото решения)</Text>
      </Divider>
      <SolutionAttachments files={solutionFiles} onChange={onSolutionFilesChange} />

      {previewSolution && (
        <Card
          size="small"
          title={<Text type="secondary" style={{ fontSize: 12 }}>Предпросмотр решения</Text>}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <MathRenderer text={previewSolution} />
        </Card>
      )}
    </Space>
  );
}
