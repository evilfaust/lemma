import { useEffect, useMemo, useState } from 'react';
import {
  App, Empty, Form, Input, InputNumber, Modal, Segmented, Select, Space, Spin, Typography,
} from 'antd';
import { api } from '../../../shared/services/pocketbase';
import {
  addTasksAsPositions, emptyStructure, normalizeStructure, rowCount, variantLabel,
} from '../../../utils/geometryWork';

const { Text } = Typography;

const VARIANT_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }));

export const defaultWorkTitle = () => `Геометрия · ${new Date().toLocaleDateString('ru-RU')}`;

/**
 * «Создать работу»: название, класс, число вариантов. Задачи (из подборки или
 * темы) становятся позициями первого варианта; остальные варианты пустые —
 * их заполняют параллелями в редакторе работы.
 */
export function CreateGeometryWorkModal({ open, onClose, taskIds = [], initialTitle = '', onCreated }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.setFieldsValue({ title: initialTitle || defaultWorkTitle(), class: null, variants: 1 });
  }, [open, initialTitle, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const { structure } = addTasksAsPositions(emptyStructure(values.variants), taskIds);
      const rec = await api.createGeometryWork({
        title: values.title.trim(),
        class: values.class || null,
        structure,
      });
      message.success('Работа создана');
      onCreated?.(rec);
    } catch (e) {
      message.error(`Не удалось создать работу: ${e?.message || 'ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Новая работа"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Создать"
      cancelText="Отмена"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Название" rules={[{ required: true, whitespace: true, message: 'Назовите работу' }]}>
          <Input autoFocus maxLength={200} />
        </Form.Item>
        <Space size={24} align="start">
          <Form.Item name="class" label="Класс">
            <InputNumber min={1} max={11} placeholder="—" style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="variants" label="Вариантов">
            <Segmented options={VARIANT_OPTIONS} />
          </Form.Item>
        </Space>
        <Text type="secondary">
          {taskIds.length
            ? `Задач: ${taskIds.length} — они станут позициями первого варианта.`
            : 'Пустая работа — задачи добавите из подборки.'}
          {' '}Другие варианты заполняются в редакторе работы — подбором параллелей.
        </Text>
      </Form>
    </Modal>
  );
}

/** «Добавить в работу…»: задачи — новыми позициями выбранного варианта. */
export function AddToGeometryWorkModal({ open, onClose, taskIds = [], onAdded }) {
  const { message } = App.useApp();
  const [works, setWorks] = useState(null);
  const [workId, setWorkId] = useState(null);
  const [variant, setVariant] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWorks(null);
    setWorkId(null);
    setVariant(0);
    api.getGeometryWorks().then(setWorks).catch(() => setWorks([]));
  }, [open]);

  const selected = useMemo(() => {
    const w = works?.find((x) => x.id === workId);
    return w ? normalizeStructure(w.structure) : null;
  }, [works, workId]);

  const handleOk = async () => {
    if (!workId) return;
    setSaving(true);
    try {
      const fresh = await api.getGeometryWork(workId);
      const r = addTasksAsPositions(normalizeStructure(fresh.structure), taskIds, variant);
      const rec = await api.updateGeometryWork(workId, { structure: r.structure });
      message.success(r.skipped.length
        ? `Добавлено: ${r.added.length}, уже были в работе: ${r.skipped.length}`
        : `Добавлено задач: ${r.added.length}`);
      onAdded?.(rec);
    } catch (e) {
      message.error(`Не удалось добавить: ${e?.message || 'ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Добавить в работу (${taskIds.length})`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Добавить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !workId }}
      confirmLoading={saving}
      destroyOnHidden
    >
      {works === null ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : works.length === 0 ? (
        <Empty description="Работ ещё нет — создайте новую" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Выберите работу"
            style={{ width: '100%' }}
            value={workId}
            onChange={(v) => { setWorkId(v); setVariant(0); }}
            options={works.map((w) => {
              const s = normalizeStructure(w.structure);
              return {
                value: w.id,
                label: `${w.title}${w.class ? ` · ${w.class} кл.` : ''} — ${rowCount(s)} поз., ${s.variants.length} вар.`,
              };
            })}
          />
          {selected && selected.variants.length > 1 && (
            <Space>
              <Text>В вариант:</Text>
              <Segmented
                value={variant}
                onChange={setVariant}
                options={selected.variants.map((_, i) => ({ value: i, label: variantLabel(i) }))}
              />
            </Space>
          )}
          <Text type="secondary">Задачи станут новыми позициями; те, что уже есть в работе, пропустятся.</Text>
        </Space>
      )}
    </Modal>
  );
}
