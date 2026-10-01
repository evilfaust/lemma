import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Empty, Modal, Segmented, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { SECTION_LABELS } from '../../../utils/geometrySection';
import { statementPreview } from '../GeometryTaskColumns';
import GeometryTaskThumb from '../GeometryTaskThumb';

const { Text, Paragraph } = Typography;

const ORIGINS = [
  { value: 'all', label: 'Все' },
  { value: 'mccme', label: 'МЦНМО' },
  { value: 'manual', label: 'Мои' },
];

function pctColor(pct) {
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'orange';
  if (pct >= 50) return 'gold';
  return 'default';
}

/**
 * Подбор параллели для ячейки варианта: похожие на задачу-образец позиции
 * (векторный поиск /geo/similar) с чертежами. Задачи, которые уже есть в
 * работе, не предлагаются; по умолчанию — только того же раздела.
 *
 * @param {object} reference — задача-образец (лёгкая запись)
 * @param {Set<string>} excludeIds — задачи работы
 * @param {function} onPick — (task) выбрана
 */
export default function GeometryParallelPicker({ open, reference, excludeIds, onPick, onClose, onOpenTask, title }) {
  const [origin, setOrigin] = useState('all');
  const [sameSection, setSameSection] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    if (!reference?.id) return;
    setLoading(true);
    setError(null);
    try {
      const similar = await api.getSimilarGeometryTasks(reference.id, { limit: 24, origin });
      const ids = similar.map((x) => x.task_id).filter((id) => !excludeIds?.has(id));
      const records = await api.getGeometryTasksByIds(ids);
      const byId = new Map(records.map((r) => [r.id, r]));
      setItems(similar
        .filter((x) => byId.has(x.task_id))
        .map((x) => ({ pct: x.pct, task: byId.get(x.task_id) })));
    } catch (e) {
      setError(e.name === 'TimeoutError' ? 'Сервис поиска не ответил' : e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [reference?.id, origin, excludeIds]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const shown = items.filter((x) => !sameSection || !reference?.section || !x.task.section || x.task.section === reference.section);

  return (
    <Modal
      title={title || 'Подобрать параллель'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      destroyOnHidden
    >
      {reference && (
        <div style={{ display: 'flex', gap: 12, padding: 10, background: '#f6f8ff', borderRadius: 8, marginBottom: 12 }}>
          <GeometryTaskThumb task={reference} height={72} width={96} />
          <div style={{ minWidth: 0 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Образец · {reference.code}</Text>
            <Paragraph ellipsis={{ rows: 3 }} style={{ margin: 0, fontSize: 13 }}>
              {statementPreview(reference.statement_md) || '—'}
            </Paragraph>
          </div>
        </div>
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        <Segmented size="small" value={origin} onChange={setOrigin} options={ORIGINS} />
        {reference?.section && (
          <Checkbox checked={sameSection} onChange={(e) => setSameSection(e.target.checked)}>
            только {SECTION_LABELS[reference.section]?.toLowerCase()}
          </Checkbox>
        )}
      </Space>

      {loading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
      {!loading && error && <Alert type="warning" showIcon message={error} />}
      {!loading && !error && shown.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Подходящих задач не нашлось" />
      )}

      {!loading && shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {shown.map(({ pct, task }) => (
            <div
              key={task.id}
              style={{ display: 'flex', gap: 12, padding: 8, border: '1px solid #f0f0f0', borderRadius: 8, alignItems: 'center' }}
            >
              <GeometryTaskThumb task={task} height={68} width={92} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={4} wrap>
                  <Tag color={pctColor(pct)} style={{ margin: 0 }}>{pct}%</Tag>
                  <Text code style={{ fontSize: 12 }}>{task.code}</Text>
                  <Tag color={task.origin === 'mccme' ? 'geekblue' : 'green'} style={{ margin: 0 }}>
                    {task.origin === 'mccme' ? 'МЦНМО' : 'Моя'}
                  </Tag>
                  {task.answer && <Text type="secondary" style={{ fontSize: 12 }}>ответ: {task.answer}</Text>}
                </Space>
                <Paragraph ellipsis={{ rows: 3 }} style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {statementPreview(task.statement_md) || '—'}
                </Paragraph>
              </div>
              <Space direction="vertical" size={4}>
                <Button type="primary" size="small" onClick={() => onPick(task)}>Взять</Button>
                {onOpenTask && (
                  <Tooltip title="Карточка задачи">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => onOpenTask(task.id)} />
                  </Tooltip>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
