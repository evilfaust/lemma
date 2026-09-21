import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin, Tag } from 'antd';
import {
  CalendarOutlined, CheckCircleFilled, ClockCircleOutlined, FileTextOutlined,
  LinkOutlined, PlayCircleOutlined, RedoOutlined, StarOutlined,
} from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { summerWeeks } from '../../shared/utils/summerWeeks';
import { sessionFacts } from '../workspace/summer/campaignProgress';
import MathRenderer from '../MathRenderer';

const BLOCK_LABEL = { algebra: 'Алгебра', geometry: 'Геометрия', custom: 'Работа', oral: 'Устный счёт', extra: 'Тригонометрия' };

// «Моя летняя программа» в кабинете ученика: блоки по неделям + «каждую неделю».
// Чтение своей программы открыто правилами (миграция 1779000021).
export default function StudentSummerProgram({ student }) {
  const [items, setItems] = useState([]);
  const [program, setProgram] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [factLoading, setFactLoading] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const prog = await api.getStudyProgramForStudent(student.id, { season: 'summer', year });
        if (cancelled) return;
        setProgram(prog);
        if (prog) {
          setItems(await api.getProgramItems(prog.id));
          // Общее задание класса — из кампании, к которой привязана программа.
          if (prog.campaign) {
            const camp = await api.getCampaign(prog.campaign).catch(() => null);
            if (!cancelled) setCampaign(camp);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id, year]);

  const campaignBlocks = useMemo(() => campaign?.template_config?.blocks || [], [campaign]);

  // Что уже сделано: попытки по выдачам плана. Берём ПО СЕССИЯМ (как у учителя) —
  // иначе теряются работы, решённые по ссылке без входа в аккаунт.
  const sessionKey = useMemo(() => {
    const ids = [
      ...items.map((i) => i.session),
      ...campaignBlocks.map((b) => b.session_id),
    ].filter(Boolean);
    return [...new Set(ids)].sort().join(',');
  }, [items, campaignBlocks]);

  useEffect(() => {
    if (!sessionKey) { setAttempts([]); return undefined; }
    let cancelled = false;
    setFactLoading(true);
    api.getAttemptsBySessions(sessionKey.split(','), {
      fields: 'id,session,status,score,total,submitted_at,created,student',
    })
      .then((atts) => { if (!cancelled) setAttempts(atts || []); })
      .catch(() => { if (!cancelled) setAttempts([]); })
      .finally(() => { if (!cancelled) setFactLoading(false); });
    return () => { cancelled = true; };
  }, [sessionKey]);

  // Персональные выдачи: сессия принадлежит только этому ученику.
  const factBySession = useMemo(() => sessionFacts(attempts), [attempts]);
  // Общее задание класса: сессия одна на всех, поэтому берём только свои попытки.
  const blockFacts = useMemo(
    () => sessionFacts(attempts.filter((a) => a.student === student.id)),
    [attempts, student.id],
  );

  // Календарные недели + распределение. Счётные навыки (week==null) показываем
  // в КАЖДОЙ неделе (делать дозированно, каждую неделю).
  const { calWeeks, byWeek, weekly } = useMemo(() => {
    const cal = summerWeeks(program?.config?.startDate, program?.config?.endDate);
    const map = new Map();
    const every = [];
    for (const it of items) {
      const w = it.params?.week;
      if (w == null) { every.push(it); continue; }
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(it);
    }
    // Если дат нет — соберём недели из самих элементов.
    const weeksList = cal.length
      ? cal
      : [...map.keys()].sort((a, b) => a - b).map((w) => ({ week: w, label: null }));
    return { calWeeks: weeksList, byWeek: map, weekly: every };
  }, [items, program]);

  // Сводка «сдано N из M»: считаем только то, что оставляет факт — выдачи.
  // Задания «каждую неделю» — одна выдача, в знаменателе один раз.
  const totals = useMemo(() => {
    const own = items.filter((it) => it.session);
    const shared = campaignBlocks.filter((b) => b.session_id);
    const done = own.filter((it) => factBySession.get(it.session)?.done).length
      + shared.filter((b) => blockFacts.get(b.session_id)?.done).length;
    return { total: own.length + shared.length, done };
  }, [items, campaignBlocks, factBySession, blockFacts]);

  const weekFiles = program?.config?.weekFiles || {};
  const extra = program?.config?.extra || null;
  const hasExtra = extra && (extra.text?.trim() || (extra.files || []).length || (extra.links || []).length);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  if (!program || (!items.length && !hasExtra && !campaignBlocks.length)) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Каникулярного задания пока нет. Загляни позже — учитель его соберёт." />
      </div>
    );
  }

  return (
    <div className="student-summer">
      <h2 className="student-summer-title"><CalendarOutlined /> Каникулярное задание</h2>
      <p className="student-summer-hint">
        Здесь весь план на каникулы. Выполняй по неделям — не сразу всё, а порцию каждую неделю.
      </p>

      {totals.total > 0 && (
        <div className="student-summer-progress">
          <div className="student-summer-progress-head">
            <span>Сделано работ</span>
            <b>{totals.done} из {totals.total}</b>
          </div>
          <div className="student-summer-progress-bar">
            <div
              className="student-summer-progress-fill"
              style={{ width: `${Math.round((totals.done / totals.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {campaignBlocks.map((b) => (
        <div key={b.id} className="student-summer-group student-summer-group--campaign">
          <div className="student-summer-group-head">📋 {b.title || 'Общее задание класса'}</div>
          {b.description?.trim() && (
            <div className="student-summer-item student-summer-extra-text">
              <MathRenderer text={b.description} inline={false} />
            </div>
          )}
          {b.session_id && (
            <SessionItem
              sessionId={b.session_id}
              fact={blockFacts.get(b.session_id)}
              loading={factLoading}
              tag={<Tag color="geekblue">Работа</Tag>}
              title={b.work_title || 'Работа'}
            />
          )}
          {b.url && (
            <div className="student-summer-item">
              <div className="student-summer-item-main">
                <span className="student-summer-item-title">{b.url_label || b.url}</span>
              </div>
              <div className="student-summer-item-actions">
                <Button icon={<LinkOutlined />} href={b.url} target="_blank">Открыть</Button>
              </div>
            </div>
          )}
          {(b.files || []).map((f) => <FileItem key={f.id} file={f} />)}
        </div>
      ))}

      {calWeeks.map((w) => {
        const examItems = byWeek.get(w.week) || [];
        const files = weekFiles[w.week] || [];
        const weekWorks = [...examItems, ...weekly].filter((it) => it.session);
        const weekDone = weekWorks.filter((it) => factBySession.get(it.session)?.done).length;
        return (
          <div key={w.week} className="student-summer-group">
            <div className="student-summer-group-head">
              <span>
                Неделя {w.week}{w.label ? <span className="student-summer-week-dates"> · {w.label}</span> : ''}
              </span>
              {weekWorks.length > 0 && (
                <span className={`student-summer-week-count${weekDone === weekWorks.length ? ' student-summer-week-count--done' : ''}`}>
                  {weekDone === weekWorks.length ? '✓ всё сделано' : `${weekDone} из ${weekWorks.length}`}
                </span>
              )}
            </div>
            {examItems.map((it) => (
              <ProgramItem key={it.id} item={it} fact={factBySession.get(it.session)} loading={factLoading} />
            ))}
            {weekly.map((it) => (
              <ProgramItem key={`${w.week}-${it.id}`} item={it} weekly fact={factBySession.get(it.session)} loading={factLoading} />
            ))}
            {files.map((f) => <FileItem key={f.id} file={f} />)}
            {!examItems.length && !weekly.length && !files.length && (
              <div className="student-summer-item"><span style={{ color: '#999' }}>На эту неделю заданий нет</span></div>
            )}
          </div>
        );
      })}

      {hasExtra && (
        <div className="student-summer-group student-summer-group--extra">
          <div className="student-summer-group-head"><StarOutlined /> Дополнительное задание</div>
          {extra.text?.trim() && (
            <div className="student-summer-item student-summer-extra-text">
              <MathRenderer text={extra.text} inline={false} />
            </div>
          )}
          {(extra.files || []).map((f) => <FileItem key={f.id} file={f} />)}
          {(extra.links || []).map((l, i) => (
            <div key={i} className="student-summer-item">
              <div className="student-summer-item-main">
                <span className="student-summer-item-title">{l.label || l.url}</span>
              </div>
              <div className="student-summer-item-actions">
                <Button icon={<LinkOutlined />} href={l.url} target="_blank">Открыть</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Метка «сделано / начато / ещё не начато» у работы. Балл ученик и так видит
// сразу после сдачи — решения и верных ответов здесь по-прежнему нет.
function StatusChip({ fact, loading }) {
  if (loading && !fact) return <span className="student-summer-status student-summer-status--wait">…</span>;
  if (!fact) {
    return <span className="student-summer-status student-summer-status--none">ещё не начато</span>;
  }
  if (!fact.done) {
    return (
      <span className="student-summer-status student-summer-status--progress">
        <ClockCircleOutlined /> начато
      </span>
    );
  }
  return (
    <span className="student-summer-status student-summer-status--done">
      <CheckCircleFilled /> сделано{fact.total ? ` · ${fact.score}/${fact.total}` : ''}
    </span>
  );
}

// Кнопка входа в работу: подпись зависит от того, что уже сделано.
function SolveButton({ sessionId, fact }) {
  if (fact?.done) {
    return <Button icon={<RedoOutlined />} href={`/student/${sessionId}`}>Ещё раз</Button>;
  }
  return (
    <Button type="primary" icon={<PlayCircleOutlined />} href={`/student/${sessionId}`}>
      {fact ? 'Продолжить' : 'Решать'}
    </Button>
  );
}

// Строка с выдачей (общее задание класса): статус + кнопка.
function SessionItem({ sessionId, fact, loading, tag, title }) {
  return (
    <div className={`student-summer-item${fact?.done ? ' student-summer-item--done' : ''}`}>
      <div className="student-summer-item-main">
        {tag}
        <span className="student-summer-item-title">{title}</span>
        <StatusChip fact={fact} loading={loading} />
      </div>
      <div className="student-summer-item-actions">
        <SolveButton sessionId={sessionId} fact={fact} />
      </div>
    </div>
  );
}

// Прикреплённый файл (к неделе или доп. заданию) с опциональным пояснением.
function FileItem({ file }) {
  return (
    <div className="student-summer-item">
      <div className="student-summer-item-main">
        <Tag color="blue"><FileTextOutlined /> файл</Tag>
        <span className="student-summer-item-title">
          {file.title || 'файл'}
          {file.note && <span className="student-summer-file-note"> — {file.note}</span>}
        </span>
      </div>
      <div className="student-summer-item-actions">
        <Button icon={<FileTextOutlined />} href={file.url} target="_blank">Открыть</Button>
      </div>
    </div>
  );
}

function ProgramItem({ item, weekly, fact, loading }) {
  const atts = item.params?.attachments || [];
  return (
    <div className={`student-summer-item${item.session && fact?.done ? ' student-summer-item--done' : ''}`}>
      <div className="student-summer-item-main">
        <Tag color={weekly ? 'purple' : undefined}>{BLOCK_LABEL[item.block_type] || item.block_type}</Tag>
        <span className="student-summer-item-title">{item.title}</span>
        {weekly && <Tag color="purple" style={{ marginLeft: 4 }}>каждую неделю</Tag>}
        {item.session && <StatusChip fact={fact} loading={loading} />}
      </div>
      <div className="student-summer-item-actions">
        {item.session && <SolveButton sessionId={item.session} fact={fact} />}
        {atts.map((a) => (
          <Button key={a.id} icon={<FileTextOutlined />} href={a.url} target="_blank">
            {a.title || 'файл'}
          </Button>
        ))}
      </div>
    </div>
  );
}
