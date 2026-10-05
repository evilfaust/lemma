import { useEffect, useMemo, useState } from 'react';
import { App, Modal, Select, Typography } from 'antd';
import { api } from '../../../shared/services/pocketbase';

const { Text } = Typography;
const TEST_PREFIX = 'mc:';

/**
 * «Работа Lemma» в журнал: выбранная работа становится колонкой, выданной
 * всему классу, — она видна сразу, ещё до первой попытки, а не сдавшие к сроку
 * попадают в долги. С v3.9.299 — и тест (из генератора или с выбором ответа):
 * его колонка ведётся по выдаче, выбор уходит в `onPickTest(test)`.
 */
export default function WorkColumnModal({ open, presentWorkIds = [], onCancel, onPick, onPickTest }) {
  const { message } = App.useApp();
  const [works, setWorks] = useState([]);
  const [tests, setTests] = useState([]);
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
        const [list, testList] = await Promise.all([
          api.getWorks(),
          onPickTest ? api.getMCTestsLight() : Promise.resolve([]),
        ]);
        if (alive) { setWorks(list); setTests(testList); }
      } catch {
        message.error('Не удалось загрузить работы');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, message, onPickTest]);

  const present = useMemo(() => new Set(presentWorkIds), [presentWorkIds]);
  const options = useMemo(() => {
    const workOpts = works.map((w) => ({
      value: w.id,
      label: present.has(w.id) ? `${w.title} · уже в журнале` : w.title,
      search: String(w.title || '').toLowerCase(),
    }));
    if (!tests.length) return workOpts;
    return [
      { label: 'Работы', options: workOpts },
      {
        label: 'Тесты',
        options: tests.map((t) => ({
          value: `${TEST_PREFIX}${t.id}`,
          label: t.title || 'Тест',
          search: String(t.title || '').toLowerCase(),
        })),
      },
    ];
  }, [works, tests, present]);

  const submit = async () => {
    setSaving(true);
    try {
      if (String(value).startsWith(TEST_PREFIX)) {
        const test = tests.find((t) => `${TEST_PREFIX}${t.id}` === value);
        if (test) await onPickTest(test);
      } else {
        const work = works.find((w) => w.id === value);
        if (work) await onPick(work);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={onPickTest ? 'Работа или тест Lemma в журнал' : 'Работа Lemma в журнал'}
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
        placeholder={onPickTest ? 'Найдите работу или тест по названию' : 'Найдите работу по названию'}
        loading={loading}
        value={value}
        onChange={setValue}
        options={options}
        filterOption={(input, opt) => (opt.search || '').includes(input.toLowerCase())}
        notFoundContent={loading ? 'Загрузка…' : 'Работ не найдено'}
      />
    </Modal>
  );
}
