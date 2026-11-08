import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, App, Button, DatePicker, Flex, Popconfirm, Space, Spin, Tag } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../shared/services/pocketbase';
import { assignmentDeadlineTime, assignmentReviewed } from '../../utils/assignmentAttention';
import { studentWorkTitle } from '../../utils/studentWorkTitle';
import TeacherResultsDashboard from '../worksheet/TeacherResultsDashboard';
import { SectionCard, WorkspacePageHeader } from './ui';

export default function AssignmentPage() {
  const { sessionId } = useParams();
  return <Assignment key={sessionId} sessionId={sessionId} />;
}

function Assignment({ sessionId }) {
  const { canEdit } = useAuth();
  const { message } = App.useApp();
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState(undefined);
  const [refresh, setRefresh] = useState(0);
  const [newDeadline, setNewDeadline] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setProgress(undefined);
    api.getAssignment(sessionId).then(async (record) => {
      if (!active) return;
      setSession(record);
      const stats = await api.getAssignmentProgress([record]).catch(() => null);
      if (active) setProgress(stats?.get(sessionId) ?? null);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [sessionId, refresh]);

  const save = async (action, fields, success) => {
    setBusy(true);
    try {
      const updated = await action();
      setSession((prev) => ({ ...prev, ...Object.fromEntries(fields.map((name) => [name, updated[name]])) }));
      message.success(success);
      return true;
    } catch (error) {
      message.error(error.status ? 'Не удалось обновить выдачу' : error.message || 'Не удалось обновить выдачу');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const extend = async () => {
    if (!newDeadline || newDeadline.valueOf() <= Math.max(Date.now(), assignmentDeadlineTime(session.deadline) || 0)) {
      message.warning('Выберите будущую дату и время позже текущего срока');
      return;
    }
    const saved = await save(
      () => api.updateSession(session.id, { deadline: newDeadline.toISOString() }),
      ['deadline'], session.deadline ? 'Срок продлён' : 'Срок установлен',
    );
    if (saved) setNewDeadline(null);
  };

  const back = <Link to="/app/today">← Сегодня</Link>;
  if (loadError) {
    return <Space direction="vertical">{back}
      <Alert type="error" message="Не удалось открыть выдачу" />
      <Button onClick={() => setRefresh((n) => n + 1)}>Повторить</Button>
    </Space>;
  }
  if (!session) return <Spin />;

  const deadline = assignmentDeadlineTime(session.deadline);
  const expired = deadline <= Date.now();
  const closedByDeadline = expired && session.strict_deadline;
  const actionsDisabled = busy || progress === undefined;
  const reviewed = assignmentReviewed(session);
  const groups = session.expand?.groups || [];
  const changeIntake = (is_open) => save(
    () => api.updateSession(session.id, { is_open }), ['is_open'], is_open ? 'Приём открыт' : 'Приём закрыт',
  );
  const changeReviewed = () => save(
    () => api.setAssignmentReviewed(session, !reviewed), ['reviewed_deadline'],
    reviewed ? 'Отметка снята' : 'Итоги отмечены как разобранные',
  );

  return (
    <Flex vertical gap="middle">
      <WorkspacePageHeader
        icon={<FlagOutlined />}
        title={studentWorkTitle(session, 'Выданная работа')}
        subtitle={groups.map((group) => group.name).join(' · ') || 'Выданная работа'}
        extra={back}
      />
      <SectionCard title="Сдача работы">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Tag color={session.is_open && !closedByDeadline ? 'green' : 'default'}>
              {!session.is_open ? 'Приём закрыт' : closedByDeadline ? 'Приём закрыт по сроку' : 'Приём открыт'}
            </Tag>
            <span>{session.deadline ? `Срок ${dayjs(deadline).format('DD.MM.YYYY HH:mm')}` : 'Без срока сдачи'}</span>
            {reviewed && <Tag>Итоги разобраны</Tag>}
          </Space>
          {canEdit && (
            <Space wrap>
              <DatePicker
                aria-label="Новый срок сдачи"
                showTime={{ format: 'HH:mm' }}
                format="DD.MM.YYYY HH:mm"
                placeholder="Новый срок сдачи"
                value={newDeadline}
                disabled={actionsDisabled}
                onChange={setNewDeadline}
              />
              <Button disabled={actionsDisabled || !newDeadline} onClick={extend}>
                {session.deadline ? 'Продлить срок' : 'Установить срок'}
              </Button>
              {session.is_open ? (
                <Popconfirm
                  title="Закрыть приём?"
                  description="Ученики больше не смогут начать или отправить работу."
                  okText="Закрыть"
                  cancelText="Отмена"
                  onConfirm={() => changeIntake(false)}
                >
                  <Button disabled={actionsDisabled}>Закрыть приём</Button>
                </Popconfirm>
              ) : (
                <Button disabled={actionsDisabled || closedByDeadline} onClick={() => changeIntake(true)}>
                  Открыть приём
                </Button>
              )}
              {(expired || reviewed) && (
                <Button type="primary" disabled={actionsDisabled} onClick={changeReviewed}>
                  {reviewed ? 'Снять отметку' : 'Отметить разобранной'}
                </Button>
              )}
            </Space>
          )}
          {canEdit && !session.is_open && closedByDeadline && <span>Для открытия приёма продлите строгий срок.</span>}
          {progress === undefined ? <Spin size="small" /> : progress === null ? (
            <Alert type="warning" message="Не удалось загрузить сводку сдачи"
              action={<Button size="small" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>Обновить</Button>} />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <strong>{progress.expected
                  ? `Сдали ${progress.submitted.length} из ${progress.expected}`
                  : `Сдано попыток: ${progress.submittedAttempts}`}</strong>
                {!progress.expected && <span>Список ожидаемых участников пуст.</span>}
                <Button size="small" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>Обновить сводку</Button>
              </Space>
              <MissingStudents title="Начали, но не отправили" students={progress.started} />
              <MissingStudents title="Не приступали" students={progress.untouched} />
            </Space>
          )}
        </Space>
      </SectionCard>
      <SectionCard title="Результаты учеников">
        <TeacherResultsDashboard sessionId={sessionId} />
      </SectionCard>
    </Flex>
  );
}

function MissingStudents({ title, students }) {
  if (!students.length) return null;
  return (
    <div>
      <strong>{title} ({students.length})</strong>
      <ul style={{ marginBlock: '4px 0', paddingInlineStart: 24 }}>
        {students.map((student) => <li key={student.id}>{student.name}</li>)}
      </ul>
    </div>
  );
}
