import { useMemo, useState } from 'react';
import { Modal, InputNumber, Alert, Checkbox, Divider } from 'antd';
import MathText from '../shared/MathText';
import {
  QUAD_IMPORT_GROUPS, QUAD_IMPORT_LABELS,
  generateItemsForClassify, presetKeysForCategories,
} from '../../utils/classifyQuadImport';
import { bucketsFromPreset } from '../../utils/classifySheet';

/**
 * Добор уравнений из генератора квадратных уравнений.
 *
 * Генератор собирает задание под конкретную категорию и возвращает её вместе
 * с уравнением — значит карман известен заранее и разметка не нужна. Это
 * главное отличие от ручного ввода и причина, по которой окно вообще есть.
 *
 * Если для выбранной категории кармана на листе нет, он предлагается к
 * добавлению — иначе уравнения приедут «без типа» и потеряются в ключе.
 */
export function QuadImportModal({ open, onClose, buckets, onAdd, onAddBuckets }) {
  const [counts, setCounts] = useState({});
  const [addMissing, setAddMissing] = useState(true);

  const total = useMemo(
    () => Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0),
    [counts],
  );

  const missing = useMemo(() => {
    const have = new Set(buckets.map(b => b.presetKey).filter(Boolean));
    return presetKeysForCategories(counts).filter(k => !have.has(k));
  }, [counts, buckets]);

  const handleOk = () => {
    // Недостающие карманы создаём здесь же и сразу знаем их id: состояние
    // обновится асинхронно, а уравнениям карман нужен прямо сейчас.
    const fresh = (addMissing && missing.length) ? bucketsFromPreset(missing) : [];
    const nextBuckets = [...buckets, ...fresh];

    if (fresh.length) onAddBuckets(fresh);
    onAdd(generateItemsForClassify(counts, nextBuckets));
    setCounts({});
    onClose();
  };

  return (
    <Modal
      title="Добрать из генератора квадратных уравнений"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={total ? `Добавить ${total}` : 'Добавить'}
      okButtonProps={{ disabled: total === 0 }}
      width={720}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Тип проставится сам — генератор знает, под какую категорию собрано уравнение."
      />

      {missing.length > 0 && (
        <Checkbox
          checked={addMissing}
          onChange={e => setAddMissing(e.target.checked)}
          style={{ marginBottom: 12 }}
        >
          Добавить недостающие типы на лист ({missing.length})
        </Checkbox>
      )}

      <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
        {QUAD_IMPORT_GROUPS.map(group => (
          <div key={group.label}>
            <Divider orientation="left" style={{ margin: '10px 0 6px', fontSize: 12 }}>
              {group.label}
            </Divider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {group.keys.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <InputNumber
                    size="small"
                    min={0}
                    max={10}
                    value={counts[cat] || 0}
                    onChange={v => setCounts(prev => ({ ...prev, [cat]: v || 0 }))}
                    style={{ width: 56 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 0 }}>
                    <MathText text={QUAD_IMPORT_LABELS[cat]} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default QuadImportModal;
