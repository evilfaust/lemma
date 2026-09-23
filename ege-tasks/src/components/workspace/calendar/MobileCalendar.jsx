import { useMemo, useState } from 'react';
import { Button } from 'antd';
import {
  BankOutlined, CheckOutlined, DownOutlined, FlagOutlined, LeftOutlined, PlusOutlined,
  RightOutlined, UpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { groupHex, lessonHex } from '../ui';
import { slotLabel } from '../lessonTime';
import { KIND_COLORS } from '../../../shared/services/pb/schoolEvents';
import useSwipe from '../../../hooks/useSwipe';
import {
  CORE_PAIRS, dayAgenda, dayMarks, gridDays, usedExtraPairs,
} from './mobileAgenda';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const schoolHex = (e) => groupHex(e.resource?.color || KIND_COLORS[e.resource?.kind] || 'slate');

function plural(n, one, few, many) {
  const m10 = n % 10; const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/**
 * Календарь для телефона вместо сетки react-big-calendar: сверху неделя
 * (или месяц) с точками событий, ниже — лента выбранного дня по парам.
 * Свободная пара — строка «+», тап создаёт урок сразу на неё.
 * Листание: стрелки или свайп (по сетке — недели/месяцы, по ленте — дни).
 */
export default function MobileCalendar({
  events, date, onDateChange, groups, groupFilter, setGroupFilter,
  onOpenLesson, onOpenEvent, onToggleTodo, onToggleLessonDone, onCreate, canEdit,
}) {
  const [mode, setMode] = useState('week'); // week | month
  const day = dayjs(date);
  const today = dayjs();

  const days = useMemo(() => gridDays(date, mode), [date, mode]);
  const marks = useMemo(() => dayMarks(events, days, (e) => schoolHex(e).base), [events, days]);

  // Нулевая/вечерние пары предлагаются, если ими пользуются на видимом отрезке.
  const extraKeys = useMemo(() => {
    const first = days[0]; const last = days[days.length - 1];
    return usedExtraPairs(events.filter((e) => e.resource?.type === 'lesson'
      && !dayjs(e.start).isBefore(first, 'day') && !dayjs(e.start).isAfter(last, 'day')));
  }, [events, days]);

  const weekend = day.day() === 0 || day.day() === 6;
  const past = day.isBefore(today, 'day');
  const freeKeys = canEdit && !weekend && !past
    ? [...CORE_PAIRS, ...extraKeys].sort()
    : [];
  const agenda = useMemo(() => dayAgenda(events, date, { freeKeys }), [events, date, freeKeys.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (dir) => {
    const unit = mode === 'week' ? 'week' : 'month';
    onDateChange(day.add(dir, unit).toDate());
  };
  const shiftDay = (dir) => onDateChange(day.add(dir, 'day').toDate());
  const gridSwipe = useSwipe({ onLeft: () => shift(1), onRight: () => shift(-1) });
  const daySwipe = useSwipe({ onLeft: () => shiftDay(1), onRight: () => shiftDay(-1) });

  const title = mode === 'week'
    ? (() => {
      const s = days[0]; const e = days[6];
      return s.month() === e.month()
        ? `${s.date()}–${e.date()} ${e.format('MMMM')}`
        : `${s.format('D MMM')} – ${e.format('D MMM')}`;
    })()
    : cap(day.format('MMMM YYYY'));

  const now = Date.now();

  return (
    <div className="mc">
      <div className="mc-bar">
        <button type="button" className="mc-arrow" onClick={() => shift(-1)} aria-label="Назад"><LeftOutlined /></button>
        <button type="button" className="mc-title" onClick={() => setMode((m) => (m === 'week' ? 'month' : 'week'))}>
          {title} {mode === 'week' ? <DownOutlined /> : <UpOutlined />}
        </button>
        <button type="button" className="mc-arrow" onClick={() => shift(1)} aria-label="Вперёд"><RightOutlined /></button>
        {!day.isSame(today, 'day') && (
          <Button size="small" onClick={() => onDateChange(new Date())}>Сегодня</Button>
        )}
      </div>

      <div className="mc-grid" {...gridSwipe}>
        {WD.map((w) => <div key={w} className="mc-wd">{w}</div>)}
        {days.map((d) => {
          const key = d.format('YYYY-MM-DD');
          const m = marks.get(key);
          let cls = 'mc-cell';
          if (d.isSame(day, 'day')) cls += ' is-sel';
          if (d.isSame(today, 'day')) cls += ' is-today';
          if (mode === 'month' && d.month() !== day.month()) cls += ' is-out';
          if (d.day() === 0 || d.day() === 6) cls += ' is-weekend';
          return (
            <button type="button" key={key} className={cls} onClick={() => onDateChange(d.toDate())}>
              <span className="mc-cell__n">{d.date()}</span>
              <span className="mc-cell__dots">
                {m?.dots.map((c, i) => <span key={i} className="mc-dot" style={{ background: c }} />)}
              </span>
              {m?.school && <span className="mc-cell__school" style={{ background: m.school }} />}
            </button>
          );
        })}
      </div>

      {groups.length > 1 && (
        <div className="mc-groups">
          <button type="button" className={`mc-pill${!groupFilter ? ' is-on' : ''}`} onClick={() => setGroupFilter(null)}>
            Все
          </button>
          {groups.map((g) => {
            const hex = groupHex(g);
            const on = groupFilter === g.id;
            return (
              <button type="button" key={g.id} className={`mc-pill${on ? ' is-on' : ''}`}
                style={on ? { background: hex.base, borderColor: hex.base, color: '#fff' } : { color: hex.ink || hex.base }}
                onClick={() => setGroupFilter(on ? null : g.id)}>
                {g.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mc-day" {...daySwipe}>
        <div className="mc-day__head">
          <span className="mc-day__title">
            {day.isSame(today, 'day') ? 'Сегодня, ' : ''}{day.format('dddd, D MMMM')}
          </span>
          {agenda.lessonsCount > 0 && (
            <span className="mc-day__meta">
              {agenda.lessonsCount} {plural(agenda.lessonsCount, 'урок', 'урока', 'уроков')}
            </span>
          )}
        </div>

        {agenda.school.map((e) => {
          const hex = schoolHex(e);
          return (
            <button type="button" key={e.id} className="mc-school"
              style={{ color: hex.ink || hex.base, background: hex.soft, borderColor: hex.base }}
              onClick={() => onOpenEvent(e)}>
              <BankOutlined /> {e.title}
            </button>
          );
        })}

        {agenda.rows.filter((row) => row.kind !== 'free' || +row.slot.end > now).map((row) => {
          if (row.kind === 'free') {
            const { slot } = row;
            return (
              <button type="button" key={row.key} className="mc-free" onClick={() => onCreate(slot.start, slot.key)}>
                <span className="mc-time">
                  <span>{dayjs(slot.start).format('HH:mm')}</span>
                </span>
                <span className="mc-free__label"><PlusOutlined /> {slot.label} свободна</span>
              </button>
            );
          }
          const e = row.event;
          const l = e.resource.raw;
          const st = e.resource.status;
          const hex = lessonHex(l);
          const live = st !== 'done' && st !== 'cancelled' && +e.start <= now && now < +e.end;
          const mats = Array.isArray(l.materials) ? l.materials.length : 0;
          const slot = slotLabel(l.time_slot);
          return (
            <div key={row.key}
              className={`mc-lesson is-${st}${live ? ' is-live' : ''}`}
              style={{ '--mc-c': hex.base, '--mc-soft': hex.soft }}
              role="button" tabIndex={0} onClick={() => onOpenLesson(l)}>
              <span className="mc-time">
                <span>{dayjs(e.start).format('HH:mm')}</span>
                <small>{dayjs(e.end).format('HH:mm')}</small>
              </span>
              <span className="mc-lesson__main">
                <span className="mc-lesson__title">{l.title || 'Урок'}</span>
                <span className="mc-lesson__meta">
                  {e.resource.groupName && (
                    <span className="mc-lesson__group" style={{ color: hex.ink || hex.base }}>{e.resource.groupName}</span>
                  )}
                  {slot && <span>{slot}</span>}
                  {live && <span className="mc-live">идёт сейчас</span>}
                  {st === 'cancelled' && <span>отменён</span>}
                  {mats > 0 && <span>📎 {mats}</span>}
                  {e.resource.isForeign && <span>ведёт {e.resource.ownerName || 'коллега'}</span>}
                </span>
              </span>
              {canEdit && st !== 'cancelled' && (
                <button type="button"
                  className={`mc-done${st === 'done' ? ' is-on' : ''}`}
                  aria-label={st === 'done' ? 'Вернуть в запланированные' : 'Отметить проведённым'}
                  onClick={(ev) => { ev.stopPropagation(); onToggleLessonDone(l); }}>
                  <CheckOutlined />
                </button>
              )}
            </div>
          );
        })}

        {agenda.deadlines.map((e) => (
          <button type="button" key={e.id} className="mc-item mc-item--deadline" onClick={() => onOpenEvent(e)}>
            <FlagOutlined />
            <span className="mc-item__title">{e.title}</span>
            <span className="mc-item__tag">дедлайн</span>
          </button>
        ))}

        {agenda.todos.map((e) => {
          const done = e.resource.done;
          return (
            <div key={e.id} className={`mc-item mc-item--todo${done ? ' is-done' : ''}`}
              role="button" tabIndex={0} onClick={() => onOpenEvent(e)}>
              <button type="button" className={`mc-check${done ? ' is-on' : ''}`}
                aria-label={done ? 'Вернуть в работу' : 'Сделано'}
                onClick={(ev) => { ev.stopPropagation(); onToggleTodo(e.resource.raw); }}>
                {done && <CheckOutlined />}
              </button>
              <span className="mc-item__title">{e.title}</span>
              {e.resource.groupName && <span className="mc-item__tag">{e.resource.groupName}</span>}
            </div>
          );
        })}

        {!agenda.rows.length && !agenda.school.length && !agenda.deadlines.length && !agenda.todos.length && (
          <div className="mc-empty">
            {weekend ? 'Выходной — ничего не запланировано.' : 'На этот день ничего не запланировано.'}
          </div>
        )}
        {canEdit && (
          <Button block icon={<PlusOutlined />} className="mc-add" onClick={() => onCreate(day.toDate(), null)}>
            Урок на {day.format('D MMMM')}
          </Button>
        )}
      </div>
    </div>
  );
}
