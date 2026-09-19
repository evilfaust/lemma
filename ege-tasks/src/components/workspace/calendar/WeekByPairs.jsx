import dayjs from 'dayjs';
import { ClockCircleOutlined, PaperClipOutlined, CheckOutlined, FlagFilled } from '@ant-design/icons';
import { PAIRS, slotRangeFromCode, slotPairIndexes, guessSlot, hhmm } from '../lessonTime';
import { groupHex } from '../ui';
import { periodTitle } from './calendarUtils';
import { useCalendarCtx } from './CalendarContext';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

// «2 пары» / «5 пар» — подпись длительности интенсива.
const pairsWord = (n) => (n >= 2 && n <= 4 ? 'пары' : 'пар');

// Какие строки-пары занимает урок: по time_slot (интенсив "1-4" — четыре пары),
// иначе по времени старта (guessSlot), иначе — ближайшая по времени пара (не теряем
// уроки с нестандартным временем, напр. «своё время» вечером). Строки времени
// zero-padded → лексикографика ок.
function pairRowsForLesson(l, start) {
  const ix = slotPairIndexes(l.time_slot);
  if (ix) return ix;
  const g = guessSlot(start);
  if (g.pair) {
    const i = PAIRS.findIndex((p) => p.key === g.pair);
    if (i >= 0) return [i, i];
  }
  // Фолбэк: последняя пара, чей старт <= времени урока (иначе — первая).
  const t = hhmm(start);
  let bucket = 0;
  PAIRS.forEach((p, i) => { if (p.full[0] <= t) bucket = i; });
  return [bucket, bucket];
}

/**
 * Кастомный вид «Неделя» для react-big-calendar — сетка строк по парам школы
 * (PAIRS) вместо почасовой шкалы. Колонки — 7 дней. Сверху полоса «весь день»
 * для дедлайнов и дел. Клик по пустой ячейке пары → создание урока.
 */
export default function WeekByPairs({ date, events }) {
  const { onSelectEvent, onCreateInSlot, onToggleTodo, onToggleLessonDone, canEdit } = useCalendarCtx();

  const days = WeekByPairs.range(date).map((d) => dayjs(d));
  const wkStart = days[0].startOf('day').valueOf();
  const wkEnd = days[6].endOf('day').valueOf();
  const weekEvents = events.filter((e) => {
    const t = +new Date(e.start);
    return t >= wkStart && t <= wkEnd;
  });

  const allDay = weekEvents.filter((e) => e.resource?.type !== 'lesson');
  const lessons = weekEvents.filter((e) => e.resource?.type === 'lesson');

  // Размещение уроков на сетке: from/to — индексы первой и последней занятой пары.
  // busy — ячейки под блоком (не предлагаем там «создать урок»); spanned — ячейки,
  // чью нижнюю линию перекрывает многопарный блок.
  const placed = [];
  const busy = new Set();
  const spanned = new Set();
  lessons.forEach((e) => {
    const start = new Date(e.start);
    const di = days.findIndex((d) => d.isSame(dayjs(start), 'day'));
    if (di < 0) return;
    const [from, to] = pairRowsForLesson(e.resource.raw, start);
    placed.push({ e, di, from, to });
    for (let i = from; i <= to; i += 1) {
      busy.add(`${di}:${i}`);
      if (i < to) spanned.add(`${di}:${i}`);
    }
  });
  placed.sort((a, b) => a.from - b.from || a.to - b.to);
  // Пересекающиеся уроки одного дня делят колонку на дорожки (два урока в одну
  // пару стоят рядом, а не друг на друге).
  const laneCount = {};
  days.forEach((_, di) => {
    const ends = []; // ends[lane] = последняя занятая строка этой дорожки
    placed.filter((x) => x.di === di).forEach((x) => {
      let lane = ends.findIndex((last) => last < x.from);
      if (lane < 0) { lane = ends.length; }
      ends[lane] = x.to;
      x.lane = lane;
    });
    laneCount[di] = Math.max(1, ends.length);
  });

  const today = dayjs();
  const cols = `66px repeat(7, minmax(0, 1fr))`;

  return (
    <div className="cw">
      {/* Заголовки дней */}
      <div className="cw-row cw-head" style={{ gridTemplateColumns: cols }}>
        <div className="cw-corner" />
        {days.map((d) => {
          const isToday = d.isSame(today, 'day');
          const weekend = d.day() === 0 || d.day() === 6;
          return (
            <div key={d.valueOf()} className={`cw-dayhead${weekend ? ' is-weekend' : ''}`}>
              <span className="cw-dow">{WD[(d.day() + 6) % 7]}</span>
              <span className={`cw-daynum${isToday ? ' is-today' : ''}`}>{d.date()}</span>
            </div>
          );
        })}
      </div>

      {/* Полоса «весь день» — дедлайны и дела */}
      <div className="cw-row cw-allday" style={{ gridTemplateColumns: cols }}>
        <div className="cw-timecell cw-allday-label">весь день</div>
        {days.map((d) => {
          const items = allDay.filter((e) => dayjs(e.start).isSame(d, 'day'));
          const weekend = d.day() === 0 || d.day() === 6;
          return (
            <div key={d.valueOf()} className={`cw-allday-cell${weekend ? ' is-weekend' : ''}`}>
              {items.map((e) => {
                const r = e.resource;
                if (r.type === 'todo') {
                  const accent = (r.group || r.groupId) ? groupHex(r.group || r.groupId).base : '#0D9488';
                  return (
                    <div key={e.id} className={`cw-ad cw-ad--todo${r.done ? ' is-done' : ''}`}
                      onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
                      <span className="cal-todo-check" role="checkbox" aria-checked={r.done}
                        style={{ borderColor: r.done ? '#B5BAC4' : accent, background: r.done ? accent : 'transparent' }}
                        onClick={(ev) => { ev.stopPropagation(); onToggleTodo(r.raw); }}>
                        {r.done && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
                      </span>
                      <span className="cal-chip-text">{e.title}</span>
                      {r.priority === 'high' && !r.done && <FlagFilled className="cal-flag" />}
                    </div>
                  );
                }
                return (
                  <div key={e.id} className="cw-ad cw-ad--deadline"
                    onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
                    <ClockCircleOutlined className="cal-chip-ico" />
                    <span className="cal-chip-text">{e.title}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Тайм-сетка по парам: одна grid-сетка, чтобы интенсив занимал N строк */}
      <div className="cw-grid" style={{ gridTemplateColumns: cols }}>
        {PAIRS.map((p, pi) => (
          <div key={`t-${p.key}`} className="cw-timecell" style={{ gridColumn: 1, gridRow: pi + 1 }}>
            <span className="cw-time">{p.full[0]}</span>
            <span className="cw-pairlabel">{p.label}</span>
          </div>
        ))}
        {PAIRS.map((p, pi) => days.map((d, di) => {
          const weekend = d.day() === 0 || d.day() === 6;
          const isBusy = busy.has(`${di}:${pi}`);
          return (
            <div key={`c-${p.key}-${d.valueOf()}`}
              className={`cw-cell${weekend ? ' is-weekend' : ''}${isBusy ? '' : ' is-empty'}${spanned.has(`${di}:${pi}`) ? ' is-spanned' : ''}`}
              style={{ gridColumn: di + 2, gridRow: pi + 1 }}
              onClick={(e) => { if (e.target === e.currentTarget && !isBusy) onCreateInSlot(d.toDate(), p.key); }}
            />
          );
        }))}
        {placed.map(({ e, di, from, to, lane }) => {
          const r = e.resource;
          const hex = groupHex(r.group || r.groupId);
          const muted = r.status === 'done' || r.status === 'cancelled';
          const span = to - from + 1;
          const range = slotRangeFromCode(r.raw?.time_slot);
          const timeText = span > 1 && range
            ? `${range[0]}–${range[1]}`
            : dayjs(e.start).format('HH:mm');
          return (
            <div key={e.id}
              className={`cw-lesson${span > 1 ? ' is-tall' : ''}${r.status === 'cancelled' ? ' is-cancelled' : ''}${r.status === 'done' ? ' is-done' : ''}`}
              style={{
                gridColumn: di + 2,
                gridRow: `${from + 1} / ${to + 2}`,
                background: muted ? '#F6F7F9' : hex.soft,
                borderColor: muted ? '#E5E7EB' : hex.base,
                ...(laneCount[di] > 1 ? {
                  width: `calc(${100 / laneCount[di]}% - 8px)`,
                  marginLeft: `calc(${(lane * 100) / laneCount[di]}% + 4px)`,
                } : null),
              }}
              onClick={() => onSelectEvent(e)} role="button" tabIndex={0}>
              <div className="cw-lesson-head">
                <span className="cw-lesson-bar" style={{ background: muted ? '#C2C6CE' : hex.base }} />
                <span className="cw-lesson-title">{e.title}</span>
                {r.hasMaterials && r.status !== 'done' && <PaperClipOutlined className="cal-chip-tail" />}
                {/* «Провёл» одной кнопкой: на hover у запланированного, всегда — у проведённого. */}
                {canEdit && r.status !== 'cancelled' ? (
                  <span
                    className={`cw-lesson-done${r.status === 'done' ? ' is-on' : ''}`}
                    role="checkbox"
                    aria-checked={r.status === 'done'}
                    aria-label={r.status === 'done' ? 'Вернуть в запланированные' : 'Отметить проведённым'}
                    title={r.status === 'done' ? 'Вернуть в запланированные' : 'Отметить проведённым'}
                    tabIndex={0}
                    style={{ borderColor: r.status === 'done' ? hex.base : undefined, background: r.status === 'done' ? hex.base : undefined }}
                    onClick={(ev) => { ev.stopPropagation(); onToggleLessonDone(r.raw); }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault(); ev.stopPropagation(); onToggleLessonDone(r.raw);
                      }
                    }}
                  >
                    <CheckOutlined />
                  </span>
                ) : (r.status === 'done' && <CheckOutlined className="cal-chip-tail" />)}
              </div>
              <div className="cw-lesson-meta">
                {timeText}{r.groupName ? ` · ${r.groupName}` : ''}
                {span > 1 ? ` · ${span} ${pairsWord(span)}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Статика react-big-calendar для кастомного вида ──
WeekByPairs.range = (date) => {
  const start = dayjs(date).startOf('week');
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').toDate());
};

WeekByPairs.navigate = (date, action) => {
  if (action === 'PREV') return dayjs(date).subtract(1, 'week').toDate();
  if (action === 'NEXT') return dayjs(date).add(1, 'week').toDate();
  return date;
};

WeekByPairs.title = (date) => periodTitle(date, 'week');
