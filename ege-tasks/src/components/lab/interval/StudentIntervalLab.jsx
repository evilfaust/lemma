import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Progress, Spin, Tag } from 'antd';
import { api } from '../../../shared/services/pocketbase';
import { INTERVAL_STEPS, emptyIntervalInput } from '../../../utils/lab/intervalContract';
import { CabinetLink } from '../../../student/pwa/InstallApp';
import { useBlockAppReload } from '../../../student/pwa/useAppUpdate';
import MathRenderer from '../../MathRenderer';
import IntervalBoard from './IntervalBoard';
import './intervalLab.css';

function StepInput({ current, attempt, saving, onAction, closed }) {
  const state = attempt.state, step = INTERVAL_STEPS[state.stepIndex];
  const row = state.answers[`${current.key}.${step.key}`];
  const revealed = row?.revealed && !row.correct;
  const input = useRef(null);
  const draftKey = `lemma.lab.interval.${attempt.id}.${current.key}.${step.key}`;
  const [value, setValue] = useState(() => {
    if (revealed) return row.value;
    const points = state.answers[`${current.key}.points`]?.value;
    const adapt = (saved) => {
      if (step.key === 'answer') return { gaps: saved.gaps, points: points ?? saved.points };
      if (step.key === 'changes') return saved.map(mark => mark !== false);
      return saved;
    };
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      // Подсказка меняет revision, но не должна стирать набранный ответ.
      if (draft && (draft.revision === state.revision || draft.checks === (row?.checks || 0))) return adapt(draft.value);
    } catch { /* Приватный режим: остаётся сохранённый на сервере ответ. */ }
    return row?.value != null ? adapt(row.value) : emptyIntervalInput(step.key, current.rootCount, points);
  });
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ revision: state.revision, checks: row?.checks || 0, value })); }
    catch { /* Шаги по-прежнему сохраняются на сервере после проверки. */ }
  }, [draftKey, state.revision, row?.checks, value]);
  const disabled = saving || closed || revealed;
  const instructions = {
    roots: 'Найди нули числителя и знаменателя. Запиши каждую точку один раз через точку с запятой в любом порядке.',
    order: 'Нажимай на найденные числа от меньшего к большему. Нажми на число под прямой, чтобы убрать его.',
    changes: 'Поставь ! над каждой точкой чётной кратности. Если таких точек нет, оставь отметки пустыми.',
    points: 'Отметь каждую точку. ● входит в ответ, ○ выколота.',
    signs: 'Выбери + или − на каждом промежутке.',
    answer: 'Заштрихуй промежутки, на которых выполняется неравенство. Закрашенные точки уже включены.',
    notation: 'Запиши ответ промежутками. Для отдельной точки используй фигурные скобки.',
  };
  const insert = (symbol) => {
    const field = input.current?.input;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? start;
    setValue(value.slice(0, start) + symbol + value.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  };
  return <>
    <ol className="li-steps" aria-label="Шаги решения">
      {INTERVAL_STEPS.map((s, i) => {
        const done = state.answers[`${current.key}.${s.key}`]?.correct;
        return <li key={s.key} className={done ? 'li-step-done' : ''} aria-current={i === state.stepIndex ? 'step' : undefined}>{done ? '✓ ' : `${i + 1}. `}{s.label}</li>;
      })}
    </ol>
    <h2>{step.label}</h2>
    <p>{instructions[step.key]}</p>
    <IntervalBoard current={current} step={step.key} value={value} answers={state.answers} onChange={setValue} disabled={disabled} />
    {(step.key === 'roots' || step.key === 'notation') && (
      revealed && step.key === 'notation' ? <MathRenderer text={`$$${row.value}$$`} /> :
      <Input ref={input} aria-label={step.key === 'roots' ? 'Критические точки' : 'Ответ промежутками'} value={value}
        maxLength={300} disabled={disabled} placeholder={step.key === 'roots' ? 'Например: 5; −3; 0' : 'Например: (−∞; 2] ∪ {5}'}
        onChange={e => setValue(e.target.value)} onPressEnter={() => { if (!disabled) onAction('check', value); }} />
    )}
    {step.key === 'notation' && !revealed && <div className="li-choices" aria-label="Символы для записи ответа">
      {['(', ')', '[', ']', '{', '}', '∞', '∪', '∅', 'ℝ'].map(symbol => <button type="button" key={symbol} disabled={disabled} onClick={() => insert(symbol)}>{symbol}</button>)}
    </div>}
    {revealed && <p className="li-answer" role="note">Разбери показанный шаг. {step.hint}</p>}
    {!revealed && row?.checks > 0 && !row.correct && <p className="li-feedback is-error" role="status">{row.feedback || 'Проверь этот шаг и попробуй ещё раз.'}</p>}
    {!revealed && row?.hinted && <p className="li-answer" role="note">Подсказка: {step.hint}</p>}
    <div className="li-actions">
      <Button type="primary" loading={saving} disabled={closed} onClick={() => onAction(revealed ? 'continue' : 'check', revealed ? undefined : value)}>{revealed ? 'Дальше' : 'Проверить шаг'}</Button>
      {!revealed && attempt.hintsAllowed && !row?.hinted && <Button disabled={disabled} onClick={() => onAction('hint')}>Подсказка</Button>}
      {!revealed && attempt.hintsAllowed && row?.errors >= 3 && <Button disabled={disabled} onClick={() => onAction('reveal')}>Показать этот шаг</Button>}
    </div>
    <details style={{ marginTop: 24 }}><summary>Не получается решить задание?</summary><p>Можно пропустить задание. Учитель увидит, на каком шаге ты остановился.</p><Button disabled={saving || closed} onClick={() => onAction('skip')}>Пропустить задание</Button></details>
  </>;
}

export default function StudentIntervalLab({ id }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const inFlight = useRef(false);
  useBlockAppReload(data?.attempt?.status === 'started');
  const load = useCallback(async () => {
    setError(''); setFeedback('');
    try { setData(await api.getLabInterval(id)); }
    catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (kind, value) => {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(''); setFeedback('');
    try {
      const next = kind === 'start' ? await api.startLabInterval(id) : await api.actLabInterval(id, { kind, value, revision: data.attempt.state.revision, version: 2 });
      if (data?.attempt && (next.attempt.state.taskIndex !== data.attempt.state.taskIndex || next.attempt.state.stepIndex !== data.attempt.state.stepIndex)) {
        try { localStorage.removeItem(`lemma.lab.interval.${data.attempt.id}.${data.current.key}.${INTERVAL_STEPS[data.attempt.state.stepIndex].key}`); } catch { /* Не мешает серверному сохранению. */ }
        if (kind === 'check') setFeedback('Шаг принят и сохранён.');
      }
      setData(next);
    } catch (e) { setError(e.message); }
    finally { inFlight.current = false; setSaving(false); }
  };
  const attempt = data?.attempt, current = data?.current;
  return <main className="li-page">
    <CabinetLink />
    <div className="li-header"><div><Tag color="purple">Лаборатория · эксперимент</Tag><h1>{data?.work.title || 'Метод интервалов'}</h1></div>{data && <span className="li-muted">{data.work.count} заданий</span>}</div>
    {error && <Alert style={{ marginBottom: 20 }} type="error" showIcon message={error} description="Набранный ответ остаётся на этом устройстве. Если запрос успел сохраниться, повторная загрузка покажет актуальный шаг." action={<Button disabled={saving} onClick={load}>Загрузить сохранённое</Button>} />}
    {!data && !error && <Spin />}
    {data && !data.work.isOpen && <Alert type="info" message="Учитель закрыл тренировку. Отправка шагов приостановлена." style={{ marginBottom: 20 }} />}
    {data && !attempt && <section className="li-panel">
      <h2>Решаем по шагам</h2><p>Найди и расставь корни, отметь кратности и границы, поставь знаки, заштрихуй решение и запиши ответ. Здесь можно исправлять ошибки.</p>
      <p>Проверенные шаги сохраняются в аккаунте. Учитель увидит ошибки, подсказки и пропущенные задания. Полное решение можно разобрать с учителем.</p>
      <Button type="primary" disabled={!data.work.isOpen} loading={saving} onClick={() => act('start')}>Начать тренировку</Button>
    </section>}
    {attempt?.status === 'completed' && <section className="li-panel">
      <h2>Тренировка завершена</h2><p>Результаты сохранены и доступны учителю.</p>
      <p>Самостоятельно с первой проверки: <b>{attempt.summary.independent}</b> из {attempt.summary.total}.</p>
      <p>После исправлений: {attempt.summary.corrected}. С помощью: {attempt.summary.helped}. Пропущено: {attempt.summary.skipped}.</p>
    </section>}
    {attempt?.status === 'started' && attempt.state.version !== 2 && <Alert type="info" message="Обновлённый тренажёр подключается. Обнови страницу позже." />}
    {attempt?.status === 'started' && attempt.state.version === 2 && current && <section className="li-panel">
      <div className="li-header"><b>Задание {attempt.state.taskIndex + 1} из {data.work.count}</b><span className="li-muted">Проверенные шаги сохранены</span></div>
      <Progress percent={Math.round((attempt.state.taskIndex * INTERVAL_STEPS.length + attempt.state.stepIndex) / (data.work.count * INTERVAL_STEPS.length) * 100)} size="small" />
      <div className="li-expression"><MathRenderer text={`$$${current.expression}$$`} /></div>
      {feedback && <p className="li-feedback" role="status">{feedback}</p>}
      <StepInput key={`${attempt.id}:${attempt.state.revision}`} current={current} attempt={{ ...attempt, hintsAllowed: data.hintsAllowed }} saving={saving} closed={!data.work.isOpen || !!error} onAction={act} />
    </section>}
  </main>;
}
