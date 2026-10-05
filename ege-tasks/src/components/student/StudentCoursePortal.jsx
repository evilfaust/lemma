import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin } from 'antd';
import {
  DownloadOutlined, LinkOutlined, PlayCircleOutlined, VideoCameraOutlined,
  ClockCircleOutlined, ReadOutlined, RightOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { api } from '../../shared/services/pocketbase';
import { slotRangeFromCode } from '../workspace/lessonTime';
import { homeworkFeed, isNextDue, resolveHomework } from '../../utils/homework';
import MathRenderer from '../MathRenderer';
import './StudentCoursePortal.css';

/**
 * «Мои уроки» в кабинете ученика (v3.9.291; до этого — «Мои курсы»).
 * Уроки курсов и классов с включённым расписанием приходят из хука
 * /api/lessons/my уже без приватного. ДЗ «к следующему уроку» раскладывает по
 * урокам utils/homework.js — та же функция, что у учителя в модалке урока.
 */

const AGENDA_DAYS = 14;  // столько дней вперёд показываем сразу
const PAST_DAYS = 30;    // прошедшие — за месяц

// Точный отсчёт до начала занятия (учитывает конец пары → «идёт сейчас»).
function untilLabel(pub, d) {
  if (!d) return '';
  const now = dayjs();
  const r = slotRangeFromCode(pub.time_slot);
  if (r) {
    const [eh, em] = r[1].split(':').map(Number);
    const end = d.hour(eh).minute(em);
    if (now.isAfter(end)) return 'Завершилось';
    if (!now.isBefore(d)) return 'Идёт сейчас';
  } else if (now.isAfter(d)) {
    return 'Завершилось';
  }
  const mins = d.diff(now, 'minute');
  if (mins < 1) return 'Вот-вот начнётся';
  if (mins < 60) return `Через ${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Через ${hours} ч ${mins % 60} мин`;
  const days = Math.floor(hours / 24);
  return `Через ${days} дн ${hours % 24} ч`;
}

const dateOf = (l) => (l?.date_plan ? dayjs(l.date_plan).locale('ru') : null);
const shortDate = (l) => { const d = dateOf(l); return d ? d.format('D MMM, dd') : ''; };

function ItemRow({ item, meta }) {
  let body;
  if (item.kind === 'work') {
    body = (
      <div className="sc-item">
        <span className="sc-item-title"><PlayCircleOutlined /> {item.title || 'Работа'}</span>
        {item.session_id
          ? <Button type="primary" size="small" className="sc-btn" href={`/student/${item.session_id}`}>Решать</Button>
          : <span className="sc-item-muted">ссылка не задана</span>}
      </div>
    );
  } else if (item.kind === 'file') {
    body = (
      <div className="sc-item">
        <span className="sc-item-title"><DownloadOutlined /> {item.title || 'Материал'}</span>
        {item.file_url
          ? <Button size="small" className="sc-btn" href={item.file_url} target="_blank">Открыть</Button>
          : <span className="sc-item-muted">недоступно</span>}
      </div>
    );
  } else {
    body = (
      <div className="sc-item sc-item--text">
        <MathRenderer text={item.description || ''} inline={false} />
      </div>
    );
  }
  if (!meta) return body;
  return <div className="sc-item-wrap">{body}<div className="sc-item-meta">{meta}</div></div>;
}

function timeRange(pub, d) {
  const r = slotRangeFromCode(pub.time_slot);
  if (r) return `${r[0]}–${r[1]}`;
  return d ? d.format('HH:mm') : '';
}

// Тело урока: что задано к нему раньше, материалы, ДЗ к нему и к следующему.
function LessonBody({ lesson, hw }) {
  const items = Array.isArray(lesson.items) ? lesson.items : [];
  const incoming = hw.incoming.get(lesson.id) || [];
  const classItems = items.filter((i) => i.role !== 'homework');
  const hwHere = items.filter((i) => i.role === 'homework' && !isNextDue(i));
  const hwNext = items.filter(isNextDue);
  if (!incoming.length && !classItems.length && !hwHere.length && !hwNext.length) {
    return lesson.status === 'cancelled' ? null : <div className="sc-empty-note">Материалы появятся позже</div>;
  }
  const target = hw.targetOf.get(lesson.id);
  return (
    <>
      {incoming.length > 0 && (
        <div className="sc-block sc-block--due">
          <div className="sc-block-head">📌 Сделать к этому уроку</div>
          {incoming.map(({ item, from }, i) => (
            <ItemRow key={`in${i}`} item={item} meta={`задано на уроке ${shortDate(from)}`} />
          ))}
        </div>
      )}
      {classItems.length > 0 && (
        <div className="sc-block">
          <div className="sc-block-head">Материалы</div>
          {classItems.map((it, i) => <ItemRow key={`c${i}`} item={it} />)}
        </div>
      )}
      {hwHere.length > 0 && (
        <div className="sc-block sc-block--hw">
          <div className="sc-block-head">🏠 Домашнее задание</div>
          {hwHere.map((it, i) => <ItemRow key={`h${i}`} item={it} />)}
        </div>
      )}
      {hwNext.length > 0 && (
        <div className="sc-block sc-block--hw">
          <div className="sc-block-head">
            🏠 К следующему уроку · {target ? shortDate(target) : 'дата уточняется'}
          </div>
          {hwNext.map((it, i) => <ItemRow key={`n${i}`} item={it} />)}
        </div>
      )}
    </>
  );
}

function GroupChip({ group }) {
  if (!group) return null;
  return <span className="sc-group-chip">{group.kind === 'course' ? '🎓' : '📘'} {group.name}</span>;
}

// Компактная карточка занятия (расписание/прошедшие).
function LessonCard({ lesson, hw, dimmed, group }) {
  const d = dateOf(lesson);
  const cancelled = lesson.status === 'cancelled';
  const until = dimmed || cancelled ? '' : untilLabel(lesson, d);
  return (
    <div className={`sc-card${dimmed ? ' sc-card--dim' : ''}${cancelled ? ' sc-card--cancel' : ''}`}>
      <div className="sc-date">
        <span className="sc-date-day">{d ? d.format('D') : '—'}</span>
        <span className="sc-date-mon">{d ? d.format('MMM') : ''}</span>
      </div>
      <div className="sc-card-main">
        <div className="sc-card-top">
          <span className="sc-card-title">{lesson.title || 'Урок'}</span>
          <span className="sc-card-time"><ClockCircleOutlined /> {timeRange(lesson, d)}</span>
        </div>
        {(group || cancelled) && (
          <div className="sc-card-sub">
            <GroupChip group={group} />
            {cancelled && <span className="sc-cancel-note">Урок отменён</span>}
          </div>
        )}
        {until && <div className="sc-card-until">{until}</div>}
        <LessonBody lesson={lesson} hw={hw} />
      </div>
    </div>
  );
}

// Крупная карточка ближайшего занятия.
function NextLessonHero({ lesson, hw, group }) {
  const d = dateOf(lesson);
  const boardUrl = group?.board_url;
  return (
    <div className="sc-hero">
      <div className="sc-hero-head">
        <div>
          <div className="sc-hero-rel">{d ? untilLabel(lesson, d) : 'Ближайший урок'}</div>
          <div className="sc-hero-title">{lesson.title || 'Урок'}</div>
          <div className="sc-hero-when">
            {d ? d.format('dddd, D MMMM') : ''} · <b>{timeRange(lesson, d)}</b>
            {group && <> · {group.name}</>}
          </div>
        </div>
        {(lesson.conference_url || boardUrl) && (
          <div className="sc-hero-actions">
            {lesson.conference_url && (
              <Button type="primary" icon={<VideoCameraOutlined />} href={lesson.conference_url} target="_blank" className="sc-hero-join sc-btn">
                Подключиться
              </Button>
            )}
            {boardUrl && (
              <Button icon={<FundProjectionScreenOutlined />} href={boardUrl} target="_blank" className="sc-hero-join sc-btn">
                Доска
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="sc-hero-body"><LessonBody lesson={lesson} hw={hw} /></div>
    </div>
  );
}

// Лента «Домашнее задание»: всё, что сделать, по сроку.
function HomeworkFeed({ feed, groupOf }) {
  if (!feed.length) return null;
  return (
    <section className="sc-hw-feed">
      <div className="sc-section-title">🏠 Домашнее задание</div>
      {feed.map(({ item, from, due }, i) => {
        let when;
        if (!due) when = 'к следующему уроку — дата уточняется';
        else if (due.id === from.id) when = `задано на уроке ${shortDate(from)}`;
        else when = `к уроку ${shortDate(due)}`;
        const g = groupOf(from);
        return <ItemRow key={i} item={item} meta={g ? `${when} · ${g.name}` : when} />;
      })}
    </section>
  );
}

export default function StudentCoursePortal({ student }) {
  const [data, setData] = useState(undefined); // undefined — грузим, null — хук недоступен
  const [showPast, setShowPast] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    api.getMyLessons()
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [student.id]);

  const groups = data?.groups || [];
  const lessons = useMemo(
    () => [...(data?.lessons || [])].sort((a, b) => new Date(a.date_plan) - new Date(b.date_plan)),
    [data],
  );
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  // Подписывать класс у урока — только когда их несколько.
  const groupOf = (l) => (groups.length > 1 ? groupsById.get(l.group) : null);
  const hw = useMemo(() => resolveHomework(lessons, (l) => l.items), [lessons]);
  const feed = useMemo(() => homeworkFeed(lessons), [lessons]);

  if (data === undefined) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;

  if (data === null) {
    return <div style={{ padding: 24 }}><Empty description="Расписание сейчас недоступно. Попробуй открыть позже." /></div>;
  }

  if (!groups.length) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Здесь появятся уроки и домашние задания, как только учитель откроет расписание твоего класса или курса." />
      </div>
    );
  }

  const today = dayjs().startOf('day');
  const upcoming = lessons.filter((l) => !dayjs(l.date_plan).isBefore(today));
  const past = lessons
    .filter((l) => dayjs(l.date_plan).isBefore(today) && !dayjs(l.date_plan).isBefore(today.subtract(PAST_DAYS, 'day')))
    .reverse();
  // Герой — ближайший урок, который ещё не прошёл и не отменён.
  const hero = upcoming.find((l) => l.status !== 'cancelled' && untilLabel(l, dateOf(l)) !== 'Завершилось')
    || upcoming.find((l) => l.status !== 'cancelled');
  const rest = upcoming.filter((l) => l !== hero);
  const horizon = today.add(AGENDA_DAYS, 'day');
  const shown = showAll ? rest : rest.filter((l) => dayjs(l.date_plan).isBefore(horizon));
  const hidden = rest.length - shown.length;

  // Расписание по дням.
  const days = [];
  for (const l of shown) {
    const key = dayjs(l.date_plan).format('YYYY-MM-DD');
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, list: [] });
    days[days.length - 1].list.push(l);
  }
  const courses = groups.filter((g) => g.kind === 'course' && (g.conference_url || g.board_url));

  return (
    <div className="sc-portal">
      <h2 className="sc-portal-title"><ReadOutlined /> Мои уроки</h2>

      {courses.map((course) => (
        <div key={course.id} className="sc-course-head">
          <div className="sc-course-name">🎓 {course.name}</div>
          <div className="sc-course-links">
            {course.conference_url && (
              <Button size="small" className="sc-btn" icon={<LinkOutlined />} href={course.conference_url} target="_blank">
                Комната курса
              </Button>
            )}
            {course.board_url && (
              <Button size="small" className="sc-btn" icon={<FundProjectionScreenOutlined />} href={course.board_url} target="_blank">
                Доска
              </Button>
            )}
          </div>
        </div>
      ))}

      <HomeworkFeed feed={feed} groupOf={groupOf} />

      {hero && <NextLessonHero lesson={hero} hw={hw} group={groupsById.get(hero.group)} />}
      {!hero && !lessons.length && <div className="sc-empty-note">Уроков пока нет</div>}

      {days.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-title">Расписание</div>
          {days.map(({ key, list }) => (
            <div key={key} className="sc-day">
              <div className="sc-day-head">{dayjs(key).locale('ru').format('dddd, D MMMM')}</div>
              {list.map((l) => <LessonCard key={l.id} lesson={l} hw={hw} group={groupOf(l)} />)}
            </div>
          ))}
        </div>
      )}
      {hidden > 0 && (
        <button type="button" className="sc-past-toggle" onClick={() => setShowAll(true)}>
          <RightOutlined className="sc-past-caret" /> Показать дальше ({hidden})
        </button>
      )}

      {past.length > 0 && (
        <div className="sc-section">
          <button type="button" className="sc-past-toggle" onClick={() => setShowPast((v) => !v)}>
            <RightOutlined className={`sc-past-caret${showPast ? ' is-open' : ''}`} />
            Прошедшие уроки ({past.length})
          </button>
          {showPast && past.map((l) => <LessonCard key={l.id} lesson={l} hw={hw} group={groupOf(l)} dimmed />)}
        </div>
      )}
    </div>
  );
}
