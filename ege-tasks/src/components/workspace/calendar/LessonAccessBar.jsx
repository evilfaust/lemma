import { useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Space, Typography } from 'antd';
import { ShareAltOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { Chip } from '../ui';
import { teacherLabel } from '../CoTeachersSection';

const { Text } = Typography;
const SERVICE_ACCOUNTS = ['journal-sync'];

/**
 * Полоса доступа к уроку в модалке:
 *  • чужой урок → «Ведёт: Иванов И. · вы второй учитель»;
 *  • свой урок → точечный доступ (`lessons.shared_with`) для разовой замены
 *    или открытого урока.
 *
 * 🚨 Постоянный тандем «два учителя на класс» сюда не относится — он задаётся
 * один раз на классе («Ведут класс» в карточке группы) и накрывает все уроки.
 * Об этом же говорит подпись под полем, чтобы точечный доступ не раздавали
 * вместо со-ведения.
 */
export default function LessonAccessBar({ lesson, canEdit, onShared }) {
  const { message } = App.useApp();
  const { teacher } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [value, setValue] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const ownerId = lesson?.owner || '';
  const isForeign = !!(teacher && ownerId && ownerId !== teacher.id);

  useEffect(() => {
    setValue((lesson?.shared_with || []).slice());
    setDirty(false);
    setOpen(false);
  }, [lesson?.id, lesson?.shared_with]);

  useEffect(() => {
    if (!open || teachers.length) return;
    api.getTeachers().then(setTeachers).catch(() => setTeachers([]));
  }, [open, teachers.length]);

  const options = useMemo(() => teachers
    .filter((t) => t.id !== ownerId && !SERVICE_ACCOUNTS.includes(t.username))
    .map((t) => ({ value: t.id, label: teacherLabel(t) })), [teachers, ownerId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.shareLesson(lesson.id, value);
      message.success(value.length ? 'Доступ к уроку открыт' : 'Доступ к уроку закрыт');
      setDirty(false);
      onShared?.();
    } catch {
      message.error('Не удалось изменить доступ к уроку');
    } finally {
      setSaving(false);
    }
  };

  if (isForeign) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Chip tone="violet" dot={false}>
          <UserOutlined /> Ведёт: {lesson?.expand?.owner
            ? teacherLabel(lesson.expand.owner) : 'коллега'} · вы второй учитель
        </Chip>
      </div>
    );
  }

  if (!lesson?.id || !canEdit) return null;

  const shared = lesson.shared_with || [];

  return (
    <div style={{ marginBottom: 12 }}>
      <Space size={8} wrap>
        <Button size="small" icon={<ShareAltOutlined />} onClick={() => setOpen((v) => !v)}>
          {shared.length ? `Доступ у ${shared.length} коллег` : 'Поделиться уроком'}
        </Button>
        {dirty && (
          <>
            <Button size="small" type="primary" loading={saving} onClick={save}>Сохранить доступ</Button>
            <Button size="small" onClick={() => { setValue(shared.slice()); setDirty(false); }}>Отмена</Button>
          </>
        )}
      </Space>
      {open && (
        <div style={{ marginTop: 8 }}>
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            placeholder="Кому открыть этот урок"
            value={value}
            onChange={(v) => { setValue(v); setDirty(true); }}
            options={options}
            optionFilterProp="label"
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
            Точечный доступ к одному уроку — для разовой замены или открытого урока.
            Если коллега ведёт класс вместе с вами постоянно, впишите его в «Ведут класс»
            в карточке группы: тогда откроются все уроки сразу.
          </Text>
        </div>
      )}
    </div>
  );
}
