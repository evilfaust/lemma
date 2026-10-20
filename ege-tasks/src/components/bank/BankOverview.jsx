import { useEffect, useMemo, useState } from 'react';
import { Segmented, Spin, Tooltip, Alert } from 'antd';
import {
  DatabaseOutlined, CheckCircleOutlined, ReadOutlined, SolutionOutlined,
  AimOutlined, WarningOutlined, LineChartOutlined, PieChartOutlined,
  FileTextOutlined, FunctionOutlined, QuestionCircleOutlined, TagsOutlined,
  FolderOpenOutlined, CopyOutlined, NodeIndexOutlined, RightOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useTaskStats } from '../../hooks/useTaskStats';
import { useVectorIndexStats } from '../../hooks/useVectorIndexStats';
import { SectionCard, EmptyState } from '../workspace/ui';
import {
  EXAM_SCOPES, UNSET_DIFFICULTY, MIN_SOLVE_N,
  countByTopic, usageStats, examCoverage, coverageSummary, examMix,
  hardestTasks, difficultyRows, yearRows, share,
} from '../../utils/taskBank';

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

// Признаки задач и состав работ меняются редко, а экран открывают часто —
// держим их пять минут (кнопка «Обновить» сбрасывает).
const TTL_MS = 5 * 60 * 1000;
let bankCache = null;
let bankInflight = null;

export function invalidateBankData() {
  bankCache = null;
  bankInflight = null;
}

function loadBankData() {
  if (bankCache && Date.now() - bankCache.at < TTL_MS) return Promise.resolve(bankCache);
  if (!bankInflight) {
    bankInflight = Promise.all([api.getTaskBankFlags(), api.getAllVariantTasks()])
      .then(([flags, variants]) => {
        bankCache = { at: Date.now(), flags, variants };
        return bankCache;
      })
      .finally(() => { bankInflight = null; });
  }
  return bankInflight;
}

function useBankData() {
  const [state, setState] = useState(() => ({ data: bankCache, error: null }));
  useEffect(() => {
    let alive = true;
    loadBankData()
      .then((data) => { if (alive) setState({ data, error: null }); })
      .catch((error) => { if (alive) setState({ data: null, error }); });
    return () => { alive = false; };
  }, []);
  return state;
}

const DIFFICULTY = {
  '0': { label: 'Вне шкалы (0)', color: 'var(--ink-4)' },
  '1': { label: 'Базовый', color: 'var(--c-teal)' },
  '2': { label: 'Средний', color: 'var(--c-amber)' },
  '3': { label: 'Повышенный', color: 'var(--c-rose)' },
  '4': { label: 'Высокий', color: 'var(--c-violet)' },
  '5': { label: 'Олимпиадный', color: 'var(--c-indigo)' },
  [UNSET_DIFFICULTY]: { label: 'Не указана', color: 'var(--rule)' },
};

const MIX_COLOR = {
  ege_base: 'var(--c-blue)',
  ege_profile: 'var(--c-violet)',
  oge: 'var(--c-teal)',
  vpr: 'var(--c-cyan)',
  oral: 'var(--c-amber)',
  trig: 'var(--c-orange)',
  mordkovich: 'var(--c-pink)',
  other: 'var(--c-slate)',
  none: 'var(--ink-4)',
  notopic: 'var(--c-rose)',
};

// Цвет доли «с ответом / с решением» и решаемости.
const shareTone = (x, { good = 0.95, ok = 0.7 } = {}) => {
  if (x == null) return 'muted';
  if (x >= good) return 'good';
  if (x >= ok) return 'ok';
  return 'bad';
};
const solveTone = (rate) => (rate == null ? 'muted' : rate >= 0.7 ? 'good' : rate >= 0.4 ? 'ok' : 'bad');

function Kpi({ icon, tone, label, value, sub, onClick }) {
  return (
    <button type="button" className="bank-kpi" onClick={onClick} disabled={!onClick}>
      <span className={`bank-kpi__icon bank-tone--${tone}`}>{icon}</span>
      <span className="bank-kpi__body">
        <span className="bank-kpi__value">{value}</span>
        <span className="bank-kpi__label">{label}</span>
        {sub && <span className="bank-kpi__sub">{sub}</span>}
      </span>
    </button>
  );
}

function Bar({ value, max, color }) {
  const w = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <span className="bank-bar">
      <span className="bank-bar__fill" style={{ width: `${w}%`, background: color }} />
    </span>
  );
}

function ExamCoverageCard({ topics, counts, flagsByTopic, usage, loading, onOpenTasks }) {
  const available = EXAM_SCOPES.filter((s) => topics.some((t) => t.exam_type === s.key && !t.archived));
  const [scope, setScope] = useState(available[0]?.key || 'ege_base');

  const rows = useMemo(
    () => examCoverage({ topics, examType: scope, counts, flags: flagsByTopic || {}, usage }),
    [topics, scope, counts, flagsByTopic, usage],
  );
  const summary = coverageSummary(rows);
  const max = Math.max(...rows.map((r) => r.count), 1);
  const withParts = rows.some((r) => r.part === 2);

  const meta = `${summary.topics} заданий · ${fmt(summary.tasks)} задач`;
  const notes = [
    summary.empty && `пустых: ${summary.empty}`,
    summary.thin && `мало задач: ${summary.thin}`,
    usage && summary.unused && `ни разу не выдавались: ${summary.unused}`,
  ].filter(Boolean);

  return (
    <SectionCard
      icon={<AimOutlined />}
      iconColor="var(--c-blue)"
      title="Покрытие экзаменов"
      meta={meta}
      extra={available.length > 1 && (
        <Segmented
          size="small"
          className="bank-card-switch"
          value={scope}
          onChange={setScope}
          options={available.map((s) => ({ value: s.key, label: s.label }))}
        />
      )}
      bodyClass="bank-cov"
    >
      {notes.length > 0 && <div className="bank-cov__notes">{notes.join(' · ')}</div>}
      <div className="bank-cov__head">
        <span>№</span>
        <span>Задание</span>
        <span>Задач</span>
        <Tooltip title="Доля задач с ответом"><span className="bank-cov__num">Ответ</span></Tooltip>
        <Tooltip title="Доля задач с решением"><span className="bank-cov__num">Решение</span></Tooltip>
        <Tooltip title="Сколько задач темы стоят в работах"><span className="bank-cov__num bank-cov__opt">В работах</span></Tooltip>
        <Tooltip title={`Доля верных ответов учеников (и журнала «Решу») по задачам темы; показываем от ${MIN_SOLVE_N} ответов`}>
          <span className="bank-cov__num bank-cov__opt">Решают</span>
        </Tooltip>
      </div>
      {rows.length === 0 && <div className="ws-card__empty">У этого экзамена нет тем</div>}
      {rows.map((r, i) => (
        <div key={r.key}>
          {withParts && r.part === 2 && rows[i - 1]?.part !== 2 && (
            <div className="bank-cov__part">Часть 2</div>
          )}
          <button
            type="button"
            className={`bank-cov__row bank-cov__row--${r.level}`}
            onClick={() => onOpenTasks({ topic: r.topicId })}
          >
            <span className="bank-cov__no">{r.number ?? '·'}</span>
            <span className="bank-cov__title">
              <span className="bank-cov__name">{r.title}</span>
              {r.level === 'empty' && <span className="lemma-chip lemma-chip-rose lemma-chip--nodot">пусто</span>}
              {r.level === 'thin' && <span className="lemma-chip lemma-chip-amber lemma-chip--nodot">мало</span>}
              {r.review > 0 && (
                <Tooltip title="Задачи с непроверенным LaTeX">
                  <span className="lemma-chip lemma-chip-neutral lemma-chip--nodot">LaTeX: {r.review}</span>
                </Tooltip>
              )}
            </span>
            <span className="bank-cov__count">
              <span className="bank-cov__countn">{fmt(r.count)}</span>
              <Bar value={r.count} max={max} color={r.level === 'ok' ? 'var(--accent)' : r.level === 'thin' ? 'var(--c-amber)' : 'var(--c-rose)'} />
            </span>
            <span className={`bank-cov__num bank-val--${loading ? 'muted' : shareTone(r.answerShare)}`}>
              {loading ? '…' : pct(r.answerShare)}
            </span>
            <span className={`bank-cov__num bank-val--${loading ? 'muted' : shareTone(r.solutionShare, { good: 0.8, ok: 0.4 })}`}>
              {loading ? '…' : pct(r.solutionShare)}
            </span>
            <span className={`bank-cov__num bank-cov__opt${r.used === 0 && r.count > 0 ? ' bank-val--bad' : ''}`}>
              {r.used == null ? '…' : fmt(r.used)}
            </span>
            <span className="bank-cov__num bank-cov__opt">
              {r.solve && r.solve.n >= MIN_SOLVE_N ? (
                <Tooltip title={`${fmt(r.solve.c)} верных из ${fmt(r.solve.n)} ответов`}>
                  <span className={`bank-val--${solveTone(r.solve.rate)}`}>{pct(r.solve.rate)}</span>
                </Tooltip>
              ) : <span className="bank-val--muted">—</span>}
            </span>
          </button>
        </div>
      ))}
    </SectionCard>
  );
}

function AttentionCard({ items, loading }) {
  const visible = items.filter((it) => it.count == null || it.count > 0);
  return (
    <SectionCard
      icon={<WarningOutlined />}
      iconColor="var(--c-amber)"
      title="Требует внимания"
      bodyClass="bank-list"
    >
      {visible.length === 0 && !loading && (
        <EmptyState title="Всё в порядке" description="Битых формул, задач без ответа и пустых тем нет" />
      )}
      {visible.map((it) => (
        <button
          key={it.key}
          type="button"
          className="bank-issue"
          onClick={it.onClick}
          disabled={!it.onClick}
        >
          <span className={`bank-issue__icon bank-tone--${it.tone}`}>{it.icon}</span>
          <span className="bank-issue__main">
            <span className="bank-issue__title">{it.title}</span>
            <span className="bank-issue__hint">{it.hint}</span>
          </span>
          <span className="bank-issue__count">{it.count == null ? '…' : fmt(it.count)}</span>
          {it.onClick && <RightOutlined className="bank-issue__go" />}
        </button>
      ))}
    </SectionCard>
  );
}

function UsageCard({ usage, loading, error, hardest, briefById, topicById, onOpenTasks }) {
  return (
    <SectionCard
      icon={<LineChartOutlined />}
      iconColor="var(--c-teal)"
      title="Использование"
      meta="работы и ответы учеников"
      bodyClass="bank-usage"
    >
      {error && <Alert type="warning" showIcon message="Не удалось загрузить работы" />}
      {loading && !usage && <div className="bank-loading bank-loading--small"><Spin /></div>}
      {usage && (
        <>
          <div className="bank-usage__stats">
            <div>
              <div className="bank-usage__value">{fmt(usage.usedTasks)}</div>
              <div className="bank-usage__label">задач в {fmt(usage.works)} работах</div>
            </div>
            <div>
              <div className="bank-usage__value">{fmt(usage.answers)}</div>
              <div className="bank-usage__label">ответов учеников</div>
            </div>
            <div>
              <div className={`bank-usage__value bank-val--${solveTone(usage.rate)}`}>{pct(usage.rate)}</div>
              <div className="bank-usage__label">верных в среднем</div>
            </div>
          </div>
          {hardest.length > 0 && (
            <>
              <div className="bank-subhead">Чаще всего ошибаются</div>
              {hardest.map((h) => {
                const brief = briefById.get(h.id);
                const topic = topicById.get(brief?.topic || h.task?.topic);
                return (
                  <Tooltip key={h.id} title={brief?.statement_md} placement="left">
                    <button
                      type="button"
                      className="bank-hard"
                      onClick={() => brief?.code && onOpenTasks({ search: brief.code })}
                      disabled={!brief?.code}
                    >
                      <span className="bank-hard__code">{brief?.code || '…'}</span>
                      <span className="bank-hard__topic">
                        {topic ? (topic.ege_number ? `№${topic.ege_number} ${topic.title}` : topic.title) : '—'}
                      </span>
                      <span className={`bank-hard__rate bank-val--${solveTone(h.rate)}`}>{pct(h.rate)}</span>
                      <span className="bank-hard__n">{fmt(h.n)} отв.</span>
                    </button>
                  </Tooltip>
                );
              })}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

function CompositionCard({ topics, counts, onOpenTasks }) {
  const mix = useMemo(() => examMix(topics, counts), [topics, counts]);
  const diffs = useMemo(() => difficultyRows(counts), [counts]);
  const years = useMemo(() => yearRows(counts), [counts]);
  const total = counts.total || 1;
  const maxDiff = Math.max(...diffs.map((d) => d.count), 1);

  const openMix = (key) => {
    if (key === 'notopic') onOpenTasks({ issue: 'notopic' });
    else if (key !== 'none') onOpenTasks({ exam_type: key });
  };

  return (
    <SectionCard
      icon={<PieChartOutlined />}
      iconColor="var(--c-violet)"
      title="Состав банка"
      bodyClass="bank-mix"
    >
      <div className="bank-mix__strip">
        {mix.map((m) => (
          <Tooltip key={m.key} title={`${m.label}: ${fmt(m.count)}`}>
            <span
              className="bank-mix__seg"
              style={{ flexGrow: m.count, background: MIX_COLOR[m.key] || 'var(--ink-4)' }}
            />
          </Tooltip>
        ))}
      </div>
      <div className="bank-mix__legend">
        {mix.map((m) => (
          <button
            key={m.key}
            type="button"
            className="bank-mix__item"
            onClick={() => openMix(m.key)}
            disabled={m.key === 'none'}
          >
            <span className="bank-mix__dot" style={{ background: MIX_COLOR[m.key] || 'var(--ink-4)' }} />
            <span className="bank-mix__label">{m.label}</span>
            <span className="bank-mix__n">{fmt(m.count)}</span>
            <span className="bank-mix__pct">{pct(m.count / total)}</span>
          </button>
        ))}
      </div>

      <div className="bank-subhead">Сложность</div>
      {diffs.map((d) => {
        const info = DIFFICULTY[d.difficulty] || { label: d.difficulty, color: 'var(--ink-4)' };
        const clickable = d.difficulty !== UNSET_DIFFICULTY;
        return (
          <button
            key={d.key}
            type="button"
            className="bank-hrow"
            onClick={() => clickable && onOpenTasks({ difficulty: d.difficulty })}
            disabled={!clickable}
          >
            <span className="bank-hrow__label">{info.label}</span>
            <Bar value={d.count} max={maxDiff} color={info.color} />
            <span className="bank-hrow__n">{fmt(d.count)}</span>
          </button>
        );
      })}

      {years.length > 0 && (
        <>
          <div className="bank-subhead">Год</div>
          <div className="bank-years">
            {years.map((y) => (
              <button key={y.key} type="button" className="bank-year" onClick={() => onOpenTasks({ year: y.year })}>
                {y.year} <b>{fmt(y.count)}</b>
              </button>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

function SourcesCard({ sourceRows, onOpenTasks, onTab }) {
  const top = sourceRows.filter((s) => s.count > 0).slice(0, 8);
  const max = Math.max(...top.map((s) => s.count), 1);
  return (
    <SectionCard
      icon={<FileTextOutlined />}
      iconColor="var(--c-amber)"
      title="Источники"
      meta={`${sourceRows.length}`}
      actionLabel={<>Все <RightOutlined /></>}
      onAction={() => onTab('sources')}
      bodyClass="bank-list bank-list--rows"
    >
      {top.map((s) => (
        <button key={s.key} type="button" className="bank-hrow" onClick={() => onOpenTasks({ source: s.source })}>
          <span className="bank-hrow__label bank-hrow__label--wide" title={s.source}>{s.source}</span>
          <Bar value={s.count} max={max} color="var(--c-amber)" />
          <span className="bank-hrow__n">{fmt(s.count)}</span>
        </button>
      ))}
    </SectionCard>
  );
}

/** «Обзор» банка: что в нём есть, что чинить и как задачи используются. */
export default function BankOverview({ counts, topicRows, sourceRows, nameDuplicates, onOpenTasks, onTab }) {
  const { topics, tasksSnapshot } = useReferenceData();
  const { data, error } = useBankData();
  const { statsByTask, loading: statsLoading } = useTaskStats();
  const vec = useVectorIndexStats();
  const flags = data?.flags || null;

  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const taskById = useMemo(() => new Map(tasksSnapshot.map((t) => [t.id, t])), [tasksSnapshot]);
  const topicOf = useMemo(() => new Map(tasksSnapshot.map((t) => [t.id, t.topic])), [tasksSnapshot]);

  const flagsByTopic = useMemo(() => (flags ? {
    noAnswer: countByTopic(flags.noAnswer),
    noSolution: countByTopic(flags.noSolution),
    review: countByTopic(flags.review),
  } : null), [flags]);

  const usage = useMemo(() => {
    if (!data || statsLoading) return null;
    return usageStats({ variants: data.variants, statsByTask, topicOf });
  }, [data, statsLoading, statsByTask, topicOf]);

  const hardest = useMemo(
    () => (statsLoading ? [] : hardestTasks(statsByTask, taskById, { limit: 6 })),
    [statsLoading, statsByTask, taskById],
  );

  // Коды и начало условий «трудных» задач — их в снимке нет.
  const [briefById, setBriefById] = useState(() => new Map());
  const hardestKey = hardest.map((h) => h.id).join(',');
  useEffect(() => {
    if (!hardestKey) return undefined;
    let alive = true;
    api.getTasksBrief(hardestKey.split(','))
      .then((list) => { if (alive) setBriefById(new Map(list.map((t) => [t.id, t]))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [hardestKey]);

  const total = counts.total;
  const withAnswer = flags ? total - flags.noAnswer.length : null;
  const withSolution = flags ? total - flags.noSolution.length : null;
  const emptyTopics = topicRows.filter((r) => r.count === 0 && !r.raw?.archived).length;

  const attention = [
    {
      key: 'latex', tone: 'rose', icon: <FunctionOutlined />,
      title: 'Проверить LaTeX', hint: 'формулы не прошли проверку при импорте',
      count: flags ? flags.review.length : null,
      onClick: () => onOpenTasks({ issue: 'latex' }),
    },
    {
      key: 'noanswer', tone: 'amber', icon: <QuestionCircleOutlined />,
      title: 'Без ответа', hint: 'онлайн-выдача не сможет их проверить',
      count: flags ? flags.noAnswer.length : null,
      onClick: () => onOpenTasks({ hasAnswer: false }),
    },
    {
      key: 'notopic', tone: 'amber', icon: <FolderOpenOutlined />,
      title: 'Без темы', hint: 'не попадут ни в один генератор',
      count: counts.noTopic,
      onClick: () => onOpenTasks({ issue: 'notopic' }),
    },
    {
      key: 'diff0', tone: 'neutral', icon: <TagsOutlined />,
      title: 'Сложность «0»', hint: 'вне шкалы 1–5',
      count: counts.byDifficulty.get('0') || 0,
      onClick: () => onOpenTasks({ difficulty: '0' }),
    },
    {
      key: 'empty', tone: 'neutral', icon: <ReadOutlined />,
      title: 'Пустые темы', hint: 'ни одной задачи (архивные не считаем)',
      count: emptyTopics,
      onClick: () => onTab('topics'),
    },
    {
      key: 'names', tone: 'violet', icon: <CopyOutlined />,
      title: 'Одинаковые названия', hint: 'темы, подтемы, теги, источники — можно слить',
      count: nameDuplicates,
      onClick: () => onTab('duplicates'),
    },
    {
      key: 'vec', tone: 'blue', icon: <NodeIndexOutlined />,
      title: 'Вне векторного индекса', hint: 'не участвуют в «Похожих»; vector-benchmark → npm run index',
      count: vec ? vec.missing || 0 : 0,
      onClick: null,
    },
  ];

  return (
    <div className="bank-overview">
      {error && (
        <Alert
          type="warning"
          showIcon
          className="bank-alert"
          message="Часть показателей не загрузилась"
          description="Доли «с ответом» и «с решением», состав работ. Нажмите «Обновить» вверху."
        />
      )}

      <div className="bank-kpis">
        <Kpi
          icon={<DatabaseOutlined />} tone="blue"
          label="задач в банке" value={fmt(total)}
          sub={`${fmt(topics.length)} тем`}
          onClick={() => onOpenTasks(null)}
        />
        <Kpi
          icon={<CheckCircleOutlined />} tone="teal"
          label="с ответом" value={withAnswer == null ? '…' : pct(share(withAnswer, total))}
          sub={withAnswer == null ? null : `${fmt(withAnswer)} задач`}
          onClick={() => onOpenTasks({ hasAnswer: true })}
        />
        <Kpi
          icon={<ReadOutlined />} tone="violet"
          label="с решением" value={withSolution == null ? '…' : pct(share(withSolution, total))}
          sub={withSolution == null ? null : `${fmt(withSolution)} задач`}
          onClick={() => onOpenTasks({ hasSolution: true })}
        />
        <Kpi
          icon={<SolutionOutlined />} tone="amber"
          label="в работах" value={usage ? fmt(usage.usedTasks) : '…'}
          sub={usage ? `${pct(share(usage.usedTasks, total))} банка` : null}
        />
      </div>

      <div className="bank-cols">
        <div className="bank-col">
          <ExamCoverageCard
            topics={topics}
            counts={counts}
            flagsByTopic={flagsByTopic}
            usage={usage}
            loading={!flags && !error}
            onOpenTasks={onOpenTasks}
          />
        </div>
        <div className="bank-col">
          <AttentionCard items={attention} loading={!flags && !error} />
          <UsageCard
            usage={usage}
            loading={(!data && !error) || statsLoading}
            error={error}
            hardest={hardest}
            briefById={briefById}
            topicById={topicById}
            onOpenTasks={onOpenTasks}
          />
        </div>
      </div>

      <div className="bank-cols bank-cols--even">
        <CompositionCard topics={topics} counts={counts} onOpenTasks={onOpenTasks} />
        <SourcesCard sourceRows={sourceRows} onOpenTasks={onOpenTasks} onTab={onTab} />
      </div>
    </div>
  );
}
