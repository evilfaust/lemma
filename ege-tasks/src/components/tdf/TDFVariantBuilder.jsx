import { useState, useEffect, useCallback } from 'react';
import {
  Button, Space, Typography, Spin, message, Modal, Form, Input, InputNumber,
  Popconfirm, Tag, Checkbox, Divider, Card, List, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  PrinterOutlined, DragOutlined, CheckSquareOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import TDFPrintView from './TDFPrintView';
import MathRenderer from '../../shared/components/MathRenderer';

const { Title, Text } = Typography;

const TYPE_COLORS = {
  theorem: 'blue', definition: 'green', formula: 'purple', axiom: 'orange', property: 'cyan', criterion: 'magenta', corollary: 'gold',
};
const TYPE_LABELS = {
  theorem: 'Теорема', definition: 'Определение', formula: 'Формула',
  axiom: 'Аксиома', property: 'Свойство', criterion: 'Признак', corollary: 'Следствие',
};

export default function TDFVariantBuilder({ setId, onBack }) {
  const [tdfSet, setTdfSet] = useState(null);
  const [allItems, setAllItems] = useState([]); // все пункты набора (не заголовки разделов)
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Создание / редактирование варианта
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [variantForm] = Form.useForm();

  // Печать варианта
  const [printVariant, setPrintVariant] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [set, items, vars] = await Promise.all([
        api.getTdfSet(setId),
        api.getTdfItems(setId),
        api.getTdfVariants(setId),
      ]);
      setTdfSet(set);
      setAllItems(items.filter(i => !i.is_section_header));
      setVariants(vars);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => { loadData(); }, [loadData]);

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
    variantForm.setFieldsValue({
      number: variant.number,
      title: variant.title || '',
    });
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

  const handleDeleteVariant = async (id) => {
    try {
      await api.deleteTdfVariant(id);
      message.success('Вариант удалён');
      loadData();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  // Drag-and-drop внутри selectedItemIds для переупорядочивания
  const [dragItemId, setDragItemId] = useState(null);
  const onDragStart = (id) => setDragItemId(id);
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

  const toggleItem = (id) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Получить все пункты набора, сгруппированные по разделам (для удобства выбора)
  const [allItemsWithSections, setAllItemsWithSections] = useState([]);
  useEffect(() => {
    const load = async () => {
      if (!setId) return;
      const all = await api.getTdfItems(setId);
      setAllItemsWithSections(all);
    };
    load();
  }, [setId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  if (printVariant) {
    // Получаем пункты варианта по item_ids в нужном порядке
    const variantItems = (printVariant.item_ids || [])
      .map(id => allItems.find(i => i.id === id))
      .filter(Boolean);
    return (
      <TDFPrintView
        tdfSet={tdfSet}
        items={variantItems}
        mode="blank"
        variantNumber={printVariant.number}
        variantTitle={printVariant.title}
        onBack={() => setPrintVariant(null)}
      />
    );
  }

  // Группируем пункты по разделам для отображения в чекбоксах
  const groupedForSelection = [];
  let currentSection = null;
  for (const item of allItemsWithSections) {
    if (item.is_section_header) {
      currentSection = item.section_title;
      groupedForSelection.push({ type: 'header', label: currentSection, key: item.id });
    } else {
      groupedForSelection.push({ type: 'item', item, section: currentSection, key: item.id });
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <div>
            <Title level={3} style={{ margin: 0 }}>Варианты: {tdfSet?.title}</Title>
            <Text type="secondary">{variants.length} вариант(ов) · {allItems.length} пунктов в эталоне</Text>
          </div>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateVariant}>
          Новый вариант
        </Button>
      </div>

      {variants.length === 0 ? (
        <Empty description="Вариантов ещё нет. Создайте первый!" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {variants.map(v => {
            const varItems = (v.item_ids || []).map(id => allItems.find(i => i.id === id)).filter(Boolean);
            return (
              <Card
                key={v.id}
                title={
                  <Space>
                    <Tag color="blue">Вариант {v.number}</Tag>
                    {v.title && <Text>{v.title}</Text>}
                  </Space>
                }
                extra={
                  <Space>
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => setPrintVariant(v)}>
                      Печать
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditVariant(v)} />
                    <Popconfirm
                      title="Удалить вариант?"
                      onConfirm={() => handleDeleteVariant(v.id)}
                      okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }}
                    >
                      <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                  </Space>
                }
                size="small"
              >
                <Text type="secondary" style={{ fontSize: 12 }}>{varItems.length} пунктов</Text>
                <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12 }}>
                  {varItems.map(item => (
                    <li key={item.id} style={{ marginBottom: 2 }}>
                      {item.type && <Tag color={TYPE_COLORS[item.type]} style={{ fontSize: 10 }}>{TYPE_LABELS[item.type]}</Tag>}
                      {item.name}
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      )}

      {/* Модальное окно создания/редактирования варианта */}
      <Modal
        title={editingVariant ? `Редактировать Вариант ${editingVariant.number}` : 'Новый вариант'}
        open={variantModalOpen}
        onOk={handleSaveVariant}
        onCancel={() => setVariantModalOpen(false)}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
        width={800}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <Form form={variantForm} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="number" label="Номер варианта" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="title" label="Подзаголовок">
            <Input placeholder="Необязательно" style={{ width: 240 }} />
          </Form.Item>
        </Form>

        <Divider orientation="left">
          Выберите пункты ({selectedItemIds.length} выбрано)
        </Divider>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Левая панель: все пункты с чекбоксами */}
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Все пункты эталона:
            </Text>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
              {groupedForSelection.map(entry => {
                if (entry.type === 'header') {
                  return (
                    <div key={entry.key} style={{ background: '#f5f5f5', padding: '4px 8px', marginBottom: 4, fontWeight: 600, fontSize: 12, borderRadius: 4 }}>
                      {entry.label}
                    </div>
                  );
                }
                const checked = selectedItemIds.includes(entry.item.id);
                return (
                  <div
                    key={entry.key}
                    style={{ padding: '4px 8px', cursor: 'pointer', background: checked ? '#e6f4ff' : 'transparent', borderRadius: 4, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => toggleItem(entry.item.id)}
                  >
                    <Checkbox checked={checked} onChange={() => toggleItem(entry.item.id)} />
                    <div>
                      {entry.item.type && (
                        <Tag color={TYPE_COLORS[entry.item.type]} style={{ fontSize: 10, marginRight: 4 }}>
                          {TYPE_LABELS[entry.item.type]}
                        </Tag>
                      )}
                      <Text style={{ fontSize: 12 }}>{entry.item.name || '—'}</Text>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Правая панель: порядок в варианте (drag-and-drop) */}
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Порядок в варианте (перетаскивайте):
            </Text>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8, minHeight: 100 }}>
              {selectedItemIds.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>Выберите пункты слева</Text>
              ) : (
                selectedItemIds.map((id, idx) => {
                  const it = allItems.find(i => i.id === id);
                  if (!it) return null;
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => onDragStart(id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDrop(id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px', marginBottom: 2, borderRadius: 4,
                        background: dragItemId === id ? '#bae0ff' : '#fafafa',
                        border: '1px solid #e0e0e0', cursor: 'grab',
                      }}
                    >
                      <DragOutlined style={{ color: '#aaa', flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, color: '#888', width: 18, flexShrink: 0 }}>{idx + 1}.</Text>
                      {it.type && (
                        <Tag color={TYPE_COLORS[it.type]} style={{ fontSize: 10, flexShrink: 0 }}>
                          {TYPE_LABELS[it.type]}
                        </Tag>
                      )}
                      <Text style={{ fontSize: 12, flex: 1 }}>{it.name || '—'}</Text>
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
