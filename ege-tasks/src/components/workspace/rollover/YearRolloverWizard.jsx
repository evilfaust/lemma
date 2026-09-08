import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Input, InputNumber, Progress, Result, Segmented, Select,
  Space, Spin, Steps, Table, Tag, Typography,
} from 'antd';
import { ArrowRightOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/pocketbase';
import {
  collectAcademicYears, currentAcademicYear, isValidAcademicYear,
  nextAcademicYear, normalizeAcademicYear, prevAcademicYear,
} from '../../../utils/academicYear';
import {
  buildRolloverPlan, summarizeRolloverPlan, validateRolloverPlan,
  GROUP_ACTIONS, STUDENT_ACTIONS,
} from '../../../utils/yearRollover';
import { WorkspacePageHeader, SectionCard, EmptyState, Chip } from '../ui';

const { Text } = Typography;

const GROUP_ACTION_OPTIONS = [
  { value: GROUP_ACTIONS.CONTINUE, label: 'Перевести' },
  { value: GROUP_ACTIONS.GRADUATE, label: 'Выпуск' },
  { value: GROUP_ACTIONS.SKIP, label: 'Не трогать' },
];

const STUDENT_ACTION_OPTIONS = [
  { value: STUDENT_ACTIONS.TRANSFER, label: 'Перевести' },
  { value: STUDENT_ACTIONS.GRADUATE, label: 'Выпустить' },
  { value: STUDENT_ACTIONS.LEAVE, label: 'Выбыл' },
  { value: STUDENT_ACTIONS.STAY, label: 'Оставить' },
];

// Мастер перевода на новый учебный год: год-источник → что делать с группами →
// пофамильно → применение. План собирает чистая логика (`utils/yearRollover`),
// здесь — только правка плана руками и показ того, что произойдёт.
export default function YearRolloverWizard() {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [years, setYears] = useState([]);
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState({ groups: [], rosters: {} });
  const [plan, setPlan] = useState(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await api.getAcademicYears();
      const known = collectAcademicYears(list);
      setYears(known);
      // По умолчанию переводим тот год, который только что закончился.
      const now = currentAcademicYear();
      const guess = known.includes(now) ? now : (known[0] || prevAcademicYear(now));
      setFromYear(guess);
      setToYear(nextAcademicYear(guess));
    })();
  }, []);

  const loadSource = useCallback(async () => {
    if (!fromYear) return;
    setLoading(true);
    try {
      const src = await api.getRolloverSource(fromYear);
      setSource(src);
      setPlan(buildRolloverPlan({ ...src, fromYear, toYear }));
      setStep(1);
    } catch (e) {
      message.error('Не удалось загрузить группы года');
    } finally {
      setLoading(false);
    }
  }, [fromYear, toYear, message]);

  // Точечная правка плана: строка группы.
  const patchGroup = (sourceId, patch) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const groups = prev.groups.map((g) => (g.sourceId === sourceId ? { ...g, ...patch } : g));
      let students = prev.students;
      // Группу перестали переводить — её ученикам перевод больше не подходит.
      if (patch.action && patch.action !== GROUP_ACTIONS.CONTINUE) {
        const fallback = patch.action === GROUP_ACTIONS.GRADUATE
          ? STUDENT_ACTIONS.GRADUATE : STUDENT_ACTIONS.STAY;
        students = students.map((s) => (
          s.sourceGroupId === sourceId && s.action === STUDENT_ACTIONS.TRANSFER
            ? { ...s, action: fallback, targetSourceId: null }
            : s
        ));
      }
      if (patch.action === GROUP_ACTIONS.CONTINUE) {
        students = students.map((s) => (
          s.sourceGroupId === sourceId && s.action !== STUDENT_ACTIONS.TRANSFER
            ? { ...s, action: STUDENT_ACTIONS.TRANSFER, targetSourceId: sourceId }
            : s
        ));
      }
      return { ...prev, groups, students };
    });
  };

  const patchStudent = (studentId, patch) => {
    setPlan((prev) => prev && ({
      ...prev,
      students: prev.students.map((s) => (s.studentId === studentId ? { ...s, ...patch } : s)),
    }));
  };

  const summary = useMemo(() => (plan ? summarizeRolloverPlan(plan) : null), [plan]);
  const problems = useMemo(() => (plan ? validateRolloverPlan(plan) : []), [plan]);
  const continuing = useMemo(
    () => (plan?.groups || []).filter((g) => g.action === GROUP_ACTIONS.CONTINUE),
    [plan],
  );
  const groupNameById = useMemo(
    () => Object.fromEntries((plan?.groups || []).map((g) => [g.sourceId, g.sourceName])),
    [plan],
  );

  const handleApply = async () => {
    if (!plan || problems.length) return;
    setApplying(true);
    setProgress({ done: 0, total: 0, label: '' });
    try {
      const res = await api.applyRolloverPlan(plan, setProgress);
      setResult(res);
      setStep(3);
      if (res.errors.length) message.warning(`Перевод завершён, но с ошибками: ${res.errors.length}`);
      else message.success('Перевод на новый учебный год выполнен');
    } catch (e) {
      message.error('Не удалось выполнить перевод');
    } finally {
      setApplying(false);
    }
  };

  const groupColumns = [
    {
      title: 'Группа', dataIndex: 'sourceName', key: 'name',
      render: (name, g) => (
        <Space>
          <Text strong>{name}</Text>
          {g.grade ? <Chip tone="neutral" dot={false}>{g.grade} кл.</Chip> : null}
          {g.kind === 'course' ? <Chip tone="violet" dot={false}>курс</Chip> : null}
          <Text type="secondary">{(source.rosters[g.sourceId] || []).length} чел.</Text>
        </Space>
      ),
    },
    {
      title: 'Что делаем', key: 'action', width: 280,
      render: (_, g) => (
        <Segmented
          size="small"
          value={g.action}
          options={GROUP_ACTION_OPTIONS}
          onChange={(action) => patchGroup(g.sourceId, {
            action,
            archiveSource: action !== GROUP_ACTIONS.SKIP,
            newName: action === GROUP_ACTIONS.CONTINUE ? (g.newName || g.sourceName) : '',
            newGrade: action === GROUP_ACTIONS.CONTINUE
              ? (g.newGrade ?? (g.grade ? g.grade + 1 : null)) : null,
          })}
        />
      ),
    },
    {
      title: 'Группа нового года', key: 'new', width: 300,
      render: (_, g) => (g.action === GROUP_ACTIONS.CONTINUE ? (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={g.newName}
            onChange={(e) => patchGroup(g.sourceId, { newName: e.target.value })}
            placeholder="Название"
          />
          <InputNumber
            min={1}
            max={11}
            value={g.newGrade}
            onChange={(v) => patchGroup(g.sourceId, { newGrade: v })}
            placeholder="кл."
            style={{ width: 90 }}
          />
        </Space.Compact>
      ) : <Text type="secondary">—</Text>),
    },
  ];

  const studentColumns = [
    {
      title: 'Ученик', dataIndex: 'name', key: 'name',
      render: (name, s) => (
        <Space>
          <Text>{name || '—'}</Text>
          {s.external ? <Chip tone="neutral" dot={false}>без аккаунта</Chip> : null}
        </Space>
      ),
    },
    {
      title: 'Откуда', dataIndex: 'sourceGroupId', key: 'from',
      width: 160,
      render: (id) => <Text type="secondary">{groupNameById[id] || '—'}</Text>,
    },
    {
      title: 'Что делаем', key: 'action', width: 330,
      render: (_, s) => (
        <Segmented
          size="small"
          value={s.action}
          options={STUDENT_ACTION_OPTIONS}
          onChange={(action) => patchStudent(s.studentId, {
            action,
            targetSourceId: action === STUDENT_ACTIONS.TRANSFER
              ? (s.targetSourceId || continuing[0]?.sourceId || null)
              : null,
          })}
        />
      ),
    },
    {
      title: 'Куда', key: 'target', width: 220,
      render: (_, s) => (s.action === STUDENT_ACTIONS.TRANSFER ? (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={s.targetSourceId}
          placeholder="Группа"
          status={s.targetSourceId ? '' : 'error'}
          onChange={(v) => patchStudent(s.studentId, { targetSourceId: v })}
          options={continuing.map((g) => ({ value: g.sourceId, label: g.newName || g.sourceName }))}
        />
      ) : <Text type="secondary">—</Text>),
    },
  ];

  return (
    <div>
      <WorkspacePageHeader
        icon={<CalendarOutlined />}
        accent="violet"
        title="Новый учебный год"
        subtitle="Перевод групп и учеников: кого повысить, кого выпустить, что убрать в архив"
        extra={<Button onClick={() => navigate('/app/groups')}>К группам</Button>}
      />

      <Steps
        current={step}
        style={{ marginBottom: 16 }}
        items={[
          { title: 'Год' },
          { title: 'Группы' },
          { title: 'Ученики' },
          { title: 'Готово' },
        ]}
      />

      {step === 0 && (
        <SectionCard icon={<CalendarOutlined />} title="Какой год переводим">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              message="Как это работает"
              description={(
                <>
                  Группы года-источника уходят в архив вместе со всей своей историей —
                  журналом, посещаемостью и составом. В новом году создаются группы-наследники,
                  ученики переезжают в них, выпускники получают статус «выпустился».
                  Результаты «Решу ЕГЭ» и каникулярные задания не затрагиваются.
                </>
              )}
            />
            <Space wrap align="end" size="large">
              <div>
                <div style={{ marginBottom: 4 }}><Text type="secondary">Учебный год</Text></div>
                <Select
                  style={{ width: 200 }}
                  value={fromYear}
                  onChange={(v) => { setFromYear(v); setToYear(nextAcademicYear(v)); }}
                  options={years.map((y) => ({ value: y, label: y }))}
                  placeholder="2025/2026"
                />
              </div>
              <ArrowRightOutlined style={{ marginBottom: 8, color: 'var(--ink-3)' }} />
              <div>
                <div style={{ marginBottom: 4 }}><Text type="secondary">Новый учебный год</Text></div>
                <Input
                  style={{ width: 200 }}
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  onBlur={(e) => setToYear(normalizeAcademicYear(e.target.value) || e.target.value)}
                  status={isValidAcademicYear(toYear) ? '' : 'warning'}
                  placeholder="2026/2027"
                />
              </div>
              <Button
                type="primary"
                loading={loading}
                disabled={!fromYear || !isValidAcademicYear(toYear)}
                onClick={loadSource}
              >
                Дальше
              </Button>
            </Space>
            {!years.length && (
              <Text type="secondary">
                У групп не заполнен учебный год — проставьте его в карточке группы,
                тогда перевод будет знать, что откуда переводить.
              </Text>
            )}
          </Space>
        </SectionCard>
      )}

      {step === 1 && plan && (
        <SectionCard
          icon={<TeamOutlined />}
          title={`Группы ${fromYear}`}
          meta={`${plan.groups.length} шт.`}
          extra={(
            <Space>
              <Button onClick={() => setStep(0)}>Назад</Button>
              <Button type="primary" onClick={() => setStep(2)} disabled={!plan.groups.length}>
                Дальше: ученики
              </Button>
            </Space>
          )}
        >
          {plan.groups.length ? (
            <Table
              size="small"
              rowKey="sourceId"
              pagination={false}
              dataSource={plan.groups}
              columns={groupColumns}
            />
          ) : (
            <EmptyState
              title={`В ${fromYear} нет активных групп`}
              description="Возможно, они уже в архиве — выберите другой год."
            />
          )}
        </SectionCard>
      )}

      {step === 2 && plan && (
        <SectionCard
          icon={<TeamOutlined />}
          title="Ученики"
          meta={`${plan.students.length} чел.`}
          extra={(
            <Space>
              <Button onClick={() => setStep(1)}>Назад</Button>
              <Button
                type="primary"
                loading={applying}
                disabled={!!problems.length || !plan.students.length}
                onClick={handleApply}
              >
                Выполнить перевод
              </Button>
            </Space>
          )}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {summary && (
              <Space wrap>
                <Tag color="blue">{`Новых групп: ${summary.groupsToCreate}`}</Tag>
                <Tag color="green">{`Переведём: ${summary.transferred}`}</Tag>
                <Tag color="gold">{`Выпустим: ${summary.graduated}`}</Tag>
                <Tag>{`Выбыло: ${summary.left}`}</Tag>
                <Tag>{`Оставим как есть: ${summary.stayed}`}</Tag>
                <Tag color="default">{`В архив групп: ${summary.groupsToArchive}`}</Tag>
              </Space>
            )}
            {problems.length > 0 && (
              <Alert
                type="warning"
                message="Нужно поправить перед переводом"
                description={<ul style={{ margin: 0, paddingLeft: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
              />
            )}
            {applying && progress.total > 0 && (
              <Progress
                percent={Math.round((progress.done / progress.total) * 100)}
                status="active"
                format={() => `${progress.done} / ${progress.total}`}
              />
            )}
            <Table
              size="small"
              rowKey="studentId"
              pagination={false}
              dataSource={plan.students}
              columns={studentColumns}
            />
          </Space>
        </SectionCard>
      )}

      {step === 3 && result && (
        <Result
          status={result.errors.length ? 'warning' : 'success'}
          title={`Учебный год ${plan?.toYear} начат`}
          subTitle={`Создано групп: ${result.createdGroups.length} · переведено: ${result.transferred}`
            + ` · выпущено: ${result.graduated} · выбыло: ${result.left}`
            + ` · в архив: ${result.archived}`}
          extra={[
            <Button type="primary" key="groups" onClick={() => navigate('/app/groups')}>
              К группам
            </Button>,
            <Button key="again" onClick={() => { setStep(0); setResult(null); setPlan(null); }}>
              Перевести ещё год
            </Button>,
          ]}
        >
          {result.errors.length > 0 && (
            <Alert
              type="warning"
              message="Часть операций не выполнена"
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            />
          )}
        </Result>
      )}

      {loading && step === 0 && <Spin style={{ marginTop: 16 }} />}
    </div>
  );
}
