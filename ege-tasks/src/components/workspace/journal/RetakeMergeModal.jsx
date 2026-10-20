import { useMemo, useState } from 'react';
import { Modal, Select, Typography } from 'antd';
import { planRetakeMerge, shortDay } from '../../../utils/classJournal';

const { Text } = Typography;

/**
 * «Это пересдача колонки…» (v3.9.391): отметки колонки-пересдачи дописываются
 * к основной через «/» («9/11»), колонка пересдачи удаляется.
 * targets — `retakeTargets(column, allColumns)`, ближайшая раньше — первой.
 */
export default function RetakeMergeModal({
  column, targets = [], students = [], marksIndex, onCancel, onMerge,
}) {
  // Окно пересоздаётся на каждую колонку (key у вызывающего) — выбор с нуля.
  const [targetId, setTargetId] = useState(() => targets[0]?.id || null);
  const [busy, setBusy] = useState(false);

  const target = targets.find((c) => c.id === targetId) || null;
  const plan = useMemo(
    () => (column && target ? planRetakeMerge(target, column, students, marksIndex) : null),
    [column, target, students, marksIndex],
  );

  const submit = async () => {
    if (!plan?.writes.length) return;
    setBusy(true);
    try {
      await onMerge(target, column, plan);
    } finally {
      setBusy(false);
    }
  };

  const label = (c) => `${shortDay(c.day) || '—'} · ${c.title}`;
  return (
    <Modal
      open={!!column}
      title={column ? `«${column.title}» — пересдача какой работы?` : ''}
      okText="Перенести и удалить колонку"
      cancelText="Отмена"
      okButtonProps={{ disabled: !plan?.writes.length, loading: busy }}
      onOk={submit}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
        Отметки этой колонки допишутся к основной через «/»: было 9, пересдал на 11 — в клетке «9 / 11»,
        в средний пойдёт лучшая. Колонка пересдачи потом удалится.
      </Text>
      <Select
        style={{ width: '100%' }}
        value={targetId}
        onChange={setTargetId}
        options={targets.map((c) => ({ value: c.id, label: label(c) }))}
        aria-label="Основная работа"
      />
      {plan && (
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
          <li>пересдали: {plan.retaken}</li>
          {plan.late > 0 && <li>писали только пересдачу (в основной «н» или пусто): {plan.late}</li>}
          {plan.skipped > 0 && <li>пропущено («н», «w», «—» на пересдаче): {plan.skipped}</li>}
          {!plan.writes.length && <li>переносить нечего — в колонке нет новых отметок</li>}
        </ul>
      )}
    </Modal>
  );
}
