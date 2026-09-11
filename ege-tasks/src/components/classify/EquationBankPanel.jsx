import { Button, Input, Select, Tooltip, Empty, Tag } from 'antd';
import {
  DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import MathInline from '../shared/MathInline';
import MathText from '../shared/MathText';
import ClassifyItemView from './ClassifyItemView';
import { OTHER_BUCKET_ID, OTHER_BUCKET } from '../../utils/classifySheet';

/**
 * Банк уравнений: текст, ответ и разметка «в какой карман идёт».
 *
 * Номер уравнения — это его место в списке, и он же попадает в контрольные
 * суммы, поэтому порядок здесь настоящий, а не косметический: перестановка
 * стрелками меняет и суммы на листе.
 *
 * Ответ необязателен и нужен только ключу учителя — на листе ученика его нет.
 */
export function EquationBankPanel({
  items,
  buckets,
  settings,
  onPatch,
  onRemove,
  onMove,
}) {
  // label у Ant Select — ReactNode, поэтому формула в названии типа рендерится
  // и в списке, и в закрытом поле.
  const options = [
    { value: '', label: 'Без типа' },
    ...buckets.map(b => ({ value: b.id, label: <MathText text={b.label || 'Без названия'} /> })),
    ...(settings.showOther ? [{ value: OTHER_BUCKET_ID, label: <MathText text={OTHER_BUCKET.label} /> }] : []),
  ];

  if (!items.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Банк пуст — добавьте уравнения списком или по одному"
        style={{ marginTop: 40 }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, index) => {
        const known = item.bucketId
          && (item.bucketId === OTHER_BUCKET_ID || buckets.some(b => b.id === item.bucketId));
        return (
          <div
            key={item.id}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              border: '1px solid var(--rule-soft)',
              borderLeft: `3px solid ${known ? 'var(--accent)' : 'var(--rule)'}`,
              borderRadius: 'var(--radius)',
              padding: '8px 10px',
              background: 'var(--bg-raised)',
            }}
          >
            <div style={{
              width: 26, flexShrink: 0, paddingTop: 4,
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)',
            }}>
              {index + 1})
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                padding: '5px 10px', marginBottom: 6,
                background: 'var(--bg-sunken)', borderRadius: 'var(--radius)',
                overflowX: 'auto', minHeight: 30,
              }}>
                {(item.latex || item.md)
                  ? <ClassifyItemView item={item} />
                  : <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>пусто</span>}
                {item.answerLatex && (
                  <>
                    <span style={{ color: 'var(--ink-4)', margin: '0 8px' }}>→</span>
                    <MathInline latex={item.answerLatex} />
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {item.md !== undefined && item.md !== null && item.md !== '' ? (
                  <Input
                    size="small"
                    value={item.md}
                    placeholder="Текст задачи (markdown)"
                    onChange={e => onPatch(item.id, { md: e.target.value })}
                    style={{ flex: 2, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                ) : (
                  <Input
                    size="small"
                    value={item.latex}
                    placeholder="Уравнение в LaTeX: x^2 - 5x = 0"
                    onChange={e => onPatch(item.id, { latex: e.target.value })}
                    style={{ flex: 2, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                )}
                <Input
                  size="small"
                  value={item.answerLatex}
                  placeholder="Ответ (для ключа)"
                  onChange={e => onPatch(item.id, { answerLatex: e.target.value })}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Select
                  size="small"
                  value={item.bucketId || ''}
                  options={options}
                  onChange={v => onPatch(item.id, { bucketId: v || null })}
                  style={{ flex: 1, minWidth: 0 }}
                  status={known ? undefined : 'warning'}
                />
                {item.sourceCat && (
                  <Tooltip title="Тип проставлен генератором">
                    <Tag style={{ margin: 0, fontSize: 11 }}>авто</Tag>
                  </Tooltip>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                size="small" type="text" icon={<ArrowUpOutlined />}
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
              />
              <Button
                size="small" type="text" icon={<ArrowDownOutlined />}
                disabled={index === items.length - 1}
                onClick={() => onMove(index, 1)}
              />
              <Button
                size="small" type="text" danger icon={<DeleteOutlined />}
                onClick={() => onRemove(item.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EquationBankPanel;
