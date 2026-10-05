import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { dayKey, dayMarks, weekDays, weekLabel, weekStart } from '../../utils/studentWeek';

/**
 * Календарь «неделя» в «Моих уроках» ученика (v3.9.292): полоса из семи дней
 * с отметками (точка — урок, оранжевая — к этому дню есть ДЗ) и уроки
 * выбранного дня под ней. Карточку урока рисует вызывающий (`renderLesson`) —
 * та же, что в виде «списком».
 */
export default function StudentWeekView({ day, onDay, lessonsMap, hw, renderLesson, loading }) {
  const days = weekDays(day);
  const today = dayjs();
  const todayKey = dayKey(today);
  const selKey = dayKey(day);
  const thisWeek = weekStart(day).isSame(weekStart(today), 'day');
  const list = lessonsMap.get(selKey) || [];

  return (
    <div className="sw">
      <div className="sw-nav">
        <Button size="small" className="sc-btn" icon={<LeftOutlined />} aria-label="Предыдущая неделя"
          onClick={() => onDay(day.subtract(7, 'day'))} />
        <span className="sw-nav-label">{weekLabel(day, today)}</span>
        <Button size="small" className="sc-btn" icon={<RightOutlined />} aria-label="Следующая неделя"
          onClick={() => onDay(day.add(7, 'day'))} />
        {!thisWeek && (
          <Button size="small" className="sc-btn sw-today-btn" onClick={() => onDay(today.startOf('day'))}>
            Сегодня
          </Button>
        )}
      </div>

      <div className="sw-strip">
        {days.map((d) => {
          const k = dayKey(d);
          const m = dayMarks(lessonsMap.get(k), hw.incoming);
          const cls = [
            'sw-day',
            k === selKey ? 'is-selected' : '',
            k === todayKey ? 'is-today' : '',
            d.day() === 0 || d.day() === 6 ? 'is-weekend' : '',
          ].filter(Boolean).join(' ');
          const title = [
            m.lessons ? `уроков: ${m.lessons}` : 'уроков нет',
            m.cancelled ? `отменено: ${m.cancelled}` : '',
            m.homework ? 'есть ДЗ' : '',
          ].filter(Boolean).join(', ');
          return (
            <button key={k} type="button" className={cls} aria-pressed={k === selKey}
              aria-label={`${d.locale('ru').format('dddd, D MMMM')}: ${title}`} onClick={() => onDay(d)}>
              <span className="sw-dow">{d.locale('ru').format('dd')}</span>
              <span className="sw-num">{d.format('D')}</span>
              <span className="sw-dots">
                {Array.from({ length: Math.min(m.lessons, 3) }, (_, i) => <i key={i} className="sw-dot" />)}
                {!m.lessons && m.cancelled > 0 && <i className="sw-dot sw-dot--off" />}
                {m.homework && <i className="sw-dot sw-dot--hw" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sw-day-title">
        {day.locale('ru').format('dddd, D MMMM')}
        {loading && <span className="sw-loading"> · загружаю…</span>}
      </div>
      {list.length > 0
        ? list.map((l) => renderLesson(l))
        : <div className="sc-empty-note">{loading ? '' : 'В этот день уроков нет'}</div>}
    </div>
  );
}
