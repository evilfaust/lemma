import { useState } from 'react';
import {
  Button, Input, InputNumber, Modal, Checkbox, Tag, Tooltip, Empty,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import MathText from '../shared/MathText';
import { QUAD_BUCKET_PRESET } from '../../utils/classifySheet';

// Строка, в которой есть что рендерить. Превью показываем только тогда: у
// подписи «Неполное: свободный коэффициент равен нулю» рендерить нечего, а
// лишняя строка на каждый тип съедает панель.
const hasMath = (...parts) => parts.some(t => /\$[^$\n]+\$/.test(String(t || '')));

/**
 * Карманы листа — типы уравнений. Правятся прямо в списке: название и признак
 * идут на печать, поэтому и редактируются как текст, без отдельного окна.
 *
 * Счётчик уравнений у кармана виден только здесь: на листе ученика его нет,
 * иначе половина задания решалась бы подсчётом.
 */
export function BucketsPanel({
  buckets,
  stats,
  showPoints,
  onPatch,
  onRemove,
  onMove,
  onAdd,
  onAddPreset,
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [chosen, setChosen] = useState([]);

  const counts = new Map(stats.buckets.map(s => [s.bucket.id, s.count]));
  const have = new Set(buckets.map(b => b.presetKey).filter(Boolean));

  const applyPreset = () => {
    onAddPreset(chosen);
    setChosen([]);
    setPresetOpen(false);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buckets.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Типов пока нет"
            style={{ margin: '8px 0' }}
          />
        )}

        {buckets.map((bucket, index) => (
          <div
            key={bucket.id}
            style={{
              border: '1px solid var(--rule-soft)',
              borderRadius: 'var(--radius)',
              padding: '8px 10px',
              background: 'var(--bg-raised)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Tag
                color={counts.get(bucket.id) ? 'blue' : 'default'}
                style={{ margin: 0, fontFamily: 'var(--font-mono)' }}
              >
                {counts.get(bucket.id) || 0}
              </Tag>
              <Input
                size="small"
                value={bucket.label}
                placeholder="Название типа"
                onChange={e => onPatch(bucket.id, { label: e.target.value })}
                style={{ flex: 1 }}
              />
              <Tooltip title="Выше">
                <Button
                  size="small" type="text" icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                />
              </Tooltip>
              <Tooltip title="Ниже">
                <Button
                  size="small" type="text" icon={<ArrowDownOutlined />}
                  disabled={index === buckets.length - 1}
                  onClick={() => onMove(index, 1)}
                />
              </Tooltip>
              <Tooltip title="Удалить тип — уравнения вернутся в банк без разметки">
                <Button
                  size="small" type="text" danger icon={<DeleteOutlined />}
                  onClick={() => onRemove(bucket.id)}
                />
              </Tooltip>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <Input
                size="small"
                value={bucket.hint}
                placeholder="Признак: $ax^2 + bx = 0$"
                onChange={e => onPatch(bucket.id, { hint: e.target.value })}
                style={{ flex: 1 }}
              />
              {showPoints && (
                <Tooltip title="Баллов за одно уравнение этого типа">
                  <InputNumber
                    size="small"
                    min={0}
                    max={20}
                    value={bucket.points}
                    onChange={v => onPatch(bucket.id, { points: v ?? 0 })}
                    style={{ width: 60 }}
                  />
                </Tooltip>
              )}
            </div>

            {hasMath(bucket.label, bucket.hint) && (
              <div style={{
                marginTop: 6, paddingTop: 5,
                borderTop: '1px dashed var(--rule-soft)',
                fontSize: 12, color: 'var(--ink-2)',
                display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap',
              }}>
                <MathText text={bucket.label} />
                {bucket.hint && (
                  <span style={{ color: 'var(--ink-3)' }}><MathText text={bucket.hint} /></span>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" block icon={<PlusOutlined />} onClick={() => onAdd()}>
            Свой тип
          </Button>
          <Button
            size="small" block icon={<AppstoreAddOutlined />}
            onClick={() => setPresetOpen(true)}
          >
            Из библиотеки
          </Button>
        </div>
      </div>

      <Modal
        title="Типы квадратных уравнений"
        open={presetOpen}
        onCancel={() => setPresetOpen(false)}
        onOk={applyPreset}
        okText="Добавить"
        okButtonProps={{ disabled: chosen.length === 0 }}
        width={620}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          {QUAD_BUCKET_PRESET.map((preset) => {
            const already = have.has(preset.key);
            return (
              <label
                key={preset.key}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '8px 10px',
                  border: '1px solid var(--rule-soft)',
                  borderRadius: 'var(--radius)',
                  opacity: already ? 0.5 : 1,
                  cursor: already ? 'default' : 'pointer',
                }}
              >
                <Checkbox
                  disabled={already}
                  checked={chosen.includes(preset.key)}
                  onChange={e => setChosen(prev => (
                    e.target.checked
                      ? [...prev, preset.key]
                      : prev.filter(k => k !== preset.key)
                  ))}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>
                    <MathText text={preset.label} />
                    {already && <Tag style={{ marginLeft: 8 }}>уже на листе</Tag>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    <MathText text={preset.hint} /> · <MathText text={preset.method} />
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

export default BucketsPanel;
