import { useEffect, useMemo, useState } from 'react';
import { App, Modal, Select, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/pocketbase';
import { currentAcademicYear } from '../../../utils/academicYear';

const { Text } = Typography;

// Тот же ключ, что у журнала: предлагаем класс, открытый в журнале последним.
const LS_GROUP = 'journal.groupId';
const readLS = () => { try { return localStorage.getItem(LS_GROUP); } catch { return null; } };
const writeLS = (v) => { try { localStorage.setItem(LS_GROUP, v); } catch { /* приватный режим */ } };

/** Ссылка в журнал класса с колонкой по листу генератора. */
export function sheetJournalLink(groupId, sheetId) {
  return `/app/journal?${new URLSearchParams({ group: groupId, sheet: sheetId })}`;
}

/**
 * «В журнал» у листа генератора (v3.9.240): выбрать класс — и журнал откроется
 * с готовой колонкой этого листа (максимум = заданий в варианте, сегодняшний
 * урок класса подставится сам), после сохранения — сразу ввод отметок. Если
 * лист уже заведён в журнале класса, журнал откроет ввод в той колонке.
 * sheet — { id, title, questions_count? }.
 */
export default function SheetToJournalModal({ open, sheet, onClose }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    api.getTeachingGroups()
      .then((list) => {
        if (!alive) return;
        const active = list.filter((g) => !g.archived);
        setGroups(active);
        const saved = readLS();
        setGroupId((active.find((g) => g.id === saved) || active[0])?.id || null);
      })
      .catch(() => message.error('Не удалось загрузить классы'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, message]);

  const year = currentAcademicYear();
  const options = useMemo(() => groups.map((g) => ({
    value: g.id,
    label: g.year && g.year !== year ? `${g.name} · ${g.year}` : g.name,
  })), [groups, year]);

  const go = () => {
    if (!groupId || !sheet?.id) return;
    writeLS(groupId);
    onClose?.();
    navigate(sheetJournalLink(groupId, sheet.id));
  };

  const count = Number(sheet?.questions_count) || 0;

  return (
    <Modal
      open={open}
      title="В журнал класса"
      okText="Открыть журнал"
      cancelText="Отмена"
      okButtonProps={{ disabled: !groupId }}
      onOk={go}
      onCancel={onClose}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <Text strong>«{sheet?.title || 'Лист'}»</Text>
        {count > 0 && <Text type="secondary"> · заданий в варианте: {count}</Text>}
      </div>
      <Select
        style={{ width: '100%' }}
        placeholder="Класс"
        loading={loading}
        value={groupId}
        onChange={setGroupId}
        options={options}
        showSearch
        optionFilterProp="label"
        notFoundContent={loading ? 'Загрузка…' : 'Классов нет — заведите класс в «Классах и группах»'}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 13 }}>
        Откроется журнал этого класса с новой колонкой по листу: баллы из числа
        заданий в варианте, урок сегодня подставится сам. После сохранения —
        сразу ввод отметок.
      </Text>
    </Modal>
  );
}
