import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button, Space, Spin, message, Modal, Form, Input, InputNumber,
  Popconfirm, Checkbox, Divider, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PrinterOutlined, HolderOutlined, UnorderedListOutlined, CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import TDFPrintView from './TDFPrintView';
import { WorkspacePageHeader, EmptyState, Chip } from '../workspace/ui';
import { tdfTypeShort, tdfTypeTone, tdfTypeLabel } from './tdfTypes';
import './tdf.css';

const { Text } = Typography;

export default function TDFVariantBuilder({ setId, onBack }) {
  const [tdfSet, setTdfSet] = useState(null);
  const [allItems, setAllItems] = useState([]);   // весь конспект, включая заголовки разделов
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [variantForm] = Form.useForm();
  const [dragItemId, setDragItemId] = useState(null);

  // { variant, mode: 'blank' | 'key' } — бланк ученику или ключ учителю.
  const [printTarget, setPrintTarget] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [set, items, vars] = await Promise.all([
        api.getTdfSet(setId),
        api.getTdfItems(setId),
        api.getTdfVariants(setId),
      ]);
      setTdfSet(set);
      setAllItems(items);
      setVariants(vars);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => { loadData(); }, [loadData]);

  const realItems = useMemo(() => allItems.filter(i => !i.is_section_header), [allItems]);
  const itemById = useMemo(() => Object.fromEntries(realItems.map(i => [i.id, i])), [realItems]);

  /**
   * Покрытие эталона: в скольких вариантах встречается каждый пункт. По нему
   * видно и забытые пункты, и те, что учитель спрашивает в каждом варианте.
   */
  const usage = useMemo(() => {
    const counts = {};
    for (const v of variants) {
      for (const id of (v.item_ids || [])) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [variants]);

  const uncovered = useMemo(
    () => realItems.filter(i => !usage[i.id]),
    [realItems, usage]
  );

  const openCreateVariant = () => {
    setEditingVariant(null);
    setSelectedItemIds([]);
    variantForm.resetFields();
    variantForm.setFieldsValue({ number: variants.length + 1 });
    setVariantModalOpen(true);
  };

  const openEditVariant = (variant) => {
    setEditingVariant(variant);
    setSelectedItemIds(variant.item_ids || []);
    variantForm.setFieldsValue({ number: variant.number, title: variant.title || '' });
    setVariantModalOpen(true);
  };

  const handleSaveVariant = async () => {
    try {
      const values = await variantForm.validateFields();
      setSaving(true);
      const data = {
        tdf_set: setId,
        number: values.number,
        title: values.title || '',
        item_ids: selectedItemIds,
      };
      if (editingVariant) {
        await api.updateTdfVariant(editingVariant.id, data);
        message.success('Вариант обновлён');
      } else {
        await api.createTdfVariant(data);
        message.success('Вариант создан');
      }
      setVariantModalOpen(false);
      loadData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateVariant = async (v) => {
    try {
      await api.createTdfVariant({
        tdf_set: setId,
        number: Math.max(0, ...variants.map(x => x.number || 0)) + 1,
        title: v.title || '',
        item_ids: v.item_ids || [],
      });
      message.success('Вариант скопирован');
      loadData();
    } catch {
      message.error('Ошибка копирования');
    }
  };

  const handleDeleteVariant = async (id) => {
    try {
      await api.deleteTdfVariant(id);
      message.success('Вариант удалён');
      loadData();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const toggleItem = (id) => {
    setSelectedItemIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const onDrop = (targetId) => {
    if (!dragItemId || dragItemId === targetId) { setDragItemId(null); return; }
    const newIds = [...selectedItemIds];
    const fromIdx = newIds.indexOf(dragItemId);
    const toIdx = newIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragItemId(null); return; }
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, dragItemId);
    setSelectedItemIds(newIds);
    setDragItemId(null);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  if (printTarget) {
    const { variant, mode } = printTarget;
    const variantItems = (variant.item_ids || []).map(id => itemById[id]).filter(Boolean);
    return (
      <TDFPrintView
        tdfSet={tdfSet}
        items={variantItems}
        mode={mode}
        variantNumber={variant.number}
        variantTitle={variant.title}
        onBack={() => setPrintTarget(null)}
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1360, margin: '0 auto' }}>
      <WorkspacePageHeader
        icon={<UnorderedListOutlined />}
        accent="violet"
        title={`Варианты опроса: ${tdfSet?.title || ''}`}
        subtitle={`${variants.length} вариантов · в эталоне ${realItems.length} пунктов · задействовано ${realItems.length - uncovered.length}`}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>К наборам</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateVariant} disabled={realItems.length === 0}>
              Новый вариант
            </Button>
          </Space>
        }
      />

      {uncovered.length > 0 && variants.length > 0 && (
        <div className="tdf-statbar">
          <span style={{ color: 'var(--c-amber)' }}>
            Ни в один вариант не вошли <b>{uncovered.length}</b> пунктов:
          </span>
          <span style={{ color: 'var(--ink-3)' }}>
            {uncovered.slice(0, 6).map(i => i.name || '—').join(' · ')}
            {uncovered.length > 6 && ` и ещё ${uncovered.length - 6}`}
          </span>
        </div>
      )}

      {variants.length === 0 ? (
        <EmptyState
          title="Вариантов ещё нет"
          description="Вариант — это бланк устного опроса: несколько пунктов конспекта, которые ученик заполняет по памяти. Соседям по парте дают разные варианты."
          cta={realItems.length ? 'Собрать первый вариант' : undefined}
          ctaIcon={<PlusOutlined />}
          onCta={openCreateVariant}
        />
      ) : (
        <div className="ws-grid">
          {variants.map(v => {
            const varItems = (v.item_ids || []).map(id => itemById[id]).filter(Boolean);
            return (
              <article key={v.id} className="ws-tile" style={{ cursor: 'default' }}>
                <div className="ws-tile__top">
                  <span className="ws-tile__badge tdf-badge">№{v.number}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="ws-tile__name">{v.title || `Вариант ${v.number}`}</div>
                    <div className="ws-tile__sub">{varItems.length} пунктов</div>
                  </div>
                  <div className="ws-tile__actions">
                    <Tooltip title="Дублировать вариант">
                      <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleDuplicateVariant(v)} />
                    </Tooltip>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditVariant(v)} />
                    <Popconfirm
                      title="Удалить вариант?"
                      onConfirm={() => handleDeleteVariant(v.id)}
                      okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>

                <ol style={{ margin: '11px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  {varItems.map(item => (
                    <li key={item.id} style={{ marginBottom: 3 }}>
                      {item.type && (
                        <Chip tone={tdfTypeTone(item.type)} title={tdfTypeLabel(item.type)} style={{ marginRight: 5 }}>
                          {tdfTypeShort(item.type)}
                        </Chip>
                      )}
                      {item.name || '—'}
                    </li>
                  ))}
                </ol>

                <div className="ws-tile__foot">
                  <Space size={6} wrap>
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => setPrintTarget({ variant: v, mode: 'blank' })}>
                      Бланк ученику
                    </Button>
                    <Tooltip title="Тот же состав с формулировками и чертежами — по нему учитель проверяет ответы">
                      <Button size="small" icon={<KeyOutlined />} onClick={() => setPrintTarget({ variant: v, mode: 'key' })}>
                        Ключ
                      </Button>
                    </Tooltip>
                  </Space>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        title={editingVariant ? `Вариант ${editingVariant.number}` : 'Новый вариант'}
        open={variantModalOpen}
        onOk={handleSaveVariant}
        onCancel={() => setVariantModalOpen(false)}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        width={820}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <Form form={variantForm} layout="inline" style={{ marginBottom: 14 }}>
          <Form.Item name="number" label="Номер" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="title" label="Подзаголовок">
            <Input placeholder="Необязательно" style={{ width: 280 }} />
          </Form.Item>
        </Form>

        <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
          Состав варианта — выбрано {selectedItemIds.length}
        </Divider>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Слева — весь конспект; справа — порядок в бланке */}
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Пункты конспекта
            </Text>
            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 8, padding: 8 }}>
              {allItems.map(item => {
                if (item.is_section_header) {
                  return (
                    <div key={item.id} style={{
                      background: 'var(--bg-sunken)', padding: '4px 8px', margin: '6px 0 4px',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'var(--ink-2)', borderRadius: 5,
                    }}>
                      {item.section_title}
                    </div>
                  );
                }
                const checked = selectedItemIds.includes(item.id);
                const used = usage[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    style={{
                      padding: '4px 8px', cursor: 'pointer', borderRadius: 6, marginBottom: 2,
                      background: checked ? 'var(--accent-soft)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <Checkbox checked={checked} onChange={() => toggleItem(item.id)} onClick={e => e.stopPropagation()} />
                    {item.type && (
                      <Chip tone={tdfTypeTone(item.type)} title={tdfTypeLabel(item.type)}>
                        {tdfTypeShort(item.type)}
                      </Chip>
                    )}
                    <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{item.name || '—'}</span>
                    {used > 0 && (
                      <Tooltip title={`Уже входит в ${used} вариант(ов)`}>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums' }}>
                          ×{used}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Порядок в бланке — перетаскивайте
            </Text>
            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 8, padding: 8, minHeight: 100 }}>
              {selectedItemIds.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12.5 }}>Отметьте пункты слева</Text>
              ) : (
                selectedItemIds.map((id, idx) => {
                  const it = itemById[id];
                  if (!it) return null;
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => setDragItemId(id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDrop(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 8px', marginBottom: 3, borderRadius: 6,
                        background: dragItemId === id ? 'var(--accent-soft)' : 'var(--bg-hover)',
                        border: '1px solid var(--rule-soft)', cursor: 'grab',
                      }}
                    >
                      <HolderOutlined style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', width: 18, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {idx + 1}.
                      </span>
                      {it.type && (
                        <Chip tone={tdfTypeTone(it.type)} title={tdfTypeLabel(it.type)}>
                          {tdfTypeShort(it.type)}
                        </Chip>
                      )}
                      <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{it.name || '—'}</span>
                      <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => toggleItem(id)} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
