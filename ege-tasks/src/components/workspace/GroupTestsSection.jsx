import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Input, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { groupLineageIds } from '../../utils/yearRollover';
import { studentWorkTitle } from '../../utils/studentWorkTitle';
import { groupTestProgress, groupTestProgressText, PROGRESS_LABELS } from '../../utils/groupTests';
import { copyText } from '../../utils/copyText';
import { SectionCard } from './ui';

const sessionLabel = (s) => `${studentWorkTitle(s)} · ${s.id}${s.deadline ? ` · до ${dayjs(s.deadline).format('DD.MM HH:mm')}` : ''}${s.is_open ? '' : ' · приём закрыт'}`;

export default function GroupTestsSection({ group, students = [] }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(null);
  const [attemptError, setAttemptError] = useState(false);
  const [courseStudents, setCourseStudents] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [picked, setPicked] = useState();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    (async () => {
      const groups = await api.getTeachingGroups({ allYears: true, includeArchived: true });
      const [list, roster] = await Promise.all([
        api.getGroupTestSessions(groupLineageIds([...groups.filter((g) => g.id !== group.id), group], group.id)),
        group.kind === 'course' ? api.getCourseStudents(group.id, { strict: true }) : Promise.resolve([]),
      ]);
      if (!active) return;
      list.sort((a, b) => Number(b.is_open) - Number(a.is_open) || new Date(b.created) - new Date(a.created));
      setSessions(list); setCourseStudents(roster);
      setSelected((prev) => list.some((s) => s.id === prev) ? prev : list[0]?.id);
    })().catch(() => { if (active) setError('Не удалось загрузить тесты группы. Проверьте обновление базы и подключение.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.id, group.kind, group.prev_group, refresh]);

  const loadAttempts = useCallback(() => api.getGroupTestAttempts(selected), [selected]);
  useEffect(() => {
    let active = true;
    setAttempts(null); setAttemptError(false);
    if (!selected) return;
    const load = () => loadAttempts().then((rows) => {
      if (active) { setAttempts(rows); setAttemptError(false); }
    }).catch(() => { if (active) { setAttempts(null); setAttemptError(true); } });
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [loadAttempts, refresh]);

  const roster = group.kind === 'course' ? courseStudents : students;
  const session = sessions.find((s) => s.id === selected);
  const progress = useMemo(() => attempts === null ? null : groupTestProgress(roster, attempts), [roster, attempts]);

  const openAssign = async () => {
    setOpen(true); setPicked(undefined); setOptions([]); setOptionsError(''); setOptionsLoading(true);
    try { setOptions(await api.getAssignableSessions()); }
    catch { setOptionsError('Не удалось загрузить выдачи тестов. Закройте окно и попробуйте ещё раз.'); }
    finally { setOptionsLoading(false); }
  };
  const assign = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.assignSessionToGroup(picked, group.id);
      setSelected(picked); setOpen(false); setRefresh((n) => n + 1);
      message.success('Тест назначен группе');
    } catch (e) { message.error(e.message || 'Не удалось назначить тест'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.assignSessionToGroup(session.id, group.id, false);
      setRefresh((n) => n + 1); message.success('Назначение снято');
    } catch (e) { message.error(e.message || 'Не удалось снять назначение'); }
    finally { setBusy(false); }
  };
  const copyProgress = async () => {
    setBusy(true);
    try {
      // Перед отправкой в чат сверяемся с сервером, а не с прошлым опросом.
      const fresh = await loadAttempts();
      setAttempts(fresh); setAttemptError(false);
      const text = groupTestProgressText(group, session, groupTestProgress(roster, fresh));
      if (await copyText(text)) message.success('Сводка скопирована — можно вставить в чат');
      else setManual(text);
    } catch { setAttempts(null); setAttemptError(true); message.error('Не удалось обновить статусы. Сводка не скопирована.'); }
    finally { setBusy(false); }
  };

  return <div style={{ marginBottom: 16 }}>
    <SectionCard icon={<FileTextOutlined />} title="Тесты группы" extra={canEdit && (
      <Button size="small" icon={<PlusOutlined />} onClick={openAssign}>Назначить тест</Button>
    )}>
      {loading ? <Spin /> : error ? <Alert type="warning" message={error} action={<Button onClick={() => setRefresh((n) => n + 1)}>Повторить</Button>} />
        : !sessions.length ? <Typography.Text type="secondary">Назначьте выданный тест — он появится на главной учеников, а здесь будут статусы выполнения.</Typography.Text>
          : <>
            <Select aria-label="Тест группы" value={selected} onChange={setSelected} optionFilterProp="label" showSearch
              style={{ width: '100%', marginBottom: 12 }} disabled={busy}
              options={sessions.map((s) => ({ value: s.id, label: sessionLabel(s) }))} />
            {session && <>
              <Space wrap style={{ marginBottom: 12 }}>
                <Tag color={session.is_open ? 'green' : 'default'}>{session.is_open ? 'Приём открыт' : 'Приём закрыт'}</Tag>
                <Typography.Text>{session.deadline ? `Сдать до ${dayjs(session.deadline).format('DD.MM.YYYY HH:mm')}` : 'Без срока сдачи'}</Typography.Text>
                {!session.groups?.includes(group.id) && <Tag>Назначен группе другого учебного года</Tag>}
              </Space>
              <div style={{ marginBottom: 12 }}><Space wrap>
                <Button size="small" icon={<CopyOutlined />} onClick={copyProgress} loading={busy} disabled={!progress}>Копировать статусы</Button>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefresh((n) => n + 1)} disabled={busy}>Обновить</Button>
                {canEdit && session.groups?.includes(group.id) && <Popconfirm title="Снять назначение группе?" description="Тест и результаты сохранятся." okText="Снять" cancelText="Отмена" onConfirm={remove}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={busy}>Снять назначение</Button>
                </Popconfirm>}
              </Space></div>
              {attemptError ? <Alert type="error" message="Не удалось получить статусы. Обновите данные перед копированием." />
                : !progress ? <Spin /> : <div className="ws-test-progress">
                  {Object.entries(PROGRESS_LABELS).filter(([key]) => key !== 'external' || progress[key].length).map(([key, label]) => (
                    <div key={key}>
                      <Typography.Text strong>{label} ({progress[key].length})</Typography.Text>
                      {progress[key].length ? <ul>{progress[key].map((s) => <li key={s.id}>{s.name}</li>)}</ul> : <div>—</div>}
                    </div>
                  ))}
                </div>}
            </>}
          </>}
    </SectionCard>
    <Modal open={open} title="Назначить тест группе" onCancel={() => !busy && setOpen(false)} onOk={assign}
      confirmLoading={busy} okText="Назначить" cancelText="Отмена" okButtonProps={{ disabled: !picked || optionsLoading }}>
      <p>Выберите существующую выдачу. Срок сдачи берётся из её настроек; закрытая выдача появится у учеников после открытия приёма.</p>
      {optionsError && <Alert type="error" message={optionsError} />}
      <Select aria-label="Выдача теста" showSearch optionFilterProp="label" loading={optionsLoading} value={picked} onChange={setPicked}
        style={{ width: '100%' }} placeholder="Название теста или код выдачи"
        notFoundContent={optionsLoading ? <Spin size="small" /> : 'Сначала откройте «Выдачу» нужной работы или теста'}
        options={options.filter((s) => !s.groups?.includes(group.id)).map((s) => ({ value: s.id, label: sessionLabel(s) }))} />
    </Modal>
    <Modal open={!!manual} title="Статусы выполнения" footer={null} onCancel={() => setManual('')}>
      <p>Выделите текст и скопируйте его в чат.</p>
      <Input.TextArea readOnly value={manual} autoSize={{ minRows: 8, maxRows: 24 }} onFocus={(e) => e.target.select()} />
    </Modal>
  </div>;
}
