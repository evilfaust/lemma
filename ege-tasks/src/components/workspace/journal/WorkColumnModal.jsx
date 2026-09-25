import { useEffect, useMemo, useState } from 'react';
import { App, Modal, Select, Typography } from 'antd';
import { api } from '../../../shared/services/pocketbase';

const { Text } = Typography;

/**
 * «Работа Lemma» в журнал: выбранная работа становится колонкой, выданной
 * всему классу, — она видна сразу, ещё до первой попытки, а не сдавшие к сроку
 * попадают в долги.
 */
export default function WorkColumnModal({ open, presentWorkIds = [], onCancel, onPick }) {
  const { message } = App.useApp();
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(null);
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await api.getWorks();
        if (alive) setWorks(list);
      } catch {
        message.error('Не удалось загрузить работы');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, message]);

  const present = useMemo(() => new Set(presentWorkIds), [presentWorkIds]);
  const options = useMemo(() => works.map((w) => ({
    value: w.id,
    label: present.has(w.id) ? `${w.title} · уже в журнале` : w.title,
    search: String(w.title || '').toLowerCase(),
  })), [works, present]);

  const submit = async () => {
    const work = works.find((w) => w.id === value);
    if (!work) return;
    setSaving(true);
    try {
      await onPick(work);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Работа Lemma в журнал"
      okText="Добавить колонку"
      cancelText="Отмена"
      okButtonProps={{ disabled: !value }}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
        Колонка появится сразу, ещё до первой попытки. Результаты подтянутся из попыток
        учеников класса, а кто не сдаст к сроку выдачи — попадёт в долги.
      </Text>
      <Select
        showSearch
        autoFocus
        style={{ width: '100%' }}
        placeholder="Найдите работу по названию"
        loading={loading}
        value={value}
        onChange={setValue}
        options={options}
        filterOption={(input, opt) => opt.search.includes(input.toLowerCase())}
        notFoundContent={loading ? 'Загрузка…' : 'Работ не найдено'}
      />
    </Modal>
  );
}
