import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Divider, Form, Input, Modal, Popconfirm, Segmented,
  Select, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, KeyOutlined, SearchOutlined, UserOutlined,
} from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import {
  normalizeTelegramId, profileDiff, suggestTelegramMatches, validateUsername,
} from '../../utils/studentModeration';
import { collectAcademicYears, currentAcademicYear } from '../../utils/academicYear';

const { Text, Paragraph } = Typography;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Учится' },
  { value: 'graduated', label: 'Выпустился' },
  { value: 'left', label: 'Выбыл' },
];

// Единая карточка правки ученика: профиль, статус, доступ, принадлежность.
// Открывается из списка «Ученики», карточки ученика и состава группы —
// чтобы одни и те же поля не расползались по трём разным формам.
export default function StudentEditModal({ open, student, onClose, onSaved, onDeleted }) {
  const { message, modal } = App.useApp();
  const { canEdit, isSuperAdmin, teacher } = useAuth();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [peers, setPeers] = useState([]);       // остальные ученики: занятые логины и telegram_id
  const [extRows, setExtRows] = useState([]);   // строки журнала «Решу ЕГЭ» для подбора telegram_id
  const [tgOpen, setTgOpen] = useState(false);
  const [credentials, setCredentials] = useState(null); // { username, password } — показываем один раз
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [status, setStatus] = useState('active');

  // Справочники грузим при открытии — модалка самодостаточна и её можно
  // воткнуть в любой экран, не таща туда загрузку групп и учителей.
  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [groupsData, teachersData, studentsData, extData] = await Promise.all([
        api.getTeachingGroups({ includeArchived: true }).catch(() => []),
        api.getTeachers().catch(() => []),
        api.getStudents().catch(() => []),
        api.getExtResults().catch(() => []),
      ]);
      if (cancelled) return;
      setGroups(groupsData);
      setTeachers(teachersData);
      setPeers(studentsData.filter((s) => s.id !== student.id));
      setExtRows(extData);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, student]);

  useEffect(() => {
    if (!open || !student) return;
    setCredentials(null);
    setTgOpen(false);
    setStatus(student.status || 'active');
    form.setFieldsValue({
      name: student.name || '',
      username: student.username || '',
      student_class: student.student_class || '',
      teaching_group: student.teaching_group || '',
      telegram_id: student.telegram_id || '',
      status: student.status || 'active',
      grad_year: student.grad_year || '',
      owner: student.owner || '',
    });
  }, [open, student, form]);

  const takenUsernames = useMemo(() => peers.map((s) => s.username), [peers]);
  const takenTelegramIds = useMemo(
    () => peers.map((s) => s.telegram_id).filter(Boolean),
    [peers],
  );
  const tgCandidates = useMemo(
    () => (tgOpen ? suggestTelegramMatches({ student, extRows, takenIds: takenTelegramIds }) : []),
    [tgOpen, student, extRows, takenTelegramIds],
  );
  const years = useMemo(
    () => collectAcademicYears([...groups.map((g) => g.year), currentAcademicYear()]),
    [groups],
  );

  const canManage = canEdit && (isSuperAdmin || !student?.owner || student?.owner === teacher?.id);

  const copy = useCallback((text) => {
    navigator.clipboard?.writeText(text)
      .then(() => message.success('Скопировано'))
      .catch(() => message.warning('Не удалось скопировать'));
  }, [message]);

  const handleSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch { return; }

    const tg = normalizeTelegramId(values.telegram_id);
    const next = {
      ...values,
      telegram_id: tg.value,
      // Год выпуска имеет смысл только у выпустившегося или выбывшего.
      grad_year: values.status === 'active' ? '' : (values.grad_year || ''),
    };
    const diff = profileDiff(student, next);
    if (!diff.length) {
      message.info('Изменений нет');
      onClose?.();
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateStudentProfile(student.id, next);
      message.success(`Сохранено: ${diff.map((d) => d.label.toLowerCase()).join(', ')}`);
      onSaved?.(updated || { ...student, ...next });
      onClose?.();
    } catch (e) {
      const text = String(e?.message || '');
      message.error(text.includes('username')
        ? 'Логин занят или недопустим'
        : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setPasswordBusy(true);
    try {
      const res = await api.setStudentPassword(student.id);
      setCredentials(res);
      message.success('Новый пароль выдан — покажите его ученику');
    } catch (e) {
      message.error(`Не удалось сменить пароль: ${e?.message || ''}`);
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      const preview = await api.previewDeleteStudent(student.id);
      if (preview.blocking?.length) {
        modal.info({
          title: 'Удалить нельзя — у ученика есть данные',
          content: (
            <>
              <Paragraph>Найдено: {preview.blocking.join(', ')}.</Paragraph>
              <Paragraph type="secondary">
                Такой аккаунт объединяют с основным («Объединить аккаунты») или помечают
                статусом «выбыл» — тогда история остаётся, а из списков он пропадает.
              </Paragraph>
            </>
          ),
        });
        return;
      }
      modal.confirm({
        title: `Удалить аккаунт «${student.name || student.username}»?`,
        content: 'Аккаунт пустой — попыток, программ и отметок нет. Действие необратимо.',
        okText: 'Удалить',
        okButtonProps: { danger: true },
        cancelText: 'Отмена',
        onOk: async () => {
          await api.deleteStudentAccount(student.id);
          message.success('Аккаунт удалён');
          onDeleted?.(student.id);
          onClose?.();
        },
      });
    } catch (e) {
      message.error(`Не удалось проверить аккаунт: ${e?.message || ''}`);
    }
  };

  if (!student) return null;

  return (
    <Modal
      open={open}
      title={(
        <Space>
          <UserOutlined />
          {student.name || student.username}
          {student.external && <Tag color="orange">без аккаунта</Tag>}
        </Space>
      )}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !canManage }}
      width={620}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : (
        <Form form={form} layout="vertical" disabled={!canManage}>
          <Form.Item name="name" label="Имя" rules={[{ required: true, message: 'Введите имя' }]}>
            <Input placeholder="Фамилия Имя" maxLength={100} />
          </Form.Item>

          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="teaching_group" label="Группа" style={{ flex: 1 }}>
              <Select
                allowClear
                placeholder="Без группы"
                options={groups.map((g) => ({
                  value: g.id,
                  label: `${g.name}${g.year ? ` · ${g.year}` : ''}${g.archived ? ' (архив)' : ''}`,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item
              name="student_class"
              label="Класс"
              tooltip="Свободная строка из старых времён: подсказка для «привязать по совпадению» и подпись в списках"
              style={{ width: 180 }}
            >
              <Input placeholder="10А" maxLength={50} />
            </Form.Item>
          </Space>

          <Form.Item
            name="telegram_id"
            label={(
              <Space>
                Telegram ID
                <Tooltip title="По нему сходятся результаты «Решу ЕГЭ» из внешнего журнала">
                  <Text type="secondary" style={{ fontWeight: 400 }}>зачем?</Text>
                </Tooltip>
              </Space>
            )}
            extra={student.telegram_id ? undefined : 'Пусто — результаты «Решу ЕГЭ» этому ученику не сопоставятся'}
          >
            <Input
              placeholder="5935392293"
              maxLength={64}
              addonAfter={(
                <Tooltip title="Подобрать из журнала «Решу ЕГЭ»">
                  <SearchOutlined onClick={() => setTgOpen((v) => !v)} style={{ cursor: 'pointer' }} />
                </Tooltip>
              )}
            />
          </Form.Item>

          {tgOpen && (
            <div style={{ marginTop: -12, marginBottom: 16, maxHeight: 180, overflowY: 'auto' }}>
              {tgCandidates.length ? tgCandidates.map((c) => (
                <div
                  key={c.telegramId}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                >
                  <Tag color={c.match === 'exact' ? 'green' : (c.match === 'partial' ? 'gold' : undefined)}>
                    {c.match === 'exact' ? 'совпало' : (c.match === 'partial' ? 'похоже' : 'свободен')}
                  </Tag>
                  <Text style={{ flex: 1, minWidth: 0 }} ellipsis>
                    {c.names.join(', ') || '—'}
                    {c.groups.length ? ` · ${c.groups.join(', ')}` : ''}
                  </Text>
                  <Text type="secondary">{c.telegramId}</Text>
                  <Button
                    size="small"
                    onClick={() => {
                      form.setFieldValue('telegram_id', c.telegramId);
                      setTgOpen(false);
                    }}
                  >
                    Взять
                  </Button>
                </div>
              )) : (
                <Text type="secondary">Свободных ID в журнале «Решу ЕГЭ» нет</Text>
              )}
            </div>
          )}

          <Divider orientation="left" plain>Статус</Divider>
          <Space size="middle" align="start" style={{ display: 'flex' }}>
            <Form.Item name="status" style={{ marginBottom: 8 }}>
              <Segmented options={STATUS_OPTIONS} onChange={setStatus} />
            </Form.Item>
            {status !== 'active' && (
              <Form.Item name="grad_year" label="Учебный год" style={{ width: 180 }}>
                <Select
                  allowClear
                  placeholder="2025/2026"
                  options={years.map((y) => ({ value: y, label: y }))}
                />
              </Form.Item>
            )}
          </Space>
          {status !== 'active' && (
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message="История сохраняется полностью"
              description="Попытки, результаты «Решу ЕГЭ», программы и посещаемость остаются на месте. Ученик просто пропадает из активных списков и пикеров."
            />
          )}

          <Divider orientation="left" plain>Доступ</Divider>
          {student.external ? (
            <Alert
              type="warning"
              style={{ marginBottom: 16 }}
              message="Ученик вписан вручную, без рабочего аккаунта"
              description="Ему доступны только заметки и посещаемость. Чтобы он мог проходить тесты, снимите отметку и выдайте пароль — логин уже есть."
              action={canManage && (
                <Button
                  size="small"
                  onClick={async () => {
                    try {
                      await api.updateStudentProfile(student.id, { external: false });
                      const res = await api.setStudentPassword(student.id);
                      setCredentials(res);
                      onSaved?.({ ...student, external: false });
                      message.success('Аккаунт выдан');
                    } catch (e) {
                      message.error(`Не удалось выдать аккаунт: ${e?.message || ''}`);
                    }
                  }}
                >
                  Выдать аккаунт
                </Button>
              )}
            />
          ) : null}

          <Space size="middle" align="end" style={{ display: 'flex' }}>
            <Form.Item
              name="username"
              label="Логин"
              style={{ flex: 1 }}
              extra="Ученик будет входить по новому логину; уже открытая сессия не прервётся"
              rules={[{
                validator: (_, value) => {
                  const err = validateUsername(value, { taken: takenUsernames });
                  return err ? Promise.reject(new Error(err)) : Promise.resolve();
                },
              }]}
            >
              <Input placeholder="st_ab12" maxLength={50} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 24 }}>
              <Popconfirm
                title="Выдать новый пароль?"
                description="Старый перестанет работать. Новый покажем один раз."
                okText="Выдать"
                cancelText="Отмена"
                onConfirm={handleResetPassword}
                disabled={!canManage}
              >
                <Button icon={<KeyOutlined />} loading={passwordBusy} disabled={!canManage}>
                  Сбросить пароль
                </Button>
              </Popconfirm>
            </Form.Item>
          </Space>

          {credentials && (
            <Alert
              type="success"
              style={{ marginBottom: 16 }}
              message="Данные для входа — покажите ученику сейчас"
              description={(
                <Space size="large" wrap>
                  <Text>Логин: <Text code>{credentials.username}</Text></Text>
                  <Text>Пароль: <Text code>{credentials.password}</Text></Text>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copy(`${credentials.username} / ${credentials.password}`)}
                  >
                    Копировать
                  </Button>
                </Space>
              )}
            />
          )}

          {(isSuperAdmin || student.owner === teacher?.id || !student.owner) && (
            <>
              <Divider orientation="left" plain>Принадлежность</Divider>
              <Form.Item
                name="owner"
                label="Учитель"
                extra="После передачи ученик пропадёт из ваших списков"
              >
                <Select
                  allowClear
                  placeholder="Не привязан"
                  options={teachers
                    .filter((t) => t.username !== 'journal-sync')
                    .map((t) => ({ value: t.id, label: t.name || t.username }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </>
          )}

          {isSuperAdmin && (
            <>
              <Divider orientation="left" plain>Опасная зона</Divider>
              <Space align="start">
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                  Удалить аккаунт
                </Button>
                <Text type="secondary" style={{ maxWidth: 380, display: 'inline-block' }}>
                  Удаляется только пустой аккаунт — без попыток, программ, курсов и
                  отметок. Если данные есть, сервер откажет и подскажет, что мешает.
                </Text>
              </Space>
            </>
          )}
        </Form>
      )}
    </Modal>
  );
}
