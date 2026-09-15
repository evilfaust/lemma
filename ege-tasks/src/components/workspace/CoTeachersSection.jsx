import { useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Space, Typography } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { Chip, SectionCard } from './ui';

const { Text } = Typography;

/** Подпись учителя в списках: имя, иначе логин. */
export function teacherLabel(t) {
  return t?.name || t?.username || 'учитель';
}

// Технический аккаунт синхронизации журнала «Решу» — не человек, в пикере не нужен.
const SERVICE_ACCOUNTS = ['journal-sync'];

/**
 * «Ведут класс» — владелец плюс вторые учителя (`teaching_groups.co_teachers`).
 *
 * 🚨 Этот список — единственный источник со-ведения: по нему правила PB
 * (миграция 1786200000) открывают коллеге уроки класса, его учеников, журнал и
 * заметки уроков. Поэтому и предупреждение о доступе живёт прямо здесь.
 */
export default function CoTeachersSection({ group, onChanged }) {
  const { message } = App.useApp();
  const { canEdit, teacher } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [value, setValue] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const ownerId = group?.owner || '';
  const isOwner = !!teacher && ownerId === teacher.id;

  useEffect(() => {
    setValue((group?.co_teachers || []).slice());
    setDirty(false);
  }, [group?.id, group?.co_teachers]);

  useEffect(() => {
    let cancelled = false;
    api.getTeachers()
      .then((list) => { if (!cancelled) setTeachers(list); })
      .catch(() => { if (!cancelled) setTeachers([]); });
    return () => { cancelled = true; };
  }, []);

  const options = useMemo(() => teachers
    .filter((t) => t.id !== ownerId && !SERVICE_ACCOUNTS.includes(t.username))
    .map((t) => ({ value: t.id, label: teacherLabel(t) })), [teachers, ownerId]);

  const byId = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const ownerName = teacherLabel(byId.get(ownerId) || group?.expand?.owner);

  const save = async () => {
    setSaving(true);
    try {
      await api.setGroupCoTeachers(group.id, value);
      message.success(value.length
        ? 'Класс теперь ведут вдвоём — коллеге открылись уроки, ученики и журнал'
        : 'Второй учитель убран из класса');
      setDirty(false);
      onChanged?.();
    } catch {
      message.error('Не удалось сохранить второго учителя');
    } finally {
      setSaving(false);
    }
  };

  // Не владелец (я сам здесь второй учитель) — состав показываем, но не правим.
  if (!isOwner) {
    return (
      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={<TeamOutlined />} iconColor="var(--ink-3)" title="Ведут класс">
          <div className="ws-tile__meta" style={{ margin: '2px 8px 6px', gap: '8px 12px' }}>
            <Chip tone="blue" dot={false}><UserOutlined /> {ownerName} — ведущий</Chip>
            {(group?.co_teachers || []).map((id) => (
              <Chip key={id} tone="neutral" dot={false}>
                {id === teacher?.id ? 'вы — второй учитель' : teacherLabel(byId.get(id))}
              </Chip>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionCard
        icon={<TeamOutlined />}
        iconColor="var(--ink-3)"
        title="Ведут класс"
        extra={dirty && canEdit && (
          <Space size={6} style={{ marginLeft: 'auto' }}>
            <Button size="small" onClick={() => { setValue((group?.co_teachers || []).slice()); setDirty(false); }}>
              Отмена
            </Button>
            <Button size="small" type="primary" loading={saving} onClick={save}>Сохранить</Button>
          </Space>
        )}
      >
        <div style={{ padding: '2px 8px 8px' }}>
          <div style={{ marginBottom: 8 }}>
            <Chip tone="blue" dot={false}><UserOutlined /> {ownerName} — ведущий</Chip>
          </div>
          <Select
            mode="multiple"
            allowClear
            disabled={!canEdit}
            style={{ width: '100%', maxWidth: 520 }}
            placeholder="Второй учитель (помощник на уроках этого класса)"
            value={value}
            onChange={(v) => { setValue(v); setDirty(true); }}
            options={options}
            optionFilterProp="label"
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
            Второй учитель видит уроки класса и работает с ними наравне с вами:
            правит, переносит, отмечает посещаемость. Ему также открываются ученики
            класса, журнал и заметки уроков. Карточку ученика и сам класс правит владелец.
          </Text>
        </div>
      </SectionCard>
    </div>
  );
}
