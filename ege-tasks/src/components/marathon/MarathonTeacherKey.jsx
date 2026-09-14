import { useMemo, useState } from 'react';
import { Empty, Input, Switch, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import MathRenderer from '../../shared/components/MathRenderer';
import './MarathonTeacherKey.css';

const { Text } = Typography;

const plain = (s) => String(s || '').replace(/\$+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Ключи марафона на экране — то, чем учитель пользуется во время самого урока:
 * ученик подходит с задачей №7, учитель смотрит ответ и, если нужно, решение.
 * Печатные листы для этого приходится держать в руках, а здесь всё ищется.
 *
 * Заодно это проверка готовности: задачи без ответа видны до начала марафона,
 * а не когда очередь уже стоит.
 */
export default function MarathonTeacherKey({ tasks = [] }) {
  const [query, setQuery] = useState('');
  const [showSolutions, setShowSolutions] = useState(false);
  const [openRows, setOpenRows] = useState(() => new Set());

  const rows = useMemo(
    () => tasks.map((task, idx) => ({ task, no: idx + 1 })),
    [tasks],
  );

  const noAnswer = useMemo(() => rows.filter(r => !r.task.answer).length, [rows]);
  const noSolution = useMemo(() => rows.filter(r => !r.task.solution_md).length, [rows]);

  const filtered = useMemo(() => {
    const q = plain(query);
    if (!q) return rows;
    return rows.filter(({ task, no }) =>
      String(no) === q
      || plain(task.code).includes(q)
      || plain(task.statement_md).includes(q)
      || plain(task.answer).includes(q));
  }, [rows, query]);

  const toggleRow = (id) => setOpenRows((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (!rows.length) return <Empty description="Задачи не выбраны" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <div className="mtk">
      <div className="mtk-toolbar">
        <Input
          allowClear
          size="small"
          prefix={<SearchOutlined />}
          placeholder="Номер, код, условие или ответ"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="mtk-search"
        />
        <label className="mtk-switch">
          <Switch size="small" checked={showSolutions} onChange={setShowSolutions} />
          <span>Решения</span>
        </label>
        <div className="mtk-badges">
          {noAnswer > 0
            ? <Tag color="warning">без ответа: {noAnswer}</Tag>
            : <Tag color="success">ответы у всех задач</Tag>}
          {noSolution > 0 && <Tag>без решения: {noSolution}</Tag>}
        </div>
      </div>

      <div className="mtk-table">
        <div className="mtk-row mtk-row--head">
          <span>№</span>
          <span>Условие</span>
          <span>Ответ</span>
        </div>

        {filtered.map(({ task, no }) => {
          const open = showSolutions || openRows.has(task.id);
          const hasSolution = !!task.solution_md;
          return (
            <div key={task.id} className={`mtk-row${open ? ' is-open' : ''}`}>
              <span className="mtk-num">{no}</span>

              <div className="mtk-statement">
                <MathRenderer content={task.statement_md || ''} />
                <div className="mtk-meta">
                  {task.code && <span className="mtk-code">{task.code}</span>}
                  {hasSolution ? (
                    <button type="button" className="mtk-link" onClick={() => toggleRow(task.id)}>
                      {open ? 'скрыть решение' : 'решение'}
                    </button>
                  ) : (
                    <span className="mtk-muted">решения нет</span>
                  )}
                </div>
                {open && hasSolution && (
                  <div className="mtk-solution">
                    <MathRenderer content={task.solution_md} />
                  </div>
                )}
              </div>

              <div className="mtk-answer">
                {task.answer
                  ? <MathRenderer content={task.answer} />
                  : <Text type="warning" style={{ fontSize: 12 }}>нет ответа</Text>}
              </div>
            </div>
          );
        })}

        {!filtered.length && (
          <div className="mtk-empty">Ничего не нашлось по запросу «{query}»</div>
        )}
      </div>
    </div>
  );
}
