import { Switch, Button, Popover } from 'antd';
import { PlusOutlined, CheckOutlined, FlagFilled } from '@ant-design/icons';
import { groupHex, Chip, GroupColorPicker } from '../ui';
import { dueChip } from './calendarUtils';

const SWATCH = { lesson: '#2B4BFF', deadline: '#D97706', todo: '#0D9488' };
const FILTER_LABEL = { lesson: 'Уроки', deadline: 'Дедлайны', todo: 'Дела' };

function Metric({ label, value, color }) {
  return (
    <div className="cr-metric">
      <div className="cr-metric-val" style={{ color }}>{value}</div>
      <div className="cr-metric-label">{label}</div>
    </div>
  );
}

/**
 * Правый рабочий рейл календаря: сводка недели · фильтры типов + легенда групп ·
 * дела на сегодня (просроченные + сегодняшние).
 */
export default function RightRail({
  summary, filters, setFilters, counts, groups, groupFilter, setGroupFilter,
  today, onToggleTodo, onSelectTodo, onCreateTodo, onSetGroupColor, canEdit,
}) {
  return (
    <aside className="cal-rail">
      {/* a) Сводка периода */}
      <div className="cr-block">
        <div className="cr-block-title">Сводка недели</div>
        <div className="cr-metrics">
          <Metric label="Уроков" value={summary.lessonsCount} color="#2B4BFF" />
          <Metric label="Дедлайнов" value={summary.deadlinesCount} color="#D97706" />
          <Metric label="Дел открыто" value={summary.todosOpen} color="#0D9488" />
          <Metric label="Требует внимания" value={summary.attention} color="#E11D48" />
        </div>
      </div>

      {/* b) Фильтры «Показывать на сетке» */}
      <div className="cr-block">
        <div className="cr-block-title">Показывать на сетке</div>
        {['lesson', 'deadline', 'todo'].map((k) => (
          <div key={k} className="cr-filter">
            <span className="cr-swatch" style={{ background: SWATCH[k] }} />
            <span className="cr-filter-label">{FILTER_LABEL[k]}</span>
            <span className="cr-filter-count">{counts[k]}</span>
            <Switch size="small" checked={filters[k]}
              onChange={(v) => setFilters((f) => ({ ...f, [k]: v }))} />
          </div>
        ))}

        {groups.length > 0 && (
          <div className="cr-legend">
            <span
              className={`cr-pill${!groupFilter ? ' is-active' : ''}`}
              onClick={() => setGroupFilter(null)}
              role="button" tabIndex={0}
            >
              Все группы
            </span>
            {groups.map((g) => {
              // Точка легенды — она же кнопка смены цвета класса: цвет правят
              // там, где он мешает, не уходя в «Классы и группы».
              const dot = (
                <span
                  className={`cr-dot${canEdit && onSetGroupColor ? ' cr-dot--edit' : ''}`}
                  style={{ background: groupHex(g).base }}
                  title={canEdit && onSetGroupColor ? 'Цвет класса' : undefined}
                  onClick={(e) => { if (canEdit && onSetGroupColor) e.stopPropagation(); }}
                />
              );
              return (
                <span
                  key={g.id}
                  className={`cr-pill${groupFilter === g.id ? ' is-active' : ''}`}
                  onClick={() => setGroupFilter(groupFilter === g.id ? null : g.id)}
                  role="button" tabIndex={0}
                >
                  {canEdit && onSetGroupColor ? (
                    <Popover
                      trigger="click"
                      placement="left"
                      title={`Цвет · ${g.name}`}
                      content={(
                        <div style={{ maxWidth: 208 }}>
                          <GroupColorPicker
                            value={g.color || ''}
                            autoKey={g.id}
                            onChange={(tone) => onSetGroupColor(g, tone)}
                          />
                        </div>
                      )}
                    >
                      {dot}
                    </Popover>
                  ) : dot}
                  {g.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* c) Дела на сегодня */}
      <div className="cr-block">
        <div className="cr-block-title">Дела на сегодня</div>
        {today.length === 0 ? (
          <div className="cr-empty">Нет дел на сегодня 🎉</div>
        ) : (
          <div className="cr-todos">
            {today.map((t) => {
              const accent = t.group ? groupHex(t.expand?.group || t.group).base : '#0D9488';
              const chip = dueChip(t.due_date);
              return (
                <div key={t.id} className="cr-todo" onClick={() => onSelectTodo(t)} role="button" tabIndex={0}>
                  <span className="cal-todo-check"
                    style={{ borderColor: t.done ? '#B5BAC4' : accent, background: t.done ? accent : 'transparent' }}
                    onClick={(e) => { e.stopPropagation(); onToggleTodo(t); }}>
                    {t.done && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
                  </span>
                  <span className={`cr-todo-title${t.done ? ' is-done' : ''}`}>{t.title}</span>
                  <span className="cr-todo-tail">
                    {chip && <Chip tone={chip.tone} dot={false}>{chip.label}</Chip>}
                    {t.expand?.group?.name && <Chip tone="neutral" dot={false}>{t.expand.group.name}</Chip>}
                    {t.priority === 'high' && !t.done && <FlagFilled className="cal-flag" />}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {canEdit && (
          <Button block type="dashed" icon={<PlusOutlined />} className="cr-new-todo" onClick={onCreateTodo}>
            Новое дело
          </Button>
        )}
      </div>
    </aside>
  );
}
