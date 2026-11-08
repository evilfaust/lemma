import { useEffect, useState } from 'react';
import { App, Button, Select, Space, Typography } from 'antd';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';

export default function SessionGroupsSelect({ session, onSaved }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(session.groups || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setSelected(session.groups || []); }, [session.id, session.groups]);
  useEffect(() => {
    let active = true;
    api.getTeachingGroups({ allYears: true }).then((list) => { if (active) setGroups(list); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.setSessionGroups(session.id, selected);
      onSaved(updated);
      message.success('Назначение сохранено');
    } catch (e) { message.error(e.message || 'Не удалось назначить тест'); }
    finally { setBusy(false); }
  };
  const supported = Array.isArray(session.groups);
  const dirty = selected.length !== (session.groups || []).length || selected.some((id) => !session.groups?.includes(id));
  const known = new Set(groups.map((g) => g.id));
  return <div>
    <Space.Compact style={{ width: '100%' }}>
      <Select mode="multiple" aria-label="Назначить тест группам" placeholder="Выберите классы или группы"
        style={{ flex: 1, minWidth: 0 }} value={selected} onChange={setSelected} optionFilterProp="label"
        disabled={!canEdit || !supported || busy || error}
        options={[
          ...groups.filter((g) => !g.archived || selected.includes(g.id)).map((g) => ({ value: g.id, label: `${g.name}${g.year ? ` · ${g.year}` : ''}` })),
          ...selected.filter((id) => !known.has(id)).map((id) => ({ value: id, label: `Группа ${id}` })),
        ]} />
      {canEdit && <Button onClick={save} loading={busy} disabled={!supported || !dirty || error}>Сохранить</Button>}
    </Space.Compact>
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {!supported ? 'Назначение будет доступно после обновления базы.' : error ? 'Не удалось загрузить группы. Откройте выдачу повторно.'
        : 'Открытый тест появится на главной учеников этих групп со сроком сдачи, если он задан.'}
    </Typography.Text>
  </div>;
}
