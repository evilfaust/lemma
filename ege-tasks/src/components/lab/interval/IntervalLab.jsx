import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Checkbox, Drawer, Empty, Input, InputNumber, Select, Space, Spin, Switch, Table, Tag } from 'antd';
import { ExperimentOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { generateIntervalExperiment } from '../../../utils/lab/intervalExperiment';
import { INTERVAL_SKILLS, INTERVAL_STEPS, intervalExperimentPath, intervalStepAnswerText } from '../../../utils/lab/intervalContract';
import MathRenderer from '../../MathRenderer';
import './intervalLab.css';

function Creation({ onCreated, onCancel }) {
  const [title, setTitle] = useState('Метод интервалов · эксперимент');
  const [groups, setGroups] = useState([]), [group, setGroup] = useState(null);
  const [roster, setRoster] = useState(null), [rosterError, setRosterError] = useState('');
  const [count, setCount] = useState(8), [skills, setSkills] = useState(INTERVAL_SKILLS.map(s => s.key));
  const [hints, setHints] = useState(true), [tasks, setTasks] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.getTeachingGroups().then(rows => { if (alive) setGroups(rows.filter(g => g.kind !== 'course')); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    setRoster(null); setRosterError('');
    if (group) api.getStudentsByGroup(group).then(rows => { if (alive) setRoster(rows); }).catch(() => { if (alive) setRosterError('Не удалось загрузить состав. Выбери группу заново'); });
    return () => { alive = false; };
  }, [group]);
  const preview = () => {
    try { setTasks(generateIntervalExperiment({ count, skills })); setError(''); }
    catch (e) { setError(e.message); }
  };
  const create = async () => {
    if (!group || !roster?.length || !tasks || !title.trim()) return;
    setBusy(true); setError('');
    try {
      const created = await api.createLabIntervalWork({ title, group, participants: roster.map(s => s.id), tasks, hints });
      onCreated(created.id);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <>
    <p>Отдельная пошаговая работа. Она появится только у указанного состава группы и не повлияет на обычные тесты или журнал.</p>
    {error && <Alert type="error" message={error} showIcon />}
    <div className="li-form">
      <label>Название<Input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
      <label>Тестовая группа<Select aria-label="Тестовая группа" placeholder="Выбери группу" value={group} onChange={setGroup} options={groups.map(g => ({ value: g.id, label: g.name }))} /></label>
      {group && <div aria-live="polite">{rosterError || (roster ? `Будет назначено: ${roster.length} ученикам` : 'Загружаем состав…')}</div>}
      {roster?.length > 0 && <details><summary>Кому будет назначена работа</summary><p>{roster.map(s => s.name).join(', ')}</p></details>}
      <label>Количество заданий<InputNumber aria-label="Количество заданий" min={3} max={20} value={count} onChange={v => { setCount(v); setTasks(null); }} /></label>
      <div><p>Типы заданий</p><Checkbox.Group value={skills} onChange={v => { setSkills(v); setTasks(null); }} options={INTERVAL_SKILLS.map(s => ({ value: s.key, label: s.label }))} /></div>
      <Space><Switch checked={hints} onChange={setHints} aria-label="Подсказки и разбор шага" />Подсказки и разбор шага</Space>
    </div>
    <div className="li-actions"><Button onClick={preview} disabled={!skills.length || !count}>{tasks ? 'Сгенерировать заново' : 'Предпросмотр заданий'}</Button></div>
    {tasks && <div className="li-panel" style={{ marginTop: 20 }}>
      <h2>Будущая работа</h2><p className="li-muted">Это точный набор заданий, который получит группа. Ответы видит только учитель.</p>
      {tasks.map((task, i) => <details key={task.key} className="li-task-details"><summary>Задание {i + 1} · {INTERVAL_SKILLS.find(s => s.key === task.skill)?.label}</summary>
        <MathRenderer text={`$$${task.expression}$$`} /><MathRenderer text={`Ответ: $${task.answerLatex}$`} />
      </details>)}
    </div>}
    <div className="li-actions">
      <Button type="primary" loading={busy} disabled={!tasks || !title.trim() || !group || !roster?.length || !!rosterError} onClick={create}>Назначить группе</Button>
      <Button disabled={busy} onClick={onCancel}>Отмена</Button>
    </div>
  </>;
}

function Results({ id, onChanged }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { setData(await api.getLabIntervalResults(id)); }
    catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const toggle = async () => {
    setBusy(true);
    try { await api.setLabIntervalOpen(id, !data.work.isOpen); await load(); onChanged(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const { canEdit } = useAuth();
  if (!data) return error ? <Alert type="error" message={error} action={<Button onClick={load}>Повторить</Button>} /> : <Spin />;
  const attempts = new Map(data.attempts.map(a => [a.student, a]));
  const rows = data.work.roster.map(s => ({ ...s, attempt: attempts.get(s.id) }));
  const selectedAttempt = data.attempts.find(a => a.student === selected);
  const aggregates = INTERVAL_STEPS.map(s => ({ ...s, errors: data.attempts.reduce((sum, a) => sum + (a.summary.steps[s.key]?.errors || 0), 0), hints: data.attempts.reduce((sum, a) => sum + (a.summary.steps[s.key]?.hints || 0), 0), shown: data.attempts.reduce((sum, a) => sum + (a.summary.steps[s.key]?.shown || 0), 0) }));
  const link = `${window.location.protocol}//${window.location.hostname === 'localhost' ? window.location.host : 'student.oipav.ru'}${intervalExperimentPath(id)}`;
  return <>
    {error && <Alert type="error" message={error} showIcon />}
    <div className="li-header"><Tag color={data.work.isOpen ? 'green' : 'default'}>{data.work.isOpen ? 'Доступна ученикам' : 'Закрыта'}</Tag>
      <Space><Button onClick={load} icon={<ReloadOutlined aria-hidden />}>Обновить</Button>{canEdit && <Button loading={busy} onClick={toggle}>{data.work.isOpen ? 'Закрыть тренировку' : 'Открыть тренировку'}</Button>}</Space>
    </div>
    <label>Ссылка для назначенных учеников<Input readOnly value={link} aria-label="Ссылка на тренировку" onFocus={e => e.target.select()} /></label>
    <p className="li-muted">Состав зафиксирован при назначении. Чтобы изменить задания или участников, создай новую работу.</p>
    <Table size="small" rowKey="id" pagination={false} scroll={{ x: true }} dataSource={rows} columns={[
      { title: 'Ученик', dataIndex: 'name' },
      { title: 'Статус', render: (_, r) => !r.attempt ? 'Не приступал' : r.attempt.status === 'completed' ? 'Завершил' : `В работе · ${r.attempt.state.taskIndex}/${data.work.count}` },
      { title: 'Самостоятельно', render: (_, r) => r.attempt?.summary.independent ?? '—' },
      { title: 'После исправлений', render: (_, r) => r.attempt?.summary.corrected ?? '—' },
      { title: 'С помощью', render: (_, r) => r.attempt?.summary.helped ?? '—' },
      { title: 'Пропуски', render: (_, r) => r.attempt?.summary.skipped ?? '—' },
      { title: '', render: (_, r) => r.attempt && <Button size="small" onClick={() => setSelected(r.id)}>Шаги</Button> },
    ]} />
    <h2 style={{ marginTop: 24 }}>Затруднения группы</h2>
    <div className="li-table-scroll"><table className="li-report"><thead><tr><th>Шаг</th><th>Ошибочные проверки</th><th>Подсказки</th><th>Показы шага</th></tr></thead><tbody>{aggregates.map(s => <tr key={s.key}><td>{s.label}</td><td>{s.errors}</td><td>{s.hints}</td><td>{s.shown}</td></tr>)}</tbody></table></div>
    {selectedAttempt && <section className="li-panel" style={{ marginTop: 24 }}>
      <h2>{rows.find(r => r.id === selected)?.name}: история шагов</h2>
      {data.work.tasks.map((t, i) => <details key={t.key} className="li-task-details"><summary>Задание {i + 1}</summary>
        <MathRenderer text={`$$${t.expression}$$\n\nОтвет: $${t.answerLatex}$`} />
        {INTERVAL_STEPS.map(s => {
          const a = selectedAttempt.state.answers[`${t.key}.${s.key}`];
          return <div key={s.key}><b>{s.label}</b>: {a ? `${a.skipped ? 'пропущено' : a.revealed ? 'показан образец' : a.correct ? 'верно' : 'не завершено'} · проверок ${a.checks || 0} · ошибок ${a.errors || 0}${a.hinted ? ' · подсказка' : ''}` : 'не приступал'}
            {a?.value !== undefined && <pre>Последний ответ: {intervalStepAnswerText(t, s.key, a.value)}</pre>}
            {a?.history?.length > 0 && <details><summary>Последние проверки (до 10)</summary>{a.history.map((h, idx) => <pre key={idx}>{new Date(h.at).toLocaleString('ru-RU')} · {h.correct ? 'верно' : 'ошибка'}: {intervalStepAnswerText(t, s.key, h.value)}</pre>)}</details>}
          </div>;
        })}
      </details>)}
    </section>}
  </>;
}

export default function IntervalLab() {
  const { canEdit } = useAuth();
  const { message } = App.useApp();
  const [works, setWorks] = useState(null), [error, setError] = useState('');
  const [creating, setCreating] = useState(false), [resultId, setResultId] = useState(null);
  const load = useCallback(async () => {
    setError('');
    try { setWorks((await api.getLabIntervalWorks()).works); }
    catch (e) { setError(e.status === 404 ? 'Эксперимент ещё не включён на сервере. Работа станет доступна после обновления платформы.' : e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <main className="li-page">
    <div className="li-header"><div><Tag color="purple"><ExperimentOutlined /> Эксперимент</Tag><h1>Метод интервалов</h1><span className="li-muted">Пошаговые работы для тестовой группы</span></div>
      {canEdit && <Button type="primary" icon={<PlusOutlined aria-hidden />} onClick={() => setCreating(true)}>Создать работу</Button>}
    </div>
    <p>Семь шагов решения, подсказки по правилам и отдельный отчёт о затруднениях. Задания и результаты хранятся только в лаборатории.</p>
    {error && <Alert type="error" message={error} showIcon action={<Button onClick={load}>Повторить</Button>} />}
    {!works && !error && <Spin />}
    {works?.length === 0 && <Empty description="Экспериментальных работ пока нет" />}
    {!!works?.length && <Table rowKey="id" dataSource={works} pagination={{ pageSize: 10 }} scroll={{ x: true }} columns={[
      { title: 'Работа', dataIndex: 'title' }, { title: 'Группа', dataIndex: 'groupName' },
      { title: 'Учеников', dataIndex: 'participants' }, { title: 'Заданий', dataIndex: 'count' },
      { title: 'Доступ', render: (_, r) => r.isOpen ? <Tag color="green">Открыта</Tag> : <Tag>Закрыта</Tag> },
      { title: '', render: (_, r) => <Button onClick={() => setResultId(r.id)}>Результаты и ссылка</Button> },
    ]} />}
    <Drawer title="Новая экспериментальная работа" open={creating} width={760} onClose={() => setCreating(false)} destroyOnClose>
      <Creation onCancel={() => setCreating(false)} onCreated={id => { setCreating(false); setResultId(id); load(); message.success('Тренировка назначена выбранному составу группы'); }} />
    </Drawer>
    <Drawer title={works?.find(w => w.id === resultId)?.title || 'Результаты эксперимента'} open={!!resultId} width={1000} onClose={() => setResultId(null)} destroyOnClose>
      {resultId && <Results key={resultId} id={resultId} onChanged={load} />}
    </Drawer>
  </main>;
}
