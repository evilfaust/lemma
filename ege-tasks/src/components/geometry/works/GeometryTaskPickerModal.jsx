import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, Empty, Input, Modal, Segmented, Select, Space, Spin, Tag, Typography,
} from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { GEOMETRY_SECTIONS } from '../../../utils/geometrySection';
import { MIN_SEARCH_LENGTH } from '../../../shared/utils/searchVariants';
import MathRenderer from '../../MathRenderer';
import GeometryTaskThumb from '../GeometryTaskThumb';

const { Text } = Typography;

const SCOPES = [
  { value: 'manual', label: 'Мои' },
  { value: 'gen', label: 'Генератор' },
  { value: 'mccme', label: 'МЦНМО' },
];
const SHOW = 60;

/**
 * Добавить задачи в работу прямо из банка: поиск, раздел, область, тема —
 * отметить несколько и добавить позициями выбранного варианта.
 * @param {Set<string>} usedIds — задачи, которые уже в работе (не выбираются)
 * @param {function} onAdd — (tasks[]) выбранные лёгкие записи
 */
export default function GeometryTaskPickerModal({ open, onClose, usedIds, onAdd, onOpenTask, variantOptions, variant, onVariantChange }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('manual');
  const [section, setSection] = useState(null);
  const [topic, setTopic] = useState(null);
  const [topics, setTopics] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    api.getGeometryTopics().then(setTopics).catch(() => {});
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Банк МЦНМО целиком не грузим: нужен поиск или раздел «Стереометрия»
  const idle = scope === 'mccme' && query.length < MIN_SEARCH_LENGTH && section !== 'stereo';

  useEffect(() => {
    if (!open || idle) { setTasks([]); return undefined; }
    let alive = true;
    setLoading(true);
    api.getGeometryTasks({
      origin: scope,
      search: query || undefined,
      section: section || undefined,
      topic: scope === 'mccme' ? undefined : topic || undefined,
    })
      .then((list) => { if (alive) setTasks(list); })
      .catch(() => { if (alive) setTasks([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, scope, query, section, topic, idle]);

  const shown = useMemo(() => tasks.slice(0, SHOW), [tasks]);
  const pickedSet = new Set(picked.map((t) => t.id));
  const toggle = (t) => setPicked((p) => (pickedSet.has(t.id) ? p.filter((x) => x.id !== t.id) : [...p, t]));

  return (
    <Modal
      title="Добавить задачи из банка"
      open={open}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={(
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space>
            {variantOptions?.length > 1 && (
              <>
                <Text>В вариант</Text>
                <Select size="small" value={variant} onChange={onVariantChange} options={variantOptions} style={{ width: 130 }} />
              </>
            )}
          </Space>
          <Space>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
              Добавить{picked.length ? ` (${picked.length})` : ''}
            </Button>
          </Space>
        </Space>
      )}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Input
          allowClear
          autoFocus
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Поиск по коду, условию, ответу, источнику…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Space wrap>
          <Segmented size="small" value={scope} onChange={(v) => { setScope(v); setTopic(null); }} options={SCOPES} />
          <Segmented
            size="small"
            value={section || ''}
            onChange={(v) => setSection(v || null)}
            options={[{ value: '', label: 'Все разделы' }, ...GEOMETRY_SECTIONS]}
          />
          {scope === 'manual' && (
            <Select
              size="small"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Тема"
              value={topic}
              onChange={setTopic}
              style={{ width: 220 }}
              options={topics.map((t) => ({ value: t.id, label: t.title }))}
            />
          )}
        </Space>

        {idle && <Alert type="info" showIcon message="Банк МЦНМО большой — введите поиск или выберите «Стереометрию»" />}
        {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
        {!loading && !idle && !tasks.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ничего не нашлось" />}

        {!loading && shown.length > 0 && (
          <>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Найдено: {tasks.length}{tasks.length > SHOW ? ` — показаны первые ${SHOW}, уточните поиск` : ''}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
              {shown.map((t) => {
                const used = usedIds?.has(t.id);
                const on = pickedSet.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={used ? undefined : () => toggle(t)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center', padding: 6, borderRadius: 8,
                      border: `1px solid ${on ? '#91caff' : '#f0f0f0'}`, background: on ? '#f0f7ff' : '#fff',
                      cursor: used ? 'default' : 'pointer', opacity: used ? 0.55 : 1,
                    }}
                  >
                    <Checkbox checked={on} disabled={used} />
                    <GeometryTaskThumb task={t} height={56} width={76} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Space size={4} wrap>
                        <Text code style={{ fontSize: 11 }}>{t.code}</Text>
                        {used && <Tag style={{ margin: 0 }}>уже в работе</Tag>}
                        {t.answer && <Text type="secondary" style={{ fontSize: 11 }}>отв.&nbsp;<MathRenderer text={String(t.answer)} /></Text>}
                      </Space>
                      <div className="gw-cell-text" style={{ WebkitLineClamp: 2 }}>
                        <MathRenderer text={String(t.statement_md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')} />
                      </div>
                    </div>
                    {onOpenTask && (
                      <Button
                        size="small"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={(e) => { e.stopPropagation(); onOpenTask(t.id); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
}
